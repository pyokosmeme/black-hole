#define M_PI 3.141592653589793238462643383279
#define R_SQRT_2 0.7071067811865475
#define DEG_TO_RAD (M_PI/180.0)
#define SQ(x) ((x)*(x))

#define ROT_Y(a) mat3(0, cos(a), sin(a), 1, 0, 0, 0, sin(a), -cos(a))


// spectrum texture lookup helper macros
const float BLACK_BODY_TEXTURE_COORD = 1.0;
const float SINGLE_WAVELENGTH_TEXTURE_COORD = 0.5;
const float TEMPERATURE_LOOKUP_RATIO_TEXTURE_COORD = 0.0;

// black-body texture metadata
const float SPECTRUM_TEX_TEMPERATURE_RANGE = 65504.0;
const float SPECTRUM_TEX_WAVELENGTH_RANGE = 2048.0;
const float SPECTRUM_TEX_RATIO_RANGE = 6.48053329012;

// multi-line macros don't seem to work in WebGL :(
#define BLACK_BODY_COLOR(t) texture2D(spectrum_texture, vec2((t) / SPECTRUM_TEX_TEMPERATURE_RANGE, BLACK_BODY_TEXTURE_COORD))
#define SINGLE_WAVELENGTH_COLOR(lambda) texture2D(spectrum_texture, vec2((lambda) / SPECTRUM_TEX_WAVELENGTH_RANGE, SINGLE_WAVELENGTH_TEXTURE_COORD))
#define TEMPERATURE_LOOKUP(ratio) (texture2D(spectrum_texture, vec2((ratio) / SPECTRUM_TEX_RATIO_RANGE, TEMPERATURE_LOOKUP_RATIO_TEXTURE_COORD)).r * SPECTRUM_TEX_TEMPERATURE_RANGE)

uniform vec2 resolution;
uniform float time;

uniform vec3 cam_pos;
uniform vec3 cam_x;
uniform vec3 cam_y;
uniform vec3 cam_z;
uniform vec3 cam_vel;

uniform float planet_distance, planet_radius;

uniform sampler2D galaxy_texture, star_texture,
    accretion_disk_texture, planet_texture, spectrum_texture;

// ---------------------------------------------------------------- neon fork
// Everything below is additive styling evaluated ALONG the same null
// geodesics as the original: the grid and floor are emitters placed in
// Schwarzschild space, so they get lensed exactly like the stars do.
uniform float grid_strength;    // celestial grid emission
uniform float grid_glow;        // halo width, in pixels
uniform float grid_pulse;       // traveling packets / sweep band
uniform float floor_strength;   // synthwave floor emission
uniform float floor_height;     // camera height above floor (r_s units)
uniform float floor_tilt;       // radians; tilts horizon below eye level
uniform float floor_speed;      // scroll speed (r_s per unit time)
uniform float floor_extent;     // radial fade length around the hole's foot
uniform float disk_temp;        // peak disk temperature (K) for NT profile
uniform float disk_outer;       // outer disk radius (r_s units)
uniform float galaxy_gain;

const vec3 NEON_CYAN    = vec3(0.10, 0.95, 1.00);
const vec3 NEON_MAGENTA = vec3(1.00, 0.12, 0.85);
const vec3 NEON_VIOLET  = vec3(0.55, 0.10, 1.00);

float hash11(float x) { return fract(sin(x * 127.1) * 43758.5453); }

// anti-aliased line + screen-space glow. d, core, fw, glow all in the same units
vec2 neon_line(float d, float core, float fw, float glow) {
    float c = 1.0 - smoothstep(core, core + fw, d);
    float g = exp(-d / max(glow, 1e-6));
    return vec2(c, g);
}
// -------------------------------------------------------------------------

// stepping parameters
const int NSTEPS = {{n_steps}};
const float MAX_REVOLUTIONS = 2.0;

const float ACCRETION_MIN_R = 1.5;
const float ACCRETION_WIDTH = 5.0;
const float ACCRETION_BRIGHTNESS = 0.9;
const float ACCRETION_TEMPERATURE = 3900.0;

const float STAR_MIN_TEMPERATURE = 4000.0;
const float STAR_MAX_TEMPERATURE = 15000.0;

const float STAR_BRIGHTNESS = 1.0;
const float GALAXY_BRIGHTNESS = 0.4;

const float PLANET_AMBIENT = 0.1;
const float PLANET_LIGHTNESS = 1.5;

// background texture coordinate system
mat3 BG_COORDS = ROT_Y(45.0 * DEG_TO_RAD);

// planet texture coordinate system
const float PLANET_AXIAL_TILT = 30.0 * DEG_TO_RAD;
mat3 PLANET_COORDS = ROT_Y(PLANET_AXIAL_TILT);

const float FOV_ANGLE_DEG = 90.0;
// fork: FOV comes from JS so portrait screens aren't 120 deg tall
uniform float fov_mult;
#define FOV_MULT fov_mult

// derived "constants" (from uniforms)
float PLANET_RADIUS,
    PLANET_DISTANCE,
    PLANET_ORBITAL_ANG_VEL,
    PLANET_ROTATION_ANG_VEL,
    PLANET_GAMMA;

vec2 sphere_map(vec3 p) {
    return vec2(atan(p.x,p.y)/M_PI*0.5+0.5, asin(p.z)/M_PI+0.5);
}

float smooth_step(float x, float threshold) {
    const float STEEPNESS = 1.0;
    return 1.0 / (1.0 + exp(-(x-threshold)*STEEPNESS));
}

vec3 lorentz_velocity_transformation(vec3 moving_v, vec3 frame_v) {
    float v = length(frame_v);
    if (v > 0.0) {
        vec3 v_axis = -frame_v / v;
        float gamma = 1.0/sqrt(1.0 - v*v);

        float moving_par = dot(moving_v, v_axis);
        vec3 moving_perp = moving_v - v_axis*moving_par;

        float denom = 1.0 + v*moving_par;
        return (v_axis*(moving_par+v)+moving_perp/gamma)/denom;
    }
    return moving_v;
}

vec3 contract(vec3 x, vec3 d, float mult) {
    float par = dot(x,d);
    return (x-par*d) + d*par*mult;
}

vec4 planet_intersection(vec3 old_pos, vec3 ray, float t, float dt,
        vec3 planet_pos0, float ray_doppler_factor) {

    vec4 ret = vec4(0,0,0,0);
    vec3 ray0 = ray;
    ray = ray/dt;

    vec3 planet_dir = vec3(planet_pos0.y, -planet_pos0.x, 0.0) / PLANET_DISTANCE;

    {{#light_travel_time}}
    float planet_ang1 = (t-dt) * PLANET_ORBITAL_ANG_VEL;
    vec3 planet_pos1 = vec3(cos(planet_ang1), sin(planet_ang1), 0)*PLANET_DISTANCE;
    vec3 planet_vel = (planet_pos1-planet_pos0)/dt;

    // transform to moving planet coordinate system
    ray = ray - planet_vel;
    {{/light_travel_time}}
    {{^light_travel_time}}
    vec3 planet_vel = planet_dir * PLANET_ORBITAL_ANG_VEL * PLANET_DISTANCE;
    {{/light_travel_time}}

    // ray-sphere intersection
    vec3 d = old_pos - planet_pos0;

    {{#lorentz_contraction}}
    ray = contract(ray, planet_dir, PLANET_GAMMA);
    d = contract(d, planet_dir, PLANET_GAMMA);
    {{/lorentz_contraction}}

    float dotp = dot(d,ray);
    float c_coeff = dot(d,d) - SQ(PLANET_RADIUS);
    float ray2 = dot(ray, ray);
    float discr = dotp*dotp - ray2*c_coeff;

    if (discr < 0.0) return ret;
    float isec_t = (-dotp - sqrt(discr)) / ray2;

    float MIN_ISEC_DT = 0.0;
    {{#lorentz_contraction}}
    MIN_ISEC_DT = -dt;
    {{/lorentz_contraction}}

    if (isec_t < MIN_ISEC_DT || isec_t > dt) return ret;

    vec3 surface_point = (d + isec_t*ray) / PLANET_RADIUS;

    isec_t = isec_t/dt;

    vec3 light_dir = planet_pos0;
    float rot_phase = t;

    {{#light_travel_time}}
    light_dir += planet_vel*isec_t*dt;
    rot_phase -= isec_t*dt;
    {{/light_travel_time}}

    rot_phase = rot_phase * PLANET_ROTATION_ANG_VEL*0.5/M_PI;
    light_dir = light_dir / PLANET_DISTANCE;

    {{#light_travel_time}}
    light_dir = light_dir - planet_vel;
    {{/light_travel_time}}

    vec3 surface_normal = surface_point;
    {{#lorentz_contraction}}
    light_dir = contract(light_dir, planet_dir, PLANET_GAMMA);
    {{/lorentz_contraction}}
    light_dir = normalize(light_dir);

    vec2 tex_coord = sphere_map(surface_point * PLANET_COORDS);
    tex_coord.x = mod(tex_coord.x + rot_phase, 1.0);

    float diffuse = max(0.0, dot(surface_normal, -light_dir));
    float lightness = ((1.0-PLANET_AMBIENT)*diffuse + PLANET_AMBIENT) *
        PLANET_LIGHTNESS;

    float light_temperature = ACCRETION_TEMPERATURE;
    {{#doppler_shift}}
    float doppler_factor = SQ(PLANET_GAMMA) *
        (1.0 + dot(planet_vel, light_dir)) *
        (1.0 - dot(planet_vel, normalize(ray)));
    light_temperature /= doppler_factor * ray_doppler_factor;
    {{/doppler_shift}}

    vec4 light_color = BLACK_BODY_COLOR(light_temperature);
    ret = texture2D(planet_texture, tex_coord) * lightness * light_color;
    if (isec_t < 0.0) isec_t = 0.5;
    ret.w = isec_t;

    return ret;
}

vec4 galaxy_color(vec2 tex_coord, float doppler_factor) {

    vec4 color = texture2D(galaxy_texture, tex_coord);
    {{^observerMotion}}
    return color;
    {{/observerMotion}}

    {{#observerMotion}}
    vec4 ret = vec4(0.0,0.0,0.0,0.0);
    float red = max(0.0, color.r - color.g);

    const float H_ALPHA_RATIO = 0.1;
    const float TEMPERATURE_BIAS = 0.95;

    color.r -= red*H_ALPHA_RATIO;

    float i1 = max(color.r, max(color.g, color.b));
    float ratio = (color.g+color.b) / color.r;

    if (i1 > 0.0 && color.r > 0.0) {

        float temperature = TEMPERATURE_LOOKUP(ratio) * TEMPERATURE_BIAS;
        color = BLACK_BODY_COLOR(temperature);

        float i0 = max(color.r, max(color.g, color.b));
        if (i0 > 0.0) {
            temperature /= doppler_factor;
            ret = BLACK_BODY_COLOR(temperature) * max(i1/i0,0.0);
        }
    }

    ret += SINGLE_WAVELENGTH_COLOR(656.28 * doppler_factor) * red / 0.214 * H_ALPHA_RATIO;

    return ret;
    {{/observerMotion}}
}

{{#neon_floor}}
vec3 floor_n, floor_e1, floor_e2, floor_o;
float floor_d;

// Emission (rgb) and opacity (a) of the floor at hit point fp, seen along
// unit direction dir after travelling dist. PIX_ANGLE*dist/cos(i) is the
// pixel footprint on the plane, used for analytic anti-aliasing.
vec4 floor_shade(vec3 fp, vec3 dir, float dist, float pix_angle) {
    vec3 rel = fp - floor_o;
    float rad = length(rel);
    vec2 st = vec2(dot(rel, floor_e1), dot(rel, floor_e2));
    st.y += time * floor_speed;

    float cosi = abs(dot(dir, floor_n));
    float fw = dist * pix_angle / max(cosi, 0.02);

    const float S = 1.0;          // cell size, r_s
    const float W = 0.018;        // line half-width, r_s
    vec2 gd = abs(fract(st / S + 0.5) - 0.5) * S;
    vec2 lx = neon_line(gd.x, W, fw, W + 2.5*fw);
    vec2 ly = neon_line(gd.y, W, fw, W + 2.5*fw);
    // when cells shrink below a few pixels, fade lines to their mean
    float dens = clamp(S / (6.0 * fw), 0.0, 1.0);
    float mean = 2.0 * (W + fw) / S;
    float core = mix(mean * 1.5, max(lx.x, ly.x), dens);
    float glow = mix(mean * 2.0, max(lx.y, ly.y), dens);

    float fade = exp(-rad / floor_extent);
    vec3 fc = NEON_MAGENTA * (1.3*core + 0.35*glow)
            + vec3(1.0, 0.8, 1.0) * core * lx.x * ly.x * 1.2   // hot crossings
            + NEON_VIOLET * 0.025;                              // surface sheen
    // distance haze: grid dissolves into the classic pink horizon band
    vec3 haze = mix(vec3(0.05, 0.0, 0.10), vec3(0.85, 0.15, 0.55), smoothstep(0.6, 1.0, 1.0 - fade));
    fc = mix(haze * 0.45, fc, fade);

    // opacity falls off with distance so the horizon is a soft haze gradient
    float opac = 0.98 * exp(-rad / (2.5 * floor_extent));
    return vec4(fc * floor_strength * mix(0.6, 1.0, opac), opac);
}
{{/neon_floor}}

void main() {

    {{#planetEnabled}}
    // "constants" derived from uniforms
    PLANET_RADIUS = planet_radius;
    PLANET_DISTANCE = max(planet_distance,planet_radius+1.5);
    PLANET_ORBITAL_ANG_VEL = -1.0 / sqrt(2.0*(PLANET_DISTANCE-1.0)) / PLANET_DISTANCE;
    float MAX_PLANET_ROT = max((1.0 + PLANET_ORBITAL_ANG_VEL*PLANET_DISTANCE) / PLANET_RADIUS,0.0);
    PLANET_ROTATION_ANG_VEL = -PLANET_ORBITAL_ANG_VEL + MAX_PLANET_ROT * 0.5;
    PLANET_GAMMA = 1.0/sqrt(1.0-SQ(PLANET_ORBITAL_ANG_VEL*PLANET_DISTANCE));
    {{/planetEnabled}}

    vec2 p = -1.0 + 2.0 * gl_FragCoord.xy / resolution.xy;
    p.y *= resolution.y / resolution.x;

    vec3 pos = cam_pos;
    vec3 ray = normalize(p.x*cam_x + p.y*cam_y + FOV_MULT*cam_z);

    {{#aberration}}
    ray = lorentz_velocity_transformation(ray, cam_vel);
    {{/aberration}}

    float ray_intensity = 1.0;
    float ray_doppler_factor = 1.0;

    float gamma = 1.0/sqrt(1.0-dot(cam_vel,cam_vel));
    ray_doppler_factor = gamma*(1.0 + dot(ray,-cam_vel));
    {{#beaming}}
    ray_intensity /= ray_doppler_factor*ray_doppler_factor*ray_doppler_factor;
    {{/beaming}}
    {{^doppler_shift}}
    ray_doppler_factor = 1.0;
    {{/doppler_shift}}

    float step = 0.01;
    vec4 color = vec4(0.0,0.0,0.0,1.0);

    // initial conditions
    float u = 1.0 / length(pos), old_u;
    float u0 = u;

    vec3 normal_vec = normalize(pos);
    vec3 tangent_vec = normalize(cross(cross(normal_vec, ray), normal_vec));

    float du = -dot(ray,normal_vec) / dot(ray,tangent_vec) * u;
    float du0 = du;

    float phi = 0.0;
    float t = time;
    float dt = 1.0;

    {{^light_travel_time}}
    float planet_ang0 = t * PLANET_ORBITAL_ANG_VEL;
    vec3 planet_pos0 = vec3(cos(planet_ang0), sin(planet_ang0), 0)*PLANET_DISTANCE;
    {{/light_travel_time}}

    vec3 old_pos = pos - ray;
    float trans = 1.0;        // fraction of light still reaching the camera
    float path_len = 0.0;     // affine-ish distance travelled, for AA footprints
    float PIX_ANGLE = 2.0 / (resolution.x * FOV_MULT);
    float DISK_WIDTH = max(disk_outer - ACCRETION_MIN_R, 0.5);

    {{#neon_floor}}
    // Floor rigidly attached to the observer's frame (stylization: it is not
    // boosted with the orbit). Tilt lowers the horizon so the hole sits above it.
    floor_n  = normalize(cam_y * cos(floor_tilt) + cam_z * sin(floor_tilt));
    floor_d  = dot(cam_pos, floor_n) - floor_height;
    floor_e1 = normalize(cam_x - dot(cam_x, floor_n) * floor_n);
    floor_e2 = cross(floor_e1, floor_n);                 // points away from camera
    floor_o  = floor_d * floor_n;                        // foot of the hole on the floor
    {{/neon_floor}}

    for (int j=0; j < NSTEPS; j++) {

        step = MAX_REVOLUTIONS * 2.0*M_PI / float(NSTEPS);

        // adaptive step size, some ad hoc formulas
        float max_rel_u_change = (1.0-log(u))*10.0 / float(NSTEPS);
        if ((du > 0.0 || (du0 < 0.0 && u0/u < 5.0)) && abs(du) > abs(max_rel_u_change*u) / step)
            step = max_rel_u_change*u/abs(du);

        old_u = u;

        {{#light_travel_time}}
        {{#gravitational_time_dilation}}
        dt = sqrt(du*du + u*u*(1.0-u))/(u*u*(1.0-u))*step;
        {{/gravitational_time_dilation}}
        {{/light_travel_time}}

        // Leapfrog scheme
        u += du*step;
        float ddu = -u*(1.0 - 1.5*u*u);
        du += ddu*step;

        if (u < 0.0) break;

        phi += step;

        old_pos = pos;
        pos = (cos(phi)*normal_vec + sin(phi)*tangent_vec)/u;

        ray = pos-old_pos;
        float solid_isec_t = 2.0;
        float ray_l = length(ray);

        {{#light_travel_time}}
        {{#gravitational_time_dilation}}
        float blend = smooth_step(1.0/u, 8.0);
        dt = blend*ray_l + (1.0-blend)*dt;
        {{/gravitational_time_dilation}}
        {{^gravitational_time_dilation}}
        dt = ray_l;
        {{/gravitational_time_dilation}}
        {{/light_travel_time}}

        {{#planetEnabled}}
        if (
            (
                old_pos.z * pos.z < 0.0 ||
                min(abs(old_pos.z), abs(pos.z)) < PLANET_RADIUS
            ) &&
            max(u, old_u) > 1.0/(PLANET_DISTANCE+PLANET_RADIUS) &&
            min(u, old_u) < 1.0/(PLANET_DISTANCE-PLANET_RADIUS)
        ) {

            {{#light_travel_time}}
            float planet_ang0 = t * PLANET_ORBITAL_ANG_VEL;
            vec3 planet_pos0 = vec3(cos(planet_ang0), sin(planet_ang0), 0)*PLANET_DISTANCE;
            {{/light_travel_time}}

            vec4 planet_isec = planet_intersection(old_pos, ray, t, dt,
                    planet_pos0, ray_doppler_factor);
            if (planet_isec.w > 0.0) {
                solid_isec_t = planet_isec.w;
                planet_isec.w = 1.0;
                color += planet_isec * trans;
            }
        }
        {{/planetEnabled}}

        {{#accretion_disk}}
        if (old_pos.z * pos.z < 0.0) {
            // crossed plane z=0

            float acc_isec_t = -old_pos.z / ray.z;
            if (acc_isec_t < solid_isec_t) {
                vec3 isec = old_pos + ray*acc_isec_t;

                float r = length(isec);

                if (r > ACCRETION_MIN_R && r < disk_outer) {
                    float phi_tex = atan(isec.x, isec.y)/M_PI*0.5+0.5;
                    float r_tex = (r-ACCRETION_MIN_R)/DISK_WIDTH;
                    vec2 tex_coord = vec2(r_tex, phi_tex);

                    float accretion_intensity = ACCRETION_BRIGHTNESS;
                    float temperature = ACCRETION_TEMPERATURE;

                    vec3 accretion_v = vec3(-isec.y, isec.x, 0.0) / sqrt(2.0*(r-1.0)) / (r*r);
                    gamma = 1.0/sqrt(1.0-dot(accretion_v,accretion_v));
                    float doppler_factor = gamma*(1.0+dot(ray/ray_l,accretion_v));

                    vec4 disk_tex;
                    {{#disk_flow}}
                    // Keplerian differential rotation, Omega = v/r, using the
                    // retarded time t (light-travel corrected when enabled).
                    // Two layers reset out of phase and crossfade (flow-map
                    // trick) so the pattern shears locally but never winds up.
                    {
                        float omega = 1.0 / (r * sqrt(2.0*(r-1.0)));
                        const float P = 60.0;
                        float c1 = t / P, c2 = t / P + 0.5;
                        float f1 = fract(c1), f2 = fract(c2);
                        float w1 = 1.0 - abs(2.0*f1 - 1.0);
                        float rot1 = omega*f1*P/(2.0*M_PI) + 0.618*floor(c1);
                        float rot2 = omega*f2*P/(2.0*M_PI) + 0.618*floor(c2) + 0.31;
                        vec2 o2 = vec2(0.0, 0.5);
                        vec4 a1 = texture2D(accretion_disk_texture, vec2(r_tex, phi_tex + rot1));
                        vec4 a2 = texture2D(accretion_disk_texture, vec2(r_tex, phi_tex + rot2));
                        vec4 b1 = texture2D(accretion_disk_texture, vec2(r_tex*1.9+0.13, 2.0*(phi_tex + rot1)));
                        vec4 b2 = texture2D(accretion_disk_texture, vec2(r_tex*1.9+0.13, 2.0*(phi_tex + rot2)));
                        disk_tex = mix(a2*0.7 + b2*0.45, a1*0.7 + b1*0.45, w1);
                    }
                    {{/disk_flow}}
                    {{^disk_flow}}
                    disk_tex = texture2D(accretion_disk_texture, tex_coord);
                    {{/disk_flow}}
                    {{#disk_profile}}
                    // more streak contrast so the shear/flow reads (fork styling)
                    disk_tex = pow(max(disk_tex, 0.0), vec4(1.7)) * 1.8;
                    {{/disk_profile}}

                    {{#disk_profile}}
                    // Novikov-Thorne / Shakura-Sunyaev: T ~ r^-3/4 (1 - sqrt(r_in/r))^1/4,
                    // r_in = ISCO = 3 r_s, normalised to peak 1 at r = 49/36 r_in.
                    // Inside the ISCO a dim bump stands in for plunging gas.
                    {
                        const float R_ISCO = 3.0;
                        float q = R_ISCO / r;
                        float f_nt = pow(q, 0.75) * pow(max(1.0 - sqrt(q), 0.0), 0.25) / 0.4880;
                        float f_pl = 0.45 * exp(-SQ((r - R_ISCO) / 0.7));
                        float f = max(f_nt, f_pl);
                        temperature = disk_temp * f;
                        accretion_intensity *= 3.5 * f*f*f*f;   // bolometric ~ T^4
                    }
                    {{/disk_profile}}

                    {{#grav_redshift}}
                    // static emitter -> static observer at r_cam: sqrt(g_tt(r)/g_tt(r_cam))
                    {
                        float g_grav = sqrt(max(1.0 - 1.0/r, 0.0) / (1.0 - u0));
                        temperature *= g_grav;
                        accretion_intensity *= g_grav*g_grav*g_grav;
                    }
                    {{/grav_redshift}}

                    {{#beaming}}
                    accretion_intensity /= doppler_factor*doppler_factor*doppler_factor;
                    {{/beaming}}
                    {{#doppler_shift}}
                    temperature /= ray_doppler_factor*doppler_factor;
                    {{/doppler_shift}}

                    color += disk_tex
                        * accretion_intensity
                        * BLACK_BODY_COLOR(temperature) * trans;
                }
            }
        }
        {{/accretion_disk}}

        {{#neon_floor}}
        {
            float h0 = dot(old_pos, floor_n) - floor_d;
            float h1 = dot(pos, floor_n) - floor_d;
            if (h0 * h1 < 0.0) {
                float ft = h0 / (h0 - h1);
                if (ft < solid_isec_t) {
                    vec4 fs = floor_shade(mix(old_pos, pos, ft), ray / ray_l,
                                          path_len + ft * ray_l, PIX_ANGLE);
                    // images that wrapped > ~pi around the hole live in a sliver at
                    // the photon ring and alias to sparkle: fade them out
                    fs *= smoothstep(1.6 * M_PI, 1.15 * M_PI, phi);
                    color.rgb += fs.rgb * trans;
                    trans *= 1.0 - fs.a;
                }
            }
        }
        {{/neon_floor}}
        path_len += ray_l;

        {{#light_travel_time}}
        t -= dt;
        {{/light_travel_time}}

        if (solid_isec_t <= 1.0) u = 2.0; // break
        if (u > 1.0) break;
    }

    vec3 esc = normalize(pos - old_pos);

    {{#neon_floor}}
    if (u < 1.0) {
        float h = dot(pos, floor_n) - floor_d;
        float dn = dot(esc, floor_n);
        if (h > 0.0 && dn < 0.0) {
            float sd = -h / dn;
            vec4 fs = floor_shade(pos + esc * sd, esc, path_len + sd, PIX_ANGLE);
            fs *= smoothstep(1.6 * M_PI, 1.15 * M_PI, phi);
            color.rgb += fs.rgb * trans;
            trans *= 1.0 - fs.a;
        }
    }
    {{/neon_floor}}
    vec3 gdir = esc * BG_COORDS;

    {{#neon_grid}}
    // Analytic celestial grid on the escape direction: exact lensing, crisp at
    // any resolution, no texture filtering. fwidth of the unit vector is the
    // pixel's angular footprint and is seam-free (unlike fwidth(atan)).
    vec3 grid_rgb = vec3(0.0);
    {
        float fw = max(length(fwidth(gdir)), 1e-5);
        float lat = asin(clamp(gdir.z, -1.0, 1.0));
        float lon = atan(gdir.x, gdir.y);
        const float LAT_STEP = M_PI / 24.0;
        const float LON_STEP = 2.0 * M_PI / 48.0;
        float dlat = abs(fract(lat / LAT_STEP + 0.5) - 0.5) * LAT_STEP;
        float dlon = abs(fract(lon / LON_STEP + 0.5) - 0.5) * LON_STEP * cos(lat);
        // meridians converge at the poles; drop them near the pole cap
        float pole = smoothstep(0.985, 0.995, abs(gdir.z));

        float core = 0.0012;                                 // ~0.07 deg
        float glow = min(grid_glow * fw, 0.3 * LAT_STEP);    // screen-space halo
        vec2 a = neon_line(dlat, core, fw, glow);
        vec2 b = neon_line(dlon, core, fw, glow);
        b *= 1.0 - pole;

        // where lensing compresses the grid below pixel scale (photon ring),
        // fade to the mean rather than aliasing into moire
        float dens = clamp(LAT_STEP / (8.0 * fw), 0.0, 1.0);

        // packets running along meridians, each with its own speed and phase
        float id = floor(lon / LON_STEP + 0.5);
        float h = hash11(id + 3.7);
        float k = fract((lat / M_PI + 0.5) * 2.0 + time * 0.012 * (0.4 + h) + h * 9.0);
        float packet = exp(-k * 40.0) + 0.25 * exp(-k * 6.0);
        // a latitude band sweeping pole to pole; through the lens it becomes arcs
        float band_lat = (fract(time * 0.004) - 0.5) * M_PI;
        float band = exp(-abs(lat - band_lat) / 0.06);

        float A = (1.2 * a.x + 0.35 * a.y) * (1.0 + 2.5 * grid_pulse * band);
        float B = (1.2 * b.x + 0.35 * b.y) * (1.0 + 4.0 * grid_pulse * packet);
        grid_rgb = (NEON_CYAN * A + NEON_MAGENTA * B
                 + vec3(1.0) * a.x * b.x * 2.0
                 + NEON_CYAN * 0.06 * grid_pulse * band) * dens
                 + (NEON_CYAN + NEON_MAGENTA) * 0.04 * (1.0 - dens);
        // rays still orbiting when the step budget ran out (photon ring) have no
        // meaningful escape direction; don't let them sparkle
        grid_rgb *= grid_strength * smoothstep(0.08, 0.02, u);
    }
    {{/neon_grid}}

    // the event horizon is at u = 1
    if (u < 1.0) {
        ray = esc;
        vec2 tex_coord = sphere_map(gdir);
        float t_coord;

        vec4 star_color = texture2D(star_texture, tex_coord);
        if (star_color.r > 0.0) {
            t_coord = (STAR_MIN_TEMPERATURE +
                (STAR_MAX_TEMPERATURE-STAR_MIN_TEMPERATURE) * star_color.g)
                 / ray_doppler_factor;

            color += BLACK_BODY_COLOR(t_coord) * star_color.r * STAR_BRIGHTNESS * trans;
        }

        color += galaxy_color(tex_coord, ray_doppler_factor) * GALAXY_BRIGHTNESS * galaxy_gain * trans;
        {{#neon_grid}}
        color.rgb += grid_rgb * trans;
        {{/neon_grid}}
    }

    gl_FragColor = color*ray_intensity;
}

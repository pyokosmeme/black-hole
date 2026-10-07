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
{{#viewerSky}}
uniform mat3 sky_rotation;
{{/viewerSky}}

uniform vec3 cam_pos;
{{#diskTilt}}
uniform vec3 disk_n, disk_bx, disk_by;
{{/diskTilt}}
uniform vec3 cam_x;
uniform vec3 cam_y;
uniform vec3 cam_z;
uniform vec3 cam_vel;

uniform float planet_distance, planet_radius;
uniform float planet_eccentricity, planet_phase, planet_speed, planet_spin, planet_texture_offset;
uniform vec3 planet_bx, planet_by, planet_tx, planet_ty, planet_tz;

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
uniform float floor_concentration, floor_reflection, floor_roughness, reflection_pass, gas_tint;
uniform vec3 gas_color, reflect_pos, reflect_x, reflect_y, reflect_z;
uniform sampler2D reflection_tex;
uniform float floor_sparkle, floor_dunes, hole_glow, snowfall;
uniform vec3 hole_glow_color;
uniform vec3 floor_rim_color, floor_shadow_color;
{{#floorTint}}
uniform vec3 floor_color, floor_major_color;
{{/floorTint}}

// lastnpcalex.agency palette: --cyan #00ffff, --purple #bf00ff, deep #4a1868
const vec3 SITE_CYAN   = vec3(0.000, 1.000, 1.000);
const vec3 SITE_PURPLE = vec3(0.749, 0.000, 1.000);
const vec3 SITE_DEEP   = vec3(0.290, 0.094, 0.408);

uniform float floor_cell;      // grid cell size (r_s)
uniform float floor_x, floor_y;
uniform vec2 floor_offset;     // accumulated drift across the floor (r_s), integrated in JS
uniform vec3 floor_bx, floor_by, floor_bz;   // camera basis WITHOUT wobble: floor stays level
uniform float disk_speed;      // 1 = Keplerian
uniform float spot_strength;   // orbiting hot spots

// cheap 3D value noise for the disk turbulence
float vhash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vnoise(vec3 x) {
    vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(vhash(i), vhash(i + vec3(1,0,0)), f.x), mix(vhash(i + vec3(0,1,0)), vhash(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(vhash(i + vec3(0,0,1)), vhash(i + vec3(1,0,1)), f.x), mix(vhash(i + vec3(0,1,1)), vhash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float vfbm(vec3 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * vnoise(p); p = p * 2.07 + 5.3; a *= 0.5; } return s; }

// Gas pattern in the frame co-rotating with the Keplerian flow, started at
// epoch t0: angle advanced by Omega(r) (t - t0) so the pattern shears like
// the real flow. Azimuth enters as a circle in noise space, so no seam.
float disk_gas(float r, float ang, float dt_epoch, float seed) {
    float omega = disk_speed * sqrt(0.5 / (r*r*r));   // coordinate Omega, r_s = 1
    float a = ang - omega * dt_epoch;
    vec3 q = vec3(cos(a) * 2.2, sin(a) * 2.2, log(r) * 7.0 + seed);
    float n = vfbm(q);
    return n + 0.5 * vfbm(q * 2.6 + vec3(n * 2.0));   // fine filaments riding the clumps
}

float hash11(float x) { return fract(sin(x * 127.1) * 43758.5453); }

// Falling snow: layered crystal flakes (six-armed dendrites with side branches) composited
// over the finished frame. Arms pointing at the hole catch its crimson light; flakes glint.
vec3 sfh(vec2 id, float s) {
    vec3 p3 = fract(vec3(id.xyx) * vec3(0.1031, 0.1030, 0.0973) + s);
    p3 += dot(p3, p3.yxz + 33.33);
    return fract((p3.xxy + p3.yzz) * p3.zyx);
}

float ray_acceleration(float u) {
    {{#photon_eq_fix}}
    return -u * (1.0 - 1.5 * u);
    {{/photon_eq_fix}}
    {{^photon_eq_fix}}
    return -u * (1.0 - 1.5 * u * u);
    {{/photon_eq_fix}}
}

// Advance position and derivative at the same angular time. The old
// drift/kick update left the escape direction dependent on the last step.
vec2 ray_advance(vec2 state, float h) {
    vec2 a = vec2(state.y, ray_acceleration(state.x));
    vec2 bstate = state + 0.5 * h * a;
    vec2 b = vec2(bstate.y, ray_acceleration(bstate.x));
    vec2 cstate = state + 0.5 * h * b;
    vec2 c = vec2(cstate.y, ray_acceleration(cstate.x));
    vec2 dstate = state + h * c;
    vec2 d = vec2(dstate.y, ray_acceleration(dstate.x));
    return state + h * (a + 2.0 * b + 2.0 * c + d) / 6.0;
}

// anti-aliased line + screen-space glow. d, core, fw, glow all in the same units
vec2 neon_line(float d, float core, float fw, float glow) {
    // Integrate the thin line across a pixel instead of expanding its edge
    // by a whole footprint. Subpixel lines keep their coverage without blur.
    float pixel = max(fw, 1e-6);
    float c = clamp((core - d) / pixel + 0.5, 0.0, 1.0)
            - clamp((-core - d) / pixel + 0.5, 0.0, 1.0);
    float g = glow > 0.0 ? exp(-d / glow) : 0.0;
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

// Kepler ellipse in its own plane, then rotated into world space.
float planet_anomaly(float epoch) {
    float a=max(planet_distance,planet_radius+1.5);
    float n=-planet_speed/sqrt(2.0*(a-1.0))/a;
    float m=mod(epoch*n+planet_phase+M_PI,2.0*M_PI)-M_PI;
    float E=m;
    for(int k=0;k<8;k++) E-=(E-planet_eccentricity*sin(E)-m)/max(1.0-planet_eccentricity*cos(E),0.2);
    return E;
}
vec3 planet_position(float epoch) {
    float E=planet_anomaly(epoch),a=max(planet_distance,planet_radius+1.5),e=planet_eccentricity;
    return a*((cos(E)-e)*planet_bx+sqrt(1.0-e*e)*sin(E)*planet_by);
}
vec3 planet_velocity(float epoch) {
    float E=planet_anomaly(epoch),a=max(planet_distance,planet_radius+1.5),e=planet_eccentricity;
    float rate=(-planet_speed/sqrt(2.0*(a-1.0))/a)/max(1.0-e*cos(E),0.2);
    return a*rate*(-sin(E)*planet_bx+sqrt(1.0-e*e)*cos(E)*planet_by);
}
vec4 planet_intersection(vec3 old_pos, vec3 ray, float t, float dt,
        vec3 planet_pos0, float ray_doppler_factor) {

    vec4 ret = vec4(0,0,0,0);
    vec3 ray0 = ray;
    dt=max(dt,0.00001);
    ray = ray/dt;
    vec3 velocity0=planet_velocity(t);
    vec3 planet_dir=length(velocity0)>0.00001?normalize(velocity0):planet_by;
    float planet_gamma=1.0/sqrt(max(1.0-dot(velocity0,velocity0),0.01));

    {{#light_travel_time}}
    vec3 planet_pos1 = planet_position(t-dt);
    vec3 planet_vel = (planet_pos1-planet_pos0)/dt;

    // transform to moving planet coordinate system
    ray = ray - planet_vel;
    {{/light_travel_time}}
    {{^light_travel_time}}
    vec3 planet_vel = velocity0;
    {{/light_travel_time}}

    // ray-sphere intersection
    vec3 d = old_pos - planet_pos0;

    {{#lorentz_contraction}}
    ray = contract(ray, planet_dir, planet_gamma);
    d = contract(d, planet_dir, planet_gamma);
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

    rot_phase = rot_phase * planet_spin*0.5/M_PI;
    light_dir = normalize(light_dir);

    {{#light_travel_time}}
    light_dir = light_dir - planet_vel;
    {{/light_travel_time}}

    vec3 surface_normal = surface_point;
    {{#lorentz_contraction}}
    light_dir = contract(light_dir, planet_dir, planet_gamma);
    {{/lorentz_contraction}}
    light_dir = normalize(light_dir);

    vec3 surface_unit=normalize(surface_point);
    vec2 tex_coord = sphere_map(vec3(dot(surface_unit,planet_tx),dot(surface_unit,planet_ty),dot(surface_unit,planet_tz)));
    tex_coord.x = mod(tex_coord.x + rot_phase + planet_texture_offset, 1.0);

    float diffuse = max(0.0, dot(surface_normal, -light_dir));
    float lightness = ((1.0-PLANET_AMBIENT)*diffuse + PLANET_AMBIENT) *
        PLANET_LIGHTNESS;

    float light_temperature = ACCRETION_TEMPERATURE;
    {{#doppler_shift}}
    float doppler_factor = SQ(planet_gamma) *
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
    {{#neon_sky}}
    // The original refits each texel to a blackbody and shifts its
    // temperature, which turns saturated neon into beige. Stylized
    // stand-in: tint toward red when redshifted (D > 1), blue when
    // blueshifted. Intensity beaming is still applied to the whole frame.
    {
        float D = clamp(doppler_factor, 0.3, 3.0);
        vec3 tint = vec3(pow(D, 0.9), 1.0, pow(D, -0.9));
        return vec4(color.rgb * tint / max(max(tint.r, tint.b), 1.0) * 1.2, color.a);
    }
    {{/neon_sky}}
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

{{#look.floor_snow}}
float dh21(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float dn2(vec2 p) {
    vec2 i = floor(p), f = fract(p); f = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
    return mix(mix(dh21(i), dh21(i + vec2(1.0, 0.0)), f.x), mix(dh21(i + vec2(0.0, 1.0)), dh21(i + vec2(1.0, 1.0)), f.x), f.y);
}

// Flowing wind-swept dunes: sinuous crests whose phase is warped by low-frequency
// noise, so ridges meander, split and merge instead of repeating as sine bands.
float dune_elevation(vec2 st) {
    float lateral = st.x;
    float depth = max(0.0, st.y);
    float nearRamp = smoothstep(0.8, 3.5, depth);
    float distFade = mix(0.34, 1.0, smoothstep(90.0, 22.0, depth));

    // central valley cradling the hole; both flanks climb and roll over
    float flank = smoothstep(2.0, 17.0, abs(lateral)) * 0.95
                + exp(-pow((abs(lateral) - 10.0) / 5.0, 2.0)) * 0.55;

    vec2 w = vec2(dn2(st * 0.07 + 3.1), dn2(st * 0.07 + 8.7)) - 0.5;
    vec2 q = st + w * 16.0;

    float ph1 = q.y * 0.34 + (dn2(q * vec2(0.10, 0.14)) - 0.5) * 6.5 + q.x * 0.06;
    float d1 = pow(0.5 + 0.5 * sin(ph1 - 0.5 * cos(ph1)), 2.0) * 0.62;
    float ph2 = q.y * 0.71 + (dn2(q * vec2(0.16, 0.24) + 5.0) - 0.5) * 5.0 - q.x * 0.09;
    float d2 = pow(0.5 + 0.5 * sin(ph2 - 0.4 * cos(ph2)), 2.2) * 0.34;
    float cres = pow(1.0 - abs(2.0 * dn2(q * vec2(0.34, 0.62) + 11.0) - 1.0), 3.0) * 0.14;
    float swell = dn2(st * 0.045 + 21.0) * 0.55;

    float total = (0.30 + flank + d1 + d2 + cres + swell) * floor_dunes;
    // distant ridgelines that climb past eye level, so the horizon is a broken silhouette, not a flat line
    float farK = smoothstep(24.0, 78.0, depth);
    float ridge = pow(1.0 - abs(2.0 * dn2(q * vec2(0.045, 0.10) + 31.0) - 1.0), 1.5);
    float mount = (0.15 + 0.85 * ridge) * pow(dn2(st * vec2(0.035, 0.02) + 9.0), 1.6) * 1.0 * 9.0 * farK;
    return min(12.0, total * nearRamp * distFade + mount * floor_dunes);
}

// Fine wind ripples that follow the flow of the dunes (the long crest lines).
float dune_ripples(vec2 st) {
    vec2 q = st + (vec2(dn2(st * 0.45 + 1.3), dn2(st * 0.45 + 7.7)) - 0.5) * 2.4;
    float r1 = 0.5 + 0.5 * sin(q.y * 6.0 + q.x * 0.7 + 2.6 * dn2(q * vec2(0.30, 1.0)));
    float r2 = 0.5 + 0.5 * sin(q.y * 13.0 - q.x * 1.5 + 3.4 * dn2(q * vec2(0.7, 2.2) + 4.0));
    float r3 = dn2(q * vec2(2.0, 6.0));
    return clamp(pow(r1, 1.7) * 0.55 + pow(r2, 2.2) * 0.30 + r3 * 0.15, 0.0, 1.0);
}
{{/look.floor_snow}}

// Emission (rgb) and opacity (a) of the floor at hit point fp, seen along
// unit direction dir after travelling dist. PIX_ANGLE*dist/cos(i) is the
// pixel footprint on the plane, used for analytic anti-aliasing.
vec4 floor_shade(vec3 fp, vec3 dir, float dist, float pix_angle) {
    if (reflection_pass > 0.5) return vec4(0.0);
    vec3 rel = fp - floor_o;
    float rad = length(rel);
    vec2 st = vec2(dot(rel, floor_e1), dot(rel, floor_e2));
    st += floor_offset;

    float cosi = abs(dot(dir, floor_n));
    float fw = dist * pix_angle / max(cosi, 0.02);

    float S = floor_cell;         // cell size, r_s
    float W = 0.006 * S;          // thin line half-width scales with the cell
    vec2 gd = abs(fract(st / S + 0.5) - 0.5) * S;
    vec2 lx = neon_line(gd.x, W, fw, 0.0);
    vec2 ly = neon_line(gd.y, W, fw, 0.0);
    // when cells shrink below a few pixels, fade lines to their mean
    float dens = clamp(S / (6.0 * fw), 0.0, 1.0);
    float mean = 2.0 * W / S;
    float core = mix(2.0 * mean - mean * mean,
                     lx.x + ly.x - lx.x * ly.x, dens);

    // major lines every 4 cells in the site's cyan
    float S4 = 4.0 * S;
    float W4 = 1.4 * W;
    vec2 gm = abs(fract(st / S4 + 0.5) - 0.5) * S4;
    vec2 mx = neon_line(gm.x, W4, fw, 0.0);
    vec2 my = neon_line(gm.y, W4, fw, 0.0);
    float dens4 = clamp(S4 / (6.0 * fw), 0.0, 1.0);
    float mean4 = 2.0 * W4 / S4;
    float mcore = mix(2.0 * mean4 - mean4 * mean4,
                      mx.x + my.x - mx.x * my.x, dens4);
    {{#look.floor_infinite}}
    // Filter each family separately. A receding line is sharp in one axis
    // even when the footprint along the plane is enormous in the other.
    vec2 along = vec2(dot(dir,floor_e1),dot(dir,floor_e2));
    vec2 footprint = dist * pix_angle * sqrt(vec2(1.0) + along*along / max(cosi*cosi,0.000001));
    // Keep resolved wires at a fraction of a pixel, rather than dimming them
    // away. Once spacing is subpixel, their actual coverage fills the pixel.
    vec2 width = max(min(vec2(W),footprint*0.55),min(footprint*0.32,vec2(S*0.08)));
    vec2 majorWidth = max(min(vec2(W4),footprint*0.55),min(footprint*0.32,vec2(S4*0.08)));
    vec2 density = smoothstep(1.5,4.0,S/footprint);
    vec2 majorDensity = smoothstep(1.5,4.0,S4/footprint);
    vec2 wires = mix(min(2.0*width/S,vec2(1.0)),vec2(neon_line(gd.x,width.x,footprint.x,0.0).x,neon_line(gd.y,width.y,footprint.y,0.0).x),density);
    vec2 majorWires = mix(min(2.0*majorWidth/S4,vec2(1.0)),vec2(neon_line(gm.x,majorWidth.x,footprint.x,0.0).x,neon_line(gm.y,majorWidth.y,footprint.y,0.0).x),majorDensity);
    core = wires.x+wires.y-wires.x*wires.y;
    mcore = majorWires.x+majorWires.y-majorWires.x*majorWires.y;
    {{/look.floor_infinite}}

    {{#look.floor_infinite}}
    // An infinite emitting plane has no arbitrary radial cutoff.
    float fade = 1.0;
    {{/look.floor_infinite}}
    {{^look.floor_infinite}}
    float fade = exp(-rad / floor_extent);
    {{/look.floor_infinite}}
    // purple stays out from under the cyan lines (it was shifting them blue);
    // core gains are set so cores land on the site hex after the tonemap
    float major = mcore;
    float minor = core * (1.0 - major);
    vec3 fc = SITE_PURPLE * (1.3 * minor)
            + SITE_CYAN * (1.8 * mcore)
            + vec3(0.85, 1.0, 1.0) * mcore * mx.x * my.x * 1.5;
    {{#floorTint}}
    // The same pigments shade both nearby wires and their integrated light.
    fc = floor_color * (1.3 * minor) + floor_major_color * (1.8 * major);
    {{/floorTint}}
    // Transparent mode occludes only the wires and the partial reflection.
    float opac = clamp((minor + major) * floor_strength, 0.0, 1.0) * fade;
    {{#look.floor_infinite}}
    // Keep the filtered mean wire emission as projected cells shrink. Their
    // integrated light concentrates toward the vanishing line, only where
    // this ray actually intersects the plane; there is no horizon stripe.
    // Use distance's angular footprint here, rather than the grazing-angle
    // footprint used to filter individual wires. That confines the integrated
    // glow to the furthest subpixel cells instead of brightening a broad band.
    float horizonDensity = clamp(S4 / max(6.0 * dist * pix_angle, 0.0001), 0.0, 1.0);
    fc *= 1.0 + 0.15 * floor_concentration * pow(1.0 - horizonDensity, 3.0);
    {{/look.floor_infinite}}
    vec3 reflected = vec3(0.0);
    if (floor_reflection > 0.0) {
        vec3 v = fp - reflect_pos;
        float depth = dot(v, reflect_z);
        vec2 uv = 0.5 + 0.5 * fov_mult * vec2(dot(v, reflect_x), dot(v, reflect_y) * resolution.x / resolution.y) / max(depth, 0.0001);
        if (depth > 0.0 && min(uv.x,uv.y)>=0.0 && max(uv.x,uv.y)<=1.0) {
            vec2 blur = vec2(1.0, resolution.x/resolution.y) * floor_roughness * 0.015;
            reflected = texture2D(reflection_tex,uv).rgb * 0.4;
            reflected += (texture2D(reflection_tex,uv+vec2(blur.x,0.0)).rgb + texture2D(reflection_tex,uv-vec2(blur.x,0.0)).rgb + texture2D(reflection_tex,uv+vec2(0.0,blur.y)).rgb + texture2D(reflection_tex,uv-vec2(0.0,blur.y)).rgb) * 0.15;
        }
        float mirror = floor_reflection * fade;
        reflected *= mirror * (1.0-opac);
        opac = opac + mirror * (1.0-opac);
    }
    {{#look.floor_opaque}}
    // The mirror rests on a solid surface: unreflected light is absorbed,
    // rather than revealing the sky or the scene beneath the plane.
    opac = fade;
    {{/look.floor_opaque}}
    return vec4(fc * floor_strength * fade + reflected, opac);
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
    {{#neon_floor}}{{^look.floor_lensing}}
    vec3 floor_camera_ray=ray;
    {{/look.floor_lensing}}{{/neon_floor}}

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

    // Schwarzschild impact parameter of this ray (critical b = 3*sqrt(3)/2 r_s);
    // drives the photon-ring glow, which is lensed light from the thin gas that
    // orbits at the photon sphere.
    float sin_psi = clamp(length(cross(normal_vec, normalize(ray))), 0.0, 1.0);
    float impact_b = sin_psi / (u0 * sqrt(max(1.0 - u0 * sin_psi * sin_psi, 1e-4)));

    float phi = 0.0;
    float t = time;
    float dt = 1.0;

    {{^light_travel_time}}
    vec3 planet_pos0 = planet_position(t);
    {{/light_travel_time}}

    vec3 old_pos = pos - ray;
    float trans = 1.0;        // fraction of light still reaching the camera
    float path_len = 0.0;     // affine-ish distance travelled, for AA footprints
    float PIX_ANGLE = 2.0 / (resolution.x * FOV_MULT);
    float DISK_WIDTH = max(disk_outer - ACCRETION_MIN_R, 0.5);

    {{#neon_floor}}
    // Floor rigidly attached to the observer's frame (stylization: it is not
    // boosted with the orbit). Tilt lowers the horizon so the hole sits above it.
    floor_n  = normalize(floor_by * cos(floor_tilt) + floor_bz * sin(floor_tilt));
    {{#look.floor_follow_camera}}
    floor_d  = dot(cam_pos, floor_n) - floor_height;
    {{/look.floor_follow_camera}}
    {{^look.floor_follow_camera}}
    floor_d  = -floor_height;
    {{/look.floor_follow_camera}}
    floor_e1 = normalize(floor_bx - dot(floor_bx, floor_n) * floor_n);
    floor_e2 = cross(floor_e1, floor_n);                 // points away from camera
    floor_o  = floor_d * floor_n + floor_x*floor_e1 + floor_y*floor_e2;
    {{/neon_floor}}

    float last_u = u, last_du = du, last_phi = 0.0;

    for (int j=0; j < NSTEPS; j++) {
        last_u = u; last_du = du; last_phi = phi;

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

        vec2 next_ray = ray_advance(vec2(u, du), step);
        u = next_ray.x;
        du = next_ray.y;

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
            max(u, old_u) > 1.0/(PLANET_DISTANCE*(1.0+planet_eccentricity)+PLANET_RADIUS) &&
            min(u, old_u) < 1.0/(PLANET_DISTANCE*(1.0-planet_eccentricity)-PLANET_RADIUS)
        ) {

            {{#light_travel_time}}
            vec3 planet_pos0 = planet_position(t);
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
        {{#diskTilt}}
        float disk_h0 = dot(old_pos, disk_n), disk_h1 = dot(pos, disk_n);
        if (disk_h0 * disk_h1 < 0.0) {
            float acc_isec_t = -disk_h0 / dot(ray, disk_n);
        {{/diskTilt}}
        {{^diskTilt}}
        if (old_pos.z * pos.z < 0.0) {
            // crossed plane z=0

            float acc_isec_t = -old_pos.z / ray.z;
        {{/diskTilt}}
            if (acc_isec_t < solid_isec_t) {
                vec3 isec = old_pos + ray*acc_isec_t;
                {{#diskTilt}}
                vec3 disk_isec = vec3(dot(isec,disk_bx),dot(isec,disk_by),0.0);
                {{/diskTilt}}
                {{^diskTilt}}
                vec3 disk_isec = isec;
                {{/diskTilt}}

                float r = length(isec);

                if (r > ACCRETION_MIN_R && r < disk_outer * 1.25) {
                    float phi_tex = atan(disk_isec.x, disk_isec.y)/M_PI*0.5+0.5;
                    float r_tex = (r-ACCRETION_MIN_R)/DISK_WIDTH;
                    vec2 tex_coord = vec2(r_tex, phi_tex);

                    float accretion_intensity = ACCRETION_BRIGHTNESS;
                    float temperature = ACCRETION_TEMPERATURE;

                    {{#diskTilt}}
                    vec3 accretion_v = (-disk_isec.y*disk_bx + disk_isec.x*disk_by) / sqrt(2.0*(r-1.0)) / (r*r);
                    {{/diskTilt}}
                    {{^diskTilt}}
                    vec3 accretion_v = vec3(-isec.y, isec.x, 0.0) / sqrt(2.0*(r-1.0)) / (r*r);
                    {{/diskTilt}}
                    gamma = 1.0/sqrt(1.0-dot(accretion_v,accretion_v));
                    float doppler_factor = gamma*(1.0+dot(ray/ray_l,accretion_v));

                    vec4 disk_tex = texture2D(accretion_disk_texture, vec2(min(r_tex, 1.0), phi_tex));
                    float spot = 0.0;
                    // retarded time AT the crossing: t is only updated once per
                    // step, and using it raw makes the gas pattern jump wherever
                    // neighbouring rays cross on different steps
                    float t_hit = t;
                    {{#light_travel_time}}
                    t_hit = t - dt * acc_isec_t;
                    {{/light_travel_time}}
                    // soft outer edge: density tapers over the outer ~35%, and
                    // the gas pattern (below) pushes the edge in and out
                    float edge_r = r;
                    {{#disk_flow}}
                    // The ring texture is azimuthally uniform (it varies ~40x
                    // more in r than in phi), so rotating it shows nothing.
                    // Instead: procedural gas advected by Keplerian rotation in
                    // retarded coordinate time t. Two epochs, each reset every
                    // EPOCH, crossfade with a variance-preserving blend, so the
                    // pattern shears into spirals without winding up and
                    // without the contrast loss of a plain mix.
                    {
                        float ang = atan(disk_isec.y, disk_isec.x);
                        const float EPOCH = 90.0;
                        float c1 = t_hit / EPOCH, c2 = c1 + 0.5;
                        float f1 = fract(c1), f2 = fract(c2);
                        float w1 = 1.0 - abs(2.0*f1 - 1.0), w2 = 1.0 - w1;
                        float g1 = disk_gas(r, ang, f1 * EPOCH, 13.1 * floor(c1));
                        float g2 = disk_gas(r, ang, f2 * EPOCH, 13.1 * floor(c2) + 57.0);
                        float g = 0.75 + ((g1 - 0.75) * w1 + (g2 - 0.75) * w2) / sqrt(w1*w1 + w2*w2);
                        float clump = smoothstep(0.45, 1.15, g);
                        disk_tex *= 0.25 + 1.6 * clump;
                        edge_r = r * (1.0 - 0.18 * (g - 0.75));

                        // Orbiting hot spots (cf. GRAVITY flares near Sgr A*):
                        // Gaussian blobs on circular Keplerian orbits, stretched
                        // along phi. They pass through the same beaming/Doppler
                        // code below, so the approaching side flashes.
                        for (int k = 0; k < 3; k++) {
                            float fk = float(k);
                            float rk = 3.4 + 1.9 * fk + 0.6 * sin(fk * 2.3);
                            float ok = disk_speed * sqrt(0.5 / (rk*rk*rk));
                            float pk = fk * 2.1 + ok * t_hit;
                            float dphi = mod(ang - pk + M_PI, 2.0 * M_PI) - M_PI;
                            float dr = (r - rk) / 0.35;
                            float ds = dphi * rk / 1.1;
                            spot += exp(-dr*dr - ds*ds) * (0.8 + 0.4 * sin(fk * 4.7 + t_hit * 0.05));
                        }
                        spot *= spot_strength;
                    }
                    {{/disk_flow}}
                    {{#disk_profile}}
                    // more streak contrast (fork styling)
                    disk_tex = pow(max(disk_tex, 0.0), vec4(1.4)) * 1.5;
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

                    disk_tex *= 1.0 - smoothstep(0.65 * disk_outer, 1.05 * disk_outer, edge_r);

                    // hot spots: brighter and hotter than the surrounding gas
                    accretion_intensity *= 1.0 + 3.0 * spot;
                    temperature *= 1.0 + 0.35 * spot;
                    disk_tex += vec4(0.35 * spot);

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

                    vec4 spectrum = BLACK_BODY_COLOR(temperature);
                    {{#gasTint}}
                    spectrum.rgb = mix(spectrum.rgb, gas_color * max(spectrum.r,max(spectrum.g,spectrum.b)), gas_tint);
                    {{/gasTint}}
                    color += disk_tex * accretion_intensity * spectrum * trans;
                }
            }
        }
        {{/accretion_disk}}

        {{#neon_floor}}
        {{#look.floor_lensing}}
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
        {{/look.floor_lensing}}
        {{/neon_floor}}
        path_len += ray_l;

        {{#light_travel_time}}
        t -= dt;
        {{/light_travel_time}}

        if (solid_isec_t <= 1.0) u = 2.0; // break
        if (u > 1.0) break;
    }

    vec3 esc = normalize(pos - old_pos);
    if (u < 0.0) {
        // Locate u=0 within the crossing step using the same nonlinear ODE,
        // not a straight chord or a linearized oscillator at a variable radius.
        // Newton refinement keeps neighboring rays continuous when their final
        // step count differs. The crossing derivative is safely nonzero.
        float x = clamp(last_u / max(-last_du, 1e-6), 0.0, step);
        for (int refine=0; refine<3; refine++) {
            vec2 end_ray = ray_advance(vec2(last_u, last_du), x);
            x = clamp(x - end_ray.x / min(end_ray.y, -1e-6), 0.0, step);
        }
        float pa = last_phi + x;
        esc = normalize(cos(pa) * normal_vec + sin(pa) * tangent_vec);
    }

    {{#neon_floor}}{{#look.floor_lensing}}
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
    {{/look.floor_lensing}}{{/neon_floor}}
    vec3 gdir = esc * BG_COORDS;
    {{#neon_grid}}
    // Analytic celestial grid on the escape direction: exact lensing, crisp at
    // any resolution, no texture filtering. fwidth of the unit vector is the
    // pixel's angular footprint and is seam-free (unlike fwidth(atan)).
    vec3 grid_rgb = vec3(0.0);
    {
        float fw = clamp(length(fwidth(gdir)), 1e-5, 0.02);
        float lat = asin(clamp(gdir.z, -1.0, 1.0));
        float lon = atan(gdir.x, gdir.y);
        const float LAT_STEP = M_PI / 24.0;
        const float LON_STEP = 2.0 * M_PI / 48.0;
        float dlat = abs(fract(lat / LAT_STEP + 0.5) - 0.5) * LAT_STEP;
        float dlon = abs(fract(lon / LON_STEP + 0.5) - 0.5) * LON_STEP * cos(lat);
        // meridians converge at the poles; drop them near the pole cap
        float pole = smoothstep(0.985, 0.995, abs(gdir.z));

        float core = 0.00055;                                // ~0.03 deg
        float glow = min(grid_glow * fw, 0.3 * LAT_STEP);    // screen-space halo
        vec2 a = neon_line(dlat, core, fw, glow);
        vec2 b = neon_line(dlon, core, fw, glow);
        b *= 1.0 - pole;

        // where lensing compresses the grid below pixel scale (photon ring),
        // fade to the mean rather than aliasing into moire
        float dens = clamp(LAT_STEP / (8.0 * fw), 0.0, 1.0);

        // packets running along meridians, each with its own speed and phase
        {{#gridPulse}}
        float id = floor(lon / LON_STEP + 0.5);
        float h = hash11(id + 3.7);
        float k = fract((lat / M_PI + 0.5) * 2.0 + time * 0.012 * (0.4 + h) + h * 9.0);
        float packet = exp(-k * 40.0) + 0.25 * exp(-k * 6.0);
        // a latitude band sweeping pole to pole; through the lens it becomes arcs
        float band_lat = (fract(time * 0.004) - 0.5) * M_PI;
        float band = exp(-abs(lat - band_lat) / 0.06);
        {{/gridPulse}}
        {{^gridPulse}}
        float packet = 0.0, band = 0.0;
        {{/gridPulse}}

        float A = (1.2 * a.x + 0.35 * a.y) * (1.0 + 2.5 * grid_pulse * band);
        float B = (1.2 * b.x + 0.35 * b.y) * (1.0 + 4.0 * grid_pulse * packet);
        grid_rgb = (SITE_CYAN * A + SITE_PURPLE * B
                 + vec3(1.0) * a.x * b.x * 2.0
                 + SITE_CYAN * 0.06 * grid_pulse * band) * dens
                 + (SITE_CYAN + SITE_PURPLE) * 0.04 * (1.0 - dens);
        // rays still orbiting when the step budget ran out (photon ring) have no
        // meaningful escape direction; don't let them sparkle
        grid_rgb *= grid_strength * smoothstep(0.08, 0.02, u);
    }
    {{/neon_grid}}

    // the event horizon is at u = 1
    if (u < 1.0) {
        ray = esc;
        // Rotate only texture sampling; the celestial grid uses unchanged gdir.
        {{#viewerSky}}
        vec2 tex_coord = sphere_map(sky_rotation * gdir);
        {{/viewerSky}}
        {{^viewerSky}}
        vec2 tex_coord = sphere_map(gdir);
        {{/viewerSky}}
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


    if (hole_glow > 0.0) {
        float bx = (impact_b - 2.598076) / 2.598076;
        float outside = max(bx, 0.0), inside = max(-bx, 0.0);
        // white-hot hairline on the outer edge of the shadow, then a crimson halo
        float hair = exp(-outside / 0.006) * smoothstep(-0.01, 0.0, bx);
        float ring = exp(-outside / 0.03) * smoothstep(-0.03, 0.0, bx);
        float halo = exp(-outside / 0.28) * smoothstep(-0.05, 0.0, bx);
        float haze = exp(-outside / 1.1) * smoothstep(-0.05, 0.0, bx);
        // inside the shadow: banded crimson gradient that fades to void
        float grad = exp(-inside / 0.16) * smoothstep(0.85, 0.0, inside);
        float banded = mix(grad, floor(grad * 7.0 + 0.5) / 7.0, 0.55);
        vec3 hot = vec3(1.0, 0.93, 0.94);
        vec3 gcol = hole_glow_color;
        vec3 g = hot * (hair * 2.6 + ring * 0.7)
               + mix(gcol, hot, 0.25) * ring * 1.4
               + gcol * (halo * 0.55 + haze * 0.10)
               + gcol * vec3(0.9, 0.55, 0.7) * banded * 0.5 * (bx < 0.0 ? 1.0 : 0.0);
        color.rgb += g * hole_glow * (1.0 - smoothstep(0.55, 0.9, u0 * 2.6));
    }

    {{#neon_floor}}{{^look.floor_lensing}}
    // A poster-style floor is a straight world-space mirror plane. The black
    // hole and reflected scene retain their own relativistic ray tracing.
    float planeDirection=dot(floor_camera_ray,floor_n);
    float planeHeight=dot(cam_pos,floor_n)-floor_d;
    // Cover the pixel's intersection with the plane, including the vanishing
    // row. Evaluate its centre on the floor side instead of dropping nearly
    // parallel rays at a fixed cutoff (which clipped wide-screen edges).
    float planePixel=max(fwidth(planeDirection)*0.5,0.0000001);
    float planeCoverage=clamp(0.5-planeDirection/(2.0*planePixel),0.0,1.0);
    // Captured rays and solid hits already terminate on an opaque scene
    // surface. The final straight-floor pass must not paint over that surface.
    {{#look.floor_snow}}
    if(planeHeight > 0.0 && (planeDirection < 0.3 || planeCoverage > 0.0) && u < 1.0) {
        vec3 floorRay = floor_camera_ray;
        bool hitDune = false;
        float hitT = 110.0;
        float t_base = planeDirection < -0.0001 ? planeHeight / (-planeDirection) : 110.0;
        float t_max = min(110.0, t_base);
        if (planeDirection > 0.0) t_max = min(t_max, max(12.0 - planeHeight, 0.0) / planeDirection);
        float t_min = 0.3;
        float t_prev = t_min;
        vec3 p_prev = cam_pos + floorRay * t_prev;
        vec3 r_prev = p_prev - floor_o;
        float lat_prev = dot(r_prev, floor_e2);
        float dep_prev = 30.0 - dot(r_prev, floor_e1);
        vec2 st_prev = vec2(lat_prev, dep_prev) + floor_offset;
        float h_diff_prev = (planeHeight + planeDirection * t_prev) - dune_elevation(st_prev);
        
        for (int m = 1; m <= 52; m++) {
            float frac = float(m) / 52.0;
            float t_curr = t_min + (t_max - t_min) * pow(frac, 1.45);
            vec3 pm = cam_pos + floorRay * t_curr;
            vec3 rm = pm - floor_o;
            float lat_m = dot(rm, floor_e2);
            float dep_m = 30.0 - dot(rm, floor_e1);
            vec2 stm = vec2(lat_m, dep_m) + floor_offset;
            float h_ray = planeHeight + planeDirection * t_curr;
            float h_dune = dune_elevation(stm);
            float h_diff = h_ray - h_dune;
            if (h_diff <= 0.0) {
                float f = clamp(h_diff_prev / max(0.0001, h_diff_prev - h_diff), 0.0, 1.0);
                hitT = mix(t_prev, t_curr, f);
                hitDune = true;
                break;
            }
            t_prev = t_curr;
            h_diff_prev = h_diff;
        }

        float coverage = 1.0;
        if (!hitDune && planeDirection < -0.0005) {
            hitT = t_base;
            hitDune = true;
            coverage = planeCoverage;
        }
        
        if (hitDune) {
            vec3 hitPos = cam_pos + floorRay * hitT;
            vec3 rHit = hitPos - floor_o;
            float latHit = dot(rHit, floor_e2);
            float depHit = 30.0 - dot(rHit, floor_e1);
            vec2 stHit = vec2(latHit, depHit) + floor_offset;
            float eps = max(0.02, hitT * 0.002);
            float dhx = (dune_elevation(stHit + vec2(eps, 0.0)) - dune_elevation(stHit - vec2(eps, 0.0))) / (2.0 * eps);
            float dhy = (dune_elevation(stHit + vec2(0.0, eps)) - dune_elevation(stHit - vec2(0.0, eps))) / (2.0 * eps);
            vec3 macroN = normalize(floor_n + dhy * floor_e1 - dhx * floor_e2);
            
            float reps = 0.015;
            float drx = (dune_ripples(stHit + vec2(reps, 0.0)) - dune_ripples(stHit - vec2(reps, 0.0))) / (2.0 * reps);
            float dry = (dune_ripples(stHit + vec2(0.0, reps)) - dune_ripples(stHit - vec2(0.0, reps))) / (2.0 * reps);
            float ripFade = smoothstep(26.0, 3.0, stHit.y);
            vec3 N = normalize(macroN + (dry * floor_e1 - drx * floor_e2) * (0.32 * ripFade));
            
            vec3 V = -floorRay;
            vec3 L = normalize(-hitPos);
            float NdotV = clamp(dot(N, V), 0.0, 1.0);
            float slopeUp = clamp(dot(N, floor_n), 0.0, 1.0);
            float slopeToLight = -dot(N, floor_e1); // positive when facing black hole (backlight)
            float ripVal = dune_ripples(stHit);
            

            // Velvety deep indigo/midnight shadows on camera-facing flanks
            vec3 shadowCol = floor_shadow_color;
            float troughDarken = mix(0.72, 1.04, pow(ripVal, 1.3));
            vec3 snowAmbient = mix(shadowCol * 0.8, shadowCol * 1.15, slopeUp);
            vec3 frostedIndigo = mix(snowAmbient, vec3(0.11, 0.17, 0.33), clamp(slopeUp * 0.7, 0.0, 1.0));
            // Gentle cool lavender on slopes catching diffuse ambient
            vec3 snowLit = mix(frostedIndigo, vec3(0.30, 0.38, 0.62), clamp(slopeToLight * 0.5 + slopeUp * 0.35, 0.0, 1.0)) * troughDarken * 0.95;
            
            // Slope tilt: dunes and ripples have tilt; flat ground does not
            float slopeTilt = smoothstep(0.015, 0.22, 1.0 - slopeUp);
            // Razor-sharp glowing crimson/coral rim on dune ridges facing the black hole
            float ridgeSilhouette = pow(1.0 - NdotV, 3.5) * (0.01 + 0.99 * slopeTilt) * smoothstep(-0.15, 0.35, slopeToLight);
            float directBacklight = pow(clamp(dot(reflect(-L, N), V), 0.0, 1.0), 14.0) * 0.65 * (0.04 + 0.96 * slopeTilt);
            float ripCrest = pow(ripVal, 3.6) * slopeTilt * smoothstep(0.0, 0.45, slopeToLight) * 0.85 * ripFade;
            float totalCrest = ridgeSilhouette * 1.7 + directBacklight * 0.7 + ripCrest;
            vec3 crimsonRim = mix(floor_rim_color, vec3(1.0, 0.86, 0.92), clamp(totalCrest * 0.45, 0.0, 0.75)) * totalCrest;
            vec3 snowCol = snowLit + crimsonRim;
            
            // Backlit translucent rim on dune ridges facing black hole (SSS forward scattering)
            float sssForward = pow(clamp(dot(V, -L), 0.0, 1.0), 3.2);
            float sssCrest = pow(slopeTilt, 1.6) * smoothstep(-0.05, 0.40, slopeToLight);
            vec3 sssCol = mix(floor_rim_color, vec3(1.0, 0.45, 0.62), 0.4) * (sssForward * sssCrest * 1.1);
            snowCol += sssCol;
            
            // Diamond micro-sparkles (stardust crystalline facets)
            vec2 sparkP = stHit * 68.0;
            vec2 sparkCell = floor(sparkP);
            vec3 p3 = fract(vec3(sparkCell.xyx) * 0.1031);
            p3 += dot(p3, p3.yzx + 33.33);
            float h1 = fract((p3.x + p3.y) * p3.z);
            float h2 = fract((p3.x + p3.z) * 17.13);
            vec2 sparkFrac = fract(sparkP) - 0.5;
            float sparkDot = smoothstep(0.42, 0.08, length(sparkFrac));
            
            vec3 facetN = normalize(N + vec3(h1 - 0.5, h2 - 0.5, 0.7) * 1.2);
            vec3 H = normalize(L + V);
            float facetSpec = pow(max(0.0, dot(facetN, H)), 36.0) * 2.8;
            float facetDisk = pow(max(0.0, dot(reflect(-L, facetN), V)), 24.0) * 3.5;
            float sparkle = (facetSpec + facetDisk) * sparkDot * (h1 > 0.65 ? 1.0 : 0.0) * floor_sparkle * smoothstep(36.0, 2.0, stHit.y);
            vec3 sparkleCol = mix(vec3(1.0, 0.96, 1.0), vec3(1.0, 0.82, 0.90), h2);
            snowCol += sparkleCol * sparkle;

            if (grid_strength > 0.0) {
                float S = floor_cell;
                float W = 0.008 * S;
                vec2 gd = abs(fract(stHit / S + 0.5) - 0.5) * S;
                float cosi = max(abs(dot(V, N)), 0.02);
                float fw = hitT * PIX_ANGLE / cosi;
                vec2 lx = neon_line(gd.x, W, fw, 0.0);
                vec2 ly = neon_line(gd.y, W, fw, 0.0);
                float minorGrid = lx.x + ly.x - lx.x * ly.x;

                float S4 = 4.0 * S;
                vec2 gm = abs(fract(stHit / S4 + 0.5) - 0.5) * S4;
                vec2 mx = neon_line(gm.x, 1.4 * W, fw, 0.0);
                vec2 my = neon_line(gm.y, 1.4 * W, fw, 0.0);
                float majorGrid = mx.x + my.x - mx.x * my.x;

                // Elevation contour lines draping across dunes:
                float contourStep = 0.12;
                float hElev = dune_elevation(stHit);
                float hMod = abs(fract(hElev / contourStep + 0.5) - 0.5) * contourStep;
                float hFw = max(length(vec2(dhx, dhy)) * fw, 0.002);
                vec2 hLine = neon_line(hMod, 0.006 * contourStep, hFw, 0.0);
                float topoContour = hLine.x;

                float gridDistFade = smoothstep(42.0, 3.0, stHit.y);
                vec3 topoGrid = mix(vec3(0.0, 0.9, 1.0) * (2.2 * majorGrid), floor_rim_color * (1.8 * minorGrid + 1.3 * topoContour), 0.6);
                snowCol += topoGrid * (grid_strength * 1.3 * gridDistFade);
            }

            // Reddish light reflection: diffuse bounce & specular highlights only on faces lit by accretion disk
            float litFacing = smoothstep(-0.05, 0.45, slopeToLight);
            float NdotL = clamp(dot(N, L), 0.0, 1.0);
            float redBounce = pow(NdotL, 2.4) * 0.16 * litFacing;
            vec3 redBounceCol = mix(floor_rim_color, vec3(1.0, 0.38, 0.52), 0.4);
            snowCol += redBounceCol * redBounce;

            float NdotH = clamp(dot(N, H), 0.0, 1.0);
            float specRed = (pow(NdotH, 48.0) * 0.55 + pow(NdotH, 10.0) * 0.07) * litFacing;
            vec3 redSpecCol = mix(floor_rim_color * 1.35, vec3(1.0, 0.88, 0.93), 0.35);
            snowCol += redSpecCol * specRed;

            if (floor_reflection > 0.0) {
                vec3 v = hitPos - reflect_pos;
                float depth = dot(v, reflect_z);
                vec2 uv = 0.5 + 0.5 * fov_mult * vec2(dot(v, reflect_x), dot(v, reflect_y) * resolution.x / resolution.y) / max(depth, 0.0001);
                if (depth > 0.0 && min(uv.x, uv.y) >= 0.0 && max(uv.x, uv.y) <= 1.0) {
                    vec2 blur = vec2(1.0, resolution.x / resolution.y) * floor_roughness * 0.015;
                    vec3 refl = texture2D(reflection_tex, uv).rgb * 0.4;
                    refl += (texture2D(reflection_tex, uv + vec2(blur.x, 0.0)).rgb + texture2D(reflection_tex, uv - vec2(blur.x, 0.0)).rgb + texture2D(reflection_tex, uv + vec2(0.0, blur.y)).rgb + texture2D(reflection_tex, uv - vec2(0.0, blur.y)).rgb) * 0.15;
                    float fresnel = pow(1.0 - NdotV, 3.0);
                    float reflMult = mix(0.5, 1.3, fresnel);
                    vec3 redSheen = mix(refl, refl * floor_rim_color * 1.5, 0.35);
                    snowCol += redSheen * (floor_reflection * reflMult);
                }
            }
            // aerial haze: far dunes dissolve into the horizon glow instead of ending on a hard line
            float hazeAmt = 1.0 - exp(-hitT * 0.021);
            vec3 hazeCol = hole_glow_color * vec3(0.85, 0.75, 1.0) * 0.85 + vec3(0.16, 0.09, 0.22);
            snowCol = mix(snowCol, hazeCol * (0.7 + 0.3 * slopeUp), smoothstep(0.1, 0.95, hazeAmt) * 0.92);
            vec4 fs = vec4(snowCol * floor_strength, 1.0) * coverage;
            color.rgb = fs.rgb + color.rgb * (1.0 - fs.a);
        }
    }
    {{/look.floor_snow}}
    {{^look.floor_snow}}
    if(planeHeight>0.0 && planeCoverage>0.0 && u<1.0){
        vec3 floorSample=normalize(floor_camera_ray-floor_n*max(0.0,planeDirection+planePixel*0.5));
        float planeHit=planeHeight/max(-dot(floorSample,floor_n),0.0000001);
        vec4 fs=floor_shade(cam_pos+floorSample*planeHit,floorSample,planeHit,PIX_ANGLE)*planeCoverage;
        color.rgb=fs.rgb+color.rgb*(1.0-fs.a);
    }
    {{/look.floor_snow}}
    {{/look.floor_lensing}}{{/neon_floor}}
    if (snowfall > 0.0 && reflection_pass < 0.5) {
        vec3 hv = normalize(-cam_pos);
        float hz = max(dot(hv, cam_z), 0.05);
        vec2 hole_s = FOV_MULT * vec2(dot(hv, cam_x), dot(hv, cam_y)) / hz;
        float pix_p = 2.0 / resolution.x;
        float flake_density = clamp(0.30 * snowfall, 0.0, 0.85);
        for (int sl = 0; sl < 4; sl++) {
            float fl = float(sl);
            float depthK = fl / 3.0;
            float cells = mix(40.0, 9.0, depthK);
            vec2 g = p * cells;
            g += vec2(fl * 17.3 + time * mix(0.02, 0.06, depthK) + sin(time * 0.07 + fl * 2.0) * 0.5,
                      fl * 9.1 + time * mix(0.06, 0.17, depthK));
            vec2 id = floor(g);
            vec2 f = fract(g) - 0.5;
            vec3 h1 = sfh(id, fl * 3.7);
            if (h1.x < flake_density) {
                vec3 h2 = sfh(id + 41.0, fl * 5.3);
                vec2 cen = (h1.yz - 0.5) * 0.46 + vec2(sin(time * 0.4 + h2.z * 30.0), cos(time * 0.33 + h2.y * 30.0)) * 0.04;
                vec2 v = f - cen;
                float rs = (0.09 + 0.15 * h2.x) * (0.8 + 0.4 * depthK);
                float rot = h2.y * 6.2832 + time * (h2.z - 0.5) * 0.5;
                float cr = cos(rot), sr = sin(rot);
                vec2 vr = vec2(cr * v.x + sr * v.y, -sr * v.x + cr * v.y);
                float r = length(vr);
                float a = atan(vr.y, vr.x);
                float pixC = cells * pix_p;
                float tw = max(rs * 0.055, pixC * 0.75);
                float ang = abs(fract(a / (M_PI / 3.0) + 0.5) - 0.5) * (M_PI / 3.0);
                float perp = r * sin(ang), ax = r * cos(ang);
                float arm = smoothstep(tw * 1.5, tw * 0.3, perp) * (1.0 - smoothstep(rs * 0.88, rs, ax));
                float brOn = (ax > rs * 0.3 && ax < rs * 0.68) ? 1.0 : 0.0;
                float br = smoothstep(tw * 1.3, tw * 0.3, abs(perp - (ax - rs * 0.3) * 0.8)) * brOn * 0.8;
                float core = smoothstep(rs * 0.22, rs * 0.12, r);
                float shape = max(max(arm, br), core);
                float blurK = smoothstep(0.6, 1.0, depthK);
                float bokeh = smoothstep(rs * 1.2, rs * 0.2, r) * 0.16;
                shape = mix(shape, bokeh, blurK);
                shape *= smoothstep(0.0, 0.5, min(pixC > 0.0 ? rs / pixC : 1.0, 1.0) * 1.2 + 0.2);

                vec2 toHole = hole_s - p;
                float dh = length(toHole);
                float back = 1.0 / (1.0 + dh * dh * 2.6);
                vec2 th = vec2(cr * toHole.x + sr * toHole.y, -sr * toHole.x + cr * toHole.y);
                float ath = atan(th.y, th.x);
                float pointing = pow(abs(cos(3.0 * ath)), 8.0);
                float facing = 0.5 + 0.5 * dot(normalize(vr + vec2(1e-5)), normalize(th + vec2(1e-5)));
                float glint = pow(0.5 + 0.5 * sin(time * (1.2 + 2.5 * h2.z) + h2.x * 50.0), 22.0);
                vec3 disp = 0.55 + 0.45 * cos(6.2832 * (h2.y + vec3(0.0, 0.33, 0.67)));
                vec3 flake = vec3(0.80, 0.88, 1.0) * (0.35 + 0.65 * facing)
                           + hole_glow_color * back * (0.3 + 1.2 * facing) * 1.0
                           + vec3(1.0, 0.92, 0.95) * back * pow(facing, 3.0) * 0.9
                           + mix(vec3(1.0), disp, 0.55) * glint * (0.4 + 2.2 * pointing) * 1.8;
                float al = clamp(shape * mix(0.5, 1.0, depthK) * 0.95, 0.0, 0.92);
                color.rgb = color.rgb * (1.0 - al) + flake * al;
            }
        }
    }
    gl_FragColor = color*ray_intensity;
}

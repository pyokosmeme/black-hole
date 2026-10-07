// User-selected stationary crimson snow scene, shared by the site and portable viewer.

window.NEON_CRIMSON_SNOW = {

  n_steps:60, quality:'medium', accretion_disk:true,

  caption:{enabled:true,text:'CRIMSON|HORIZON',style:'ice',font:'Sculpted',size:11,x:50,y:68,width:90,uppercase:true,bevel:1,grid:.5,stretch:1,line_gap:1.12,angular:true,metal:.75,glow:.9,fuzz:.2,tint_color:'#ffffff'},

  planet:{enabled:false,distance:7,radius:.4,eccentricity:0,inclination:0,node:0,periapsis:0,phase:0,speed:1,spin:15,axial_tilt:30,texture_offset:0,texture:''},

  lorentz_contraction:true,gravitational_time_dilation:true,aberration:true,beaming:true,doppler_shift:true,light_travel_time:true,time_scale:3.18,

  observer:{motion:false,orbit:'eccentric',periapsis:3.2,apoapsis:22.6,distance:13,orbital_inclination:4.27,azimuth:0,elevation:0,rotation_speed:0},

  camera:{navigation:'orbit',sensitivity:.18,move_speed:1,offset_x:0,offset_y:0,offset_z:0,height:-1.0,pitch:0.0,yaw:0,wobble_pitch:0,wobble_yaw:0,wobble_period:89.5},

  neon_grid:false,neon_floor:true,neon_sky:true,photon_eq_fix:true,disk_flow:true,disk_profile:true,grav_redshift:true,

  look:{

    grid_strength:0.0,grid_glow:0,grid_pulse:0,

    sky_motion:true,sky_speed:1,sky_axis_tilt:0,

    sky_plume:1.8,sky_plume_color:'#ff2855',

    hole_glow:1.1,hole_glow_color:'#ff2c4a',grain:.06,snow_enabled:true,snow_density:.01,snow_brightness:1,snow_size:1,snow_speed:1,snow_angle:0,snow_pull:0,

    neon_nebula:false,nebula_amount:1.2,nebula_scale:6,nebula_color:'#3d4d8c',nebula_resolution:'high',

    floor_strength:1.0,floor_height:3.6,floor_follow_camera:false,floor_x:0,floor_y:0,floor_yaw:0,

    floor_lensing:false,floor_tilt:0,floor_cell:2.5,floor_speed:0,floor_sway:0,floor_sway_period:34,

    floor_extent:14,floor_concentration:18,

    floor_reflection:0,floor_roughness:.18,floor_opaque:true,

    floor_snow:true,floor_sparkle:1.5,floor_dunes:1.7,

    floor_rim_color:'#ff3a65',floor_shadow_color:'#081024',

    floor_palette:false,floor_color:'#bf00ff',floor_major_color:'#00ffff',

    gas_tint:.8,gas_color:'#ff3d55',gas_texture:'',

    disk_temp:4800,disk_tilt:20,disk_yaw:75,floor_infinite:true,

    disk_outer:13,disk_speed:4.06,spot_strength:0,galaxy_gain:2.8,

    vfov:72,exposure:1.35,bloom_strength:.75,bloom_threshold:.48,bloom_radius:1.8,

    render_scale:1,auto_res:false,antialiasing:true,target_fps:50

  },

  version:1,renderer:'neon'

};

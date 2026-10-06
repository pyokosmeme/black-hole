// User-selected stationary warm scene, shared by the site and portable viewer.
window.NEON_WARM_CHROME = {
  n_steps:60, quality:'medium', accretion_disk:true,
  caption:{enabled:true,text:'BEYOND|HUMAN',style:'mixed',font:'Sculpted',size:11,x:50,y:68,width:90,uppercase:true,bevel:1,grid:.85,stretch:1,line_gap:1.12,angular:true,metal:.65,glow:.85,fuzz:.22},
  planet:{enabled:false,distance:7,radius:.4,eccentricity:0,inclination:0,node:0,periapsis:0,phase:0,speed:1,spin:15,axial_tilt:30,texture_offset:0,texture:''},
  lorentz_contraction:true,gravitational_time_dilation:true,aberration:true,beaming:true,doppler_shift:true,light_travel_time:true,time_scale:3.18,
  observer:{motion:false,orbit:'eccentric',periapsis:3.2,apoapsis:22.6,distance:30,orbital_inclination:4.27,azimuth:0,elevation:0,rotation_speed:0},
  camera:{navigation:'orbit',sensitivity:.18,move_speed:1,offset_x:0,offset_y:0,offset_z:0,height:-5.4,pitch:0,yaw:0,wobble_pitch:0,wobble_yaw:0,wobble_period:89.5},
  neon_grid:false,neon_floor:true,neon_sky:true,photon_eq_fix:true,disk_flow:true,disk_profile:true,grav_redshift:true,
  look:{grid_strength:.05,grid_glow:0,grid_pulse:0,sky_motion:true,sky_speed:1,sky_axis_tilt:0,floor_strength:.975,floor_height:6,floor_follow_camera:false,floor_x:0,floor_y:0,floor_yaw:0,floor_lensing:false,floor_tilt:0,floor_cell:2.5,floor_speed:0,floor_sway:0,floor_sway_period:34,floor_extent:14,floor_concentration:18,floor_reflection:.45,floor_roughness:.1,floor_palette:true,floor_color:'#e879ef',floor_major_color:'#e879ef',nebula_amount:1.7,nebula_scale:8,nebula_color:'#85cfa3',nebula_resolution:'high',gas_tint:.75,gas_color:'#ffbd87',gas_texture:'',disk_temp:5500,disk_tilt:17,disk_yaw:90,floor_infinite:true,disk_outer:13,disk_speed:4.06,spot_strength:4,galaxy_gain:3.36,vfov:72,exposure:1.381,bloom_strength:.693,bloom_threshold:.52,bloom_radius:1.982,render_scale:1,auto_res:false,antialiasing:true,target_fps:50},
  version:1,renderer:'neon'
};

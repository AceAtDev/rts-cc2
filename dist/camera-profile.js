import {SCALE} from './unit-profiles.js';

// Pinned Core CameraData.xml. Melee uses vertical FOV; the optional horizontal
// mode is described by the corresponding EditorStrings map-property tooltip.
export const CAMERA_PROFILE={fov:27.799999,near:.1*SCALE,far:600*SCALE,
 zoomStops:[{distance:34*SCALE,pitch:56},{distance:30*SCALE,pitch:52},
  {distance:26*SCALE,pitch:48},{distance:22*SCALE,pitch:44},{distance:18*SCALE,pitch:40}]};
export const createCamera=(x,y)=>({x,y,yaw:0,zoomStep:0,...CAMERA_PROFILE.zoomStops[0]});
export function zoomCamera(cam,direction){
 const index=Math.max(0,Math.min(CAMERA_PROFILE.zoomStops.length-1,(cam.zoomStep||0)+Math.sign(direction)));
 cam.zoomStep=index;Object.assign(cam,CAMERA_PROFILE.zoomStops[index]);return cam;
}

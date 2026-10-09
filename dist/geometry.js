// Shape offsets are catalog facts, separate from placement cells and selection radii.
export const GRID=28;
const contours={
  2:[[-1,.5],[-.5,1],[.5,1],[1,.5],[1,-.5],[.5,-1],[-.5,-1],[-1,-.5]],
  3:[[-1.5,-1],[-1.5,1],[-1,1.5],[1,1.5],[1.5,1],[1.5,-1],[1,-1.5],[-1,-1.5]],
  5:[[-1,-2.5],[-2.5,-1],[-2.5,1],[-1,2.5],[1,2.5],[2.5,1],[2.5,-1],[1,-2.5]],
};
export function applyFootprints(defs){
  for(const [type,width,radius] of [['core',5,2.5],['relay',2,1.25],['barracks',3,1.75],['factory',3,1.625],['engineering',3,1.25],['refinery',3,1.5],['techlab',2,1],['reactor',2,1]]){
    Object.assign(defs[type],{placeWidth:width,placeHeight:width,footprint:contours[width].map(([x,y])=>[x*GRID,y*GRID]),r:radius*GRID});
  }
  defs.refinery.footprint=[[-.75,-1.5],[.75,-1.5],[1.5,-.75],[1.5,.75],[.75,1.5],[-.75,1.5],[-1.5,.75],[-1.5,-.75]].map(([x,y])=>[x*GRID,y*GRID]);
}
export function snapPlacement(point,width,height=width){
  const align=(v,size)=>{const phase=size%2?.5:0;return (Math.round(v/GRID-phase)+phase)*GRID;};
  return {x:align(point.x,width),y:align(point.y,height)};
}
export function bounds(shape,placement=false){
  if(placement&&shape.placeWidth)return{x0:shape.x-shape.placeWidth*GRID/2,x1:shape.x+shape.placeWidth*GRID/2,y0:shape.y-shape.placeHeight*GRID/2,y1:shape.y+shape.placeHeight*GRID/2};
  if(shape.footprint){const xs=shape.footprint.map(p=>p[0]),ys=shape.footprint.map(p=>p[1]);return{x0:shape.x+Math.min(...xs),x1:shape.x+Math.max(...xs),y0:shape.y+Math.min(...ys),y1:shape.y+Math.max(...ys)};}
  return{x0:shape.x-shape.r,x1:shape.x+shape.r,y0:shape.y-shape.r,y1:shape.y+shape.r};
}
export function pointSegment(p,a,b){
  const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));
  return{x:a.x+dx*t,y:a.y+dy*t};
}
export function surface(p,shape){
  if(!shape.footprint){const dx=p.x-shape.x,dy=p.y-shape.y,d=Math.hypot(dx,dy),nx=d?dx/d:1,ny=d?dy/d:0;return{x:shape.x+nx*shape.r,y:shape.y+ny*shape.r,nx,ny,distance:d-shape.r};}
  const x=p.x-shape.x,y=p.y-shape.y,poly=shape.footprint;
  let inside=false,best=null,minimum=Infinity,area=0;
  for(let i=0,j=poly.length-1;i<poly.length;j=i++){
    const [ax,ay]=poly[j],[bx,by]=poly[i];area+=ax*by-bx*ay;
    if((ay>y)!==(by>y)&&x<(bx-ax)*(y-ay)/(by-ay)+ax)inside=!inside;
    const q=pointSegment({x,y},{x:ax,y:ay},{x:bx,y:by}),d=(q.x-x)**2+(q.y-y)**2;
    if(d<minimum){minimum=d;best={...q,dx:bx-ax,dy:by-ay};}
  }
  const d=Math.sqrt(minimum),edge=Math.hypot(best.dx,best.dy);
  const nx=!inside&&d>1e-8?(x-best.x)/d:(area>0?best.dy:-best.dy)/edge;
  const ny=!inside&&d>1e-8?(y-best.y)/d:(area>0?-best.dx:best.dx)/edge;
  return{x:best.x+shape.x,y:best.y+shape.y,nx,ny,distance:inside?-d:d};
}
export function contactPoint(p,shape,padding){const q=surface(p,shape);return{x:q.x+q.nx*padding,y:q.y+q.ny*padding};}
const cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
function intersects(a,b,c,d){const p=cross(a,b,c),q=cross(a,b,d),r=cross(c,d,a),s=cross(c,d,b);return p*q<0&&r*s<0;}
export function segmentBlocked(a,b,r,shape){
  if(!shape.footprint){const p=pointSegment(shape,a,b);return (p.x-shape.x)**2+(p.y-shape.y)**2<(shape.r+r)**2-1e-6;}
  const box=shape.bounds||bounds(shape);
  if(Math.max(a.x,b.x)<box.x0-r||Math.min(a.x,b.x)>box.x1+r||Math.max(a.y,b.y)<box.y0-r||Math.min(a.y,b.y)>box.y1+r)return false;
  if(surface(a,shape).distance<r-1e-6||surface(b,shape).distance<r-1e-6)return true;
  for(let i=0,j=shape.footprint.length-1;i<shape.footprint.length;j=i++){
    const [ax,ay]=shape.footprint[j],[bx,by]=shape.footprint[i],c={x:shape.x+ax,y:shape.y+ay},d={x:shape.x+bx,y:shape.y+by};
    if(intersects(a,b,c,d))return true;
    const q=pointSegment(c,a,b);if((q.x-c.x)**2+(q.y-c.y)**2<r*r-1e-6)return true;
  }
  return false;
}
export function rectangleOverlap(a,b){return a.x0<b.x1-1e-6&&a.x1>b.x0+1e-6&&a.y0<b.y1-1e-6&&a.y1>b.y0+1e-6;}
export function circleRectangle(circle,box){const x=Math.max(box.x0,Math.min(box.x1,circle.x)),y=Math.max(box.y0,Math.min(box.y1,circle.y));return (x-circle.x)**2+(y-circle.y)**2<circle.r**2-1e-6;}
export function addonPosition(building){return{x:building.x+2.5*GRID,y:building.y+.5*GRID};}

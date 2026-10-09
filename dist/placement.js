import {GRID,snapPlacement,bounds,rectangleOverlap,circleRectangle,addonPosition} from './geometry.js';

export function createPlacement({defs,entities,minerals,geysers,rocks,world,visible}){
  function point(type,p){
    if(type==='refinery'){const g=geysers().reduce((a,b)=>!a||Math.hypot(p.x-b.x,p.y-b.y)<Math.hypot(p.x-a.x,p.y-a.y)?b:a,null);if(g&&Math.hypot(p.x-g.x,p.y-g.y)<GRID*2)return{x:g.x,y:g.y,geyser:g};}
    return snapPlacement(p,defs[type].placeWidth,defs[type].placeHeight);
  }
  function cellValid(box,type,ignore=null){
    if(box.x0<0||box.y0<0||box.x1>world.w||box.y1>world.h)return false;
    if(!visible((box.x0+box.x1)/2,(box.y0+box.y1)/2))return false;
    if(rocks.some(o=>circleRectangle(o,box)))return false;
    if(entities().some(e=>e!==ignore&&e.hp>0&&e.building&&!e.flying&&rectangleOverlap(box,bounds(e,true))))return false;
    for(const n of minerals())if(n.amount>0){
      const b=bounds(n,true);if(type==='core'){
        b.x0-=3*GRID;b.x1+=3*GRID;b.y0-=3*GRID;b.y1+=3*GRID;
        if(!rectangleOverlap(box,b))continue;
        const overlap={x0:Math.max(box.x0,b.x0),x1:Math.min(box.x1,b.x1),y0:Math.max(box.y0,b.y0),y1:Math.min(box.y1,b.y1)};
        // The 8×7 NearResources layer leaves its four corner cells clear.
        const cornerX=overlap.x1<=b.x0+GRID+1e-6||overlap.x0>=b.x1-GRID-1e-6;
        const cornerY=overlap.y1<=b.y0+GRID+1e-6||overlap.y0>=b.y1-GRID-1e-6;
        if(cornerX&&cornerY)continue;
      }
      if(rectangleOverlap(box,b))return false;
    }
    if(type!=='refinery'&&geysers().some(g=>rectangleOverlap(box,{x0:g.x-1.5*GRID,x1:g.x+1.5*GRID,y0:g.y-1.5*GRID,y1:g.y+1.5*GRID})))return false;
    return true;
  }
  function preview(type,p,ignore=null){
    const target=point(type,p),def=defs[type],box=bounds({...def,...target},true),cells=[];
    for(let y=box.y0;y<box.y1-.01;y+=GRID)for(let x=box.x0;x<box.x1-.01;x+=GRID){const b={x0:x,y0:y,x1:x+GRID,y1:y+GRID};cells.push({...b,valid:cellValid(b,type,ignore)});}
    let valid=cells.every(c=>c.valid);
    if(type==='refinery'&&!target.geyser){valid=false;for(const c of cells)c.valid=false;}
    if(ignore&&entities().some(e=>e.hp>0&&!e.building&&!e.loadedIn&&!e.insideRefinery&&circleRectangle(e,box)))valid=false;
    const addonCells=[];
    if(['barracks','factory'].includes(type)){
      const a=addonPosition({...def,...target}),b=bounds({...defs.techlab,...a},true);
      for(let y=b.y0;y<b.y1;y+=GRID)for(let x=b.x0;x<b.x1;x+=GRID){const c={x0:x,y0:y,x1:x+GRID,y1:y+GRID};addonCells.push({...c,valid:cellValid(c,'techlab',ignore),addon:true});}
    }
    return{...target,valid,cells,addonCells};
  }
  return{point,preview,valid:(type,p,ignore=null)=>preview(type,p,ignore).valid};
}

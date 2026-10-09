import {bounds,surface,segmentBlocked,contactPoint} from './geometry.js';

class Heap{
  constructor(){this.a=[];}
  push(n){let i=this.a.length;this.a.push(n);while(i){const p=(i-1)>>1;if(this.a[p].f<=n.f)break;this.a[i]=this.a[p];i=p;}this.a[i]=n;}
  pop(){const top=this.a[0],end=this.a.pop();if(this.a.length){let i=0;while(i*2+1<this.a.length){let c=i*2+1;if(c+1<this.a.length&&this.a[c+1].f<this.a[c].f)c++;if(this.a[c].f>=end.f)break;this.a[i]=this.a[c];i=c;}this.a[i]=end;}return top;}
  get length(){return this.a.length;}
}
export function createNavigation({world,obstacles}){
  let version=0,grids=new Map(),routes=new Map();const pitch=14,nx=Math.floor(world.w/pitch)+1,ny=Math.floor(world.h/pitch)+1;
  const invalidate=()=>{version++;grids.clear();routes.clear();};
  const inWorld=(p,r)=>p.x>=r&&p.y>=r&&p.x<=world.w-r&&p.y<=world.h-r;
  function clear(a,b,r,ignore=null){return inWorld(b,r)&&!obstacles().some(o=>o.entity!==ignore&&segmentBlocked(a,b,r,o));}
  function open(p,r,ignore=null){return inWorld(p,r)&&!obstacles().some(o=>o.entity!==ignore&&surface(p,o).distance<r-1e-6);}
  function project(p,r,ignore=null){
    let q={x:Math.max(r,Math.min(world.w-r,p.x)),y:Math.max(r,Math.min(world.h-r,p.y))};
    for(let pass=0;pass<8;pass++){
      let changed=false;for(const o of obstacles())if(o.entity!==ignore&&surface(q,o).distance<r-.000001){q=contactPoint(q,o,r+.05);changed=true;}
      if(!changed&&open(q,r,ignore))return q;
    }
    for(let d=7;d<280;d+=7)for(let j=0;j<32;j++){const v={x:p.x+Math.cos(j*Math.PI/16)*d,y:p.y+Math.sin(j*Math.PI/16)*d};if(open(v,r,ignore))return v;}
    return q;
  }
  function gridFor(radius){
    const key=Math.round(radius*1000),cached=grids.get(key);if(cached)return cached;
    const grid=new Uint8Array(nx*ny);
    for(let y=0;y<ny;y++)for(let x=0;x<nx;x++)if(!inWorld({x:x*pitch,y:y*pitch},radius))grid[y*nx+x]=1;
    for(const o of obstacles()){
      const b=o.bounds||bounds(o),x0=Math.max(0,Math.ceil((b.x0-radius)/pitch)),x1=Math.min(nx-1,Math.floor((b.x1+radius)/pitch)),y0=Math.max(0,Math.ceil((b.y0-radius)/pitch)),y1=Math.min(ny-1,Math.floor((b.y1+radius)/pitch));
      for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)if(!grid[y*nx+x]&&surface({x:x*pitch,y:y*pitch},o).distance<radius-1e-6)grid[y*nx+x]=1;
    }
    grids.set(key,grid);return grid;
  }
  const nodePoint=n=>({x:(n%nx)*pitch,y:Math.floor(n/nx)*pitch});
  function connector(p,r,grid){
    let best=-1,cost=Infinity;const cx=Math.round(p.x/pitch),cy=Math.round(p.y/pitch);
    for(let dy=-3;dy<=3;dy++)for(let dx=-3;dx<=3;dx++){
      const x=cx+dx,y=cy+dy;if(x<0||y<0||x>=nx||y>=ny)continue;const n=y*nx+x;if(grid[n])continue;
      const q=nodePoint(n),d=(q.x-p.x)**2+(q.y-p.y)**2;if(d<cost&&clear(p,q,r)){best=n;cost=d;}
    }
    return best;
  }
  function path(e,target){
    const r=e.r,end=project(target,r);if(clear(e,end,r))return[end];
    const grid=gridFor(r),start=connector(e,r,grid),goal=connector(end,r,grid);if(start<0||goal<0)return[];
    if(start!==goal){let exit=false;const x=goal%nx,y=Math.floor(goal/nx);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dy)continue;const xx=x+dx,yy=y+dy,q=yy*nx+xx;if(xx>=0&&yy>=0&&xx<nx&&yy<ny&&!grid[q]&&clear(nodePoint(goal),nodePoint(q),r))exit=true;}if(!exit)return[];}
    const key=[start,goal,r,version].join(':');if(routes.has(key)){const route=routes.get(key).map(p=>({...p}));route[route.length-1]=end;return route;}
    const score=new Float64Array(nx*ny).fill(Infinity),prev=new Int32Array(nx*ny).fill(-1),closed=new Uint8Array(nx*ny),heap=new Heap(),heuristic=n=>Math.hypot(n%nx-goal%nx,Math.floor(n/nx)-Math.floor(goal/nx));
    score[start]=0;heap.push({n:start,f:heuristic(start)});let found=false;
    while(heap.length){
      const {n}=heap.pop();if(closed[n])continue;if(n===goal){found=true;break;}closed[n]=1;
      const x=n%nx,y=Math.floor(n/nx),a=nodePoint(n);
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
        if(!dx&&!dy)continue;const xx=x+dx,yy=y+dy,q=yy*nx+xx;
        if(xx<0||yy<0||xx>=nx||yy>=ny||grid[q]||closed[q])continue;
        const cost=score[n]+(dx&&dy?Math.SQRT2:1);if(cost>=score[q])continue;
        if(!clear(a,nodePoint(q),r))continue;
        score[q]=cost;prev[q]=n;heap.push({n:q,f:cost+heuristic(q)});
      }
    }
    if(!found)return[];const route=[end];for(let n=goal;n!==-1;n=prev[n]){route.unshift(nodePoint(n));if(n===start)break;}
    routes.set(key,route);if(routes.size>400)routes.delete(routes.keys().next().value);return route.map(p=>({...p}));
  }
  return{clear,open,project,path,invalidate,get version(){return version;}};
}

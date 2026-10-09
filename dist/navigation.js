import {terrainRadius} from './unit-profiles.js';
import {bounds,surface,segmentBlocked,contactPoint} from './geometry.js';

class Heap{
  constructor(){this.a=[];}
  push(n){let i=this.a.length;this.a.push(n);while(i){const p=(i-1)>>1;if(this.a[p].f<=n.f)break;this.a[i]=this.a[p];i=p;}this.a[i]=n;}
  pop(){const top=this.a[0],end=this.a.pop();if(this.a.length){let i=0;while(i*2+1<this.a.length){let c=i*2+1;if(c+1<this.a.length&&this.a[c+1].f<this.a[c].f)c++;if(this.a[c].f>=end.f)break;this.a[i]=this.a[c];i=c;}this.a[i]=end;}return top;}
  get length(){return this.a.length;}
}
export function createNavigation({world,obstacles}){
  let version=0,grids=new Map(),routes=new Map(),sharedRoutes=new Map(),jobs=[],owners=new Map(),privateGoals=new WeakMap(),budget=0;
  const pitch=14,nx=Math.floor(world.w/pitch)+1,ny=Math.floor(world.h/pitch)+1;
  const planning={expanded:0,pending:0,cancelled:0,sharedHits:0,completed:0,nodeBudget:1024};
  const invalidate=()=>{version++;grids.clear();routes.clear();sharedRoutes.clear();jobs=[];owners.clear();privateGoals=new WeakMap();};
  const inWorld=(p,r)=>p.x>=r&&p.y>=r&&p.x<=world.w-r&&p.y<=world.h-r;
  function clear(a,b,r,ignore=null){return inWorld(b,r)&&!obstacles().some(o=>o.entity!==ignore&&segmentBlocked(a,b,r,o));}
  function pointBlocked(p,r,o){
    const b=o.bounds||bounds(o);if(p.x<b.x0-r||p.x>b.x1+r||p.y<b.y0-r||p.y>b.y1+r)return false;
    if(!o.footprint)return(p.x-o.x)**2+(p.y-o.y)**2<(o.r+r)**2-1e-6;
    return surface(p,o).distance<r-1e-6;
  }
  function open(p,r,ignore=null){return inWorld(p,r)&&!obstacles().some(o=>o.entity!==ignore&&pointBlocked(p,r,o));}
  function project(p,r,ignore=null){
    let q={x:Math.max(r,Math.min(world.w-r,p.x)),y:Math.max(r,Math.min(world.h-r,p.y))};
    for(let pass=0;pass<8;pass++){
      let changed=false;for(const o of obstacles())if(o.entity!==ignore&&pointBlocked(q,r,o)){q=contactPoint(q,o,r+.05);changed=true;}
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
      for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)if(!grid[y*nx+x]&&pointBlocked({x:x*pitch,y:y*pitch},radius,o))grid[y*nx+x]=1;
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
    const r=terrainRadius(e),end=project(target,r);if(clear(e,end,r))return[end];
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
  function routeFrom(job){
    const route=[job.end];for(let n=job.goal;n!==undefined;n=job.prev.get(n)){route.unshift(nodePoint(n));if(n===job.start)break;}
    return route;
  }
  function reusable(e,end,r,goal){
    const choices=sharedRoutes.get([goal,r,version].join(':'));
    if(!choices)return null;
    for(const route of choices){
      const before=route[route.length-2]||e;if(!clear(before,end,r))continue;
      for(let i=route.length-2;i>=0;i--)if(clear(e,route[i],r)){
        const copy=route.slice(i).map(p=>({...p}));copy[copy.length-1]={...end};planning.sharedHits++;return copy;
      }
    }
    return null;
  }
  function advance(job,quota){
    let used=0;
    while(job.heap.length&&used<quota&&budget>0){
      const {n}=job.heap.pop();if(job.closed.has(n))continue;
      used++;budget--;planning.expanded++;
      if(n===job.goal){job.result=routeFrom(job);break;}
      job.closed.add(n);const x=n%nx,y=Math.floor(n/nx),a=nodePoint(n),base=job.score.get(n);
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
        if(!dx&&!dy)continue;const xx=x+dx,yy=y+dy,q=yy*nx+xx;
        if(xx<0||yy<0||xx>=nx||yy>=ny||job.grid[q]||job.closed.has(q))continue;
        const cost=base+(dx&&dy?Math.SQRT2:1);if(cost>=(job.score.get(q)??Infinity)||!clear(a,nodePoint(q),job.r))continue;
        job.score.set(q,cost);job.prev.set(q,n);job.heap.push({n:q,f:cost+Math.hypot(xx-job.goal%nx,yy-Math.floor(job.goal/nx))});
      }
    }
    if(!job.heap.length&&!job.result)job.result=[];
    if(job.result){
      planning.completed++;
      if(job.result.length){const key=[job.goal,job.r,version].join(':'),saved=sharedRoutes.get(key)||[];saved.unshift(job.result);sharedRoutes.set(key,saved.slice(0,4));if(sharedRoutes.size>100)sharedRoutes.delete(sharedRoutes.keys().next().value);}
    }
  }
  function current(owner,ticket){return owner.hp>0&&owner.order===ticket.order;}
  // Begin also rebuilds collision bins after movement; it performs no search
  // work itself. Only movement requests consume the current step's budget.
  path.begin=()=>{
    budget=planning.nodeBudget;planning.expanded=0;
    for(const [owner,ticket] of owners)if(!current(owner,ticket)){owners.delete(owner);planning.cancelled++;}
    jobs=jobs.filter(job=>[...owners.values()].some(ticket=>ticket.job===job));
    planning.pending=jobs.length;
  };
  path.request=(e,target)=>{
    const r=terrainRadius(e),end=project(target,r),targetKey=[Math.round(end.x/14),Math.round(end.y/14),r,version].join(':');
    if(clear(e,end,r)){owners.delete(e);return[end];}
    const grid=gridFor(r),start=connector(e,r,grid),goal=connector(end,r,grid);
    if(start<0||goal<0){owners.delete(e);return[];}
    // Reject an isolated destination cell before exploring the whole map.
    // Mineral contact points can be open yet enclosed by neighboring fields.
    if(start!==goal){
      let exit=false;const x=goal%nx,y=Math.floor(goal/nx),p=nodePoint(goal);
      for(let dy=-1;dy<=1&&!exit;dy++)for(let dx=-1;dx<=1;dx++){
        if(!dx&&!dy)continue;const xx=x+dx,yy=y+dy,q=yy*nx+xx;
        if(xx>=0&&yy>=0&&xx<nx&&yy<ny&&!grid[q]&&clear(p,nodePoint(q),r)){exit=true;break;}
      }
      if(!exit){owners.delete(e);return[];}
    }
    const shared=reusable(e,end,r,goal);if(shared){owners.delete(e);return shared;}
    let ticket=owners.get(e);
    if(ticket&&(!current(e,ticket)||ticket.targetKey!==targetKey)){owners.delete(e);ticket=null;planning.cancelled++;}
    if(!ticket){
      // Give a common goal one lead search, rather than expanding 120 nearly
      // identical frontiers. Each follower must verify a clear entry to its
      // completed corridor. A disconnected follower gets a private search.
      const key=privateGoals.get(e)===targetKey?[start,goal,r,version].join(':'):['shared',goal,r,version].join(':');let job=jobs.find(j=>j.key===key);
      if(!job){const heap=new Heap();heap.push({n:start,f:Math.hypot(start%nx-goal%nx,Math.floor(start/nx)-Math.floor(goal/nx))});job={key,start,goal,r,end,grid,heap,score:new Map([[start,0]]),prev:new Map(),closed:new Set(),result:null};jobs.push(job);}
      ticket={order:e.order,targetKey,job};owners.set(e,ticket);
    }
    // A fixed expansion budget bounds geometry work. Rotate unfinished jobs
    // instead of repeatedly giving the first entities complete searches.
    let turns=jobs.length;
    while(budget>0&&turns-->0&&jobs.length){
      const job=jobs.shift();if(!job.result)advance(job,64);
      if(!job.result)jobs.push(job);
    }
    planning.pending=jobs.length;
    if(ticket.job.result){
      const result=ticket.job.result.map(p=>({...p}));owners.delete(e);
      const joined=reusable(e,end,r,goal);if(joined)return joined;
      if(ticket.job.start!==start){privateGoals.set(e,targetKey);return null;}
      if(result.length)result[result.length-1]=end;return result;
    }
    return null;
  };
  path.planning=planning;
  return{clear,open,project,path,invalidate,planning,get version(){return version;}};
}

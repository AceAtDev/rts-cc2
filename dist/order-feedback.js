// Endpoints use observed intent; rendering never reveals a hidden target's live position.
export function orderEndpoint(order,team,visible){
 if(!order)return null;
 const target=order.target;
 if(target){
  if(target.team===team||visible(target.x,target.y))return target;
  return order.lastSeen||null;
 }
 return order.node||order;
}
export const orderColor=order=>['attack','attackMove'].includes(order?.kind)?'#ef5950':'#63ec65';

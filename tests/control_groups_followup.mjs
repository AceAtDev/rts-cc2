import assert from 'node:assert/strict';
import {controlGroupDigit,controlGroupOperation,controlGroupButtonOperation,sortedSelection,subgroupTypes,cycleSubgroup,
  pruneControlGroups,groupMembers,assignControlGroup,createGroupRecallTracker} from '../dist/control-groups.js';
let checks=0;
const check=(name,fn)=>{fn();checks++;console.log('PASS',name);};
const unit=(id,type='marine',extra={})=>({id,type,team:0,hp:45,subgroupPriority:type==='marine'?78:58,...extra});
const a=unit(1),b=unit(2),worker=unit(3,'worker'),loaded=unit(4,'marine',{loadedIn:50}),hiddenWorker=unit(5,'worker',{insideRefinery:9});
const dead=unit(6,'marine',{hp:0}),enemy=unit(7,'marine',{team:1}),planned=unit(8,'core',{planned:true}),world=[a,b,worker,loaded,hiddenWorker,dead,enemy,planned];
check('Shift+1 physical digit survives punctuation key',()=>assert.equal(controlGroupDigit({code:'Digit1',key:'!',shiftKey:true}),'1'));
check('Shift+0 physical digit survives punctuation key',()=>assert.equal(controlGroupDigit({code:'Digit0',key:')',shiftKey:true}),'0'));
check('Code-less numeral events remain supported',()=>assert.equal(controlGroupDigit({key:'3'}),'3'));
check('Letters and numpad punctuation do not select groups',()=>assert.equal(controlGroupDigit({code:'KeyA',key:'a'}),null));
for(const [name,event,expected] of [
  ['number recall',{},'recall'],['Control sets',{ctrlKey:true},'set'],['Shift appends',{shiftKey:true},'append'],
  ['Control Alt steals and sets',{ctrlKey:true,altKey:true},'setAndSteal'],['Shift Alt steals and appends',{shiftKey:true,altKey:true},'appendAndSteal'],
  ['Alt compatibility shortcut steals and sets',{altKey:true},'setAndSteal'],['Meta browser alias sets',{metaKey:true},'set'],
  ['Unsupported Control Shift is inert',{ctrlKey:true,shiftKey:true},null],
])check(name,()=>assert.equal(controlGroupOperation(event),expected));
check('Group button left-click recalls even with modifiers',()=>assert.equal(controlGroupButtonOperation({button:0,shiftKey:true}),'recall'));
check('Group button right-click sets; Alt right-click sets and steals',()=>{assert.equal(controlGroupButtonOperation({button:2,shiftKey:true}),'set');assert.equal(controlGroupButtonOperation({button:2,altKey:true}),'setAndSteal');});
check('Middle click cannot mutate a control group',()=>assert.equal(controlGroupButtonOperation({button:1}),null));
check('Selection order follows subgroup priority then stable ID without mutation',()=>{const original=[worker,b,a,a];assert.deepEqual(sortedSelection(original),[a,b,worker]);assert.deepEqual(original,[worker,b,a,a]);});
check('Subgroup types honor priority even if caller order differs',()=>assert.deepEqual(subgroupTypes([worker,b,a]),['marine','worker']));
check('Tab advances and wraps only active subgroup',()=>{assert.equal(cycleSubgroup([worker,a],'marine'),'worker');assert.equal(cycleSubgroup([worker,a],'worker'),'marine');});
check('Shift Tab reverses and empty selection is safe',()=>{const tank=unit(9,'tank',{subgroupPriority:74});assert.equal(cycleSubgroup([worker,tank,a],'marine',-1),'worker');assert.equal(cycleSubgroup([],'marine'),null);});
check('Missing active subgroup has deterministic fallback',()=>{assert.equal(cycleSubgroup([worker,a],'absent'),'marine');assert.equal(cycleSubgroup([worker,a],'absent',-1),'worker');});
check('Set replaces group and does not add enemy, dead or planned entities',()=>{const r=assignControlGroup({'1':[worker.id]},'1',[a,b,dead,enemy,planned],world,'set');assert.deepEqual(r['1'],[1,2]);});
check('Set does not mutate caller groups or create duplicate IDs',()=>{const g={'1':[3]};const r=assignControlGroup(g,'1',[b,a,a],world,'set');assert.deepEqual(g,{'1':[3]});assert.deepEqual(r['1'],[1,2]);});
check('Append preserves existing group and deduplicates additions',()=>assert.deepEqual(assignControlGroup({'1':[3,1]},'1',[a,b],world,'append')['1'],[3,1,2]));
check('Append to unused group creates it',()=>assert.deepEqual(assignControlGroup({},'0',[a],world,'append')['0'],[1]));
check('Set-and-steal removes selected IDs from every other group',()=>{const r=assignControlGroup({'1':[1,3],'2':[1,2],'0':[4,1]},'2',[a],world,'setAndSteal');assert.deepEqual(r,{'0':[4],'1':[3],'2':[1]});});
check('Append-and-steal does not steal preexisting destination members',()=>{const r=assignControlGroup({'1':[1,3],'2':[2],'3':[2,3]},'2',[a],world,'appendAndSteal');assert.deepEqual(r,{'1':[3],'2':[2,1],'3':[2,3]});});
check('Stale object from reset cannot bind replacement entity with reused ID',()=>{const replacement=unit(1);assert.deepEqual(assignControlGroup({},'1',[a],[replacement],'set')['1'],[]);});
check('Empty set clears group while empty append preserves it',()=>{assert.deepEqual(assignControlGroup({'1':[1]},'1',[],world,'set')['1'],[]);assert.deepEqual(assignControlGroup({'1':[1]},'1',[],world,'append')['1'],[1]);});
check('Death pruning preserves live transported and gas-hidden membership',()=>assert.deepEqual(pruneControlGroups({'1':[1,4,5,6,7,8,999,1]},world),{'1':[1,4,5]}));
check('Group count includes cargo while recall excludes only transport cargo',()=>{const g={'1':[1,4,5]};assert.deepEqual(groupMembers(g,'1',world).map(u=>u.id),[1,4,5]);assert.deepEqual(groupMembers(g,'1',world,{selectableOnly:true}).map(u=>u.id),[1,5]);});
check('Unloading restores original group membership',()=>{const g={'1':[4]},r=pruneControlGroups(g,world);assert.deepEqual(groupMembers(r,'1',world,{selectableOnly:true}),[]);loaded.loadedIn=null;assert.deepEqual(groupMembers(r,'1',world,{selectableOnly:true}),[loaded]);loaded.loadedIn=50;});
check('Assignment excludes transport cargo but retains harvesting gas workers',()=>assert.deepEqual(assignControlGroup({},'1',[loaded,hiddenWorker],world,'set')['1'],[5]));
check('A gas-worker-only group remains recallable while its actor is hidden',()=>assert.deepEqual(groupMembers({'2':[5]},'2',world,{selectableOnly:true}),[hiddenWorker]));
check('Invalid group and unsupported operation leave original object intact',()=>{const g={'1':[1]};assert.equal(assignControlGroup(g,'A',[a],world,'set'),g);assert.equal(assignControlGroup(g,'1',[a],world,'invalid'),g);});
check('First recall selects; quick matching second recall centers',()=>{const t=createGroupRecallTracker();assert.equal(t.recall('1',0),false);assert.equal(t.recall('1',150),true);});
check('Different group or expired interval prevents centering',()=>{const t=createGroupRecallTracker();t.recall('1',0);assert.equal(t.recall('2',100),false);assert.equal(t.recall('2',450),false);});
check('Intervening selection or command cancels double-tap candidate',()=>{const t=createGroupRecallTracker();t.recall('1',0);t.cancel();assert.equal(t.recall('1',100),false);});
check('Empty or inaccessible group cannot seed a centering action',()=>{const t=createGroupRecallTracker();t.recall('1',0,false);assert.equal(t.recall('1',100),false);t.recall('1',200,false);assert.equal(t.recall('1',210),false);});
check('Clock rollback or reset cannot produce accidental centering',()=>{const t=createGroupRecallTracker();t.recall('1',100);assert.equal(t.recall('1',50),false);t.reset();assert.equal(t.recall('1',60),false);});
console.log(`${checks} control-group checks passed`);

// Standard English Terran command cards. Physical cells are deliberately not compacted.
// References and known scope are recorded in reference-data.json.
window.SC2 = (() => {
const icon=n=>'assets/icons/'+n+'.png';
const defs={
 core:{name:'Command Center',hp:1500,r:48,cost:400,build:71,building:true,vision:390,cap:15,armor:1},
 relay:{name:'Supply Depot',hp:400,r:26,cost:100,build:21,building:true,vision:230,cap:8,armor:1},
 barracks:{name:'Barracks',hp:1000,r:40,cost:150,build:46,building:true,vision:270,armor:1,requires:'relay'},
 factory:{name:'Factory',hp:1250,r:45,cost:150,gas:100,build:43,building:true,vision:280,armor:1,requires:'barracks'},
 refinery:{name:'Refinery',hp:500,r:29,cost:75,build:21,building:true,vision:220,armor:1},
 engineering:{name:'Engineering Bay',hp:850,r:36,cost:125,build:25,building:true,vision:270,armor:1,requires:'core'},
 techlab:{name:'Tech Lab',hp:400,r:20,cost:50,gas:25,build:18,building:true,vision:200,armor:1},
 reactor:{name:'Reactor',hp:400,r:20,cost:50,gas:50,build:36,building:true,vision:200,armor:1},
 worker:{name:'SCV',hp:45,r:10,cost:50,speed:105,damage:5,range:19,cool:1.07,train:12,supply:1,vision:230,armor:0,producer:'core',mechanical:true},
 marine:{name:'Marine',hp:45,r:9,cost:50,speed:105,damage:6,range:140,cool:.61,train:18,supply:1,vision:270,armor:0,producer:'barracks'},
 marauder:{name:'Marauder',hp:125,r:13,cost:100,gas:25,speed:105,damage:10,range:165,cool:1.07,train:21,supply:2,vision:270,armor:1,producer:'barracks',lab:true},
 reaper:{name:'Reaper',hp:60,r:10,cost:50,gas:50,speed:147,damage:8,range:140,cool:.79,train:32,supply:1,vision:270,armor:0,producer:'barracks'},
 hellion:{name:'Hellion',hp:90,r:15,cost:100,speed:179,damage:8,range:140,cool:1.79,train:21,supply:2,vision:290,armor:0,producer:'factory',mechanical:true},
 tank:{name:'Siege Tank',hp:175,r:19,cost:150,gas:125,speed:105,damage:15,range:196,cool:.74,train:32,supply:3,vision:350,armor:1,producer:'factory',lab:true,mechanical:true}
};
const names={core:'commandcenter',relay:'supplydepot',engineering:'engineeringbay',worker:'scv',tank:'siegetank'};
for(const [k,t] of Object.entries(defs))t.icon=icon('btn-'+(t.building?'building':'unit')+'-terran-'+(names[k]||k));
const A={};
function add(id,name,key,file,extra={}){A[id]={id,name,key,icon:icon(file),...extra}}
for(const [id,key] of Object.entries({move:'M',stop:'S',hold:'H',patrol:'P',attack:'A'}))add(id,{move:'Move',stop:'Stop',hold:'Hold Position',patrol:'Patrol',attack:'Attack'}[id],key,'btn-command-'+(id==='hold'?'holdposition':id));
add('basic','Build Structure','B','btn-command-terran-buildstructure');add('advanced','Build Advanced Structure','V','btn-command-terran-buildadvancedstructure');
add('gather','Gather','G','btn-ability-terran-gather');add('cargo','Return Cargo','C','btn-command-returncargo');add('repair','Repair','R','btn-ability-terran-repair');add('rally','Set Rally Point','Y','btn-ability-terran-setrallypoint');
add('cancel','Cancel','Escape','btn-command-cancel');add('halt','Halt Construction','T','btn-command-stop');
add('siege','Siege Mode','E','btn-unit-terran-siegetanksiegemode');add('unsiege','Tank Mode','D','btn-unit-terran-siegetank');
add('stim','Stimpack','T','btn-ability-terran-stimpack-color');add('stimResearch','Research Stimpack','T','btn-ability-terran-stimpack-color',{cost:100,gas:100,duration:100,research:true});
add('shieldResearch','Research Combat Shield','C','btn-techupgrade-terran-combatshield-color',{cost:100,gas:100,duration:79,research:true});
add('weapons','Research Infantry Weapons Level 1','E','btn-upgrade-terran-infantryweaponslevel1',{cost:100,gas:100,duration:114,research:true});
add('armor','Research Infantry Armor Level 1','A','btn-upgrade-terran-infantryarmorlevel1',{cost:100,gas:100,duration:114,research:true});
add('lift','Lift Off','L','btn-ability-terran-liftoff');add('land','Land','L','btn-ability-terran-land');
add('lower','Lower Supply Depot','R','btn-building-terran-supplydepotlowered');add('raise','Raise Supply Depot','R','btn-building-terran-supplydepot');
add('orbital','Upgrade to Orbital Command','B','btn-building-terran-commandcenter',{cost:150,duration:25,requires:'barracks'});
add('planetary','Upgrade to Planetary Fortress','P','btn-building-terran-planetaryfortress',{cost:150,gas:150,duration:36,requires:'engineering'});
add('scan','Scanner Sweep','C','btn-ability-terran-scannersweep-color',{energy:50});add('supplyDrop','Calldown Extra Supplies','X','btn-ability-terran-calldownextrasupplies-color',{energy:50});add('mule','Calldown MULE','E','btn-unit-terran-mule',{energy:50,unsupported:true});
add('load','Load SCVs','O','btn-ability-terran-load');add('unload','Unload All','D','btn-ability-terran-unloadall');
for(const [id,key] of Object.entries({core:'C',refinery:'R',relay:'S',barracks:'B',engineering:'E',factory:'F',worker:'S',marine:'A',reaper:'R',marauder:'D',hellion:'E',tank:'S',techlab:'X',reactor:'C'})) A[id]={id,name:(defs[id].building?'Build ':'Train ')+defs[id].name,key,icon:defs[id].icon,...defs[id]};
// Other Terran buttons retain their reference position, but declare unsupported gameplay.
for(const [id,name,key,kind] of [['ghost','Ghost','G','unit'],['widowmine','Widow Mine','D','unit'],['cyclone','Cyclone','N','unit'],['hellbat','Hellbat','R','unit'],['thor','Thor','T','unit'],['bunker','Bunker','U','building'],['missileturret','Missile Turret','T','building'],['sensordome','Sensor Tower','N','building'],['ghostacademy','Ghost Academy','G','building'],['armory','Armory','A','building'],['starport','Starport','S','building'],['fusioncore','Fusion Core','C','building']])add(id,name,key,'btn-'+kind+'-terran-'+id,{unsupported:true});
const put=(pairs)=>{const c=Array(15).fill(null);for(const [i,a] of pairs)c[i]=a;return c};
const common=()=>put([[0,'move'],[1,'stop'],[2,'hold'],[3,'patrol'],[4,'attack']]);
function card(e,menu){if(!e)return Array(15).fill(null);let c=common();if(e.team!==0)return Array(15).fill(null);
 if(!e.ready)return put([[8,'builder'],[14,'cancel']]);
 if(menu==='basic'&&e.type==='worker')return put([[0,'core'],[1,'refinery'],[2,'relay'],[5,'barracks'],[6,'engineering'],[10,'bunker'],[11,'missileturret'],[12,'sensordome'],[14,'cancel']]);
 if(menu==='advanced'&&e.type==='worker')return put([[0,'ghostacademy'],[5,'factory'],[6,'armory'],[10,'starport'],[11,'fusioncore'],[14,'cancel']]);
 if(e.flying){c[4]=null;c[13]='land';if(e.type!=='core'){c[10]='techlab';c[11]='reactor'}return c}
 if(e.type==='worker'){c[5]='gather';if(e.carry)c[6]='cargo';c[10]='basic';c[11]='advanced';c[12]='repair';if(e.order?.kind==='build')c[14]='halt';return c}
 if(e.type==='marine'||e.type==='marauder'){c[10]='stim';return c}
 if(e.type==='tank')return e.sieged?put([[1,'stop'],[4,'attack'],[11,'unsiege']]):(c[10]='siege',c);
 if(!e.building)return c;
 if(e.type==='core'){c=put([[0,'worker'],[9,'rally']]);if(e.morph==='orbital'){c[10]='mule';c[11]='supplyDrop';c[12]='scan';c[13]='lift'}else if(e.morph!=='planetary'){c[3]='orbital';c[4]='planetary';c[10]='load';if(e.loaded?.length)c[11]='unload';c[13]='lift'}if(e.queue.length||e.research)c[14]='cancel';return c}
 if(e.type==='barracks'||e.type==='factory'){c=e.type==='barracks'?put([[0,'marine'],[1,'reaper'],[2,'marauder'],[3,'ghost'],[9,'rally'],[13,'lift']]):put([[0,'hellion'],[1,'widowmine'],[2,'cyclone'],[3,'tank'],[5,'hellbat'],[6,'thor'],[9,'rally'],[13,'lift']]);if(!e.addon){c[10]='techlab';c[11]='reactor'}if(e.queue.length||e.research)c[14]='cancel';return c}
 if(e.type==='techlab'){c=e.parent?.type==='barracks'?put([[0,'shieldResearch'],[1,'stimResearch']]):put([]);if(e.research)c[14]='cancel';return c}
 if(e.type==='engineering')return put([[0,'weapons'],[1,'armor'],...(e.research?[[14,'cancel']]:[])]);
 if(e.type==='relay')return put([[10,e.lowered?'raise':'lower']]);return put([]);
}
add('builder','Select Builder','Q','btn-unit-terran-scv');
return{defs,actions:A,card,icon};
})();

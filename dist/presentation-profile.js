// Core ActorData.xml / GameUIData.xml, pinned catalog build74071. Draw scales
// below are our UI calibration, not proof of the native billboard projection.
export const VITAL_COLORS={life:['#d02200','#d02200','#e58100','#e58100','#e5dd00','#e5dd00','#16e500','#16e500'],
 progress:'#00c8c8',energy:'#9628dc',wire:['#ff0000','#ff0000','#e58100','#e58100','#ffff00','#ffff00','#00ff00','#00ff00']};
export const vitalBand=ratio=>Math.max(0,Math.min(7,Math.floor(ratio*8)));
export const lifeColor=ratio=>VITAL_COLORS.life[vitalBand(ratio)];
export const wireColor=ratio=>VITAL_COLORS.wire[vitalBand(ratio)];
export const NATIVE_BAR_WIDTH={worker:42,marine:36,reaper:36,marauder:50,hellion:60,tank:102,core:200,relay:80,barracks:160,factory:160,engineering:135,refinery:120,techlab:80,reactor:80};
export const barWidth=(type,viewportWidth)=>Math.max(16,(NATIVE_BAR_WIDTH[type]||60)*Math.min(1.5,Math.max(.5,viewportWidth/1920)));

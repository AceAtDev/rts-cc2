"""Compare relative straight Move displacement with private native captures.

These fixtures share scalar distance and timestep, not a whole map or rendering.
No time shifting, rotation, or current-patch equivalence verdict is applied.
"""
import argparse,json,math
from pathlib import Path
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--native-directory',type=Path,required=True)
p.add_argument('--prototype',type=Path,required=True)
a=p.parse_args();prototype=json.loads(a.prototype.read_text());reports=[]
for trace in prototype['traces']:
 type_=trace['type'];distance=trace['distanceGameUnits'];native_name={'worker':'scv','tank':'siegetank'}.get(type_,type_)
 file=a.native_directory/f'{native_name}-move{distance:g}.jsonl'
 if not file.exists():
  # Native lab uses the shorter tank label for SiegeTankTankMode.
  file=a.native_directory/f'{"tank" if type_=="tank" else native_name}-move{distance:g}.jsonl'
 records=[json.loads(line) for line in file.read_text().splitlines()];meta=records[0]
 assert meta['engine']=='native-sc2-api' and prototype['engine']=='custom-browser-prototype'
 assert meta['loops_per_second']==prototype['simulationHz']
 native={r['loop']:r['units']['unit'] for r in records[1:] if r['kind']=='frame' and 'unit' in r['units']}
 start=native[0];errors=[];proto_frames={r['loop']:r for r in trace['frames']}
 for loop,n in native.items():
  b=proto_frames[loop];errors.append(math.hypot((n['x']-start['x'])-b['x'],(n['y']-start['y'])-b['y']))
 native_done=next((loop for loop,n in native.items() if loop>0 and not n['orders']),None)
 prototype_done=next((r['loop'] for r in trace['frames'] if r['loop']>0 and r['order'] is None),None)
 reports.append({'type':type_,'distanceGameUnits':distance,'nativeInitialFacing':start['facing'],'prototypeInitialFacing':trace['frames'][0]['facing'],'samples':len(errors),'maxDisplacementErrorGameUnits':max(errors),'meanDisplacementErrorGameUnits':sum(errors)/len(errors),'nativeOrderClearLoop':native_done,'prototypeOrderClearLoop':prototype_done,'nativeVersion':meta['game_version'],'nativeMapSha256':meta['map_sha256'],'seed':meta['seed']})
print(json.dumps({'prototypeCommit':prototype['sourceCommit'],'prototypeSourceSha256':prototype['sourceSha256'],'acknowledgementBoundary':'Each action issued before relative loop 1; no temporal alignment adjustment. Native initial facing remains as captured.','reports':reports},indent=2))

"""Capture a preconfigured SC2 API game, without downloading or launching SC2.

Requires an already-running non-realtime native client, s2clientprotocol and
websockets. Setup, terrain equivalence and label mapping remain the caller's
responsibility. See docs/native-control-comparison.md before using this tool.
"""
import argparse
import asyncio
import hashlib
import json
from pathlib import Path
from urllib.parse import urlparse


def arguments():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--endpoint', default='ws://127.0.0.1:5000/sc2api')
    parser.add_argument('--fixture', required=True, type=Path)
    parser.add_argument('--labels', required=True, type=Path,
                        help='JSON object: stable fixture label -> native unit tag')
    parser.add_argument('--output', required=True, type=Path)
    return parser.parse_args()


async def capture(args):
    try:
        import websockets
        from s2clientprotocol import sc2api_pb2 as pb
        from s2clientprotocol import raw_pb2 as raw
    except ImportError as error:
        raise SystemExit('Native capture dependencies unavailable: '+str(error))
    endpoint = urlparse(args.endpoint)
    if endpoint.hostname not in ('127.0.0.1', 'localhost', '::1'):
        raise SystemExit('This collector accepts only an explicitly local SC2 API endpoint.')
    fixture = json.loads(args.fixture.read_text())
    labels = {label: int(tag) for label, tag in json.loads(args.labels.read_text()).items()}
    if not labels or len(set(labels.values())) != len(labels):
        raise SystemExit('Labels must map distinct fixture units to distinct native tags.')
    required = ('scenario', 'map_sha256', 'loops', 'loops_per_second', 'commands')
    if any(field not in fixture for field in required):
        raise SystemExit('Fixture requires: '+', '.join(required))
    if not isinstance(fixture['loops'], int) or not 1 <= fixture['loops'] <= 10000:
        raise SystemExit('Fixture duration must be between 1 and 10000 loops.')
    if fixture['loops_per_second'] <= 0:
        raise SystemExit('Fixture loops_per_second must be positive.')
    commands = {}
    for command in fixture['commands']:
        loop = command['loop']
        if not isinstance(loop, int) or not 0 <= loop < fixture['loops']:
            raise SystemExit('Command loop is outside the fixture duration.')
        commands.setdefault(loop, []).append(command)
    fixture_hash = hashlib.sha256(json.dumps(fixture, sort_keys=True,
                                            separators=(',', ':')).encode()).hexdigest()
    async with websockets.connect(args.endpoint, max_size=64*1024*1024) as websocket:
        request_id = 0

        async def request(kind, message):
            nonlocal request_id
            request_id += 1
            envelope = pb.Request(id=request_id)
            getattr(envelope, kind).CopyFrom(message)
            await websocket.send(envelope.SerializeToString())
            response = pb.Response()
            response.ParseFromString(await websocket.recv())
            if response.id != request_id:
                raise RuntimeError('SC2 response ID does not match request ID.')
            if response.error:
                raise RuntimeError('; '.join(response.error))
            if response.status != pb.in_game:
                raise RuntimeError('Collector requires an already joined, stepped game.')
            return getattr(response, kind)

        ping = await request('ping', pb.RequestPing())
        info = await request('game_info', pb.RequestGameInfo())
        if not info.options.raw:
            raise RuntimeError('Join the native game with InterfaceOptions.raw enabled.')
        observed = await request('observation', pb.RequestObservation())
        start_loop = observed.observation.game_loop
        with args.output.open('x') as output:
            def emit(row):
                output.write(json.dumps(row, separators=(',', ':'))+'\n')
                output.flush()

            emit({'kind': 'metadata', 'engine': 'native-sc2-api',
                  'fixture_sha256': fixture_hash, 'scenario': fixture['scenario'],
                  'map_sha256': fixture['map_sha256'], 'map_name': info.map_name,
                  'game_version': ping.game_version, 'data_version': ping.data_version,
                  'base_build': ping.base_build, 'data_build': ping.data_build,
                  'loops_per_second': fixture['loops_per_second'],
                  'start_loop': start_loop, 'labels': labels,
                  'map_hash_verified_by_collector': False})
            for relative in range(fixture['loops']+1):
                observation = observed.observation
                if observation.game_loop != start_loop+relative:
                    raise RuntimeError('Game advanced outside the requested single-loop schedule.')
                units = {int(unit.tag): unit for unit in observation.raw_data.units}
                rows = {}
                for label, tag in labels.items():
                    if tag not in units:
                        continue  # Death, gas hiding and fog are meaningful absences.
                    unit = units[tag]
                    rows[label] = {'x': unit.pos.x, 'y': unit.pos.y,
                                   'facing': unit.facing, 'radius': unit.radius,
                                   'health': unit.health, 'cooldown': unit.weapon_cooldown,
                                   'engaged_target_tag': str(unit.engaged_target_tag),
                                   'buff_ids': list(unit.buff_ids),
                                   'order_abilities': [order.ability_id for order in unit.orders]}
                emit({'kind': 'frame', 'loop': relative,
                      'seconds': relative/fixture['loops_per_second'], 'units': rows,
                      'minerals': observation.player_common.minerals,
                      'action_execution_loops': [action.game_loop-start_loop
                                                 for action in observed.actions],
                      'action_errors': [{'tag': str(error.unit_tag),
                                         'ability': error.ability_id, 'result': error.result}
                                        for error in observed.action_errors]})
                if relative == fixture['loops']:
                    break
                for command in commands.get(relative, []):
                    unit_command = raw.ActionRawUnitCommand(
                        ability_id=command['ability_id'],
                        unit_tags=[labels[label] for label in command['units']],
                        queue_command=command.get('queued', False))
                    if 'target' in command:
                        unit_command.target_unit_tag = labels[command['target']]
                    elif 'point' in command:
                        unit_command.target_world_space_pos.x = command['point'][0]
                        unit_command.target_world_space_pos.y = command['point'][1]
                    action = pb.Action(action_raw=raw.ActionRaw(unit_command=unit_command))
                    response = await request('action', pb.RequestAction(actions=[action]))
                    emit({'kind': 'command', 'requested_loop': relative,
                          'command': command, 'result': list(response.result)})
                await request('step', pb.RequestStep(count=1))
                observed = await request('observation', pb.RequestObservation())


if __name__ == '__main__':
    asyncio.run(capture(arguments()))

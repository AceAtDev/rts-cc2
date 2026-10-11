"""Loop-stepped native SC2 fixture runner (research use; see docs/native-client-license-boundary.md).

Launches two local headless clients, creates a fog-free, non-realtime game with
two Participant players (no computer controller), and exposes debug spawning,
raw commands from each owner's client and per-loop merged observations.
Native binaries, maps and captures stay outside the repository.
"""
import json, os, socket, subprocess, threading, time
from pathlib import Path
from websockets.sync.client import connect
from s2clientprotocol import sc2api_pb2 as pb, raw_pb2 as raw, debug_pb2 as dbg, common_pb2 as common

SC2 = Path(os.environ.get('SC2PATH', '/home/user/native-sc2/StarCraftII'))
UNIT = {'SCV': 45, 'Marine': 48, 'Marauder': 51, 'Reaper': 49, 'Hellion': 53, 'SiegeTank': 33,
        'SiegeTankSieged': 32, 'Thor': 52, 'CommandCenter': 18, 'SupplyDepot': 19, 'SupplyDepotLowered': 47,
        'Zergling': 105, 'Roach': 110, 'Stalker': 74, 'Zealot': 73, 'Ultralisk': 109, 'MineralField': 341,
        'Immortal': 83, 'Archon': 141, 'Colossus': 4, 'Queen': 126, 'Cyclone': 692, 'Hydralisk': 107,
        'Adept': 311, 'Probe': 84, 'Ravager': 688, 'Hellbat': 484, 'Ghost': 50}
KEPT = ('CommandCenter', 'MineralField')  # survive clear(); every other listed type is removed
ABILITY = {'smart': 1, 'stop': 4, 'move': 16, 'patrol': 17, 'hold': 18, 'attack': 23, 'siege': 388, 'unsiege': 390}


def free_port():
    with socket.socket() as s:
        s.bind(('127.0.0.1', 0))
        return s.getsockname()[1]


class Client:
    def __init__(self, index):
        self.port = free_port()
        temp = Path(f'/tmp/sc2-client-{index}-{self.port}')
        temp.mkdir(parents=True, exist_ok=True)
        binary = sorted((SC2/'Versions').glob('Base*/SC2_x64'))[-1]
        self.process = subprocess.Popen([str(binary), '-listen', '127.0.0.1', '-port', str(self.port),
                                         '-dataDir', str(SC2)+'/', '-tempDir', str(temp)+'/', '-displayMode', '0'],
                                        cwd=str(SC2), stdout=open(temp/'client.log','w'), stderr=subprocess.STDOUT)
        self.log=temp/'client.log'
        for _ in range(240):
            if 'Ready for commands' not in self.log.read_text(errors='ignore'):
                time.sleep(.5); continue
            try:
                self.ws = connect(f'ws://127.0.0.1:{self.port}/sc2api', max_size=256*1024*1024, open_timeout=5, ping_interval=None)
                break
            except Exception:
                time.sleep(.5)
        else:
            raise RuntimeError('SC2 client did not open its API listener')
        self.id = 0

    def request(self, kind, message):
        self.id += 1
        envelope = pb.Request(id=self.id)
        getattr(envelope, kind).CopyFrom(message)
        self.ws.send(envelope.SerializeToString())
        response = pb.Response()
        response.ParseFromString(self.ws.recv(timeout=600))
        if response.error:
            raise RuntimeError(kind+': '+'; '.join(response.error))
        return getattr(response, kind)

    def close(self):
        try:
            self.request('quit', pb.RequestQuit())
        except Exception:
            pass
        self.process.kill()


def both(fn):
    out = [None, None]
    threads = [threading.Thread(target=lambda i=i: out.__setitem__(i, fn(i))) for i in (0, 1)]
    for t in threads: t.start()
    for t in threads: t.join()
    return out


class NativeLab:
    def __init__(self, map_name='Flat64.SC2Map', seed=42):
        self.clients = [Client(0), Client(1)]
        c0 = self.clients[0]
        maps = list((SC2/'Maps').rglob(map_name))
        if not maps:
            raise RuntimeError('map not found: '+map_name)
        create = pb.RequestCreateGame(local_map=pb.LocalMap(map_path=str(maps[0])), realtime=False,
                                      random_seed=seed, disable_fog=True)
        create.player_setup.add(type=pb.Participant)
        create.player_setup.add(type=pb.Participant)
        c0.request('create_game', create)
        ports = [free_port() for _ in range(4)]

        def join(i):
            request = pb.RequestJoinGame(race=common.Terran, options=pb.InterfaceOptions(raw=True, score=False))
            request.shared_port = 0
            request.server_ports.game_port, request.server_ports.base_port = ports[0], ports[1]
            request.client_ports.add(game_port=ports[2], base_port=ports[3])
            return self.clients[i].request('join_game', request).player_id
        self.player_ids = both(join)
        self.ping = c0.request('ping', pb.RequestPing())
        self.info = c0.request('game_info', pb.RequestGameInfo())
        self.loop = 0
        self.step(1)

    # --- state -------------------------------------------------------------
    def observe(self):
        obs = both(lambda i: self.clients[i].request('observation', pb.RequestObservation()))
        self.loop = obs[0].observation.game_loop
        units = {}
        for i, o in enumerate(obs):
            for u in o.observation.raw_data.units:
                tag = u.tag
                own = u.owner == self.player_ids[i]
                row = units.get(tag)
                if row is None or own:
                    units[tag] = {'tag': tag, 'type': u.unit_type, 'owner': u.owner, 'x': u.pos.x, 'y': u.pos.y,
                                  'facing': u.facing, 'r': u.radius, 'hp': u.health, 'cd': u.weapon_cooldown,
                                  'target': u.engaged_target_tag,
                                  'orders': [[od.ability_id, od.target_unit_tag if od.HasField('target_unit_tag') else None,
                                              [od.target_world_space_pos.x, od.target_world_space_pos.y]
                                              if od.HasField('target_world_space_pos') else None] for od in u.orders]
                                  if own else (row or {}).get('orders', [])}
        self.units = units
        self.errors = [[e.unit_tag, e.ability_id, e.result] for o in obs for e in o.action_errors]
        return units

    def step(self, n=1):
        both(lambda i: self.clients[i].request('step', pb.RequestStep(count=n)))
        return self.observe()

    # --- fixtures ----------------------------------------------------------
    def debug(self, commands, client=0):
        self.clients[client].request('debug', pb.RequestDebug(debug=commands))

    def clear(self, keep_structures=True):
        """Remove every mobile unit (and optionally structures other than town halls)."""
        units = self.observe()
        doomed = [t for t, u in units.items() if u['owner'] in (1, 2) and (u['type'] not in (UNIT['CommandCenter'],)
                  if not keep_structures else u['type'] in [v for k, v in UNIT.items() if k not in KEPT])]
        if doomed:
            self.debug([dbg.DebugCommand(kill_unit=dbg.DebugKillUnit(tag=doomed))])
        self.step(2)

    def spawn(self, kind, owner, points):
        """Create one unit per point; returns tags in point order (matched by nearest new unit)."""
        before = set(self.observe())
        cmds = [dbg.DebugCommand(create_unit=dbg.DebugCreateUnit(unit_type=UNIT[kind], owner=owner,
                pos=common.Point2D(x=p[0], y=p[1]), quantity=1)) for p in points]
        self.debug(cmds)
        for _ in range(8):
            units = self.step(1)
            new = [u for t, u in units.items() if t not in before and u['type'] == UNIT[kind] and u['owner'] == owner]
            if len(new) >= len(points):
                break
        tags = []
        for p in points:
            best = min((u for u in new if u['tag'] not in tags), key=lambda u: (u['x']-p[0])**2+(u['y']-p[1])**2)
            tags.append(best['tag'])
        return tags

    def owner_client(self, tags):
        owners = {self.units[t]['owner'] for t in tags}
        assert len(owners) == 1, 'one command per owner'
        return self.player_ids.index(owners.pop())

    def command(self, ability, tags, point=None, target=None, queued=False):
        cmd = raw.ActionRawUnitCommand(ability_id=ABILITY.get(ability, ability), unit_tags=list(tags), queue_command=queued)
        if target is not None:
            cmd.target_unit_tag = target
        elif point is not None:
            cmd.target_world_space_pos.x, cmd.target_world_space_pos.y = point
        result = self.clients[self.owner_client(tags)].request('action', pb.RequestAction(
            actions=[pb.Action(action_raw=raw.ActionRaw(unit_command=cmd))]))
        return list(result.result)

    def record(self, loops, tags, schedule=None, out=None):
        """Step `loops` single loops; schedule maps relative loop -> callable run before stepping."""
        frames = []
        for rel in range(loops+1):
            units = self.units
            frames.append({'loop': rel, 'game_loop': self.loop, 'units': {str(t): {k: units[t][k] for k in ('x', 'y', 'facing', 'hp', 'cd', 'target', 'orders', 'r')}
                           for t in tags if t in units}, 'errors': self.errors})
            if rel == loops:
                break
            if schedule and rel in schedule:
                schedule[rel]()
            self.step(1)
        if out:
            Path(out).parent.mkdir(parents=True, exist_ok=True)
            Path(out).write_text(json.dumps({'version': self.ping.game_version, 'frames': frames}))
        return frames

    def close(self):
        for c in self.clients:
            c.close()


if __name__ == '__main__':
    lab = NativeLab()
    print('game', lab.ping.game_version, 'players', lab.player_ids, 'map', lab.info.map_name,
          'playable', lab.info.start_raw.playable_area)
    units = lab.observe()
    print({(u['type'], u['owner']) for u in units.values()})
    lab.close()

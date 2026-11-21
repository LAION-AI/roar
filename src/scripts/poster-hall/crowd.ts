import * as THREE from 'three';
import { LAYOUT, type PosterSpot } from './hall';
import { drawBlob, rng } from './posters';

type Kind = 'presenter' | 'agent' | 'human';

interface Walker {
  kind: Kind;
  group: THREE.Group;
  head: THREE.Mesh;
  halo?: THREE.Mesh;
  shadow: THREE.Mesh;
  floorY: number;
  speed: number;
  path: THREE.Vector3[];
  state: 'walk' | 'look';
  timer: number;
  yaw: number;
  targetYaw: number;
  phase: number;
  spot?: number;
  home?: PosterSpot;
}

const UP_Y = { presenter: 0.32, agent: 0.32, human: 0 };

function lerpAngle(a: number, b: number, t: number) {
  const d = ((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  return a + d * t;
}

export function buildCrowd(scene: THREE.Scene, posters: PosterSpot[], visitors = 34) {
  const r = rng(2027);
  const blobTex = new THREE.CanvasTexture(drawBlob('0,0,0', 0.55));
  const glowTex = new THREE.CanvasTexture(drawBlob('245,200,76', 0.35));
  const blobGeo = new THREE.PlaneGeometry(1.1, 1.1);
  const blobMat = new THREE.MeshBasicMaterial({
    map: blobTex,
    transparent: true,
    depthWrite: false,
  });
  const glowMat = new THREE.MeshBasicMaterial({
    map: glowTex,
    transparent: true,
    depthWrite: false,
  });

  const agentBody = new THREE.CapsuleGeometry(0.21, 0.62, 4, 14);
  const humanBody = new THREE.CapsuleGeometry(0.24, 0.78, 4, 14);
  const agentHead = new THREE.OctahedronGeometry(0.21);
  const humanHead = new THREE.SphereGeometry(0.17, 18, 14);
  const haloGeo = new THREE.TorusGeometry(0.34, 0.025, 8, 40);
  // A visor shows which way each avatar faces (+z is "forward").
  const visorGeo = new THREE.BoxGeometry(0.24, 0.07, 0.08);
  const visorMat = new THREE.MeshStandardMaterial({
    color: 0x061220,
    roughness: 0.2,
    metalness: 0.6,
  });

  const mats = {
    presenterBody: new THREE.MeshStandardMaterial({
      color: 0x10283d,
      roughness: 0.35,
      metalness: 0.5,
    }),
    agentBody: new THREE.MeshStandardMaterial({ color: 0x1d374e, roughness: 0.4, metalness: 0.45 }),
    humanBody: new THREE.MeshStandardMaterial({ color: 0xe8edf0, roughness: 0.8 }),
    humanHead: new THREE.MeshStandardMaterial({ color: 0xc9d5de, roughness: 0.7 }),
    presenterHead: new THREE.MeshStandardMaterial({
      color: 0xf5c84c,
      emissive: 0xf5c84c,
      emissiveIntensity: 0.9,
    }),
    agentHead: new THREE.MeshStandardMaterial({
      color: 0x6aa8ff,
      emissive: 0x6aa8ff,
      emissiveIntensity: 0.9,
    }),
  };

  const walkers: Walker[] = [];

  function make(kind: Kind, pos: THREE.Vector3, yaw: number): Walker {
    const group = new THREE.Group();
    const isAgent = kind !== 'human';
    const body = new THREE.Mesh(
      isAgent ? agentBody : humanBody,
      kind === 'presenter' ? mats.presenterBody : isAgent ? mats.agentBody : mats.humanBody,
    );
    body.position.y = isAgent ? 0.52 : 0.63;
    const head = new THREE.Mesh(
      isAgent ? agentHead : humanHead,
      kind === 'presenter' ? mats.presenterHead : isAgent ? mats.agentHead : mats.humanHead,
    );
    head.position.y = isAgent ? 1.27 : 1.36;
    const visor = new THREE.Mesh(visorGeo, visorMat);
    visor.position.set(0, head.position.y + 0.01, isAgent ? 0.13 : 0.14);
    group.add(body, head, visor);
    let halo: THREE.Mesh | undefined;
    if (kind === 'presenter') {
      halo = new THREE.Mesh(
        haloGeo,
        new THREE.MeshStandardMaterial({
          color: 0xf5c84c,
          emissive: 0xf5c84c,
          emissiveIntensity: 0.4,
        }),
      );
      halo.rotation.x = Math.PI / 2;
      halo.position.y = 0.72;
      group.add(halo);
    }
    const shadow = new THREE.Mesh(blobGeo, isAgent ? glowMat : blobMat);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.02 - UP_Y[kind];
    group.add(shadow);
    group.position.copy(pos);
    group.position.y = pos.y + UP_Y[kind];
    group.rotation.y = yaw;
    scene.add(group);
    const w: Walker = {
      kind,
      group,
      head,
      halo,
      shadow,
      floorY: pos.y,
      speed: kind === 'human' ? 0.9 + r() * 0.35 : 1.05 + r() * 0.45,
      path: [],
      state: 'look',
      timer: r() * 4,
      yaw,
      targetYaw: yaw,
      phase: r() * Math.PI * 2,
    };
    walkers.push(w);
    return w;
  }

  // Author agents stand beside their posters, facing the audience, turned a bit towards the poster.
  const presenterYaw = (p: PosterSpot) => p.facing + Math.PI - 0.45 * p.normal.z;
  for (const p of posters) {
    const w = make('presenter', p.presenter, presenterYaw(p));
    w.home = p;
  }

  // Visitors: agents and humans, spread over the viewing spots
  for (let i = 0; i < visitors; i++) {
    const spot = Math.floor(r() * posters.length);
    const p = posters[spot];
    const pos = p.view.clone().add(new THREE.Vector3((r() - 0.5) * 1.6, 0, (r() - 0.5) * 0.6));
    const w = make(i % 5 < 3 ? 'agent' : 'human', pos, p.facing);
    w.spot = spot;
    w.timer = 1 + r() * 8;
  }

  const visiting = new Array(posters.length).fill(0);

  // Manhattan route through the free columns, so nobody walks through a poster stand.
  function route(from: THREE.Vector3, to: THREE.Vector3) {
    const gaps = LAYOUT.gapXs;
    let gx = gaps[0];
    for (const g of gaps)
      if (Math.abs(g - to.x) + Math.abs(g - from.x) < Math.abs(gx - to.x) + Math.abs(gx - from.x))
        gx = g;
    gx += (r() - 0.5) * 1.2;
    return [new THREE.Vector3(gx, 0, from.z), new THREE.Vector3(gx, 0, to.z), to.clone()];
  }

  function chooseNext(w: Walker) {
    let spot: number;
    // About a quarter of the walks go to the spotlight podium.
    if (r() < 0.25) spot = posters.length - 1 - Math.floor(r() * 3);
    else spot = Math.floor(r() * (posters.length - 3));
    if (spot === w.spot) spot = (spot + 1) % posters.length;
    const p = posters[spot];
    const target = p.view.clone().add(new THREE.Vector3((r() - 0.5) * 1.8, 0, (r() - 0.5) * 0.7));
    w.path = route(w.group.position, target);
    w.spot = spot;
    w.state = 'walk';
  }

  const tmp = new THREE.Vector3();
  let time = 0;

  function update(dt: number) {
    time += dt;
    visiting.fill(0);
    for (const w of walkers)
      if (w.kind !== 'presenter' && w.state === 'look' && w.spot !== undefined) visiting[w.spot]++;

    for (const w of walkers) {
      const g = w.group;
      if (w.kind === 'presenter') {
        // Turn a little towards the audience; the halo brightens while someone visits.
        const idx = posters.indexOf(w.home!);
        const busy = visiting[idx] > 0;
        w.targetYaw = presenterYaw(w.home!) + Math.sin(time * 0.6 + w.phase) * (busy ? 0.5 : 0.2);
        const mat = w.halo!.material as THREE.MeshStandardMaterial;
        mat.emissiveIntensity +=
          ((busy ? 1.6 : 0.35) - mat.emissiveIntensity) * Math.min(1, dt * 3);
      } else if (w.state === 'look') {
        w.timer -= dt;
        w.targetYaw = posters[w.spot!].facing;
        if (w.timer <= 0) chooseNext(w);
      } else {
        const wp = w.path[0];
        tmp.set(wp.x - g.position.x, 0, wp.z - g.position.z);
        const d = tmp.length();
        if (d < 0.12) {
          w.path.shift();
          if (!w.path.length) {
            w.state = 'look';
            w.timer = 3 + r() * 9;
          }
        } else {
          tmp.multiplyScalar(Math.min(d, w.speed * dt) / d);
          g.position.x += tmp.x;
          g.position.z += tmp.z;
          w.targetYaw = Math.atan2(tmp.x, tmp.z);
        }
      }

      w.yaw = lerpAngle(w.yaw, w.targetYaw, Math.min(1, dt * 6));
      g.rotation.y = w.yaw;
      const walking = w.state === 'walk' && w.kind !== 'presenter';
      if (w.kind === 'human') {
        g.position.y = w.floorY + (walking ? Math.abs(Math.sin(time * 8 + w.phase)) * 0.05 : 0);
      } else {
        g.position.y = w.floorY + UP_Y[w.kind] + Math.sin(time * 2 + w.phase) * 0.05;
        w.head.rotation.y += dt * (walking ? 2.2 : 0.9);
      }
      // Shadow stays on the floor while the avatar bobs or floats.
      w.shadow.position.y = w.floorY + 0.02 - g.position.y;
    }

    // Keep visitors from walking into each other
    for (let i = 0; i < walkers.length; i++) {
      const a = walkers[i];
      if (a.kind === 'presenter') continue;
      for (let j = i + 1; j < walkers.length; j++) {
        const b = walkers[j];
        const dx = b.group.position.x - a.group.position.x;
        const dz = b.group.position.z - a.group.position.z;
        const d2 = dx * dx + dz * dz;
        if (d2 > 0 && d2 < 0.36) {
          const d = Math.sqrt(d2);
          const push = (0.6 - d) / 2 / d;
          if (b.kind !== 'presenter') {
            b.group.position.x += dx * push;
            b.group.position.z += dz * push;
          }
          a.group.position.x -= dx * push;
          a.group.position.z -= dz * push;
        }
      }
    }
  }

  /** Visitors step aside for the player in walk mode (also while the crowd is paused). */
  function avoid(player: THREE.Vector3, radius = 1.2) {
    for (const w of walkers) {
      if (w.kind === 'presenter') continue;
      const dx = w.group.position.x - player.x;
      const dz = w.group.position.z - player.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.001 && d < radius) {
        w.group.position.x = player.x + (dx / d) * radius;
        w.group.position.z = player.z + (dz / d) * radius;
      }
    }
  }

  const counts = {
    presenters: walkers.filter((w) => w.kind === 'presenter').length,
    agents: walkers.filter((w) => w.kind === 'agent').length,
    humans: walkers.filter((w) => w.kind === 'human').length,
  };
  return { update, avoid, counts };
}

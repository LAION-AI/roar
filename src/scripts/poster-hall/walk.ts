import * as THREE from 'three';
import { floorHeight, LAYOUT, type PosterSpot, type Solid } from './hall';
import { drawBlob } from './posters';

export type View = 'third' | 'first';

interface Options {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  /** Meshes the third-person camera must not pass through. */
  blockers: THREE.Object3D[];
  solids: Solid[];
  posters: PosterSpot[];
}

const RADIUS = 0.3; // player's footprint
const STEP_UP = 0.35; // highest step the player can climb
const WALK = 2.4;
const RUN = 4.6;
const EYE = 1.62;

const KEYS: Record<string, 'fwd' | 'back' | 'left' | 'right'> = {
  KeyW: 'fwd',
  ArrowUp: 'fwd',
  KeyS: 'back',
  ArrowDown: 'back',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
};
export const isMoveKey = (code: string) => code in KEYS;

/** Walk mode: the visitor's own avatar, moved with WASD / arrows / a touch stick. */
export function createWalk({ scene, camera, blockers, solids, posters }: Options) {
  // Player avatar: a human visitor with a gold ring and a marker above the head.
  const avatar = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.24, 0.78, 4, 14),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 }),
  );
  body.position.y = 0.63;
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.17, 18, 14),
    new THREE.MeshStandardMaterial({ color: 0xdfe7ed, roughness: 0.6 }),
  );
  head.position.y = 1.36;
  const visor = new THREE.Mesh(
    new THREE.BoxGeometry(0.24, 0.07, 0.08),
    new THREE.MeshStandardMaterial({ color: 0xf5c84c, emissive: 0xf5c84c, emissiveIntensity: 0.6 }),
  );
  visor.position.set(0, 1.37, 0.14);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.42, 0.5, 40),
    new THREE.MeshBasicMaterial({
      color: 0xf5c84c,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
    }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.025;
  const marker = new THREE.Mesh(
    new THREE.ConeGeometry(0.12, 0.22, 4),
    new THREE.MeshStandardMaterial({ color: 0xf5c84c, emissive: 0xf5c84c, emissiveIntensity: 0.9 }),
  );
  marker.rotation.x = Math.PI;
  marker.position.y = 1.95;
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.1, 1.1),
    new THREE.MeshBasicMaterial({
      map: new THREE.CanvasTexture(drawBlob('0,0,0', 0.55)),
      transparent: true,
      depthWrite: false,
    }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.015;
  avatar.add(shadow, ring, body, head, visor, marker);
  avatar.visible = false;
  scene.add(avatar);

  const pos = new THREE.Vector3();
  let floorY = 0;
  let yaw = Math.PI; // facing the podium
  let bodyYaw = Math.PI;
  let pitch = 0.18;
  let view: View = 'third';
  let active = false;
  let time = 0;
  const held = new Set<string>();
  let run = false;
  const stick = new THREE.Vector2();
  const camTarget = new THREE.Vector3();
  const lookTarget = new THREE.Vector3();
  const ray = new THREE.Raycaster();
  const presenterSpots = posters.map((p) => p.presenter);

  function blocked(x: number, z: number) {
    const b = LAYOUT.bounds;
    if (x < b.minX + 1 || x > b.maxX - 1 || z < b.minZ - 0.2 || z > b.maxZ + 1) return true;
    for (const s of solids)
      if (x > s.minX - RADIUS && x < s.maxX + RADIUS && z > s.minZ - RADIUS && z < s.maxZ + RADIUS)
        return true;
    for (const p of presenterSpots)
      if (Math.abs(p.y - floorHeight(x, z)) < 0.5 && Math.hypot(p.x - x, p.z - z) < 0.55)
        return true;
    return floorHeight(x, z) - floorY > STEP_UP;
  }

  function enter(start?: THREE.Vector3, startYaw = Math.PI) {
    active = true;
    pos.copy(start ?? new THREE.Vector3(0, 0, 13.5));
    floorY = floorHeight(pos.x, pos.z);
    yaw = bodyYaw = startYaw;
    pitch = 0.18;
    avatar.visible = view === 'third';
    camTarget.copy(camera.position);
    lookTarget.copy(pos).add(new THREE.Vector3(0, 1.4, 0));
  }
  function exit() {
    active = false;
    avatar.visible = false;
    held.clear();
    stick.set(0, 0);
  }
  function toggleView() {
    view = view === 'third' ? 'first' : 'third';
    avatar.visible = active && view === 'third';
    return view;
  }

  function key(code: string, down: boolean) {
    if (code === 'ShiftLeft' || code === 'ShiftRight') run = down;
    const dir = KEYS[code];
    if (!dir) return false;
    if (down) held.add(dir);
    else held.delete(dir);
    return true;
  }
  /** Drag to look: right turns right, down looks down. */
  function look(dx: number, dy: number) {
    yaw -= dx * 0.0045;
    pitch = THREE.MathUtils.clamp(pitch + dy * 0.003, -0.45, 0.75);
  }

  function nearest(): PosterSpot | null {
    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);
    let best: PosterSpot | null = null;
    let bestD = Infinity;
    for (const p of posters) {
      const dx = p.center.x - pos.x;
      const dz = p.center.z - pos.z;
      const d = Math.hypot(dx, dz);
      // Close enough, on the poster's printed side, and roughly looking at it.
      const reach = p.width > 2 ? 6 : 3.4;
      const inFront = (pos.x - p.center.x) * p.normal.x + (pos.z - p.center.z) * p.normal.z > 0.2;
      if (d < reach && inFront && (dx * fx + dz * fz) / d > 0.35 && d < bestD) {
        best = p;
        bestD = d;
      }
    }
    return best;
  }

  function update(dt: number) {
    if (!active) return;
    time += dt;
    const fwd = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const right = new THREE.Vector3(-Math.cos(yaw), 0, Math.sin(yaw));
    const move = new THREE.Vector3();
    if (held.has('fwd')) move.add(fwd);
    if (held.has('back')) move.sub(fwd);
    if (held.has('right')) move.add(right);
    if (held.has('left')) move.sub(right);
    move.addScaledVector(fwd, -stick.y).addScaledVector(right, stick.x);
    const moving = move.lengthSq() > 0.0004;
    if (moving) {
      const amount = Math.min(1, move.length());
      move.normalize().multiplyScalar((run ? RUN : WALK) * amount * dt);
      bodyYaw = Math.atan2(move.x, move.z);
      // Small steps, so slow frames never skip through a stand; slide along obstacles by
      // trying each axis on its own.
      const steps = Math.max(1, Math.ceil(move.length() / 0.12));
      move.divideScalar(steps);
      for (let i = 0; i < steps; i++) {
        if (!blocked(pos.x + move.x, pos.z)) pos.x += move.x;
        if (!blocked(pos.x, pos.z + move.z)) pos.z += move.z;
      }
    }
    const ground = floorHeight(pos.x, pos.z);
    floorY += (ground - floorY) * Math.min(1, dt * 14);

    // Avatar
    const d = ((bodyYaw - avatar.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    avatar.rotation.y += d * Math.min(1, dt * 10);
    avatar.position.set(pos.x, floorY + (moving ? Math.abs(Math.sin(time * 9)) * 0.06 : 0), pos.z);
    marker.position.y = 1.95 + Math.sin(time * 3) * 0.05;
    marker.rotation.y += dt * 2;

    // Camera
    const headPos = new THREE.Vector3(pos.x, floorY + 1.45, pos.z);
    if (view === 'first') {
      camTarget.set(pos.x, floorY + EYE, pos.z);
      camera.position.copy(camTarget);
      lookTarget
        .copy(camTarget)
        .add(new THREE.Vector3(fwd.x * Math.cos(pitch), -Math.sin(pitch), fwd.z * Math.cos(pitch)));
      camera.lookAt(lookTarget);
      return;
    }
    // Over-the-shoulder: the camera sits behind and a little to the right, so the player
    // stands left of centre and the view ahead stays clear.
    const dist = 4.4;
    const pivot = headPos.clone().addScaledVector(right, 0.65);
    const back = new THREE.Vector3(
      -fwd.x * Math.cos(pitch),
      Math.sin(pitch) + 0.15,
      -fwd.z * Math.cos(pitch),
    ).normalize();
    // Pull the camera in when a poster stand is between it and the player.
    ray.set(pivot, back);
    ray.far = dist;
    const hit = ray.intersectObjects(blockers, false)[0];
    const camDist = hit ? Math.max(0.6, hit.distance - 0.25) : dist;
    const desired = pivot.clone().addScaledVector(back, camDist);
    desired.y = Math.max(desired.y, floorY + 0.4);
    const k = 1 - Math.exp(-dt * 12);
    camTarget.lerp(desired, k);
    camera.position.copy(camTarget);
    lookTarget.lerp(pivot.clone().addScaledVector(fwd, 3), k);
    camera.lookAt(lookTarget);
  }

  return {
    enter,
    exit,
    toggleView,
    key,
    look,
    nearest,
    update,
    setStick: (x: number, y: number) => stick.set(x, y),
    get active() {
      return active;
    },
    get view() {
      return view;
    },
    position: pos,
  };
}

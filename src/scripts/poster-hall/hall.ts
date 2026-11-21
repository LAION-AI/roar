import * as THREE from 'three';
import { drawBackdrop, drawPoster, posterInfo, type PosterInfo } from './posters';

export interface PosterSpot {
  mesh: THREE.Mesh;
  info: PosterInfo;
  center: THREE.Vector3;
  normal: THREE.Vector3;
  width: number;
  height: number;
  /** Where visitors stand to look at it, and which way they face. */
  view: THREE.Vector3;
  facing: number;
  /** Where its author agent stands. */
  presenter: THREE.Vector3;
}

export const LAYOUT = {
  boardXs: [-12, -6, 0, 6, 12],
  rowZs: [5, -5],
  /** Free columns between and beside the boards, used for walking routes. */
  gapXs: [-15, -9, -3, 3, 9, 15],
  podiumZ: -17,
  podiumFront: -13.2,
  bounds: { minX: -22, maxX: 22, minZ: -20, maxZ: 16 },
};

const POSTER_W = 1.5;
const POSTER_H = POSTER_W * 1.414;

/** Posters glow a little, like lit boards, so they stay readable in the dim hall. */
export const POSTER_GLOW = 0.38;
function posterMaterial(map: THREE.Texture) {
  return new THREE.MeshStandardMaterial({
    map,
    emissive: 0xffffff,
    emissiveMap: map,
    emissiveIntensity: POSTER_GLOW,
    roughness: 0.75,
  });
}

function texture(canvas: HTMLCanvasElement, renderer: THREE.WebGLRenderer) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return t;
}

export function buildHall(scene: THREE.Scene, renderer: THREE.WebGLRenderer) {
  const posters: PosterSpot[] = [];
  const frames: THREE.Mesh[] = [];

  scene.background = new THREE.Color(0x061220);
  scene.fog = new THREE.Fog(0x061220, 34, 80);

  // Light: cool ambient from above, warm key light, spotlights on the podium.
  scene.add(new THREE.HemisphereLight(0xb8c9d8, 0x061220, 1.4));
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(8, 20, 14);
  scene.add(key);

  // Floor with the site's fine grid
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(120, 100),
    new THREE.MeshStandardMaterial({ color: 0x0b1c2d, roughness: 0.92, metalness: 0.05 }),
  );
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);
  const grid = new THREE.GridHelper(120, 60, 0x2b4d6b, 0x163049);
  const gridMat = grid.material as THREE.Material;
  gridMat.transparent = true;
  gridMat.opacity = 0.55;
  grid.position.y = 0.005;
  scene.add(grid);

  // Aisle runner leading to the podium
  const runner = new THREE.Mesh(
    new THREE.PlaneGeometry(5, 30),
    new THREE.MeshStandardMaterial({ color: 0x10283d, roughness: 1 }),
  );
  runner.rotation.x = -Math.PI / 2;
  runner.position.set(0, 0.01, 1.5);
  scene.add(runner);

  // Ceiling light strips (above the backdrop's top edge, so they never cross it)
  const stripMat = new THREE.MeshBasicMaterial({ color: 0xdfe9f2 });
  for (const z of [-2, 9]) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(34, 0.08, 0.35), stripMat);
    strip.position.set(0, 14, z);
    scene.add(strip);
  }

  // Poster stands: double-sided boards in two rows
  const boardMat = new THREE.MeshStandardMaterial({
    color: 0x1d374e,
    roughness: 0.6,
    metalness: 0.2,
  });
  const legMat = new THREE.MeshStandardMaterial({
    color: 0x0d2236,
    roughness: 0.5,
    metalness: 0.6,
  });
  const boardGeo = new THREE.BoxGeometry(POSTER_W + 0.3, POSTER_H + 0.3, 0.08);
  const legGeo = new THREE.CylinderGeometry(0.035, 0.035, 1.05, 8);
  const posterGeo = new THREE.PlaneGeometry(POSTER_W, POSTER_H);
  const poleY = 1.05 + POSTER_H / 2;
  let seed = 1;
  for (const z of LAYOUT.rowZs) {
    for (const x of LAYOUT.boardXs) {
      const board = new THREE.Mesh(boardGeo, boardMat);
      board.position.set(x, poleY, z);
      scene.add(board);
      frames.push(board);
      for (const lx of [-0.65, 0.65]) {
        const leg = new THREE.Mesh(legGeo, legMat);
        leg.position.set(x + lx, 0.525, z);
        scene.add(leg);
      }
      for (const side of [1, -1]) {
        const info = posterInfo(seed);
        const mesh = new THREE.Mesh(
          posterGeo,
          posterMaterial(texture(drawPoster(info, seed), renderer)),
        );
        mesh.position.set(x, poleY, z + side * 0.045);
        if (side < 0) mesh.rotation.y = Math.PI;
        scene.add(mesh);
        const normal = new THREE.Vector3(0, 0, side);
        posters.push({
          mesh,
          info,
          center: mesh.position.clone(),
          normal,
          width: POSTER_W,
          height: POSTER_H,
          view: new THREE.Vector3(x, 0, z + side * 1.9),
          facing: side > 0 ? Math.PI : 0,
          presenter: new THREE.Vector3(x + 1.25, 0, z + side * 0.85),
        });
        seed++;
      }
    }
  }

  // Podium with the outstanding papers
  const podium = new THREE.Group();
  const platformMat = new THREE.MeshStandardMaterial({
    color: 0x10283d,
    roughness: 0.5,
    metalness: 0.25,
  });
  const platform = new THREE.Mesh(new THREE.BoxGeometry(24, 0.9, 7), platformMat);
  platform.position.set(0, 0.45, LAYOUT.podiumZ);
  podium.add(platform);
  const edgeMat = new THREE.MeshBasicMaterial({ color: 0xf5c84c });
  const edge = new THREE.Mesh(new THREE.BoxGeometry(24, 0.05, 0.05), edgeMat);
  edge.position.set(0, 0.9, LAYOUT.podiumZ + 3.5);
  podium.add(edge);
  for (let i = 0; i < 3; i++) {
    const step = new THREE.Mesh(
      new THREE.BoxGeometry(10 - i * 0.6, 0.3 * (i + 1), 0.6),
      platformMat,
    );
    step.position.set(0, 0.15 * (i + 1), LAYOUT.podiumZ + 3.5 + 0.6 * (2 - i) + 0.3);
    podium.add(step);
  }
  scene.add(podium);

  const bigW = 3.4;
  const bigH = bigW * 1.414;
  const bigGeo = new THREE.PlaneGeometry(bigW, bigH);
  const bigBoardGeo = new THREE.BoxGeometry(bigW + 0.4, bigH + 0.4, 0.12);
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xf5c84c,
    emissive: 0x6b4f0d,
    roughness: 0.35,
    metalness: 0.7,
  });
  [-6.5, 0, 6.5].forEach((x, i) => {
    const y = 0.9 + 0.5 + bigH / 2;
    const z = LAYOUT.podiumZ - 1.4;
    const frame = new THREE.Mesh(bigBoardGeo, goldMat);
    frame.position.set(x, y, z);
    scene.add(frame);
    frames.push(frame);
    const info = posterInfo(900 + i, true);
    const mesh = new THREE.Mesh(
      bigGeo,
      posterMaterial(texture(drawPoster(info, 900 + i, 1024), renderer)),
    );
    mesh.position.set(x, y, z + 0.07);
    scene.add(mesh);
    posters.push({
      mesh,
      info,
      center: mesh.position.clone(),
      normal: new THREE.Vector3(0, 0, 1),
      width: bigW,
      height: bigH,
      view: new THREE.Vector3(x, 0, LAYOUT.podiumFront + 2.3),
      facing: Math.PI,
      presenter: new THREE.Vector3(x + 2.3, 0.9, z + 1.2),
    });

    const spot = new THREE.SpotLight(0xffe2a0, 60, 26, 0.32, 0.55, 1.4);
    spot.position.set(x, 11, z + 9);
    spot.target.position.set(x, y, z);
    scene.add(spot, spot.target);
  });

  // Backdrop with the seal
  const backdropW = 40;
  const backdrop = new THREE.Mesh(
    new THREE.PlaneGeometry(backdropW, backdropW / 3.2),
    new THREE.MeshBasicMaterial({ map: texture(drawBackdrop(), renderer), fog: true }),
  );
  backdrop.position.set(0, backdropW / 3.2 / 2, LAYOUT.podiumZ - 3.6);
  scene.add(backdrop);

  return { posters, frames };
}

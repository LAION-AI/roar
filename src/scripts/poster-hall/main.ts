import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { buildCrowd } from './crowd';
import { buildHall, LAYOUT, POSTER_GLOW, type PosterSpot } from './hall';
import { createWalk, isMoveKey } from './walk';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T | null;

const ease = (t: number) => 1 - Math.pow(1 - t, 3);

async function fontsReady() {
  if (!('fonts' in document)) return;
  const load = Promise.all([
    document.fonts.load('900 30px Dinish'),
    document.fonts.load('400 14px Dinish'),
  ]);
  await Promise.race([load, new Promise((resolve) => setTimeout(resolve, 2500))]);
}

function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGL2RenderingContext && c.getContext('webgl2'));
  } catch {
    return false;
  }
}

async function start() {
  const stage = $('hall-stage');
  const loading = $('hall-loading');
  if (!stage) return;
  if (!webglAvailable()) {
    loading?.setAttribute('hidden', '');
    $('hall-fallback')?.removeAttribute('hidden');
    return;
  }
  await fontsReady();

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  stage.appendChild(renderer.domElement);
  renderer.domElement.setAttribute('aria-hidden', 'true');

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 220);
  const { posters, frames, solids } = buildHall(scene, renderer);
  const crowd = buildCrowd(scene, posters);
  const walk = createWalk({ scene, camera, blockers: frames, solids, posters });
  const hall = stage.closest<HTMLElement>('.hall');

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 2.5;
  controls.maxDistance = 48;
  controls.maxPolarAngle = Math.PI * 0.47;
  controls.screenSpacePanning = false;

  const overview = { pos: new THREE.Vector3(12, 9, 21), target: new THREE.Vector3(0, 2, -4) };
  const intro = { pos: new THREE.Vector3(30, 26, 46), target: new THREE.Vector3(0, 2, -6) };
  camera.position.copy(reduced ? overview.pos : intro.pos);
  controls.target.copy(reduced ? overview.target : intro.target);

  // Camera flights (intro, focus a poster, back to the overview)
  let flight: {
    fromPos: THREE.Vector3;
    fromTarget: THREE.Vector3;
    toPos: THREE.Vector3;
    toTarget: THREE.Vector3;
    t: number;
    duration: number;
  } | null = null;
  function flyTo(pos: THREE.Vector3, target: THREE.Vector3, duration = 1.4) {
    flight = {
      fromPos: camera.position.clone(),
      fromTarget: controls.target.clone(),
      toPos: pos.clone(),
      toTarget: target.clone(),
      t: 0,
      duration: reduced ? 0.001 : duration,
    };
  }
  if (!reduced) flyTo(overview.pos, overview.target, 3.2);

  // Resize with the container
  const resize = () => {
    const { clientWidth: w, clientHeight: h } = stage;
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(1, h);
    // Wider view on portrait screens so the hall still fits side to side.
    camera.fov = camera.aspect < 1 ? 50 + (1 - camera.aspect) * 40 : 50;
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(stage);
  resize();

  // Poster info panel
  const panel = $('hall-panel');
  const field = (name: string) => panel?.querySelector<HTMLElement>(`[data-field="${name}"]`);
  let focused = -1;
  function showPanel(p: PosterSpot) {
    if (!panel) return;
    const avg = p.info.scores.reduce((a, b) => a + b, 0) / p.info.scores.length;
    field('id')!.textContent = `Poster ${p.info.id} · ${p.info.topic}`;
    field('title')!.textContent = p.info.title;
    field('status')!.textContent = p.info.outstanding
      ? 'Outstanding paper · spotlight'
      : 'Accepted · poster';
    field('status')!.classList.toggle('gold', p.info.outstanding);
    field('author')!.textContent = `Author agent ${p.info.id}`;
    const list = field('scores')!;
    list.replaceChildren(
      ...p.info.scores.map((score, i) => {
        const li = document.createElement('li');
        li.innerHTML = `<span>R${i + 1}</span><b style="--v:${score * 10}%"></b><em>${score}</em>`;
        return li;
      }),
    );
    field('avg')!.textContent = `Average ${avg.toFixed(1)} / 10 from six model families`;
    panel.hidden = false;
  }
  function focusPoster(index: number) {
    const p = posters[(index + posters.length) % posters.length];
    focused = posters.indexOf(p);
    // On foot the camera stays with the player; just show the details.
    if (walk.active) {
      showPanel(p);
      return;
    }
    // Slightly above eye level, so visitors in front of the poster don't block the view.
    const dist = p.height * 1.05 + 0.9;
    flyTo(
      p.center
        .clone()
        .addScaledVector(p.normal, dist)
        .add(new THREE.Vector3(0, p.height * 0.28, 0)),
      p.center,
      1.3,
    );
    showPanel(p);
  }
  function closePanel() {
    focused = -1;
    if (panel) panel.hidden = true;
  }
  function backToHall() {
    closePanel();
    if (walk.active) exitWalk();
    else flyTo(overview.pos, overview.target, 1.4);
  }

  // Walk mode: explore on foot, third or first person
  const walkBtn = $('hall-walk');
  const viewBtn = $('hall-view');
  const prompt = $<HTMLButtonElement>('hall-prompt');
  let near: PosterSpot | null = null;
  const syncView = () => {
    if (viewBtn)
      viewBtn.textContent = walk.view === 'third' ? 'First person (V)' : 'Third person (V)';
  };
  function enterWalk() {
    if (walk.active) return;
    // Start in front of the poster you were looking at, or at the entrance.
    const from = focused >= 0 ? posters[focused] : null;
    closePanel();
    flight = null;
    controls.enabled = false;
    walk.enter(
      from ? from.view.clone().addScaledVector(from.normal, 0.6) : undefined,
      from ? from.facing : Math.PI,
    );
    if (hall) hall.dataset.mode = 'walk';
    syncView();
  }
  function exitWalk() {
    walk.exit();
    near = null;
    if (prompt) prompt.hidden = true;
    if (hall) hall.dataset.mode = 'orbit';
    controls.enabled = true;
    controls.target.copy(walk.position).setY(1.4);
    flyTo(overview.pos, overview.target, 1.4);
  }
  walkBtn?.addEventListener('click', enterWalk);
  viewBtn?.addEventListener('click', () => {
    walk.toggleView();
    syncView();
  });
  prompt?.addEventListener('click', () => near && showPanel(near));

  $('hall-close')?.addEventListener('click', () => (walk.active ? closePanel() : backToHall()));
  $('hall-reset')?.addEventListener('click', backToHall);
  $('hall-next')?.addEventListener('click', () => focusPoster(focused + 1));
  $('hall-prev')?.addEventListener('click', () => focusPoster(focused < 0 ? -1 : focused - 1));
  window.addEventListener('keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === 'Escape') {
      if (panel && !panel.hidden && walk.active) closePanel();
      else if (walk.active || focused >= 0) backToHall();
      return;
    }
    // Any movement key starts walking.
    if (!walk.active && isMoveKey(e.code)) enterWalk();
    if (!walk.active) return;
    if (walk.key(e.code, true) || e.code === 'Space') e.preventDefault();
    if (e.code === 'KeyV' && !e.repeat) {
      walk.toggleView();
      syncView();
    }
    if (e.code === 'KeyE' && near) showPanel(near);
  });
  window.addEventListener('keyup', (e) => walk.key(e.code, false));
  window.addEventListener('blur', () => {
    for (const code of ['KeyW', 'KeyA', 'KeyS', 'KeyD']) walk.key(code, false);
  });

  // Touch stick for walking on phones and tablets
  const stick = $('hall-stick');
  const knob = stick?.querySelector<HTMLElement>('.knob');
  if (stick && knob) {
    const R = 44;
    const moveStick = (e: PointerEvent) => {
      const rect = stick.getBoundingClientRect();
      let x = e.clientX - (rect.left + rect.width / 2);
      let y = e.clientY - (rect.top + rect.height / 2);
      const len = Math.hypot(x, y);
      if (len > R) {
        x = (x / len) * R;
        y = (y / len) * R;
      }
      knob.style.transform = `translate(${x}px, ${y}px)`;
      walk.setStick(x / R, y / R);
    };
    const release = () => {
      knob.style.transform = '';
      walk.setStick(0, 0);
    };
    stick.addEventListener('pointerdown', (e) => {
      stick.setPointerCapture(e.pointerId);
      moveStick(e);
    });
    stick.addEventListener('pointermove', (e) => {
      if (stick.hasPointerCapture(e.pointerId)) moveStick(e);
    });
    stick.addEventListener('pointerup', release);
    stick.addEventListener('pointercancel', release);
  }

  // Hover + click on posters (a click is a short press without dragging)
  const ray = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const meshes = posters.map((p) => p.mesh);
  let hovered: THREE.Mesh | null = null;
  function pick(e: PointerEvent) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    ray.setFromCamera(pointer, camera);
    return ray.intersectObjects(meshes, false)[0]?.object as THREE.Mesh | undefined;
  }
  function setHover(mesh: THREE.Mesh | null) {
    if (hovered === mesh) return;
    if (hovered) (hovered.material as THREE.MeshStandardMaterial).emissiveIntensity = POSTER_GLOW;
    hovered = mesh;
    if (hovered)
      (hovered.material as THREE.MeshStandardMaterial).emissiveIntensity = POSTER_GLOW * 2;
    renderer.domElement.style.cursor = hovered ? 'pointer' : '';
  }
  let down: { x: number; y: number; t: number } | null = null;
  let lastX = 0;
  let lastY = 0;
  renderer.domElement.addEventListener('pointermove', (e) => {
    if (walk.active && down) {
      // Drag to look around while walking
      walk.look(e.clientX - lastX, e.clientY - lastY);
      lastX = e.clientX;
      lastY = e.clientY;
      return;
    }
    if (e.pointerType === 'mouse') setHover(pick(e) ?? null);
  });
  renderer.domElement.addEventListener('pointerdown', (e) => {
    down = { x: e.clientX, y: e.clientY, t: performance.now() };
    lastX = e.clientX;
    lastY = e.clientY;
    if (walk.active) renderer.domElement.setPointerCapture(e.pointerId);
  });
  renderer.domElement.addEventListener('pointercancel', () => (down = null));
  renderer.domElement.addEventListener('pointerup', (e) => {
    if (!down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    const quick = performance.now() - down.t < 450;
    down = null;
    if (moved > 6 || !quick) return;
    const hit = pick(e);
    if (hit) focusPoster(meshes.indexOf(hit));
  });

  // Pause / play the crowd
  let paused = reduced;
  const pauseBtn = $('hall-pause');
  const syncPause = () => {
    if (!pauseBtn) return;
    pauseBtn.textContent = paused ? 'Play' : 'Pause';
    pauseBtn.setAttribute('aria-pressed', String(paused));
  };
  pauseBtn?.addEventListener('click', () => {
    paused = !paused;
    syncPause();
  });
  syncPause();

  const counts = $('hall-counts');
  if (counts) {
    counts.textContent = `${crowd.counts.presenters} author agents · ${crowd.counts.agents} visiting agents · ${crowd.counts.humans} humans`;
  }

  let last = performance.now();
  const b = LAYOUT.bounds;
  renderer.setAnimationLoop((now: number) => {
    // Real elapsed time (capped), so walking and flights keep their speed on slow devices.
    const dt = Math.min((now - last) / 1000, 0.25);
    last = now;
    if (!paused) crowd.update(Math.min(dt, 0.1));
    if (walk.active) {
      walk.update(dt);
      crowd.avoid(walk.position);
      // "Press E" prompt for the poster in front of the player
      const next = panel?.hidden ? walk.nearest() : null;
      if (next !== near && prompt) {
        near = next;
        prompt.hidden = !near;
        if (near) prompt.textContent = `E · Read poster ${near.info.id}: ${near.info.title}`;
      }
      renderer.render(scene, camera);
      return;
    }
    if (flight) {
      flight.t += dt / flight.duration;
      const k = ease(Math.min(1, flight.t));
      camera.position.lerpVectors(flight.fromPos, flight.toPos, k);
      controls.target.lerpVectors(flight.fromTarget, flight.toTarget, k);
      if (flight.t >= 1) flight = null;
    }
    // Keep the view inside the hall
    controls.target.x = THREE.MathUtils.clamp(controls.target.x, b.minX, b.maxX);
    controls.target.z = THREE.MathUtils.clamp(controls.target.z, b.minZ, b.maxZ);
    controls.target.y = THREE.MathUtils.clamp(controls.target.y, 0.5, 7);
    controls.update();
    if (camera.position.y < 0.6) camera.position.y = 0.6;
    renderer.render(scene, camera);
  });

  loading?.setAttribute('hidden', '');
  stage.dataset.ready = 'true';
}

start().catch((error) => {
  console.error(error);
  $('hall-loading')?.setAttribute('hidden', '');
  $('hall-fallback')?.removeAttribute('hidden');
});

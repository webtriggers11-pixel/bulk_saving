/**
 * FEAT-028 (ADR-0039 §4): the society in Three.js. Flat paper towers with ink edges, windows
 * that light in the accent as units are pledged, a spark burst when a tier unlocks. Colours
 * are read from the CSS tokens, so the scene follows accent and scheme live. Loaded on demand
 * by hero.ts; the SVG fallback stands in without WebGL.
 */
import {
  BoxGeometry,
  BufferGeometry,
  Color,
  EdgesGeometry,
  Float32BufferAttribute,
  GridHelper,
  Group,
  InstancedMesh,
  AdditiveBlending,
  LineBasicMaterial,
  LineSegments,
  AmbientLight,
  CylinderGeometry,
  DirectionalLight,
  IcosahedronGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  PCFShadowMap,
  ShadowMaterial,
  Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  Points,
  PointsMaterial,
  Raycaster,
  RingGeometry,
  Scene,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import { FLOOR_HEIGHT, SOCIETY, allWindows, lightingOrder, litSet } from './model';
import type { View } from './story';
import { prefersReducedMotion, readRgb } from './theme';

export interface Building {
  setUnits(units: number): void;
  /** Camera and rise targets; the loop eases toward them. */
  setView(view: Partial<View>): void;
  /** Where the camera rests when nothing drives it. */
  readonly restView: View;
  burst(): void;
  /** FEAT-030: replace the lighting order (the hero promotes a tapped flat). */
  setOrder(order: readonly number[]): void;
  /** FEAT-030: a window's centre in container pixels, or null when it is off-screen. */
  project(index: number): { x: number; y: number } | null;
  dispose(): void;
}

export interface BuildingOptions {
  /** Start with the towers flat on the plot (an intro will raise them). */
  flat?: boolean;
  /** A slow, continuous zoom drift on the resting view (the Ken Burns idea). */
  drift?: boolean;
  /**
   * FEAT-030 (hero only): windows answer the pointer — hover tints one and reports it, a tap
   * picks it, a drag turns the society (clamped, inertia, springs back).
   */
  interactive?: {
    onPick(index: number, at: { x: number; y: number }): void;
    onHover(index: number | null, at: { x: number; y: number }): void;
    /** A drag began (the visitor is turning the society). */
    onDragStart?(): void;
  };
}

const GROUND_FLOOR = 0.3;
const SPARKS = 56;
const SPARK_LIFE = 950;
const LIGHT_FADE = 520;
const RING_LIFE = 1300;
/** How far a drag may turn the society: past this the unlit back faces would show. */
const DRAG_MAX = 0.75;
/** Pixels a pointer may travel and still count as a tap. */
const TAP_SLOP = 6;

const rgb = (token: string) => new Color(...readRgb(token));

export function mountBuilding(container: HTMLElement, initialUnits: number, options: BuildingOptions = {}): Building {
  const reduced = prefersReducedMotion();
  const restView: View = { yaw: 0, pitch: 0, zoom: 1, rise: 1 };
  const target: View = { ...restView, rise: options.flat && !reduced ? 0 : 1 };
  const current: View = { ...target };
  const CAMERA = { x: 7.6, y: 6.4, z: 9.4 };
  const renderer = new WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
  // Crisp edges on retina: render at the device's full ratio (capped at 2.5 for 4K laptops).
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2.5));
  renderer.setClearColor(0x000000, 0);
  // FEAT-030 (owner: "looks blurry … make it realistic"): a lit architectural model —
  // one sun with soft shadows on the plot, sky fill, recessed windows with sills.
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;
  container.appendChild(renderer.domElement);

  const scene = new Scene();
  const camera = new PerspectiveCamera(30, 1, 0.5, 60);
  camera.position.set(CAMERA.x, CAMERA.y, CAMERA.z);
  camera.lookAt(0, 2.1, 0);

  const world = new Group();
  world.position.y = -0.35;
  scene.add(world);
  /** Everything that rises from the plot (towers, windows, trees); the plot itself stays. */
  const towers = new Group();
  world.add(towers);

  // ---- light: a sun from the front-left (front faces bright, sides in half-shade) ---------
  const ambient = new AmbientLight(0xffffff, 0.72);
  scene.add(ambient);
  const sun = new DirectionalLight(0xffffff, 0.7);
  sun.position.set(-5, 10, 7.5);
  sun.target.position.set(0, 0, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -6;
  sun.shadow.camera.right = 6;
  sun.shadow.camera.top = 6;
  sun.shadow.camera.bottom = -6;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 30;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.02;
  sun.shadow.radius = 4;
  world.add(sun);
  world.add(sun.target);

  // ---- materials, all from tokens ---------------------------------------------------------
  const wall = new MeshLambertMaterial();
  const slab = new MeshLambertMaterial();
  const frameMat = new MeshLambertMaterial();
  const darkMat = new MeshLambertMaterial();
  const edge = new LineBasicMaterial({ transparent: true, opacity: 0.32 });
  const plot = new LineBasicMaterial({ transparent: true, opacity: 0.2 });
  const shadowMat = new ShadowMaterial({ opacity: 0.14 });
  const win = new MeshBasicMaterial({ toneMapped: false });
  // A soft halo on the wall behind each lit window (shows at night): additive, so an unlit
  // (black) halo adds nothing. It sits between the wall and the frame, never at the glass's
  // depth (that z-fight was the striped, "blurry" look).
  const glow = new MeshBasicMaterial({
    toneMapped: false,
    transparent: true,
    opacity: 0.5,
    blending: AdditiveBlending,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const sparkMat = new PointsMaterial({ size: 0.075, transparent: true, opacity: 0, depthWrite: false });
  const ringMat = new MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, toneMapped: false });

  const colours = { brand: new Color(), brand2: new Color(), unlit: new Color() };
  const paint = () => {
    const ink = rgb('--ink');
    const pap = rgb('--paper');
    const line = rgb('--line');
    const dark = document.documentElement.getAttribute('data-scheme') === 'dark';
    colours.brand = rgb('--brand');
    colours.brand2 = rgb('--brand-2');
    // Unlit glass: a cool reflection of the sky, a step darker than the wall.
    colours.unlit = pap.clone().lerp(ink, dark ? 0.12 : 0.22);
    // Night: the paper is near-black, so the walls lift a touch to keep their shape.
    wall.color.copy(dark ? pap.clone().lerp(ink, 0.1) : pap);
    slab.color.copy(pap.clone().lerp(line, dark ? 0.06 : 0.08));
    frameMat.color.copy(pap.clone().lerp(ink, dark ? 0.2 : 0.1));
    darkMat.color.copy(pap.clone().lerp(ink, 0.6));
    // Linear light: front faces (ambient + sun·0.55) reach 1 = the paper token exactly;
    // sides get the ambient alone, a soft half-shade.
    // three's Lambert divides incoming light by π, hence the factor.
    ambient.intensity = Math.PI * (dark ? 0.5 : 0.6);
    sun.intensity = Math.PI * (dark ? 0.75 : 0.8);
    shadowMat.opacity = dark ? 0.45 : 0.2;
    glow.opacity = dark ? 0.55 : 0;
    edge.color.copy(ink);
    plot.color.copy(ink);
    gridMat.color.copy(ink);
    sparkMat.color.copy(colours.brand2);
    ringMat.color.copy(colours.brand);
    repaintWindows(true);
  };

  // ---- the plot: soft shadows on a clear ground, the app's faint grid, its outline -------
  const ground = new Mesh(new PlaneGeometry(7.4, 7.4), shadowMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  world.add(ground);
  const grid = new GridHelper(7.4, 14);
  const gridMat = grid.material as LineBasicMaterial;
  gridMat.transparent = true;
  gridMat.opacity = 0.07;
  grid.position.y = 0.0015;
  world.add(grid);
  const plotLines = new LineSegments(new EdgesGeometry(new PlaneGeometry(7.4, 7.4)), plot);
  plotLines.rotation.x = -Math.PI / 2;
  plotLines.position.y = 0.002;
  world.add(plotLines);

  const solid = (mesh: Mesh) => {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  };

  // ---- towers: lit boxes, slab lines per floor, a parapet, a tank, an entrance ----------
  SOCIETY.forEach((t, i) => {
    const h = GROUND_FLOOR + t.floors * FLOOR_HEIGHT;
    const body = solid(new Mesh(new BoxGeometry(t.width, h, t.depth), wall));
    body.position.set(t.x, h / 2, t.z);
    towers.add(body);
    towers.add(outline(body));

    // A thin slab band at every floor line: what makes a box read as a building.
    const band = new BoxGeometry(t.width + 0.04, 0.035, t.depth + 0.04);
    for (let f = 0; f <= t.floors; f++) {
      const b = solid(new Mesh(band, slab));
      b.position.set(t.x, GROUND_FLOOR + f * FLOOR_HEIGHT, t.z);
      towers.add(b);
    }

    const parapet = solid(new Mesh(new BoxGeometry(t.width + 0.12, 0.12, t.depth + 0.12), wall));
    parapet.position.set(t.x, h + 0.06, t.z);
    towers.add(parapet);
    towers.add(outline(parapet));

    // Entrance on the front: a dark doorway under a canopy.
    const door = new Mesh(new BoxGeometry(0.34, 0.24, 0.02), darkMat);
    door.position.set(t.x, 0.12, t.z + t.depth / 2 + 0.011);
    towers.add(door);
    const canopy = solid(new Mesh(new BoxGeometry(0.6, 0.035, 0.22), slab));
    canopy.position.set(t.x, 0.27, t.z + t.depth / 2 + 0.11);
    towers.add(canopy);

    if (i === 0) {
      const tank = solid(new Mesh(new BoxGeometry(0.5, 0.42, 0.5), wall));
      tank.position.set(t.x + t.width / 2 - 0.5, h + 0.12 + 0.21, t.z - t.depth / 2 + 0.5);
      towers.add(tank);
      towers.add(outline(tank));
    }
  });

  // White model trees on the plot, the way an architect's model has them.
  const crownGeo = new IcosahedronGeometry(0.26, 1);
  const trunkGeo = new CylinderGeometry(0.025, 0.035, 0.28, 6);
  [
    [-3.0, 2.4, 1],
    [-2.3, 2.95, 0.8],
    [0.6, 2.6, 0.9],
    [3.0, 0.9, 1.1],
    [2.9, -2.6, 0.85],
  ].forEach(([x = 0, z = 0, k = 1]) => {
    const trunk = solid(new Mesh(trunkGeo, frameMat));
    trunk.position.set(x, 0.14 * k, z);
    trunk.scale.setScalar(k);
    const crown = solid(new Mesh(crownGeo, wall));
    crown.position.set(x, (0.28 + 0.2) * k, z);
    crown.scale.setScalar(k);
    towers.add(trunk, crown);
  });

  function outline(mesh: Mesh): LineSegments {
    const lines = new LineSegments(new EdgesGeometry(mesh.geometry), edge);
    lines.position.copy(mesh.position);
    return lines;
  }

  // ---- windows: a recessed frame, a sill, the glass; lit = accent, unlit = sky glass -------
  // Depths off the wall: halo 0.004 · frame 0..0.03 · glass 0.034 · sill sticks out 0.06.
  const windows = allWindows();
  let order = lightingOrder(windows.length);
  const winMesh = new InstancedMesh(new PlaneGeometry(0.28, 0.22), win, windows.length);
  const glowMesh = new InstancedMesh(new PlaneGeometry(0.62, 0.5), glow, windows.length);
  const frameMesh = new InstancedMesh(new BoxGeometry(0.36, 0.3, 0.03), frameMat, windows.length);
  const sillMesh = new InstancedMesh(new BoxGeometry(0.42, 0.03, 0.08), slab, windows.length);
  frameMesh.castShadow = sillMesh.castShadow = true;
  frameMesh.receiveShadow = sillMesh.receiveShadow = true;
  const proxy = new Object3D();
  const place = (mesh: InstancedMesh, i: number, z: number, y = 0) => {
    const save = proxy.position.clone();
    proxy.translateZ(z);
    proxy.translateY(y);
    proxy.updateMatrix();
    mesh.setMatrixAt(i, proxy.matrix);
    proxy.position.copy(save);
  };
  windows.forEach((w, i) => {
    const t = SOCIETY[w.tower]!;
    const y = GROUND_FLOOR + (w.floor + 0.55) * FLOOR_HEIGHT;
    if (w.face === 'front') {
      proxy.position.set(t.x - t.width / 2 + ((w.col + 0.5) * t.width) / t.perFace, y, t.z + t.depth / 2);
      proxy.rotation.set(0, 0, 0);
    } else {
      proxy.position.set(t.x + t.width / 2, y, t.z + t.depth / 2 - ((w.col + 0.5) * t.depth) / t.perFace);
      proxy.rotation.set(0, Math.PI / 2, 0);
    }
    place(glowMesh, i, 0.004);
    place(frameMesh, i, 0.015);
    place(sillMesh, i, 0.04, -0.165);
    place(winMesh, i, 0.034);
  });
  towers.add(glowMesh, frameMesh, sillMesh, winMesh);
  towers.scale.y = Math.max(0.001, current.rise);
  const black = new Color(0, 0, 0);
  let hovered: number | null = null;

  let units = initialUnits;
  let lit = litSet(order, units);
  /** When each window last changed, for the short colour fade. */
  const changedAt = new Map<number, number>();
  const tmp = new Color();
  const tmp2 = new Color();

  /** A window whose hover state just changed and needs one repaint. */
  let hoverDirty = -1;
  function repaintWindows(all: boolean) {
    const now = performance.now();
    let dirty = all;
    for (let i = 0; i < windows.length; i++) {
      const at = changedAt.get(i);
      const fading = at !== undefined && now - at < LIGHT_FADE;
      if (!all && !fading && i !== hoverDirty) continue;
      const isLit = lit.has(i);
      if (fading && !reduced) {
        const k = (now - (at as number)) / LIGHT_FADE;
        // A window turning on flashes the partner hue first, then settles on the accent.
        if (isLit) tmp.copy(colours.brand2).lerp(colours.brand, k);
        else tmp.copy(colours.brand).lerp(colours.unlit, k);
      } else {
        tmp.copy(isLit ? colours.brand : colours.unlit);
        changedAt.delete(i);
      }
      // FEAT-030: the window under the pointer leans toward the partner hue.
      if (i === hovered && !isLit) tmp.lerp(colours.brand2, 0.55);
      winMesh.setColorAt(i, tmp);
      // The halo is the window's colour at a fraction, black when unlit (additive = nothing).
      glowMesh.setColorAt(i, isLit ? tmp2.copy(tmp).multiplyScalar(0.35) : black);
      dirty = true;
    }
    hoverDirty = -1;
    if (dirty && winMesh.instanceColor) winMesh.instanceColor.needsUpdate = true;
    if (dirty && glowMesh.instanceColor) glowMesh.instanceColor.needsUpdate = true;
  }

  // ---- sparks ------------------------------------------------------------------------------
  const sparkGeo = new BufferGeometry();
  const sparkPos = new Float32Array(SPARKS * 3);
  const sparkVel = new Float32Array(SPARKS * 3);
  sparkGeo.setAttribute('position', new Float32BufferAttribute(sparkPos, 3));
  const sparks = new Points(sparkGeo, sparkMat);
  sparks.visible = false;
  world.add(sparks);
  let sparkStart = -1;

  // ---- FEAT-030: a shockwave ring on the plot when a tier unlocks --------------------------
  const ring = new Mesh(new RingGeometry(0.92, 1, 64), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(0, 0.004, 0);
  ring.visible = false;
  world.add(ring);
  let ringStart = -1;
  function stepRing(now: number) {
    if (ringStart < 0) return;
    const k = (now - ringStart) / RING_LIFE;
    if (k >= 1) {
      ring.visible = false;
      ringStart = -1;
      return;
    }
    const e = 1 - Math.pow(1 - k, 3);
    ring.scale.setScalar(0.4 + e * 3.4);
    ringMat.opacity = 0.7 * (1 - k);
  }

  const tall = SOCIETY[0]!;
  const top = GROUND_FLOOR + tall.floors * FLOOR_HEIGHT + 0.2;

  /** A burst from the roof (a tier unlocked) or a small rise from a window (a flat joined). */
  function burst(at?: { x: number; y: number; z: number; count: number }) {
    if (reduced) return;
    const n = at ? Math.min(SPARKS, at.count) : SPARKS;
    for (let i = 0; i < SPARKS; i++) {
      const live = i < n;
      const a = Math.random() * Math.PI * 2;
      const r = at ? 0.15 + Math.random() * 0.35 : 0.6 + Math.random() * 1.6;
      sparkPos[i * 3] = (at ? at.x : tall.x) + (Math.random() - 0.5) * (at ? 0.2 : 0.6);
      sparkPos[i * 3 + 1] = live ? (at ? at.y : top) : -50;
      sparkPos[i * 3 + 2] = (at ? at.z : tall.z) + (Math.random() - 0.5) * (at ? 0.2 : 0.6);
      sparkVel[i * 3] = Math.cos(a) * r;
      sparkVel[i * 3 + 1] = at ? 0.9 + Math.random() * 0.9 : 1.8 + Math.random() * 2.2;
      sparkVel[i * 3 + 2] = Math.sin(a) * r;
    }
    sparkGeo.attributes.position!.needsUpdate = true;
    sparks.visible = true;
    sparkStart = performance.now();
    if (!at) {
      ring.visible = true;
      ringStart = sparkStart;
    }
    wake();
  }

  function stepSparks(now: number, dt: number) {
    if (sparkStart < 0) return;
    const age = now - sparkStart;
    if (age > SPARK_LIFE) {
      sparks.visible = false;
      sparkStart = -1;
      sparkMat.opacity = 0;
      return;
    }
    for (let i = 0; i < SPARKS; i++) {
      sparkVel[i * 3 + 1]! -= 5.5 * dt;
      sparkPos[i * 3]! += sparkVel[i * 3]! * dt;
      sparkPos[i * 3 + 1]! += sparkVel[i * 3 + 1]! * dt;
      sparkPos[i * 3 + 2]! += sparkVel[i * 3 + 2]! * dt;
    }
    sparkGeo.attributes.position!.needsUpdate = true;
    sparkMat.opacity = 1 - age / SPARK_LIFE;
  }

  // ---- size, visibility, pointer ------------------------------------------------------------
  function resize() {
    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    wake();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(container);

  let visible = true;
  const io = new IntersectionObserver(
    (entries) => {
      visible = entries.some((e) => e.isIntersecting);
      if (visible) wake();
    },
    { threshold: 0.05 },
  );
  io.observe(container);

  let pointerX = 0;
  let pointerY = 0;
  // FEAT-030: drag-to-turn state. dragYaw is added to the view's yaw; it springs to 0.
  let dragYaw = 0;
  let dragVel = 0;
  let drag: { id: number; x0: number; y0: number; lastX: number; lastT: number; moved: boolean } | null = null;
  const raycaster = new Raycaster();
  const ndc = new Vector2();
  const local = (e: PointerEvent) => {
    const r = container.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top, w: r.width, h: r.height };
  };
  /** The window under a container point, or null. */
  const pickAt = (x: number, y: number, w: number, h: number): number | null => {
    ndc.set((x / w) * 2 - 1, -(y / h) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObject(winMesh, false)[0];
    return hit?.instanceId ?? null;
  };
  const setHover = (next: number | null) => {
    if (next === hovered) return;
    const prev = hovered;
    hovered = next;
    if (prev !== null) {
      hoverDirty = prev;
      repaintWindows(false);
    }
    if (next !== null) hoverDirty = next;
    container.style.cursor = drag?.moved ? 'grabbing' : next !== null ? 'pointer' : options.interactive ? 'grab' : '';
  };
  const onPointer = (e: PointerEvent) => {
    const p = local(e);
    pointerX = (p.x / p.w - 0.5) * 2;
    pointerY = (p.y / p.h - 0.5) * 2;
    const ia = options.interactive;
    if (ia && drag && drag.id === e.pointerId) {
      if (!drag.moved && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) > TAP_SLOP) {
        drag.moved = true;
        setHover(null);
        ia.onHover(null, p);
        ia.onDragStart?.();
      }
      if (drag.moved) {
        const now = performance.now();
        const dx = e.clientX - drag.lastX;
        const d = (dx / p.w) * 2.4;
        dragYaw = Math.max(-DRAG_MAX, Math.min(DRAG_MAX, dragYaw + d));
        dragVel = d / Math.max(0.008, (now - drag.lastT) / 1000);
        drag.lastX = e.clientX;
        drag.lastT = now;
      }
    } else if (ia && e.pointerType !== 'touch') {
      const idx = pickAt(p.x, p.y, p.w, p.h);
      setHover(idx);
      ia.onHover(idx, p);
    }
    wake();
  };
  const onLeave = (e: PointerEvent) => {
    pointerX = 0;
    pointerY = 0;
    // A finger "leaves" right after every tap (Pointer Events spec); the tap's tip must stay.
    if (options.interactive && e.pointerType !== 'touch') {
      setHover(null);
      options.interactive.onHover(null, { x: 0, y: 0 });
    }
    wake();
  };
  const onDown = (e: PointerEvent) => {
    if (!options.interactive || e.button !== 0) return;
    drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, lastX: e.clientX, lastT: performance.now(), moved: false };
    dragVel = 0;
    try {
      container.setPointerCapture(e.pointerId);
    } catch {
      /* capture is a nicety */
    }
  };
  const onUp = (e: PointerEvent) => {
    const ia = options.interactive;
    if (!ia || !drag || drag.id !== e.pointerId) return;
    const wasDrag = drag.moved;
    drag = null;
    container.style.cursor = hovered !== null ? 'pointer' : 'grab';
    if (wasDrag) {
      wake();
      return;
    }
    dragVel = 0;
    const p = local(e);
    const idx = pickAt(p.x, p.y, p.w, p.h);
    if (idx !== null) ia.onPick(idx, p);
  };
  const onCancel = () => {
    drag = null;
    wake();
  };
  container.addEventListener('pointermove', onPointer);
  container.addEventListener('pointerleave', onLeave);
  if (options.interactive) {
    container.style.cursor = 'grab';
    container.style.touchAction = 'pan-y';
    container.addEventListener('pointerdown', onDown);
    container.addEventListener('pointerup', onUp);
    container.addEventListener('pointercancel', onCancel);
  }

  // ---- the loop: runs while something moves; sleeps otherwise ---------------------------------
  let raf = 0;
  let last = performance.now();
  let yaw = 0;
  let pitch = 0;
  let disposed = false;
  let settleFrames = 0;

  function frame(now: number) {
    raf = 0;
    if (disposed) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    // Ease the driven view (story / intro) toward its targets.
    const ease = Math.min(1, dt * 5);
    let viewMoving = false;
    for (const key of ['yaw', 'pitch', 'zoom', 'rise'] as const) {
      const d = target[key] - current[key];
      if (Math.abs(d) > 0.0005) {
        current[key] += d * ease;
        viewMoving = true;
      } else current[key] = target[key];
    }
    // The Ken Burns drift: a slow push-in and back on the resting view.
    const drift = options.drift && !reduced ? 1 + 0.045 * (0.5 + 0.5 * Math.sin(now * 0.00012)) : 1;
    const idle = reduced ? 0 : Math.sin(now * 0.00035) * 0.11;
    // FEAT-030: after a drag the society coasts, then springs back to its resting angle.
    let dragMoving = false;
    if (!drag && (Math.abs(dragYaw) > 0.0005 || Math.abs(dragVel) > 0.001)) {
      dragYaw = Math.max(-DRAG_MAX, Math.min(DRAG_MAX, dragYaw + dragVel * dt));
      dragVel *= Math.pow(0.04, dt);
      dragYaw += (0 - dragYaw) * Math.min(1, dt * 1.6);
      dragMoving = true;
    } else if (!drag) {
      dragYaw = 0;
      dragVel = 0;
    }
    const targetYaw = current.yaw + idle + dragYaw + (reduced || drag?.moved ? 0 : pointerX * 0.14);
    const targetPitch = current.pitch + (reduced ? 0 : -pointerY * 0.05);
    yaw += (targetYaw - yaw) * Math.min(1, dt * 4);
    pitch += (targetPitch - pitch) * Math.min(1, dt * 4);
    world.rotation.y = yaw;
    world.rotation.x = pitch;
    towers.scale.y = Math.max(0.001, current.rise);
    const k = 1 / (current.zoom * drift);
    camera.position.set(CAMERA.x * k, CAMERA.y * k, CAMERA.z * k);
    camera.lookAt(0, 2.1 * Math.min(1, current.rise + 0.3), 0);

    repaintWindows(false);
    stepSparks(now, dt);
    stepRing(now);
    renderer.render(scene, camera);

    const moving =
      !reduced || viewMoving || dragMoving || drag !== null || sparkStart >= 0 || ringStart >= 0 || changedAt.size > 0 || Math.abs(targetYaw - yaw) > 0.0005;
    if (visible && (moving || settleFrames-- > 0)) raf = requestAnimationFrame(frame);
  }
  function wake() {
    settleFrames = 24;
    last = performance.now();
    if (!raf && !disposed) raf = requestAnimationFrame(frame);
  }

  const onTheme = () => {
    paint();
    wake();
  };
  document.addEventListener('bulk:theme', onTheme);

  paint();
  resize();

  return {
    setUnits(next) {
      const before = lit;
      units = next;
      lit = litSet(order, units);
      const now = performance.now();
      let first: number | null = null;
      for (let i = 0; i < windows.length; i++) {
        if (before.has(i) !== lit.has(i)) {
          changedAt.set(i, now);
          if (first === null && lit.has(i)) first = i;
        }
      }
      // A few sparks rise from the first window that just lit: a flat joined.
      if (first !== null && sparkStart < 0 && units > 0) {
        const m = new Object3D();
        winMesh.getMatrixAt(first, m.matrix);
        m.matrix.decompose(m.position, m.quaternion, m.scale);
        burst({ x: m.position.x, y: m.position.y, z: m.position.z, count: 14 });
      }
      wake();
    },
    setView(view) {
      Object.assign(target, view);
      if (reduced) Object.assign(current, view);
      wake();
    },
    restView,
    burst: () => burst(),
    setOrder(next) {
      order = [...next];
    },
    project(index) {
      if (index < 0 || index >= windows.length) return null;
      const m = new Object3D();
      winMesh.getMatrixAt(index, m.matrix);
      const v = new Vector3().setFromMatrixPosition(m.matrix);
      winMesh.updateWorldMatrix(true, false);
      v.applyMatrix4(winMesh.matrixWorld).project(camera);
      if (v.z > 1) return null;
      return { x: ((v.x + 1) / 2) * container.clientWidth, y: ((1 - v.y) / 2) * container.clientHeight };
    },
    dispose() {
      disposed = true;
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      container.removeEventListener('pointermove', onPointer);
      container.removeEventListener('pointerleave', onLeave);
      container.removeEventListener('pointerdown', onDown);
      container.removeEventListener('pointerup', onUp);
      container.removeEventListener('pointercancel', onCancel);
      document.removeEventListener('bulk:theme', onTheme);
      scene.traverse((o) => {
        const m = o as Mesh;
        m.geometry?.dispose?.();
        const mat = m.material as { dispose?: () => void } | { dispose?: () => void }[] | undefined;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose?.());
        else mat?.dispose?.();
      });
      sun.shadow.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}

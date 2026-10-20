/**
 * FEAT-027 (ADR-0038 §4): the society in Three.js. Flat paper towers with ink edges, windows
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
  Group,
  InstancedMesh,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  Points,
  PointsMaterial,
  Scene,
  WebGLRenderer,
} from 'three';
import { FLOOR_HEIGHT, SOCIETY, allWindows, lightingOrder, litSet } from './model';
import { prefersReducedMotion, readRgb } from './theme';

export interface Building {
  setUnits(units: number): void;
  burst(): void;
  dispose(): void;
}

const GROUND_FLOOR = 0.3;
const SPARKS = 56;
const SPARK_LIFE = 950;
const LIGHT_FADE = 520;

const rgb = (token: string) => new Color(...readRgb(token));

export function mountBuilding(container: HTMLElement, initialUnits: number): Building {
  const reduced = prefersReducedMotion();
  const renderer = new WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  container.appendChild(renderer.domElement);

  const scene = new Scene();
  const camera = new PerspectiveCamera(30, 1, 0.1, 80);
  camera.position.set(7.6, 6.4, 9.4);
  camera.lookAt(0, 2.1, 0);

  const world = new Group();
  world.position.y = -0.35;
  scene.add(world);

  // ---- materials, all from tokens ---------------------------------------------------------
  const paper = new MeshBasicMaterial();
  const paperSide = new MeshBasicMaterial();
  const paperTop = new MeshBasicMaterial();
  const edge = new LineBasicMaterial({ transparent: true, opacity: 0.55 });
  const plot = new LineBasicMaterial({ transparent: true, opacity: 0.22 });
  const win = new MeshBasicMaterial({ toneMapped: false });
  const sparkMat = new PointsMaterial({ size: 0.075, transparent: true, opacity: 0, depthWrite: false });

  const colours = { brand: new Color(), brand2: new Color(), unlit: new Color() };
  const paint = () => {
    const ink = rgb('--ink');
    const pap = rgb('--paper');
    const line = rgb('--line');
    colours.brand = rgb('--brand');
    colours.brand2 = rgb('--brand-2');
    colours.unlit = pap.clone().lerp(line, 0.1);
    paper.color.copy(pap);
    paperSide.color.copy(pap.clone().lerp(line, 0.05));
    paperTop.color.copy(pap.clone().lerp(line, 0.025));
    edge.color.copy(ink);
    plot.color.copy(ink);
    sparkMat.color.copy(colours.brand2);
    repaintWindows(true);
  };

  // ---- the plot ---------------------------------------------------------------------------
  const plotLines = new LineSegments(new EdgesGeometry(new PlaneGeometry(7.4, 7.4)), plot);
  plotLines.rotation.x = -Math.PI / 2;
  plotLines.position.y = 0.001;
  world.add(plotLines);

  // ---- towers: flat boxes, ink edges, a parapet, a water tank on the tall one -------------
  // BoxGeometry material order: +x (side), -x, +y (top), -y, +z (front), -z.
  const faceMats = [paperSide, paperSide, paperTop, paperTop, paper, paper];
  SOCIETY.forEach((t, i) => {
    const h = GROUND_FLOOR + t.floors * FLOOR_HEIGHT;
    const body = new Mesh(new BoxGeometry(t.width, h, t.depth), faceMats);
    body.position.set(t.x, h / 2, t.z);
    world.add(body);
    world.add(outline(body));

    const parapet = new Mesh(new BoxGeometry(t.width + 0.12, 0.09, t.depth + 0.12), faceMats);
    parapet.position.set(t.x, h + 0.045, t.z);
    world.add(parapet);
    world.add(outline(parapet));

    if (i === 0) {
      const tank = new Mesh(new BoxGeometry(0.5, 0.42, 0.5), faceMats);
      tank.position.set(t.x + t.width / 2 - 0.5, h + 0.09 + 0.21, t.z - t.depth / 2 + 0.5);
      world.add(tank);
      world.add(outline(tank));
    }
  });

  function outline(mesh: Mesh): LineSegments {
    const lines = new LineSegments(new EdgesGeometry(mesh.geometry), edge);
    lines.position.copy(mesh.position);
    return lines;
  }

  // ---- windows: one instanced plane each; lit = accent, unlit = faint ---------------------
  const windows = allWindows();
  const order = lightingOrder(windows.length);
  const winMesh = new InstancedMesh(new PlaneGeometry(0.3, 0.23), win, windows.length);
  const proxy = new Object3D();
  windows.forEach((w, i) => {
    const t = SOCIETY[w.tower]!;
    const y = GROUND_FLOOR + (w.floor + 0.55) * FLOOR_HEIGHT;
    if (w.face === 'front') {
      proxy.position.set(t.x - t.width / 2 + ((w.col + 0.5) * t.width) / t.perFace, y, t.z + t.depth / 2 + 0.012);
      proxy.rotation.set(0, 0, 0);
    } else {
      proxy.position.set(t.x + t.width / 2 + 0.012, y, t.z + t.depth / 2 - ((w.col + 0.5) * t.depth) / t.perFace);
      proxy.rotation.set(0, Math.PI / 2, 0);
    }
    proxy.updateMatrix();
    winMesh.setMatrixAt(i, proxy.matrix);
  });
  world.add(winMesh);

  let units = initialUnits;
  let lit = litSet(order, units);
  /** When each window last changed, for the short colour fade. */
  const changedAt = new Map<number, number>();
  const tmp = new Color();

  function repaintWindows(all: boolean) {
    const now = performance.now();
    let dirty = all;
    for (let i = 0; i < windows.length; i++) {
      const at = changedAt.get(i);
      const fading = at !== undefined && now - at < LIGHT_FADE;
      if (!all && !fading) continue;
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
      winMesh.setColorAt(i, tmp);
      dirty = true;
    }
    if (dirty && winMesh.instanceColor) winMesh.instanceColor.needsUpdate = true;
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

  const tall = SOCIETY[0]!;
  const top = GROUND_FLOOR + tall.floors * FLOOR_HEIGHT + 0.2;

  function burst() {
    if (reduced) return;
    for (let i = 0; i < SPARKS; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 0.6 + Math.random() * 1.6;
      sparkPos[i * 3] = tall.x + (Math.random() - 0.5) * 0.6;
      sparkPos[i * 3 + 1] = top;
      sparkPos[i * 3 + 2] = tall.z + (Math.random() - 0.5) * 0.6;
      sparkVel[i * 3] = Math.cos(a) * r;
      sparkVel[i * 3 + 1] = 1.8 + Math.random() * 2.2;
      sparkVel[i * 3 + 2] = Math.sin(a) * r;
    }
    sparkGeo.attributes.position!.needsUpdate = true;
    sparks.visible = true;
    sparkStart = performance.now();
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
  const onPointer = (e: PointerEvent) => {
    const r = container.getBoundingClientRect();
    pointerX = ((e.clientX - r.left) / r.width - 0.5) * 2;
    pointerY = ((e.clientY - r.top) / r.height - 0.5) * 2;
    wake();
  };
  const onLeave = () => {
    pointerX = 0;
    pointerY = 0;
    wake();
  };
  container.addEventListener('pointermove', onPointer);
  container.addEventListener('pointerleave', onLeave);

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

    const idle = reduced ? 0 : Math.sin(now * 0.00035) * 0.11;
    const targetYaw = idle + pointerX * 0.14;
    const targetPitch = -pointerY * 0.05;
    yaw += (targetYaw - yaw) * Math.min(1, dt * 4);
    pitch += (targetPitch - pitch) * Math.min(1, dt * 4);
    world.rotation.y = yaw;
    world.rotation.x = pitch;

    repaintWindows(false);
    stepSparks(now, dt);
    renderer.render(scene, camera);

    const moving = !reduced || sparkStart >= 0 || changedAt.size > 0 || Math.abs(targetYaw - yaw) > 0.0005;
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
      for (let i = 0; i < windows.length; i++) {
        if (before.has(i) !== lit.has(i)) changedAt.set(i, now);
      }
      wake();
    },
    burst,
    dispose() {
      disposed = true;
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      container.removeEventListener('pointermove', onPointer);
      container.removeEventListener('pointerleave', onLeave);
      document.removeEventListener('bulk:theme', onTheme);
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}

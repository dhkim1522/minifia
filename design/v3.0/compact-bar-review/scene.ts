import {
  ACESFilmicToneMapping, BufferGeometry, DirectionalLight, Line, LineDashedMaterial, Mesh,
  MeshBasicMaterial, OrthographicCamera, PCFShadowMap, Plane, PointLight, Raycaster, RingGeometry,
  Vector2, Vector3, WebGLRenderer,
} from "three";
import type { AnimalId } from "../../../shared/game/animals";
import { BAR_MAP, UNIT, routeFx, snapToWalkable } from "../../../shared/game/map";
import { PX_PER_UNIT } from "../../../src/world/camera";
import { createCharacter } from "../../../src/world/character";
import { buildBarScene } from "../../../src/world/maps/bar";
import { LADDER } from "../../../src/world/renderer";

type Mode = "walk" | "table" | "speaker";

export const people = [
  { name: "지호", animal: "rabbit", line: "나는 창가 쪽에 있었어." },
  { name: "민준", animal: "elephant", line: "그때 피아노 소리는 안 들렸어?" },
  { name: "서연", animal: "fox", line: "아까 민준이 한 말이랑 달라." },
  { name: "도윤", animal: "penguin", line: "서연이 말부터 더 들어보자." },
  { name: "하린", animal: "lion", line: "나도 그 얘기가 궁금했어." },
  { name: "유진", animal: "frog", line: "기록을 다시 보고 올게." },
  { name: "현우", animal: "hedgehog", line: "두 사람 말이 조금씩 다르네." },
  { name: "수아", animal: "parrot", line: "지호가 본 것도 들어보고 싶어." },
] as const satisfies readonly { name: string; animal: AnimalId; line: string }[];

const table = { x: -2.4, z: -4.6 };
const walkZone = { left: -4.45, right: 2.9, back: -5.7, front: 1.6 };
const lookByMode = {
  walk: { yaw: 0.55, tilt: 35, aim: [0.22, 0.99, 0.64], span: 4.55 },
  table: { yaw: 0.34, tilt: 26, aim: [0, 1.28, 0], span: 4.52 },
  speaker: { yaw: 0.34, tilt: 18, aim: [0, 1.28, -0.78], span: 2.43 },
} as const;

const walkingSpots = [
  [-0.57, 2.03], [1.53, 0.94], [-1.58, -0.40], [1.72, 2.8],
  [3.2, 0.12], [2.1, -1.3], [2.63, 4.1], [-2.25, 3.94],
] as const;
const tableSpots = [[-1.36, 0.82], [-0.70, -0.94], [0.77, -0.96], [1.35, 0.76]] as const;
const standingYaw = [0.70, 0.22, -0.18, -0.74, 0.47, -0.54, -0.2, 0.36] as const;
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

function insideWalkZone(x: number, z: number): boolean {
  return x >= walkZone.left && x <= walkZone.right && z >= walkZone.back && z <= walkZone.front;
}

function walkBoundary(): Line {
  const { left, right, back, front } = walkZone;
  const corners = [[left, back], [right, back], [right, front], [left, front], [left, back]] as const;
  const geometry = new BufferGeometry().setFromPoints(corners.map(([x, z]) => new Vector3(x, 0.026, z)));
  const material = new LineDashedMaterial({ color: "#caaa72", dashSize: 0.13, gapSize: 0.10, opacity: 0.58, transparent: true });
  const border = new Line(geometry, material);
  border.computeLineDistances();
  return border;
}

export function mountScene(host: HTMLElement, mode: Mode, onPick: (index: number) => void): {
  setFocus(index: number): void;
  setMark(index: number | null): void;
} {
  const rig = lookByMode[mode];
  const toWorld = (x: number, y: number, z: number): Vector3 => new Vector3(
    table.x + x * Math.cos(rig.yaw) + z * Math.sin(rig.yaw), y,
    table.z - x * Math.sin(rig.yaw) + z * Math.cos(rig.yaw),
  );
  const renderer = new WebGLRenderer({ antialias: true });
  renderer.domElement.className = "scene-canvas";
  renderer.domElement.setAttribute("aria-hidden", "true");
  Object.assign(renderer.domElement.style, { display: "block", width: "100%", height: "100%" });
  host.append(renderer.domElement);

  const bar = buildBarScene(LADDER[2]!, { omitTableChairsAt: [table.x, table.z] });
  bar.setLighting("night");
  bar.lights.hemi.intensity *= 0.85;
  bar.lights.stage.intensity *= 0.5;
  const key = new PointLight("#ffc893", 11, 5);
  key.position.copy(toWorld(0, 2.3, 1.25));
  const fill = new DirectionalLight("#c0d2f7", 1.3);
  fill.position.copy(toWorld(-1, 3, 6));
  fill.target.position.copy(toWorld(0, 1, 0));
  bar.root.add(key, fill, fill.target);
  const destination = new Mesh(new RingGeometry(0.17, 0.21, 28), new MeshBasicMaterial({ color: "#edc784" }));
  destination.rotation.x = -Math.PI / 2;
  destination.visible = false;
  if (mode === "walk") bar.root.add(walkBoundary(), destination);
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));

  const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 60);
  const [aimX, aimY, aimZ] = rig.aim;
  const initialAim = toWorld(aimX, aimY, aimZ);
  const aim = initialAim.clone();
  const tilt = rig.tilt * Math.PI / 180;
  const cameraOffset = toWorld(0, Math.tan(tilt) * 13, 13).sub(toWorld(0, 0, 0));
  const ray = new Raycaster();
  const pointer = new Vector2();
  const floor = new Plane(new Vector3(0, 1, 0), 0);
  let path: Vector3[] = [];
  let raf = 0;
  let previous = 0;
  let active = mode === "walk" ? 0 : 2;
  let width = 0;
  let height = 0;
  let mark: number | null = null;

  const actors = people.slice(0, mode === "table" ? tableSpots.length : people.length).map((person, index) => {
    const character = createCharacter(index, "coat", undefined, person.animal);
    const label = document.createElement("button");
    label.type = "button";
    label.className = "scene-name";
    const name = document.createElement("span");
    name.textContent = person.name + (index === 0 ? " · 나" : "");
    label.append(name);
    label.dataset.player = String(index);
    Object.assign(label.style, { position: "absolute", transform: "translate(-50%, -100%)" });
    label.addEventListener("click", () => onPick(index));
    if (mode !== "speaker") host.append(label);
    bar.root.add(character.root);
    return { character, label };
  });

  function poseFocus(): void {
    actors.forEach(({ character, label }, index) => {
      label.setAttribute("aria-pressed", String(index === active));
      if (mode !== "speaker") {
        character.setRing(index === active || (mode === "walk" && index === 0) ? "#dbaa65" : null);
        return;
      }
      const beside = index === (active + 1) % people.length ? -1 : index === (active + 2) % people.length ? 1 : 0;
      character.root.visible = index === active || beside !== 0;
      character.root.position.copy(beside ? toWorld(beside * 1.32, 0, 0.78) : toWorld(0, 0, -1.05));
      character.setYaw(rig.yaw - beside * 1.62);
      character.setDim(beside !== 0);
    });
  }

  if (mode !== "speaker") {
    const spots = mode === "walk" ? walkingSpots : tableSpots;
    actors.forEach(({ character }, index) => {
      const [x, z] = spots[index]!;
      const position = toWorld(x, 0, z);
      if (mode === "walk") {
        const snapped = snapToWalkable(BAR_MAP, { x: Math.round(position.x * UNIT), z: Math.round(position.z * UNIT) });
        position.set(snapped.x / UNIT, 0, snapped.z / UNIT);
      }
      character.root.position.copy(position);
      character.setYaw(rig.yaw + standingYaw[index]!);
    });
  }
  poseFocus();

  function render(dt = 0): void {
    if (width <= 0 || height <= 0) return;
    let moving = false;
    if (mode === "walk") {
      const character = actors[0]!.character;
      const next = path[0];
      if (next) {
        const current = character.root.position;
        const delta = next.clone().sub(current);
        const distance = delta.length();
        const step = reduced() ? distance : dt * 2.95;
        character.setYaw(Math.atan2(delta.x, delta.z));
        if (distance <= step) {
          current.copy(next);
          path.shift();
          destination.visible = path.length > 0;
        } else {
          current.addScaledVector(delta, step / distance);
          moving = true;
        }
        renderer.shadowMap.needsUpdate = true;
      }
      const target = character.root.position.clone().lerp(initialAim, 0.54);
      target.y = initialAim.y;
      aim.lerp(target, reduced() ? 1 : 1 - Math.exp(-Math.max(dt, 0.016) * 5));
    }
    camera.position.copy(aim).add(cameraOffset);
    camera.lookAt(aim);
    camera.updateMatrixWorld();
    actors.forEach(({ character, label }, index) => {
      const { headY } = character.update(dt, 1, index === 0 && moving);
      if (mode === "speaker") return;
      const p = character.root.position.clone();
      p.y = headY;
      p.project(camera);
      label.hidden = Math.abs(p.x) > 0.96 || Math.abs(p.y) > 0.90;
      label.style.left = `${(p.x + 1) * 50}%`;
      label.style.top = `${(1 - p.y) * height / 2 - 5}px`;
    });
    renderer.render(bar.root, camera);
    host.dataset.ready = "true";
  }

  function animate(now: number): void {
    raf = 0;
    const dt = previous ? Math.min((now - previous) / 1_000, 0.05) : 0.016;
    previous = now;
    render(dt);
    if (path.length > 0) raf = requestAnimationFrame(animate);
    else previous = 0;
  }

  const resize = new ResizeObserver(() => {
    width = host.clientWidth;
    height = host.clientHeight;
    if (width <= 0 || height <= 0) return;
    renderer.setSize(width, height, false);
    const scale = mode === "walk" ? Math.min(PX_PER_UNIT * 1.27, width / rig.span) : width / rig.span;
    camera.left = -width / 2 / scale;
    camera.right = -camera.left;
    camera.top = height / 2 / scale;
    camera.bottom = -camera.top;
    camera.updateProjectionMatrix();
    render();
  });
  resize.observe(host);

  renderer.domElement.addEventListener("click", (event) => {
    const bounds = renderer.domElement.getBoundingClientRect();
    pointer.set(2 * (event.clientX - bounds.left) / bounds.width - 1, 1 - 2 * (event.clientY - bounds.top) / bounds.height);
    ray.setFromCamera(pointer, camera);
    if (mode === "speaker") {
      onPick(active);
      return;
    }
    const byMesh = new Map(actors.flatMap(({ character }, index) => character.bodyMeshes().map((mesh) => [mesh, index] as const)));
    const hit = ray.intersectObjects([...byMesh.keys()], false)[0];
    const person = hit?.object instanceof Mesh ? byMesh.get(hit.object) : undefined;
    if (person !== undefined) {
      onPick(person);
      return;
    }
    if (mode !== "walk") return;
    const p = ray.ray.intersectPlane(floor, new Vector3());
    if (!p || !insideWalkZone(p.x, p.z)) return;
    const current = actors[0]!.character.root.position;
    const fx = routeFx(BAR_MAP, { x: Math.round(current.x * UNIT), z: Math.round(current.z * UNIT) }, {
      x: Math.round(p.x * UNIT), z: Math.round(p.z * UNIT),
    });
    const nextPath: Vector3[] = [];
    for (let i = 2; i < fx.length; i += 2) {
      const next = new Vector3(fx[i]! / UNIT, 0, fx[i + 1]! / UNIT);
      if (!insideWalkZone(next.x, next.z)) return;
      nextPath.push(next);
    }
    path = nextPath;
    const end = path.at(-1);
    if (end) {
      destination.position.set(end.x, 0.03, end.z);
      destination.visible = true;
      if (!raf) raf = requestAnimationFrame(animate);
    }
  });

  return {
    setFocus(index: number) {
      if (!actors[index] || index === active) return;
      active = index;
      poseFocus();
      renderer.shadowMap.needsUpdate = true;
      render();
    },
    setMark(index: number | null) {
      if (mark === index) return;
      if (mark !== null) actors[mark]?.character.setNotes([], { animate: false });
      mark = index;
      if (mark !== null) actors[mark]?.character.setNotes([0], { animate: false });
      actors.forEach(({ label }, seat) => {
        label.dataset.marked = String(seat === mark);
        label.setAttribute("aria-label", `${label.textContent}${seat === mark ? " · 의심딱지" : ""}`);
      });
      render();
    },
  };
}

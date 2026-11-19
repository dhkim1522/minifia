import {
  ACESFilmicToneMapping, Mesh, MeshBasicMaterial, OrthographicCamera, PCFShadowMap,
  Plane, Raycaster, RingGeometry, Vector2, Vector3, WebGLRenderer,
} from "three";
import type { AnimalId } from "../../../shared/game/animals";
import { CELL, CHAR_RADIUS, UNIT, parseMask, routeFx, snapToWalkable } from "../../../shared/game/map";
import type { MapDef } from "../../../shared/game/map";
import { PX_PER_UNIT } from "../../../src/world/camera";
import { createCharacter } from "../../../src/world/character";
import { bar, buildReviewRoom, centerStandRadius, piano, roomHalf, seatTop } from "./room";

export type Mode = "walk" | "four" | "eight";
export { roomHalf };

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

const discussionCamera = { yaw: 0.34, tilt: 26, aimY: 1.14, span: 4.52 };
const walkCamera = { yaw: discussionCamera.yaw, tilt: 35, aimY: 1.0, span: 4.55 };

// 앞·뒤의 네 자리를 엇갈리게 배치해 좁은 화면에서도 뒷줄의 얼굴을 읽을 수 있다.
const seatLayout = [
  [-1.72, 0.77], [-0.79, -2.22], [0.67, -2.27], [1.72, 0.94],
  [-1.67, -1.16], [1.65, -1.12], [-0.73, 2.08], [0.70, 2.08],
] as const;
function rotateFromCamera([x, z]: readonly [number, number]): readonly [number, number] {
  const { yaw } = discussionCamera;
  return [x * Math.cos(yaw) + z * Math.sin(yaw), -x * Math.sin(yaw) + z * Math.cos(yaw)];
}
export const seatSpots = seatLayout.map(rotateFromCamera);
const standingYaw = [0.68, 0.14, -0.15, -0.70, 0.56, -0.56, 0.38, -0.42] as const;
const walkStart = rotateFromCamera([-0.06, 2.92]);
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

const walkHalf = roomHalf - CHAR_RADIUS;
function insideWalkZone(x: number, z: number): boolean {
  return Math.abs(x) <= walkHalf && Math.abs(z) <= walkHalf;
}

function makeWalkMap(): MapDef {
  const size = 2 * Math.ceil(walkHalf / CELL);
  const origin = -size * CELL / 2;
  const rows = Array.from({ length: size }, (_, row) => Array.from({ length: size }, (_, col) => {
    const x = origin + (col + 0.5) * CELL;
    const z = origin + (row + 0.5) * CELL;
    const clearance = CHAR_RADIUS + CELL / 4;
    const hitsStand = Math.hypot(x, z) < centerStandRadius + clearance;
    const hitsSeat = seatSpots.some(([sx, sz]) => Math.hypot(x - sx, z - sz) < 0.35 + clearance);
    const hitsFixture = [piano, bar].some(fixture =>
      Math.abs(x - fixture.x) < fixture.width / 2 + clearance &&
      Math.abs(z - fixture.z) < fixture.depth / 2 + clearance);
    return hitsStand || hitsSeat || hitsFixture ? "#" : ".";
  }).join(""));
  return { id: "bar", size, origin, walkHalf, mask: parseMask(rows), spawns: [] };
}
const walkMap = makeWalkMap();

export function mountScene(host: HTMLElement, mode: Mode, onPick: (index: number) => void): {
  setFocus(index: number): void;
  setMark(index: number | null): void;
} {
  const walking = mode === "walk";
  const rig = walking ? walkCamera : discussionCamera;
  const room = buildReviewRoom(seatSpots);
  const renderer = new WebGLRenderer({ antialias: true });
  renderer.domElement.className = "scene-canvas";
  renderer.domElement.setAttribute("aria-hidden", "true");
  Object.assign(renderer.domElement.style, { display: "block", width: "100%", height: "100%" });
  host.append(renderer.domElement);

  const destination = new Mesh(new RingGeometry(0.17, 0.21, 28), new MeshBasicMaterial({ color: "#edc784" }));
  destination.rotation.x = -Math.PI / 2;
  destination.visible = false;
  if (walking) room.add(destination);
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));

  const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 60);
  const aim = new Vector3(0, rig.aimY, 0);
  const walkAim = aim.clone();
  const tilt = rig.tilt * Math.PI / 180;
  const cameraOffset = new Vector3(Math.sin(rig.yaw) * 13, Math.tan(tilt) * 13, Math.cos(rig.yaw) * 13);
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

  const actors = people.slice(0, mode === "four" ? 4 : people.length).map((person, index) => {
    const character = createCharacter(index, "coat", undefined, person.animal);
    const label = document.createElement("button");
    label.type = "button";
    label.className = "scene-name";
    const name = document.createElement("span");
    name.textContent = person.name + (index === 0 ? " · 나" : "");
    label.append(name);
    label.dataset.player = String(index);
    const footLabel = seatLayout[index]![1] > 0 && !(walking && index === 0);
    Object.assign(label.style, { position: "absolute", transform: footLabel ? "translate(-50%, -20%)" : "translate(-50%, -100%)" });
    label.addEventListener("click", () => onPick(index));
    host.append(label);
    room.add(character.root);
    const [sx, sz] = seatSpots[index]!;
    if (walking && index === 0) {
      const start = snapToWalkable(walkMap, { x: Math.round(walkStart[0] * UNIT), z: Math.round(walkStart[1] * UNIT) });
      character.root.position.set(start.x / UNIT, 0, start.z / UNIT);
    } else {
      character.root.position.set(sx, seatTop, sz);
    }
    character.setYaw(rig.yaw + standingYaw[index]!);
    return { character, label, footLabel };
  });

  function poseFocus(): void {
    actors.forEach(({ character, label }, index) => {
      label.setAttribute("aria-pressed", String(index === active));
      character.setRing(index === active || (walking && index === 0) ? "#dbaa65" : null);
    });
  }

  poseFocus();

  function render(dt = 0): void {
    if (width <= 0 || height <= 0) return;
    let moving = false;
    if (walking) {
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
        walkAim.set(current.x * 0.73, rig.aimY, current.z * 0.73);
      }
      aim.lerp(walkAim, reduced() ? 1 : 1 - Math.exp(-Math.max(dt, 0.016) * 8));
    }
    camera.position.copy(aim).add(cameraOffset);
    camera.lookAt(aim);
    camera.updateMatrixWorld();
    actors.forEach(({ character, label, footLabel }, index) => {
      const { headY } = character.update(dt, 1, index === 0 && moving);
      const p = character.root.position.clone();
      if (footLabel) {
        // 앞자리의 이름이 뒤편 참가자의 눈과 입을 가리지 않도록 자기 좌석 아래에 둔다.
        p.y = 0;
        p.x += Math.sin(rig.yaw) * 0.28;
        p.z += Math.cos(rig.yaw) * 0.28;
      } else {
        p.y += headY;
      }
      p.project(camera);
      label.hidden = Math.abs(p.x) > 0.96 || Math.abs(p.y) > 0.90;
      label.style.left = `${(p.x + 1) * 50}%`;
      label.style.top = `${(1 - p.y) * height / 2 - (footLabel ? 0 : 5)}px`;
    });
    renderer.render(room, camera);
    host.dataset.ready = "true";
  }

  function animate(now: number): void {
    raf = 0;
    const dt = previous ? Math.min((now - previous) / 1_000, 0.05) : 0.016;
    previous = now;
    render(dt);
    if (path.length > 0 || aim.distanceToSquared(walkAim) > 0.0001) raf = requestAnimationFrame(animate);
    else previous = 0;
  }

  const resize = new ResizeObserver(() => {
    width = host.clientWidth;
    height = host.clientHeight;
    if (width <= 0 || height <= 0) return;
    renderer.setSize(width, height, false);
    const scale = walking ? Math.min(PX_PER_UNIT * 1.27, width / rig.span) : width / rig.span;
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
    const byMesh = new Map(actors.flatMap(({ character }, index) => character.bodyMeshes().map((mesh) => [mesh, index] as const)));
    const hit = ray.intersectObjects([...byMesh.keys()], false)[0];
    const person = hit?.object instanceof Mesh ? byMesh.get(hit.object) : undefined;
    if (person !== undefined) {
      onPick(person);
      return;
    }
    if (!walking) return;
    const p = ray.ray.intersectPlane(floor, new Vector3());
    if (!p || !insideWalkZone(p.x, p.z)) return;
    const current = actors[0]!.character.root.position;
    const fx = routeFx(walkMap, { x: Math.round(current.x * UNIT), z: Math.round(current.z * UNIT) }, {
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

import {
  ACESFilmicToneMapping, Box3, Color, DirectionalLight, MathUtils, Mesh, MeshBasicMaterial,
  MeshStandardMaterial, PCFShadowMap, PerspectiveCamera, PlaneGeometry, Raycaster,
  SphereGeometry, TorusGeometry, Vector2, Vector3, WebGLRenderer,
} from "three";
import type { Object3D, Scene } from "three";
import type { AnimalId } from "../../../shared/game/animals";
import { createCharacter } from "../../../src/world/character";
import { buildBarScene, Bundle, tf, under } from "../../../src/world/maps/bar";
import { LADDER } from "../../../src/world/renderer";
import { addFinishedRoom } from "./finish";
import { addDetailedTable } from "../../../src/world/barAssets/table-detail";
import { addChairParts, addSeatedRoomShell } from "../../../src/world/barAssets/seated-bar";
import { occupiedSlots } from "./table-layout";
import type { TableCount } from "./table-layout";

export type ViewMode = "eye" | "shoulder" | "wide";
type RoomArt = "original" | "polished" | "detailed";

type ReviewPerson = { slot: number; name: string; animal: AnimalId; line: string };

const startingPeople = [
  { name: "지호", animal: "rabbit", line: "창가 쪽에 앉아 있었어." },
  { name: "민준", animal: "elephant", line: "그때 피아노 소리가 들렸어?" },
  { name: "서연", animal: "fox", line: "내가 기억하는 거랑 조금 달라." },
  { name: "도윤", animal: "penguin", line: "방금 한 얘기부터 다시 들어보자." },
  { name: "하린", animal: "lion", line: "창가 쪽은 불이 꺼져 있었어." },
  { name: "유진", animal: "frog", line: "난 노란 불빛만 기억나." },
  { name: "현우", animal: "hedgehog", line: "서로 기억하는 게 다른가 봐." },
  { name: "수아", animal: "parrot", line: "다른 사람 얘기도 들어보고 싶어." },
] as const satisfies readonly Omit<ReviewPerson, "slot">[];

export function previewSeatOf(people: readonly ReviewPerson[]): number {
  const nearestLeft = people.findIndex(person => ringAngles[person.slot]! < 0);
  return nearestLeft < 0 ? 1 : nearestLeft;
}

export function oppositeSeatOf(people: readonly ReviewPerson[]): number {
  return people.findIndex(person => person.slot === oppositeSlot);
}

export function seatedPeople(count: TableCount, animal?: AnimalId): readonly ReviewPerson[] {
  const people = occupiedSlots(count).map(slot => ({ ...startingPeople[slot]!, slot }));
  if (!animal) return people;
  const previewSeat = previewSeatOf(people);
  const previousSeat = people.findIndex(person => person.animal === animal);
  return people.map((person, index) => {
    if (index === previewSeat) return { ...person, animal };
    if (index === previousSeat) return { ...person, animal: people[previewSeat]!.animal };
    return person;
  });
}

const HEAD_CENTER_Y = 0.431; // 현재 동물 목 리그의 머리 중심

const oppositeSlot = 2;
const ringAngles = [0, -0.83, 3.09, 0.87, -1.64, 1.66, -2.39, 2.41];
const places = ringAngles.map(a => new Vector3(Math.sin(a) * 2.04, 0, Math.cos(a) * 2.04));
const coatColors = [
  "#3d4e68", "#405068", "#304d56", "#35384b", "#574355", "#414759", "#524641", "#3d4e68",
];
const tableY = 0.79;
const chairY = 0.43;
const focusDuration = 0.32;
const glanceDuration = 1200;
const maxYaw = 66 * Math.PI / 180;
const paper = "#a7916c";

function makeFurniture(root: Scene, finish: boolean, crafted: boolean): void {
  const wood = new Bundle();
  const brass = new Bundle();
  const felt = new Bundle();
  const porcelain = new Bundle();
  const lamp = new Bundle();
  wood.cyl(0.39, 0.54, 0.12, 36, "#472c25", tf(0, 0.08, 0));
  wood.cyl(0.21, 0.29, 0.61, 32, "#54352a", tf(0, 0.36, 0));
  if (!finish) {
    wood.cyl(1.63, 1.60, 0.09, 72, "#613c2e", tf(0, tableY - 0.045, 0));
    wood.cyl(1.62, 1.54, 0.035, 72, "#825944", tf(0, tableY - 0.027, 0));
    felt.cyl(1.52, 1.52, 0.012, 72, "#19302e", tf(0, tableY - 0.002, 0));
    brass.add(new TorusGeometry(1.55, 0.009, 6, 72), "#b9874e", tf(0, tableY - 0.013, 0, -Math.PI / 2));
  }
  if (!crafted) {
    brass.cyl(0.12, 0.145, 0.028, 24, "#b78250", tf(0, tableY + 0.023, 0));
    brass.cyl(0.018, 0.022, 0.14, 16, "#c2985b", tf(0, tableY + 0.10, 0));
    brass.add(new SphereGeometry(0.135, 24, 12, 0, 2 * Math.PI, 0, Math.PI / 2).scale(1, 0.69, 1),
      "#cc9a5b", tf(0, tableY + 0.17, 0));
    lamp.cyl(0.121, 0.126, 0.014, 24, "#ffdcaa", tf(0, tableY + 0.166, 0), finish ? 0.91 : 1.08);
    if (finish) {
      brass.add(new TorusGeometry(0.133, 0.006, 8, 32), "#d4a665", tf(0, tableY + 0.17, 0, -Math.PI / 2));
      brass.cyl(0.020, 0.025, 0.036, 12, "#b98d55", tf(0, tableY + 0.267, 0));
    }
  }

  for (const [i, pos] of places.entries()) {
    const facing = Math.atan2(-pos.x, -pos.z);
    addChairParts(wood, felt, brass, pos, i === 0, chairY);
    if (crafted) continue;
    const settingRadius = i === 0 ? 0.51 : 0.655;
    const placeSetting = tf(pos.x * settingRadius, tableY + 0.009, pos.z * settingRadius, 0, facing, 0);
    porcelain.add(new PlaneGeometry(0.18, 0.117), i === oppositeSlot ? "#eac88b" : paper,
      under(placeSetting, tf(-0.08, 0, 0, -Math.PI / 2, 0, 0.11)));
    if (finish) {
      porcelain.cyl(0.070, 0.061, 0.010, 20, "#524139", under(placeSetting, tf(0.20, 0.006, 0.025)));
      brass.cyl(0.043, 0.033, 0.067, 20, "#9b714c", under(placeSetting, tf(0.20, 0.047, 0.025)));
      porcelain.cyl(0.037, 0.034, 0.005, 20, "#3c2926", under(placeSetting, tf(0.20, 0.081, 0.025)));
      brass.add(new TorusGeometry(0.042, 0.004, 6, 20), "#d0ae7a", under(placeSetting, tf(0.20, 0.083, 0.025, -Math.PI / 2)));
      brass.box(0.117, 0.012, 0.015, "#6d593e", under(placeSetting, tf(-0.20, 0.013, 0.107, 0, -0.31, 0)));
      for (const dz of [-0.024, 0.0, 0.024]) {
        porcelain.box(0.106, 0.001, 0.004, "#9a7c54", under(placeSetting, tf(-0.084, 0.002, dz)));
      }
    } else {
      brass.cyl(0.042, 0.032, 0.069, 16, "#a17751", under(placeSetting, tf(0.20, 0.045, 0.025)));
      porcelain.cyl(0.031, 0.031, 0.004, 16, "#533930", under(placeSetting, tf(0.20, 0.081, 0.025)));
    }
  }

  const meshes = [
    wood.build(new MeshStandardMaterial({ vertexColors: true, roughness: 0.73 }), "seated-table-wood"),
    felt.build(new MeshStandardMaterial({ vertexColors: true, roughness: 0.96 }), "seated-table-upholstery"),
    brass.build(new MeshStandardMaterial({ vertexColors: true, roughness: 0.37, metalness: 0.31 }), "seated-table-brass"),
  ];
  if (!crafted) meshes.push(
    porcelain.build(new MeshStandardMaterial({ vertexColors: true, roughness: 0.74 }), "seated-table-props"),
    lamp.build(new MeshBasicMaterial({ vertexColors: true }), "seated-table-lamp"),
  );
  for (const mesh of meshes) mesh.receiveShadow = true;
  meshes[0]!.castShadow = meshes[1]!.castShadow = true;
  root.add(...meshes);

  addSeatedRoomShell(root, false);
}

function cameraSpot(mode: ViewMode): Vector3 {
  if (mode === "eye") return new Vector3(0.04, 1.42, 1.96);
  if (mode === "shoulder") return new Vector3(0.67, 1.70, 2.58);
  return new Vector3(1.65, 4.57, 5.72);
}

type Aim = { yaw: number; pitch: number };

function aimAt(position: Vector3, slot: number, height = 1.11): Aim {
  const person = places[slot]!;
  const x = slot ? person.x - position.x : -position.x;
  const z = slot ? person.z - position.z : -position.z;
  return {
    yaw: MathUtils.clamp(Math.atan2(x, -z), -maxYaw, maxYaw),
    pitch: Math.atan2(height - position.y, Math.hypot(x, z)),
  };
}

function headAim(origin: Vector3, target: Vector3, facing: number): Aim {
  const x = target.x - origin.x;
  const z = target.z - origin.z;
  const relative = Math.atan2(x, z) - facing;
  return {
    yaw: MathUtils.clamp(Math.atan2(Math.sin(relative), Math.cos(relative)), -1.08, 1.08),
    pitch: MathUtils.clamp(Math.atan2(origin.y - target.y, Math.hypot(x, z)), -0.18, 0.18),
  };
}

export async function mountScene(
  host: HTMLElement, mode: ViewMode, people: readonly ReviewPerson[], onPick: (index: number) => void,
  { art, detailed, preview }: { art: RoomArt; detailed: boolean; preview: boolean },
): Promise<{
  lookAt(index: number, react?: boolean): void;
  speak(index: number, listener: number): void;
  mark(index: number | null): void;
}> {
  const bar = buildBarScene(LADDER[1]!, { compact: true, omitCenterSeats: true });
  const root = bar.root;
  await bar.woodReady;
  bar.setLighting("talk", 1);
  root.background = new Color("#141725");
  for (const name of ["centerStand", "centerBulb", "emissiveVote", "glowVote"]) {
    const mesh = bar.meshes[name];
    if (mesh) mesh.visible = false;
  }
  bar.lights.stage.position.set(0, 1.30, 0.14);
  bar.lights.stage.intensity *= 0.47;
  const fill = new DirectionalLight("#e4ddff", 0.34);
  fill.position.set(0.0, 2.2, 4.0);
  root.add(fill);
  const finish = art !== "original";
  const crafted = art === "detailed";
  makeFurniture(root, finish, crafted);
  if (finish) addFinishedRoom(bar, places, tableY, crafted);
  if (crafted) addDetailedTable(root, places, tableY, oppositeSlot);

  const viewer = cameraSpot("eye");
  const opposite = oppositeSeatOf(people);
  const previewSeat = previewSeatOf(people);
  const actors = people.map((person, i) => {
    const { slot } = person;
    const character = createCharacter(slot, "coat", { coat: coatColors[slot]!, tie: slot === oppositeSlot ? "#c88844" : "#a2a0b7" },
      person.animal, { detailedHead: detailed });
    const model = character.root;
    const pos = places[slot]!;
    model.position.set(pos.x, chairY - 0.30, pos.z);
    const facing = Math.atan2(-pos.x, -pos.z);
    character.setYaw(facing);
    const body = model.getObjectByName("body")!;
    const head = model.getObjectByName("neck")!;
    const left = model.getObjectByName("armA")!;
    const right = model.getObjectByName("armB")!;
    for (const name of ["legA", "legB"]) model.getObjectByName(name)!.rotation.x = -1.33;
    for (const child of model.children) if (child !== body) child.visible = false;
    if (i === 0 && mode === "eye") {
      for (const part of body.children) if (part !== left && part !== right) part.visible = false;
      left.position.z = 0.31;
      right.position.z = 0.29;
    }
    if (i === 0 && mode === "shoulder") head.visible = false;
    root.add(model);
    model.updateWorldMatrix(true, true);
    const headTop = new Box3().setFromObject(head).max.y;
    const pickMeshes = character.bodyMeshes().filter(mesh => mesh.visible);
    const headCenter = head.localToWorld(new Vector3(0, HEAD_CENTER_Y, 0));
    let restYaw = slot === oppositeSlot ? -0.095 : 0;
    if (preview && i === previewSeat) restYaw = MathUtils.clamp(headAim(headCenter, viewer, facing).yaw, -0.54, 0.54);
    return { character, head, left, right, headTop, pickMeshes, facing, headCenter, restYaw, yaw: restYaw, pitch: 0 };
  });
  const gazeBySeat = actors.map(actor =>
    actors.map((peer, i) => headAim(actor.headCenter, i === 0 ? viewer : peer.headCenter, actor.facing)));

  const renderer = new WebGLRenderer({ antialias: true });
  renderer.domElement.className = "scene-canvas";
  renderer.domElement.setAttribute("aria-hidden", "true");
  Object.assign(renderer.domElement.style, { display: "block", width: "100%", height: "100%", touchAction: "pan-y" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setClearColor(new Color("#131722"));
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = bar.exposure * 0.98;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  host.append(renderer.domElement);

  function createTag(className: string): HTMLSpanElement {
    const tag = document.createElement("span");
    tag.className = className;
    tag.setAttribute("aria-hidden", "true");
    tag.hidden = true;
    host.append(tag);
    return tag;
  }
  const chip = createTag("scene-tag");
  const suspectChip = createTag("scene-marker");

  const camera = new PerspectiveCamera(68, 1, 0.07, 28);
  camera.position.copy(cameraSpot(mode));
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const ray = new Raycaster();
  const ndc = new Vector2();
  const currentAim = aimAt(camera.position, oppositeSlot);
  const displayedAim = { ...currentAim };
  let desiredAim = currentAim;
  let fromAim = currentAim;
  let atTime = 0;
  let focus = opposite;
  let turn: { speaker: number; listener: number; since: number } | null = null;
  let localChoice: number | null = null;
  let glanceUntil = 0;
  let glanceTimer = 0;
  let lastPoseAt = performance.now();
  let marked: number | null = null;
  let frame = 0;
  let visible = true;
  let lastDraw = -Infinity;
  let width = 0;
  let height = 0;
  let drag: { id: number; x: number; y: number; aim: Aim | null } | null = null;
  const projected = new Vector3();
  const position = new Vector3();
  const targets = actors.flatMap((actor, i) => i === 0 ? [] : actor.pickMeshes);
  const owners = new Map<Object3D, number>();
  actors.forEach((actor, i) => actor.pickMeshes.forEach(mesh => owners.set(mesh, i)));
  const actorHeads = actors.map(actor => actor.head.position.y);
  const noteOnTable = new Mesh(new PlaneGeometry(0.15, 0.10), new MeshStandardMaterial({
    color: "#e29772", roughness: 0.91, emissive: "#472117", emissiveIntensity: 0.25,
  }));
  noteOnTable.rotation.x = -Math.PI / 2;
  noteOnTable.visible = false;
  root.add(noteOnTable);

  function tagPlacement(index: number) {
    if (index === 0) return null;
    const actor = actors[index]!;
    actor.head.getWorldPosition(position);
    position.y = actor.headTop;
    projected.copy(position).project(camera);
    const left = (projected.x * 0.5 + 0.5) * width;
    const top = (0.5 - projected.y * 0.5) * height - 6;
    if (projected.z < -1 || projected.z > 1 || left < 22 || left > width - 22 || top > height - 14) return null;
    const name = people[index]!.name;
    const suspect = index === marked;
    const halfWidth = 9 + (name.length * 6) + (suspect ? 8 : 0);
    return { name, suspect, halfWidth, left: MathUtils.clamp(left, halfWidth, width - halfWidth), top: Math.max(54, top) };
  }

  function showTag(tag: HTMLSpanElement, placement: ReturnType<typeof tagPlacement>): void {
    tag.hidden = placement === null;
    if (!placement) return;
    if (tag.textContent !== placement.name) tag.textContent = placement.name;
    tag.toggleAttribute("data-marked", placement.suspect);
    tag.style.left = `${placement.left}px`;
    tag.style.top = `${placement.top}px`;
  }

  function gazeTarget(index: number, t: number): number | null | undefined {
    if (index === 0 && localChoice !== null) return localChoice;
    if (index === localChoice && t < glanceUntil) return 0;
    if (!turn) return null;
    if (index === turn.speaker) return turn.listener;
    const delay = 75 + (people[index]!.slot * 43) % 156;
    return reduceMotion.matches || t >= turn.since + delay ? turn.speaker : undefined;
  }

  function draw(t: number): void {
    if (!width || !height) return;
    const elapsed = atTime ? Math.min((t - atTime) / (focusDuration * 1000), 1) : 1;
    const progress = elapsed * elapsed * (3 - 2 * elapsed);
    displayedAim.yaw = MathUtils.lerp(fromAim.yaw, desiredAim.yaw, progress);
    displayedAim.pitch = MathUtils.lerp(fromAim.pitch, desiredAim.pitch, progress);
    if (mode === "wide") camera.lookAt(0, 0.93, 0);
    else camera.lookAt(
      camera.position.x + Math.sin(displayedAim.yaw),
      camera.position.y + Math.tan(displayedAim.pitch),
      camera.position.z - Math.cos(displayedAim.yaw),
    );
    camera.updateMatrixWorld();

    const frameSeconds = MathUtils.clamp((t - lastPoseAt) / 1000, 0, 0.12);
    lastPoseAt = t;
    const blend = reduceMotion.matches ? 1 : 1 - Math.exp(-12 * frameSeconds);
    const speaking = turn?.speaker ?? opposite;
    for (const [i, actor] of actors.entries()) {
      const peer = gazeTarget(i, t);
      if (peer !== undefined) {
        const aim = peer === null ? null : gazeBySeat[i]![peer]!;
        actor.yaw = MathUtils.lerp(actor.yaw, aim?.yaw ?? actor.restYaw, blend);
        actor.pitch = MathUtils.lerp(actor.pitch, aim?.pitch ?? 0, blend);
      }
      const rate = t * 0.0026;
      const gesture = i === speaking && !reduceMotion.matches ? Math.sin(rate) * 0.05 : 0;
      actor.head.rotation.set(actor.pitch + (i === speaking ? -0.026 : 0.018) + gesture * 0.28,
        actor.yaw + (i === focus ? gesture * 2 : 0), 0);
      actor.head.position.y = actorHeads[i]! + gesture * 0.22;
      actor.left.rotation.set(-1.33 + gesture * 1.38, 0, 0.17);
      actor.right.rotation.set(-1.30, 0, -0.18);
    }

    renderer.render(root, camera);
    const focusedTag = tagPlacement(focus);
    const markedTag = marked === null || marked === focus ? null : tagPlacement(marked);
    const overlap = focusedTag && markedTag && Math.abs(focusedTag.top - markedTag.top) < 28
      && Math.abs(focusedTag.left - markedTag.left) < focusedTag.halfWidth + markedTag.halfWidth + 4;
    showTag(chip, focusedTag);
    showTag(suspectChip, overlap ? null : markedTag);
    host.dataset.ready = "true";
  }

  function animate(t: number): void {
    frame = 0;
    if (!visible || !width || !height) return;
    if (t - lastDraw >= 32) {
      draw(t);
      lastDraw = t;
    }
    if (!reduceMotion.matches) frame = requestAnimationFrame(animate);
  }

  function updateSize(): void {
    width = host.clientWidth;
    height = host.clientHeight;
    if (!width || !height) return;
    const horizontal = (mode === "wide" ? 47 : mode === "eye" ? 58 : 58) * Math.PI / 180;
    camera.aspect = width / height;
    camera.fov = 2 * Math.atan(Math.tan(horizontal / 2) / camera.aspect) * 180 / Math.PI;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    draw(performance.now());
    if (visible && !frame && !reduceMotion.matches) frame = requestAnimationFrame(animate);
  }
  new ResizeObserver(updateSize).observe(host);
  new IntersectionObserver(([entry]) => {
    visible = entry?.isIntersecting === true;
    if (visible && !frame) frame = requestAnimationFrame(animate);
  }).observe(host);
  updateSize();

  function beginAim(next: Aim, immediate: boolean): void {
    const now = performance.now();
    fromAim = { ...displayedAim };
    desiredAim = next;
    atTime = immediate || reduceMotion.matches ? 0 : now;
    draw(now);
  }

  renderer.domElement.addEventListener("pointerdown", event => {
    if (!event.isPrimary || event.button !== 0 || drag) return;
    renderer.domElement.setPointerCapture(event.pointerId);
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, aim: null };
  });
  renderer.domElement.addEventListener("pointermove", event => {
    if (!drag || drag.id !== event.pointerId || mode === "wide") return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (!drag.aim) {
      if (Math.abs(dx) < 7 || Math.abs(dx) < Math.abs(dy)) return;
      drag.aim = { ...displayedAim };
    }
    beginAim({ yaw: MathUtils.clamp(drag.aim.yaw - dx * 0.0047, -maxYaw, maxYaw), pitch: drag.aim.pitch }, true);
  });
  if (mode !== "wide") renderer.domElement.addEventListener("touchmove", event => {
    const touch = event.touches[0];
    if (!touch || !drag || !event.cancelable) return;
    const dx = Math.abs(touch.clientX - drag.x);
    const dy = Math.abs(touch.clientY - drag.y);
    if (drag.aim || (dx >= 7 && dx > dy)) event.preventDefault();
  }, { passive: false });
  renderer.domElement.addEventListener("pointerup", event => {
    if (!drag || drag.id !== event.pointerId) return;
    const start = drag;
    drag = null;
    if (!event.isPrimary || event.button !== 0 || start.aim
      || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 8) return;
    const rect = renderer.domElement.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX >= rect.right || event.clientY < rect.top || event.clientY >= rect.bottom) return;
    ndc.set((event.clientX - rect.left) / rect.width * 2 - 1, 1 - (event.clientY - rect.top) / rect.height * 2);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(targets, false)[0];
    if (!hit) return;
    const index = owners.get(hit.object);
    if (index !== undefined) onPick(index);
  });
  function cancelDrag(event: PointerEvent): void {
    if (drag?.id === event.pointerId) drag = null;
  }
  renderer.domElement.addEventListener("pointercancel", cancelDrag);
  renderer.domElement.addEventListener("lostpointercapture", cancelDrag);

  return {
    lookAt(index, react = true) {
      const person = people[index];
      if (!person) return;
      focus = index;
      if (react) {
        localChoice = index === 0 ? null : index;
        glanceUntil = performance.now() + glanceDuration;
        window.clearTimeout(glanceTimer);
        if (localChoice !== null && reduceMotion.matches) {
          glanceTimer = window.setTimeout(() => draw(performance.now()), glanceDuration);
        }
      }
      const height = mode === "eye" && preview && index === previewSeat ? 1.28 : undefined;
      beginAim(aimAt(camera.position, person.slot, height), mode === "wide");
    },
    speak(index, listener) {
      if (!people[index]) return;
      const peer = people[listener] && listener !== index ? listener : index === opposite ? 0 : opposite;
      const now = performance.now();
      turn = { speaker: index, listener: peer, since: now };
      localChoice = null;
      window.clearTimeout(glanceTimer);
      draw(now);
    },
    mark(index) {
      marked = index;
      actors.forEach((actor, i) => actor.character.setNotes(i === index ? [0] : [], { animate: false }));
      noteOnTable.visible = index !== null;
      if (index !== null) {
        const { slot } = people[index]!;
        const pos = places[slot]!;
        noteOnTable.position.set(pos.x * 0.72, tableY + 0.014, pos.z * 0.72);
        noteOnTable.rotation.z = ringAngles[slot]!;
      }
      draw(performance.now());
    },
  };
}

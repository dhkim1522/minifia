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

export type ViewMode = "eye" | "shoulder" | "wide";

export const people = [
  { name: "지호", animal: "rabbit", line: "창가 쪽에 앉아 있었어." },
  { name: "민준", animal: "elephant", line: "그때 피아노 소리가 들렸어?" },
  { name: "서연", animal: "fox", line: "아까 민준이 한 말이랑 달라." },
  { name: "도윤", animal: "penguin", line: "서연이 얘기부터 들어보자." },
  { name: "하린", animal: "lion", line: "창가 쪽은 불이 꺼져 있었어." },
  { name: "유진", animal: "frog", line: "난 노란 불빛만 기억나." },
  { name: "현우", animal: "hedgehog", line: "두 사람이 본 게 다른가 봐." },
  { name: "수아", animal: "parrot", line: "지호가 본 것도 들어보고 싶어." },
] as const satisfies readonly { name: string; animal: AnimalId; line: string }[];

const speaker = 2;
const ringAngles = [0, -0.83, 3.09, 0.87, -1.64, 1.66, -2.39, 2.41];
const places = ringAngles.map(a => new Vector3(Math.sin(a) * 2.04, 0, Math.cos(a) * 2.04));
const coatColors = [
  "#3d4e68", "#405068", "#304d56", "#35384b", "#574355", "#414759", "#524641", "#3d4e68",
];
const tableY = 0.79;
const chairY = 0.43;
const focusDuration = 0.32;
const maxYaw = 66 * Math.PI / 180;
const paper = "#a7916c";

function makeFurniture(root: Scene, finish: boolean): void {
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
  brass.cyl(0.12, 0.145, 0.028, 24, "#b78250", tf(0, tableY + 0.023, 0));
  brass.cyl(0.018, 0.022, 0.14, 16, "#c2985b", tf(0, tableY + 0.10, 0));
  brass.add(new SphereGeometry(0.135, 24, 12, 0, 2 * Math.PI, 0, Math.PI / 2).scale(1, 0.69, 1),
    "#cc9a5b", tf(0, tableY + 0.17, 0));
  lamp.cyl(0.121, 0.126, 0.014, 24, "#ffdcaa", tf(0, tableY + 0.166, 0), finish ? 0.91 : 1.08);
  if (finish) {
    brass.add(new TorusGeometry(0.133, 0.006, 8, 32), "#d4a665", tf(0, tableY + 0.17, 0, -Math.PI / 2));
    brass.cyl(0.020, 0.025, 0.036, 12, "#b98d55", tf(0, tableY + 0.267, 0));
  }

  for (const [i, pos] of places.entries()) {
    const facing = Math.atan2(-pos.x, -pos.z);
    const chair = tf(pos.x, 0, pos.z, 0, facing, 0);
    const upholstery = i === 0 ? "#414956" : "#473435";
    felt.add(new SphereGeometry(0.44, 20, 12).scale(1, 0.15, 0.85),
      upholstery, under(chair, tf(0, chairY - 0.025, 0)));
    felt.add(new SphereGeometry(0.40, 20, 12).scale(1, 0.63, 0.19),
      upholstery, under(chair, tf(0, 0.73, -0.34, -0.16)));
    for (const x of [-0.25, 0.25]) {
      for (const z of [-0.23, 0.25]) {
        wood.cyl(0.029, 0.038, 0.39, 10, "#58423a", under(chair, tf(x, 0.195, z)));
      }
      wood.cyl(0.026, 0.03, 0.47, 12, "#634b3e", under(chair, tf(x, 0.61, -0.31, -0.19)));
      brass.sph(0.022, "#9d7853", under(chair, tf(x, 0.86, -0.36)));
    }
    const settingRadius = i === 0 ? 0.51 : 0.655;
    const placeSetting = tf(pos.x * settingRadius, tableY + 0.009, pos.z * settingRadius, 0, facing, 0);
    porcelain.add(new PlaneGeometry(0.18, 0.117), i === speaker ? "#eac88b" : paper,
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
    porcelain.build(new MeshStandardMaterial({ vertexColors: true, roughness: 0.74 }), "seated-table-props"),
    lamp.build(new MeshBasicMaterial({ vertexColors: true }), "seated-table-lamp"),
  ];
  for (const mesh of meshes) mesh.receiveShadow = true;
  meshes[0]!.castShadow = meshes[1]!.castShadow = true;
  root.add(...meshes);

  // 실내 쪽에서만 보이는 천장이라 테이블 전체를 보는 카메라를 가리지 않는다.
  const ceiling = new Mesh(
    new PlaneGeometry(9.43, 9.43),
    new MeshStandardMaterial({ color: "#252437", roughness: 1, emissive: "#231d2f", emissiveIntensity: 0.54 }),
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = 3.44;
  root.add(ceiling);

  const molding = new Bundle();
  for (const z of [-3.78, -2.40, -1.02, 0.36, 1.74, 3.12]) {
    molding.add(new PlaneGeometry(9.4, 0.032), "#373047", tf(0, 3.437, z, Math.PI / 2));
  }
  molding.add(new PlaneGeometry(9.4, 3.45), "#29293a", tf(4.6, 1.725, 0, 0, -Math.PI / 2, 0));
  for (const y of [0.09, 0.86, 3.18]) {
    molding.add(new PlaneGeometry(9.4, 0.037), "#44384a", tf(4.59, y, 0, 0, -Math.PI / 2, 0));
  }
  root.add(molding.build(new MeshBasicMaterial({ vertexColors: true }), "seated-room-molding"));
}

function cameraSpot(mode: ViewMode): Vector3 {
  if (mode === "eye") return new Vector3(0.04, 1.42, 1.96);
  if (mode === "shoulder") return new Vector3(0.67, 1.70, 2.58);
  return new Vector3(1.65, 4.57, 5.72);
}

function aimAt(position: Vector3, i: number): { yaw: number; pitch: number } {
  const person = places[i] ?? places[speaker]!;
  const height = 1.11;
  const x = i ? person.x - position.x : -position.x;
  const z = i ? person.z - position.z : -position.z;
  return {
    yaw: MathUtils.clamp(Math.atan2(x, -z), -maxYaw, maxYaw),
    pitch: Math.atan2(height - position.y, Math.hypot(x, z)),
  };
}

export async function mountScene(host: HTMLElement, mode: ViewMode, onPick: (index: number) => void, finish = true): Promise<{
  lookAt(index: number): void; mark(index: number | null): void;
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
  makeFurniture(root, finish);
  if (finish) addFinishedRoom(bar, places, tableY);

  const actors = people.map((person, i) => {
    const character = createCharacter(i, "coat", { coat: coatColors[i]!, tie: i === speaker ? "#c88844" : "#a2a0b7" }, person.animal);
    const model = character.root;
    const pos = places[i]!;
    model.position.set(pos.x, chairY - 0.30, pos.z);
    character.setYaw(Math.atan2(-pos.x, -pos.z));
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
    const headTop = new Box3().setFromObject(head).max.y;
    return { character, head, left, right, headTop };
  });

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

  const chip = document.createElement("span");
  chip.className = "scene-tag";
  chip.setAttribute("aria-hidden", "true");
  Object.assign(chip.style, { position: "absolute", transform: "translate(-50%, -100%)", pointerEvents: "none" });
  host.append(chip);

  const camera = new PerspectiveCamera(68, 1, 0.07, 28);
  camera.position.copy(cameraSpot(mode));
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const ray = new Raycaster();
  const ndc = new Vector2();
  const currentAim = aimAt(camera.position, speaker);
  let desiredAim = currentAim;
  let fromAim = currentAim;
  let atTime = 0;
  let focus = speaker;
  let frame = 0;
  let visible = true;
  let lastDraw = -Infinity;
  let width = 0;
  let height = 0;
  let drag: { x: number; y: number; yaw: number; active: boolean } | null = null;
  const projected = new Vector3();
  const position = new Vector3();
  const targets = actors.flatMap((actor, i) => i === 0 ? [] : actor.character.bodyMeshes());
  const owners = new Map<Object3D, number>();
  actors.forEach((a, i) => a.character.bodyMeshes().forEach(mesh => owners.set(mesh, i)));
  const actorHeads = actors.map(actor => actor.head.position.y);
  const noteOnTable = new Mesh(new PlaneGeometry(0.15, 0.10), new MeshStandardMaterial({
    color: "#e29772", roughness: 0.91, emissive: "#472117", emissiveIntensity: 0.25,
  }));
  noteOnTable.rotation.x = -Math.PI / 2;
  noteOnTable.visible = false;
  root.add(noteOnTable);

  function draw(t: number): void {
    if (!width || !height) return;
    const elapsed = atTime ? Math.min((t - atTime) / (focusDuration * 1000), 1) : 1;
    const progress = elapsed * elapsed * (3 - 2 * elapsed);
    const yaw = MathUtils.lerp(fromAim.yaw, desiredAim.yaw, progress);
    const pitch = MathUtils.lerp(fromAim.pitch, desiredAim.pitch, progress);
    if (mode === "wide") camera.lookAt(0, 0.93, 0);
    else camera.lookAt(
      camera.position.x + Math.sin(yaw),
      camera.position.y + Math.tan(pitch),
      camera.position.z - Math.cos(yaw),
    );
    camera.updateMatrixWorld();

    for (const [i, actor] of actors.entries()) {
      const rate = t * 0.0026;
      const gesture = i === speaker && !reduceMotion.matches ? Math.sin(rate) * 0.05 : 0;
      actor.head.rotation.set(i === speaker ? -0.026 + gesture * 0.28 : 0.018,
        (i === speaker ? -0.095 : 0) + (i === focus ? gesture * 2 : 0), 0);
      actor.head.position.y = actorHeads[i]! + (i === speaker ? gesture * 0.22 : 0);
      actor.left.rotation.set(-1.33 + gesture * 1.38, 0, 0.17);
      actor.right.rotation.set(-1.30, 0, -0.18);
    }

    renderer.render(root, camera);
    const target = actors[focus]!;
    target.head.getWorldPosition(position);
    position.y = target.headTop;
    projected.copy(position).project(camera);
    const left = (projected.x * 0.5 + 0.5) * width;
    const top = (0.5 - projected.y * 0.5) * height - 6;
    chip.hidden = focus === 0 || projected.z > 1 || left < 22 || left > width - 22 || top < 44 || top > height - 14;
    if (!chip.hidden) {
      chip.textContent = people[focus]!.name;
      chip.style.left = `${left}px`;
      chip.style.top = `${top}px`;
    }
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

  function beginAim(next: { yaw: number; pitch: number }, immediate: boolean): void {
    const now = performance.now();
    const elapsed = atTime ? Math.min((now - atTime) / (focusDuration * 1000), 1) : 1;
    const mix = elapsed * elapsed * (3 - 2 * elapsed);
    fromAim = {
      yaw: MathUtils.lerp(fromAim.yaw, desiredAim.yaw, mix),
      pitch: MathUtils.lerp(fromAim.pitch, desiredAim.pitch, mix),
    };
    desiredAim = next;
    atTime = immediate || reduceMotion.matches ? 0 : now;
    draw(now);
  }

  renderer.domElement.addEventListener("pointerdown", event => {
    if (!event.isPrimary || event.button !== 0) return;
    renderer.domElement.setPointerCapture(event.pointerId);
    drag = { x: event.clientX, y: event.clientY, yaw: desiredAim.yaw, active: false };
  });
  renderer.domElement.addEventListener("pointermove", event => {
    if (!drag || mode === "wide") return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (!drag.active && (Math.abs(dx) < 7 || Math.abs(dx) < Math.abs(dy))) return;
    drag.active = true;
    beginAim({ yaw: MathUtils.clamp(drag.yaw - dx * 0.0047, -maxYaw, maxYaw), pitch: -0.11 }, true);
  });
  if (mode !== "wide") renderer.domElement.addEventListener("touchmove", event => {
    const touch = event.touches[0];
    if (!touch || !drag || !event.cancelable) return;
    const dx = Math.abs(touch.clientX - drag.x);
    const dy = Math.abs(touch.clientY - drag.y);
    if (drag.active || (dx >= 7 && dx > dy)) event.preventDefault();
  }, { passive: false });
  renderer.domElement.addEventListener("pointerup", event => {
    const hasDrag = drag && (drag.active || Math.hypot(event.clientX - drag.x, event.clientY - drag.y) > 8);
    drag = null;
    if (hasDrag) return;
    const rect = renderer.domElement.getBoundingClientRect();
    ndc.set((event.clientX - rect.left) / rect.width * 2 - 1, 1 - (event.clientY - rect.top) / rect.height * 2);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(targets, false)[0];
    if (!hit) return;
    const index = owners.get(hit.object);
    if (index !== undefined) onPick(index);
  });
  renderer.domElement.addEventListener("pointercancel", () => { drag = null; });

  return {
    lookAt(index) {
      if (!people[index]) return;
      focus = index;
      beginAim(aimAt(camera.position, index), mode === "wide");
    },
    mark(index) {
      actors.forEach((actor, i) => actor.character.setNotes(i === index ? [0] : [], { animate: false }));
      noteOnTable.visible = index !== null;
      if (index !== null) {
        const pos = places[index]!;
        noteOnTable.position.set(pos.x * 0.72, tableY + 0.014, pos.z * 0.72);
        noteOnTable.rotation.z = ringAngles[index]!;
      }
      draw(performance.now());
    },
  };
}

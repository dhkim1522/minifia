import {
  Color, DirectionalLight, HemisphereLight, MeshBasicMaterial, MeshStandardMaterial,
  PointLight, Scene, SphereGeometry, TorusGeometry,
} from "three";
import { Bundle, tf, under } from "../../../src/world/maps/bar";
import { PALETTE as P } from "../../../src/world/palette";

export const roomHalf = 4.7;
export const seatTop = 0.19;
export const centerStandRadius = 0.66;
export const piano = { x: -1.85, z: -roomHalf + 0.63, width: 1.62, depth: 0.66 } as const;
export const bar = { x: roomHalf - 0.35, z: -1.24, width: 0.55, depth: 2.05 } as const;
const seatRadius = 0.36;

export function buildReviewRoom(seats: readonly (readonly [number, number])[]): Scene {
  const room = new Scene();
  room.background = new Color("#111823");
  const floor = new Bundle();
  const furniture = new Bundle();
  const brass = new Bundle();
  const lamps = new Bundle();
  const wood = new MeshStandardMaterial({ vertexColors: true, roughness: 0.77 });
  const metal = new MeshStandardMaterial({ vertexColors: true, roughness: 0.48, metalness: 0.26 });
  const glow = new MeshBasicMaterial({ vertexColors: true });
  const side = roomHalf * 2;

  floor.box(side + 0.16, 0.18, side + 0.16, P.wall, tf(0, -0.1, 0));
  const planks = [P.floorA, P.floorB, P.floorC] as const;
  const plankRows = Math.round(side / 0.30);
  for (let row = 0; row < plankRows; row++) {
    const depth = side / plankRows;
    const z = -roomHalf + (row + 0.5) * depth;
    let left = -roomHalf;
    let seam = left + (row % 3 + 2) * 0.43;
    let plank = 0;
    while (left < roomHalf - 0.001) {
      const right = Math.min(seam, roomHalf);
      floor.box(right - left - 0.009, 0.02, depth - 0.011, planks[(row + plank * 2) % planks.length]!, tf((left + right) / 2, -0.01, z));
      left = right;
      seam += 1.89;
      plank++;
    }
  }
  floor.box(side, 3.13, 0.13, P.wall, tf(0, 1.565, -roomHalf));
  floor.box(0.13, 2.8, side, P.wall, tf(-roomHalf, 1.4, 0));
  floor.box(side, 0.69, 0.035, P.wainscot, tf(0, 0.345, -roomHalf + 0.085));
  floor.box(0.035, 0.69, side, P.wainscot, tf(-roomHalf + 0.085, 0.345, 0));
  for (const y of [0.12, 0.70, 2.96]) {
    floor.box(side, 0.037, 0.045, P.wallTrim, tf(0, y, -roomHalf + 0.09));
    if (y < 1) floor.box(0.045, 0.037, side, P.wallTrim, tf(-roomHalf + 0.09, y, 0));
  }
  brass.box(side, 0.017, 0.038, P.brass, tf(0, 0.007, roomHalf - 0.04));
  brass.box(0.038, 0.017, side, P.brass, tf(roomHalf - 0.04, 0.007, 0));

  // 창은 방의 차가운 바탕색을 살리고, 벽 아래에 피아노 실루엣을 남긴다.
  const windowX = 0.42;
  const windowZ = -roomHalf + 0.13;
  floor.box(1.54, 1.24, 0.048, P.wallTrim, tf(windowX, 1.96, windowZ));
  floor.box(1.45, 1.16, 0.032, P.windowGlass, tf(windowX, 1.96, windowZ + 0.03));
  for (const dx of [-0.7, -0.24, 0.23, 0.7]) {
    floor.box(0.049, 1.17, 0.027, P.blind, tf(windowX + dx, 1.96, windowZ + 0.06));
  }
  for (const y of [1.42, 1.87, 2.18, 2.51]) {
    floor.box(1.48, 0.032, 0.029, P.blind, tf(windowX, y, windowZ + 0.07));
  }
  floor.box(1.61, 0.055, 0.19, P.sill, tf(windowX, 1.36, windowZ + 0.05));
  for (let i = -3; i <= 3; i++) {
    brass.box(0.02, 0.76 + Math.abs(i) * 0.025, 0.013, P.inlay, tf(2.69 + i * 0.108, 2.10 - Math.abs(i) * 0.12, -roomHalf + 0.10, 0, 0, -i * 0.33));
  }
  furniture.box(piano.width, 0.69, piano.depth, P.pianoBody, tf(piano.x, 0.94, piano.z));
  furniture.box(piano.width + 0.06, 0.052, piano.depth + 0.05, P.wallTrim, tf(piano.x, 1.30, piano.z));
  furniture.box(piano.width, 0.11, 0.20, P.pianoBody, tf(piano.x, 0.63, piano.z + 0.37));
  furniture.box(piano.width - 0.13, 0.028, 0.15, P.pianoKeys, tf(piano.x, 0.696, piano.z + 0.39));
  for (let i = 0; i < 16; i++) {
    furniture.box(0.009, 0.017, i % 3 === 1 ? 0.04 : 0.083, P.pianoBody, tf(piano.x - 0.7 + i * 0.09, 0.717, piano.z + 0.367));
  }
  for (const dx of [-0.69, 0.69]) {
    furniture.box(0.086, 0.62, 0.089, P.pianoBody, tf(piano.x + dx, 0.31, piano.z + 0.42));
  }
  furniture.box(bar.width, 0.78, bar.depth, P.counter, tf(bar.x, 0.39, bar.z));
  furniture.box(bar.width + 0.10, 0.075, bar.depth + 0.12, P.counterTop, tf(bar.x, 0.81, bar.z));
  brass.box(0.031, 0.035, bar.depth, P.brass, tf(bar.x - bar.width / 2, 0.18, bar.z));

  // 중앙 스탠드와 그 둘레의 좌석은 모든 인원 구도에서 같은 좌표를 사용한다.
  furniture.cyl(centerStandRadius, centerStandRadius, 0.085, 48, P.stageBody, tf(0, 0.043, 0));
  furniture.cyl(centerStandRadius - 0.026, centerStandRadius, 0.037, 48, P.stageWood, tf(0, 0.099, 0));
  brass.add(new TorusGeometry(centerStandRadius - 0.018, 0.015, 8, 48), P.brass, tf(0, 0.105, 0, -Math.PI / 2));
  brass.cyl(0.22, 0.24, 0.052, 24, P.brass, tf(0, 0.14, 0));
  brass.cyl(0.033, 0.050, 0.45, 16, P.brass, tf(0, 0.39, 0));
  brass.cyl(0.045, 0.063, 0.032, 18, P.brass, tf(0, 0.62, 0));
  furniture.cyl(0.126, 0.275, 0.14, 32, "#9e734b", tf(0, 0.70, 0));
  lamps.cyl(0.245, 0.245, 0.022, 32, "#ffd49d", tf(0, 0.632, 0), 1.7);
  lamps.sph(0.044, P.lamp, tf(0, 0.786, 0), 1.35);
  brass.add(new TorusGeometry(0.272, 0.014, 6, 32), P.brass, tf(0, 0.628, 0, -Math.PI / 2));

  for (const [x, z] of seats) {
    const orientation = tf(x, 0, z, 0, Math.atan2(-x, -z));
    furniture.cyl(seatRadius, seatRadius - 0.035, 0.075, 32, P.chairSeat, under(orientation, tf(0, seatTop - 0.038, 0)));
    furniture.cyl(0.23, 0.27, 0.103, 24, P.chairBack, under(orientation, tf(0, 0.070, 0)));
    brass.add(new TorusGeometry(seatRadius - 0.012, 0.012, 6, 32), P.brass, under(orientation, tf(0, seatTop - 0.037, 0, -Math.PI / 2)));
    furniture.add(new SphereGeometry(0.29, 18, 12).scale(1.11, 0.58, 0.20), P.chairSeat, under(orientation, tf(0, 0.37, -0.29, -0.11)));
    for (const dx of [-0.174, 0.174]) {
      brass.cyl(0.017, 0.020, 0.263, 8, P.brass, under(orientation, tf(dx, 0.22, -0.26, -0.13)));
    }
  }

  const floorShell = floor.build(wood, "compact-bar-shell");
  floorShell.receiveShadow = true;
  const fixtures = furniture.build(wood, "compact-bar-furniture");
  fixtures.castShadow = fixtures.receiveShadow = true;
  const trim = brass.build(metal, "compact-bar-brass");
  trim.receiveShadow = true;
  room.add(floorShell, fixtures, trim, lamps.build(glow, "center-stand-light"));
  room.add(new HemisphereLight("#c9d9fc", "#735539", 1.38));
  const fill = new DirectionalLight("#c4d6ff", 1.65);
  fill.position.set(2.8, 7.0, 5.8);
  fill.castShadow = true;
  fill.shadow.mapSize.set(512, 512);
  const shadowExtent = roomHalf + 1.35;
  fill.shadow.camera.left = fill.shadow.camera.bottom = -shadowExtent;
  fill.shadow.camera.right = fill.shadow.camera.top = shadowExtent;
  fill.shadow.camera.far = 22;
  fill.shadow.normalBias = 0.028;
  const lamp = new PointLight("#ffc280", 8, 4);
  lamp.position.set(0, 1.03, 0);
  const window = new DirectionalLight("#8fa8f1", 0.6);
  window.position.set(windowX, 2.2, -roomHalf - 0.65);
  room.add(fill, lamp, window);
  return room;
}

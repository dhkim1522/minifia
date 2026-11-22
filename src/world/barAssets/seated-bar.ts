import {
  DirectionalLight, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry,
  SphereGeometry, SpotLight, Vector3,
} from "three";
import type { Object3D } from "three";
import { BAR_ROOM_HALF, BAR_SEAT_HEIGHT, BAR_SEATS_FX, BAR_TABLE_HEIGHT, UNIT } from "../../../shared/game/map";
import { Bundle, tf, under } from "../maps/bar";
import type { BarScene } from "../maps/bar";
import { addRoomDetail } from "./room-detail";
import { addDetailedTable } from "./table-detail";
import { addFinishedTable, tableReflection } from "./table-finish";

export function addChairParts(wood: Bundle, felt: Bundle, brass: Bundle, pos: Vector3, mine: boolean, height: number): void {
  const chair = tf(pos.x, 0, pos.z, 0, Math.atan2(-pos.x, -pos.z));
  const upholstery = mine ? "#414956" : "#473435";
  felt.add(new SphereGeometry(0.44, 20, 12).scale(1, 0.15, 0.85),
    upholstery, under(chair, tf(0, height - 0.025, 0)));
  felt.add(new SphereGeometry(0.40, 20, 12).scale(1, 0.63, 0.19),
    upholstery, under(chair, tf(0, 0.73, -0.34, -0.16)));
  for (const x of [-0.25, 0.25]) {
    for (const z of [-0.23, 0.25]) {
      wood.cyl(0.029, 0.038, 0.39, 10, "#58423a", under(chair, tf(x, 0.195, z)));
    }
    wood.cyl(0.026, 0.03, 0.47, 12, "#634b3e", under(chair, tf(x, 0.61, -0.31, -0.19)));
    brass.sph(0.022, "#9d7853", under(chair, tf(x, 0.86, -0.36)));
  }
}

/** 방 안에서는 사방 벽과 천장이 보이고 방 밖에서 보는 전체 구도를 가리지 않는다. */
export function addSeatedRoomShell(root: Object3D, closeFront: boolean): void {
  const width = BAR_ROOM_HALF * 2;
  const ceiling = new Mesh(
    new PlaneGeometry(width + 0.03, width + 0.03),
    new MeshStandardMaterial({ color: "#252437", roughness: 1, emissive: "#231d2f", emissiveIntensity: 0.54 }),
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = 3.44;
  root.add(ceiling);

  const molding = new Bundle();
  for (const z of [-3.78, -2.40, -1.02, 0.36, 1.74, 3.12]) {
    molding.add(new PlaneGeometry(width, 0.032), "#373047", tf(0, 3.437, z, Math.PI / 2));
  }
  const sides = closeFront ? [tf(4.6, 0, 0, 0, -Math.PI / 2), tf(0, 0, 4.6, 0, Math.PI)] : [tf(4.6, 0, 0, 0, -Math.PI / 2)];
  for (const wall of sides) {
    molding.add(new PlaneGeometry(width, 3.45), "#29293a", under(wall, tf(0, 1.725, 0)));
    for (const y of [0.09, 0.86, 3.18]) {
      molding.add(new PlaneGeometry(width, 0.037), "#44384a", under(wall, tf(0, y, 0.01)));
    }
  }
  root.add(molding.build(new MeshBasicMaterial({ vertexColors: true }), "seated-room-molding"));
}

export function createSeatedBarArt(bar: BarScene): {
  table: Group;
  blockers: Object3D[];
  setConversationLighting(on: boolean, night?: boolean): void;
  applyBudget(fullProps: boolean): void;
} {
  const { root, meshes } = bar;
  const floor = meshes.woodFloor;
  const woodMap = floor?.material instanceof MeshStandardMaterial ? floor.material.map : null;
  const positions = BAR_SEATS_FX.map(([x, z]) => new Vector3(x / UNIT, 0, z / UNIT));
  const table = new Group();
  table.name = "conversation-table";
  const base = new Bundle();
  base.cyl(0.39, 0.54, 0.12, 36, "#472c25", tf(0, 0.08, 0));
  base.cyl(0.21, 0.29, 0.61, 32, "#54352a", tf(0, 0.36, 0));
  const tableBase = base.build(new MeshStandardMaterial({ vertexColors: true, roughness: 0.73 }), "conversation-table-base");
  tableBase.receiveShadow = tableBase.castShadow = true;
  table.add(tableBase);
  addFinishedTable(table, positions, BAR_TABLE_HEIGHT, woodMap);
  addDetailedTable(table, positions, BAR_TABLE_HEIGHT, 2);

  const wood = new Bundle();
  const felt = new Bundle();
  const brass = new Bundle();
  for (const [index, pos] of positions.entries()) addChairParts(wood, felt, brass, pos, index === 0, BAR_SEAT_HEIGHT);
  const chairs = [
    wood.build(new MeshStandardMaterial({ vertexColors: true, roughness: 0.73 }), "conversation-chair-wood"),
    felt.build(new MeshStandardMaterial({ vertexColors: true, roughness: 0.96 }), "conversation-chair-felt"),
    brass.build(new MeshStandardMaterial({ vertexColors: true, roughness: 0.37, metalness: 0.31 }), "conversation-chair-brass"),
  ];
  for (const mesh of chairs) mesh.receiveShadow = true;
  chairs[0]!.castShadow = chairs[1]!.castShadow = true;
  const room = new Group();
  addRoomDetail(room, woodMap);
  addSeatedRoomShell(root, true);

  const keyIntensity = 19;
  const rimIntensity = 0.72;
  const key = new SpotLight("#ffcc98", keyIntensity, 8, Math.PI / 3.4, 0.75, 2);
  key.position.set(-1.78, 2.88, 0.76);
  key.target.position.set(-0.22, 0.96, -1.25);
  const rim = new DirectionalLight("#9cb7ff", rimIntensity);
  rim.position.set(1.73, 2.15, -3.98);
  root.environment = tableReflection;
  root.add(table, room, ...chairs, key, key.target, rim);
  const blockers = [...chairs, ...table.children.filter(object => object.userData.tableBlocker === true)];
  return {
    table,
    blockers,
    setConversationLighting(on, night = false) {
      // 광원 수를 바꾸면 다음 프레임에 Three.js가 새 조명 셰이더를 컴파일한다.
      key.intensity = on ? keyIntensity : 0;
      rim.intensity = on ? rimIntensity : night ? 1.03 : 0;
      root.environmentIntensity = on ? 0.47 : night ? 0.17 : 0.24;
    },
    applyBudget(fullProps) {
      room.getObjectByName("seated-cabinet-glass")!.visible = fullProps;
      room.getObjectByName("seated-cabinet-baked-bounce")!.visible = fullProps;
    },
  };
}

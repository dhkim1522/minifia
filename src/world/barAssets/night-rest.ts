import {
  CatmullRomCurve3, Color, DoubleSide, InstancedMesh, MeshBasicMaterial, MeshStandardMaterial,
  RingGeometry, SphereGeometry, TubeGeometry, Vector3,
} from "three";
import type { Object3D } from "three";
import { BAR_SEATS_FX, BAR_TABLE_HEIGHT } from "../../../shared/game/map";
import { Bundle, tf } from "../maps/bar";
import type { NightRestSeat } from "../renderer";

const CLOTH = "#222b40";
const CLOTH_EDGE = "#33415b";
const DARK_CLOTH = "#151d2d";

/** 팔은 탁자 가장자리에 닿고 후드의 입구는 팔을 향한다. 모든 의자가 같은 모형을 쓴다. */
function sleeperModel() {
  const cloth = new Bundle();
  const mound = (x: number, y: number, z: number, w: number, h: number, d: number, color: string, pitch = 0, roll = 0) =>
    cloth.add(new SphereGeometry(1, 22, 14).scale(w, h, d), color, tf(x, y, z, pitch, 0, roll));

  mound(0, 0.64, 0.08, 0.43, 0.29, 0.42, DARK_CLOTH, 0.18);
  mound(0, 0.86, 0.19, 0.47, 0.26, 0.41, CLOTH, 0.32);
  for (const side of [-1, 1]) {
    mound(side * 0.32, 0.81, 0.38, 0.17, 0.23, 0.26, CLOTH, -0.64, side * 0.12);
    mound(side * 0.27, 0.89, 0.59, 0.19, 0.13, 0.27, CLOTH, 0.12, side * -0.14);
    mound(side * 0.19, 0.88, 0.77, 0.14, 0.10, 0.17, "#394155", 0.08, side * -0.18);
    mound(side * 0.14, 0.86, 0.87, 0.11, 0.065, 0.11, "#444b5d");
  }

  // -Y 쪽의 일부를 비운 구면을 탁자 쪽으로 눕혀 실제 후드 입구를 만든다.
  const hood = new SphereGeometry(1, 40, 24, 0, Math.PI * 2, 0, Math.PI * 0.71);
  const hoodX = 0.46, hoodY = 0.46, hoodZ = 0.47;
  const hoodPivot = new Vector3(0, 1.13, 0.42);
  const tilt = 0.61;
  const hoodTransform = tf(hoodPivot.x, hoodPivot.y, hoodPivot.z, tilt);
  hood.rotateX(-Math.PI / 2).scale(hoodX, hoodY, hoodZ);
  cloth.add(hood, CLOTH, hoodTransform);
  mound(0, 0.97, 0.55, 0.35, 0.25, 0.31, "#0d1320", 0.38);

  const rimRadius = Math.sin(Math.PI * 0.71);
  const rimZ = -Math.cos(Math.PI * 0.71) * hoodZ;
  const rim = new CatmullRomCurve3(Array.from({ length: 24 }, (_, i) => {
    const angle = i * Math.PI * 2 / 24;
    return new Vector3(Math.cos(angle) * hoodX * rimRadius, Math.sin(angle) * hoodY * rimRadius, rimZ);
  }), true);
  cloth.add(new TubeGeometry(rim, 40, 0.016, 5, true), CLOTH_EDGE, hoodTransform);
  const crown = new CatmullRomCurve3([-1.2, -0.8, -0.4, 0, 0.4, 0.72].map((angle) =>
    new Vector3(0, Math.cos(angle) * (hoodY + 0.003), Math.sin(angle) * (hoodZ + 0.003))));
  cloth.add(new TubeGeometry(crown, 24, 0.007, 5), CLOTH_EDGE, hoodTransform);
  const material = new MeshStandardMaterial({ vertexColors: true, roughness: 0.96, side: DoubleSide });
  return { geometry: cloth.build(material, "night-sleeper-model").geometry, material };
}

export function createNightRest(root: Object3D) {
  const model = sleeperModel();
  const sleepers = new InstancedMesh(model.geometry, model.material, BAR_SEATS_FX.length);
  const rings = new InstancedMesh(new RingGeometry(0.21, 0.237, 32), new MeshBasicMaterial({ transparent: true, opacity: 0.72 }), BAR_SEATS_FX.length);
  const color = new Color();
  sleepers.name = "night-sleepers";
  sleepers.castShadow = sleepers.receiveShadow = true;
  rings.name = "night-spectator-rings";
  sleepers.visible = rings.visible = false;
  root.add(sleepers, rings);

  return {
    set(seats: readonly NightRestSeat[], hideSeat: number | undefined): void {
      let count = 0;
      let ringCount = 0;
      for (const { seat, x, z, ring } of seats) {
        if (seat === hideSeat) continue;
        sleepers.setMatrixAt(count++, tf(x, 0, z, 0, Math.atan2(-x, -z)));
        if (ring !== undefined) {
          const radius = Math.hypot(x, z);
          const inset = (radius - 0.87) / radius;
          rings.setMatrixAt(ringCount, tf(x * inset, BAR_TABLE_HEIGHT + 0.026, z * inset, -Math.PI / 2));
          rings.setColorAt(ringCount++, color.set(ring));
        }
      }
      sleepers.count = count;
      sleepers.visible = count > 0;
      rings.count = ringCount;
      rings.visible = ringCount > 0;
      if (count > 0) {
        sleepers.instanceMatrix.needsUpdate = true;
        sleepers.computeBoundingSphere();
      }
      if (ringCount > 0 && rings.instanceColor !== null) {
        rings.instanceMatrix.needsUpdate = true;
        rings.instanceColor.needsUpdate = true;
        rings.computeBoundingSphere();
      }
    },
    dispose(): void {
      root.remove(sleepers, rings);
      sleepers.dispose();
      sleepers.geometry.dispose();
      model.material.dispose();
      rings.dispose();
      rings.geometry.dispose();
      rings.material.dispose();
    },
  };
}

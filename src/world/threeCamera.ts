// three 정사영 카메라. camera.ts 의 순수 수학과 같은 상수(PX_PER_UNIT·CAM_*·LOOK_Y)로 구성하고,
// Vector3.project / Raycaster 결과가 groundToScreen / screenToGround 와 같다는 것을 cameraThree.test.ts 가 증명한다.
// 시안(blockout.js)은 view 14 를 고정해 폰마다 배율이 달라졌다 — 여기서는 배율(px/단위)을 고정한다(UI-SPEC).
import { OrthographicCamera } from "three";
import { CAM_DIST, CAM_HEIGHT, CAM_YAW, LOOK_Y, PX_PER_UNIT } from "./camera";

export function createCamera(): OrthographicCamera {
  return new OrthographicCamera(-1, 1, 1, -1, 0.1, 120);
}

/**
 * 카메라를 목표·캔버스 크기·세로 이동에 맞춘다. 위치 = 목표 + (sin(yaw)·거리, 높이, cos(yaw)·거리), 주시점 = (목표, LOOK_Y).
 * offsetY 는 setViewOffset 으로 건다(양수면 장면이 위로 올라간다). 호출할 때마다 행렬을 모두 다시 계산한다.
 */
export function configureCamera(camera: OrthographicCamera, target: { x: number; z: number }, canvas: { w: number; h: number }, offsetY: number, zoom = 1): void {
  void zoom; // RED 뼈대: 아직 반영하지 않는다
  const { w, h } = canvas;
  camera.left = -w / 2 / PX_PER_UNIT;
  camera.right = w / 2 / PX_PER_UNIT;
  camera.top = h / 2 / PX_PER_UNIT;
  camera.bottom = -h / 2 / PX_PER_UNIT;
  camera.position.set(target.x + Math.sin(CAM_YAW) * CAM_DIST, CAM_HEIGHT, target.z + Math.cos(CAM_YAW) * CAM_DIST);
  camera.lookAt(target.x, LOOK_Y, target.z);
  camera.setViewOffset(w, h, 0, offsetY, w, h); // 안에서 updateProjectionMatrix 를 부른다
  camera.updateMatrixWorld(true);
}

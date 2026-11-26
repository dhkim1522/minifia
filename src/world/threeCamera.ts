// three 정사영 카메라. camera.ts 의 순수 수학과 같은 상수(PX_PER_UNIT·CAM_*·LOOK_Y)로 구성하고,
// Vector3.project / Raycaster 결과가 groundToScreen / screenToGround 와 같다는 것을 cameraThree.test.ts 가 증명한다.
// 시안(blockout.js)은 view 14 를 고정해 폰마다 배율이 달라졌다 — 여기서는 배율(px/단위)을 고정한다(UI-SPEC).
import { OrthographicCamera, PerspectiveCamera } from "three";
import { cameraScale, DEFAULT_CAMERA, TABLE_EYE_FOV } from "./camera";
import type { CameraRig, TableCamera } from "./camera";

export function createCamera(): OrthographicCamera {
  return new OrthographicCamera(-1, 1, 1, -1, 0.1, 120);
}

export function createTableCamera(): PerspectiveCamera {
  return new PerspectiveCamera(68, 1, 0.07, 28);
}

export function configureTableCamera(
  camera: PerspectiveCamera, view: TableCamera, { w, h }: { w: number; h: number }, offsetY: number,
): void {
  const horizontal = view.mode === "wide" ? 47 * Math.PI / 180 : view.horizontalFov ?? TABLE_EYE_FOV;
  camera.aspect = w / h;
  camera.fov = 2 * Math.atan(Math.tan(horizontal / 2) / camera.aspect) * 180 / Math.PI;
  camera.position.set(view.position.x, view.position.y, view.position.z);
  camera.lookAt(view.target.x, view.target.y, view.target.z);
  camera.setViewOffset(w, h, 0, offsetY, w, h);
  camera.updateMatrixWorld(true);
}

/**
 * 카메라를 목표·캔버스 크기·세로 이동에 맞춘다. 위치 = 목표 + (sin(yaw)·거리, 높이, cos(yaw)·거리), 주시점 = (목표, LOOK_Y).
 * zoom 은 화면 가운데 기준 확대(기본 1, 과반 연출 1.08) — 프러스텀을 PX_PER_UNIT × zoom 으로 나눈다. offsetY 는 zoom 과 상관없이 화면 픽셀이다.
 * 위치·방위는 camera.ts 의 CAM_YAW·CAM_DIST·CAM_HEIGHT 를 따른다.
 * offsetY 는 setViewOffset 으로 건다(양수면 장면이 위로 올라간다). 호출할 때마다 행렬을 모두 다시 계산한다.
 */
export function configureCamera(camera: OrthographicCamera, target: { x: number; z: number }, canvas: { w: number; h: number }, offsetY: number, zoom = 1, rig: CameraRig = DEFAULT_CAMERA): void {
  const { w, h } = canvas;
  const scale = cameraScale(canvas, rig) * zoom;
  camera.left = -w / 2 / scale;
  camera.right = w / 2 / scale;
  camera.top = h / 2 / scale;
  camera.bottom = -h / 2 / scale;
  camera.position.set(target.x + Math.sin(rig.yaw) * rig.dist, rig.height, target.z + Math.cos(rig.yaw) * rig.dist);
  camera.lookAt(target.x, rig.lookY, target.z);
  camera.setViewOffset(w, h, 0, offsetY, w, h); // 안에서 updateProjectionMatrix 를 부른다
  camera.updateMatrixWorld(true);
}

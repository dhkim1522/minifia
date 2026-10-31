// three 정사영 카메라 (RED 스텁)
import { OrthographicCamera } from "three";

export function createCamera(): OrthographicCamera {
  return new OrthographicCamera(-1, 1, 1, -1, 0.1, 120);
}

export function configureCamera(_camera: OrthographicCamera, _target: { x: number; z: number }, _canvas: { w: number; h: number }, _offsetY: number): void {}

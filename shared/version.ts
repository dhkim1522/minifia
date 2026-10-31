// 빌드 시 vite define 이 채우는 버전 문자열. 정의가 없는 환경(vitest 등)에서는 "dev".
// shared/ 는 앱·워커 두 tsconfig 에 모두 들어가므로 DOM·workerd 전용 API 를 쓰지 않는다.
declare const __APP_VERSION__: string | undefined;
declare const __WORKER_NAME__: string | undefined;

export const APP_VERSION: string = typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "dev";

// 배포 대상 Worker 이름. scripts/deploy-target.mjs 가 단일 출처이고 vite define 이 채운다. 정의가 없으면 "dev".
export const WORKER_NAME: string = typeof __WORKER_NAME__ === "string" ? __WORKER_NAME__ : "dev";

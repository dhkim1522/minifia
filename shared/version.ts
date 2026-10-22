// 빌드 시 vite define 이 채우는 버전 문자열. 정의가 없는 환경(vitest 등)에서는 "dev".
// shared/ 는 앱·워커 두 tsconfig 에 모두 들어가므로 DOM·workerd 전용 API 를 쓰지 않는다.
declare const __APP_VERSION__: string | undefined;

export const APP_VERSION: string = typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "dev";

// RED 단계 자리표시 — 테스트가 읽어 들일 수 있게 이름만 내보낸다. 구현은 다음 커밋(GREEN)에서 채운다.
export const WORKER_NAME = "";
export const V1_NAME = "";
export const WORKERS_SUBDOMAIN = "";
export const V1_HOST = "";
export const V1_ORIGIN = "";
export function expectedOrigin() {
  return "";
}
export function assertNotV1(urlOrOrigin) {
  return urlOrOrigin;
}
export function exitIfV1() {}
export function stripJsonComments(text) {
  return text;
}
export function judgeDeployTarget() {
  return { ok: true, problems: [] };
}

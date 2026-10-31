// 배포 대상의 유일한 출처 — 다른 스크립트는 이 값만 import 한다(결정 0043-3·0044-24).
// v2.0 은 Worker `minifia-v2` 로만 배포하고, v1.0(`minifia`) 주소는 검사·배포 어느 쪽도 하지 않는다.
// 거부를 푸는 옵션·환경 변수는 없다. Node 내장만 쓰는 순수 판정 모듈이다(네트워크·파일을 건드리지 않는다).

/** v2.0 Worker 이름. wrangler.jsonc 의 name 과 빌드 산출물의 name 이 이 값이어야 한다. */
export const WORKER_NAME = "minifia-v2";
/** v1.0 Worker 이름 — 덮어쓰면 안 된다. */
export const V1_NAME = "minifia";
/** 개인 계정의 workers.dev 하위 도메인(docs/setup.md). */
export const WORKERS_SUBDOMAIN = "dhplay";
/** v1.0 배포본의 호스트 — v2 스크립트는 이 호스트에 요청을 보내지 않는다. */
export const V1_HOST = "minifia.dhplay.workers.dev";
export const V1_ORIGIN = "https://minifia.dhplay.workers.dev";

/** v2.0 공개 주소(workers.dev 규칙으로 파생). */
export function expectedOrigin() {
  return `https://${WORKER_NAME}.${WORKERS_SUBDOMAIN}.workers.dev`;
}

/**
 * 주소가 v1.0 이면 던지고, 아니면 URL 의 origin 을 돌려준다. 호스트는 대소문자를 가리지 않고,
 * 경로·끝 슬래시·scheme(http/https)과 무관하게 v1.0 호스트면 거부한다. 주소가 아니면 URL 파싱 오류를 던진다.
 * @param {string} urlOrOrigin
 * @returns {string}
 */
export function assertNotV1(urlOrOrigin) {
  const u = new URL(String(urlOrOrigin).trim());
  if (u.hostname.toLowerCase() === V1_HOST) {
    throw new Error(`v1.0 주소(${V1_HOST})는 v2 스크립트가 검사·배포하지 않는다(결정 0043)`);
  }
  return u.origin;
}

/** CLI 용: v1.0 이면 한국어 한 줄을 찍고 종료 상태 1 로 끝낸다(네트워크 요청 전에 부른다). */
export function exitIfV1(urlOrOrigin) {
  try {
    assertNotV1(urlOrOrigin);
  } catch (err) {
    console.error(`중단 — ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

/**
 * JSONC 의 `//` 줄 주석과 블록 주석을 지운다. 문자열 리터럴(따옴표·이스케이프 포함) 안의 `//` 는 남긴다.
 * @param {string} text
 * @returns {string}
 */
export function stripJsonComments(text) {
  let out = "";
  let i = 0;
  let inString = false;
  while (i < text.length) {
    const c = text[i];
    const next = text[i + 1];
    if (inString) {
      out += c;
      if (c === "\\" && i + 1 < text.length) {
        out += next;
        i += 2;
        continue;
      }
      if (c === '"') inString = false;
      i += 1;
    } else if (c === '"') {
      inString = true;
      out += c;
      i += 1;
    } else if (c === "/" && next === "/") {
      while (i < text.length && text[i] !== "\n") i += 1;
    } else if (c === "/" && next === "*") {
      i += 2;
      while (i < text.length && !(text[i] === "*" && text[i + 1] === "/")) i += 1;
      i += 2;
    } else {
      out += c;
      i += 1;
    }
  }
  return out;
}

/**
 * 배포 직전 대상 일치 여부를 판정한다. 네 조건을 각각 문제 문장으로 모은다.
 * @param {{ builtName: unknown, sourceName: unknown, prodUrl: string, previewUrls: unknown }} input
 * @returns {{ ok: boolean, problems: string[] }}
 */
export function judgeDeployTarget({ builtName, sourceName, prodUrl, previewUrls }) {
  const problems = [];
  if (builtName !== WORKER_NAME) {
    problems.push(
      `빌드 산출물 dist/worker/wrangler.json 의 name 이 ${JSON.stringify(WORKER_NAME)} 가 아님: ${JSON.stringify(builtName)} (낡은 산출물이면 vite build 를 다시 실행)`,
    );
  }
  if (sourceName !== WORKER_NAME) {
    problems.push(`wrangler.jsonc 의 name 이 ${JSON.stringify(WORKER_NAME)} 가 아님: ${JSON.stringify(sourceName)}`);
  }
  let prodHost = "";
  try {
    prodHost = new URL(String(prodUrl).trim()).host.toLowerCase();
  } catch {
    prodHost = String(prodUrl).trim();
  }
  const expectedHost = new URL(expectedOrigin()).host;
  if (prodHost !== expectedHost) {
    problems.push(`scripts/prod-url.txt 의 호스트가 ${expectedHost} 가 아님: ${prodHost || "(비어 있음)"}`);
  }
  if (previewUrls !== false) {
    problems.push(`wrangler.jsonc 의 preview_urls 가 false 가 아님: ${JSON.stringify(previewUrls)} (결정 0042)`);
  }
  return { ok: problems.length === 0, problems };
}

// 화면 E2E 순수 도우미(결정 0025). playwright-core·네트워크·파일을 쓰지 않는다 — 단위 테스트: node --test scripts/e2e/lib.test.mjs
// 사각형은 { left, top, width, height } 이고 right·bottom 이 없으면 계산한다(DOMRect 를 옮긴 값).
import { assertNotV1 } from "../deploy-target.mjs";

export const DEFAULT_SIZES = [
  { w: 360, h: 640, label: "360x640" },
  { w: 390, h: 664, label: "390x664" },
  { w: 430, h: 932, label: "430x932" },
  // 단 높이 probe(05-UI-SPEC 11.3c, P5-3): 방 높이 575 미만의 짧은 폰. 세 폭 기준은 그대로.
  { w: 360, h: 560, label: "360x560" },
];
/**
 * 로비·world 흐름의 폰 크기 6종(06-17): DEFAULT_SIZES 4개 + 390×844 + 402×874. src/world/camera.ts 의 STAGE_SIZES 와 같다 —
 * test/unit/e2eContract.test.ts 가 w·h·label 이 같음을 고정한다. v1.0 게임 흐름의 크기 목록(DEFAULT_SIZES)은 그대로다.
 */
export const LOBBY_SIZES = [...DEFAULT_SIZES, { w: 390, h: 844, label: "390x844" }, { w: 402, h: 874, label: "402x874" }];
/** LOBBY_SIZES 중 DEFAULT_SIZES 에 없는 크기: lobby·world 흐름이 `--sizes` 없이 돌 때 기본 크기에 더해 도는 두 크기(run.mjs 의 extraSizes). */
export const LOBBY_EXTRA_SIZES = LOBBY_SIZES.filter((s) => !DEFAULT_SIZES.some((d) => d.label === s.label));
/** 겹침 허용 오차(px). 변이 맞닿거나 0.5px 이하로 겹친 것은 겹침이 아니다. 알려진 결함 D4 의 기준이므로 낮추지 않는다. */
export const OVERLAP_EPS = 0.5;
/** 탭 대상 하한(px). */
export const TAP_MIN = 44;
/** index.html 이 불러오는 Gowun Dodum 글꼴 호스트 — 대상 주소 밖에서 요청을 허용하는 유일한 두 곳. */
export const FONT_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"];
export const LOCAL_HOSTS = ["localhost", "127.0.0.1", "[::1]"];
export const MAX_PARALLEL = 3;
// 흐름이 늘었다(vote5 등, 04-32) — 기준 수치가 아니라 중단 한도다.
// 15-09: 새 흐름 errand·witness·trace 가 폰 6종으로 돈다. 흐름마다 실제 40초 심부름(witness·errand)과 최대 15초 아침(trace)을 기다린다 —
// 한 판 약 90초(errand)·100초(witness)·170초(trace, 밤 둘·아침 둘) × 6 크기 = 약 2160초를 MAX_PARALLEL 3 으로 나눈 720초를 기존 900초에 더해 1620초로 올렸다.
// 17-09: 새 흐름 tutorial-solo(폰 6종, 한 크기 약 34초)·tutorial-together(12초)가 더한다 — 6 × 34 + 12 = 218초를 MAX_PARALLEL 3 으로 나눈 약 73초를 60초 단위로 올려 120초,
// `--only tutorial` 로컬 실측 81초(걸린 시간)와 맞다. 1620초에서 1740초로 올렸다.
export const OVERALL_LIMIT_MS = 1_740_000;

// ---- 결과 화면(ended) 판정은 11-05 에 scripts/e2e/result.mjs 로 옮겼다(resultStageChecks) — 옛 카드 격자 계약(04-29 P8)은 지웠다. ----

// ---- 5페이즈 계약 (05-05) — UX1·UX2·UX2-J·UX2-PC·WL1·WL2 가 받는 값의 모양 ----
// 05-06·05-07 의 browser.mjs 가 아래 모양 그대로 읽어 온다. 검사 함수는 필드가 없거나 숫자가 아니면 조용히 통과하지 않고 `측정값 없음(…)` 으로 실패한다.
// 높이·좌표 단위는 CSS px, 사각형 값은 getBoundingClientRect 그대로.
//
//   UX1  guideChecks(g, { phase })
//     g = { count, items: [{ text, inBand, height, lineHeight }], timers }   (14페이즈: 헤더 안내줄 → 자막 띠로 옮김)
//       count      `[data-guide]` 요소 수(한 화면에 정확히 하나)
//       items[i]   text = 글자(textContent), inBand = 자막 띠(`[data-host-band]`) 안인가, height·lineHeight = 그 요소의 높이와 계산된 줄 높이
//       timers     `[role="timer"]` 요소 수. `TIMELESS_PHASES` 밖 단계에서는 1 이상이어야 한다
//   UX2  docHeightChecks(m, { h })       m = { docH }   — document.documentElement.scrollHeight, h = 화면 높이
//   UX2-J joinFitChecks(j, { h, expectSeated })
//     j = { seated, docH, buttonBottom }  — 링크 참가 화면에 앉은 사람 수·문서 높이·`참가하기` 버튼의 아래끝(y).
//     화면 높이 JOIN_FIT_MIN_H(640) 미만에서는 흐름이 이 검사를 부르지 않는다(P5-4 범위가 360×640·390×664 이상이다).
//   UX2-PC pcCenterChecks(p, { w })
//     p = { rootLeft, rootWidth, where }  — `#root` 의 left·width, where = 재는 자리 이름(`홈`·`대기실`·`낮`), w = 화면 폭(PC 1280)
//   WL1  wakeLockChecks(w, { mode: "unsupported" })   w = { hasApi, reachedPhase, consoleErrors: string[] }
//       hasApi = 모의로 `navigator.wakeLock` 을 지운 뒤에도 남아 있는가(false 여야 함), reachedPhase = 대기실 이후 단계까지 정상 진행했는가
//   WL2  wakeLockChecks(w, { mode: "spy" })           w = { requestsAtLobby, requestsAfterVisible }
//       스파이가 센 `navigator.wakeLock.request` 호출 수 — 대기실에서의 누계, 숨김 → 보임 복귀 뒤의 누계(정확히 1 늘어야 함)

/** 시간(타이머) 없이 머무는 단계. src/game/scenes.ts 의 같은 이름 상수와 같은 목록이다 — test/unit/e2eContract.test.ts 가 같음을 확인한다. */
export const TIMELESS_PHASES = ["lobby", "assigning", "ended"];
/** 링크 참가 한 화면 판정(UX2-J)은 화면 높이가 이 값 이상일 때만 한다(P5-4: 360×640·390×664, 430 폭은 이미 맞음). */
export const JOIN_FIT_MIN_H = 640;

/** G2 가 보지 않는 장식 요소. 항목을 더할 때는 selector 와 reason 을 함께 적는다(결과 출력 머리에 목록이 찍힌다). */
export const DECORATIVE_ALLOW = [
  { selector: '[aria-hidden="true"], [aria-hidden="true"] *', reason: "보조 기술에서 숨긴 장식" },
  { selector: ".mf-sr-only, .mf-sr-only *", reason: "화면에 보이지 않는 읽기 전용 안내" },
];
/** G3 이 보지 않는 누르는 요소. 비어 있다 — 항목을 더할 때는 selector 와 reason 을 함께 적는다. */
export const TAP_ALLOW = [];
/**
 * G7 이 보지 않는 작은 글자(14px 미만). `.mf-journal__new` 하나로 시작했고, 08-25 에서 득표 배지 단위 `.mv-badge__unit` 을 더했다(디자인 시스템 승인값).
 * 더할 수 있는 것은 테스트 도구 선택자(`.mf-tt*`, 제품 UI 아님)와 이 두 승인 항목뿐이다 — 단위 테스트가 그 밖 선택자를 거부한다(D-18).
 */
export const TEXT_SIZE_ALLOW = [
  { selector: ".mf-journal__new", reason: "NEW 알약 12px — 03 에서 허용된 캡션(UI-SPEC 타이포)" },
  { selector: ".mv-badge__unit", reason: "득표 배지 단위 '표' 12px — v2.0 디자인 시스템 승인값(tokens.json·README, tokensV2.test 고정)" },
  // 테스트 도구 선택자(.mf-tt*)는 제품 UI 가 아니라 허용할 수 있다. 테스트 방 방장 전용 [테스트] 시트의 12px 보조 줄(testtools.css) 한 곳만.
  { selector: ".mf-tt-sheet__list small", reason: "[테스트] 시트의 12px 보조 줄(지금 단계·인원 유지) — 테스트 방 전용 도구, 제품 UI 아님" },
];

export class UsageError extends Error {
  constructor(message) {
    super(message);
    this.name = "UsageError";
  }
}

export const USAGE =
  "사용법: node scripts/e2e/run.mjs [--url https://minifia-v3.dhplay.workers.dev | http://localhost:5173] [--only <흐름 이름 부분 문자열, 쉼표로 여러 개>] [--shots] [--sizes 360x640,390x664,430x932,360x560]  (--sizes 를 주지 않으면 lobby·world 흐름은 390x844,402x874 도 더해 6개 크기로 돈다)";

export function parseArgs(argv) {
  const out = { url: null, only: null, shots: false, sizes: DEFAULT_SIZES.map((s) => ({ ...s })), sizesGiven: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--shots") out.shots = true;
    else if (a === "--url" || a === "--only" || a === "--sizes") {
      const v = argv[++i];
      if (v === undefined || v === "" || v.startsWith("--")) throw new UsageError(`${a} 값이 없음`);
      if (a === "--url") out.url = v;
      else if (a === "--only") out.only = v;
      else {
        out.sizesGiven = true;
        out.sizes = v.split(",").map((part) => {
          const m = /^(\d{2,4})x(\d{2,4})$/.exec(part.trim());
          if (!m) throw new UsageError(`--sizes 값이 올바르지 않음: ${part}`);
          return { w: Number(m[1]), h: Number(m[2]), label: `${m[1]}x${m[2]}` };
        });
      }
    } else throw new UsageError(`알 수 없는 인자: ${a}`);
  }
  return out;
}

/** 대상 출처 하나를 정한다. 인자가 없으면 prod-url.txt 값. http 는 로컬만, https 는 prod 이거나 --url 로 명시했을 때만. */
export function resolveTarget(urlArg, prodUrlText) {
  const raw = (urlArg ?? String(prodUrlText ?? "")).trim();
  let u;
  try {
    u = new URL(raw);
  } catch {
    throw new Error(`대상 주소가 올바르지 않음: ${raw === "" ? "(비어 있음)" : raw}`);
  }
  if (u.username !== "" || u.password !== "") throw new Error("대상 주소에 사용자 정보를 넣을 수 없음");
  assertNotV1(u.origin); // 기본값·명시값 모두 v1.0 이면 거부(DEPLOY-02, 우회 인자 없음)
  if (u.protocol === "http:") {
    if (!LOCAL_HOSTS.includes(u.hostname)) throw new Error(`http 는 localhost·127.0.0.1·[::1] 만 허용: ${u.hostname}`);
  } else if (u.protocol !== "https:") {
    throw new Error(`허용하지 않는 scheme: ${u.protocol}`);
  }
  return { origin: u.origin, host: u.host, explicit: urlArg !== null };
}

export function chromeCandidates(platform, env) {
  if (platform === "darwin") {
    const list = ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"];
    if (env.HOME) list.push(`${env.HOME}/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`);
    return list;
  }
  if (platform === "win32") {
    const tail = "\\Google\\Chrome\\Application\\chrome.exe";
    const list = [];
    for (const key of ["PROGRAMFILES", "PROGRAMFILES(X86)", "LOCALAPPDATA"]) if (env[key]) list.push(`${env[key]}${tail}`);
    return list;
  }
  return ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser"];
}

/** CHROME_PATH 가 있으면 그것만 본다(없는데 기본 경로로 넘어가지 않는다). 못 찾으면 안내가 담긴 오류. */
export function findChrome(platform, env, exists) {
  if (env.CHROME_PATH) {
    if (exists(env.CHROME_PATH)) return env.CHROME_PATH;
    throw new Error(`CHROME_PATH 의 파일이 없음: ${env.CHROME_PATH} — CHROME_PATH 를 설치된 Chrome 실행 파일 경로로 고치거나 지우세요`);
  }
  const tried = chromeCandidates(platform, env);
  for (const p of tried) if (exists(p)) return p;
  throw new Error(
    `Chrome 을 찾지 못함. 찾아본 경로:\n${tried.map((p) => `  - ${p}`).join("\n") || "  (없음)"}\n` +
      "CHROME_PATH 환경 변수에 Chrome 실행 파일 경로를 주세요. 예: CHROME_PATH=\"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome\" npm run e2e",
  );
}

const right = (r) => r.right ?? r.left + r.width;
const bottom = (r) => r.bottom ?? r.top + r.height;

/** 두 사각형이 OVERLAP_EPS 보다 크게 겹치는가(변만 맞닿으면 false). */
export function rectsOverlap(a, b) {
  const w = Math.min(right(a), right(b)) - Math.max(a.left, b.left);
  const h = Math.min(bottom(a), bottom(b)) - Math.max(a.top, b.top);
  return w > OVERLAP_EPS && h > OVERLAP_EPS;
}

/** inner 가 outer 안에 있는가(오차 OVERLAP_EPS 허용). */
export function rectInside(inner, outer) {
  return (
    inner.left >= outer.left - OVERLAP_EPS &&
    inner.top >= outer.top - OVERLAP_EPS &&
    right(inner) <= right(outer) + OVERLAP_EPS &&
    bottom(inner) <= bottom(outer) + OVERLAP_EPS
  );
}

const fmt = (n) => Math.round(n * 10) / 10;
const list = (items, max = 4) => (items.length <= max ? items : [...items.slice(0, max), `…외 ${items.length - max}개`]).join("; ");

/** 모든 검사 상태에 도는 공통 검사 G1~G7. 항상 일곱 개를 같은 순서로 돌려준다. */
export function genericIssues(snap, { w }) {
  const g1Bad = [];
  if (snap.docW > w) g1Bad.push(`documentElement ${fmt(snap.docW)} > ${w}`);
  if (snap.bodyW > w) g1Bad.push(`body ${fmt(snap.bodyW)} > ${w}`);
  // G2: 화면 가로 밖으로 나간 요소. 이름 길이에 따른 완화는 없다(결정 0056 완화는 08-23 에 지웠다, 결정 0060-14).
  const g2Bad = snap.elements
    .filter((e) => e.rect.left < -0.5 || right(e.rect) > w + 0.5)
    .map((e) => `${e.desc} (${fmt(e.rect.left)}~${fmt(right(e.rect))})`);
  const g3Bad = snap.interactive
    .filter((e) => e.rect.width + 0.5 < TAP_MIN || e.rect.height + 0.5 < TAP_MIN)
    .map((e) => `${e.desc} ${fmt(e.rect.width)}x${fmt(e.rect.height)}`);
  const issues = snap.issues ?? { console: [], failed: [], offOrigin: [] };
  const mk = (id, bad, name) => ({ id, ok: bad.length === 0, detail: bad.length === 0 ? "" : `${name}: ${list(bad)}` });
  return [
    mk("G1", g1Bad, "가로 스크롤"),
    mk("G2", g2Bad, "화면 밖"),
    mk("G3", g3Bad, "탭 대상 44px 미만"),
    mk("G4", issues.console, "콘솔 오류"),
    mk("G5", issues.failed, "실패한 요청"),
    mk("G6", issues.offOrigin, "외부 요청"),
    smallTextIssues(snap.smallText),
  ];
}

/** text 안의 모든 비밀 값을 [가림] 으로 바꾼다. */
export function redact(text, secrets) {
  let out = String(text);
  for (const s of secrets) if (s) out = out.split(s).join("[가림]");
  return out;
}

export const TABLE_HEAD = "시나리오 | 크기 | 항목 | 결과 | 내용";
const line = (r) => `${r.scenario} | ${r.size} | ${r.id} ${r.label} | ${r.ok ? "통과" : "실패"} | ${r.detail ?? ""}`;

/** 결과 { scenario: "흐름/상태", size, id, label, ok, detail } 목록으로 전체 표·요약 표·실패 표 글자를 만든다. */
export function formatTables(results) {
  const table = [TABLE_HEAD, ...results.map(line)].join("\n");
  const failures = [TABLE_HEAD, ...results.filter((r) => !r.ok).map(line)].join("\n");
  const groups = new Map();
  for (const r of results) {
    const key = `${r.scenario.split("/")[0]} | ${r.size}`;
    const g = groups.get(key) ?? { pass: 0, total: 0 };
    g.total += 1;
    if (r.ok) g.pass += 1;
    groups.set(key, g);
  }
  const summary = ["흐름 | 크기 | 통과/전체", ...[...groups].map(([key, g]) => `${key} | ${g.pass}/${g.total}`)].join("\n");
  return { table, summary, failures };
}

/** 0 = 모두 통과, 1 = 실패 있음, 2 = 중단(통과 여부와 무관). */
export function exitCodeOf(results, aborted) {
  if (aborted) return 2;
  return results.some((r) => !r.ok) ? 1 : 0;
}

// ---- 공통 판정 도우미 ----
// 테이블 판정은 08-23 에 지웠다(결정 0060-14). 맵 게임 화면 판정은 "게임 맵 판정" 구간에 있다.

/** 제목 한 줄 판정 배율(줄 높이의 1.6배까지). 낮추지 않는다(D1). */
export const ONE_LINE_FACTOR = 1.6;

// ---- 채팅 패널 치수 사본(07-20). src/game/chatUi.ts 의 값을 그대로 옮긴 것이다 — test/unit/e2eContract.test.ts 가 같은 값인지 확인한다(05-05 사본 일치 규약).
//      값을 바꾸려면 UI-SPEC 과 chatUi.ts 를 먼저 바꾼다. ----
/** 기록 칸 고정 높이: 방 높이 < 780 */
export const LOG_H_SHORT = 96;
/** 기록 칸 고정 높이: 방 높이 ≥ 780 */
export const LOG_H_TALL = 152;
/** 키보드가 열렸을 때 기록 칸 높이 */
export const LOG_H_KB = 72;
/** 이 높이 이상인 방은 긴 기록 칸을 쓴다 */
export const TALL_ROOM_MIN_H = 780;
/** 로비 패널 = LOG_H + 154 */
export const LOBBY_PANEL_EXTRA = 154;
/** 방장 대기실 패널 증분 = 스위치 줄 64 + 간격 12(chatUi.LOBBY_HOST_TUTORIAL_EXTRA 사본, 0080-4). 방장 패널은 250/306 → 326/382 */
export const LOBBY_HOST_TUTORIAL_EXTRA = 76;
/** 채팅 패널(게임 맵의 지목·변론 단계의 입력줄 패널) = LOG_H + 92 */
export const CHAT_PANEL_EXTRA = 92;
/** 키보드 열림 패널 = 14 + 72 + 8 + 48 + 8 */
export const KB_PANEL_H = 150;
/** 머리 위 입력 중 알약이 스택을 늘리는 높이 */
export const TYPING_PILL_H = 22;

/** 기록 칸 고정 높이 — 방 높이로 정한다(chatUi.logHeightFor 사본). */
export function logHeightFor(roomH) {
  return roomH >= TALL_ROOM_MIN_H ? LOG_H_TALL : LOG_H_SHORT;
}

/** 로비 채팅 패널 높이(chatUi.lobbyPanelHeight 사본). 안전 영역 제외. */
export function lobbyPanelHeight(logH, host = false) {
  return logH + LOBBY_PANEL_EXTRA + (host ? LOBBY_HOST_TUTORIAL_EXTRA : 0);
}

// ---- 게임 맵 판정 (08-23, 08-UI-SPEC "아래 패널 종류와 높이"·"검사 가능하게 둘 것"). 순수 함수 — 브라우저에서 읽는 값은 08-24 의 readGame 이 만든다. ----
// 모든 판정은 다른 판정과 같은 { id, label, ok, detail } 줄(들)을 돌려준다. 값이 없거나 숫자가 아니면 조용히 통과하지 않고 `측정값 없음(…)` 으로 실패한다.

/** 게임 맵 아래 패널 높이 덧셈(안전 영역 제외): 토론 = LOG_H + 154, 채팅 = + 92, 찬반 투표자 = + 218, 찬반 보기 = + 126(0062-2: 점 9px 대신 숫자 한 줄 24px 이라 +15). 밤은 네 역할 모두 얼굴 목록 하나라 여기 없다(15-08, faceListPanelH). */
export const GAME_PANEL_EXTRA = Object.freeze({ talk: 154, chat: CHAT_PANEL_EXTRA, verdictVoter: 218, verdictViewer: 126 });

/**
 * 밤 얼굴 목록 패널 높이(09-UI-SPEC 160행 식, 안전 영역 제외). w = 폰 폭, n = 후보 수(밤 동안 변하지 않는다), wrappedRows = 이름이 줄바꿈된 행 수.
 * 한 칸 fw = (w − 32 − 24) / 4, 한 행 = fw + 26.2, 행 수 = ceil(n / 4), 행 사이 8. 패널 = 14 + 행들 + 10 + 52 + 22 + 줄바꿈 행마다 18.
 * 표의 값은 이 식의 반올림이고 E2E 는 패널 높이를 DOM 에서 재 이 식과 ±2px 로 비교한다(가정 A1).
 */
export function faceListPanelH({ w, n, wrappedRows = 0 }) {
  const rows = Math.max(1, Math.ceil(n / 4));
  const fw = (w - 56) / 4;
  return 14 + rows * (fw + 26.2) + (rows - 1) * 8 + 10 + 52 + 22 + wrappedRows * 18;
}

/**
 * 게임 맵 아래 패널의 기대 높이(기록 칸 + 여분 — 입력줄 단추가 48 원이라 보정 없음, 16-05). kind 는 GAME_PANEL_EXTRA 의 키 또는 "faceList"(opts = { w, n, wrappedRows? }), roomH = 방(뷰포트) 높이.
 * 알 수 없는 kind 는 던진다.
 */
export function gamePanelHeight(roomH, kind, opts) {
  if (kind === "faceList") {
    if (!opts || !isNum(opts.w) || !isNum(opts.n)) throw new Error("faceList 패널 높이는 opts.w·n 이 필요하다");
    return faceListPanelH(opts);
  }
  const extra = Object.hasOwn(GAME_PANEL_EXTRA, kind) ? GAME_PANEL_EXTRA[kind] : undefined;
  if (extra === undefined) throw new Error(`알 수 없는 패널 종류: ${kind}`);
  return logHeightFor(roomH) + extra;
}

// ---- 9페이즈 표식·판정 (09-21, 09-UI-SPEC "검사 가능하게 둘 것" 450~455행). 8페이즈 표식(data-game-stage·data-announce·data-pick 등)은 그대로라 여기 없다. ----

/** 9페이즈가 새로 더한 DOM 표식 11개. test/unit/e2eContract.test.ts 가 각각이 src/ 에 실제로 있는지 확인한다(이름 오타 방지). */
export const NIGHT_MARKERS = Object.freeze([
  "data-night-dark", // 시민 편 어둠(게임 맵 루트, 세 역할 같은 값)
  "data-tension-pulse", // 맥박 비네트
  "data-face-list", // 경찰·의사 얼굴 목록
  "data-face", // 얼굴 칸 data-face="{seat}"
  "data-will-button", // 깃펜
  "data-will-sheet", // 유언 시트 will|note
  "data-note-button", // [쪽지]
  "data-card", // 채팅 카드 will|note
  "data-chalk", // 분필 "x,z"
  "data-curtain", // 장면 전환 막(진한 동안만)
  "data-kill-fx", // 암살 번쩍임
]);

/** 사각형 값 하나라도 숫자가 아니면 측정 불가 — 조용히 통과시키지 않고 거짓으로 돌려준다. */
const allNum = (...xs) => xs.every(isNum);

/**
 * 이름표 사각형이 스테이지 사각형 안에 완전히 들어오는가("밤마다 내 이름표가 스테이지 안", 450~455행).
 * tag = { x, y, w, h }(왼쪽 위 + 크기), stage = { top, bottom, left, right }. 부동소수 오차 0.01px 만 봐주고 1px 라도 밖이면 false. 측정값이 없으면 false.
 */
export function tagInStage({ tag, stage } = {}) {
  if (!tag || !stage || !allNum(tag.x, tag.y, tag.w, tag.h, stage.top, stage.bottom, stage.left, stage.right)) return false;
  const e = 0.01;
  return tag.x >= stage.left - e && tag.y >= stage.top - e && tag.x + tag.w <= stage.right + e && tag.y + tag.h <= stage.bottom + e;
}

/**
 * 얼굴 칸의 이름이 칸 밖으로 넘치지 않는가(8자 이름, 450~455행). cell·name = DOMRect 모양 { left, top, right, bottom }. 측정값이 없으면 false.
 */
export function faceNameFits({ cell, name } = {}) {
  if (!cell || !name || !allNum(cell.left, cell.top, cell.right, cell.bottom, name.left, name.top, name.right, name.bottom)) return false;
  const e = 0.01;
  return name.left >= cell.left - e && name.top >= cell.top - e && name.right <= cell.right + e && name.bottom <= cell.bottom + e;
}

/** 지목 이름표 버튼의 개수 상한(산 사람 8명 중 나를 뺀 7명이 최대지만 UI-SPEC 은 버튼 8개까지 본다). */
export const PICK_BUTTON_MAX = 8;

/**
 * 지목 이름표 버튼 판정(PK1~PK3). buttons = [{ seat, rect }] — `[data-pick]` 버튼의 사각형.
 * PK1 개수 1~8 · PK2 각각 44×44 이상(G3 와 같은 0.5px 오차) · PK3 서로 가려지지 않음(겹침 > OVERLAP_EPS 가 없다).
 */
export function pickButtonChecks(buttons) {
  const label1 = "지목 버튼이 1~8개";
  const label2 = "지목 버튼이 각각 44×44 이상";
  const label3 = "지목 버튼끼리 가려지지 않음";
  if (!Array.isArray(buttons)) return [noMeasure("PK1", label1, "buttons"), noMeasure("PK2", label2, "buttons"), noMeasure("PK3", label3, "buttons")];
  const valid = buttons.filter((b) => b?.rect && [b.rect.width, b.rect.height, b.rect.left, b.rect.top].every(isNum));
  const lines = [result("PK1", label1, buttons.length >= 1 && buttons.length <= PICK_BUTTON_MAX && valid.length === buttons.length ? [] : [`${buttons.length}개(측정 가능 ${valid.length}개)`])];
  const small = valid.filter((b) => b.rect.width + 0.5 < TAP_MIN || b.rect.height + 0.5 < TAP_MIN).map((b) => `자리 ${b.seat} ${fmt(b.rect.width)}x${fmt(b.rect.height)}`);
  lines.push(result("PK2", label2, small));
  const clashes = [];
  for (let i = 0; i < valid.length; i++) {
    for (let j = i + 1; j < valid.length; j++) {
      if (rectsOverlap(valid[i].rect, valid[j].rect)) clashes.push(`${valid[i].seat}-${valid[j].seat} (${overlapText(valid[i].rect, valid[j].rect)})`);
    }
  }
  lines.push(result("PK3", label3, clashes));
  return lines;
}

// ---- 직업 배지·귓속말 (09.1.1-08·09, 결정 0066, UI-SPEC A·B 와 폰 크기별 공통 배치) ----
// 앱 상수 사본. test/unit/e2eContract.test.ts 가 CSS 원문(tokens.css·game.css·v2.css)과 같은 값인지 본다.
/** 떠 있는 버튼 지름(--control-input) */
export const FLOAT_SIZE = 48;
/**
 * 14-07 에서 떠 있는 버튼은 면(48) 아래 한 단어 라벨이 붙어 상자가 71.6 으로 길어졌으나, 16-04 가 이름표를 없애고 16-06 이 상자를 곧 면(48 원)으로 합쳤다.
 * 라벨 몫은 0 이다. 높이를 보는 판정(FB4)은 이 상자 높이를 받는다(boxH).
 */
export const FLOAT_LABEL_EXTRA = 0;
export const FLOAT_BOX_H = FLOAT_SIZE + FLOAT_LABEL_EXTRA;
/** 오른쪽 열(SideColumn) 단추 지름(--control-button, 16-06) · 칸 사이 간격 */
export const SIDE_BUTTON_SIZE = 52;
export const SIDE_GAP = 12;
/** 떠 있는 묶음의 오른쪽 여백(--space-md) */
export const FLOAT_MARGIN = 16;
/** 떠 있는 버튼 사이와 패널 윗변 위 간격(--space-sm) */
export const FLOAT_GAP = 8;
/** 귓속말 한 줄 시트 높이: 12 + 44 + 8 + 48 + 12 (테두리 1px 두 줄은 허용 오차 ±2 안) */
export const WHISPER_SHEET_H = 124;
/** 귓속말 시트 위 공개 예고 한 줄(11-07, A-4): 14px × 줄간격 1.4 = 19.6 에 시트 안 간격 8 (notice: true 일 때 기대 높이에 더한다) */
export const WHISPER_NOTICE_H = 27.6;
/** 이름표 모서리 배지 지름 */
export const CLAIM_BADGE_SIZE = 20;
/** 배지 안 직업 아이콘 크기 */
export const CLAIM_ICON_SIZE = 14;
/** 말 바꿈 점 지름 */
export const CLAIM_SWAP_SIZE = 16;
/** 배지가 이름표 오른쪽 위 모서리에서 바깥으로 나가는 거리(오른쪽 −4)·위로 올라가는 거리(위 −8) */
export const CLAIM_OUT_X = 4;
export const CLAIM_OUT_Y = -8;

/**
 * 떠 있는 버튼 판정(FB1~FB5). buttons = [{ kind, rect }], panel = { top }, viewport = { w, h }, kbOpen = 가상 키보드가 열려 있나, expectCount = 기대 개수(기본 2: 배지 + 귓속말).
 * FB1 개수가 기대와 같고 모두 화면 안 · FB2 버튼끼리 겹치지 않음 · FB3 키보드가 닫혀 있으면 아랫변 ≤ 패널 윗변 − 8 + 0.5 · FB4 지름 48±1(≥ 44) · FB5 오른쪽 여백 16±1.
 */
export function floatButtonChecks({ buttons, panel, viewport, kbOpen = false, expectCount = 2, boxH = FLOAT_SIZE } = {}) {
  const L1 = `떠 있는 버튼이 ${expectCount}개이고 모두 화면 안`;
  const L2 = "떠 있는 버튼끼리 겹치지 않음";
  const L3 = "떠 있는 버튼이 패널 윗변 위 8 이내(키보드 닫힘)";
  const L4 = `떠 있는 버튼 폭 ${FLOAT_SIZE}±1 · 높이 ${fmt(boxH)}±1`;
  const L5 = `떠 있는 버튼 오른쪽 여백 ${FLOAT_MARGIN}±1`;
  const valid = Array.isArray(buttons) && buttons.every((b) => b?.rect && allNum(b.rect.left, b.rect.top, b.rect.width, b.rect.height));
  if (!valid || !viewport || !allNum(viewport.w, viewport.h)) return [noMeasure("FB1", L1, "buttons·viewport"), noMeasure("FB2", L2, "buttons"), noMeasure("FB3", L3, "buttons"), noMeasure("FB4", L4, "buttons"), noMeasure("FB5", L5, "buttons")];
  const screen = { left: 0, top: 0, right: viewport.w, bottom: viewport.h };
  const out = [];
  const bad1 = buttons.length === expectCount ? [] : [`${buttons.length}개`];
  for (const b of buttons) if (!rectInside(b.rect, screen)) bad1.push(`${b.kind} ${fmt(b.rect.left)},${fmt(b.rect.top)} ${fmt(b.rect.width)}x${fmt(b.rect.height)}`);
  out.push(result("FB1", L1, bad1));
  const clashes = [];
  for (let i = 0; i < buttons.length; i++) {
    for (let j = i + 1; j < buttons.length; j++) {
      if (rectsOverlap(buttons[i].rect, buttons[j].rect)) clashes.push(`${buttons[i].kind}-${buttons[j].kind} (${overlapText(buttons[i].rect, buttons[j].rect)})`);
    }
  }
  out.push(result("FB2", L2, clashes));
  if (kbOpen) out.push(result("FB3", L3, []));
  else if (!panel || !isNum(panel.top)) out.push(noMeasure("FB3", L3, "panel.top"));
  else out.push(result("FB3", L3, buttons.filter((b) => bottom(b.rect) > panel.top - FLOAT_GAP + OVERLAP_EPS).map((b) => `${b.kind} 아래 ${fmt(bottom(b.rect))} > ${fmt(panel.top - FLOAT_GAP)}`)));
  out.push(result("FB4", L4, buttons.filter((b) => Math.abs(b.rect.width - FLOAT_SIZE) > 1 || Math.abs(b.rect.height - boxH) > 1 || b.rect.width + OVERLAP_EPS < TAP_MIN || b.rect.height + OVERLAP_EPS < TAP_MIN).map((b) => `${b.kind} ${fmt(b.rect.width)}x${fmt(b.rect.height)}`)));
  out.push(result("FB5", L5, buttons.filter((b) => Math.abs(viewport.w - right(b.rect) - FLOAT_MARGIN) > 1).map((b) => `${b.kind} 여백 ${fmt(viewport.w - right(b.rect))}`)));
  return out;
}

/** 시트 글자 하한(UI-SPEC: 14px 미만 없음). 낮추지 않는다 */
export const SHEET_FONT_MIN = 14;

/**
 * 시트가 보이는 영역에 맞는지(SF1~SF6). sheet = 시트 사각형, header = { bottom }, viewport = { w, h }(키보드가 열려 있으면 보이는 영역 = visualViewport 크기),
 * panel = { top } 이거나 null(패널이 가려졌거나 키보드가 올라와 시트만 키보드 위에 붙은 경우 — 그때는 viewport 아래가 기준), kind = "whisper" | "badge",
 * targets = 누르기 대상 사각형들(칩·보내기·닫기), fontMin = 시트 안 글자 크기 최소(px), chipRows·hint = badge 높이 계산 재료.
 * SF1 윗변 ≥ 헤더 아랫변 · SF2 화면 안 · SF3 아랫변 ≤ 패널 윗변(없으면 viewport 아래) · SF4 대상 각각 44×44 이상 · SF5 글자 14px 이상 ·
 * SF6 높이: whisper 124±2(notice 이면 공개 예고 한 줄 27.6 을 더함), badge = 12 + 44 + 8 + (칩 줄 × 44 + 줄 사이 8) + (안내 있으면 8 + 20) + 12 에 테두리 2 를 더한 값 −2~+6 안.
 */
export function sheetFitChecks({ sheet, header, viewport, panel, kind, targets, fontMin, chipRows, hint, notice = false } = {}) {
  const L1 = "시트가 헤더 아래에 있음";
  const L2 = "시트가 화면 안";
  const L3 = "시트 아랫변이 패널 윗변(또는 보이는 영역 아래) 이내";
  const L4 = `시트의 누르기 대상이 각각 ${TAP_MIN}×${TAP_MIN} 이상`;
  const L5 = `시트 글자가 ${SHEET_FONT_MIN}px 이상`;
  const L6 = kind === "whisper" ? (notice ? `귓속말 시트 높이 ${WHISPER_SHEET_H}+예고 ${WHISPER_NOTICE_H}±2` : `귓속말 시트 높이 ${WHISPER_SHEET_H}±2`) : "배지 시트 높이(칩 줄 수·안내에 맞음)";
  if (!sheet || !allNum(sheet.left, sheet.top, sheet.width, sheet.height) || !viewport || !allNum(viewport.w, viewport.h)) {
    return [noMeasure("SF1", L1, "sheet"), noMeasure("SF2", L2, "sheet"), noMeasure("SF3", L3, "sheet"), noMeasure("SF4", L4, "sheet"), noMeasure("SF5", L5, "sheet"), noMeasure("SF6", L6, "sheet")];
  }
  const out = [];
  out.push(header && isNum(header.bottom) ? result("SF1", L1, sheet.top + OVERLAP_EPS >= header.bottom ? [] : [`시트 위 ${fmt(sheet.top)} < 헤더 아래 ${fmt(header.bottom)}`]) : noMeasure("SF1", L1, "header.bottom"));
  const bad2 = [];
  if (sheet.left < -OVERLAP_EPS) bad2.push(`왼쪽 ${fmt(sheet.left)}`);
  if (right(sheet) > viewport.w + OVERLAP_EPS) bad2.push(`오른쪽 ${fmt(right(sheet))} > ${viewport.w}`);
  if (sheet.top < -OVERLAP_EPS) bad2.push(`위 ${fmt(sheet.top)}`);
  if (bottom(sheet) > viewport.h + OVERLAP_EPS) bad2.push(`아래 ${fmt(bottom(sheet))} > ${viewport.h}`);
  out.push(result("SF2", L2, bad2));
  const limit = panel && isNum(panel.top) ? panel.top : viewport.h;
  out.push(result("SF3", L3, bottom(sheet) <= limit + OVERLAP_EPS ? [] : [`시트 아래 ${fmt(bottom(sheet))} > ${fmt(limit)}${panel ? " (패널 윗변)" : " (보이는 영역 아래)"}`]));
  if (!Array.isArray(targets) || targets.length === 0 || !targets.every((t) => allNum(t?.width, t?.height))) out.push(noMeasure("SF4", L4, "targets"));
  else out.push(result("SF4", L4, targets.filter((t) => t.width + OVERLAP_EPS < TAP_MIN || t.height + OVERLAP_EPS < TAP_MIN).map((t) => `${fmt(t.width)}x${fmt(t.height)}`)));
  out.push(isNum(fontMin) ? result("SF5", L5, fontMin + 0.01 >= SHEET_FONT_MIN ? [] : [`${fmt(fontMin)}px`]) : noMeasure("SF5", L5, "fontMin"));
  if (kind === "whisper") {
    out.push(result("SF6", L6, Math.abs(sheet.height - WHISPER_SHEET_H - (notice ? WHISPER_NOTICE_H : 0)) <= 2.01 ? [] : [`높이 ${fmt(sheet.height)}`]));
  } else if (kind === "badge") {
    if (![1, 2, 3].includes(chipRows) || typeof hint !== "boolean") out.push(noMeasure("SF6", L6, "chipRows·hint"));
    else {
      const want = 12 + 44 + 8 + chipRows * 44 + (chipRows - 1) * 8 + (hint ? 8 + 20 : 0) + 12;
      const d = sheet.height - want;
      out.push(result("SF6", L6, d >= -2 && d <= 6 ? [] : [`높이 ${fmt(sheet.height)} (칩 ${chipRows}줄${hint ? "·안내" : ""} 기대 ${want}~${want + 2})`]));
    }
  } else out.push(noMeasure("SF6", L6, "kind"));
  return out;
}

/**
 * 이름표 모서리 배지 기하(CB1~CB4, 말 바꿈 점이 있으면 CB5). badge = { rect, icon: { width, height }, swap: rect | null }, tag = 이름표(.mv-tag) 사각형,
 * tagWidthWithout = 배지가 없을 때 같은 이름표의 폭(호출 쪽이 같은 이름표를 배지 전에 재서 준다).
 * CB1 지름 20±1 · CB2 이름표 오른쪽 위 모서리에서 바깥 4·위 −8 (각 ±2) · CB3 이름표 폭이 배지로 늘지 않음(+0.5) · CB4 아이콘 14±1 · CB5 말 바꿈 점 지름 16±1.
 */
export function claimBadgeChecks({ badge, tag, tagWidthWithout } = {}) {
  const L1 = `배지 지름 ${CLAIM_BADGE_SIZE}±1`;
  const L2 = `배지가 이름표 오른쪽 위 모서리에서 바깥 ${CLAIM_OUT_X}·위 ${CLAIM_OUT_Y} (±2)`;
  const L3 = "이름표 폭이 배지로 늘지 않음";
  const L4 = `배지 아이콘 ${CLAIM_ICON_SIZE}±1`;
  const r = badge?.rect;
  if (!r || !allNum(r.left, r.top, r.width, r.height) || !tag || !allNum(tag.left, tag.top, tag.width, tag.height)) {
    return [noMeasure("CB1", L1, "badge"), noMeasure("CB2", L2, "badge·tag"), noMeasure("CB3", L3, "tag"), noMeasure("CB4", L4, "badge.icon")];
  }
  const out = [];
  out.push(result("CB1", L1, Math.abs(r.width - CLAIM_BADGE_SIZE) <= 1 && Math.abs(r.height - CLAIM_BADGE_SIZE) <= 1 ? [] : [`${fmt(r.width)}x${fmt(r.height)}`]));
  const outX = right(r) - right(tag);
  const outY = r.top - tag.top;
  out.push(result("CB2", L2, Math.abs(outX - CLAIM_OUT_X) <= 2 && Math.abs(outY - CLAIM_OUT_Y) <= 2 ? [] : [`바깥 ${fmt(outX)}·위 ${fmt(outY)}`]));
  out.push(isNum(tagWidthWithout) ? result("CB3", L3, tag.width <= tagWidthWithout + OVERLAP_EPS ? [] : [`이름표 폭 ${fmt(tag.width)} > 배지 없을 때 ${fmt(tagWidthWithout)}`]) : noMeasure("CB3", L3, "tagWidthWithout"));
  const ic = badge.icon;
  out.push(ic && allNum(ic.width, ic.height) ? result("CB4", L4, Math.abs(ic.width - CLAIM_ICON_SIZE) <= 1 && Math.abs(ic.height - CLAIM_ICON_SIZE) <= 1 ? [] : [`${fmt(ic.width)}x${fmt(ic.height)}`]) : noMeasure("CB4", L4, "badge.icon"));
  if (badge.swap) {
    const sw = badge.swap;
    const L5 = `말 바꿈 점 지름 ${CLAIM_SWAP_SIZE}±1`;
    out.push(allNum(sw.width, sw.height) ? result("CB5", L5, Math.abs(sw.width - CLAIM_SWAP_SIZE) <= 1 && Math.abs(sw.height - CLAIM_SWAP_SIZE) <= 1 ? [] : [`${fmt(sw.width)}x${fmt(sw.height)}`]) : noMeasure("CB5", L5, "badge.swap"));
  }
  return out;
}

// ---- 순차 지목 (09.1-08, 결정 0063-1, UI-SPEC A-1·A-2) ----
// 앱 상수 사본. 스크립트는 shared 를 import 하지 않는다(e2eContract.test.ts 가 shared/game/phases.ts 와 같은 값인지 본다).
export const NOMINATION_GATHER_MS = 3000;
export const PICK_TURN_MS = 8000;
export const PICK_GAP_MS = 900;
export const NOMINATION_END_MS = 2000;

/** 차례 수 n 인 판의 지목 최악 길이(전원 기권) = 모이기 + n × (차례 + 사이) + 끝 알림. shared/game/phases.ts nominationMaxMs 와 같은 식. */
export function nominationMaxMs(n) {
  return NOMINATION_GATHER_MS + n * (PICK_TURN_MS + PICK_GAP_MS) + NOMINATION_END_MS;
}

/** 기본판 투표(동시) 길이 = shared/game/phases.ts NOMINATION_MS 와 같은 값(13-01, e2eContract.test.ts 가 같은지 본다). */
export const NOMINATION_MS = 15000;

/** 차례 알약 글자 하한(이름 16·초 24·n/N 14). 낮추지 않는다 — NAMETAG_FONT_MIN 과 같은 14. */
export const TURN_FONT_MIN = 14;

/**
 * 차례 알약 판정(NT-A1~NT-A4). turn = readGame().turn — { pill, pillScrollW, pillClientW, docScrollW, docClientW, minFontPx, no, seat }.
 * NT-A1 알약 사각형이 화면 안에 완전히(OVERLAP_EPS 오차) · NT-A2 가로 넘침 없음(알약 안·문서) · NT-A3 글자 14px 이상 · NT-A4 data-turn-no·data-turn-seat 가 숫자.
 * vw·vh = 화면 크기. 값이 없으면 통과시키지 않고 `측정값 없음` 으로 실패한다.
 */
export function turnBlockChecks(turn, vw, vh) {
  const L1 = "차례 알약이 화면 안에 완전히 들어온다";
  const L2 = "차례 알약에 가로 넘침이 없다";
  const L3 = `차례 알약 글자가 ${TURN_FONT_MIN}px 이상`;
  const L4 = "data-turn-no·data-turn-seat 가 숫자";
  if (!turn || typeof turn !== "object") return [noMeasure("NT-A1", L1, "turn"), noMeasure("NT-A2", L2, "turn"), noMeasure("NT-A3", L3, "turn"), noMeasure("NT-A4", L4, "turn")];
  const out = [];
  const r = turn.pill;
  if (!r || !allNum(r.left, r.top, r.right, r.bottom, vw, vh)) out.push(noMeasure("NT-A1", L1, "pill"));
  else {
    const bad = [];
    if (r.left < -OVERLAP_EPS) bad.push(`왼쪽 ${fmt(r.left)}`);
    if (r.right > vw + OVERLAP_EPS) bad.push(`오른쪽 ${fmt(r.right)} > ${vw}`);
    if (r.top < -OVERLAP_EPS) bad.push(`위 ${fmt(r.top)}`);
    if (r.bottom > vh + OVERLAP_EPS) bad.push(`아래 ${fmt(r.bottom)} > ${vh}`);
    out.push(result("NT-A1", L1, bad));
  }
  if (!allNum(turn.pillScrollW, turn.pillClientW, turn.docScrollW, turn.docClientW)) out.push(noMeasure("NT-A2", L2, "scrollWidth"));
  else {
    const bad = [];
    if (turn.pillScrollW > turn.pillClientW + 1) bad.push(`알약 안 ${turn.pillScrollW} > ${turn.pillClientW}`);
    if (turn.docScrollW > turn.docClientW + 1) bad.push(`문서 ${turn.docScrollW} > ${turn.docClientW}`);
    out.push(result("NT-A2", L2, bad));
  }
  out.push(isNum(turn.minFontPx) ? result("NT-A3", L3, turn.minFontPx + 0.01 >= TURN_FONT_MIN ? [] : [`${fmt(turn.minFontPx)}px`]) : noMeasure("NT-A3", L3, "minFontPx"));
  out.push(isNum(turn.no) && isNum(turn.seat) ? result("NT-A4", L4, []) : noMeasure("NT-A4", L4, `no ${turn.no} seat ${turn.seat}`));
  return out;
}

// ---- 기본판 꺼진 장치 부재 검사 (13-05, 결정 0072, UI-SPEC "끄는 장치" 표) ----

/** 꺼진 장치의 DOM 선택자 — 기본판 한 판 전체에서 모두 0건이어야 한다. 이름 접두 OFF_DEVICE_ATTR_PREFIX 속성(`data-turn-*`)도 0건이어야 한다. */
export const OFF_DEVICE_SELECTORS = Object.freeze([
  '[data-float="claim"]',
  '[data-float="whisper"]',
  "[data-claim-sheet]",
  "[data-claim-chip]",
  "[data-claim]",
  "[data-badge-live]",
  "[data-line-sheet]",
  "[data-turn-block]",
  "[data-speak-sheet]",
  "[data-showdown-step]",
]);
/** 순차 지목 표시용 속성 접두 — `data-turn` 과 `data-turn-*` 모두 포함한다. */
export const OFF_DEVICE_ATTR_PREFIX = "data-turn";

/**
 * 받은 프레임 하나에서 꺼진 장치 흔적의 경로 문자열을 모은다(원문·값·토큰은 싣지 않는다, T-13-16).
 * state: players[].badge·badgeSwapped, day.turn·runoff·showdown, me.whisperUsed·ballot, phase runoff·showdown.
 * chat: k whisper·whispered. chatLog: 줄의 k. resultLog: part whisper·claim 이면서 줄이 있을 때(빈 묶음은 아님). 기본판 view 는 빈 배열.
 */
export function offDeviceKeysOf(msg) {
  const out = [];
  const add = (k) => {
    if (!out.includes(k)) out.push(k);
  };
  if (!msg || typeof msg !== "object") return out;
  if (msg.t === "state" && msg.view && typeof msg.view === "object") {
    const v = msg.view;
    if (Array.isArray(v.players)) {
      if (v.players.some((p) => p && p.badge !== undefined)) add("players[].badge");
      if (v.players.some((p) => p && p.badgeSwapped !== undefined)) add("players[].badgeSwapped");
    }
    const day = v.day;
    if (day && typeof day === "object") {
      if (day.turn !== undefined) add("day.turn");
      if (day.runoff !== undefined) add("day.runoff");
      if (day.showdown !== undefined) add("day.showdown");
    }
    const me = v.me;
    if (me && typeof me === "object") {
      if (me.whisperUsed !== undefined) add("me.whisperUsed");
      if (me.ballot !== undefined) add("me.ballot");
    }
    if (v.phase === "runoff" || v.phase === "showdown") add(`phase:${v.phase}`);
  } else if (msg.t === "chat") {
    if (msg.k === "whisper" || msg.k === "whispered") add(`chat.k:${msg.k}`);
  } else if (msg.t === "chatLog" && Array.isArray(msg.lines)) {
    for (const l of msg.lines) if (l && (l.k === "whisper" || l.k === "whispered")) add(`chatLog.k:${l.k}`);
  } else if (msg.t === "resultLog" && (msg.part === "whisper" || msg.part === "claim") && Array.isArray(msg.lines) && msg.lines.length > 0) {
    // 결과 화면은 묶음 네 부분을 모두 요청하고 서버는 꺼진 부분을 빈 줄로 답한다 — 빈 묶음은 흔적이 아니고 줄이 실제로 올 때만 센다
    add(`resultLog.part:${msg.part}`);
  }
  return out;
}

/** 기본판에서 허용되는 단계 전이(연속 중복은 접은 뒤). runoff·showdown 은 어느 쪽에도 없다. */
const BASIC_TRANSITIONS = Object.freeze({
  lobby: ["assigning"],
  assigning: ["roleReveal"],
  roleReveal: ["dayAnnounce"],
  dayAnnounce: ["errand"],
  errand: ["discussion"],
  discussion: ["nomination"],
  nomination: ["defense", "night"],
  defense: ["verdict"],
  verdict: ["execution"],
  execution: ["night", "ended"],
  night: ["morning"],
  morning: ["dayAnnounce", "ended"],
  ended: [],
});

/**
 * 기본판 단계 순서 판정(OFF3). phases = 받은 state 의 phase 열. 처음 어긋난 전이를 detail 로 실패시킨다. 값이 없으면 측정값 없음.
 * 로비 재시작(ended→lobby)은 한 판을 넘어가는 것이라 허용하지 않는다 — 한 판만 넘긴다.
 */
export function basicOrderChecks(phases) {
  const label = "단계 순서가 기본판이다(투표 → 변론 → 찬반 → 처형, 결선·결전 없음)";
  if (!Array.isArray(phases) || phases.length === 0 || phases.some((p) => typeof p !== "string")) return [noMeasure("OFF3", label, "phases[]")];
  const seq = phases.filter((p, i) => i === 0 || p !== phases[i - 1]);
  const bad = [];
  if (seq.includes("runoff")) bad.push("runoff 단계가 나왔다");
  if (seq.includes("showdown")) bad.push("showdown 단계가 나왔다");
  for (let i = 1; i < seq.length && bad.length < 3; i++) {
    const allowed = BASIC_TRANSITIONS[seq[i - 1]];
    if (allowed === undefined || !allowed.includes(seq[i])) {
      bad.push(`${seq[i - 1]} → ${seq[i]} 는 기본판 전이가 아님`);
      break;
    }
  }
  return [result("OFF3", label, bad)];
}

/** 결선 후보 이름표 중심 거리 하한(UI-SPEC D-4, 오탭 방지 T-09.1.1-40) */
export const RUNOFF_CENTER_MIN = 140;

/**
 * 동점 결선 화면 판정(RF1~RF5, 09.1.1-14, UI-SPEC D). 투표 중(step 1) 후보가 아닌 사람 화면에서 잰다.
 * pill = { rect, minFontPx, parts: [알약 안 조각 글자], tone } — rect 는 `.mf-turn__pill` 사각형, parts 는 그 안 span 글자, tone 은 `data-turn-tone`.
 * bar = 막대 사각형 · candidates = [{ seat, rect }] — `[data-pick]` 후보 이름표 버튼 · viewport = { w, h } · compact = 압축형(360×560) 여부(문턱은 같다).
 * RF1 알약·막대가 화면 안이고 알약 글자 ≥ 14 · RF2 후보 버튼 정확히 둘, 각 44×44 이상 · RF3 두 버튼이 겹치지 않고 중심 거리 ≥ 140
 * RF4 알약 안은 `결선` 과 `{초}초` 두 조각뿐(이름·n / N 없음) · RF5 알약 색 calm(진홍으로 바뀌지 않는다, O-10). 값이 없으면 `측정값 없음` 으로 실패한다.
 */
export function runoffChecks(input) {
  const { pill, bar, candidates, viewport, compact } = input ?? {};
  const suffix = compact === true ? " (압축형)" : "";
  const L1 = `결선 알약·막대가 화면 안이고 알약 글자 ${TURN_FONT_MIN}px 이상${suffix}`;
  const L2 = "후보 이름표 버튼 둘이 각각 44×44 이상";
  const L3 = `후보 이름표 버튼이 겹치지 않고 중심 거리 ${RUNOFF_CENTER_MIN}px 이상`;
  const L4 = "알약 안은 `결선` 과 `{초}초` 두 조각뿐(이름 없음)";
  const L5 = "알약 색이 calm 이다(진홍 없음)";
  const out = [];
  // RF1
  const r = pill?.rect;
  const vw = viewport?.w;
  const vh = viewport?.h;
  if (!r || !allNum(r.left, r.top, r.right, r.bottom, vw, vh) || !isNum(pill?.minFontPx) || !bar || !allNum(bar.left, bar.top, bar.right, bar.bottom)) {
    out.push(noMeasure("RF1", L1, !r ? "pill" : !viewport ? "viewport" : !isNum(pill?.minFontPx) ? "minFontPx" : "bar"));
  } else {
    const bad = [];
    const inside = (name, b) => {
      if (b.left < -OVERLAP_EPS) bad.push(`${name} 왼쪽 ${fmt(b.left)}`);
      if (b.right > vw + OVERLAP_EPS) bad.push(`${name} 오른쪽 ${fmt(b.right)} > ${vw}`);
      if (b.top < -OVERLAP_EPS) bad.push(`${name} 위 ${fmt(b.top)}`);
      if (b.bottom > vh + OVERLAP_EPS) bad.push(`${name} 아래 ${fmt(b.bottom)} > ${vh}`);
    };
    inside("알약", r);
    inside("막대", bar);
    if (pill.minFontPx + 0.01 < TURN_FONT_MIN) bad.push(`글자 ${fmt(pill.minFontPx)}px`);
    out.push(result("RF1", L1, bad));
  }
  // RF2·RF3
  const cs = Array.isArray(candidates) ? candidates : null;
  const valid = cs ? cs.filter((c) => c?.rect && allNum(c.rect.left, c.rect.top, c.rect.right, c.rect.bottom)) : [];
  if (!cs || valid.length !== cs.length) {
    out.push(noMeasure("RF2", L2, "candidates"), noMeasure("RF3", L3, "candidates"));
  } else {
    const wh = (c) => ({ w: c.rect.right - c.rect.left, h: c.rect.bottom - c.rect.top });
    const bad2 = [];
    if (cs.length !== 2) bad2.push(`후보 버튼 ${cs.length}개(기대 2)`);
    for (const c of cs) {
      const { w, h } = wh(c);
      if (w + 0.5 < TAP_MIN || h + 0.5 < TAP_MIN) bad2.push(`자리 ${c.seat} ${fmt(w)}x${fmt(h)}`);
    }
    out.push(result("RF2", L2, bad2));
    const bad3 = [];
    if (cs.length !== 2) bad3.push(`후보 버튼 ${cs.length}개(기대 2)`);
    else {
      const [a, b] = cs;
      if (rectsOverlap(a.rect, b.rect)) bad3.push(`겹침 (${overlapText(a.rect, b.rect)})`);
      const dist = Math.hypot((a.rect.left + a.rect.right) / 2 - (b.rect.left + b.rect.right) / 2, (a.rect.top + a.rect.bottom) / 2 - (b.rect.top + b.rect.bottom) / 2);
      if (dist + 0.01 < RUNOFF_CENTER_MIN) bad3.push(`중심 거리 ${fmt(dist)}px`);
    }
    out.push(result("RF3", L3, bad3));
  }
  // RF4
  const parts = pill?.parts;
  if (!Array.isArray(parts)) out.push(noMeasure("RF4", L4, "parts"));
  else {
    const ok = parts.length === 2 && parts[0] === "결선" && /^\d+초$/.test(parts[1]);
    out.push(result("RF4", L4, ok ? [] : [`조각 ${JSON.stringify(parts)}`]));
  }
  // RF5
  out.push(typeof pill?.tone === "string" ? result("RF5", L5, pill.tone === "calm" ? [] : [`tone ${pill.tone}`]) : noMeasure("RF5", L5, "tone"));
  return out;
}

// ---- 마지막 3인 결전 (09.1.1-16, UI-SPEC E) ----
// 앱 상수 사본. 출처 shared/game/phases.ts (test/unit/e2eContract.test.ts 가 같은 값인지 본다). 사이(0.9초)는 위의 PICK_GAP_MS 를 그대로 쓴다.
export const SHOWDOWN_GATHER_MS = 2000;
export const SHOWDOWN_TURN_MS = 8000;
export const SHOWDOWN_POINT_MS = 8000;
export const SHOWDOWN_REVEAL_MS = 1500;

/** 마지막 3인 알약·막대 아랫변 한도(UI-SPEC "폰 크기별 공통 배치"): 일반 160, 압축형(360×560) 124 */
export const SHOWDOWN_BLOCK_BOTTOM = 160;
export const SHOWDOWN_BLOCK_BOTTOM_COMPACT = 124;
/** 인용 카드: 알약 아랫변과의 간격 8, 좌우 여백 16 씩, 글자 16 */
export const SHOWDOWN_QUOTE_GAP = 8;
export const SHOWDOWN_QUOTE_SIDE = 16;
export const SHOWDOWN_QUOTE_FONT = 16;
/** 한마디 시트 칩 높이 하한·줄 수 상한 */
export const SHOWDOWN_CHIP_MIN_H = 44;
export const SHOWDOWN_CHIP_ROWS_MAX = 3;

/**
 * 마지막 3인 화면 기하 판정(SH1~SH6). 입력 { mode: "speak"|"point", pill: { rect, minFontPx, parts }, bar, sheet, chips, quote, buttons, panel, viewport: { w, h }, compact }.
 * SH1 알약·막대가 화면 안·알약 글자 ≥ 14 · SH2 알약 조각: speak = `n / 3`·`{이름} 님 차례`·`{초}초`, point = `지목`·`모두 동시에`·`{초}초`
 * SH3(speak 이고 sheet 가 있을 때) 시트 윗변 = 패널 윗변 ±1·높이 = 패널 높이 ±1·칩 높이 ≥ 44·칩 3줄 이하
 * SH4(quote 가 있을 때) 인용 카드가 알약·막대 아랫변 + 8 ±2 에서 시작·폭 = 화면 폭 − 32 ±2·글자 16 ±0.5·두 줄 이하
 * SH5(point 이고 buttons 가 있을 때) 지목 버튼이 정확히 둘·각 44×44 이상·교차 없음 · SH6 알약·막대 아랫변이 160(압축형 124) ±2 안.
 * sheet·quote·buttons 가 undefined 면 그 화면에는 해당 요소가 없는 것이라 항목을 만들지 않는다(없음 자체는 호출한 흐름이 따로 확인). null 이면 측정 실패로 `측정값 없음`. 값이 없으면 통과시키지 않는다.
 */
export function showdownChecks(input) {
  const { mode, pill, bar, sheet, chips, quote, buttons, panel, viewport, compact } = input ?? {};
  const suffix = compact === true ? " (압축형)" : "";
  const L1 = `마지막 3인 알약·막대가 화면 안이고 알약 글자 ${TURN_FONT_MIN}px 이상${suffix}`;
  const L2 = mode === "point" ? "알약 조각이 `지목`·`모두 동시에`·`{초}초` 이다" : "알약 조각이 `n / 3`·`{이름} 님 차례`·`{초}초` 이다";
  const L3 = `내 한마디 시트가 패널을 덮는다(윗변·높이 ±1), 칩 높이 ${SHOWDOWN_CHIP_MIN_H} 이상·${SHOWDOWN_CHIP_ROWS_MAX}줄 이하`;
  const L4 = `인용 카드가 알약 아래 ${SHOWDOWN_QUOTE_GAP}±2·폭 화면−${SHOWDOWN_QUOTE_SIDE * 2}±2·글자 ${SHOWDOWN_QUOTE_FONT}±0.5·두 줄 이하`;
  const L5 = `지목 버튼 둘이 각각 ${TAP_MIN}×${TAP_MIN} 이상이고 겹치지 않는다`;
  const limit = compact === true ? SHOWDOWN_BLOCK_BOTTOM_COMPACT : SHOWDOWN_BLOCK_BOTTOM;
  const L6 = `알약·막대 아랫변이 ${limit}${compact === true ? "(압축형)" : ""} 안에 있다`;
  const out = [];
  const vw = viewport?.w;
  const vh = viewport?.h;
  const r = pill?.rect;
  const barOk = bar && allNum(bar.left, bar.top, bar.right, bar.bottom);
  // SH1
  if (!r || !allNum(r.left, r.top, r.right, r.bottom, vw, vh) || !isNum(pill?.minFontPx) || !barOk) {
    out.push(noMeasure("SH1", L1, !r ? "pill" : !viewport ? "viewport" : !isNum(pill?.minFontPx) ? "minFontPx" : "bar"));
  } else {
    const bad = [];
    const inside = (name, b) => {
      if (b.left < -OVERLAP_EPS) bad.push(`${name} 왼쪽 ${fmt(b.left)}`);
      if (b.right > vw + OVERLAP_EPS) bad.push(`${name} 오른쪽 ${fmt(b.right)} > ${vw}`);
      if (b.top < -OVERLAP_EPS) bad.push(`${name} 위 ${fmt(b.top)}`);
      if (b.bottom > vh + OVERLAP_EPS) bad.push(`${name} 아래 ${fmt(b.bottom)} > ${vh}`);
    };
    inside("알약", r);
    inside("막대", bar);
    if (pill.minFontPx + 0.01 < TURN_FONT_MIN) bad.push(`글자 ${fmt(pill.minFontPx)}px`);
    out.push(result("SH1", L1, bad));
  }
  // SH2
  const parts = pill?.parts;
  if (!Array.isArray(parts)) out.push(noMeasure("SH2", L2, "parts"));
  else {
    const secOk = parts.length === 3 && /^\d+초$/.test(parts[2]);
    const ok = mode === "point" ? secOk && parts[0] === "지목" && parts[1] === "모두 동시에" : secOk && /^[1-3] \/ 3$/.test(parts[0]) && / 님 차례$/.test(parts[1]) && parts[1].length > " 님 차례".length;
    out.push(result("SH2", L2, ok ? [] : [`조각 ${mode === "point" ? JSON.stringify(parts) : JSON.stringify([parts[0], parts[1] === undefined ? undefined : "(이름)", parts[2]]).replace(/null/g, "없음")}`]));
  }
  // 알약·막대 아랫변(인용 카드와 SH6 의 기준)
  const anchor = r && barOk && isNum(r.bottom) ? Math.max(r.bottom, bar.bottom) : null;
  // SH3
  if (sheet !== undefined && mode !== "point") {
    const cs = Array.isArray(chips) ? chips : null;
    if (!sheet || !allNum(sheet.top, sheet.height) || !panel || !allNum(panel.top, panel.height) || !cs || cs.length === 0 || cs.some((c) => !c || !allNum(c.top, c.height))) {
      out.push(noMeasure("SH3", L3, !sheet ? "sheet" : !panel ? "panel" : "chips"));
    } else {
      const bad = [];
      if (Math.abs(sheet.top - panel.top) > 1) bad.push(`윗변 ${fmt(sheet.top)} ≠ 패널 ${fmt(panel.top)}`);
      if (Math.abs(sheet.height - panel.height) > 1) bad.push(`높이 ${fmt(sheet.height)} ≠ 패널 ${fmt(panel.height)}`);
      for (const [i, c] of cs.entries()) if (c.height + 0.5 < SHOWDOWN_CHIP_MIN_H) bad.push(`칩 ${i + 1} 높이 ${fmt(c.height)}`);
      const rows = new Set(cs.map((c) => Math.round(c.top))).size;
      if (rows > SHOWDOWN_CHIP_ROWS_MAX) bad.push(`칩 ${rows}줄`);
      out.push(result("SH3", L3, bad));
    }
  }
  // SH4
  if (quote !== undefined) {
    const q = quote?.rect;
    if (!q || !allNum(q.top, q.width, quote.fontPx, quote.lines, vw) || anchor === null) out.push(noMeasure("SH4", L4, !q ? "quote" : anchor === null ? "anchor" : "viewport"));
    else {
      const bad = [];
      if (Math.abs(q.top - (anchor + SHOWDOWN_QUOTE_GAP)) > 2) bad.push(`시작 ${fmt(q.top)} (기대 ${fmt(anchor + SHOWDOWN_QUOTE_GAP)}±2)`);
      if (Math.abs(q.width - (vw - SHOWDOWN_QUOTE_SIDE * 2)) > 2) bad.push(`폭 ${fmt(q.width)} (기대 ${vw - SHOWDOWN_QUOTE_SIDE * 2}±2)`);
      if (Math.abs(quote.fontPx - SHOWDOWN_QUOTE_FONT) > 0.5) bad.push(`글자 ${fmt(quote.fontPx)}px`);
      if (quote.lines > 2) bad.push(`${quote.lines}줄`);
      out.push(result("SH4", L4, bad));
    }
  }
  // SH5
  if (buttons !== undefined && mode !== "speak") {
    const bs = Array.isArray(buttons) ? buttons : null;
    if (!bs || bs.some((b) => !b?.rect || !allNum(b.rect.left, b.rect.top, b.rect.right, b.rect.bottom))) out.push(noMeasure("SH5", L5, "buttons"));
    else {
      const bad = [];
      if (bs.length !== 2) bad.push(`지목 버튼 ${bs.length}개(기대 2)`);
      for (const b of bs) {
        const w = b.rect.right - b.rect.left;
        const h = b.rect.bottom - b.rect.top;
        if (w + 0.5 < TAP_MIN || h + 0.5 < TAP_MIN) bad.push(`자리 ${b.seat} ${fmt(w)}x${fmt(h)}`);
      }
      if (bs.length === 2 && rectsOverlap(bs[0].rect, bs[1].rect)) bad.push(`겹침 (${overlapText(bs[0].rect, bs[1].rect)})`);
      out.push(result("SH5", L5, bad));
    }
  }
  // SH6
  if (anchor === null) out.push(noMeasure("SH6", L6, "pill·bar"));
  else out.push(result("SH6", L6, anchor > limit + 2 ? [`아랫변 ${fmt(anchor)} > ${limit}`] : []));
  return out;
}

/**
 * 결과 알림 판정(AN1~AN3). m = { fontPx, lineCount, wordBreak } — `[data-announce]` 의 계산된 글자 크기·줄 수·word-break.
 * AN1 글자 36px(28px 로 줄이지 않는다) · AN2 한두 줄 · AN3 word-break keep-all.
 */
export function announceChecks(m) {
  const label1 = "결과 알림 글자 36px";
  const label2 = "결과 알림이 한두 줄";
  const label3 = "결과 알림 word-break keep-all";
  if (!m || typeof m !== "object") return [noMeasure("AN1", label1, "announce"), noMeasure("AN2", label2, "announce"), noMeasure("AN3", label3, "announce")];
  return [
    isNum(m.fontPx) ? result("AN1", label1, Math.abs(m.fontPx - 36) <= 0.5 ? [] : [`${fmt(m.fontPx)}px`]) : noMeasure("AN1", label1, "fontPx"),
    isNum(m.lineCount) ? result("AN2", label2, m.lineCount >= 1 && m.lineCount <= 2 ? [] : [`${m.lineCount}줄`]) : noMeasure("AN2", label2, "lineCount"),
    typeof m.wordBreak === "string" ? result("AN3", label3, m.wordBreak === "keep-all" ? [] : [`word-break ${m.wordBreak}`]) : noMeasure("AN3", label3, "wordBreak"),
  ];
}

// ---- 유언 편지(09.1-11, 결정 0063-3, UI-SPEC C-1~C-3) ----
// 앱 상수 사본 — test/unit/e2eContract.test.ts 가 src/game/willLetter.ts·src/game/dayView.ts 와 같음을 고정한다.
/** 편지 접힘 시작 = 채팅 카드 도착(편지 T0 기준 ms) */
export const LETTER_FOLD_AT_MS = 5000;
/** 편지 제거(편지 T0 기준 ms) */
export const LETTER_END_AT_MS = 5420;
/** 일반 화면에서 아침 알림(= 편지 T0)이 시작되는 시각(아침 진입 기준 ms) */
export const ANNOUNCE_MORNING_AT = 400;
/** 인장 글자(임시, 미결 M-7) */
export const SEAL_GLYPH = "M";
/** 머리글 글자 크기 하한 */
export const LETTER_HEAD_FONT_MIN = 14;
/** 머리글 대비 하한(14px 글자) */
export const LETTER_HEAD_CONTRAST_MIN = 4.5;
/** 인장 그림(84×84) 안의 밀랍 원 반지름 비율 — 불규칙 가장자리 바깥 점은 이 반지름 안에 든다 */
const SEAL_RADIUS_RATIO = 0.46;

/** "rgb(r, g, b)" / "rgba(r, g, b, a)" 를 [r, g, b] 로. 읽을 수 없으면 null */
export function parseRgb(text) {
  const m = /^rgba?\(\s*(\d+(?:\.\d+)?)[ ,]+(\d+(?:\.\d+)?)[ ,]+(\d+(?:\.\d+)?)/.exec(String(text ?? ""));
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

/** 두 색(rgb 글자)의 대비. 읽을 수 없으면 null */
export function contrastRatio(fg, bg) {
  const a = parseRgb(fg);
  const b = parseRgb(bg);
  if (a === null || b === null) return null;
  const [hi, lo] = [relLuminance(a), relLuminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** 사각형과 원이 겹치는가(원 중심에서 사각형까지 가장 가까운 점이 반지름 안) */
function rectHitsCircle(r, cx, cy, radius) {
  const nx = Math.max(r.left, Math.min(cx, right(r)));
  const ny = Math.max(r.top, Math.min(cy, bottom(r)));
  return Math.hypot(nx - cx, ny - cy) < radius - OVERLAP_EPS;
}

/**
 * 유언 편지 맞춤 판정(LT4~LT8). m = readLetter() — { vw, vh, paper, lines[], seal, sealSize, head: { fontPx, color }, paperBg }.
 * LT4 편지지 사각형이 화면 안 · LT5 모든 글 줄 사각형이 편지지 안 · LT6 인장이 글 줄과 겹치지 않음(인장은 밀랍 원으로 본다)
 * LT7 머리글 14px 이상 · LT8 머리글 대비 4.5:1 이상(읽은 색 값으로 계산). 값이 없으면 통과시키지 않고 `측정값 없음` 으로 실패한다.
 */
export function letterChecks(m) {
  const L4 = "편지지가 화면 안에 완전히 들어온다";
  const L5 = "모든 글 줄이 편지지 안에 있다";
  const L6 = "인장이 글 줄과 겹치지 않는다";
  const L7 = `편지 머리글이 ${LETTER_HEAD_FONT_MIN}px 이상`;
  const L8 = `편지 머리글 대비가 ${LETTER_HEAD_CONTRAST_MIN}:1 이상`;
  if (!m || typeof m !== "object") return [noMeasure("LT4", L4, "letter"), noMeasure("LT5", L5, "letter"), noMeasure("LT6", L6, "letter"), noMeasure("LT7", L7, "letter"), noMeasure("LT8", L8, "letter")];
  const out = [];
  const p = m.paper;
  const rectOk = (r) => !!r && allNum(r.left, r.top, r.width, r.height);
  if (!rectOk(p) || !isNum(m.vw) || !isNum(m.vh)) out.push(noMeasure("LT4", L4, "paper·vw·vh"));
  else {
    const bad = [];
    if (p.left < -OVERLAP_EPS) bad.push(`왼쪽 ${fmt(p.left)}`);
    if (right(p) > m.vw + OVERLAP_EPS) bad.push(`오른쪽 ${fmt(right(p))} > ${m.vw}`);
    if (p.top < -OVERLAP_EPS) bad.push(`위 ${fmt(p.top)}`);
    if (bottom(p) > m.vh + OVERLAP_EPS) bad.push(`아래 ${fmt(bottom(p))} > ${m.vh}`);
    out.push(result("LT4", L4, bad));
  }
  const lines = Array.isArray(m.lines) ? m.lines : [];
  if (!rectOk(p) || lines.length === 0 || !lines.every(rectOk)) out.push(noMeasure("LT5", L5, "lines"));
  else {
    const bad = [];
    lines.forEach((l, i) => {
      if (!rectInside(l, p)) bad.push(`${i + 1}번째 줄 ${fmt(l.left)}~${fmt(right(l))} × ${fmt(l.top)}~${fmt(bottom(l))}`);
    });
    out.push(result("LT5", L5, bad));
  }
  const s = m.seal;
  if (!rectOk(s) || !isNum(m.sealSize) || lines.length === 0 || !lines.every(rectOk)) out.push(noMeasure("LT6", L6, "seal·lines"));
  else {
    const cx = s.left + s.width / 2;
    const cy = s.top + s.height / 2;
    const bad = [];
    lines.forEach((l, i) => {
      if (rectHitsCircle(l, cx, cy, m.sealSize * SEAL_RADIUS_RATIO)) bad.push(`${i + 1}번째 줄이 인장과 겹침`);
    });
    out.push(result("LT6", L6, bad));
  }
  out.push(isNum(m.head?.fontPx) ? result("LT7", L7, m.head.fontPx + 0.01 >= LETTER_HEAD_FONT_MIN ? [] : [`${fmt(m.head.fontPx)}px`]) : noMeasure("LT7", L7, "head.fontPx"));
  const ratio = contrastRatio(m.head?.color, m.paperBg);
  out.push(ratio === null ? noMeasure("LT8", L8, "head.color·paperBg") : result("LT8", L8, ratio + 0.001 >= LETTER_HEAD_CONTRAST_MIN ? [] : [`${Math.round(ratio * 100) / 100}:1 (${m.head.color} on ${m.paperBg})`]));
  return out;
}

/** 요청 주소 목록에서 손글씨 글꼴을 대상 주소 밖에서 불러온 수(Google Fonts 의 Nanum 요청 등). 같은 출처 /fonts/nanum-pen-script/ 는 센다고 하지 않는다 */
export function externalPenFontRequests(urls, origin) {
  let own;
  try {
    own = new URL(origin).origin;
  } catch {
    own = origin;
  }
  return (urls ?? []).filter((u) => {
    let url;
    try {
      url = new URL(u);
    } catch {
      return false;
    }
    return url.origin !== own && /nanum/i.test(u);
  }).length;
}

/** 요청 주소 목록에서 같은 출처 손글씨 글꼴 조각 요청 수(글꼴이 실제로 같은 출처에서 왔는지 참고용) */
export function ownPenFontRequests(urls, origin) {
  let own;
  try {
    own = new URL(origin).origin;
  } catch {
    own = origin;
  }
  return (urls ?? []).filter((u) => {
    try {
      const url = new URL(u);
      return url.origin === own && url.pathname.startsWith("/fonts/nanum-pen-script/");
    } catch {
      return false;
    }
  }).length;
}

/**
 * 산 사람 화면의 유령 누설 판정(GH1~GH4, UI-SPEC "산 사람 쪽 규칙"). m = { ghostView, roleChips, ghostSeats, ghostTexts } —
 * `[data-ghost-view]`·`[data-role-chip]`·`[data-ghost-seat]` 요소 수와 유령 문구("유령끼리만 보여요"·"유령 채팅") 를 가진 요소 수. 산 사람이면 모두 0 이어야 한다.
 */
export function ghostDomChecks(m) {
  const spec = [
    ["GH1", "산 사람 화면에 [data-ghost-view] 0건", "ghostView"],
    ["GH2", "산 사람 화면에 [data-role-chip] 0건", "roleChips"],
    ["GH3", "산 사람 화면에 [data-ghost-seat] 0건", "ghostSeats"],
    ["GH4", "산 사람 화면에 유령 문구 0건", "ghostTexts"],
  ];
  return spec.map(([id, label, key]) => (!m || !isNum(m[key]) ? noMeasure(id, label, key) : result(id, label, m[key] === 0 ? [] : [`${key} ${m[key]}건`])));
}

/**
 * 찬반 패널 구성 판정(VP1~VP2). m = { kind: "voter"|"viewer", hasPicker, hasCount, kbOpen } —
 * 투표자(변론자 아닌 산 사람)는 VerdictPicker 와 숫자(.mv-count), 보기(변론자·유령)는 숫자만, 키보드가 열려 있으면 둘 다 숨는다.
 */
export function verdictPanelChecks(m) {
  const label1 = "찬반 고르기(VerdictPicker) 구성";
  const label2 = "찬반 투표 숫자(.mv-count) 구성";
  if (!m || (m.kind !== "voter" && m.kind !== "viewer") || typeof m.hasPicker !== "boolean" || typeof m.hasCount !== "boolean") {
    return [noMeasure("VP1", label1, "kind·hasPicker"), noMeasure("VP2", label2, "kind·hasCount")];
  }
  const kb = m.kbOpen === true;
  const wantPicker = m.kind === "voter" && !kb;
  const wantCount = !kb;
  const where = `${m.kind === "voter" ? "투표자" : "보기"}${kb ? "·키보드 열림" : ""}`;
  return [
    result("VP1", label1, m.hasPicker === wantPicker ? [] : [`${where}: 고르기 ${m.hasPicker ? "있음" : "없음"} (기대 ${wantPicker ? "있음" : "없음"})`]),
    result("VP2", label2, m.hasCount === wantCount ? [] : [`${where}: 숫자 ${m.hasCount ? "있음" : "없음"} (기대 ${wantCount ? "있음" : "없음"})`]),
  ];
}

/** 직업 이름(시트 칩 글자). */
export const ROLE_NAME = { mafia: "마피아", police: "경찰", doctor: "의사", citizen: "시민" };

export function isOneLine(height, lineHeight) {
  return height <= lineHeight * ONE_LINE_FACTOR + 1e-6;
}
export function lineCount(height, lineHeight) {
  return Math.round(height / lineHeight);
}

const rd = (n) => Math.round(n * 10) / 10;
/** 겹친 크기를 사람이 판단할 수 있게 내용 칸에 적는다(기준은 바꾸지 않는다). */
const overlapText = (a, b) =>
  `가로 ${rd(Math.min(right(a), right(b)) - Math.max(a.left, b.left))}px·세로 ${rd(Math.min(bottom(a), bottom(b)) - Math.max(a.top, b.top))}px`;
const result = (id, label, bad) => ({ id, label, ok: bad.length === 0, detail: bad.length === 0 ? "" : bad.join("; ") });

/**
 * D3b 5명판 이름표 보이는 비율 바닥 98.0 % — 사용자 승인 완화(2026-10-26, 승인 목록 APPROVED_RELAXATIONS 의 `D3b-5`).
 * 사유: 앞쪽 옆자리(5명판 자리 1·4)가 탈락해 유령 그림이 되면 유령의 머리 윗부분이 뒤쪽 이웃(자리 2·3)의 5글자 이름표
 * 알약 아래쪽을 약 0.4 % 덮는다(실측 99.5~99.9 %). 사용자가 캐릭터가 이름표를 덮는 것은 이미 허용했고(UI-SPEC F2),
 * 이 숫자는 5명판에만 적용한다. 4명판 100 %·6명판 85 %·7명판 50 %·8명판 55 % 와 다른 모든 기준 수치는 그대로다.
 */
export const D3B_FLOOR_5_PLAYERS = 0.98;

/**
 * 사용자가 승인한 검사 완화 목록(출력 머리에도 찍힌다). 이 밖의 기준은 낮추지 않는다 — 단위 테스트가 목록과 상수를 고정한다.
 * approved: 승인 근거(03.1 F7 = UI-SPEC 확정 결정 F7) 또는 승인 날짜.
 */
export const APPROVED_RELAXATIONS = [
  { id: "M1", approved: "03.1 F7", reason: "아침 카드가 5초 동안 남의 얼굴을 가려도 됨(M3·M4 신설)" },
  { id: "D3a/D3b", approved: "03.1 F7", reason: "이름표가 이웃 얼굴을 가리지 않음 → 캐릭터 아래 층(D3a) + 인원별 보이는 비율 바닥(D3b)" },
  { id: "D4", approved: "03.1 F7", reason: "[테스트] 버튼이 캐릭터 상자와 겹치는 세로 깊이 ≤ 3px" },
  { id: "D3b-5", approved: "2026-10-26", reason: "5명판 D3b 바닥 99.9 % → 98.0 %: 앞쪽 옆자리 유령 머리가 5글자 이름표를 약 0.4 % 덮음(캐릭터가 이름표를 덮는 것은 이미 허용)" },
];

// ---- H1 헤더 글씨 대비 (결정 0030, 사용자 지시 V-06) ----

/** 헤더 제목·타이머 글씨 대비 하한(WCAG AA 본문). 낮추지 않는다. */
export const HEADER_CONTRAST_MIN = 4.5;
/** 글씨 뒤 배경 픽셀 휘도를 대표하는 백분위수 — 별·해 같은 작은 밝은 점에 흔들리지 않게 p95. */
export const HEADER_BG_PERCENTILE = 0.95;

/** sRGB(0~255 세 값) → WCAG 상대 휘도 0~1. */
export function relLuminance(rgb) {
  const lin = (v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const l = 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
  return Math.round(l * 1e12) / 1e12;
}

/** 값 목록의 p 분위수(가장 가까운 순위, 오름차순). 빈 목록은 NaN. */
export function percentile(values, p) {
  if (!Array.isArray(values) || values.length === 0) return Number.NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.min(sorted.length, Math.max(1, Math.ceil(p * sorted.length)));
  return sorted[rank - 1];
}

/** 평평한 RGB 배열([r,g,b,r,g,b,…])의 픽셀 휘도 p95(HEADER_BG_PERCENTILE). 비면 NaN. */
export function rgbP95Luminance(flat) {
  const lums = [];
  for (let i = 0; i + 2 < flat.length; i += 3) lums.push(relLuminance([flat[i], flat[i + 1], flat[i + 2]]));
  return percentile(lums, HEADER_BG_PERCENTILE);
}

/**
 * H1 헤더 제목·타이머 글씨가 배경 위에서 읽힌다. measure = browser.readHeaderContrast 결과 { items: [{ name: "제목"|"타이머", rect, color: [r,g,b], bgLum }] }.
 * 대비 = (밝은 쪽 휘도 + .05) / (어두운 쪽 휘도 + .05) ≥ HEADER_CONTRAST_MIN. bgLum 은 글씨를 투명하게 한 스냅숏에서 그 요소 사각형 안 픽셀 휘도의 p95.
 * expectTimer(타이머가 있어야 하는 상태)인데 타이머 항목이 없거나, 제목 항목이 없거나, 측정값이 비면 조용히 통과하지 않고 실패한다.
 */
export function headerContrastChecks(measure, { expectTimer }) {
  const label = "헤더 제목·타이머 글씨 대비 4.5:1";
  const items = measure?.items;
  if (!Array.isArray(items) || items.length === 0) return result("H1", label, ["측정값 없음(헤더 글씨 항목이 없음)"]);
  const bad = [];
  if (!items.some((i) => i.name === "제목")) bad.push("제목 항목 없음");
  if (expectTimer && !items.some((i) => i.name === "타이머")) bad.push("타이머가 있어야 하는데 타이머 항목 없음");
  for (const i of items) {
    if (typeof i.bgLum !== "number" || Number.isNaN(i.bgLum) || !Array.isArray(i.color)) {
      bad.push(`${i.name} 측정값 없음(배경 휘도 또는 글자색)`);
      continue;
    }
    const lt = relLuminance(i.color);
    const ratio = (Math.max(lt, i.bgLum) + 0.05) / (Math.min(lt, i.bgLum) + 0.05);
    if (ratio < HEADER_CONTRAST_MIN) bad.push(`${i.name} ${rd(ratio)}:1 < ${HEADER_CONTRAST_MIN}:1 (배경 p95 휘도 ${Math.round(i.bgLum * 1000) / 1000})`);
  }
  return result("H1", label, bad);
}

/** 단계 → 배경 장면 id. src/game/scenes.ts 의 PHASE_SCENE 과 같은 표다 — test/unit/scenes.test.ts 가 두 표가 같음을 확인한다. */
export const EXPECTED_SCENE = {
  lobby: "lobby",
  tutorial: "lobby", // 17페이즈(결정 0080): 튜토리얼 화면이 자기 장면을 그리기 전까지 대기실 장면
  assigning: "lobby",
  roleReveal: "lobby",
  dayAnnounce: "day",
  errand: "day",
  discussion: "day",
  night: "night",
  morning: "morning",
  defense: "dusk",
  execution: "dusk",
  nomination: "dusk",
  runoff: "dusk",
  showdown: "dusk",
  verdict: "dusk",
  ended: "night",
};

// ---- 역할 카드(R1~R6) ----

// ---- 관전자(V1)·살아 있는 사람(V2) ----

/** G7 본문 글자 ≥ 14px. 항목 { desc, size, allowed? } — allowed(TEXT_SIZE_ALLOW 에 걸림)는 뺀다. 필드가 없으면 실패한다. */
export function smallTextIssues(smallText) {
  if (!Array.isArray(smallText)) return { id: "G7", label: "본문 글자 14px 이상", ok: false, detail: "글자 크기 측정값(smallText) 없음" };
  const bad = smallText.filter((e) => !e.allowed && e.size < 14).map((e) => `${e.desc} ${fmt(e.size)}px`);
  return { id: "G7", label: "본문 글자 14px 이상", ok: bad.length === 0, detail: bad.length === 0 ? "" : `14px 미만: ${list(bad)}` };
}

// ---- 처형 구간 순수 검사 P1·P9·P2·P3 (04-29, UI-SPEC 15.3). 입력 모양은 머리의 `처형 구간 스냅숏 계약` ----

// ---- P4 공개 연출·P-COLOR 색 규칙 (04-29, UI-SPEC 15.1·15.3, D-31·D-33) ----

// ---- 04-30 P5 변론 스포트라이트·P6 처형 카드 (UI-SPEC 8.4·8.5·15.3) ----

 // VERDICT_DIM_PERCENT 45 %
 // VERDICT_BLUR_PX 3
 // VERDICT_CANDIDATE_SCALE
 // UI-SPEC 12 층: 어둡게+흐림 z 30
 // 후보 이름표 아래끝 ≤ 장면 아래 − 4

const isNum = (x) => typeof x === "number" && Number.isFinite(x);

// ---- 04-30 P7 처형 무효 카드·P10 배치 겹침 (UI-SPEC 9.2·15.3) ----

// ---- 5페이즈 순수 검사 (05-05) ----

/** 측정값이 빠졌거나 모양이 틀린 입력은 조용히 통과하지 않는다(T-05-11). */
const noMeasure = (id, label, what) => result(id, label, [`측정값 없음(${what})`]);

/**
 * UX1 지금 할 일 문장이 한 화면에 하나, 글자가 있고 자막 띠 안이며 3줄 미만이고(14페이즈 — 옛 헤더 한 줄 규칙을 띠로 옮김), 시간 있는 단계에는 타이머가 있다 (D-08, UI-SPEC 8.4).
 * g = { count, items: [{ text, inBand, height, lineHeight }], timers } — 모양은 위 5페이즈 계약.
 */
export function guideChecks(g, { phase }) {
  const label = "지금 할 일 문장 하나·띠 안·3줄 미만·타이머";
  if (!g || !isNum(g.count) || !Array.isArray(g.items) || !isNum(g.timers)) return noMeasure("UX1", label, "안내 문장 개수·항목·타이머 수");
  if (g.count === 0) return result("UX1", label, ["안내 문장 요소 없음"]);
  if (g.count !== 1) return result("UX1", label, [`안내 문장 요소 ${g.count}개 ≠ 1`]);
  const it = g.items[0];
  if (!it || typeof it.text !== "string" || typeof it.inBand !== "boolean") return noMeasure("UX1", label, "안내 문장 글자");
  const bad = [];
  if (it.text.trim() === "") bad.push("안내 문장 글자가 비어 있음");
  if (!it.inBand) bad.push("안내 문장이 자막 띠 밖에 있음");
  else {
    if (!isNum(it.height) || !isNum(it.lineHeight) || it.lineHeight <= 0) return noMeasure("UX1", label, "띠 문장 높이·줄 높이");
    if (lineCount(it.height, it.lineHeight) >= HOST_LINE_MAX) bad.push(`띠 문장이 ${HOST_LINE_MAX}줄 이상(높이 ${rd(it.height)}px·줄 높이 ${rd(it.lineHeight)}px, ${lineCount(it.height, it.lineHeight)}줄)`);
  }
  if (!TIMELESS_PHASES.includes(phase) && g.timers < 1) bad.push(`타이머 없음(단계 ${phase})`);
  return result("UX1", label, bad);
}

/** UX2 문서 높이가 화면 높이를 넘지 않는다(세로 스크롤이 생기지 않음). m = { docH }. */
export function docHeightChecks(m, { h }) {
  const label = "문서 높이가 화면 높이 이내";
  if (!m || !isNum(m.docH) || !isNum(h)) return noMeasure("UX2", label, "문서 높이");
  return result("UX2", label, m.docH > h ? [`문서 높이 ${rd(m.docH)} > ${h}`] : []);
}

/** UX2-J 링크 참가(앉은 사람 expectSeated 명): 문서 높이와 `참가하기` 아래끝이 화면 높이 이내. j = { seated, docH, buttonBottom }. h ≥ JOIN_FIT_MIN_H 일 때만 흐름이 부른다. */
export function joinFitChecks(j, { h, expectSeated }) {
  const label = "링크 참가 한 화면(문서·참가하기 버튼)";
  if (!j || !isNum(j.seated) || !isNum(j.docH) || !isNum(j.buttonBottom) || !isNum(h) || !isNum(expectSeated)) {
    return noMeasure("UX2-J", label, "앉은 사람 수·문서 높이·참가하기 아래끝");
  }
  const bad = [];
  if (j.seated !== expectSeated) bad.push(`앉은 사람 ${j.seated}명 ≠ 기대 ${expectSeated}명`);
  if (j.docH > h) bad.push(`문서 높이 ${rd(j.docH)} > ${h}`);
  if (j.buttonBottom > h) bad.push(`참가하기 아래끝 ${rd(j.buttonBottom)} > ${h}`);
  return result("UX2-J", label, bad);
}

/** PC 에서 폰 폭 열의 최대 폭(px). UI-SPEC D-11 — `#root` 가 이 폭 이하이고 화면 가운데에 선다. */
const PC_ROOT_MAX_W = 430;
/** 가운데 정렬 허용 오차(px). */
const PC_CENTER_EPS = 1;
/** UX2-PC PC 폭(1280)에서 `#root` 폭 ≤ 430 이고 가로 가운데(±1). p = { rootLeft, rootWidth, where }. */
export function pcCenterChecks(p, { w }) {
  const label = "PC 폭에서 폰 폭 열이 가운데";
  if (!p || !isNum(p.rootLeft) || !isNum(p.rootWidth) || !isNum(w)) return noMeasure("UX2-PC", label, "#root left·width");
  const where = typeof p.where === "string" && p.where !== "" ? p.where : "?";
  const bad = [];
  if (p.rootWidth > PC_ROOT_MAX_W) bad.push(`${where}: #root 폭 ${rd(p.rootWidth)} > ${PC_ROOT_MAX_W}`);
  const wantLeft = (w - p.rootWidth) / 2;
  if (Math.abs(p.rootLeft - wantLeft) > PC_CENTER_EPS) bad.push(`${where}: #root left ${rd(p.rootLeft)} ≠ 가운데 ${rd(wantLeft)}(±${PC_CENTER_EPS}, 화면 폭 ${w})`);
  return result("UX2-PC", label, bad);
}

/**
 * WL1·WL2 화면 켜짐 유지(Wake Lock). mode "unsupported"(WL1): w = { hasApi, reachedPhase, consoleErrors } — API 없는 환경에서도 정상 진행하고 콘솔 오류가 없다.
 * mode "spy"(WL2): w = { requestsAtLobby, requestsAfterVisible } — 대기실에서 요청이 1회 이상이고 숨김 → 보임 복귀에 정확히 1회 늘어난다.
 */
export function wakeLockChecks(w, { mode }) {
  if (mode === "unsupported") {
    const label = "Wake Lock 미지원 환경 정상 진행";
    if (!w || typeof w.hasApi !== "boolean" || typeof w.reachedPhase !== "boolean" || !Array.isArray(w.consoleErrors)) {
      return noMeasure("WL1", label, "hasApi·reachedPhase·consoleErrors");
    }
    const bad = [];
    if (w.hasApi) bad.push("navigator.wakeLock 이 남아 있음(미지원 모의가 안 먹음)");
    if (!w.reachedPhase) bad.push("미지원 환경에서 다음 단계까지 가지 못함");
    if (w.consoleErrors.length > 0) bad.push(`콘솔 오류 ${w.consoleErrors.length}개: ${w.consoleErrors.slice(0, 3).join(" | ").slice(0, 200)}`);
    return result("WL1", label, bad);
  }
  if (mode === "spy") {
    const label = "Wake Lock 요청이 대기실·가시성 복귀에 맞음";
    if (!w || !isNum(w.requestsAtLobby) || !isNum(w.requestsAfterVisible)) return noMeasure("WL2", label, "requestsAtLobby·requestsAfterVisible");
    const bad = [];
    if (w.requestsAtLobby < 1) bad.push(`대기실 요청 ${w.requestsAtLobby}회 < 1`);
    const delta = w.requestsAfterVisible - w.requestsAtLobby;
    if (delta !== 1) bad.push(`보임 복귀 뒤 요청 증가 ${delta}회 ≠ 1`);
    return result("WL2", label, bad);
  }
  return result("WL", "Wake Lock 검사", [`알 수 없는 모드 ${String(mode)}`]);
}

// ---- 261029-vvd: 후보 선택 취소 (결정 0040) — P11 안내 줄, P12 이름표 탭 유지·빈 곳 탭 취소 ----

// ---- 6페이즈 맵 로비·world 흐름 순수 검사 (06-17) ----
// 캐릭터는 3D 메시라 DOM 위치가 없다 — 두 페이지의 위치는 window.__mfWorld.sample(seat, t) 로만 읽는다(06-13 테스트 훅, RESEARCH Pitfall 6).
// 모든 판정 함수는 측정값이 없으면 조용히 통과하지 않고 `측정값 없음(…)` 으로 실패한다.

/** 두 페이지가 같은 서버 시각 t 에서 보는 같은 자리 위치의 차이 상한(월드 단위). 같은 머신(같은 시계)에만 적용한다(가정 A2). 낮추지 않는다. */
export const WORLD_SYNC_TOL = 0.3;
/** 바닥을 누른 뒤 목적지 링(data-ring)이 뜨기까지 상한(ms, UI-SPEC 100ms). */
export const WORLD_RING_MAX_MS = 100;
/** 바닥을 누른 뒤 서버가 보낸 내 구간이 도착하기까지 상한(ms, UI-SPEC 500ms). */
export const WORLD_SEGMENT_MAX_MS = 500;
/** 걷는 중 표본이 실제로 움직였다고 볼 최소 거리(월드 단위) — 서 있는 사람끼리 같은 위치를 비교하는 거짓 통과를 막는다. */
export const WORLD_MOVED_MIN = 0.1;
/** 이름표 글자 크기 하한(px). */
export const NAMETAG_FONT_MIN = 14;

/** 앱 MOVE_SPEED(shared/game/world.ts)와 같은 걷는 속도(단위/초) — e2eContract 시험이 같음을 고정한다. */
export const WORLD_MOVE_SPEED = 1.8;
/** 손 뗀 뒤 이 프레임 수 안에 화면 출발(결정 0059: 배포본 RTT 약 155ms 에서 예측이 없으면 약 10프레임 뒤). */
export const WORLD_START_MAX_FRAMES = 3;
/** 출발로 보는 최소 화면 이동(월드 단위). */
export const WORLD_START_MOVED_MIN = 0.005;
/** 걷는 동안 프레임 사이 화면 속도 상한(단위/초) — 진단 측정에서 섞기 없는 응답 순간 튐이 약 8.7 단위/초였다. */
export const WORLD_JUMP_SPEED_MAX = 3 * WORLD_MOVE_SPEED;

const dist2 = (p, q) => Math.hypot(p.x - q.x, p.z - q.z);

/**
 * 손님 탭 한 번이 두 페이지에서 같은 위치로 걷는지(MAP-02). a·b = 두 페이지가 같은 서버 시각 t 로 읽은 표본 목록
 * [{ kind: "walk"|"arrived", t, p: { x, z } | null }] (같은 순서·같은 t). ringMs·segmentMs = 탭(손 뗌)에서 링·내 구간까지 걸린 시간(ms).
 * W2 위치 차 ≤ tol(걷는 중과 도착 뒤 모두, 걷는 중 표본이 3개 이상이고 실제로 움직였을 것) · W3 링 ≤ 100ms · W4 구간 도착 ≤ 500ms.
 */
export function worldSyncChecks({ a, b, tol = WORLD_SYNC_TOL, ringMs, segmentMs }) {
  const bad = [];
  if (!Array.isArray(a) || !Array.isArray(b) || a.length === 0 || a.length !== b.length) {
    bad.push(`측정값 없음(표본 ${Array.isArray(a) ? a.length : 0}/${Array.isArray(b) ? b.length : 0}개)`);
  } else {
    const walk = a.filter((s) => s.kind === "walk");
    if (walk.length < 3) bad.push(`걷는 중 표본 ${walk.length}개 < 3`);
    if (!a.some((s) => s.kind === "arrived")) bad.push("도착 뒤 표본 없음");
    let worst = 0;
    let worstAt = "";
    for (let i = 0; i < a.length; i++) {
      const pa = a[i].p;
      const pb = b[i].p;
      if (!pa || !pb) {
        bad.push(`${a[i].kind} 표본 ${i + 1}: 위치를 읽지 못함 (A ${pa ? "있음" : "없음"}, B ${pb ? "있음" : "없음"})`);
        continue;
      }
      if (a[i].t !== b[i].t) bad.push(`${a[i].kind} 표본 ${i + 1}: 두 페이지의 시각 t 가 다름`);
      const d = dist2(pa, pb);
      if (d > worst) {
        worst = d;
        worstAt = `${a[i].kind} 표본 ${i + 1}`;
      }
    }
    if (worst > tol) bad.push(`${worstAt} 두 페이지 위치 차 ${Math.round(worst * 1000) / 1000} > ${tol}`);
    const first = walk[0]?.p;
    const last = walk[walk.length - 1]?.p;
    if (first && last && dist2(first, last) < WORLD_MOVED_MIN) bad.push(`걷는 중 표본이 움직이지 않음 (${Math.round(dist2(first, last) * 1000) / 1000} < ${WORLD_MOVED_MIN})`);
  }
  const timing = (id, label, ms, max) => {
    if (typeof ms !== "number" || !Number.isFinite(ms)) return result(id, label, [`측정값 없음(${label})`]);
    return result(id, label, ms <= max ? [] : [`${Math.round(ms)}ms > ${max}ms`]);
  };
  return [
    result("W2", `두 페이지 손님 위치 차 ≤ ${tol} (걷는 중·도착 뒤)`, bad),
    timing("W3", `탭 → 목적지 링 ${WORLD_RING_MAX_MS}ms 이내`, ringMs, WORLD_RING_MAX_MS),
    timing("W4", `탭 → 손님 구간 시작 ${WORLD_SEGMENT_MAX_MS}ms 이내`, segmentMs, WORLD_SEGMENT_MAX_MS),
  ];
}

/** W12 에서 속도를 재는 이웃 프레임 쌍의 시간 간격 범위(ms) — 너무 붙은 쌍(타이머 잡음)과 멈췄다 온 쌍(탭 전환·정지)은 뺀다. */
const WALK_PAIR_DT_MIN_MS = 4;
const WALK_PAIR_DT_MAX_MS = 100;
/** W12 가 판정하려면 필요한 쌍의 최소 개수. */
const WALK_PAIR_MIN_COUNT = 10;

/**
 * 탭 한 번의 화면 위치 감시로 W11·W12 를 판정한다(G-07-9, 결정 0059).
 * watch = { upWall: number|null, frames: [{ x, z, at }] } — at = 런타임 프레임의 Date.now()(오름차순), upWall = 손 뗀 Date.now().
 * W11: upWall 이전 마지막 프레임(없으면 첫 프레임)을 출발점으로, upWall 보다 늦은 프레임을 세어 출발점에서
 *   WORLD_START_MOVED_MIN 이상 떨어진 첫 프레임이 WORLD_START_MAX_FRAMES 번째 이내면 통과.
 * W12: at 차이가 4~100ms 인 이웃 프레임 쌍의 거리/시간 최대가 WORLD_JUMP_SPEED_MAX 이하면 통과(쌍 10개 미만이면 측정값 없음).
 * watch 가 없거나 upWall 이 수가 아니거나 frames 가 비면 두 행 모두 측정값 없음으로 실패한다.
 */
export function walkStartChecks(watch) {
  const id11 = "W11";
  const label11 = `탭 → 내 캐릭터 화면 출발 ${WORLD_START_MAX_FRAMES}프레임 이내(결정 0059)`;
  const id12 = "W12";
  const label12 = `걷는 동안 화면 위치가 한 프레임에 튀지 않음(≤ ${WORLD_JUMP_SPEED_MAX.toFixed(1)} 단위/초)`;
  const frames = Array.isArray(watch?.frames) ? watch.frames.filter((f) => f && Number.isFinite(f.x) && Number.isFinite(f.z) && Number.isFinite(f.at)) : [];
  const up = watch?.upWall;
  if (typeof up !== "number" || !Number.isFinite(up) || frames.length === 0) {
    const why = `측정값 없음(화면 위치 감시 ${watch ? `upWall ${String(up)}·프레임 ${frames.length}개` : "없음"})`;
    return [result(id11, label11, [why]), result(id12, label12, [why])];
  }
  // W11
  const bad11 = [];
  const before = frames.filter((f) => f.at <= up);
  const after = frames.filter((f) => f.at > up);
  const origin = before.length > 0 ? before[before.length - 1] : frames[0];
  if (after.length === 0) bad11.push("측정값 없음(손 뗀 뒤 프레임 없음)");
  else {
    const k = after.findIndex((f) => Math.hypot(f.x - origin.x, f.z - origin.z) >= WORLD_START_MOVED_MIN);
    if (k < 0) bad11.push(`손 뗀 뒤 프레임 ${after.length}개 동안 화면 출발 없음(이동 < ${WORLD_START_MOVED_MIN})`);
    else if (k + 1 > WORLD_START_MAX_FRAMES) bad11.push(`${k + 1}번째 프레임(${Math.round(after[k].at - up)}ms 뒤)에 출발 > ${WORLD_START_MAX_FRAMES}프레임`);
  }
  // W12
  const bad12 = [];
  let worst = -1;
  let worstAt = 0;
  let pairs = 0;
  for (let i = 1; i < frames.length; i++) {
    const dt = frames[i].at - frames[i - 1].at;
    if (dt < WALK_PAIR_DT_MIN_MS || dt > WALK_PAIR_DT_MAX_MS) continue;
    pairs++;
    const v = (Math.hypot(frames[i].x - frames[i - 1].x, frames[i].z - frames[i - 1].z) / dt) * 1000;
    if (v > worst) {
      worst = v;
      worstAt = frames[i].at - up;
    }
  }
  if (pairs < WALK_PAIR_MIN_COUNT) bad12.push(`측정값 없음(프레임 쌍 ${pairs}개 < ${WALK_PAIR_MIN_COUNT})`);
  else if (worst > WORLD_JUMP_SPEED_MAX) bad12.push(`최대 ${worst.toFixed(2)} 단위/초 > ${WORLD_JUMP_SPEED_MAX.toFixed(1)}(손 뗀 ${Math.round(worstAt)}ms 뒤)`);
  return [result(id11, label11, bad11), result(id12, label12, bad12)];
}

/**
 * NT1 이름표가 잘리지 않는다(MAP-07, 결정 0052-2): 모든 이름표 글자 칸이 scrollWidth === clientWidth, text-overflow 가 말줄임이 아니고, 글자 크기 14px 이상.
 * tags = browser.readWorld().tags — [{ seat, text, scrollWidth, clientWidth, textOverflow, fontSize }]. expectTexts 가 있으면 화면 글자가 기대한 닉네임 그대로인지도 본다.
 */
export function nameTagFitChecks(tags, { expectTexts = [] } = {}) {
  const label = "이름표가 잘리지 않음(말줄임 없음·14px 이상)";
  if (!Array.isArray(tags) || tags.length === 0) return result("NT1", label, ["측정값 없음(이름표가 없음)"]);
  const bad = [];
  for (const t of tags) {
    if (typeof t.scrollWidth !== "number" || typeof t.clientWidth !== "number") {
      bad.push(`자리 ${t.seat} 측정값 없음(scrollWidth·clientWidth)`);
      continue;
    }
    if (t.scrollWidth !== t.clientWidth) bad.push(`자리 ${t.seat} scrollWidth ${t.scrollWidth} ≠ clientWidth ${t.clientWidth}`);
    if (String(t.textOverflow ?? "").includes("ellipsis")) bad.push(`자리 ${t.seat} text-overflow ${t.textOverflow}`);
    if (!(t.fontSize >= NAMETAG_FONT_MIN)) bad.push(`자리 ${t.seat} 글자 ${t.fontSize}px < ${NAMETAG_FONT_MIN}px`);
  }
  for (const want of expectTexts) {
    if (!tags.some((t) => t.text === want)) bad.push(`기대한 이름표 글자 "${want}" 가 화면에 없음`);
  }
  return result("NT1", label, bad);
}

/** 맨 앞 겹침 이름표 면 알파 하한: overlay-ink-strong(0.92). */
export const TAG_FRONT_ALPHA_MIN = 0.9;
/** 겹치지 않는 이름표 면 알파 상한: overlay-ink(0.8) 유지. */
export const TAG_BASE_ALPHA_MAX = 0.85;

/** CSS 색 문자열의 알파: "rgba(14, 19, 38, 0.92)" → 0.92, "rgb(…)" → 1, "transparent" → 0, 읽지 못하면 NaN. */
export function cssAlpha(color) {
  if (typeof color !== "string") return Number.NaN;
  const c = color.trim().toLowerCase();
  if (c === "transparent") return 0;
  const m = /^rgba?\(([^)]*)\)$/.exec(c);
  if (!m) return Number.NaN;
  const parts = m[1].split(/[\s,/]+/).filter(Boolean);
  if (parts.length === 3) return 1;
  if (parts.length !== 4) return Number.NaN;
  const raw = parts[3];
  const v = raw.endsWith("%") ? Number(raw.slice(0, -1)) / 100 : Number(raw);
  return Number.isFinite(v) ? v : Number.NaN;
}

/**
 * NT3 겹친 이름표(UI-SPEC E2, G-06-4): ① 사각형이 겹치는 쌍은 z-index 가 서로 달라 앞뒤가 정해진다 ② 내 이름표가 모두의 위
 * ③ 다른 이름표와 겹치고 겹친 모두보다 위에 있는 맨 앞 이름표의 면은 overlay-ink-strong(알파 ≥ TAG_FRONT_ALPHA_MIN)
 * ④ 어떤 이름표와도 겹치지 않는 이름표의 면은 overlay-ink 80%(알파 ≤ TAG_BASE_ALPHA_MAX).
 * tags = [{ seat, me, rect, z, face }] (face = .mv-tag 의 계산된 배경색). 겹치는 쌍이 없어도 ②·④는 판정한다.
 */
export function tagStackChecks(tags) {
  const label = "겹친 이름표: 내 이름표 맨 위·맨 앞 면 짙음·안 겹치면 80%";
  if (!Array.isArray(tags) || tags.length === 0) return result("NT3", label, ["측정값 없음(이름표가 없음)"]);
  const bad = [];
  const touching = tags.map(() => []);
  for (let i = 0; i < tags.length; i++) {
    for (let j = i + 1; j < tags.length; j++) {
      if (!rectsOverlap(tags[i].rect, tags[j].rect)) continue;
      touching[i].push(j);
      touching[j].push(i);
      if (!Number.isFinite(tags[i].z) || !Number.isFinite(tags[j].z)) bad.push(`자리 ${tags[i].seat}-${tags[j].seat} z-index 를 읽지 못함`);
      else if (tags[i].z === tags[j].z) bad.push(`자리 ${tags[i].seat}-${tags[j].seat} 겹쳤는데 z-index 가 같음 (${tags[i].z})`);
    }
  }
  for (const me of tags.filter((t) => t.me)) {
    for (const o of tags) {
      if (o === me) continue;
      if (Number.isFinite(me.z) && Number.isFinite(o.z) && me.z <= o.z) bad.push(`내 이름표(자리 ${me.seat}) z ${me.z} 가 자리 ${o.seat} z ${o.z} 보다 위가 아님`);
    }
  }
  let faceMissing = false;
  tags.forEach((t, i) => {
    const alpha = cssAlpha(t.face);
    const nearby = touching[i];
    const isFront = nearby.length > 0 && nearby.every((j) => Number.isFinite(t.z) && Number.isFinite(tags[j].z) && t.z > tags[j].z);
    if (nearby.length > 0 && !isFront) return;
    if (!Number.isFinite(alpha)) {
      faceMissing = true;
      return;
    }
    if (isFront && alpha < TAG_FRONT_ALPHA_MIN) bad.push(`자리 ${t.seat} 맨 앞 겹침 이름표 면 알파 ${alpha} < ${TAG_FRONT_ALPHA_MIN} (overlay-ink-strong 이어야 함)`);
    if (nearby.length === 0 && alpha > TAG_BASE_ALPHA_MAX) bad.push(`자리 ${t.seat} 겹치지 않는 이름표 면 알파 ${alpha} > ${TAG_BASE_ALPHA_MAX} (overlay-ink 80% 여야 함)`);
  });
  if (faceMissing) bad.push("측정값 없음(면 색)");
  return result("NT3", label, bad);
}

/**
 * NT4 내 이름표가 스테이지 사각형(헤더 아래 ~ 아래 패널 위, 폭 전체) 안에 있다(MAP-03: 카메라가 따라가 이동 뒤에도 안에 든다).
 * mine = 내 이름표 사각형, stage = { left, top, right, bottom }.
 */
export function ownTagInStageChecks(mine, stage) {
  const label = "내 이름표가 스테이지 사각형 안";
  if (!mine || !stage) return result("NT4", label, ["측정값 없음(내 이름표 또는 스테이지 사각형)"]);
  const bad = [];
  if (mine.left < stage.left - OVERLAP_EPS) bad.push(`왼쪽 ${rd(mine.left)} < ${rd(stage.left)}`);
  if (right(mine) > stage.right + OVERLAP_EPS) bad.push(`오른쪽 ${rd(right(mine))} > ${rd(stage.right)}`);
  if (mine.top < stage.top - OVERLAP_EPS) bad.push(`위 ${rd(mine.top)} < ${rd(stage.top)}`);
  if (bottom(mine) > stage.bottom + OVERLAP_EPS) bad.push(`아래 ${rd(bottom(mine))} > ${rd(stage.bottom)}`);
  return result("NT4", label, bad);
}

/**
 * L7 로비 헤더: [나가기]·[공유] 가 화면 안에서 44px 이상으로 보이고(가운데 점이 그 버튼) 서로 겹치지 않는다.
 * m = browser.readLobbyFrame().header — { leave, share } 각 { rect, hit } | null.
 */
export function lobbyHeaderChecks(m, { w, h }) {
  const label = "헤더 [나가기]·[공유] 44px 이상·겹치지 않음";
  if (!m || !m.leave || !m.share) return result("L7", label, ["측정값 없음([나가기] 또는 [공유])"]);
  const bad = [];
  for (const [name, b] of [["나가기", m.leave], ["공유", m.share]]) {
    if (b.rect.width + OVERLAP_EPS < TAP_MIN || b.rect.height + OVERLAP_EPS < TAP_MIN) bad.push(`[${name}] ${rd(b.rect.width)}x${rd(b.rect.height)} < ${TAP_MIN}`);
    if (!rectInside(b.rect, { left: 0, top: 0, width: w, height: h })) bad.push(`[${name}] 가 화면 밖`);
    if (b.hit !== true) bad.push(`[${name}] 가운데 점을 눌러도 그 버튼이 아님(elementFromPoint)`);
  }
  if (rectsOverlap(m.leave.rect, m.share.rect)) bad.push(`[나가기]·[공유] 겹침 (${overlapText(m.leave.rect, m.share.rect)})`);
  return result("L7", label, bad);
}

/**
 * L8 [시작] 버튼 상태(ROOM-03, UI-SPEC 행동 줄): 방장의 [시작] 은 연결된 사람이 4명 미만이면 흐림(aria-disabled="true", 불투명도 < 1),
 * 4명 이상이면 활성(aria-disabled 없음, 불투명도 1)이고, 버튼 안 숫자는 "연결된 사람 수 / 최대 인원"(예: "4 / 8")이다.
 * s = browser.readLobbyFrame().start — { ariaDisabled, opacity, countText, rect, hit } | null.
 */
export function lobbyStartChecks(s, { n, min = 4, max = 8 }) {
  const label = `[시작] ${n}명: ${n >= min ? "활성" : "흐림"}·숫자 ${n} / ${max}`;
  if (!s) return result("L8", label, ["측정값 없음([시작] 버튼 없음)"]);
  const bad = [];
  const dim = s.ariaDisabled === "true";
  if (n >= min && dim) bad.push("활성이어야 하는데 aria-disabled");
  if (n < min && !dim) bad.push("흐려야 하는데 aria-disabled 아님");
  if (n >= min && !(s.opacity >= 0.99)) bad.push(`활성인데 불투명도 ${s.opacity}`);
  if (n < min && !(s.opacity < 0.99)) bad.push(`흐려야 하는데 불투명도 ${s.opacity}`);
  const wantText = `${n} / ${max}`;
  if (s.countText !== wantText) bad.push(`숫자 '${s.countText ?? ""}' ≠ '${wantText}'`);
  if (s.rect.height + OVERLAP_EPS < TAP_MIN) bad.push(`높이 ${rd(s.rect.height)} < ${TAP_MIN}`);
  return result("L8", label, bad);
}

/** 이름의 그래핌(눈에 보이는 글자) 수. Intl.Segmenter 가 없으면 코드 포인트 수로 센다. */
export function graphemeCount(text) {
  const t = String(text ?? "");
  if (typeof Intl !== "undefined" && typeof Intl.Segmenter === "function") return [...new Intl.Segmenter("ko", { granularity: "grapheme" }).segment(t)].length;
  return [...t].length;
}

/**
 * shared/game/map.ts 의 원문에서 BAR_MASK 줄(28개)을 읽는다 — .mjs 가 TS 를 직접 import 하지 않게 원문 텍스트를 받는다(순수).
 * 못 읽으면 던진다.
 */
export function parseBarMask(source) {
  const m = /export const BAR_MASK[^=]*=\s*\[([\s\S]*?)\];/.exec(String(source));
  if (!m) throw new Error("BAR_MASK 를 찾지 못함");
  const rows = [...m[1].matchAll(/"([.#]+)"/g)].map((x) => x[1]);
  if (rows.length === 0 || rows.some((r) => r.length !== rows.length)) throw new Error("BAR_MASK 줄이 정사각이 아님");
  return rows;
}

/** 마스크의 걸을 수 있는 칸 중심(월드 단위: 원점 −7, 칸 0.5). 행 우선. */
export function walkableCenters(rows) {
  const out = [];
  rows.forEach((row, r) => {
    for (let c = 0; c < row.length; c++) if (row[c] === ".") out.push({ x: -7 + c * 0.5 + 0.25, z: -7 + r * 0.5 + 0.25 });
  });
  return out;
}

/**
 * 탭할 목적지 고르기: from 에서 minDist 이상 떨어진 걸을 수 있는 칸 중심을 먼 순서로 돌려준다(가장 먼 것부터 시도하게).
 * visible(x, z) 이 거짓인 점(화면 밖·헤더·패널 아래)은 뺀다.
 */
export function pickTapTargets(centers, from, { minDist = 3, visible = () => true } = {}) {
  return centers
    .map((p) => ({ ...p, d: dist2(p, from) }))
    .filter((p) => p.d >= minDist && visible(p.x, p.z))
    .sort((p, q) => q.d - p.d);
}

/**
 * world 흐름의 목적지 고르기 기준(07-20). 보이는 칸 중 3 단위 이상 먼 칸이 있으면 그 칸들(먼 순서)과 걷는 길이 1.5초 이상을 쓴다.
 * 로비 스테이지가 채팅 패널로 낮아진 폰(360×560 의 스테이지 248)에는 카메라가 내 캐릭터를 따라 두 화면에 보이는 칸이 모두 3 단위 안이라 그런 칸이 없다 —
 * 그때는 보이는 칸 중 1.5 단위 이상 먼 칸을 먼 순서로 쓰고 걷는 길이 하한을 0.8초로 둔다(걷는 동안 5번 읽는 데 필요한 시간 ≈ 0.5초 + 여유).
 * 걷는 길이 하한은 측정이 걷는 도중에 일어나게 하는 준비 조건이다 — 누르기 44·글자 크기·가로 넘침 같은 화면 판정 기준이 아니다.
 * 반환: { ranked: 먼 순서의 칸, low: 낮은 스테이지 기준을 썼는가, minWalkMs }.
 */
export const WORLD_TAP_MIN_DIST = 3;
export const WORLD_TAP_MIN_DIST_LOW = 1.5;
export const WORLD_WALK_MIN_MS = 1500;
export const WORLD_WALK_MIN_MS_LOW = 800;
export function worldTapRanking(onScreen, from) {
  const far = pickTapTargets(onScreen, from, { minDist: WORLD_TAP_MIN_DIST });
  if (far.length > 0) return { ranked: far, low: false, minWalkMs: WORLD_WALK_MIN_MS };
  return { ranked: pickTapTargets(onScreen, from, { minDist: WORLD_TAP_MIN_DIST_LOW }), low: true, minWalkMs: WORLD_WALK_MIN_MS_LOW };
}

// ---- 재접속·렌더 예산·메모리 검사 (06-18, CONN-04·MAP-05·성공 기준 4 의 자동 몫) ----

/** 재접속 흐름이 종류마다 되풀이하는 횟수(UI-SPEC CONN-04: 각각 10회). 줄이지 않는다. */
export const RECONNECT_ROUNDS = 10;
/** 복구한 뒤 이 시간(ms)이 지나도 재접속 띠가 남아 있으면 안 된다 — 앱의 RESTORED_MS(2000) + 여유 0.5초. */
export const RESTORED_GONE_MS = 2500;
/** 재접속 흐름의 다섯 종류. id 는 시나리오 이름(reconnect/{id})이 된다. */
export const RECONNECT_KINDS = [
  { id: "offline", label: "끊김·복귀(오프라인 3초)", requireBannerSeen: true, requirePainted: false },
  { id: "frozen", label: "화면 껐다 켜기(frozen 5초)", requireBannerSeen: false, requirePainted: false },
  { id: "reload", label: "새로 고침", requireBannerSeen: false, requirePainted: false },
  { id: "lose", label: "WebGL 소실·복구", requireBannerSeen: false, requirePainted: true },
  { id: "lose-idle", label: "WebGL 소실 후 방치(재생성)", requireBannerSeen: false, requirePainted: true },
];
/** src/world/renderer.ts 의 DRAW_CALL_BUDGET 과 같다 — test/unit/e2eContract.test.ts 가 고정한다. */
export const DRAW_CALL_BUDGET = 120;
/** 동적 점광원 상한(UI-SPEC 렌더 성능 게이트 예산: 동적 광원 ≤ 3 + 반구광 1). */
export const POINT_LIGHT_BUDGET = 3;
/** 맵을 5번 열고 닫는 횟수(UI-SPEC 메모리 행). */
export const REOPEN_ROUNDS = 5;

/**
 * 콘솔 경고·오류 허용 목록. 재접속 때문에 생기는 메시지가 아니거나, 시험이 일부러 만든 조건을 브라우저 자신이 기록한 것만 올린다.
 * 앱이 만든 경고·오류는 하나도 올리지 않는다(예: 앱이 던지는 THREE 경고는 허용하지 않고 고친다).
 * kinds = 적용하는 재접속 종류(null 이면 전부), localOnly = 로컬 개발 서버(localhost)에서만.
 */
export const CONSOLE_ALLOW = [
  {
    id: "preload-unused",
    type: "warning",
    pattern: /was preloaded using link preload but not used within a few seconds/,
    kinds: null,
    localOnly: false,
    reason: "v1.0 index.html 의 링크 프리로드(역할 카드·일지·배경 그림)가 로비에서 안 쓰여 브라우저가 17개 한 묶음으로 알리는 경고 — 재접속과 무관한 v1.0 의 기존 동작(로비에 머무는 동안 반복해 나옴)",
  },
  {
    id: "offline-net",
    type: null,
    pattern: /ERR_INTERNET_DISCONNECTED/,
    kinds: ["offline"],
    localOnly: false,
    reason: "시험이 일부러 켠 오프라인 상태에서 브라우저가 실패한 요청·소켓 연결을 직접 기록한 메시지",
  },
  {
    id: "dev-strictmode-socket",
    type: "warning",
    pattern: /WebSocket connection to .* failed: WebSocket is closed before the connection is established/,
    kinds: ["reload"],
    localOnly: true,
    reason: "개발 서버의 React StrictMode 가 첫 마운트의 연결 중 소켓을 정리에서 닫을 때 브라우저가 남기는 경고(배포 빌드에는 없다)",
  },
];

/** 주소가 이 PC 의 로컬 개발 서버인가(deployhold 의 파일 시각 갱신을 허용하는 유일한 조건, T-06-41). */
export function isLocalOrigin(origin) {
  try {
    return LOCAL_HOSTS.includes(new URL(origin).hostname);
  } catch {
    return false;
  }
}

/**
 * 콘솔 항목 [{ type, text }] 을 허용 목록으로 나눈다. warning·error 가 아닌 항목은 처음부터 보지 않는다.
 * 돌려주는 값: { issues: string[] (허용되지 않은 것), allowed: { [id]: 개수 } }
 */
export function consoleIssues(entries, { kind = null, local = false } = {}) {
  const issues = [];
  const allowed = {};
  for (const e of Array.isArray(entries) ? entries : []) {
    if (e?.type !== "warning" && e?.type !== "error") continue;
    const text = String(e.text ?? "");
    const hit = CONSOLE_ALLOW.find((a) => (a.type === null || a.type === e.type) && a.pattern.test(text) && (a.kinds === null || a.kinds.includes(kind)) && (!a.localOnly || local));
    if (hit) allowed[hit.id] = (allowed[hit.id] ?? 0) + 1;
    else issues.push(`[${e.type}] ${text.slice(0, 120)}`);
  }
  return { issues, allowed };
}

const isNumber = (v) => typeof v === "number" && Number.isFinite(v);

/**
 * 재접속 한 종류를 되풀이한 결과 판정(CONN-04·MAP-05, UI-SPEC "연결·복귀 상태"). rounds = 라운드마다
 * { n, console: string[] (허용되지 않은 콘솔 경고·오류), bannerLeft: boolean|null (복구 + 2.5초 뒤 .mf-reconnect 가 남았나, null = 못 읽음),
 *   bannerSeen: boolean (끊긴 동안 띠가 떴나), posDiff: number (같은 순간 두 페이지의 같은 캐릭터 위치 차 최대),
 *   drift: number (복구 전 위치 대비 어긋남 최대), replayed: string[] (복구 뒤 다시 뜬 입장·퇴장 알림), recovered: boolean (카드·띠가 사라지고 맵이 ready),
 *   painted: boolean|null (다시 그려진 첫 프레임이 한 가지 색이 아님) }.
 * opts = { expectedRounds, requireBannerSeen, requirePainted, tol }. 라운드 수가 모자라면 실패다 — 횟수를 줄여 초록을 만들 수 없다.
 */
export function reconnectChecks(rounds, { expectedRounds = RECONNECT_ROUNDS, requireBannerSeen = false, requirePainted = false, tol = WORLD_SYNC_TOL } = {}) {
  const list = Array.isArray(rounds) ? rounds : [];
  const rows = [];
  const each = (pick) => list.map(pick).filter((x) => x !== null);

  const count = list.length;
  const recoveredBad = list.filter((r) => r.recovered !== true).map((r) => `${r.n}회`);
  rows.push(
    result("RC5", `${expectedRounds}회 모두 복구(카드·띠가 사라지고 맵이 열림)`, [
      ...(count === expectedRounds ? [] : [`라운드 ${count}/${expectedRounds}회만 돌았다`]),
      ...(recoveredBad.length > 0 ? [`복구 못 함: ${recoveredBad.slice(0, 5).join(", ")}`] : []),
    ]),
  );

  const consoleBad = each((r) => (Array.isArray(r.console) && r.console.length > 0 ? `${r.n}회 ${r.console[0]}${r.console.length > 1 ? ` 외 ${r.console.length - 1}개` : ""}` : null));
  const consoleUnread = list.filter((r) => !Array.isArray(r.console)).map((r) => `${r.n}회`);
  rows.push(result("RC1", "콘솔 경고·오류 0건", [...(consoleUnread.length > 0 ? [`측정값 없음: ${consoleUnread.slice(0, 5).join(", ")}`] : []), ...consoleBad.slice(0, 3)]));

  const bannerBad = list.filter((r) => r.bannerLeft !== false).map((r) => `${r.n}회 ${r.bannerLeft === true ? "띠가 남음" : "측정값 없음"}`);
  rows.push(result("RC2", `재접속 띠가 사라지고 남지 않음(복구 ${RESTORED_GONE_MS}ms 뒤)`, bannerBad.slice(0, 5)));

  const posBad = list
    .filter((r) => !isNumber(r.posDiff) || !isNumber(r.drift) || r.posDiff > tol || r.drift > tol)
    .map((r) => `${r.n}회 두 페이지 차 ${isNumber(r.posDiff) ? Math.round(r.posDiff * 1000) / 1000 : "측정값 없음"}, 복구 전 대비 ${isNumber(r.drift) ? Math.round(r.drift * 1000) / 1000 : "측정값 없음"} (상한 ${tol})`);
  rows.push(result("RC3", `두 페이지 캐릭터 위치 어긋남 0건(≤ ${tol} 단위)`, posBad.slice(0, 3)));

  const replayBad = list.filter((r) => !Array.isArray(r.replayed) || r.replayed.length > 0).map((r) => `${r.n}회 ${Array.isArray(r.replayed) ? r.replayed.join(" / ") : "측정값 없음"}`);
  rows.push(result("RC4", "복구 뒤 지난 입장·퇴장 알림 재표시 0건", replayBad.slice(0, 3)));

  if (requireBannerSeen) {
    const seenBad = list.filter((r) => r.bannerSeen !== true).map((r) => `${r.n}회`);
    rows.push(result("RC6", "끊긴 동안 재접속 띠가 뜸(띠가 떴다 사라짐)", seenBad.length > 0 ? [`띠가 안 뜬 회: ${seenBad.slice(0, 5).join(", ")}`] : []));
  }
  if (requirePainted) {
    const paintBad = list.filter((r) => r.painted !== true).map((r) => `${r.n}회 ${r.painted === false ? "한 가지 색" : "측정값 없음"}`);
    rows.push(result("RC7", "복구 뒤 첫 프레임이 같은 씬으로 다시 그려짐(한 가지 색이 아님)", paintBad.slice(0, 3)));
  }
  return rows;
}

/** 관찰 창 앞뒤 /api/health version 이 둘 다 비어 있지 않은 글자이고 서로 다르면 true, 아니면 false(읽지 못함 포함). 배포가 있었다는 유일한 신호다. */
export function deployObservedOf(beforeVersion, afterVersion) {
  const readable = (v) => typeof v === "string" && v.trim() !== "";
  return readable(beforeVersion) && readable(afterVersion) && beforeVersion !== afterVersion;
}

/**
 * deployhold(CONN-04·MAP-05) 판정. 라운드 = collectRound 결과 + { socketsKept: boolean|null, deployObserved: boolean|null }.
 * 로컬(local): 이전 판정 그대로 — 10회, 띠가 떠야 통과(reconnectChecks 의 RC1~RC6).
 * 배포 주소: Durable Object 하이버네이션 때문에 배포가 소켓을 끊지 않으므로 띠를 기다리지 않는다. 배포 신호(deployObserved)가 있는 1회만 판정한다:
 *   RC5·RC1~RC4(RC6 없음) + DH1. 신호가 없으면(false·null·없음) 배포 없이 조용히 지나간 창이 초록이 되지 않게, 통과로 세지 않는 DH0 참고 행({ ok: true, info: true }) 하나만 돌려준다.
 * DH1 통과: (bannerSeen false 이고 socketsKept true) 또는 (bannerSeen true 이고 recovered true).
 * DH1 실패: bannerSeen false 인데 socketsKept 가 true 가 아님(소켓이 조용히 바뀜 또는 측정 못 함), bannerSeen true 인데 recovered 가 true 가 아님.
 */
export function deployHoldChecks(rounds, { local = false } = {}) {
  if (local) return reconnectChecks(rounds, { expectedRounds: RECONNECT_ROUNDS, requireBannerSeen: true });
  const list = Array.isArray(rounds) ? rounds : [];
  if (list.length === 0 || list.some((r) => r?.deployObserved !== true)) {
    return [
      {
        id: "DH0",
        label: "배포 직후 확인: 미확인(참고, 판정 아님)",
        ok: true,
        info: true,
        detail: "관찰 창 앞뒤 /api/health version 이 같거나 읽지 못함 — 배포 신호 없음 — 통과로 세지 않음. 배포와 함께 다시 돌려야 한다",
      },
    ];
  }
  const rows = reconnectChecks(list, { expectedRounds: 1, requireBannerSeen: false });
  const bad = [];
  for (const r of list) {
    if (r.bannerSeen === true) {
      if (r.recovered !== true) bad.push(`${r.n}회 띠가 떴으나 복구하지 못함`);
    } else if (r.socketsKept !== true) {
      bad.push(`${r.n}회 띠 없이 소켓이 조용히 바뀜${r.socketsKept === null || r.socketsKept === undefined ? "(소켓 유지 측정값 없음)" : ""}`);
    }
  }
  rows.push(result("DH1", "배포 직후: 띠 없이 소켓이 유지되거나, 띠가 떴으면 사라지고 복구됨", bad.slice(0, 3)));
  return rows;
}

/** 라운드 결과를 한 줄 기록으로(참고 행): 횟수·허용 경고·위치 차 최대·띠 본 횟수. 판정이 아니다. */
export function reconnectSummary(rounds, allowedTotals = {}) {
  const list = Array.isArray(rounds) ? rounds : [];
  const max = (pick) => {
    const v = list.map(pick).filter(isNumber);
    return v.length === 0 ? "읽지 못함" : (Math.round(Math.max(...v) * 10000) / 10000).toString();
  };
  const allowed = Object.entries(allowedTotals)
    .map(([id, n]) => `${id} ${n}`)
    .join(", ");
  return `${list.length}회 · 콘솔 경고·오류 ${list.reduce((a, r) => a + (Array.isArray(r.console) ? r.console.length : 0), 0)}건 · 띠 잔류 ${list.filter((r) => r.bannerLeft === true).length}건 · 위치 차 최대 ${max((r) => r.posDiff)} · 복구 전 대비 최대 ${max((r) => r.drift)} · 띠 본 횟수 ${list.filter((r) => r.bannerSeen).length} · 허용 목록 적용 ${allowed === "" ? "없음" : allowed}`;
}

/**
 * 한 장면의 렌더 예산 판정(성공 기준 4 의 자동 몫, RESEARCH R2.3-6). info = { calls, pointLights?, ... } (window.__mfWorld.debug.info() 또는 __mfPerf.result.renderer).
 * maxCalls 는 draw call 상한, maxPointLights 가 숫자면 점광원도 본다. 값이 없으면 통과하지 않고 측정값 없음으로 실패한다.
 * scene = 결과 표의 구분 글자.
 */
export function budgetChecks(info, { maxCalls = DRAW_CALL_BUDGET, maxPointLights = null, scene = "" } = {}) {
  const tag = scene === "" ? "" : `(${scene})`;
  const rows = [];
  const callsBad = !info || !isNumber(info.calls) ? ["측정값 없음(calls)"] : info.calls > maxCalls ? [`draw call ${info.calls} > ${maxCalls}`] : info.calls <= 0 ? [`draw call ${info.calls} (그려지지 않음)`] : [];
  rows.push(result("B1", `draw call ≤ ${maxCalls}${tag}`, callsBad));
  if (maxPointLights !== null) {
    const lightsBad = !info || !isNumber(info.pointLights) ? ["측정값 없음(pointLights)"] : info.pointLights > maxPointLights ? [`점광원 ${info.pointLights} > ${maxPointLights}`] : [];
    rows.push(result("B2", `동적 점광원 ≤ ${maxPointLights}${tag}`, lightsBad));
  }
  return rows;
}

/**
 * 맵 열고 닫기 뒤 메모리 원복(UI-SPEC 메모리 행): snapshots = [{ geometries, textures }] 첫 칸이 처음 연 맵이고 나머지가 다시 연 맵.
 * 다시 열 때마다 geometries·textures 가 처음 값보다 늘지 않아야 한다(증가 0). expected = 전체 표본 수(처음 + 다시 열기).
 */
export function memoryStableChecks(snapshots, { expected = REOPEN_ROUNDS + 1 } = {}) {
  const label = `맵 ${expected - 1}번 열고 닫아도 geometries·textures 가 늘지 않음`;
  const list = Array.isArray(snapshots) ? snapshots : [];
  const bad = [];
  if (list.length !== expected) bad.push(`표본 ${list.length}/${expected}개`);
  const base = list[0];
  if (!base || !isNumber(base.geometries) || !isNumber(base.textures)) bad.push("측정값 없음(처음 연 맵의 geometries·textures)");
  else {
    list.slice(1).forEach((s, i) => {
      if (!s || !isNumber(s.geometries) || !isNumber(s.textures)) bad.push(`${i + 1}번째 다시 열기: 측정값 없음`);
      else {
        if (s.geometries > base.geometries) bad.push(`${i + 1}번째 geometries ${s.geometries} > 처음 ${base.geometries}`);
        if (s.textures > base.textures) bad.push(`${i + 1}번째 textures ${s.textures} > 처음 ${base.textures}`);
      }
    });
  }
  return result("M1", label, bad);
}

/** 콘솔에 "Too many active WebGL contexts" 경고가 없다(맵을 여러 번 열고 닫을 때 컨텍스트가 새지 않는다). entries = [{ type, text }]. */
export function contextLeakChecks(entries) {
  const hits = (Array.isArray(entries) ? entries : []).filter((e) => /Too many active WebGL contexts/i.test(String(e?.text ?? "")));
  return result("M2", "'Too many active WebGL contexts' 경고 없음", hits.length > 0 ? [`${hits.length}건: ${String(hits[0].text).slice(0, 100)}`] : []);
}

/** 월드 청크(three 렌더러·캐릭터 모듈) 요청 주소인가 — 개발 서버(/src/world/threeRenderer.ts)와 빌드(assets/threeRenderer-해시.js) 모두. */
export function isWorldChunkUrl(url) {
  let path;
  try {
    path = new URL(url).pathname;
  } catch {
    return false;
  }
  return /(?:^|\/)(?:threeRenderer|character)(?:[-.][\w-]+)?\.(?:ts|js)$/.test(path);
}

/**
 * 월드 청크 요청을 막았을 때의 화면 판정(UI-SPEC UI Considerations E1 error): "맵을 불러오지 못했어요" 카드와 [다시 시도] 가 보이고, 캔버스가 없어 흰·검은 화면이 남지 않는다.
 * v = { title: string|null, retryVisible: boolean, canvases: number }
 */
export function chunkFailChecks(v) {
  const label = "청크 요청 실패 → '맵을 불러오지 못했어요' 카드·[다시 시도], 캔버스 없음";
  if (!v || typeof v !== "object") return result("E1", label, ["측정값 없음"]);
  const bad = [];
  if (v.title !== "맵을 불러오지 못했어요") bad.push(`카드 제목 ${v.title === null ? "없음" : `"${v.title}"`}`);
  if (v.retryVisible !== true) bad.push("[다시 시도] 버튼이 안 보임");
  if (v.canvases !== 0) bad.push(`캔버스 ${v.canvases}개가 남음(흰·검은 화면)`);
  return result("E1", label, bad);
}

/**
 * 화면 그림 통계로 "한 가지 바탕색이 아닌가"를 판정한다(소실 후 재생성 뒤 같은 씬으로 첫 프레임이 다시 그려졌나, RESEARCH A9).
 * stats = { distinct: 양자화한 서로 다른 색 수, dominantShare: 가장 흔한 색이 차지하는 비율 }.
 */
export function paintedFromStats(stats) {
  if (!stats || !isNumber(stats.distinct) || !isNumber(stats.dominantShare)) return null;
  return stats.distinct >= 8 && stats.dominantShare < 0.9;
}

/**
 * 실행할 흐름 고르기(06-18): --only 가 없으면 skipByDefault 흐름(deployhold)을 뺀 전부, 있으면 id 에 부분 문자열이 들어 있거나 --only 가 id 로 시작하는 흐름
 * (skipByDefault 라도 --only 로 고르면 돈다). 08-23: --only 는 쉼표로 여러 개를 줄 수 있다(`--only day,ghost`) — 하나라도 맞으면 고른다.
 */
export function selectFlows(flows, only) {
  if (only === null || only === undefined) return flows.filter((f) => f.skipByDefault !== true);
  const keys = String(only).split(",").map((k) => k.trim()).filter((k) => k !== "");
  return flows.filter((f) => keys.some((k) => f.id.includes(k) || k.startsWith(f.id)));
}

// ---- 판결 순간 연출 (09.1.1-13, 결정 0066-3·7, UI-SPEC C) ----
/** 찬반 기록 알약 높이(얼굴만 2단계는 얼굴 지름)와 허용 오차 */
export const BALLOT_PILL_H = 32;
/** 알림 아랫변과 묶음 윗변 사이 간격(--space-md) */
export const BALLOT_GAP_ANNOUNCE = 16;
/** 묶음 아랫변과 패널 윗변 사이 간격(--space-sm) */
export const BALLOT_GAP_PANEL = 8;
/** 이름이 있는 알약 글자 하한 */
export const BALLOT_NAME_MIN = 14;

/**
 * 찬반 기록 묶음 배치 판정(BF1~BF6). root = .mv-ballots 사각형, groups = [{ side, rect }], pills = [{ side, rect, nameFont }](nameFont 는 이름이 없는 2단계에서 null),
 * panelTop = 아래 패널 윗변, announceBottom = 결과 알림 아랫변(알림이 없으면 null), viewport = { w, h }, compact = 얼굴만 2단계.
 * BF1 묶음·알약이 화면 안 · BF2 묶음 윗변 ≥ 알림 아랫변 + 16 · BF3 묶음 아랫변 ≤ 패널 윗변 − 8 · BF4 이름 글자 ≥ 14 · BF5 찬성 묶음이 반대 묶음 위 · BF6 알약(얼굴) 높이 32±1.
 * 0.5px 오차(OVERLAP_EPS)를 허용한다.
 */
export function ballotFitChecks({ root, groups, pills, panelTop, announceBottom, viewport, compact }) {
  const labels = {
    BF1: "찬반 묶음·알약이 화면 안",
    BF2: "묶음 윗변이 결과 알림 아랫변 + 16 아래",
    BF3: "묶음 아랫변이 패널 윗변 − 8 위",
    BF4: `이름 글자 ${BALLOT_NAME_MIN}px 이상`,
    BF5: "찬성 묶음이 반대 묶음보다 위",
    BF6: `알약(2단계는 얼굴) 높이 ${BALLOT_PILL_H}±1`,
  };
  const rectOk = (r) => r && [r.left, r.top, r.width, r.height].every(isNum);
  const groupsOk = Array.isArray(groups) && groups.length > 0 && groups.every((g) => rectOk(g?.rect));
  const pillsOk = Array.isArray(pills) && pills.length > 0 && pills.every((p) => rectOk(p?.rect));
  const vpOk = viewport && isNum(viewport.w) && isNum(viewport.h);
  if (!groupsOk || !pillsOk || !rectOk(root) || !vpOk || !isNum(panelTop)) {
    return Object.entries(labels).map(([id, label]) => noMeasure(id, label, "묶음·알약·패널"));
  }
  const screen = { left: 0, top: 0, right: viewport.w, bottom: viewport.h };
  const out = [...groups, ...pills].filter((x) => !rectInside(x.rect, screen)).map((x) => `${x.side} ${fmt(x.rect.left)},${fmt(x.rect.top)} ${fmt(x.rect.width)}x${fmt(x.rect.height)}`);
  const lines = [result("BF1", labels.BF1, out)];
  const top = Math.min(...groups.map((g) => g.rect.top));
  const lowest = Math.max(...groups.map((g) => bottom(g.rect)));
  lines.push(result("BF2", labels.BF2, isNum(announceBottom) && top < announceBottom + BALLOT_GAP_ANNOUNCE - OVERLAP_EPS ? [`묶음 윗변 ${fmt(top)} < 알림 아랫변 ${fmt(announceBottom)} + ${BALLOT_GAP_ANNOUNCE}`] : []));
  lines.push(result("BF3", labels.BF3, lowest > panelTop - BALLOT_GAP_PANEL + OVERLAP_EPS ? [`묶음 아랫변 ${fmt(lowest)} > 패널 윗변 ${fmt(panelTop)} − ${BALLOT_GAP_PANEL}`] : []));
  const named = pills.filter((p) => !compact && p.nameFont !== null);
  const smallText = named.filter((p) => !isNum(p.nameFont) || p.nameFont < BALLOT_NAME_MIN).map((p) => `${p.side} 글자 ${p.nameFont}`);
  lines.push(result("BF4", labels.BF4, smallText));
  const yes = groups.find((g) => g.side === "yes");
  const no = groups.find((g) => g.side === "no");
  lines.push(!yes || !no ? noMeasure("BF5", labels.BF5, "찬성·반대 묶음 둘") : result("BF5", labels.BF5, yes.rect.top < no.rect.top ? [] : [`찬성 윗변 ${fmt(yes.rect.top)} ≥ 반대 윗변 ${fmt(no.rect.top)}`]));
  const wrong = pills.filter((p) => Math.abs(p.rect.height - BALLOT_PILL_H) > 1 + 1e-9 || (compact && Math.abs(p.rect.width - BALLOT_PILL_H) > 1 + 1e-9)).map((p) => `${p.side} ${fmt(p.rect.width)}x${fmt(p.rect.height)}`);
  lines.push(result("BF6", labels.BF6, wrong));
  return lines;
}

/** 판결 순간 시간표 허용 오차(ms): 관찰 시계는 처형 단계가 화면에 처음 보인 시각이라 서버 시각과 지연만큼 어긋난다 */
export const VERDICT_TOL = { yes: [300, 900], gap: [200, 600], gone: [4200, 5000], pinOff: 400, zoomAt: 700, zoomBackAt: 5450 };

/**
 * 판결 순간 시간표 판정(VT1~VT6). log = 변할 때만 쌓은 기록 [{ t, phase, stage, yes, no, seat, strength, zoom, dim }](t 는 ms, 같은 시계),
 * opts = { passed(처형 성립), candidate(변론자 좌석), expectZoom(스테이지 높이 360 이상) }.
 * 0 = 기록에서 처음 phase "execution" 인 항목의 t.
 * VT1 찬성 묶음 0.6초(0.3~0.9) · VT2 반대 묶음이 찬성 뒤 0.4초(0.2~0.6) 그리고 그 순간 찬성은 이미 있음 · VT3 묶음 사라짐 4.6초(±0.4)
 * VT4 핀이 변론자에게 켜지고(세기 0.5 이상) 부결 4.0초·처형 5.0초(±0.4)에 꺼지기 시작 · VT5 0.7초 뒤 줌 1.10±0.01(작은 스테이지는 내내 1) · VT6 5.45초에 줌 1.
 */
export function verdictTimelineChecks(log, { passed, candidate, expectZoom }) {
  const labels = {
    VT1: "찬성 묶음이 처형 진입 0.6초(0.3~0.9)에 나타난다",
    VT2: "반대 묶음이 찬성 묶음 뒤 0.4초(0.2~0.6)에 나타나고 그때 찬성은 이미 있다",
    VT3: "묶음이 4.6초(±0.4)에 사라진다",
    VT4: `핀 조명이 변론자에게 켜지고 ${passed ? "5.0" : "4.0"}초(±0.4)에 꺼지기 시작한다`,
    VT5: expectZoom ? "0.7초 뒤 카메라 줌 1.10±0.01" : "스테이지 높이 360 미만이라 줌이 한 번도 켜지지 않는다",
    VT6: "5.45초에 줌이 1 로 돌아와 있다",
  };
  const entries = Array.isArray(log) ? [...log].filter((e) => isNum(e?.t)).sort((a, b) => a.t - b.t) : [];
  const first = entries.find((e) => e.phase === "execution");
  if (!first) return Object.entries(labels).map(([id, label]) => noMeasure(id, label, "처형 단계 기록"));
  const t0 = first.t;
  const ex = entries.filter((e) => e.t >= t0 && e.phase === "execution").map((e) => ({ ...e, rel: e.t - t0 }));
  const at = (rel) => [...ex].reverse().find((e) => e.rel <= rel) ?? ex[0];
  const inRange = (v, [lo, hi]) => v >= lo && v <= hi;
  const yesE = ex.find((e) => e.yes === true);
  const noE = ex.find((e) => e.no === true);
  const lines = [];
  lines.push(result("VT1", labels.VT1, yesE && inRange(yesE.rel, VERDICT_TOL.yes) ? [] : [yesE ? `${Math.round(yesE.rel)}ms` : "찬성 묶음을 못 봄"]));
  const gap = yesE && noE ? noE.rel - yesE.rel : null;
  lines.push(result("VT2", labels.VT2, gap !== null && inRange(gap, VERDICT_TOL.gap) && noE.yes === true && yesE.no === false ? [] : [gap === null ? "묶음을 못 봄" : `간격 ${Math.round(gap)}ms · 반대가 나올 때 찬성 ${noE.yes} · 찬성이 나올 때 반대 ${yesE.no}`]));
  const goneE = noE ? ex.find((e) => e.rel > noE.rel && e.stage === null) : null;
  lines.push(result("VT3", labels.VT3, goneE && inRange(goneE.rel, VERDICT_TOL.gone) ? [] : [goneE ? `${Math.round(goneE.rel)}ms` : "사라지지 않음"]));
  const lit = ex.find((e) => e.seat !== null && e.strength >= 0.5);
  const wrongSeat = ex.filter((e) => e.seat !== null && e.seat !== candidate).map((e) => e.seat);
  const offE = lit ? ex.find((e) => e.rel > lit.rel && e.seat === null) : null;
  const offAt = passed ? 5000 : 4000;
  const pinBad = [];
  if (!lit) pinBad.push("핀이 켜지지 않음");
  else if (lit.seat !== candidate) pinBad.push(`좌석 ${lit.seat} (기대 ${candidate})`);
  if (wrongSeat.length > 0) pinBad.push(`다른 좌석 ${[...new Set(wrongSeat)].join(",")}`);
  if (lit && (!offE || Math.abs(offE.rel - offAt) > VERDICT_TOL.pinOff)) pinBad.push(`꺼짐 ${offE ? Math.round(offE.rel) : "없음"}ms (기대 ${offAt}±${VERDICT_TOL.pinOff})`);
  lines.push(result("VT4", labels.VT4, pinBad));
  const z = at(VERDICT_TOL.zoomAt)?.zoom;
  lines.push(
    result("VT5", labels.VT5, expectZoom ? (isNum(z) && Math.abs(z - 1.1) <= 0.01 ? [] : [`0.7초 줌 ${z}`]) : ex.some((e) => e.zoom > 1.0005) ? [`줌 ${Math.max(...ex.map((e) => e.zoom))}`] : []),
  );
  const zb = at(VERDICT_TOL.zoomBackAt)?.zoom;
  lines.push(result("VT6", labels.VT6, isNum(zb) && zb <= 1.005 ? [] : [`5.45초 줌 ${zb}`]));
  return lines;
}

// ---- 10페이즈 동작 버튼·5+4 판 (10-05, 결정 D-1·D-2·D-18, UI-SPEC A-1·A-2) ----

/** 10페이즈가 새로 더한 DOM 표식·훅 이름 4개. test/unit/e2eContract.test.ts 가 각각이 git 추적 src/ 파일에 실제로 있는지 확인한다(이름 오타 방지). 10-07 이 의상 표식 3개를 더했다. 이후 계획(단계)이 같은 목록에 더한다. */
export const AVATAR_MARKERS = Object.freeze([
  "data-emote-button", // 입력줄 맨 앞 동작 버튼(ChatPanel)
  "data-emote-tray", // 5+4 아이콘 판(EmoteTray)
  "data-emote", // 칸 data-emote="{id}"
  "__mfEmotes", // 테스트 훅 window.__mfEmotes = { last, playing }
  "data-dress-sheet", // 로비 꾸미기 시트(DressSheet, 10-07)
  "data-outfit", // 시트의 카드 data-outfit="{id}"
  "__mfLooks", // 테스트 훅 window.__mfLooks = { 좌석: 의상 id }(10-04)
]);

/**
 * 동작 버튼·판 기하(EB1·EP2·TR1~TR5·EP3·EP4). 사각형은 { left, top, width, height }.
 * button = 동작 버튼, input = 입력칸, tray = 판, cells = 칸 아홉 개, nameFont = 칸 이름 글자 크기 최솟값(px), viewport = { w, h },
 * character = 내 캐릭터의 화면 좌표 { x, y }, hasKb = 가상 키보드가 열려 있나.
 * EB1 버튼 48x48 ±1 · EP2 입력칸 폭 ≥ 150 · TR1 판 좌우 16 ±1·폭 = viewport − 32 ±1 · TR2 칸 아홉 개(윗줄 5·아랫줄 4)이고 두 줄 모두 판 가운데 정렬(좌우 여백 차 ≤ 2) ·
 * EP3 칸 폭·높이 ≥ 44 · TR3 판 아랫변 = 입력칸 윗변 − 8 ±2 · EP4 캐릭터 점이 판 사각형 밖 · TR4 이름 글자 ≥ 14 · TR5 판이 열려 있을 때 키보드는 닫혀 있음.
 */
export function emoteTrayChecks({ button, input, tray, cells, nameFont, viewport, character, hasKb } = {}) {
  const L = {
    EB1: `동작 버튼 ${TAP_MIN + 4}x${TAP_MIN + 4}`,
    EP2: "입력칸 폭 150 이상",
    TR1: "판 좌우 16 · 폭 = 폰 폭 − 32",
    TR2: "칸 아홉 개: 윗줄 5 · 아랫줄 4, 두 줄 모두 판 가운데",
    EP3: `칸 누르기 영역 ${TAP_MIN} 이상`,
    TR3: "판 아랫변 = 입력줄 윗변 − 8",
    EP4: "판이 내 캐릭터를 가리지 않음",
    TR4: "칸 이름 글자 14px 이상",
    TR5: "판이 열려 있을 때 키보드는 닫혀 있음",
  };
  const rectOk = (r) => !!r && allNum(r.left, r.top, r.width, r.height);
  const valid = rectOk(button) && rectOk(input) && rectOk(tray) && Array.isArray(cells) && cells.every(rectOk) && !!viewport && allNum(viewport.w, viewport.h) && !!character && allNum(character.x, character.y) && isNum(nameFont) && typeof hasKb === "boolean";
  if (!valid) return Object.entries(L).map(([id, label]) => noMeasure(id, label, "button·input·tray·cells·nameFont·viewport·character·hasKb"));
  const out = [];
  const eb1Bad = Math.abs(button.width - 48) > 1 || Math.abs(button.height - 48) > 1;
  out.push(result("EB1", L.EB1, eb1Bad ? [`${fmt(button.width)}x${fmt(button.height)}`] : []));
  out.push(result("EP2", L.EP2, input.width >= 150 ? [] : [`입력칸 폭 ${fmt(input.width)}`]));
  const t1 = [];
  if (Math.abs(tray.left - 16) > 1) t1.push(`왼쪽 ${fmt(tray.left)}`);
  if (Math.abs(viewport.w - right(tray) - 16) > 1) t1.push(`오른쪽 여백 ${fmt(viewport.w - right(tray))}`);
  if (Math.abs(tray.width - (viewport.w - 32)) > 1) t1.push(`폭 ${fmt(tray.width)} (기대 ${viewport.w - 32})`);
  out.push(result("TR1", L.TR1, t1));
  const t2 = [];
  if (cells.length !== 9) t2.push(`칸 ${cells.length}개`);
  else {
    const tops = [...new Set(cells.map((c) => Math.round(c.top)))].sort((a, b) => a - b);
    const rows = [];
    for (const top of tops) {
      const last = rows[rows.length - 1];
      if (last && top - last.top <= 4) last.n += cells.filter((c) => Math.round(c.top) === top).length;
      else rows.push({ top, n: cells.filter((c) => Math.round(c.top) === top).length });
    }
    if (rows.length !== 2 || rows[0].n !== 5 || rows[1].n !== 4) t2.push(`줄 ${rows.map((r) => r.n).join("+")} (기대 5+4)`);
    else {
      const upper = cells.filter((c) => Math.abs(c.top - rows[0].top) <= 4);
      const lower = cells.filter((c) => Math.abs(c.top - rows[1].top) <= 4);
      for (const [name, row] of [["윗줄", upper], ["아랫줄", lower]]) {
        const l = Math.min(...row.map((c) => c.left)) - tray.left;
        const r = right(tray) - Math.max(...row.map((c) => right(c)));
        if (Math.abs(l - r) > 2) t2.push(`${name} 좌우 여백 ${fmt(l)} / ${fmt(r)}`);
      }
    }
  }
  out.push(result("TR2", L.TR2, t2));
  out.push(result("EP3", L.EP3, cells.filter((c) => c.width + OVERLAP_EPS < TAP_MIN || c.height + OVERLAP_EPS < TAP_MIN).map((c) => `${fmt(c.width)}x${fmt(c.height)}`)));
  const gap = input.top - bottom(tray);
  out.push(result("TR3", L.TR3, Math.abs(gap - 8) > 2 ? [`입력줄 윗변과 간격 ${fmt(gap)} (기대 8)`] : []));
  const covered = character.x >= tray.left && character.x <= right(tray) && character.y >= tray.top && character.y <= bottom(tray);
  out.push(result("EP4", L.EP4, covered ? [`캐릭터 ${fmt(character.x)},${fmt(character.y)} 가 판 안`] : []));
  out.push(result("TR4", L.TR4, nameFont >= 14 ? [] : [`${nameFont}px`]));
  out.push(result("TR5", L.TR5, hasKb ? ["키보드가 열려 있음"] : []));
  return out;
}

// ---- 10페이즈 단계별 동작 도착·비밀 채널 0건·떠 있는 버튼 숨김 (10-08, 결정 D-12·D-18·D-20, UI-SPEC A-5·A-6) ----

/**
 * 동작 프레임 도착 검사. 읽은 값은 각 페이지의 window.__mfEmotes 사본 { last: {seat,id,n}|null, playing: number[] } 뿐이다(DOM 속성은 없다).
 * sender = 보낸 사람 자기 페이지 { name, last, playing } (없으면 null) — 서버가 보낸 사람에게도 프레임을 돌려주므로 mode 와 무관하게 늘 "도착"이어야 한다(ED0).
 * receivers = 다른 페이지들 [{ name, before, last, playing }] — before 는 보내기 전의 last. 줄은 receivers 순서대로 ED1, ED2, …
 * mode "arrive": last 가 { seat: expectSeat, id: expectId } 이고 playing 에 expectSeat 포함. mode "absent": last 가 보내기 전과 같고 playing 에 expectSeat 없음(밤 마피아→시민 편·유령→산 사람, L27).
 */
export function emoteDeliveryChecks({ sender, receivers, expectSeat, expectId, mode } = {}) {
  const arrive = (o) => {
    const bad = [];
    if (!o || !o.last || o.last.seat !== expectSeat || o.last.id !== expectId) bad.push(`last ${JSON.stringify(o?.last ?? null)} (기대 seat ${expectSeat} · id ${expectId})`);
    if (!o || !Array.isArray(o.playing) || !o.playing.includes(expectSeat)) bad.push(`playing ${JSON.stringify(o?.playing ?? null)} 에 ${expectSeat} 없음`);
    return bad;
  };
  const absent = (o) => {
    const bad = [];
    if (JSON.stringify(o?.last ?? null) !== JSON.stringify(o?.before ?? null)) bad.push(`last 가 ${JSON.stringify(o?.before ?? null)} → ${JSON.stringify(o?.last ?? null)} 로 바뀜`);
    if (Array.isArray(o?.playing) && o.playing.includes(expectSeat)) bad.push(`playing ${JSON.stringify(o.playing)} 에 ${expectSeat} 가 있음`);
    return bad;
  };
  const ok = Array.isArray(receivers) && receivers.length > 0 && receivers.every((r) => !!r && Array.isArray(r.playing)) && isNum(expectSeat) && typeof expectId === "string" && (mode === "arrive" || mode === "absent") && (sender == null || Array.isArray(sender.playing));
  if (!ok) return [noMeasure("ED1", "동작 도착 검사", "receivers·expectSeat·expectId·mode(arrive|absent)")];
  const out = [];
  if (sender) out.push(result("ED0", `${sender.name}: 보낸 사람 자기 페이지에도 서버 프레임이 도착(seat ${expectSeat} · ${expectId})`, arrive(sender)));
  receivers.forEach((r, i) => {
    const label = mode === "arrive" ? `${r.name}: 동작 프레임이 도착(seat ${expectSeat} · ${expectId}, playing 에 듦)` : `${r.name}: 동작 프레임이 0건(last 그대로, playing 에 좌석 없음)`;
    const bad = mode === "arrive" ? arrive(r) : absent(r);
    out.push(result(`ED${i + 1}`, label, bad.map((b) => `${r.name} ${b}`)));
  });
  return out;
}

/**
 * 동작 판이 열려 있는 동안 떠 있는 버튼 묶음(.mf-float)이 숨고 닫으면 돌아오는지(10-05 가 CSS 로 구현). 각 값은 { count, shown } —
 * count = .mf-float 요소 수, shown = 그 가운데 computed visibility 가 hidden 이 아닌 수.
 * FT1 열기 전 하나 이상 있고 모두 보임 · FT2 열린 동안 하나 이상 있고 모두 숨음 · FT3 닫은 뒤 모두 보임. 확인할 버튼이 하나도 없으면 셋 다 실패(공허한 통과 금지).
 * 기본판(결정 0072, floatsOn 기본 false)에서는 떠 있는 버튼 자체가 없다 — 세 시점 모두 count 0 이면 통과(없음을 확인하는 것이지 확인을 건너뛰는 것이 아니다), 하나라도 있으면 실패. floatsOn(정통 판)이면 위 규칙.
 */
export function floatTrayChecks({ visibleBefore, hiddenWhileOpen, visibleAfter } = {}, { floatsOn = false } = {}) {
  if (!floatsOn) {
    const LA = {
      FT1: "기본판: 판을 열기 전 떠 있는 버튼이 없음(결정 0072)",
      FT2: "기본판: 판이 열린 동안에도 떠 있는 버튼이 없음",
      FT3: "기본판: 판을 닫은 뒤에도 떠 있는 버튼이 없음",
    };
    const okObs0 = (o) => !!o && isNum(o.count) && isNum(o.shown);
    if (!okObs0(visibleBefore) || !okObs0(hiddenWhileOpen) || !okObs0(visibleAfter)) return Object.entries(LA).map(([id, label]) => noMeasure(id, label, "visibleBefore·hiddenWhileOpen·visibleAfter { count, shown }"));
    const none = (o) => (o.count === 0 ? [] : [`떠 있는 버튼 ${o.count}개가 남아 있음`]);
    return [result("FT1", LA.FT1, none(visibleBefore)), result("FT2", LA.FT2, none(hiddenWhileOpen)), result("FT3", LA.FT3, none(visibleAfter))];
  }
  const L = {
    FT1: "판을 열기 전: 떠 있는 버튼이 있고 모두 보임",
    FT2: "판이 열린 동안: 떠 있는 버튼이 모두 숨음(visibility hidden)",
    FT3: "판을 닫은 뒤: 떠 있는 버튼이 모두 돌아옴",
  };
  const okObs = (o) => !!o && isNum(o.count) && isNum(o.shown);
  if (!okObs(visibleBefore) || !okObs(hiddenWhileOpen) || !okObs(visibleAfter)) return Object.entries(L).map(([id, label]) => noMeasure(id, label, "visibleBefore·hiddenWhileOpen·visibleAfter { count, shown }"));
  const show = (o) => {
    if (o.count < 1) return ["떠 있는 버튼이 하나도 없음(확인할 것이 없다)"];
    return o.shown === o.count ? [] : [`보이는 것 ${o.shown}/${o.count}`];
  };
  const hide = (o) => {
    if (o.count < 1) return ["떠 있는 버튼이 하나도 없음(확인할 것이 없다)"];
    return o.shown === 0 ? [] : [`아직 보이는 것 ${o.shown}/${o.count}`];
  };
  return [result("FT1", L.FT1, show(visibleBefore)), result("FT2", L.FT2, hide(hiddenWhileOpen)), result("FT3", L.FT3, show(visibleAfter))];
}

// ---- 10페이즈 로비 꾸미기 버튼·시트·카드 띠 (10-07, 결정 D-4·D-5·D-18, UI-SPEC B-1·B-2) ----

/**
 * 꾸미기 기하(DB1·DS1~DS6). 사각형은 { left, top, width, height }.
 * float = 떠 있는 꾸미기 버튼(시트가 닫힌 때), panel = 로비 아래 패널, sheet = 열린 시트, cards = 카드 아홉 개(띠 안에서 가려져도 DOM 사각형),
 * close = 닫기 버튼, selected = { rect, pressedCount }(선택 카드와 aria-pressed="true" 개수), nameFont = 카드 이름 글자 크기 최솟값(px), viewport = { w, h }, kb = 가상 키보드가 열려 있나.
 * DB1 버튼 52x52 ±1(16-06 오른쪽 열의 한 칸) · 오른쪽 여백 16 ±1(두 열로 접히면 둘째 열 80) · 아랫변 ≤ 패널 윗변 − 8(키보드가 열려 있으면 보지 않는다) ·
 * DS1 시트 윗변 = 패널 윗변 ±1, 높이 = 패널 높이 ±1(키보드가 열려 있으면 윗변은 보지 않는다) · DS2 카드 아홉 개, 폭 72 ±2, 높이 44 이상 ·
 * DS3 완전히 보이는 카드 4 이상이고 시트 오른쪽 가장자리에 걸쳐 8px 이상 보이는 다음 카드가 있음(더 있음을 알림) · DS4 닫기 44x44 이상 ·
 * DS5 선택 카드가 시트 가로 안에 완전히 보이고 aria-pressed="true" 가 하나뿐 · DS6 이름 글자 14px 이상.
 */
export function dressChecks({ float, panel, sheet, cards, close, selected, nameFont, viewport, kb } = {}) {
  const L = {
    DB1: `옷장 버튼 ${SIDE_BUTTON_SIZE}x${SIDE_BUTTON_SIZE}(오른쪽 열) · 오른쪽 ${FLOAT_MARGIN} · 아랫변이 패널 윗변 − ${FLOAT_GAP} 위`,
    DS1: "시트가 아래 패널을 정확히 덮음(윗변·높이)",
    DS2: "카드 아홉 개: 폭 72 · 높이 44 이상",
    DS3: "완전히 보이는 카드 4장 이상 + 오른쪽에 걸친 다음 카드",
    DS4: `닫기 ${TAP_MIN}x${TAP_MIN} 이상`,
    DS5: "선택 카드가 보이고 aria-pressed=true 는 하나",
    DS6: "카드 이름 글자 14px 이상",
  };
  const rectOk = (r) => !!r && allNum(r.left, r.top, r.width, r.height);
  const valid = rectOk(float) && rectOk(panel) && rectOk(sheet) && Array.isArray(cards) && cards.every(rectOk) && rectOk(close) && !!selected && rectOk(selected.rect) && isNum(selected.pressedCount) && isNum(nameFont) && !!viewport && allNum(viewport.w, viewport.h) && typeof kb === "boolean";
  if (!valid) return Object.entries(L).map(([id, label]) => noMeasure(id, label, "float·panel·sheet·cards·close·selected·nameFont·viewport·kb"));
  const out = [];
  const db = [];
  if (Math.abs(float.width - SIDE_BUTTON_SIZE) > 1 || Math.abs(float.height - SIDE_BUTTON_SIZE) > 1) db.push(`${fmt(float.width)}x${fmt(float.height)}`);
  // 열이 하나면 오른쪽 여백 16, 넘쳐 두 열로 접히면(V-3) 옷장이 둘째 열(왼쪽 12 옆)에 서서 16 + 52 + 12 = 80 이다
  const margin = viewport.w - right(float);
  if (Math.abs(margin - FLOAT_MARGIN) > 1 && Math.abs(margin - (FLOAT_MARGIN + SIDE_BUTTON_SIZE + SIDE_GAP)) > 1) db.push(`오른쪽 여백 ${fmt(margin)} (기대 ${FLOAT_MARGIN} 또는 둘째 열 ${FLOAT_MARGIN + SIDE_BUTTON_SIZE + SIDE_GAP})`);
  if (!kb && bottom(float) > panel.top - FLOAT_GAP + OVERLAP_EPS) db.push(`아랫변 ${fmt(bottom(float))} (패널 윗변 − ${FLOAT_GAP} = ${fmt(panel.top - FLOAT_GAP)} 아래로 넘음)`);
  out.push(result("DB1", L.DB1, db));
  const ds1 = [];
  if (!kb && Math.abs(sheet.top - panel.top) > 1) ds1.push(`윗변 ${fmt(sheet.top)} (패널 ${fmt(panel.top)})`);
  if (Math.abs(sheet.height - panel.height) > 1) ds1.push(`높이 ${fmt(sheet.height)} (패널 ${fmt(panel.height)})`);
  out.push(result("DS1", L.DS1, ds1));
  const ds2 = [];
  if (cards.length !== 9) ds2.push(`카드 ${cards.length}개`);
  for (const c of cards) {
    if (Math.abs(c.width - 72) > 2) ds2.push(`폭 ${fmt(c.width)}`);
    if (c.height + OVERLAP_EPS < TAP_MIN) ds2.push(`높이 ${fmt(c.height)}`);
  }
  out.push(result("DS2", L.DS2, ds2));
  const edge = right(sheet);
  const full = cards.filter((c) => c.left >= sheet.left - 0.5 && right(c) <= edge + 0.5).length;
  const peek = cards.find((c) => c.left < edge - 8 && right(c) > edge + 0.5);
  const ds3 = [];
  if (full < 4) ds3.push(`완전히 보이는 카드 ${full}장`);
  if (!peek) ds3.push("오른쪽에 걸쳐 보이는 다음 카드 없음");
  out.push(result("DS3", L.DS3, ds3));
  out.push(result("DS4", L.DS4, close.width + OVERLAP_EPS < TAP_MIN || close.height + OVERLAP_EPS < TAP_MIN ? [`${fmt(close.width)}x${fmt(close.height)}`] : []));
  const ds5 = [];
  if (selected.rect.left < sheet.left - 0.5 || right(selected.rect) > edge + 0.5) ds5.push(`선택 카드 ${fmt(selected.rect.left)}~${fmt(right(selected.rect))} 가 시트 밖`);
  if (selected.pressedCount !== 1) ds5.push(`aria-pressed=true ${selected.pressedCount}개`);
  out.push(result("DS5", L.DS5, ds5));
  out.push(result("DS6", L.DS6, nameFont >= 14 ? [] : [`${nameFont}px`]));
  return out;
}

// ---- 12페이즈 소리 시험 페이지 sound-render (12-06, 결정 D-18·D-19, UI-SPEC E) ----

/** 12페이즈가 새로 더한 시험 페이지 DOM 표식·훅 이름. test/unit/e2eContract.test.ts 가 각각이 git 추적 src/ 파일에 실제로 있는지 확인한다(이름 오타 방지). 이후 계획(소리 단계)이 같은 목록에 더한다. */
export const SOUND_MARKERS = Object.freeze([
  "data-sound-lab", // 시험 페이지 루트(soundLab.ts)
  "data-sound-id", // 소리 ▶ 단추 data-sound-id="{id}" (70개)
  "__mfSound", // 테스트 훅 window.__mfSound = { state, on, bed, voices, log, clear }(12-05)
  "__mfSoundLab", // 시험 페이지 훅 window.__mfSoundLab = { done, results }
  "data-sound-button", // 방 화면 소리 단추(SoundButton.tsx, 12-07) — 방 화면에 정확히 하나
  "data-sound-state", // 소리 단추 상태 on|off|locked (역할·좌석 값 없음)
]);

/**
 * 오프라인 렌더 합격 문턱 (D-18). 낮추지 않는다: 실패하면 레시피를 고친다(T-12-22).
 * count 는 SOUND_IDS.length, 나머지는 src/debug/soundLabData.ts 의 SOUND_LIMITS 와 같아야 하고 e2eContract 시험이 대조한다.
 */
export const SOUND_RENDER_LIMITS = Object.freeze({ count: 70, peakMaxDb: -3, rmsMinDb: -60, lengthTolMs: 50 });

/**
 * sound-render: 시험 페이지 [전부 계산] 결과(window.__mfSoundLab.results)를 판정한다.
 * results = [{ id, peakDb, rmsDb, nan, lengthMs, declaredMs(침대는 null) }].
 * SR1 정확히 count 개 · SR2 id 중복 없음 · SR3 피크 ≤ peakMaxDb · SR4 NaN 0 · SR5 RMS ≥ rmsMinDb · SR6 효과음 길이가 선언과 lengthTolMs 이내.
 * 실패 줄의 detail 에 실패한 id 와 값을 적는다.
 */
export function soundRenderChecks(results, limits = SOUND_RENDER_LIMITS) {
  const L = {
    SR1: `렌더 결과 ${limits.count}개`,
    SR2: "소리 id 중복 없음",
    SR3: `피크 ${limits.peakMaxDb} dBFS 이하`,
    SR4: "NaN 0",
    SR5: `RMS ${limits.rmsMinDb} dB 이상`,
    SR6: `효과음 길이가 선언과 ±${limits.lengthTolMs}ms`,
  };
  const valid = Array.isArray(results) && results.every((r) => !!r && typeof r.id === "string" && allNum(r.peakDb, r.rmsDb, r.nan, r.lengthMs) && (r.declaredMs === null || isNum(r.declaredMs)));
  if (!valid) return Object.entries(L).map(([id, label]) => noMeasure(id, label, "results[{ id, peakDb, rmsDb, nan, lengthMs, declaredMs }]"));
  const out = [];
  out.push(result("SR1", L.SR1, results.length === limits.count ? [] : [`${results.length}개`]));
  const seen = new Set();
  const dup = [];
  for (const r of results) {
    if (seen.has(r.id)) dup.push(r.id);
    seen.add(r.id);
  }
  out.push(result("SR2", L.SR2, dup));
  out.push(result("SR3", L.SR3, results.filter((r) => r.peakDb > limits.peakMaxDb).map((r) => `${r.id} ${fmt(r.peakDb)}`)));
  out.push(result("SR4", L.SR4, results.filter((r) => r.nan !== 0).map((r) => `${r.id} NaN ${r.nan}`)));
  out.push(result("SR5", L.SR5, results.filter((r) => r.rmsDb < limits.rmsMinDb).map((r) => `${r.id} ${fmt(r.rmsDb)}`)));
  out.push(
    result(
      "SR6",
      L.SR6,
      results.filter((r) => r.declaredMs !== null && Math.abs(r.lengthMs - r.declaredMs) > limits.lengthTolMs).map((r) => `${r.id} ${fmt(r.lengthMs)}ms (선언 ${fmt(r.declaredMs)})`),
    ),
  );
  return out;
}

// ---- 12페이즈 소리 단추 sound-unlock (12-07, 결정 D-4·D-21, UI-SPEC B-1·B-2) ----

/** 소리 단추 기하(16-06 V-2·V-4): 상자가 곧 면이라 누르기 = 시각 지름 52 ±1, 자막 띠 아랫변에서 12 아래 ±2, 오른쪽 여백 16 ±2, 알약 높이 52 · 폭 112 이상 */
export const SOUND_BUTTON_GEOMETRY = Object.freeze({ tap: 52, disc: 52, discTol: 1, gap: 12, margin: 16, posTol: 2, pillH: 52, pillMinW: 112 });
const SOUND_NAMES = Object.freeze({ on: "소리 끄기", off: "소리 켜기", locked: "소리 켜기" });

/**
 * 방 화면 소리 단추 위치·겹침·접근성 (sound-unlock). 사각형은 { left, top, width, height }.
 * viewport = { w, h } · button = { count, rect(누르기 영역), disc(시각 원/알약), pill } · header = { bottom(헤더 아래 끝), buttons[{kind, rect}] } ·
 * test = [테스트] 사각형|null · toast = TopToast 글자 사각형|null · bannerHit = { present, covers(띠가 단추 중심을 덮음), hitIsButton(그 점의 최상단이 단추) } · labels = { state, name, pressed }.
 * SU1 정확히 하나 · SU2 누르기 ≥ 44×44 · SU3 위 = 헤더 아래 끝 + 8 (±2) · 오른쪽 여백 16 (±2) · SU4 헤더 단추·[테스트]·TopToast 와 겹침 0 ·
 * SU5 재접속 띠가 단추 중심을 덮을 때 최상단이 단추 자신(띠가 없거나 덮지 않으면 확인한 것이 없어 실패 — 공허한 통과 금지) ·
 * SU6 시각 지름 36 (±1), 알약이면 높이 44 · 폭 112 이상 · SU7 접근성 이름이 상태에 맞음(on '소리 끄기' · off/locked '소리 켜기', aria-pressed).
 */
export function soundButtonChecks({ viewport, button, header, test, toast, bannerHit, labels } = {}) {
  const G = SOUND_BUTTON_GEOMETRY;
  const L = {
    SU1: "방 화면에 소리 단추가 정확히 하나",
    SU2: `누르기 영역 ${G.tap}x${G.tap} 이상`,
    SU3: `위 = 헤더(자막 띠가 있으면 띠) 아래 끝 + ${G.gap} · 오른쪽 여백 ${G.margin} (±${G.posTol})`,
    SU4: "헤더 단추·[테스트]·토스트 글자와 겹침 0",
    SU5: "재접속 띠가 떠 있어도 단추 중심의 최상단이 단추 자신",
    SU6: `시각 지름 ${G.disc}±${G.discTol} (알약은 높이 ${G.pillH} · 폭 ${G.pillMinW} 이상)`,
    SU7: "접근성 이름·aria-pressed 가 상태에 맞음",
  };
  const okRect = (r) => !!r && allNum(r.left, r.top, r.width, r.height);
  const okButton = !!button && isNum(button.count) && okRect(button.rect) && okRect(button.disc);
  const okHeader = !!header && isNum(header.bottom) && Array.isArray(header.buttons) && header.buttons.every((b) => !!b && okRect(b.rect));
  const okOpt = (r) => r === null || r === undefined || okRect(r);
  const need = (cond, id, what) => (cond ? null : noMeasure(id, L[id], what));
  const missing = [
    need(okButton && !!viewport && allNum(viewport.w, viewport.h), "SU1", "viewport { w, h } · button { count, rect, disc }"),
  ];
  if (missing[0] || !okHeader || !okOpt(test) || !okOpt(toast) || !bannerHit || typeof bannerHit.present !== "boolean" || !labels) {
    return Object.entries(L).map(([id, label]) => noMeasure(id, label, "viewport · button · header { bottom, buttons } · test · toast · bannerHit { present, covers, hitIsButton } · labels { state, name, pressed }"));
  }
  const r = button.rect;
  const out = [];
  out.push(result("SU1", L.SU1, button.count === 1 ? [] : [`${button.count}개`]));
  out.push(result("SU2", L.SU2, r.width >= G.tap && r.height >= G.tap ? [] : [`${fmt(r.width)}x${fmt(r.height)}`]));
  const bad3 = [];
  const dTop = r.top - (header.bottom + G.gap);
  if (Math.abs(dTop) > G.posTol) bad3.push(`위 ${fmt(r.top)} (헤더(띠) 아래 끝 ${fmt(header.bottom)} + ${G.gap} 과 ${fmt(dTop)})`);
  const marginRight = viewport.w - right(r);
  if (Math.abs(marginRight - G.margin) > G.posTol) bad3.push(`오른쪽 여백 ${fmt(marginRight)} (기대 ${G.margin})`);
  out.push(result("SU3", L.SU3, bad3));
  const bad4 = [];
  for (const b of header.buttons) if (rectsOverlap(r, b.rect)) bad4.push(`헤더 ${b.kind} (${overlapText(r, b.rect)})`);
  if (test && rectsOverlap(r, test)) bad4.push(`[테스트] (${overlapText(r, test)})`);
  if (toast && rectsOverlap(r, toast)) bad4.push(`토스트 (${overlapText(r, toast)})`);
  out.push(result("SU4", L.SU4, bad4));
  const bad5 = [];
  // 14페이즈: 소리 단추가 띠 아래 독으로 내려와 재접속 띠가 더는 단추 중심을 덮지 않는다 — 덮든 안 덮든 단추 중심의 최상단이 단추 자신이어야 한다(띠가 없으면 확인한 것이 없어 실패)
  if (!bannerHit.present) bad5.push("재접속 띠가 떠 있지 않아 확인할 것이 없다");
  else if (bannerHit.hitIsButton !== true) bad5.push(bannerHit.covers === true ? "띠가 단추 중심을 덮고 있다(단추가 눌리지 않음)" : "단추 중심의 최상단이 단추가 아님");
  out.push(result("SU5", L.SU5, bad5));
  const d = button.disc;
  const bad6 = [];
  if (button.pill === true) {
    if (Math.abs(d.height - G.pillH) > G.discTol) bad6.push(`알약 높이 ${fmt(d.height)}`);
    if (d.width < G.pillMinW) bad6.push(`알약 폭 ${fmt(d.width)}`);
  } else {
    if (Math.abs(d.width - G.disc) > G.discTol) bad6.push(`지름(폭) ${fmt(d.width)}`);
    if (Math.abs(d.height - G.disc) > G.discTol) bad6.push(`지름(높이) ${fmt(d.height)}`);
  }
  out.push(result("SU6", L.SU6, bad6));
  const want = SOUND_NAMES[labels.state];
  const bad7 = [];
  if (want === undefined) bad7.push(`알 수 없는 상태 ${String(labels.state)}`);
  else {
    if (labels.name !== want) bad7.push(`이름 '${labels.name}' (기대 '${want}')`);
    const wantPressed = labels.state === "on" ? "true" : "false";
    if (labels.pressed !== wantPressed) bad7.push(`aria-pressed ${labels.pressed} (기대 ${wantPressed})`);
  }
  out.push(result("SU7", L.SU7, bad7));
  return out;
}

// ---- 16페이즈 오른쪽 세로 한 줄 열 sideColumnChecks (16-06, 결정 D-05, UI-SPEC V-2~V-5) ----

/** 열 단추의 위 → 아래 순서(오른쪽 열부터, 열 안은 위부터). 맵·봇은 방장에게만 있다 */
export const SIDE_ORDER = Object.freeze(["sound", "map", "bots", "dress"]);
/** 앱이 더한 DOM 표식(16-06). 값은 SIDE_ORDER 의 고정 낱말뿐이다(역할·좌석 없음, T-16-14). e2eContract 가 git 추적 src/ 에 있는지·값이 낱말뿐인지 본다 */
export const SIDE_MARKERS = Object.freeze(["data-side-column", "data-side-button"]);

/**
 * 알려진 한계로 두고 고치지 않는 폰·화면 조합(사용자 메모 '작은 화면 문제는 그대로', UI Considerations #21 unresolved, 결정 0079).
 * 360×560 방장 대기실은 열 두 개와 아래 패널(250)이 겹칠 수 있다 — 14 의 위쪽 비좁음과 같은 한계. 이 조합의 SC2(교차)는 잰 값을 남기되 실패로 세지 않는다.
 * 목록 밖 조합은 그대로 판정한다 — 예외를 넓히려면 이유를 적어 여기에 한 줄을 더해야 한다.
 */
export const SIDE_COLUMN_EXCEPTIONS = Object.freeze([
  Object.freeze({ w: 360, h: 560, host: true, screen: "lobby", reason: "360×560 방장 대기실: 열 두 개와 아래 패널이 겹칠 수 있는 알려진 한계(UI Considerations #21, 결정 0079)" }),
]);

/**
 * 오른쪽 열 판정 (SC1~SC6). 사각형은 { left, top, width, height, right, bottom }.
 * s = { viewport {w,h} · screen "lobby"|"result"|"game" · host 방장 화면인가 · mapsOn·botsOn 이 방에서 맵·봇 도구가 켜져 있나 ·
 *       buttons [{ side, rect, pill? }]([data-side-button]) · band 자막 띠 면 사각형|null · panelTop 아래 패널 윗변|null ·
 *       head [{ kind, rect }] 머리 단추(나가기·공유) · expectHead 머리 단추 개수(기본 2) · test [테스트] 사각형|null }.
 * SC1 열 단추는 지름 52±1 원(알약 소리는 높이 52±1·폭 112 이상) · SC2 열 단추끼리·자막 띠(좌우·아래 8 여유)·아래 패널(윗변 − 8)·머리 단추·[테스트] 와 교차 0(예외 조합은 SIDE_COLUMN_EXCEPTIONS) ·
 * SC3 방장은 map(mapsOn)·bots(botsOn)가 있고 손님은 없다, 소리·옷장(대기실·결과)이 있고 순서는 sound·map·bots·dress ·
 * SC4 머리에는 44 정사각 단추뿐(개수 expectHead) · SC5 열 윗변 = 띠 아랫변 + 12 ±2, 가장 오른쪽 단추의 오른쪽 여백 16 ±1 ·
 * SC6 열 안 간격 12 ±1, 두 열이면 열 사이 12 ±1, 첫 열(오른쪽)은 두 칸 이상.
 */
export function sideColumnChecks(s = {}) {
  const L = {
    SC1: `열 단추는 지름 ${SIDE_BUTTON_SIZE}±1 원(소리 알약은 높이 ${SIDE_BUTTON_SIZE}·폭 ${SOUND_BUTTON_GEOMETRY.pillMinW} 이상)`,
    SC2: "열 단추끼리·자막 띠(좌우·아래 8 이내)·아래 패널·머리 단추·[테스트]와 교차 0",
    SC3: "방장은 맵·봇(켜진 방), 손님은 없다 · 소리·옷장 · 순서 소리·맵·봇·옷장",
    SC4: "머리 단추는 44 정사각뿐(나가기·공유)",
    SC5: `열 윗변 = 띠 아랫변 + ${SIDE_GAP}(±2) · 오른쪽 여백 16(±1)`,
    SC6: `열 안 간격 ${SIDE_GAP}(±1) · 열 사이 ${SIDE_GAP}(±1) · 첫 열은 두 칸 이상`,
  };
  const rectOk = (r) => !!r && allNum(r.left, r.top, r.width, r.height);
  const valid =
    !!s.viewport && allNum(s.viewport.w, s.viewport.h) && typeof s.host === "boolean" && ["lobby", "result", "game"].includes(s.screen) &&
    Array.isArray(s.buttons) && s.buttons.length > 0 && s.buttons.every((b) => !!b && typeof b.side === "string" && rectOk(b.rect)) &&
    (s.band === null || s.band === undefined || rectOk(s.band)) && Array.isArray(s.head) && s.head.every((b) => !!b && rectOk(b.rect)) &&
    (s.test === null || s.test === undefined || rectOk(s.test)) && (s.panelTop === null || s.panelTop === undefined || isNum(s.panelTop));
  if (!valid) return Object.entries(L).map(([id, label]) => noMeasure(id, label, "viewport·screen·host·buttons[{side, rect}]·band·panelTop·head·test"));
  const out = [];
  // 소리 잠김 알약(8초)은 왼쪽으로 늘어나므로 교차·열 판정에는 오른쪽 52 몫만 쓴다(오른쪽 변은 움직이지 않는다). 크기(SC1)는 상자 전체로 본다
  const btns = s.buttons.map((b) => ({ side: b.side, raw: b.rect, pill: b.pill === true, r: b.pill === true ? { left: right(b.rect) - SIDE_BUTTON_SIZE, top: b.rect.top, width: SIDE_BUTTON_SIZE, height: b.rect.height, right: right(b.rect), bottom: bottom(b.rect) } : b.rect }));
  const D = SIDE_BUTTON_SIZE;
  const bad1 = [];
  for (const b of btns) {
    const wOk = b.pill ? b.raw.width + OVERLAP_EPS >= SOUND_BUTTON_GEOMETRY.pillMinW : Math.abs(b.raw.width - D) <= 1;
    if (!wOk || Math.abs(b.raw.height - D) > 1) bad1.push(`${b.side} ${fmt(b.raw.width)}x${fmt(b.raw.height)}`);
  }
  out.push(result("SC1", L.SC1, bad1));

  const bad2 = [];
  for (let i = 0; i < btns.length; i++) for (let j = i + 1; j < btns.length; j++) if (rectsOverlap(btns[i].r, btns[j].r)) bad2.push(`${btns[i].side}·${btns[j].side} (${overlapText(btns[i].r, btns[j].r)})`);
  if (s.band) {
    const fat = { left: s.band.left - 8, top: s.band.top, right: right(s.band) + 8, bottom: bottom(s.band) + 8 };
    fat.width = fat.right - fat.left;
    fat.height = fat.bottom - fat.top;
    for (const b of btns) if (rectsOverlap(b.r, fat)) bad2.push(`${b.side} 가 자막 띠 주변 8 안 (${overlapText(b.r, fat)})`);
  }
  if (isNum(s.panelTop)) for (const b of btns) if (bottom(b.r) > s.panelTop - 8 + OVERLAP_EPS) bad2.push(`${b.side} 아랫변 ${fmt(bottom(b.r))} > 패널 윗변 − 8 = ${fmt(s.panelTop - 8)}`);
  for (const h of s.head) for (const b of btns) if (rectsOverlap(b.r, h.rect)) bad2.push(`${b.side}·머리 ${h.kind ?? "?"} (${overlapText(b.r, h.rect)})`);
  if (s.test) for (const b of btns) if (rectsOverlap(b.r, s.test)) bad2.push(`${b.side}·[테스트] (${overlapText(b.r, s.test)})`);
  const exc = SIDE_COLUMN_EXCEPTIONS.find((e) => e.w === s.viewport.w && e.h === s.viewport.h && e.host === s.host && e.screen === s.screen);
  if (exc && bad2.length > 0) out.push({ id: "SC2", label: L.SC2, ok: true, detail: `알려진 한계(판정 아님): ${exc.reason} — ${bad2.join("; ")}`, known: true, info: true });
  else out.push(result("SC2", L.SC2, bad2));

  const bad3 = [];
  const sides = btns.map((b) => b.side);
  const count = (k) => sides.filter((x) => x === k).length;
  const unknown = sides.filter((x) => !SIDE_ORDER.includes(x));
  if (unknown.length > 0) bad3.push(`알 수 없는 표식 ${unknown.join(",")}`);
  if (count("sound") !== 1) bad3.push(`소리 ${count("sound")}개`);
  if (s.screen !== "game" && count("dress") !== 1) bad3.push(`옷장 ${count("dress")}개`);
  if (s.screen === "game" && count("dress") !== 0) bad3.push(`게임 화면에 옷장 ${count("dress")}개`);
  const wantMap = s.host && s.screen !== "game" && s.mapsOn === true;
  const wantBots = s.host && s.screen === "lobby" && s.botsOn === true;
  if (count("map") !== (wantMap ? 1 : 0)) bad3.push(`맵 ${count("map")}개(기대 ${wantMap ? 1 : 0})`);
  if (count("bots") !== (wantBots ? 1 : 0)) bad3.push(`봇 ${count("bots")}개(기대 ${wantBots ? 1 : 0})`);
  // 순서: 오른쪽 열(오른쪽변이 큰 쪽)부터, 열 안은 위부터
  const ordered = [...btns].sort((a, b) => (Math.abs(right(b.r) - right(a.r)) > 6 ? right(b.r) - right(a.r) : a.r.top - b.r.top)).map((b) => b.side).filter((x) => SIDE_ORDER.includes(x));
  const want = SIDE_ORDER.filter((x) => ordered.includes(x));
  if (ordered.join(",") !== want.join(",")) bad3.push(`순서 ${ordered.join("·")} (기대 ${want.join("·")})`);
  out.push(result("SC3", L.SC3, bad3));

  const bad4 = [];
  const expectHead = s.expectHead ?? 2;
  if (s.head.length !== expectHead) bad4.push(`머리 단추 ${s.head.length}개(기대 ${expectHead})`);
  for (const h of s.head) if (Math.abs(h.rect.width - TAP_MIN) > 1 || Math.abs(h.rect.height - TAP_MIN) > 1) bad4.push(`${h.kind ?? "?"} ${fmt(h.rect.width)}x${fmt(h.rect.height)}`);
  out.push(result("SC4", L.SC4, bad4));

  const bad5 = [];
  if (!s.band) bad5.push("자막 띠 사각형 없음(기준을 알 수 없다)");
  else {
    const top = Math.min(...btns.map((b) => b.r.top));
    if (Math.abs(top - (bottom(s.band) + SIDE_GAP)) > 2) bad5.push(`열 윗변 ${fmt(top)} (띠 아랫변 ${fmt(bottom(s.band))} + ${SIDE_GAP} = ${fmt(bottom(s.band) + SIDE_GAP)})`);
  }
  const maxRight = Math.max(...btns.map((b) => right(b.r)));
  if (Math.abs(s.viewport.w - maxRight - FLOAT_MARGIN) > 1) bad5.push(`오른쪽 여백 ${fmt(s.viewport.w - maxRight)} (기대 ${FLOAT_MARGIN})`);
  out.push(result("SC5", L.SC5, bad5));

  const bad6 = [];
  // 열 나누기: 오른쪽변이 6 이상 다르면 다른 열
  const cols = [];
  for (const b of [...btns].sort((a, c) => right(c.r) - right(a.r))) {
    const last = cols[cols.length - 1];
    if (last && Math.abs(right(last[0].r) - right(b.r)) <= 6) last.push(b);
    else cols.push([b]);
  }
  for (const col of cols) {
    col.sort((a, b) => a.r.top - b.r.top);
    for (let i = 1; i < col.length; i++) {
      const gap = col[i].r.top - bottom(col[i - 1].r);
      if (Math.abs(gap - SIDE_GAP) > 1) bad6.push(`${col[i - 1].side}·${col[i].side} 간격 ${fmt(gap)}`);
    }
  }
  for (let i = 1; i < cols.length; i++) {
    const gap = Math.min(...cols[i - 1].map((b) => b.r.left)) - Math.max(...cols[i].map((b) => right(b.r)));
    if (Math.abs(gap - SIDE_GAP) > 1) bad6.push(`열 ${i}·${i + 1} 사이 ${fmt(gap)}`);
  }
  if (cols.length > 1 && cols[0].length < 2) bad6.push(`첫 열이 ${cols[0].length}칸`);
  out.push(result("SC6", L.SC6, bad6));
  return out;
}

// ---- 12페이즈 sound-script (12-08, 결정 D-21): 단계 구간마다 기대 소리 id 가 순서대로 ----

/**
 * 구간별 훅 로그를 기대 표와 견준다 (sound-script). 구간은 훅 clear() 로 나눈다(단계 시작 전 clear, 끝나면 읽기).
 * segments = 구간마다 `window.__mfSound.log` 사본 [{ id, at, gain, played }] 의 배열 · steps = segments 와 같은 길이의 기대 목록:
 *   { id, label, ids[순서대로 있어야 하는 소리 id, 부분 수열·같은 id 반복 가능], notIds?[하나라도 있으면 실패],
 *     counts?{ id: 정확한 횟수(0 포함) }, onlyPrefix?(모든 줄이 이 접두어이고 한 줄 이상 — 새로고침 구간의 "침대만") }.
 * 반환은 단계마다 한 줄 { id, label, ok, detail }. 구간 수가 다르거나 로그 모양이 틀리면 전부 측정값 없음으로 실패한다.
 */
export function soundSequenceChecks(segments, steps) {
  const validSteps = Array.isArray(steps) && steps.every((st) => !!st && typeof st.id === "string" && Array.isArray(st.ids));
  const list = validSteps ? steps : [];
  const validLogs = Array.isArray(segments) && validSteps && segments.length === steps.length && segments.every((seg) => Array.isArray(seg) && seg.every((e) => !!e && typeof e.id === "string"));
  if (!validLogs) return (validSteps ? list : [{ id: "SS0", label: "sound-script" }]).map((st) => noMeasure(st.id, st.label ?? st.id, "구간별 로그 배열[[{ id, … }]] 이 단계 수와 같은 길이"));
  return list.map((st, k) => {
    const got = segments[k].map((e) => e.id);
    const bad = [];
    let from = 0;
    for (const want of st.ids) {
      const at = got.indexOf(want, from);
      if (at < 0) {
        bad.push(`${want} 없음${got.includes(want) ? "(순서가 다르거나 횟수 부족)" : ""}`);
        break;
      }
      from = at + 1;
    }
    for (const id of st.notIds ?? []) if (got.includes(id)) bad.push(`${id} 가 나오면 안 됨`);
    for (const [id, n] of Object.entries(st.counts ?? {})) {
      const have = got.filter((x) => x === id).length;
      if (have !== n) bad.push(`${id} ${have}번 (기대 ${n})`);
    }
    if (typeof st.onlyPrefix === "string") {
      const other = got.filter((id) => !id.startsWith(st.onlyPrefix));
      if (got.length === 0) bad.push(`${st.onlyPrefix}* 한 줄도 없음`);
      if (other.length > 0) bad.push(`${st.onlyPrefix}* 가 아닌 줄: ${[...new Set(other)].join(",")}`);
    }
    const r = result(st.id, st.label ?? st.id, bad);
    return bad.length === 0 ? r : { ...r, detail: `${r.detail} · 로그 [${got.join(", ")}]` };
  });
}

/** 일회성 소리 id — 새로고침 구간(첫 스냅샷)에 하나도 없어야 한다 (LS-10) */
const ONE_SHOT_AFTER_RELOAD = Object.freeze(["game.start", "role.flip", "day.start", "phase.vote", "pin.on", "pick.turn", "pick.point", "pin.move", "lobby.join", "timer.tick"]);
const OTHER_BEDS = (own) => ["bed.lobby", "bed.reveal", "bed.day", "bed.vote", "bed.night", "bed.dawn", "bed.result"].filter((b) => b !== own);

/**
 * sound-script 의 단계별 기대 (390×844 한 방, 방장 + 봇 3). 순서는 장면 순서이고 구간은 단계마다 clear() 로 나눈다.
 * 한 구간 안의 순서는 감독이 침대를 먼저 요청하고 일회성 소리를 뒤에 낸다(useSound apply).
 * 방 화면을 막 연 구간(로비·새로고침)은 개발 서버의 이중 효과 실행(StrictMode)으로 같은 침대 요청이 두 줄일 수 있어 횟수 대신 "침대 줄뿐"(onlyPrefix)으로 본다.
 * 밤·처형·아침·결과는 12-09·12-10·12-11 이 같은 표에 단계를 더한다.
 */
export const SOUND_SCRIPT_STEPS = Object.freeze([
  Object.freeze({ id: "SC1", label: "로비: 침대 bed.lobby", ids: ["bed.lobby"], onlyPrefix: "bed.", notIds: ["game.start", "lobby.join"] }),
  Object.freeze({ id: "SC2", label: "봇이 앉으면 lobby.join", ids: ["lobby.join"], notIds: ["game.start", "role.flip"] }),
  Object.freeze({ id: "SC3", label: "시작 → assigning: game.start, 일회성 뒤 소리 없음", ids: ["game.start"], notIds: ["role.flip", "bed.reveal"] }),
  Object.freeze({ id: "SC4", label: "roleReveal: bed.reveal → role.flip", ids: ["bed.reveal", "role.flip"], notIds: ["game.start"] }),
  Object.freeze({ id: "SC5", label: "dayAnnounce·discussion: bed.day → day.start, 침대 요청은 한 번뿐", ids: ["bed.day", "day.start"], counts: { "bed.day": 1, "bed.vote": 0 }, notIds: ["phase.vote", "role.flip"] }),
  Object.freeze({ id: "SC6", label: "nomination(기본판 동시 투표): bed.vote → phase.vote, 차례 소리(pin.on·pick.turn·pick.tick) 없음", ids: ["bed.vote", "phase.vote"], counts: { "bed.vote": 1 }, notIds: ["day.start", "pin.on", "pick.turn", "pick.tick"] }),
  Object.freeze({ id: "SC7", label: "내가 투표해도 차례 소리(pick.point·pin.move·pick.turn)가 없고 새 침대도 없음", ids: [], counts: { "bed.vote": 0 }, notIds: ["pick.point", "pin.move", "pick.turn", "pin.on", "pick.skip", "bed.vote"] }),
  Object.freeze({ id: "SC8", label: "봇 투표·변론 진입: 차례 소리 없음, 새 침대 없음", ids: [], counts: { "bed.vote": 0 }, notIds: ["pin.on", "pick.turn", "pick.tick", "pick.point", "pin.move", "phase.vote", "day.start", "role.flip", "game.start"] }),
  Object.freeze({ id: "SC9", label: "verdict: 마지막 5초 timer.tick 이 초마다, 새 침대 없음", ids: ["timer.tick", "timer.tick"], counts: { "bed.vote": 0 }, notIds: ["phase.vote", "day.start", "role.flip", "game.start"] }),
  Object.freeze({ id: "SC10", label: "낮 중간 새로고침(LS-10): 현재 단계 침대만, 일회성 소리 없음", ids: ["bed.vote"], onlyPrefix: "bed.", notIds: [...ONE_SHOT_AFTER_RELOAD, ...OTHER_BEDS("bed.vote")] }),
  // 12-09: 새로고침 뒤 testSkip 으로 밤 → 아침. 지나온 단계의 소리가 앞에 끼어도 되도록 부분 수열로 본다(큐·역할별 동일성은 sound-night-parity 가 본다)
  Object.freeze({ id: "SC11", label: "밤 진입: bed.night → night.fall (밤 큐·암살음·아침 소리는 아직 없음)", ids: ["bed.night", "night.fall"], notIds: ["kill.slash", "morning.dawn", "bed.dawn"] }),
  Object.freeze({ id: "SC12", label: "아침 진입: bed.dawn → morning.dawn 한 번 (결과와 무관), night.fall 없음", ids: ["bed.dawn", "morning.dawn"], counts: { "morning.dawn": 1 }, notIds: ["night.fall"] }),
]);

// ---- 12페이즈 sound-night-parity (12-09, 결정 D-21): 역할이 다른 페이지의 밤 소리 동일성 · 밤 UI 무음 · 암살음 피해자만 ----

/** 밤 구간(첫 bed.night 부터 첫 bed.dawn 앞)의 소리 id 집합 — 역할·살아 있음과 무관하게 모든 페이지가 같다 (LS-3). 이 밖의 id 가 나오면 새는 것이다 */
export const NIGHT_PARITY_IDS = Object.freeze(["bed.night", "night.cue", "night.fall"]);

/**
 * 사회자 알림음(14-03, HOST-02): 자막 띠의 공개 단계 전환 소리. 밤 진입에도 모든 역할이 같은 프레임에 듣는다 — 밤 동일성은 이 소리를 뺀 나머지로 본다.
 * 밤 무음(P3)의 예외도 이 id 하나뿐이다(다른 ui.* 는 그대로 실패).
 */
export const HOST_CHIME_ID = "ui.host";

/** 페이지 로그를 밤 구간과 아침 구간으로 나눈다. 밤: 첫 bed.night 부터 그 뒤 첫 bed.dawn 앞 · 아침: 첫 bed.dawn 부터 끝. 밤 앞의 낮 소리(시험 시트 눌림 등)는 어느 쪽에도 넣지 않는다 */
function nightSegments(log) {
  // 동작 소리(emote.*)는 받은 프레임에서만 나는 별개 규칙이라 soundEmoteLeakChecks 가 본다 — 밤 소리 집합 비교에서는 뺀다(12-10)
  const ids = log.map((e) => e.id).filter((id) => !id.startsWith("emote.") && id !== HOST_CHIME_ID);
  const nightAt = ids.indexOf("bed.night");
  const dawnAt = ids.indexOf("bed.dawn", Math.max(0, nightAt));
  return {
    night: nightAt < 0 ? [] : ids.slice(nightAt, dawnAt < 0 ? undefined : dawnAt),
    morning: dawnAt < 0 ? [] : ids.slice(dawnAt),
  };
}

/**
 * 밤 소리 동일성 판정 (sound-night-parity, LS-3·LS-7·LS-8·LS-10). 순수 함수 — 문턱은 여기에만 있다.
 * pages = [{ label, log[{ id, … }], reloaded? }] (훅 로그 사본; reloaded 는 밤 중간에 새로고침한 페이지) · victimLabel = 암살당한 페이지 라벨.
 *   P1 새로고침하지 않은 모든 페이지의 밤 id 집합이 NIGHT_PARITY_IDS 와 같다(서로 같다는 뜻이기도 하다)
 *   P2 night.cue 개수: 새로고침하지 않은 페이지는 2~4, 새로고침 페이지는 0~4 (남은 시간 안에서 새로 뽑는다)
 *   P3 모든 페이지의 밤 구간에 ui.* 와 vote.cast 가 0
 *   P4 kill.slash: 밤 구간 0, 아침 구간은 피해자 페이지에서만 정확히 1회
 *   P5 morning.dawn 은 모든 페이지의 아침 구간에 정확히 1회 (결과와 무관)
 *   P6 새로고침 페이지는 밤 구간에 bed.night 가 있고 night.fall 이 없다
 */
export function soundNightParityChecks(input) {
  const ids = ["P1", "P2", "P3", "P4", "P5", "P6"];
  const labels = {
    P1: "밤 구간 id 집합이 {bed.night, night.fall, night.cue} 로 모든 페이지에서 같다",
    P2: "night.cue 가 2~4개(새로고침 페이지는 0~4)",
    P3: "밤 구간에 ui.* 와 vote.cast 가 0",
    P4: "kill.slash 는 아침에 피해자 페이지에서만 정확히 1회, 밤 구간 0",
    P5: "morning.dawn 이 모든 페이지에 정확히 1회",
    P6: "새로고침 페이지는 bed.night 만 있고 night.fall 이 없다",
  };
  const pages = input?.pages;
  const valid = Array.isArray(pages) && pages.length > 0 && pages.every((p) => !!p && typeof p.label === "string" && Array.isArray(p.log) && p.log.every((e) => !!e && typeof e.id === "string"));
  if (!valid) return ids.map((id) => noMeasure(id, labels[id], "pages[{ label, log[{ id }] }]"));
  const seg = pages.map((p) => ({ ...p, ...nightSegments(p.log) }));
  const full = seg.filter((p) => p.reloaded !== true);
  const reloaded = seg.filter((p) => p.reloaded === true);
  const count = (list, id) => list.filter((x) => x === id).length;
  const out = [];

  if (full.length < 2) out.push(noMeasure("P1", labels.P1, "새로고침하지 않은 페이지가 둘 이상"));
  else {
    const bad = [];
    for (const p of full) {
      const set = [...new Set(p.night)].sort();
      if (p.night.length === 0) bad.push(`${p.label}: 밤 구간 없음`);
      else if (set.join(",") !== NIGHT_PARITY_IDS.join(",")) bad.push(`${p.label}: {${set.join(", ")}}`);
    }
    out.push(result("P1", labels.P1, bad));
  }

  const bad2 = [];
  for (const p of seg) {
    const n = count(p.night, "night.cue");
    if (p.reloaded === true ? n > 4 : n < 2 || n > 4) bad2.push(`${p.label}: night.cue ${n}개`);
  }
  out.push(result("P2", labels.P2, bad2));

  const bad3 = [];
  for (const p of seg) {
    const loud = p.night.filter((id) => id.startsWith("ui.") || id === "vote.cast");
    if (loud.length > 0) bad3.push(`${p.label}: 밤에 ${[...new Set(loud)].join(",")}`);
  }
  out.push(result("P3", labels.P3, bad3));

  const victim = seg.find((p) => p.label === input.victimLabel);
  if (victim === undefined) out.push(noMeasure("P4", labels.P4, `피해자 페이지 '${String(input.victimLabel)}' 가 pages 에 있어야 함`));
  else {
    const bad4 = [];
    for (const p of seg) {
      const inNight = count(p.night, "kill.slash");
      if (inNight > 0) bad4.push(`${p.label}: 밤 구간에 kill.slash ${inNight}번`);
      const inMorning = count(p.morning, "kill.slash");
      const want = p === victim ? 1 : 0;
      if (inMorning !== want) bad4.push(`${p.label}: 아침 kill.slash ${inMorning}번 (기대 ${want})`);
    }
    out.push(result("P4", labels.P4, bad4));
  }

  const bad5 = [];
  for (const p of seg) {
    const n = count(p.morning, "morning.dawn");
    if (n !== 1) bad5.push(`${p.label}: morning.dawn ${n}번`);
  }
  out.push(result("P5", labels.P5, bad5));

  if (reloaded.length === 0) out.push(noMeasure("P6", labels.P6, "밤 중간에 새로고침한 페이지가 하나 이상"));
  else {
    const bad6 = [];
    for (const p of reloaded) {
      if (!p.night.includes("bed.night")) bad6.push(`${p.label}: bed.night 없음`);
      if (p.night.includes("night.fall")) bad6.push(`${p.label}: night.fall 이 나옴`);
    }
    out.push(result("P6", labels.P6, bad6));
  }
  return out;
}

// ---- 12페이즈 판결 타이밍·동작 소리 누설 (12-10, 결정 D-13·D-14·D-21, LS-4) ----

/** 판결 타이밍 문턱: 결과 소리는 첫 심장 박동 +2600ms ± 250, 의사봉과 떠오름은 ±100 안에서 같이 난다 */
export const VERDICT_TIMING = Object.freeze({ hearts: 5, announceAt: 2600, tolerance: 250, riseTolerance: 100, headBefore: 2350 });
const VERDICT_FAMILY = ["verdict.", "ballot.", "pin.", "execution."];

const entriesOf = (log, id) => log.filter((e) => e.id === id);
const validLog = (log) => Array.isArray(log) && log.every((e) => !!e && typeof e.id === "string" && Number.isFinite(e.at));

/** 첫 박동과 이 시간(ms) 안에 요청된 소리는 같은 순간으로 보고 id 순으로 센다(틱 안 순서는 판마다 갈린다) */
const VERDICT_HEAD_TICK_MS = 50;
const headKey = (e, base) => (Math.abs(e.at - base) < VERDICT_HEAD_TICK_MS ? base : e.at);
/** 첫 심장 박동 직전 이 시간(ms) 안에 요청된 판결 계열 소리도 앞머리에 센다(같은 진입 틱의 pin.on) */
const VERDICT_HEAD_LEAD_MS = 100;
/** 판결 앞머리 id 열: 첫 심장 박동부터 2350ms(= 2600 − 250, 결과 소리가 나도 되는 가장 이른 시각) 앞의 판결 계열 id (다른 UI 소리는 비교하지 않는다) */
function verdictHead(log, base) {
  // pin.on 은 같은 진입 순간에 즉시 요청되고 첫 심장 박동은 같은 틱의 타이머에서 나온다 — 로그 시각이 1~수 ms 앞서거나 같아 base 와 정확히 비교하면 판마다 갈린다(12-12).
  // 첫 박동 직전 HEAD_LEAD_MS 안의 판결 계열도 같은 앞머리로 센다. 한 판에만 있으면 여전히 V5 가 실패한다
  return log
    .filter((e) => e.at >= base - VERDICT_HEAD_LEAD_MS && e.at - base < VERDICT_TIMING.headBefore && VERDICT_FAMILY.some((p) => e.id.startsWith(p)))
    .sort((a, b) => headKey(a, base) - headKey(b, base) || a.id.localeCompare(b.id))
    .map((e) => e.id);
}

/**
 * 판결 순간 소리 타이밍 판정 (sound-script, D-13·LS-1·T-12-36). 순수 함수 — 문턱은 여기에만 있고 흐름은 낮추지 않는다.
 * input = { pass, reject } (각 훅 로그 [{ id, at, … }]: 찬성으로 통과한 처형 판 · 반대로 부결된 판).
 *   V1 두 판 모두 verdict.heart 가 정확히 5개
 *   V2 통과 판: execution.gavel 이 정확히 1개이고 첫 심장 박동 +2600 ± 250
 *   V3 통과 판: execution.rise 가 gavel 과 ±100 안
 *   V4 부결 판: gavel·rise 가 없고 verdict.reject 가 정확히 1개, 첫 심장 박동 +2600 ± 250
 *   V5 두 판의 2600ms 앞(첫 심장 박동 +2350 안) 판결 id 열이 같다 (결과가 앞머리에 새지 않는다)
 */
export function soundVerdictTimingChecks(input) {
  const T = VERDICT_TIMING;
  const labels = {
    V1: `verdict.heart 가 두 판 모두 정확히 ${T.hearts}개`,
    V2: `통과: execution.gavel 이 첫 심장 박동 +${T.announceAt}ms ± ${T.tolerance}`,
    V3: `통과: execution.rise 가 gavel 과 ±${T.riseTolerance}ms 안`,
    V4: `부결: gavel·rise 없이 verdict.reject 가 첫 심장 박동 +${T.announceAt}ms ± ${T.tolerance}`,
    V5: "두 판의 2600ms 앞 판결 소리 열이 같다 (결과 무관 앞머리)",
  };
  const ids = ["V1", "V2", "V3", "V4", "V5"];
  const pass = validLog(input?.pass) ? input.pass : null;
  const reject = validLog(input?.reject) ? input.reject : null;
  const base = (log) => {
    const hs = log === null ? [] : entriesOf(log, "verdict.heart").sort((a, b) => a.at - b.at);
    return hs.length > 0 ? hs[0].at : null;
  };
  const pb = base(pass);
  const rb = base(reject);
  const out = [];

  if (pass === null || reject === null) out.push(noMeasure("V1", labels.V1, "통과 판·부결 판 훅 로그"));
  else {
    const bad = [];
    for (const [name, log] of [["통과", pass], ["부결", reject]]) {
      const n = entriesOf(log, "verdict.heart").length;
      if (n !== T.hearts) bad.push(`${name} 판 verdict.heart ${n}개`);
    }
    out.push(result("V1", labels.V1, bad));
  }

  if (pass === null || pb === null) out.push(noMeasure("V2", labels.V2, "통과 판의 verdict.heart"));
  else {
    const g = entriesOf(pass, "execution.gavel");
    const bad = [];
    if (g.length !== 1) bad.push(`gavel ${g.length}개`);
    else if (Math.abs(g[0].at - pb - T.announceAt) > T.tolerance) bad.push(`gavel 간격 ${Math.round(g[0].at - pb)}ms`);
    out.push(result("V2", labels.V2, bad));
  }

  if (pass === null) out.push(noMeasure("V3", labels.V3, "통과 판 훅 로그"));
  else {
    const g = entriesOf(pass, "execution.gavel");
    const r = entriesOf(pass, "execution.rise");
    const bad = [];
    if (g.length !== 1 || r.length !== 1) bad.push(`gavel ${g.length}개 · rise ${r.length}개`);
    else if (Math.abs(r[0].at - g[0].at) > T.riseTolerance) bad.push(`rise 가 gavel 과 ${Math.round(r[0].at - g[0].at)}ms 차이`);
    out.push(result("V3", labels.V3, bad));
  }

  if (reject === null || rb === null) out.push(noMeasure("V4", labels.V4, "부결 판의 verdict.heart"));
  else {
    const rj = entriesOf(reject, "verdict.reject");
    const bad = [];
    if (entriesOf(reject, "execution.gavel").length > 0 || entriesOf(reject, "execution.rise").length > 0) bad.push("부결 판에 gavel/rise 가 남");
    if (rj.length !== 1) bad.push(`verdict.reject ${rj.length}개`);
    else if (Math.abs(rj[0].at - rb - T.announceAt) > T.tolerance) bad.push(`reject 간격 ${Math.round(rj[0].at - rb)}ms`);
    out.push(result("V4", labels.V4, bad));
  }

  if (pb === null || rb === null) out.push(noMeasure("V5", labels.V5, "두 판의 verdict.heart"));
  else {
    const a = verdictHead(pass, pb);
    const b = verdictHead(reject, rb);
    out.push(result("V5", labels.V5, a.join(",") === b.join(",") ? [] : [`통과 [${a.join(", ")}] ≠ 부결 [${b.join(", ")}]`]));
  }
  return ids.map((id) => out.find((l) => l.id === id));
}

/** 동작 소리 gain(선형): 내 것 0dB = 1, 남의 것 −6dB ≈ 0.501 */
const EMOTE_GAIN = Object.freeze({ mine: 1, other: 0.501, tolerance: 0.03 });

/**
 * 동작 소리 누설 판정 (sound-night-parity, D-14·LS-4·T-12-37). 순수 함수.
 * input = { senderLog, otherLogs: [{ label, log }], day?: { senderLog, receiverLog } } — 밤 마피아 동작의 보낸 쪽·시민 쪽 로그, 낮 동작의 보낸·받은 쪽 로그.
 *   E1 밤 마피아 로그에 emote.* 가 0개 (15-08: 밤 마피아 화면은 시민 편과 같은 얼굴 목록이라 밤 동작 칸이 없다 — 보낼 수단이 없다)
 *   E2 시민 쪽 모든 로그에 emote.* 가 0개
 *   E3 낮 동작: 보낸 사람 gain 1(0dB), 받은 사람 gain 0.501(−6dB)
 */
export function soundEmoteLeakChecks(input) {
  const labels = {
    E1: "밤 마피아 로그에 emote.* 가 0개(밤 동작 칸 없음)",
    E2: "시민 쪽 로그에 emote.* 가 0개",
    E3: "낮 동작 gain: 보낸 사람 1(0dB) · 받은 사람 0.501(−6dB)",
  };
  const isEmote = (e) => e.id.startsWith("emote.");
  const sender = validLog(input?.senderLog) ? input.senderLog : null;
  const others = Array.isArray(input?.otherLogs) && input.otherLogs.length > 0 && input.otherLogs.every((o) => !!o && typeof o.label === "string" && validLog(o.log)) ? input.otherLogs : null;
  const day = input?.day;
  const out = [];

  if (sender === null) out.push(noMeasure("E1", labels.E1, "보낸 쪽 훅 로그"));
  else {
    const n = sender.filter(isEmote).length;
    out.push(result("E1", labels.E1, n === 0 ? [] : [`emote.* ${n}개`]));
  }

  if (others === null) out.push(noMeasure("E2", labels.E2, "시민 쪽 훅 로그 [{ label, log }]"));
  else {
    const bad = [];
    for (const o of others) {
      const n = o.log.filter(isEmote).length;
      if (n > 0) bad.push(`${o.label}: emote.* ${n}개`);
    }
    out.push(result("E2", labels.E2, bad));
  }

  if (!day || !validLog(day.senderLog) || !validLog(day.receiverLog)) out.push(noMeasure("E3", labels.E3, "낮 동작의 보낸·받은 쪽 로그"));
  else {
    const s = day.senderLog.filter(isEmote);
    const r = day.receiverLog.filter(isEmote);
    const bad = [];
    if (s.length !== 1 || r.length !== 1) bad.push(`보낸 쪽 emote ${s.length}개 · 받은 쪽 ${r.length}개`);
    else {
      if (!(Math.abs(s[0].gain - EMOTE_GAIN.mine) <= EMOTE_GAIN.tolerance)) bad.push(`보낸 사람 gain ${s[0].gain}`);
      if (!(Math.abs(r[0].gain - EMOTE_GAIN.other) <= EMOTE_GAIN.tolerance)) bad.push(`받은 사람 gain ${r[0].gain}`);
    }
    out.push(result("E3", labels.E3, bad));
  }
  return out;
}

/** 결과·시상 소리 일회성 id(새로고침·재접속 로그에 있으면 안 된다) */
const RESULT_ONE_SHOTS = ["role.flip", "result.win", "result.lose", "game.start"];
const isResultOneShot = (id) => RESULT_ONE_SHOTS.includes(id) || id.startsWith("award.");

/**
 * 결과·시상 소리 판정 (sound-result, D-15·D-21·T-12-41·T-12-44). 순수 함수 — 문턱은 여기에만 있고 흐름은 낮추지 않는다.
 * input = { log, participants, awards, expectWin?, reloadLog } — log 는 ended 도착 직전에 비운 뒤 시상 끝까지 받은 훅 로그, reloadLog 는 같은 페이지를 새로고침한 직후 로그.
 *   R1 결과 구간 로그의 첫 침대 요청이 bed.result
 *   R2 role.flip 개수 == min(참가자 수, 8)
 *   R3 result.win + result.lose 가 정확히 1회 (expectWin 이 있으면 그 쪽 id)
 *   R4 award.plate == 패 수 − 1, award.final == 1회이고 award.* 의 마지막 (패가 없으면 둘 다 0)
 *   R5 순서: 첫 role.flip < result.win/lose < 첫 award.*
 *   R6 새로고침 로그: bed.result 가 있고 role.flip·result.*·award.*·game.start 가 없다
 */
export function soundResultChecks(input) {
  const labels = {
    R1: "결과 구간의 첫 침대 요청이 bed.result",
    R2: "role.flip 이 참가자 수(최대 8)만큼",
    R3: "result.win/lose 가 정확히 한 번(내 팀에 맞는 쪽)",
    R4: "award.plate 가 패 수 − 1, award.final 이 한 번이고 마지막",
    R5: "순서: 뒤집기 < 승패 < 시상",
    R6: "새로고침 로그는 bed.result 만(일회성 소리 없음)",
  };
  const log = validLog(input?.log) ? input.log : null;
  const reload = validLog(input?.reloadLog) ? input.reloadLog : null;
  const n = input?.participants;
  const awards = input?.awards;
  const out = [];
  const idsOf = (l, pred) => l.filter((e) => pred(e.id));
  const at = (e) => (e ? e.at : null);

  if (log === null || !Number.isInteger(n) || n < 1 || !Number.isInteger(awards) || awards < 0) {
    for (const id of ["R1", "R2", "R3", "R4", "R5"]) out.push(noMeasure(id, labels[id], "결과 구간 훅 로그·참가자 수·패 수"));
  } else {
    const firstBed = log.find((e) => e.id.startsWith("bed."));
    out.push(result("R1", labels.R1, firstBed?.id === "bed.result" ? [] : [`첫 침대 요청 ${firstBed?.id ?? "(없음)"}`]));

    const flips = idsOf(log, (id) => id === "role.flip");
    const want = Math.min(n, 8);
    out.push(result("R2", labels.R2, flips.length === want ? [] : [`role.flip ${flips.length}개 ≠ ${want}`]));

    const wl = idsOf(log, (id) => id === "result.win" || id === "result.lose");
    const bad3 = [];
    if (wl.length !== 1) bad3.push(`result.win/lose ${wl.length}회 ≠ 1`);
    else if (typeof input.expectWin === "boolean") {
      const wantId = input.expectWin ? "result.win" : "result.lose";
      if (wl[0].id !== wantId) bad3.push(`${wl[0].id} (기대 ${wantId})`);
    }
    out.push(result("R3", labels.R3, bad3));

    const plates = idsOf(log, (id) => id === "award.plate");
    const finals = idsOf(log, (id) => id === "award.final");
    const allAward = idsOf(log, (id) => id.startsWith("award.")).sort((a, b) => a.at - b.at);
    const bad4 = [];
    if (awards === 0) {
      if (plates.length + finals.length !== 0) bad4.push(`패가 없는데 award.* ${plates.length + finals.length}개`);
    } else {
      if (plates.length !== awards - 1) bad4.push(`award.plate ${plates.length}개 ≠ ${awards - 1}`);
      if (finals.length !== 1) bad4.push(`award.final ${finals.length}개 ≠ 1`);
      else if (allAward[allAward.length - 1]?.id !== "award.final") bad4.push("award.final 이 마지막이 아님");
    }
    out.push(result("R4", labels.R4, bad4));

    const bad5 = [];
    const firstFlip = at(flips.sort((a, b) => a.at - b.at)[0]);
    const light = at(wl[0]);
    const firstAward = at(allAward[0]);
    if (firstFlip === null || light === null) bad5.push("role.flip 또는 result.win/lose 가 없어 순서를 못 잼");
    else {
      if (!(firstFlip < light)) bad5.push(`첫 role.flip(${Math.round(firstFlip)}) ≥ 승패(${Math.round(light)})`);
      if (firstAward !== null && !(light < firstAward)) bad5.push(`승패(${Math.round(light)}) ≥ 첫 award.*(${Math.round(firstAward)})`);
    }
    out.push(result("R5", labels.R5, bad5));
  }

  if (reload === null) out.push(noMeasure("R6", labels.R6, "새로고침 직후 훅 로그"));
  else {
    const bad = [];
    if (!reload.some((e) => e.id === "bed.result")) bad.push("bed.result 요청 없음");
    const shots = reload.filter((e) => isResultOneShot(e.id)).map((e) => e.id);
    if (shots.length > 0) bad.push(`일회성 소리 ${[...new Set(shots)].join(", ")}`);
    out.push(result("R6", labels.R6, bad));
  }
  return out;
}

/**
 * 무대 탭 건너뛰기 소리 판정 (sound-result, 건너뛰기 변형 한 판). 순수 함수.
 * input = { log, participants } — 연출 구간(gather·flip)에서 무대를 탭하고 원래 조명 시각(4600ms)이 지난 뒤까지 받은 훅 로그.
 *   K1 건너뛴 뒤집기 소리는 없다: role.flip 이 참가자 수 미만(탭 전에 난 것까지만)
 *   K2 result.win/lose 가 정확히 한 번
 */
export function soundResultSkipChecks(input) {
  const labels = { K1: "건너뛰기: role.flip 이 참가자 수보다 적다", K2: "건너뛰기: result.win/lose 가 정확히 한 번" };
  const log = validLog(input?.log) ? input.log : null;
  const n = input?.participants;
  if (log === null || !Number.isInteger(n) || n < 1) return [noMeasure("K1", labels.K1, "훅 로그·참가자 수"), noMeasure("K2", labels.K2, "훅 로그")];
  const flips = log.filter((e) => e.id === "role.flip").length;
  const wl = log.filter((e) => e.id === "result.win" || e.id === "result.lose").length;
  return [
    result("K1", labels.K1, flips < Math.min(n, 8) ? [] : [`role.flip ${flips}개 ≥ ${Math.min(n, 8)}`]),
    result("K2", labels.K2, wl === 1 ? [] : [`result.win/lose ${wl}회`]),
  ];
}

// ---- 14페이즈 계약 (14-08) — 사회자 띠·도구 단추 이름·누설·알림음 판정이 받는 값의 모양 ----
// 판정은 모두 이 파일의 순수 함수고 흐름(scripts/e2e/host.mjs)은 읽기만 한다. 값이 없거나 모양이 틀리면 조용히 통과하지 않고 `측정값 없음(…)` 으로 실패한다. 문턱은 여기서만 정하고 낮추지 않는다.
//   HB1~HB5 hostBandChecks(b, { phase, timed })
//     b = { bands, lineCount, lineH, lineLH, guideCount, guideInBand, timeText, barShown, oldHint, oldRing, oldTimer }
//       bands = `[data-host-band]` 수, lineCount = `[data-host-line]` 수, lineH·lineLH = 그 문장 요소의 높이·계산된 줄 높이,
//       guideCount = `[data-guide]` 수, guideInBand = 그것이 띠 안인가, timeText = `[data-host-time]` 글자(없으면 ""), barShown = 시간 막대가 보이는가,
//       oldHint·oldRing·oldTimer = `.mv-phase__hint`·`.mv-ring`·`.mf-timer` 수(옛 헤더 안내줄·시간 링·m:ss 타이머)
//   hostOverlapChecks({ band, tags })   band = 띠 사각형, tags = 이름표 단추 사각형 목록(투표·밤)
//   TL1·TL2 toolLabelChecks(list, { labelAttrs, labelEls })   list = [{ name, text, hasIcon }] — 보이는 button·[role=tab] 하나씩(접근성 이름·보이는 글자),
//       labelAttrs = 이름표 속성(data-tool-label) 요소 수, labelEls = 아이콘 아래 라벨 요소 수(16페이즈 TOOL-04: 둘 다 0, 이름 없는 단추도 0)
//   HL1~HL4 hostLeakChecks(list)   list = [{ role, ownRole, phase, domText, callCount, line, idle }] — role = 시점(mafia·police·doctor·citizen·ghost), ownRole = 유령의 살았을 때 직업,
//       domText = 띠·목표·빛남 영역 글자, callCount = `[data-call]` 수, line = 띠 문장, idle = 그 단계에서 할 일이 없는 시점인가
//   VK1 viewKeyChecks({ top, me, day })   받은 state 프레임의 최상위·me·day 키 이름 집합(값 없음)
//   HS1~HS4 hostChimeChecks(segs)   segs = [{ kind: transition|first|reload|dayToDiscussion|muted, name, count, played }] — count = 구간의 ui.host 요청 수, played = 실제 재생된 수

/** 자막 띠 문장의 줄 수 상한(미만): 한 문장·3줄 미만(UI-SPEC 사회자 문구 표 — 2줄까지). */
export const HOST_LINE_MAX = 3;
/** E2E 가 읽는 14페이즈 표식(src 에 있어야 한다 — e2eContract 가 확인). */
export const HOST_MARKERS = ["data-host-band", "data-host-line", "data-host-time", "data-call", "data-role-goal", "data-guide"];
/**
 * 서버 view 허용 키(13페이즈 그대로, 서버 diff 0). test/unit/view.test.ts 의 TOP_KEYS·ME_KEYS·DAY_KEYS 에 더해, 그 시험의 풍부한 상태가 만들지 않는 9페이즈 상태 의존 키만 더했다:
 * me.will·me.note(유언·쪽지, 결정 0061-9·10)·day.chalk(암살 분필, 결정 0061-14). 실제 판의 state 프레임에는 이 키들이 나온다(emcee-leak 이 처음 걸렸다) — e2eContract 가 "view.test.ts 집합 + 이 셋" 임과
 * 그 셋이 shared/protocol.ts 의 MyInfo·DayView 에 선언된 키임을 고정한다. 14페이즈가 새 키를 더하면 여전히 VK1 이 잡는다.
 * 17-07: view.tutorial(모두에게 같은 진행 수)·me.tutorialDone(끝났음을 보낸 본인만) 은 tutorial 단계에서만 받는 키다(받을 권리, 결정 0080-11) — view.test.ts 의 TOP_KEYS·ME_KEYS 에도 같이 있다.
 */
export const VIEW_TOP_KEYS = new Set(["code", "phase", "round", "phaseEndsAt", "phaseDurationMs", "serverNow", "minPlayers", "maxPlayers", "players", "me", "day", "spectate", "result", "mapChoice", "map", "tutorial"]);
export const VIEW_ME_KEYS = new Set(["seat", "isHost", "role", "allies", "testMode", "testRole", "testBots", "testBotVote", "pick", "allyPicks", "records", "chat", "endDiscussion", "verdictVote", "whisperUsed", "ballot", "errand", "record", "nightTally", "nightSure", "will", "note", "tutorialDone"]);
export const VIEW_DAY_KEYS = new Set(["n", "roles", "voteLog", "morning", "candidate", "execution", "noExecution", "points", "endCount", "voted", "verdict", "turn", "ballots", "runoff", "showdown", "chalk", "evidence"]);
/** 밤 역할별 사회자 줄(src/game/hostLine.ts HOST_LINES 의 night.mafia·police·doctor 사본) — 다른 역할 화면에 있으면 누설이다. e2eContract 가 같음을 고정한다. */
export const HOST_ACT_LINES = {
  mafia: "밤이 되었습니다. 없앨 사람의 얼굴을 눌러 주세요.",
  police: "밤이 되었습니다. 조사할 사람의 얼굴을 눌러 주세요.",
  doctor: "밤이 되었습니다. 지킬 사람의 얼굴을 눌러 주세요.",
};
/** 역할 목표 문장(src/game/roleText.ts ROLE_TEXT[role].goal 사본). */
export const GOALS = {
  mafia: "밤마다 한 명을 없애 시민 편과 수가 같아지면 승리합니다.",
  police: "밤마다 한 명을 조사해 마피아를 찾아내세요.",
  doctor: "밤마다 한 명을 지켜 마피아의 암살을 막으세요.",
  citizen: "대화와 투표로 마피아를 모두 처형하면 승리합니다.",
};
const isStr = (x) => typeof x === "string";

/** HB1~HB5 자막 띠 판정(HOST-01, TOOL-02). b = 위 14페이즈 계약. */
export function hostBandChecks(b, { phase, timed }) {
  const L = {
    HB1: `띠 하나·문장 하나(${phase})`,
    HB2: "data-guide 하나가 띠 안",
    HB3: `띠 문장 ${HOST_LINE_MAX}줄 미만`,
    HB4: timed ? "시간 막대 + 'n초'" : "시간 없는 단계는 막대·숫자 없음",
    HB5: "옛 안내줄·링·m:ss 타이머 없음",
  };
  const ids = ["HB1", "HB2", "HB3", "HB4", "HB5"];
  const nm = (id, what) => noMeasure(id, L[id], what);
  if (!b || typeof b !== "object") return ids.map((id) => nm(id, "띠 읽기 값"));
  const out = [];
  out.push(isNum(b.bands) && isNum(b.lineCount) ? result("HB1", L.HB1, [...(b.bands === 1 ? [] : [`띠 ${b.bands}개 ≠ 1`]), ...(b.lineCount === 1 ? [] : [`[data-host-line] ${b.lineCount}개 ≠ 1`])]) : nm("HB1", "띠 수·문장 수"));
  out.push(isNum(b.guideCount) && typeof b.guideInBand === "boolean" ? result("HB2", L.HB2, [...(b.guideCount === 1 ? [] : [`[data-guide] ${b.guideCount}개 ≠ 1`]), ...(b.guideCount >= 1 && !b.guideInBand ? ["[data-guide] 가 띠 밖"] : [])]) : nm("HB2", "data-guide 수·위치"));
  if (isNum(b.lineH) && isNum(b.lineLH) && b.lineLH > 0) {
    const n = lineCount(b.lineH, b.lineLH);
    out.push(result("HB3", L.HB3, n < HOST_LINE_MAX ? [] : [`${n}줄(높이 ${rd(b.lineH)}px·줄 높이 ${rd(b.lineLH)}px)`]));
  } else out.push(nm("HB3", "문장 높이·줄 높이"));
  if (isStr(b.timeText) && typeof b.barShown === "boolean") {
    const bad = [];
    const hasText = b.timeText.trim() !== "";
    if (timed) {
      if (!/^\d+초$/.test(b.timeText.trim())) bad.push(`시간 글자 '${b.timeText}' 가 'n초' 가 아님`);
      if (!b.barShown) bad.push("시간 막대 없음");
    } else {
      if (hasText) bad.push(`시간 글자 '${b.timeText}' 가 있음`);
      if (b.barShown) bad.push("시간 막대가 보임");
    }
    out.push(result("HB4", L.HB4, bad));
  } else out.push(nm("HB4", "시간 글자·막대"));
  if (isNum(b.oldHint) && isNum(b.oldRing) && isNum(b.oldTimer)) {
    const bad = [];
    if (b.oldHint > 0) bad.push(`.mv-phase__hint ${b.oldHint}개`);
    if (b.oldRing > 0) bad.push(`.mv-ring ${b.oldRing}개`);
    if (b.oldTimer > 0) bad.push(`.mf-timer ${b.oldTimer}개`);
    out.push(result("HB5", L.HB5, bad));
  } else out.push(nm("HB5", "옛 안내줄·링·타이머 수"));
  return out;
}

/**
 * HO1 투표·밤 이름표 단추끼리, 그리고 띠와 겹침 0(OVERLAP_EPS). x = { band, tags }.
 * knownBandLimit: 가장 낮고 좁은 폰(360×560, UI#14 알려진 한계)에서는 띠와 이름표의 겹침을 판정에서 빼고 known 에 측정값 그대로 돌려준다 — 이름표끼리 겹침은 그대로 판정한다.
 * 돌려주는 값: { id, label, ok, detail, known } — known 은 한계로 기록한 문장("" 이면 없음).
 */
export function hostOverlapChecks(x, { knownBandLimit = false } = {}) {
  const label = "이름표 단추끼리·띠와 겹침 없음";
  const okRect = (r) => r && isNum(r.left) && isNum(r.top) && isNum(r.width) && isNum(r.height);
  if (!x || !okRect(x.band) || !Array.isArray(x.tags) || x.tags.length === 0 || !x.tags.every(okRect)) return { ...noMeasure("HO1", label, "띠·이름표 사각형"), known: "" };
  const bad = [];
  const known = [];
  x.tags.forEach((t, i) => {
    if (rectsOverlap(t, x.band)) (knownBandLimit ? known : bad).push(`이름표 ${i + 1} 이 띠와 겹침(${overlapText(t, x.band)})`);
    for (let j = i + 1; j < x.tags.length; j++) if (rectsOverlap(t, x.tags[j])) bad.push(`이름표 ${i + 1}·${j + 1} 겹침(${overlapText(t, x.tags[j])})`);
  });
  return { ...result("HO1", label, bad), known: known.join("; ") };
}

/**
 * TL1·TL2 아이콘 단추 이름(TOOL-04, 14 의 이름표 판정 TOOL-01 을 뒤집은 것). list = [{ name, text, hasIcon }], counts = { labelAttrs, labelEls }.
 * TL1 보이는 button·[role=tab] 중 접근성 이름이 빈 것 0건(면제 목록 없음 — 아이콘 단추는 aria-label, 글 단추는 내용이 이름이다).
 * TL2 이름표 속성(data-tool-label) 요소 수 + 아이콘 아래 라벨 요소 수가 0(브라우저가 읽어 넘긴다).
 */
export function toolLabelChecks(list, counts) {
  const l1 = "접근성 이름이 빈 단추 0건";
  const l2 = "이름표 속성·아이콘 아래 라벨 요소 0건";
  const okItem = (it) => it && isStr(it.name) && isStr(it.text);
  if (!Array.isArray(list) || list.length === 0 || !list.every(okItem)) return [noMeasure("TL1", l1, "보이는 단추 목록"), toolLabelCountCheck(counts, l2)];
  const bare = list.filter((it) => it.name.trim() === "");
  return [result("TL1", l1, bare.map((it) => `이름 없는 단추(글자 '${it.text}'${it.hasIcon ? ", 아이콘만" : ""})`)), toolLabelCountCheck(counts, l2)];
}

function toolLabelCountCheck(counts, label) {
  if (!counts || !isNum(counts.labelAttrs) || !isNum(counts.labelEls)) return noMeasure("TL2", label, "이름표 속성·라벨 요소 수");
  const bad = [];
  if (counts.labelAttrs > 0) bad.push(`data-tool-label 요소 ${counts.labelAttrs}개`);
  if (counts.labelEls > 0) bad.push(`아이콘 아래 라벨 요소 ${counts.labelEls}개`);
  return result("TL2", label, bad);
}

/**
 * HL1~HL4 누설(HOST-05 ①③④). list = [{ role, ownRole, phase, domText, callCount, line, idle }] — 위 14페이즈 계약.
 * HL1 시점 X 의 띠·목표·빛남 글자에 다른 역할의 act 줄·목표가 없다(유령은 살았을 때 직업의 목표만 허용, act 줄은 어느 것도 없음). HL2 같은 단계 idle 시점끼리 띠 문장이 같다.
 * HL3 유령 띠 문장에 마피아·경찰·의사·시민 낱말이 없다. HL4 산 사람의 밤 화면 data-call 수가 역할과 무관하게 같다(15-08: 네 역할 모두 산 사람 칸이 빛난다 — 마피아도 0이 아니다).
 */
export function hostLeakChecks(list) {
  const L = {
    HL1: "다른 역할 전용 줄·목표가 화면에 없음",
    HL2: "할 일 없는 시점끼리 같은 단계의 띠 문장이 같음",
    HL3: "유령 띠 문장에 역할 이름 없음",
    HL4: "산 사람의 밤 화면 data-call 수가 역할과 무관하게 같음",
  };
  const ROLES = ["mafia", "police", "doctor", "citizen", "ghost"];
  const okItem = (it) =>
    it && ROLES.includes(it.role) && isStr(it.phase) && isStr(it.domText) && isStr(it.line) && isNum(it.callCount) && typeof it.idle === "boolean" && (it.role !== "ghost" || ["mafia", "police", "doctor", "citizen"].includes(it.ownRole));
  if (!Array.isArray(list) || list.length === 0 || !list.every(okItem)) return Object.keys(L).map((id) => noMeasure(id, L[id], "시점 × 단계 읽기 목록"));
  const bad1 = [];
  for (const it of list) {
    const own = it.role === "ghost" ? it.ownRole : it.role;
    for (const r of Object.keys(HOST_ACT_LINES)) {
      const isOwnLiveLine = it.role !== "ghost" && r === own;
      if (!isOwnLiveLine && it.domText.includes(HOST_ACT_LINES[r])) bad1.push(`${it.role}@${it.phase} 화면에 ${r} 밤 줄`);
    }
    for (const r of Object.keys(GOALS)) if (r !== own && it.domText.includes(GOALS[r])) bad1.push(`${it.role}@${it.phase} 화면에 ${r} 목표`);
  }
  const bad2 = [];
  const idleByPhase = new Map();
  for (const it of list) if (it.idle) idleByPhase.set(it.phase, [...(idleByPhase.get(it.phase) ?? []), it]);
  for (const [phase, its] of idleByPhase) {
    const lines = new Set(its.map((i) => i.line));
    if (lines.size > 1) bad2.push(`${phase}: ${its.map((i) => `${i.role} '${i.line}'`).join(" ≠ ")}`);
  }
  const bad3 = list.filter((it) => it.role === "ghost" && /마피아|경찰|의사|시민/.test(it.line)).map((it) => `${it.phase}: '${it.line}'`);
  // HL4: 산 사람(유령 제외)의 밤 읽기가 서로 다른 역할 둘 이상이어야 비교가 된다 — 아니면 측정 불가(공허 통과 금지)
  const liveNights = list.filter((it) => it.role !== "ghost" && it.phase === "night");
  const nightRoles = new Set(liveNights.map((it) => it.role));
  let hl4;
  if (nightRoles.size < 2) hl4 = noMeasure("HL4", L.HL4, "산 사람 밤 읽기가 서로 다른 역할 둘 미만");
  else {
    const counts = new Map();
    for (const it of liveNights) counts.set(it.role, it.callCount);
    const vals = new Set(counts.values());
    hl4 = result("HL4", L.HL4, vals.size === 1 ? [] : [`역할별 밤 data-call: ${[...counts].map(([r, n]) => `${r} ${n}`).join(" ≠ ")}`]);
  }
  return [result("HL1", L.HL1, bad1), result("HL2", L.HL2, bad2), result("HL3", L.HL3, bad3), hl4];
}

/** VK1 받은 state 프레임의 view 키(최상위·me·day)가 허용 목록 안(HOST-05 ②, 서버 diff 0). keys = { top, me, day } — 배열 또는 Set. */
export function viewKeyChecks(keys) {
  const label = "view 키(최상위·me·day)가 13페이즈 허용 목록 안";
  const asArr = (v) => (v instanceof Set ? [...v] : Array.isArray(v) ? v : null);
  const top = asArr(keys?.top);
  const me = asArr(keys?.me);
  const day = asArr(keys?.day);
  if (top === null || me === null || day === null || top.length === 0 || me.length === 0 || day.length === 0) return noMeasure("VK1", label, "받은 state 프레임 키");
  const bad = [];
  for (const k of top) if (!VIEW_TOP_KEYS.has(k)) bad.push(`최상위 키 ${k}`);
  for (const k of me) if (!VIEW_ME_KEYS.has(k)) bad.push(`me.${k}`);
  for (const k of day) if (!VIEW_DAY_KEYS.has(k)) bad.push(`day.${k}`);
  return result("VK1", label, bad);
}

/**
 * HS1~HS4 사회자 알림음(HOST-02). segs = [{ kind, name, count, played }].
 * HS1 transition(단계 전환 — 심부름 → 토론 포함) 구간마다 ui.host 정확히 1. HS2 first(처음 입장)·reload(새로고침 첫 프레임) 0. HS3 dayToErrand(낮 시작 → 심부름; 옛 이름 dayToDiscussion 도 받는다) 0.
 * HS4 muted(소리 끔) 구간에 재생된 ui.host 0. 구간 종류가 하나도 없으면 그 판정은 측정값 없음.
 */
export function hostChimeChecks(segs) {
  const spec = [
    ["HS1", "단계 전환마다 ui.host 한 번", ["transition"], (s) => (s.count === 1 ? null : `${s.name}: ui.host ${s.count}번 ≠ 1`)],
    ["HS2", "처음 입장·새로고침 첫 프레임 0번", ["first", "reload"], (s) => (s.count === 0 ? null : `${s.name}: ui.host ${s.count}번 ≠ 0`)],
    ["HS3", "낮 시작 → 심부름 0번(15페이즈: 낮 시작 다음은 심부름이다)", ["dayToErrand", "dayToDiscussion"], (s) => (s.count === 0 ? null : `${s.name}: ui.host ${s.count}번 ≠ 0`)],
    ["HS4", "소리를 끄면 재생된 ui.host 0번", ["muted"], (s) => (s.played === 0 ? null : `${s.name}: 재생된 ui.host ${s.played}번 ≠ 0`)],
  ];
  const okSeg = (s) => s && isStr(s.kind) && isStr(s.name) && isNum(s.count) && isNum(s.played);
  const valid = Array.isArray(segs) && segs.length > 0 && segs.every(okSeg);
  return spec.map(([id, label, kinds, judge]) => {
    if (!valid) return noMeasure(id, label, "구간별 ui.host 개수");
    const mine = segs.filter((s) => kinds.includes(s.kind));
    if (mine.length === 0) return noMeasure(id, label, `${kinds.join("·")} 구간`);
    return result(id, label, mine.map(judge).filter((x) => x !== null));
  });
}


// ---- 15페이즈 계약 (15-09) — 심부름·목격 기록·밤 얼굴 목록·아침 흔적 판정이 받는 값의 모양 ----
// 판정은 모두 이 파일의 순수 함수고 흐름(scripts/e2e/errand.mjs)은 읽기만 한다. 값이 없거나 모양이 틀리면 조용히 통과하지 않고 `측정값 없음(…)` 으로 실패한다(공허 통과 금지, T-15-36).
// 문턱은 여기서만 정하고 낮추지 않는다. 결과 줄에는 장소 id·진행 수·개수·단계 이름만 쓴다(닉네임·토큰 없음, T-15-35).
//   EA1~EA11 errandChecks(s)   (16-07: 처리 입구가 아래 독 [처리] 에서 장소 위 알약으로 바뀌어 EA3 를 고치고 EA7~EA10 을 더했다. 16-08: 아래 패널·독·칩이 없어지고 진행 점 줄이 생겨 EA1·EA2·EA3 를 고치고 EA11 을 더했다)
//     s = { total(진행 점 수), places: [{ id, done, hidden, call, rest }], doneAttr(data-done 점 수), progressText("n/N" — data-errand-progress 속성), bandLine(띠 문장), panelCount(아래 패널·독·칩 수 — 0 이어야 한다),
//           dotsRows([data-errand-dots] 수), dotsAria(그 aria-label), dotsLive(그 aria-live), dotsText(점 줄의 보이는 글자 — 없어야 한다),
//           callCount([data-call] 수), callKinds([data-call] 요소 종류 목록: "act"|"tile"|"arrow"|"other"), reach("out" 반경 밖|"in" 반경 안|"done" 3곳 완료), actCount([data-errand-act] 수), arrowCount(보이는 화살표 수),
//           tiles(보이는 타일 사각형 목록), seatsInWorld(__mfWorld.seats() 중 나 말고 수), nearSeats(그 가운데 근처 반경 + 여유 안), tagSeats(나 말고 이름표 수), attrValues(ERRAND_MARKERS 속성 값 전부) }
//   EC1·EC2 errandCardChecks({ early, late })·errandCardWalkChecks({ moved, closed }) — 시작 카드(16-08): early = { cards, tiles, buttons, text }(단계 시작 2초 안), late = { cards }(2.5초 뒤)
//   EO1~EO5 errandOverlapChecks({ stage, band, side, dots, vh, pins, arrow, act, tagButtons })   — 사각형은 { left, top, width, height } (DOMRect 값). stage = 띠 아랫변 ~ 진행 점 줄 윗변, pins = 보이는 타일, side = 오른쪽 열 단추들([data-side-button]),
//           arrow = 보이는 화살표 사각형 | 목록 | null, act = 보이는 [처리] 알약 사각형 | null, dots = 진행 점 줄, vh = 창 높이
//   ER1 errandParityChecks(mafia, citizen) — 마피아 판과 시민 판의 심부름 영역 마크업(data-* 이름·개수)이 같다(V-25, T-16-15)
//   RC1~RC4 recordChecks(s)   s = { finished, hasButton, hasCard, rowsAttr, rowCount, zeroText, cardRect, dockRect, bandRect, inputRect, collapsedOnFocus } — inputRect = 채팅 입력줄(.mv-chat__form) 사각형
//   TC1~TC6 traceChecks(s)    s = { expectCard, cards, cardText, cardAttrText, nameLines, noteLines, rowLines, lastseenRows, lastseenCount, expectSeen, rowOverflow, cardRect, bandRect, dockRect, panelRect, announceVisible } (16-09: 증거 카드 두 행)
//   TC7·TC8 traceMarkChecks(s) s = { stage: "morning"|"discussion"|"night", expectTrace, expectSeen, trace, seen, unseated, attrValues } — 이름표 표시 좌석(같은 옷·마지막 목격). expect* 는 expectedMarks(view) 로 만든다
//   NF1~NF6 nightFaceChecks(list)   list = [{ role, count, itemH, listH, eyeHeal, ringMafia, callCount, disabledCount, toastAfterTap }] — 마피아·경찰·의사·시민 네 시점

/** E2E 가 읽는 15페이즈 표식(src 에 있어야 한다 — e2eContract 가 확인). */
export const ERRAND_MARKERS = [
  "data-errand-start-card",
  "data-errand-dots",
  "data-errand-dot",
  "data-errand-progress",
  "data-errand-act",
  "data-errand-place",
  "data-errand-arrow",
  "data-near-ring",
  "data-rest",
  "data-record-button",
  "data-record-card",
  "data-record-rows",
  "data-record-row",
  "data-trace-card",
  "data-lastseen-row",
  "data-lastseen-count",
  "data-trace-mark",
  "data-seen-mark",
];
/** 심부름 장소 id 16개(shared/protocol.ts PLACE_IDS 사본 — e2eContract 가 같음을 고정). 표식 값은 이 집합·숫자·"n/N"·빈 값뿐이어야 한다(좌석·역할 값 금지, D-08). */
export const ERRAND_PLACE_IDS = ["glass", "piano", "sax", "stool", "door", "poster", "record", "candle", "clock", "fountain", "bench", "lamp", "mail", "tree", "flower", "stand"];
/** 산 사람마다 받는 장소 수(shared/game/phases.ts ERRAND_COUNT 사본 — e2eContract 가 고정). */
export const ERRAND_PER_PERSON = 3;
/** 심부름 단계 길이 ms(ERRAND_MS 사본). 흔적 구간 길이 ms(MORNING_TRACE_MS 사본). */
export const ERRAND_E2E_MS = 40_000;
export const TRACE_WINDOW_MS = 5_000;
/** 처리 반경·근처 반경(월드 단위, ERRAND_ACT_R·ERRAND_NEAR_R 사본). 근처 검사는 서버가 근처로 본 사람이 이 반경 + 여유 안인지 본다. */
export const ERRAND_ACT_R_E2E = 1.2;
export const ERRAND_NEAR_R_E2E = 3.0;
/** 기록 카드 윗변은 독 아랫변보다 이만큼(px) 아래에 있어야 한다(UI-SPEC "기록 카드 영역"). */
export const RECORD_DOCK_GAP = 8;
/** 타일·알약·화살표 상자가 스테이지 안쪽에 있어야 하는 여백(px). */
export const ERRAND_STAGE_INSET = 8;
/** 장소 타일 한 변(px)과 허용 오차(UI-SPEC V-20). */
export const ERRAND_TILE_PX = 64;
export const ERRAND_TILE_EPS = 1;
/** 마크업 동일 판정(ER1)이 개수까지 견주는 구조 표식, 그리고 상태에 따라 있고 없는 표식(이름만 허용 집합 안인지 본다). */
export const ERRAND_PARITY_COUNTED = ["data-errand-start-card", "data-errand-dots", "data-errand-dot", "data-errand-progress", "data-errand-place", "data-errand-arrow", "data-near-ring"];
/** 진행 점 줄 아랫변은 창 아래에서 이만큼(px) 위(UI-SPEC V-23: 아래 40 + 안전 영역). 허용 오차 2. */
export const ERRAND_DOTS_BOTTOM = 40;
export const ERRAND_DOTS_EPS = 2;
/** 타일·알약·화살표는 진행 점 줄 윗변에서 이만큼(px) 위에만 놓인다(V-23). */
export const ERRAND_DOTS_GAP = 8;
/** 시작 카드: 장소 타일 수(내 목록 3곳)와 카드 글자 두 줄(UI-SPEC V-19). */
export const ERRAND_CARD_TITLE = "오늘 갈 곳";
export const ERRAND_CARD_LINE = "가는 길에 본 사람이 기록돼요";
export const ERRAND_STATE_ATTRS = ["data-done", "data-call", "data-rest", "data-errand-act"];
/** 사회자 띠 문장 사본(src/game/hostLine.ts HOST_LINES 의 errand·witness·trace·discussion 줄 — e2eContract 가 같음을 고정). */
export const ERRAND_LINES = {
  act: "심부름 시간입니다. 빛나는 곳을 찾아 처리해 주세요.",
  done: "심부름을 마쳤습니다. 곧 토론이 시작됩니다.",
  witness: "토론 시간입니다. 기록 단추로 본 것을 확인해 주세요.",
  discussionAct: "토론 시간입니다. 의심 가는 사람을 이야기해 주세요.",
  trace: "흔적이 남았습니다. 같은 옷을 입은 사람을 표시했습니다.",
  discussionEvidence: "토론입니다. 같은 옷과 엇갈린 목격을 살펴보세요.",
};
/** 의상 → 조각 id 사본(shared/game/trace.ts TRACE_OF_OUTFIT — e2eContract 가 같음을 고정). 공개 players[].look 에서 같은 옷 좌석을 셈하는 데만 쓴다. */
export const TRACE_OF_OUTFIT_E2E = {
  coat: "button",
  police: "pin",
  doctor: "whiteCloth",
  mafia: "blackCloth",
  detective: "brownCloth",
  reporter: "pencil",
  elder: "grayThread",
  hood: "navyThread",
  noir: "redCloth",
};
/** 조각과 같은 옷을 입은 산 사람 좌석(오름차순). 의상이 없는 사람은 coat. src/game/traceMark.ts sameOutfitSeats 와 같은 규칙. */
export function sameOutfitSeatsE2E(players, piece) {
  return players
    .filter((p) => p.alive !== false && TRACE_OF_OUTFIT_E2E[p.look ?? "coat"] === piece)
    .map((p) => p.seat)
    .sort((a, b) => a - b);
}
/** 한 view 가 이름표에 붙여야 할 표시 좌석: day.evidence.trace 가 있을 때만 { trace: 같은 옷 산 사람, seen: 목격자 }, 아니면 둘 다 빈 배열. */
export function expectedMarks(view) {
  const ev = view?.day?.evidence;
  if (!ev || typeof ev.trace !== "string" || !Array.isArray(view.players)) return { trace: [], seen: [] };
  return { trace: sameOutfitSeatsE2E(view.players, ev.trace), seen: ev.seen && Number.isInteger(ev.seen.seat) ? [ev.seen.seat] : [] };
}
/** 흔적·기록·표식 값에 있으면 안 되는 낱말(역할 연상어·확정 암시). */
const ROLE_WORD_RE = /마피아|경찰|의사|시민|범인|증거|확정|mafia|police|doctor|citizen/i;

const okRect = (r) => !!r && typeof r === "object" && isNum(r.left) && isNum(r.top) && isNum(r.width) && isNum(r.height);
const asRectList = (x) => (x === null || x === undefined ? [] : Array.isArray(x) ? x : [x]);

/** EA1~EA11 심부름 화면 판정(ERRAND-01~04·07, 16-07 D-06·D-07, 16-08 진행 점). s = 위 계약. */
export function errandChecks(s) {
  const L = {
    EA1: `진행 점이 ${ERRAND_PER_PERSON}개이고 장소 타일 수와 같다`,
    EA2: "진행 표식 n/N = data-done 점 수 = 처리한 타일 수",
    EA3: "띠 문장(errand.act/done)이 맞고 아래 패널·독·칩이 0건([처리] 는 장소 위 알약뿐)",
    EA4: "[data-call] 이 한 화면 1개 이하이고 화살표에는 없다(알약 또는 가장 가까운 타일)",
    EA5: "월드·이름표에 근처 밖 좌석 0",
    EA6: "표식 속성 값에 좌석·역할 없음(장소 id·숫자·진행 수뿐)",
    EA7: `보이는 타일 상자가 ${ERRAND_TILE_PX}×${ERRAND_TILE_PX} ± ${ERRAND_TILE_EPS}`,
    EA8: "반경 밖이면 알약 0·화살표 1, 반경 안이면 알약 1·화살표 0, 3곳 완료면 둘 다 0",
    EA9: "빛남 우선: 반경 안이면 알약만, 반경 밖이면 가장 가까운 타일만(보이면), 3곳 완료면 없음",
    EA10: "남은(미처리·빛나지 않는) 보이는 타일은 data-rest, 처리한 타일과 빛나는 타일은 data-rest 없음",
    EA11: "진행 점 줄 1개·role=group aria-label '진행 n/N'·aria-live polite·보이는 글자 없음",
  };
  const ids = Object.keys(L);
  if (!s || typeof s !== "object") return ids.map((id) => noMeasure(id, L[id], "심부름 읽기 값"));
  const out = [];
  const placesOk = Array.isArray(s.places) && s.places.every((p) => p && isStr(p.id) && typeof p.done === "boolean");
  // EA1
  if (isNum(s.total) && placesOk) {
    const bad = [];
    if (s.total !== ERRAND_PER_PERSON) bad.push(`점 ${s.total}개 ≠ ${ERRAND_PER_PERSON}`);
    if (s.places.length !== s.total) bad.push(`타일 ${s.places.length}개 ≠ 점 ${s.total}개`);
    out.push(result("EA1", L.EA1, bad));
  } else out.push(noMeasure("EA1", L.EA1, "점 수·타일 목록"));
  // EA2
  if (isNum(s.total) && isNum(s.doneAttr) && isStr(s.progressText) && placesOk) {
    const doneMarkers = s.places.filter((p) => p.done).length;
    const bad = [];
    if (s.progressText.trim() !== `${s.doneAttr}/${s.total}`) bad.push(`진행 '${s.progressText}' ≠ ${s.doneAttr}/${s.total}`);
    if (doneMarkers !== s.doneAttr) bad.push(`처리한 타일 ${doneMarkers}개 ≠ data-done 점 ${s.doneAttr}개`);
    out.push(result("EA2", L.EA2, bad));
  } else out.push(noMeasure("EA2", L.EA2, "진행 표식·data-done 점 수·타일"));
  // EA3
  if (isNum(s.total) && isNum(s.doneAttr) && isStr(s.bandLine) && isNum(s.panelCount)) {
    const bad = [];
    const complete = s.doneAttr >= s.total;
    if (complete) {
      if (s.bandLine.trim() !== ERRAND_LINES.done) bad.push("3/3 인데 띠 문장이 errand.done 이 아님");
    } else if (s.bandLine.trim() !== ERRAND_LINES.act) bad.push("미완인데 띠 문장이 errand.act 가 아님");
    if (s.panelCount !== 0) bad.push(`아래 패널·독·칩 ${s.panelCount}개 ≠ 0`);
    out.push(result("EA3", L.EA3, bad));
  } else out.push(noMeasure("EA3", L.EA3, "띠 문장·아래 패널·독·칩 수"));
  // EA4
  if (isNum(s.callCount) && Array.isArray(s.callKinds) && s.callKinds.every(isStr)) {
    const bad = [];
    if (s.callCount > 1) bad.push(`[data-call] ${s.callCount}개 > 1`);
    if (s.callKinds.length !== s.callCount) bad.push(`[data-call] ${s.callCount}개인데 종류 목록 ${s.callKinds.length}개`);
    if (s.callKinds.some((k) => k !== "act" && k !== "tile")) bad.push(`알약·타일이 아닌 곳에 빛: ${s.callKinds.filter((k) => k !== "act" && k !== "tile").join(",")}`);
    out.push(result("EA4", L.EA4, bad));
  } else out.push(noMeasure("EA4", L.EA4, "[data-call] 수·종류"));
  // EA5
  if (isNum(s.seatsInWorld) && isNum(s.nearSeats) && isNum(s.tagSeats)) {
    const bad = [];
    if (s.nearSeats > s.seatsInWorld) bad.push(`근처 좌석 ${s.nearSeats} > 월드 좌석 ${s.seatsInWorld}`);
    if (s.seatsInWorld !== s.nearSeats) bad.push(`월드에 근처 밖 좌석 ${s.seatsInWorld - s.nearSeats}개(월드 ${s.seatsInWorld}·근처 ${s.nearSeats})`);
    if (s.tagSeats > s.seatsInWorld) bad.push(`이름표 ${s.tagSeats}개 > 월드 좌석 ${s.seatsInWorld}`);
    out.push(result("EA5", L.EA5, bad));
  } else out.push(noMeasure("EA5", L.EA5, "월드 좌석·근처 좌석·이름표 수"));
  // EA6
  if (Array.isArray(s.attrValues) && s.attrValues.every(isStr)) {
    const bad = [];
    for (const v of s.attrValues) {
      const fine = v === "" || /^\d+$/.test(v) || /^\d+\/\d+$/.test(v) || ERRAND_PLACE_IDS.includes(v);
      if (!fine || ROLE_WORD_RE.test(v)) bad.push(`표식 값 '${v}'`);
    }
    out.push(result("EA6", L.EA6, bad));
  } else out.push(noMeasure("EA6", L.EA6, "표식 속성 값 목록"));
  // EA7
  if (Array.isArray(s.tiles) && s.tiles.every(okRect)) {
    const bad = [];
    s.tiles.forEach((t, i) => {
      if (Math.abs(t.width - ERRAND_TILE_PX) > ERRAND_TILE_EPS || Math.abs(t.height - ERRAND_TILE_PX) > ERRAND_TILE_EPS) bad.push(`타일 ${i + 1} 상자 ${rd(t.width)}x${rd(t.height)} ≠ ${ERRAND_TILE_PX}`);
    });
    out.push(result("EA7", L.EA7, bad));
  } else out.push(noMeasure("EA7", L.EA7, "타일 사각형"));
  // EA8·EA9
  const reachOk = s.reach === "out" || s.reach === "in" || s.reach === "done";
  if (reachOk && isNum(s.actCount) && isNum(s.arrowCount)) {
    const want = { out: [0, 1], in: [1, 0], done: [0, 0] }[s.reach];
    const bad = [];
    if (s.actCount !== want[0]) bad.push(`${s.reach}: 알약 ${s.actCount}개 ≠ ${want[0]}`);
    if (s.arrowCount !== want[1]) bad.push(`${s.reach}: 화살표 ${s.arrowCount}개 ≠ ${want[1]}`);
    out.push(result("EA8", L.EA8, bad));
  } else out.push(noMeasure("EA8", L.EA8, "반경 상태(reach)·알약 수·화살표 수"));
  if (reachOk && Array.isArray(s.callKinds) && s.callKinds.every(isStr)) {
    const bad = [];
    if (s.reach === "in" && !(s.callKinds.length === 1 && s.callKinds[0] === "act")) bad.push(`반경 안인데 빛이 알약 하나가 아님(${s.callKinds.join(",") || "없음"})`);
    if (s.reach === "out" && s.callKinds.some((k) => k !== "tile")) bad.push(`반경 밖인데 타일 말고 빛남(${s.callKinds.join(",")})`);
    if (s.reach === "done" && s.callKinds.length !== 0) bad.push(`3곳 완료인데 빛이 ${s.callKinds.length}개`);
    out.push(result("EA9", L.EA9, bad));
  } else out.push(noMeasure("EA9", L.EA9, "반경 상태(reach)·빛 종류"));
  // EA10
  if (placesOk && s.places.every((p) => typeof p.hidden === "boolean" && typeof p.call === "boolean" && typeof p.rest === "boolean")) {
    const bad = [];
    for (const p of s.places) {
      if (p.hidden) continue;
      if (p.done && (p.rest || p.call)) bad.push(`처리한 타일 ${p.id} 에 ${p.rest ? "data-rest" : "data-call"}`);
      if (!p.done && p.call && p.rest) bad.push(`빛나는 타일 ${p.id} 에 data-rest`);
      if (!p.done && !p.call && !p.rest) bad.push(`남은 타일 ${p.id} 에 data-rest 없음`);
    }
    out.push(result("EA10", L.EA10, bad));
  } else out.push(noMeasure("EA10", L.EA10, "타일별 hidden·call·rest"));
  // EA11
  if (isNum(s.dotsRows) && isStr(s.progressText) && isStr(s.dotsAria) && isStr(s.dotsLive) && isStr(s.dotsText)) {
    const bad = [];
    if (s.dotsRows !== 1) bad.push(`진행 점 줄 ${s.dotsRows}개 ≠ 1`);
    if (s.dotsAria !== `진행 ${s.progressText.trim()}`) bad.push(`aria-label '${s.dotsAria}' ≠ '진행 ${s.progressText.trim()}'`);
    if (s.dotsLive !== "polite") bad.push(`aria-live '${s.dotsLive}' ≠ polite`);
    if (s.dotsText.trim() !== "") bad.push("점 줄에 보이는 글자가 있음");
    out.push(result("EA11", L.EA11, bad));
  } else out.push(noMeasure("EA11", L.EA11, "점 줄 수·aria-label·aria-live·글자"));
  return out;
}

/**
 * EC1 시작 카드(ERRAND-06, 16-08 V-19): 단계 시작 2초 안 읽기(early)에 카드 1개·타일 3개·단추 0·제목과 한 줄이 있고, 2.5초 뒤 읽기(late)에는 0개.
 * early = { cards, tiles, buttons, text }, late = { cards }. 장소 이름 글자는 타일에 없다(접근성 이름뿐) — 글자는 제목·한 줄 둘뿐이다.
 */
export function errandCardChecks(c) {
  const label = `시작 카드: 2초 안 1개(타일 ${ERRAND_PER_PERSON}·단추 0·제목·한 줄), 2.5초 뒤 0개`;
  const e = c?.early;
  const l = c?.late;
  if (!e || !isNum(e.cards) || !isNum(e.tiles) || !isNum(e.buttons) || !isStr(e.text) || !l || !isNum(l.cards)) return [noMeasure("EC1", label, "시작 카드 읽기(2초 안·2.5초 뒤)")];
  const bad = [];
  if (e.cards !== 1) bad.push(`2초 안 카드 ${e.cards}개 ≠ 1`);
  if (e.tiles !== ERRAND_PER_PERSON) bad.push(`카드 타일 ${e.tiles}개 ≠ ${ERRAND_PER_PERSON}`);
  if (e.buttons !== 0) bad.push(`카드에 단추 ${e.buttons}개`);
  if (e.text.replace(/\s+/g, "") !== `${ERRAND_CARD_TITLE}${ERRAND_CARD_LINE}`.replace(/\s+/g, "")) bad.push("카드 글자가 제목·한 줄과 다름");
  if (l.cards !== 0) bad.push(`2.5초 뒤 카드 ${l.cards}개 ≠ 0`);
  return [result("EC1", label, bad)];
}

/** EC2 카드가 떠 있어도 바닥을 누르면 걷고(moved: 위치가 바뀜) 그 누름에 카드가 닫힌다(closed). T-16-19: 카드는 입력을 막지 않는다. */
export function errandCardWalkChecks(w) {
  const label = "카드 중에도 바닥을 누르면 걷고, 그 누름에 카드가 닫힌다";
  if (!w || typeof w.moved !== "boolean" || typeof w.closed !== "boolean") return [noMeasure("EC2", label, "카드 중 걷기·닫힘 읽기")];
  const bad = [];
  if (!w.moved) bad.push("카드가 떠 있는 동안 누른 바닥으로 걷지 않음(입력이 막힘)");
  if (!w.closed) bad.push("바닥을 눌러도 카드가 닫히지 않음");
  return [result("EC2", label, bad)];
}

/**
 * EO1~EO5 심부름 영역(UI-SPEC "심부름 화면 영역 표", 폰 6종). x = { stage, band, side, dots, vh, pins, arrow, act, tagButtons } — 사각형은 { left, top, width, height }.
 * EO1 타일끼리·[처리] 알약과 타일이 겹치지 않는다(화살표는 눌림을 통과하는 방향 표지라 가까이 다가가면 목표 타일 위로 지나갈 수 있어 타일과의 겹침은 보지 않는다 — 16-07).
 * EO2 타일·알약·화살표가 이름표 버튼과 겹치지 않는다. EO3 타일·알약·화살표가 띠 면·오른쪽 열 단추·진행 점 줄(윗변 − 8 부터)과 겹치지 않는다(SC2, V-23).
 * EO4 타일·알약·화살표 상자가 스테이지(띠 아랫변 ~ 점 줄 윗변) 안쪽 8 inset 안이고 화살표·알약은 한 개 이하. EO5 진행 점 줄 아랫변이 창 아래 − 40 ± 2 이고 화면 안에 있다. 판정 문턱(OVERLAP_EPS)은 낮추지 않는다.
 */
export function errandOverlapChecks(x) {
  const L = {
    EO1: "타일끼리·알약과 타일 겹침 0",
    EO2: "타일·알약·화살표가 이름표 버튼과 겹침 0",
    EO3: `타일·알약·화살표가 띠 면·오른쪽 열 단추·진행 점 줄(윗변 − ${ERRAND_DOTS_GAP} 부터)과 겹침 0`,
    EO4: `타일·알약·화살표 상자가 스테이지 안쪽 ${ERRAND_STAGE_INSET} 안이고 화살표·알약은 한 개 이하`,
    EO5: `진행 점 줄 아랫변이 창 아래 − ${ERRAND_DOTS_BOTTOM} ± ${ERRAND_DOTS_EPS}`,
  };
  const ids = Object.keys(L);
  const arrows = asRectList(x?.arrow);
  const acts = asRectList(x?.act);
  const pins = x?.pins;
  const tags = x?.tagButtons;
  const side = x?.side;
  if (!x || !okRect(x.stage) || !okRect(x.band) || !okRect(x.dots) || !isNum(x.vh) || !Array.isArray(side) || !side.every(okRect) || !Array.isArray(pins) || !pins.every(okRect) || !arrows.every(okRect) || !acts.every(okRect) || !Array.isArray(tags) || !tags.every(okRect))
    return ids.map((id) => noMeasure(id, L[id], "스테이지·띠·오른쪽 열·진행 점 줄·타일·화살표·알약·이름표 사각형"));
  const marks = [...pins.map((r, i) => ({ r, name: `타일 ${i + 1}` })), ...acts.map((r, i) => ({ r, name: `알약 ${i + 1}` })), ...arrows.map((r, i) => ({ r, name: `화살표 ${i + 1}` }))];
  const bad1 = [];
  const solid = marks.filter((m) => !m.name.startsWith("화살표"));
  for (let i = 0; i < solid.length; i++) for (let j = i + 1; j < solid.length; j++) if (rectsOverlap(solid[i].r, solid[j].r)) bad1.push(`${solid[i].name}·${solid[j].name} 겹침(${overlapText(solid[i].r, solid[j].r)})`);
  const bad2 = [];
  for (const m of marks) tags.forEach((t, k) => { if (rectsOverlap(m.r, t)) bad2.push(`${m.name} 이 이름표 ${k + 1} 과 겹침(${overlapText(m.r, t)})`); });
  const bad3 = [];
  const dotsZone = { left: x.dots.left, top: x.dots.top - ERRAND_DOTS_GAP, width: x.dots.width, height: x.dots.height + ERRAND_DOTS_GAP };
  for (const m of marks) for (const [name, r] of [["띠", x.band], ...side.map((r, k) => [`오른쪽 열 단추 ${k + 1}`, r]), ["진행 점 줄", dotsZone]]) if (rectsOverlap(m.r, r)) bad3.push(`${m.name} 이 ${name}와 겹침(${overlapText(m.r, r)})`);
  const bad4 = [];
  const inner = { left: x.stage.left + ERRAND_STAGE_INSET, top: x.stage.top + ERRAND_STAGE_INSET, right: right(x.stage) - ERRAND_STAGE_INSET, bottom: bottom(x.stage) - ERRAND_STAGE_INSET };
  for (const m of marks) if (!rectInside(m.r, inner)) bad4.push(`${m.name} 이 스테이지 안쪽 ${ERRAND_STAGE_INSET} 밖(${rd(m.r.left)},${rd(m.r.top)} ${rd(m.r.width)}x${rd(m.r.height)})`);
  if (arrows.length > 1) bad4.push(`화살표 ${arrows.length}개 > 1`);
  if (acts.length > 1) bad4.push(`알약 ${acts.length}개 > 1`);
  const bad5 = [];
  const dotsBottom = bottom(x.dots);
  if (Math.abs(dotsBottom - (x.vh - ERRAND_DOTS_BOTTOM)) > ERRAND_DOTS_EPS) bad5.push(`점 줄 아랫변 ${rd(dotsBottom)} ≠ 창 아래 ${rd(x.vh)} − ${ERRAND_DOTS_BOTTOM}`);
  return [result("EO1", L.EO1, bad1), result("EO2", L.EO2, bad2), result("EO3", L.EO3, bad3), result("EO4", L.EO4, bad4), result("EO5", L.EO5, bad5)];
}

/**
 * ER1 마피아 판과 시민 판의 심부름 영역 마크업이 같다(V-25, T-16-15). 입력은 각 판의 { names: 영역 안 data-* 이름 목록, counts: { [표식]: 개수 } } (browser.mjs readErrandSignature).
 * 같아야 하는 것: 구조 표식(ERRAND_PARITY_COUNTED)의 개수, 상태 표식(ERRAND_STATE_ATTRS)을 뺀 data-* 이름 집합.
 * 상태 표식(data-done·data-call·data-rest·data-errand-act)은 판마다 위치가 달라 있고 없고가 다르므로 개수는 견주지 않고 이름이 허용 집합 안인지만 본다. 역할류 이름(fake·mafia·role·decoy·bluff)은 어느 쪽에도 없어야 한다.
 */
export function errandParityChecks(mafia, citizen) {
  const id = "ER1";
  const label = "마피아·시민 심부름 영역의 data-* 이름·구조 표식 개수가 같고 가짜·역할류 표식이 없다";
  const okSig = (z) => z && Array.isArray(z.names) && z.names.every(isStr) && z.counts && typeof z.counts === "object" && ERRAND_PARITY_COUNTED.every((k) => isNum(z.counts[k]));
  if (!okSig(mafia) || !okSig(citizen)) return [noMeasure(id, label, "마피아·시민 판의 심부름 영역 표식 이름·개수")];
  const bad = [];
  const structural = (z) => [...new Set(z.names)].filter((n) => !ERRAND_STATE_ATTRS.includes(n)).sort();
  const a = structural(mafia);
  const b = structural(citizen);
  if (JSON.stringify(a) !== JSON.stringify(b)) bad.push(`표식 이름 집합이 다름(마피아 ${a.join(",")} ≠ 시민 ${b.join(",")})`);
  for (const k of ERRAND_PARITY_COUNTED) if (mafia.counts[k] !== citizen.counts[k]) bad.push(`${k} 개수 마피아 ${mafia.counts[k]} ≠ 시민 ${citizen.counts[k]}`);
  for (const [who, z] of [["마피아", mafia], ["시민", citizen]]) {
    for (const n of new Set(z.names)) {
      if (/fake|mafia|role|decoy|bluff/i.test(n)) bad.push(`${who} 판에 역할류 표식 ${n}`);
      if (ERRAND_STATE_ATTRS.includes(n) === false && ERRAND_MARKERS.includes(n) === false && !ERRAND_STRUCT_EXTRA.includes(n)) bad.push(`${who} 판에 알 수 없는 표식 ${n}`);
    }
  }
  return [result(id, label, bad)];
}
/** 심부름 영역에 구조적으로 더 있는 표식(층 상자) — 허용 집합. */
const ERRAND_STRUCT_EXTRA = ["data-errand-layer", "data-errand-act-layer"];

/**
 * RC1~RC4 목격 기록(ERRAND-05, D-04). s = 위 15페이즈 계약. finished = 3곳을 모두 마친 산 사람인가.
 * RC1 마친 사람만 [기록] 이 있고 못 마친 사람은 단추·카드 0. RC2 열린 카드의 줄 수 표식 = li 개수, 줄 0이면 '0' 한 칸.
 * RC3 열린 카드 윗변 ≥ 독 아랫변 + 8, 띠와 교차 0, 아랫변 ≤ 입력줄 윗변 − 8. 카드는 아래 패널의 채팅 기록 칸을 덮는 것이 설계다(UI-SPEC "기록 카드 영역": 아래는 입력줄 윗변 − 8,
 * 입력줄·[토론 끝내기]는 가려지지 않는다) — 그래서 패널 전체가 아니라 입력줄과의 교차를 본다(15-09 편차, 문턱은 같다). RC4 입력칸 포커스에 카드가 접힌다(마친 사람 필수).
 */
export function recordChecks(s) {
  const L = {
    RC1: "[기록]·카드는 3곳을 마친 사람에게만(못 마친 사람 0건)",
    RC2: "줄 수 표식 = 줄(li) 개수, 줄 0이면 '0'",
    RC3: `카드 윗변 ≥ 독 아랫변 + ${RECORD_DOCK_GAP}, 띠와 교차 0, 아랫변 ≤ 입력줄 윗변 − ${RECORD_DOCK_GAP}`,
    RC4: "입력칸 포커스에 카드가 접힌다",
  };
  const ids = Object.keys(L);
  if (!s || typeof s !== "object" || typeof s.finished !== "boolean" || typeof s.hasButton !== "boolean" || typeof s.hasCard !== "boolean") return ids.map((id) => noMeasure(id, L[id], "기록 읽기 값(finished·hasButton·hasCard)"));
  const out = [];
  const bad1 = [];
  if (s.finished && !s.hasButton) bad1.push("마친 사람인데 [기록] 단추가 없음");
  if (!s.finished && s.hasButton) bad1.push("못 마친 사람에게 [기록] 단추가 있음");
  if (!s.finished && s.hasCard) bad1.push("못 마친 사람에게 기록 카드가 있음");
  out.push(result("RC1", L.RC1, bad1));
  if (!s.finished) return [...out, result("RC2", L.RC2, []), result("RC3", L.RC3, []), result("RC4", L.RC4, [])];
  // RC2·RC3 은 열린 카드에서만 잰다(마친 사람이 카드를 연 읽기). 카드가 없으면 그 읽기가 없었으므로 측정 불가
  if (!s.hasCard) return [...out, noMeasure("RC2", L.RC2, "열린 카드"), noMeasure("RC3", L.RC3, "열린 카드"), typeof s.collapsedOnFocus === "boolean" ? result("RC4", L.RC4, s.collapsedOnFocus ? [] : ["포커스에도 카드가 남음"]) : noMeasure("RC4", L.RC4, "포커스 접힘 읽기")];
  if (isNum(s.rowCount) && (isNum(s.rowsAttr) || (isStr(s.rowsAttr) && /^\d+$/.test(s.rowsAttr)))) {
    const bad = [];
    if (Number(s.rowsAttr) !== s.rowCount) bad.push(`data-record-rows ${s.rowsAttr} ≠ li ${s.rowCount}`);
    if (s.rowCount === 0 && !(isStr(s.zeroText) && s.zeroText.trim() === "0")) bad.push(`줄 0개인데 머리 글자 '${s.zeroText}' ≠ '0'`);
    out.push(result("RC2", L.RC2, bad));
  } else out.push(noMeasure("RC2", L.RC2, "줄 수 표식·li 개수"));
  if (okRect(s.cardRect) && okRect(s.dockRect) && okRect(s.bandRect) && okRect(s.inputRect)) {
    const bad = [];
    if (s.cardRect.top < bottom(s.dockRect) + RECORD_DOCK_GAP - OVERLAP_EPS) bad.push(`카드 윗변 ${rd(s.cardRect.top)} < 독 아랫변 ${rd(bottom(s.dockRect))} + ${RECORD_DOCK_GAP}`);
    if (rectsOverlap(s.cardRect, s.bandRect)) bad.push(`카드·띠 겹침(${overlapText(s.cardRect, s.bandRect)})`);
    if (bottom(s.cardRect) > s.inputRect.top - RECORD_DOCK_GAP + OVERLAP_EPS) bad.push(`카드 아랫변 ${rd(bottom(s.cardRect))} > 입력줄 윗변 ${rd(s.inputRect.top)} − ${RECORD_DOCK_GAP}`);
    out.push(result("RC3", L.RC3, bad));
  } else out.push(noMeasure("RC3", L.RC3, "카드·독·띠·입력줄 사각형"));
  out.push(typeof s.collapsedOnFocus === "boolean" ? result("RC4", L.RC4, s.collapsedOnFocus ? [] : ["포커스에도 카드가 남음"]) : noMeasure("RC4", L.RC4, "포커스 접힘 읽기"));
  return out;
}

/**
 * TC1~TC6 아침 증거 카드(TRACE-02·03, D-06, 16-09 EVID-02). s = 위 계약. expectCard = 피해자가 있고 흔적 구간 안인가(구간 전·피해자 없음은 false).
 * TC1 카드 수 = expectCard ? 1 : 0. TC2 1행 조각 이름 한 줄 + 보조 줄 합쳐 두 줄 이내 + 2행(마지막 목격) 한 줄. TC3 카드 글자·속성에 역할 낱말·'범인'·'증거'·'확정' 0.
 * TC4 피해자 알림과 카드가 동시에 보이지 않는다. TC5 카드가 띠·독 줄·아래 패널과 교차 0.
 * TC6 2행 표식: data-lastseen-row 하나·data-lastseen-count 가 목격자 유무(1|0)와 같고 2행이 카드 밖으로 넘치지 않는다.
 */
export function traceChecks(s) {
  const L = {
    TC1: "피해자 있는 아침의 흔적 구간에만 카드 1개, 아니면 0개",
    TC2: "1행 조각 이름 한 줄 + 보조 줄 합쳐 두 줄 이내 + 2행 한 줄",
    TC3: "카드 글자·속성에 역할 낱말·'범인'·'증거'·'확정' 없음",
    TC4: "피해자 알림과 카드가 동시에 보이지 않음",
    TC5: "카드가 띠·독 줄·아래 패널과 교차 0",
    TC6: "2행 표식 하나·목격자 유무와 같은 count(0|1)·카드 밖으로 안 넘침",
  };
  const ids = Object.keys(L);
  if (!s || typeof s !== "object" || typeof s.expectCard !== "boolean" || !isNum(s.cards)) return ids.map((id) => noMeasure(id, L[id], "흔적 읽기 값(expectCard·cards)"));
  const out = [result("TC1", L.TC1, s.cards === (s.expectCard ? 1 : 0) ? [] : [`카드 ${s.cards}개(기대 ${s.expectCard ? 1 : 0})`])];
  if (s.cards === 0) {
    // 카드가 없는 읽기는 알림 동시 표시 외에 볼 것이 없다 — 나머지는 해당 없음(통과)
    return [...out, result("TC2", L.TC2, []), result("TC3", L.TC3, []), typeof s.announceVisible === "boolean" ? result("TC4", L.TC4, []) : noMeasure("TC4", L.TC4, "알림 표시 여부"), result("TC5", L.TC5, []), result("TC6", L.TC6, [])];
  }
  out.push(
    isNum(s.nameLines) && isNum(s.noteLines) && isNum(s.rowLines)
      ? result("TC2", L.TC2, [...(s.nameLines === 1 ? [] : [`조각 이름 ${s.nameLines}줄 ≠ 1`]), ...(s.nameLines + s.noteLines <= 2 ? [] : [`카드 ${s.nameLines + s.noteLines}줄 > 2`]), ...(s.rowLines === 1 ? [] : [`2행 ${s.rowLines}줄 ≠ 1`])])
      : noMeasure("TC2", L.TC2, "이름·보조 줄·2행 줄 수"),
  );
  if (isStr(s.cardText) && isStr(s.cardAttrText)) {
    const bad = [];
    if (ROLE_WORD_RE.test(s.cardText)) bad.push("카드 글자에 금지 낱말");
    if (ROLE_WORD_RE.test(s.cardAttrText)) bad.push("카드 속성에 금지 낱말");
    out.push(result("TC3", L.TC3, bad));
  } else out.push(noMeasure("TC3", L.TC3, "카드 글자·속성"));
  out.push(typeof s.announceVisible === "boolean" ? result("TC4", L.TC4, s.announceVisible ? ["알림과 카드가 같이 보임"] : []) : noMeasure("TC4", L.TC4, "알림 표시 여부"));
  if (okRect(s.cardRect) && okRect(s.bandRect) && okRect(s.dockRect) && okRect(s.panelRect)) {
    const bad = [];
    for (const [name, r] of [["띠", s.bandRect], ["독 줄", s.dockRect], ["아래 패널", s.panelRect]]) if (rectsOverlap(s.cardRect, r)) bad.push(`카드·${name} 겹침(${overlapText(s.cardRect, r)})`);
    out.push(result("TC5", L.TC5, bad));
  } else out.push(noMeasure("TC5", L.TC5, "카드·띠·독·패널 사각형"));
  if (isNum(s.lastseenRows) && typeof s.expectSeen === "boolean" && typeof s.rowOverflow === "boolean" && (s.lastseenCount === "0" || s.lastseenCount === "1")) {
    const bad = [];
    if (s.lastseenRows !== 1) bad.push(`2행 표식 ${s.lastseenRows}개 ≠ 1`);
    if (s.lastseenCount !== (s.expectSeen ? "1" : "0")) bad.push(`목격 count ${s.lastseenCount}(기대 ${s.expectSeen ? 1 : 0})`);
    if (s.rowOverflow) bad.push("2행이 카드 밖으로 넘침");
    out.push(result("TC6", L.TC6, bad));
  } else out.push(noMeasure("TC6", L.TC6, "2행 표식 읽기"));
  return out;
}

/**
 * TC7·TC8 이름표 표시 좌석(EVID-01, D-09·D-10). stage "morning"(흔적 구간 안) → TC7, "discussion"(낮 단계)·"night"(밤) → TC8.
 * 읽은 data-trace-mark 좌석 = expectTrace(같은 옷 산 사람), data-seen-mark 좌석 = expectSeen(마지막 목격자). 밤에는 expect* 가 모두 빈 배열이다(서버가 증거를 싣지 않음).
 * 표식 값은 모두 빈 값이고(좌석·역할·조각 id 금지) 좌석을 못 찾은 표식(unseated)이 0 이다. 결과 줄에는 좌석 번호만 쓴다.
 */
export function traceMarkChecks(s) {
  const id = s && s.stage === "morning" ? "TC7" : "TC8";
  const label = s && s.stage === "night" ? "밤에는 이름표 표시가 0개" : s && s.stage === "discussion" ? "낮(토론)에도 같은 좌석에 표시가 남아 있다" : "흔적 구간: 같은 옷 산 사람·마지막 목격자 이름표에만 표시";
  const okSeats = (a) => Array.isArray(a) && a.every((x) => Number.isInteger(x));
  if (!s || !["morning", "discussion", "night"].includes(s.stage) || ![s.expectTrace, s.expectSeen, s.trace, s.seen].every(okSeats) || !isNum(s.unseated) || !Array.isArray(s.attrValues)) {
    return [noMeasure(id, label, "표시 좌석 읽기(stage·expect*·trace·seen·unseated·attrValues)")];
  }
  const norm = (a) => JSON.stringify([...a].sort((x, y) => x - y));
  const bad = [];
  if (norm(s.trace) !== norm(s.expectTrace)) bad.push(`같은 옷 표시 좌석 [${[...s.trace].sort((x, y) => x - y)}] ≠ 기대 [${[...s.expectTrace].sort((x, y) => x - y)}]`);
  if (norm(s.seen) !== norm(s.expectSeen)) bad.push(`목격 표시 좌석 [${[...s.seen].sort((x, y) => x - y)}] ≠ 기대 [${[...s.expectSeen].sort((x, y) => x - y)}]`);
  if (s.unseated !== 0) bad.push(`좌석을 못 찾은 표식 ${s.unseated}개`);
  const loud = s.attrValues.filter((v) => v !== "");
  if (loud.length > 0) bad.push(`표식 값이 비어 있지 않음 ${loud.length}개`);
  return [result(id, label, bad)];
}

/** 밤 얼굴 목록 판정이 요구하는 역할 네 시점. */
export const NIGHT_FACE_ROLES = ["mafia", "police", "doctor", "citizen"];
/** 네 시점의 높이 차 허용(px). 마피아 선택 수 배지는 칸 크기를 바꾸지 않아야 하므로 1px 만 본다. */
export const NIGHT_FACE_H_EPS = 1;

/**
 * NF1~NF6 밤 얼굴 목록(TRACE-01, D-05). list = [{ role, count, itemH, listH, eyeHeal, ringMafia, callCount, disabledCount, toastAfterTap }] — 네 역할이 모두 있어야 한다.
 * NF1 칸 수가 네 역할에서 같다. NF2 칸 높이·목록 높이가 같다(±1). NF3 eye·heal 아이콘 0. NF4 data-ring-kind="mafia" 0.
 * NF5 aria-disabled 칸 0이고 [data-call] 수가 네 역할에서 같고 칸 수와 같다(모든 칸이 같이 빛남). NF6 어떤 칸을 눌러도 거절 알림 0.
 */
export function nightFaceChecks(list) {
  const L = {
    NF1: "밤 얼굴 목록 칸 수가 마피아·경찰·의사·시민에서 같다",
    NF2: `칸 높이·목록 높이가 네 역할에서 같다(±${NIGHT_FACE_H_EPS}px)`,
    NF3: "eye·heal 아이콘 0",
    NF4: 'data-ring-kind="mafia" 0',
    NF5: "aria-disabled 칸 0, [data-call] 수가 네 역할에서 같고 칸 수와 같다",
    NF6: "어떤 칸을 눌러도 거절 알림 0",
  };
  const ids = Object.keys(L);
  const okItem = (it) => it && NIGHT_FACE_ROLES.includes(it.role) && [it.count, it.itemH, it.listH, it.eyeHeal, it.ringMafia, it.callCount, it.disabledCount, it.toastAfterTap].every(isNum);
  const roles = Array.isArray(list) ? new Set(list.map((it) => it?.role)) : new Set();
  if (!Array.isArray(list) || !list.every(okItem) || !NIGHT_FACE_ROLES.every((r) => roles.has(r))) return ids.map((id) => noMeasure(id, L[id], "마피아·경찰·의사·시민 밤 얼굴 목록 읽기"));
  const by = (key) => list.map((it) => `${it.role} ${rd(it[key])}`).join(" ≠ ");
  const spread = (key) => Math.max(...list.map((it) => it[key])) - Math.min(...list.map((it) => it[key]));
  const hits = (key) => list.filter((it) => it[key] !== 0).map((it) => `${it.role} ${it[key]}`);
  const bad1 = spread("count") === 0 && list[0].count > 0 ? [] : [`칸 수 ${by("count")}`];
  const bad2 = [...(spread("itemH") <= NIGHT_FACE_H_EPS ? [] : [`칸 높이 ${by("itemH")}`]), ...(spread("listH") <= NIGHT_FACE_H_EPS ? [] : [`목록 높이 ${by("listH")}`])];
  const bad5 = [...hits("disabledCount").map((h) => `aria-disabled ${h}`), ...(spread("callCount") === 0 ? [] : [`[data-call] ${by("callCount")}`]), ...list.filter((it) => it.callCount !== it.count).map((it) => `${it.role} 빛남 ${it.callCount} ≠ 칸 ${it.count}`)];
  return [result("NF1", L.NF1, bad1), result("NF2", L.NF2, bad2), result("NF3", L.NF3, hits("eyeHeal")), result("NF4", L.NF4, hits("ringMafia")), result("NF5", L.NF5, bad5), result("NF6", L.NF6, hits("toastAfterTap"))];
}

// ---- 17페이즈 첫 사건(튜토리얼) 판정 (17-09, TUT-01·TUT-02·TUT-03·TUT-05) ----
// 사본 상수: 앱 src/game/tutorialScript.ts 와 같아야 한다 — test/unit/e2eContract.test.ts 가 대조한다(.mjs 가 TS 를 직접 import 하지 않는다).
/** 진행 점 수(장면 1~7). 앱 TUTORIAL_DOT_COUNT 와 같다 */
export const TUTORIAL_DOT_COUNT = 7;
/** 오프닝에서 꺼지는 램프 수. 앱 OPENING_LAMPS 와 같다 */
export const OPENING_LAMPS = 2;
/** 장면 6 오답이 이만큼 쌓이면 정답 하나만 깜빡인다. 앱 WRONG_HINT_AFTER 와 같다 */
export const WRONG_HINT_AFTER = 2;

const isRectLike = (r) => !!r && [r.left, r.top, r.width, r.height].every(isNum);
const rectText = (r) => `(${rd(r.left)},${rd(r.top)} ${rd(r.width)}x${rd(r.height)})`;

/**
 * 첫 화면 진입(TUT-01, UI-SPEC "첫 화면 진입 계약"): 큰 카드(`kind: "card"`, 처음)·작은 단추(`kind: "button"`, 한 번 본 뒤)·마무리 카드(`kind: "end"`, 끝까지 본 뒤) 중 기대한 하나만 화면 안에 있고
 * 방 코드 칸·[방 만들기] 와 교차 0 이다. entry = { cards, buttons, rect }(rect = 보이는 카드/단추의 사각형), field·create = 방 코드 칸·[방 만들기] 사각형, viewport = { w, h }.
 * 값이 없으면 조용히 통과하지 않고 `측정값 없음` 으로 실패한다. 항상 같은 세 줄(TE1 개수·TE2 화면 안·TE3 교차 0).
 */
export function tutorialEntryChecks({ entry, field, create, viewport }, { kind = "card" } = {}) {
  const L = {
    TE1: kind === "card" ? "처음 카드 1개·작은 단추 0개" : kind === "button" ? "작은 단추 1개·카드 0개" : "마무리 카드 1개·진입 카드·작은 단추 0개",
    TE2: "카드·단추가 화면 안(가로 0~폭, 위 0 이상, 아래 높이 이하)",
    TE3: "카드·단추가 방 코드 칸·[방 만들기] 와 교차 0",
  };
  const okEntry = !!entry && isNum(entry.cards) && isNum(entry.buttons);
  const okView = !!viewport && isNum(viewport.w) && isNum(viewport.h);
  const lines = [];
  if (!okEntry) lines.push(noMeasure("TE1", L.TE1, "[data-tutorial-entry] 개수 읽기"));
  else {
    const want = kind === "card" ? { cards: 1, buttons: 0, ends: 0 } : kind === "button" ? { cards: 0, buttons: 1, ends: 0 } : { cards: 0, buttons: 0, ends: 1 };
    const ends = isNum(entry.ends) ? entry.ends : 0;
    lines.push(result("TE1", L.TE1, entry.cards === want.cards && entry.buttons === want.buttons && ends === want.ends ? [] : [`카드 ${entry.cards}개·단추 ${entry.buttons}개·마무리 카드 ${ends}개 (기대 ${want.cards}·${want.buttons}·${want.ends})`]));
  }
  const rect = okEntry && isRectLike(entry.rect) ? entry.rect : null;
  if (rect === null || !okView) lines.push(noMeasure("TE2", L.TE2, "진입 카드·단추 사각형과 화면 크기"));
  else {
    const inside = rect.left >= -OVERLAP_EPS && right(rect) <= viewport.w + OVERLAP_EPS && rect.top >= -OVERLAP_EPS && bottom(rect) <= viewport.h + OVERLAP_EPS;
    lines.push(result("TE2", L.TE2, inside ? [] : [`${rectText(rect)} 가 ${viewport.w}x${viewport.h} 밖`]));
  }
  if (rect === null || !isRectLike(field) || !isRectLike(create)) lines.push(noMeasure("TE3", L.TE3, "방 코드 칸·[방 만들기] 사각형"));
  else {
    const bad = [];
    if (rectsOverlap(rect, field)) bad.push(`방 코드 칸 ${rectText(field)} 와 겹침`);
    if (rectsOverlap(rect, create)) bad.push(`[방 만들기] ${rectText(create)} 와 겹침`);
    lines.push(result("TE3", L.TE3, bad));
  }
  return lines;
}

/**
 * 한 페이지가 보낸 소켓 프레임의 t 목록이 허용 목록 안인가(TUT-05). ping 은 늘 허용한다. frames = 보낸 프레임 t 문자열 목록(원문·토큰 없음), 없으면 측정값 없음.
 * options.once = 정확히 한 번씩만 보내야 하는 t 목록(예: tutorialDone). 판정 메시지는 t 이름과 횟수뿐이다(T-17-21).
 */
export function sentFrameChecks(frames, allowed, { once = [] } = {}) {
  const label = "보낸 프레임이 허용 목록 안(ping 제외)";
  if (!Array.isArray(frames) || !Array.isArray(allowed)) return noMeasure("TS1", label, "보낸 프레임 t 목록");
  const ok = new Set([...allowed, "ping"]);
  const counts = new Map();
  for (const t of frames) counts.set(String(t), (counts.get(String(t)) ?? 0) + 1);
  const bad = [...counts].filter(([t]) => !ok.has(t)).map(([t, n]) => `${t} ${n}건`);
  for (const t of once) {
    const n = counts.get(t) ?? 0;
    if (n !== 1) bad.push(`${t} ${n}건 (기대 1건)`);
  }
  return result("TS1", label, bad);
}

/**
 * 튜토리얼 출연 사본(17-09): 앱 src/game/tutorialScript.ts 의 TUTORIAL_CAST 와 같아야 한다 — test/unit/e2eContract.test.ts 가 대조한다.
 * me·victim·suspect 는 좌석 번호, errandTarget 은 심부름 장소 id, names 는 가짜 인물 이름 다섯(나 제외 — 누설 검사 낱말).
 */
export const TUTORIAL_CAST_E2E = Object.freeze({ me: 5, victim: 2, suspect: 1, errandTarget: "mail", names: Object.freeze(["서연", "도윤", "민준", "지호", "하린"]) });

// ---- 장면 판정 (17-09 Task 2) ----
// 모든 판정은 { id, label, ok, detail } 줄(들)을 돌려주고, 값이 없으면 조용히 통과하지 않고 `측정값 없음(…)` 으로 실패한다. 메시지에는 키·개수·사각형만 싣는다(T-17-21).

/** 오프닝 자동 넘김(ms)과 허용 오차 — 앱 장면 표 장면 1 advance.afterMs 사본(e2eContract 가 대조). 실제 브라우저의 시간 판정은 여유를 둔다 */
export const TUTORIAL_OPENING_MS = 4600;
export const TUTORIAL_OPENING_TOL_MS = 1000;
/** [처리] 를 누른 뒤 다음 장면까지(ms)와 허용 오차 — 앱 장면 표 장면 3 advance.afterMs 사본 */
export const TUTORIAL_ERRAND_MS = 700;
export const TUTORIAL_ERRAND_TOL_MS = 500;
/** 포커스 상자 여백(대상 둘레 8)과 화면 가장자리 안쪽 거리(8)·허용 오차 2 — 앱 FocusRing 의 PAD */
export const TUTORIAL_FOCUS_PAD = 8;
export const TUTORIAL_FOCUS_TOL = 2;
/** 사회자 띠 파형 막대 수와 글자 하한 */
export const TUTORIAL_BAND_BARS = 5;
export const TUTORIAL_TEXT_MIN = 14;
/** 오프닝 소리 링 수(앱 OpeningFx 의 RINGS) */
export const TUTORIAL_OPENING_RINGS = 3;
/** 직업 카드 종류(장면 7) */
export const TUTORIAL_ROLE_KINDS = Object.freeze(["citizen", "mafia", "doctor", "police"]);

const isViewport = (v) => !!v && isNum(v.w) && isNum(v.h);
const sortedKeys = (list) => list.map((x) => String(x.key)).sort();

/**
 * 포커스 상자(TUT-03): 상자마다 대상 사각형을 사방 8 키운 자리(오차 2) — 화면 안쪽 8 밖이면 크기를 그대로 두고 안으로 민 자리다(앱 FocusRing 과 같은 규칙).
 * boxes = 읽은 상자 [{ key, rect }], targets = 그 장면에서 기대하는 대상 [{ key, rect }](상자 0개를 기대하면 빈 배열). TF1 = 키·개수, TF2 = 위치.
 */
export function tutorialFocusChecks(boxes, targets, viewport) {
  const L = { TF1: "포커스 상자 개수·키가 장면 기대와 같다", TF2: "포커스 상자가 대상 사각형 ± 8(오차 2) 또는 화면 안쪽 8 로 민 자리" };
  const okBox = (b) => b && typeof b.key === "string" && isRectLike(b.rect);
  if (!Array.isArray(boxes) || !boxes.every(okBox) || !Array.isArray(targets) || !targets.every(okBox) || !isViewport(viewport)) {
    return [noMeasure("TF1", L.TF1, "상자·대상 사각형과 화면 크기"), noMeasure("TF2", L.TF2, "상자·대상 사각형과 화면 크기")];
  }
  const have = sortedKeys(boxes);
  const want = sortedKeys(targets);
  const same = have.length === want.length && have.every((k, i) => k === want[i]);
  const tf1 = result("TF1", L.TF1, same ? [] : [`상자 [${have.join(",")}] ≠ 기대 [${want.join(",")}]`]);
  const bad = [];
  const pad = TUTORIAL_FOCUS_PAD;
  for (const t of targets) {
    const box = boxes.find((b) => b.key === t.key);
    if (!box) continue; // 개수·키는 TF1 이 맡는다
    const w = t.rect.width + pad * 2;
    const h = t.rect.height + pad * 2;
    const x = Math.max(pad, Math.min(t.rect.left - pad, viewport.w - pad - w));
    const y = Math.max(pad, Math.min(t.rect.top - pad, viewport.h - pad - h));
    const diffs = [Math.abs(box.rect.left - x), Math.abs(box.rect.top - y), Math.abs(box.rect.width - w), Math.abs(box.rect.height - h)];
    if (diffs.some((d) => d > TUTORIAL_FOCUS_TOL)) bad.push(`${t.key} 상자 ${rectText(box.rect)} ≠ 기대 (${rd(x)},${rd(y)} ${rd(w)}x${rd(h)})`);
  }
  return [tf1, result("TF2", L.TF2, bad)];
}

/**
 * 사회자 띠(TUT-03, HOST): band = { rect, bars, barsMoving, speaking, fontMin, timers }, others = { header, dock, next, targets: [{ key, rect }] }(없는 것은 null — 비교하지 않는다. targets 의 band 키는 띠 자신이라 뺀다).
 * options.speaking = true(말하는 동안: data-speaking 참·막대가 모두 움직임) / false(말이 끝남: 참이 아니고 막대 정지) / 없음(묻지 않음). options.reduced 면 막대 움직임은 보지 않는다(모션 줄이기).
 * TB1 막대 5개 · TB2 말하는 상태 · TB3 머리·소리 독·[다음]·포커스 대상과 교차 0 · TB4 글자 14 이상 · TB5 시간 행 0.
 */
export function tutorialBandChecks(band, others, { speaking, reduced = false } = {}) {
  const L = {
    TB1: `띠 파형 막대 ${TUTORIAL_BAND_BARS}개`,
    TB2: speaking === true ? "말하는 동안 data-speaking 이 참이고 막대가 움직인다" : speaking === false ? "말이 끝나면 data-speaking 이 꺼지고 막대가 멈춘다" : "말하는 상태(묻지 않음)",
    TB3: "띠가 머리·소리 독·[다음]·포커스 대상과 교차 0",
    TB4: `띠 글자 ${TUTORIAL_TEXT_MIN}px 이상`,
    TB5: "띠에 시간 행 0",
  };
  const okBand = !!band && isRectLike(band.rect) && isNum(band.bars) && isNum(band.barsMoving) && typeof band.speaking === "boolean";
  const none = (id) => noMeasure(id, L[id], "사회자 띠 읽기");
  const tb1 = okBand ? result("TB1", L.TB1, band.bars === TUTORIAL_BAND_BARS ? [] : [`막대 ${band.bars}개`]) : none("TB1");
  let tb2 = none("TB2");
  if (okBand) {
    const bad = [];
    if (speaking === true) {
      if (band.speaking !== true) bad.push("data-speaking 이 참이 아님");
      if (!reduced && band.barsMoving !== band.bars) bad.push(`움직이는 막대 ${band.barsMoving}/${band.bars}`);
    } else if (speaking === false) {
      if (band.speaking !== false) bad.push("말이 끝났는데 data-speaking 이 켜져 있음");
      if (!reduced && band.barsMoving !== 0) bad.push(`멈춰야 하는데 움직이는 막대 ${band.barsMoving}개`);
    }
    tb2 = result("TB2", L.TB2, bad);
  }
  let tb3 = none("TB3");
  if (okBand && others && typeof others === "object") {
    const bad = [];
    for (const [name, r] of [["머리", others.header], ["소리 독", others.dock], ["[다음]", others.next]]) if (isRectLike(r) && rectsOverlap(band.rect, r)) bad.push(`${name} ${rectText(r)} 와 겹침`);
    for (const t of Array.isArray(others.targets) ? others.targets : []) if (t.key !== "band" && isRectLike(t.rect) && rectsOverlap(band.rect, t.rect)) bad.push(`포커스 대상 ${t.key} ${rectText(t.rect)} 와 겹침`);
    tb3 = result("TB3", L.TB3, bad);
  }
  const tb4 = okBand && isNum(band.fontMin) ? result("TB4", L.TB4, band.fontMin >= TUTORIAL_TEXT_MIN ? [] : [`글자 ${rd(band.fontMin)}px`]) : none("TB4");
  const tb5 = okBand && isNum(band.timers) ? result("TB5", L.TB5, band.timers === 0 ? [] : [`시간 행 ${band.timers}개`]) : none("TB5");
  return [tb1, tb2, tb3, tb4, tb5];
}

/**
 * 누설(TUT-05, T-17-18): dom = 튜토리얼 밖 화면별 [{ where, names: 그 화면 DOM 에서 나온 가짜 이름들, roleCards: data-tutorial-role-card 개수 }](비어 있으면 측정값 없음),
 * frames = { hits: { 이름: 받은 프레임에서 나온 횟수 } }, roleInTutorial = 튜토리얼 단계에서 받은 view 에 me.role 키가 있던 횟수. TL1 DOM · TL2 받은 프레임 · TL3 me.role.
 */
export function tutorialLeakChecks({ dom, frames, roleInTutorial } = {}) {
  const L = { TL1: "튜토리얼 밖 화면의 DOM 에 가짜 이름 다섯·직업 카드 0", TL2: "받은 프레임에 가짜 이름 다섯 0", TL3: "튜토리얼 중 받은 view 에 me.role 0" };
  const okDom = Array.isArray(dom) && dom.length > 0 && dom.every((d) => d && typeof d.where === "string" && Array.isArray(d.names) && isNum(d.roleCards));
  const tl1 = okDom
    ? result("TL1", L.TL1, dom.flatMap((d) => [...(d.names.length > 0 ? [`${d.where} 에 가짜 이름 ${d.names.join("·")}`] : []), ...(d.roleCards > 0 ? [`${d.where} 에 직업 카드 ${d.roleCards}장`] : [])]))
    : noMeasure("TL1", L.TL1, "화면별 DOM 읽기");
  const tl2 = frames && typeof frames.hits === "object" && frames.hits !== null ? result("TL2", L.TL2, Object.entries(frames.hits).filter(([, n]) => n > 0).map(([name, n]) => `${name} ${n}건`)) : noMeasure("TL2", L.TL2, "받은 프레임 감시");
  const tl3 = isNum(roleInTutorial) ? result("TL3", L.TL3, roleInTutorial === 0 ? [] : [`me.role 이 실린 view ${roleInTutorial}건`]) : noMeasure("TL3", L.TL3, "튜토리얼 단계 view 감시");
  return [tl1, tl2, tl3];
}

/**
 * 장면 6 정체 공개(TUT-03): reveal = { card, stamp, line }, next = [다음]. TR1 모두 화면 안 · TR2 카드·줄·[다음]·도장이 서로 교차 0(도장은 카드 위에 놓이므로 카드와는 비교하지 않는다).
 */
export function tutorialRevealChecks({ reveal, next, viewport } = {}) {
  const L = { TR1: "정체 공개의 카드·도장·줄·[다음] 이 화면 안", TR2: "카드·줄·[다음]·도장이 서로 교차 0(도장은 카드 위)" };
  const ok = !!reveal && isRectLike(reveal.card) && isRectLike(reveal.stamp) && isRectLike(reveal.line) && isRectLike(next) && isViewport(viewport);
  if (!ok) return [noMeasure("TR1", L.TR1, "정체 공개 사각형"), noMeasure("TR2", L.TR2, "정체 공개 사각형")];
  const screen = { left: 0, top: 0, width: viewport.w, height: viewport.h };
  const parts = { 카드: reveal.card, 도장: reveal.stamp, 줄: reveal.line, "[다음]": next };
  const out = Object.entries(parts).filter(([, r]) => !rectInside(r, screen)).map(([n, r]) => `${n} ${rectText(r)} 가 ${viewport.w}x${viewport.h} 밖`);
  const bad = [];
  for (const [a, b] of [["카드", "줄"], ["카드", "[다음]"], ["줄", "[다음]"], ["도장", "줄"], ["도장", "[다음]"]]) if (rectsOverlap(parts[a], parts[b])) bad.push(`${a} ${rectText(parts[a])} 와 ${b} ${rectText(parts[b])} 겹침`);
  return [result("TR1", L.TR1, out), result("TR2", L.TR2, bad)];
}

/**
 * 장면 7 직업 카드(TUT-04): roles = [{ kind, rect }], next = [다음]. TC1 네 종류 한 장씩 · TC2 화면 안 · TC3 카드끼리 교차 0 · TC4 [다음] 과 교차 0.
 * 작은 폰(360x560·640)에서 TC4 가 겹치는 것은 알려진 한계(17-08)라 흐름이 그 크기에서만 id 로 골라 참고 줄로 남긴다 — 판정 문턱은 여기서 낮추지 않는다.
 */
export function tutorialRoleCardChecks({ roles, next, viewport } = {}) {
  const L = { TC1: "직업 카드 네 종류가 한 장씩", TC2: "직업 카드가 화면 안", TC3: "직업 카드끼리 교차 0", TC4: "직업 카드와 [다음] 교차 0" };
  const ok = Array.isArray(roles) && roles.every((r) => r && typeof r.kind === "string" && isRectLike(r.rect)) && isRectLike(next) && isViewport(viewport);
  if (!ok) return Object.keys(L).map((id) => noMeasure(id, L[id], "직업 카드·[다음] 사각형"));
  const counts = new Map();
  for (const r of roles) counts.set(r.kind, (counts.get(r.kind) ?? 0) + 1);
  const bad1 = [...TUTORIAL_ROLE_KINDS.filter((k) => counts.get(k) !== 1).map((k) => `${k} ${counts.get(k) ?? 0}장`), ...[...counts.keys()].filter((k) => !TUTORIAL_ROLE_KINDS.includes(k)).map((k) => `알 수 없는 종류 ${k}`)];
  const firsts = TUTORIAL_ROLE_KINDS.map((k) => roles.find((r) => r.kind === k)).filter(Boolean);
  const screen = { left: 0, top: 0, width: viewport.w, height: viewport.h };
  const bad2 = firsts.filter((r) => !rectInside(r.rect, screen)).map((r) => `${r.kind} ${rectText(r.rect)} 가 ${viewport.w}x${viewport.h} 밖`);
  const bad3 = [];
  for (let i = 0; i < firsts.length; i++) for (let j = i + 1; j < firsts.length; j++) if (rectsOverlap(firsts[i].rect, firsts[j].rect)) bad3.push(`${firsts[i].kind}·${firsts[j].kind} 겹침`);
  const bad4 = firsts.filter((r) => rectsOverlap(r.rect, next)).map((r) => `${r.kind} ${rectText(r.rect)} 가 [다음] ${rectText(next)} 와 겹침`);
  return [result("TC1", L.TC1, bad1), result("TC2", L.TC2, bad2), result("TC3", L.TC3, bad3), result("TC4", L.TC4, bad4)];
}

/**
 * 장면 1 오프닝(TUT-03): opening = { present, lamps, flash, rings, still }. 보통은 램프 번짐 OPENING_LAMPS·번쩍임 1·소리 링 3 이고 어둠이 움직인다(still 거짓),
 * options.reduced(모션 줄이기)면 번짐·번쩍임·링 0 이고 어둠이 정지한다(still 참).
 */
export function tutorialOpeningChecks(opening, { reduced = false } = {}) {
  const L = {
    TO1: reduced ? "모션 줄이기: 램프 번짐 0" : `램프 번짐 ${OPENING_LAMPS}개`,
    TO2: reduced ? "모션 줄이기: 진홍 번쩍임 0" : "진홍 번쩍임 1개",
    TO3: reduced ? "모션 줄이기: 소리 링 0" : `소리 링 ${TUTORIAL_OPENING_RINGS}개`,
    TO4: reduced ? "모션 줄이기: 어둠이 정지" : "어둠이 움직임(정지 아님)",
  };
  const ok = !!opening && opening.present === true && isNum(opening.lamps) && isNum(opening.flash) && isNum(opening.rings) && typeof opening.still === "boolean";
  if (!ok) return Object.keys(L).map((id) => noMeasure(id, L[id], "오프닝 연출 층 읽기"));
  const want = reduced ? { lamps: 0, flash: 0, rings: 0 } : { lamps: OPENING_LAMPS, flash: 1, rings: TUTORIAL_OPENING_RINGS };
  const one = (id, got, exp) => result(id, L[id], got === exp ? [] : [`${got}개 (기대 ${exp})`]);
  return [one("TO1", opening.lamps, want.lamps), one("TO2", opening.flash, want.flash), one("TO3", opening.rings, want.rings), result("TO4", L.TO4, opening.still === reduced ? [] : [`still ${opening.still}`])];
}

/**
 * 장면 시각(TUT-03): openingMs = 오프닝 연출 시작 → 장면 2, errandMs = [처리] 누름 → 장면 4(ms). 주어진 키만 판정한다(키가 있고 값이 없으면 측정값 없음).
 * TM1 4.6초 ± 1.0초 · TM2 0.7초 ± 0.5초(실제 브라우저의 시간 판정은 여유를 둔다).
 */
export function tutorialTimingChecks(t) {
  const out = [];
  const one = (id, label, got, want, tol) => out.push(isNum(got) ? result(id, label, Math.abs(got - want) <= tol ? [] : [`${Math.round(got)}ms (기대 ${want}±${tol})`]) : noMeasure(id, label, "장면 전환 시각"));
  if (t && "openingMs" in t) one("TM1", `오프닝 약 ${TUTORIAL_OPENING_MS / 1000}초 뒤 자동으로 장면 2`, t.openingMs, TUTORIAL_OPENING_MS, TUTORIAL_OPENING_TOL_MS);
  if (t && "errandMs" in t) one("TM2", `[처리] ${TUTORIAL_ERRAND_MS / 1000}초 뒤 장면 4`, t.errandMs, TUTORIAL_ERRAND_MS, TUTORIAL_ERRAND_TOL_MS);
  return out;
}

/** 진행 점(T-16): 점 TUTORIAL_DOT_COUNT 개이고 지금 점이 장면 번호와 같다. TD1 개수 · TD2 지금 */
export function tutorialDotChecks(dots, scene) {
  const L = { TD1: `진행 점 ${TUTORIAL_DOT_COUNT}개`, TD2: `지금 점이 장면 번호(${scene})와 같다` };
  if (!dots || !isNum(dots.count) || !isNum(dots.now)) return [noMeasure("TD1", L.TD1, "진행 점 읽기"), noMeasure("TD2", L.TD2, "진행 점 읽기")];
  return [result("TD1", L.TD1, dots.count === TUTORIAL_DOT_COUNT ? [] : [`점 ${dots.count}개`]), result("TD2", L.TD2, dots.now === scene ? [] : [`지금 점 ${dots.now}`])];
}

/**
 * [건너뛰기](T-16): 알약은 높이 32 이지만 누르는 영역을 투명하게 늘려 44×44 이상이어야 한다(G3 의 탭 하한 TAP_MIN, 낮추지 않는다). skip = { rect, hit }.
 * TK1 누르는 영역 44×44 이상 · TK2 알약이 화면 안
 */
export function tutorialSkipChecks({ skip, viewport } = {}) {
  const L = { TK1: `[건너뛰기] 누르는 영역 ${TAP_MIN}×${TAP_MIN} 이상`, TK2: "[건너뛰기] 가 화면 안" };
  if (!skip || !isRectLike(skip.rect) || !isRectLike(skip.hit) || !isViewport(viewport)) return [noMeasure("TK1", L.TK1, "건너뛰기 사각형"), noMeasure("TK2", L.TK2, "건너뛰기 사각형")];
  const small = skip.hit.width + 0.5 < TAP_MIN || skip.hit.height + 0.5 < TAP_MIN;
  const screen = { left: 0, top: 0, width: viewport.w, height: viewport.h };
  return [result("TK1", L.TK1, small ? [`누르는 영역 ${rd(skip.hit.width)}x${rd(skip.hit.height)}`] : []), result("TK2", L.TK2, rectInside(skip.rect, screen) ? [] : [`${rectText(skip.rect)} 가 ${viewport.w}x${viewport.h} 밖`])];
}

/**
 * 증거 층(TUT-03): ev = { eye, recordRows, traceCard, links, formula }. 장면 4 = EV1 눈 표시 1개 · EV2 기록 카드 한 줄, 장면 5 = EV3 증거 카드 · EV4 연결 선 2개 · EV5 수식 줄이 [다음] 과 교차 0.
 */
export function tutorialEvidenceChecks(ev, { scene, next } = {}) {
  const none = (id, label) => noMeasure(id, label, "증거 층 읽기");
  if (scene === 4) {
    const L = { EV1: "목격 눈 표시 1개", EV2: "목격 기록 카드 한 줄" };
    if (!ev || !isNum(ev.eye) || !isNum(ev.recordRows)) return [none("EV1", L.EV1), none("EV2", L.EV2)];
    return [result("EV1", L.EV1, ev.eye === 1 ? [] : [`눈 표시 ${ev.eye}개`]), result("EV2", L.EV2, ev.recordRows === 1 ? [] : [`기록 ${ev.recordRows}줄`])];
  }
  if (scene === 5) {
    const L = { EV3: "증거 카드", EV4: "연결 선 2개", EV5: "수식 줄이 [다음] 과 교차 0" };
    if (!ev || !isNum(ev.links)) return [none("EV3", L.EV3), none("EV4", L.EV4), none("EV5", L.EV5)];
    return [
      ev.traceCard === null ? result("EV3", L.EV3, ["증거 카드 없음"]) : isRectLike(ev.traceCard) ? result("EV3", L.EV3, []) : none("EV3", L.EV3),
      result("EV4", L.EV4, ev.links === 2 ? [] : [`선 ${ev.links}개`]),
      isRectLike(ev.formula) && isRectLike(next) ? result("EV5", L.EV5, rectsOverlap(ev.formula, next) ? [`수식 ${rectText(ev.formula)} 가 [다음] ${rectText(next)} 와 겹침`] : []) : none("EV5", L.EV5),
    ];
  }
  throw new Error(`tutorialEvidenceChecks: 장면 ${scene} 은 증거 층이 없다`);
}

/** 장면 5 선·도윤 이름표가 들어와야 하는 화면 안쪽 여백(px, UI-SPEC 장면 5 계약 — 앱 clampPoint 의 inset 8 과 같다) */
export const TUTORIAL_LINE_INSET = 8;

/** 장면 5 선·도윤 이름표 판정(EV6~EV8) — 자리 함수(18-08 RED): 아직 아무 줄도 돌려주지 않는다 */
export function tutorialLineChecks(ev, opts) {
  void ev;
  void opts;
  return [];
}

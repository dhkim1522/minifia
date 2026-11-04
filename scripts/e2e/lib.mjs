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
export const OVERALL_LIMIT_MS = 900_000;

// ---- 결과 화면 스냅숏 계약 (04-29 P8) ----
// resultChecks(v, { winner, n, summaryRows }) 가 받는 값의 모양. 결과 화면은 8페이즈에 바뀌지 않는다. 검사 함수는 필드가 없으면
// 조용히 통과하지 않고 `측정값 없음(…)` 으로 실패한다. 사각형은 { left, top, width, height[, right, bottom] }.
// 처형 구간(지목·변론·찬반·처형)의 옛 테이블 판정 계약(VerdictSnap 의 bottom·dt·intro·reveal·execCard·voidCard)은 08-23 에 지웠다(결정 0060-14).
//
//   v.result (ended): {
//     winner: "citizenWin"|"mafiaWin", bannerText(`시민 팀 승리`|`마피아 팀 승리`), bannerSub,
//     cards: [{ seat, job(직업 이름 글자), dead: boolean, figOpacity(캐릭터 그림 계산된 opacity) }],
//     rows(요약 카드 행 수), scrollW, clientW(가로 스크롤 판정), reachedButton(세로 스크롤로 [처음으로] 가 화면에 닿음),
//     glow(위쪽 진홍 번짐 요소 존재), hasPhaseBar(헤더 바·타이머·하단 패널 존재)
//   }

// ---- 5페이즈 계약 (05-05) — UX1·UX2·UX2-J·UX2-PC·WL1·WL2 가 받는 값의 모양 ----
// 05-06·05-07 의 browser.mjs 가 아래 모양 그대로 읽어 온다. 검사 함수는 필드가 없거나 숫자가 아니면 조용히 통과하지 않고 `측정값 없음(…)` 으로 실패한다.
// 높이·좌표 단위는 CSS px, 사각형 값은 getBoundingClientRect 그대로.
//
//   UX1  guideChecks(g, { phase })
//     g = { count, items: [{ text, inHeader, height, lineHeight }], timers }
//       count      `[data-guide]` 요소 수(한 화면에 정확히 하나)
//       items[i]   text = 글자(textContent), inHeader = 헤더 안내줄(`.mf-phasebar__do`)인가, height·lineHeight = 그 요소의 높이와 계산된 줄 높이
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
  "사용법: node scripts/e2e/run.mjs [--url https://minifia-v2.dhplay.workers.dev | http://localhost:5173] [--only <흐름 이름 부분 문자열, 쉼표로 여러 개>] [--shots] [--sizes 360x640,390x664,430x932,360x560]  (--sizes 를 주지 않으면 lobby·world 흐름은 390x844,402x874 도 더해 6개 크기로 돈다)";

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
export function lobbyPanelHeight(logH) {
  return logH + LOBBY_PANEL_EXTRA;
}

// ---- 게임 맵 판정 (08-23, 08-UI-SPEC "아래 패널 종류와 높이"·"검사 가능하게 둘 것"). 순수 함수 — 브라우저에서 읽는 값은 08-24 의 readGame 이 만든다. ----
// 모든 판정은 다른 판정과 같은 { id, label, ok, detail } 줄(들)을 돌려준다. 값이 없거나 숫자가 아니면 조용히 통과하지 않고 `측정값 없음(…)` 으로 실패한다.

/** 게임 맵 아래 패널 높이 덧셈(안전 영역 제외): 토론 = LOG_H + 154, 채팅 = + 92, 찬반 투표자 = + 218, 찬반 보기 = + 126(0062-2: 점 9px 대신 숫자 한 줄 24px 이라 +15), 밤 마피아 = + 154(토론 패널과 같다, 09-UI-SPEC 149~157행). */
export const GAME_PANEL_EXTRA = Object.freeze({ talk: 154, chat: CHAT_PANEL_EXTRA, verdictVoter: 218, verdictViewer: 126, nightMafia: 154 });

/** 밤 시민 패널 높이: 행동 줄 52 [유언] 하나 = 88 고정(09-UI-SPEC 157행, 방 높이와 무관). */
export const NIGHT_CITIZEN_PANEL_H = 88;

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
 * 게임 맵 아래 패널의 기대 높이. kind 는 GAME_PANEL_EXTRA 의 키 또는 "nightCitizen"(88 고정)·"faceList"(opts = { w, n, wrappedRows? }), roomH = 방(뷰포트) 높이.
 * 알 수 없는 kind 는 던진다.
 */
export function gamePanelHeight(roomH, kind, opts) {
  if (kind === "nightCitizen") return NIGHT_CITIZEN_PANEL_H;
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
  assigning: "lobby",
  roleReveal: "lobby",
  dayAnnounce: "day",
  discussion: "day",
  night: "night",
  morning: "morning",
  defense: "dusk",
  execution: "dusk",
  nomination: "dusk",
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

// ---- 04-30 P7 처형 무효 카드·P8 결과 화면·P10 배치 겹침 (UI-SPEC 9.2·11·15.3) ----

const WINNER_BANNER = { citizenWin: "시민 팀 승리", mafiaWin: "마피아 팀 승리" };
const ROLE_WORDS = Object.values(ROLE_NAME);
const RESULT_OPACITY_TOL = 0.05; // 탈락 카드 그림 opacity .5 ± .05

/**
 * P8 결과 화면(ended). v.result = { winner, bannerText, bannerSub, cards:[{ seat, job, dead, figOpacity }], rows, scrollW, clientW, reachedButton, glow, hasPhaseBar },
 * opts = { winner("citizenWin"|"mafiaWin"), n(인원), summaryRows(요약 카드 행 수 기대값) }.
 * 배너=승패, 카드 수=인원, 모든 카드에 직업 이름, 탈락 카드 그림 opacity .5 ± .05(살아 있는 카드 1 ± .05), 요약 행 수, 가로 스크롤 없음(G1),
 * 세로 스크롤로 [처음으로] 에 닿음, 위쪽 진홍 번짐은 마피아 승일 때만, 헤더 바·하단 패널 없음.
 */
export function resultChecks(v, { winner, n, summaryRows } = {}) {
  const label = "결과 화면: 배너·카드 수·직업·탈락 흐림·요약·스크롤·번짐";
  const miss = [];
  if (!(winner in WINNER_BANNER)) miss.push("측정값 없음(winner 인자)");
  if (!isNum(n)) miss.push("측정값 없음(n 인자)");
  if (!isNum(summaryRows)) miss.push("측정값 없음(summaryRows 인자)");
  const r = v?.result;
  if (!r || typeof r !== "object") miss.push("측정값 없음(result)");
  else {
    if (typeof r.winner !== "string") miss.push("측정값 없음(result.winner)");
    if (typeof r.bannerText !== "string") miss.push("측정값 없음(result.bannerText)");
    if (!Array.isArray(r.cards)) miss.push("측정값 없음(result.cards)");
    else if (r.cards.some((c) => typeof c?.job !== "string" || typeof c.dead !== "boolean" || !isNum(c.figOpacity))) miss.push("측정값 없음(result.cards 의 job·dead·figOpacity)");
    if (!isNum(r.rows)) miss.push("측정값 없음(result.rows)");
    if (!isNum(r.scrollW) || !isNum(r.clientW)) miss.push("측정값 없음(result.scrollW·clientW)");
    if (typeof r.reachedButton !== "boolean") miss.push("측정값 없음(result.reachedButton)");
    if (typeof r.glow !== "boolean") miss.push("측정값 없음(result.glow)");
    if (typeof r.hasPhaseBar !== "boolean") miss.push("측정값 없음(result.hasPhaseBar)");
  }
  if (miss.length > 0) return result("P8", label, miss);

  const bad = [];
  if (r.winner !== winner) bad.push(`결과 승자 ${r.winner} ≠ 기대 ${winner}`);
  if (r.bannerText !== WINNER_BANNER[winner]) bad.push(`배너 "${r.bannerText}" ≠ "${WINNER_BANNER[winner]}"`);
  if (r.cards.length !== n) bad.push(`카드 ${r.cards.length}장 ≠ 인원 ${n}`);
  for (const c of r.cards) {
    if (!ROLE_WORDS.includes(c.job)) bad.push(`자리 ${c.seat} 직업 이름 "${c.job}" 가 [${ROLE_WORDS.join("|")}] 중 하나가 아님`);
    const want = c.dead ? 0.5 : 1;
    if (Math.abs(c.figOpacity - want) > RESULT_OPACITY_TOL + 1e-9) {
      bad.push(c.dead ? `탈락 카드(자리 ${c.seat}) 그림 opacity ${fmt(c.figOpacity * 100) / 100} ≠ .5` : `살아 있는 카드(자리 ${c.seat}) 그림 opacity ${fmt(c.figOpacity * 100) / 100} ≠ 1`);
    }
  }
  if (r.rows !== summaryRows) bad.push(`요약 행 ${r.rows}개 ≠ ${summaryRows}`);
  if (r.scrollW > r.clientW) bad.push(`가로 스크롤: scrollWidth ${r.scrollW} > clientWidth ${r.clientW}`);
  if (!r.reachedButton) bad.push("세로 스크롤로 [처음으로] 에 닿지 못함");
  if (r.glow !== (winner === "mafiaWin")) bad.push(winner === "mafiaWin" ? "마피아 승인데 위쪽 진홍 번짐이 없음" : "시민 승인데 진홍 번짐이 있음(마피아 승에만)");
  if (r.hasPhaseBar) bad.push("헤더 바·타이머·하단 패널이 보임(결과 화면에는 없음)");
  return result("P8", label, bad);
}

/**
 * RS-FIT 결과 화면 [처음으로] 가 폰 크기마다 스크롤 없이 화면 안에 있고 눌린다 (09-29, feedback-6).
 * m = { home: { rect:{left,top,width,height}, hit }, scrollTop(.mf-result 의 scrollTop), docScroll(문서 스크롤 높이 − 뷰포트 높이) }, size = { w, h, label }.
 * 버튼 사각형이 뷰포트(0,0,w,h) 안, elementFromPoint 가 버튼(hit), 스크롤 0(scrollTop 0 · docScroll ≤ 1). 측정값이 없으면 실패한다.
 */
export function resultFitChecks(m, size) {
  const label = `결과 화면 [처음으로] 스크롤 없이 화면 안${size?.label ? ` (${size.label})` : ""}`;
  const miss = [];
  if (!size || !isNum(size.w) || !isNum(size.h)) miss.push("측정값 없음(size)");
  const rc = m?.home?.rect;
  if (!rc || !isNum(rc.left) || !isNum(rc.top) || !isNum(rc.width) || !isNum(rc.height)) miss.push("측정값 없음(home.rect)");
  if (typeof m?.home?.hit !== "boolean") miss.push("측정값 없음(home.hit)");
  if (!isNum(m?.scrollTop)) miss.push("측정값 없음(scrollTop)");
  if (!isNum(m?.docScroll)) miss.push("측정값 없음(docScroll)");
  if (miss.length > 0) return result("RS-FIT", label, miss);

  const bad = [];
  const bottomY = rc.top + rc.height;
  const rightX = rc.left + rc.width;
  if (rc.width <= 0 || rc.height <= 0) bad.push("[처음으로] 크기가 0");
  if (rc.top < 0) bad.push(`버튼 위 ${fmt(rc.top)} 가 화면 위 밖`);
  if (bottomY > size.h) bad.push(`버튼 아래 끝 ${fmt(bottomY)} 가 화면 높이 ${size.h} 아래로 나감(화면 밖)`);
  if (rc.left < 0) bad.push(`버튼 왼쪽 ${fmt(rc.left)} 가 화면 왼쪽 밖`);
  if (rightX > size.w) bad.push(`버튼 오른쪽 끝 ${fmt(rightX)} 가 화면 폭 ${size.w} 밖`);
  if (!m.home.hit) bad.push("버튼 가운데 점이 버튼이 아님(가려져 눌리지 않음)");
  if (m.scrollTop !== 0) bad.push(`.mf-result scrollTop ${m.scrollTop} ≠ 0(스크롤을 내려야 보임)`);
  if (m.docScroll > 1) bad.push(`문서 스크롤 여유 ${m.docScroll}px > 1(문서 스크롤)`);
  return result("RS-FIT", label, bad);
}

// ---- 5페이즈 순수 검사 (05-05) ----

/** 측정값이 빠졌거나 모양이 틀린 입력은 조용히 통과하지 않는다(T-05-11). */
const noMeasure = (id, label, what) => result(id, label, [`측정값 없음(${what})`]);

/**
 * UX1 지금 할 일 문장이 한 화면에 하나, 글자가 있고(헤더 안내줄이면 한 줄), 시간 있는 단계에는 타이머가 있다 (D-08, UI-SPEC 8.4).
 * g = { count, items: [{ text, inHeader, height, lineHeight }], timers } — 모양은 위 5페이즈 계약.
 */
export function guideChecks(g, { phase }) {
  const label = "지금 할 일 문장 하나·한 줄·타이머";
  if (!g || !isNum(g.count) || !Array.isArray(g.items) || !isNum(g.timers)) return noMeasure("UX1", label, "안내 문장 개수·항목·타이머 수");
  if (g.count === 0) return result("UX1", label, ["안내 문장 요소 없음"]);
  if (g.count !== 1) return result("UX1", label, [`안내 문장 요소 ${g.count}개 ≠ 1`]);
  const it = g.items[0];
  if (!it || typeof it.text !== "string" || typeof it.inHeader !== "boolean") return noMeasure("UX1", label, "안내 문장 글자");
  const bad = [];
  if (it.text.trim() === "") bad.push("안내 문장 글자가 비어 있음");
  if (it.inHeader) {
    if (!isNum(it.height) || !isNum(it.lineHeight) || it.lineHeight <= 0) return noMeasure("UX1", label, "헤더 안내줄 높이·줄 높이");
    if (!isOneLine(it.height, it.lineHeight)) bad.push(`헤더 안내줄이 한 줄이 아님(높이 ${rd(it.height)}px·줄 높이 ${rd(it.lineHeight)}px, ${lineCount(it.height, it.lineHeight)}줄)`);
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

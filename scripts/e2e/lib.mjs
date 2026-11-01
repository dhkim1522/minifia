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

// ---- 처형 구간 스냅숏 계약 (04-29) ----
// 처형 구간(execVote·candidateVote·candidateVoteReveal·defense·execution·ended) 검사 P1~P10 이 받는 값의 모양을 여기 한 곳에 적는다.
// 04-31 의 `readVerdict(page)`(browser.mjs)가 이 모양 그대로 만든다. 사각형은 위 머리 주석과 같은 { left, top, width, height[, right, bottom] }.
// 검사 함수는 필드가 없으면 조용히 통과하지 않고 `측정값 없음(…)` 으로 실패한다(기존 검사와 같은 규칙).
//
//   VerdictSnap = {
//     bottom: {                      // 하단 패널(.mf-claimpanel / .mf-execvote 등)
//       title: string,               //   제목 글자
//       guide: string,               //   안내 줄 글자(없으면 "")
//       guideH: number,              //   안내 줄 요소 높이(px, 없으면 NaN — 결정 0040 P11)
//       guideLH: number,             //   안내 줄 계산된 line-height(px, 없으면 NaN)
//       tally: string,               //   집계 줄 글자 `.mf-execvote__tally`(없으면 "")
//       pill: string | null,         //   알약 글자(`관전 중 · …`, `…님에게 투표했어요`, `선택 안 함`). 없으면 null
//       buttons: [{ text, pressed: boolean|null, disabled, w, h }],  // `.mf-seg__b` 등 누르는 요소. pressed = aria-pressed, w·h = 탭 크기(px)
//       height: number,              //   패널 높이(px)
//     },
//     dt: {                          // 낮 테이블 장면(.mf-dt)
//       textHits: number,            //   이름표·캐릭터 안에 `찬성`·`반대`·`투표` 글자가 든 요소 수(익명 D-02)
//       haloImgs: [{ seat, kind: "white"|"amber"|"crimson" }],       // 후광 img 전부(한 화면 합계 ≤ 3)
//       seatButtons: [{ seat, pickable: boolean, pressed: boolean|null, label }], // 자리마다 하나. pickable = 누를 수 있는 버튼
//       scene: { left, top, right, bottom, width },                  // 장면 상자(top = 헤더 아래끝)
//     },
//     intro: { count, pointerEvents, cardOpacity, residueCount },    // `.mf-vintro` 수·계산된 pointer-events·카드 불투명도·남은 불투명 잔상 요소 수
//     reveal: {                      // 공개 단계(candidateVoteReveal)
//       arrows: number,              //   `.mf-varrow` 동시 수
//       chips: [{ seat, n, tone: "pop"|"lead"|"beat"|…, left, top, right, bottom }], // `.mf-vchip`
//       tags: [{ seat, left, top, right, bottom }],                  // 이름표 사각형(P10, 04-30)
//     },
//     crimsonNew: number,            // 이 페이즈가 새로 그린 요소(카드·화살표·칩·후광·처형 카드) 중 진홍을 쓰는 요소 수. 0 이어야 한다
//     crimsonScreen: number,         // 화면 전체 진홍 요소 수(동료 마름모·후광 포함). 방장이 시민이면 0 이어야 한다
//     newColors?: [{ desc, color }], // (선택) 새 요소가 쓴 색의 rgb 문자열 — 있으면 crimsonColors 와 비교해 crimsonNew 에 더한다
//     screenColors?: [{ desc, color }], // (선택) 화면 전체 요소가 쓴 색 — 같은 방식으로 crimsonScreen 에 더한다
//   }
//
// 시간표본 입력(재는 쪽이 시각 오름차순으로 모은다): introChecks 는 [{ t(ms, 도착 이후), intro }] + { clickedThrough },
// revealChecks 는 [{ t, reveal, dt:{ haloImgs, scene }, crimsonNew }].
//
// ---- 04-30 이 더한 필드 (P5·P6·P7·P8·P10) — VerdictSnap 에 아래가 이어진다 ----
//   VerdictSnap.bottom 추가: height(패널 높이 px; 변론 후보 본인은 236, 그 밖은 157), buttons = 변론 칩 버튼 목록을 그대로 재사용(후보 본인 6개).
//   VerdictSnap.dt 추가 (P5 변론):
//     center: { seat, cx(후보 좌석 가운데 x), scale(계산된 배율), z(좌석 z-index), tagZ(이름표 z-index), tagBottom(이름표 아래끝 y) },
//     others: { maxSeatZ, maxTagZ },     // 후보가 아닌 모든 자리·이름표 z-index 의 최댓값
//     dim:    { count(`.mf-dt__dim--verdict` 수), backdropFilter(계산된 값), background(계산된 값 `rgba(…, .45)`), z },
//     cones:  number,                    // 원뿔 층 수(`.mf-dt__cone`)
//   VerdictSnap.dt 추가 (P6 처형):
//     ghosts: number[],                  // 그림이 유령(`/characters/ghost/`)인 자리 번호 목록
//     roleImgs: number,                  // `/characters/roles/` 그림 수(살아 있는 viewer 화면에서 0)
//     roleWords: number,                 // 화면에 보이는 역할 이름 글자 요소 수(마피아·경찰·의사·시민)
//     header, panel: { left, top, right, bottom },   // P10 배치 비교용 사각형
//   VerdictSnap.execCard (P6): { count, title, sub, borderColor(계산된 border-color 문자열) }       // `.mf-morningcard--amber`
//   VerdictSnap.voidCard (P7): { count, title, sub, borderColor, pointerEvents }                      // 처형 무효 회색 카드
//   VerdictSnap.card (P10, 선택): { rect }                                                           // 인트로·무효 카드 사각형
//   VerdictSnap.reveal.chips: 각 { seat, n, tone, left, top, right, bottom }, reveal.tags: 각 { seat, left, top, right, bottom }(모든 이름표)
//   VerdictSnap.result (P8, ended): {
//     winner: "citizenWin"|"mafiaWin", bannerText(`시민 팀 승리`|`마피아 팀 승리`), bannerSub,
//     cards: [{ seat, job(직업 이름 글자), dead: boolean, figOpacity(캐릭터 그림 계산된 opacity) }],
//     rows(요약 카드 행 수), scrollW, clientW(가로 스크롤 판정), reachedButton(세로 스크롤로 [처음으로] 가 화면에 닿음),
//     glow(위쪽 진홍 번짐 요소 존재), hasPhaseBar(헤더 바·타이머·하단 패널 존재)
//   }
// P7 시간표본: [{ t(ms, 처형 무효 카드 도착 기준), voidCard, nightIntro(밤 시작 문구 `.mf-sceneintro` 수) }] + { clickedThrough }.

// ---- 5페이즈 계약 (05-05) — UX1·UX2·UX2-J·UX2-PC·AT1·AT2·WL1·WL2 가 받는 값의 모양 ----
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
//   AT1  vignetteChecks(a, { expect })    expect = 1(밤) | 0(밤이 아님)
//     a = { vignettes: [{ pointerEvents, backgroundImage }], tapHitsTable }
//       vignettes    `.mf-backdrop__vignette` 요소별 계산된 값. tapHitsTable = 내 인물 위 한 점을 탭했을 때 elementFromPoint 가 비네팅이 아닌 테이블 쪽 요소를 돌려주는가(expect 1 에서만 필요)
//   AT2  glowChecks(a, { expect })        expect = 1(밤 → 아침을 본 렌더) | 0
//     a = { glows: [{ pointerEvents, backgroundImage, top, bottom }], sceneTop, sceneBottom, tagHit }
//       glows        `.mf-morningglow` 요소별 계산된 값과 사각형 위·아래. sceneTop·sceneBottom = 장면 상자 `.mf-dayscene__scene` 위·아래
//       tagHit       이름표 위 한 점을 탭했을 때 elementFromPoint 가 밝아짐 층이 아니라 이름표 쪽을 돌려주는가(expect 1 에서만 필요)
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
 * G7 이 보지 않는 작은 글자(14px 미만). `.mf-journal__new` 하나로 시작한다.
 * 더할 수 있는 것은 테스트 도구 선택자(`.mf-tt*`, 제품 UI 아님)뿐이다 — 단위 테스트가 그 밖 선택자를 거부한다(D-18).
 */
export const TEXT_SIZE_ALLOW = [
  { selector: ".mf-journal__new", reason: "NEW 알약 12px — 03 에서 허용된 캡션(UI-SPEC 타이포)" },
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
  "사용법: node scripts/e2e/run.mjs [--url https://minifia-v2.dhplay.workers.dev | http://localhost:5173] [--only <시나리오 부분 문자열>] [--shots] [--sizes 360x640,390x664,430x932,360x560]  (--sizes 를 주지 않으면 lobby·world 흐름은 390x844,402x874 도 더해 6개 크기로 돈다)";

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
  // 결정 0056 개정(G2-8ch): v1.0 고정 테이블의 6 그래핌 이상 이름 이름표(.mf-dt__tag 와 그 안쪽 요소, fixedTagName)가 화면 밖이면 완화 범위다. 그 밖의 요소는 그대로 실패한다.
  const g2Out = snap.elements.filter((e) => e.rect.left < -0.5 || right(e.rect) > w + 0.5);
  const g2Bad = g2Out.filter((e) => !isWideName(e.fixedTagName)).map((e) => `${e.desc} (${fmt(e.rect.left)}~${fmt(right(e.rect))})`);
  const g2Relaxed = g2Out.filter((e) => isWideName(e.fixedTagName)).map((e) => `${e.desc} (${fmt(e.rect.left)}~${fmt(right(e.rect))})`);
  const g3Bad = snap.interactive
    .filter((e) => e.rect.width + 0.5 < TAP_MIN || e.rect.height + 0.5 < TAP_MIN)
    .map((e) => `${e.desc} ${fmt(e.rect.width)}x${fmt(e.rect.height)}`);
  const issues = snap.issues ?? { console: [], failed: [], offOrigin: [] };
  const mk = (id, bad, name) => ({ id, ok: bad.length === 0, detail: bad.length === 0 ? "" : `${name}: ${list(bad)}` });
  return [
    mk("G1", g1Bad, "가로 스크롤"),
    g2Bad.length === 0 && g2Relaxed.length > 0
      ? { id: "G2", ok: true, relaxed: true, detail: `승인 완화(G2-8ch, 결정 0056) 적용: 6자 이상 이름 이름표 요소 ${g2Relaxed.length}개 화면 밖 — ${list(g2Relaxed)}` }
      : mk("G2", g2Bad, "화면 밖"),
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

// ---- 낮 장면·아침·테이블 검사 규칙(과제 2). 알려진 결함 D1·D4 도 다른 단언과 똑같이 판정한다 — 예외 분기를 두지 않는다. ----

/** 제목 한 줄 판정 배율(줄 높이의 1.6배까지). 낮추지 않는다(D1). */
export const ONE_LINE_FACTOR = 1.6;
/** 얼굴 = 캐릭터 상자의 위 45%. */
export const FACE_RATIO = 0.45;
/** 낮 장면 하단 패널 높이(결정 0017). */
export const PANEL_H = 157;
/**
 * 변론의 후보 본인 하단 패널 높이 236 — 승인 시안 DC 값(승인 완화 `P-PANEL-236`). defenseChecks 가 isCandidate 일 때만 이 값을 요구하고
 * 그 밖의 모든 상태는 PANEL_H 157 이다. PANEL_H 자체는 낮추지 않는다.
 */
export const PANEL_H_DEFENSE_ME = 236;
/** 앰버 처형 카드 테두리(UI-SPEC 6.2 amber-400 #f2b84b). 회색·진홍 색값은 04-31 이 토큰에서 읽어 넘긴다. */
export const AMBER_RGB = "rgb(242, 184, 75)";
/** 양옆 캐릭터와 테이블 면 사이 가로 간격 하한(px, T2). P2 계산 최소는 6.2. */
export const SIDE_GAP_MIN = 4;
/** 장면 상자 위의 머리 높이(실측 119.2, T1). */
export const HEADER_H = 119.2;
/** 직업 이름(시트 칩 글자). */
export const ROLE_NAME = { mafia: "마피아", police: "경찰", doctor: "의사", citizen: "시민" };

export function isOneLine(height, lineHeight) {
  return height <= lineHeight * ONE_LINE_FACTOR + 1e-6;
}
export function lineCount(height, lineHeight) {
  return Math.round(height / lineHeight);
}
/** 캐릭터 상자의 얼굴 영역(위 45%). */
export function faceRegion(r) {
  return { left: r.left, right: right(r), top: r.top, bottom: r.top + r.height * FACE_RATIO };
}

const rd = (n) => Math.round(n * 10) / 10;
const HALO_KINDS = ["white", "amber", "crimson"]; // 후광 img 의 색 종류
const HALO_MAX = 3; // 한 화면 후광 img 상한(src/game/dayTable.ts 의 HALO_MAX_SIMULTANEOUS 와 같은 값)
/** 겹친 크기를 사람이 판단할 수 있게 내용 칸에 적는다(기준은 바꾸지 않는다). */
const overlapText = (a, b) =>
  `가로 ${rd(Math.min(right(a), right(b)) - Math.max(a.left, b.left))}px·세로 ${rd(Math.min(bottom(a), bottom(b)) - Math.max(a.top, b.top))}px`;
const result = (id, label, bad) => ({ id, label, ok: bad.length === 0, detail: bad.length === 0 ? "" : bad.join("; ") });
const hasPoint = (r, x, y) => x >= r.left && x <= right(r) && y >= r.top && y <= bottom(r);

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
  { id: "P-PANEL-236", approved: "execution-v1/DC-defense-me", reason: "변론의 후보 본인 하단 패널 높이 157 → 236(제목+안내+칩 3줄×2칸). 승인 시안 DC 값이며 defenseChecks 가 isCandidate 일 때만 허용한다(UI-SPEC 8.4·15.1, 결정 0030 §6)" },
  // 결정 0056(2026-11-01): 테스트 봇 이름이 8자가 되어도 v1.0 고정 테이블 화면(8~9페이즈에 삭제)은 5자 기준 간격이다. 기준 수치(0.5px·보이는 비율 바닥)는 그대로, 적용 범위만 좁게 표시한다.
  // 범위 = v1.0 고정 테이블 화면(.mf-dt__tag)에서 6 그래핌 이상 이름표가 낀 겹침(D9)·6 그래핌 이상 이름표의 보이는 비율(D3b). 6자 미만끼리의 겹침, 새 맵 화면(NT1·NT3·NT4)은 그대로 판정한다.
  // 8~9페이즈에 고정 테이블을 지울 때 이 두 항목도 함께 지운다.
  { id: "D9-8ch", approved: "결정 0056", reason: "v1.0 고정 테이블 화면(8~9페이즈 삭제)에서 6 그래핌 이상 이름이 낀 이름표 겹침(D9). 겹침 기준 0.5px 불변" },
  { id: "D3b-8ch", approved: "결정 0056", reason: "v1.0 고정 테이블 화면(8~9페이즈 삭제)에서 6 그래핌 이상 이름표의 보이는 비율 바닥(D3b). 인원별 바닥 수치 불변" },
  // 결정 0056 개정(2026-11-01, 사용자 선택 1): 같은 범위를 G2·D2·P10 으로 넓힌다. 대상은 v1.0 고정 테이블의 이름표(.mf-dt__tag 와 그 안쪽)와 칩뿐이다.
  { id: "G2-8ch", approved: "결정 0056", reason: "v1.0 고정 테이블 화면(8~9페이즈 삭제)에서 6 그래핌 이상 이름의 이름표(.mf-dt__tag 와 그 안쪽 요소)가 화면 가로 밖으로 나감(G2). 그 밖의 요소가 화면 밖이면 그대로 실패. 화면 가로 기준 불변" },
  { id: "D2-8ch", approved: "결정 0056", reason: "v1.0 고정 테이블 화면(8~9페이즈 삭제)에서 6 그래핌 이상 이름의 이름표가 장면 상자 밖으로 나감(D2 의 장면 밖 부분만). 하단 패널과 겹침은 그대로 실패" },
  { id: "P10-8ch", approved: "결정 0056", reason: "v1.0 고정 테이블 화면(8~9페이즈 삭제)에서 투표 공개 칩이 6 그래핌 이상 이름의 이름표와 겹침(P10 의 칩-이름표 부분만). 헤더·패널·카드 겹침은 그대로 실패" },
];

/** 결정 0056 완화 범위의 이름 조건: 이 그래핌 수 이상인 이름. */
export const WIDE_NAME_GRAPHEMES = 6;
const isWideName = (name) => typeof name === "string" && graphemeCount(name) >= WIDE_NAME_GRAPHEMES;
const isWideTag = (t) => isWideName(t?.name);

/** 완화가 적용된 통과 행: ok 이지만 relaxed 표시와 적용 내용을 detail 에 남긴다(결과 표에 보인다). */
const relaxedResult = (id, label, relaxId, notes) => ({ id, label, ok: true, relaxed: true, detail: `승인 완화(${relaxId}, 결정 0056) 적용: ${notes.join("; ")}` });

/** D3b 인원별 이름표 보이는 비율 바닥. 4명 100 %(부동소수 오차 0.001 허용), 5명 98.0 %(승인 완화), 6명 85 %, 7명 50 %, 8명 55 %. */
function visibilityFloor(n) {
  if (n <= 4) return 0.999;
  if (n === 5) return D3B_FLOOR_5_PLAYERS;
  if (n === 6) return 0.85;
  if (n === 7) return 0.5;
  return 0.55;
}

/**
 * D3a 이름표 z-index < 캐릭터 z-index 구조 증명.
 * 사용자 승인 교체(UI-SPEC F7, D-18): 이전 기준 = 「이름표 ↔ 이웃 얼굴 영역(상자 위 45 %) 기하 겹침 0」(D3). 그 검사는 삭제했다.
 */
function d3aStructure(snap) {
  const tagZ = snap.tags.map((t) => t.z);
  const seatZ = snap.seats.map((x) => x.z);
  if (tagZ.length === 0 || seatZ.length === 0) return ["이름표 또는 캐릭터가 없어 층을 비교할 수 없음"];
  if ([...tagZ, ...seatZ].some((z) => !Number.isFinite(z))) return [`z-index 를 읽지 못함 (이름표 ${tagZ.join("/")}, 캐릭터 ${seatZ.join("/")})`];
  const tagMax = Math.max(...tagZ);
  const seatMin = Math.min(...seatZ);
  return tagMax < seatMin ? [] : [`이름표 z 최댓값 ${tagMax} ≥ 캐릭터 z 최솟값 ${seatMin}`];
}

/**
 * D3b 이름표 보이는 비율 바닥.
 * 사용자 승인 교체(UI-SPEC F7, D-18): 이전 기준 = 이름표가 어떤 얼굴도 가리지 않음(기하 겹침 0). 이제 캐릭터가 이름표를 가릴 수 있으나 읽을 수 있는 바닥은 지킨다.
 * ratio 가 null(이미지 미로드)이면 조용히 통과시키지 않고 실패한다.
 */
function d3bVisibility(snap) {
  const v = snap.tagVisibility;
  if (!Array.isArray(v) || v.length === 0) return { bad: ["이름표 보이는 비율을 측정하지 못함 (tagVisibility 없음)"], relaxed: [] };
  const unloaded = v.filter((x) => x.ratio === null || x.ratio === undefined || Number.isNaN(x.ratio));
  if (unloaded.length > 0) return { bad: [`이미지가 로드되지 않아 측정하지 못함: 자리 ${unloaded.map((x) => x.seat).join("/")}`], relaxed: [] };
  const floor = visibilityFloor(v.length);
  const bad = [];
  const relaxed = [];
  // 가장 낮은 자리부터 모든 미달 자리를 본다. 6 그래핌 이상 이름표의 미달은 결정 0056 완화 범위(D3b-8ch)라 바닥은 그대로 두고 표시만 한다.
  for (const low of [...v].filter((x) => x.ratio < floor).sort((a, b) => a.ratio - b.ratio)) {
    const text = `${v.length}명판 자리 ${low.seat} 이름표 ${rd(low.ratio * 100)}% < 바닥 ${rd(floor * 100)}%`;
    const tag = (snap.tags ?? []).find((t) => t.seat === low.seat);
    if (isWideTag(tag)) relaxed.push(`${text} (이름 ${graphemeCount(tag.name)}자)`);
    else bad.push(text);
  }
  return { bad: bad.slice(0, 1), relaxed };
}

/**
 * D4 [테스트] 버튼 규칙.
 * 사용자 승인 완화(UI-SPEC F7, D-18): 이전 기준 = 「어떤 캐릭터 상자와도 0.5px 초과 겹침 금지」. 이제 ① 상자와 겹치는 세로 깊이 ≤ 3px
 * (상자 맨 위 투명 여백), ② 얼굴 영역 가운데 점·이름표와 겹침 0, ③ 가운데 점 elementFromPoint 가 [테스트] 버튼(hit).
 */
function d4TestButton(snap) {
  if (!snap.tt) return ["[테스트] 버튼 없음"];
  const bad = [];
  const tt = snap.tt.rect;
  for (const s of snap.seats) {
    const w = Math.min(right(tt), right(s.rect)) - Math.max(tt.left, s.rect.left);
    if (w <= OVERLAP_EPS) continue;
    const depth = Math.min(bottom(tt), bottom(s.rect)) - Math.max(tt.top, s.rect.top);
    if (depth > 3 + 1e-6) bad.push(`자리 ${s.seat} 캐릭터 상자와 세로 ${rd(depth)}px 겹침 > 3px (가로 ${rd(w)}px)`);
    const f = faceRegion(s.rect);
    if (hasPoint(tt, (f.left + f.right) / 2, (f.top + f.bottom) / 2)) bad.push(`자리 ${s.seat} 얼굴 가운데 점을 가림`);
  }
  for (const t of snap.tags) if (rectsOverlap(tt, t.rect)) bad.push(`자리 ${t.seat} 이름표와 겹침 (${overlapText(tt, t.rect)})`);
  if (snap.tt.hit !== true) bad.push("가운데 점을 눌러도 [테스트] 버튼이 아님(elementFromPoint)");
  return bad;
}

function d3bResult(snap) {
  const r = d3bVisibility(snap);
  const label = "이름표 보이는 비율";
  if (r.bad.length > 0) return result("D3b", label, r.bad);
  return r.relaxed.length > 0 ? relaxedResult("D3b", label, "D3b-8ch", r.relaxed) : result("D3b", label, []);
}

/** 낮 장면(직업 공개·토론·밤·아침)의 고정물 검사 D1·D2·D3a·D3b·D4·D5·D6·D8. D3b 는 결정 0056 완화 범위(6 그래핌 이상 이름표)만 표시하고 통과시킨다. */
export function dayChecks(snap, { w, h }) {
  // D1 위쪽 제목이 한 줄
  const d1 = [];
  if (!snap.h1) d1.push("제목 없음");
  else if (!isOneLine(snap.h1.rect.height, snap.h1.lineHeight))
    d1.push(`"${snap.h1.text}" ${lineCount(snap.h1.rect.height, snap.h1.lineHeight)}줄 (높이 ${rd(snap.h1.rect.height)}, 줄 높이 ${rd(snap.h1.lineHeight)})`);

  // D2 이름표가 장면 안·패널 밖
  // 결정 0056 개정(D2-8ch): 6 그래핌 이상 이름 이름표의 "장면 밖"만 완화한다. 하단 패널과 겹침은 이름 길이와 무관하게 실패.
  const d2 = [];
  const d2Relaxed = [];
  for (const t of snap.tags) {
    if (snap.scene && !rectInside(t.rect, snap.scene)) (isWideTag(t) ? d2Relaxed : d2).push(`자리 ${t.seat} 이름표가 장면 밖`);
    if (snap.panel && rectsOverlap(t.rect, snap.panel.rect)) d2.push(`자리 ${t.seat} 이름표가 하단 패널과 겹침`);
  }

  // D5 세로 스크롤 없음
  const d5 = snap.docH > h ? [`문서 높이 ${rd(snap.docH)} > ${h}`] : [];

  // D6 하단 패널 높이 157
  const d6 = [];
  if (!snap.panel) d6.push("하단 패널 없음");
  else if (Math.abs(snap.panel.rect.height - PANEL_H) > 0.5) d6.push(`패널 높이 ${rd(snap.panel.rect.height)} ≠ ${PANEL_H}`);

  // D8 위쪽 바 버튼이 한 줄
  const d8 = [];
  if (!snap.extra) d8.push("위쪽 바 버튼 칸 없음");
  else {
    const tops = snap.extra.children.map((c) => c.top);
    if (tops.length > 0 && Math.max(...tops) - Math.min(...tops) > 1) d8.push(`버튼 top ${tops.map(rd).join("/")}`);
    if (!rectInside(snap.extra.rect, { left: 0, top: 0, width: w, height: h })) d8.push("버튼 칸이 화면 밖");
  }

  return [
    result("D1", "위쪽 제목이 한 줄", d1),
    d2.length === 0 && d2Relaxed.length > 0 ? relaxedResult("D2", "이름표가 장면 안·패널 밖", "D2-8ch", d2Relaxed) : result("D2", "이름표가 장면 안·패널 밖", d2),
    result("D3a", "이름표가 캐릭터 아래 층", d3aStructure(snap)),
    d3bResult(snap),
    result("D4", "[테스트]가 얼굴·이름표를 안 가리고 눌림", d4TestButton(snap)),
    result("D5", "세로 스크롤 없음", d5),
    result("D6", "하단 패널 높이 157", d6),
    result("D8", "위쪽 바 버튼이 한 줄", d8),
  ];
}

/**
 * M1 아침 카드 허용 범위.
 * 사용자 승인 완화(UI-SPEC F7, D-18): 이전 기준 = 카드가 남의 얼굴 영역(상자 위 45 %)과도 겹치지 않음. 이 5초에 한해 그 검사만 뺀다.
 * 남은 검사: top 168±0.5 · 가로 가운데 · 폭 252±0.5 · 뷰포트 안 · 하단 패널·내 캐릭터 상자·내 이름표와 안 겹침.
 * h 가 없으면 snap.vh 를 쓴다.
 */
export function morningCardIssues(snap, { w, h, mySeat }) {
  const card = snap.card;
  if (!card) return { id: "M1", label: "아침 카드 허용 범위", ok: false, detail: "아침 카드 없음" };
  const vh = h ?? snap.vh;
  const bad = [];
  if (Math.abs(card.top - 168) > 0.5) bad.push(`top ${rd(card.top)} ≠ 168`);
  const cx = card.left + card.width / 2;
  if (Math.abs(cx - w / 2) > 0.5) bad.push(`가운데 ${rd(cx)} ≠ ${rd(w / 2)}`);
  if (Math.abs(card.width - 252) > 0.5) bad.push(`폭 ${rd(card.width)} ≠ 252`);
  const outside = card.left < -0.5 || right(card) > w + 0.5 || card.top < -0.5 || (vh !== undefined && bottom(card) > vh + 0.5);
  if (outside) bad.push(`뷰포트 밖 (${rd(card.left)}~${rd(right(card))}, ${rd(card.top)}~${rd(bottom(card))})`);
  if (snap.panel && rectsOverlap(card, snap.panel.rect)) bad.push("하단 패널과 겹침");
  const mine = snap.seats.find((s) => s.seat === mySeat);
  if (mine && rectsOverlap(card, mine.rect)) bad.push("내 캐릭터와 겹침");
  const myTag = snap.tags.find((t) => t.seat === mySeat);
  if (myTag && rectsOverlap(card, myTag.rect)) bad.push("내 이름표와 겹침");
  return result("M1", "아침 카드 허용 범위", bad);
}

/** M3 아침 어둡게 층. expectSpotlit(탈락자가 있음)이면 강조 자리가 있어야 하고, 강조 자리의 z 는 층보다 높아야 한다. */
export function dimChecks(snap, { w, expectSpotlit = false }) {
  const dim = snap.dim;
  if (!dim) return { id: "M3", label: "아침 어둡게 층", ok: false, detail: "어둡게 층(.mf-dt__dim) 없음" };
  const bad = [];
  const sc = snap.scene;
  if (!sc) bad.push("장면 사각형 없음");
  else {
    const r = dim.rect;
    const same = Math.abs(r.left - 0) <= 0.5 && Math.abs(r.width - w) <= 0.5 && Math.abs(r.top - sc.top) <= 0.5 && Math.abs(r.height - sc.height) <= 0.5;
    if (!same) bad.push(`층 ${rd(r.left)},${rd(r.top)} ${rd(r.width)}x${rd(r.height)} ≠ 장면+여백 0,${rd(sc.top)} ${w}x${rd(sc.height)}`);
  }
  if (snap.header && rectsOverlap(dim.rect, snap.header)) bad.push("헤더를 덮음");
  if (snap.panel && rectsOverlap(dim.rect, snap.panel.rect)) bad.push("하단 패널을 덮음");
  if (dim.pointerEvents !== "none") bad.push(`pointer-events ${dim.pointerEvents} ≠ none`);
  const spot = snap.seats.filter((x) => x.spotlit);
  if (expectSpotlit && spot.length === 0) bad.push("탈락자가 있는데 강조 자리(.mf-dt__seat--spotlit) 없음");
  for (const x of spot) if (!(x.z > dim.z)) bad.push(`강조 자리 ${x.seat} z ${x.z} ≤ 층 z ${dim.z}`);
  return result("M3", "아침 어둡게 층", bad);
}

/** M4 아침이 끝난 뒤 장면에 카드·층이 DOM 에 없다. */
export function morningGoneChecks(snap) {
  const bad = [];
  if (snap.card) bad.push("아침 카드가 남아 있음");
  if (snap.dim) bad.push("어둡게 층이 남아 있음");
  return result("M4", "아침 뒤 카드·층 사라짐", bad);
}

/** D7: 흐름의 모든 낮 장면 상태에서 테이블 면(.mf-dt__felt)이 같다. entries = [{ state, rect }]. */
export function feltStable(entries) {
  const bad = [];
  const base = entries[0];
  if (!base?.rect) bad.push(`${base?.state ?? "첫 상태"}: 측정값 없음(테이블 면)`);
  for (const e of entries.slice(1)) {
    const r = e.rect;
    if (!r || !base?.rect) {
      if (!r) bad.push(`${e.state}: 측정값 없음(테이블 면)`);
      continue;
    }
    const same = ["left", "top", "width", "height"].every((k) => Math.abs(r[k] - base.rect[k]) <= 0.5);
    if (!same) bad.push(`${e.state} 에서 테이블이 ${base.state} 와 다름 (${rd(r.left)},${rd(r.top)} ${rd(r.width)}x${rd(r.height)} ↔ ${rd(base.rect.left)},${rd(base.rect.top)} ${rd(base.rect.width)}x${rd(base.rect.height)})`);
  }
  return result("D7", "단계가 바뀌어도 테이블 그대로", bad);
}

/**
 * D9: 이름표끼리 겹치지 않는다(모든 인원). tags = [{ seat, rect, name }]. v1.0 고정 테이블 화면(.mf-dt__tag)의 이름표만 부른다.
 * 결정 0056 완화: 겹친 쌍 중 한쪽이라도 이름(name)이 6 그래핌 이상이면 그 쌍은 완화 범위(D9-8ch)라 통과로 두고 쌍을 표시한다.
 * 6 그래핌 미만끼리의 겹침, 이름을 모르는 이름표의 겹침은 그대로 실패한다. 겹침 기준(OVERLAP_EPS 0.5px)은 바뀌지 않는다.
 */
export function tagsOverlap(tags) {
  const bad = [];
  const relaxed = [];
  for (let i = 0; i < tags.length; i++)
    for (let j = i + 1; j < tags.length; j++) {
      if (!rectsOverlap(tags[i].rect, tags[j].rect)) continue;
      const pair = `${tags[i].seat}-${tags[j].seat}`;
      if (isWideTag(tags[i]) || isWideTag(tags[j])) relaxed.push(pair);
      else bad.push(pair);
    }
  const label = "이름표끼리 안 겹침";
  if (bad.length > 0) return result("D9", label, bad);
  return relaxed.length > 0 ? relaxedResult("D9", label, "D9-8ch", [`6자 이상 이름이 낀 겹침 ${relaxed.length}쌍 ${relaxed.join(",")}`]) : result("D9", label, []);
}

/**
 * T2 (결정 0028): 발 줄이 테이블 면의 세로 범위에 드는 캐릭터는 그 줄의 면(타원 현)과 가로로 SIDE_GAP_MIN 이상 떨어진다.
 * stage = browser.readStage 결과 { felt, seats: [{ seat, rect }] }. 측정값이 없으면 조용히 통과시키지 않고 실패한다.
 */
export function feltGapChecks(stage) {
  const label = "양옆 캐릭터가 테이블 면 바깥";
  const felt = stage?.felt;
  const seats = stage?.seats;
  if (!felt || !Array.isArray(seats) || seats.length === 0) return result("T2", label, ["측정값 없음(테이블 면 또는 캐릭터)"]);
  const a = felt.width / 2;
  const b = felt.height / 2;
  const cx = felt.left + a;
  const cy = felt.top + b;
  const bad = [];
  for (const s of seats) {
    const foot = bottom(s.rect);
    const t = (foot - cy) / b;
    if (Math.abs(t) > 1) continue;
    const half = a * Math.sqrt(1 - t * t);
    const mid = s.rect.left + s.rect.width / 2;
    const gap = mid < cx ? cx - half - right(s.rect) : s.rect.left - (cx + half);
    if (gap < SIDE_GAP_MIN - 1e-6) bad.push(`자리 ${s.seat} 테이블 면과 간격 ${rd(gap)}px < ${SIDE_GAP_MIN}px`);
  }
  return result("T2", label, bad);
}

/**
 * T1 (결정 0028): 단계가 바뀌어도(같은 인원) 장면 상자·테이블 면·내 캐릭터가 ±0.5 같고, 머리 119.2·하단 패널 157,
 * 패널 위 = 장면 아래. entries = [{ state, stage, mySeat }]. 내 자리가 spotlit(방금 탈락)이면 내 캐릭터 비교만 건너뛴다.
 */
export function stageStable(entries) {
  const label = "단계가 바뀌어도 장면 상자·테이블·내 캐릭터·패널이 그대로";
  if (!Array.isArray(entries) || entries.length === 0) return result("T1", label, ["측정값 없음(항목 없음)"]);
  const bad = [];
  const same = (r, base) => ["left", "top", "width", "height"].every((k) => Math.abs(r[k] - base[k]) <= OVERLAP_EPS);
  const fmt = (r) => `${rd(r.left)},${rd(r.top)} ${rd(r.width)}x${rd(r.height)}`;
  const mine = (e) => e.stage?.seats?.find((x) => x.seat === e.mySeat);
  for (const e of entries) {
    const st = e.stage;
    if (!st || !st.scene || !st.felt || !st.header || !st.panel) {
      bad.push(`${e.state}: 측정값 없음(장면·테이블·머리·패널 중 하나)`);
      continue;
    }
    if (Math.abs(st.header.height - HEADER_H) > OVERLAP_EPS) bad.push(`${e.state}: 머리 높이 ${rd(st.header.height)} ≠ ${HEADER_H}`);
    if (Math.abs(st.panel.height - PANEL_H) > OVERLAP_EPS) bad.push(`${e.state}: 패널 높이 ${rd(st.panel.height)} ≠ ${PANEL_H}`);
    if (Math.abs(st.panel.top - bottom(st.scene)) > OVERLAP_EPS) bad.push(`${e.state}: 패널 위 ${rd(st.panel.top)} ≠ 장면 아래 ${rd(bottom(st.scene))}`);
  }
  const base = entries[0];
  if (base.stage?.scene && base.stage.felt) {
    for (const e of entries.slice(1)) {
      const st = e.stage;
      if (!st?.scene || !st.felt) continue;
      if (!same(st.scene, base.stage.scene)) bad.push(`${e.state} 에서 장면 상자가 ${base.state} 와 다름 (${fmt(st.scene)} ↔ ${fmt(base.stage.scene)})`);
      if (!same(st.felt, base.stage.felt)) bad.push(`${e.state} 에서 테이블이 ${base.state} 와 다름 (${fmt(st.felt)} ↔ ${fmt(base.stage.felt)})`);
      const me = mine(e);
      const baseMe = mine(base);
      if (me && baseMe && !me.spotlit && !baseMe.spotlit && !same(me.rect, baseMe.rect))
        bad.push(`${e.state} 에서 내 캐릭터가 ${base.state} 와 다름 (${fmt(me.rect)} ↔ ${fmt(baseMe.rect)})`);
    }
  }
  return result("T1", label, bad);
}

// ---- 차례(K1·K2)·주장 채팅(K3)·기록 카드(X1) ----

/** 시작 문구 톤별 기대 글자: 밤 `N일차 / 밤이 되었습니다`(N6), 낮 시작 `N일차 / 낮이 되었습니다 / 토론 전에 먼저 직업을 공개해요`(N8). */
const INTRO_SPEC = {
  night: { id: "N6", label: "밤 시작 문구가 한 번 보임", lines: ["밤이 되었습니다"] },
  day: { id: "N8", label: "낮 시작 문구가 한 번 보임", lines: ["낮이 되었습니다", "토론 전에 먼저 직업을 공개해요"] },
};

/**
 * N6 밤·N8 낮 시작 문구(결정 0028 → 0030: 낮·밤 한 부품 SceneIntro). intro = browser.readSceneIntro 결과(또는 처음 본 값 readIntroWatch): 없으면 null,
 * 있으면 { texts, kind, pointerEvents, ariaHidden, rect }. kind 는 기대 톤(기본 night).
 */
export function sceneIntroChecks(intro, { kind = "night" } = {}) {
  const spec = INTRO_SPEC[kind];
  if (spec === undefined) return result("N6", "밤 시작 문구가 한 번 보임", [`지원하지 않는 톤 ${kind}`]);
  const bad = [];
  if (!intro) bad.push("시작 문구(.mf-sceneintro) 없음");
  else {
    const t = intro.texts ?? [];
    const want = ["N일차", ...spec.lines];
    const ok = t.length === want.length && /^\d+일차$/.test(t[0]) && spec.lines.every((line, i) => t[i + 1] === line);
    if (!ok) bad.push(`글자 [${t.join(" / ")}] ≠ [${want.join(" / ")}]`);
    if (intro.kind !== kind) bad.push(`톤 ${intro.kind} ≠ ${kind}`);
    if (intro.pointerEvents !== "none") bad.push(`pointer-events ${intro.pointerEvents} ≠ none`);
    if (intro.ariaHidden !== true) bad.push("aria-hidden 이 아님");
  }
  return result(spec.id, spec.label, bad);
}

// ---- H1 헤더 글씨 대비 · B1 배경 장면 (결정 0030, 사용자 지시 V-06) ----

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
  claim: "day",
  discussion: "day",
  night: "night",
  morning: "morning",
  execVote: "dusk",
  candidateVote: "dusk",
  candidateVoteReveal: "dusk",
  defense: "dusk",
  execution: "dusk",
  ended: "night",
};

/**
 * B1 배경 장면이 단계에 맞다. info = browser.readBackdropLayers 결과 { layers: [{ scene, state, image }] }.
 * 전환이 끝나 한 층만 남고 그 층이 current, data-scene 이 단계의 기대 장면, 계산된 background-image 가 bg_game_*.webp 여야 한다.
 */
export function backdropSceneChecks(info, { phase }) {
  const label = "배경 장면이 단계에 맞음";
  const layers = info?.layers;
  if (!Array.isArray(layers)) return result("B1", label, ["측정값 없음(배경 층)"]);
  const want = EXPECTED_SCENE[phase];
  if (want === undefined) return result("B1", label, [`알 수 없는 단계 ${phase}`]);
  if (layers.length !== 1) return result("B1", label, [`배경 층 ${layers.length}개 ≠ 1 (${layers.map((l) => `${l.scene}:${l.state}`).join(",") || "없음"})`]);
  const l = layers[0];
  const bad = [];
  if (l.state !== "current") bad.push(`층 상태 ${l.state} ≠ current`);
  if (l.scene !== want) bad.push(`장면 ${l.scene} ≠ 기대 ${want} (단계 ${phase})`);
  if (!/bg_game_[a-z_]+\.webp/.test(String(l.image ?? ""))) bad.push(`그림이 bg_game_*.webp 가 아님 (${String(l.image ?? "").slice(0, 80)})`);
  return result("B1", label, bad);
}

/**
 * K4 후광은 윤곽을 따르는 filter 이고 발밑 원이 없다 (결정 0030). halo = 스냅숏 halo { items: [{ seat, cls, filter, seatContext, onImg }], max },
 * circles = 발밑 원 요소 수(turn.legacyCircles). 후광 img 는 한 화면 3개 이하, 각각 계산된 filter 에 drop-shadow 두 겹과 9px 반지름이 있고
 * 후광 클래스는 img 에만 있으며 자리는 쌓임 맥락(z-index 있음)이다. expectNone 이 아니면(차례가 있는 claim) 흰 후광이 차례 말풍선과 같은 자리다.
 * 04-29: 후광 종류는 white|amber|crimson (앰버 = 낮의 공개 투표, D-33). crimsonAllowed(기본 true)가 false 이면 진홍 후광이 하나라도 있을 때 실패한다
 * (방장이 시민인 투표·처형 단계 — 진홍 후광은 동료인 마피아 viewer·관전자에게만 있다).
 */
export function haloChecks(halo, { circles, bubbleSeats, whiteSeats, expectNone, crimsonAllowed = true }) {
  const bad = [];
  if (!halo || !Array.isArray(halo.items)) bad.push("측정값 없음(후광 halo)");
  else {
    if (typeof halo.max !== "number" || halo.max > HALO_MAX) bad.push(`후광 img ${halo.max}개 > ${HALO_MAX}`);
    for (const h of halo.items) {
      if (!HALO_KINDS.includes(h.cls)) bad.push(`자리 ${h.seat} 후광 종류 "${h.cls}" 를 모름(white|amber|crimson)`);
      else if (h.cls === "crimson" && !crimsonAllowed) bad.push(`자리 ${h.seat} 진홍 후광이 있음 — 방장이 시민이면 투표·처형 단계에 진홍 후광 0 (D-33)`);
      const f = String(h.filter ?? "");
      const layers = f.split("drop-shadow(").length - 1;
      if (layers !== 2) bad.push(`자리 ${h.seat} 후광 filter 에 drop-shadow ${layers}겹 ≠ 2 ("${f.slice(0, 60)}")`);
      else if (!/\b9px\b/.test(f)) bad.push(`자리 ${h.seat} 후광 filter 에 9px 반지름 없음 ("${f.slice(0, 60)}")`);
      if (h.onImg !== true) bad.push(`자리 ${h.seat} 후광 클래스가 img 가 아닌 요소에 있음`);
      if (h.seatContext !== true) bad.push(`자리 ${h.seat} 가 쌓임 맥락이 아님(z-index 없음)`);
    }
  }
  if (typeof circles !== "number") bad.push("측정값 없음(발밑 원 요소 수)");
  else if (circles !== 0) bad.push(`발밑 원 요소 ${circles}개 ≠ 0`);
  if (!expectNone && Array.isArray(bubbleSeats) && Array.isArray(whiteSeats)) {
    const b = [...bubbleSeats].sort().join(",");
    const w = [...whiteSeats].sort().join(",");
    if (b !== w) bad.push(`흰 후광 자리 [${w}] 가 차례 말풍선 자리 [${b}] 와 다름`);
  }
  return result("K4", "후광은 윤곽을 따르는 filter, 발밑 원 없음", bad);
}

/**
 * W1 게임 중 방장 왕관 없음(결정 0030): 배정·낮·밤·아침에는 .mf-dt__crown 이 0개다. snap.crowns = .mf-dt__crown 수. 측정값이 없으면 실패.
 * 대기실의 방장 왕관 검사는 지웠다 — 맵 로비는 고정 테이블이 없고 방장 변경은 TopToast 로 알린다(06-15·06-21, 결정 0051).
 */
export function crownChecks(snap, { expect = 0 } = {}) {
  if (expect !== 0) throw new Error("crownChecks 는 게임 중(expect 0)만 판정한다 — 대기실 왕관 검사는 지웠다");
  const n = snap?.crowns;
  if (typeof n !== "number") return result("W1", "게임 중 방장 왕관 없음", ["측정값 없음(왕관 수 crowns)"]);
  return result("W1", "게임 중 방장 왕관 없음", n === 0 ? [] : [`방장 왕관 ${n}개 ≠ 0`]);
}

/**
 * K1·K4·K2. K1: 차례 말풍선(--turn)이 정확히 한 자리이고 흰 후광이 같은 자리 하나, 발밑 원·이름표 반전·아랫줄은 0 개.
 * expectNone: 차례 없는 단계(토론·밤·아침)라 차례 말풍선이 0 개(토론의 빠른 메시지 말풍선은 세지 않고, 밤 선택의 흰 후광은 허용). K4 는 항상 돌린다.
 * myTurn(true/false)이 있으면 K2 도 돌린다. jobs = 이번 판 직업 칩 글자(내 차례일 때 + 「말 안 함」과 순서까지 비교).
 */
export function turnChecks(snap, { expectNone = false, myTurn, jobs = [], crimsonAllowed = true } = {}) {
  const t = snap.turn ?? {};
  const bubbles = Array.isArray(t.bubbleTurnSeats) ? t.bubbleTurnSeats : null;
  const whites = Array.isArray(t.haloWhiteSeats) ? t.haloWhiteSeats : null;
  const k1 = [];
  if (!bubbles || !whites) k1.push("측정값 없음(차례 말풍선·흰 후광 자리)");
  else if (expectNone) {
    if (bubbles.length !== 0) k1.push(`차례 말풍선 ${bubbles.length}개 ≠ 0 (자리 ${bubbles.join(",")})`);
  } else {
    if (bubbles.length !== 1) k1.push(`차례 말풍선 ${bubbles.length}개 ≠ 1`);
    if (whites.length !== 1) k1.push(`차례 흰 후광 ${whites.length}개 ≠ 1`);
    else if (bubbles.length === 1 && whites[0] !== bubbles[0]) k1.push(`흰 후광 자리 ${whites[0]} 가 말풍선 자리 ${bubbles[0]} 와 다름`);
  }
  if (t.legacyCircles !== 0) k1.push(`발밑 원 요소 ${t.legacyCircles}개 ≠ 0`);
  if (t.tagInverted !== 0) k1.push(`이름표 반전 ${t.tagInverted}개 ≠ 0`);
  if (t.legacyRows !== 0) k1.push(`이름표 아랫줄 ${t.legacyRows}개 ≠ 0`);
  const out = [result("K1", expectNone ? "차례 표식 없음" : "차례 표식이 정확히 한 자리", k1)];
  out.push(haloChecks(snap.halo, { circles: t.legacyCircles, bubbleSeats: bubbles, whiteSeats: whites, expectNone, crimsonAllowed }));
  if (typeof myTurn !== "boolean") return out;

  const p = snap.panel;
  const k2 = [];
  if (!p) k2.push("하단 패널 없음");
  else {
    if (Math.abs(p.rect.height - PANEL_H) > 0.5) k2.push(`패널 높이 ${rd(p.rect.height)} ≠ ${PANEL_H}`);
    if (myTurn) {
      const expected = [...jobs, "말 안 함"];
      if (JSON.stringify(p.chips) !== JSON.stringify(expected)) k2.push(`칩 [${p.chips.join(",")}] ≠ [${expected.join(",")}]`);
      if (p.stRow) k2.push("내 차례인데 상태 줄(.st-row)이 있음");
      if (p.emojiBtn) k2.push("내 차례인데 이모티콘 버튼이 있음");
    } else {
      if (!p.stRow) k2.push("남의 차례인데 상태 줄(.st-row) 없음");
      if (!p.emojiBtn) k2.push("남의 차례인데 이모티콘 버튼 없음");
      if (p.quickBtn) k2.push("빠른 메시지 버튼이 있음");
      if (p.chips.length > 0) k2.push(`남의 차례인데 칩 [${p.chips.join(",")}]`);
    }
  }
  out.push(result("K2", myTurn ? "내 차례 하단 칩" : "남의 차례 하단 이모티콘", k2));
  return out;
}

const CLAIM_LINE_RE = /^(저는 (마피아예요|경찰이에요|의사예요|시민이에요)|말하지 않았어요)$/;

/** K3 주장 채팅 줄. lines = 화면에 보이는 줄 본문(이름 앞부분은 「이름: 」 꼴이면 떼고 본다). alive = 살아 있는 인원. */
export function claimChatIssues(lines, { alive }) {
  const bad = [];
  for (const raw of lines) {
    if (/[\[\]]/.test(raw)) bad.push(`대괄호 있음: "${raw}"`);
    const body = raw.replace(/^[^:：]*[:：]\s*/, "");
    if (!CLAIM_LINE_RE.test(body)) bad.push(`주장 문장이 아님: "${raw}"`);
  }
  if (lines.length !== alive) bad.push(`줄 수 ${lines.length} ≠ 살아 있는 인원 ${alive}`);
  return result("K3", "주장 채팅 줄 문장", bad);
}

/** X1 자리를 눌렀을 때: 낮에는 「{닉네임} 기록」 카드가 열리고 제목이 닉네임, 밤에는 아무 dialog 도 안 열린다. snap.dialogs = [{ label, title }]. */
export function inspectChecks(snap, { nick, night }) {
  const dialogs = snap.dialogs ?? [];
  const bad = [];
  if (night) {
    if (dialogs.length > 0) bad.push(`밤에 dialog 가 열림: ${dialogs.map((d) => d.label).join("/")}`);
  } else {
    const d = dialogs.find((x) => x.label === `${nick} 기록`);
    if (!d) bad.push(`"${nick} 기록" dialog 없음 (열린 것: ${dialogs.map((x) => x.label).join("/") || "없음"})`);
    else if (d.title !== nick) bad.push(`제목 "${d.title}" ≠ "${nick}"`);
  }
  return result("X1", night ? "밤에는 기록 카드가 안 열림" : "낮에 기록 카드가 열림", bad);
}

// ---- 역할 카드(R1~R6) ----

const JOURNAL = {
  police: { name: "수사일지", results: ["마피아", "마피아 아님"], empty: "아직 조사한 사람이 없어요" },
  mafia: { name: "암살일지", results: ["사망", "생존"], empty: "아직 지목한 사람이 없어요" },
  doctor: { name: "치료일지", results: ["보호"], empty: "아직 보호한 사람이 없어요" },
};
const rcOf = (snap) => snap.roleCard ?? null;

/** R1 헤더 [역할 카드] 버튼(시민도 있다)과 새 기록 점(지름 ≥ 12). 옛 [수사 기록] 버튼은 없어야 한다. */
export function roleCardButtonChecks(snap, { unread }) {
  const bad = [];
  const rc = rcOf(snap);
  const b = rc?.button;
  if (!b) bad.push("[역할 카드] 버튼 없음");
  else {
    const want = unread ? "역할 카드, 새 기록" : "역할 카드";
    if (b.label !== want) bad.push(`이름 "${b.label}" ≠ "${want}"`);
    if (unread) {
      if (!b.dotRect) bad.push("새 기록 점 없음");
      else if (Math.min(b.dotRect.width, b.dotRect.height) + 0.5 < 12) bad.push(`점 ${rd(b.dotRect.width)}x${rd(b.dotRect.height)} < 12`);
    } else if (b.dotRect) bad.push("읽을 새 기록이 없는데 점이 있음");
  }
  if (snap.legacyRecordsBtn) bad.push("옛 [수사 기록] 버튼이 남아 있음");
  return result("R1", "[역할 카드] 버튼과 점", bad);
}

/** R2(경찰·마피아·의사) 탭 둘과 활동 기록 탭 점(지름 ≥ 10) / R5(시민) 탭 줄·점 없음, 본문 존재. */
export function roleCardTabChecks(snap, { job, unread }) {
  const sheet = rcOf(snap)?.sheet;
  const bad = [];
  if (job === "citizen") {
    if (!sheet) bad.push("역할 카드 시트가 열려 있지 않음");
    else {
      if (sheet.tabs.length > 0) bad.push(`시민인데 탭 ${sheet.tabs.length}개`);
      if (sheet.tabs.some((t) => t.dotRect)) bad.push("시민인데 탭 점이 있음");
      if (!sheet.hasBody) bad.push("본문 없음");
    }
    return result("R5", "시민 역할 카드는 탭 없이 본문", bad);
  }
  if (!sheet) bad.push("역할 카드 시트가 열려 있지 않음");
  else {
    const names = sheet.tabs.map((t) => t.text);
    if (JSON.stringify(names) !== JSON.stringify(["내 역할", "활동 기록"])) bad.push(`탭 [${names.join(",")}] ≠ [내 역할,활동 기록]`);
    const act = sheet.tabs.find((t) => t.text === "활동 기록");
    if (act) {
      if (unread) {
        if (!act.dotRect) bad.push("활동 기록 탭 점 없음");
        else if (Math.min(act.dotRect.width, act.dotRect.height) + 0.5 < 10) bad.push(`탭 점 ${rd(act.dotRect.width)}x${rd(act.dotRect.height)} < 10`);
      } else if (act.dotRect) bad.push("읽을 새 기록이 없는데 탭 점이 있음");
    }
  }
  return result("R2", "역할 카드 탭 둘과 점", bad);
}

/**
 * R3(mode "viewing": 활동 기록을 보는 순간) / R4(mode "closed": 시트를 닫은 뒤).
 * viewing: 버튼 점·탭 점 소멸, 일지 이름·첫 줄 N일차 밤·결과 단어·NEW, 줄이 없으면 빈 상태 문구.
 * closed: 시트가 없거나 모든 줄의 NEW 가 사라짐.
 */
export function journalChecks(snap, { job, mode }) {
  const sheet = rcOf(snap)?.sheet ?? null;
  const bad = [];
  if (mode === "closed") {
    if (sheet && sheet.rows.some((r) => r.hasNew)) bad.push("시트를 닫은 뒤에도 NEW 가 남음");
    return result("R4", "시트를 닫으면 NEW 소멸", bad);
  }
  const spec = JOURNAL[job];
  if (!spec) return result("R3", "일지 내용과 점 소멸", [`일지가 없는 역할: ${job}`]);
  if (!sheet) return result("R3", "일지 내용과 점 소멸", ["역할 카드 시트가 열려 있지 않음"]);
  const btn = rcOf(snap)?.button;
  if (btn && (btn.dotRect || /새 기록/.test(btn.label))) bad.push("활동 기록을 보는 중인데 버튼 점이 남음");
  if (sheet.tabs.some((t) => t.dotRect)) bad.push("활동 기록을 보는 중인데 탭 점이 남음");
  const act = sheet.tabs.find((t) => t.text === "활동 기록");
  if (act && !act.selected) bad.push("활동 기록 탭이 선택되지 않음");
  if (sheet.journalName !== spec.name) bad.push(`일지 이름 "${sheet.journalName}" ≠ "${spec.name}"`);
  if (sheet.rows.length === 0) {
    if (sheet.emptyText !== spec.empty) bad.push(`빈 상태 문구 "${sheet.emptyText}" ≠ "${spec.empty}"`);
  } else {
    const first = sheet.rows[0];
    if (!/^\d+일차 밤$/.test(first.day)) bad.push(`첫 줄 날짜 "${first.day}" 가 N일차 밤이 아님`);
    if (!spec.results.includes(first.result)) bad.push(`첫 줄 결과 "${first.result}" ∉ [${spec.results.join(",")}]`);
    if (!first.hasNew) bad.push("첫 줄에 NEW 없음");
  }
  return result("R3", "일지 내용과 점 소멸", bad);
}

/** R6 밤 끝 알림이 화면에 없음(결정 0028). 측정값(roleCard.noticeTexts)이 없으면 조용히 통과시키지 않는다. */
export function noNightNoticeChecks(snap) {
  const texts = rcOf(snap)?.noticeTexts;
  if (!Array.isArray(texts)) return result("R6", "밤 끝 알림 없음", ["밤 끝 알림 측정값 없음(noticeTexts)"]);
  return result("R6", "밤 끝 알림 없음", texts.map((t) => `알림이 보임: "${t}"`));
}

// ---- 관전자(V1)·살아 있는 사람(V2) ----

/** V1 관전자 테이블. spectate = [{ seat, job, alive }](받은 spectate.seats 와 생존). */
export function spectatorChecks(snap, { spectate, mySeat }) {
  const bad = [];
  for (const s of snap.seats) {
    const info = spectate.find((x) => x.seat === s.seat);
    const src = s.imgSrc ?? "";
    if (s.seat === mySeat || (info && !info.alive)) {
      if (!src.startsWith("/characters/ghost/")) bad.push(`자리 ${s.seat} 은 유령이어야 함 (${src})`);
    } else if (info) {
      const want = `/characters/roles/${info.job}_default`;
      if (!src.startsWith(want)) bad.push(`자리 ${s.seat} 그림 ${src} ≠ ${want}…`);
    } else bad.push(`자리 ${s.seat} 의 spectate 정보 없음`);
  }
  for (const t of snap.tags) {
    if (t.lines !== 1) bad.push(`자리 ${t.seat} 이름표 ${t.lines}줄`);
    if (!t.hasDot) bad.push(`자리 ${t.seat} 이름표에 색깔점 없음`);
  }
  return result("V1", "관전자 테이블 직업 그림", bad);
}

/** V2 살아 있는 사람 화면: 테이블 안 역할 그림 0 개, 역할 그림은 내 역할 카드 시트·공개 화면의 내 직업 하나뿐. */
export function livingRoleArtChecks(snap, { myJob }) {
  const imgs = snap.roleImgs ?? [];
  const bad = [];
  const inTable = imgs.filter((i) => i.inTable);
  if (inTable.length > 0) bad.push(`테이블 안 역할 그림 ${inTable.length}개: ${list(inTable.map((i) => i.src))}`);
  const elsewhere = imgs.filter((i) => !i.inTable && !i.inDialog && !i.inReveal);
  if (elsewhere.length > 0) bad.push(`시트·공개 화면 밖 역할 그림: ${list(elsewhere.map((i) => i.src))}`);
  const jobs = new Set(imgs.map((i) => /\/characters\/roles\/([a-z]+)_/.exec(i.src)?.[1] ?? i.src));
  if (jobs.size > 1) bad.push(`역할 그림이 둘 이상: ${[...jobs].join("/")}`);
  if (jobs.size === 1 && myJob && !jobs.has(myJob)) bad.push(`역할 그림 ${[...jobs][0]} ≠ 내 역할 ${myJob}`);
  return result("V2", "남의 역할 그림이 테이블에 없음", bad);
}

/** G7 본문 글자 ≥ 14px. 항목 { desc, size, allowed? } — allowed(TEXT_SIZE_ALLOW 에 걸림)는 뺀다. 필드가 없으면 실패한다. */
export function smallTextIssues(smallText) {
  if (!Array.isArray(smallText)) return { id: "G7", label: "본문 글자 14px 이상", ok: false, detail: "글자 크기 측정값(smallText) 없음" };
  const bad = smallText.filter((e) => !e.allowed && e.size < 14).map((e) => `${e.desc} ${fmt(e.size)}px`);
  return { id: "G7", label: "본문 글자 14px 이상", ok: bad.length === 0, detail: bad.length === 0 ? "" : `14px 미만: ${list(bad)}` };
}

// ---- 처형 구간 순수 검사 P1·P9·P2·P3 (04-29, UI-SPEC 15.3). 입력 모양은 머리의 `처형 구간 스냅숏 계약` ----

const EXEC_TITLE = "오늘 처형을 할까요?";
const TALLY_RE = /^찬성 \d+ · 반대 \d+/;
/**
 * 인트로 카드가 DOM 에서 사라져야 하는 시각(ms, D-30). 낮추지 않는다.
 * EXEC_INTRO_MS 3000 + 측정 여유 200 — 여유는 예전(1600 + 200)과 같다(결정 0039). test/unit/e2eContract.test.ts 가 앱 상수와 대조한다.
 */
export const INTRO_GONE_MS = 3200;

/**
 * 후보 선택 공개 단계 시간표 사본(결정 0039). TS(shared/game/phases.ts)를 import 하지 않는 스크립트용이다 —
 * test/unit/e2eContract.test.ts 가 같은 값인지 대조한다.
 */
export const CANDIDATE_REVEAL_TIMING = Object.freeze({ leadMs: 400, slotMs: 2000, tailMs: 600, emptyMs: 2000 });

/** 공개 단계 길이(ms): n ≥ 1 이면 앞 + n × 한 표 + 뒤, n = 0 이면 emptyMs. shared/game/phases.ts 의 candidateRevealMs 와 같은 식. */
export function candidateRevealMs(n) {
  const count = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
  const { leadMs, slotMs, tailMs, emptyMs } = CANDIDATE_REVEAL_TIMING;
  return count === 0 ? emptyMs : leadMs + count * slotMs + tailMs;
}

/**
 * P1(살아 있는 viewer)·P9(탈락 viewer, spectator: true) 처형 여부 투표 하단과 익명.
 * 제목 `오늘 처형을 할까요?`, 집계 줄 `찬성 N · 반대 M…`, 이름표·캐릭터 안 `찬성`·`반대`·`투표` 글자 0, 후광 0(내 선택도 후광이 아님, D-02; 관전자의 마피아 동료 진홍 후광은 D-33 으로 남으므로 제외).
 * 살아 있는 viewer: 버튼이 정확히 `찬성`·`반대` 둘, 각 w·h ≥ TAP_MIN, aria-pressed 불리언, `기권` 없음. 탈락 viewer: 버튼 0, 알약에 `관전 중`, 집계 줄은 그대로.
 */
export function voteChecks(v, { spectator = false } = {}) {
  const id = spectator ? "P9" : "P1";
  const label = spectator ? "탈락 방장의 투표 화면: 버튼 없음·관전 알약·집계 보임" : "처형 여부 투표 하단·익명";
  const b = v?.bottom;
  const dt = v?.dt;
  const miss = [];
  if (!b || typeof b !== "object") miss.push("측정값 없음(bottom)");
  else {
    if (typeof b.title !== "string") miss.push("측정값 없음(bottom.title)");
    if (typeof b.tally !== "string") miss.push("측정값 없음(bottom.tally)");
    if (!Array.isArray(b.buttons)) miss.push("측정값 없음(bottom.buttons)");
  }
  if (!dt || typeof dt !== "object") miss.push("측정값 없음(dt)");
  else {
    if (typeof dt.textHits !== "number") miss.push("측정값 없음(dt.textHits)");
    if (!Array.isArray(dt.haloImgs)) miss.push("측정값 없음(dt.haloImgs)");
  }
  if (miss.length > 0) return result(id, label, miss);

  const bad = [];
  if (b.title !== EXEC_TITLE) bad.push(`제목 "${b.title}" ≠ "${EXEC_TITLE}"`);
  if (!TALLY_RE.test(b.tally)) bad.push(`집계 줄 "${b.tally}" 이 "찬성 N · 반대 M" 모양이 아님`);
  if (dt.textHits !== 0) bad.push(`이름표·캐릭터 안 찬성/반대/투표 글자 요소 ${dt.textHits}개 ≠ 0 (익명)`);
  // 관전자는 모든 직업을 보므로 마피아 자리의 진홍 후광(동료 표시, D-33·UI-SPEC 12.4)은 투표 장면에서도 남는다. 흰·앰버(내 선택·공개)는 어떤 viewer 에게도 0.
  const halos = spectator ? dt.haloImgs.filter((h) => h.kind !== "crimson") : dt.haloImgs;
  if (halos.length !== 0) bad.push(`후광 ${halos.length}개 ≠ 0 (자리 ${halos.map((h) => h.seat).join(",")}) — 내 선택도 후광이 아님${spectator ? "(관전자의 마피아 동료 진홍 후광은 제외)" : ""}`);
  const texts = b.buttons.map((x) => String(x.text ?? "").trim());
  if (texts.some((t) => t.includes("기권"))) bad.push("기권 버튼이 있음");
  if (spectator) {
    if (b.buttons.length !== 0) bad.push(`버튼 ${b.buttons.length}개 ≠ 0 (관전 중 [${texts.join(",")}])`);
    if (typeof b.pill !== "string" || !b.pill.includes("관전 중")) bad.push(`알약 "${b.pill ?? ""}" 에 "관전 중" 없음`);
  } else {
    if (texts.join(",") !== "찬성,반대") bad.push(`버튼 [${texts.join(",")}] ≠ [찬성,반대]`);
    for (const x of b.buttons) {
      if (!(x.w >= TAP_MIN && x.h >= TAP_MIN)) bad.push(`버튼 "${x.text}" ${fmt(x.w)}×${fmt(x.h)} 가 ${TAP_MIN}px 미만`);
      if (typeof x.pressed !== "boolean") bad.push(`버튼 "${x.text}" aria-pressed 가 불리언이 아님`);
    }
  }
  return result(id, label, bad);
}

/**
 * P2 처형 투표 인트로 카드(D-30). samples = [{ t(ms), intro:{ count, pointerEvents, cardOpacity, residueCount } }],
 * clickedThrough = 그 동안 버튼 클릭이 me.voteAgree 를 바꿈. 도착 직후 표본: 카드 정확히 1장, 카드가 보이는 모든 표본: pointer-events none,
 * INTRO_GONE_MS(3200ms) 이후 표본: 카드 0장·남은 불투명 잔상 0.
 */
export function introChecks(samples, { clickedThrough } = {}) {
  const label = "인트로 카드: 도착·터치 통과·3.2초 뒤 흔적 없음";
  if (!Array.isArray(samples) || samples.length === 0) return result("P2", label, ["측정값 없음(인트로 시간표본)"]);
  if (samples.some((x) => !Number.isFinite(x?.t) || !x.intro || typeof x.intro.count !== "number")) {
    return result("P2", label, ["측정값 없음(표본 t·intro.count)"]);
  }
  const sorted = [...samples].sort((a, b) => a.t - b.t);
  const bad = [];
  const first = sorted[0];
  if (first.intro.count !== 1) bad.push(`도착 직후(t=${fmt(first.t)}ms) 인트로 카드 ${first.intro.count}개 ≠ 1`);
  for (const x of sorted) {
    if (x.intro.count > 0 && x.intro.pointerEvents !== "none") bad.push(`t=${fmt(x.t)}ms 카드 pointer-events "${x.intro.pointerEvents}" ≠ none`);
  }
  const late = sorted.filter((x) => x.t >= INTRO_GONE_MS);
  if (late.length === 0) bad.push(`측정값 없음(${INTRO_GONE_MS}ms 이후 표본)`);
  for (const x of late) {
    if (x.intro.count !== 0) bad.push(`${INTRO_GONE_MS}ms 뒤(t=${fmt(x.t)}ms)에도 인트로 카드 ${x.intro.count}개가 사라지지 않음`);
    if (typeof x.intro.residueCount !== "number") bad.push("측정값 없음(intro.residueCount)");
    else if (x.intro.residueCount !== 0) bad.push(`t=${fmt(x.t)}ms 불투명 잔상 ${x.intro.residueCount}개 ≠ 0`);
  }
  if (typeof clickedThrough !== "boolean") bad.push("측정값 없음(clickedThrough)");
  else if (!clickedThrough) bad.push("버튼 클릭이 카드를 통과하지 못함(me.voteAgree 가 안 바뀜)");
  return result("P2", label, bad);
}

/**
 * P3 후보 선택(candidateVote). opts = { mySeat, deadSeats, chosenSeat(number|null), crimsonSeats = [], name? }.
 * 내 자리·탈락 자리는 pickable false, 나머지는 true. 고른 자리만 aria-pressed true 이고 흰 후광이 정확히 한 개로 그 자리.
 * 그 밖 후광은 동료 진홍 마름모 자리(crimsonSeats)의 진홍뿐. 알약은 고른 뒤 `…님에게 투표했어요`(name 이 있으면 그 이름 포함), 고르기 전 `선택 안 함`.
 */
export function candidateChecks(v, { mySeat, deadSeats, chosenSeat, crimsonSeats = [], name } = {}) {
  const label = "후보 선택: 자리 규칙·흰 후광 하나·알약";
  const miss = [];
  if (typeof mySeat !== "number") miss.push("측정값 없음(mySeat 인자)");
  if (!Array.isArray(deadSeats)) miss.push("측정값 없음(deadSeats 인자)");
  if (chosenSeat !== null && typeof chosenSeat !== "number") miss.push("측정값 없음(chosenSeat 인자)");
  if (typeof v?.bottom?.pill !== "string") miss.push("측정값 없음(bottom.pill)");
  if (!Array.isArray(v?.dt?.seatButtons) || v.dt.seatButtons.length === 0) miss.push("측정값 없음(dt.seatButtons)");
  if (!Array.isArray(v?.dt?.haloImgs)) miss.push("측정값 없음(dt.haloImgs)");
  if (miss.length > 0) return result("P3", label, miss);

  const bad = [];
  for (const s of v.dt.seatButtons) {
    const mine = s.seat === mySeat;
    const dead = deadSeats.includes(s.seat);
    const blocked = mine || dead;
    if (blocked) {
      if (s.pickable !== false) bad.push(`${mine ? "내 자리" : "탈락 자리"} ${s.seat} 가 누를 수 있는 버튼임`);
    } else if (s.pickable !== true) bad.push(`살아 있는 남의 자리 ${s.seat} 가 누를 수 있는 버튼이 아님`);
    const want = !blocked && chosenSeat !== null && s.seat === chosenSeat;
    if (blocked ? s.pressed === true : s.pressed !== want) bad.push(`자리 ${s.seat} aria-pressed ${String(s.pressed)} ≠ ${want}`);
  }
  const whites = v.dt.haloImgs.filter((h) => h.kind === "white");
  if (chosenSeat === null) {
    if (v.dt.haloImgs.length !== 0) bad.push(`고르기 전인데 후광 ${v.dt.haloImgs.length}개 (자리 ${v.dt.haloImgs.map((h) => h.seat).join(",")})`);
    if (!v.bottom.pill.includes("선택 안 함")) bad.push(`고르기 전 알약 "${v.bottom.pill}" 에 "선택 안 함" 없음`);
  } else {
    if (whites.length !== 1) bad.push(`흰 후광 ${whites.length}개 ≠ 1`);
    else if (whites[0].seat !== chosenSeat) bad.push(`흰 후광 자리 ${whites[0].seat} ≠ 고른 자리 ${chosenSeat}`);
    for (const h of v.dt.haloImgs) {
      if (h.kind === "white") continue;
      if (h.kind === "crimson" && crimsonSeats.includes(h.seat)) continue;
      bad.push(`자리 ${h.seat} 후광 종류 ${h.kind} 는 남의 자리에 허용되지 않음(동료 진홍 마름모 자리만)`);
    }
    const phrase = name ? `${name}님에게 투표했어요` : "님에게 투표했어요";
    if (!v.bottom.pill.includes(phrase)) bad.push(`알약 "${v.bottom.pill}" 에 "${phrase}" 없음`);
  }
  return result("P3", label, bad);
}

// ---- P4 공개 연출·P-COLOR 색 규칙 (04-29, UI-SPEC 15.1·15.3, D-31·D-33) ----

/**
 * P4 후보 선택 공개(candidateVoteReveal). samples = [{ t(ms), reveal:{ arrows, chips[], tags[] }, dt:{ haloImgs, scene }, crimsonNew }] 시각 오름차순,
 * opts = { n(= 최종 후보 선택 표 수 cand.votes.length), size?:{ w, h }(화면 크기) }.
 * 모든 표본: 화살표 ≤ 1, 후광 img 합(white+amber+crimson) ≤ HALO_MAX, 새 요소 진홍 0, 칩이 장면 폭 안이고 위가 헤더 아래(scene.top 이상),
 * size 가 있으면 화면 폭 안. 시간에 따라 칩 숫자 합이 줄지 않고 마지막 표본의 합이 n (n=0 이면 칩 없음).
 */
export function revealChecks(samples, { n, size } = {}) {
  const label = "공개 연출: 화살표 ≤ 1·칩 합 단조 증가·후광 ≤ 3·진홍 0·칩 위치";
  if (!Array.isArray(samples) || samples.length === 0) return result("P4", label, ["측정값 없음(공개 시간표본)"]);
  if (typeof n !== "number") return result("P4", label, ["측정값 없음(n 인자)"]);
  const miss = [];
  samples.forEach((x, i) => {
    if (!Number.isFinite(x?.t)) miss.push(`측정값 없음(표본 ${i} t)`);
    else if (typeof x.reveal?.arrows !== "number" || !Array.isArray(x.reveal?.chips)) miss.push(`측정값 없음(표본 ${i} reveal.arrows·chips)`);
    else if (!Array.isArray(x.dt?.haloImgs)) miss.push(`측정값 없음(표본 ${i} dt.haloImgs)`);
    else if (typeof x.crimsonNew !== "number") miss.push(`측정값 없음(표본 ${i} crimsonNew)`);
    else if (x.reveal.chips.length > 0 && !(Number.isFinite(x.dt.scene?.left) && Number.isFinite(x.dt.scene?.right) && Number.isFinite(x.dt.scene?.top))) {
      miss.push(`측정값 없음(표본 ${i} dt.scene)`);
    }
  });
  if (miss.length > 0) return result("P4", label, miss);

  const bad = [];
  let prevSum = 0;
  let lastSum = 0;
  samples.forEach((x, i) => {
    const at = `t=${fmt(x.t)}ms`;
    if (i > 0 && x.t < samples[i - 1].t) bad.push(`표본 시각이 오름차순이 아님 (${fmt(samples[i - 1].t)} → ${fmt(x.t)})`);
    if (x.reveal.arrows > 1) bad.push(`${at} 화살표 ${x.reveal.arrows}개 > 1`);
    if (x.dt.haloImgs.length > HALO_MAX) bad.push(`${at} 후광 img ${x.dt.haloImgs.length}개 > ${HALO_MAX}`);
    if (x.crimsonNew !== 0) bad.push(`${at} 새 요소 진홍 ${x.crimsonNew}개 ≠ 0`);
    const sum = x.reveal.chips.reduce((a, c) => a + (c.n || 0), 0);
    if (sum < prevSum) bad.push(`${at} 칩 숫자 합이 줄어듦 ${prevSum} → ${sum}`);
    prevSum = Math.max(prevSum, sum);
    lastSum = sum;
    for (const c of x.reveal.chips) {
      const sc = x.dt.scene;
      const who = `${at} 칩(자리 ${c.seat})`;
      if (c.left < sc.left - OVERLAP_EPS || right(c) > sc.right + OVERLAP_EPS) bad.push(`${who} 가 장면 폭 [${fmt(sc.left)}, ${fmt(sc.right)}] 밖 (${fmt(c.left)}~${fmt(right(c))})`);
      if (c.top < sc.top - OVERLAP_EPS) bad.push(`${who} 가 헤더를 침범 (위 ${fmt(c.top)} < 장면 위 ${fmt(sc.top)})`);
      if (Number.isFinite(size?.w) && (c.left < -OVERLAP_EPS || right(c) > size.w + OVERLAP_EPS)) bad.push(`${who} 가 화면 폭 ${size.w} 밖`);
    }
  });
  if (n === 0 && samples.some((x) => x.reveal.chips.length > 0)) bad.push("표가 0 인데 칩이 나옴");
  if (lastSum !== n) bad.push(`최종 칩 숫자 합 ${lastSum} ≠ 투표 수 ${n}`);
  return result("P4", label, bad);
}

/** rgb()/rgba() 색 문자열을 알파·공백을 뺀 `r,g,b` 로 줄인다(진홍 토큰 값과 비교용). 못 읽으면 소문자·공백 제거한 문자열. */
const colorKey = (c) => {
  const m = /rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(String(c));
  return m ? `${Number(m[1])},${Number(m[2])},${Number(m[3])}` : String(c).replace(/\s+/g, "").toLowerCase();
};

/**
 * P-COLOR 진홍 사용 규칙(D-33). v = { crimsonNew, crimsonScreen, newColors?, screenColors? }(스냅숏 계약), opts = { crimsonColors, wholeScreenCrimson }.
 * 새 요소의 진홍 사용 crimsonNew 는 0. wholeScreenCrimson(방장이 시민인 투표·처형 단계)이면 화면 전체 진홍 crimsonScreen 도 0(동료 마름모·후광 제외 없음).
 * 색 목록(newColors·screenColors)이 있으면 crimsonColors(토큰을 읽어 rgb 로 정규화한 문자열 배열)와 비교해 같은 색을 진홍으로 센다 — lib 에 색 값을 박지 않는다.
 */
export function colorRuleChecks(v, { crimsonColors, wholeScreenCrimson = false } = {}) {
  const label = wholeScreenCrimson ? "진홍 규칙: 새 요소·화면 전체 진홍 0 (방장이 시민)" : "진홍 규칙: 새 요소 진홍 0";
  const miss = [];
  if (typeof v?.crimsonNew !== "number") miss.push("측정값 없음(crimsonNew)");
  if (wholeScreenCrimson && typeof v?.crimsonScreen !== "number") miss.push("측정값 없음(crimsonScreen)");
  const newColors = v?.newColors;
  const screenColors = wholeScreenCrimson ? v?.screenColors : undefined;
  if ((newColors !== undefined || screenColors !== undefined) && (!Array.isArray(crimsonColors) || crimsonColors.length === 0)) {
    miss.push("측정값 없음(crimsonColors 토큰 색 목록)");
  }
  if (newColors !== undefined && !Array.isArray(newColors)) miss.push("측정값 없음(newColors 배열)");
  if (screenColors !== undefined && !Array.isArray(screenColors)) miss.push("측정값 없음(screenColors 배열)");
  if (miss.length > 0) return result("P-COLOR", label, miss);

  const bad = [];
  const crimson = new Set((crimsonColors ?? []).map(colorKey));
  if (v.crimsonNew !== 0) bad.push(`새 요소 진홍 사용 ${v.crimsonNew}개 ≠ 0`);
  for (const c of newColors ?? []) if (crimson.has(colorKey(c.color))) bad.push(`새 요소 ${c.desc} 가 진홍 ${c.color} 를 씀`);
  if (wholeScreenCrimson) {
    if (v.crimsonScreen !== 0) bad.push(`화면 전체 진홍 요소 ${v.crimsonScreen}개 ≠ 0 (방장이 시민)`);
    for (const c of screenColors ?? []) if (crimson.has(colorKey(c.color))) bad.push(`화면 전체: ${c.desc} 가 진홍 ${c.color} 를 씀 (방장이 시민)`);
  }
  return result("P-COLOR", label, bad);
}

// ---- 04-30 P5 변론 스포트라이트·P6 처형 카드 (UI-SPEC 8.4·8.5·15.3) ----

// 아래 수치는 src/game/verdict.ts 의 상수와 같은 값이다(단위 시험이 파일을 읽어 동일성 단언 — D-38 이 바뀌면 E2E 가 알려 준다).
const DEFENSE_DIM_ALPHA = 0.45; // VERDICT_DIM_PERCENT 45 %
const DEFENSE_BLUR = "blur(3px)"; // VERDICT_BLUR_PX 3
const DEFENSE_SCALE = 1.7; // VERDICT_CANDIDATE_SCALE
const DEFENSE_DIM_Z = 30; // UI-SPEC 12 층: 어둡게+흐림 z 30
const DEFENSE_CHIPS = 6; // 후보 본인 칩 3줄×2칸
const TAG_BOTTOM_MARGIN = 4; // 후보 이름표 아래끝 ≤ 장면 아래 − 4
const EXEC_TAIL_RE = /^.+님이 (더는 함께할 수 없게 되었습니다|형장의 이슬이 되었습니다|잔혹하게 처형되었습니다|처형대에 올랐습니다)$/;

/** rgba(…, a) 또는 color(… / a) 문자열의 알파. 못 읽으면 NaN. 알파 없는 rgb() 는 1. */
const alphaOf = (c) => {
  const t = String(c);
  const slash = /\/\s*([\d.]+)(%?)\s*\)/.exec(t);
  if (slash) return Number(slash[1]) / (slash[2] ? 100 : 1);
  const m = /rgba\(\s*[\d.]+[\s,]+[\d.]+[\s,]+[\d.]+[\s,]+([\d.]+)\s*\)/i.exec(t);
  if (m) return Number(m[1]);
  return /^rgb\(/i.test(t.trim()) ? 1 : NaN;
};
const isNum = (x) => typeof x === "number" && Number.isFinite(x);

/**
 * P5 변론 스포트라이트(defense). opts = { isCandidate(viewer 가 후보 본인인가) }.
 * 후보 가운데 |cx − 장면 가운데| ≤ 2·배율 1.7 ± .02, 어둡게 층 정확히 하나(계산된 backdrop-filter 에 blur(3px), 배경 알파 .45 ± .02, z 30),
 * 원뿔 정확히 하나, 층 순서(후보 좌석·이름표 z > 어둡게 z > 다른 자리·이름표 z), 후보 이름표 아래끝 ≤ 장면 아래 − 4.
 * 패널: 후보 본인은 높이 236(승인 완화 P-PANEL-236) + 칩 정확히 6개(각 ≥ TAP_MIN), 그 밖은 PANEL_H.
 */
export function defenseChecks(v, { isCandidate } = {}) {
  const label = "변론 스포트라이트: 가운데·1.7배·어둡게 45%·흐림 3px·원뿔 하나·층 순서·패널";
  const miss = [];
  if (typeof isCandidate !== "boolean") miss.push("측정값 없음(isCandidate 인자)");
  const dt = v?.dt;
  const c = dt?.center;
  if (!dt || typeof dt !== "object") miss.push("측정값 없음(dt)");
  else {
    const sc = dt.scene;
    if (!(isNum(sc?.left) && isNum(sc?.width) && isNum(sc?.bottom))) miss.push("측정값 없음(dt.scene)");
    if (!c || !["cx", "scale", "z", "tagZ", "tagBottom"].every((k) => isNum(c[k]))) miss.push("측정값 없음(dt.center)");
    if (!(isNum(dt.others?.maxSeatZ) && isNum(dt.others?.maxTagZ))) miss.push("측정값 없음(dt.others)");
    const d = dt.dim;
    if (!d || !isNum(d.count) || typeof d.backdropFilter !== "string" || typeof d.background !== "string" || !isNum(d.z)) miss.push("측정값 없음(dt.dim)");
    if (!isNum(dt.cones)) miss.push("측정값 없음(dt.cones)");
  }
  if (!isNum(v?.bottom?.height)) miss.push("측정값 없음(bottom.height)");
  if (isCandidate === true && !Array.isArray(v?.bottom?.buttons)) miss.push("측정값 없음(bottom.buttons)");
  if (miss.length > 0) return result("P5", label, miss);

  const bad = [];
  const sc = dt.scene;
  const mid = sc.left + sc.width / 2;
  if (Math.abs(c.cx - mid) > 2) bad.push(`후보 가운데 x ${fmt(c.cx)} 가 장면 가운데 ${fmt(mid)} 에서 ${fmt(Math.abs(c.cx - mid))}px 어긋남(허용 2)`);
  if (Math.abs(c.scale - DEFENSE_SCALE) > 0.02) bad.push(`후보 배율 ${fmt(c.scale * 100) / 100} ≠ ${DEFENSE_SCALE}`);
  const d = dt.dim;
  if (d.count !== 1) bad.push(`어둡게 층 ${d.count}개 ≠ 1`);
  else {
    if (!d.backdropFilter.includes(DEFENSE_BLUR)) bad.push(`어둡게 층 backdrop-filter "${d.backdropFilter}" 에 ${DEFENSE_BLUR} 없음(흐림 3px)`);
    const a = alphaOf(d.background);
    if (!Number.isFinite(a)) bad.push(`어둡게 층 배경 "${d.background}" 에서 알파를 읽을 수 없음`);
    else if (Math.abs(a - DEFENSE_DIM_ALPHA) > 0.02) bad.push(`어둡게 층 배경 알파 ${fmt(a * 100) / 100} ≠ ${DEFENSE_DIM_ALPHA}`);
    if (d.z !== DEFENSE_DIM_Z) bad.push(`어둡게 층 z ${d.z} ≠ ${DEFENSE_DIM_Z}`);
  }
  if (dt.cones !== 1) bad.push(`원뿔 ${dt.cones}개 ≠ 1`);
  if (!(c.z > d.z)) bad.push(`후보 좌석 z ${c.z} 가 어둡게 층 z ${d.z} 보다 위가 아님`);
  if (!(c.tagZ > d.z)) bad.push(`후보 이름표 z ${c.tagZ} 가 어둡게 층 z ${d.z} 보다 위가 아님`);
  if (!(dt.others.maxSeatZ < d.z)) bad.push(`다른 자리 z ${dt.others.maxSeatZ} 가 어둡게 층 z ${d.z} 이상(어두워지지 않음)`);
  if (!(dt.others.maxTagZ < d.z)) bad.push(`다른 이름표 z ${dt.others.maxTagZ} 가 어둡게 층 z ${d.z} 이상(어두워지지 않음)`);
  if (c.tagBottom > sc.bottom - TAG_BOTTOM_MARGIN) bad.push(`후보 이름표 아래끝 ${fmt(c.tagBottom)} 가 장면 아래 ${fmt(sc.bottom)} − ${TAG_BOTTOM_MARGIN} 을 침범`);

  const h = v.bottom.height;
  if (isCandidate) {
    if (Math.abs(h - PANEL_H_DEFENSE_ME) > OVERLAP_EPS) bad.push(`후보 본인 패널 높이 ${fmt(h)} ≠ ${PANEL_H_DEFENSE_ME}(승인 완화 P-PANEL-236)`);
    const chips = v.bottom.buttons;
    if (chips.length !== DEFENSE_CHIPS) bad.push(`변론 칩 ${chips.length}개 ≠ ${DEFENSE_CHIPS}`);
    for (const x of chips) {
      if (!(x.w >= TAP_MIN && x.h >= TAP_MIN)) bad.push(`칩 "${x.text}" ${fmt(x.w)}×${fmt(x.h)} 가 ${TAP_MIN}px 미만`);
    }
  } else if (Math.abs(h - PANEL_H) > OVERLAP_EPS) {
    bad.push(`패널 높이 ${fmt(h)} ≠ ${PANEL_H}(236 은 후보 본인만)`);
  }
  return result("P5", label, bad);
}

/**
 * P6 처형(execution). opts = { viewerAlive, candidateSeat }.
 * 처형 카드 정확히 1장·테두리 앰버(AMBER_RGB, 진홍·회색 아님)·제목 `…님이 {꼬리 4개 중 하나}`·부제 `처형이 집행됐어요`,
 * 후보 그림이 유령(dt.ghosts 에 candidateSeat), 하단 `처형이 끝났어요` + `곧 다음으로 넘어가요`, 새 요소 진홍 0.
 * 살아 있는 viewer 의 화면에는 역할 그림·역할 이름이 0(D-09; 처형된 viewer 는 관전 규칙으로 허용되어 검사하지 않는다).
 */
export function executionChecks(v, { viewerAlive, candidateSeat } = {}) {
  const label = "처형: 앰버 카드·꼬리 문구·유령·직업 비노출";
  const miss = [];
  if (typeof viewerAlive !== "boolean") miss.push("측정값 없음(viewerAlive 인자)");
  if (!isNum(candidateSeat)) miss.push("측정값 없음(candidateSeat 인자)");
  const ec = v?.execCard;
  if (!ec || !isNum(ec.count) || typeof ec.title !== "string" || typeof ec.sub !== "string" || typeof ec.borderColor !== "string") miss.push("측정값 없음(execCard)");
  if (!Array.isArray(v?.dt?.ghosts)) miss.push("측정값 없음(dt.ghosts)");
  if (typeof v?.bottom?.title !== "string" || typeof v?.bottom?.guide !== "string") miss.push("측정값 없음(bottom.title·guide)");
  if (!isNum(v?.crimsonNew)) miss.push("측정값 없음(crimsonNew)");
  if (viewerAlive === true && !(isNum(v?.dt?.roleImgs) && isNum(v?.dt?.roleWords))) miss.push("측정값 없음(dt.roleImgs·roleWords)");
  if (miss.length > 0) return result("P6", label, miss);

  const bad = [];
  if (ec.count !== 1) bad.push(`처형 카드 ${ec.count}장 ≠ 1`);
  if (colorKey(ec.borderColor) !== colorKey(AMBER_RGB)) bad.push(`처형 카드 테두리 ${ec.borderColor} 가 앰버 ${AMBER_RGB} 가 아님(진홍·회색 아님)`);
  if (!EXEC_TAIL_RE.test(ec.title)) bad.push(`처형 카드 문구 "${ec.title}" 가 "…님이 (네 꼬리 중 하나)" 모양이 아님`);
  if (ec.sub !== "처형이 집행됐어요") bad.push(`처형 카드 부제 "${ec.sub}" ≠ "처형이 집행됐어요"`);
  if (!v.dt.ghosts.includes(candidateSeat)) bad.push(`후보 자리 ${candidateSeat} 가 유령 그림이 아님(유령 자리 [${v.dt.ghosts.join(",")}])`);
  if (v.bottom.title !== "처형이 끝났어요") bad.push(`하단 제목 "${v.bottom.title}" ≠ "처형이 끝났어요"`);
  if (v.bottom.guide !== "곧 다음으로 넘어가요") bad.push(`하단 안내 "${v.bottom.guide}" ≠ "곧 다음으로 넘어가요"`);
  if (v.crimsonNew !== 0) bad.push(`새 요소 진홍 ${v.crimsonNew}개 ≠ 0`);
  if (viewerAlive) {
    if (v.dt.roleImgs !== 0) bad.push(`역할 그림 ${v.dt.roleImgs}개 ≠ 0 (D-09)`);
    if (v.dt.roleWords !== 0) bad.push(`역할 이름 ${v.dt.roleWords}개 ≠ 0 (D-09)`);
  }
  return result("P6", label, bad);
}

// ---- 04-30 P7 처형 무효 카드·P8 결과 화면·P10 배치 겹침 (UI-SPEC 9.2·11·15.3) ----

const VOID_SUBS = ["찬성이 과반이 아니에요", "동률이라 처형하지 않아요", "던진 표가 없어요"];
/** P-3: 밤 시작 문구는 처형 무효 카드가 뜬 지 최소 이만큼(ms) 뒤에 보인다(카드 0–1.6초, 문구 1.6초 뒤부터. 측정 오차로 100ms 여유). */
const VOID_INTRO_AFTER_MS = 1500;
/** 처형 무효 카드가 DOM 에서 사라져야 하는 시각(ms, UI-SPEC 9.2 마감 1.6초 + 여유). */
const VOID_GONE_MS = 1800;
const WINNER_BANNER = { citizenWin: "시민 팀 승리", mafiaWin: "마피아 팀 승리" };
const ROLE_WORDS = Object.values(ROLE_NAME);
const RESULT_OPACITY_TOL = 0.05; // 탈락 카드 그림 opacity .5 ± .05
const isRect = (r) => isNum(r?.left) && isNum(r?.top) && (isNum(r.right) || isNum(r.width)) && (isNum(r.bottom) || isNum(r.height));

/**
 * P7 처형 무효 회색 카드(night + noExecution). samples = [{ t(ms, 카드 도착 기준), voidCard:{ count, title, sub, borderColor, pointerEvents }, nightIntro(밤 시작 문구 수) }],
 * opts = { grayColors, crimsonColors(토큰을 읽어 넘긴 rgb 문자열 목록), clickedThrough(밤 조작 클릭이 통과함) }.
 * 도착 직후 카드 1장, 보이는 모든 표본: 제목 `처형 무효`·부제가 세 문구 중 하나·테두리가 grayColors 중 하나(앰버·진홍 아님)·pointer-events none.
 * 1800ms 이후 표본은 카드 0장. 밤 시작 문구의 첫 등장은 카드의 첫 등장보다 1500ms 이상 뒤(P-3).
 */
export function voidCardChecks(samples, { grayColors, crimsonColors, clickedThrough } = {}) {
  const label = "처형 무효 카드: 회색·문구·1.8초 안 사라짐·밤 시작 문구 순서·터치 통과";
  if (!Array.isArray(samples) || samples.length === 0) return result("P7", label, ["측정값 없음(처형 무효 카드 시간표본)"]);
  const miss = [];
  if (!Array.isArray(grayColors) || grayColors.length === 0) miss.push("측정값 없음(grayColors 토큰 색 목록)");
  if (!Array.isArray(crimsonColors) || crimsonColors.length === 0) miss.push("측정값 없음(crimsonColors 토큰 색 목록)");
  if (typeof clickedThrough !== "boolean") miss.push("측정값 없음(clickedThrough)");
  samples.forEach((x, i) => {
    if (!Number.isFinite(x?.t)) miss.push(`측정값 없음(표본 ${i} t)`);
    else if (!x.voidCard || !isNum(x.voidCard.count)) miss.push(`측정값 없음(표본 ${i} voidCard.count)`);
    else if (!isNum(x.nightIntro)) miss.push(`측정값 없음(표본 ${i} nightIntro)`);
  });
  if (miss.length > 0) return result("P7", label, [...new Set(miss)]);
  const sorted = [...samples].sort((a, b) => a.t - b.t);
  const late = sorted.filter((x) => x.t >= VOID_GONE_MS);
  if (late.length === 0) miss.push(`측정값 없음(${VOID_GONE_MS}ms 이후 표본)`);
  const cardFirst = sorted.find((x) => x.voidCard.count > 0);
  const introFirst = sorted.find((x) => x.nightIntro > 0);
  if (!introFirst) miss.push("측정값 없음(밤 시작 문구 등장 표본)");
  if (miss.length > 0) return result("P7", label, miss);

  const gray = new Set(grayColors.map(colorKey));
  const crimson = new Set(crimsonColors.map(colorKey));
  const bad = new Set();
  const first = sorted[0];
  if (first.voidCard.count !== 1) bad.add(`도착 직후(t=${fmt(first.t)}ms) 처형 무효 카드 ${first.voidCard.count}개 ≠ 1`);
  for (const x of sorted) {
    const c = x.voidCard;
    if (c.count === 0) continue;
    if (c.count > 1) bad.add(`t=${fmt(x.t)}ms 카드 ${c.count}개 > 1`);
    if (c.title !== "처형 무효") bad.add(`카드 제목 "${c.title}" ≠ "처형 무효"`);
    if (!VOID_SUBS.includes(c.sub)) bad.add(`카드 부제 "${c.sub}" 가 세 문구 [${VOID_SUBS.join(" / ")}] 중 하나가 아님`);
    const key = colorKey(c.borderColor);
    if (key === colorKey(AMBER_RGB)) bad.add(`카드 테두리 ${c.borderColor} 가 앰버 — 회색이어야 함`);
    else if (crimson.has(key)) bad.add(`카드 테두리 ${c.borderColor} 가 진홍 — 회색이어야 함`);
    else if (!gray.has(key)) bad.add(`카드 테두리 ${c.borderColor} 가 회색 목록에 없음`);
    if (c.pointerEvents !== "none") bad.add(`카드 pointer-events "${c.pointerEvents}" ≠ none(밤 조작을 막음)`);
  }
  for (const x of late) {
    if (x.voidCard.count !== 0) bad.add(`${VOID_GONE_MS}ms 뒤(t=${fmt(x.t)}ms)에도 카드 ${x.voidCard.count}개가 사라지지 않음`);
  }
  if (cardFirst && introFirst.t - cardFirst.t < VOID_INTRO_AFTER_MS) {
    bad.add(`밤 시작 문구가 카드 도착 ${fmt(introFirst.t - cardFirst.t)}ms 뒤에 보임 < ${VOID_INTRO_AFTER_MS}ms (카드 뒤 순서, P-3)`);
  }
  if (!clickedThrough) bad.add("밤 조작 클릭이 카드를 통과하지 못함");
  return result("P7", label, [...bad]);
}

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
 * P10 칩·카드 배치. v = { dt:{ header, panel, scene? }, reveal:{ chips[], tags[] }, card?:{ rect } }.
 * 칩 사각형은 헤더·하단 패널·모든 이름표(자기 대상 포함)와 겹치지 않는다(캐릭터 머리 위를 덮는 것은 허용). card.rect 가 있으면 장면 폭 안이고 헤더·패널과 겹치지 않는다.
 */
export function placementChecks(v) {
  const label = "배치: 칩·카드가 이름표·헤더·패널과 겹치지 않음";
  const miss = [];
  if (!isRect(v?.dt?.header)) miss.push("측정값 없음(dt.header)");
  if (!isRect(v?.dt?.panel)) miss.push("측정값 없음(dt.panel)");
  if (!Array.isArray(v?.reveal?.chips)) miss.push("측정값 없음(reveal.chips)");
  if (!Array.isArray(v?.reveal?.tags)) miss.push("측정값 없음(reveal.tags)");
  const card = v?.card?.rect;
  if (v?.card) {
    if (!isRect(card)) miss.push("측정값 없음(card.rect)");
    if (!(isNum(v.dt?.scene?.left) && isNum(v.dt?.scene?.right))) miss.push("측정값 없음(dt.scene)");
  }
  if (miss.length > 0) return result("P10", label, miss);

  const bad = [];
  const relaxed = []; // 결정 0056 개정(P10-8ch): 6 그래핌 이상 이름의 이름표와 칩이 겹친 것만 완화한다
  const { header, panel } = v.dt;
  for (const c of v.reveal.chips) {
    const who = `칩(자리 ${c.seat})`;
    if (rectsOverlap(c, header)) bad.push(`${who} 가 헤더와 겹침`);
    if (rectsOverlap(c, panel)) bad.push(`${who} 가 하단 패널과 겹침`);
    for (const t of v.reveal.tags) if (rectsOverlap(c, t)) (isWideTag(t) ? relaxed : bad).push(`${who} 가 이름표(자리 ${t.seat})와 겹침`);
  }
  if (card) {
    const sc = v.dt.scene;
    if (card.left < sc.left - OVERLAP_EPS || right(card) > sc.right + OVERLAP_EPS) bad.push(`카드가 장면 폭 [${fmt(sc.left)}, ${fmt(sc.right)}] 밖 (${fmt(card.left)}~${fmt(right(card))})`);
    if (rectsOverlap(card, header)) bad.push("카드가 헤더와 겹침");
    if (rectsOverlap(card, panel)) bad.push("카드가 하단 패널과 겹침");
  }
  if (bad.length === 0 && relaxed.length > 0) return relaxedResult("P10", label, "P10-8ch", [...new Set(relaxed)]);
  return result("P10", label, bad);
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

/** 겹침 층(비네팅·밝아짐) 한 요소의 공통 판정: 탭을 가로채지 않고(pointer-events: none) 배경이 radial-gradient 다. 이유 목록을 돌려준다. */
function overlayLayerIssues(layer, name) {
  const bad = [];
  if (layer.pointerEvents !== "none") bad.push(`${name} pointer-events ${String(layer.pointerEvents)} ≠ none`);
  if (!String(layer.backgroundImage ?? "").startsWith("radial-gradient(")) bad.push(`${name} 배경이 radial-gradient 가 아님(${String(layer.backgroundImage ?? "").slice(0, 40)})`);
  return bad;
}

/**
 * AT1 밤 비네팅: expect 1(밤)이면 층 정확히 1개·pointer-events none·radial-gradient·내 인물 위 탭이 테이블로 간다. expect 0(밤이 아님)이면 0개다.
 * a = { vignettes: [{ pointerEvents, backgroundImage }], tapHitsTable }.
 */
export function vignetteChecks(a, { expect }) {
  const label = expect === 1 ? "밤 비네팅 한 겹·탭 통과" : "밤이 아니면 비네팅 없음";
  if (!a || !Array.isArray(a.vignettes)) return noMeasure("AT1", label, "비네팅 층 목록");
  const n = a.vignettes.length;
  if (expect === 0) return result("AT1", label, n === 0 ? [] : [`밤이 아닌데 비네팅 ${n}개`]);
  if (n !== 1) return result("AT1", label, [`비네팅 ${n}개 ≠ 1`]);
  if (typeof a.tapHitsTable !== "boolean") return noMeasure("AT1", label, "내 인물 위 탭 대상");
  const bad = overlayLayerIssues(a.vignettes[0], "비네팅");
  if (!a.tapHitsTable) bad.push("내 인물 위 탭이 테이블로 가지 않음(비네팅이 가로챔)");
  return result("AT1", label, bad);
}

/** 밝아짐 층이 장면 상자에서 벗어나도 되는 오차(px). */
const GLOW_BOX_EPS = 0.5;
/**
 * AT2 아침 밝아짐: expect 1(밤 → 아침을 본 렌더)이면 층 정확히 1개·pointer-events none·radial-gradient·장면 상자 안·이름표 위 탭이 이름표로 간다. expect 0 이면 0개다.
 * a = { glows: [{ pointerEvents, backgroundImage, top, bottom }], sceneTop, sceneBottom, tagHit }.
 */
export function glowChecks(a, { expect }) {
  const label = expect === 1 ? "아침 밝아짐 한 겹·장면 상자 안·탭 통과" : "아침을 본 렌더가 아니면 밝아짐 없음";
  if (!a || !Array.isArray(a.glows)) return noMeasure("AT2", label, "밝아짐 층 목록");
  const n = a.glows.length;
  if (expect === 0) return result("AT2", label, n === 0 ? [] : [`밝아짐 ${n}개 ≠ 0`]);
  if (n !== 1) return result("AT2", label, [`밝아짐 ${n}개 ≠ 1`]);
  const g = a.glows[0];
  if (!isNum(g?.top) || !isNum(g?.bottom) || !isNum(a.sceneTop) || !isNum(a.sceneBottom)) return noMeasure("AT2", label, "밝아짐 층·장면 상자 위아래");
  if (typeof a.tagHit !== "boolean") return noMeasure("AT2", label, "이름표 위 탭 대상");
  const bad = overlayLayerIssues(g, "밝아짐");
  if (g.top < a.sceneTop - GLOW_BOX_EPS) bad.push(`밝아짐 위 ${rd(g.top)} < 장면 상자 위 ${rd(a.sceneTop)}(헤더 쪽으로 올라감)`);
  if (g.bottom > a.sceneBottom + GLOW_BOX_EPS) bad.push(`밝아짐 아래 ${rd(g.bottom)} > 장면 상자 아래 ${rd(a.sceneBottom)}`);
  if (!a.tagHit) bad.push("이름표 위 탭이 이름표로 가지 않음(밝아짐이 가로챔)");
  return result("AT2", label, bad);
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

/** 후보 선택 하단 안내 줄 두 문장. src/game/verdict.ts VERDICT_TEXT.candidateGuideNone·candidateGuidePicked 의 사본이다 — test/unit/e2eContract.test.ts 가 대조한다. */
export const CANDIDATE_GUIDE = Object.freeze({
  none: "아무도 고르지 않으면 무효표가 돼요",
  picked: "빈 곳을 누르면 선택이 취소돼요",
});

/** 빈 곳 측정 점이 사람·버튼에서 떨어져야 하는 여유(px). 앱 여유 BLANK_TAP_SLOP_PX(8)의 두 배 — 측정 점이 분명히 빈 곳이다(e2eContract 가 2배 이상을 지킨다). */
export const BLANK_TAP_E2E_MARGIN = 16;

/**
 * 빈 곳 후보 점. scene 상자를 margin 만큼 줄인 안쪽에서 step 간격 격자를 위→아래·왼→오른 순서로 훑어,
 * 모든 avoid 상자를 margin 만큼 넓힌 범위(경계 포함) 밖인 점을 limit 개까지 돌려준다. 너비·높이 0 인 avoid 는 무시한다. 다 덮이면 [].
 * 사각형은 { left, top, width, height }. 같은 입력이면 같은 결과.
 */
export function blankPointsOf({ scene, avoid = [], margin, step, limit = 200 }) {
  const x0 = scene.left + margin;
  const x1 = scene.left + scene.width - margin;
  const y0 = scene.top + margin;
  const y1 = scene.top + scene.height - margin;
  const boxes = avoid.filter((b) => b.width > 0 && b.height > 0);
  const out = [];
  for (let y = y0; y <= y1 && out.length < limit; y += step) {
    for (let x = x0; x <= x1 && out.length < limit; x += step) {
      const covered = boxes.some((b) => x >= b.left - margin && x <= b.left + b.width + margin && y >= b.top - margin && y <= b.top + b.height + margin);
      if (!covered) out.push({ x, y });
    }
  }
  return out;
}

/**
 * P11 후보 선택 안내 줄(결정 0040). v = readVerdict 스냅숏(bottom.guide·guideH·guideLH), opts.picked = 고른 뒤인가.
 * 안내 줄이 CANDIDATE_GUIDE 의 맞는 문장이고 한 줄(isOneLine)이면 통과.
 */
export function candidateGuideChecks(v, { picked } = {}) {
  const label = "후보 선택 안내 줄: 문장·한 줄";
  const miss = [];
  if (typeof v?.bottom?.guide !== "string") miss.push("측정값 없음(bottom.guide)");
  if (!isNum(v?.bottom?.guideH)) miss.push("측정값 없음(bottom.guideH)");
  if (!isNum(v?.bottom?.guideLH)) miss.push("측정값 없음(bottom.guideLH)");
  if (typeof picked !== "boolean") miss.push("측정값 없음(picked 인자)");
  if (miss.length > 0) return result("P11", label, miss);
  const want = CANDIDATE_GUIDE[picked ? "picked" : "none"];
  const bad = [];
  if (v.bottom.guide !== want) bad.push(`안내 줄 "${v.bottom.guide}" ≠ "${want}" (무효표·취소 문장)`);
  if (!isOneLine(v.bottom.guideH, v.bottom.guideLH)) bad.push(`안내 줄이 한 줄이 아님(높이 ${rd(v.bottom.guideH)}px·줄 높이 ${rd(v.bottom.guideLH)}px, ${lineCount(v.bottom.guideH, v.bottom.guideLH)}줄)`);
  return result("P11", label, bad);
}

/**
 * P12 취소 탭(결정 0040). 입력 { chosenSeat, afterTag, afterBlank }:
 *  - afterTag = 이름표(pointer-events none 이라 아래로 통과하는 점)를 탭한 뒤 { voteTarget, pill } — 표가 chosenSeat 로 남고 알약이 `님에게 투표했어요`.
 *  - afterBlank = 빈 곳을 탭한 뒤 { voteTarget, pill, halos } — 표가 없고(undefined·null) 알약이 `선택 안 함`, 흰 후광 0.
 * 값이 없으면 `측정값 없음` 으로 실패한다.
 */
export function cancelTapChecks({ chosenSeat, afterTag, afterBlank } = {}) {
  const label = "취소 탭: 이름표는 표 유지·빈 곳은 취소";
  const miss = [];
  if (typeof chosenSeat !== "number") miss.push("측정값 없음(chosenSeat 인자)");
  if (!afterTag || typeof afterTag.pill !== "string") miss.push("측정값 없음(이름표 탭 뒤 값)");
  if (!afterBlank || typeof afterBlank.pill !== "string" || !isNum(afterBlank.halos)) miss.push("측정값 없음(빈 곳 탭 뒤 값)");
  if (miss.length > 0) return result("P12", label, miss);
  const bad = [];
  if (afterTag.voteTarget !== chosenSeat) bad.push(`이름표를 탭했더니 표가 ${String(afterTag.voteTarget)} 로 바뀜(기대 ${chosenSeat} 유지, 이름표 탭이 취소됨)`);
  if (!afterTag.pill.includes("님에게 투표했어요")) bad.push(`이름표 탭 뒤 알약 "${afterTag.pill}" 에 "님에게 투표했어요" 없음`);
  if (afterBlank.voteTarget !== undefined && afterBlank.voteTarget !== null) bad.push(`빈 곳을 탭했는데 표 ${String(afterBlank.voteTarget)} 가 안 풀림`);
  if (!afterBlank.pill.includes("선택 안 함")) bad.push(`빈 곳 탭 뒤 알약 "${afterBlank.pill}" 에 "선택 안 함" 없음(빈 곳 탭이 취소하지 않음)`);
  if (afterBlank.halos !== 0) bad.push(`빈 곳 탭 뒤 흰 후광 ${afterBlank.halos}개 ≠ 0`);
  return result("P12", label, bad);
}

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
 * 4명 이상이면 활성(aria-disabled 없음, 불투명도 1)이고, 점은 항상 최대 인원(8)개이며 켜진 점은 연결된 사람 수와 같다.
 * s = browser.readLobbyFrame().start — { ariaDisabled, opacity, dots, dotsOn, rect, hit } | null.
 */
export function lobbyStartChecks(s, { n, min = 4, max = 8 }) {
  const label = `[시작] ${n}명: ${n >= min ? "활성" : "흐림"}·점 ${max}개 중 ${n}개 켜짐`;
  if (!s) return result("L8", label, ["측정값 없음([시작] 버튼 없음)"]);
  const bad = [];
  const dim = s.ariaDisabled === "true";
  if (n >= min && dim) bad.push("활성이어야 하는데 aria-disabled");
  if (n < min && !dim) bad.push("흐려야 하는데 aria-disabled 아님");
  if (n >= min && !(s.opacity >= 0.99)) bad.push(`활성인데 불투명도 ${s.opacity}`);
  if (n < min && !(s.opacity < 0.99)) bad.push(`흐려야 하는데 불투명도 ${s.opacity}`);
  if (s.dots !== max) bad.push(`점 ${s.dots}개 ≠ ${max}`);
  if (s.dotsOn !== n) bad.push(`켜진 점 ${s.dotsOn}개 ≠ ${n}`);
  if (s.rect.height + OVERLAP_EPS < TAP_MIN) bad.push(`높이 ${rd(s.rect.height)} < ${TAP_MIN}`);
  return result("L8", label, bad);
}

/** 이름이 6 그래핌 이상인가(결정 0056 완화 범위의 이름 조건). Intl.Segmenter 가 없으면 코드 포인트 수로 센다. */
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
 * (skipByDefault 라도 --only 로 고르면 돈다).
 */
export function selectFlows(flows, only) {
  return flows.filter((f) => (only === null || only === undefined ? f.skipByDefault !== true : f.id.includes(only) || only.startsWith(f.id)));
}

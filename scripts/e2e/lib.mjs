// 화면 E2E 순수 도우미(결정 0025). playwright-core·네트워크·파일을 쓰지 않는다 — 단위 테스트: node --test scripts/e2e/lib.test.mjs
// 사각형은 { left, top, width, height } 이고 right·bottom 이 없으면 계산한다(DOMRect 를 옮긴 값).

export const DEFAULT_SIZES = [
  { w: 360, h: 640, label: "360x640" },
  { w: 390, h: 664, label: "390x664" },
  { w: 430, h: 932, label: "430x932" },
];
/** 겹침 허용 오차(px). 변이 맞닿거나 0.5px 이하로 겹친 것은 겹침이 아니다. 알려진 결함 D4 의 기준이므로 낮추지 않는다. */
export const OVERLAP_EPS = 0.5;
/** 탭 대상 하한(px). */
export const TAP_MIN = 44;
/** index.html 이 불러오는 Gowun Dodum 글꼴 호스트 — 대상 주소 밖에서 요청을 허용하는 유일한 두 곳. */
export const FONT_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"];
export const LOCAL_HOSTS = ["localhost", "127.0.0.1", "[::1]"];
export const MAX_PARALLEL = 3;
export const OVERALL_LIMIT_MS = 600_000;

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
  "사용법: node scripts/e2e/run.mjs [--url https://minifia.dhplay.workers.dev | http://localhost:5173] [--only <시나리오 부분 문자열>] [--shots] [--sizes 360x640,390x664,430x932]";

export function parseArgs(argv) {
  const out = { url: null, only: null, shots: false, sizes: DEFAULT_SIZES.map((s) => ({ ...s })) };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--shots") out.shots = true;
    else if (a === "--url" || a === "--only" || a === "--sizes") {
      const v = argv[++i];
      if (v === undefined || v === "" || v.startsWith("--")) throw new UsageError(`${a} 값이 없음`);
      if (a === "--url") out.url = v;
      else if (a === "--only") out.only = v;
      else {
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

// ---- 낮 장면·아침·테이블 검사 규칙(과제 2). 알려진 결함 D1·D4 도 다른 단언과 똑같이 판정한다 — 예외 분기를 두지 않는다. ----

/** 제목 한 줄 판정 배율(줄 높이의 1.6배까지). 낮추지 않는다(D1). */
export const ONE_LINE_FACTOR = 1.6;
/** 얼굴 = 캐릭터 상자의 위 45%. */
export const FACE_RATIO = 0.45;
/** 낮 장면 하단 패널 높이(결정 0017). */
export const PANEL_H = 157;
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
/** 겹친 크기를 사람이 판단할 수 있게 내용 칸에 적는다(기준은 바꾸지 않는다). */
const overlapText = (a, b) =>
  `가로 ${rd(Math.min(right(a), right(b)) - Math.max(a.left, b.left))}px·세로 ${rd(Math.min(bottom(a), bottom(b)) - Math.max(a.top, b.top))}px`;
const result = (id, label, bad) => ({ id, label, ok: bad.length === 0, detail: bad.length === 0 ? "" : bad.join("; ") });
const hasPoint = (r, x, y) => x >= r.left && x <= right(r) && y >= r.top && y <= bottom(r);

/** D3b 인원별 이름표 보이는 비율 바닥. 4·5명 100 %(부동소수 오차 0.001 허용), 6명 85 %, 7명 50 %, 8명 55 %. */
function visibilityFloor(n) {
  if (n <= 5) return 0.999;
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
  if (!Array.isArray(v) || v.length === 0) return ["이름표 보이는 비율을 측정하지 못함 (tagVisibility 없음)"];
  const unloaded = v.filter((x) => x.ratio === null || x.ratio === undefined || Number.isNaN(x.ratio));
  if (unloaded.length > 0) return [`이미지가 로드되지 않아 측정하지 못함: 자리 ${unloaded.map((x) => x.seat).join("/")}`];
  const floor = visibilityFloor(v.length);
  const low = v.reduce((a, b) => (b.ratio < a.ratio ? b : a));
  return low.ratio >= floor ? [] : [`${v.length}명판 자리 ${low.seat} 이름표 ${rd(low.ratio * 100)}% < 바닥 ${rd(floor * 100)}%`];
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

/** 낮 장면(직업 공개·토론·밤·아침)의 고정물 검사 D1·D2·D3a·D3b·D4·D5·D6·D8. */
export function dayChecks(snap, { w, h }) {
  // D1 위쪽 제목이 한 줄
  const d1 = [];
  if (!snap.h1) d1.push("제목 없음");
  else if (!isOneLine(snap.h1.rect.height, snap.h1.lineHeight))
    d1.push(`"${snap.h1.text}" ${lineCount(snap.h1.rect.height, snap.h1.lineHeight)}줄 (높이 ${rd(snap.h1.rect.height)}, 줄 높이 ${rd(snap.h1.lineHeight)})`);

  // D2 이름표가 장면 안·패널 밖
  const d2 = [];
  for (const t of snap.tags) {
    if (snap.scene && !rectInside(t.rect, snap.scene)) d2.push(`자리 ${t.seat} 이름표가 장면 밖`);
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
    result("D2", "이름표가 장면 안·패널 밖", d2),
    result("D3a", "이름표가 캐릭터 아래 층", d3aStructure(snap)),
    result("D3b", "이름표 보이는 비율", d3bVisibility(snap)),
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
  for (const e of entries.slice(1)) {
    const r = e.rect;
    const same = ["left", "top", "width", "height"].every((k) => Math.abs(r[k] - base.rect[k]) <= 0.5);
    if (!same) bad.push(`${e.state} 에서 테이블이 ${base.state} 와 다름 (${rd(r.left)},${rd(r.top)} ${rd(r.width)}x${rd(r.height)} ↔ ${rd(base.rect.left)},${rd(base.rect.top)} ${rd(base.rect.width)}x${rd(base.rect.height)})`);
  }
  return result("D7", "단계가 바뀌어도 테이블 그대로", bad);
}

/** D9: 이름표끼리 겹치지 않는다(모든 인원). tags = [{ seat, rect }]. */
export function tagsOverlap(tags) {
  const bad = [];
  for (let i = 0; i < tags.length; i++)
    for (let j = i + 1; j < tags.length; j++) if (rectsOverlap(tags[i].rect, tags[j].rect)) bad.push(`${tags[i].seat}-${tags[j].seat}`);
  return result("D9", "이름표끼리 안 겹침", bad);
}

// ---- 차례(K1·K2)·주장 채팅(K3)·기록 카드(X1) ----

/** clip-path 의 inset(...) 을 위·오른쪽·아래·왼쪽 네 값으로 펼친다(브라우저가 1~3개 값으로 줄여 돌려줘도 읽는다). 아니면 null */
function insetSides(clip) {
  const m = /^inset\(([^)]*?)(?:\s+round\s+[^)]*)?\)$/.exec(String(clip ?? "").trim());
  if (!m) return null;
  const v = m[1].trim().split(/\s+/);
  if (v.length < 1 || v.length > 4) return null;
  const [top, right = top, bottom = top, left = right] = v;
  return { top, right, bottom, left };
}

/** N6 밤 시작 문구(결정 0028). intro = browser.readNightIntro 결과: 없으면 null, 있으면 { texts, pointerEvents, ariaHidden, rect } */
export function nightIntroChecks(intro) {
  const bad = [];
  if (!intro) bad.push("밤 시작 문구(.mf-nightintro) 없음");
  else {
    const t = intro.texts ?? [];
    if (!(t.length === 2 && /^\d+일차$/.test(t[0]) && t[1] === "밤이 되었습니다")) bad.push(`글자 [${t.join(" / ")}] ≠ [N일차 / 밤이 되었습니다]`);
    if (intro.pointerEvents !== "none") bad.push(`pointer-events ${intro.pointerEvents} ≠ none`);
    if (intro.ariaHidden !== true) bad.push("aria-hidden 이 아님");
  }
  return result("N6", "밤 시작 문구가 한 번 보임", bad);
}

/** K4 차례 링이 캐릭터 뒤(위쪽 반)·앞(아래쪽 반) 두 층으로 갈라져 있다 (결정 0028). ring = 스냅숏 turn.ring */
export function ringChecks(ring) {
  const bad = [];
  if (!ring) bad.push("측정값 없음(차례 링 묶음 .mf-dt__spot 을 못 찾음)");
  else {
    if (!ring.plain) bad.push("링 묶음이 평범하지 않음(쌓임 맥락·변형·애니메이션이 있음)");
    if (!ring.back) bad.push("뒤쪽 호 없음");
    else if (!(typeof ring.back.z === "number" && ring.back.z < 0)) bad.push(`뒤쪽 호 z-index ${ring.back.z} 가 음수가 아님`);
    if (!ring.front) bad.push("앞쪽 호 없음");
    else {
      if (typeof ring.front.z === "number" && ring.front.z < 0) bad.push(`앞쪽 호 z-index ${ring.front.z} 가 음수`);
      if (ring.front.position !== "absolute") bad.push(`앞쪽 호 position ${ring.front.position} ≠ absolute`);
    }
    if (!ring.figBeforeFront) bad.push("앞쪽 호가 캐릭터 그림보다 앞 순서(그림 위로 오지 않음)");
    const b = ring.back && insetSides(ring.back.clip);
    if (ring.back && !(b && b.bottom === "50%" && b.top !== "50%")) bad.push(`뒤쪽 호 clip-path "${ring.back.clip}" 가 위쪽 반만 보이는 꼴이 아님`);
    const f = ring.front && insetSides(ring.front.clip);
    if (ring.front && !(f && f.top === "50%" && f.bottom !== "50%")) bad.push(`앞쪽 호 clip-path "${ring.front.clip}" 가 아래쪽 반만 보이는 꼴이 아님`);
    if (!ring.seatContext) bad.push("자리(.mf-dt__seat)가 쌓임 맥락이 아님(z-index 없음)");
  }
  return result("K4", "차례 링이 캐릭터 뒤·앞 반으로 갈라짐", bad);
}

/**
 * K1·K4·K2. 차례가 있으면 K4(링 앞뒤 층)도 돌린다. expectNone: 차례 없는 단계(토론·밤·아침)라 표식 세 값이 모두 0 이어야 하고 K2 는 돌리지 않는다.
 * myTurn(true/false)이 있으면 K2 도 돌린다. jobs = 이번 판 직업 칩 글자(내 차례일 때 + 「말 안 함」과 순서까지 비교).
 */
export function turnChecks(snap, { expectNone = false, myTurn, jobs = [] } = {}) {
  const t = snap.turn ?? { spot: 0, badge: 0, tagTurn: 0, legacyRows: 0 };
  const k1 = [];
  const want = expectNone ? 0 : 1;
  for (const [key, name] of [["spot", "강조 자리(.mf-dt__spot)"], ["badge", "차례 배지(.mf-dt__turn)"], ["tagTurn", "반전 이름표(.mf-dt__tag--turn)"]]) {
    if (t[key] !== want) k1.push(`${name} ${t[key]}개 ≠ ${want}`);
  }
  if (t.legacyRows !== 0) k1.push(`이름표 아랫줄(.mf-dt__claim) ${t.legacyRows}개 ≠ 0`);
  const out = [result("K1", expectNone ? "차례 표식 없음" : "차례 표식이 정확히 한 자리", k1)];
  if (expectNone) return out;
  out.push(ringChecks(t.ring));
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

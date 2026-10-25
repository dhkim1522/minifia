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

/** 모든 검사 상태에 도는 공통 검사 G1~G6. 항상 여섯 개를 같은 순서로 돌려준다. */
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

/** 낮 장면(직업 공개·토론·밤·아침)의 고정물 검사 D1·D2·D3·D4·D5·D6·D8. */
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

  // D3 이름표가 다른 자리의 얼굴을 안 가림
  const d3 = [];
  for (const t of snap.tags) {
    for (const s of snap.seats) {
      if (s.seat === t.seat) continue;
      if (rectsOverlap(t.rect, faceRegion(s.rect))) d3.push(`${t.seat}→${s.seat} (${overlapText(t.rect, faceRegion(s.rect))})`);
    }
  }

  // D4 [테스트] 가 캐릭터와 안 겹침
  const d4 = [];
  if (!snap.tt) d4.push("[테스트] 버튼 없음");
  else for (const s of snap.seats) if (rectsOverlap(snap.tt.rect, s.rect)) d4.push(`자리 ${s.seat} 캐릭터 상자와 겹침 (${overlapText(snap.tt.rect, s.rect)})`);

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
    result("D3", "이름표가 다른 얼굴을 안 가림", d3),
    result("D4", "[테스트]가 캐릭터와 안 겹침", d4),
    result("D5", "세로 스크롤 없음", d5),
    result("D6", "하단 패널 높이 157", d6),
    result("D8", "위쪽 바 버튼이 한 줄", d8),
  ];
}

/** M1 아침 카드 허용 범위. 뒷자리 이름표를 덮는 것은 허용(night-v1 SPEC M1)이라 이름표는 내 것만 본다. */
export function morningCardIssues(snap, { w, mySeat }) {
  const card = snap.card;
  if (!card) return { id: "M1", label: "아침 카드 허용 범위", ok: false, detail: "아침 카드 없음" };
  const bad = [];
  if (card.left < -0.5 || right(card) > w + 0.5) bad.push(`카드가 화면 밖 (${rd(card.left)}~${rd(right(card))})`);
  if (snap.panel && rectsOverlap(card, snap.panel.rect)) bad.push("하단 패널과 겹침");
  for (const s of snap.seats) {
    if (s.seat === mySeat) {
      if (rectsOverlap(card, s.rect)) bad.push("내 자리 캐릭터와 겹침");
    } else if (rectsOverlap(card, faceRegion(s.rect))) bad.push(`자리 ${s.seat} 얼굴과 겹침 (${overlapText(card, faceRegion(s.rect))})`);
  }
  const myTag = snap.tags.find((t) => t.seat === mySeat);
  if (myTag && rectsOverlap(card, myTag.rect)) bad.push("내 이름표와 겹침");
  return result("M1", "아침 카드 허용 범위", bad);
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

/** D9: 이름표끼리 겹치지 않는다. tags = [{ seat, rect }]. */
export function tagsOverlap(tags) {
  const bad = [];
  for (let i = 0; i < tags.length; i++)
    for (let j = i + 1; j < tags.length; j++) if (rectsOverlap(tags[i].rect, tags[j].rect)) bad.push(`${tags[i].seat}-${tags[j].seat}`);
  return result("D9", "4명 이름표 안 겹침", bad);
}

// ---- RED 단계 임시 껍데기: 단언으로 실패하게 하려는 자리 표시. GREEN 커밋에서 실제 구현으로 바뀐다. ----
const todo = (id) => ({ id, label: "미구현", ok: false, detail: "미구현" });
export const TEXT_SIZE_ALLOW = [];
export const dimChecks = () => todo("M3");
export const morningGoneChecks = () => todo("M4");
export const turnChecks = () => [todo("K1")];
export const claimChatIssues = () => todo("K3");
export const inspectChecks = () => todo("X1");
export const roleCardButtonChecks = () => todo("R1");
export const roleCardTabChecks = () => todo("R2");
export const journalChecks = () => todo("R3");
export const noticeChecks = () => todo("R6");
export const spectatorChecks = () => todo("V1");
export const livingRoleArtChecks = () => todo("V2");
export const smallTextIssues = () => todo("G7");

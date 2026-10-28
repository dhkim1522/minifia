// 화면 E2E 순수 도우미 단위 테스트. 실행: node --test scripts/e2e/lib.test.mjs
import test from "node:test";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import {
  APPROVED_RELAXATIONS,
  D3B_FLOOR_5_PLAYERS,
  DECORATIVE_ALLOW,
  EXPECTED_SCENE,
  FACE_RATIO,
  HEADER_BG_PERCENTILE,
  HEADER_CONTRAST_MIN,
  HEADER_H,
  ONE_LINE_FACTOR,
  PANEL_H,
  OVERLAP_EPS,
  SIDE_GAP_MIN,
  TAP_ALLOW,
  TAP_MIN,
  TEXT_SIZE_ALLOW,
  UsageError,
  chromeCandidates,
  claimChatIssues,
  dayChecks,
  dimChecks,
  inspectChecks,
  journalChecks,
  livingRoleArtChecks,
  morningGoneChecks,
  noNightNoticeChecks,
  roleCardButtonChecks,
  roleCardTabChecks,
  smallTextIssues,
  spectatorChecks,
  turnChecks,
  crownChecks,
  sceneIntroChecks,
  backdropSceneChecks,
  headerContrastChecks,
  percentile,
  relLuminance,
  rgbP95Luminance,
  exitCodeOf,
  faceRegion,
  feltGapChecks,
  feltStable,
  findChrome,
  formatTables,
  genericIssues,
  isOneLine,
  lobbyShapeChecks,
  lineCount,
  morningCardIssues,
  parseArgs,
  rectInside,
  rectsOverlap,
  redact,
  resolveTarget,
  stageStable,
  tagsOverlap,
  voteChecks,
  introChecks,
  candidateChecks,
  revealChecks,
  colorRuleChecks,
  haloChecks,
  AMBER_RGB,
  PANEL_H_DEFENSE_ME,
  defenseChecks,
  executionChecks,
} from "./lib.mjs";

const PROD = "https://minifia.dhplay.workers.dev\n";
const rect = (left, top, width, height) => ({ left, top, width, height, right: left + width, bottom: top + height });

test("parseArgs: 인자 없음은 기본값 세 크기", () => {
  const a = parseArgs([]);
  assert.equal(a.url, null);
  assert.equal(a.only, null);
  assert.equal(a.shots, false);
  assert.deepEqual(
    a.sizes.map((s) => [s.w, s.h, s.label]),
    [
      [360, 640, "360x640"],
      [390, 664, "390x664"],
      [430, 932, "430x932"],
    ],
  );
});

test("parseArgs: --sizes 하나, --shots, --only, --url", () => {
  const a = parseArgs(["--sizes", "360x640", "--shots", "--only", "lobby", "--url", "http://localhost:5173"]);
  assert.equal(a.sizes.length, 1);
  assert.equal(a.sizes[0].label, "360x640");
  assert.equal(a.shots, true);
  assert.equal(a.only, "lobby");
  assert.equal(a.url, "http://localhost:5173");
});

test("parseArgs: 잘못된 인자는 UsageError", () => {
  for (const argv of [["--sizes", "360x"], ["--sizes", "abc"], ["--foo"], ["--only"], ["--url"]]) {
    assert.throws(() => parseArgs(argv), UsageError, argv.join(" "));
  }
});

test("resolveTarget: 인자 없으면 prod-url 값", () => {
  assert.equal(resolveTarget(null, PROD).origin, "https://minifia.dhplay.workers.dev");
});

test("resolveTarget: localhost 는 경로와 쿼리를 버린 origin", () => {
  assert.equal(resolveTarget("http://localhost:5173/x?y=1", PROD).origin, "http://localhost:5173");
  assert.equal(resolveTarget("http://127.0.0.1:8787", PROD).origin, "http://127.0.0.1:8787");
  assert.equal(resolveTarget("http://[::1]:5173", PROD).origin, "http://[::1]:5173");
});

test("resolveTarget: 명시한 https 는 받는다", () => {
  assert.equal(resolveTarget("https://staging.example.dev", PROD).origin, "https://staging.example.dev");
});

test("resolveTarget: 로컬이 아닌 http·다른 scheme·사용자 정보·주소 아님은 이유와 함께 거부", () => {
  for (const bad of ["http://example.com", "ftp://localhost/", "https://u:p@host.dev", "not a url"]) {
    assert.throws(
      () => resolveTarget(bad, PROD),
      (e) => e instanceof Error && e.message.length > 3,
      bad,
    );
  }
});

test("chromeCandidates: darwin 첫 값은 맥 기본 경로", () => {
  assert.equal(chromeCandidates("darwin", {})[0], "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome");
});

test("chromeCandidates: win32 는 환경 변수 기준 세 경로", () => {
  const list = chromeCandidates("win32", { PROGRAMFILES: "C:\\PF", "PROGRAMFILES(X86)": "C:\\PF86", LOCALAPPDATA: "C:\\LA" });
  for (const base of ["C:\\PF", "C:\\PF86", "C:\\LA"]) {
    assert.ok(
      list.some((p) => p.startsWith(base) && p.endsWith("Google\\Chrome\\Application\\chrome.exe")),
      base,
    );
  }
});

test("chromeCandidates: linux 는 /usr/bin/google-chrome 포함", () => {
  assert.ok(chromeCandidates("linux", {}).includes("/usr/bin/google-chrome"));
});

test("findChrome: CHROME_PATH 가 있고 파일도 있으면 그 경로", () => {
  assert.equal(findChrome("darwin", { CHROME_PATH: "/x/chrome" }, (p) => p === "/x/chrome"), "/x/chrome");
});

test("findChrome: CHROME_PATH 파일이 없으면 기본 경로로 넘어가지 않고 CHROME_PATH 를 말한다", () => {
  assert.throws(
    () => findChrome("darwin", { CHROME_PATH: "/x/none" }, () => false),
    (e) => /CHROME_PATH/.test(e.message) && /\/x\/none/.test(e.message),
  );
  // 기본 경로가 존재하더라도 CHROME_PATH 가 틀렸으면 쓰지 않는다
  assert.throws(
    () => findChrome("darwin", { CHROME_PATH: "/x/none" }, (p) => p.startsWith("/Applications")),
    /CHROME_PATH/,
  );
});

test("findChrome: 아무것도 없으면 찾아본 경로를 담은 오류", () => {
  assert.throws(
    () => findChrome("darwin", {}, () => false),
    (e) => e.message.includes("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome") && /CHROME_PATH/.test(e.message),
  );
});

test("findChrome: 기본 경로가 있으면 그 경로", () => {
  const first = chromeCandidates("darwin", {})[0];
  assert.equal(findChrome("darwin", {}, (p) => p === first), first);
});

test("rectsOverlap: 맞닿음 false, 1px 겹침 true, 0.4px 겹침 false", () => {
  assert.equal(OVERLAP_EPS, 0.5);
  assert.equal(rectsOverlap(rect(0, 0, 10, 10), rect(10, 0, 10, 10)), false);
  assert.equal(rectsOverlap(rect(0, 0, 10, 10), rect(9, 0, 10, 10)), true);
  assert.equal(rectsOverlap(rect(0, 0, 10, 10), rect(9.6, 0, 10, 10)), false);
});

test("rectInside: 0.3px 넘침 true, 1px 넘침 false", () => {
  const outer = rect(0, 0, 100, 100);
  assert.equal(rectInside(rect(0, 0, 100.3, 50), outer), true);
  assert.equal(rectInside(rect(0, 0, 101, 50), outer), false);
});

const cleanSnap = () => ({
  vw: 360,
  vh: 640,
  docW: 360,
  docH: 640,
  bodyW: 360,
  elements: [{ desc: "div.a", rect: rect(0, 0, 360, 100) }],
  interactive: [{ desc: "button.b", rect: rect(10, 10, 44, 44), hit: true }],
  issues: { console: [], failed: [], offOrigin: [] },
  smallText: [],
});
const byId = (list, id) => list.find((x) => x.id === id);

test("genericIssues: 이상 없으면 G1~G7 일곱 개가 같은 순서로 모두 통과", () => {
  const list = genericIssues(cleanSnap(), { w: 360, h: 640 });
  assert.deepEqual(list.map((x) => x.id), ["G1", "G2", "G3", "G4", "G5", "G6", "G7"]);
  assert.ok(list.every((x) => x.ok), JSON.stringify(list));
});

test("genericIssues: 문서 폭이 설정 폭보다 크면 G1 실패", () => {
  const s = cleanSnap();
  s.docW = 361;
  assert.equal(byId(genericIssues(s, { w: 360, h: 640 }), "G1").ok, false);
});

test("genericIssues: 화면 밖 요소는 G2 실패, 내용에 요소 설명", () => {
  const s = cleanSnap();
  s.elements.push({ desc: "div.wide", rect: rect(100, 0, 261, 10) });
  const g2 = byId(genericIssues(s, { w: 360, h: 640 }), "G2");
  assert.equal(g2.ok, false);
  assert.match(g2.detail, /div\.wide/);
});

test("genericIssues: 탭 대상 43x44 는 G3 실패, 44x44·43.6x44 는 통과", () => {
  const s = cleanSnap();
  s.interactive = [{ desc: "button.s", rect: rect(0, 0, 43, 44), hit: true }];
  assert.equal(TAP_MIN, 44);
  assert.equal(byId(genericIssues(s, { w: 360, h: 640 }), "G3").ok, false);
  s.interactive = [
    { desc: "button.a", rect: rect(0, 0, 44, 44), hit: true },
    { desc: "button.b", rect: rect(0, 0, 43.6, 44), hit: true },
  ];
  assert.equal(byId(genericIssues(s, { w: 360, h: 640 }), "G3").ok, true);
});

test("genericIssues: 콘솔·실패 요청·외부 요청은 G4·G5·G6 실패", () => {
  const s = cleanSnap();
  s.issues = { console: ["boom"], failed: ["GET /x 500"], offOrigin: ["https://evil.example"] };
  const list = genericIssues(s, { w: 360, h: 640 });
  for (const id of ["G4", "G5", "G6"]) assert.equal(byId(list, id).ok, false, id);
});

test("허용 목록: 모든 항목에 이유가 있고 알려진 결함 요소를 빼지 않는다", () => {
  for (const item of [...DECORATIVE_ALLOW, ...TAP_ALLOW]) {
    assert.ok(typeof item.reason === "string" && item.reason.trim().length > 0, JSON.stringify(item));
    for (const banned of ["mf-tt", "mf-phasebar", "mf-dt__tag", "mf-dt__seat"]) {
      assert.ok(!item.selector.includes(banned), `${item.selector} 에 ${banned}`);
    }
  }
});

test("TEXT_SIZE_ALLOW: .mf-journal__new 하나로 시작하고, 더할 수 있는 것은 테스트 도구(.mf-tt*)뿐, 이유 필수", () => {
  assert.ok(TEXT_SIZE_ALLOW.some((i) => i.selector === ".mf-journal__new"));
  for (const item of TEXT_SIZE_ALLOW) {
    assert.ok(typeof item.reason === "string" && item.reason.trim().length > 0, JSON.stringify(item));
    for (const sel of item.selector.split(",").map((x) => x.trim())) {
      assert.ok(sel === ".mf-journal__new" || sel.startsWith(".mf-tt"), `허용되지 않는 글자 크기 허용 선택자: ${sel}`);
      for (const banned of [".mf-phasebar", ".mf-dt__", ".mf-rolecard", ".mf-journal__row"]) {
        assert.ok(!sel.includes(banned), `${sel} 에 ${banned}`);
      }
    }
  }
});

test("기준 수치는 낮추지 않았다(0.5px·1.6배·45%·44·157)", () => {
  assert.equal(OVERLAP_EPS, 0.5);
  assert.equal(ONE_LINE_FACTOR, 1.6);
  assert.equal(FACE_RATIO, 0.45);
  assert.equal(TAP_MIN, 44);
  assert.equal(PANEL_H, 157);
});

test("D3B_FLOOR_5_PLAYERS 는 98.0% 하나만 낮췄다(5명판 한정, 사용자 승인 2026-10-26) — 다른 바닥과 기준 수치는 그대로", () => {
  assert.equal(D3B_FLOOR_5_PLAYERS, 0.98);
  // 5명판 바닥만 98.0%. 다른 인원 바닥은 dayChecks 로 직접 잰다 (4명 100%, 6명 85%, 7명 50%, 8명 55%).
  const floorOk = (n, ratio) => {
    const s = daySnap();
    s.tagVisibility = Array.from({ length: n }, (_, i) => ({ seat: i, ratio: i === 1 ? ratio : 1 }));
    return dayById(dayChecks(s, size), "D3b").ok;
  };
  assert.equal(floorOk(4, 0.999), true);
  assert.equal(floorOk(4, 0.998), false);
  assert.equal(floorOk(5, 0.98), true);
  assert.equal(floorOk(5, 0.979), false);
  assert.equal(floorOk(6, 0.85), true);
  assert.equal(floorOk(6, 0.849), false);
  assert.equal(floorOk(7, 0.5), true);
  assert.equal(floorOk(7, 0.499), false);
  assert.equal(floorOk(8, 0.55), true);
  assert.equal(floorOk(8, 0.549), false);
  assert.equal(OVERLAP_EPS, 0.5);
  assert.equal(ONE_LINE_FACTOR, 1.6);
  assert.equal(FACE_RATIO, 0.45);
  assert.equal(TAP_MIN, 44);
  assert.equal(PANEL_H, 157);
});

test("APPROVED_RELAXATIONS: 승인된 완화는 M1·D3a/D3b·D4·5명판 D3b 98.0%·변론 후보 패널 236 뿐이고, 모두 이유와 승인 날짜가 있다", () => {
  assert.deepEqual(APPROVED_RELAXATIONS.map((r) => r.id), ["M1", "D3a/D3b", "D4", "D3b-5", "P-PANEL-236"]);
  for (const r of APPROVED_RELAXATIONS) {
    assert.ok(typeof r.reason === "string" && r.reason.trim().length > 0, JSON.stringify(r));
    assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(r.approved) || r.approved === "03.1 F7" || r.approved === "execution-v1/DC-defense-me", JSON.stringify(r));
  }
  const five = APPROVED_RELAXATIONS.find((r) => r.id === "D3b-5");
  assert.equal(five.approved, "2026-10-26");
  assert.match(five.reason, /98\.0/);
  const panel = APPROVED_RELAXATIONS.find((r) => r.id === "P-PANEL-236");
  assert.equal(panel.approved, "execution-v1/DC-defense-me");
  assert.match(panel.reason, /236/);
});

test("G7 smallTextIssues: 14px 미만 글자는 실패, 허용된 줄은 통과, 필드가 없으면 실패", () => {
  assert.equal(smallTextIssues([]).ok, true);
  assert.equal(smallTextIssues([{ desc: "span.x", size: 14 }]).ok, true);
  const bad = smallTextIssues([{ desc: "span.x", size: 12 }]);
  assert.equal(bad.ok, false);
  assert.match(bad.detail, /span\.x/);
  assert.equal(smallTextIssues([{ desc: "span.mf-journal__new", size: 12, allowed: true }]).ok, true);
  assert.equal(smallTextIssues(undefined).ok, false);
  const s = cleanSnap();
  s.smallText = [{ desc: "p.tiny", size: 12 }];
  assert.equal(byId(genericIssues(s, { w: 360, h: 640 }), "G7").ok, false);
  const s2 = cleanSnap();
  delete s2.smallText;
  assert.equal(byId(genericIssues(s2, { w: 360, h: 640 }), "G7").ok, false);
});

test("redact: 모든 곳을 가리고 빈 목록은 그대로", () => {
  assert.equal(redact("x SECRET y SECRET", ["SECRET"]), "x [가림] y [가림]");
  assert.equal(redact("x SECRET", []), "x SECRET");
});

const R = (scenario, size, id, label, ok, detail = "") => ({ scenario, size, id, label, ok, detail });

test("formatTables: 머리 줄·줄 형식·요약·실패", () => {
  const t = formatTables([
    R("lobby/lobby", "390x664", "L1", "[테스트] 버튼이 보임", true),
    R("lobby/lobby", "390x664", "L2", "[테스트]가 다른 조작과 안 겹침", false, "겹침"),
    R("police5/claim", "390x664", "D1", "위쪽 제목이 한 줄", false, "3줄"),
  ]);
  const head = "시나리오 | 크기 | 항목 | 결과 | 내용";
  assert.equal(t.table.split("\n")[0], head);
  assert.ok(t.table.includes("lobby/lobby | 390x664 | L1 [테스트] 버튼이 보임 | 통과 | \n") || t.table.includes("lobby/lobby | 390x664 | L1 [테스트] 버튼이 보임 | 통과 | "));
  assert.ok(t.table.includes("police5/claim | 390x664 | D1 위쪽 제목이 한 줄 | 실패 | 3줄"));
  assert.ok(t.summary.includes("lobby | 390x664 | 1/2"));
  assert.ok(t.summary.includes("police5 | 390x664 | 0/1"));
  const failLines = t.failures.split("\n");
  assert.equal(failLines[0], head);
  assert.equal(failLines.filter((l) => l.includes("| 통과 |")).length, 0);
  assert.equal(failLines.filter((l) => l.includes("| 실패 |")).length, 2);
});

test("exitCodeOf: 통과 0, 실패 1, 중단 2", () => {
  const ok = [R("a/b", "1x1", "S1", "x", true)];
  const bad = [...ok, R("a/b", "1x1", "S2", "y", false)];
  assert.equal(exitCodeOf(ok, false), 0);
  assert.equal(exitCodeOf(bad, false), 1);
  assert.equal(exitCodeOf(ok, true), 2);
  assert.equal(exitCodeOf(bad, true), 2);
});

// ---- 과제 2: 낮 장면·아침·테이블 검사 규칙 ----

test("기준 수치는 계획 그대로(1.6배·45%·157)", () => {
  assert.equal(ONE_LINE_FACTOR, 1.6);
  assert.equal(FACE_RATIO, 0.45);
  assert.equal(PANEL_H, 157);
});

test("isOneLine: 정확히 1.6배까지 한 줄", () => {
  assert.equal(isOneLine(28.8, 28.8), true);
  assert.equal(isOneLine(46.08, 28.8), true);
  assert.equal(isOneLine(46.2, 28.8), false);
  assert.equal(isOneLine(57.6, 28.8), false);
  assert.equal(isOneLine(86.4, 28.8), false);
});

test("lineCount: 높이를 줄 높이로 나눈 줄 수", () => {
  assert.equal(lineCount(57.6, 28.8), 2);
  assert.equal(lineCount(86.4, 28.8), 3);
});

test("faceRegion: 상자 위 45%", () => {
  const f = faceRegion(rect(0, 100, 72, 96));
  assert.equal(f.top, 100);
  assert.ok(Math.abs(f.bottom - 143.2) < 1e-9, String(f.bottom));
  assert.equal(f.left, 0);
  assert.equal(f.right, 72);
});

/** 이상 없는 낮 장면 고정물(360x640, 3명판). 이름표 z 1~3 < 캐릭터 z 12~14. */
const daySnap = () => ({
  vw: 360,
  vh: 640,
  docW: 360,
  docH: 640,
  bodyW: 360,
  h1: { rect: rect(16, 20, 200, 28.8), lineHeight: 28.8, text: "낮 · 토론" },
  extra: { rect: rect(220, 16, 130, 44), children: [rect(220, 16, 60, 44), rect(290, 16, 60, 44)] },
  header: rect(0, 0, 360, 100),
  scene: rect(0, 100, 360, 383),
  panel: { rect: rect(0, 483, 360, 157), text: "", children: [] },
  tt: { rect: rect(8, 108, 100, 44), hit: true },
  seats: [
    { seat: 0, rect: rect(150, 400, 72, 96), z: 14, isButton: false, sel: false, pressed: false, reachable: true, imgSrc: "/characters/figures/fig1.png", spotlit: false },
    { seat: 1, rect: rect(20, 200, 72, 96), z: 12, isButton: false, sel: false, pressed: false, reachable: true, imgSrc: "/characters/figures/fig2.png", spotlit: false },
    { seat: 2, rect: rect(270, 200, 72, 96), z: 12, isButton: false, sel: false, pressed: false, reachable: true, imgSrc: "/characters/figures/fig3.png", spotlit: false },
  ],
  tags: [
    { seat: 0, rect: rect(150, 440, 72, 22), z: 3, lines: 1, hasDot: true },
    { seat: 1, rect: rect(20, 300, 72, 22), z: 1, lines: 1, hasDot: true },
    { seat: 2, rect: rect(270, 300, 72, 22), z: 1, lines: 1, hasDot: true },
  ],
  tagVisibility: [
    { seat: 0, ratio: 1 },
    { seat: 1, ratio: 1 },
    { seat: 2, ratio: 1 },
  ],
});
const size = { w: 360, h: 640, mySeat: 0 };
const dayById = (list, id) => list.find((x) => x.id === id);

test("dayChecks: 이상 없는 고정물은 D1·D2·D3a·D3b·D4·D5·D6·D8 통과", () => {
  const list = dayChecks(daySnap(), size);
  assert.deepEqual(list.map((x) => x.id), ["D1", "D2", "D3a", "D3b", "D4", "D5", "D6", "D8"]);
  assert.ok(list.every((x) => x.ok), JSON.stringify(list.filter((x) => !x.ok)));
  assert.equal(dayById(list, "D3a").label, "이름표가 캐릭터 아래 층");
  assert.equal(dayById(list, "D3b").label, "이름표 보이는 비율");
  assert.equal(dayById(list, "D4").label, "[테스트]가 얼굴·이름표를 안 가리고 눌림");
  assert.equal(dayById(list, "D3"), undefined);
});

test("dayChecks D1: 제목 3줄이면 실패, 내용에 3줄", () => {
  const s = daySnap();
  s.h1.rect = rect(16, 20, 100, 86.4);
  const d1 = dayById(dayChecks(s, size), "D1");
  assert.equal(d1.ok, false);
  assert.match(d1.detail, /3줄/);
});

test("dayChecks D2: 이름표가 장면 밖으로 나가거나 패널과 겹치면 실패", () => {
  const s = daySnap();
  s.tags[1].rect = rect(20, 300, 342, 22); // right 362, 장면 right 360 보다 2 큼
  const d2 = dayById(dayChecks(s, size), "D2");
  assert.equal(d2.ok, false);
  assert.match(d2.detail, /1/);
  const s2 = daySnap();
  s2.tags[1].rect = rect(20, 470, 72, 22); // 패널(top 483)과 교차
  assert.equal(dayById(dayChecks(s2, size), "D2").ok, false);
});

test("dayChecks D3a: 이름표 z 최댓값 < 캐릭터 z 최솟값이면 통과, 같거나 크거나 NaN 이면 실패", () => {
  const s = daySnap();
  s.tags[0].z = 11;
  s.seats[1].z = 12;
  assert.equal(dayById(dayChecks(s, size), "D3a").ok, true);
  s.tags[0].z = 12; // 같음
  const same = dayById(dayChecks(s, size), "D3a");
  assert.equal(same.ok, false);
  assert.match(same.detail, /12/);
  s.tags[0].z = 20; // 큼
  assert.equal(dayById(dayChecks(s, size), "D3a").ok, false);
  const n = daySnap();
  n.tags[1].z = Number.NaN;
  assert.equal(dayById(dayChecks(n, size), "D3a").ok, false);
});

test("dayChecks D3b: 인원별 바닥(4명 100%, 5명 98.0%, 6명 85%, 7명 50%, 8명 55%)", () => {
  const withN = (n, ratio, lowSeat = 1) => {
    const s = daySnap();
    s.tagVisibility = Array.from({ length: n }, (_, i) => ({ seat: i, ratio: i === lowSeat ? ratio : 1 }));
    return dayById(dayChecks(s, size), "D3b");
  };
  assert.equal(withN(4, 1).ok, true);
  assert.equal(withN(4, 0.99).ok, false);
  assert.equal(withN(5, 1).ok, true);
  // 5명판만 98.0% (2026-10-26 사용자 승인 완화, D3B_FLOOR_5_PLAYERS): 앞쪽 옆자리 유령 머리가 5글자 이름표를 약 0.4% 덮는다
  assert.equal(withN(5, 0.996).ok, true);
  assert.equal(withN(5, 0.98).ok, true);
  assert.equal(withN(5, 0.979).ok, false);
  assert.equal(withN(5, 0.95).ok, false);
  assert.equal(withN(6, 0.85).ok, true);
  assert.equal(withN(6, 0.84).ok, false);
  assert.equal(withN(7, 0.5).ok, true);
  assert.equal(withN(7, 0.49).ok, false);
  assert.equal(withN(8, 0.55).ok, true);
  assert.equal(withN(8, 0.54).ok, false);
  const low = withN(8, 0.4, 5);
  assert.match(low.detail, /5/);
  assert.match(low.detail, /0\.4|40/);
});

test("dayChecks D3b: 이미지 미로드(ratio null)는 조용히 통과하지 않고 실패", () => {
  const s = daySnap();
  s.tagVisibility[2].ratio = null;
  const d = dayById(dayChecks(s, size), "D3b");
  assert.equal(d.ok, false);
  assert.match(d.detail, /로드/);
  const s2 = daySnap();
  s2.tagVisibility = undefined;
  assert.equal(dayById(dayChecks(s2, size), "D3b").ok, false);
});

test("dayChecks D4: 세로 깊이 1.5·3.0 통과, 3.1 실패, 가로 겹침 0.5 이하면 깊이 무관", () => {
  const depth = (d) => {
    const s = daySnap();
    s.tt.rect = rect(20, 200 + d - 44, 100, 44); // 자리 1 상자 top 200 과 d 만큼 겹침
    return dayById(dayChecks(s, size), "D4");
  };
  assert.equal(depth(1.5).ok, true, depth(1.5).detail);
  assert.equal(depth(3).ok, true, depth(3).detail);
  const bad = depth(3.1);
  assert.equal(bad.ok, false);
  assert.match(bad.detail, /3\.1/);
  const s = daySnap();
  s.tt.rect = rect(91.7, 150, 100, 100); // 자리 1 과 가로 0.3 만 겹침, 세로로는 깊이 큼
  s.seats[1].rect = rect(20, 200, 72, 96);
  s.seats[2].rect = rect(270, 200, 72, 96);
  // 가로 91.7~191.7 와 자리 0(150~222, 400~) 의 가로는 겹치지만 세로는 안 겹침
  assert.equal(dayById(dayChecks(s, size), "D4").ok, true);
});

test("dayChecks D4: 얼굴 가운데 점이나 이름표를 가리면 실패", () => {
  const s = daySnap();
  // 자리 1 얼굴 영역 가운데 = (56, 200 + 96*0.45/2 = 221.6)
  s.tt.rect = rect(30, 180, 60, 60);
  const d = dayById(dayChecks(s, size), "D4");
  assert.equal(d.ok, false);
  const s2 = daySnap();
  s2.tt.rect = rect(10, 290, 100, 44); // 자리 1 이름표(20,300) 와 교차, 자리 상자(200~296)와 깊이 6 → 이름표 사유도 나와야
  s2.tags[1].rect = rect(20, 300, 72, 22);
  const d2 = dayById(dayChecks(s2, size), "D4");
  assert.equal(d2.ok, false);
  assert.match(d2.detail, /이름표/);
  const s3 = daySnap();
  s3.tt.rect = rect(10, 296, 100, 44); // 상자 아래에 닿음(깊이 0)이지만 이름표(300~322)와 겹침
  assert.equal(dayById(dayChecks(s3, size), "D4").ok, false);
});

test("dayChecks D4: 눌림(hit)이 false 거나 버튼이 없으면 실패", () => {
  const s = daySnap();
  s.tt.hit = false;
  assert.equal(dayById(dayChecks(s, size), "D4").ok, false);
  const s3 = daySnap();
  s3.tt = null;
  assert.equal(dayById(dayChecks(s3, size), "D4").ok, false);
});

test("dayChecks D5·D6·D8", () => {
  const s = daySnap();
  s.docH = 641;
  assert.equal(dayById(dayChecks(s, size), "D5").ok, false);
  const s2 = daySnap();
  s2.panel.rect = rect(0, 490, 360, 150);
  assert.equal(dayById(dayChecks(s2, size), "D6").ok, false);
  const s3 = daySnap();
  s3.panel.rect = rect(0, 482.7, 360, 157.3);
  assert.equal(dayById(dayChecks(s3, size), "D6").ok, true);
  const s4 = daySnap();
  s4.extra.children = [rect(200, 10, 60, 44), rect(270, 54, 60, 44)];
  assert.equal(dayById(dayChecks(s4, size), "D8").ok, false);
});

const morningSnap = () => {
  const s = daySnap();
  s.card = rect(54, 168, 252, 100);
  s.seats = [
    { ...daySnap().seats[0], rect: rect(150, 400, 72, 96) },
    { ...daySnap().seats[1], rect: rect(20, 330, 72, 96) },
    { ...daySnap().seats[2], rect: rect(270, 330, 72, 96) },
  ];
  s.tags = [
    { ...daySnap().tags[0], rect: rect(150, 496, 72, 22) },
    { ...daySnap().tags[1], rect: rect(20, 426, 72, 22) },
    { ...daySnap().tags[2], rect: rect(270, 426, 72, 22) },
  ];
  return s;
};

test("morningCardIssues M1: 위치·크기·뷰포트 안이고 패널/내 캐릭터/내 이름표와 안 겹치면 통과", () => {
  assert.equal(morningCardIssues(morningSnap(), size).ok, true);
});

test("morningCardIssues M1: 남의 얼굴과 겹쳐도 통과(승인된 완화, UI-SPEC F7)", () => {
  const s = morningSnap();
  s.seats[1].rect = rect(60, 150, 72, 96); // 카드(54~306, 168~268)가 자리 1 얼굴을 덮음
  assert.equal(morningCardIssues(s, size).ok, true);
});

test("morningCardIssues M1: 위치 어긋남은 각각 다른 사유로 실패", () => {
  const top = morningSnap();
  top.card = rect(54, 170, 252, 100);
  const t = morningCardIssues(top, size);
  assert.equal(t.ok, false);
  assert.match(t.detail, /168/);
  const cx = morningSnap();
  cx.card = rect(60, 168, 252, 100); // 가운데 어긋남 6
  const c = morningCardIssues(cx, size);
  assert.equal(c.ok, false);
  assert.match(c.detail, /가운데/);
  const wd = morningSnap();
  wd.card = rect(60, 168, 240, 100); // 가운데는 맞고 폭 240
  const w = morningCardIssues(wd, size);
  assert.equal(w.ok, false);
  assert.match(w.detail, /폭/);
  assert.notEqual(t.detail, c.detail);
  assert.notEqual(c.detail, w.detail);
});

test("morningCardIssues M1: 뷰포트 밖·패널·내 캐릭터·내 이름표와 겹치거나 카드가 없으면 실패", () => {
  const out = morningSnap();
  out.card = rect(54, 168, 252, 500); // 뷰포트 아래로 나감(패널과도 겹침)
  assert.equal(morningCardIssues(out, { ...size, h: 640 }).ok, false);
  const a = morningSnap();
  a.card = rect(54, 168, 252, 400); // 패널 top 483 은 안 넘지만 내 캐릭터(400~)와 겹침
  const ra = morningCardIssues(a, size);
  assert.equal(ra.ok, false);
  assert.match(ra.detail, /내 캐릭터|내 자리/);
  const b = morningSnap();
  b.seats[0].rect = rect(150, 520, 72, 96);
  b.card = rect(54, 168, 252, 330); // 패널 top 483 과 겹침
  assert.match(morningCardIssues(b, size).detail, /패널/);
  const c = morningSnap();
  c.seats[0].rect = rect(150, 540, 72, 96); // 캐릭터는 카드 밖
  c.tags[0].rect = rect(150, 250, 72, 22); // 내 이름표만 카드 안(카드 168~268)
  const rc = morningCardIssues(c, size);
  assert.equal(rc.ok, false);
  assert.match(rc.detail, /이름표/);
  const d = morningSnap();
  d.card = null;
  assert.equal(morningCardIssues(d, size).ok, false);
});

test("dimChecks M3: 장면 상자 + 좌우 여백과 같고 헤더·패널과 안 겹치고 pointer-events none 이면 통과", () => {
  const s = morningSnap();
  s.dim = { rect: rect(0, 100, 360, 383), z: 30, pointerEvents: "none" };
  const r = dimChecks(s, { w: 360 });
  assert.equal(r.id, "M3");
  assert.equal(r.ok, true, r.detail);
});

test("dimChecks M3: 없음·모양 다름·헤더/패널 침범·pointer-events·탈락자 z 역전은 실패", () => {
  const base = () => {
    const s = morningSnap();
    s.dim = { rect: rect(0, 100, 360, 383), z: 30, pointerEvents: "none" };
    return s;
  };
  const none = base();
  none.dim = null;
  assert.equal(dimChecks(none, { w: 360 }).ok, false);
  const narrow = base();
  narrow.dim.rect = rect(12, 100, 336, 383);
  assert.equal(dimChecks(narrow, { w: 360 }).ok, false);
  const tall = base();
  tall.dim.rect = rect(0, 80, 360, 403); // 헤더(0~100)를 침범
  assert.equal(dimChecks(tall, { w: 360 }).ok, false);
  const pe = base();
  pe.dim.pointerEvents = "auto";
  assert.equal(dimChecks(pe, { w: 360 }).ok, false);
  const spot = base();
  spot.seats[1].spotlit = true;
  spot.seats[1].z = 31;
  assert.equal(dimChecks(spot, { w: 360, expectSpotlit: true }).ok, true);
  spot.seats[1].z = 30; // 층과 같음
  const bad = dimChecks(spot, { w: 360, expectSpotlit: true });
  assert.equal(bad.ok, false);
  assert.match(bad.detail, /30/);
  const missing = base();
  assert.equal(dimChecks(missing, { w: 360, expectSpotlit: true }).ok, false); // 탈락자가 있어야 하는데 강조 자리 없음
});

test("morningGoneChecks M4: 카드·층이 모두 없으면 통과, 하나라도 있으면 실패", () => {
  const s = daySnap();
  s.card = null;
  s.dim = null;
  const ok = morningGoneChecks(s);
  assert.equal(ok.id, "M4");
  assert.equal(ok.ok, true);
  const a = daySnap();
  a.card = rect(54, 168, 252, 100);
  a.dim = null;
  assert.equal(morningGoneChecks(a).ok, false);
  const b = daySnap();
  b.card = null;
  b.dim = { rect: rect(0, 100, 360, 383), z: 30, pointerEvents: "none" };
  assert.equal(morningGoneChecks(b).ok, false);
});

test("tagsOverlap D9: 라벨이 인원을 말하지 않고, 겹치지 않으면 통과, 겹치면 자리 쌍을 말한다", () => {
  const ok = tagsOverlap([0, 1, 2, 3, 4, 5, 6, 7].map((i) => ({ seat: i, rect: rect(i * 40, 0, 36, 22) })));
  assert.equal(ok.ok, true);
  assert.equal(ok.label, "이름표끼리 안 겹침");
  assert.ok(!ok.label.includes("4명"));
  const bad = tagsOverlap([
    { seat: 0, rect: rect(0, 0, 72, 22) },
    { seat: 1, rect: rect(60, 10, 72, 22) },
  ]);
  assert.equal(bad.ok, false);
  assert.match(bad.detail, /0.*1/);
});

test("feltStable: 같으면 통과, 1px 옮겨지면 실패하고 상태 이름을 말한다", () => {
  const r = rect(10, 20, 300, 200);
  assert.equal(feltStable([{ state: "claim", rect: r }, { state: "discussion", rect: r }, { state: "night", rect: r }]).ok, true);
  const bad = feltStable([{ state: "claim", rect: r }, { state: "discussion", rect: rect(10, 21, 300, 200) }]);
  assert.equal(bad.ok, false);
  assert.match(bad.detail, /discussion/);
});

// ---- 테이블 기하 고정(T1·T2, 결정 0028) ----

test("T1·T2 상수: 양옆 간격 하한 4, 머리 높이 119.2 — 기존 기준 수치는 그대로", () => {
  assert.equal(SIDE_GAP_MIN, 4);
  assert.equal(HEADER_H, 119.2);
  assert.equal(OVERLAP_EPS, 0.5);
  assert.equal(ONE_LINE_FACTOR, 1.6);
  assert.equal(FACE_RATIO, 0.45);
  assert.equal(TAP_MIN, 44);
  assert.equal(PANEL_H, 157);
});

// 390×664: 장면 366 폭(여백 12) · 면 216×108 (left 87, top 270 = 헤더 119.2 + 150.8) · 8명판 양옆 자리
const stageOf = (over = {}) => ({
  scene: rect(0, 119.2, 390, 387.8),
  header: rect(0, 0, 390, 119.2),
  panel: rect(0, 507, 390, 157),
  felt: rect(87, 270, 216, 108),
  seats: [
    // 맨 왼쪽(4·8명판 양옆): 발 y = 면 중심 y − 6 = 318, 상자 오른쪽 끝 = 면 현 왼쪽 − 6.3
    { seat: 1, rect: rect(12, 222, 64.8, 86.4), spotlit: false },
    { seat: 2, rect: rect(313.2, 222, 64.8, 86.4), spotlit: false },
    { seat: 0, rect: rect(159, 412, 72, 96), spotlit: false },
  ],
  ...over,
});
const sideSeat = (right, y = 324) => ({ seat: 1, rect: rect(right - 64.8, y - 86.4, 64.8, 86.4), spotlit: false });

test("feltGapChecks T2: 발 줄이 면 세로 범위에 드는 양옆 캐릭터가 면 현과 4px 이상 떨어지면 통과", () => {
  // 면 중심 (195, 324), 발 줄 y=324 에서 현 왼쪽 = 87, 오른쪽 = 303. 왼쪽 캐릭터 상자 오른쪽 끝 80.7 → 간격 6.3
  const stage = stageOf({ seats: [sideSeat(80.7), { seat: 2, rect: rect(309.3, 324 - 86.4, 64.8, 86.4), spotlit: false }] });
  const r = feltGapChecks(stage);
  assert.equal(r.id, "T2");
  assert.match(r.label, /양옆 캐릭터가 테이블 면 바깥/);
  assert.equal(r.ok, true);
});

test("feltGapChecks T2: 간격 3.9 면 실패하고 자리와 간격이 내용 칸에 나온다", () => {
  const stage = stageOf({ seats: [sideSeat(83.1), { seat: 2, rect: rect(309.3, 324 - 86.4, 64.8, 86.4), spotlit: false }] });
  const r = feltGapChecks(stage);
  assert.equal(r.ok, false);
  assert.match(r.detail, /자리 1/);
  assert.match(r.detail, /3\.9/);
});

test("feltGapChecks T2: 면과 겹치면(음수 간격) 실패하고, 발 줄이 면 세로 범위 밖인 자리는 건너뛴다", () => {
  const overlap = feltGapChecks(stageOf({ seats: [sideSeat(100)] }));
  assert.equal(overlap.ok, false);
  const outside = feltGapChecks(stageOf({ seats: [sideSeat(100, 200)] }));
  assert.equal(outside.ok, true);
  const back = feltGapChecks(stageOf({ seats: [{ seat: 3, rect: rect(160, 158, 57.6, 76.8), spotlit: false }] }));
  assert.equal(back.ok, true);
});

test("feltGapChecks T2: 면 높이 방향 끝 가까운 발 줄은 현이 짧아진다(타원)", () => {
  // 발 y = 면 아래 끝 근처(y=376): 현 반폭이 108 보다 훨씬 작아 80.7 에 있는 상자와의 간격이 커진다
  const r = feltGapChecks(stageOf({ seats: [sideSeat(80.7, 376)] }));
  assert.equal(r.ok, true);
});

test("feltGapChecks T2: stage.felt 또는 stage.seats 가 없으면 조용히 통과하지 않고 실패한다", () => {
  assert.equal(feltGapChecks(stageOf({ felt: null })).ok, false);
  assert.equal(feltGapChecks(stageOf({ seats: undefined })).ok, false);
  assert.equal(feltGapChecks(stageOf({ seats: [] })).ok, false);
  assert.equal(feltGapChecks(null).ok, false);
  assert.match(feltGapChecks(stageOf({ felt: null })).detail, /측정값 없음/);
});

const entry = (state, over = {}, mySeat = 0) => ({ state, stage: stageOf(over), mySeat });

test("stageStable T1: 상태가 달라도 장면 상자·면·내 캐릭터가 ±0.5 같고 머리 119.2·패널 157·패널 위 = 장면 아래면 통과", () => {
  const r = stageStable([entry("claim"), entry("night"), entry("morning")]);
  assert.equal(r.id, "T1");
  assert.match(r.label, /단계가 바뀌어도 장면 상자·테이블·내 캐릭터·패널이 그대로/);
  assert.equal(r.ok, true);
  const near = stageStable([entry("claim"), entry("night", { felt: rect(87.4, 270.4, 216, 108) })]);
  assert.equal(near.ok, true);
});

test("stageStable T1: 1px 다르면 실패하고 상태 이름을 말한다", () => {
  const scene = stageStable([entry("claim"), entry("night", { scene: rect(0, 119.2, 390, 386.8) })]);
  assert.equal(scene.ok, false);
  assert.match(scene.detail, /night/);
  const felt = stageStable([entry("claim"), entry("morning", { felt: rect(87, 271, 216, 108) })]);
  assert.equal(felt.ok, false);
  assert.match(felt.detail, /morning/);
  const me = stageStable([entry("claim"), entry("night", { seats: [{ seat: 0, rect: rect(159, 413, 72, 96), spotlit: false }] })]);
  assert.equal(me.ok, false);
  assert.match(me.detail, /night/);
});

test("stageStable T1: 머리 높이 ≠ 119.2, 패널 높이 ≠ 157, 패널 위 ≠ 장면 아래면 실패한다", () => {
  assert.equal(stageStable([entry("claim", { header: rect(0, 0, 390, 100) })]).ok, false);
  assert.equal(stageStable([entry("claim", { panel: rect(0, 507, 390, 150) })]).ok, false);
  assert.equal(stageStable([entry("claim", { panel: rect(0, 520, 390, 157) })]).ok, false);
  assert.equal(stageStable([entry("claim", { header: null })]).ok, false);
});

test("stageStable T1: 내 자리가 spotlit 이면 내 캐릭터 비교만 건너뛰고, 항목이 비면 실패한다", () => {
  const spot = stageStable([
    entry("night"),
    entry("morning", { seats: [{ seat: 0, rect: rect(100, 300, 72, 96), spotlit: true }] }),
  ]);
  assert.equal(spot.ok, true);
  assert.equal(stageStable([]).ok, false);
});

// ---- L6 대기실 자리 모양 (결정 0028) ----
// 390폭 장면: 내 발 (183+12, 460) 아래 가운데. 발 = 상자 아래 가운데.
const footSeat = (seat, x, y) => ({ seat, rect: rect(x - 36, y - 96, 72, 96), spotlit: false });

test("lobbyShapeChecks L6: 둘이면 마주 본다 — 상대의 발 가로 중심이 내 발과 ±0.5 같고 80px 이상 위면 통과", () => {
  const stage = stageOf({ seats: [footSeat(0, 195, 508), footSeat(1, 195.3, 308)] });
  const r = lobbyShapeChecks(stage, { n: 2, mySeat: 0 });
  assert.equal(r.id, "L6");
  assert.match(r.label, /대기실 자리: 둘이면 마주 봄·셋이면 삼각/);
  assert.equal(r.ok, true, r.detail);
});

test("lobbyShapeChecks L6: 둘인데 가로가 어긋나거나(1px) 세로로 80px 미만이면 실패하고 이유를 말한다", () => {
  const side = lobbyShapeChecks(stageOf({ seats: [footSeat(0, 195, 508), footSeat(1, 196.5, 308)] }), { n: 2, mySeat: 0 });
  assert.equal(side.ok, false);
  assert.match(side.detail, /가로/);
  const near = lobbyShapeChecks(stageOf({ seats: [footSeat(0, 195, 508), footSeat(1, 195, 440)] }), { n: 2, mySeat: 0 });
  assert.equal(near.ok, false);
  assert.match(near.detail, /80/);
});

test("lobbyShapeChecks L6: 셋이면 세 발이 삼각이다 — 외적 > 100 이고 쌍별 거리 > 60", () => {
  const ok = lobbyShapeChecks(stageOf({ seats: [footSeat(0, 195, 508), footSeat(1, 110, 380), footSeat(2, 280, 380)] }), { n: 3, mySeat: 0 });
  assert.equal(ok.ok, true, ok.detail);
  const line = lobbyShapeChecks(stageOf({ seats: [footSeat(0, 195, 508), footSeat(1, 195, 420), footSeat(2, 195, 330)] }), { n: 3, mySeat: 0 });
  assert.equal(line.ok, false);
  assert.match(line.detail, /직선|삼각/);
  const close = lobbyShapeChecks(stageOf({ seats: [footSeat(0, 195, 508), footSeat(1, 110, 380), footSeat(2, 130, 380)] }), { n: 3, mySeat: 0 });
  assert.equal(close.ok, false);
});

test("lobbyShapeChecks L6: 1명이거나 4명 이상이면 건너뛰고 통과한다", () => {
  assert.equal(lobbyShapeChecks(stageOf(), { n: 1, mySeat: 0 }).ok, true);
  assert.equal(lobbyShapeChecks(stageOf(), { n: 5, mySeat: 0 }).ok, true);
  assert.equal(lobbyShapeChecks(null, { n: 4, mySeat: 0 }).ok, true);
});

test("lobbyShapeChecks L6: 둘·셋인데 측정값이 없거나 자리 수가 안 맞으면 조용히 통과하지 않고 실패한다", () => {
  assert.equal(lobbyShapeChecks(null, { n: 2, mySeat: 0 }).ok, false);
  assert.equal(lobbyShapeChecks(stageOf({ seats: [footSeat(0, 195, 508)] }), { n: 2, mySeat: 0 }).ok, false);
  assert.equal(lobbyShapeChecks(stageOf({ seats: [footSeat(1, 195, 308), footSeat(2, 195, 308)] }), { n: 2, mySeat: 0 }).ok, false);
  assert.match(lobbyShapeChecks(null, { n: 3, mySeat: 0 }).detail, /측정값 없음/);
});

// ---- 차례(K1·K2)·주장 채팅(K3)·기록 카드(X1) ----

const turnPanel = (over = {}) => ({ rect: rect(0, 483, 360, 157), text: "", stRow: false, emojiBtn: false, quickBtn: false, chips: [], ...over });

const FILTER_WHITE = "drop-shadow(rgba(241, 242, 245, 0.95) 0px 0px 2px) drop-shadow(rgba(241, 242, 245, 0.75) 0px 0px 9px)";
const FILTER_CRIMSON = "drop-shadow(rgba(224, 52, 75, 0.95) 0px 0px 2px) drop-shadow(rgba(224, 52, 75, 0.7) 0px 0px 9px)";
const goodTurn = (over = {}) => ({ bubbleTurnSeats: [3], haloWhiteSeats: [3], legacyCircles: 0, tagInverted: 0, legacyRows: 0, ...over });
const goodHalo = () => ({
  items: [
    { seat: 3, cls: "white", filter: FILTER_WHITE, seatContext: true, onImg: true },
    { seat: 5, cls: "crimson", filter: FILTER_CRIMSON, seatContext: true, onImg: true },
  ],
  max: 2,
});
const turnSnap = ({ turn = goodTurn(), halo = goodHalo(), panel = turnPanel({ stRow: true, emojiBtn: true }) } = {}) => {
  const s = daySnap();
  s.panel = panel;
  s.turn = turn;
  s.halo = halo;
  return s;
};

test("turnChecks K1: 차례 말풍선이 정확히 한 자리, 흰 후광이 같은 자리 하나, 발밑 원·이름표 반전·이름표 아랫줄 0 이면 통과", () => {
  const list = turnChecks(turnSnap(), { myTurn: false, jobs: ["마피아", "경찰"] });
  assert.equal(dayById(list, "K1").ok, true, dayById(list, "K1").detail);
  const cases = [
    ["말풍선 없음", { bubbleTurnSeats: [] }, /말풍선/],
    ["말풍선 둘", { bubbleTurnSeats: [3, 4] }, /말풍선/],
    ["흰 후광 없음", { haloWhiteSeats: [] }, /흰 후광/],
    ["흰 후광이 다른 자리", { haloWhiteSeats: [4] }, /같은 자리|다름/],
    ["발밑 원 남음", { legacyCircles: 1 }, /발밑 원/],
    ["이름표 반전 남음", { tagInverted: 1 }, /반전/],
    ["이름표 아랫줄 남음", { legacyRows: 1 }, /아랫줄/],
  ];
  for (const [name, over, re] of cases) {
    const k1 = dayById(turnChecks(turnSnap({ turn: goodTurn(over) }), { myTurn: false }), "K1");
    assert.equal(k1.ok, false, name);
    assert.match(k1.detail, re, name);
  }
});

test("turnChecks K1: 차례 없는 단계(expectNone)는 차례 말풍선 0 이어야 통과하고, 토론 빠른 메시지 말풍선(--spoke)은 세지 않는다", () => {
  const s = turnSnap({ turn: goodTurn({ bubbleTurnSeats: [], haloWhiteSeats: [] }) });
  const list = turnChecks(s, { expectNone: true });
  assert.deepEqual(list.map((x) => x.id), ["K1", "K4"]);
  assert.equal(dayById(list, "K1").ok, true, dayById(list, "K1").detail);
  // 밤에 내가 고른 대상의 흰 후광은 차례가 아니므로 expectNone 을 실패시키지 않는다
  s.turn.haloWhiteSeats = [2];
  assert.equal(dayById(turnChecks(s, { expectNone: true }), "K1").ok, true);
  // 차례 말풍선이 있으면 실패
  s.turn.bubbleTurnSeats = [1];
  assert.equal(dayById(turnChecks(s, { expectNone: true }), "K1").ok, false);
});

test("turnChecks: K1 과 K4 는 항상, myTurn 이 불리언이면 K2 도 돌려준다", () => {
  assert.deepEqual(turnChecks(turnSnap(), { myTurn: false, jobs: [] }).map((x) => x.id), ["K1", "K4", "K2"]);
  assert.deepEqual(turnChecks(turnSnap(), {}).map((x) => x.id), ["K1", "K4"]);
  assert.deepEqual(turnChecks(turnSnap(), { expectNone: true }).map((x) => x.id), ["K1", "K4"]);
});

// ---- K4 후광은 윤곽을 따르는 filter 이고 발밑 원이 없음 (결정 0030) ----

test("turnChecks K4: 후광 img 에 두 겹 drop-shadow(9px 포함)·자리 쌓임 맥락이 있고 발밑 원이 없으며 3개 이하면 통과", () => {
  const k4 = dayById(turnChecks(turnSnap(), { myTurn: false }), "K4");
  assert.equal(k4.ok, true, k4.detail);
  // 후광이 하나도 없는 상태(차례 없음, 선택 없음)도 통과
  const none = dayById(turnChecks(turnSnap({ turn: goodTurn({ bubbleTurnSeats: [], haloWhiteSeats: [] }), halo: { items: [], max: 0 } }), { expectNone: true }), "K4");
  assert.equal(none.ok, true, none.detail);
  // 끊긴 자리: grayscale 뒤에 후광이 붙어도 통과
  const gray = goodHalo();
  gray.items[0].filter = `grayscale(1) ${FILTER_WHITE}`;
  assert.equal(dayById(turnChecks(turnSnap({ halo: gray }), { myTurn: false }), "K4").ok, true);
});

test("turnChecks K4: 어긋남마다 실패하고 이유를 말한다", () => {
  const four = goodHalo();
  four.items = [3, 5, 6, 7].map((seat) => ({ seat, cls: seat === 3 ? "white" : "crimson", filter: FILTER_CRIMSON, seatContext: true, onImg: true }));
  four.max = 4;
  const cases = [
    ["후광 img 4개", { halo: four }, /3/],
    ["drop-shadow 한 겹뿐", (h) => { h.items[0].filter = "drop-shadow(rgba(241, 242, 245, 0.75) 0px 0px 9px)"; }, /drop-shadow/],
    ["9px 없음", (h) => { h.items[0].filter = "drop-shadow(rgba(241, 242, 245, 0.95) 0px 0px 2px) drop-shadow(rgba(241, 242, 245, 0.75) 0px 0px 4px)"; }, /9px/],
    ["filter 없음", (h) => { h.items[1].filter = "none"; }, /drop-shadow/],
    ["후광 클래스가 img 가 아님", (h) => { h.items[0].onImg = false; }, /img/],
    ["자리가 쌓임 맥락이 아님", (h) => { h.items[1].seatContext = false; }, /쌓임/],
  ];
  for (const [name, change, re] of cases) {
    let halo = goodHalo();
    if (typeof change === "function") change(halo);
    else halo = change.halo;
    const k4 = dayById(turnChecks(turnSnap({ halo }), { myTurn: false }), "K4");
    assert.equal(k4.ok, false, name);
    assert.match(k4.detail, re, name);
  }
  // 발밑 원 요소가 남아 있음
  const k4c = dayById(turnChecks(turnSnap({ turn: goodTurn({ legacyCircles: 2 }) }), { myTurn: false }), "K4");
  assert.equal(k4c.ok, false);
  assert.match(k4c.detail, /발밑 원/);
  // claim 인데 흰 후광이 말풍선 자리와 다름
  const k4d = dayById(turnChecks(turnSnap({ turn: goodTurn({ bubbleTurnSeats: [5] }) }), { myTurn: false }), "K4");
  assert.equal(k4d.ok, false);
  assert.match(k4d.detail, /말풍선/);
  // 측정값 없음은 조용히 통과하지 않는다
  for (const halo of [null, undefined]) {
    const snap = turnSnap();
    snap.halo = halo; // turnSnap 의 기본값 대신 null/undefined 를 그대로 넣는다
    const k4 = dayById(turnChecks(snap, { myTurn: false }), "K4");
    assert.equal(k4.ok, false);
    assert.match(k4.detail, /측정값 없음/);
  }
});

test("turnChecks K4: 차례가 없는 단계(expectNone)에서는 말풍선과 흰 후광의 자리 일치를 따지지 않는다(밤 선택 후광)", () => {
  const s = turnSnap({ turn: goodTurn({ bubbleTurnSeats: [], haloWhiteSeats: [3] }) });
  assert.equal(dayById(turnChecks(s, { expectNone: true }), "K4").ok, true);
});

// ---- W1 방장 왕관은 대기실만 (결정 0030) ----

test("crownChecks W1: expect 1 이면 왕관 1개 통과·0개 실패, expect 0 이면 0개 통과·1개 실패, 측정값 없으면 실패", () => {
  const r = crownChecks({ crowns: 1 }, { expect: 1 });
  assert.equal(r.id, "W1");
  assert.equal(r.ok, true, r.detail);
  assert.equal(crownChecks({ crowns: 0 }, { expect: 1 }).ok, false);
  assert.equal(crownChecks({ crowns: 2 }, { expect: 1 }).ok, false);
  assert.equal(crownChecks({ crowns: 0 }, { expect: 0 }).ok, true);
  assert.equal(crownChecks({ crowns: 1 }, { expect: 0 }).ok, false);
  for (const snap of [{}, { crowns: undefined }, { crowns: null }, null]) {
    const m = crownChecks(snap, { expect: 0 });
    assert.equal(m.ok, false);
    assert.match(m.detail, /측정값 없음/);
  }
});

// ---- N6 밤 시작 문구 (결정 0028 → 0030: 낮·밤 한 부품 SceneIntro) ----
test("sceneIntroChecks N6: `N일차`+`밤이 되었습니다`, 톤 night, pointer-events none, aria-hidden 이면 통과하고 어긋남마다 실패한다", () => {
  const good = { texts: ["1일차", "밤이 되었습니다"], kind: "night", pointerEvents: "none", ariaHidden: true };
  const ok = sceneIntroChecks(good);
  assert.equal(ok.id, "N6");
  assert.equal(ok.ok, true, ok.detail);
  assert.equal(sceneIntroChecks(good, { kind: "night" }).ok, true);
  assert.equal(sceneIntroChecks({ ...good, texts: ["12일차", "밤이 되었습니다"] }).ok, true);
  for (const bad of [
    null,
    undefined,
    { ...good, texts: ["1일차", "낮이 되었습니다"] },
    { ...good, texts: ["밤이 되었습니다"] },
    { ...good, texts: ["일차", "밤이 되었습니다"] },
    { ...good, kind: "day" },
    { ...good, pointerEvents: "auto" },
    { ...good, ariaHidden: false },
  ]) {
    assert.equal(sceneIntroChecks(bad).ok, false, JSON.stringify(bad));
  }
  assert.match(sceneIntroChecks(null).detail, /없음/);
  assert.match(sceneIntroChecks(null).detail, /\.mf-sceneintro/);
});

test("turnChecks K2: 내 차례는 이번 판 직업 + 말 안 함 칩 · stRow/이모티콘 없음 · 높이 157", () => {
  const s = daySnap();
  s.turn = goodTurn();
  s.halo = goodHalo();
  s.panel = turnPanel({ chips: ["마피아", "경찰", "시민", "말 안 함"] });
  const ok = dayById(turnChecks(s, { myTurn: true, jobs: ["마피아", "경찰", "시민"] }), "K2");
  assert.equal(ok.ok, true, ok.detail);
  s.panel = turnPanel({ chips: ["경찰", "마피아", "시민", "말 안 함"] }); // 순서 다름
  assert.equal(dayById(turnChecks(s, { myTurn: true, jobs: ["마피아", "경찰", "시민"] }), "K2").ok, false);
  s.panel = turnPanel({ chips: ["마피아", "경찰", "시민", "말 안 함"], stRow: true });
  assert.equal(dayById(turnChecks(s, { myTurn: true, jobs: ["마피아", "경찰", "시민"] }), "K2").ok, false);
  s.panel = turnPanel({ chips: ["마피아", "경찰", "시민", "말 안 함"], emojiBtn: true });
  assert.equal(dayById(turnChecks(s, { myTurn: true, jobs: ["마피아", "경찰", "시민"] }), "K2").ok, false);
  s.panel = turnPanel({ chips: ["마피아", "경찰", "시민", "말 안 함"], rect: rect(0, 490, 360, 150) });
  assert.equal(dayById(turnChecks(s, { myTurn: true, jobs: ["마피아", "경찰", "시민"] }), "K2").ok, false);
});

test("turnChecks K2: 남의 차례는 stRow·이모티콘 있고 빠른 메시지·칩 없음 · 높이 157", () => {
  const s = daySnap();
  s.turn = goodTurn();
  s.halo = goodHalo();
  s.panel = turnPanel({ stRow: true, emojiBtn: true });
  assert.equal(dayById(turnChecks(s, { myTurn: false, jobs: [] }), "K2").ok, true);
  for (const over of [{ stRow: false }, { emojiBtn: false }, { quickBtn: true }, { chips: ["경찰"] }, { rect: rect(0, 480, 360, 160) }]) {
    s.panel = turnPanel({ stRow: true, emojiBtn: true, ...over });
    assert.equal(dayById(turnChecks(s, { myTurn: false, jobs: [] }), "K2").ok, false, JSON.stringify(over));
  }
});

test("claimChatIssues K3: 주장 문장 또는 말하지 않았어요만, 대괄호 없음, 줄 수 = 살아 있는 인원", () => {
  const lines = ["저는 마피아예요", "저는 경찰이에요", "저는 의사예요", "저는 시민이에요", "말하지 않았어요"];
  const r = claimChatIssues(lines, { alive: 5 });
  assert.equal(r.id, "K3");
  assert.equal(r.ok, true, r.detail);
  assert.equal(claimChatIssues(["하하: 저는 경찰이에요", "저는 시민이에요"], { alive: 2 }).ok, true);
  assert.equal(claimChatIssues(["[경찰] 저는 경찰이에요"], { alive: 1 }).ok, false);
  assert.equal(claimChatIssues(["안녕하세요"], { alive: 1 }).ok, false);
  const few = claimChatIssues(lines.slice(0, 3), { alive: 5 });
  assert.equal(few.ok, false);
  assert.match(few.detail, /3.*5|5.*3/);
  assert.equal(claimChatIssues([...lines, "저는 시민이에요"], { alive: 5 }).ok, false);
});

test("inspectChecks X1: 낮에는 {닉네임} 기록 카드가 열리고 밤에는 아무것도 안 열린다", () => {
  const day = inspectChecks({ dialogs: [{ label: "하하 기록", title: "하하" }] }, { nick: "하하", night: false });
  assert.equal(day.id, "X1");
  assert.equal(day.ok, true, day.detail);
  assert.equal(inspectChecks({ dialogs: [] }, { nick: "하하", night: false }).ok, false);
  assert.equal(inspectChecks({ dialogs: [{ label: "하하 기록", title: "다른" }] }, { nick: "하하", night: false }).ok, false);
  assert.equal(inspectChecks({ dialogs: [{ label: "역할 카드", title: "하하" }] }, { nick: "하하", night: false }).ok, false);
  assert.equal(inspectChecks({ dialogs: [] }, { nick: "하하", night: true }).ok, true);
  assert.equal(inspectChecks({ dialogs: [{ label: "하하 기록", title: "하하" }] }, { nick: "하하", night: true }).ok, false);
});

// ---- 역할 카드(R1~R6) ----

const rcBtn = (over = {}) => ({ label: "역할 카드", rect: rect(250, 16, 90, 44), dotRect: null, hit: true, ...over });
const rcSnap = (over = {}) => ({ legacyRecordsBtn: false, roleCard: { button: rcBtn(), sheet: null, noticeTexts: [] }, ...over });

test("roleCardButtonChecks R1: 새 기록이면 label 에 새 기록 + 점 지름 12 이상, 없으면 점 없음", () => {
  const none = roleCardButtonChecks(rcSnap(), { job: "police", unread: false });
  assert.equal(none.id, "R1");
  assert.equal(none.ok, true, none.detail);
  const withDot = rcSnap();
  withDot.roleCard.button = rcBtn({ label: "역할 카드, 새 기록", dotRect: rect(330, 10, 12, 12) });
  assert.equal(roleCardButtonChecks(withDot, { job: "police", unread: true }).ok, true);
  const small = rcSnap();
  small.roleCard.button = rcBtn({ label: "역할 카드, 새 기록", dotRect: rect(330, 10, 10, 10) });
  assert.equal(roleCardButtonChecks(small, { job: "police", unread: true }).ok, false);
  assert.equal(roleCardButtonChecks(withDot, { job: "police", unread: false }).ok, false); // 점이 남음
  assert.equal(roleCardButtonChecks(rcSnap(), { job: "police", unread: true }).ok, false); // 점이 없음
});

test("roleCardButtonChecks R1: 시민도 버튼이 있고, 버튼이 없거나 수사 기록 버튼이 있으면 실패", () => {
  assert.equal(roleCardButtonChecks(rcSnap(), { job: "citizen", unread: false }).ok, true);
  const nobtn = rcSnap();
  nobtn.roleCard.button = null;
  assert.equal(roleCardButtonChecks(nobtn, { job: "doctor", unread: false }).ok, false);
  assert.equal(roleCardButtonChecks(rcSnap({ legacyRecordsBtn: true }), { job: "police", unread: false }).ok, false);
  const nullCard = rcSnap({ roleCard: null });
  assert.equal(roleCardButtonChecks(nullCard, { job: "police", unread: false }).ok, false);
});

const sheetOf = (over = {}) => ({
  tabs: [
    { text: "내 역할", selected: true, dotRect: null },
    { text: "활동 기록", selected: false, dotRect: null },
  ],
  journalName: null,
  rows: [],
  emptyText: null,
  hasBody: true,
  ...over,
});

test("roleCardTabChecks R2: 경찰·마피아·의사는 탭 둘, 안 읽음이면 활동 기록 탭 점 지름 10 이상", () => {
  const s = rcSnap();
  s.roleCard.sheet = sheetOf();
  const r = roleCardTabChecks(s, { job: "police", unread: false });
  assert.equal(r.id, "R2");
  assert.equal(r.ok, true, r.detail);
  const dot = rcSnap();
  dot.roleCard.sheet = sheetOf({
    tabs: [
      { text: "내 역할", selected: true, dotRect: null },
      { text: "활동 기록", selected: false, dotRect: rect(100, 4, 10, 10) },
    ],
  });
  assert.equal(roleCardTabChecks(dot, { job: "mafia", unread: true }).ok, true);
  assert.equal(roleCardTabChecks(dot, { job: "mafia", unread: false }).ok, false);
  assert.equal(roleCardTabChecks(s, { job: "mafia", unread: true }).ok, false);
  dot.roleCard.sheet.tabs[1].dotRect = rect(100, 4, 8, 8);
  assert.equal(roleCardTabChecks(dot, { job: "doctor", unread: true }).ok, false);
  const one = rcSnap();
  one.roleCard.sheet = sheetOf({ tabs: [{ text: "내 역할", selected: true, dotRect: null }] });
  assert.equal(roleCardTabChecks(one, { job: "police", unread: false }).ok, false);
  const nosheet = rcSnap();
  assert.equal(roleCardTabChecks(nosheet, { job: "police", unread: false }).ok, false);
});

test("roleCardTabChecks R5: 시민은 탭 줄 없음·점 없음·본문 존재", () => {
  const s = rcSnap();
  s.roleCard.sheet = sheetOf({ tabs: [] });
  const r = roleCardTabChecks(s, { job: "citizen", unread: false });
  assert.equal(r.id, "R5");
  assert.equal(r.ok, true, r.detail);
  s.roleCard.sheet = sheetOf();
  assert.equal(roleCardTabChecks(s, { job: "citizen", unread: false }).ok, false);
  s.roleCard.sheet = sheetOf({ tabs: [], hasBody: false });
  assert.equal(roleCardTabChecks(s, { job: "citizen", unread: false }).ok, false);
});

const journalView = (job, over = {}) => {
  const names = { police: "수사일지", mafia: "암살일지", doctor: "치료일지" };
  const results = { police: "마피아 아님", mafia: "사망", doctor: "보호" };
  const s = rcSnap();
  s.roleCard.sheet = sheetOf({
    tabs: [
      { text: "내 역할", selected: false, dotRect: null },
      { text: "활동 기록", selected: true, dotRect: null },
    ],
    journalName: names[job],
    rows: [{ day: "1일차 밤", who: "하하", result: results[job], hasNew: true }],
    ...over,
  });
  return s;
};

test("journalChecks R3: 역할별 일지 이름·N일차 밤·결과 단어·첫 줄 NEW, 점이 모두 사라짐", () => {
  for (const job of ["police", "mafia", "doctor"]) {
    const r = journalChecks(journalView(job), { job, mode: "viewing" });
    assert.equal(r.id, "R3");
    assert.equal(r.ok, true, `${job}: ${r.detail}`);
  }
  const wrongName = journalView("police", { journalName: "암살일지" });
  assert.equal(journalChecks(wrongName, { job: "police", mode: "viewing" }).ok, false);
  const wrongResult = journalView("mafia", { rows: [{ day: "1일차 밤", who: "하하", result: "보호", hasNew: true }] });
  assert.equal(journalChecks(wrongResult, { job: "mafia", mode: "viewing" }).ok, false);
  const wrongDay = journalView("doctor", { rows: [{ day: "1일차", who: "하하", result: "보호", hasNew: true }] });
  assert.equal(journalChecks(wrongDay, { job: "doctor", mode: "viewing" }).ok, false);
  const noNew = journalView("police", { rows: [{ day: "1일차 밤", who: "하하", result: "마피아", hasNew: false }] });
  assert.equal(journalChecks(noNew, { job: "police", mode: "viewing" }).ok, false);
  const btnDot = journalView("police");
  btnDot.roleCard.button = rcBtn({ label: "역할 카드, 새 기록", dotRect: rect(330, 10, 12, 12) });
  assert.equal(journalChecks(btnDot, { job: "police", mode: "viewing" }).ok, false);
  const tabDot = journalView("police");
  tabDot.roleCard.sheet.tabs[1].dotRect = rect(100, 4, 10, 10);
  assert.equal(journalChecks(tabDot, { job: "police", mode: "viewing" }).ok, false);
});

test("journalChecks R3: 줄이 없으면 역할별 빈 상태 문구여야 통과", () => {
  const ok = journalView("police", { rows: [], emptyText: "아직 조사한 사람이 없어요" });
  assert.equal(journalChecks(ok, { job: "police", mode: "viewing" }).ok, true);
  const mafia = journalView("mafia", { rows: [], emptyText: "아직 지목한 사람이 없어요" });
  assert.equal(journalChecks(mafia, { job: "mafia", mode: "viewing" }).ok, true);
  const doctor = journalView("doctor", { rows: [], emptyText: "아직 보호한 사람이 없어요" });
  assert.equal(journalChecks(doctor, { job: "doctor", mode: "viewing" }).ok, true);
  const wrong = journalView("police", { rows: [], emptyText: "아직 지목한 사람이 없어요" });
  assert.equal(journalChecks(wrong, { job: "police", mode: "viewing" }).ok, false);
});

test("journalChecks R4: 시트를 닫은 뒤 NEW 가 사라진다(시트 없음 또는 hasNew 모두 false)", () => {
  const closed = rcSnap();
  const r = journalChecks(closed, { job: "police", mode: "closed" });
  assert.equal(r.id, "R4");
  assert.equal(r.ok, true);
  const reopened = journalView("police", { rows: [{ day: "1일차 밤", who: "하하", result: "마피아", hasNew: false }] });
  assert.equal(journalChecks(reopened, { job: "police", mode: "closed" }).ok, true);
  assert.equal(journalChecks(journalView("police"), { job: "police", mode: "closed" }).ok, false);
});

test("noNightNoticeChecks R6: 밤 끝 알림이 화면에 없음 (noticeTexts 가 빈 배열이어야 통과)", () => {
  const ok = noNightNoticeChecks(rcSnap());
  assert.equal(ok.id, "R6");
  assert.equal(ok.ok, true, ok.detail);
  const shown = rcSnap();
  shown.roleCard.noticeTexts = ["수사일지가 추가됐어요 · 눌러서 보기"];
  const bad = noNightNoticeChecks(shown);
  assert.equal(bad.ok, false);
  assert.match(bad.detail, /수사일지가 추가됐어요 · 눌러서 보기/);
  // 측정값 필드가 없으면 조용히 통과시키지 않는다(G7 의 smallText 와 같은 방식)
  const missing = rcSnap();
  delete missing.roleCard.noticeTexts;
  const m = noNightNoticeChecks(missing);
  assert.equal(m.ok, false);
  assert.match(m.detail, /측정값 없음/);
  assert.equal(noNightNoticeChecks({ legacyRecordsBtn: false }).ok, false);
});

// ---- 관전자(V1)·살아 있는 사람(V2) ----

const specSeats = [
  { seat: 0, job: "citizen", alive: false }, // 나(탈락)
  { seat: 1, job: "mafia", alive: true },
  { seat: 2, job: "police", alive: true },
  { seat: 3, job: "citizen", alive: false },
];
const specSnap = () => {
  const s = daySnap();
  s.seats = [
    { ...s.seats[0], seat: 0, imgSrc: "/characters/ghost/ghost_default@2x.png" },
    { ...s.seats[1], seat: 1, imgSrc: "/characters/roles/mafia_default@2x.png" },
    { ...s.seats[2], seat: 2, imgSrc: "/characters/roles/police_default@2x.png" },
    { ...s.seats[2], seat: 3, imgSrc: "/characters/ghost/ghost_default@2x.png" },
  ];
  s.tags = [0, 1, 2, 3].map((seat) => ({ ...daySnap().tags[1], seat }));
  return s;
};

test("spectatorChecks V1: 살아 있는 다른 자리는 직업 그림, 탈락·내 자리는 유령, 이름표는 한 줄 + 점", () => {
  const r = spectatorChecks(specSnap(), { spectate: specSeats, mySeat: 0 });
  assert.equal(r.id, "V1");
  assert.equal(r.ok, true, r.detail);
  const wrongJob = specSnap();
  wrongJob.seats[1].imgSrc = "/characters/roles/doctor_default@2x.png";
  assert.equal(spectatorChecks(wrongJob, { spectate: specSeats, mySeat: 0 }).ok, false);
  const neutral = specSnap();
  neutral.seats[2].imgSrc = "/characters/figures/fig3.png";
  assert.equal(spectatorChecks(neutral, { spectate: specSeats, mySeat: 0 }).ok, false);
  const deadRole = specSnap();
  deadRole.seats[3].imgSrc = "/characters/roles/citizen_default@2x.png";
  assert.equal(spectatorChecks(deadRole, { spectate: specSeats, mySeat: 0 }).ok, false);
  const meRole = specSnap();
  meRole.seats[0].imgSrc = "/characters/roles/citizen_default@2x.png";
  assert.equal(spectatorChecks(meRole, { spectate: specSeats, mySeat: 0 }).ok, false);
  const twoLines = specSnap();
  twoLines.tags[2].lines = 2;
  assert.equal(spectatorChecks(twoLines, { spectate: specSeats, mySeat: 0 }).ok, false);
  const noDot = specSnap();
  noDot.tags[1].hasDot = false;
  assert.equal(spectatorChecks(noDot, { spectate: specSeats, mySeat: 0 }).ok, false);
});

test("livingRoleArtChecks V2: 테이블 안에 역할 그림 0 개, 시트·공개 화면에만 내 역할 하나", () => {
  const ok = livingRoleArtChecks(
    { roleImgs: [{ src: "/characters/roles/police_default@2x.png", inTable: false, inDialog: true, inReveal: false }] },
    { myJob: "police" },
  );
  assert.equal(ok.id, "V2");
  assert.equal(ok.ok, true, ok.detail);
  assert.equal(livingRoleArtChecks({ roleImgs: [] }, { myJob: "police" }).ok, true);
  const inTable = livingRoleArtChecks(
    { roleImgs: [{ src: "/characters/roles/mafia_default@2x.png", inTable: true, inDialog: false, inReveal: false }] },
    { myJob: "police" },
  );
  assert.equal(inTable.ok, false);
  const elsewhere = livingRoleArtChecks(
    { roleImgs: [{ src: "/characters/roles/police_default@2x.png", inTable: false, inDialog: false, inReveal: false }] },
    { myJob: "police" },
  );
  assert.equal(elsewhere.ok, false);
  const other = livingRoleArtChecks(
    { roleImgs: [{ src: "/characters/roles/mafia_default@2x.png", inTable: false, inDialog: true, inReveal: false }] },
    { myJob: "police" },
  );
  assert.equal(other.ok, false);
  const two = livingRoleArtChecks(
    {
      roleImgs: [
        { src: "/characters/roles/police_default@2x.png", inTable: false, inDialog: true, inReveal: false },
        { src: "/characters/roles/doctor_default@2x.png", inTable: false, inReveal: true, inDialog: false },
      ],
    },
    { myJob: "police" },
  );
  assert.equal(two.ok, false);
});

// ---- H1 헤더 글씨 대비 · B1 배경 장면 · N8 낮 시작 문구 (결정 0030, 사용자 지시 V-06) ----

const GRAY_50 = [241, 242, 245];
// 대비 비율 r 이 되는 배경 휘도 (L글자 + .05) / (L배경 + .05) = r
const bgFor = (ratio, color = GRAY_50) => (relLuminance(color) + 0.05) / ratio - 0.05;
const hItem = (name, ratio, color = GRAY_50) => ({ name, rect: rect(16, 16, 100, 30), color, bgLum: bgFor(ratio, color) });

test("H1 상수: 대비 하한 4.5, 배경 백분위수 0.95 — 낮추지 않는다", () => {
  assert.equal(HEADER_CONTRAST_MIN, 4.5);
  assert.equal(HEADER_BG_PERCENTILE, 0.95);
});

test("relLuminance: 흰색 1, 검정 0, gray-50(241,242,245) 약 0.889, 초록이 가장 밝다", () => {
  assert.equal(relLuminance([255, 255, 255]), 1);
  assert.equal(relLuminance([0, 0, 0]), 0);
  assert.ok(Math.abs(relLuminance(GRAY_50) - 0.889) < 0.002, String(relLuminance(GRAY_50)));
  assert.ok(relLuminance([0, 255, 0]) > relLuminance([255, 0, 0]));
  assert.ok(relLuminance([255, 0, 0]) > relLuminance([0, 0, 255]));
});

test("percentile: 정렬 후 95번째, 한 개면 그 값, 빈 목록은 NaN", () => {
  const v = Array.from({ length: 100 }, (_, i) => i + 1);
  assert.equal(percentile(v, 0.95), 95);
  assert.equal(percentile([...v].reverse(), 0.95), 95);
  assert.equal(percentile([0.3], 0.95), 0.3);
  assert.equal(percentile(v, 1), 100);
  assert.equal(percentile(v, 0), 1);
  assert.ok(Number.isNaN(percentile([], 0.95)));
});

test("rgbP95Luminance: 한 점만 밝은 픽셀(별·해)은 p95 를 흔들지 않고 전체가 밝으면 밝다", () => {
  // 픽셀 100개: 99개는 어둡고(14,19,38) 1개만 흰색 → p95 는 어두운 쪽
  const flat = [];
  for (let i = 0; i < 99; i += 1) flat.push(14, 19, 38);
  flat.push(255, 255, 255);
  assert.ok(rgbP95Luminance(flat) < 0.02, String(rgbP95Luminance(flat)));
  // 10 % 가 흰색이면 p95 는 흰색
  const flat2 = [];
  for (let i = 0; i < 90; i += 1) flat2.push(14, 19, 38);
  for (let i = 0; i < 10; i += 1) flat2.push(255, 255, 255);
  assert.equal(rgbP95Luminance(flat2), 1);
  assert.ok(Number.isNaN(rgbP95Luminance([])));
});

test("headerContrastChecks H1: 제목 7.0·타이머 5.2 는 통과", () => {
  const r = headerContrastChecks({ items: [hItem("제목", 7.0), hItem("타이머", 5.2)] }, { expectTimer: true });
  assert.equal(r.id, "H1");
  assert.equal(r.ok, true, r.detail);
});

test("headerContrastChecks H1: 정확히 4.5 는 통과, 4.49 는 실패", () => {
  assert.equal(headerContrastChecks({ items: [hItem("제목", 4.5001)] }, { expectTimer: false }).ok, true);
  assert.equal(headerContrastChecks({ items: [hItem("제목", 4.49)] }, { expectTimer: false }).ok, false);
});

test("headerContrastChecks H1: 타이머 3.9 는 실패하고 내용 칸에 요소 이름과 숫자가 나온다", () => {
  const r = headerContrastChecks({ items: [hItem("제목", 7.0), hItem("타이머", 3.9)] }, { expectTimer: true });
  assert.equal(r.ok, false);
  assert.match(r.detail, /타이머/);
  assert.match(r.detail, /3\.9/);
  assert.doesNotMatch(r.detail, /제목/);
});

test("headerContrastChecks H1: 계산된 글자색이 어두우면 같은 배경에서도 달라진다(글자색을 쓴다)", () => {
  const dark = [40, 40, 40];
  const bgLum = bgFor(7.0, GRAY_50);
  const r = headerContrastChecks({ items: [{ name: "제목", rect: rect(0, 0, 10, 10), color: dark, bgLum }] }, { expectTimer: false });
  assert.equal(r.ok, false);
});

test("headerContrastChecks H1: 측정값이 없으면 조용히 통과하지 않고 `측정값 없음`", () => {
  for (const m of [null, undefined, {}, { items: [] }, { items: null }]) {
    const r = headerContrastChecks(m, { expectTimer: false });
    assert.equal(r.ok, false, JSON.stringify(m));
    assert.match(r.detail, /측정값 없음/);
  }
});

test("headerContrastChecks H1: 배경 휘도가 숫자가 아니면(캡처 실패) 실패한다", () => {
  const bad = { name: "제목", rect: rect(0, 0, 10, 10), color: GRAY_50, bgLum: Number.NaN };
  const r = headerContrastChecks({ items: [bad] }, { expectTimer: false });
  assert.equal(r.ok, false);
  assert.match(r.detail, /측정값 없음|배경/);
});

test("headerContrastChecks H1: 타이머가 있어야 하는 상태에서 타이머 항목이 없으면 실패, 거짓이면 제목만 있어도 통과", () => {
  const onlyTitle = { items: [hItem("제목", 7.0)] };
  const a = headerContrastChecks(onlyTitle, { expectTimer: true });
  assert.equal(a.ok, false);
  assert.match(a.detail, /타이머/);
  assert.equal(headerContrastChecks(onlyTitle, { expectTimer: false }).ok, true);
});

test("headerContrastChecks H1: 제목 항목이 없어도 실패한다(대기실 코드·장면 제목이 반드시 있다)", () => {
  const r = headerContrastChecks({ items: [hItem("타이머", 6)] }, { expectTimer: true });
  assert.equal(r.ok, false);
  assert.match(r.detail, /제목/);
});

const layer = (scene, state = "current", image = `url("http://localhost:5173/backgrounds/bg_game_${scene}.webp")`) => ({ scene, state, image });

test("EXPECTED_SCENE: 단계 열네 개가 모두 장면 id 로 정해져 있다", () => {
  assert.deepEqual(Object.keys(EXPECTED_SCENE).sort(), [
    "assigning", "candidateVote", "candidateVoteReveal", "claim", "dayAnnounce", "defense", "discussion", "ended", "execVote", "execution", "lobby", "morning", "night", "roleReveal",
  ]);
  for (const p of ["execVote", "candidateVote", "candidateVoteReveal", "defense", "execution"]) assert.equal(EXPECTED_SCENE[p], "dusk", p);
  assert.equal(EXPECTED_SCENE.ended, "night");
  assert.equal(EXPECTED_SCENE.night, "night");
  assert.equal(EXPECTED_SCENE.morning, "morning");
  assert.equal(EXPECTED_SCENE.dayAnnounce, "day");
  assert.equal(EXPECTED_SCENE.claim, "day");
  assert.equal(EXPECTED_SCENE.discussion, "day");
  assert.equal(EXPECTED_SCENE.lobby, "lobby");
});

test("backdropSceneChecks B1: 한 층이 current 이고 기대 장면이며 webp 면 통과", () => {
  const r = backdropSceneChecks({ layers: [layer("night")] }, { phase: "night" });
  assert.equal(r.id, "B1");
  assert.equal(r.ok, true, r.detail);
  assert.equal(backdropSceneChecks({ layers: [layer("day")] }, { phase: "discussion" }).ok, true);
  assert.equal(backdropSceneChecks({ layers: [layer("lobby")] }, { phase: "lobby" }).ok, true);
});

test("backdropSceneChecks B1: 층이 둘, leaving 이 남음, 장면 다름, webp 아님, info 없음은 각각 실패", () => {
  const cases = [
    [{ layers: [layer("night", "leaving"), layer("night")] }, /층/],
    [{ layers: [layer("night", "leaving")] }, /current|leaving/],
    [{ layers: [layer("night", "entering")] }, /current|entering/],
    [{ layers: [layer("morning")] }, /morning/],
    [{ layers: [layer("night", "current", 'url("http://localhost:5173/backgrounds/bg_game_night.svg")')] }, /webp/],
    [{ layers: [layer("night", "current", "none")] }, /webp/],
    [{ layers: [] }, /층/],
    [null, /없음/],
    [undefined, /없음/],
  ];
  for (const [info, re] of cases) {
    const r = backdropSceneChecks(info, { phase: "night" });
    assert.equal(r.ok, false, JSON.stringify(info));
    assert.match(r.detail, re, JSON.stringify(info));
  }
});

test("backdropSceneChecks B1: 알 수 없는 단계는 실패한다", () => {
  assert.equal(backdropSceneChecks({ layers: [layer("night")] }, { phase: "voting" }).ok, false);
});

test("sceneIntroChecks N8: 낮 시작 문구 `N일차`+`낮이 되었습니다`+보조줄, 톤 day, pointer-events none, aria-hidden 이면 통과", () => {
  const good = { texts: ["2일차", "낮이 되었습니다", "토론 전에 먼저 직업을 공개해요"], kind: "day", pointerEvents: "none", ariaHidden: true };
  const r = sceneIntroChecks(good, { kind: "day" });
  assert.equal(r.id, "N8");
  assert.equal(r.ok, true, r.detail);
  assert.equal(sceneIntroChecks({ ...good, texts: ["13일차", ...good.texts.slice(1)] }, { kind: "day" }).ok, true);
  for (const bad of [
    null,
    undefined,
    { ...good, texts: ["2일차", "낮이 되었습니다"] },
    { ...good, texts: ["2일차", "밤이 되었습니다", good.texts[2]] },
    { ...good, texts: ["일차", "낮이 되었습니다", good.texts[2]] },
    { ...good, texts: ["2일차", "낮이 되었습니다", "다른 줄"] },
    { ...good, kind: "night" },
    { ...good, pointerEvents: "auto" },
    { ...good, ariaHidden: false },
  ]) {
    assert.equal(sceneIntroChecks(bad, { kind: "day" }).ok, false, JSON.stringify(bad));
  }
  assert.match(sceneIntroChecks(null, { kind: "day" }).detail, /\.mf-sceneintro/);
  // 밤 규칙(N6)은 그대로: 낮 글자는 밤 검사를 통과하지 못한다
  assert.equal(sceneIntroChecks(good).ok, false);
});

// ---- 처형 구간 순수 검사 P1·P9·P2·P3 (04-29, UI-SPEC 15.3). 입력은 lib.mjs 머리의 `처형 구간 스냅숏 계약` 모양 ----

const goodVote = (over = {}) => ({
  bottom: {
    title: "오늘 처형을 할까요?",
    guide: "",
    tally: "찬성 2 · 반대 1 · 살아 있는 5명",
    pill: null,
    buttons: [
      { text: "찬성", pressed: true, disabled: false, w: 160, h: 52 },
      { text: "반대", pressed: false, disabled: false, w: 160, h: 52 },
    ],
    height: 157,
  },
  dt: { textHits: 0, haloImgs: [], seatButtons: [], scene: { left: 0, top: 119, right: 360, bottom: 483, width: 360 } },
  ...over,
});
const withBottom = (patch) => {
  const v = goodVote();
  Object.assign(v.bottom, patch);
  return v;
};

test("voteChecks P1: 제목·집계 줄·찬성/반대 둘(≥44, aria-pressed)·익명(글자·후광 0)이면 통과한다", () => {
  const r = voteChecks(goodVote());
  assert.equal(r.id, "P1");
  assert.equal(r.ok, true, r.detail);
  // 아직 아무것도 안 고른 상태(둘 다 false)도 통과
  const none = withBottom({ buttons: goodVote().bottom.buttons.map((b) => ({ ...b, pressed: false })) });
  assert.equal(voteChecks(none).ok, true);
});

test("voteChecks P1: 어긋남마다 실패하고 이유를 말한다", () => {
  const b = goodVote().bottom.buttons;
  const cases = [
    ["익명 깨짐: 이름표·캐릭터에 찬성/반대 글자", (() => { const v = goodVote(); v.dt.textHits = 1; return v; })(), /익명|글자/],
    ["익명 깨짐: 후광 하나", (() => { const v = goodVote(); v.dt.haloImgs = [{ seat: 2, kind: "white" }]; return v; })(), /후광/],
    ["버튼 하나 부족", withBottom({ buttons: [b[0]] }), /버튼/],
    ["버튼 높이 40", withBottom({ buttons: [{ ...b[0], h: 40 }, b[1]] }), /44/],
    ["버튼 너비 40", withBottom({ buttons: [b[0], { ...b[1], w: 40 }] }), /44/],
    ["기권 버튼", withBottom({ buttons: [...b, { text: "기권", pressed: false, disabled: false, w: 100, h: 52 }] }), /기권|버튼/],
    ["aria-pressed 가 불리언이 아님", withBottom({ buttons: [{ ...b[0], pressed: null }, b[1]] }), /aria-pressed|pressed/],
    ["제목이 다름", withBottom({ title: "누구를 처형할까요?" }), /제목/],
    ["집계 줄 모양이 다름", withBottom({ tally: "찬성 2" }), /집계/],
  ];
  for (const [name, v, re] of cases) {
    const r = voteChecks(v);
    assert.equal(r.ok, false, name);
    assert.match(r.detail, re, name);
  }
});

test("voteChecks P1: 필드가 없으면 측정값 없음으로 실패한다", () => {
  for (const v of [null, undefined, {}, { bottom: goodVote().bottom }, { dt: goodVote().dt }]) {
    const r = voteChecks(v);
    assert.equal(r.ok, false, JSON.stringify(v));
    assert.match(r.detail, /측정값 없음/);
  }
  const v = goodVote();
  delete v.dt.textHits;
  assert.match(voteChecks(v).detail, /측정값 없음\(.*textHits/);
});

test("voteChecks P9: 탈락 viewer 는 버튼 0·알약 `관전 중`·집계 줄은 그대로 보인다", () => {
  const spec = withBottom({ buttons: [], pill: "관전 중 · 볼 수만 있어요" });
  const r = voteChecks(spec, { spectator: true });
  assert.equal(r.id, "P9");
  assert.equal(r.ok, true, r.detail);
  const cases = [
    ["관전자에 버튼 있음", withBottom({ buttons: goodVote().bottom.buttons, pill: "관전 중 · 볼 수만 있어요" }), /버튼/],
    ["알약 없음", withBottom({ buttons: [], pill: null }), /관전 중/],
    ["알약 문구 다름", withBottom({ buttons: [], pill: "투표했어요" }), /관전 중/],
    ["집계 줄 사라짐", withBottom({ buttons: [], pill: "관전 중 · 볼 수만 있어요", tally: "" }), /집계/],
  ];
  for (const [name, v, re] of cases) {
    const x = voteChecks(v, { spectator: true });
    assert.equal(x.ok, false, name);
    assert.match(x.detail, re, name);
  }
  // 살아 있는 viewer 기준으로는 관전 화면이 통과하지 못한다
  assert.equal(voteChecks(spec).ok, false);
});

const introSamples = (over = {}) => [
  { t: 100, intro: { count: 1, pointerEvents: "none", cardOpacity: 1, residueCount: 0 } },
  { t: 900, intro: { count: 1, pointerEvents: "none", cardOpacity: 1, residueCount: 0 } },
  { t: 1900, intro: { count: 0, pointerEvents: null, cardOpacity: null, residueCount: 0 } },
  ...(over.extra ?? []),
];

test("introChecks P2: 도착 직후 카드 1장·터치 통과, 1.8초 뒤 DOM 에서 사라져 잔상 0, 그 동안 클릭이 통과했으면 통과한다", () => {
  const r = introChecks(introSamples(), { clickedThrough: true });
  assert.equal(r.id, "P2");
  assert.equal(r.ok, true, r.detail);
});

test("introChecks P2: 어긋남마다 실패하고 이유를 말한다", () => {
  const s = introSamples();
  const mut = (i, patch) => s.map((x, k) => (k === i ? { ...x, intro: { ...x.intro, ...patch } } : x));
  const cases = [
    ["도착 직후 카드 없음", mut(0, { count: 0 }), true, /카드/],
    ["도착 직후 카드 둘", mut(0, { count: 2 }), true, /카드/],
    ["터치를 가로챔", mut(0, { pointerEvents: "auto" }), true, /pointer-events/],
    ["1.8초 뒤에도 남아 있음", mut(2, { count: 1, pointerEvents: "none" }), true, /1800|사라/],
    ["불투명 잔상", mut(2, { residueCount: 1 }), true, /잔상/],
    ["클릭이 통과하지 못함", s, false, /클릭/],
    ["1.8초 뒤 표본 없음", s.slice(0, 2), true, /측정값 없음/],
    ["표본 없음", [], true, /측정값 없음/],
  ];
  for (const [name, samples, clickedThrough, re] of cases) {
    const r = introChecks(samples, { clickedThrough });
    assert.equal(r.ok, false, name);
    assert.match(r.detail, re, name);
  }
  assert.match(introChecks(s, {}).detail, /측정값 없음\(.*clickedThrough/);
  assert.match(introChecks(null, { clickedThrough: true }).detail, /측정값 없음/);
});

const seatBtns = (over = {}) =>
  [0, 1, 2, 3, 4].map((seat) => ({
    seat,
    pickable: seat !== 0 && seat !== 4,
    pressed: false,
    label: `플레이어${seat}`,
    ...(over[seat] ?? {}),
  }));
const goodCand = ({ chosen = 2, halo, pill } = {}) => ({
  bottom: { title: "처형할 사람을 고르세요", guide: "", tally: "", pill: pill ?? (chosen === null ? "선택 안 함" : "플레이어2님에게 투표했어요"), buttons: [], height: 157 },
  dt: {
    textHits: 0,
    haloImgs: halo ?? (chosen === null ? [] : [{ seat: chosen, kind: "white" }]),
    seatButtons: seatBtns(chosen === null ? {} : { [chosen]: { pressed: true } }),
    scene: { left: 0, top: 119, right: 360, bottom: 483, width: 360 },
  },
});
const candOpts = { mySeat: 0, deadSeats: [4], chosenSeat: 2 };

test("candidateChecks P3: 내 자리·탈락 자리 비활성, 고른 자리 pressed+흰 후광 하나, 알약 `…님에게 투표했어요`면 통과한다", () => {
  const r = candidateChecks(goodCand(), candOpts);
  assert.equal(r.id, "P3");
  assert.equal(r.ok, true, r.detail);
  // 고르기 전: 선택 안 함, 후광 0
  const none = candidateChecks(goodCand({ chosen: null }), { ...candOpts, chosenSeat: null });
  assert.equal(none.ok, true, none.detail);
  // 동료 진홍 마름모 후광은 허용 목록에 있을 때만 통과
  const withMate = goodCand({ halo: [{ seat: 2, kind: "white" }, { seat: 3, kind: "crimson" }] });
  assert.equal(candidateChecks(withMate, { ...candOpts, crimsonSeats: [3] }).ok, true);
  assert.equal(candidateChecks(withMate, candOpts).ok, false);
});

test("candidateChecks P3: 어긋남마다 실패하고 이유를 말한다", () => {
  const cases = [
    ["내 자리가 pickable", (() => { const v = goodCand(); v.dt.seatButtons[0].pickable = true; return v; })(), candOpts, /내 자리/],
    ["탈락 자리가 pickable", (() => { const v = goodCand(); v.dt.seatButtons[4].pickable = true; return v; })(), candOpts, /탈락/],
    ["살아 있는 남의 자리가 pickable 아님", (() => { const v = goodCand(); v.dt.seatButtons[3].pickable = false; return v; })(), candOpts, /자리 3/],
    ["후광 둘", goodCand({ halo: [{ seat: 2, kind: "white" }, { seat: 3, kind: "white" }] }), candOpts, /흰 후광/],
    ["남의 자리에만 후광", goodCand({ halo: [{ seat: 3, kind: "white" }] }), candOpts, /후광/],
    ["후광 없음", goodCand({ halo: [] }), candOpts, /흰 후광/],
    ["앰버 후광", goodCand({ halo: [{ seat: 2, kind: "white" }, { seat: 3, kind: "amber" }] }), candOpts, /후광/],
    ["고른 자리 pressed 아님", (() => { const v = goodCand(); v.dt.seatButtons[2].pressed = false; return v; })(), candOpts, /pressed|aria-pressed/],
    ["다른 자리도 pressed", (() => { const v = goodCand(); v.dt.seatButtons[1].pressed = true; return v; })(), candOpts, /pressed|aria-pressed/],
    ["알약 문구 다름", goodCand({ pill: "선택 안 함" }), candOpts, /투표했어요/],
    ["고르기 전인데 알약이 선택 안 함이 아님", goodCand({ chosen: null, pill: "플레이어2님에게 투표했어요" }), { ...candOpts, chosenSeat: null }, /선택 안 함/],
    ["고르기 전인데 후광", goodCand({ chosen: null, halo: [{ seat: 2, kind: "white" }] }), { ...candOpts, chosenSeat: null }, /후광/],
  ];
  for (const [name, v, opts, re] of cases) {
    const r = candidateChecks(v, opts);
    assert.equal(r.ok, false, name);
    assert.match(r.detail, re, name);
  }
});

test("candidateChecks P3: 필드가 없으면 측정값 없음으로 실패한다", () => {
  for (const v of [null, {}, { bottom: goodCand().bottom }, { dt: { ...goodCand().dt, seatButtons: undefined }, bottom: goodCand().bottom }]) {
    const r = candidateChecks(v, candOpts);
    assert.equal(r.ok, false, JSON.stringify(v));
    assert.match(r.detail, /측정값 없음/);
  }
  assert.match(candidateChecks(goodCand(), { chosenSeat: 2 }).detail, /측정값 없음\(.*mySeat/);
});

// ---- P4 공개 연출 불변식과 후광·색 규칙 확장 (04-29, D-31·D-33) ----

const SCENE = { left: 0, top: 119, right: 360, bottom: 483, width: 360 };
const chip = (seat, n, over = {}) => ({ seat, n, tone: "pop", left: 100 + seat * 20, top: 200, right: 140 + seat * 20, bottom: 232, ...over });
const sample = (t, { arrows = 0, chips = [], halo = [], crimsonNew = 0 } = {}) => ({
  t,
  reveal: { arrows, chips, tags: [] },
  dt: { haloImgs: halo, scene: SCENE },
  crimsonNew,
});
const goodReveal = () => [
  sample(200, { arrows: 1 }),
  sample(700, { arrows: 1, chips: [chip(2, 1)], halo: [{ seat: 2, kind: "amber" }] }),
  sample(1300, { arrows: 0, chips: [chip(2, 2)], halo: [{ seat: 2, kind: "amber" }] }),
  sample(2000, { arrows: 0, chips: [chip(2, 2, { tone: "lead" }), chip(3, 1)], halo: [{ seat: 2, kind: "amber" }, { seat: 3, kind: "amber" }] }),
];
const revealOpts = { n: 3, size: { w: 360, h: 640 } };

test("revealChecks P4: 화살표 ≤ 1·칩 합 단조 증가해 최종 n·후광 합 ≤ 3·새 요소 진홍 0·칩이 장면 안이면 통과한다", () => {
  const r = revealChecks(goodReveal(), revealOpts);
  assert.equal(r.id, "P4");
  assert.equal(r.ok, true, r.detail);
  // 표가 하나도 없는 판(n=0): 칩 없음
  assert.equal(revealChecks([sample(200), sample(900)], { n: 0, size: revealOpts.size }).ok, true);
  // 앰버+흰+진홍 합이 정확히 3
  const three = goodReveal();
  three[3].dt.haloImgs = [{ seat: 2, kind: "amber" }, { seat: 3, kind: "white" }, { seat: 1, kind: "crimson" }];
  assert.equal(revealChecks(three, revealOpts).ok, true);
});

test("revealChecks P4: 어긋남마다 실패하고 이유를 말한다", () => {
  const mutate = (fn) => {
    const s = goodReveal();
    fn(s);
    return s;
  };
  const cases = [
    ["화살표 둘", mutate((s) => { s[1].reveal.arrows = 2; }), revealOpts, /화살표/],
    ["칩 합 감소", mutate((s) => { s[2].reveal.chips = [chip(2, 0)]; }), revealOpts, /줄어|감소/],
    ["최종 합 ≠ n", goodReveal(), { ...revealOpts, n: 4 }, /최종|n/],
    ["n=0 인데 칩", goodReveal(), { ...revealOpts, n: 0 }, /칩/],
    ["후광 4개", mutate((s) => { s[3].dt.haloImgs = [1, 2, 3, 4].map((seat) => ({ seat, kind: "amber" })); }), revealOpts, /후광/],
    ["새 요소 진홍", mutate((s) => { s[1].crimsonNew = 1; }), revealOpts, /진홍/],
    ["칩이 장면 오른쪽 밖", mutate((s) => { s[3].reveal.chips[1].right = 380; s[3].reveal.chips[1].left = 340; }), revealOpts, /장면|폭/],
    ["칩이 헤더를 침범", mutate((s) => { s[3].reveal.chips[0].top = 100; }), revealOpts, /헤더/],
    ["칩이 화면 폭 밖", mutate((s) => { s[3].reveal.chips[1].right = 361; }), { ...revealOpts, size: { w: 360, h: 640 } }, /폭|밖/],
    ["표본 시각이 오름차순이 아님", mutate((s) => { s.reverse(); }), revealOpts, /오름차순/],
  ];
  for (const [name, samples, opts, re] of cases) {
    const r = revealChecks(samples, opts);
    assert.equal(r.ok, false, name);
    assert.match(r.detail, re, name);
  }
});

test("revealChecks P4: 필드가 없으면 측정값 없음으로 실패한다", () => {
  for (const samples of [null, [], [{ t: 1 }], [{ t: 1, reveal: { arrows: 0, chips: [] } }], [sample(1)].map((x) => ({ ...x, crimsonNew: undefined }))]) {
    const r = revealChecks(samples, revealOpts);
    assert.equal(r.ok, false, JSON.stringify(samples));
    assert.match(r.detail, /측정값 없음/);
  }
  assert.match(revealChecks(goodReveal(), { size: revealOpts.size }).detail, /측정값 없음\(.*n/);
});

const FILTER_AMBER = "drop-shadow(rgba(242, 184, 75, 0.95) 0px 0px 2px) drop-shadow(rgba(242, 184, 75, 0.75) 0px 0px 9px)";
const amberHalo = () => ({
  items: [
    { seat: 2, cls: "amber", filter: FILTER_AMBER, seatContext: true, onImg: true },
    { seat: 3, cls: "white", filter: FILTER_WHITE, seatContext: true, onImg: true },
  ],
  max: 2,
});

test("haloChecks K4: 앰버 후광을 허용하되 drop-shadow 두 겹·9px 규칙은 같이 적용된다", () => {
  const r = haloChecks(amberHalo(), { circles: 0, expectNone: true });
  assert.equal(r.id, "K4");
  assert.equal(r.ok, true, r.detail);
  const one = amberHalo();
  one.items[0].filter = "drop-shadow(rgba(242, 184, 75, 0.75) 0px 0px 9px)";
  assert.match(haloChecks(one, { circles: 0, expectNone: true }).detail, /drop-shadow/);
  const four = amberHalo();
  four.items = [1, 2, 3, 4].map((seat) => ({ seat, cls: "amber", filter: FILTER_AMBER, seatContext: true, onImg: true }));
  four.max = 4;
  assert.match(haloChecks(four, { circles: 0, expectNone: true }).detail, /3/);
  // 모르는 후광 종류는 실패한다
  const weird = amberHalo();
  weird.items[0].cls = "green";
  assert.match(haloChecks(weird, { circles: 0, expectNone: true }).detail, /green/);
});

test("haloChecks K4: crimsonAllowed false 이면 진홍 후광이 하나라도 있을 때 실패한다(방장이 시민인 투표·처형, D-33)", () => {
  const withCrimson = goodHalo(); // 흰 + 진홍
  assert.equal(haloChecks(withCrimson, { circles: 0, expectNone: true }).ok, true, "기본값은 진홍 허용");
  assert.equal(haloChecks(withCrimson, { circles: 0, expectNone: true, crimsonAllowed: true }).ok, true);
  const r = haloChecks(withCrimson, { circles: 0, expectNone: true, crimsonAllowed: false });
  assert.equal(r.ok, false);
  assert.match(r.detail, /진홍/);
  assert.equal(haloChecks(amberHalo(), { circles: 0, expectNone: true, crimsonAllowed: false }).ok, true);
  // turnChecks 도 같은 인자를 K4 에 넘긴다
  const k4 = dayById(turnChecks(turnSnap(), { myTurn: false, crimsonAllowed: false }), "K4");
  assert.equal(k4.ok, false);
  assert.match(k4.detail, /진홍/);
});

test("colorRuleChecks P-COLOR: 새 요소 진홍 0, 방장이 시민이면 화면 전체 진홍도 0", () => {
  const crimsonColors = ["rgb(224, 52, 75)"];
  const r = colorRuleChecks({ crimsonNew: 0, crimsonScreen: 3 }, { crimsonColors, wholeScreenCrimson: false });
  assert.equal(r.id, "P-COLOR");
  assert.equal(r.ok, true, r.detail);
  assert.equal(colorRuleChecks({ crimsonNew: 0, crimsonScreen: 0 }, { crimsonColors, wholeScreenCrimson: true }).ok, true);
  const cases = [
    ["새 요소에 진홍", { crimsonNew: 1, crimsonScreen: 0 }, false, /새 요소/],
    ["시민 방장 화면에 진홍", { crimsonNew: 0, crimsonScreen: 1 }, true, /화면 전체/],
  ];
  for (const [name, v, whole, re] of cases) {
    const x = colorRuleChecks(v, { crimsonColors, wholeScreenCrimson: whole });
    assert.equal(x.ok, false, name);
    assert.match(x.detail, re, name);
  }
  // 색 목록이 있으면 토큰 진홍 값과 비교한다(공백·알파 차이는 같은 색)
  const byColor = colorRuleChecks({ crimsonNew: 0, crimsonScreen: 0, newColors: [{ desc: ".mf-vchip", color: "rgba(224,52,75,0.7)" }] }, { crimsonColors });
  assert.equal(byColor.ok, false);
  assert.match(byColor.detail, /\.mf-vchip/);
  const amberOnly = colorRuleChecks({ crimsonNew: 0, crimsonScreen: 0, newColors: [{ desc: ".mf-vchip", color: "rgb(242, 184, 75)" }] }, { crimsonColors });
  assert.equal(amberOnly.ok, true, amberOnly.detail);
  const screenColor = colorRuleChecks({ crimsonNew: 0, crimsonScreen: 0, screenColors: [{ desc: ".mf-dt__mark", color: "rgb(224, 52, 75)" }] }, { crimsonColors, wholeScreenCrimson: true });
  assert.equal(screenColor.ok, false);
  // 측정값 없음
  assert.match(colorRuleChecks({ crimsonScreen: 0 }, { crimsonColors }).detail, /측정값 없음\(.*crimsonNew/);
  assert.match(colorRuleChecks({ crimsonNew: 0 }, { crimsonColors, wholeScreenCrimson: true }).detail, /측정값 없음\(.*crimsonScreen/);
  assert.match(colorRuleChecks({ crimsonNew: 0, newColors: [] }, {}).detail, /측정값 없음\(.*crimsonColors/);
  assert.match(colorRuleChecks(null, { crimsonColors }).detail, /측정값 없음/);
});

test("04-29: 기존 기준 수치는 그대로다(04-30 이 완화를 더해도 낮추지 않는다)", () => {
  assert.equal(OVERLAP_EPS, 0.5);
  assert.equal(TAP_MIN, 44);
  assert.equal(PANEL_H, 157);
  assert.equal(ONE_LINE_FACTOR, 1.6);
  assert.equal(FACE_RATIO, 0.45);
});

// ---- 04-30 Task 1: P5 변론 스포트라이트·P6 처형 카드, 승인 완화 P-PANEL-236 ----

const DEF_SCENE = { left: 0, top: 119.2, right: 390, bottom: 520, width: 390 };
const defenseSnap = ({ me = false } = {}) => ({
  bottom: {
    title: me ? "변론할 말을 고르세요" : "",
    guide: "",
    height: me ? 236 : 157,
    buttons: me ? Array.from({ length: 6 }, (_, i) => ({ text: `칩${i}`, pressed: null, disabled: false, w: 110, h: 44 })) : [],
  },
  dt: {
    scene: DEF_SCENE,
    center: { seat: 2, cx: 195, scale: 1.7, z: 31, tagZ: 32, tagBottom: 514 },
    others: { maxSeatZ: 10, maxTagZ: 12 },
    dim: { count: 1, backdropFilter: "blur(3px)", background: "rgba(0, 0, 0, 0.45)", z: 30 },
    cones: 1,
  },
});
const defenseBad = (mutate, opts) => {
  const s = defenseSnap({ me: opts?.isCandidate });
  mutate(s);
  return defenseChecks(s, opts ?? { isCandidate: false });
};

test("defenseChecks P5: 정상 입력(남의 시점·후보 본인)은 통과한다", () => {
  const a = defenseChecks(defenseSnap(), { isCandidate: false });
  assert.equal(a.id, "P5");
  assert.equal(a.ok, true, a.detail);
  const b = defenseChecks(defenseSnap({ me: true }), { isCandidate: true });
  assert.equal(b.ok, true, b.detail);
});

test("defenseChecks P5: 가운데·배율·어둡게·원뿔·층 순서·이름표 여유 위반을 각각 잡는다", () => {
  const cases = [
    ["가운데 5px 어긋남", (s) => { s.dt.center.cx = 200; }, /가운데/],
    ["가운데 2px 는 허용", null, null],
    ["배율 1.5", (s) => { s.dt.center.scale = 1.5; }, /배율/],
    ["어둡게 층 없음", (s) => { s.dt.dim.count = 0; }, /어둡게/],
    ["어둡게 층 둘", (s) => { s.dt.dim.count = 2; }, /어둡게/],
    ["흐림 4px", (s) => { s.dt.dim.backdropFilter = "blur(4px)"; }, /blur\(3px\)|흐림/],
    ["흐림 없음", (s) => { s.dt.dim.backdropFilter = "none"; }, /blur\(3px\)|흐림/],
    ["어둡게 알파 .6", (s) => { s.dt.dim.background = "rgba(0, 0, 0, 0.6)"; }, /알파|어둡게/],
    ["어둡게 알파 읽을 수 없음", (s) => { s.dt.dim.background = "red"; }, /알파|어둡게/],
    ["어둡게 z 가 30 아님", (s) => { s.dt.dim.z = 20; }, /z/],
    ["원뿔 둘", (s) => { s.dt.cones = 2; }, /원뿔/],
    ["원뿔 없음", (s) => { s.dt.cones = 0; }, /원뿔/],
    ["후보 z 29", (s) => { s.dt.center.z = 29; }, /후보.*z|z.*후보/],
    ["후보 이름표 z 29", (s) => { s.dt.center.tagZ = 29; }, /이름표.*z|z.*이름표/],
    ["다른 자리가 층 위", (s) => { s.dt.others.maxSeatZ = 30; }, /다른 자리/],
    ["다른 이름표가 층 위", (s) => { s.dt.others.maxTagZ = 31; }, /다른 이름표/],
    ["이름표 아래끝이 장면 아래 − 4 침범", (s) => { s.dt.center.tagBottom = 517; }, /아래끝/],
    ["패널 높이 157 이 아님", (s) => { s.bottom.height = 170; }, /패널 높이/],
  ];
  for (const [name, mutate, re] of cases) {
    if (!mutate) {
      const s = defenseSnap();
      s.dt.center.cx = 197;
      assert.equal(defenseChecks(s, { isCandidate: false }).ok, true, name);
      continue;
    }
    const r = defenseBad(mutate);
    assert.equal(r.ok, false, name);
    assert.match(r.detail, re, name);
  }
});

test("defenseChecks P5: 후보 본인 패널은 236·칩 6개(각 ≥ 44)이고 남의 시점은 157 이다(승인 완화가 번지지 않음, T-04-71)", () => {
  // 후보 본인인데 157 이면 실패, 남인데 236 이어도 실패
  const me157 = defenseSnap({ me: true });
  me157.bottom.height = 157;
  assert.match(defenseChecks(me157, { isCandidate: true }).detail, /236/);
  const other236 = defenseSnap();
  other236.bottom.height = 236;
  const r = defenseChecks(other236, { isCandidate: false });
  assert.equal(r.ok, false);
  assert.match(r.detail, /157/);
  // 칩 5개, 칩 하나가 44 미만
  const five = defenseSnap({ me: true });
  five.bottom.buttons.pop();
  assert.match(defenseChecks(five, { isCandidate: true }).detail, /칩 5개/);
  const small = defenseSnap({ me: true });
  small.bottom.buttons[0].h = 40;
  assert.match(defenseChecks(small, { isCandidate: true }).detail, /44/);
  // 236 은 반올림 오차 ±0.5 까지
  const tol = defenseSnap({ me: true });
  tol.bottom.height = 236.4;
  assert.equal(defenseChecks(tol, { isCandidate: true }).ok, true);
  tol.bottom.height = 236.6;
  assert.equal(defenseChecks(tol, { isCandidate: true }).ok, false);
});

test("defenseChecks P5: 측정값이 없으면 조용히 통과하지 않는다", () => {
  for (const [name, mutate] of [
    ["center", (s) => { delete s.dt.center; }],
    ["dim", (s) => { delete s.dt.dim; }],
    ["cones", (s) => { delete s.dt.cones; }],
    ["others", (s) => { delete s.dt.others; }],
    ["scene", (s) => { delete s.dt.scene; }],
    ["bottom.height", (s) => { delete s.bottom.height; }],
  ]) {
    const r = defenseBad(mutate);
    assert.equal(r.ok, false, name);
    assert.match(r.detail, /측정값 없음/, name);
  }
  assert.match(defenseChecks(null, { isCandidate: false }).detail, /측정값 없음/);
  assert.match(defenseChecks(defenseSnap(), {}).detail, /측정값 없음\(.*isCandidate/);
});

const execSnap = () => ({
  bottom: { title: "처형이 끝났어요", guide: "곧 다음으로 넘어가요" },
  dt: { ghosts: [2], roleImgs: 0, roleWords: 0 },
  execCard: { count: 1, title: "하늘님이 형장의 이슬이 되었습니다", sub: "처형이 집행됐어요", borderColor: "rgb(242, 184, 75)" },
  crimsonNew: 0,
});
const execBad = (mutate, opts) => {
  const s = execSnap();
  mutate(s);
  return executionChecks(s, opts ?? { viewerAlive: true, candidateSeat: 2 });
};

test("executionChecks P6: 정상 입력은 통과하고 네 꼬리 모두 받아들인다", () => {
  const r = executionChecks(execSnap(), { viewerAlive: true, candidateSeat: 2 });
  assert.equal(r.id, "P6");
  assert.equal(r.ok, true, r.detail);
  for (const tail of ["더는 함께할 수 없게 되었습니다", "형장의 이슬이 되었습니다", "잔혹하게 처형되었습니다", "처형대에 올랐습니다"]) {
    const s = execSnap();
    s.execCard.title = `하늘님이 ${tail}`;
    assert.equal(executionChecks(s, { viewerAlive: true, candidateSeat: 2 }).ok, true, tail);
  }
});

test("executionChecks P6: 카드·문구·유령·하단·진홍·직업 비노출 위반을 각각 잡는다", () => {
  const cases = [
    ["처형 카드 진홍", (s) => { s.execCard.borderColor = "rgb(224, 52, 75)"; }, /앰버/],
    ["처형 카드 회색", (s) => { s.execCard.borderColor = "rgb(168, 172, 184)"; }, /앰버/],
    ["처형 카드 없음", (s) => { s.execCard.count = 0; }, /처형 카드/],
    ["처형 카드 둘", (s) => { s.execCard.count = 2; }, /처형 카드/],
    ["아침 꼬리(5번째)", (s) => { s.execCard.title = "하늘님이 어둠 속으로 사라졌습니다"; }, /문구/],
    ["님이 없음", (s) => { s.execCard.title = "하늘이 형장의 이슬이 되었습니다"; }, /문구/],
    ["부제 다름", (s) => { s.execCard.sub = "처형이 끝났어요"; }, /부제/],
    ["유령 아님", (s) => { s.dt.ghosts = [1, 3]; }, /유령/],
    ["하단 제목 다름", (s) => { s.bottom.title = "처형 중"; }, /하단 제목/],
    ["하단 안내 다름", (s) => { s.bottom.guide = "잠시만요"; }, /안내/],
    ["새 요소 진홍", (s) => { s.crimsonNew = 1; }, /진홍/],
    ["역할 그림 1개", (s) => { s.dt.roleImgs = 1; }, /역할 그림/],
    ["역할 이름 1개", (s) => { s.dt.roleWords = 1; }, /역할 이름/],
  ];
  for (const [name, mutate, re] of cases) {
    const r = execBad(mutate);
    assert.equal(r.ok, false, name);
    assert.match(r.detail, re, name);
  }
});

test("executionChecks P6: 탈락한 viewer 는 직업 그림 검사를 하지 않고, 측정값이 없으면 실패한다", () => {
  const s = execSnap();
  s.dt.roleImgs = 5;
  s.dt.roleWords = 5;
  assert.equal(executionChecks(s, { viewerAlive: false, candidateSeat: 2 }).ok, true);
  for (const [name, mutate] of [
    ["execCard", (x) => { delete x.execCard; }],
    ["ghosts", (x) => { delete x.dt.ghosts; }],
    ["crimsonNew", (x) => { delete x.crimsonNew; }],
    ["roleImgs", (x) => { delete x.dt.roleImgs; }],
    ["bottom", (x) => { delete x.bottom; }],
  ]) {
    const r = execBad(mutate);
    assert.equal(r.ok, false, name);
    assert.match(r.detail, /측정값 없음/, name);
  }
  assert.match(executionChecks(execSnap(), { viewerAlive: true }).detail, /측정값 없음\(.*candidateSeat/);
});

test("04-30: 변론 후보 패널 236 은 승인 완화 한 줄뿐이고 기준 수치는 그대로이며, 상수는 verdict.ts 와 같다", () => {
  assert.equal(PANEL_H_DEFENSE_ME, 236);
  assert.equal(PANEL_H, 157);
  assert.equal(AMBER_RGB, "rgb(242, 184, 75)");
  assert.equal(APPROVED_RELAXATIONS.filter((x) => x.id === "P-PANEL-236").length, 1);
  assert.equal(OVERLAP_EPS, 0.5);
  assert.equal(TAP_MIN, 44);
  assert.equal(ONE_LINE_FACTOR, 1.6);
  assert.equal(FACE_RATIO, 0.45);
  const src = readFileSync(new URL("../../src/game/verdict.ts", import.meta.url), "utf8");
  const num = (name) => Number(new RegExp(`export const ${name} = ([0-9.]+)`).exec(src)?.[1]);
  const spot = defenseSnap();
  // lib 의 수치가 상수 파일과 같다: 45%·3px·1.7. 다르면 아래 단언이 깨진다.
  assert.equal(num("VERDICT_DIM_PERCENT"), 45);
  assert.equal(num("VERDICT_BLUR_PX"), 3);
  assert.equal(num("VERDICT_CANDIDATE_SCALE"), 1.7);
  // 기준값 그대로 만든 스냅숏이 통과한다 = lib 수치가 상수와 같다
  const dim = `rgba(0, 0, 0, ${num("VERDICT_DIM_PERCENT") / 100})`;
  spot.dt.dim.background = dim;
  spot.dt.dim.backdropFilter = `blur(${num("VERDICT_BLUR_PX")}px)`;
  spot.dt.center.scale = num("VERDICT_CANDIDATE_SCALE");
  assert.equal(defenseChecks(spot, { isCandidate: false }).ok, true);
  // lib 에 쓴 236 이 UI-SPEC 8.4 와 같은지는 위 PANEL_H_DEFENSE_ME 단언이 고정한다.
});

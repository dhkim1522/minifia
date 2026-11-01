// 화면 E2E 순수 도우미 단위 테스트. 실행: node --test scripts/e2e/lib.test.mjs
import test from "node:test";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import {
  APPROVED_RELAXATIONS,
  TAG_BASE_ALPHA_MAX,
  TAG_FRONT_ALPHA_MIN,
  cssAlpha,
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
  USAGE,
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
  lineCount,
  morningCardIssues,
  parseArgs,
  rectInside,
  rectsOverlap,
  redact,
  resolveTarget,
  stageStable,
  LOBBY_EXTRA_SIZES,
  LOBBY_SIZES,
  WIDE_NAME_GRAPHEMES,
  NAMETAG_FONT_MIN,
  WORLD_MOVED_MIN,
  WORLD_RING_MAX_MS,
  WORLD_SEGMENT_MAX_MS,
  WORLD_SYNC_TOL,
  graphemeCount,
  lobbyHeaderChecks,
  lobbyStartChecks,
  nameTagFitChecks,
  ownTagInStageChecks,
  parseBarMask,
  pickTapTargets,
  tagStackChecks,
  walkableCenters,
  worldSyncChecks,
  tagsOverlap,
  voteChecks,
  candidateRevealMs,
  CANDIDATE_REVEAL_TIMING,
  introChecks,
  BLANK_TAP_E2E_MARGIN,
  CANDIDATE_GUIDE,
  blankPointsOf,
  cancelTapChecks,
  candidateChecks,
  candidateGuideChecks,
  revealChecks,
  colorRuleChecks,
  haloChecks,
  AMBER_RGB,
  PANEL_H_DEFENSE_ME,
  defenseChecks,
  executionChecks,
  voidCardChecks,
  resultChecks,
  placementChecks,
  DEFAULT_SIZES,
  TIMELESS_PHASES,
  JOIN_FIT_MIN_H,
  guideChecks,
  docHeightChecks,
  joinFitChecks,
  pcCenterChecks,
  vignetteChecks,
  glowChecks,
  wakeLockChecks,
  CONSOLE_ALLOW,
  DRAW_CALL_BUDGET,
  POINT_LIGHT_BUDGET,
  RECONNECT_KINDS,
  RECONNECT_ROUNDS,
  REOPEN_ROUNDS,
  RESTORED_GONE_MS,
  budgetChecks,
  chunkFailChecks,
  consoleIssues,
  deployHoldChecks,
  deployObservedOf,
  contextLeakChecks,
  isLocalOrigin,
  isWorldChunkUrl,
  memoryStableChecks,
  paintedFromStats,
  reconnectChecks,
  reconnectSummary,
  selectFlows,
} from "./lib.mjs";
import { dropSockets } from "./browser.mjs";

const PROD = "https://minifia-v2.dhplay.workers.dev\n";
const rect = (left, top, width, height) => ({ left, top, width, height, right: left + width, bottom: top + height });

test("parseArgs: 인자 없음은 기본값 세 폭 기준 + 단 높이 probe 360x560", () => {
  const a = parseArgs([]);
  assert.equal(a.url, null);
  assert.equal(a.only, null);
  assert.equal(a.shots, false);
  assert.equal(a.sizesGiven, false);
  assert.deepEqual(
    a.sizes.map((s) => [s.w, s.h, s.label]),
    [
      [360, 640, "360x640"],
      [390, 664, "390x664"],
      [430, 932, "430x932"],
      [360, 560, "360x560"],
    ],
  );
});

test("parseArgs: --sizes 하나, --shots, --only, --url", () => {
  const a = parseArgs(["--sizes", "360x640", "--shots", "--only", "lobby", "--url", "http://localhost:5173"]);
  assert.equal(a.sizesGiven, true);
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

test("resolveTarget: 인자 없으면 prod-url 값(v2 주소, 명시 아님)", () => {
  const t = resolveTarget(null, PROD);
  assert.equal(t.origin, "https://minifia-v2.dhplay.workers.dev");
  assert.equal(t.explicit, false);
});

// DEPLOY-02: v1.0 호스트 문자열은 이 거부 테스트에만 둔다(정적 검사 허용 목록).
test("resolveTarget: 끝 점이 붙은 v1.0 주소도 거부(06 리뷰 CR-01)", () => {
  assert.throws(() => resolveTarget("https://minifia.dhplay.workers.dev.", PROD), /v1\.0/);
  assert.throws(() => resolveTarget(null, "https://MINIFIA.dhplay.workers.dev.\n"), /v1\.0/);
});

test("resolveTarget: prod-url 이 v1.0 주소면 거부(v1.0 이 기본값이 되지 않는다)", () => {
  assert.throws(() => resolveTarget(null, "https://minifia.dhplay.workers.dev\n"), /v1\.0/);
});

test("resolveTarget: v1.0 주소는 명시해도 거부(푸는 옵션 없음)", () => {
  for (const v1 of ["https://minifia.dhplay.workers.dev", "https://MINIFIA.dhplay.workers.dev/x/", "http://minifia.dhplay.workers.dev"]) {
    assert.throws(() => resolveTarget(v1, PROD), /v1\.0/, v1);
  }
});

test("USAGE 의 예시 주소는 v2 다", () => {
  assert.ok(USAGE.includes("minifia-v2.dhplay.workers.dev"));
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

test("APPROVED_RELAXATIONS: 승인된 완화는 M1·D3a/D3b·D4·5명판 D3b 98.0%·변론 후보 패널 236·결정 0056 의 D9·D3b·G2·D2·P10(6자 이상 이름) 뿐이고, 모두 이유와 승인 근거가 있다", () => {
  assert.deepEqual(APPROVED_RELAXATIONS.map((r) => r.id), ["M1", "D3a/D3b", "D4", "D3b-5", "P-PANEL-236", "D9-8ch", "D3b-8ch", "G2-8ch", "D2-8ch", "P10-8ch"]);
  for (const r of APPROVED_RELAXATIONS) {
    assert.ok(typeof r.reason === "string" && r.reason.trim().length > 0, JSON.stringify(r));
    assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(r.approved) || ["03.1 F7", "execution-v1/DC-defense-me", "결정 0056"].includes(r.approved), JSON.stringify(r));
  }
  for (const id of ["D9-8ch", "D3b-8ch", "G2-8ch", "D2-8ch", "P10-8ch"]) {
    const r = APPROVED_RELAXATIONS.find((x) => x.id === id);
    assert.equal(r.approved, "결정 0056");
    assert.match(r.reason, /v1\.0 고정 테이블 화면/);
    assert.match(r.reason, /6 그래핌 이상/);
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

// ---- W1 게임 중 방장 왕관 없음 (결정 0030, 06-17: 대기실 왕관 검사는 기능과 함께 지움) ----

test("crownChecks W1: 게임 중에는 왕관 0개만 통과, 1개 이상·측정값 없음은 실패, 대기실 기대(expect 1)는 더 이상 없다", () => {
  const r = crownChecks({ crowns: 0 }, { expect: 0 });
  assert.equal(r.id, "W1");
  assert.equal(r.ok, true, r.detail);
  assert.equal(crownChecks({ crowns: 0 }).ok, true);
  assert.equal(crownChecks({ crowns: 1 }, { expect: 0 }).ok, false);
  assert.throws(() => crownChecks({ crowns: 1 }, { expect: 1 }), /대기실 왕관 검사는 지웠다/);
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

test("voteChecks P9: 관전자는 마피아 동료 표시(진홍 후광, D-33)만 허용하고 흰·앰버 후광은 여전히 실패한다", () => {
  const spec = (haloImgs) => {
    const v = withBottom({ buttons: [], pill: "관전 중 · 볼 수만 있어요" });
    v.dt.haloImgs = haloImgs;
    return v;
  };
  // 관전자는 모든 직업을 보므로 마피아 자리에 진홍 후광이 계속 남는다(UI-SPEC 12.4·D-33)
  const ally = voteChecks(spec([{ seat: 2, kind: "crimson" }]), { spectator: true });
  assert.equal(ally.ok, true, ally.detail);
  for (const kind of ["white", "amber"]) {
    const x = voteChecks(spec([{ seat: 2, kind }]), { spectator: true });
    assert.equal(x.ok, false, kind);
    assert.match(x.detail, /후광/, kind);
  }
  assert.equal(voteChecks(spec([{ seat: 2, kind: "crimson" }, { seat: 3, kind: "white" }]), { spectator: true }).ok, false);
  // 살아 있는 viewer 는 진홍이어도 후광 0 이어야 한다(P1 은 그대로)
  const alive = goodVote();
  alive.dt.haloImgs = [{ seat: 2, kind: "crimson" }];
  assert.equal(voteChecks(alive).ok, false);
});

const introSamples = (over = {}) => [
  { t: 100, intro: { count: 1, pointerEvents: "none", cardOpacity: 1, residueCount: 0 } },
  { t: 900, intro: { count: 1, pointerEvents: "none", cardOpacity: 1, residueCount: 0 } },
  { t: 2500, intro: { count: 1, pointerEvents: "none", cardOpacity: 0.4, residueCount: 0 } }, // 3초 카드는 2.5초에도 있는 것이 정상(결정 0039)
  { t: 3300, intro: { count: 0, pointerEvents: null, cardOpacity: null, residueCount: 0 } },
  ...(over.extra ?? []),
];

test("introChecks P2: 도착 직후 카드 1장·터치 통과, 3.2초 뒤 DOM 에서 사라져 잔상 0, 그 동안 클릭이 통과했으면 통과한다", () => {
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
    ["3.2초 뒤에도 남아 있음", mut(3, { count: 1, pointerEvents: "none" }), true, /3200|사라/],
    ["불투명 잔상", mut(3, { residueCount: 1 }), true, /잔상/],
    ["클릭이 통과하지 못함", s, false, /클릭/],
    ["3.2초 뒤 표본 없음", s.slice(0, 3), true, /측정값 없음/],
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

test("candidateRevealMs 사본: 0표 2000, 1표 3000, 5표 11000, 8표 17000 (결정 0039)", () => {
  assert.deepEqual([0, 1, 5, 8].map((n) => candidateRevealMs(n)), [2000, 3000, 11000, 17000]);
  assert.deepEqual({ ...CANDIDATE_REVEAL_TIMING }, { leadMs: 400, slotMs: 2000, tailMs: 600, emptyMs: 2000 });
  assert.equal(candidateRevealMs(-2), 2000);
  assert.equal(candidateRevealMs(Number.NaN), 2000);
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

// ---- 04-30 Task 2: P7 처형 무효 카드·P8 결과 화면·P10 배치 겹침 ----

const GRAY = ["rgb(168, 172, 184)", "rgb(200, 203, 212)"];
const CRIMSON = ["rgb(224, 52, 75)"];
const voidCard = (over = {}) => ({ count: 1, title: "처형 무효", sub: "동률이라 처형하지 않아요", borderColor: "rgb(168, 172, 184)", pointerEvents: "none", ...over });
const voidSamples = () => [
  { t: 0, voidCard: voidCard(), nightIntro: 0 },
  { t: 800, voidCard: voidCard(), nightIntro: 0 },
  { t: 1650, voidCard: voidCard({ count: 0 }), nightIntro: 1 },
  { t: 1900, voidCard: voidCard({ count: 0 }), nightIntro: 1 },
];
const voidOpts = (o = {}) => ({ grayColors: GRAY, crimsonColors: CRIMSON, clickedThrough: true, ...o });

test("voidCardChecks P7: 정상 입력은 통과하고 세 부제 모두 받아들인다", () => {
  const r = voidCardChecks(voidSamples(), voidOpts());
  assert.equal(r.id, "P7");
  assert.equal(r.ok, true, r.detail);
  for (const sub of ["찬성이 과반이 아니에요", "동률이라 처형하지 않아요", "던진 표가 없어요"]) {
    const x = voidSamples();
    x.forEach((e) => { if (e.voidCard.count) e.voidCard.sub = sub; });
    assert.equal(voidCardChecks(x, voidOpts()).ok, true, sub);
  }
});

test("voidCardChecks P7: 카드 색·제목·부제·순서·잔상·터치 통과 위반을 각각 잡는다", () => {
  const cases = [
    ["테두리 앰버", (x) => { x[0].voidCard.borderColor = "rgb(242, 184, 75)"; }, /앰버|회색/],
    ["테두리 진홍", (x) => { x[0].voidCard.borderColor = "rgba(224, 52, 75, 1)"; }, /진홍|회색/],
    ["테두리가 회색 목록에 없음", (x) => { x[0].voidCard.borderColor = "rgb(10, 20, 30)"; }, /회색/],
    ["제목 다름", (x) => { x[0].voidCard.title = "처형 취소"; }, /제목/],
    ["부제 다름", (x) => { x[0].voidCard.sub = "표가 모자라요"; }, /부제/],
    ["도착 직후 카드 없음", (x) => { x[0].voidCard.count = 0; }, /도착|카드 0/],
    ["카드 둘", (x) => { x[0].voidCard.count = 2; }, /카드 2/],
    ["터치 막음", (x) => { x[1].voidCard.pointerEvents = "auto"; }, /pointer-events/],
    ["밤 시작 문구가 카드와 동시", (x) => { x[0].nightIntro = 1; }, /밤 시작 문구/],
    ["밤 시작 문구가 1.4초에", (x) => { x[0].nightIntro = 0; x[1].nightIntro = 0; x[2].nightIntro = 0; x[2].t = 1650; x.splice(2, 0, { t: 1400, voidCard: voidCard(), nightIntro: 1 }); }, /밤 시작 문구/],
    ["1.8초 뒤 잔상", (x) => { x[3].voidCard.count = 1; }, /1800ms|사라지지/],
  ];
  for (const [name, mutate, re] of cases) {
    const x = voidSamples();
    mutate(x);
    const r = voidCardChecks(x, voidOpts());
    assert.equal(r.ok, false, name);
    assert.match(r.detail, re, name);
  }
  const noClick = voidCardChecks(voidSamples(), voidOpts({ clickedThrough: false }));
  assert.equal(noClick.ok, false);
  assert.match(noClick.detail, /통과/);
});

test("voidCardChecks P7: 측정값이 없으면 조용히 통과하지 않는다", () => {
  assert.match(voidCardChecks([], voidOpts()).detail, /측정값 없음/);
  assert.match(voidCardChecks(undefined, voidOpts()).detail, /측정값 없음/);
  assert.match(voidCardChecks(voidSamples(), voidOpts({ grayColors: undefined })).detail, /측정값 없음\(.*grayColors/);
  assert.match(voidCardChecks(voidSamples(), voidOpts({ crimsonColors: [] })).detail, /측정값 없음\(.*crimsonColors/);
  assert.match(voidCardChecks(voidSamples(), voidOpts({ clickedThrough: undefined })).detail, /측정값 없음\(.*clickedThrough/);
  const noLate = voidSamples().slice(0, 2);
  assert.match(voidCardChecks(noLate, voidOpts()).detail, /측정값 없음\(.*1800/);
  const noIntro = voidSamples();
  noIntro.forEach((e) => { e.nightIntro = 0; });
  assert.match(voidCardChecks(noIntro, voidOpts()).detail, /측정값 없음\(.*밤 시작 문구/);
  const noField = voidSamples();
  delete noField[0].voidCard;
  assert.match(voidCardChecks(noField, voidOpts()).detail, /측정값 없음/);
});

const resultSnap = (winner = "mafiaWin", n = 5) => ({
  result: {
    winner,
    bannerText: winner === "mafiaWin" ? "마피아 팀 승리" : "시민 팀 승리",
    bannerSub: "마피아 수가 나머지 생존자 수와 같아졌어요",
    cards: Array.from({ length: n }, (_, i) => ({ seat: i, job: ["마피아", "경찰", "의사", "시민", "시민"][i % 5], dead: i === 1 || i === 3, figOpacity: i === 1 || i === 3 ? 0.5 : 1 })),
    rows: 4,
    scrollW: 300,
    clientW: 300,
    reachedButton: true,
    glow: winner === "mafiaWin",
    hasPhaseBar: false,
  },
});
const resultOpts = (o = {}) => ({ winner: "mafiaWin", n: 5, summaryRows: 4, ...o });
const resBad = (mutate, snapWinner = "mafiaWin", opts) => {
  const s = resultSnap(snapWinner);
  mutate(s.result);
  return resultChecks(s, resultOpts({ winner: snapWinner, ...(opts ?? {}) }));
};

test("resultChecks P8: 마피아 승·시민 승 정상 입력은 통과한다", () => {
  const a = resultChecks(resultSnap("mafiaWin"), resultOpts());
  assert.equal(a.id, "P8");
  assert.equal(a.ok, true, a.detail);
  const b = resultChecks(resultSnap("citizenWin"), resultOpts({ winner: "citizenWin" }));
  assert.equal(b.ok, true, b.detail);
});

test("resultChecks P8: 배너·카드·흐림·요약·스크롤·번짐 위반을 각각 잡는다", () => {
  const cases = [
    ["배너가 승자와 다름", "mafiaWin", (r) => { r.bannerText = "시민 팀 승리"; }, /배너/],
    ["결과 winner 가 기대와 다름", "mafiaWin", (r) => { r.winner = "citizenWin"; }, /winner|승자/],
    ["카드 수 부족", "mafiaWin", (r) => { r.cards.pop(); }, /카드 4/],
    ["직업 이름 없음", "mafiaWin", (r) => { r.cards[0].job = ""; }, /직업/],
    ["엉뚱한 직업 이름", "mafiaWin", (r) => { r.cards[0].job = "광대"; }, /직업/],
    ["탈락 카드 불투명", "mafiaWin", (r) => { r.cards[1].figOpacity = 1; }, /탈락/],
    ["살아 있는 카드가 흐림", "mafiaWin", (r) => { r.cards[0].figOpacity = 0.5; }, /살아/],
    ["요약 행 수 다름", "mafiaWin", (r) => { r.rows = 3; }, /요약/],
    ["가로 스크롤 301>300", "mafiaWin", (r) => { r.scrollW = 301; }, /가로/],
    ["[처음으로] 에 못 닿음", "mafiaWin", (r) => { r.reachedButton = false; }, /처음으로/],
    ["시민 승에 번짐", "citizenWin", (r) => { r.glow = true; }, /번짐/],
    ["마피아 승에 번짐 없음", "mafiaWin", (r) => { r.glow = false; }, /번짐/],
    ["진행 바가 보임", "mafiaWin", (r) => { r.hasPhaseBar = true; }, /헤더|바/],
  ];
  for (const [name, w, mutate, re] of cases) {
    const r = resBad(mutate, w);
    assert.equal(r.ok, false, name);
    assert.match(r.detail, re, name);
  }
  // 오차 허용: 탈락 .5 ± .05
  assert.equal(resBad((r) => { r.cards[1].figOpacity = 0.54; }).ok, true);
  assert.equal(resBad((r) => { r.cards[1].figOpacity = 0.56; }).ok, false);
});

test("resultChecks P8: 측정값이 없으면 조용히 통과하지 않는다", () => {
  assert.match(resultChecks(null, resultOpts()).detail, /측정값 없음/);
  for (const k of ["bannerText", "cards", "rows", "scrollW", "reachedButton", "glow", "hasPhaseBar"]) {
    const s = resultSnap();
    delete s.result[k];
    const r = resultChecks(s, resultOpts());
    assert.equal(r.ok, false, k);
    assert.match(r.detail, /측정값 없음/, k);
  }
  assert.match(resultChecks(resultSnap(), { winner: "mafiaWin", n: 5 }).detail, /측정값 없음\(.*summaryRows/);
  assert.match(resultChecks(resultSnap(), { n: 5, summaryRows: 4 }).detail, /측정값 없음\(.*winner/);
});

const placeSnap = () => ({
  dt: { header: rect(0, 0, 390, 119.2), panel: rect(0, 560, 390, 157), scene: { left: 0, top: 119.2, right: 390, bottom: 560, width: 390 } },
  reveal: {
    chips: [{ seat: 1, n: 2, tone: "lead", ...rect(150, 200, 36, 32) }],
    tags: [
      { seat: 1, ...rect(140, 290, 70, 22) },
      { seat: 2, ...rect(250, 250, 70, 22) },
    ],
  },
  card: { rect: rect(55, 200, 280, 176) },
});

test("placementChecks P10: 정상 입력은 통과한다(머리 위 캐릭터를 덮는 칩은 허용)", () => {
  const r = placementChecks(placeSnap());
  assert.equal(r.id, "P10");
  assert.equal(r.ok, true, r.detail);
  const noCard = placeSnap();
  delete noCard.card;
  assert.equal(placementChecks(noCard).ok, true);
});

test("placementChecks P10: 칩·카드가 이름표·헤더·패널과 겹치면 실패한다", () => {
  const cases = [
    ["칩이 자기 이름표와 겹침", (s) => { s.reveal.chips[0] = { seat: 1, n: 2, tone: "lead", ...rect(150, 280, 36, 32) }; }, /이름표/],
    ["칩이 남의 이름표와 겹침", (s) => { s.reveal.chips[0] = { seat: 1, n: 2, tone: "lead", ...rect(260, 240, 36, 32) }; }, /이름표/],
    ["칩이 헤더와 겹침", (s) => { s.reveal.chips[0] = { seat: 1, n: 2, tone: "lead", ...rect(150, 100, 36, 32) }; }, /헤더/],
    ["칩이 패널과 겹침", (s) => { s.reveal.chips[0] = { seat: 1, n: 2, tone: "lead", ...rect(150, 550, 36, 32) }; }, /패널/],
    ["카드가 패널 침범", (s) => { s.card.rect = rect(55, 440, 280, 176); }, /패널/],
    ["카드가 헤더 침범", (s) => { s.card.rect = rect(55, 80, 280, 176); }, /헤더/],
    ["카드가 장면 폭 밖", (s) => { s.card.rect = rect(-20, 200, 280, 176); }, /장면 폭/],
  ];
  for (const [name, mutate, re] of cases) {
    const s = placeSnap();
    mutate(s);
    const r = placementChecks(s);
    assert.equal(r.ok, false, name);
    assert.match(r.detail, re, name);
  }
  // 변만 맞닿는 것은 겹침이 아니다
  const touch = placeSnap();
  touch.reveal.chips[0] = { seat: 1, n: 2, tone: "lead", ...rect(150, 258, 36, 32) };
  assert.equal(placementChecks(touch).ok, true);
});

test("placementChecks P10: 측정값이 없으면 조용히 통과하지 않는다", () => {
  for (const [name, mutate] of [
    ["header", (s) => { delete s.dt.header; }],
    ["panel", (s) => { delete s.dt.panel; }],
    ["chips", (s) => { delete s.reveal.chips; }],
    ["tags", (s) => { delete s.reveal.tags; }],
    ["scene(카드가 있을 때)", (s) => { delete s.dt.scene; }],
  ]) {
    const s = placeSnap();
    mutate(s);
    const r = placementChecks(s);
    assert.equal(r.ok, false, name);
    assert.match(r.detail, /측정값 없음/, name);
  }
  assert.match(placementChecks(null).detail, /측정값 없음/);
});

test("04-30·06-17: 닫기 — 승인 목록은 열 건(결정 0056 의 다섯 건 포함)이고 기준 수치는 그대로다", () => {
  assert.deepEqual(APPROVED_RELAXATIONS.map((x) => x.id), ["M1", "D3a/D3b", "D4", "D3b-5", "P-PANEL-236", "D9-8ch", "D3b-8ch", "G2-8ch", "D2-8ch", "P10-8ch"]);
  assert.equal(FACE_RATIO, 0.45);
  assert.equal(PANEL_H, 157);
});


// ---- 5페이즈 순수 검사 (05-05): UX1·UX2·UX2-J·UX2-PC·AT1·AT2·WL1·WL2 ----

test("DEFAULT_SIZES: 세 폭 기준 뒤에 단 높이 probe 360x560 하나, 기준 수치는 불변", () => {
  assert.deepEqual(
    DEFAULT_SIZES.map((s) => s.label),
    ["360x640", "390x664", "430x932", "360x560"],
  );
  assert.equal(OVERLAP_EPS, 0.5);
  assert.equal(TAP_MIN, 44);
  assert.equal(ONE_LINE_FACTOR, 1.6);
  assert.equal(FACE_RATIO, 0.45);
  assert.equal(PANEL_H, 157);
  assert.equal(HEADER_CONTRAST_MIN, 4.5);
});

test("parseArgs: --sizes 를 주면 probe 가 섞이지 않고 그 값만이다", () => {
  assert.deepEqual(parseArgs(["--sizes", "390x664"]).sizes.map((s) => s.label), ["390x664"]);
});

test("TIMELESS_PHASES: 대기실·배정·결과 (src/game/scenes.ts 와 같은 목록)", () => {
  assert.deepEqual([...TIMELESS_PHASES], ["lobby", "assigning", "ended"]);
});

const gOk = (over = {}) => ({
  count: 1,
  items: [{ text: "토론하세요", inHeader: false, height: 20, lineHeight: 20 }],
  timers: 1,
  ...over,
});

test("guideChecks UX1: 안내 하나·글자 있음·타이머 하나는 통과", () => {
  const r = guideChecks(gOk(), { phase: "discussion" });
  assert.equal(r.id, "UX1");
  assert.equal(r.ok, true, r.detail);
});

test("guideChecks UX1: 안내 요소 0개는 실패, 2개도 실패(개수 적힘)", () => {
  const r0 = guideChecks(gOk({ count: 0, items: [] }), { phase: "discussion" });
  assert.equal(r0.ok, false);
  assert.match(r0.detail, /안내 문장 요소 없음/);
  const r2 = guideChecks(gOk({ count: 2, items: [gOk().items[0], gOk().items[0]] }), { phase: "discussion" });
  assert.equal(r2.ok, false);
  assert.match(r2.detail, /2개/);
});

test("guideChecks UX1: 글자가 공백뿐이면 실패", () => {
  const r = guideChecks(gOk({ items: [{ text: "  \n ", inHeader: false, height: 20, lineHeight: 20 }] }), { phase: "discussion" });
  assert.equal(r.ok, false);
  assert.match(r.detail, /글자/);
});

test("guideChecks UX1: 헤더 안내줄이 두 줄이면 실패, 한 줄 경계(1.6배)는 통과", () => {
  const two = guideChecks(gOk({ items: [{ text: "안내", inHeader: true, height: 40, lineHeight: 20 }] }), { phase: "discussion" });
  assert.equal(two.ok, false);
  assert.match(two.detail, /40/);
  const edge = guideChecks(gOk({ items: [{ text: "안내", inHeader: true, height: 32, lineHeight: 20 }] }), { phase: "discussion" });
  assert.equal(edge.ok, true, edge.detail);
  const over = guideChecks(gOk({ items: [{ text: "안내", inHeader: true, height: 32.5, lineHeight: 20 }] }), { phase: "discussion" });
  assert.equal(over.ok, false);
});

test("guideChecks UX1: 헤더가 아닌 안내는 여러 줄이어도 한 줄 판정을 받지 않는다", () => {
  const r = guideChecks(gOk({ items: [{ text: "안내", inHeader: false, height: 80, lineHeight: 20 }] }), { phase: "discussion" });
  assert.equal(r.ok, true, r.detail);
});

test("guideChecks UX1: 타이머 0개는 시간 있는 단계에서 실패, TIMELESS_PHASES 에서는 통과", () => {
  const bad = guideChecks(gOk({ timers: 0 }), { phase: "discussion" });
  assert.equal(bad.ok, false);
  assert.match(bad.detail, /타이머 없음/);
  for (const phase of TIMELESS_PHASES) assert.equal(guideChecks(gOk({ timers: 0 }), { phase }).ok, true, phase);
});

test("guideChecks UX1: 측정값이 없거나 숫자가 아니면 조용히 통과하지 않고 측정값 없음으로 실패", () => {
  for (const g of [undefined, null, {}, gOk({ count: "1" }), gOk({ timers: undefined }), gOk({ items: undefined }), { count: 1, items: [], timers: 1 }]) {
    const r = guideChecks(g, { phase: "discussion" });
    assert.equal(r.ok, false, JSON.stringify(g));
    assert.match(r.detail, /측정값 없음/, JSON.stringify(g));
  }
  const r = guideChecks(gOk({ items: [{ text: "안내", inHeader: true, height: "x", lineHeight: 20 }] }), { phase: "discussion" });
  assert.equal(r.ok, false);
  assert.match(r.detail, /측정값 없음/);
});

test("docHeightChecks UX2: 문서 높이 ≤ 화면 높이 통과, +1 은 실패(숫자 포함), 측정값 없음 실패", () => {
  const ok = docHeightChecks({ docH: 560 }, { h: 560 });
  assert.equal(ok.id, "UX2");
  assert.equal(ok.ok, true, ok.detail);
  const bad = docHeightChecks({ docH: 561 }, { h: 560 });
  assert.equal(bad.ok, false);
  assert.match(bad.detail, /561/);
  assert.match(bad.detail, /560/);
  for (const m of [undefined, {}, { docH: "561" }, { docH: NaN }]) {
    const r = docHeightChecks(m, { h: 560 });
    assert.equal(r.ok, false);
    assert.match(r.detail, /측정값 없음/);
  }
});

test("JOIN_FIT_MIN_H 는 640", () => {
  assert.equal(JOIN_FIT_MIN_H, 640);
});

test("joinFitChecks UX2-J: 7명 앉음·문서 640·버튼 아래끝 620 은 통과", () => {
  const r = joinFitChecks({ seated: 7, docH: 640, buttonBottom: 620 }, { h: 640, expectSeated: 7 });
  assert.equal(r.id, "UX2-J");
  assert.equal(r.ok, true, r.detail);
});

test("joinFitChecks UX2-J: 문서 높이 733 실패(숫자), 버튼 아래끝 685 실패, 앉은 수 6 실패, 측정값 없음 실패", () => {
  const doc = joinFitChecks({ seated: 7, docH: 733, buttonBottom: 620 }, { h: 640, expectSeated: 7 });
  assert.equal(doc.ok, false);
  assert.match(doc.detail, /문서 높이 733 > 640/);
  const btn = joinFitChecks({ seated: 7, docH: 640, buttonBottom: 685 }, { h: 640, expectSeated: 7 });
  assert.equal(btn.ok, false);
  assert.match(btn.detail, /685/);
  const seated = joinFitChecks({ seated: 6, docH: 640, buttonBottom: 620 }, { h: 640, expectSeated: 7 });
  assert.equal(seated.ok, false);
  assert.match(seated.detail, /6/);
  for (const j of [undefined, {}, { seated: 7, docH: 640 }, { seated: 7, buttonBottom: 600 }, { docH: 640, buttonBottom: 600 }]) {
    const r = joinFitChecks(j, { h: 640, expectSeated: 7 });
    assert.equal(r.ok, false, JSON.stringify(j));
    assert.match(r.detail, /측정값 없음/, JSON.stringify(j));
  }
});

test("pcCenterChecks UX2-PC: 1280 폭에서 폭 430·left 425 는 통과", () => {
  const r = pcCenterChecks({ rootLeft: 425, rootWidth: 430, where: "홈" }, { w: 1280 });
  assert.equal(r.id, "UX2-PC");
  assert.equal(r.ok, true, r.detail);
  assert.equal(pcCenterChecks({ rootLeft: 425.9, rootWidth: 430, where: "홈" }, { w: 1280 }).ok, true);
  assert.equal(pcCenterChecks({ rootLeft: 426.1, rootWidth: 430, where: "홈" }, { w: 1280 }).ok, false);
});

test("pcCenterChecks UX2-PC: left 0 실패·폭 1280 실패·측정값 없음 실패, 실패 내용에 위치", () => {
  const left = pcCenterChecks({ rootLeft: 0, rootWidth: 430, where: "대기실" }, { w: 1280 });
  assert.equal(left.ok, false);
  assert.match(left.detail, /대기실/);
  assert.match(left.detail, /0/);
  const wide = pcCenterChecks({ rootLeft: 0, rootWidth: 1280, where: "낮" }, { w: 1280 });
  assert.equal(wide.ok, false);
  assert.match(wide.detail, /낮/);
  assert.match(wide.detail, /1280/);
  for (const p of [undefined, {}, { rootLeft: 425 }, { rootWidth: 430 }, { rootLeft: "425", rootWidth: 430 }]) {
    const r = pcCenterChecks(p, { w: 1280 });
    assert.equal(r.ok, false, JSON.stringify(p));
    assert.match(r.detail, /측정값 없음/, JSON.stringify(p));
  }
});

const vOk = { pointerEvents: "none", backgroundImage: "radial-gradient(ellipse at center, rgba(0, 0, 0, 0) 40%, rgba(0, 0, 0, 0.5) 100%)" };

test("vignetteChecks AT1 expect 1: 한 개·none·radial·탭이 테이블로 감은 통과", () => {
  const r = vignetteChecks({ vignettes: [vOk], tapHitsTable: true }, { expect: 1 });
  assert.equal(r.id, "AT1");
  assert.equal(r.ok, true, r.detail);
});

test("vignetteChecks AT1 expect 1: 0개·2개·auto·그라데이션 아님·탭이 막힘은 각각 실패", () => {
  assert.equal(vignetteChecks({ vignettes: [], tapHitsTable: true }, { expect: 1 }).ok, false);
  const two = vignetteChecks({ vignettes: [vOk, vOk], tapHitsTable: true }, { expect: 1 });
  assert.equal(two.ok, false);
  assert.match(two.detail, /2/);
  const auto = vignetteChecks({ vignettes: [{ ...vOk, pointerEvents: "auto" }], tapHitsTable: true }, { expect: 1 });
  assert.equal(auto.ok, false);
  assert.match(auto.detail, /auto/);
  const none = vignetteChecks({ vignettes: [{ ...vOk, backgroundImage: "none" }], tapHitsTable: true }, { expect: 1 });
  assert.equal(none.ok, false);
  const tap = vignetteChecks({ vignettes: [vOk], tapHitsTable: false }, { expect: 1 });
  assert.equal(tap.ok, false);
});

test("vignetteChecks AT1 expect 0: 0개면 통과(탭 값 무시), 1개면 실패, 측정값 없음 실패", () => {
  assert.equal(vignetteChecks({ vignettes: [] }, { expect: 0 }).ok, true);
  assert.equal(vignetteChecks({ vignettes: [], tapHitsTable: false }, { expect: 0 }).ok, true);
  const one = vignetteChecks({ vignettes: [vOk], tapHitsTable: true }, { expect: 0 });
  assert.equal(one.ok, false);
  assert.match(one.detail, /1/);
  for (const a of [undefined, {}, { vignettes: "x" }]) {
    for (const expect of [0, 1]) {
      const r = vignetteChecks(a, { expect });
      assert.equal(r.ok, false, JSON.stringify(a));
      assert.match(r.detail, /측정값 없음/);
    }
  }
  // expect 1 인데 탭 판정 값이 빠지면 조용히 통과하지 않는다
  const noTap = vignetteChecks({ vignettes: [vOk] }, { expect: 1 });
  assert.equal(noTap.ok, false);
  assert.match(noTap.detail, /측정값 없음/);
});

const gl = { pointerEvents: "none", backgroundImage: "radial-gradient(ellipse at 50% 0%, rgba(255, 220, 160, 0.3) 0%, rgba(255, 220, 160, 0) 70%)", top: 119, bottom: 380 };
const glOk = { glows: [gl], sceneTop: 119.2, sceneBottom: 380, tagHit: true };

test("glowChecks AT2 expect 1: 장면 상자 안·none·radial·이름표 탭이 이름표로 감은 통과, 경계 0.5 허용", () => {
  const r = glowChecks(glOk, { expect: 1 });
  assert.equal(r.id, "AT2");
  assert.equal(r.ok, true, r.detail);
  assert.equal(glowChecks({ ...glOk, glows: [{ ...gl, top: 118.7, bottom: 380.5 }] }, { expect: 1 }).ok, true);
  assert.equal(glowChecks({ ...glOk, glows: [{ ...gl, bottom: 380.6 }] }, { expect: 1 }).ok, false);
});

test("glowChecks AT2 expect 1: 헤더로 올라감·이름표 탭 막힘·개수·pointer-events·배경이 틀리면 실패", () => {
  const up = glowChecks({ ...glOk, glows: [{ ...gl, top: 100 }] }, { expect: 1 });
  assert.equal(up.ok, false);
  assert.match(up.detail, /100/);
  assert.equal(glowChecks({ ...glOk, tagHit: false }, { expect: 1 }).ok, false);
  assert.equal(glowChecks({ ...glOk, glows: [] }, { expect: 1 }).ok, false);
  assert.equal(glowChecks({ ...glOk, glows: [gl, gl] }, { expect: 1 }).ok, false);
  assert.equal(glowChecks({ ...glOk, glows: [{ ...gl, pointerEvents: "auto" }] }, { expect: 1 }).ok, false);
  assert.equal(glowChecks({ ...glOk, glows: [{ ...gl, backgroundImage: "none" }] }, { expect: 1 }).ok, false);
});

test("glowChecks AT2 expect 0: 0개 통과, 1개 실패, 측정값 없음 실패", () => {
  assert.equal(glowChecks({ glows: [] }, { expect: 0 }).ok, true);
  assert.equal(glowChecks(glOk, { expect: 0 }).ok, false);
  for (const a of [undefined, {}, { glows: null }]) {
    const r = glowChecks(a, { expect: 0 });
    assert.equal(r.ok, false);
    assert.match(r.detail, /측정값 없음/);
  }
  for (const a of [{ glows: [gl], sceneTop: 119, tagHit: true }, { glows: [gl], sceneTop: 119, sceneBottom: 380 }, { glows: [{ ...gl, top: undefined }], sceneTop: 119, sceneBottom: 380, tagHit: true }]) {
    const r = glowChecks(a, { expect: 1 });
    assert.equal(r.ok, false, JSON.stringify(a));
    assert.match(r.detail, /측정값 없음/, JSON.stringify(a));
  }
});

test("wakeLockChecks WL1(unsupported): API 없음·단계 도달·콘솔 오류 0 은 통과", () => {
  const r = wakeLockChecks({ hasApi: false, reachedPhase: true, consoleErrors: [] }, { mode: "unsupported" });
  assert.equal(r.id, "WL1");
  assert.equal(r.ok, true, r.detail);
});

test("wakeLockChecks WL1(unsupported): API 가 남아 있음·단계 미도달·콘솔 오류는 실패, 측정값 없음 실패", () => {
  assert.equal(wakeLockChecks({ hasApi: true, reachedPhase: true, consoleErrors: [] }, { mode: "unsupported" }).ok, false);
  assert.equal(wakeLockChecks({ hasApi: false, reachedPhase: false, consoleErrors: [] }, { mode: "unsupported" }).ok, false);
  const err = wakeLockChecks({ hasApi: false, reachedPhase: true, consoleErrors: ["TypeError: x"] }, { mode: "unsupported" });
  assert.equal(err.ok, false);
  assert.match(err.detail, /TypeError/);
  for (const w of [undefined, {}, { hasApi: false, reachedPhase: true }, { hasApi: false, consoleErrors: [] }, { reachedPhase: true, consoleErrors: [] }]) {
    const r = wakeLockChecks(w, { mode: "unsupported" });
    assert.equal(r.ok, false, JSON.stringify(w));
    assert.match(r.detail, /측정값 없음/, JSON.stringify(w));
  }
});

test("wakeLockChecks WL2(spy): 대기실에서 1 이상·가시성 복귀에 정확히 1 증가는 통과", () => {
  const r = wakeLockChecks({ requestsAtLobby: 1, requestsAfterVisible: 2 }, { mode: "spy" });
  assert.equal(r.id, "WL2");
  assert.equal(r.ok, true, r.detail);
  assert.equal(wakeLockChecks({ requestsAtLobby: 3, requestsAfterVisible: 4 }, { mode: "spy" }).ok, true);
});

test("wakeLockChecks WL2(spy): 요청 0·증가 0·증가 2·측정값 없음은 실패, 알 수 없는 모드도 실패", () => {
  assert.equal(wakeLockChecks({ requestsAtLobby: 0, requestsAfterVisible: 1 }, { mode: "spy" }).ok, false);
  const none = wakeLockChecks({ requestsAtLobby: 1, requestsAfterVisible: 1 }, { mode: "spy" });
  assert.equal(none.ok, false);
  const twice = wakeLockChecks({ requestsAtLobby: 1, requestsAfterVisible: 3 }, { mode: "spy" });
  assert.equal(twice.ok, false);
  assert.match(twice.detail, /2/);
  for (const w of [undefined, {}, { requestsAtLobby: 1 }, { requestsAfterVisible: 2 }]) {
    const r = wakeLockChecks(w, { mode: "spy" });
    assert.equal(r.ok, false, JSON.stringify(w));
    assert.match(r.detail, /측정값 없음/, JSON.stringify(w));
  }
  assert.equal(wakeLockChecks({}, { mode: "other" }).ok, false);
});

// ---- 261029-vvd: 후보 선택 취소 (결정 0040) — P11 안내 줄, P12 이름표 탭 유지·빈 곳 탭 취소, blankPointsOf ----

test("CANDIDATE_GUIDE 는 고르기 전·고른 뒤 두 문장이고 얼려 있다", () => {
  assert.deepEqual({ ...CANDIDATE_GUIDE }, { none: "아무도 고르지 않으면 무효표가 돼요", picked: "빈 곳을 누르면 선택이 취소돼요" });
  assert.equal(Object.isFrozen(CANDIDATE_GUIDE), true);
  assert.equal(BLANK_TAP_E2E_MARGIN, 16);
});

test("candidateGuideChecks P11: 맞는 문장이고 한 줄이면 통과한다 (고르기 전·고른 뒤)", () => {
  const none = candidateGuideChecks({ bottom: { guide: CANDIDATE_GUIDE.none, guideH: 20, guideLH: 20 } }, { picked: false });
  assert.equal(none.id, "P11");
  assert.equal(none.ok, true, none.detail);
  const picked = candidateGuideChecks({ bottom: { guide: CANDIDATE_GUIDE.picked, guideH: 20, guideLH: 20 } }, { picked: true });
  assert.equal(picked.ok, true, picked.detail);
});

test("candidateGuideChecks P11: 다른 문장·두 줄·측정값 없음은 실패한다", () => {
  const wrong = candidateGuideChecks({ bottom: { guide: CANDIDATE_GUIDE.picked, guideH: 20, guideLH: 20 } }, { picked: false });
  assert.equal(wrong.ok, false);
  assert.match(wrong.detail, /무효표|취소/);
  const two = candidateGuideChecks({ bottom: { guide: CANDIDATE_GUIDE.none, guideH: 40, guideLH: 20 } }, { picked: false });
  assert.equal(two.ok, false);
  assert.match(two.detail, /줄/);
  for (const bottom of [undefined, { guide: CANDIDATE_GUIDE.none }, { guide: CANDIDATE_GUIDE.none, guideH: 20 }, { guideH: 20, guideLH: 20 }]) {
    const r = candidateGuideChecks({ bottom }, { picked: false });
    assert.equal(r.ok, false);
    assert.match(r.detail, /측정값 없음/);
  }
});

test("cancelTapChecks P12: 이름표 탭 뒤 표가 남고 빈 곳 탭 뒤 풀리면 통과한다", () => {
  const r = cancelTapChecks({
    chosenSeat: 2,
    afterTag: { voteTarget: 2, pill: "민지님에게 투표했어요" },
    afterBlank: { voteTarget: undefined, pill: "선택 안 함", halos: 0 },
  });
  assert.equal(r.id, "P12");
  assert.equal(r.ok, true, r.detail);
  assert.equal(cancelTapChecks({ chosenSeat: 2, afterTag: { voteTarget: 2, pill: "x님에게 투표했어요" }, afterBlank: { voteTarget: null, pill: "선택 안 함", halos: 0 } }).ok, true);
});

test("cancelTapChecks P12: 이름표 탭에 취소되면 `이름표`, 빈 곳 탭에 안 풀리면 `빈 곳` 사유로 실패한다", () => {
  const tagCancelled = cancelTapChecks({
    chosenSeat: 2,
    afterTag: { voteTarget: undefined, pill: "선택 안 함" },
    afterBlank: { voteTarget: undefined, pill: "선택 안 함", halos: 0 },
  });
  assert.equal(tagCancelled.ok, false);
  assert.match(tagCancelled.detail, /이름표/);
  const notCleared = cancelTapChecks({
    chosenSeat: 2,
    afterTag: { voteTarget: 2, pill: "민지님에게 투표했어요" },
    afterBlank: { voteTarget: 2, pill: "민지님에게 투표했어요", halos: 1 },
  });
  assert.equal(notCleared.ok, false);
  assert.match(notCleared.detail, /빈 곳/);
  const haloLeft = cancelTapChecks({
    chosenSeat: 2,
    afterTag: { voteTarget: 2, pill: "민지님에게 투표했어요" },
    afterBlank: { voteTarget: undefined, pill: "선택 안 함", halos: 1 },
  });
  assert.equal(haloLeft.ok, false);
});

test("cancelTapChecks P12: 값이 없으면 `측정값 없음` 으로 실패한다 (건너뛰지 않는다)", () => {
  for (const arg of [
    { chosenSeat: 2, afterTag: null, afterBlank: { voteTarget: undefined, pill: "선택 안 함", halos: 0 } },
    { chosenSeat: 2, afterTag: { voteTarget: 2, pill: "x님에게 투표했어요" }, afterBlank: null },
    { chosenSeat: null, afterTag: { voteTarget: 2, pill: "x님에게 투표했어요" }, afterBlank: { voteTarget: undefined, pill: "선택 안 함", halos: 0 } },
  ]) {
    const r = cancelTapChecks(arg);
    assert.equal(r.ok, false);
    assert.match(r.detail, /측정값 없음/);
  }
});

test("blankPointsOf: scene 을 margin 만큼 줄인 안쪽 격자에서 avoid 상자(margin 넓힘) 밖인 점을 위→아래·왼→오른 순서로 돌려준다", () => {
  const scene = { left: 0, top: 0, width: 100, height: 60 };
  const pts = blankPointsOf({ scene, avoid: [{ left: 40, top: 20, width: 20, height: 20 }], margin: 10, step: 10, limit: 200 });
  assert.ok(pts.length > 0);
  // 안쪽 범위: x 10..90, y 10..50
  for (const p of pts) {
    assert.ok(p.x >= 10 && p.x <= 90 && p.y >= 10 && p.y <= 50, `scene 안쪽 ${JSON.stringify(p)}`);
    const inside = p.x >= 40 - 10 && p.x <= 60 + 10 && p.y >= 20 - 10 && p.y <= 40 + 10;
    assert.equal(inside, false, `avoid 밖 ${JSON.stringify(p)}`);
  }
  assert.deepEqual(pts[0], { x: 10, y: 10 });
  const order = pts.map((p) => p.y * 1000 + p.x);
  assert.deepEqual(order, [...order].sort((a, b) => a - b));
  assert.deepEqual(pts, blankPointsOf({ scene, avoid: [{ left: 40, top: 20, width: 20, height: 20 }], margin: 10, step: 10, limit: 200 }));
});

test("blankPointsOf: limit 로 자르고, 너비·높이 0 인 avoid 는 무시하며, 다 덮이면 [] 이다", () => {
  const scene = { left: 0, top: 0, width: 100, height: 60 };
  assert.equal(blankPointsOf({ scene, avoid: [], margin: 10, step: 10, limit: 3 }).length, 3);
  const zero = blankPointsOf({ scene, avoid: [{ left: 0, top: 0, width: 0, height: 50 }, { left: 0, top: 0, width: 50, height: 0 }], margin: 10, step: 10 });
  assert.equal(zero[0].x, 10);
  assert.deepEqual(blankPointsOf({ scene, avoid: [{ left: 0, top: 0, width: 100, height: 60 }], margin: 10, step: 10 }), []);
  assert.deepEqual(blankPointsOf({ scene: { left: 0, top: 0, width: 10, height: 10 }, avoid: [], margin: 10, step: 5 }), []);
});


// ---- 6페이즈 맵 로비·world 흐름 순수 검사 (06-17) ----

const walkSamples = (n = 5, step = 0.09) => Array.from({ length: n }, (_, i) => ({ kind: "walk", t: 1000 + i * 50, p: { x: i * step, z: 1 } }));
const arrivedSample = (x = 3, z = 1) => ({ kind: "arrived", t: 4000, p: { x, z } });

test("worldSyncChecks: 상수는 UI-SPEC 그대로 — 0.3 단위·링 100ms·구간 500ms", () => {
  assert.equal(WORLD_SYNC_TOL, 0.3);
  assert.equal(WORLD_RING_MAX_MS, 100);
  assert.equal(WORLD_SEGMENT_MAX_MS, 500);
  assert.equal(WORLD_MOVED_MIN, 0.1);
});

test("worldSyncChecks W2~W4: 두 페이지가 0.3 이하로 같고 링 100ms·구간 500ms 이내면 세 줄 모두 통과한다", () => {
  const a = [...walkSamples(), arrivedSample()];
  const b = a.map((s) => ({ ...s, p: { x: s.p.x + 0.1, z: s.p.z } }));
  const r = worldSyncChecks({ a, b, ringMs: 40, segmentMs: 120 });
  assert.deepEqual(r.map((x) => x.id), ["W2", "W3", "W4"]);
  for (const x of r) assert.equal(x.ok, true, x.detail);
});

test("worldSyncChecks W2: 0.3 을 넘게 어긋난 표본이 있으면 실패하고 어느 표본인지 말한다 (걷는 중·도착 뒤 모두 본다)", () => {
  const a = [...walkSamples(), arrivedSample()];
  const walkBad = a.map((s, i) => (i === 2 ? { ...s, p: { x: s.p.x + 0.31, z: s.p.z } } : s));
  const w = worldSyncChecks({ a, b: walkBad, ringMs: 10, segmentMs: 10 })[0];
  assert.equal(w.ok, false);
  assert.match(w.detail, /walk 표본 3.*0\.31/);
  const arrivedBad = a.map((s) => (s.kind === "arrived" ? { ...s, p: { x: s.p.x, z: s.p.z + 0.5 } } : s));
  const r = worldSyncChecks({ a, b: arrivedBad, ringMs: 10, segmentMs: 10 })[0];
  assert.equal(r.ok, false);
  assert.match(r.detail, /arrived 표본/);
  // 정확히 0.3 은 통과
  const edge = a.map((s) => (s.kind === "arrived" ? { ...s, p: { x: s.p.x + 0.3, z: s.p.z } } : s));
  assert.equal(worldSyncChecks({ a, b: edge, ringMs: 10, segmentMs: 10 })[0].ok, true);
});

test("worldSyncChecks W2: 걷는 중 표본이 3개 미만이거나 움직이지 않았거나 도착 뒤 표본이 없거나 위치를 못 읽으면 조용히 통과하지 않는다", () => {
  const same = (a) => a.map((s) => ({ ...s }));
  const few = [...walkSamples(2), arrivedSample()];
  assert.match(worldSyncChecks({ a: few, b: same(few), ringMs: 1, segmentMs: 1 })[0].detail, /걷는 중 표본 2개/);
  const still = [...walkSamples(5, 0), arrivedSample()];
  assert.match(worldSyncChecks({ a: still, b: same(still), ringMs: 1, segmentMs: 1 })[0].detail, /움직이지 않음/);
  const noArrive = walkSamples();
  assert.match(worldSyncChecks({ a: noArrive, b: same(noArrive), ringMs: 1, segmentMs: 1 })[0].detail, /도착 뒤 표본 없음/);
  const a = [...walkSamples(), arrivedSample()];
  const nullB = a.map((s, i) => (i === 1 ? { ...s, p: null } : s));
  assert.match(worldSyncChecks({ a, b: nullB, ringMs: 1, segmentMs: 1 })[0].detail, /위치를 읽지 못함/);
  assert.match(worldSyncChecks({ a: [], b: [], ringMs: 1, segmentMs: 1 })[0].detail, /측정값 없음/);
  assert.match(worldSyncChecks({ a: undefined, b: undefined, ringMs: 1, segmentMs: 1 })[0].detail, /측정값 없음/);
  const diffT = a.map((s, i) => (i === 0 ? { ...s, t: s.t + 1 } : s));
  assert.match(worldSyncChecks({ a, b: diffT, ringMs: 1, segmentMs: 1 })[0].detail, /시각 t 가 다름/);
});

test("worldSyncChecks W3·W4: 링 100ms·구간 500ms 를 넘거나 측정값이 없으면 실패한다 (경계 값은 통과)", () => {
  const a = [...walkSamples(), arrivedSample()];
  const b = a.map((s) => ({ ...s }));
  const ok = worldSyncChecks({ a, b, ringMs: 100, segmentMs: 500 });
  assert.equal(ok[1].ok, true);
  assert.equal(ok[2].ok, true);
  const slow = worldSyncChecks({ a, b, ringMs: 101, segmentMs: 501 });
  assert.equal(slow[1].ok, false);
  assert.match(slow[1].detail, /101ms > 100ms/);
  assert.equal(slow[2].ok, false);
  const none = worldSyncChecks({ a, b, ringMs: undefined, segmentMs: Number.NaN });
  assert.match(none[1].detail, /측정값 없음/);
  assert.match(none[2].detail, /측정값 없음/);
});

const nameTag = (over = {}) => ({ seat: 0, text: "방장이름여덟글자 (나)", scrollWidth: 120, clientWidth: 120, textOverflow: "clip", fontSize: 14, ...over });

test("nameTagFitChecks NT1: 넘침 없음·말줄임 아님·14px 이상이면 통과하고, 기대한 글자가 화면에 있어야 한다", () => {
  const r = nameTagFitChecks([nameTag(), nameTag({ seat: 1, text: "봇가나다라마바사" })], { expectTexts: ["방장이름여덟글자 (나)"] });
  assert.equal(r.id, "NT1");
  assert.equal(r.ok, true, r.detail);
  assert.equal(NAMETAG_FONT_MIN, 14);
  const missing = nameTagFitChecks([nameTag()], { expectTexts: ["없는이름"] });
  assert.equal(missing.ok, false);
  assert.match(missing.detail, /없는이름/);
});

test("nameTagFitChecks NT1: scrollWidth ≠ clientWidth·ellipsis·14px 미만·측정값 없음은 실패한다", () => {
  const over = nameTagFitChecks([nameTag({ scrollWidth: 130 })]);
  assert.equal(over.ok, false);
  assert.match(over.detail, /scrollWidth 130 ≠ clientWidth 120/);
  const ell = nameTagFitChecks([nameTag({ textOverflow: "ellipsis" })]);
  assert.equal(ell.ok, false);
  assert.match(ell.detail, /text-overflow ellipsis/);
  const small = nameTagFitChecks([nameTag({ fontSize: 13 })]);
  assert.equal(small.ok, false);
  assert.match(small.detail, /13px/);
  assert.match(nameTagFitChecks([]).detail, /측정값 없음/);
  assert.match(nameTagFitChecks(undefined).detail, /측정값 없음/);
  assert.match(nameTagFitChecks([nameTag({ scrollWidth: undefined })]).detail, /측정값 없음/);
  assert.equal(nameTagFitChecks([nameTag({ fontSize: undefined })]).ok, false);
});

test("cssAlpha: rgba·rgb·공백 문법·transparent 를 알파로 읽고 못 읽으면 NaN", () => {
  assert.equal(cssAlpha("rgba(14, 19, 38, 0.92)"), 0.92);
  assert.equal(cssAlpha("rgba(14, 19, 38, 0.8)"), 0.8);
  assert.equal(cssAlpha("rgb(14, 19, 38)"), 1);
  assert.equal(cssAlpha("rgb(14 19 38 / 0.5)"), 0.5);
  assert.equal(cssAlpha("rgb(14 19 38 / 50%)"), 0.5);
  assert.equal(cssAlpha("transparent"), 0);
  assert.ok(Number.isNaN(cssAlpha("")));
  assert.ok(Number.isNaN(cssAlpha(undefined)));
  assert.ok(Number.isNaN(cssAlpha("불투명")));
  assert.equal(TAG_FRONT_ALPHA_MIN, 0.9);
  assert.equal(TAG_BASE_ALPHA_MAX, 0.85);
});

const STRONG = "rgba(14, 19, 38, 0.92)";
const BASE = "rgba(14, 19, 38, 0.8)";

test("tagStackChecks NT3: 겹친 이름표는 z-index 가 달라야 하고 같거나 못 읽으면 실패, 안 겹치면 z 가 같아도 통과한다", () => {
  const t = (seat, left, z, face = BASE, me = false) => ({ seat, me, rect: rect(left, 100, 100, 24), z, face });
  assert.equal(tagStackChecks([t(0, 100, 3), t(1, 150, 4, STRONG)]).ok, true);
  assert.equal(tagStackChecks([t(0, 100, 3), t(1, 300, 3)]).ok, true);
  const same = tagStackChecks([t(0, 100, 3), t(1, 150, 3, STRONG)]);
  assert.equal(same.ok, false);
  assert.match(same.detail, /z-index 가 같음/);
  assert.match(tagStackChecks([t(0, 100, Number.NaN), t(1, 150, 3)]).detail, /z-index 를 읽지 못함/);
  assert.match(tagStackChecks([]).detail, /측정값 없음/);
});

test("tagStackChecks NT3: 내 이름표가 맨 위여야 한다 — 겹치는 쌍에서 내 이름표가 위이고 면이 0.92 이면 통과, 내가 아래이면 실패하고 자리를 말한다", () => {
  const t = (seat, left, z, face, me = false) => ({ seat, me, rect: rect(left, 100, 100, 24), z, face });
  const ok = tagStackChecks([t(0, 100, 4, STRONG, true), t(1, 150, 3, BASE)]);
  assert.equal(ok.id, "NT3");
  assert.equal(ok.ok, true, ok.detail);
  const below = tagStackChecks([t(0, 100, 3, BASE, true), t(1, 150, 4, STRONG)]);
  assert.equal(below.ok, false);
  assert.match(below.detail, /내 이름표/);
  assert.match(below.detail, /자리 0/);
  // 멀리 떨어진 이름표라도 내 이름표는 모두의 위여야 한다(순위는 전체에서 정해진다)
  const far = tagStackChecks([t(0, 100, 1, BASE, true), t(1, 600, 4, BASE)]);
  assert.equal(far.ok, false);
  assert.match(far.detail, /내 이름표/);
});

test("tagStackChecks NT3: 맨 앞 겹침 이름표의 면은 0.9 이상, 겹치지 않는 이름표의 면은 0.85 이하", () => {
  const t = (seat, left, z, face, me = false) => ({ seat, me, rect: rect(left, 100, 100, 24), z, face });
  const flat = tagStackChecks([t(0, 100, 4, BASE, true), t(1, 150, 3, BASE)]);
  assert.equal(flat.ok, false);
  assert.match(flat.detail, /맨 앞/);
  assert.match(flat.detail, /0\.8/);
  const lone = tagStackChecks([t(0, 100, 4, STRONG, true), t(1, 150, 3, BASE), t(2, 500, 1, STRONG)]);
  assert.equal(lone.ok, false);
  assert.match(lone.detail, /자리 2/);
  assert.match(lone.detail, /겹치지 않/);
  // 겹쳤지만 맨 앞이 아닌 이름표는 면 제한이 없다
  assert.equal(tagStackChecks([t(0, 100, 4, STRONG, true), t(1, 150, 3, BASE), t(2, 160, 2, BASE)]).ok, true);
  // 사슬 A–B, B–C: C 만 맨 앞
  assert.equal(tagStackChecks([t(0, 100, 1, BASE), t(1, 170, 2, BASE), t(2, 240, 3, STRONG)]).ok, true);
});

test("tagStackChecks NT3: 면 색을 읽지 못하면 측정값 없음(면 색)으로 실패한다", () => {
  const t = (seat, left, z, face, me = false) => ({ seat, me, rect: rect(left, 100, 100, 24), z, face });
  const front = tagStackChecks([t(0, 100, 4, undefined, true), t(1, 150, 3, BASE)]);
  assert.equal(front.ok, false);
  assert.match(front.detail, /측정값 없음\(면 색\)/);
  const lone = tagStackChecks([t(0, 100, 4, "", true)]);
  assert.equal(lone.ok, false);
  assert.match(lone.detail, /측정값 없음\(면 색\)/);
});

test("ownTagInStageChecks NT4: 스테이지 사각형 안이면 통과, 어느 변이든 넘으면 실패하고 방향을 말한다", () => {
  const stage = { left: 0, top: 62, right: 360, bottom: 552 };
  assert.equal(ownTagInStageChecks(rect(80, 300, 200, 24), stage).ok, true);
  assert.match(ownTagInStageChecks(rect(-10, 300, 200, 24), stage).detail, /왼쪽/);
  assert.match(ownTagInStageChecks(rect(200, 300, 200, 24), stage).detail, /오른쪽/);
  assert.match(ownTagInStageChecks(rect(80, 40, 200, 24), stage).detail, /위/);
  assert.match(ownTagInStageChecks(rect(80, 540, 200, 24), stage).detail, /아래/);
  assert.match(ownTagInStageChecks(null, stage).detail, /측정값 없음/);
  assert.match(ownTagInStageChecks(rect(80, 300, 200, 24), null).detail, /측정값 없음/);
});

const btn = (left, top, w = 44, h = 44, hit = true) => ({ rect: rect(left, top, w, h), hit });

test("lobbyHeaderChecks L7: 두 버튼이 44px 이상·화면 안·안 겹침·눌림이면 통과하고 하나라도 어긋나면 실패한다", () => {
  const good = { leave: btn(16, 18), share: btn(300, 18) };
  const r = lobbyHeaderChecks(good, { w: 360, h: 640 });
  assert.equal(r.id, "L7");
  assert.equal(r.ok, true, r.detail);
  assert.match(lobbyHeaderChecks({ leave: btn(16, 18, 40, 44), share: good.share }, { w: 360, h: 640 }).detail, /\[나가기\] 40x44/);
  assert.match(lobbyHeaderChecks({ leave: good.leave, share: btn(330, 18) }, { w: 360, h: 640 }).detail, /\[공유\] 가 화면 밖/);
  assert.match(lobbyHeaderChecks({ leave: btn(16, 18), share: btn(40, 18) }, { w: 360, h: 640 }).detail, /겹침/);
  assert.match(lobbyHeaderChecks({ leave: btn(16, 18, 44, 44, false), share: good.share }, { w: 360, h: 640 }).detail, /elementFromPoint/);
  assert.match(lobbyHeaderChecks({ leave: null, share: good.share }, { w: 360, h: 640 }).detail, /측정값 없음/);
  assert.match(lobbyHeaderChecks(null, { w: 360, h: 640 }).detail, /측정값 없음/);
});

const startBtn = (over = {}) => ({ ariaDisabled: null, opacity: 1, dots: 8, dotsOn: 4, rect: rect(16, 540, 328, 52), hit: true, ...over });

test("lobbyStartChecks L8: 1명은 흐림, 4명은 활성, 8명은 점 8개가 모두 켜져야 통과한다", () => {
  const one = lobbyStartChecks(startBtn({ ariaDisabled: "true", opacity: 0.45, dotsOn: 1 }), { n: 1 });
  assert.equal(one.id, "L8");
  assert.equal(one.ok, true, one.detail);
  assert.equal(lobbyStartChecks(startBtn(), { n: 4 }).ok, true);
  assert.equal(lobbyStartChecks(startBtn({ dotsOn: 8 }), { n: 8 }).ok, true);
  assert.equal(lobbyStartChecks(startBtn({ ariaDisabled: "true", opacity: 0.45, dotsOn: 3 }), { n: 3 }).ok, true);
});

test("lobbyStartChecks L8: 1명인데 활성·4명인데 흐림·점 개수 어긋남·측정값 없음은 실패한다", () => {
  assert.match(lobbyStartChecks(startBtn({ dotsOn: 1 }), { n: 1 }).detail, /흐려야 하는데/);
  assert.match(lobbyStartChecks(startBtn({ ariaDisabled: "true", opacity: 0.45 }), { n: 4 }).detail, /활성이어야 하는데/);
  assert.match(lobbyStartChecks(startBtn({ opacity: 0.45 }), { n: 4 }).detail, /불투명도 0\.45/);
  assert.match(lobbyStartChecks(startBtn({ dots: 7 }), { n: 4 }).detail, /점 7개 ≠ 8/);
  assert.match(lobbyStartChecks(startBtn({ dotsOn: 5 }), { n: 4 }).detail, /켜진 점 5개 ≠ 4/);
  assert.match(lobbyStartChecks(startBtn({ rect: rect(16, 540, 328, 40) }), { n: 4 }).detail, /높이 40/);
  assert.match(lobbyStartChecks(null, { n: 4 }).detail, /측정값 없음/);
});

test("graphemeCount: 전각 8자 8개, 이모지 8개 8개, 결합 문자 한 글자, 5자 5개", () => {
  assert.equal(graphemeCount("방장이름여덟글자"), 8);
  assert.equal(graphemeCount("😀😃😄😁😆😅🤣😂"), 8);
  assert.equal(graphemeCount("화면검사기"), 5);
  assert.equal(graphemeCount("e\u0301"), 1);
  assert.equal(graphemeCount(undefined), 0);
});

const MAP_SRC = readFileSync(new URL("../../shared/game/map.ts", import.meta.url), "utf8");

test("parseBarMask·walkableCenters: shared/game/map.ts 원문에서 28줄 마스크를 읽고 칸 중심은 −7 + 0.5c + 0.25", () => {
  const rows = parseBarMask(MAP_SRC);
  assert.equal(rows.length, 28);
  assert.ok(rows.every((r) => r.length === 28));
  const centers = walkableCenters(rows);
  assert.equal(centers.length, rows.join("").split(".").length - 1);
  const first = centers[0];
  assert.deepEqual(first, { x: -7 + rows[2].indexOf(".") * 0.5 + 0.25, z: -7 + 2 * 0.5 + 0.25 });
  assert.throws(() => parseBarMask("export const X = 1;"), /BAR_MASK/);
  assert.throws(() => parseBarMask('export const BAR_MASK: readonly string[] = ["..", "."];'), /정사각/);
});

test("pickTapTargets: minDist 이상만, 먼 순서, visible 이 거짓인 점은 뺀다", () => {
  const centers = [{ x: 0, z: 0 }, { x: 1, z: 0 }, { x: 4, z: 0 }, { x: 6, z: 0 }];
  const all = pickTapTargets(centers, { x: 0, z: 0 }, { minDist: 3 });
  assert.deepEqual(all.map((p) => p.x), [6, 4]);
  const hidden = pickTapTargets(centers, { x: 0, z: 0 }, { minDist: 3, visible: (x) => x < 5 });
  assert.deepEqual(hidden.map((p) => p.x), [4]);
  assert.deepEqual(pickTapTargets(centers, { x: 0, z: 0 }, { minDist: 99 }), []);
});


// ---- 06-17 Task 2: LOBBY_SIZES·extraSizes·결정 0056 완화 범위 ----

test("LOBBY_SIZES: DEFAULT_SIZES 4개 + 390x844 + 402x874 여섯 개이고 LOBBY_EXTRA_SIZES 는 더해진 두 개다 (DEFAULT_SIZES 는 그대로)", () => {
  assert.deepEqual(LOBBY_SIZES.map((x) => x.label), ["360x640", "390x664", "430x932", "360x560", "390x844", "402x874"]);
  assert.deepEqual(LOBBY_SIZES.map((x) => [x.w, x.h]), [[360, 640], [390, 664], [430, 932], [360, 560], [390, 844], [402, 874]]);
  assert.deepEqual(LOBBY_EXTRA_SIZES.map((x) => x.label), ["390x844", "402x874"]);
  assert.deepEqual(DEFAULT_SIZES.map((x) => x.label), ["360x640", "390x664", "430x932", "360x560"]);
});

test("run.mjs: 흐름별 extraSizes 는 --sizes 를 주지 않았을 때만 더하고, FLOWS 의 lobby·world 만 갖는다", () => {
  const run = readFileSync(new URL("./run.mjs", import.meta.url), "utf8");
  assert.match(run, /extraSizes/);
  assert.match(run, /!args\.sizesGiven/);
  const flows = readFileSync(new URL("./flows.mjs", import.meta.url), "utf8");
  const entries = [...flows.matchAll(/\{ id: "([a-z0-9-]+)", run: [A-Za-z(), ]+?(, extraSizes: LOBBY_EXTRA_SIZES)? \}/g)];
  const withExtra = entries.filter((m) => m[2]).map((m) => m[1]);
  assert.deepEqual(withExtra, ["lobby", "world"]);
});

const wideTag = (seat, left, name) => ({ seat, rect: rect(left, 100, 100, 22), name });

test("결정 0056 D9: 6 그래핌 이상 이름이 낀 겹침만 완화(통과 + relaxed + 쌍 표시), 6자 미만끼리·이름 모름은 그대로 실패한다", () => {
  assert.equal(WIDE_NAME_GRAPHEMES, 6);
  const wide = tagsOverlap([wideTag(0, 100, "화면검사기"), wideTag(1, 150, "봇가나다라마바사")]);
  assert.equal(wide.ok, true, wide.detail);
  assert.equal(wide.relaxed, true);
  assert.match(wide.detail, /승인 완화\(D9-8ch, 결정 0056\)/);
  assert.match(wide.detail, /0-1/);
  // 6자 정확히도 범위
  assert.equal(tagsOverlap([wideTag(0, 100, "가나다라마바"), wideTag(1, 150, "가나다")]).relaxed, true);
  // 5자끼리는 범위 밖: 그대로 실패
  const narrow = tagsOverlap([wideTag(0, 100, "화면검사기"), wideTag(1, 150, "가나다라마")]);
  assert.equal(narrow.ok, false);
  assert.equal(narrow.relaxed, undefined);
  assert.match(narrow.detail, /0-1/);
  // 이름을 모르는 이름표(name 없음)는 범위 밖
  assert.equal(tagsOverlap([{ seat: 0, rect: rect(100, 100, 100, 22) }, { seat: 1, rect: rect(150, 100, 100, 22) }]).ok, false);
  // 범위 안 쌍과 범위 밖 쌍이 같이 있으면 범위 밖 쌍 때문에 실패
  const mixed = tagsOverlap([wideTag(0, 100, "봇가나다라마바사"), wideTag(1, 150, "가나다"), wideTag(2, 400, "라마바"), wideTag(3, 450, "사아자")]);
  assert.equal(mixed.ok, false);
  assert.match(mixed.detail, /2-3/);
  assert.doesNotMatch(mixed.detail, /0-1/);
  // 겹치지 않으면 완화 표시 없이 통과
  const none = tagsOverlap([wideTag(0, 100, "봇가나다라마바사"), wideTag(1, 300, "봇거너더러머버서")]);
  assert.equal(none.ok, true);
  assert.equal(none.relaxed, undefined);
  assert.equal(none.detail, "");
  // 겹침 기준(0.5px)은 그대로: 변이 맞닿거나 0.5px 이하 겹침은 겹침이 아니다
  assert.equal(tagsOverlap([wideTag(0, 100, "봇가나다라마바사"), wideTag(1, 199.5, "봇거너더러머버서")]).relaxed, undefined);
});

test("결정 0056 D3b: 6 그래핌 이상 이름표의 바닥 미달만 완화(표시), 바닥 수치는 그대로이고 6자 미만 이름표의 미달은 실패한다", () => {
  const withN = (n, ratio, lowSeat, nameOfLow) => {
    const s = daySnap();
    s.tagVisibility = Array.from({ length: n }, (_, i) => ({ seat: i, ratio: i === lowSeat ? ratio : 1 }));
    s.tags = Array.from({ length: n }, (_, i) => ({ seat: i, rect: rect(20 + i * 5, 300, 72, 22), z: 1, lines: 1, hasDot: true, name: i === lowSeat ? nameOfLow : "가나다" }));
    return dayById(dayChecks(s, size), "D3b");
  };
  const relaxed = withN(8, 0.4, 5, "봇가나다라마바사");
  assert.equal(relaxed.ok, true, relaxed.detail);
  assert.equal(relaxed.relaxed, true);
  assert.match(relaxed.detail, /승인 완화\(D3b-8ch, 결정 0056\)/);
  assert.match(relaxed.detail, /8명판 자리 5/);
  assert.match(relaxed.detail, /8자/);
  // 같은 미달이어도 이름이 짧으면 실패
  const short = withN(8, 0.4, 5, "가나다라마");
  assert.equal(short.ok, false);
  assert.equal(short.relaxed, undefined);
  assert.match(short.detail, /자리 5/);
  // 이름을 모르면 실패
  assert.equal(withN(8, 0.4, 5, undefined).ok, false);
  // 바닥 이상이면 완화 표시도 없다 (바닥 수치 불변)
  const fine = withN(8, 0.55, 5, "봇가나다라마바사");
  assert.equal(fine.ok, true);
  assert.equal(fine.relaxed, undefined);
  assert.equal(fine.detail, "");
  // 이미지 미로드는 이름과 무관하게 실패
  const s = daySnap();
  s.tagVisibility = [{ seat: 0, ratio: null }];
  s.tags = [{ seat: 0, rect: rect(20, 300, 72, 22), z: 1, lines: 1, hasDot: true, name: "봇가나다라마바사" }];
  assert.equal(dayById(dayChecks(s, size), "D3b").ok, false);
});


// ---- 결정 0056 개정(2026-11-01): G2·D2·P10 도 같은 범위(v1.0 고정 테이블 이름표·칩 + 6 그래핌 이상 이름) ----

test("결정 0056 개정 G2: 6 그래핌 이상 이름의 고정 테이블 이름표 요소가 화면 밖이면 완화(통과+표시), 그 밖의 화면 밖 요소·짧은 이름 이름표는 그대로 실패한다", () => {
  const withEls = (els) => {
    const s = cleanSnap();
    s.elements = [...s.elements, ...els];
    return byId(genericIssues(s, { w: 360, h: 640 }), "G2");
  };
  const tagOut = { desc: 'div.mf-dt__tag"봇가나다라마바사"', rect: rect(-17.7, 300, 133, 22), fixedTagName: "봇가나다라마바사" };
  const dotOut = { desc: "i.mf-dt__dot", rect: rect(-9.7, 304, 8, 8), fixedTagName: "봇가나다라마바사" };
  // 범위 안: 완화
  const inScope = withEls([tagOut, dotOut]);
  assert.equal(inScope.ok, true, inScope.detail);
  assert.equal(inScope.relaxed, true);
  assert.match(inScope.detail, /승인 완화\(G2-8ch, 결정 0056\)/);
  assert.match(inScope.detail, /2개/);
  // 범위 밖: 이름표가 아닌 요소가 화면 밖
  const other = withEls([{ desc: "div.mf-other", rect: rect(300, 10, 100, 20), fixedTagName: null }]);
  assert.equal(other.ok, false);
  assert.equal(other.relaxed, undefined);
  assert.match(other.detail, /div\.mf-other/);
  // 범위 밖: 5자 이름 이름표가 화면 밖
  assert.equal(withEls([{ ...tagOut, fixedTagName: "화면검사기" }]).ok, false);
  // 범위 밖: 이름 정보가 없으면(측정 안 됨) 완화하지 않는다
  assert.equal(withEls([{ desc: "div.mf-dt__tag", rect: rect(-5, 300, 100, 22) }]).ok, false);
  // 섞이면 범위 밖 요소 때문에 실패하고 완화 표시는 없다
  const mixed = withEls([tagOut, { desc: "div.mf-other", rect: rect(300, 10, 100, 20), fixedTagName: null }]);
  assert.equal(mixed.ok, false);
  assert.doesNotMatch(mixed.detail, /mf-dt__tag/);
  // 화면 가로 기준은 그대로: 안쪽이면 완화 표시도 없다
  const inside = withEls([{ ...tagOut, rect: rect(0, 300, 133, 22) }]);
  assert.equal(inside.ok, true);
  assert.equal(inside.relaxed, undefined);
});

test("결정 0056 개정 D2: 6 그래핌 이상 이름 이름표의 장면 밖만 완화, 짧은 이름 이름표의 장면 밖과 하단 패널 겹침은 이름과 무관하게 실패한다", () => {
  const withTag = (rectOfTag, name) => {
    const s = daySnap();
    s.tags = [{ seat: 1, rect: rectOfTag, z: 1, lines: 1, hasDot: true, name }, ...s.tags.slice(1)];
    return dayById(dayChecks(s, size), "D2");
  };
  const out = rect(-17.7, 300, 133, 22); // scene 은 0~360
  const relaxed = withTag(out, "봇가나다라마바사");
  assert.equal(relaxed.ok, true, relaxed.detail);
  assert.equal(relaxed.relaxed, true);
  assert.match(relaxed.detail, /승인 완화\(D2-8ch, 결정 0056\)/);
  assert.match(relaxed.detail, /자리 1/);
  assert.equal(withTag(out, "화면검사기").ok, false);
  assert.equal(withTag(out, undefined).ok, false);
  // 패널과 겹침은 긴 이름이어도 실패
  const overPanel = withTag(rect(20, 470, 133, 30), "봇가나다라마바사");
  assert.equal(overPanel.ok, false);
  assert.match(overPanel.detail, /하단 패널/);
  // 장면 안이면 완화 표시 없음
  const fine = withTag(rect(20, 300, 133, 22), "봇가나다라마바사");
  assert.equal(fine.ok, true);
  assert.equal(fine.relaxed, undefined);
});

test("결정 0056 개정 P10: 칩이 6 그래핌 이상 이름의 이름표와 겹친 것만 완화, 짧은 이름 이름표·헤더·패널·카드 겹침은 그대로 실패한다", () => {
  const snapWith = (tagName, chipRect = rect(150, 200, 36, 32)) => {
    const s = placeSnap();
    s.reveal.chips = [{ seat: 1, n: 2, tone: "lead", ...chipRect }];
    s.reveal.tags = [{ seat: 2, ...rect(140, 190, 70, 40), name: tagName }];
    return s;
  };
  const relaxed = placementChecks(snapWith("봇가나다라마바사"));
  assert.equal(relaxed.ok, true, relaxed.detail);
  assert.equal(relaxed.relaxed, true);
  assert.match(relaxed.detail, /승인 완화\(P10-8ch, 결정 0056\)/);
  assert.match(relaxed.detail, /이름표\(자리 2\)/);
  const short = placementChecks(snapWith("가나다라마"));
  assert.equal(short.ok, false);
  assert.equal(short.relaxed, undefined);
  assert.equal(placementChecks(snapWith(undefined)).ok, false);
  // 긴 이름 이름표와 겹쳐도 칩이 헤더·패널과 겹치면 실패
  const overHeader = placementChecks(snapWith("봇가나다라마바사", rect(150, 100, 36, 32)));
  assert.equal(overHeader.ok, false);
  assert.match(overHeader.detail, /헤더/);
  // 카드가 패널과 겹치면 실패(이름표 완화와 무관)
  const s = snapWith("봇가나다라마바사");
  s.card = { rect: rect(55, 500, 280, 176) };
  const card = placementChecks(s);
  assert.equal(card.ok, false);
  assert.match(card.detail, /카드/);
  // 겹치지 않으면 완화 표시 없음
  const none = placementChecks(snapWith("봇가나다라마바사", rect(300, 400, 36, 32)));
  assert.equal(none.ok, true);
  assert.equal(none.relaxed, undefined);
});

// ---- 재접속·예산·메모리 검사 (06-18) ----

const goodRound = (n, over = {}) => ({ n, console: [], bannerLeft: false, bannerSeen: true, posDiff: 0.001, drift: 0.002, replayed: [], recovered: true, painted: true, ...over });
const rounds10 = (over = {}) => Array.from({ length: 10 }, (_, i) => goodRound(i + 1, typeof over === "function" ? over(i + 1) : over));

test("재접속 상수: 종류마다 10회·복구 2.5초·다섯 종류·예산 120/3·열고 닫기 5회", () => {
  assert.equal(RECONNECT_ROUNDS, 10);
  assert.equal(RESTORED_GONE_MS, 2500);
  assert.deepEqual(RECONNECT_KINDS.map((k) => k.id), ["offline", "frozen", "reload", "lose", "lose-idle"]);
  assert.equal(DRAW_CALL_BUDGET, 120);
  assert.equal(POINT_LIGHT_BUDGET, 3);
  assert.equal(REOPEN_ROUNDS, 5);
  // 끊김 종류만 띠가 떠야 하고, WebGL 두 종류만 다시 그려졌는지를 본다
  assert.deepEqual(RECONNECT_KINDS.filter((k) => k.requireBannerSeen).map((k) => k.id), ["offline"]);
  assert.deepEqual(RECONNECT_KINDS.filter((k) => k.requirePainted).map((k) => k.id), ["lose", "lose-idle"]);
});

test("consoleIssues: warning·error 만 보고, 허용 목록에 없는 것은 모두 issues 로 남는다", () => {
  const r = consoleIssues(
    [
      { type: "log", text: "THREE.WebGLRenderer: Context Lost." },
      { type: "debug", text: "[vite] connected." },
      { type: "warning", text: "THREE.WebGLRenderer: WEBGL_lose_context extension not supported." },
      { type: "error", text: "Uncaught TypeError: x" },
    ],
    { kind: "lose" },
  );
  assert.equal(r.issues.length, 2);
  assert.match(r.issues[0], /\[warning\] THREE.*extension not supported/);
  assert.match(r.issues[1], /\[error\] Uncaught/);
  assert.deepEqual(r.allowed, {});
  assert.deepEqual(consoleIssues(undefined), { issues: [], allowed: {} });
});

test("consoleIssues: 허용 목록은 이유·종류·로컬 조건이 맞을 때만 적용된다 (앱이 낸 경고는 어느 종류에서도 허용되지 않는다)", () => {
  const preload = { type: "warning", text: "The resource http://localhost:5173/journals/a.svg was preloaded using link preload but not used within a few seconds from the window's load event." };
  assert.deepEqual(consoleIssues([preload], { kind: "frozen" }), { issues: [], allowed: { "preload-unused": 1 } });
  const off = { type: "error", text: "WebSocket connection to 'ws://localhost:5173/api/rooms/1/ws' failed: Error in connection establishment: net::ERR_INTERNET_DISCONNECTED" };
  assert.equal(consoleIssues([off], { kind: "offline" }).issues.length, 0);
  assert.equal(consoleIssues([off], { kind: "frozen" }).issues.length, 1); // 오프라인 종류가 아니면 허용하지 않는다
  assert.equal(consoleIssues([{ type: "error", text: "Failed to load resource: net::ERR_CONNECTION_REFUSED" }], { kind: "offline" }).issues.length, 1); // 다른 네트워크 오류는 아니다
  const dev = { type: "warning", text: "WebSocket connection to 'ws://localhost:5173/api/rooms/8961/ws' failed: WebSocket is closed before the connection is established." };
  assert.equal(consoleIssues([dev], { kind: "reload", local: true }).issues.length, 0);
  assert.equal(consoleIssues([dev], { kind: "reload", local: false }).issues.length, 1); // 배포 주소에서는 허용하지 않는다
  assert.equal(consoleIssues([dev], { kind: "offline", local: true }).issues.length, 1);
  for (const a of CONSOLE_ALLOW) assert.ok(a.reason.length > 10, `${a.id} 에 이유가 있다`);
});

test("isLocalOrigin: localhost·127.0.0.1 만 참이고 배포 주소·잘못된 값은 거짓이다 (T-06-41)", () => {
  assert.equal(isLocalOrigin("http://localhost:5173"), true);
  assert.equal(isLocalOrigin("http://127.0.0.1:5173"), true);
  assert.equal(isLocalOrigin("https://minifia-v2.dhplay.workers.dev"), false);
  assert.equal(isLocalOrigin("https://localhost.evil.example"), false);
  assert.equal(isLocalOrigin("not a url"), false);
});

test("reconnectChecks: 열 번 모두 깨끗하면 RC1~RC5 가 통과한다 (끊김 종류는 RC6, WebGL 종류는 RC7 도)", () => {
  const base = reconnectChecks(rounds10());
  assert.deepEqual(base.map((x) => x.id), ["RC5", "RC1", "RC2", "RC3", "RC4"]);
  for (const x of base) assert.equal(x.ok, true, `${x.id} ${x.detail}`);
  const off = reconnectChecks(rounds10(), { requireBannerSeen: true, requirePainted: true });
  assert.deepEqual(off.map((x) => x.id), ["RC5", "RC1", "RC2", "RC3", "RC4", "RC6", "RC7"]);
  for (const x of off) assert.equal(x.ok, true, `${x.id} ${x.detail}`);
});

test("reconnectChecks RC5: 열 번을 채우지 못하거나 복구하지 못한 회가 있으면 실패한다 — 횟수를 줄여 초록을 만들 수 없다", () => {
  const few = reconnectChecks(rounds10().slice(0, 9));
  assert.equal(few.find((x) => x.id === "RC5").ok, false);
  assert.match(few.find((x) => x.id === "RC5").detail, /9\/10/);
  const stuck = reconnectChecks(rounds10((n) => (n === 4 ? { recovered: false } : {})));
  assert.match(stuck.find((x) => x.id === "RC5").detail, /4회/);
  assert.equal(reconnectChecks([]).find((x) => x.id === "RC5").ok, false);
  assert.equal(reconnectChecks(undefined).find((x) => x.id === "RC5").ok, false);
  // 기대 횟수를 바꾸면(deployhold 의 배포 직후 1회) 그 횟수에 맞는다
  assert.equal(reconnectChecks(rounds10().slice(0, 1), { expectedRounds: 1 }).every((x) => x.ok), true);
});

test("reconnectChecks RC1: 콘솔 항목이 하나라도 있으면 실패하고 첫 항목을 보인다, 못 읽은 회는 측정값 없음", () => {
  const r = reconnectChecks(rounds10((n) => (n === 2 ? { console: ["[warning] THREE x", "[error] y"] } : {})));
  const c = r.find((x) => x.id === "RC1");
  assert.equal(c.ok, false);
  assert.match(c.detail, /2회 \[warning\] THREE x 외 1개/);
  const unread = reconnectChecks(rounds10((n) => (n === 3 ? { console: undefined } : {})));
  assert.match(unread.find((x) => x.id === "RC1").detail, /측정값 없음: 3회/);
});

test("reconnectChecks RC2: 띠가 남았거나 못 읽은 회는 실패한다", () => {
  const stuck = reconnectChecks(rounds10((n) => (n === 5 ? { bannerLeft: true } : {})));
  assert.match(stuck.find((x) => x.id === "RC2").detail, /5회 띠가 남음/);
  const unread = reconnectChecks(rounds10((n) => (n === 6 ? { bannerLeft: null } : {})));
  assert.match(unread.find((x) => x.id === "RC2").detail, /6회 측정값 없음/);
});

test("reconnectChecks RC3: 두 페이지 차나 복구 전 대비 어긋남이 0.3 을 넘거나 NaN 이면 실패한다 (경계 0.3 은 통과)", () => {
  const over = reconnectChecks(rounds10((n) => (n === 1 ? { posDiff: 0.31 } : {})));
  assert.equal(over.find((x) => x.id === "RC3").ok, false);
  assert.match(over.find((x) => x.id === "RC3").detail, /1회 두 페이지 차 0\.31/);
  assert.equal(reconnectChecks(rounds10((n) => (n === 1 ? { drift: 0.5 } : {}))).find((x) => x.id === "RC3").ok, false);
  assert.equal(reconnectChecks(rounds10((n) => (n === 1 ? { posDiff: Number.NaN } : {}))).find((x) => x.id === "RC3").ok, false);
  assert.equal(reconnectChecks(rounds10((n) => (n === 1 ? { posDiff: 0.3, drift: 0.3 } : {}))).find((x) => x.id === "RC3").ok, true);
});

test("reconnectChecks RC4: 복구 뒤 입장·퇴장 알림이 다시 뜨면 실패한다", () => {
  const r = reconnectChecks(rounds10((n) => (n === 7 ? { replayed: ["손님 님 입장"] } : {})));
  assert.equal(r.find((x) => x.id === "RC4").ok, false);
  assert.match(r.find((x) => x.id === "RC4").detail, /7회 손님 님 입장/);
});

test("reconnectChecks RC6·RC7: 끊겨도 띠가 안 뜨거나 다시 그리지 못한 회가 있으면 해당 종류만 실패한다", () => {
  const noBanner = reconnectChecks(rounds10((n) => (n === 8 ? { bannerSeen: false } : {})), { requireBannerSeen: true });
  assert.match(noBanner.find((x) => x.id === "RC6").detail, /8회/);
  const flat = reconnectChecks(rounds10((n) => (n === 9 ? { painted: false } : n === 10 ? { painted: null } : {})), { requirePainted: true });
  assert.match(flat.find((x) => x.id === "RC7").detail, /9회 한 가지 색.*10회 측정값 없음/);
  // 요구하지 않은 종류는 띠를 못 봐도, 그림 검사가 없어도 영향이 없다
  assert.equal(reconnectChecks(rounds10({ bannerSeen: false, painted: null })).every((x) => x.ok), true);
});

test("reconnectSummary: 횟수·콘솔 건수·띠 잔류·위치 차 최대·허용 목록 적용을 한 줄로 남긴다", () => {
  const line = reconnectSummary(rounds10((n) => (n === 2 ? { posDiff: 0.0123, console: ["x"] } : {})), { "preload-unused": 17 });
  assert.match(line, /^10회/);
  assert.match(line, /콘솔 경고·오류 1건/);
  assert.match(line, /띠 잔류 0건/);
  assert.match(line, /위치 차 최대 0\.0123/);
  assert.match(line, /preload-unused 17/);
  assert.match(reconnectSummary([]), /^0회.*위치 차 최대 읽지 못함.*없음/);
});

test("budgetChecks: calls ≤ 120 이면 B1 통과, 넘으면 실패하고 숫자를 말한다 (경계 120 은 통과)", () => {
  assert.equal(budgetChecks({ calls: 120 }, { maxCalls: 120 })[0].ok, true);
  const over = budgetChecks({ calls: 121 }, { maxCalls: 120 })[0];
  assert.equal(over.ok, false);
  assert.match(over.detail, /121 > 120/);
  assert.equal(budgetChecks({ calls: 0 })[0].ok, false); // 그려지지 않은 장면은 통과가 아니다
  assert.equal(budgetChecks({}, { maxCalls: 120 })[0].ok, false);
  assert.match(budgetChecks(null)[0].detail, /측정값 없음/);
  assert.match(budgetChecks({ calls: 5 }, { scene: "vote" })[0].label, /\(vote\)/);
});

test("budgetChecks B2: maxPointLights 를 주면 점광원 3 이하를 본다 (넘거나 값이 없으면 실패)", () => {
  const ok = budgetChecks({ calls: 80, pointLights: 3 }, { maxCalls: 120, maxPointLights: 3 });
  assert.deepEqual(ok.map((x) => x.id), ["B1", "B2"]);
  assert.equal(ok.every((x) => x.ok), true);
  const four = budgetChecks({ calls: 80, pointLights: 4 }, { maxCalls: 120, maxPointLights: 3 })[1];
  assert.equal(four.ok, false);
  assert.match(four.detail, /4 > 3/);
  assert.equal(budgetChecks({ calls: 80 }, { maxCalls: 120, maxPointLights: 3 })[1].ok, false);
  assert.equal(budgetChecks({ calls: 80 }, { maxCalls: 120 }).length, 1);
});

test("memoryStableChecks: 처음 연 맵 + 다시 연 5번이 모두 처음 값 이하면 통과, 하나라도 늘면 실패한다", () => {
  const snap = (g = 40, t = 12) => ({ geometries: g, textures: t });
  const six = [snap(), snap(), snap(), snap(), snap(), snap()];
  assert.equal(memoryStableChecks(six).ok, true);
  assert.equal(memoryStableChecks([snap(), snap(39), snap(40, 11), snap(), snap(), snap()]).ok, true); // 줄어드는 것은 새는 것이 아니다
  const leak = memoryStableChecks([snap(), snap(), snap(), snap(42), snap(), snap(40, 13)]);
  assert.equal(leak.ok, false);
  assert.match(leak.detail, /3번째 geometries 42 > 처음 40/);
  assert.match(leak.detail, /5번째 textures 13 > 처음 12/);
});

test("memoryStableChecks: 표본이 모자라거나 값이 없으면 통과하지 않는다", () => {
  assert.match(memoryStableChecks([{ geometries: 1, textures: 1 }]).detail, /표본 1\/6개/);
  assert.match(memoryStableChecks([]).detail, /표본 0\/6개/);
  assert.match(memoryStableChecks(undefined).detail, /표본 0\/6개/);
  const missing = memoryStableChecks([{ geometries: 40, textures: 12 }, null, {}, { geometries: 40 }, { geometries: 40, textures: 12 }, { geometries: 40, textures: 12 }]);
  assert.equal(missing.ok, false);
  assert.match(missing.detail, /1번째 다시 열기: 측정값 없음/);
  assert.match(memoryStableChecks([{}, {}]  , { expected: 2 }).detail, /처음 연 맵/);
  assert.equal(memoryStableChecks([{ geometries: 1, textures: 1 }, { geometries: 1, textures: 1 }], { expected: 2 }).ok, true);
});

test("contextLeakChecks: 'Too many active WebGL contexts' 경고가 있으면 실패한다", () => {
  assert.equal(contextLeakChecks([{ type: "log", text: "x" }, { type: "warning", text: "something else" }]).ok, true);
  const bad = contextLeakChecks([{ type: "warning", text: "WARNING: Too many active WebGL contexts. Oldest context will be lost." }]);
  assert.equal(bad.ok, false);
  assert.match(bad.detail, /1건/);
  assert.equal(contextLeakChecks(undefined).ok, true);
});

test("isWorldChunkUrl: 개발 서버 모듈과 빌드 청크의 렌더러·캐릭터 모듈만 참이다", () => {
  const yes = [
    "http://localhost:5173/src/world/threeRenderer.ts",
    "http://localhost:5173/src/world/threeRenderer.ts?t=1730000000",
    "http://localhost:5173/src/world/character.ts",
    "https://minifia-v2.dhplay.workers.dev/assets/threeRenderer-Ab12_cD.js",
    "https://minifia-v2.dhplay.workers.dev/assets/character-9xZ.js",
  ];
  const no = [
    "http://localhost:5173/src/world/characterData.ts",
    "http://localhost:5173/src/world/runtime.ts",
    "http://localhost:5173/src/world/renderer.ts",
    "http://localhost:5173/characters/roles/police_default.png",
    "http://localhost:5173/api/rooms/1/ws",
    "그냥 글자",
  ];
  for (const u of yes) assert.equal(isWorldChunkUrl(u), true, u);
  for (const u of no) assert.equal(isWorldChunkUrl(u), false, u);
});

test("chunkFailChecks: 카드 제목·[다시 시도]·캔버스 없음이 모두 맞아야 통과한다", () => {
  assert.equal(chunkFailChecks({ title: "맵을 불러오지 못했어요", retryVisible: true, canvases: 0 }).ok, true);
  const bad = chunkFailChecks({ title: null, retryVisible: false, canvases: 1 });
  assert.equal(bad.ok, false);
  assert.match(bad.detail, /카드 제목 없음/);
  assert.match(bad.detail, /\[다시 시도\]/);
  assert.match(bad.detail, /캔버스 1개/);
  assert.match(chunkFailChecks({ title: "화면을 다시 그리지 못했어요", retryVisible: true, canvases: 0 }).detail, /카드 제목/);
  assert.match(chunkFailChecks(null).detail, /측정값 없음/);
});

test("paintedFromStats: 색이 8가지 이상이고 한 색이 90% 미만이어야 그려진 것이다, 값이 없으면 null", () => {
  assert.equal(paintedFromStats({ distinct: 200, dominantShare: 0.4 }), true);
  assert.equal(paintedFromStats({ distinct: 1, dominantShare: 1 }), false); // 바탕색 한 가지
  assert.equal(paintedFromStats({ distinct: 30, dominantShare: 0.95 }), false);
  assert.equal(paintedFromStats({ distinct: 7, dominantShare: 0.2 }), false);
  assert.equal(paintedFromStats(null), null);
  assert.equal(paintedFromStats({ distinct: Number.NaN, dominantShare: 0.2 }), null);
});

test("selectFlows: --only 가 없으면 skipByDefault 흐름만 빠지고, --only 로 고르면 skipByDefault 라도 돈다", () => {
  const flows = [{ id: "lobby" }, { id: "reconnect" }, { id: "deployhold", skipByDefault: true }, { id: "perfbudget" }];
  assert.deepEqual(selectFlows(flows, null).map((f) => f.id), ["lobby", "reconnect", "perfbudget"]);
  assert.deepEqual(selectFlows(flows, undefined).map((f) => f.id), ["lobby", "reconnect", "perfbudget"]);
  assert.deepEqual(selectFlows(flows, "deployhold").map((f) => f.id), ["deployhold"]);
  assert.deepEqual(selectFlows(flows, "reconnect").map((f) => f.id), ["reconnect"]);
  assert.deepEqual(selectFlows(flows, "nothing"), []);
});

// ---- dropSockets: 합성 close 가 먼저 (06-23, G-06-6) ----

/** 가짜 page: evaluate(fn) 가 fn() 을 바로 실행한다. 가짜 window.__e2eSockets·CloseEvent 를 globalThis 에 심고 끝나면 되돌린다. */
async function withFakeSockets(sockets, calls, run) {
  const had = { window: "window" in globalThis, CloseEvent: "CloseEvent" in globalThis };
  const prev = { window: globalThis.window, CloseEvent: globalThis.CloseEvent };
  globalThis.window = { __e2eSockets: sockets };
  globalThis.CloseEvent = class FakeCloseEvent {
    constructor(type, init = {}) {
      this.type = type;
      this.code = init.code;
      this.wasClean = init.wasClean;
    }
  };
  try {
    return await run({ evaluate: async (fn) => fn() });
  } finally {
    if (had.window) globalThis.window = prev.window;
    else delete globalThis.window;
    if (had.CloseEvent) globalThis.CloseEvent = prev.CloseEvent;
    else delete globalThis.CloseEvent;
  }
}

function fakeSocket(url, readyState, calls, name) {
  return {
    url,
    readyState,
    dispatchEvent(ev) {
      calls.push({ name, op: "dispatch", type: ev.type, code: ev.code, wasClean: ev.wasClean });
      return true;
    },
    close() {
      calls.push({ name, op: "close" });
    },
  };
}

test("dropSockets: 앱 방 소켓(열림·연결 중)마다 합성 close(1006, wasClean false)를 ws.close() 보다 먼저 dispatch 한다", async () => {
  const calls = [];
  const sockets = [
    fakeSocket("wss://x.test/api/rooms/ABCD/ws?token=t", 1, calls, "open"),
    fakeSocket("wss://x.test/api/rooms/ABCD/ws?token=u", 0, calls, "connecting"),
  ];
  const n = await withFakeSockets(sockets, calls, (page) => dropSockets(page));
  assert.equal(n, 2);
  assert.deepEqual(calls, [
    { name: "open", op: "dispatch", type: "close", code: 1006, wasClean: false },
    { name: "open", op: "close" },
    { name: "connecting", op: "dispatch", type: "close", code: 1006, wasClean: false },
    { name: "connecting", op: "close" },
  ]);
});

test("dropSockets: 방 소켓이 아닌 소켓(vite HMR)과 닫히는 중·닫힌 소켓은 이벤트도 close 도 받지 않는다", async () => {
  const calls = [];
  const sockets = [
    fakeSocket("ws://localhost:5173/?token=hmr", 1, calls, "hmr"),
    fakeSocket("wss://x.test/api/rooms/ABCD/ws", 2, calls, "closing"),
    fakeSocket("wss://x.test/api/rooms/ABCD/ws", 3, calls, "closed"),
  ];
  const n = await withFakeSockets(sockets, calls, (page) => dropSockets(page));
  assert.equal(n, 0);
  assert.deepEqual(calls, []);
});

test("dropSockets: 건드린 소켓 수를 돌려주고, 방 소켓이 없으면 0 이다", async () => {
  const calls = [];
  assert.equal(await withFakeSockets([], calls, (page) => dropSockets(page)), 0);
  const mixed = [
    fakeSocket("wss://x.test/api/rooms/A/ws", 3, calls, "a"),
    fakeSocket("wss://x.test/api/rooms/A/ws", 1, calls, "b"),
    fakeSocket("ws://localhost/hmr", 1, calls, "c"),
  ];
  assert.equal(await withFakeSockets(mixed, calls, (page) => dropSockets(page)), 1);
});

// ---- deployhold: 배포 신호가 있을 때만 판정 (06-23, G-06-6) ----

test("deployObservedOf: 앞뒤 version 이 둘 다 비어 있지 않고 서로 다를 때만 true 다 (같음·읽지 못함은 false)", () => {
  assert.equal(deployObservedOf("2026-11-01T08:00:00Z+aaa", "2026-11-01T09:00:00Z+bbb"), true);
  assert.equal(deployObservedOf("v1", "v1"), false);
  for (const [a, b] of [["", "v2"], ["v1", ""], [null, "v2"], ["v1", undefined], [undefined, undefined], ["", ""], [null, null]]) {
    assert.equal(deployObservedOf(a, b), false, `${String(a)} → ${String(b)}`);
  }
  assert.equal(deployObservedOf(123, 456), false); // 글자가 아니면 읽지 못한 것으로 본다
});

const deployRound = (over = {}) => goodRound(1, { bannerSeen: false, socketsKept: true, deployObserved: true, ...over });

test("deployHoldChecks 로컬: 이전 판정 그대로 — 10회, 띠가 떠야 통과하고 deployObserved 와 무관하다", () => {
  const ok = deployHoldChecks(rounds10(), { local: true });
  assert.deepEqual(ok.map((r) => r.id), ["RC5", "RC1", "RC2", "RC3", "RC4", "RC6"]);
  assert.equal(ok.every((r) => r.ok), true);
  const same = reconnectChecks(rounds10(), { expectedRounds: 10, requireBannerSeen: true });
  assert.deepEqual(ok, same);
  const noBanner = deployHoldChecks(rounds10((n) => (n === 3 ? { bannerSeen: false } : {})), { local: true });
  assert.equal(noBanner.find((r) => r.id === "RC6").ok, false);
  assert.equal(deployHoldChecks(rounds10().slice(0, 9), { local: true }).find((r) => r.id === "RC5").ok, false);
  // deployObserved 가 없어도(로컬은 신호를 보지 않는다) 같은 결과
  assert.equal(deployHoldChecks(rounds10({ deployObserved: false }), { local: true }).every((r) => r.ok), true);
});

test("deployHoldChecks 배포 주소: 배포 신호가 false·null·없음이면 소켓 유지·깨끗한 라운드여도 DH0 한 행뿐이고 통과로 세지 않는다", () => {
  for (const over of [{ deployObserved: false }, { deployObserved: null }, { deployObserved: undefined }]) {
    const rows = deployHoldChecks([deployRound(over)], { local: false });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].id, "DH0");
    assert.equal(rows[0].ok, true);
    assert.equal(rows[0].info, true);
    assert.match(rows[0].detail, /배포 신호 없음 — 통과로 세지 않음/);
    assert.equal(rows.some((r) => r.id === "DH1"), false);
  }
  const none = deployHoldChecks([], { local: false });
  assert.deepEqual(none.map((r) => r.id), ["DH0"]);
  assert.deepEqual(deployHoldChecks(undefined, { local: false }).map((r) => r.id), ["DH0"]);
});

test("deployHoldChecks 배포 주소: 신호가 있고 띠 없음·소켓 유지·위치·콘솔이 깨끗하면 RC5·RC1~RC4 와 DH1 이 모두 통과하고 RC6 은 없다", () => {
  const rows = deployHoldChecks([deployRound()], { local: false });
  assert.deepEqual(rows.map((r) => r.id), ["RC5", "RC1", "RC2", "RC3", "RC4", "DH1"]);
  assert.equal(rows.every((r) => r.ok), true);
  assert.equal(rows.some((r) => r.info === true), false);
});

test("deployHoldChecks DH1: 띠 없음인데 소켓이 유지되지 않았거나 측정 못 했으면 실패하고, 띠가 떴으면 복구해야 통과한다", () => {
  const swapped = deployHoldChecks([deployRound({ socketsKept: false })], { local: false }).find((r) => r.id === "DH1");
  assert.equal(swapped.ok, false);
  assert.match(swapped.detail, /띠 없이 소켓이 바뀜|조용히/);
  const unread = deployHoldChecks([deployRound({ socketsKept: null })], { local: false }).find((r) => r.id === "DH1");
  assert.equal(unread.ok, false);
  assert.match(unread.detail, /측정/);
  const seenOk = deployHoldChecks([deployRound({ bannerSeen: true, socketsKept: false, recovered: true })], { local: false });
  assert.equal(seenOk.find((r) => r.id === "DH1").ok, true);
  const seenStuck = deployHoldChecks([deployRound({ bannerSeen: true, recovered: false })], { local: false });
  const dh1 = seenStuck.find((r) => r.id === "DH1");
  assert.equal(dh1.ok, false);
  assert.match(dh1.detail, /복구/);
});

test("deployHoldChecks 배포 주소: 위치 차 초과는 RC3, 콘솔 항목은 RC1, 띠 잔류는 RC2 가 각각 실패한다", () => {
  const pos = deployHoldChecks([deployRound({ posDiff: 0.5 })], { local: false });
  assert.equal(pos.find((r) => r.id === "RC3").ok, false);
  assert.equal(pos.find((r) => r.id === "RC1").ok, true);
  const con = deployHoldChecks([deployRound({ console: ["[error] x"] })], { local: false });
  assert.equal(con.find((r) => r.id === "RC1").ok, false);
  assert.equal(con.find((r) => r.id === "RC3").ok, true);
  const left = deployHoldChecks([deployRound({ bannerLeft: true })], { local: false });
  assert.equal(left.find((r) => r.id === "RC2").ok, false);
});

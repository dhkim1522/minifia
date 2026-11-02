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
  HEADER_BG_PERCENTILE,
  HEADER_CONTRAST_MIN,
  ONE_LINE_FACTOR,
  LOG_H_SHORT,
  LOG_H_TALL,
  logHeightFor,
  OVERLAP_EPS,
  TAP_ALLOW,
  TAP_MIN,
  TEXT_SIZE_ALLOW,
  USAGE,
  UsageError,
  chromeCandidates,
  smallTextIssues,
  headerContrastChecks,
  percentile,
  relLuminance,
  rgbP95Luminance,
  exitCodeOf,
  findChrome,
  formatTables,
  genericIssues,
  isOneLine,
  lineCount,
  parseArgs,
  rectInside,
  rectsOverlap,
  redact,
  resolveTarget,
  LOBBY_EXTRA_SIZES,
  LOBBY_SIZES,
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
  worldTapRanking,
  WORLD_WALK_MIN_MS,
  WORLD_WALK_MIN_MS_LOW,
  tagStackChecks,
  walkableCenters,
  worldSyncChecks,
  walkStartChecks,
  WORLD_MOVE_SPEED,
  WORLD_START_MAX_FRAMES,
  WORLD_START_MOVED_MIN,
  WORLD_JUMP_SPEED_MAX,
  resultChecks,
  DEFAULT_SIZES,
  TIMELESS_PHASES,
  JOIN_FIT_MIN_H,
  guideChecks,
  docHeightChecks,
  joinFitChecks,
  pcCenterChecks,
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
  CHAT_PANEL_EXTRA,
  LOBBY_PANEL_EXTRA,
  lobbyPanelHeight,
  GAME_PANEL_EXTRA,
  PICK_BUTTON_MAX,
  gamePanelHeight,
  pickButtonChecks,
  announceChecks,
  ghostDomChecks,
  verdictPanelChecks,
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

test("TEXT_SIZE_ALLOW: .mf-journal__new·.mv-badge__unit(승인값) 외에 더할 수 있는 것은 테스트 도구(.mf-tt*)뿐, 이유 필수", () => {
  assert.ok(TEXT_SIZE_ALLOW.some((i) => i.selector === ".mf-journal__new"));
  assert.ok(TEXT_SIZE_ALLOW.some((i) => i.selector === ".mv-badge__unit"));
  for (const item of TEXT_SIZE_ALLOW) {
    assert.ok(typeof item.reason === "string" && item.reason.trim().length > 0, JSON.stringify(item));
    for (const sel of item.selector.split(",").map((x) => x.trim())) {
      assert.ok(sel === ".mf-journal__new" || sel === ".mv-badge__unit" || sel.startsWith(".mf-tt"), `허용되지 않는 글자 크기 허용 선택자: ${sel}`);
      for (const banned of [".mf-phasebar", ".mf-dt__", ".mf-rolecard", ".mf-journal__row"]) {
        assert.ok(!sel.includes(banned), `${sel} 에 ${banned}`);
      }
    }
  }
});

test("기준 수치는 낮추지 않았다(0.5px·1.6배·44)", () => {
  assert.equal(OVERLAP_EPS, 0.5);
  assert.equal(ONE_LINE_FACTOR, 1.6);
  assert.equal(TAP_MIN, 44);
});

test("D3B_FLOOR_5_PLAYERS 는 98.0% 하나만 낮춘 승인 완화 값이다(5명판 한정, 사용자 승인 2026-10-26) — 이 계획은 건드리지 않는다", () => {
  assert.equal(D3B_FLOOR_5_PLAYERS, 0.98);
  assert.equal(OVERLAP_EPS, 0.5);
  assert.equal(ONE_LINE_FACTOR, 1.6);
  assert.equal(TAP_MIN, 44);
});

test("APPROVED_RELAXATIONS: 승인된 완화는 M1·D3a/D3b·D4·5명판 D3b 98.0% 뿐이고(결정 0056 의 다섯 항목은 08-23 에 지웠다, 결정 0060-14), 모두 이유와 승인 근거가 있다", () => {
  assert.deepEqual(APPROVED_RELAXATIONS.map((r) => r.id), ["M1", "D3a/D3b", "D4", "D3b-5"]);
  for (const r of APPROVED_RELAXATIONS) {
    assert.ok(typeof r.reason === "string" && r.reason.trim().length > 0, JSON.stringify(r));
    assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(r.approved) || r.approved === "03.1 F7", JSON.stringify(r));
  }
  const five = APPROVED_RELAXATIONS.find((r) => r.id === "D3b-5");
  assert.equal(five.approved, "2026-10-26");
  assert.match(five.reason, /98\.0/);
  // 변론 후보 패널 236 완화는 변론 칩과 함께 07-20 에 지웠다
  assert.equal(APPROVED_RELAXATIONS.some((r) => r.id === "P-PANEL-236"), false);
});

test("G7 smallTextIssues: 14px 미만 글자는 실패, 허용된 줄은 통과, 필드가 없으면 실패", () => {
  assert.equal(smallTextIssues([]).ok, true);
  assert.equal(smallTextIssues([{ desc: "span.x", size: 14 }]).ok, true);
  const bad = smallTextIssues([{ desc: "span.x", size: 12 }]);
  assert.equal(bad.ok, false);
  assert.match(bad.detail, /span\.x/);
  assert.equal(smallTextIssues([{ desc: "span.mf-journal__new", size: 12, allowed: true }]).ok, true);
  assert.equal(smallTextIssues([{ desc: "span.mv-badge__unit", size: 12, allowed: true }]).ok, true);
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

// ---- 공통 판정 도우미(한 줄·줄 수·채팅 패널 치수) ----

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

const size = { w: 360, h: 640, mySeat: 0 };

test("채팅 패널 치수 사본: logHeightFor(779) 96 · (780) 152, 채팅 패널 = LOG_H + 92, 로비 패널 = LOG_H + 154", () => {
  assert.equal(LOG_H_SHORT, 96);
  assert.equal(LOG_H_TALL, 152);
  assert.equal(logHeightFor(779), 96);
  assert.equal(logHeightFor(780), 152);
  assert.equal(logHeightFor(560), 96);
  assert.equal(CHAT_PANEL_EXTRA, 92);
  assert.equal(LOBBY_PANEL_EXTRA, 154);
  assert.equal(lobbyPanelHeight(96), 250);
  assert.equal(lobbyPanelHeight(152), 306);
});

// ---- H1 헤더 글씨 대비 (결정 0030, 사용자 지시 V-06) ----

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

test("EXPECTED_SCENE: 단계 열두 개가 모두 장면 id 로 정해져 있다 (옛 처형 여부·후보 선택·후보 공개 단계는 08-22 에 PhaseId 와 함께 없어졌다)", () => {
  assert.deepEqual(Object.keys(EXPECTED_SCENE).sort(), [
    "assigning", "dayAnnounce", "defense", "discussion", "ended", "execution", "lobby", "morning", "night", "nomination", "roleReveal", "verdict",
  ]);
  for (const p of ["nomination", "defense", "verdict", "execution"]) assert.equal(EXPECTED_SCENE[p], "dusk", p);
  assert.equal(EXPECTED_SCENE.ended, "night");
  assert.equal(EXPECTED_SCENE.night, "night");
  assert.equal(EXPECTED_SCENE.morning, "morning");
  assert.equal(EXPECTED_SCENE.dayAnnounce, "day");
  assert.equal(EXPECTED_SCENE.discussion, "day");
  assert.equal(EXPECTED_SCENE.lobby, "lobby");
});

test("04-29: 기존 기준 수치는 그대로다(04-30 이 완화를 더해도 낮추지 않는다)", () => {
  assert.equal(OVERLAP_EPS, 0.5);
  assert.equal(TAP_MIN, 44);
  assert.equal(ONE_LINE_FACTOR, 1.6);
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

test("04-30·06-17·08-23: 닫기 — 승인 목록은 네 건(결정 0056 의 다섯 건은 지웠다)이고 기준 수치는 그대로다", () => {
  assert.deepEqual(APPROVED_RELAXATIONS.map((x) => x.id), ["M1", "D3a/D3b", "D4", "D3b-5"]);
  assert.equal(OVERLAP_EPS, 0.5);
  assert.equal(TAP_MIN, 44);
});

// ---- 08-23: 게임 맵 판정 (UI-SPEC "아래 패널 종류와 높이"·"검사 가능하게 둘 것") ----

test("gamePanelHeight: 토론 LOG_H+154 · 채팅 +92 · 찬반 투표자 +203 · 찬반 보기 +111 (UI-SPEC 표의 여섯 폰 값)", () => {
  assert.equal(gamePanelHeight(780, "talk"), 152 + 154);
  assert.equal(gamePanelHeight(640, "chat"), 96 + 92);
  assert.equal(gamePanelHeight(844, "verdictVoter"), 152 + 203);
  assert.equal(gamePanelHeight(664, "verdictViewer"), 96 + 111);
  // UI-SPEC 폰 크기 표: [방 높이, 토론, 채팅, 투표자, 보기]
  for (const [h, talk, chat, voter, viewer] of [[640, 250, 188, 299, 207], [664, 250, 188, 299, 207], [932, 306, 244, 355, 263], [560, 250, 188, 299, 207], [844, 306, 244, 355, 263], [874, 306, 244, 355, 263]]) {
    assert.deepEqual([gamePanelHeight(h, "talk"), gamePanelHeight(h, "chat"), gamePanelHeight(h, "verdictVoter"), gamePanelHeight(h, "verdictViewer")], [talk, chat, voter, viewer], `방 높이 ${h}`);
  }
  assert.deepEqual({ ...GAME_PANEL_EXTRA }, { talk: 154, chat: 92, verdictVoter: 203, verdictViewer: 111 });
  assert.equal(GAME_PANEL_EXTRA.chat, CHAT_PANEL_EXTRA);
  assert.throws(() => gamePanelHeight(640, "table"), /알 수 없는 패널 종류/);
  assert.throws(() => gamePanelHeight(640, "toString"), /알 수 없는 패널 종류/);
});

const pick = (seat, left, top, w = 44, h = 44) => ({ seat, rect: rect(left, top, w, h) });
const idsOk = (lines) => Object.fromEntries(lines.map((l) => [l.id, l.ok]));

test("pickButtonChecks: 8개가 44×44 이상이고 서로 안 겹치면 모두 통과, 줄 모양은 { id, label, ok, detail }", () => {
  const buttons = Array.from({ length: 8 }, (_, i) => pick(i, 10 + (i % 4) * 80, 100 + Math.floor(i / 4) * 80));
  const lines = pickButtonChecks(buttons);
  assert.deepEqual(idsOk(lines), { PK1: true, PK2: true, PK3: true });
  for (const l of lines) assert.deepEqual(Object.keys(l).sort(), ["detail", "id", "label", "ok"]);
});

test("pickButtonChecks PK2: 44 미만은 실패(43.5 는 G3 와 같은 0.5px 오차로 통과, 43.4 는 실패)하고 자리와 크기를 말한다", () => {
  assert.equal(idsOk(pickButtonChecks([pick(0, 0, 0, 43.5, 44)])).PK2, true);
  assert.equal(idsOk(pickButtonChecks([pick(0, 0, 0, 44, 43.5)])).PK2, true);
  const bad = pickButtonChecks([pick(0, 0, 0), pick(3, 100, 0, 43.4, 44)]).find((l) => l.id === "PK2");
  assert.equal(bad.ok, false);
  assert.match(bad.detail, /자리 3 43\.4x44/);
});

test("pickButtonChecks PK3: 두 버튼이 0.5px 넘게 겹치면 실패하고 쌍을 말한다, 변이 맞닿거나 0.5px 이하 겹침은 통과", () => {
  const clash = pickButtonChecks([pick(1, 0, 0), pick(2, 30, 10)]).find((l) => l.id === "PK3");
  assert.equal(clash.ok, false);
  assert.match(clash.detail, /1-2/);
  assert.equal(idsOk(pickButtonChecks([pick(1, 0, 0), pick(2, 44, 0)])).PK3, true);
  assert.equal(idsOk(pickButtonChecks([pick(1, 0, 0), pick(2, 43.6, 0)])).PK3, true);
  assert.equal(idsOk(pickButtonChecks([pick(1, 0, 0), pick(2, 43.4, 0)])).PK3, false);
});

test("pickButtonChecks PK1: 0개와 9개 이상은 실패, 입력이 배열이 아니거나 사각형 값이 비면 측정값 없음으로 실패", () => {
  assert.equal(idsOk(pickButtonChecks([])).PK1, false);
  const nine = Array.from({ length: 9 }, (_, i) => pick(i, i * 50, 0));
  assert.equal(idsOk(pickButtonChecks(nine)).PK1, false);
  assert.equal(PICK_BUTTON_MAX, 8);
  for (const l of pickButtonChecks(null)) {
    assert.equal(l.ok, false);
    assert.match(l.detail, /측정값 없음/);
  }
  const broken = pickButtonChecks([{ seat: 0, rect: { left: 0, top: 0, width: Number.NaN, height: 44 } }]);
  assert.equal(idsOk(broken).PK1, false);
});

test("announceChecks: 36px·1줄·keep-all 통과, 2줄 통과, 3줄 실패, 28px 실패, word-break 다르면 실패", () => {
  assert.deepEqual(idsOk(announceChecks({ fontPx: 36, lineCount: 1, wordBreak: "keep-all" })), { AN1: true, AN2: true, AN3: true });
  assert.equal(idsOk(announceChecks({ fontPx: 36, lineCount: 2, wordBreak: "keep-all" })).AN2, true);
  const three = announceChecks({ fontPx: 36, lineCount: 3, wordBreak: "keep-all" }).find((l) => l.id === "AN2");
  assert.equal(three.ok, false);
  assert.match(three.detail, /3줄/);
  const small = announceChecks({ fontPx: 28, lineCount: 1, wordBreak: "keep-all" }).find((l) => l.id === "AN1");
  assert.equal(small.ok, false);
  assert.match(small.detail, /28px/);
  assert.equal(idsOk(announceChecks({ fontPx: 36, lineCount: 1, wordBreak: "normal" })).AN3, false);
  assert.equal(idsOk(announceChecks({ fontPx: 36.4, lineCount: 1, wordBreak: "keep-all" })).AN1, true);
});

test("announceChecks: 값이 없으면 조용히 통과하지 않고 측정값 없음으로 실패한다", () => {
  for (const m of [null, undefined, {}, { fontPx: 36 }]) {
    const lines = announceChecks(m);
    assert.equal(lines.length, 3);
    assert.ok(lines.some((l) => !l.ok && /측정값 없음/.test(l.detail)), JSON.stringify(m));
  }
});

test("ghostDomChecks: 산 사람 화면은 ghostView·roleChips·ghostSeats·ghostTexts 가 모두 0 일 때만 통과한다", () => {
  assert.deepEqual(idsOk(ghostDomChecks({ ghostView: 0, roleChips: 0, ghostSeats: 0, ghostTexts: 0 })), { GH1: true, GH2: true, GH3: true, GH4: true });
  for (const key of ["ghostView", "roleChips", "ghostSeats", "ghostTexts"]) {
    const m = { ghostView: 0, roleChips: 0, ghostSeats: 0, ghostTexts: 0, [key]: 1 };
    const lines = ghostDomChecks(m);
    assert.equal(lines.filter((l) => !l.ok).length, 1, key);
    assert.match(lines.find((l) => !l.ok).detail, new RegExp(`${key} 1건`));
  }
  const missing = ghostDomChecks({ ghostView: 0 });
  assert.equal(missing.filter((l) => !l.ok).length, 3);
  assert.ok(ghostDomChecks(null).every((l) => !l.ok && /측정값 없음/.test(l.detail)));
});

test("verdictPanelChecks: 투표자는 고르기+점, 보기는 점만, 키보드가 열리면 둘 다 없다", () => {
  assert.deepEqual(idsOk(verdictPanelChecks({ kind: "voter", hasPicker: true, hasDots: true, kbOpen: false })), { VP1: true, VP2: true });
  assert.deepEqual(idsOk(verdictPanelChecks({ kind: "viewer", hasPicker: false, hasDots: true, kbOpen: false })), { VP1: true, VP2: true });
  assert.deepEqual(idsOk(verdictPanelChecks({ kind: "voter", hasPicker: false, hasDots: false, kbOpen: true })), { VP1: true, VP2: true });
  assert.deepEqual(idsOk(verdictPanelChecks({ kind: "viewer", hasPicker: false, hasDots: false, kbOpen: true })), { VP1: true, VP2: true });
});

test("verdictPanelChecks: 구성이 어긋나면 각각 다른 줄이 실패하고 이유를 말한다", () => {
  const viewerWithPicker = verdictPanelChecks({ kind: "viewer", hasPicker: true, hasDots: true, kbOpen: false });
  assert.deepEqual(idsOk(viewerWithPicker), { VP1: false, VP2: true });
  assert.match(viewerWithPicker[0].detail, /보기: 고르기 있음/);
  const voterNoPicker = verdictPanelChecks({ kind: "voter", hasPicker: false, hasDots: true, kbOpen: false });
  assert.deepEqual(idsOk(voterNoPicker), { VP1: false, VP2: true });
  const kbStillShown = verdictPanelChecks({ kind: "voter", hasPicker: true, hasDots: true, kbOpen: true });
  assert.deepEqual(idsOk(kbStillShown), { VP1: false, VP2: false });
  assert.match(kbStillShown[0].detail, /키보드 열림/);
  assert.deepEqual(idsOk(verdictPanelChecks({ kind: "voter", hasPicker: true, hasDots: false, kbOpen: false })), { VP1: true, VP2: false });
});

test("verdictPanelChecks: kind 가 없거나 값이 불리언이 아니면 측정값 없음으로 실패한다", () => {
  for (const m of [null, {}, { kind: "ghost", hasPicker: false, hasDots: true }, { kind: "voter", hasPicker: "y", hasDots: true }]) {
    assert.ok(verdictPanelChecks(m).every((l) => !l.ok && /측정값 없음/.test(l.detail)), JSON.stringify(m));
  }
});

// ---- 5페이즈 순수 검사 (05-05): UX1·UX2·UX2-J·UX2-PC·WL1·WL2 ----

test("DEFAULT_SIZES: 세 폭 기준 뒤에 단 높이 probe 360x560 하나, 기준 수치는 불변", () => {
  assert.deepEqual(
    DEFAULT_SIZES.map((s) => s.label),
    ["360x640", "390x664", "430x932", "360x560"],
  );
  assert.equal(OVERLAP_EPS, 0.5);
  assert.equal(TAP_MIN, 44);
  assert.equal(ONE_LINE_FACTOR, 1.6);
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

// ---- 6페이즈 맵 로비·world 흐름 순수 검사 (06-17) ----

const walkSamples = (n = 5, step = 0.09) => Array.from({ length: n }, (_, i) => ({ kind: "walk", t: 1000 + i * 50, p: { x: i * step, z: 1 } }));
const arrivedSample = (x = 3, z = 1) => ({ kind: "arrived", t: 4000, p: { x, z } });

test("worldSyncChecks: 상수는 UI-SPEC 그대로 — 0.3 단위·링 100ms·구간 500ms", () => {
  assert.equal(WORLD_SYNC_TOL, 0.3);
  assert.equal(WORLD_RING_MAX_MS, 100);
  assert.equal(WORLD_SEGMENT_MAX_MS, 500);
  assert.equal(WORLD_MOVED_MIN, 0.1);
});

// ---- G-07-9 탭 뒤 화면 출발·한 프레임 튐 (결정 0059, 07-26) ----

const UP = 100000;
/** 손 뗀 뒤 프레임: 출발점 (0,0) 한 프레임(at = UP − 10) + UP 뒤 16ms 간격 n 개. stepOf(i) = i번째(1부터) 프레임의 x */
const watchOf = (n, xAt) => ({
  upWall: UP,
  frames: [{ x: 0, z: 0, at: UP - 10 }, ...Array.from({ length: n }, (_, i) => ({ x: xAt(i + 1), z: 0, at: UP + 6 + i * 16 }))],
});

test("walkStartChecks: 상수 — 걷는 속도 1.8·3프레임·최소 이동 0.005·튐 상한 5.4", () => {
  assert.equal(WORLD_MOVE_SPEED, 1.8);
  assert.equal(WORLD_START_MAX_FRAMES, 3);
  assert.equal(WORLD_START_MOVED_MIN, 0.005);
  assert.ok(Math.abs(WORLD_JUMP_SPEED_MAX - 5.4) < 1e-9);
});

test("walkStartChecks: 첫 프레임부터 한 프레임에 0.03 씩 걸으면 W11(1번째 프레임)·W12(1.875 단위/초) 모두 통과한다", () => {
  const [w11, w12] = walkStartChecks(watchOf(12, (i) => i * 0.03));
  assert.equal(w11.id, "W11");
  assert.equal(w12.id, "W12");
  assert.equal(w11.ok, true, w11.detail);
  assert.equal(w12.ok, true, w12.detail);
});

test("walkStartChecks W11: 손 뗀 뒤 9프레임 동안 서 있다 10번째에 움직이면 실패하고 10번째와 ms 를 말한다(예측 없는 배포본 모양)", () => {
  const w11 = walkStartChecks(watchOf(14, (i) => (i < 10 ? 0 : (i - 9) * 0.03)))[0];
  assert.equal(w11.ok, false);
  assert.match(w11.detail, /10번째/);
  assert.match(w11.detail, /\d+ms/);
});

test("walkStartChecks W11: 3번째 프레임에 움직이면 통과, 4번째면 실패한다(경계)", () => {
  assert.equal(walkStartChecks(watchOf(8, (i) => (i < 3 ? 0 : (i - 2) * 0.03)))[0].ok, true);
  assert.equal(walkStartChecks(watchOf(8, (i) => (i < 4 ? 0 : (i - 3) * 0.03)))[0].ok, false);
});

test("walkStartChecks W12: 걷는 중 한 프레임(16ms)에 0.14 를 건너뛰면 실패하고 최대 속도를 말한다(섞기 없는 배포본 모양)", () => {
  const w12 = walkStartChecks(watchOf(14, (i) => i * 0.03 + (i >= 7 ? 0.11 : 0)))[1];
  assert.equal(w12.ok, false);
  assert.match(w12.detail, /8\.\d+/);
});

test("walkStartChecks W12: at 차이 3ms 쌍과 150ms 쌍은 속도 계산에서 빠지고, 남는 쌍이 10개 미만이면 측정값 없음으로 실패한다", () => {
  const frames = [{ x: 0, z: 0, at: UP - 10 }];
  let at = UP + 6;
  let x = 0;
  for (let i = 0; i < 12; i++) {
    x += 0.03;
    frames.push({ x, z: 0, at });
    at += 16;
  }
  // 3ms 쌍 (건너뜀 1.0 이어도 빠진다)
  frames.push({ x: x + 1, z: 0, at: at - 16 + 3 });
  // 150ms 쌍
  frames.push({ x: x + 5, z: 0, at: at - 16 + 3 + 150 });
  const ok = walkStartChecks({ upWall: UP, frames })[1];
  assert.equal(ok.ok, true, ok.detail);
  const few = walkStartChecks(watchOf(5, (i) => i * 0.03))[1];
  assert.equal(few.ok, false);
  assert.match(few.detail, /측정값 없음/);
});

test("walkStartChecks: watch 가 null·upWall 이 null·frames 가 빈 배열이면 W11·W12 모두 측정값 없음으로 실패한다", () => {
  for (const w of [null, undefined, { upWall: null, frames: [{ x: 0, z: 0, at: 1 }] }, { upWall: UP, frames: [] }]) {
    const rows = walkStartChecks(w);
    assert.equal(rows.length, 2);
    for (const r of rows) {
      assert.equal(r.ok, false);
      assert.match(r.detail, /측정값 없음/);
    }
  }
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

test("worldTapRanking: 3 단위 이상 먼 칸이 있으면 그 칸과 1.5초 하한, 없으면(낮은 스테이지) 1.5 단위 이상 먼 칸과 0.8초 하한", () => {
  const from = { x: 0, z: 0 };
  const tall = worldTapRanking([{ x: 4, z: 0 }, { x: 1, z: 0 }, { x: 0, z: 3.5 }], from);
  assert.equal(tall.low, false);
  assert.equal(tall.minWalkMs, WORLD_WALK_MIN_MS);
  assert.deepEqual(tall.ranked.map((p) => p.x + "," + p.z), ["4,0", "0,3.5"]);
  const low = worldTapRanking([{ x: 2.2, z: 0 }, { x: 1, z: 0 }, { x: 0, z: 1.6 }], from);
  assert.equal(low.low, true);
  assert.equal(low.minWalkMs, WORLD_WALK_MIN_MS_LOW);
  assert.deepEqual(low.ranked.map((p) => p.x + "," + p.z), ["2.2,0", "0,1.6"]);
  // 1.5 단위 이상도 없으면 후보가 비어 SetupError 로 이어진다(조용히 통과하지 않는다)
  assert.deepEqual(worldTapRanking([{ x: 1, z: 0 }], from).ranked, []);
  assert.equal(WORLD_WALK_MIN_MS, 1500);
  assert.equal(WORLD_WALK_MIN_MS_LOW, 800);
});

test("pickTapTargets: minDist 이상만, 먼 순서, visible 이 거짓인 점은 뺀다", () => {
  const centers = [{ x: 0, z: 0 }, { x: 1, z: 0 }, { x: 4, z: 0 }, { x: 6, z: 0 }];
  const all = pickTapTargets(centers, { x: 0, z: 0 }, { minDist: 3 });
  assert.deepEqual(all.map((p) => p.x), [6, 4]);
  const hidden = pickTapTargets(centers, { x: 0, z: 0 }, { minDist: 3, visible: (x) => x < 5 });
  assert.deepEqual(hidden.map((p) => p.x), [4]);
  assert.deepEqual(pickTapTargets(centers, { x: 0, z: 0 }, { minDist: 99 }), []);
});

// ---- 06-17 Task 2: LOBBY_SIZES·extraSizes ----

test("LOBBY_SIZES: DEFAULT_SIZES 4개 + 390x844 + 402x874 여섯 개이고 LOBBY_EXTRA_SIZES 는 더해진 두 개다 (DEFAULT_SIZES 는 그대로)", () => {
  assert.deepEqual(LOBBY_SIZES.map((x) => x.label), ["360x640", "390x664", "430x932", "360x560", "390x844", "402x874"]);
  assert.deepEqual(LOBBY_SIZES.map((x) => [x.w, x.h]), [[360, 640], [390, 664], [430, 932], [360, 560], [390, 844], [402, 874]]);
  assert.deepEqual(LOBBY_EXTRA_SIZES.map((x) => x.label), ["390x844", "402x874"]);
  assert.deepEqual(DEFAULT_SIZES.map((x) => x.label), ["360x640", "390x664", "430x932", "360x560"]);
});

test("run.mjs: 흐름별 extraSizes 는 --sizes 를 주지 않았을 때만 더하고, FLOWS 의 lobby·world·chat-lobby·chat-keyboard·day·ghost 만 갖는다", () => {
  const run = readFileSync(new URL("./run.mjs", import.meta.url), "utf8");
  assert.match(run, /extraSizes/);
  assert.match(run, /!args\.sizesGiven/);
  const flows = readFileSync(new URL("./flows.mjs", import.meta.url), "utf8");
  const entries = [...flows.matchAll(/\{ id: "([a-z0-9-]+)", run: [A-Za-z(), ]+?(, extraSizes: LOBBY_EXTRA_SIZES)? \}/g)];
  const withExtra = entries.filter((m) => m[2]).map((m) => m[1]);
  assert.deepEqual(withExtra, ["lobby", "world", "chat-lobby", "chat-keyboard", "day", "ghost"]);
});

// ---- 08-23: 결정 0056 완화를 지웠다(결정 0060-14) — 이름 길이로 G2 를 봐 주지 않는다 ----

test("G2: 화면 가로 밖 요소는 이름 길이와 무관하게 실패한다(결정 0056 완화 삭제, 화면 가로 기준 불변)", () => {
  const withEls = (els) => {
    const s = cleanSnap();
    s.elements = [...s.elements, ...els];
    return byId(genericIssues(s, { w: 360, h: 640 }), "G2");
  };
  const out = withEls([{ desc: "div.mf-nametag", rect: rect(-17.7, 300, 133, 22), fixedTagName: "봇가나다라마바사" }]);
  assert.equal(out.ok, false);
  assert.equal(out.relaxed, undefined);
  assert.match(out.detail, /div\.mf-nametag/);
  assert.equal(withEls([{ desc: "div.mf-other", rect: rect(300, 10, 100, 20) }]).ok, false);
  const inside = withEls([{ desc: "div.mf-nametag", rect: rect(0, 300, 133, 22) }]);
  assert.equal(inside.ok, true);
  assert.equal(inside.relaxed, undefined);
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

test("selectFlows: --only 는 쉼표로 여러 개를 줄 수 있고 하나라도 맞으면 고른다 (08-23)", () => {
  const flows = [{ id: "lobby" }, { id: "chat-lobby" }, { id: "reconnect" }, { id: "deployhold", skipByDefault: true }];
  assert.deepEqual(selectFlows(flows, "reconnect,deployhold").map((f) => f.id), ["reconnect", "deployhold"]);
  assert.deepEqual(selectFlows(flows, "chat-lobby, reconnect").map((f) => f.id), ["chat-lobby", "reconnect"]);
  assert.deepEqual(selectFlows(flows, "nothing,none"), []);
  assert.deepEqual(selectFlows(flows, ",").map((f) => f.id), []);
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

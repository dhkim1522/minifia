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
  faceListPanelH,
  NIGHT_MARKERS,
  tagInStage,
  faceNameFits,
  pickButtonChecks,
  turnBlockChecks,
  runoffChecks,
  showdownChecks,
  SHOWDOWN_GATHER_MS,
  SHOWDOWN_TURN_MS,
  SHOWDOWN_POINT_MS,
  SHOWDOWN_REVEAL_MS,
  nominationMaxMs,
  NOMINATION_GATHER_MS,
  PICK_TURN_MS,
  PICK_GAP_MS,
  NOMINATION_END_MS,
  TURN_FONT_MIN,
  announceChecks,
  ghostDomChecks,
  verdictPanelChecks,
  LETTER_END_AT_MS,
  LETTER_FOLD_AT_MS,
  ANNOUNCE_MORNING_AT,
  SEAL_GLYPH,
  contrastRatio,
  externalPenFontRequests,
  letterChecks,
  ownPenFontRequests,
  FLOAT_SIZE,
  FLOAT_MARGIN,
  FLOAT_GAP,
  WHISPER_SHEET_H,
  CLAIM_BADGE_SIZE,
  CLAIM_SWAP_SIZE,
  floatButtonChecks,
  emoteTrayChecks,
  dressChecks,
  emoteDeliveryChecks,
  floatTrayChecks,
  AVATAR_MARKERS,
  SOUND_MARKERS,
  SOUND_RENDER_LIMITS,
  soundRenderChecks,
  sheetFitChecks,
  claimBadgeChecks,
  ballotFitChecks,
  verdictTimelineChecks,
  parseRgb,
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

test("EXPECTED_SCENE: 단계 열네 개가 모두 장면 id 로 정해져 있다 (옛 처형 여부·후보 선택·후보 공개 단계는 08-22 에 PhaseId 와 함께 없어졌고, 결선 runoff·마지막 3인 showdown 은 09.1.1-04·06 이 더했다)", () => {
  assert.deepEqual(Object.keys(EXPECTED_SCENE).sort(), [
    "assigning", "dayAnnounce", "defense", "discussion", "ended", "execution", "lobby", "morning", "night", "nomination", "roleReveal", "runoff", "showdown", "verdict",
  ]);
  for (const p of ["nomination", "defense", "verdict", "execution", "runoff", "showdown"]) assert.equal(EXPECTED_SCENE[p], "dusk", p);
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

// 11-05: 결과 화면 판정(옛 resultChecks·resultFitChecks)은 scripts/e2e/result.mjs 의 resultStageChecks 로 바뀌었다 — 시험은 scripts/e2e/result.test.mjs.

test("04-30·06-17·08-23: 닫기 — 승인 목록은 네 건(결정 0056 의 다섯 건은 지웠다)이고 기준 수치는 그대로다", () => {
  assert.deepEqual(APPROVED_RELAXATIONS.map((x) => x.id), ["M1", "D3a/D3b", "D4", "D3b-5"]);
  assert.equal(OVERLAP_EPS, 0.5);
  assert.equal(TAP_MIN, 44);
});

// ---- 08-23: 게임 맵 판정 (UI-SPEC "아래 패널 종류와 높이"·"검사 가능하게 둘 것") ----

test("gamePanelHeight: 토론 LOG_H+154 · 채팅 +92 · 찬반 투표자 +218 · 찬반 보기 +126 (UI-SPEC 표의 여섯 폰 값)", () => {
  assert.equal(gamePanelHeight(780, "talk"), 152 + 154);
  assert.equal(gamePanelHeight(640, "chat"), 96 + 92);
  assert.equal(gamePanelHeight(844, "verdictVoter"), 152 + 218);
  assert.equal(gamePanelHeight(664, "verdictViewer"), 96 + 126);
  // UI-SPEC 폰 크기 표: [방 높이, 토론, 채팅, 투표자, 보기]
  for (const [h, talk, chat, voter, viewer] of [[640, 250, 188, 314, 222], [664, 250, 188, 314, 222], [932, 306, 244, 370, 278], [560, 250, 188, 314, 222], [844, 306, 244, 370, 278], [874, 306, 244, 370, 278]]) {
    assert.deepEqual([gamePanelHeight(h, "talk"), gamePanelHeight(h, "chat"), gamePanelHeight(h, "verdictVoter"), gamePanelHeight(h, "verdictViewer")], [talk, chat, voter, viewer], `방 높이 ${h}`);
  }
  assert.deepEqual({ ...GAME_PANEL_EXTRA }, { talk: 154, chat: 92, verdictVoter: 218, verdictViewer: 126, nightMafia: 154 });
  assert.equal(GAME_PANEL_EXTRA.chat, CHAT_PANEL_EXTRA);
  assert.throws(() => gamePanelHeight(640, "table"), /알 수 없는 패널 종류/);
  assert.throws(() => gamePanelHeight(640, "toString"), /알 수 없는 패널 종류/);
});

// ---- 09-21: 밤 패널 세 종류의 기대 높이 (UI-SPEC "아래 패널 종류와 높이", 149~172행) ----

test("faceListPanelH: 폭 4종 × 2행·1행이 UI-SPEC 표 값(약, ±1)이고 줄바꿈 행마다 +18 (NIGHT-09)", () => {
  const near = (a, b) => assert.ok(Math.abs(a - b) <= 1, `${a} ≈ ${b}`);
  // 후보 5명 이상 = 2행: 310 · 325 · 331 · 345
  for (const [w, h] of [[360, 310], [390, 325], [402, 331], [430, 345]]) near(faceListPanelH({ w, n: 5 }), h);
  // 후보 4명 이하 = 1행: 200 · 208 · 211 · 218 (UI-SPEC 표의 402 값 215 는 식(160행)과 4px 어긋난 오기 — 식을 따라 211, 09-21 SUMMARY 편차)
  for (const [w, h] of [[360, 200], [390, 208], [402, 211], [430, 218]]) near(faceListPanelH({ w, n: 4 }), h);
  near(faceListPanelH({ w: 360, n: 5, wrappedRows: 1 }), 328);
  near(faceListPanelH({ w: 360, n: 5, wrappedRows: 2 }), 346);
  // 식 그대로: 14 + 행들 + 행 사이 8 + 10 + 52 + 22
  assert.equal(faceListPanelH({ w: 360, n: 1 }), 14 + (76 + 26.2) + 10 + 52 + 22);
  assert.equal(faceListPanelH({ w: 360, n: 8 }), 14 + 2 * (76 + 26.2) + 8 + 10 + 52 + 22);
});

test("gamePanelHeight: nightMafia = LOG_H + 154 · nightCitizen = 88(방 높이와 무관) · faceList 는 faceListPanelH (09-21)", () => {
  assert.equal(GAME_PANEL_EXTRA.nightMafia, 154);
  for (const [h, mafia] of [[640, 250], [560, 250], [932, 306], [874, 306]]) {
    assert.equal(gamePanelHeight(h, "nightMafia"), mafia, `방 높이 ${h}`);
    assert.equal(gamePanelHeight(h, "nightMafia"), gamePanelHeight(h, "talk"));
    assert.equal(gamePanelHeight(h, "nightCitizen"), 88, `방 높이 ${h}`);
  }
  assert.equal(gamePanelHeight(640, "faceList", { w: 360, n: 5 }), faceListPanelH({ w: 360, n: 5 }));
  assert.equal(gamePanelHeight(932, "faceList", { w: 430, n: 4, wrappedRows: 1 }), faceListPanelH({ w: 430, n: 4, wrappedRows: 1 }));
  assert.throws(() => gamePanelHeight(640, "faceList"), /w·n/);
  assert.throws(() => gamePanelHeight(640, "table"), /알 수 없는 패널 종류/);
});

// ---- 09-21: 9페이즈 표식 목록·판정 도우미 (UI-SPEC 450~455행) ----

test("NIGHT_MARKERS: 표식 11개, 중복 없음, 얼려 있다 (09-21)", () => {
  assert.equal(NIGHT_MARKERS.length, 11);
  assert.equal(new Set(NIGHT_MARKERS).size, 11);
  assert.ok(Object.isFrozen(NIGHT_MARKERS));
  for (const m of ["data-night-dark", "data-tension-pulse", "data-face-list", "data-face", "data-will-button", "data-will-sheet", "data-note-button", "data-card", "data-chalk", "data-curtain", "data-kill-fx"]) {
    assert.ok(NIGHT_MARKERS.includes(m), m);
  }
});

test("tagInStage: 완전히 안이면 true, 1px 라도 밖이면 false, 측정값이 없으면 false (밤마다 내 이름표가 스테이지 안, 09-21)", () => {
  const stage = { top: 62, bottom: 400, left: 0, right: 360 };
  assert.equal(tagInStage({ tag: { x: 100, y: 100, w: 80, h: 30 }, stage }), true);
  assert.equal(tagInStage({ tag: { x: 0, y: 62, w: 360, h: 338 }, stage }), true); // 꼭 맞음
  assert.equal(tagInStage({ tag: { x: -1, y: 100, w: 80, h: 30 }, stage }), false); // 왼쪽 1px
  assert.equal(tagInStage({ tag: { x: 100, y: 61, w: 80, h: 30 }, stage }), false); // 위 1px
  assert.equal(tagInStage({ tag: { x: 281, y: 100, w: 80, h: 30 }, stage }), false); // 오른쪽 1px
  assert.equal(tagInStage({ tag: { x: 100, y: 371, w: 80, h: 30 }, stage }), false); // 아래 1px
  assert.equal(tagInStage({ tag: { x: NaN, y: 100, w: 80, h: 30 }, stage }), false);
  assert.equal(tagInStage({ tag: null, stage }), false);
  assert.equal(tagInStage({ tag: { x: 100, y: 100, w: 80, h: 30 }, stage: { top: 62, bottom: 400 } }), false);
});

test("faceNameFits: 이름 사각형이 칸 사각형 안이면 true, 넘치면 false (8자 이름, 09-21)", () => {
  const cell = rect(10, 100, 76, 102);
  assert.equal(faceNameFits({ cell, name: rect(14, 180, 68, 18) }), true);
  assert.equal(faceNameFits({ cell, name: rect(10, 180, 76, 18) }), true); // 꼭 맞음
  assert.equal(faceNameFits({ cell, name: rect(8, 180, 80, 18) }), false); // 양옆으로 넘침
  assert.equal(faceNameFits({ cell, name: rect(14, 180, 68, 24) }), false); // 아래로 넘침
  assert.equal(faceNameFits({ cell, name: null }), false);
  assert.equal(faceNameFits({ cell: { left: 1 }, name: rect(14, 180, 68, 18) }), false);
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

test("verdictPanelChecks: 투표자는 고르기+숫자, 보기는 숫자만, 키보드가 열리면 둘 다 없다", () => {
  assert.deepEqual(idsOk(verdictPanelChecks({ kind: "voter", hasPicker: true, hasCount: true, kbOpen: false })), { VP1: true, VP2: true });
  assert.deepEqual(idsOk(verdictPanelChecks({ kind: "viewer", hasPicker: false, hasCount: true, kbOpen: false })), { VP1: true, VP2: true });
  assert.deepEqual(idsOk(verdictPanelChecks({ kind: "voter", hasPicker: false, hasCount: false, kbOpen: true })), { VP1: true, VP2: true });
  assert.deepEqual(idsOk(verdictPanelChecks({ kind: "viewer", hasPicker: false, hasCount: false, kbOpen: true })), { VP1: true, VP2: true });
});

test("verdictPanelChecks: 구성이 어긋나면 각각 다른 줄이 실패하고 이유를 말한다", () => {
  const viewerWithPicker = verdictPanelChecks({ kind: "viewer", hasPicker: true, hasCount: true, kbOpen: false });
  assert.deepEqual(idsOk(viewerWithPicker), { VP1: false, VP2: true });
  assert.match(viewerWithPicker[0].detail, /보기: 고르기 있음/);
  const voterNoPicker = verdictPanelChecks({ kind: "voter", hasPicker: false, hasCount: true, kbOpen: false });
  assert.deepEqual(idsOk(voterNoPicker), { VP1: false, VP2: true });
  const kbStillShown = verdictPanelChecks({ kind: "voter", hasPicker: true, hasCount: true, kbOpen: true });
  assert.deepEqual(idsOk(kbStillShown), { VP1: false, VP2: false });
  assert.match(kbStillShown[0].detail, /키보드 열림/);
  assert.deepEqual(idsOk(verdictPanelChecks({ kind: "voter", hasPicker: true, hasCount: false, kbOpen: false })), { VP1: true, VP2: false });
});

test("verdictPanelChecks: kind 가 없거나 값이 불리언이 아니면 측정값 없음으로 실패한다", () => {
  for (const m of [null, {}, { kind: "ghost", hasPicker: false, hasCount: true }, { kind: "voter", hasPicker: "y", hasCount: true }]) {
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

const startBtn = (over = {}) => ({ ariaDisabled: null, opacity: 1, countText: "4 / 8", rect: rect(16, 540, 328, 52), hit: true, ...over });

test("lobbyStartChecks L8: 1명은 흐림, 4명은 활성, 8명은 숫자가 맞아야 통과한다", () => {
  const one = lobbyStartChecks(startBtn({ ariaDisabled: "true", opacity: 0.45, countText: "1 / 8" }), { n: 1 });
  assert.equal(one.id, "L8");
  assert.equal(one.ok, true, one.detail);
  assert.equal(lobbyStartChecks(startBtn(), { n: 4 }).ok, true);
  assert.equal(lobbyStartChecks(startBtn({ countText: "8 / 8" }), { n: 8 }).ok, true);
  assert.equal(lobbyStartChecks(startBtn({ ariaDisabled: "true", opacity: 0.45, countText: "3 / 8" }), { n: 3 }).ok, true);
});

test("lobbyStartChecks L8: 1명인데 활성·4명인데 흐림·숫자 어긋남·측정값 없음은 실패한다", () => {
  assert.match(lobbyStartChecks(startBtn({ countText: "1 / 8" }), { n: 1 }).detail, /흐려야 하는데/);
  assert.match(lobbyStartChecks(startBtn({ ariaDisabled: "true", opacity: 0.45 }), { n: 4 }).detail, /활성이어야 하는데/);
  assert.match(lobbyStartChecks(startBtn({ opacity: 0.45 }), { n: 4 }).detail, /불투명도 0\.45/);
  assert.match(lobbyStartChecks(startBtn({ countText: "4 / 7" }), { n: 4 }).detail, /숫자 '4 \/ 7' ≠ '4 \/ 8'/);
  assert.match(lobbyStartChecks(startBtn({ countText: "5 / 8" }), { n: 4 }).detail, /숫자 '5 \/ 8' ≠ '4 \/ 8'/);
  assert.match(lobbyStartChecks(startBtn({ countText: null }), { n: 4 }).detail, /숫자 '' ≠ '4 \/ 8'/);
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

test("run.mjs: 흐름별 extraSizes 는 --sizes 를 주지 않았을 때만 더하고, FLOWS 의 lobby·world·chat-lobby·chat-keyboard·day·ghost·night-sizes(09-22 폰 크기 6종 기하)·result-reveal(11-07 결과 탭 패널 폰 6종)·result-awards(11-09 시상식 폰 6종)·politics-badge·politics-whisper(09.1.1-10 배지·귓속말 폰 6종)·politics-pin(09.1.1-11 핀 조명 폰 6종)·politics-verdict(09.1.1-13 판결 순간 폰 6종)·politics-runoff(09.1.1-14 동점 결선 폰 6종)·politics-showdown(09.1.1-16 마지막 3인 폰 6종)·avatar-emote(10-05 동작 판 폰 6종)·avatar-dress(10-07 꾸미기 폰 6종) 만 갖는다", () => {
  const run = readFileSync(new URL("./run.mjs", import.meta.url), "utf8");
  assert.match(run, /extraSizes/);
  assert.match(run, /!args\.sizesGiven/);
  const flows = readFileSync(new URL("./flows.mjs", import.meta.url), "utf8");
  const entries = [...flows.matchAll(/\{ id: "([a-z0-9-]+)", run: [A-Za-z(), ]+?(, extraSizes: LOBBY_EXTRA_SIZES)? \}/g)];
  const withExtra = entries.filter((m) => m[2]).map((m) => m[1]);
  assert.deepEqual(withExtra, ["lobby", "world", "chat-lobby", "chat-keyboard", "day", "ghost", "night-sizes", "result-reveal", "result-awards", "politics-badge", "politics-whisper", "politics-pin", "politics-verdict", "politics-runoff", "politics-showdown", "avatar-emote", "avatar-dress"]);
});

test("flows.mjs night-sizes 편지 시험 유언 WILL50 은 서버 유언 상한(WILL_MAX_GRAPHEMES)과 같은 자소 수이고, 공백 없는 긴 단어(10~15자)를 섞는다(사용자 결정 2026-11-05)", () => {
  const will = readFileSync(new URL("../../shared/game/will.ts", import.meta.url), "utf8");
  const max = Number(will.match(/export const WILL_MAX_GRAPHEMES = (\d+);/)?.[1]);
  assert.equal(max, 50);
  const flows = readFileSync(new URL("./flows.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(flows, /WILL100/);
  const text = flows.match(/const WILL50 = "([^"]+)";/)?.[1];
  assert.ok(text, "WILL50 문자열 상수");
  assert.equal(graphemeCount(text), max);
  const longest = Math.max(...text.split(" ").map((w) => graphemeCount(w)));
  assert.ok(longest >= 10 && longest <= 15, `가장 긴 단어 ${longest}자`);
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

// ---- 순차 지목 (09.1-08) ----

test("지목 시간 상수 사본과 nominationMaxMs: 8명 76200ms, 4명 41000ms", () => {
  assert.equal(NOMINATION_GATHER_MS, 3000);
  assert.equal(PICK_TURN_MS, 8000);
  assert.equal(PICK_GAP_MS, 900);
  assert.equal(NOMINATION_END_MS, 2000);
  assert.equal(nominationMaxMs(8), 76200);
  assert.equal(nominationMaxMs(4), 3000 + 4 * 8900 + 2000);
});

const goodTurn = (over = {}) => ({
  pill: { left: 40, top: 100, right: 350, bottom: 148 },
  pillScrollW: 310,
  pillClientW: 310,
  docScrollW: 390,
  docClientW: 390,
  minFontPx: 14,
  no: 2,
  seat: 1,
  ...over,
});
const turnOk = (t, vw = 390, vh = 844) => Object.fromEntries(turnBlockChecks(t, vw, vh).map((l) => [l.id, l.ok]));

test("turnBlockChecks: 화면 안·넘침 없음·글자 14px·숫자 속성이면 NT-A1~A4 모두 통과, 줄 모양은 { id, label, ok, detail }", () => {
  const lines = turnBlockChecks(goodTurn(), 390, 844);
  assert.deepEqual(lines.map((l) => l.id), ["NT-A1", "NT-A2", "NT-A3", "NT-A4"]);
  assert.ok(lines.every((l) => l.ok && l.detail === "" && typeof l.label === "string"));
});

test("turnBlockChecks NT-A1: 알약이 화면 밖으로 나가면 실패(0.5px 오차는 통과)하고 어느 쪽인지 말한다", () => {
  assert.equal(turnOk(goodTurn({ pill: { left: -0.5, top: 0, right: 390.5, bottom: 844.5 } }))["NT-A1"], true);
  assert.equal(turnOk(goodTurn({ pill: { left: -0.6, top: 100, right: 350, bottom: 148 } }))["NT-A1"], false);
  assert.equal(turnOk(goodTurn({ pill: { left: 40, top: 100, right: 391, bottom: 148 } }))["NT-A1"], false);
  assert.equal(turnOk(goodTurn({ pill: { left: 40, top: -2, right: 350, bottom: 148 } }))["NT-A1"], false);
  assert.equal(turnOk(goodTurn({ pill: { left: 40, top: 100, right: 350, bottom: 845 } }))["NT-A1"], false);
  const bad = turnBlockChecks(goodTurn({ pill: { left: 40, top: 100, right: 400, bottom: 148 } }), 390, 844).find((l) => l.id === "NT-A1");
  assert.match(bad.detail, /오른쪽/);
});

test("turnBlockChecks NT-A2: 알약 안·문서 가로 넘침(1px 오차까지 통과)", () => {
  assert.equal(turnOk(goodTurn({ pillScrollW: 311 }))["NT-A2"], true);
  assert.equal(turnOk(goodTurn({ pillScrollW: 312 }))["NT-A2"], false);
  assert.equal(turnOk(goodTurn({ docScrollW: 391 }))["NT-A2"], true);
  assert.equal(turnOk(goodTurn({ docScrollW: 392 }))["NT-A2"], false);
});

test("turnBlockChecks NT-A3·A4: 글자 14 미만 실패, 속성이 숫자가 아니면 실패", () => {
  assert.equal(TURN_FONT_MIN, 14);
  assert.equal(turnOk(goodTurn({ minFontPx: 13.9 }))["NT-A3"], false);
  assert.equal(turnOk(goodTurn({ minFontPx: 16 }))["NT-A3"], true);
  assert.equal(turnOk(goodTurn({ seat: NaN }))["NT-A4"], false);
  assert.equal(turnOk(goodTurn({ no: undefined }))["NT-A4"], false);
});

test("turnBlockChecks: 측정값이 없으면 조용히 통과하지 않고 '측정값 없음' 으로 실패", () => {
  for (const t of [null, undefined, {}, goodTurn({ pill: null })]) {
    const lines = turnBlockChecks(t, 390, 844);
    assert.equal(lines.length, 4);
    assert.ok(lines.some((l) => !l.ok && /측정값 없음/.test(l.detail)));
  }
  assert.ok(turnBlockChecks({}, 390, 844).every((l) => !l.ok));
});

// ---- 동점 결선 (09.1.1-14, UI-SPEC D) ----

const goodRunoff = (over = {}) => ({
  pill: { rect: { left: 120, top: 100, right: 270, bottom: 148 }, minFontPx: 16, parts: ["결선", "5초"], tone: "calm" },
  bar: { left: 20, top: 152, right: 370, bottom: 158 },
  candidates: [
    { seat: 2, rect: { left: 60, top: 400, right: 160, bottom: 460, width: 100, height: 60 } },
    { seat: 3, rect: { left: 230, top: 400, right: 330, bottom: 460, width: 100, height: 60 } },
  ],
  viewport: { w: 390, h: 844 },
  compact: false,
  ...over,
});
const runoffOk = (r) => Object.fromEntries(runoffChecks(r).map((l) => [l.id, l.ok]));

test("runoffChecks: 알약이 화면 안·글자 14px·후보 버튼 44×44·떨어짐 140·결선+초 두 조각·calm 이면 RF1~RF5 모두 통과", () => {
  const lines = runoffChecks(goodRunoff());
  assert.deepEqual(lines.map((l) => l.id), ["RF1", "RF2", "RF3", "RF4", "RF5"]);
  assert.ok(lines.every((l) => l.ok && l.detail === "" && typeof l.label === "string"));
});

test("runoffChecks RF1: 알약·막대가 화면 밖이거나 글자가 14px 미만이면 실패", () => {
  assert.equal(runoffOk(goodRunoff({ pill: { ...goodRunoff().pill, rect: { left: 300, top: 100, right: 400, bottom: 148 } } })).RF1, false);
  assert.equal(runoffOk(goodRunoff({ pill: { ...goodRunoff().pill, rect: { left: 120, top: -1, right: 270, bottom: 48 } } })).RF1, false);
  assert.equal(runoffOk(goodRunoff({ pill: { ...goodRunoff().pill, minFontPx: 13.9 } })).RF1, false);
  assert.equal(runoffOk(goodRunoff({ bar: { left: 20, top: 152, right: 392, bottom: 158 } })).RF1, false);
  const bad = runoffChecks(goodRunoff({ pill: { ...goodRunoff().pill, rect: { left: 300, top: 100, right: 400, bottom: 148 } } })).find((l) => l.id === "RF1");
  assert.match(bad.detail, /오른쪽/);
});

test("runoffChecks RF2: 후보 이름표 버튼 각각 44×44 이상(0.5px 오차 통과), 두 개가 아니면 실패", () => {
  const c = goodRunoff().candidates;
  const small = (w, h) => [{ ...c[0], rect: { left: 60, top: 400, right: 60 + w, bottom: 400 + h, width: w, height: h } }, c[1]];
  assert.equal(runoffOk(goodRunoff({ candidates: small(43.6, 44) })).RF2, true);
  assert.equal(runoffOk(goodRunoff({ candidates: small(43.4, 44) })).RF2, false);
  assert.equal(runoffOk(goodRunoff({ candidates: small(44, 40) })).RF2, false);
  assert.equal(runoffOk(goodRunoff({ candidates: [c[0]] })).RF2, false);
  assert.equal(runoffOk(goodRunoff({ candidates: [] })).RF2, false);
});

test("runoffChecks RF3: 두 버튼이 겹치지 않고 중심 거리가 140 이상이어야 한다(139 는 실패)", () => {
  const at = (cx2) => [
    { seat: 2, rect: { left: 40, top: 400, right: 140, bottom: 460, width: 100, height: 60 } },
    { seat: 3, rect: { left: cx2 - 50, top: 400, right: cx2 + 50, bottom: 460, width: 100, height: 60 } },
  ];
  assert.equal(runoffOk(goodRunoff({ candidates: at(90 + 140) })).RF3, true);
  assert.equal(runoffOk(goodRunoff({ candidates: at(90 + 139) })).RF3, false);
  assert.equal(runoffOk(goodRunoff({ candidates: at(90 + 60) })).RF3, false);
  const bad = runoffChecks(goodRunoff({ candidates: at(90 + 60) })).find((l) => l.id === "RF3");
  assert.match(bad.detail, /겹침|거리/);
});

test("runoffChecks RF4: 알약 안은 `결선` 과 `{초}초` 두 조각뿐 — 이름 조각이나 n / N 이 있으면 실패", () => {
  const p = goodRunoff().pill;
  assert.equal(runoffOk(goodRunoff({ pill: { ...p, parts: ["결선", "0초"] } })).RF4, true);
  assert.equal(runoffOk(goodRunoff({ pill: { ...p, parts: ["결선", "가나다라 님 차례", "5초"] } })).RF4, false);
  assert.equal(runoffOk(goodRunoff({ pill: { ...p, parts: ["1 / 4", "5초"] } })).RF4, false);
  assert.equal(runoffOk(goodRunoff({ pill: { ...p, parts: ["결선"] } })).RF4, false);
  assert.equal(runoffOk(goodRunoff({ pill: { ...p, parts: ["결선", "다섯초"] } })).RF4, false);
});

test("runoffChecks RF5: 알약 색(data-turn-tone)은 calm — warn/urgent 는 실패", () => {
  const p = goodRunoff().pill;
  assert.equal(runoffOk(goodRunoff({ pill: { ...p, tone: "warn" } })).RF5, false);
  assert.equal(runoffOk(goodRunoff({ pill: { ...p, tone: "urgent" } })).RF5, false);
  assert.equal(runoffOk(goodRunoff({ pill: { ...p, tone: null } })).RF5, false);
  assert.equal(runoffOk(goodRunoff({ pill: { ...p, tone: "calm" } })).RF5, true);
});

test("runoffChecks: 측정값이 없으면 조용히 통과하지 않고 '측정값 없음' 으로 실패", () => {
  for (const r of [null, undefined, {}, goodRunoff({ pill: null }), goodRunoff({ viewport: null })]) {
    const lines = runoffChecks(r);
    assert.equal(lines.length, 5);
    assert.ok(lines.some((l) => !l.ok && /측정값 없음/.test(l.detail)));
  }
});

test("runoffChecks: 압축형(compact)도 같은 문턱이다 — 알약 글자 14px 를 낮추지 않는다", () => {
  assert.equal(runoffOk(goodRunoff({ compact: true })).RF1, true);
  assert.equal(runoffOk(goodRunoff({ compact: true, pill: { ...goodRunoff().pill, minFontPx: 13 } })).RF1, false);
});

// ---- 마지막 3인 결전 (09.1.1-16, UI-SPEC E) ----

const goodShowdownSpeak = (over = {}) => ({
  mode: "speak",
  pill: { rect: { left: 100, top: 100, right: 290, bottom: 148 }, minFontPx: 16, parts: ["1 / 3", "가나다 님 차례", "8초"], tone: "calm" },
  bar: { left: 20, top: 152, right: 370, bottom: 158 },
  panel: { left: 0, top: 600, right: 390, bottom: 844, height: 244 },
  sheet: { left: 0, top: 600, right: 390, bottom: 844, height: 244 },
  chips: [
    { left: 16, top: 612, right: 190, bottom: 656, height: 44 },
    { left: 198, top: 612, right: 374, bottom: 656, height: 44 },
    { left: 16, top: 664, right: 190, bottom: 708, height: 44 },
    { left: 198, top: 664, right: 374, bottom: 708, height: 44 },
    { left: 16, top: 716, right: 190, bottom: 760, height: 44 },
  ],
  quote: { rect: { left: 16, top: 166, right: 374, bottom: 212, width: 358 }, fontPx: 16, lines: 1 },
  buttons: undefined,
  viewport: { w: 390, h: 844 },
  compact: false,
  ...over,
});
const goodShowdownPoint = (over = {}) =>
  goodShowdownSpeak({
    mode: "point",
    pill: { rect: { left: 100, top: 100, right: 290, bottom: 148 }, minFontPx: 16, parts: ["지목", "모두 동시에", "8초"], tone: "calm" },
    sheet: undefined,
    chips: undefined,
    quote: undefined,
    buttons: [
      { seat: 1, rect: { left: 60, top: 400, right: 160, bottom: 460 } },
      { seat: 2, rect: { left: 230, top: 400, right: 330, bottom: 460 } },
    ],
    ...over,
  });
const shOk = (r) => Object.fromEntries(showdownChecks(r).map((l) => [l.id, l.ok]));

test("showdownChecks: 한마디(speak) 정상 입력은 SH1~SH4·SH6 모두 통과하고 SH5 는 만들지 않는다", () => {
  const lines = showdownChecks(goodShowdownSpeak());
  assert.deepEqual(lines.map((l) => l.id), ["SH1", "SH2", "SH3", "SH4", "SH6"]);
  assert.ok(lines.every((l) => l.ok && l.detail === "" && typeof l.label === "string"));
});

test("showdownChecks: 동시 지목(point) 정상 입력은 SH1·SH2·SH5·SH6 통과, 시트·인용 카드 항목은 만들지 않는다", () => {
  const lines = showdownChecks(goodShowdownPoint());
  assert.deepEqual(lines.map((l) => l.id), ["SH1", "SH2", "SH5", "SH6"]);
  assert.ok(lines.every((l) => l.ok));
});

test("showdownChecks: 시트·인용 카드가 없는 구경 화면(speak, sheet·quote 미지정)은 SH1·SH2·SH6 만 본다", () => {
  const lines = showdownChecks(goodShowdownSpeak({ sheet: undefined, chips: undefined, quote: undefined }));
  assert.deepEqual(lines.map((l) => l.id), ["SH1", "SH2", "SH6"]);
  assert.ok(lines.every((l) => l.ok));
});

test("showdownChecks SH1: 알약이 화면 밖이거나 글자가 14px 미만이면 실패", () => {
  const p = goodShowdownSpeak().pill;
  assert.equal(shOk(goodShowdownSpeak({ pill: { ...p, rect: { ...p.rect, right: 400 } } })).SH1, false);
  assert.equal(shOk(goodShowdownSpeak({ pill: { ...p, minFontPx: 13.9 } })).SH1, false);
  assert.equal(shOk(goodShowdownSpeak({ pill: { ...p, minFontPx: 14 } })).SH1, true);
  assert.equal(shOk(goodShowdownSpeak({ bar: { left: 20, top: 152, right: 392, bottom: 158 } })).SH1, false);
});

test("showdownChecks SH2: speak 는 `n / 3`·`{이름} 님 차례`·`{초}초`, point 는 `지목`·`모두 동시에`·`{초}초` 세 조각이어야 한다", () => {
  const p = goodShowdownSpeak().pill;
  assert.equal(shOk(goodShowdownSpeak({ pill: { ...p, parts: ["3 / 3", "나 님 차례", "0초"] } })).SH2, true);
  assert.equal(shOk(goodShowdownSpeak({ pill: { ...p, parts: ["1 / 4", "가나다 님 차례", "8초"] } })).SH2, false);
  assert.equal(shOk(goodShowdownSpeak({ pill: { ...p, parts: ["1 / 3", "8초"] } })).SH2, false);
  assert.equal(shOk(goodShowdownSpeak({ pill: { ...p, parts: ["1 / 3", "모두 동시에", "8초"] } })).SH2, false);
  const q = goodShowdownPoint().pill;
  assert.equal(shOk(goodShowdownPoint({ pill: { ...q, parts: ["지목", "가나다 님 차례", "8초"] } })).SH2, false);
  assert.equal(shOk(goodShowdownPoint({ pill: { ...q, parts: ["1 / 3", "모두 동시에", "8초"] } })).SH2, false);
  assert.equal(shOk(goodShowdownPoint({ pill: { ...q, parts: ["지목", "모두 동시에", "여덟초"] } })).SH2, false);
});

test("showdownChecks SH3: 시트 윗변=패널 윗변 ±1, 높이=패널 높이 ±1, 칩 높이 ≥ 44, 칩 3줄 이하", () => {
  const g = goodShowdownSpeak();
  assert.equal(shOk(g).SH3, true);
  assert.equal(shOk(goodShowdownSpeak({ sheet: { ...g.sheet, top: 602 } })).SH3, false);
  assert.equal(shOk(goodShowdownSpeak({ sheet: { ...g.sheet, top: 601 } })).SH3, true);
  assert.equal(shOk(goodShowdownSpeak({ sheet: { ...g.sheet, height: 188, bottom: 788 } })).SH3, false);
  assert.equal(shOk(goodShowdownSpeak({ chips: g.chips.map((c, i) => (i === 1 ? { ...c, height: 43, bottom: c.top + 43 } : c)) })).SH3, false);
  const four = [...g.chips, { left: 198, top: 768, right: 374, bottom: 812, height: 44 }];
  assert.equal(shOk(goodShowdownSpeak({ chips: four })).SH3, false);
});

test("showdownChecks SH4: 인용 카드는 알약 아랫변+8 ±2 뒤에 시작·폭 화면−32 ±2·글자 16±0.5·두 줄 이하", () => {
  const g = goodShowdownSpeak();
  const q = g.quote;
  assert.equal(shOk(g).SH4, true);
  assert.equal(shOk(goodShowdownSpeak({ quote: { ...q, rect: { ...q.rect, top: 175 } } })).SH4, false);
  assert.equal(shOk(goodShowdownSpeak({ quote: { ...q, rect: { ...q.rect, top: 162 } } })).SH4, false);
  assert.equal(shOk(goodShowdownSpeak({ quote: { ...q, rect: { ...q.rect, width: 340 } } })).SH4, false);
  assert.equal(shOk(goodShowdownSpeak({ quote: { ...q, fontPx: 15 } })).SH4, false);
  assert.equal(shOk(goodShowdownSpeak({ quote: { ...q, fontPx: 16.4 } })).SH4, true);
  assert.equal(shOk(goodShowdownSpeak({ quote: { ...q, lines: 3 } })).SH4, false);
  assert.equal(shOk(goodShowdownSpeak({ quote: { ...q, lines: 2 } })).SH4, true);
});

test("showdownChecks SH5: 지목 버튼은 정확히 둘, 각 44×44 이상, 서로 겹치지 않는다", () => {
  const b = goodShowdownPoint().buttons;
  assert.equal(shOk(goodShowdownPoint()).SH5, true);
  assert.equal(shOk(goodShowdownPoint({ buttons: [b[0]] })).SH5, false);
  assert.equal(shOk(goodShowdownPoint({ buttons: [b[0], { seat: 2, rect: { left: 60, top: 400, right: 60 + 43.4, bottom: 460 } }] })).SH5, false);
  assert.equal(shOk(goodShowdownPoint({ buttons: [b[0], { seat: 2, rect: { left: 150, top: 400, right: 250, bottom: 460 } }] })).SH5, false);
});

test("showdownChecks SH6: 알약·막대 아랫변이 일반 160, 압축형(360×560) 124 아래 ±2 에 있다", () => {
  const p = goodShowdownSpeak().pill;
  assert.equal(shOk(goodShowdownSpeak({ bar: { left: 20, top: 152, right: 370, bottom: 162 } })).SH6, true);
  assert.equal(shOk(goodShowdownSpeak({ bar: { left: 20, top: 152, right: 370, bottom: 163 } })).SH6, false);
  const c = goodShowdownSpeak({ compact: true, pill: { ...p, rect: { ...p.rect, top: 72, bottom: 120 } }, bar: { left: 20, top: 120, right: 370, bottom: 124 } });
  assert.equal(shOk(c).SH6, true);
  assert.equal(shOk({ ...c, bar: { left: 20, top: 120, right: 370, bottom: 128 } }).SH6, false);
});

test("showdownChecks: 측정값이 없으면 조용히 통과하지 않고 '측정값 없음' 으로 실패", () => {
  for (const r of [null, undefined, {}, goodShowdownSpeak({ pill: null }), goodShowdownSpeak({ viewport: null })]) {
    const lines = showdownChecks(r);
    assert.ok(lines.length >= 3);
    assert.ok(lines.some((l) => !l.ok && /측정값 없음/.test(l.detail)));
  }
  assert.ok(showdownChecks(goodShowdownSpeak({ sheet: null })).some((l) => l.id === "SH3" && !l.ok && /측정값 없음/.test(l.detail)));
  assert.ok(showdownChecks(goodShowdownSpeak({ quote: null })).some((l) => l.id === "SH4" && !l.ok && /측정값 없음/.test(l.detail)));
  assert.ok(showdownChecks(goodShowdownPoint({ buttons: null })).some((l) => l.id === "SH5" && !l.ok && /측정값 없음/.test(l.detail)));
});

test("마지막 3인 시간 상수 사본: 모이기 2초·한마디 8초·지목 8초·공개 1.5초, 사이 0.9초는 PICK_GAP_MS 재사용", () => {
  assert.equal(SHOWDOWN_GATHER_MS, 2000);
  assert.equal(SHOWDOWN_TURN_MS, 8000);
  assert.equal(SHOWDOWN_POINT_MS, 8000);
  assert.equal(SHOWDOWN_REVEAL_MS, 1500);
  assert.equal(PICK_GAP_MS, 900);
});

// ---- 유언 편지(09.1-11) ----
const goodLetter = (over = {}) => ({
  vw: 390,
  vh: 844,
  paper: { left: 28, top: 200, width: 334, height: 349 },
  lines: [
    { left: 80, top: 260, width: 230, height: 36 },
    { left: 100, top: 300, width: 190, height: 36 },
  ],
  seal: { left: 240, top: 440, width: 95, height: 95 },
  sealSize: 84,
  head: { fontPx: 14, color: "rgb(95, 104, 123)" },
  paperBg: "rgb(243, 239, 228)",
  ...over,
});
const letterOk = (m) => Object.fromEntries(letterChecks(m).map((l) => [l.id, l.ok]));

test("편지 시간 상수 사본: 접힘 5000·제거 5420·일반 알림 400·인장 글자 M", () => {
  assert.equal(LETTER_FOLD_AT_MS, 5000);
  assert.equal(LETTER_END_AT_MS, 5420);
  assert.equal(ANNOUNCE_MORNING_AT, 400);
  assert.equal(SEAL_GLYPH, "M");
});

test("parseRgb·contrastRatio: 검정 대 흰색 21:1, 읽을 수 없으면 null", () => {
  assert.deepEqual(parseRgb("rgba(10, 20, 30, 0.5)"), [10, 20, 30]);
  assert.equal(parseRgb("red"), null);
  assert.ok(Math.abs(contrastRatio("rgb(0, 0, 0)", "rgb(255, 255, 255)") - 21) < 0.01);
  assert.equal(contrastRatio("x", "rgb(0, 0, 0)"), null);
});

test("letterChecks: 알맞은 편지는 LT4~LT8 모두 통과, 줄 모양은 { id, label, ok, detail }", () => {
  const lines = letterChecks(goodLetter());
  assert.deepEqual(lines.map((l) => l.id), ["LT4", "LT5", "LT6", "LT7", "LT8"]);
  assert.ok(lines.every((l) => l.ok && typeof l.label === "string" && l.detail === ""));
});

test("letterChecks LT4: 편지지가 화면 밖이면 실패(0.5px 오차까지 통과)", () => {
  assert.equal(letterOk(goodLetter({ paper: { left: -0.5, top: 200, width: 334, height: 349 } })).LT4, true);
  assert.equal(letterOk(goodLetter({ paper: { left: -1, top: 200, width: 334, height: 349 } })).LT4, false);
  assert.equal(letterOk(goodLetter({ paper: { left: 28, top: 200, width: 334, height: 645 } })).LT4, false);
  assert.equal(letterOk(goodLetter({ paper: { left: 60, top: 200, width: 331, height: 349 } })).LT4, false);
});

test("letterChecks LT5: 편지지 밖으로 나온 줄이 있으면 실패", () => {
  assert.equal(letterOk(goodLetter({ lines: [{ left: 20, top: 260, width: 100, height: 36 }] })).LT5, false);
  assert.equal(letterOk(goodLetter({ lines: [] })).LT5, false);
});

test("letterChecks LT6: 인장 원과 겹치는 줄은 실패, 사각형 모서리만 닿는 줄은 통과", () => {
  // 인장 중심 (287.5, 487.5), 반지름 84 × 0.46 = 38.6
  assert.equal(letterOk(goodLetter({ lines: [{ left: 200, top: 470, width: 120, height: 32 }] })).LT6, false);
  // 인장 사각형(95×95) 모서리 가까이지만 원 밖
  assert.equal(letterOk(goodLetter({ lines: [{ left: 100, top: 428, width: 160, height: 32 }] })).LT6, true);
  assert.equal(letterOk(goodLetter({ lines: [{ left: 100, top: 300, width: 300, height: 32 }] })).LT6, true);
});

test("letterChecks LT7·LT8: 머리글 14px 미만·대비 4.5 미만이면 실패", () => {
  assert.equal(letterOk(goodLetter({ head: { fontPx: 13.9, color: "rgb(95, 104, 123)" } })).LT7, false);
  // 시안 값 #6a7388 on #f3efe4 는 4.14:1 이라 14px 머리글로는 모자란다
  assert.equal(letterOk(goodLetter({ head: { fontPx: 14, color: "rgb(106, 115, 136)" } })).LT8, false);
  assert.equal(letterOk(goodLetter({ head: { fontPx: 14, color: "rgb(95, 104, 123)" } })).LT8, true);
});

test("letterChecks: 측정값이 없으면 조용히 통과하지 않고 '측정값 없음' 으로 실패", () => {
  for (const m of [null, undefined, {}, goodLetter({ paper: null }), goodLetter({ head: null })]) {
    const lines = letterChecks(m);
    assert.equal(lines.length, 5);
    assert.ok(lines.some((l) => !l.ok && /측정값 없음/.test(l.detail)));
  }
});

test("externalPenFontRequests: 대상 주소 밖의 Nanum 요청만 센다, 같은 출처 조각은 센다고 하지 않는다", () => {
  const origin = "http://localhost:5173";
  const urls = [
    "http://localhost:5173/fonts/nanum-pen-script/nps-012.woff2",
    "https://fonts.googleapis.com/css2?family=Gowun+Dodum&display=swap",
    "https://fonts.googleapis.com/css2?family=Nanum+Pen+Script&display=swap",
    "https://fonts.gstatic.com/s/nanumpenscript/v21/abc.woff2",
    "not a url",
  ];
  assert.equal(externalPenFontRequests(urls, origin), 2);
  assert.equal(ownPenFontRequests(urls, origin), 1);
  assert.equal(externalPenFontRequests([], origin), 0);
  assert.equal(externalPenFontRequests(undefined, origin), 0);
});

// ---- 09.1.1-10: 떠 있는 버튼·시트 맞음·배지 기하 ----

const okOf = (lines) => Object.fromEntries(lines.map((l) => [l.id, l.ok]));
const onlyFail = (lines, ...ids) => assert.deepEqual(lines.filter((l) => !l.ok).map((l) => l.id), ids);

// 390x844 폰, 패널 윗변 700: 버튼 둘이 오른쪽 16, 패널 윗변 위 8 에서 아래 버튼이 끝난다(48 + 8 + 48).
const floatGood = () => ({
  buttons: [
    { kind: "claim", rect: rect(326, 588, 48, 48) },
    { kind: "whisper", rect: rect(326, 644, 48, 48) },
  ],
  panel: { top: 700 },
  viewport: { w: 390, h: 844 },
  kbOpen: false,
  expectCount: 2,
});

test("상수: 떠 있는 버튼 48·여백 16·사이 8, 귓속말 시트 124, 배지 20·말 바꿈 점 16", () => {
  assert.equal(FLOAT_SIZE, 48);
  assert.equal(FLOAT_MARGIN, 16);
  assert.equal(FLOAT_GAP, 8);
  assert.equal(WHISPER_SHEET_H, 124);
  assert.equal(CLAIM_BADGE_SIZE, 20);
  assert.equal(CLAIM_SWAP_SIZE, 16);
});

test("floatButtonChecks: 정상 값은 FB1~FB5 모두 통과, 줄 모양은 { id, label, ok, detail }", () => {
  const lines = floatButtonChecks(floatGood());
  assert.deepEqual(okOf(lines), { FB1: true, FB2: true, FB3: true, FB4: true, FB5: true });
  for (const l of lines) assert.deepEqual(Object.keys(l).sort(), ["detail", "id", "label", "ok"]);
});

test("floatButtonChecks FB1: 개수가 기대와 다르거나 화면 밖으로 나가면 실패", () => {
  const miss = floatGood();
  miss.buttons = miss.buttons.slice(0, 1);
  onlyFail(floatButtonChecks(miss), "FB1");
  const out = floatGood();
  out.buttons[1].rect = rect(350, 644, 48, 48); // 오른쪽 398 > 390
  const lines = floatButtonChecks(out);
  assert.equal(okOf(lines).FB1, false);
  assert.equal(okOf(lines).FB5, false); // 여백도 어긋난다
  const one = floatGood();
  one.buttons = one.buttons.slice(0, 1);
  one.expectCount = 1; // 변론 이후처럼 한 개만 기대하면 통과
  assert.equal(okOf(floatButtonChecks(one)).FB1, true);
});

test("floatButtonChecks FB2: 버튼끼리 0.5px 넘게 겹치면 실패하고 쌍을 말한다, 변이 맞닿으면 통과", () => {
  const clash = floatGood();
  clash.buttons[1].rect = rect(326, 620, 48, 48);
  const bad = floatButtonChecks(clash).find((l) => l.id === "FB2");
  assert.equal(bad.ok, false);
  assert.match(bad.detail, /claim-whisper/);
  const touch = floatGood();
  touch.buttons[1].rect = rect(326, 636, 48, 48);
  assert.equal(okOf(floatButtonChecks(touch)).FB2, true);
});

test("floatButtonChecks FB3: 키보드가 닫혀 있을 때만 아랫변이 패널 윗변 − 8 이내, 열려 있으면 보지 않는다", () => {
  const low = floatGood();
  low.buttons[1].rect = rect(326, 656, 48, 48); // 아래 704 > 700 − 8
  onlyFail(floatButtonChecks(low), "FB3");
  const kb = floatGood();
  kb.buttons[1].rect = rect(326, 656, 48, 48);
  kb.kbOpen = true;
  assert.equal(okOf(floatButtonChecks(kb)).FB3, true);
  const edge = floatGood();
  edge.buttons[1].rect = rect(326, 644.4, 48, 48); // 아래 692.4 ≤ 692.5
  assert.equal(okOf(floatButtonChecks(edge)).FB3, true);
});

test("floatButtonChecks FB4·FB5: 지름 48±1 이 아니거나 오른쪽 여백이 16±1 이 아니면 실패", () => {
  const small = floatGood();
  small.buttons[0].rect = rect(326, 588, 43, 43);
  onlyFail(floatButtonChecks(small), "FB4", "FB5");
  const m = floatGood();
  m.buttons[0].rect = rect(320, 588, 48, 48); // 여백 22
  onlyFail(floatButtonChecks(m), "FB5");
});

test("floatButtonChecks: 측정값이 없으면 통과시키지 않는다", () => {
  const lines = floatButtonChecks({ buttons: null, panel: null, viewport: null });
  assert.equal(lines.length, 5);
  assert.ok(lines.every((l) => l.ok === false && /측정값 없음/.test(l.detail)));
});

// 귓속말 시트(390x844): 폭 370, 높이 126(124 + 테두리), 패널 윗변 700 위 8 에 앉는다.
const whisperGood = () => ({
  kind: "whisper",
  sheet: rect(10, 566, 370, 126),
  header: { bottom: 62 },
  viewport: { w: 390, h: 844 },
  panel: { top: 700 },
  targets: [rect(20, 578, 44, 44), rect(326, 636, 48, 48), rect(272, 636, 44, 44)],
  fontMin: 14,
});

test("sheetFitChecks(whisper): 정상 값은 SF1~SF5 와 높이 SF6 모두 통과", () => {
  const lines = sheetFitChecks(whisperGood());
  assert.deepEqual(okOf(lines), { SF1: true, SF2: true, SF3: true, SF4: true, SF5: true, SF6: true });
  for (const l of lines) assert.deepEqual(Object.keys(l).sort(), ["detail", "id", "label", "ok"]);
});

test("sheetFitChecks SF1·SF2: 헤더에 걸치거나 화면 밖이면 실패", () => {
  const up = whisperGood();
  up.sheet = rect(10, 50, 370, 126);
  onlyFail(sheetFitChecks(up), "SF1");
  const wide = whisperGood();
  wide.sheet = rect(10, 566, 390, 126); // 오른쪽 400 > 390
  onlyFail(sheetFitChecks(wide), "SF2");
});

test("sheetFitChecks SF3: 패널이 있으면 시트 아랫변 ≤ 패널 윗변, 패널이 null(가려짐)이면 보이는 화면 아래 이내", () => {
  const over = whisperGood();
  over.sheet = rect(10, 580, 370, 126); // 아래 706 > 700
  onlyFail(sheetFitChecks(over), "SF3");
  const kb = whisperGood();
  kb.panel = null;
  kb.viewport = { w: 360, h: 304 }; // 키보드 336 이 올라온 640 폰
  kb.sheet = rect(5, 170, 350, 126);
  kb.targets = [rect(15, 182, 44, 44), rect(290, 238, 48, 48)];
  assert.equal(okOf(sheetFitChecks(kb)).SF3, true);
  kb.sheet = rect(5, 190, 350, 126); // 아래 316 > 304
  assert.equal(okOf(sheetFitChecks(kb)).SF3, false);
});

test("sheetFitChecks SF4·SF5: 누르기 대상 44 미만, 글자 14 미만이면 실패", () => {
  const tap = whisperGood();
  tap.targets = [rect(20, 578, 44, 40)];
  onlyFail(sheetFitChecks(tap), "SF4");
  const font = whisperGood();
  font.fontMin = 13;
  onlyFail(sheetFitChecks(font), "SF5");
  const half = whisperGood();
  half.targets = [rect(20, 578, 43.5, 44)]; // 0.5px 오차는 G3 와 같다
  assert.equal(okOf(sheetFitChecks(half)).SF4, true);
});

test("sheetFitChecks SF6(whisper): 높이 124±2 밖이면 실패", () => {
  const tall = whisperGood();
  tall.sheet = rect(10, 560, 370, 132);
  onlyFail(sheetFitChecks(tall), "SF6");
  const ok = whisperGood();
  ok.sheet = rect(10, 568, 370, 124);
  assert.equal(okOf(sheetFitChecks(ok)).SF6, true);
});

test("sheetFitChecks(badge): 칩 줄 수와 안내 유무에 맞는 높이(1줄 120·2줄 172·안내 +28, ±4 + 테두리 2)", () => {
  const base = { kind: "badge", header: { bottom: 62 }, viewport: { w: 390, h: 844 }, panel: { top: 700 }, targets: [rect(20, 600, 90, 44)], fontMin: 14 };
  const two = { ...base, chipRows: 2, hint: false, sheet: rect(10, 520, 370, 174) };
  assert.equal(okOf(sheetFitChecks(two)).SF6, true);
  const twoHint = { ...base, chipRows: 2, hint: true, sheet: rect(10, 490, 370, 202) };
  assert.equal(okOf(sheetFitChecks(twoHint)).SF6, true);
  const one = { ...base, chipRows: 1, hint: false, sheet: rect(10, 572, 370, 122) };
  assert.equal(okOf(sheetFitChecks(one)).SF6, true);
  const wrong = { ...base, chipRows: 2, hint: true, sheet: rect(10, 520, 370, 174) }; // 안내가 있는데 안내 없는 높이
  assert.equal(okOf(sheetFitChecks(wrong)).SF6, false);
  const missing = { ...base, chipRows: undefined, hint: false, sheet: rect(10, 520, 370, 174) };
  assert.equal(okOf(sheetFitChecks(missing)).SF6, false);
});

test("sheetFitChecks: 측정값이 없으면 통과시키지 않는다", () => {
  const lines = sheetFitChecks({ kind: "whisper", sheet: null });
  assert.equal(lines.length, 6);
  assert.ok(lines.every((l) => l.ok === false && /측정값 없음/.test(l.detail)));
});

// 배지: 이름표(.mv-tag) 오른쪽 위 모서리 — 지름 20, 오른쪽으로 4 나가고 위로 8 올라간다.
const badgeGood = () => ({
  badge: { rect: rect(204, 192, 20, 20), icon: { width: 14, height: 14 }, swap: null },
  tag: rect(120, 200, 100, 28),
  tagWidthWithout: 100,
});

test("claimBadgeChecks: 정상 값은 CB1~CB4 모두 통과(말 바꿈 점이 없으면 점 검사는 건너뜀)", () => {
  const lines = claimBadgeChecks(badgeGood());
  assert.deepEqual(okOf(lines), { CB1: true, CB2: true, CB3: true, CB4: true });
  for (const l of lines) assert.deepEqual(Object.keys(l).sort(), ["detail", "id", "label", "ok"]);
});

test("claimBadgeChecks CB1: 지름이 20±1 이 아니면 실패", () => {
  const b = badgeGood();
  b.badge.rect = rect(204, 192, 24, 24);
  assert.equal(okOf(claimBadgeChecks(b)).CB1, false);
  const edge = badgeGood();
  edge.badge.rect = rect(204, 192, 21, 21);
  assert.equal(okOf(claimBadgeChecks(edge)).CB1, true);
});

test("claimBadgeChecks CB2: 이름표 오른쪽 위 모서리에서 바깥 4·위 −8 (±2) 밖이면 실패", () => {
  const b = badgeGood();
  b.badge.rect = rect(180, 192, 20, 20); // 오른쪽 모서리 200 → 바깥 −20
  assert.equal(okOf(claimBadgeChecks(b)).CB2, false);
  const up = badgeGood();
  up.badge.rect = rect(204, 180, 20, 20); // 위 −20
  assert.equal(okOf(claimBadgeChecks(up)).CB2, false);
  const near = badgeGood();
  near.badge.rect = rect(205.5, 193.5, 20, 20);
  assert.equal(okOf(claimBadgeChecks(near)).CB2, true);
});

test("claimBadgeChecks CB3: 이름표 폭이 배지 없을 때보다 0.5px 넘게 늘면 실패, 기준 폭이 없으면 실패(측정값 없음)", () => {
  const w = badgeGood();
  w.tag = rect(120, 200, 124, 28);
  assert.equal(okOf(claimBadgeChecks(w)).CB3, false);
  const none = badgeGood();
  delete none.tagWidthWithout;
  const line = claimBadgeChecks(none).find((l) => l.id === "CB3");
  assert.equal(line.ok, false);
  assert.match(line.detail, /측정값 없음/);
});

test("claimBadgeChecks CB4: 아이콘이 14±1 이 아니면 실패", () => {
  const b = badgeGood();
  b.badge.icon = { width: 18, height: 18 };
  assert.equal(okOf(claimBadgeChecks(b)).CB4, false);
});

test("claimBadgeChecks CB5: 말 바꿈 점이 있으면 지름 16±1, 없으면 줄 자체가 없다", () => {
  const withSwap = badgeGood();
  withSwap.badge.swap = rect(220, 208, 16, 16);
  const lines = claimBadgeChecks(withSwap);
  assert.equal(okOf(lines).CB5, true);
  withSwap.badge.swap = rect(220, 208, 12, 12);
  assert.equal(okOf(claimBadgeChecks(withSwap)).CB5, false);
  assert.equal(claimBadgeChecks(badgeGood()).some((l) => l.id === "CB5"), false);
});

test("claimBadgeChecks: 측정값이 없으면 통과시키지 않는다", () => {
  const lines = claimBadgeChecks({ badge: null, tag: null });
  assert.equal(lines.length, 4);
  assert.ok(lines.every((l) => l.ok === false && /측정값 없음/.test(l.detail)));
});

// ---- 판결 순간 연출 (09.1.1-13) ----
const VIEW_360x640 = { w: 360, h: 640 };
/** 8인판 R=4 모양: 찬성 묶음 알약 4줄(2개씩), 반대는 비었다. 알림 아랫변 115, 패널 윗변 640-188 */
const ballotGood = (over = {}) => ({
  root: rect(16, 131, 328, 313),
  groups: [
    { side: "yes", rect: rect(16, 131, 328, 28 + 4 * 40) },
    { side: "no", rect: rect(16, 131 + 28 + 4 * 40 + 16, 328, 28) },
  ],
  pills: [
    { side: "yes", rect: rect(16, 167, 150, 32), nameFont: 14 },
    { side: "yes", rect: rect(174, 167, 150, 32), nameFont: 14 },
    { side: "no", rect: rect(16, 360, 150, 32), nameFont: 14 },
  ],
  panelTop: 452,
  announceBottom: 115,
  viewport: VIEW_360x640,
  compact: false,
  ...over,
});

test("ballotFitChecks: 기대 모양(R=4)은 BF1~BF6 이 모두 통과하고 줄 모양은 { id, label, ok, detail }", () => {
  const lines = ballotFitChecks(ballotGood());
  assert.deepEqual(idsOk(lines), { BF1: true, BF2: true, BF3: true, BF4: true, BF5: true, BF6: true });
  for (const l of lines) assert.deepEqual(Object.keys(l).sort(), ["detail", "id", "label", "ok"]);
});

test("ballotFitChecks BF1: 묶음이나 알약이 화면 밖으로 나가면 실패한다(0.5px 오차 허용)", () => {
  assert.equal(idsOk(ballotFitChecks(ballotGood({ pills: [{ side: "yes", rect: rect(300, 167, 70, 32), nameFont: 14 }, { side: "no", rect: rect(16, 360, 150, 32), nameFont: 14 }] }))).BF1, false);
  assert.equal(idsOk(ballotFitChecks(ballotGood({ groups: [{ side: "yes", rect: rect(16.4, 131, 343.6, 100) }, { side: "no", rect: rect(16, 250, 328, 28) }] }))).BF1, true);
});

test("ballotFitChecks BF2: 묶음 윗변이 알림 아랫변 + 16 보다 위면 실패(0.5px 허용), 알림이 두 줄이면 겹쳐 실패", () => {
  assert.equal(idsOk(ballotFitChecks(ballotGood({ announceBottom: 130 }))).BF2, false);
  assert.equal(idsOk(ballotFitChecks(ballotGood({ announceBottom: 115.4 }))).BF2, true);
  assert.equal(idsOk(ballotFitChecks(ballotGood({ announceBottom: null }))).BF2, true, "알림이 없으면 이 검사는 건너뛴다(통과)");
});

test("ballotFitChecks BF3: 묶음 아랫변이 패널 윗변 − 8 을 넘으면 실패", () => {
  assert.equal(idsOk(ballotFitChecks(ballotGood({ panelTop: 365 }))).BF3, false);
  assert.equal(idsOk(ballotFitChecks(ballotGood({ panelTop: 371 }))).BF3, true);
});

test("ballotFitChecks BF4: 이름이 있는 알약 글자가 14 미만이면 실패, 2단계(compact)는 이름이 없어 건너뛴다", () => {
  const small = ballotGood({ pills: [{ side: "yes", rect: rect(16, 167, 150, 32), nameFont: 13 }, { side: "no", rect: rect(16, 360, 150, 32), nameFont: 14 }] });
  assert.equal(idsOk(ballotFitChecks(small)).BF4, false);
  const faces = ballotGood({ compact: true, pills: [{ side: "yes", rect: rect(16, 167, 32, 32), nameFont: null }, { side: "no", rect: rect(16, 360, 32, 32), nameFont: null }] });
  assert.equal(idsOk(ballotFitChecks(faces)).BF4, true);
});

test("ballotFitChecks BF5: 찬성 묶음이 반대 묶음보다 위가 아니면 실패, 묶음이 하나뿐이면 측정값 없음으로 실패", () => {
  const swapped = ballotGood();
  swapped.groups = [swapped.groups[1], swapped.groups[0]].map((g, i) => ({ ...g, side: i === 0 ? "yes" : "no" }));
  assert.equal(idsOk(ballotFitChecks(swapped)).BF5, false);
  const one = ballotFitChecks(ballotGood({ groups: [ballotGood().groups[0]] })).find((l) => l.id === "BF5");
  assert.equal(one.ok, false);
  assert.match(one.detail, /측정값 없음/);
});

test("ballotFitChecks BF6: 알약 높이 32±1(compact 는 얼굴 지름 32±1)", () => {
  const tall = ballotGood({ pills: [{ side: "yes", rect: rect(16, 167, 150, 34), nameFont: 14 }, { side: "no", rect: rect(16, 360, 150, 32), nameFont: 14 }] });
  assert.equal(idsOk(ballotFitChecks(tall)).BF6, false);
  const ok = ballotGood({ pills: [{ side: "yes", rect: rect(16, 167, 150, 32.9), nameFont: 14 }, { side: "no", rect: rect(16, 360, 150, 31.2), nameFont: 14 }] });
  assert.equal(idsOk(ballotFitChecks(ok)).BF6, true);
  const faces = ballotGood({ compact: true, pills: [{ side: "yes", rect: rect(16, 167, 24, 24), nameFont: null }, { side: "no", rect: rect(16, 360, 32, 32), nameFont: null }] });
  assert.equal(idsOk(ballotFitChecks(faces)).BF6, false);
});

test("ballotFitChecks: 측정값이 없으면 통과시키지 않는다", () => {
  const lines = ballotFitChecks({ root: null, groups: null, pills: null, panelTop: null, announceBottom: null, viewport: null, compact: false });
  assert.equal(lines.length, 6);
  assert.ok(lines.every((l) => l.ok === false && /측정값 없음/.test(l.detail)));
});

/** 시간표 기록(변할 때만): t 는 ms, 처형 진입 관찰 시각 1000 을 0 으로 본다. 처형 시나리오 */
const tl = (over = {}) => [
  { t: 900, phase: "verdict", stage: null, yes: false, no: false, seat: null, strength: 0, zoom: 1, dim: "off" },
  { t: 1000, phase: "execution", stage: null, yes: false, no: false, seat: null, strength: 0, zoom: 1, dim: "verdict" },
  { t: 1010, phase: "execution", stage: null, yes: false, no: false, seat: 4, strength: 0.1, zoom: 1, dim: "verdict" },
  { t: 1200, phase: "execution", stage: null, yes: false, no: false, seat: 4, strength: 1, zoom: 1.04, dim: "verdict" },
  { t: 1600, phase: "execution", stage: "yes", yes: true, no: false, seat: 4, strength: 1, zoom: 1.1, dim: "verdict" },
  { t: 2000, phase: "execution", stage: "both", yes: true, no: true, seat: 4, strength: 1, zoom: 1.1, dim: "verdict" },
  { t: 5600, phase: "execution", stage: null, yes: false, no: false, seat: 4, strength: 1, zoom: 1.1, dim: "off" },
  { t: 5700, phase: "execution", stage: null, yes: false, no: false, seat: 4, strength: 1, zoom: 1.05, dim: "off" },
  { t: 6000, phase: "execution", stage: null, yes: false, no: false, seat: null, strength: 0.6, zoom: 1, dim: "off" },
  { t: 6420, phase: "execution", stage: null, yes: false, no: false, seat: null, strength: 0, zoom: 1, dim: "off" },
  ...(over.extra ?? []),
];
const VT = { passed: true, candidate: 4, expectZoom: true };
const vtIds = (lines) => Object.fromEntries(lines.map((l) => [l.id, l.ok]));

test("verdictTimelineChecks: 처형 시나리오 기대 시간표(0.6/1.0/4.6초, 핀 5.0초, 줌 1.10)는 모두 통과한다", () => {
  const lines = verdictTimelineChecks(tl(), VT);
  assert.ok(lines.every((l) => l.ok), lines.filter((l) => !l.ok).map((l) => `${l.id} ${l.detail}`).join(" / "));
  for (const l of lines) assert.deepEqual(Object.keys(l).sort(), ["detail", "id", "label", "ok"]);
  assert.deepEqual(lines.map((l) => l.id), ["VT1", "VT2", "VT3", "VT4", "VT5", "VT6"]);
});

test("verdictTimelineChecks VT1: 찬성 묶음이 0.3초 안에 이미 있으면 실패, 1.0초 넘어 나타나도 실패", () => {
  const early = tl().map((e) => (e.t === 1600 ? { ...e, t: 1200 } : e)).filter((e) => !(e.t === 1200 && e.zoom === 1.04));
  assert.equal(vtIds(verdictTimelineChecks(early, VT)).VT1, false);
  const late = tl().map((e) => (e.t === 1600 ? { ...e, t: 2200 } : e)).sort((a, b) => a.t - b.t);
  assert.equal(vtIds(verdictTimelineChecks(late, VT)).VT1, false);
});

test("verdictTimelineChecks VT2: 반대 묶음은 찬성 묶음보다 0.2~0.6초 뒤에 나타나고 그 순간 찬성은 이미 있다", () => {
  const same = tl().map((e) => (e.t === 2000 ? { ...e, t: 1620 } : e));
  assert.equal(vtIds(verdictTimelineChecks(same, VT)).VT2, false);
  const together = tl().map((e) => (e.t === 1600 ? { ...e, stage: "both", no: true } : e));
  assert.equal(vtIds(verdictTimelineChecks(together, VT)).VT2, false);
});

test("verdictTimelineChecks VT3: 묶음이 4.6초(±0.4)에 사라진다 — 3.5초에 사라지거나 한참 남아도 실패", () => {
  const early = tl().map((e) => (e.t === 5600 ? { ...e, t: 4500 } : e));
  assert.equal(vtIds(verdictTimelineChecks(early, VT)).VT3, false);
  const never = tl().map((e) => (e.t >= 5600 ? { ...e, stage: "both", yes: true, no: true } : e));
  assert.equal(vtIds(verdictTimelineChecks(never, VT)).VT3, false);
});

test("verdictTimelineChecks VT4: 핀이 변론자에게 켜지고(세기 0.5 이상) 처형은 5.0초·부결은 4.0초(±0.4)에 꺼지기 시작한다", () => {
  assert.equal(vtIds(verdictTimelineChecks(tl(), VT)).VT4, true);
  assert.equal(vtIds(verdictTimelineChecks(tl(), { ...VT, passed: false })).VT4, false, "부결이면 4.0초에 꺼져야 한다");
  const other = tl().map((e) => (e.seat === 4 ? { ...e, seat: 2 } : e));
  assert.equal(vtIds(verdictTimelineChecks(other, VT)).VT4, false);
  const noPin = tl().map((e) => ({ ...e, seat: null, strength: 0 }));
  assert.equal(vtIds(verdictTimelineChecks(noPin, VT)).VT4, false);
});

test("verdictTimelineChecks VT5: 0.7초 뒤 줌 1.10±0.01 (높이 360 미만이면 모든 순간 1)", () => {
  assert.equal(vtIds(verdictTimelineChecks(tl(), VT)).VT5, true);
  const never = tl().map((e) => ({ ...e, zoom: 1 }));
  assert.equal(vtIds(verdictTimelineChecks(never, VT)).VT5, false);
  assert.equal(vtIds(verdictTimelineChecks(never, { ...VT, expectZoom: false })).VT5, true);
  assert.equal(vtIds(verdictTimelineChecks(tl(), { ...VT, expectZoom: false })).VT5, false, "작은 스테이지에서 줌이 켜지면 실패");
});

test("verdictTimelineChecks VT6: 5.45초에 줌이 1 로 돌아와 있다(처형 단계가 끝나기 전)", () => {
  assert.equal(vtIds(verdictTimelineChecks(tl(), VT)).VT6, true);
  const stuck = tl().map((e) => (e.t >= 6000 ? { ...e, zoom: 1.1 } : e));
  assert.equal(vtIds(verdictTimelineChecks(stuck, VT)).VT6, false);
});

test("verdictTimelineChecks: 처형 단계 기록이 없으면 모든 줄이 측정값 없음으로 실패한다", () => {
  const lines = verdictTimelineChecks([{ t: 1, phase: "verdict", stage: null, yes: false, no: false, seat: null, strength: 0, zoom: 1, dim: "off" }], VT);
  assert.equal(lines.length, 6);
  assert.ok(lines.every((l) => l.ok === false && /측정값 없음/.test(l.detail)));
});

// ---- 10-05: 동작 버튼·5+4 판 기하 (emoteTrayChecks, D-18) ----

// 360x560 폰: 입력줄 윗변 460. 동작 버튼 48 · 입력칸 160(깃펜이 있는 모양) · 판 폭 328(좌우 16) · 칸 55.6x56 · 판 아랫변 = 입력줄 윗변 − 8.
const trayGood = () => {
  const cw = 55.6;
  const topRow = [0, 1, 2, 3, 4].map((i) => rect(25 + i * (cw + 8), 313, cw, 56));
  const lowRow = [0, 1, 2, 3].map((j) => rect(56.8 + j * (cw + 8), 377, cw, 56));
  return {
    button: rect(16, 460, 48, 48),
    input: rect(72, 460, 160, 48),
    tray: rect(16, 306, 328, 146),
    cells: [...topRow, ...lowRow],
    nameFont: 14,
    viewport: { w: 360, h: 560 },
    character: { x: 180, y: 250 },
    hasKb: false,
  };
};

test("emoteTrayChecks: 정상 값은 EB1·EP2·TR1·TR2·EP3·TR3·EP4·TR4·TR5 모두 통과, 줄 모양은 { id, label, ok, detail }", () => {
  const lines = emoteTrayChecks(trayGood());
  assert.deepEqual(okOf(lines), { EB1: true, EP2: true, TR1: true, TR2: true, EP3: true, TR3: true, EP4: true, TR4: true, TR5: true });
  for (const l of lines) assert.deepEqual(Object.keys(l).sort(), ["detail", "id", "label", "ok"]);
});

test("emoteTrayChecks EB1: 버튼이 48x48 이 아니면 그 항목만 실패", () => {
  const g = trayGood();
  g.button = rect(16, 460, 44, 48);
  onlyFail(emoteTrayChecks(g), "EB1");
});

test("emoteTrayChecks EP2: 입력칸 폭 150 미만이면 그 항목만 실패, 150 은 통과", () => {
  const g = trayGood();
  g.input = rect(72, 460, 149, 48);
  onlyFail(emoteTrayChecks(g), "EP2");
  g.input = rect(72, 460, 150, 48);
  assert.equal(okOf(emoteTrayChecks(g)).EP2, true);
});

test("emoteTrayChecks TR1: 판 좌우 16 에서 벗어나거나 폭이 viewport − 32 가 아니면 그 항목만 실패", () => {
  const g = trayGood();
  g.tray = rect(20, 306, 320, 146);
  onlyFail(emoteTrayChecks(g), "TR1");
});

test("emoteTrayChecks TR2: 칸이 아홉 개가 아니거나 5+4 줄이 아니거나 아랫줄이 가운데가 아니면 실패", () => {
  const eight = trayGood();
  eight.cells = eight.cells.slice(0, 8);
  assert.equal(okOf(emoteTrayChecks(eight)).TR2, false);
  const left = trayGood();
  left.cells = left.cells.map((c, i) => (i >= 5 ? rect(c.left - 30, c.top, c.width, c.height) : c));
  assert.equal(okOf(emoteTrayChecks(left)).TR2, false);
  const rows = trayGood();
  rows.cells = rows.cells.map((c, i) => (i === 2 ? rect(c.left, c.top + 9, c.width, c.height) : c)); // 세 번째 칸만 다른 줄
  assert.equal(okOf(emoteTrayChecks(rows)).TR2, false);
});

test("emoteTrayChecks EP3: 칸이 44 미만이면 그 항목만 실패", () => {
  const g = trayGood();
  g.cells = g.cells.map((c, i) => (i === 4 ? rect(c.left + c.width - 43, c.top, 43, 56) : c)); // 오른쪽 변은 그대로, 폭만 43
  onlyFail(emoteTrayChecks(g), "EP3");
});

test("emoteTrayChecks TR3: 판 아랫변이 입력줄 윗변 − 8 에서 2 넘게 벗어나면 그 항목만 실패", () => {
  const g = trayGood();
  g.tray = rect(16, 300, 328, 146); // 아랫변 446 (기대 452)
  onlyFail(emoteTrayChecks(g), "TR3");
});

test("emoteTrayChecks EP4: 캐릭터 점이 판 사각형 안이면 그 항목만 실패", () => {
  const g = trayGood();
  g.character = { x: 180, y: 400 };
  onlyFail(emoteTrayChecks(g), "EP4");
});

test("emoteTrayChecks TR4: 이름 글자 14px 미만이면 그 항목만 실패", () => {
  const g = trayGood();
  g.nameFont = 13;
  onlyFail(emoteTrayChecks(g), "TR4");
});

test("emoteTrayChecks TR5: 판이 열려 있는데 키보드가 열려 있으면 그 항목만 실패", () => {
  const g = trayGood();
  g.hasKb = true;
  onlyFail(emoteTrayChecks(g), "TR5");
});

test("emoteTrayChecks: 측정값이 없으면 모든 줄이 측정값 없음으로 실패", () => {
  const lines = emoteTrayChecks({});
  assert.equal(lines.length, 9);
  assert.ok(lines.every((l) => l.ok === false && /측정값 없음/.test(l.detail)));
});

test("AVATAR_MARKERS: 동작 표식 네 개 + 의상 표식 세 개(10-07)", () => {
  assert.deepEqual([...AVATAR_MARKERS], ["data-emote-button", "data-emote-tray", "data-emote", "__mfEmotes", "data-dress-sheet", "data-outfit", "__mfLooks"]);
});

// ---- 10-07: 꾸미기 버튼·시트·카드 기하 (dressChecks, D-18) ----

// 360x560 폰: 패널 윗변 310(높이 250). 떠 있는 버튼 48 · 오른쪽 16 · 아랫변 = 패널 윗변 − 8. 시트 = 패널 사각형. 카드 72x112, 사이 8, 왼쪽 12 에서 시작.
const dressGood = () => {
  const panel = rect(0, 310, 360, 250);
  const cards = Array.from({ length: 9 }, (_, i) => rect(12 + i * 80, 366, 72, 112));
  return {
    float: rect(296, 254, 48, 48),
    panel,
    sheet: rect(0, 310, 360, 250),
    cards,
    close: rect(304, 322, 44, 44),
    selected: { rect: cards[0], pressedCount: 1 },
    nameFont: 14,
    viewport: { w: 360, h: 560 },
    kb: false,
  };
};

test("dressChecks: 정상 값은 DB1·DS1~DS6 모두 통과, 줄 모양은 { id, label, ok, detail }", () => {
  const lines = dressChecks(dressGood());
  assert.deepEqual(okOf(lines), { DB1: true, DS1: true, DS2: true, DS3: true, DS4: true, DS5: true, DS6: true });
  for (const l of lines) assert.deepEqual(Object.keys(l).sort(), ["detail", "id", "label", "ok"]);
});

test("dressChecks DB1: 지름 48±1 · 오른쪽 여백 16±1 · 아랫변 = 패널 윗변 − 8 ±2 중 하나라도 어긋나면 그 항목만 실패", () => {
  const a = dressGood();
  a.float = rect(296, 254, 44, 44);
  onlyFail(dressChecks(a), "DB1");
  const b = dressGood();
  b.float = rect(290, 254, 48, 48);
  onlyFail(dressChecks(b), "DB1");
  const c = dressGood();
  c.float = rect(296, 240, 48, 48);
  onlyFail(dressChecks(c), "DB1");
  const d = dressGood();
  d.float = rect(296, 253, 48, 48); // 아랫변 301 (기대 302) — 오차 안
  assert.equal(okOf(dressChecks(d)).DB1, true);
});

test("dressChecks DS1: 시트 윗변 = 패널 윗변 ±1 · 높이 = 패널 높이 ±1 — 어긋나면 그 항목만 실패", () => {
  const a = dressGood();
  a.sheet = rect(0, 300, 360, 260);
  onlyFail(dressChecks(a), "DS1");
  const b = dressGood();
  b.sheet = rect(0, 310, 360, 200);
  onlyFail(dressChecks(b), "DS1");
});

test("dressChecks DS2: 카드가 아홉 개가 아니거나 폭 72±2 가 아니거나 높이 44 미만이면 그 항목만 실패", () => {
  const a = dressGood();
  a.cards = a.cards.slice(0, 8);
  onlyFail(dressChecks(a), "DS2");
  const b = dressGood();
  b.cards = b.cards.map((c, i) => (i === 3 ? rect(c.left, c.top, 60, 112) : c));
  const lb = dressChecks(b);
  assert.equal(okOf(lb).DS2, false);
  const c = dressGood();
  c.cards = c.cards.map((x, i) => (i === 3 ? rect(x.left, x.top, 72, 40) : x));
  assert.equal(okOf(dressChecks(c)).DS2, false);
});

test("dressChecks DS3: 폭 360 에서 완전히 보이는 카드 4 이상 + 오른쪽 가장자리에 걸친 다음 카드(8px 이상 보이고 잘림) — 어느 하나 없으면 그 항목만 실패", () => {
  const g = dressGood();
  assert.equal(okOf(dressChecks(g)).DS3, true);
  // 다음 카드가 통째로 안에 들어와(스크롤 끝) 걸치는 카드가 없음
  const a = dressGood();
  a.cards = a.cards.map((c, i) => rect(8 + i * 32, c.top, 72, 112));
  assert.equal(okOf(dressChecks(a)).DS3, false);
  // 완전히 보이는 카드가 3장뿐
  const b = dressGood();
  b.cards = b.cards.map((c, i) => rect(60 + i * 80, c.top, 72, 112));
  assert.equal(okOf(dressChecks(b)).DS3, false);
  // 다음 카드가 4px 만 보임(걸침이 너무 작다)
  const c = dressGood();
  c.cards = c.cards.map((x, i) => rect(4 + i * 88, x.top, 72, 112));
  c.cards = c.cards.map((x, i) => (i === 4 ? rect(356, x.top, 72, 112) : i > 4 ? rect(440 + (i - 5) * 80, x.top, 72, 112) : x));
  assert.equal(okOf(dressChecks(c)).DS3, false);
});

test("dressChecks DS4: 닫기가 44x44 미만이면 그 항목만 실패", () => {
  const g = dressGood();
  g.close = rect(304, 322, 40, 44);
  onlyFail(dressChecks(g), "DS4");
});

test("dressChecks DS5: 선택 카드가 띠 밖이거나 aria-pressed=true 가 하나가 아니면 그 항목만 실패", () => {
  const a = dressGood();
  a.selected = { rect: rect(332, 366, 72, 112), pressedCount: 1 };
  onlyFail(dressChecks(a), "DS5");
  const b = dressGood();
  b.selected = { rect: b.cards[0], pressedCount: 2 };
  onlyFail(dressChecks(b), "DS5");
  const c = dressGood();
  c.selected = { rect: b.cards[0], pressedCount: 0 };
  onlyFail(dressChecks(c), "DS5");
});

test("dressChecks DS6: 이름 글자 14px 미만이면 그 항목만 실패", () => {
  const g = dressGood();
  g.nameFont = 13;
  onlyFail(dressChecks(g), "DS6");
});

test("dressChecks: 측정값이 없으면 모든 줄이 측정값 없음으로 실패", () => {
  const lines = dressChecks({});
  assert.equal(lines.length, 7);
  assert.ok(lines.every((l) => l.ok === false && /측정값 없음/.test(l.detail)));
});

// ---- 10-08: 단계별 동작 도착·비밀 채널 0건·떠 있는 버튼 숨김 (emoteDeliveryChecks·floatTrayChecks, D-18·D-20) ----

const deliveryArrive = () => ({
  sender: { name: "손님", last: { seat: 2, id: "clap", n: 3 }, playing: [2] },
  receivers: [
    { name: "방장", before: { seat: 1, id: "dance", n: 2 }, last: { seat: 2, id: "clap", n: 3 }, playing: [2] },
    { name: "친구", before: null, last: { seat: 2, id: "clap", n: 1 }, playing: [2, 4] },
  ],
  expectSeat: 2,
  expectId: "clap",
  mode: "arrive",
});

test("emoteDeliveryChecks arrive: 모두 {seat,id} 가 맞고 playing 에 보낸 좌석이 있으면 모든 줄 통과, 줄 모양은 { id, label, ok, detail }", () => {
  const lines = emoteDeliveryChecks(deliveryArrive());
  assert.equal(lines.length, 3);
  assert.ok(lines.every((l) => l.ok && typeof l.id === "string" && typeof l.label === "string" && l.detail === ""));
});

test("emoteDeliveryChecks arrive: 받는 한 페이지의 id 만 어긋나면 그 줄만 실패한다", () => {
  const c = deliveryArrive();
  c.receivers[1] = { ...c.receivers[1], last: { seat: 2, id: "dance", n: 1 } };
  const lines = emoteDeliveryChecks(c);
  assert.deepEqual(lines.filter((l) => !l.ok).map((l) => l.id), ["ED2"]);
  assert.match(lines[2].detail, /친구/);
});

test("emoteDeliveryChecks arrive: seat 가 다르거나 last 가 null 이거나 playing 에 좌석이 없으면 해당 줄만 실패", () => {
  for (const [patch, id] of [
    [{ last: { seat: 3, id: "clap", n: 3 } }, "ED1"],
    [{ last: null }, "ED1"],
    [{ playing: [] }, "ED1"],
  ]) {
    const c = deliveryArrive();
    c.receivers[0] = { ...c.receivers[0], ...patch };
    assert.deepEqual(emoteDeliveryChecks(c).filter((l) => !l.ok).map((l) => l.id), [id]);
  }
  const c = deliveryArrive();
  c.sender = { ...c.sender, playing: [] };
  assert.deepEqual(emoteDeliveryChecks(c).filter((l) => !l.ok).map((l) => l.id), ["ED0"]);
});

const deliveryAbsent = () => ({
  sender: { name: "마피아 방장", last: { seat: 1, id: "throat", n: 1 }, playing: [1] },
  receivers: [
    { name: "시민 손님", before: { seat: 3, id: "clap", n: 4 }, last: { seat: 3, id: "clap", n: 4 }, playing: [] },
    { name: "또 한 명", before: null, last: null, playing: [] },
  ],
  expectSeat: 1,
  expectId: "throat",
  mode: "absent",
});

test("emoteDeliveryChecks absent: 받는 페이지의 last 가 이전과 같고 playing 에 좌석이 없으면 통과(보낸 사람은 자기 프레임이 있어야 한다)", () => {
  const lines = emoteDeliveryChecks(deliveryAbsent());
  assert.equal(lines.length, 3);
  assert.ok(lines.every((l) => l.ok));
});

test("emoteDeliveryChecks absent: 받으면 안 되는 페이지의 last 가 바뀌었거나 playing 에 좌석이 들면 그 줄만 실패, 보낸 사람 프레임이 없어도 그 줄만 실패", () => {
  const a = deliveryAbsent();
  a.receivers[0] = { ...a.receivers[0], last: { seat: 1, id: "throat", n: 1 } };
  assert.deepEqual(emoteDeliveryChecks(a).filter((l) => !l.ok).map((l) => l.id), ["ED1"]);
  const b = deliveryAbsent();
  b.receivers[1] = { ...b.receivers[1], playing: [1] };
  assert.deepEqual(emoteDeliveryChecks(b).filter((l) => !l.ok).map((l) => l.id), ["ED2"]);
  const c = deliveryAbsent();
  c.sender = { ...c.sender, last: null };
  assert.deepEqual(emoteDeliveryChecks(c).filter((l) => !l.ok).map((l) => l.id), ["ED0"]);
});

test("emoteDeliveryChecks: 보낸 사람 없이도 돌고, 받는 페이지가 없거나 mode 를 모르면 측정값 없음으로 실패", () => {
  const c = deliveryArrive();
  c.sender = null;
  const lines = emoteDeliveryChecks(c);
  assert.deepEqual(lines.map((l) => l.id), ["ED1", "ED2"]);
  assert.ok(lines.every((l) => l.ok));
  for (const bad of [{ ...deliveryArrive(), receivers: [] }, { ...deliveryArrive(), mode: "x" }, {}]) {
    const out = emoteDeliveryChecks(bad);
    assert.ok(out.length >= 1 && out.every((l) => !l.ok && /측정값 없음/.test(l.detail)));
  }
});

const floatTrayGood = () => ({ visibleBefore: { count: 1, shown: 1 }, hiddenWhileOpen: { count: 1, shown: 0 }, visibleAfter: { count: 1, shown: 1 } });

test("floatTrayChecks: 열기 전 보이고 열린 동안 숨고 닫으면 돌아오면 FT1~FT3 모두 통과", () => {
  const lines = floatTrayChecks(floatTrayGood());
  assert.deepEqual(lines.map((l) => l.id), ["FT1", "FT2", "FT3"]);
  assert.ok(lines.every((l) => l.ok));
});

test("floatTrayChecks: 한 값씩 어긋나면 해당 항목만 실패한다", () => {
  const a = floatTrayGood();
  a.visibleBefore = { count: 1, shown: 0 };
  onlyFail(floatTrayChecks(a), "FT1");
  const b = floatTrayGood();
  b.hiddenWhileOpen = { count: 1, shown: 1 };
  onlyFail(floatTrayChecks(b), "FT2");
  const c = floatTrayGood();
  c.visibleAfter = { count: 1, shown: 0 };
  onlyFail(floatTrayChecks(c), "FT3");
});

test("floatTrayChecks: 떠 있는 버튼이 하나도 없으면(확인할 것이 없음) 세 줄 모두 실패 · 측정값이 없어도 실패", () => {
  const none = { count: 0, shown: 0 };
  assert.ok(floatTrayChecks({ visibleBefore: none, hiddenWhileOpen: none, visibleAfter: none }).every((l) => !l.ok));
  const lines = floatTrayChecks({});
  assert.equal(lines.length, 3);
  assert.ok(lines.every((l) => !l.ok && /측정값 없음/.test(l.detail)));
});

// ---- 12-06: 소리 시험 페이지 sound-render 순수 판정 (D-18, T-12-22) ----

const soundRow = (id, over = {}) => ({ id, peakDb: -9, rmsDb: -30, nan: 0, lengthMs: 300, declaredMs: id.startsWith("bed.") ? null : 300, ok: true, ...over });
const soundRows = () => [...Array.from({ length: 7 }, (_, i) => soundRow(`bed.${i}`)), ...Array.from({ length: 49 }, (_, i) => soundRow(`sfx.${i}`))];
const soundFails = (lines) => lines.filter((l) => !l.ok).map((l) => l.id);

test("SOUND_RENDER_LIMITS: 56개 · 피크 −3 · RMS −60 · 길이 ±50ms (문턱은 이 한 곳)", () => {
  assert.deepEqual({ ...SOUND_RENDER_LIMITS }, { count: 56, peakMaxDb: -3, rmsMinDb: -60, lengthTolMs: 50 });
  assert.throws(() => {
    SOUND_RENDER_LIMITS.peakMaxDb = 0;
  });
});

test("SOUND_MARKERS: 시험 페이지 표식 네 개", () => {
  assert.deepEqual([...SOUND_MARKERS], ["data-sound-lab", "data-sound-id", "__mfSound", "__mfSoundLab"]);
});

test("soundRenderChecks: 정상 56개는 모두 통과", () => {
  const lines = soundRenderChecks(soundRows());
  assert.equal(lines.length, 6);
  assert.deepEqual(lines.map((l) => l.id), ["SR1", "SR2", "SR3", "SR4", "SR5", "SR6"]);
  assert.deepEqual(soundFails(lines), []);
});

test("soundRenderChecks: 개수가 56 이 아니면 SR1 실패(55·57)", () => {
  const r = soundRows();
  assert.deepEqual(soundFails(soundRenderChecks(r.slice(1))), ["SR1"]);
  assert.deepEqual(soundFails(soundRenderChecks([...r, soundRow("extra.0")])), ["SR1"]);
});

test("soundRenderChecks: id 중복은 SR2 실패이고 id 를 적는다", () => {
  const r = soundRows();
  r[10] = soundRow(r[11].id);
  const lines = soundRenderChecks(r);
  assert.deepEqual(soundFails(lines), ["SR2"]);
  assert.match(lines.find((l) => l.id === "SR2").detail, new RegExp(r[11].id));
});

test("soundRenderChecks: 피크 경계 −3.0 통과 / −2.99 실패, 실패 id 를 적는다", () => {
  const ok = soundRows();
  ok[3] = soundRow(ok[3].id, { peakDb: -3 });
  assert.deepEqual(soundFails(soundRenderChecks(ok)), []);
  const bad = soundRows();
  bad[3] = soundRow(bad[3].id, { peakDb: -2.99 });
  const lines = soundRenderChecks(bad);
  assert.deepEqual(soundFails(lines), ["SR3"]);
  assert.match(lines.find((l) => l.id === "SR3").detail, new RegExp(bad[3].id));
});

test("soundRenderChecks: NaN 이 1 개라도 있으면 SR4 실패", () => {
  const r = soundRows();
  r[20] = soundRow(r[20].id, { nan: 1 });
  assert.deepEqual(soundFails(soundRenderChecks(r)), ["SR4"]);
});

test("soundRenderChecks: RMS 경계 −60 통과 / −60.01 실패", () => {
  const ok = soundRows();
  ok[9] = soundRow(ok[9].id, { rmsDb: -60 });
  assert.deepEqual(soundFails(soundRenderChecks(ok)), []);
  const bad = soundRows();
  bad[9] = soundRow(bad[9].id, { rmsDb: -60.01 });
  assert.deepEqual(soundFails(soundRenderChecks(bad)), ["SR5"]);
});

test("soundRenderChecks: 효과음 길이 차이 50 통과 / 50.01 실패, 침대(선언 null)는 길이를 보지 않는다", () => {
  const ok = soundRows();
  ok[30] = soundRow(ok[30].id, { lengthMs: 350, declaredMs: 300 });
  ok[31] = soundRow(ok[31].id, { lengthMs: 250, declaredMs: 300 });
  assert.deepEqual(soundFails(soundRenderChecks(ok)), []);
  const bad = soundRows();
  bad[30] = soundRow(bad[30].id, { lengthMs: 350.01, declaredMs: 300 });
  assert.deepEqual(soundFails(soundRenderChecks(bad)), ["SR6"]);
  const bed = soundRows();
  bed[0] = soundRow(bed[0].id, { lengthMs: 12, declaredMs: null });
  assert.deepEqual(soundFails(soundRenderChecks(bed)), []);
});

test("soundRenderChecks: 문턱을 인자로 바꿔 줄 수 있지만 기본 문턱은 SOUND_RENDER_LIMITS", () => {
  const r = soundRows();
  r[2] = soundRow(r[2].id, { peakDb: -2 });
  assert.deepEqual(soundFails(soundRenderChecks(r, { ...SOUND_RENDER_LIMITS, peakMaxDb: -1 })), []);
  assert.deepEqual(soundFails(soundRenderChecks(r)), ["SR3"]);
});

test("soundRenderChecks: 배열이 아니거나 필드가 숫자가 아니면 측정값 없음으로 실패", () => {
  assert.ok(soundRenderChecks(null).every((l) => !l.ok && /측정값 없음/.test(l.detail)));
  const r = soundRows();
  r[5] = { id: r[5].id, peakDb: "x" };
  const lines = soundRenderChecks(r);
  assert.ok(lines.some((l) => !l.ok));
});

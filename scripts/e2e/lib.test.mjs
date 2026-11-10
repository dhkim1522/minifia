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
  LOBBY_HOST_TUTORIAL_EXTRA,
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
  WHISPER_NOTICE_H,
  CLAIM_BADGE_SIZE,
  CLAIM_SWAP_SIZE,
  floatButtonChecks,
  emoteTrayChecks,
  dressChecks,
  emoteDeliveryChecks,
  floatTrayChecks,
  AVATAR_MARKERS,
  dressLockChecks,
  outfitUniqueChecks,
  SOUND_MARKERS,
  SOUND_RENDER_LIMITS,
  soundButtonChecks,
  sideColumnChecks,
  SIDE_COLUMN_EXCEPTIONS,
  SIDE_ORDER,
  soundRenderChecks,
  soundNightParityChecks,
  soundVerdictTimingChecks,
  soundEmoteLeakChecks,
  soundResultChecks,
  soundResultSkipChecks,
  soundSequenceChecks,
  SOUND_SCRIPT_STEPS,
  NOMINATION_MS,
  OFF_DEVICE_SELECTORS,
  OFF_DEVICE_ATTR_PREFIX,
  offDeviceKeysOf,
  basicOrderChecks,
  sheetFitChecks,
  claimBadgeChecks,
  ballotFitChecks,
  verdictTimelineChecks,
  parseRgb,
} from "./lib.mjs";
import { dropSockets } from "./browser.mjs";
import {
  FLOAT_BOX_H,
  FLOAT_LABEL_EXTRA,
  ROLE_LINES,
  HOST_ACT_LINES,
  VIEW_DAY_KEYS,
  VIEW_ME_KEYS,
  VIEW_TOP_KEYS,
  ERRAND_LINES,
  ERRAND_MARKERS,
  ERRAND_PER_PERSON,
  ERRAND_PLACE_IDS,
  NIGHT_FACE_ROLES,
  OVERALL_LIMIT_MS,
  OPENING_LAMPS,
  TUTORIAL_DOT_COUNT,
  WRONG_HINT_AFTER,
  TUTORIAL_CAST_E2E,
  TUTORIAL_ERRAND_MS,
  TUTORIAL_OPENING_MS,
  sentFrameChecks,
  tutorialBandChecks,
  tutorialDimChecks,
  tutorialDotChecks,
  tutorialEntryChecks,
  tutorialEvidenceChecks,
  tutorialFocusChecks,
  tutorialHiddenChecks,
  tutorialLeakChecks,
  tutorialLineChecks,
  tutorialNextChecks,
  tutorialOpeningChecks,
  tutorialRevealChecks,
  tutorialRoleCardChecks,
  tutorialRoleLineChecks,
  tutorialSkipChecks,
  TUTORIAL_ROLE_LINES_E2E,
  tutorialTimingChecks,
  errandCardChecks,
  errandCardWalkChecks,
  errandChecks,
  errandOverlapChecks,
  errandParityChecks,
  nightFaceChecks,
  recordChecks,
  traceChecks,
  traceMarkChecks,
  expectedMarks,
  sameOutfitSeatsE2E,
  TRACE_OF_OUTFIT_E2E,
  hostBandChecks,
  hostChimeChecks,
  hostLeakChecks,
  hostOverlapChecks,
  toolLabelChecks,
  viewKeyChecks,
} from "./lib.mjs";

const PROD = "https://minifia-v3.dhplay.workers.dev\n";
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
  assert.equal(t.origin, "https://minifia-v3.dhplay.workers.dev");
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

test("USAGE 의 예시 주소는 v3 다", () => {
  assert.ok(USAGE.includes("minifia-v3.dhplay.workers.dev"));
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
  // 17-07(0080-4): 방장 패널 +76 = 스위치 줄 64 + 간격 12
  assert.equal(LOBBY_HOST_TUTORIAL_EXTRA, 76);
  assert.equal(lobbyPanelHeight(96, true), 326);
  assert.equal(lobbyPanelHeight(152, true), 382);
  assert.equal(lobbyPanelHeight(96, false), 250);
});

test("17-07: view 키 사본에 tutorial·tutorialDone 이 있다", () => {
  assert.ok(VIEW_TOP_KEYS.has("tutorial"));
  assert.ok(VIEW_ME_KEYS.has("tutorialDone"));
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

test("EXPECTED_SCENE: 단계 열여섯 개(15-01 이 errand, 17-01 이 tutorial 을 더했다)가 모두 장면 id 로 정해져 있다 (옛 처형 여부·후보 선택·후보 공개 단계는 08-22 에 PhaseId 와 함께 없어졌고, 결선 runoff·마지막 3인 showdown 은 09.1.1-04·06 이 더했다)", () => {
  assert.deepEqual(Object.keys(EXPECTED_SCENE).sort(), [
    "assigning", "dayAnnounce", "defense", "discussion", "ended", "errand", "execution", "lobby", "morning", "night", "nomination", "roleReveal", "runoff", "showdown", "tutorial", "verdict",
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

test("gamePanelHeight: 토론 LOG_H+154 · 채팅 +92 · 찬반 투표자 +218 · 찬반 보기 +126 (UI-SPEC 표의 여섯 폰 값, 이름표 보정 없음 — 16-05)", () => {
  assert.equal(gamePanelHeight(780, "talk"), 152 + 154);
  assert.equal(gamePanelHeight(640, "chat"), 96 + 92);
  assert.equal(gamePanelHeight(844, "verdictVoter"), 152 + 218);
  assert.equal(gamePanelHeight(664, "verdictViewer"), 96 + 126);
  // UI-SPEC 폰 크기 표: [방 높이, 토론, 채팅, 투표자, 보기]
  for (const [h, talk, chat, voter, viewer] of [[640, 250, 188, 314, 222], [664, 250, 188, 314, 222], [932, 306, 244, 370, 278], [560, 250, 188, 314, 222], [844, 306, 244, 370, 278], [874, 306, 244, 370, 278]]) {
    assert.deepEqual([gamePanelHeight(h, "talk"), gamePanelHeight(h, "chat"), gamePanelHeight(h, "verdictVoter"), gamePanelHeight(h, "verdictViewer")], [talk, chat, voter, viewer], `방 높이 ${h}`);
  }
  assert.deepEqual({ ...GAME_PANEL_EXTRA }, { talk: 154, chat: 92, verdictVoter: 218, verdictViewer: 126 });
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

test("gamePanelHeight: 밤은 faceList 하나(faceListPanelH) — 옛 밤 마피아·밤 시민 패널 종류는 15-08 에서 없어졌다 (09-21, 15-09)", () => {
  assert.equal(Object.hasOwn(GAME_PANEL_EXTRA, "nightMafia"), false);
  assert.throws(() => gamePanelHeight(640, "nightMafia"), /알 수 없는 패널 종류/);
  assert.throws(() => gamePanelHeight(640, ["night", "Citizen"].join("")), /알 수 없는 패널 종류/);
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
  items: [{ text: "토론하세요", inBand: true, height: 20, lineHeight: 20 }],
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
  const r = guideChecks(gOk({ items: [{ text: "  \n ", inBand: true, height: 20, lineHeight: 20 }] }), { phase: "discussion" });
  assert.equal(r.ok, false);
  assert.match(r.detail, /글자/);
});

test("guideChecks UX1(14페이즈): 띠 문장은 3줄 미만 — 두 줄은 통과, 세 줄은 실패", () => {
  const two = guideChecks(gOk({ items: [{ text: "안내", inBand: true, height: 40, lineHeight: 20 }] }), { phase: "discussion" });
  assert.equal(two.ok, true, two.detail);
  const three = guideChecks(gOk({ items: [{ text: "안내", inBand: true, height: 60, lineHeight: 20 }] }), { phase: "discussion" });
  assert.equal(three.ok, false);
  assert.match(three.detail, /3줄/);
});

test("guideChecks UX1(14페이즈): 안내 문장이 띠 밖이면 실패한다", () => {
  const r = guideChecks(gOk({ items: [{ text: "안내", inBand: false, height: 20, lineHeight: 20 }] }), { phase: "discussion" });
  assert.equal(r.ok, false);
  assert.match(r.detail, /띠 밖/);
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
  const r = guideChecks(gOk({ items: [{ text: "안내", inBand: true, height: "x", lineHeight: 20 }] }), { phase: "discussion" });
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

test("run.mjs: 흐름별 extraSizes 는 --sizes 를 주지 않았을 때만 더하고, FLOWS 의 lobby·world·chat-lobby·chat-keyboard·day·ghost·night-sizes(09-22 폰 크기 6종 기하)·result-reveal(11-07 결과 탭 패널 폰 6종)·result-awards(11-09 시상식 폰 6종)·map-select(11-13 맵 선택 폰 6종)·basic-vote(13-05 8명 투표 폰 6종)·politics-badge·politics-whisper(09.1.1-10 배지·귓속말 폰 6종)·politics-pin(09.1.1-11 핀 조명 폰 6종)·politics-verdict(09.1.1-13 판결 순간 폰 6종)·politics-runoff(09.1.1-14 동점 결선 폰 6종)·politics-showdown(09.1.1-16 마지막 3인 폰 6종)·avatar-emote(10-05 동작 판 폰 6종)·avatar-dress(10-07 꾸미기 폰 6종)·sound-unlock(12-12)·emcee-band(14-08 사회자 띠 폰 6종)·errand·witness·trace(15-09 심부름·목격 기록·밤 통일/아침 흔적 폰 6종)·tutorial-solo(17-09 혼자 하기 첫 사건 폰 6종) 만 갖는다", () => {
  const run = readFileSync(new URL("./run.mjs", import.meta.url), "utf8");
  assert.match(run, /extraSizes/);
  assert.match(run, /!args\.sizesGiven/);
  const flows = readFileSync(new URL("./flows.mjs", import.meta.url), "utf8");
  const entries = [...flows.matchAll(/\{ id: "([a-z0-9-]+)", run: [A-Za-z(), ]+?(, extraSizes: LOBBY_EXTRA_SIZES)?(?:, skipByDefault: true)? \}/g)];
  const withExtra = entries.filter((m) => m[2]).map((m) => m[1]);
  assert.deepEqual(withExtra, ["lobby", "world", "chat-lobby", "chat-keyboard", "day", "ghost", "night-sizes", "result-reveal", "result-awards", "map-select", "basic-vote", "politics-badge", "politics-whisper", "politics-pin", "politics-verdict", "politics-runoff", "politics-showdown", "avatar-emote", "avatar-dress", "sound-unlock", "emcee-band", "errand", "witness", "trace", "tutorial-solo"]);
});

test("기본판(결정 0072)에서 꺼진 장치 흐름 7개는 skipByDefault 이고 politics-verdict 는 기본 실행에 남는다 (13-05)", () => {
  const flows = readFileSync(new URL("./flows.mjs", import.meta.url), "utf8");
  const skipped = [...flows.matchAll(/\{ id: "([a-z0-9-]+)", run: [A-Za-z]+, (?:extraSizes: LOBBY_EXTRA_SIZES|size: GAME_SIZE), skipByDefault: true \}/g)].map((m) => m[1]);
  for (const id of ["politics-badge", "politics-whisper", "politics-pin", "politics-runoff", "politics-runoff-tie", "politics-showdown", "politics-showdown-tie"]) assert.ok(skipped.includes(id), id);
  assert.ok(!skipped.includes("politics-verdict"));
  const all = [{ id: "politics-badge", skipByDefault: true }, { id: "day" }];
  assert.deepEqual(selectFlows(all, null).map((f) => f.id), ["day"]);
  assert.deepEqual(selectFlows(all, ["politics-badge"]).map((f) => f.id), ["politics-badge"]);
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
  assert.equal(isLocalOrigin("https://minifia-v3.dhplay.workers.dev"), false);
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
    "https://minifia-v3.dhplay.workers.dev/assets/threeRenderer-Ab12_cD.js",
    "https://minifia-v3.dhplay.workers.dev/assets/character-9xZ.js",
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

test("sheetFitChecks(whisper): 공개 예고 한 줄(notice)이 있으면 기대 높이에 27.6 을 더하고 문턱 ±2 는 그대로다 (11-07)", () => {
  assert.equal(WHISPER_NOTICE_H, 27.6);
  const w = whisperGood();
  w.notice = true;
  w.sheet = rect(10, 538, 370, 153.6); // 126 + 27.6
  assert.equal(okOf(sheetFitChecks(w)).SF6, true);
  const plain = whisperGood();
  plain.sheet = rect(10, 538, 370, 153.6);
  onlyFail(sheetFitChecks(plain), "SF6"); // 예고 없이 153.6 이면 실패(문턱은 낮추지 않았다)
  const wrong = whisperGood();
  wrong.notice = true;
  wrong.sheet = rect(10, 538, 370, 160);
  onlyFail(sheetFitChecks(wrong), "SF6");
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

test("AVATAR_MARKERS: 동작 표식 네 개 + 의상 표식 세 개(10-07) + 잠긴 카드 표식(18-09)", () => {
  assert.deepEqual([...AVATAR_MARKERS], ["data-emote-button", "data-emote-tray", "data-emote", "__mfEmotes", "data-dress-sheet", "data-outfit", "__mfLooks", "data-taken"]);
});

// ---- 10-07: 꾸미기 버튼·시트·카드 기하 (dressChecks, D-18) ----

// 360x560 폰: 패널 윗변 310(높이 250). 떠 있는 버튼 48 · 오른쪽 16 · 아랫변 = 패널 윗변 − 8. 시트 = 패널 사각형. 카드 72x112, 사이 8, 왼쪽 12 에서 시작.
const dressGood = () => {
  const panel = rect(0, 310, 360, 250);
  const cards = Array.from({ length: 9 }, (_, i) => rect(12 + i * 80, 366, 72, 112));
  return {
    float: rect(292, 130, 52, 52),
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

test("dressChecks DB1: 지름 52±1 · 오른쪽 여백 16±1 · 아랫변 ≤ 패널 윗변 − 8 중 하나라도 어긋나면 그 항목만 실패", () => {
  const a = dressGood();
  a.float = rect(292, 130, 44, 44);
  onlyFail(dressChecks(a), "DB1");
  const b = dressGood();
  b.float = rect(280, 130, 52, 52);
  onlyFail(dressChecks(b), "DB1");
  const c = dressGood();
  c.float = rect(292, 252, 52, 52); // 아랫변 304 > 302
  onlyFail(dressChecks(c), "DB1");
  const d = dressGood();
  d.float = rect(292, 250, 52, 52); // 아랫변 302 — 경계 통과
  assert.equal(okOf(dressChecks(d)).DB1, true);
  const e = dressGood();
  e.float = rect(292, 252, 52, 52);
  e.kb = true; // 키보드가 열려 있으면 아랫변은 보지 않는다
  assert.equal(okOf(dressChecks(e)).DB1, true);
  const f = dressGood();
  f.float = rect(228, 130, 52, 52); // 두 열로 접힌 둘째 열: 오른쪽 여백 16 + 52 + 12 = 80
  assert.equal(okOf(dressChecks(f)).DB1, true);
  const g = dressGood();
  g.float = rect(240, 130, 52, 52); // 여백 68 — 어느 열도 아니다
  onlyFail(dressChecks(g), "DB1");
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
  const lines = floatTrayChecks(floatTrayGood(), { floatsOn: true });
  assert.deepEqual(lines.map((l) => l.id), ["FT1", "FT2", "FT3"]);
  assert.ok(lines.every((l) => l.ok));
});

test("floatTrayChecks: 한 값씩 어긋나면 해당 항목만 실패한다", () => {
  const a = floatTrayGood();
  a.visibleBefore = { count: 1, shown: 0 };
  onlyFail(floatTrayChecks(a, { floatsOn: true }), "FT1");
  const b = floatTrayGood();
  b.hiddenWhileOpen = { count: 1, shown: 1 };
  onlyFail(floatTrayChecks(b, { floatsOn: true }), "FT2");
  const c = floatTrayGood();
  c.visibleAfter = { count: 1, shown: 0 };
  onlyFail(floatTrayChecks(c, { floatsOn: true }), "FT3");
});

test("floatTrayChecks: 떠 있는 버튼이 하나도 없으면(확인할 것이 없음) 세 줄 모두 실패 · 측정값이 없어도 실패", () => {
  const none = { count: 0, shown: 0 };
  assert.ok(floatTrayChecks({ visibleBefore: none, hiddenWhileOpen: none, visibleAfter: none }, { floatsOn: true }).every((l) => !l.ok));
  const lines = floatTrayChecks({}, { floatsOn: true });
  assert.equal(lines.length, 3);
  assert.ok(lines.every((l) => !l.ok && /측정값 없음/.test(l.detail)));
});

test("floatTrayChecks 기본판(결정 0072): 세 시점 모두 떠 있는 버튼이 0개면 통과, 하나라도 남으면 실패, 측정값이 없으면 실패", () => {
  const none = { count: 0, shown: 0 };
  const ok = floatTrayChecks({ visibleBefore: none, hiddenWhileOpen: none, visibleAfter: none });
  assert.deepEqual(ok.map((l) => l.id), ["FT1", "FT2", "FT3"]);
  assert.ok(ok.every((l) => l.ok));
  onlyFail(floatTrayChecks({ visibleBefore: none, hiddenWhileOpen: { count: 1, shown: 0 }, visibleAfter: none }), "FT2");
  assert.ok(floatTrayChecks({}).every((l) => !l.ok && /측정값 없음/.test(l.detail)));
});

// ---- 12-06: 소리 시험 페이지 sound-render 순수 판정 (D-18, T-12-22) ----

const soundRow = (id, over = {}) => ({ id, peakDb: -9, rmsDb: -30, nan: 0, lengthMs: 300, declaredMs: id.startsWith("bed.") ? null : 300, ok: true, ...over });
const soundRows = () => [...Array.from({ length: 7 }, (_, i) => soundRow(`bed.${i}`)), ...Array.from({ length: 63 }, (_, i) => soundRow(`sfx.${i}`))];
const soundFails = (lines) => lines.filter((l) => !l.ok).map((l) => l.id);

test("SOUND_RENDER_LIMITS: 70개 · 피크 −3 · RMS −60 · 길이 ±50ms (문턱은 이 한 곳)", () => {
  assert.deepEqual({ ...SOUND_RENDER_LIMITS }, { count: 70, peakMaxDb: -3, rmsMinDb: -60, lengthTolMs: 50 });
  assert.throws(() => {
    SOUND_RENDER_LIMITS.peakMaxDb = 0;
  });
});

test("SOUND_MARKERS: 시험 페이지 표식 네 개 + 소리 단추 표식 둘(12-07)", () => {
  assert.deepEqual([...SOUND_MARKERS], ["data-sound-lab", "data-sound-id", "__mfSound", "__mfSoundLab", "data-sound-button", "data-sound-state"]);
});

test("soundRenderChecks: 정상 70개는 모두 통과", () => {
  const lines = soundRenderChecks(soundRows());
  assert.equal(lines.length, 6);
  assert.deepEqual(lines.map((l) => l.id), ["SR1", "SR2", "SR3", "SR4", "SR5", "SR6"]);
  assert.deepEqual(soundFails(lines), []);
});

test("soundRenderChecks: 개수가 70 이 아니면 SR1 실패(69·71)", () => {
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

// ---- 12-07: soundButtonChecks (SU1~SU7) ----

const sRect = (left, top, width, height) => ({ left, top, width, height });
/** 360 폭 로비 정상값(16-06): 띠 아래 끝 62, 소리 원 52 는 위 62 + 12 = 74, 오른쪽 16 → left 292 */
function soundIn(over = {}) {
  return {
    viewport: { w: 360, h: 560 },
    button: { count: 1, rect: sRect(292, 74, 52, 52), disc: sRect(292, 74, 52, 52), pill: false },
    header: { bottom: 62, buttons: [{ kind: "leave", rect: sRect(16, 18, 44, 44) }, { kind: "role", rect: sRect(300, 18, 44, 44) }] },
    test: sRect(16, 70, 90, 44),
    toast: sRect(110, 88, 140, 36),
    bannerHit: { present: true, covers: true, hitIsButton: true },
    labels: { state: "on", name: "소리 끄기", pressed: "true" },
    ...over,
  };
}
const suFails = (args) => soundFails(soundButtonChecks(args));

test("soundButtonChecks: 정상값은 SU1~SU7 모두 통과", () => {
  const lines = soundButtonChecks(soundIn());
  assert.deepEqual(lines.map((l) => l.id), ["SU1", "SU2", "SU3", "SU4", "SU5", "SU6", "SU7"]);
  assert.deepEqual(soundFails(lines), []);
});

test("soundButtonChecks SU1: 단추가 0개나 2개면 실패(방 화면에 정확히 하나)", () => {
  assert.deepEqual(suFails(soundIn({ button: { ...soundIn().button, count: 0 } })).includes("SU1"), true);
  assert.deepEqual(suFails(soundIn({ button: { ...soundIn().button, count: 2 } })).includes("SU1"), true);
});

test("soundButtonChecks SU2: 누르기 영역 52×52 경계 — 51.99 실패 / 52 통과", () => {
  assert.deepEqual(suFails(soundIn({ button: { ...soundIn().button, rect: sRect(292, 74, 52, 52) } })), []);
  assert.deepEqual(suFails(soundIn({ button: { ...soundIn().button, rect: sRect(292, 74, 51.99, 52) } })), ["SU2"]);
  assert.deepEqual(suFails(soundIn({ button: { ...soundIn().button, rect: sRect(292, 74, 52, 51.99) } })), ["SU2"]);
});

test("soundButtonChecks SU3: 위는 띠 아래 끝 + 12 (±2), 오른쪽 여백 16 (±2)", () => {
  const at = (top, left) => suFails(soundIn({ button: { ...soundIn().button, rect: sRect(left, top, 52, 52) } }));
  assert.deepEqual(at(76, 294), []); // +2 / −2
  assert.deepEqual(at(72, 290), []); // −2 / +2
  assert.deepEqual(at(76.01, 292), ["SU3"]);
  assert.deepEqual(at(71.99, 292), ["SU3"]);
  assert.deepEqual(at(74, 294.01), ["SU3"]); // 오른쪽 여백 13.99
  assert.deepEqual(at(74, 289.99), ["SU3"]); // 오른쪽 여백 18.01
});

test("soundButtonChecks SU4: 헤더 단추·[테스트]·토스트와 겹침 0 — 겹치면 실패, 닿기만 하면 통과", () => {
  assert.deepEqual(suFails(soundIn({ header: { bottom: 62, buttons: [{ kind: "role", rect: sRect(300, 50, 44, 44) }] } })), ["SU4"]);
  assert.deepEqual(suFails(soundIn({ test: sRect(280, 70, 90, 44) })), ["SU4"]);
  assert.deepEqual(suFails(soundIn({ toast: sRect(200, 88, 140, 36) })), ["SU4"]);
  assert.deepEqual(suFails(soundIn({ test: sRect(202, 70, 90, 44) })), []); // 오른쪽변이 단추 왼쪽변에 닿기만
  assert.deepEqual(suFails(soundIn({ test: null, toast: null })), []); // 없으면 겹칠 것이 없다
});

test("soundButtonChecks SU5: 재접속 띠가 떠 있을 때 단추 중심의 최상단이 단추 자신이어야 한다(덮든 안 덮든)", () => {
  assert.deepEqual(suFails(soundIn({ bannerHit: { present: true, covers: true, hitIsButton: false } })), ["SU5"]);
  // 띠가 없으면 확인한 것이 없다 — 공허한 통과 금지
  assert.deepEqual(suFails(soundIn({ bannerHit: { present: false, covers: false, hitIsButton: true } })), ["SU5"]);
  // 14페이즈: 단추가 띠 아래 독으로 내려와 띠가 덮지 않아도 단추 중심의 최상단이 단추 자신이면 통과, 아니면 실패
  assert.deepEqual(suFails(soundIn({ bannerHit: { present: true, covers: false, hitIsButton: true } })), []);
  assert.deepEqual(suFails(soundIn({ bannerHit: { present: true, covers: false, hitIsButton: false } })), ["SU5"]);
});

test("soundButtonChecks SU6: 시각 지름 52 (±1) — 경계 51 / 53 통과, 50.99 / 53.01 실패. 알약이면 높이 52 · 폭 112 이상", () => {
  const d = (w, h) => suFails(soundIn({ button: { ...soundIn().button, disc: sRect(292, 74, w, h) } }));
  assert.deepEqual(d(51, 51), []);
  assert.deepEqual(d(53, 53), []);
  assert.deepEqual(d(50.99, 52), ["SU6"]);
  assert.deepEqual(d(52, 53.01), ["SU6"]);
  const pill = (w, h) => suFails(soundIn({ button: { count: 1, rect: sRect(224, 74, 120, 52), disc: sRect(224, 74, w, h), pill: true }, labels: { state: "locked", name: "소리 켜기", pressed: "false" }, toast: null }));
  assert.deepEqual(pill(120, 52), []);
  assert.deepEqual(pill(111.9, 52), ["SU6"]);
  assert.deepEqual(pill(120, 50), ["SU6"]);
});

test("soundButtonChecks SU7: 접근성 이름이 상태에 맞는다 — on '소리 끄기'(pressed true), off·locked '소리 켜기'(pressed false)", () => {
  assert.deepEqual(suFails(soundIn({ labels: { state: "off", name: "소리 켜기", pressed: "false" } })), []);
  assert.deepEqual(suFails(soundIn({ labels: { state: "locked", name: "소리 켜기", pressed: "false" } })), []);
  assert.deepEqual(suFails(soundIn({ labels: { state: "on", name: "소리 켜기", pressed: "true" } })), ["SU7"]);
  assert.deepEqual(suFails(soundIn({ labels: { state: "off", name: "소리 끄기", pressed: "false" } })), ["SU7"]);
  assert.deepEqual(suFails(soundIn({ labels: { state: "on", name: "소리 끄기", pressed: "false" } })), ["SU7"]);
  assert.deepEqual(suFails(soundIn({ labels: { state: "mute", name: "소리 끄기", pressed: "true" } })), ["SU7"]);
});

test("soundButtonChecks: 빠진 입력(null)은 측정값 없음으로 실패", () => {
  const lines = soundButtonChecks({});
  assert.equal(lines.length, 7);
  assert.ok(lines.every((l) => !l.ok && /측정값 없음/.test(l.detail)));
  assert.ok(soundButtonChecks(soundIn({ button: null })).some((l) => !l.ok));
  assert.ok(soundButtonChecks(soundIn({ viewport: null })).some((l) => !l.ok));
});

// ---- 12-08 sound-script: 단계 구간별 소리 id 순서 판정 ----

const L = (...ids) => ids.map((id, i) => ({ id, at: 1000 + i * 10, gain: 1, played: true }));
const sFails = (lines) => lines.filter((l) => !l.ok).map((l) => l.id);

test("soundSequenceChecks: 기대 id 가 순서대로(부분 수열) 있으면 통과 — 사이에 다른 id 가 끼어도 된다", () => {
  const steps = [{ id: "S1", label: "시작", ids: ["game.start", "role.flip"] }];
  assert.deepEqual(sFails(soundSequenceChecks([L("game.start", "role.flip")], steps)), []);
  assert.deepEqual(sFails(soundSequenceChecks([L("ui.tap", "game.start", "ui.tap", "role.flip")], steps)), []);
  assert.equal(soundSequenceChecks([L("game.start", "role.flip")], steps).length, 1);
});

test("soundSequenceChecks: 순서가 뒤집히거나 누락되면 그 단계만 실패하고 detail 에 이유가 있다", () => {
  const steps = [
    { id: "A", label: "a", ids: ["bed.reveal", "role.flip"] },
    { id: "B", label: "b", ids: ["day.start"] },
  ];
  const lines = soundSequenceChecks([L("role.flip", "bed.reveal"), L("day.start")], steps);
  assert.deepEqual(sFails(lines), ["A"]);
  assert.match(lines[0].detail, /role\.flip/);
  assert.deepEqual(sFails(soundSequenceChecks([L("bed.reveal"), L()], steps)), ["A", "B"]);
  assert.deepEqual(sFails(soundSequenceChecks([L(), L("day.start")], steps)), ["A"]);
});

test("soundSequenceChecks: 같은 id 가 여러 번 필요하면 그 횟수만큼 있어야 한다(틱 셋)", () => {
  const steps = [{ id: "T", label: "tick", ids: ["timer.tick", "timer.tick", "timer.tick"] }];
  assert.deepEqual(sFails(soundSequenceChecks([L("timer.tick", "timer.tick", "timer.tick")], steps)), []);
  assert.deepEqual(sFails(soundSequenceChecks([L("timer.tick", "timer.tick")], steps)), ["T"]);
});

test("soundSequenceChecks: notIds 가 하나라도 있으면 실패", () => {
  const steps = [{ id: "N", label: "n", ids: ["bed.vote"], notIds: ["day.start", "role.flip"] }];
  assert.deepEqual(sFails(soundSequenceChecks([L("bed.vote")], steps)), []);
  const bad = soundSequenceChecks([L("bed.vote", "role.flip")], steps);
  assert.deepEqual(sFails(bad), ["N"]);
  assert.match(bad[0].detail, /role\.flip/);
});

test("soundSequenceChecks: counts 는 정확한 횟수(0 포함), onlyPrefix 는 모든 줄이 그 접두어이고 한 줄 이상", () => {
  const counts = [{ id: "C", label: "c", ids: [], counts: { "bed.day": 1, "bed.vote": 0 } }];
  assert.deepEqual(sFails(soundSequenceChecks([L("bed.day", "day.start")], counts)), []);
  assert.deepEqual(sFails(soundSequenceChecks([L("bed.day", "bed.day")], counts)), ["C"]);
  assert.deepEqual(sFails(soundSequenceChecks([L("bed.day", "bed.vote")], counts)), ["C"]);
  assert.deepEqual(sFails(soundSequenceChecks([L()], counts)), ["C"]);
  const only = [{ id: "O", label: "o", ids: [], onlyPrefix: "bed." }];
  assert.deepEqual(sFails(soundSequenceChecks([L("bed.vote")], only)), []);
  assert.deepEqual(sFails(soundSequenceChecks([L("bed.vote", "day.start")], only)), ["O"]);
  assert.deepEqual(sFails(soundSequenceChecks([L()], only)), ["O"], "한 줄도 없으면 공허한 통과를 막는다");
});

test("soundSequenceChecks: 구간 수와 단계 수가 다르거나 로그 모양이 틀리면 측정값 없음으로 실패", () => {
  const steps = [{ id: "A", label: "a", ids: ["day.start"] }];
  assert.ok(soundSequenceChecks([], steps).every((l) => !l.ok && /측정값 없음/.test(l.detail)));
  assert.ok(soundSequenceChecks([L("day.start"), L("day.start")], steps).every((l) => !l.ok));
  assert.ok(soundSequenceChecks([[{ nope: 1 }]], steps).every((l) => !l.ok));
  assert.ok(soundSequenceChecks(null, steps).every((l) => !l.ok));
});

test("SOUND_SCRIPT_STEPS: 단계 표가 있고 id·label 이 겹치지 않으며 기대 id 에 오타가 없다", () => {
  assert.ok(SOUND_SCRIPT_STEPS.length >= 9);
  assert.equal(new Set(SOUND_SCRIPT_STEPS.map((x) => x.id)).size, SOUND_SCRIPT_STEPS.length);
  for (const st of SOUND_SCRIPT_STEPS) {
    assert.equal(typeof st.label, "string");
    assert.ok(Array.isArray(st.ids));
  }
  const first = SOUND_SCRIPT_STEPS.find((x) => x.ids.includes("game.start"));
  assert.ok(first, "game.start 를 기대하는 단계");
  // 13-05: 기본판 투표(동시)에는 차례 소리가 없다 — 기대 id 가 아니라 나오면 안 되는 id 로 바뀌었다
  assert.ok(!SOUND_SCRIPT_STEPS.some((x) => x.ids.includes("pick.turn") || x.ids.includes("pin.on") || x.ids.includes("pick.point") || x.ids.includes("pin.move")));
  assert.ok(SOUND_SCRIPT_STEPS.some((x) => x.notIds?.includes("game.start") && x.notIds.includes("day.start")), "새로고침 단계는 일회성 소리가 없음을 확인");
});

// ---- 12-09 sound-night-parity: 역할이 다른 페이지들의 밤 소리 동일성·밤 UI 무음·암살음 피해자만 ----

const NIGHT = (cues) => ["bed.night", "night.fall", ...Array(cues).fill("night.cue")];
const MORNING = (...extra) => ["bed.dawn", "morning.dawn", ...extra];
/** 페이지 로그 = (밤 앞의 낮 소리) + 밤 구간 + 아침 구간. 밤 구간은 첫 bed.night 부터 첫 bed.dawn 앞까지 */
const page = (label, ids, extra = {}) => ({ label, log: L(...ids), ...extra });
const okPages = () => [
  page("방장(마피아)", ["ui.tap", ...NIGHT(3), ...MORNING("morning.calm")]),
  page("손님A(피해자)", [...NIGHT(2), ...MORNING("kill.slash", "chalk.draw")]),
  page("손님B", [...NIGHT(4), ...MORNING("chalk.draw")]),
  page("손님C(새로고침)", ["bed.night", "night.cue", ...MORNING("chalk.draw")], { reloaded: true }),
];
const parity = (pages, victimLabel = "손님A(피해자)") => soundNightParityChecks({ pages, victimLabel });

test("soundNightParityChecks: 정상 로그(밤 id 집합 동일·큐 2~4·밤 ui 0·slash 피해자만·dawn 1회·새로고침 night.fall 없음)는 6줄 모두 통과", () => {
  const lines = parity(okPages());
  assert.deepEqual(lines.map((l) => l.id), ["P1", "P2", "P3", "P4", "P5", "P6"]);
  assert.deepEqual(sFails(lines), []);
});

test("soundNightParityChecks P1: 한 페이지의 밤에 다른 id 가 있거나 빠지면 실패 — 밤 앞의 낮 소리(ui.tap)는 밤 구간이 아니다", () => {
  const extra = okPages();
  extra[1] = page("손님A(피해자)", [...NIGHT(2), "pick.turn", ...MORNING("kill.slash", "chalk.draw")]);
  assert.deepEqual(sFails(parity(extra)), ["P1"]);
  const missing = okPages();
  missing[2] = page("손님B", ["bed.night", "night.cue", "night.cue", ...MORNING("chalk.draw")]);
  assert.ok(sFails(parity(missing)).includes("P1"), "night.fall 이 빠진 페이지");
  const ok = okPages();
  assert.deepEqual(sFails(parity(ok)), []);
});

test("soundNightParityChecks: 밤 구간의 ui.host 는 P1·P3 을 깨지 않는다 — 공개 단계 전환 알림음은 모든 역할이 같은 프레임에 듣는다 (14-03, T-14-10)", () => {
  const host = okPages();
  for (let i = 0; i < host.length; i += 1) {
    host[i] = page(host[i].label, [...NIGHT(3), "ui.host", ...MORNING("chalk.draw")], host[i].reloaded === true ? { reloaded: true } : {});
  }
  host[0] = page("방장(마피아)", [...NIGHT(3), "ui.host", ...MORNING("kill.slash", "chalk.draw")]);
  const fails = sFails(parity(host));
  assert.ok(!fails.includes("P1"), "P1 은 ui.host 를 뺀 밤 id 집합으로 본다");
  assert.ok(!fails.includes("P3"), "P3 은 ui.host 를 밤 ui.* 로 세지 않는다");
  // 문턱을 낮추지 않았다: ui.host 와 ui.tap 이 함께 있으면 여전히 P3 실패
  const tap = okPages();
  tap[0] = page("방장(마피아)", [...NIGHT(3), "ui.host", "ui.tap", ...MORNING("morning.calm")]);
  assert.ok(sFails(parity(tap)).includes("P3"));
  // ui.host 가 아닌 다른 id 가 밤에 끼면 P1 실패(기존 판정 유지)
  const extra = okPages();
  extra[1] = page("손님A(피해자)", [...NIGHT(2), "ui.host", "pick.turn", ...MORNING("kill.slash", "chalk.draw")]);
  assert.ok(sFails(parity(extra)).includes("P1"));
});

test("soundNightParityChecks P2: 큐가 1개이거나 5개이면 실패, 새로고침 페이지는 상한만 본다", () => {
  const few = okPages();
  few[2] = page("손님B", [...NIGHT(1), ...MORNING("chalk.draw")]);
  assert.deepEqual(sFails(parity(few)), ["P2"]);
  const many = okPages();
  many[0] = page("방장(마피아)", [...NIGHT(5), ...MORNING("morning.calm")]);
  assert.deepEqual(sFails(parity(many)), ["P2"]);
  const reloadedZero = okPages();
  reloadedZero[3] = page("손님C(새로고침)", ["bed.night", ...MORNING("chalk.draw")], { reloaded: true });
  assert.deepEqual(sFails(parity(reloadedZero)), [], "새로고침 페이지의 큐는 0~4 (남은 시간에 따라)");
  const reloadedFive = okPages();
  reloadedFive[3] = page("손님C(새로고침)", ["bed.night", ...Array(5).fill("night.cue"), ...MORNING("chalk.draw")], { reloaded: true });
  assert.deepEqual(sFails(parity(reloadedFive)), ["P2"]);
});

test("soundNightParityChecks P3: 밤 구간의 ui.* 와 vote.cast 는 실패, 아침의 ui.card 는 괜찮다", () => {
  const tap = okPages();
  tap[0] = page("방장(마피아)", [...NIGHT(3), "ui.tap", ...MORNING("morning.calm")]);
  assert.ok(sFails(parity(tap)).includes("P3"));
  const vote = okPages();
  vote[2] = page("손님B", ["bed.night", "night.fall", "night.cue", "vote.cast", "night.cue", ...MORNING("chalk.draw")]);
  assert.ok(sFails(parity(vote)).includes("P3"));
  const card = okPages();
  card[2] = page("손님B", [...NIGHT(4), ...MORNING("chalk.draw", "ui.card")]);
  assert.deepEqual(sFails(parity(card)), []);
  const reloadedTap = okPages();
  reloadedTap[3] = page("손님C(새로고침)", ["bed.night", "ui.tap", "night.cue", ...MORNING("chalk.draw")], { reloaded: true });
  assert.ok(sFails(parity(reloadedTap)).includes("P3"), "새로고침 페이지도 밤에는 무음");
});

test("soundNightParityChecks P4: kill.slash 는 피해자 페이지의 아침에 정확히 1회 — 다른 페이지·밤·두 번은 실패", () => {
  const other = okPages();
  other[2] = page("손님B", [...NIGHT(4), ...MORNING("kill.slash", "chalk.draw")]);
  assert.deepEqual(sFails(parity(other)), ["P4"]);
  const none = okPages();
  none[1] = page("손님A(피해자)", [...NIGHT(2), ...MORNING("chalk.draw")]);
  assert.deepEqual(sFails(parity(none)), ["P4"]);
  const twice = okPages();
  twice[1] = page("손님A(피해자)", [...NIGHT(2), ...MORNING("kill.slash", "kill.slash", "chalk.draw")]);
  assert.deepEqual(sFails(parity(twice)), ["P4"]);
  const inNight = okPages();
  inNight[0] = page("방장(마피아)", ["bed.night", "night.fall", "kill.slash", "night.cue", "night.cue", ...MORNING("morning.calm")]);
  assert.ok(sFails(parity(inNight)).includes("P4"));
  assert.ok(sFails(parity(okPages(), "없는사람")).includes("P4"), "피해자 라벨이 페이지에 없으면 측정할 수 없다");
});

test("soundNightParityChecks P5: morning.dawn 은 모든 페이지에 정확히 1회", () => {
  const missing = okPages();
  missing[2] = page("손님B", [...NIGHT(4), "bed.dawn", "chalk.draw"]);
  assert.deepEqual(sFails(parity(missing)), ["P5"]);
  const twice = okPages();
  twice[0] = page("방장(마피아)", [...NIGHT(3), ...MORNING("morning.dawn", "morning.calm")]);
  assert.deepEqual(sFails(parity(twice)), ["P5"]);
});

test("soundNightParityChecks P6: 새로고침 페이지에 night.fall 이 있거나 bed.night 가 없으면 실패", () => {
  const fall = okPages();
  fall[3] = page("손님C(새로고침)", ["bed.night", "night.fall", "night.cue", ...MORNING("chalk.draw")], { reloaded: true });
  assert.deepEqual(sFails(parity(fall)), ["P6"]);
  const noBed = okPages();
  noBed[3] = page("손님C(새로고침)", ["night.cue", ...MORNING("chalk.draw")], { reloaded: true });
  assert.ok(sFails(parity(noBed)).includes("P6"));
});

test("soundNightParityChecks: 마피아 방장이 밤에 보낸 동작 소리(emote.*)는 밤 id 집합 비교(P1·P3)에 들어가지 않는다 (12-10)", () => {
  const withEmote = okPages();
  withEmote[0] = { ...withEmote[0], log: [...withEmote[0].log.slice(0, 2), { id: "emote.throat", at: 9, gain: 0.5 }, ...withEmote[0].log.slice(2)] };
  assert.deepEqual(sFails(parity(withEmote, "손님A(피해자)")), []);
});

test("soundNightParityChecks: 새로고침 페이지가 없거나 완전한 페이지가 둘 미만이거나 입력 모양이 틀리면 측정값 없음으로 실패", () => {
  assert.ok(parity(okPages().slice(0, 3)).some((l) => l.id === "P6" && !l.ok && /측정값 없음/.test(l.detail)), "새로고침 페이지 없음");
  const one = [okPages()[0], okPages()[3]];
  assert.ok(parity(one, "방장(마피아)").some((l) => l.id === "P1" && !l.ok && /측정값 없음/.test(l.detail)), "완전한 페이지 하나");
  assert.ok(parity(null).every((l) => !l.ok && /측정값 없음/.test(l.detail)));
  assert.ok(soundNightParityChecks({ pages: [{ label: "a", log: [{ nope: 1 }] }, okPages()[1]], victimLabel: "a" }).every((l) => !l.ok));
  assert.ok(soundNightParityChecks({ pages: [], victimLabel: "a" }).every((l) => !l.ok));
});

test("soundNightParityChecks: 밤 구간이 하나도 없는 로그(훅이 비었음)는 공허하게 통과하지 못한다", () => {
  const empty = okPages().map((p) => ({ ...p, log: [] }));
  assert.ok(sFails(parity(empty)).length > 0);
});

test("SOUND_SCRIPT_STEPS: 12-09 가 밤(night.fall·bed.night)과 아침(morning.dawn·bed.dawn) 단계를 더했다", () => {
  const night = SOUND_SCRIPT_STEPS.find((x) => x.ids.includes("night.fall"));
  assert.ok(night && night.ids.includes("bed.night"));
  const morning = SOUND_SCRIPT_STEPS.find((x) => x.ids.includes("morning.dawn"));
  assert.ok(morning && morning.ids.includes("bed.dawn"));
});

// ---- 12-10: 판결 타이밍(V1~V5)·동작 소리 누설(E1~E3) 순수 판정 ----

const HEART = [0, 800, 1500, 2050, 2400];
const entry = (id, at, gain = 1) => ({ id, at, gain });
/** 첫 심장 박동 시각 base 기준의 판결 로그. 통과면 gavel+rise, 부결이면 reject */
const verdictLog = ({ passed = true, base = 100000, gavelAt = 2600, riseAt = gavelAt, hearts = HEART, extra = [] } = {}) => [
  entry("ui.tap", base - 500),
  ...hearts.map((h) => entry("verdict.heart", base + h)),
  entry("pin.on", base),
  entry("ballot.yes", base + 600),
  entry("ballot.no", base + 1000),
  ...(passed ? [entry("execution.gavel", base + gavelAt), entry("execution.rise", base + riseAt)] : [entry("verdict.reject", base + gavelAt)]),
  ...extra,
].sort((a, b) => a.at - b.at);
const vt = (pass, reject) => soundVerdictTimingChecks({ pass, reject });
const vFails = (lines) => lines.filter((l) => !l.ok).map((l) => l.id);

test("soundVerdictTimingChecks: 정상 통과·부결 로그는 V1~V5 모두 통과", () => {
  const lines = vt(verdictLog({ passed: true }), verdictLog({ passed: false, base: 900000 }));
  assert.deepEqual(lines.map((l) => l.id), ["V1", "V2", "V3", "V4", "V5"]);
  assert.deepEqual(vFails(lines), []);
});

test("V1: verdict.heart 가 5개가 아니면 실패 (4·6)", () => {
  assert.ok(vFails(vt(verdictLog({ hearts: HEART.slice(1) }), verdictLog({ passed: false }))).includes("V1"));
  assert.ok(vFails(vt(verdictLog({ hearts: [...HEART, 2500] }), verdictLog({ passed: false }))).includes("V1"));
  assert.ok(vFails(vt(verdictLog(), verdictLog({ passed: false, hearts: HEART.slice(0, 4) }))).includes("V1"));
});

test("V2: gavel 은 첫 심장 박동 +2600 ± 250 — 경계 2350·2850 통과, 2349·2851 실패", () => {
  for (const at of [2350, 2850]) assert.deepEqual(vFails(vt(verdictLog({ gavelAt: at, riseAt: at }), verdictLog({ passed: false }))), [], `at ${at}`);
  assert.ok(vFails(vt(verdictLog({ gavelAt: 2349, riseAt: 2349 }), verdictLog({ passed: false }))).includes("V2"));
  for (const at of [2349, 2851]) assert.ok(vFails(vt(verdictLog({ gavelAt: at, riseAt: at }), verdictLog({ passed: false }))).includes("V2"), `at ${at}`);
});

test("V3: rise 는 gavel 과 ±100 — 100 통과, 101 실패, 없으면 실패", () => {
  assert.deepEqual(vFails(vt(verdictLog({ riseAt: 2700 }), verdictLog({ passed: false }))), []);
  assert.deepEqual(vFails(vt(verdictLog({ riseAt: 2701 }), verdictLog({ passed: false }))), ["V3"]);
  const noRise = verdictLog().filter((e) => e.id !== "execution.rise");
  assert.ok(vFails(vt(noRise, verdictLog({ passed: false }))).includes("V3"));
});

test("V4: 부결 판은 gavel·rise 가 없고 verdict.reject 가 +2600 ± 250 이다", () => {
  const withGavel = verdictLog({ passed: false, extra: [entry("execution.gavel", 100000 + 2600)] });
  assert.ok(vFails(vt(verdictLog(), withGavel)).includes("V4"));
  assert.ok(vFails(vt(verdictLog(), verdictLog({ passed: false, gavelAt: 2900 }))).includes("V4"));
  assert.ok(vFails(vt(verdictLog(), verdictLog({ passed: false }).filter((e) => e.id !== "verdict.reject"))).includes("V4"));
});

test("V5: 두 판의 2600ms 앞(+2350 안) 판결 id 열이 같아야 한다 — 부결 판에 앞머리가 하나 빠지면 실패, 다른 소리(ui.tap)는 비교하지 않는다", () => {
  const rejectNoPin = verdictLog({ passed: false, base: 900000 }).filter((e) => e.id !== "pin.on");
  assert.deepEqual(vFails(vt(verdictLog(), rejectNoPin)), ["V5"]);
  const rejectTap = verdictLog({ passed: false, base: 900000, extra: [entry("ui.tap", 900000 + 300)] });
  assert.deepEqual(vFails(vt(verdictLog(), rejectTap)), []);
});

test("V5: 같은 진입 틱의 pin.on 이 첫 심장 박동보다 1~수 ms 앞서도 뒤에 있어도 같은 앞머리로 센다 — 한 판에만 없으면 여전히 실패", () => {
  const withPinAt = (base, offset, passed) => verdictLog({ passed, base }).map((e) => (e.id === "pin.on" ? { ...e, at: base + offset } : e)).sort((a, b) => a.at - b.at);
  assert.deepEqual(vFails(vt(withPinAt(100000, -3, true), withPinAt(900000, 0, false))), []);
  assert.deepEqual(vFails(vt(withPinAt(100000, -3, true), withPinAt(900000, 2, false))), []);
  assert.deepEqual(vFails(vt(withPinAt(100000, 0, true), withPinAt(900000, -99, false))), []);
  // 100ms 보다 앞선 pin.on 은 앞머리가 아니다 → 한쪽에만 있는 것으로 보고 실패
  assert.deepEqual(vFails(vt(withPinAt(100000, 0, true), withPinAt(900000, -101, false))), ["V5"]);
});

test("soundVerdictTimingChecks: 로그가 없거나 심장 박동이 없으면 측정값 없음으로 실패", () => {
  assert.ok(vt(null, null).every((l) => !l.ok && /측정값 없음/.test(l.detail)));
  assert.ok(vt(verdictLog(), null).some((l) => (l.id === "V4" || l.id === "V5") && !l.ok && /측정값 없음/.test(l.detail)));
  assert.ok(vt([], []).every((l) => !l.ok));
});

const emoteLog = (...rest) => rest;
const mk = (label, log) => ({ label, log });
const emoteIn = (gain) => [entry("bed.night", 1), entry("emote.throat", 5, gain)];
const leak = (input) => soundEmoteLeakChecks(input);
const eOk = () => ({
  senderLog: [entry("bed.night", 1), entry("night.cue", 6)],
  otherLogs: [mk("손님1", [entry("bed.night", 1), entry("night.cue", 6)]), mk("손님2", [entry("bed.night", 1)])],
  day: { senderLog: [entry("emote.clap", 5, 1)], receiverLog: [entry("emote.clap", 5, 0.501)] },
});

test("soundEmoteLeakChecks: 정상(밤 마피아 0·시민 0·낮 gain 1 과 0.501)은 E1~E3 통과", () => {
  const lines = leak(eOk());
  assert.deepEqual(lines.map((l) => l.id), ["E1", "E2", "E3"]);
  assert.deepEqual(vFails(lines), []);
});

test("E1(15-08): 밤 마피아 로그의 emote.* 가 0개 — 밤 동작 칸이 없어졌으므로 1개라도 있으면 실패(played 무관)", () => {
  assert.deepEqual(vFails(leak({ ...eOk(), senderLog: [entry("bed.night", 1)] })), []);
  assert.deepEqual(vFails(leak({ ...eOk(), senderLog: emoteIn(0.5) })), ["E1"]);
  assert.deepEqual(vFails(leak({ ...eOk(), senderLog: [entry("emote.throat", 5, 0.5)].map((e) => ({ ...e, played: false })) })), ["E1"]);
});

test("E2: 시민 쪽 로그에 emote.* 가 하나라도 있으면 실패하고 그 라벨을 적는다", () => {
  const bad = { ...eOk(), otherLogs: [mk("손님1", [entry("emote.throat", 7, 0.5)]), mk("손님2", [])] };
  const lines = leak(bad);
  assert.deepEqual(vFails(lines), ["E2"]);
  assert.match(lines.find((l) => l.id === "E2").detail, /손님1/);
});

test("E3: 낮 동작은 보낸 사람 gain 1, 받은 사람 gain 0.501(−6dB) — 어긋나면 실패", () => {
  assert.deepEqual(vFails(leak({ ...eOk(), day: { senderLog: [entry("emote.clap", 5, 0.5)], receiverLog: [entry("emote.clap", 5, 0.501)] } })), ["E3"]);
  assert.deepEqual(vFails(leak({ ...eOk(), day: { senderLog: [entry("emote.clap", 5, 1)], receiverLog: [entry("emote.clap", 5, 1)] } })), ["E3"]);
  assert.deepEqual(vFails(leak({ ...eOk(), day: { senderLog: [entry("emote.clap", 5, 1)], receiverLog: [] } })), ["E3"]);
});

test("soundEmoteLeakChecks: 입력 모양이 틀리면 측정값 없음으로 실패", () => {
  assert.ok(leak(null).every((l) => !l.ok && /측정값 없음/.test(l.detail)));
  assert.ok(leak({ ...eOk(), otherLogs: [] }).some((l) => l.id === "E2" && !l.ok && /측정값 없음/.test(l.detail)));
  assert.ok(leak({ ...eOk(), day: undefined }).some((l) => l.id === "E3" && !l.ok && /측정값 없음/.test(l.detail)));
});

// ---- 12-11: 결과·시상 소리 sound-result 순수 판정 (D-15·D-21·T-12-41·T-12-44) ----
const rl = (id, at) => ({ id, at, gain: 1, played: true });
/** 참가자 4명 · 패 3개인 정상 로그: bed.result → 뒤집기 4(1200+400i) → 승패 4600 → 패 소리 6500·9000·11500(마지막이 final) */
const resultLog = () => [
  rl("bed.result", 0),
  rl("role.flip", 1200),
  rl("role.flip", 1600),
  rl("role.flip", 2000),
  rl("role.flip", 2400),
  rl("result.lose", 4600),
  rl("emote.clap", 4600),
  rl("award.plate", 6500),
  rl("emote.clap", 6500),
  rl("award.plate", 9000),
  rl("award.final", 11500),
];
const rOk = () => ({ log: resultLog(), participants: 4, awards: 3, expectWin: false, reloadLog: [rl("bed.result", 10)] });
const rFails = (over) => soundResultChecks({ ...rOk(), ...over }).filter((l) => !l.ok).map((l) => l.id);

test("soundResultChecks: 정상 로그는 R1~R6 통과", () => {
  const lines = soundResultChecks(rOk());
  assert.deepEqual(lines.map((l) => l.id), ["R1", "R2", "R3", "R4", "R5", "R6"]);
  assert.deepEqual(rFails({}), []);
});

test("R1: 첫 침대 요청이 bed.result 가 아니면 실패", () => {
  assert.deepEqual(rFails({ log: [rl("bed.vote", 0), ...resultLog()] }), ["R1"]);
  assert.deepEqual(rFails({ log: resultLog().filter((e) => e.id !== "bed.result") }), ["R1"]);
});

test("R2: role.flip 은 min(참가자, 8) — 누락·초과 실패, 9명 이상은 8", () => {
  assert.deepEqual(rFails({ log: resultLog().filter((e) => e.at !== 2400) }), ["R2"]);
  assert.deepEqual(rFails({ log: [...resultLog(), rl("role.flip", 2800)] }), ["R2"]);
  const eight = [rl("bed.result", 0), ...Array.from({ length: 8 }, (_, i) => rl("role.flip", 1200 + 400 * i)), rl("result.win", 4600)];
  assert.deepEqual(rFails({ log: eight, participants: 8, awards: 0, expectWin: true }), []);
  assert.deepEqual(rFails({ log: eight, participants: 12, awards: 0, expectWin: true }), []);
});

test("R3: result.win/lose 가 정확히 한 번이고 expectWin 쪽이어야 한다", () => {
  assert.deepEqual(rFails({ log: resultLog().filter((e) => e.id !== "result.lose") }), ["R3", "R5"]);
  assert.deepEqual(rFails({ log: [...resultLog(), rl("result.win", 4700)] }), ["R3"]);
  assert.deepEqual(rFails({ expectWin: true }), ["R3"]);
  assert.deepEqual(rFails({ expectWin: undefined }), []);
});

test("R4: award.plate 는 패 수 − 1, award.final 은 한 번이고 마지막", () => {
  assert.deepEqual(rFails({ awards: 4 }), ["R4"]);
  assert.deepEqual(rFails({ log: resultLog().filter((e) => e.id !== "award.final") }), ["R4"]);
  assert.deepEqual(rFails({ log: [...resultLog(), rl("award.plate", 14000)] }), ["R4"]);
  assert.deepEqual(rFails({ log: [...resultLog(), rl("award.final", 14000)] }), ["R4"]);
  assert.deepEqual(rFails({ log: resultLog().filter((e) => !e.id.startsWith("award.")), awards: 0 }), []);
  assert.deepEqual(rFails({ log: resultLog(), awards: 0 }), ["R4"]);
});

test("R5: 순서가 뒤집히면 실패(뒤집기 < 승패 < 시상)", () => {
  const swapped = resultLog().map((e) => (e.id === "result.lose" ? { ...e, at: 1000 } : e));
  assert.deepEqual(rFails({ log: swapped }), ["R5"]);
  const late = resultLog().map((e) => (e.id === "result.lose" ? { ...e, at: 7000 } : e));
  assert.deepEqual(rFails({ log: late }), ["R5"]);
});

test("R6: 새로고침 로그에 role.flip·result.*·award.*·game.start 가 있으면 실패, bed.result 가 없어도 실패", () => {
  assert.deepEqual(rFails({ reloadLog: [rl("bed.result", 10), rl("role.flip", 20)] }), ["R6"]);
  assert.deepEqual(rFails({ reloadLog: [rl("bed.result", 10), rl("result.win", 20)] }), ["R6"]);
  assert.deepEqual(rFails({ reloadLog: [rl("bed.result", 10), rl("award.plate", 20)] }), ["R6"]);
  assert.deepEqual(rFails({ reloadLog: [rl("bed.result", 10), rl("game.start", 20)] }), ["R6"]);
  assert.deepEqual(rFails({ reloadLog: [rl("bed.vote", 10)] }), ["R6"]);
  assert.deepEqual(rFails({ reloadLog: [rl("bed.result", 10), rl("ui.tap", 20)] }), []);
});

test("soundResultChecks: 입력 모양이 틀리면 측정값 없음으로 실패", () => {
  assert.ok(soundResultChecks(null).every((l) => !l.ok && /측정값 없음/.test(l.detail)));
  assert.ok(soundResultChecks({ ...rOk(), reloadLog: undefined }).some((l) => l.id === "R6" && !l.ok && /측정값 없음/.test(l.detail)));
});

test("soundResultSkipChecks: 건너뛴 판은 role.flip 이 참가자 수 미만이고 승패 한 번", () => {
  const ok = [rl("bed.result", 0), rl("role.flip", 1200), rl("result.lose", 1500)];
  assert.deepEqual(soundResultSkipChecks({ log: ok, participants: 4 }).map((l) => l.ok), [true, true]);
  const full = [rl("bed.result", 0), ...[0, 1, 2, 3].map((i) => rl("role.flip", 1200 + 400 * i)), rl("result.lose", 4600)];
  assert.deepEqual(soundResultSkipChecks({ log: full, participants: 4 }).map((l) => l.id + l.ok), ["K1false", "K2true"]);
  assert.deepEqual(soundResultSkipChecks({ log: [...ok, rl("result.win", 4600)], participants: 4 }).map((l) => l.id + l.ok), ["K1true", "K2false"]);
  assert.ok(soundResultSkipChecks(null).every((l) => !l.ok && /측정값 없음/.test(l.detail)));
});

// ---- 13-05: 꺼진 장치 부재 검사 · 기본판 단계 순서 · 소리 대본 기대 (D-05, U-8) ----

test("NOMINATION_MS 사본은 15000 이다(shared/game/phases.ts 와 같은 값)", () => {
  assert.equal(NOMINATION_MS, 15000);
});

test("OFF_DEVICE_SELECTORS: UI-SPEC 표의 선택자 10개가 동결되어 있다", () => {
  assert.equal(OFF_DEVICE_SELECTORS.length, 10);
  assert.ok(Object.isFrozen(OFF_DEVICE_SELECTORS));
  for (const sel of ['[data-float="claim"]', '[data-float="whisper"]', "[data-claim-sheet]", "[data-claim-chip]", "[data-claim]", "[data-badge-live]", "[data-line-sheet]", "[data-turn-block]", "[data-speak-sheet]", "[data-showdown-step]"]) {
    assert.ok(OFF_DEVICE_SELECTORS.includes(sel), sel);
  }
  assert.equal(OFF_DEVICE_ATTR_PREFIX, "data-turn");
});

test("offDeviceKeysOf: 기본판 투표 view 는 빈 배열이다", () => {
  const view = { phase: "nomination", players: [{ seat: 0 }, { seat: 1, away: true }], day: { points: [{ seat: 1, target: 0 }], voted: [1] }, me: { seat: 0 } };
  assert.deepEqual(offDeviceKeysOf({ t: "state", view }), []);
  assert.deepEqual(offDeviceKeysOf({ t: "chat", ch: "all", seat: 0, seq: 1, text: "x", at: 1 }), []);
  assert.deepEqual(offDeviceKeysOf({ t: "chat", ch: "all", seat: 0, seq: 1, text: "x", at: 1, k: "ballots" }), [], "찬반 기록 카드는 기본판 장치다");
  assert.deepEqual(offDeviceKeysOf(null), []);
  assert.deepEqual(offDeviceKeysOf({ t: "pong" }), []);
});

test("offDeviceKeysOf: 꺼진 장치 키를 경로 문자열로 모은다", () => {
  const view = {
    phase: "nomination",
    players: [{ seat: 0, badge: "doctor" }, { seat: 1, badgeSwapped: true }],
    day: { turn: { i: 0 }, runoff: {}, showdown: {} },
    me: { seat: 0, whisperUsed: true, ballot: 2 },
  };
  const got = offDeviceKeysOf({ t: "state", view });
  for (const k of ["players[].badge", "players[].badgeSwapped", "day.turn", "day.runoff", "day.showdown", "me.whisperUsed", "me.ballot"]) assert.ok(got.includes(k), k);
  assert.equal(new Set(got).size, got.length, "같은 경로는 한 번만");
  assert.ok(!JSON.stringify(got).includes("doctor"), "값은 싣지 않는다(경로만)");
});

test("offDeviceKeysOf: 귓속말 채팅 줄과 결선·결전 단계를 표시한다", () => {
  assert.deepEqual(offDeviceKeysOf({ t: "chat", ch: "all", seat: 0, seq: 1, text: "비밀", at: 1, k: "whisper", to: 1 }), ["chat.k:whisper"]);
  assert.deepEqual(offDeviceKeysOf({ t: "chat", ch: "all", seat: 0, seq: 1, text: "", at: 1, k: "whispered", to: 1 }), ["chat.k:whispered"]);
  assert.deepEqual(offDeviceKeysOf({ t: "chatLog", lines: [{ k: "whisper" }, { k: "will" }] }), ["chatLog.k:whisper"]);
  assert.deepEqual(offDeviceKeysOf({ t: "state", view: { phase: "runoff", players: [], day: {}, me: {} } }), ["phase:runoff"]);
  assert.deepEqual(offDeviceKeysOf({ t: "state", view: { phase: "showdown", players: [], day: {}, me: {} } }), ["phase:showdown"]);
});

test("offDeviceKeysOf: 결과 공개 묶음(resultLog)은 귓속말·주장 줄이 실제로 있을 때만 표시한다(빈 묶음은 흔적이 아니다)", () => {
  assert.deepEqual(offDeviceKeysOf({ t: "resultLog", part: "whisper", i: 0, end: true, lines: [] }), []);
  assert.deepEqual(offDeviceKeysOf({ t: "resultLog", part: "claim", i: 0, end: true, lines: [] }), []);
  assert.deepEqual(offDeviceKeysOf({ t: "resultLog", part: "mafia", i: 0, end: true, lines: [{ x: 1 }] }), []);
  assert.deepEqual(offDeviceKeysOf({ t: "resultLog", part: "whisper", i: 0, end: true, lines: [{ x: 1 }] }), ["resultLog.part:whisper"]);
  assert.deepEqual(offDeviceKeysOf({ t: "resultLog", part: "claim", i: 0, end: true, lines: [{ x: 1 }] }), ["resultLog.part:claim"]);
});

test("basicOrderChecks: 기본판 단계 순서는 통과하고 연속 중복은 접는다", () => {
  const ok = ["lobby", "assigning", "roleReveal", "dayAnnounce", "errand", "discussion", "nomination", "nomination", "defense", "verdict", "execution", "night", "morning", "dayAnnounce", "errand", "discussion", "nomination", "night", "morning", "ended"];
  const r = basicOrderChecks(ok);
  assert.ok(r.length >= 1 && r.every((x) => x.ok), JSON.stringify(r));
  for (const x of r) assert.ok(x.id && x.label);
  assert.ok(basicOrderChecks(["nomination", "defense", "verdict", "execution", "ended"]).every((x) => x.ok), "처형 뒤 승패가 나면 결과");
});

test("basicOrderChecks: runoff·showdown·건너뛴 전이는 처음 어긋난 곳을 detail 로 실패한다", () => {
  const a = basicOrderChecks(["discussion", "nomination", "runoff", "defense"]);
  assert.ok(a.some((x) => !x.ok && /runoff/.test(x.detail)));
  const b = basicOrderChecks(["discussion", "nomination", "showdown", "night"]);
  assert.ok(b.some((x) => !x.ok && /showdown/.test(x.detail)));
  const c = basicOrderChecks(["discussion", "verdict"]);
  assert.ok(c.some((x) => !x.ok && /discussion/.test(x.detail) && /verdict/.test(x.detail)));
  assert.ok(basicOrderChecks([]).every((x) => !x.ok && /측정값 없음/.test(x.detail)));
  assert.ok(basicOrderChecks(null).every((x) => !x.ok));
});

test("SOUND_SCRIPT_STEPS: 13-05 투표 단계는 기본판 — bed.vote·phase.vote 를 기대하고 차례 소리는 나오면 안 된다", () => {
  const sc6 = SOUND_SCRIPT_STEPS.find((x) => x.id === "SC6");
  assert.deepEqual(sc6.ids, ["bed.vote", "phase.vote"]);
  for (const id of ["pin.on", "pick.turn", "pick.tick"]) assert.ok(sc6.notIds.includes(id), id);
  const sc7 = SOUND_SCRIPT_STEPS.find((x) => x.id === "SC7");
  for (const id of ["pick.point", "pin.move", "pick.turn", "pin.on"]) assert.ok(sc7.notIds.includes(id), id);
  const sc8 = SOUND_SCRIPT_STEPS.find((x) => x.id === "SC8");
  assert.equal(sc8.counts["bed.vote"], 0);
  for (const id of ["pin.on", "pick.turn", "pick.tick", "phase.vote"]) assert.ok(sc8.notIds.includes(id), id);
});

// ---- 14페이즈(14-08): 띠·이름표·누설·알림음·view 키 판정 ----

const bandOk = (over = {}) => ({
  bands: 1, lineCount: 1, lineH: 40, lineLH: 20, guideCount: 1, guideInBand: true,
  timeText: "42초", barShown: true, oldHint: 0, oldRing: 0, oldTimer: 0, ...over,
});

test("hostBandChecks: 시간 있는 단계 — 띠 하나·문장 하나·data-guide 띠 안·두 줄·막대+초 는 통과(HB1~HB5)", () => {
  const rs = hostBandChecks(bandOk(), { phase: "discussion", timed: true });
  assert.deepEqual(rs.map((r) => r.id), ["HB1", "HB2", "HB3", "HB4", "HB5"]);
  for (const r of rs) assert.equal(r.ok, true, r.id + r.detail);
});

test("hostBandChecks: 시간 없는 단계는 막대·숫자가 둘 다 없어야 통과, 하나만 있어도 실패", () => {
  const ok = hostBandChecks(bandOk({ timeText: "", barShown: false }), { phase: "lobby", timed: false });
  for (const r of ok) assert.equal(r.ok, true, r.id + r.detail);
  const bar = hostBandChecks(bandOk({ timeText: "", barShown: true }), { phase: "lobby", timed: false }).find((r) => r.id === "HB4");
  assert.equal(bar.ok, false);
  const txt = hostBandChecks(bandOk({ timeText: "3초", barShown: false }), { phase: "lobby", timed: false }).find((r) => r.id === "HB4");
  assert.equal(txt.ok, false);
});

test("hostBandChecks: 띠 0·2개, data-guide 0개·띠 밖, 세 줄, 옛 안내·링·타이머 는 각각 실패한다", () => {
  const bad = (over, id) => {
    const r = hostBandChecks(bandOk(over), { phase: "discussion", timed: true }).find((x) => x.id === id);
    assert.equal(r.ok, false, id + JSON.stringify(over));
    return r;
  };
  bad({ bands: 0 }, "HB1");
  bad({ bands: 2 }, "HB1");
  bad({ lineCount: 2 }, "HB1");
  bad({ guideCount: 0 }, "HB2");
  bad({ guideInBand: false }, "HB2");
  assert.match(bad({ lineH: 60 }, "HB3").detail, /3줄/);
  bad({ timeText: "1:05" }, "HB4");
  bad({ barShown: false }, "HB4");
  bad({ oldHint: 1 }, "HB5");
  bad({ oldRing: 1 }, "HB5");
  bad({ oldTimer: 1 }, "HB5");
});

test("hostBandChecks: 측정값이 없거나 숫자가 아니면 조용히 통과하지 않고 측정값 없음으로 실패", () => {
  for (const b of [undefined, null, {}, bandOk({ bands: "1" }), bandOk({ lineH: undefined }), bandOk({ lineLH: 0 }), bandOk({ timeText: null }), bandOk({ guideInBand: undefined }), bandOk({ oldHint: undefined })]) {
    const rs = hostBandChecks(b, { phase: "discussion", timed: true });
    assert.ok(rs.some((r) => !r.ok && /측정값 없음/.test(r.detail)), JSON.stringify(b));
    assert.equal(rs.every((r) => r.ok), false);
  }
});

test("hostOverlapChecks: 이름표끼리·띠와 겹치지 않으면 통과, 겹치면 실패, 값 없음은 측정값 없음", () => {
  const band = { left: 0, top: 0, width: 360, height: 60 };
  const tags = [{ left: 10, top: 100, width: 44, height: 44 }, { left: 60, top: 100, width: 44, height: 44 }];
  assert.equal(hostOverlapChecks({ band, tags }).ok, true);
  assert.equal(hostOverlapChecks({ band, tags: [...tags, { left: 70, top: 110, width: 44, height: 44 }] }).ok, false);
  assert.equal(hostOverlapChecks({ band, tags: [{ left: 10, top: 50, width: 44, height: 44 }] }).ok, false);
  // 변만 맞닿으면 겹침이 아니다
  assert.equal(hostOverlapChecks({ band, tags: [{ left: 10, top: 60, width: 44, height: 44 }] }).ok, true);
  for (const x of [undefined, {}, { band, tags: [] }, { tags }]) {
    const r = hostOverlapChecks(x);
    assert.equal(r.ok, false);
    assert.match(r.detail, /측정값 없음/);
  }
});

test("hostOverlapChecks knownBandLimit: 띠 겹침은 판정에서 빼 known 으로 돌려주고, 이름표끼리 겹침은 그대로 실패한다(UI#14 360x560)", () => {
  const band = { left: 0, top: 0, width: 360, height: 60 };
  const overBand = [{ left: 10, top: 54, width: 44, height: 44 }];
  const limited = hostOverlapChecks({ band, tags: overBand }, { knownBandLimit: true });
  assert.equal(limited.ok, true, limited.detail);
  assert.match(limited.known, /띠와 겹침/);
  assert.equal(hostOverlapChecks({ band, tags: overBand }).ok, false);
  const tagsOverlap = [{ left: 10, top: 100, width: 44, height: 44 }, { left: 20, top: 110, width: 44, height: 44 }];
  assert.equal(hostOverlapChecks({ band, tags: tagsOverlap }, { knownBandLimit: true }).ok, false);
  assert.equal(hostOverlapChecks({ band, tags: [] }, { knownBandLimit: true }).ok, false);
});

const NO_LABELS = { labelAttrs: 0, labelEls: 0 };

test("toolLabelChecks TL1: 접근성 이름이 있으면 글 단추·아이콘 단추 모두 통과, 이름이 빈 단추는 실패", () => {
  const list = [
    { name: "나가기", text: "", hasIcon: true },
    { name: "넘기기", text: "1 / 3", hasIcon: true },
    { name: "시작", text: "시작", hasIcon: false },
  ];
  for (const r of toolLabelChecks(list, NO_LABELS)) assert.equal(r.ok, true, r.id + r.detail);
  const bad = toolLabelChecks([...list, { name: "", text: "", hasIcon: true }], NO_LABELS).find((r) => r.id === "TL1");
  assert.equal(bad.ok, false);
  assert.match(bad.detail, /아이콘만/);
  // 공백뿐인 이름도 빈 것이다
  assert.equal(toolLabelChecks([{ name: "  ", text: "", hasIcon: true }], NO_LABELS).find((r) => r.id === "TL1").ok, false);
});

test("toolLabelChecks: 면제 목록은 없다 — 이름이 있는 내보내기 ×·봇 ± 는 이름 덕에 통과하고 이름이 없으면 실패", async () => {
  assert.equal("TOOL_LABEL_EXEMPT" in (await import("./lib.mjs")), false);
  const named = [
    { name: "민수 님 내보내기", text: "×", hasIcon: true },
    { name: "봇 줄이기", text: "−", hasIcon: true },
  ];
  assert.equal(toolLabelChecks(named, NO_LABELS).find((r) => r.id === "TL1").ok, true);
  assert.equal(toolLabelChecks([{ name: "", text: "×", hasIcon: true }], NO_LABELS).find((r) => r.id === "TL1").ok, false);
});

test("toolLabelChecks TL2: 이름표 속성·아이콘 아래 라벨 요소가 0건이어야 통과", () => {
  const ok = [{ name: "내 역할, 새 기록", text: "", hasIcon: true }];
  assert.equal(toolLabelChecks(ok, NO_LABELS).find((r) => r.id === "TL2").ok, true);
  const attrs = toolLabelChecks(ok, { labelAttrs: 2, labelEls: 0 }).find((r) => r.id === "TL2");
  assert.equal(attrs.ok, false);
  assert.match(attrs.detail, /data-tool-label 요소 2개/);
  const els = toolLabelChecks(ok, { labelAttrs: 0, labelEls: 3 }).find((r) => r.id === "TL2");
  assert.equal(els.ok, false);
  assert.match(els.detail, /라벨 요소 3개/);
});

test("toolLabelChecks: 목록이 비었거나 모양이 틀리거나 개수가 없으면 측정값 없음으로 실패(공허 통과 금지)", () => {
  for (const x of [undefined, null, [], [{ text: 1 }]]) {
    const rs = toolLabelChecks(x, NO_LABELS);
    assert.equal(rs.find((r) => r.id === "TL1").ok, false, JSON.stringify(x));
    assert.ok(/측정값 없음/.test(rs.find((r) => r.id === "TL1").detail));
  }
  for (const c of [undefined, null, {}, { labelAttrs: 0 }, { labelAttrs: "0", labelEls: 0 }]) {
    const tl2 = toolLabelChecks([{ name: "x", text: "x", hasIcon: false }], c).find((r) => r.id === "TL2");
    assert.equal(tl2.ok, false, JSON.stringify(c));
    assert.match(tl2.detail, /측정값 없음/);
  }
});

test("HOST_ACT_LINES·ROLE_LINES: 역할별 줄·역할 문구 표", () => {
  assert.deepEqual(Object.keys(HOST_ACT_LINES).sort(), ["doctor", "mafia", "police"]);
  assert.deepEqual(Object.keys(ROLE_LINES).sort(), ["citizen", "doctor", "mafia", "police"]);
});

const leakItem = (role, over = {}) => ({ role, ownRole: role === "ghost" ? "mafia" : role, phase: "night", domText: "밤이 되었습니다.", callCount: 0, line: "밤이 되었습니다.", idle: false, ...over });

// readRoomText 가 공백을 한 칸으로 줄여 읽으므로 사본도 같은 정규화로 만든다(줄바꿈 → 공백)
const flat = (s) => s.replace(/\s+/g, " ");

test("hostLeakChecks HL1: 내 역할 줄·문구만 있으면 통과, 다른 역할 act 줄·문구가 있으면 실패", () => {
  const rs = hostLeakChecks([leakItem("police", { domText: HOST_ACT_LINES.police + " " + flat(ROLE_LINES.police) })]);
  assert.equal(rs.find((r) => r.id === "HL1").ok, true);
  const act = hostLeakChecks([leakItem("citizen", { domText: HOST_ACT_LINES.mafia })]).find((r) => r.id === "HL1");
  assert.equal(act.ok, false);
  assert.match(act.detail, /citizen/);
  const goal = hostLeakChecks([leakItem("doctor", { domText: flat(ROLE_LINES.mafia) })]).find((r) => r.id === "HL1");
  assert.equal(goal.ok, false);
  assert.match(goal.detail, /doctor@night 화면에 mafia 역할 문구/);
  // 유령은 자기 직업 줄·다른 직업 줄 모두 띠에 없어야 한다 — 자기 직업의 역할 문구만 허용
  const ghost = hostLeakChecks([leakItem("ghost", { ownRole: "mafia", domText: flat(ROLE_LINES.mafia) })]).find((r) => r.id === "HL1");
  assert.equal(ghost.ok, true, ghost.detail);
  assert.equal(hostLeakChecks([leakItem("ghost", { ownRole: "mafia", domText: HOST_ACT_LINES.mafia })]).find((r) => r.id === "HL1").ok, false);
});

test("hostLeakChecks HL2: 같은 단계에서 할 일 없는 역할(idle) 둘의 띠 문장이 같아야 한다", () => {
  const a = leakItem("citizen", { phase: "roleReveal", idle: true, line: "확인하셨으면 그대로 기다려 주세요." });
  const b = leakItem("police", { phase: "roleReveal", idle: true, line: "확인하셨으면 그대로 기다려 주세요." });
  assert.equal(hostLeakChecks([a, b]).find((r) => r.id === "HL2").ok, true);
  const c = { ...b, line: "경찰은 기다려 주세요." };
  const bad = hostLeakChecks([a, c]).find((r) => r.id === "HL2");
  assert.equal(bad.ok, false);
  assert.match(bad.detail, /roleReveal/);
  // idle 이 아닌 항목은 비교하지 않는다
  assert.equal(hostLeakChecks([a, { ...c, idle: false }]).find((r) => r.id === "HL2").ok, true);
});

test("hostLeakChecks HL3: 유령 띠 문장에 마피아·경찰·의사·시민 낱말이 없어야 한다", () => {
  assert.equal(hostLeakChecks([leakItem("ghost", { line: "밤이 되었습니다. 모두의 밤 행동을 지켜봐 주세요." })]).find((r) => r.id === "HL3").ok, true);
  const bad = hostLeakChecks([leakItem("ghost", { line: "마피아가 움직입니다." })]).find((r) => r.id === "HL3");
  assert.equal(bad.ok, false);
});

test("hostLeakChecks HL4(15-08): 산 사람의 밤 화면 data-call 수가 역할과 무관하게 같아야 한다", () => {
  const hl4 = (list) => hostLeakChecks(list).find((r) => r.id === "HL4");
  assert.equal(hl4([leakItem("mafia", { callCount: 6 }), leakItem("police", { callCount: 6 }), leakItem("citizen", { callCount: 6 })]).ok, true);
  // 마피아만 0(옛 계약)이거나 하나만 다르면 실패 — 마피아도 시민과 같은 칸이 빛난다
  const old = hl4([leakItem("mafia", { callCount: 0 }), leakItem("police", { callCount: 6 })]);
  assert.equal(old.ok, false);
  assert.match(old.detail, /mafia 0 ≠ police 6/);
  assert.equal(hl4([leakItem("mafia", { callCount: 6 }), leakItem("doctor", { callCount: 5 })]).ok, false);
  // 유령·밤이 아닌 단계는 보지 않는다
  assert.equal(hl4([leakItem("police", { callCount: 6 }), leakItem("mafia", { callCount: 6 }), leakItem("ghost", { callCount: 0 }), leakItem("doctor", { phase: "nomination", callCount: 7 })]).ok, true);
  // 서로 다른 역할의 산 사람 밤 읽기가 둘 미만이면 비교가 안 된다: 측정 불가(공허 통과 금지)
  const lone = hl4([leakItem("mafia", { callCount: 6 })]);
  assert.equal(lone.ok, false);
  assert.match(lone.detail, /측정값 없음/);
  assert.equal(hl4([leakItem("mafia", { callCount: 6 }), leakItem("mafia", { callCount: 6 })]).ok, false);
});

test("hostLeakChecks: 목록이 비었거나 모양이 틀리면 측정값 없음으로 실패", () => {
  for (const x of [undefined, null, [], [{ role: "mafia" }], [leakItem("ghost", { ownRole: undefined })], [leakItem("mafia", { callCount: "0" })]]) {
    const rs = hostLeakChecks(x);
    assert.equal(rs.every((r) => r.ok), false, JSON.stringify(x));
    assert.ok(rs.some((r) => /측정값 없음/.test(r.detail)), JSON.stringify(x));
  }
});

test("viewKeyChecks VK1: 최상위·me·day 키가 허용 목록 안이면 통과, 밖이면 실패", () => {
  const ok = { top: new Set(["code", "phase", "me"]), me: ["seat", "isHost"], day: ["n"] };
  assert.equal(viewKeyChecks(ok).ok, true);
  const bad = viewKeyChecks({ ...ok, top: ["code", "evidence"] });
  assert.equal(bad.ok, false);
  assert.match(bad.detail, /evidence/);
  assert.equal(viewKeyChecks({ ...ok, me: ["seat", "traceMine"] }).ok, false);
  assert.equal(viewKeyChecks({ ...ok, day: ["roleOf"] }).ok, false);
  assert.ok(VIEW_TOP_KEYS.has("phase") && VIEW_ME_KEYS.has("role") && VIEW_DAY_KEYS.has("n"));
  for (const x of [undefined, {}, { top: [], me: [] }, { top: [], me: [], day: [] }]) {
    const r = viewKeyChecks(x);
    assert.equal(r.ok, false);
    assert.match(r.detail, /측정값 없음/);
  }
});

test("hostChimeChecks: 전환 구간 1번·첫 프레임 0번·낮 시작→토론 0번·소리 끔 재생 0번이면 모두 통과", () => {
  const segs = [
    { kind: "transition", name: "토론→투표", count: 1, played: 1 },
    { kind: "first", name: "처음 입장", count: 0, played: 0 },
    { kind: "reload", name: "새로고침", count: 0, played: 0 },
    { kind: "dayToDiscussion", name: "낮 시작→토론", count: 0, played: 0 },
    { kind: "muted", name: "소리 끔", count: 1, played: 0 },
  ];
  const rs = hostChimeChecks(segs);
  assert.deepEqual(rs.map((r) => r.id), ["HS1", "HS2", "HS3", "HS4"]);
  for (const r of rs) assert.equal(r.ok, true, r.id + r.detail);
});

test("hostChimeChecks: 전환 0번·2번, 첫 프레임 1번, 낮 시작→토론 1번, 소리 끔 재생 1번은 각각 실패", () => {
  const f = (seg, id) => {
    const r = hostChimeChecks([seg]).find((x) => x.id === id);
    assert.equal(r.ok, false, id);
    assert.match(r.detail, new RegExp(seg.name));
  };
  f({ kind: "transition", name: "T0", count: 0, played: 0 }, "HS1");
  f({ kind: "transition", name: "T2", count: 2, played: 2 }, "HS1");
  f({ kind: "first", name: "F1", count: 1, played: 1 }, "HS2");
  f({ kind: "reload", name: "R1", count: 1, played: 1 }, "HS2");
  f({ kind: "dayToDiscussion", name: "D1", count: 1, played: 1 }, "HS3");
  f({ kind: "muted", name: "M1", count: 1, played: 1 }, "HS4");
});

test("hostChimeChecks: 구간이 없거나 모양이 틀리면 측정값 없음으로 실패(해당 구간 종류가 하나도 없어도 실패)", () => {
  for (const x of [undefined, null, [], [{ kind: "transition", count: "1" }], [{ kind: "x", name: "?", count: 0, played: 0 }]]) {
    const rs = hostChimeChecks(x);
    assert.equal(rs.every((r) => r.ok), false, JSON.stringify(x));
    assert.ok(rs.some((r) => /측정값 없음/.test(r.detail)), JSON.stringify(x));
  }
  // 전환만 있고 나머지 종류가 없으면 그 종류의 판정은 측정값 없음
  const only = hostChimeChecks([{ kind: "transition", name: "T", count: 1, played: 1 }]);
  assert.equal(only.find((r) => r.id === "HS1").ok, true);
  assert.equal(only.find((r) => r.id === "HS2").ok, false);
});

// ---- 14-08: 이름표로 길어진 떠 있는 단추 상자(면 48 + 4 + 라벨 19.6) ----

test("FLOAT_BOX_H: 떠 있는 단추는 상자가 곧 면이라 높이 48 = 지름 (16-06, 라벨 몫 0)", () => {
  assert.equal(FLOAT_LABEL_EXTRA, 0);
  assert.equal(FLOAT_BOX_H, FLOAT_SIZE);
  assert.equal(FLOAT_BOX_H, 48);
});

test("floatButtonChecks boxH: 높이를 주면 그 높이로 판정한다(기본은 48)", () => {
  const g = floatGood();
  assert.equal(okOf(floatButtonChecks(g)).FB4, true);
  g.boxH = FLOAT_BOX_H;
  assert.equal(okOf(floatButtonChecks(g)).FB4, true);
  g.boxH = 60;
  assert.equal(okOf(floatButtonChecks(g)).FB4, false);
});

test("dressChecks: 옷장 단추는 오른쪽 열의 52 원이다 — 48x48 은 실패한다(16-06)", () => {
  const a = dressGood();
  a.float = rect(292, 130, 48, 48);
  onlyFail(dressChecks(a), "DB1");
  assert.equal(okOf(dressChecks(dressGood())).DB1, true);
});

test("emoteTrayChecks(16-05): 동작 단추는 48x48, 판 아랫변은 입력줄 윗변 − 8 — 옛 이름표 단추(44x59.6)와 간격 19.6 은 실패한다", () => {
  const g = trayGood();
  assert.equal(okOf(emoteTrayChecks(g)).EB1, true);
  assert.equal(okOf(emoteTrayChecks(g)).TR3, true);
  const old = trayGood();
  old.button = rect(16, 448.4, 44, 59.6); // 이름표가 있던 옛 모양
  old.tray = rect(16, 306 - 11.6, 328, 146); // 아랫변 = 입력칸 윗변 − 19.6
  assert.deepEqual(emoteTrayChecks(old).filter((l) => !l.ok).map((l) => l.id), ["EB1", "TR3"]);
});


// ---- 15-09: 15페이즈 판정(심부름·목격 기록·아침 흔적·밤 얼굴 목록) ----

const fails = (lines) => lines.filter((l) => !l.ok).map((l) => l.id);
const noMeasureAll = (lines) => lines.every((l) => !l.ok && /측정값 없음/.test(l.detail));

test("ERRAND_MARKERS: 열여덟 개(16-07: data-rest 추가, 16-08: 독·칩 대신 시작 카드·진행 점 셋, 16-09: 증거 카드 2행·이름표 표시 넷)이고 서로 다르며 ERRAND_PLACE_IDS 는 16곳, 3곳씩", () => {
  assert.equal(ERRAND_MARKERS.length, 18);
  assert.equal(new Set(ERRAND_MARKERS).size, 18);
  assert.ok(ERRAND_MARKERS.includes("data-rest"));
  for (const gone of ["data-errand-dock", "data-errand-chip"]) assert.ok(!ERRAND_MARKERS.includes(gone), gone);
  for (const added of ["data-errand-start-card", "data-errand-dots", "data-errand-dot"]) assert.ok(ERRAND_MARKERS.includes(added), added);
  for (const added of ["data-lastseen-row", "data-lastseen-count", "data-trace-mark", "data-seen-mark"]) assert.ok(ERRAND_MARKERS.includes(added), added);
  assert.ok(ERRAND_MARKERS.every((m) => /^data-(errand-|near-|record-|trace-|lastseen-|seen-|rest$)/.test(m)));
  assert.equal(ERRAND_PLACE_IDS.length, 16);
  assert.equal(ERRAND_PER_PERSON, 3);
  assert.equal(ERRAND_LINES.trace, "흔적이 남았습니다. 같은 옷을 입은 사람을 표시했습니다.");
  assert.equal(ERRAND_LINES.discussionEvidence, "토론입니다. 같은 옷과 엇갈린 목격을 살펴보세요.");
});

test("OVERALL_LIMIT_MS: 15-09 errand·witness·trace(720초)로 900→1620초, 17-09 튜토리얼 두 흐름(solo 폰 6종 약 34초×6 + together 12초 = 218초 ÷ 병렬 3 = 73초, 60초 단위 올림 120초)으로 1620→1740초", () => {
  assert.equal(OVERALL_LIMIT_MS, 1_740_000);
});

const RR = (l, t, w, h) => ({ left: l, top: t, width: w, height: h });
const placesOk = (over = {}) => [
  { id: "clock", done: false, hidden: false, call: true, rest: false, ...over },
  { id: "bench", done: false, hidden: false, call: false, rest: true },
  { id: "lamp", done: false, hidden: true, call: false, rest: false },
];
const errandOk = (over = {}) => ({
  total: 3,
  places: placesOk(),
  doneAttr: 0,
  progressText: "0/3",
  bandLine: ERRAND_LINES.act,
  panelCount: 0,
  dotsRows: 1,
  dotsAria: "진행 0/3",
  dotsLive: "polite",
  dotsText: "",
  callCount: 1,
  callKinds: ["tile"],
  reach: "out",
  actCount: 0,
  arrowCount: 1,
  tiles: [RR(40, 200, 64, 64), RR(150, 300, 64.5, 63.5)],
  seatsInWorld: 2,
  nearSeats: 2,
  tagSeats: 2,
  attrValues: ["", "1", "2", "3", "0/3", "clock", "bench", "lamp"],
  ...over,
});
const errandDone = (over = {}) =>
  errandOk({
    places: [{ id: "clock", done: true, hidden: false, call: false, rest: false }, { id: "bench", done: true, hidden: false, call: false, rest: false }, { id: "lamp", done: true, hidden: true, call: false, rest: false }],
    doneAttr: 3,
    progressText: "3/3",
    dotsAria: "진행 3/3",
    bandLine: ERRAND_LINES.done,
    callCount: 0,
    callKinds: [],
    reach: "done",
    actCount: 0,
    arrowCount: 0,
    ...over,
  });
const errandIn = (over = {}) =>
  errandOk({
    places: placesOk({ call: false, rest: true }),
    callCount: 1,
    callKinds: ["act"],
    reach: "in",
    actCount: 1,
    arrowCount: 0,
    ...over,
  });

test("errandChecks: 정상 입력은 EA1~EA11 모두 통과 — 반경 밖·반경 안·3/3 세 상태", () => {
  assert.deepEqual(fails(errandChecks(errandOk())), []);
  assert.deepEqual(fails(errandChecks(errandIn())), []);
  assert.deepEqual(fails(errandChecks(errandDone())), []);
  assert.equal(errandChecks(errandOk()).length, 11);
});

test("errandChecks: 항목 하나씩 어긋나게 하면 해당 판정만 실패한다", () => {
  assert.deepEqual(fails(errandChecks(errandOk({ total: 2, places: errandOk().places.slice(0, 2), progressText: "0/2", dotsAria: "진행 0/2" }))), ["EA1"]);
  assert.deepEqual(fails(errandChecks(errandOk({ doneAttr: 1 }))), ["EA2"]);
  // 띠 문장과 독 단추(EA3)
  assert.deepEqual(fails(errandChecks(errandDone({ bandLine: ERRAND_LINES.act }))), ["EA3"]);
  assert.deepEqual(fails(errandChecks(errandOk({ bandLine: ERRAND_LINES.done }))), ["EA3"]);
  assert.deepEqual(fails(errandChecks(errandOk({ panelCount: 1 }))), ["EA3"]);
  // 진행 점 줄: 줄 수·aria-label·aria-live·보이는 글자
  assert.deepEqual(fails(errandChecks(errandOk({ dotsRows: 0 }))), ["EA11"]);
  assert.deepEqual(fails(errandChecks(errandOk({ dotsAria: "진행 1/3" }))), ["EA11"]);
  assert.deepEqual(fails(errandChecks(errandOk({ progressText: "1/3" }))), ["EA2", "EA11"]);
  assert.deepEqual(fails(errandChecks(errandOk({ dotsLive: "" }))), ["EA11"]);
  assert.deepEqual(fails(errandChecks(errandOk({ dotsText: "0/3" }))), ["EA11"]);
  // 빛은 한 화면 하나, 화살표에는 없다(EA4)
  assert.deepEqual(fails(errandChecks(errandOk({ callCount: 2, callKinds: ["tile", "tile"] }))), ["EA4"]);
  assert.deepEqual(fails(errandChecks(errandOk({ callKinds: ["arrow"] }))), ["EA4", "EA9"]);
  assert.deepEqual(fails(errandChecks(errandOk({ callKinds: [] }))), ["EA4"]);
  assert.deepEqual(fails(errandChecks(errandOk({ seatsInWorld: 3, nearSeats: 2 }))), ["EA5"]);
  assert.deepEqual(fails(errandChecks(errandOk({ tagSeats: 3 }))), ["EA5"]);
  assert.deepEqual(fails(errandChecks(errandOk({ attrValues: ["clock", "mafia"] }))), ["EA6"]);
  assert.deepEqual(fails(errandChecks(errandOk({ attrValues: ["seat3"] }))), ["EA6"]);
  assert.deepEqual(fails(errandChecks(errandOk({ attrValues: ["unknownPlace"] }))), ["EA6"]);
  // 타일 64 ± 1 (EA7)
  assert.deepEqual(fails(errandChecks(errandOk({ tiles: [RR(40, 200, 44, 44)] }))), ["EA7"]);
  assert.deepEqual(fails(errandChecks(errandOk({ tiles: [RR(40, 200, 65.5, 64)] }))), ["EA7"]);
  assert.deepEqual(fails(errandChecks(errandOk({ tiles: [RR(40, 200, 65, 63)] }))), []);
  // 반경 밖·안·완료의 알약·화살표 개수(EA8)
  assert.deepEqual(fails(errandChecks(errandOk({ actCount: 1 }))), ["EA8"]);
  assert.deepEqual(fails(errandChecks(errandOk({ arrowCount: 0 }))), ["EA8"]);
  assert.deepEqual(fails(errandChecks(errandIn({ actCount: 0 }))), ["EA8"]);
  assert.deepEqual(fails(errandChecks(errandIn({ arrowCount: 1 }))), ["EA8"]);
  assert.deepEqual(fails(errandChecks(errandDone({ arrowCount: 1 }))), ["EA8"]);
  // 빛남 우선(EA9): 반경 안인데 타일이 빛남·반경 밖인데 알약이 빛남·완료인데 빛남
  assert.deepEqual(fails(errandChecks(errandIn({ callKinds: ["tile"] }))), ["EA9"]);
  assert.deepEqual(fails(errandChecks(errandOk({ callKinds: ["act"] }))), ["EA9"]);
  assert.deepEqual(fails(errandChecks(errandDone({ callKinds: ["tile"], callCount: 1 }))), ["EA9"]);
  // 후광 규칙(EA10): 남은 곳에 data-rest 없음·처리한 곳에 있음·빛나는 곳에 있음, 안 보이는 타일은 따지지 않는다
  assert.deepEqual(fails(errandChecks(errandOk({ places: [{ id: "clock", done: false, hidden: false, call: true, rest: false }, { id: "bench", done: false, hidden: false, call: false, rest: false }, { id: "lamp", done: false, hidden: true, call: false, rest: false }] }))), ["EA10"]);
  assert.deepEqual(fails(errandChecks(errandOk({ places: [{ id: "clock", done: false, hidden: false, call: true, rest: true }, { id: "bench", done: false, hidden: false, call: false, rest: true }, { id: "lamp", done: false, hidden: true, call: false, rest: false }] }))), ["EA10"]);
  assert.deepEqual(fails(errandChecks(errandDone({ places: [{ id: "clock", done: true, hidden: false, call: false, rest: true }, { id: "bench", done: true, hidden: false, call: false, rest: false }, { id: "lamp", done: true, hidden: true, call: false, rest: false }] }))), ["EA10"]);
});

test("errandChecks: 측정 누락(null·빈 입력)은 측정값 없음으로 실패(공허 통과 금지)", () => {
  for (const x of [undefined, null, 3]) assert.ok(noMeasureAll(errandChecks(x)), String(x));
  for (const k of ["total", "places", "doneAttr", "progressText", "bandLine", "panelCount", "dotsRows", "dotsAria", "dotsLive", "dotsText", "callCount", "callKinds", "reach", "actCount", "arrowCount", "tiles", "seatsInWorld", "nearSeats", "tagSeats", "attrValues"]) {
    const rs = errandChecks(errandOk({ [k]: null }));
    assert.ok(rs.some((r) => !r.ok && /측정값 없음/.test(r.detail)), `${k} 누락`);
  }
  // 타일별 읽기 값 일부가 빠져도 측정값 없음(EA10)
  const partial = errandChecks(errandOk({ places: [{ id: "clock", done: false }, { id: "bench", done: false }, { id: "lamp", done: false }] }));
  assert.ok(partial.some((r) => r.id === "EA10" && !r.ok && /측정값 없음/.test(r.detail)));
});

const overlapOk = () => ({
  stage: RR(0, 123, 360, 457), // 띠 아랫변 ~ 진행 점 줄 윗변(580)
  band: RR(16, 70, 328, 53),
  side: [RR(292, 131, 52, 52), RR(292, 195, 52, 52)],
  dots: RR(138, 580, 84, 20), // 창 640 − 40 = 600 이 아랫변
  vh: 640,
  pins: [RR(40, 200, 64, 64), RR(150, 300, 64, 64)],
  arrow: RR(240, 250, 40, 40),
  act: null,
  tagButtons: [RR(180, 150, 44, 44)],
});

test("errandOverlapChecks: 서로 안 겹치면 통과, 변이 맞닿거나 0.5px 이하 겹침도 통과, 알약이 있으면 타일 위에 선다", () => {
  assert.deepEqual(fails(errandOverlapChecks(overlapOk())), []);
  assert.deepEqual(fails(errandOverlapChecks({ ...overlapOk(), pins: [RR(40, 200, 64, 64), RR(104.4, 200, 64, 64)] })), []);
  assert.deepEqual(fails(errandOverlapChecks({ ...overlapOk(), arrow: null })), []);
  assert.deepEqual(fails(errandOverlapChecks({ ...overlapOk(), arrow: null, act: RR(30, 148, 96, 44) })), []);
  // 화살표가 다가가는 타일 위를 지나도 눌림을 통과하는 표지라 겹침으로 보지 않는다(16-07)
  assert.deepEqual(fails(errandOverlapChecks({ ...overlapOk(), arrow: RR(150, 300, 40, 40) })), []);
});

test("errandOverlapChecks: 1px 겹침이 각각 해당 판정을 실패시킨다", () => {
  const o = overlapOk();
  assert.deepEqual(fails(errandOverlapChecks({ ...o, pins: [RR(40, 200, 64, 64), RR(103, 200, 64, 64)] })), ["EO1"]);
  assert.deepEqual(fails(errandOverlapChecks({ ...o, arrow: null, act: RR(30, 157, 96, 44) })), ["EO1"]);
  assert.deepEqual(fails(errandOverlapChecks({ ...o, tagButtons: [RR(40, 242, 44, 44)] })), ["EO2"]);
  assert.deepEqual(fails(errandOverlapChecks({ ...o, arrow: RR(180, 150, 40, 40) })), ["EO2"]);
  // 띠(위로 걸침: 스테이지 안쪽 inset 도 함께 벗어난다)·오른쪽 열 단추·아래 패널
  assert.deepEqual(fails(errandOverlapChecks({ ...o, pins: [RR(40, 100, 64, 64)] })), ["EO3", "EO4"]);
  assert.ok(fails(errandOverlapChecks({ ...o, arrow: RR(310, 170, 40, 40) })).includes("EO3"));
  assert.deepEqual(fails(errandOverlapChecks({ ...o, pins: [RR(280, 180, 64, 64)] })), ["EO3"]);
  assert.ok(fails(errandOverlapChecks({ ...o, pins: [RR(120, 520, 64, 64)] })).includes("EO3"));
  // 진행 점 줄 윗변 − 8(572) 에 걸치는 타일은 점 줄과 겹치지 않아도 EO3, 스테이지(윗변 580) 안쪽 8 도 벗어난다
  assert.deepEqual(fails(errandOverlapChecks({ ...o, pins: [RR(120, 512, 64, 64)] })), ["EO3", "EO4"]);
  assert.deepEqual(fails(errandOverlapChecks({ ...o, pins: [RR(120, 508, 64, 64)] })), []);
  // 진행 점 줄 아랫변이 창 아래 − 40 ± 2 를 벗어나면 EO5
  assert.deepEqual(fails(errandOverlapChecks({ ...o, dots: RR(138, 583, 84, 20) })), ["EO5"]);
  assert.deepEqual(fails(errandOverlapChecks({ ...o, dots: RR(138, 581, 84, 20) })), []);
  // 스테이지 안쪽 8 inset 밖(타일·알약·화살표 모두), 화살표 둘·알약 둘
  assert.deepEqual(fails(errandOverlapChecks({ ...o, pins: [RR(4, 200, 64, 64)] })), ["EO4"]);
  assert.deepEqual(fails(errandOverlapChecks({ ...o, arrow: null, act: RR(4, 300, 96, 44) })), ["EO4"]);
  assert.deepEqual(fails(errandOverlapChecks({ ...o, arrow: RR(4, 250, 40, 40) })), ["EO4"]);
  assert.deepEqual(fails(errandOverlapChecks({ ...o, arrow: [RR(240, 250, 40, 40), RR(200, 400, 40, 40)] })), ["EO4"]);
  assert.deepEqual(fails(errandOverlapChecks({ ...o, arrow: null, act: [RR(200, 400, 96, 44), RR(100, 400, 96, 44)] })), ["EO4"]);
});

test("errandOverlapChecks: 사각형 누락은 측정값 없음", () => {
  assert.ok(noMeasureAll(errandOverlapChecks(undefined)));
  assert.ok(noMeasureAll(errandOverlapChecks({ ...overlapOk(), stage: null })));
  assert.ok(noMeasureAll(errandOverlapChecks({ ...overlapOk(), pins: [{ left: 1 }] })));
  assert.ok(noMeasureAll(errandOverlapChecks({ ...overlapOk(), tagButtons: undefined })));
  assert.ok(noMeasureAll(errandOverlapChecks({ ...overlapOk(), side: undefined })));
  assert.ok(noMeasureAll(errandOverlapChecks({ ...overlapOk(), act: { left: 1 } })));
  assert.ok(noMeasureAll(errandOverlapChecks({ ...overlapOk(), dots: undefined })));
  assert.ok(noMeasureAll(errandOverlapChecks({ ...overlapOk(), vh: undefined })));
});

const sigOk = (over = {}) => ({
  names: ["data-errand-start-card", "data-errand-dots", "data-errand-dot", "data-errand-progress", "data-errand-place", "data-errand-arrow", "data-near-ring", "data-errand-layer", "data-errand-act-layer", "data-done", "data-rest"],
  counts: { "data-errand-start-card": 1, "data-errand-dots": 1, "data-errand-dot": 3, "data-errand-progress": 1, "data-errand-place": 3, "data-errand-arrow": 1, "data-near-ring": 1 },
  ...over,
});

test("errandParityChecks: 같은 구조면 통과(상태 표식 data-call·data-rest·data-errand-act 의 있고 없음은 판마다 달라도 된다)", () => {
  assert.deepEqual(fails(errandParityChecks(sigOk(), sigOk())), []);
  assert.deepEqual(fails(errandParityChecks(sigOk(), sigOk({ names: [...sigOk().names.filter((n) => n !== "data-rest"), "data-call", "data-errand-act"] }))), []);
});

test("errandParityChecks: 이름 집합·구조 표식 개수가 다르거나 역할류·알 수 없는 표식이 있으면 실패, 입력 누락은 측정값 없음", () => {
  assert.deepEqual(fails(errandParityChecks(sigOk(), sigOk({ names: [...sigOk().names, "data-errand-hint"] }))), ["ER1"]);
  assert.deepEqual(fails(errandParityChecks(sigOk(), sigOk({ counts: { ...sigOk().counts, "data-errand-place": 4 } }))), ["ER1"]);
  assert.deepEqual(fails(errandParityChecks(sigOk(), sigOk({ names: [...sigOk().names, "data-fake"] }))), ["ER1"]);
  assert.deepEqual(fails(errandParityChecks(sigOk({ names: [...sigOk().names, "data-mafia-place"] }), sigOk({ names: [...sigOk().names, "data-mafia-place"] }))), ["ER1"]);
  assert.deepEqual(fails(errandParityChecks(sigOk({ names: [...sigOk().names, "data-extra"] }), sigOk({ names: [...sigOk().names, "data-extra"] }))), ["ER1"]);
  assert.ok(noMeasureAll(errandParityChecks(null, sigOk())));
  assert.ok(noMeasureAll(errandParityChecks(sigOk(), sigOk({ counts: { "data-errand-dots": 1 } }))));
});

test("errandCardChecks: 2초 안 카드 1개(타일 3·단추 0·제목·한 줄)·2.5초 뒤 0개면 통과, 어긋나면 EC1 실패, 읽기 누락은 측정값 없음", () => {
  const early = { cards: 1, tiles: 3, buttons: 0, text: "오늘 갈 곳 가는 길에 본 사람이 기록돼요" };
  assert.deepEqual(fails(errandCardChecks({ early, late: { cards: 0 } })), []);
  assert.deepEqual(fails(errandCardChecks({ early: { ...early, cards: 0 }, late: { cards: 0 } })), ["EC1"]);
  assert.deepEqual(fails(errandCardChecks({ early: { ...early, tiles: 2 }, late: { cards: 0 } })), ["EC1"]);
  assert.deepEqual(fails(errandCardChecks({ early: { ...early, buttons: 1 }, late: { cards: 0 } })), ["EC1"]);
  assert.deepEqual(fails(errandCardChecks({ early: { ...early, text: "오늘 갈 곳 술잔 가는 길에 본 사람이 기록돼요" }, late: { cards: 0 } })), ["EC1"]);
  assert.deepEqual(fails(errandCardChecks({ early, late: { cards: 1 } })), ["EC1"]);
  assert.ok(noMeasureAll(errandCardChecks(undefined)));
  assert.ok(noMeasureAll(errandCardChecks({ early, late: null })));
  assert.ok(noMeasureAll(errandCardChecks({ early: { cards: 1 }, late: { cards: 0 } })));
});

test("errandCardWalkChecks: 걷고 닫혔으면 통과, 걷지 않거나 닫히지 않으면 EC2 실패, 누락은 측정값 없음", () => {
  assert.deepEqual(fails(errandCardWalkChecks({ moved: true, closed: true })), []);
  assert.deepEqual(fails(errandCardWalkChecks({ moved: false, closed: true })), ["EC2"]);
  assert.deepEqual(fails(errandCardWalkChecks({ moved: true, closed: false })), ["EC2"]);
  assert.ok(noMeasureAll(errandCardWalkChecks(null)));
  assert.ok(noMeasureAll(errandCardWalkChecks({ moved: true })));
});

const recOk = (over = {}) => ({
  finished: true,
  hasButton: true,
  hasCard: true,
  rowsAttr: "2",
  rowCount: 2,
  zeroText: "2",
  cardRect: RR(16, 183, 328, 150),
  dockRect: RR(300, 131, 44, 44),
  bandRect: RR(16, 70, 328, 53),
  inputRect: RR(16, 400, 328, 52),
  collapsedOnFocus: true,
  ...over,
});

test("recordChecks: 마친 사람의 열린 카드는 통과, 줄 0 이면 '0'", () => {
  assert.deepEqual(fails(recordChecks(recOk())), []);
  assert.deepEqual(fails(recordChecks(recOk({ rowsAttr: "0", rowCount: 0, zeroText: "0" }))), []);
  // 못 마친 사람: 단추·카드 0 이면 통과
  assert.deepEqual(fails(recordChecks({ finished: false, hasButton: false, hasCard: false })), []);
});

test("recordChecks: 어긋남은 해당 판정만 실패", () => {
  assert.deepEqual(fails(recordChecks({ finished: false, hasButton: true, hasCard: true })), ["RC1"]);
  assert.deepEqual(fails(recordChecks({ finished: false, hasButton: true, hasCard: false })), ["RC1"]);
  assert.deepEqual(fails(recordChecks(recOk({ hasButton: false }))), ["RC1"]);
  assert.deepEqual(fails(recordChecks(recOk({ rowsAttr: "3" }))), ["RC2"]);
  assert.deepEqual(fails(recordChecks(recOk({ rowsAttr: "0", rowCount: 0, zeroText: "" }))), ["RC2"]);
  // 카드 윗변이 독 아랫변 + 8 − 0.5 미만이면 실패, 0.5 이내는 통과
  assert.deepEqual(fails(recordChecks(recOk({ cardRect: RR(16, 182, 328, 150) }))), ["RC3"]);
  assert.deepEqual(fails(recordChecks(recOk({ cardRect: RR(16, 182.6, 328, 150) }))), []);
  // 아랫변이 입력줄 윗변 − 8 을 넘으면 실패(카드는 채팅 기록 칸을 덮되 입력줄은 덮지 않는다), 정확히 − 8 이면 통과
  assert.deepEqual(fails(recordChecks(recOk({ cardRect: RR(16, 183, 328, 209) }))), []);
  assert.deepEqual(fails(recordChecks(recOk({ cardRect: RR(16, 183, 328, 211) }))), ["RC3"]);
  assert.deepEqual(fails(recordChecks(recOk({ cardRect: RR(16, 183, 328, 300) }))), ["RC3"]);
  assert.deepEqual(fails(recordChecks(recOk({ bandRect: RR(16, 150, 328, 53) }))), ["RC3"]);
  assert.deepEqual(fails(recordChecks(recOk({ collapsedOnFocus: false }))), ["RC4"]);
});

test("recordChecks: 마친 사람인데 카드를 읽지 못했거나 값이 없으면 측정값 없음", () => {
  assert.ok(noMeasureAll(recordChecks(undefined)));
  assert.ok(noMeasureAll(recordChecks({ finished: "yes" })));
  const noCard = recordChecks(recOk({ hasCard: false, collapsedOnFocus: true }));
  assert.deepEqual(noCard.filter((l) => !l.ok).map((l) => l.id), ["RC2", "RC3"]);
  assert.ok(recordChecks(recOk({ collapsedOnFocus: null })).some((l) => l.id === "RC4" && /측정값 없음/.test(l.detail)));
  assert.ok(recordChecks(recOk({ cardRect: null })).some((l) => l.id === "RC3" && /측정값 없음/.test(l.detail)));
});

const traceOk = (over = {}) => ({
  expectCard: true,
  cards: 1,
  cardText: "단추 하나 같은 옷을 입은 사람에게 표시 서준 하윤",
  cardAttrText: "status",
  nameLines: 1,
  noteLines: 1,
  rowLines: 1,
  lastseenRows: 1,
  lastseenCount: "1",
  expectSeen: true,
  rowOverflow: false,
  cardRect: RR(16, 220, 328, 128),
  bandRect: RR(16, 70, 328, 53),
  dockRect: RR(300, 131, 44, 44),
  panelRect: RR(0, 360, 360, 200),
  announceVisible: false,
  ...over,
});

test("traceChecks: 피해자 있는 흔적 구간의 카드 1개는 통과, 없는 아침의 카드 0개도 통과", () => {
  assert.deepEqual(fails(traceChecks(traceOk())), []);
  assert.deepEqual(fails(traceChecks({ expectCard: false, cards: 0, announceVisible: false })), []);
});

test("traceChecks: 카드 수·글자 줄·역할 낱말·알림 동시·겹침 어긋남은 각각 실패", () => {
  assert.deepEqual(fails(traceChecks(traceOk({ cards: 0 }))), ["TC1"]);
  assert.deepEqual(fails(traceChecks(traceOk({ expectCard: false }))), ["TC1"]);
  assert.deepEqual(fails(traceChecks(traceOk({ cards: 2 }))), ["TC1"]);
  assert.deepEqual(fails(traceChecks(traceOk({ nameLines: 2 }))), ["TC2"]);
  assert.deepEqual(fails(traceChecks(traceOk({ noteLines: 2 }))), ["TC2"]);
  assert.deepEqual(fails(traceChecks(traceOk({ rowLines: 2 }))), ["TC2"]);
  assert.deepEqual(fails(traceChecks(traceOk({ lastseenRows: 0 }))), ["TC6"]);
  assert.deepEqual(fails(traceChecks(traceOk({ lastseenRows: 2 }))), ["TC6"]);
  assert.deepEqual(fails(traceChecks(traceOk({ lastseenCount: "0" }))), ["TC6"]);
  assert.deepEqual(fails(traceChecks(traceOk({ expectSeen: false }))), ["TC6"]);
  assert.deepEqual(fails(traceChecks(traceOk({ rowOverflow: true }))), ["TC6"]);
  for (const w of ["마피아", "경찰", "의사", "시민", "범인", "증거", "확정"]) assert.deepEqual(fails(traceChecks(traceOk({ cardText: `${w} 조각` }))), ["TC3"], w);
  assert.deepEqual(fails(traceChecks(traceOk({ cardAttrText: "data-role=mafia" }))), ["TC3"]);
  assert.deepEqual(fails(traceChecks(traceOk({ announceVisible: true }))), ["TC4"]);
  assert.deepEqual(fails(traceChecks(traceOk({ cardRect: RR(16, 340, 328, 128) }))), ["TC5"]);
  assert.deepEqual(fails(traceChecks(traceOk({ cardRect: RR(16, 100, 328, 128) }))), ["TC5"]);
});

test("traceChecks: 값 누락은 측정값 없음", () => {
  assert.ok(noMeasureAll(traceChecks(undefined)));
  assert.ok(noMeasureAll(traceChecks({ cards: 1 })));
  assert.ok(traceChecks(traceOk({ nameLines: null })).some((l) => l.id === "TC2" && /측정값 없음/.test(l.detail)));
  assert.ok(traceChecks(traceOk({ rowLines: null })).some((l) => l.id === "TC2" && /측정값 없음/.test(l.detail)));
  assert.ok(traceChecks(traceOk({ lastseenCount: null })).some((l) => l.id === "TC6" && /측정값 없음/.test(l.detail)));
  assert.ok(traceChecks(traceOk({ rowOverflow: null })).some((l) => l.id === "TC6" && /측정값 없음/.test(l.detail)));
  assert.ok(traceChecks(traceOk({ announceVisible: null })).some((l) => l.id === "TC4" && /측정값 없음/.test(l.detail)));
  assert.ok(traceChecks({ expectCard: false, cards: 0, announceVisible: null }).some((l) => l.id === "TC4" && !l.ok));
});

test("traceChecks: 목격자 없는 카드(count 0)는 expectSeen false 와 맞으면 통과, 카드 0개는 TC6 도 해당 없음", () => {
  assert.deepEqual(fails(traceChecks(traceOk({ lastseenCount: "0", expectSeen: false }))), []);
  assert.deepEqual(fails(traceChecks({ expectCard: false, cards: 0, announceVisible: false })), []);
});

const players8 = [
  { seat: 0, look: "police" },
  { seat: 1 },
  { seat: 2, look: "coat" },
  { seat: 3, look: "police", alive: false },
  { seat: 4, look: "police" },
];

test("TRACE_OF_OUTFIT_E2E·sameOutfitSeatsE2E·expectedMarks: 의상 없으면 coat, 죽은 사람 제외, 증거 없으면 빈 집합", () => {
  assert.equal(Object.keys(TRACE_OF_OUTFIT_E2E).length, 9);
  assert.deepEqual(sameOutfitSeatsE2E(players8, "button"), [1, 2]);
  assert.deepEqual(sameOutfitSeatsE2E(players8, "pin"), [0, 4]);
  assert.deepEqual(sameOutfitSeatsE2E(players8, "pencil"), []);
  assert.deepEqual(expectedMarks({ players: players8, day: { evidence: { trace: "pin", seen: { seat: 2, place: "glass" } } } }), { trace: [0, 4], seen: [2] });
  assert.deepEqual(expectedMarks({ players: players8, day: { evidence: { trace: "button" } } }), { trace: [1, 2], seen: [] });
  assert.deepEqual(expectedMarks({ players: players8, day: { evidence: { seen: { seat: 2, place: "glass" } } } }), { trace: [], seen: [] });
  assert.deepEqual(expectedMarks({ players: players8, day: {} }), { trace: [], seen: [] });
  assert.deepEqual(expectedMarks(undefined), { trace: [], seen: [] });
});

const markOk = (over = {}) => ({ stage: "morning", expectTrace: [0, 4], expectSeen: [2], trace: [4, 0], seen: [2], unseated: 0, attrValues: ["", "", ""], ...over });

test("traceMarkChecks: 흔적 구간 TC7·낮 TC8 은 좌석 집합이 기대와 같으면 통과(순서 무관)", () => {
  assert.deepEqual(traceMarkChecks(markOk()).map((l) => l.id), ["TC7"]);
  assert.deepEqual(fails(traceMarkChecks(markOk())), []);
  assert.deepEqual(traceMarkChecks(markOk({ stage: "discussion" })).map((l) => l.id), ["TC8"]);
  assert.deepEqual(fails(traceMarkChecks(markOk({ stage: "discussion" }))), []);
});

test("traceMarkChecks: 밤에는 기대가 빈 배열 — 표시가 남아 있으면 실패", () => {
  assert.deepEqual(fails(traceMarkChecks(markOk({ stage: "night", expectTrace: [], expectSeen: [], trace: [], seen: [], attrValues: [] }))), []);
  assert.deepEqual(fails(traceMarkChecks(markOk({ stage: "night", expectTrace: [], expectSeen: [], trace: [0], seen: [], attrValues: [""] }))), ["TC8"]);
});

test("traceMarkChecks: 좌석 불일치·누락·표식 값·좌석 못 찾음은 각각 실패, 값 누락은 측정값 없음", () => {
  assert.deepEqual(fails(traceMarkChecks(markOk({ trace: [0] }))), ["TC7"]);
  assert.deepEqual(fails(traceMarkChecks(markOk({ trace: [0, 4, 1] }))), ["TC7"]);
  assert.deepEqual(fails(traceMarkChecks(markOk({ seen: [] }))), ["TC7"]);
  assert.deepEqual(fails(traceMarkChecks(markOk({ seen: [3] }))), ["TC7"]);
  assert.deepEqual(fails(traceMarkChecks(markOk({ unseated: 1 }))), ["TC7"]);
  assert.deepEqual(fails(traceMarkChecks(markOk({ attrValues: ["", "mafia"] }))), ["TC7"]);
  assert.ok(noMeasureAll(traceMarkChecks(undefined)));
  assert.ok(noMeasureAll(traceMarkChecks(markOk({ trace: null }))));
  assert.ok(noMeasureAll(traceMarkChecks(markOk({ stage: "dawn" }))));
  assert.ok(noMeasureAll(traceMarkChecks(markOk({ unseated: undefined }))));
});

const faceOk = (role, over = {}) => ({ role, count: 6, itemH: 100, listH: 230, eyeHeal: 0, ringMafia: 0, callCount: 6, disabledCount: 0, toastAfterTap: 0, ...over });
const four = (over = {}) => NIGHT_FACE_ROLES.map((r) => faceOk(r, over[r] ?? {}));

test("nightFaceChecks: 네 역할이 같으면 NF1~NF6 모두 통과", () => {
  assert.deepEqual(NIGHT_FACE_ROLES, ["mafia", "police", "doctor", "citizen"]);
  assert.deepEqual(fails(nightFaceChecks(four())), []);
  // 마피아 선택 수 배지가 칸 높이를 0.5px 흔들어도 ±1 안이면 통과
  assert.deepEqual(fails(nightFaceChecks(four({ mafia: { itemH: 100.5 } }))), []);
});

test("nightFaceChecks: 한 역할만 달라도 해당 판정이 실패", () => {
  assert.deepEqual(fails(nightFaceChecks(four({ mafia: { count: 5, callCount: 5 } }))), ["NF1", "NF5"]);
  assert.deepEqual(fails(nightFaceChecks(four({ citizen: { itemH: 90 } }))), ["NF2"]);
  assert.deepEqual(fails(nightFaceChecks(four({ police: { listH: 300 } }))), ["NF2"]);
  assert.deepEqual(fails(nightFaceChecks(four({ police: { eyeHeal: 1 } }))), ["NF3"]);
  assert.deepEqual(fails(nightFaceChecks(four({ doctor: { eyeHeal: 2 } }))), ["NF3"]);
  assert.deepEqual(fails(nightFaceChecks(four({ mafia: { ringMafia: 1 } }))), ["NF4"]);
  assert.deepEqual(fails(nightFaceChecks(four({ mafia: { disabledCount: 1 } }))), ["NF5"]);
  assert.deepEqual(fails(nightFaceChecks(four({ mafia: { callCount: 0 } }))), ["NF5"]);
  assert.deepEqual(fails(nightFaceChecks(four({ citizen: { toastAfterTap: 1 } }))), ["NF6"]);
});

test("nightFaceChecks: 역할 하나가 빠졌거나 값이 없으면 전부 측정값 없음", () => {
  assert.ok(noMeasureAll(nightFaceChecks(four().slice(0, 3))));
  assert.ok(noMeasureAll(nightFaceChecks([])));
  assert.ok(noMeasureAll(nightFaceChecks(undefined)));
  assert.ok(noMeasureAll(nightFaceChecks(four({ mafia: { listH: null } }))));
  assert.ok(noMeasureAll(nightFaceChecks([...four(), { role: "ghost" }])));
});

test("hostChimeChecks HS3: 낮 시작 → 심부름(dayToErrand) 0번이어야 한다 (15-09)", () => {
  const seg = (kind, name, count) => ({ kind, name, count, played: count });
  const base = [seg("first", "첫", 0), seg("transition", "t", 1), seg("muted", "m", 0)];
  assert.equal(hostChimeChecks([...base, seg("dayToErrand", "낮 시작 → 심부름", 0)]).find((r) => r.id === "HS3").ok, true);
  assert.equal(hostChimeChecks([...base, seg("dayToErrand", "낮 시작 → 심부름", 1)]).find((r) => r.id === "HS3").ok, false);
  assert.match(hostChimeChecks(base).find((r) => r.id === "HS3").detail, /측정값 없음/);
});

// ---- 16-06: sideColumnChecks (SC1~SC6) ----

/** 360×640 방장 대기실 정상값: 띠 면 아랫변 123, 열 윗변 135(= 123 + 12), 오른쪽 16 → left 292, 칸 52·간격 12 */
function sideIn(over = {}) {
  const b = (side, top, left = 292, extra = {}) => ({ side, rect: rect(left, top, 52, 52), ...extra });
  return {
    viewport: { w: 360, h: 640 },
    screen: "lobby",
    host: true,
    mapsOn: true,
    botsOn: true,
    buttons: [b("sound", 135), b("map", 199), b("bots", 263), b("dress", 327)],
    band: rect(16, 70, 328, 53),
    panelTop: 390,
    head: [{ kind: "leave", rect: rect(16, 8, 44, 44) }, { kind: "share", rect: rect(300, 8, 44, 44) }],
    test: rect(16, 131, 90, 44),
    ...over,
  };
}
const scFails = (args) => soundFails(sideColumnChecks(args));

test("sideColumnChecks: 정상값(방장 넷)은 SC1~SC6 모두 통과, 줄 모양은 { id, label, ok, detail }", () => {
  const lines = sideColumnChecks(sideIn());
  assert.deepEqual(lines.map((l) => l.id), ["SC1", "SC2", "SC3", "SC4", "SC5", "SC6"]);
  assert.deepEqual(soundFails(lines), []);
  assert.deepEqual([...SIDE_ORDER], ["sound", "map", "bots", "dress"]);
});

test("sideColumnChecks: 손님(소리·옷장 둘)과 게임 화면(소리 하나)도 통과한다", () => {
  const b = (side, top) => ({ side, rect: rect(292, top, 52, 52) });
  assert.deepEqual(scFails(sideIn({ host: false, buttons: [b("sound", 135), b("dress", 199)] })), []);
  assert.deepEqual(scFails(sideIn({ screen: "game", host: false, buttons: [b("sound", 135)], test: null })), []);
});

test("SC1: 지름 52±1 원이 아니면 실패 — 경계 51 / 53 통과, 50.99 실패. 소리 알약은 높이 52·폭 112 이상", () => {
  const withMap = (w, h) => sideIn({ buttons: sideIn().buttons.map((x) => (x.side === "map" ? { ...x, rect: rect(292 + (52 - w), 199, w, h) } : x)) });
  assert.deepEqual(scFails(withMap(51, 51)).includes("SC1"), false);
  assert.deepEqual(scFails(withMap(50.99, 52)).includes("SC1"), true);
  assert.deepEqual(scFails(withMap(52, 44)).includes("SC1"), true);
  const pill = (w) => sideIn({ buttons: sideIn().buttons.map((x) => (x.side === "sound" ? { ...x, rect: rect(344 - w, 135, w, 52), pill: true } : x)) });
  assert.deepEqual(scFails(pill(120)), []);
  assert.deepEqual(scFails(pill(111)), ["SC1"]);
});

test("SC2: 열 단추끼리·띠 주변 8·아래 패널·머리 단추·[테스트] 와 겹치면 실패, 맞닿기만 하면 통과", () => {
  const move = (side, rc) => ({ buttons: sideIn().buttons.map((x) => (x.side === side ? { ...x, rect: rc } : x)) });
  assert.ok(scFails(sideIn(move("map", rect(292, 180, 52, 52)))).includes("SC2")); // 소리와 겹침
  assert.ok(scFails(sideIn({ band: rect(16, 70, 328, 70) })).includes("SC2")); // 띠 아래 8 안(열 윗변 135 < 띠 아랫변 140 + 8)
  assert.ok(scFails(sideIn({ panelTop: 380 })).includes("SC2")); // 옷장 아랫변 379 > 372
  assert.ok(scFails(sideIn({ head: [{ kind: "share", rect: rect(300, 100, 44, 44) }] })).includes("SC2"));
  assert.ok(scFails(sideIn({ test: rect(250, 131, 60, 44) })).includes("SC2"));
  assert.deepEqual(scFails(sideIn({ band: rect(16, 70, 328, 53) })), []); // 띠 아랫변 123 + 8 = 131 ≤ 열 윗변 135
  assert.deepEqual(scFails(sideIn({ panelTop: 379 + 8 })), []); // 옷장 아랫변 379 = 패널 윗변 − 8
});

test("SC2: 360×560 방장 대기실만 알려진 한계 예외 — 잰 값은 남기고 실패로 세지 않는다. 다른 조합은 같은 겹침이 실패다", () => {
  assert.ok(SIDE_COLUMN_EXCEPTIONS.length >= 1 && SIDE_COLUMN_EXCEPTIONS.every((e) => typeof e.reason === "string" && e.reason.length > 10));
  const overlapping = { panelTop: 300 };
  const exc = sideColumnChecks(sideIn({ ...overlapping, viewport: { w: 360, h: 560 } })).find((l) => l.id === "SC2");
  assert.equal(exc.ok, true);
  assert.equal(exc.known, true);
  assert.match(exc.detail, /알려진 한계/);
  assert.ok(scFails(sideIn({ ...overlapping, viewport: { w: 360, h: 640 } })).includes("SC2"));
  assert.ok(scFails(sideIn({ ...overlapping, viewport: { w: 360, h: 560 }, host: false, buttons: [{ side: "sound", rect: rect(292, 135, 52, 52) }, { side: "dress", rect: rect(292, 250, 52, 52) }] })).includes("SC2"));
  assert.ok(scFails(sideIn({ ...overlapping, viewport: { w: 360, h: 560 }, screen: "result" })).includes("SC2"));
});

test("SC3: 손님에게 맵·봇이 있거나, 방장인데 켜진 맵·봇이 없거나, 순서가 틀리면 실패", () => {
  const b = (side, top) => ({ side, rect: rect(292, top, 52, 52) });
  assert.ok(scFails(sideIn({ host: false, buttons: [b("sound", 135), b("map", 199), b("dress", 263)] })).includes("SC3")); // 손님에게 맵
  assert.ok(scFails(sideIn({ host: false, buttons: [b("sound", 135), b("bots", 199), b("dress", 263)] })).includes("SC3")); // 손님에게 봇
  assert.ok(scFails(sideIn({ buttons: [b("sound", 135), b("map", 199), b("dress", 263)] })).includes("SC3")); // 방장인데 봇 없음
  assert.deepEqual(scFails(sideIn({ botsOn: false, buttons: [b("sound", 135), b("map", 199), b("dress", 263)] })), []); // 봇 도구가 꺼진 방
  assert.deepEqual(scFails(sideIn({ mapsOn: false, buttons: [b("sound", 135), b("bots", 199), b("dress", 263)] })), []);
  assert.ok(scFails(sideIn({ buttons: [b("sound", 135), b("bots", 199), b("map", 263), b("dress", 327)] })).includes("SC3")); // 순서
  assert.ok(scFails(sideIn({ buttons: [b("map", 135), b("bots", 199), b("dress", 263)] })).includes("SC3")); // 소리 없음
  assert.ok(scFails(sideIn({ screen: "game", host: false, buttons: [b("sound", 135), b("dress", 199)] })).includes("SC3")); // 게임 화면에 옷장
});

test("SC3: 두 열이면 오른쪽 열부터 위에서 아래로 읽는다 — 소리·맵 | 봇·옷장 통과, 열이 뒤집히면 실패", () => {
  const cell = (side, top, left) => ({ side, rect: rect(left, top, 52, 52) });
  const ok = [cell("sound", 135, 292), cell("map", 199, 292), cell("bots", 135, 228), cell("dress", 199, 228)];
  assert.deepEqual(scFails(sideIn({ buttons: ok })), []);
  const flipped = [cell("sound", 135, 292), cell("map", 199, 292), cell("bots", 135, 228), cell("dress", 199, 228)].map((x) => (x.side === "bots" ? cell("bots", 199, 228) : x.side === "dress" ? cell("dress", 135, 228) : x));
  assert.ok(scFails(sideIn({ buttons: flipped })).includes("SC3"));
});

test("SC4: 머리에는 44 정사각 단추 둘뿐 — 개수·크기가 틀리면 실패, 결과 화면처럼 하나(expectHead 1)도 통과", () => {
  assert.ok(scFails(sideIn({ head: [{ kind: "leave", rect: rect(16, 8, 44, 44) }] })).includes("SC4"));
  assert.ok(scFails(sideIn({ head: [{ kind: "leave", rect: rect(16, 8, 44, 59.6) }, { kind: "share", rect: rect(300, 8, 44, 44) }] })).includes("SC4"));
  assert.ok(scFails(sideIn({ head: [{ kind: "leave", rect: rect(16, 8, 44, 44) }, { kind: "share", rect: rect(300, 8, 44, 44) }, { kind: "x", rect: rect(100, 8, 44, 44) }] })).includes("SC4"));
  assert.deepEqual(scFails(sideIn({ head: [{ kind: "leave", rect: rect(16, 8, 44, 44) }], expectHead: 1 })), []);
});

test("SC5: 열 윗변 = 띠 아랫변 + 12 (±2), 오른쪽 여백 16 (±1)", () => {
  const shifted = (dy, dx = 0) => sideIn({ buttons: sideIn().buttons.map((x) => ({ ...x, rect: rect(x.rect.left + dx, x.rect.top + dy, 52, 52) })) });
  assert.ok(!scFails(shifted(2)).includes("SC5"));
  assert.ok(scFails(shifted(2.01)).includes("SC5"));
  assert.ok(scFails(shifted(-2.01)).includes("SC5"));
  assert.ok(!scFails(shifted(0, 1)).includes("SC5"));
  assert.ok(scFails(shifted(0, 1.01)).includes("SC5"));
  assert.ok(scFails(sideIn({ band: null })).includes("SC5")); // 기준이 없으면 실패
});

test("SC6: 열 안 간격 12(±1), 열 사이 12(±1), 첫 열 두 칸 이상", () => {
  const b = (side, top, left = 292) => ({ side, rect: rect(left, top, 52, 52) });
  assert.ok(scFails(sideIn({ buttons: [b("sound", 135), b("map", 195), b("bots", 259), b("dress", 323)] })).includes("SC6")); // 소리·맵 간격 8
  assert.ok(!scFails(sideIn({ buttons: [b("sound", 135), b("map", 198), b("bots", 261), b("dress", 324)] })).includes("SC6")); // 간격 11
  assert.ok(scFails(sideIn({ buttons: [b("sound", 135), b("map", 199), b("bots", 135, 220), b("dress", 199, 220)] })).includes("SC6")); // 열 사이 20
  assert.ok(scFails(sideIn({ buttons: [b("sound", 135), b("map", 135, 228), b("bots", 199, 228), b("dress", 263, 228)] })).includes("SC6")); // 첫 열 한 칸
});

test("sideColumnChecks: 빠진 입력은 전부 측정값 없음으로 실패한다(공허 통과 금지)", () => {
  for (const args of [{}, sideIn({ buttons: [] }), sideIn({ viewport: null }), sideIn({ screen: "map" }), sideIn({ head: null })]) {
    const lines = sideColumnChecks(args);
    assert.equal(lines.length, 6);
    assert.ok(lines.every((l) => !l.ok && /측정값 없음/.test(l.detail)));
  }
});

// ---- 17-09 튜토리얼 E2E 판정 (tutorialEntryChecks·sentFrameChecks, 사본 상수) ----

test("튜토리얼 사본 상수: 점 7·램프 2·오답 도움 2 (앱 src/game/tutorialScript.ts 와 e2eContract 가 대조)", () => {
  assert.equal(TUTORIAL_DOT_COUNT, 7);
  assert.equal(OPENING_LAMPS, 2);
  assert.equal(WRONG_HINT_AFTER, 2);
});

const TV = { w: 390, h: 844 };
const entryIn = (over = {}) => ({
  entry: { cards: 1, buttons: 0, rect: RR(20, 300, 350, 84) },
  field: RR(20, 400, 350, 56),
  create: RR(20, 470, 350, 52),
  viewport: TV,
  ...over,
});
const teFails = (args, opts) => tutorialEntryChecks(args, opts).filter((l) => !l.ok).map((l) => l.id);

test("tutorialEntryChecks: 카드 1개·화면 안·방 코드 칸·[방 만들기] 와 교차 0 이면 통과한다", () => {
  const lines = tutorialEntryChecks(entryIn());
  assert.ok(lines.length >= 3);
  assert.ok(lines.every((l) => l.ok), JSON.stringify(lines));
  for (const l of lines) assert.ok(typeof l.id === "string" && typeof l.label === "string" && typeof l.detail === "string");
});

test("tutorialEntryChecks: 카드가 [방 만들기] 와 1px 이라도 겹치면 실패한다, 맞닿기만 하면 통과한다", () => {
  assert.deepEqual(teFails(entryIn({ entry: { cards: 1, buttons: 0, rect: RR(20, 300, 350, 84) }, field: RR(20, 384, 350, 56), create: RR(20, 450, 350, 52) })), []);
  assert.ok(teFails(entryIn({ create: RR(20, 383, 350, 52), field: RR(20, 450, 350, 56) })).length > 0);
  assert.ok(teFails(entryIn({ create: RR(20, 370, 350, 52), field: RR(20, 450, 350, 56) })).length > 0);
  assert.ok(teFails(entryIn({ field: RR(20, 370, 350, 56) })).length > 0);
});

test("tutorialEntryChecks: 카드·단추 개수는 기대 종류 하나뿐이어야 한다(card ↔ button)", () => {
  assert.ok(teFails(entryIn({ entry: { cards: 2, buttons: 0, rect: RR(20, 300, 350, 84) } })).length > 0);
  assert.ok(teFails(entryIn({ entry: { cards: 0, buttons: 0, rect: null } })).length > 0);
  assert.ok(teFails(entryIn({ entry: { cards: 1, buttons: 1, rect: RR(20, 300, 350, 84) } })).length > 0);
  // 한 번 본 뒤: 작은 단추 1개, 카드 0
  const btn = { entry: { cards: 0, buttons: 1, rect: RR(20, 300, 350, 44) } };
  assert.deepEqual(teFails(entryIn(btn), { kind: "button" }), []);
  assert.ok(teFails(entryIn(btn), { kind: "card" }).length > 0);
  assert.ok(teFails(entryIn({ entry: { cards: 1, buttons: 0, rect: RR(20, 300, 350, 84) } }), { kind: "button" }).length > 0);
});

test("tutorialEntryChecks: 화면 밖으로 나간 카드는 실패하고 측정값이 없으면 공허 통과하지 않는다", () => {
  assert.ok(teFails(entryIn({ entry: { cards: 1, buttons: 0, rect: RR(-3, 300, 350, 84) } })).length > 0);
  assert.ok(teFails(entryIn({ entry: { cards: 1, buttons: 0, rect: RR(20, 300, 380, 84) } })).length > 0);
  for (const args of [entryIn({ field: null }), entryIn({ create: null }), entryIn({ viewport: null }), entryIn({ entry: { cards: 1, buttons: 0, rect: null } })]) {
    const lines = tutorialEntryChecks(args);
    assert.ok(lines.some((l) => !l.ok && /측정값 없음/.test(l.detail)), JSON.stringify(lines));
  }
});

test("sentFrameChecks: 허용 목록 밖 t 가 하나라도 있으면 실패하고 ping 은 늘 허용한다", () => {
  assert.equal(sentFrameChecks([], []).ok, true);
  assert.equal(sentFrameChecks(["ping", "ping"], []).ok, true);
  assert.equal(sentFrameChecks(["ping", "tutorialDone"], ["tutorialDone"]).ok, true);
  const bad = sentFrameChecks(["ping", "move", "move", "tutorialDone"], ["tutorialDone"]);
  assert.equal(bad.ok, false);
  assert.match(bad.detail, /move/);
  assert.doesNotMatch(bad.detail, /tutorialDone/);
  assert.equal(sentFrameChecks(["hello"], ["tutorialDone"]).ok, false);
  assert.equal(sentFrameChecks(["hello"], ["tutorialDone", "hello"]).ok, true);
});

test("sentFrameChecks: once 로 준 종류는 정확히 그 횟수만 보내야 한다(끝났음은 한 번)", () => {
  assert.equal(sentFrameChecks(["ping", "tutorialDone"], ["tutorialDone"], { once: ["tutorialDone"] }).ok, true);
  const twice = sentFrameChecks(["tutorialDone", "tutorialDone"], ["tutorialDone"], { once: ["tutorialDone"] });
  assert.equal(twice.ok, false);
  assert.match(twice.detail, /tutorialDone/);
  assert.equal(sentFrameChecks(["ping"], ["tutorialDone"], { once: ["tutorialDone"] }).ok, false);
  assert.equal(sentFrameChecks(null, []).ok, false); // 측정값 없음
  assert.match(sentFrameChecks(null, []).detail, /측정값 없음/);
});

// ---- 17-09 Task 2: 장면 판정 (포커스·띠·누설·공개·직업 카드·오프닝·시각) ----

const tutTgt = (key, l, t, w, h) => ({ key, rect: RR(l, t, w, h) });
const tutBoxAround = (key, l, t, w, h, pad = 8) => ({ key, rect: RR(l - pad, t - pad, w + pad * 2, h + pad * 2) });
const tutTfFails = (boxes, targets, vp = TV) => tutorialFocusChecks(boxes, targets, vp).filter((l) => !l.ok).map((l) => l.id);

test("tutorialFocusChecks: 상자마다 대상 사각형 ± 8(오차 2) 이면 통과한다", () => {
  const targets = [tutTgt("errand", 100, 300, 120, 60)];
  const lines = tutorialFocusChecks([tutBoxAround("errand", 100, 300, 120, 60)], targets, TV);
  assert.ok(lines.length >= 2 && lines.every((l) => l.ok), JSON.stringify(lines));
  assert.deepEqual(tutTfFails([{ key: "errand", rect: RR(100 - 8 + 2, 300 - 8, 120 + 16, 60 + 16) }], targets), []); // 오차 2 경계
  assert.ok(tutTfFails([{ key: "errand", rect: RR(100 - 8 + 2.5, 300 - 8, 120 + 16, 60 + 16) }], targets).length > 0);
  assert.ok(tutTfFails([{ key: "errand", rect: RR(100 - 8, 300 - 8, 120 + 16 + 3, 60 + 16) }], targets).length > 0);
  assert.ok(tutTfFails([{ key: "errand", rect: RR(100 - 8, 300 - 8 - 3, 120 + 16, 60 + 16) }], targets).length > 0);
});

test("tutorialFocusChecks: 화면 안쪽 8 로 밀린 상자는 크기를 그대로 두고 안으로 민 자리면 통과한다", () => {
  // 대상이 왼쪽 가장자리(left 4)면 상자는 left -4 가 아니라 8 로 밀린다
  const targets = [tutTgt("band", 4, 70, 380, 56)];
  assert.deepEqual(tutTfFails([{ key: "band", rect: RR(8, 62, 396, 72) }], targets, { w: 412, h: 844 }), []);
  assert.ok(tutTfFails([{ key: "band", rect: RR(-4, 62, 396, 72) }], targets, { w: 412, h: 844 }).length > 0); // 안 밀린 상자는 화면 밖
  // 아래 가장자리
  const low = [tutTgt("errand", 100, 800, 120, 40)];
  assert.deepEqual(tutTfFails([{ key: "errand", rect: RR(92, 844 - 8 - 56, 136, 56) }], low), []);
});

test("tutorialFocusChecks: 개수·키가 기대와 다르면 실패한다(0개 기대에 상자가 있어도 실패)", () => {
  const four = ["pick-0", "pick-1", "pick-3", "pick-4"].map((k, i) => tutTgt(k, 20 + i * 80, 400, 70, 40));
  const boxes = four.map((t) => tutBoxAround(t.key, t.rect.left, t.rect.top, t.rect.width, t.rect.height));
  assert.deepEqual(tutTfFails(boxes, four), []);
  assert.ok(tutTfFails(boxes.slice(0, 3), four).length > 0);
  assert.ok(tutTfFails([...boxes, tutBoxAround("band", 20, 70, 300, 56)], four).length > 0);
  assert.ok(tutTfFails([{ ...boxes[0], key: "pick-2" }, ...boxes.slice(1)], four).length > 0);
  assert.deepEqual(tutTfFails([], []), []);
  assert.ok(tutTfFails([tutBoxAround("band", 20, 70, 300, 56)], []).length > 0);
  const missing = tutorialFocusChecks(null, four, TV);
  assert.ok(missing.some((l) => !l.ok && /측정값 없음/.test(l.detail)));
  assert.ok(tutorialFocusChecks(boxes, null, TV).some((l) => !l.ok && /측정값 없음/.test(l.detail)));
});

const tutBandOk = (over = {}) => ({ rect: RR(16, 70, 358, 56), bars: 5, barsMoving: 5, speaking: true, text: "x", fontMin: 16, timers: 0, ...over });
const tutOthersOk = (over = {}) => ({ header: RR(0, 0, 390, 60), dock: RR(322, 134, 52, 52), next: RR(314, 760, 56, 56), targets: [tutTgt("errand", 100, 400, 100, 50)], ...over });
const tutTbFails = (band, others, opts) => tutorialBandChecks(band, others, opts).filter((l) => !l.ok).map((l) => l.id);

test("tutorialBandChecks: 막대 5개·머리·소리 독·[다음]·포커스 대상과 교차 0·글자 14 이상·시간 행 0 이면 통과한다", () => {
  const lines = tutorialBandChecks(tutBandOk(), tutOthersOk(), { speaking: true });
  assert.ok(lines.length >= 5 && lines.every((l) => l.ok), JSON.stringify(lines));
});

test("tutorialBandChecks: 막대가 5개가 아니거나 말하는 동안 움직이지 않으면 실패한다, 말이 끝났으면 speaking 이 거짓이어야 한다", () => {
  assert.ok(tutTbFails(tutBandOk({ bars: 4 }), tutOthersOk()).length > 0);
  assert.ok(tutTbFails(tutBandOk({ barsMoving: 3 }), tutOthersOk(), { speaking: true }).length > 0);
  assert.ok(tutTbFails(tutBandOk({ speaking: false, barsMoving: 0 }), tutOthersOk(), { speaking: true }).length > 0);
  assert.deepEqual(tutTbFails(tutBandOk({ speaking: false, barsMoving: 0 }), tutOthersOk(), { speaking: false }), []);
  assert.ok(tutTbFails(tutBandOk({ speaking: true }), tutOthersOk(), { speaking: false }).length > 0);
  // 모션 줄이기: 막대가 움직이지 않아도 말하는 동안 data-speaking 만 참이면 된다
  assert.deepEqual(tutTbFails(tutBandOk({ barsMoving: 0 }), tutOthersOk(), { speaking: true, reduced: true }), []);
});

test("tutorialBandChecks: 띠가 머리·소리 독·[다음]·포커스 대상 어느 하나와 겹치면 실패한다", () => {
  assert.ok(tutTbFails(tutBandOk({ rect: RR(16, 50, 358, 56) }), tutOthersOk()).length > 0); // 머리(0~60)와 겹침
  assert.ok(tutTbFails(tutBandOk({ rect: RR(16, 130, 358, 56) }), tutOthersOk()).length > 0); // 소리 독(134~186)과 겹침
  assert.ok(tutTbFails(tutBandOk({ rect: RR(16, 740, 358, 56) }), tutOthersOk()).length > 0); // [다음] 과 겹침
  assert.ok(tutTbFails(tutBandOk({ rect: RR(16, 380, 358, 56) }), tutOthersOk()).length > 0); // 포커스 대상과 겹침
  assert.deepEqual(tutTbFails(tutBandOk({ rect: RR(16, 60, 358, 56) }), tutOthersOk()), []); // 머리와 맞닿기만
  assert.deepEqual(tutTbFails(tutBandOk(), tutOthersOk({ header: null, dock: null, next: null, targets: [] })), []); // 없는 것은 비교하지 않는다
});

test("tutorialBandChecks: 글자 14 미만·시간 행이 있으면 실패하고 값이 없으면 공허 통과하지 않는다", () => {
  assert.ok(tutTbFails(tutBandOk({ fontMin: 13.9 }), tutOthersOk()).length > 0);
  assert.deepEqual(tutTbFails(tutBandOk({ fontMin: 14 }), tutOthersOk()), []);
  assert.ok(tutTbFails(tutBandOk({ timers: 1 }), tutOthersOk()).length > 0);
  for (const bad of [null, tutBandOk({ rect: null }), tutBandOk({ fontMin: null }), tutBandOk({ bars: undefined })]) assert.ok(tutorialBandChecks(bad, tutOthersOk()).some((l) => !l.ok && /측정값 없음/.test(l.detail)), JSON.stringify(bad));
  assert.ok(tutorialBandChecks(tutBandOk(), null).some((l) => !l.ok && /측정값 없음/.test(l.detail)));
});

test("tutorialLeakChecks: 가짜 이름 다섯·직업 카드·튜토리얼 중 me.role 이 어디에도 없으면 통과한다", () => {
  assert.deepEqual(TUTORIAL_CAST_E2E.names, ["서연", "도윤", "민준", "지호", "하린"]);
  const dom = [{ where: "lobby", names: [], roleCards: 0 }, { where: "roleReveal", names: [], roleCards: 0 }];
  const lines = tutorialLeakChecks({ dom, frames: { hits: {} }, roleInTutorial: 0 });
  assert.ok(lines.length === 3 && lines.every((l) => l.ok), JSON.stringify(lines));
});

test("tutorialLeakChecks: 화면 DOM 이나 받은 프레임에 가짜 이름이 나오거나 직업 카드가 있거나 me.role 이 있으면 실패한다", () => {
  const clean = [{ where: "lobby", names: [], roleCards: 0 }];
  const fails = (a) => tutorialLeakChecks(a).filter((l) => !l.ok).map((l) => l.id);
  assert.deepEqual(fails({ dom: clean, frames: { hits: {} }, roleInTutorial: 0 }), []);
  const dirty = fails({ dom: [{ where: "roleReveal", names: ["도윤"], roleCards: 0 }], frames: { hits: {} }, roleInTutorial: 0 });
  assert.equal(dirty.length, 1);
  assert.ok(fails({ dom: [{ where: "lobby", names: [], roleCards: 1 }], frames: { hits: {} }, roleInTutorial: 0 }).length === 1);
  assert.ok(fails({ dom: clean, frames: { hits: { 하린: 2 } }, roleInTutorial: 0 }).length === 1);
  assert.ok(fails({ dom: clean, frames: { hits: {} }, roleInTutorial: 1 }).length === 1);
  const detail = tutorialLeakChecks({ dom: [{ where: "roleReveal", names: ["도윤"], roleCards: 0 }], frames: { hits: {} }, roleInTutorial: 0 }).find((l) => !l.ok).detail;
  assert.match(detail, /roleReveal/);
  assert.ok(tutorialLeakChecks({ dom: [], frames: { hits: {} }, roleInTutorial: 0 }).some((l) => !l.ok && /측정값 없음/.test(l.detail)));
  assert.ok(tutorialLeakChecks({ dom: clean, frames: null, roleInTutorial: 0 }).some((l) => !l.ok && /측정값 없음/.test(l.detail)));
  assert.ok(tutorialLeakChecks({ dom: clean, frames: { hits: {} }, roleInTutorial: null }).some((l) => !l.ok && /측정값 없음/.test(l.detail)));
});

const tutRevealIn = (over = {}) => ({
  reveal: { card: RR(123, 170, 144, 280), stamp: RR(150, 300, 90, 40), line: RR(60, 470, 270, 36) },
  next: RR(314, 760, 56, 56),
  viewport: TV,
  ...over,
});
const tutTrFails = (a) => tutorialRevealChecks(a).filter((l) => !l.ok).map((l) => l.id);

test("tutorialRevealChecks: 카드·도장·줄·[다음] 이 화면 안에 있고 서로 교차하지 않으면 통과한다(도장은 카드 안에 놓인다)", () => {
  assert.deepEqual(tutTrFails(tutRevealIn()), []);
  assert.ok(tutorialRevealChecks(tutRevealIn()).length >= 2);
});

test("tutorialRevealChecks: [다음] 이 카드·줄·도장과 겹치거나 화면 밖이면 실패한다", () => {
  assert.ok(tutTrFails(tutRevealIn({ next: RR(200, 440, 56, 56) })).length > 0); // 카드와 겹침
  assert.ok(tutTrFails(tutRevealIn({ next: RR(300, 480, 56, 56) })).length > 0); // 줄과 겹침
  assert.ok(tutTrFails(tutRevealIn({ reveal: { card: RR(123, 170, 144, 280), stamp: RR(150, 300, 90, 40), line: RR(60, 440, 270, 36) } })).length > 0); // 줄이 카드와 겹침
  assert.ok(tutTrFails(tutRevealIn({ reveal: { card: RR(123, 170, 144, 280), stamp: RR(150, 440, 90, 60), line: RR(60, 470, 270, 36) } })).length > 0); // 도장이 줄과 겹침
  assert.ok(tutTrFails(tutRevealIn({ reveal: { card: RR(123, 170, 144, 280), stamp: RR(150, 300, 90, 40), line: RR(-10, 470, 270, 36) } })).length > 0); // 줄이 화면 밖
  assert.ok(tutTrFails(tutRevealIn({ viewport: { w: 390, h: 480 } })).length > 0); // 줄이 화면 아래 밖
});

test("tutorialRevealChecks: 측정값이 없으면 공허 통과하지 않는다", () => {
  for (const a of [tutRevealIn({ reveal: null }), tutRevealIn({ next: null }), tutRevealIn({ viewport: null }), tutRevealIn({ reveal: { card: null, stamp: RR(1, 1, 1, 1), line: RR(1, 1, 1, 1) } })]) {
    assert.ok(tutorialRevealChecks(a).some((l) => !l.ok && /측정값 없음/.test(l.detail)), JSON.stringify(a));
  }
});

const tutRoleCards = (over = {}) => ["citizen", "mafia", "doctor", "police"].map((kind, i) => ({ kind, rect: RR(20 + (i % 2) * 180, 120 + Math.floor(i / 2) * 250, 170, 240), ...(over[kind] ?? {}) }));
const tutRcFails = (roles, next = RR(314, 760, 56, 56), vp = TV) => tutorialRoleCardChecks({ roles, next, viewport: vp }).filter((l) => !l.ok).map((l) => l.id);

test("tutorialRoleCardChecks: 네 직업 카드가 한 장씩·화면 안·서로·[다음] 과 교차 0 이면 통과한다", () => {
  assert.deepEqual(tutRcFails(tutRoleCards()), []);
  assert.equal(tutorialRoleCardChecks({ roles: tutRoleCards(), next: RR(314, 760, 56, 56), viewport: TV }).map((l) => l.id).join(","), "TC1,TC2,TC3,TC4");
});

test("tutorialRoleCardChecks: 카드 종류·개수·화면 밖·서로 겹침·[다음] 겹침을 각각 자기 id 로 실패시킨다", () => {
  assert.deepEqual(tutRcFails(tutRoleCards().slice(0, 3)), ["TC1"]);
  assert.deepEqual(tutRcFails([...tutRoleCards(), tutRoleCards()[0]]), ["TC1"]);
  assert.deepEqual(tutRcFails(tutRoleCards({ mafia: { rect: RR(370, 120, 170, 240) } })), ["TC2"]);
  assert.deepEqual(tutRcFails(tutRoleCards({ mafia: { rect: RR(150, 130, 170, 240) } })), ["TC3"]);
  assert.deepEqual(tutRcFails(tutRoleCards(), RR(300, 500, 56, 56)), ["TC4"]);
  assert.ok(tutorialRoleCardChecks({ roles: null, next: null, viewport: TV }).every((l) => !l.ok && /측정값 없음/.test(l.detail)));
});

test("tutorialOpeningChecks: 램프 번짐 2·번쩍임 1·소리 링 3 이고 모션 줄이기에서는 모두 0 이며 어둠이 정지한다", () => {
  const normal = { present: true, lamps: 2, flash: 1, rings: 3, still: false };
  assert.ok(tutorialOpeningChecks(normal).every((l) => l.ok));
  assert.ok(tutorialOpeningChecks({ ...normal, lamps: 1 }).some((l) => !l.ok));
  assert.ok(tutorialOpeningChecks({ ...normal, flash: 2 }).some((l) => !l.ok));
  assert.ok(tutorialOpeningChecks({ ...normal, rings: 2 }).some((l) => !l.ok));
  const reduced = { present: true, lamps: 0, flash: 0, rings: 0, still: true };
  assert.ok(tutorialOpeningChecks(reduced, { reduced: true }).every((l) => l.ok));
  assert.ok(tutorialOpeningChecks({ ...reduced, flash: 1 }, { reduced: true }).some((l) => !l.ok));
  assert.ok(tutorialOpeningChecks({ ...reduced, still: false }, { reduced: true }).some((l) => !l.ok));
  assert.ok(tutorialOpeningChecks(normal, { reduced: true }).some((l) => !l.ok));
  assert.ok(tutorialOpeningChecks({ ...normal, present: false }).some((l) => !l.ok && /측정값 없음/.test(l.detail)));
  assert.ok(tutorialOpeningChecks(null).some((l) => !l.ok && /측정값 없음/.test(l.detail)));
});

test("tutorialTimingChecks: 오프닝 4.6초 ± 1.0초, [처리] 뒤 0.7초 ± 0.5초 이고 경계는 통과한다", () => {
  assert.equal(TUTORIAL_OPENING_MS, 4600);
  assert.equal(TUTORIAL_ERRAND_MS, 700);
  const ok = (o, e) => tutorialTimingChecks({ openingMs: o, errandMs: e }).every((l) => l.ok);
  assert.ok(ok(4600, 700));
  assert.ok(ok(3600, 200));
  assert.ok(ok(5600, 1200));
  assert.ok(!ok(3599, 700));
  assert.ok(!ok(5601, 700));
  assert.ok(!ok(4600, 199));
  assert.ok(!ok(4600, 1201));
  assert.ok(tutorialTimingChecks({ openingMs: 4600, errandMs: null }).some((l) => !l.ok && /측정값 없음/.test(l.detail)));
  assert.ok(tutorialTimingChecks({ openingMs: 4600 }).filter((l) => l.id === "TM1").every((l) => l.ok)); // 한쪽만 줘도 그쪽만 판정한다
  assert.equal(tutorialTimingChecks({ openingMs: 4600 }).length, 1);
});

test("tutorialDotChecks: 점 7개이고 지금 점이 장면 번호와 같다", () => {
  assert.ok(tutorialDotChecks({ count: 7, now: 3 }, 3).every((l) => l.ok));
  assert.ok(tutorialDotChecks({ count: 6, now: 3 }, 3).some((l) => !l.ok));
  assert.ok(tutorialDotChecks({ count: 7, now: 2 }, 3).some((l) => !l.ok));
  assert.ok(tutorialDotChecks(null, 3).some((l) => !l.ok && /측정값 없음/.test(l.detail)));
});

test("tutorialSkipChecks: [건너뛰기] 의 누르는 영역이 44×44 이상이고 화면 안이다(알약 32 + 투명 확장)", () => {
  const skip = { rect: RR(300, 12, 76, 32), hit: RR(298, 6, 80, 44) };
  assert.ok(tutorialSkipChecks({ skip, viewport: TV }).every((l) => l.ok));
  assert.ok(tutorialSkipChecks({ skip: { rect: skip.rect, hit: RR(298, 6, 80, 43) }, viewport: TV }).some((l) => !l.ok));
  assert.ok(tutorialSkipChecks({ skip: { rect: skip.rect, hit: RR(298, 6, 43, 44) }, viewport: TV }).some((l) => !l.ok));
  assert.ok(tutorialSkipChecks({ skip: { rect: RR(350, 12, 76, 32), hit: RR(348, 6, 80, 44) }, viewport: TV }).some((l) => !l.ok));
  assert.ok(tutorialSkipChecks({ skip: null, viewport: TV }).some((l) => !l.ok && /측정값 없음/.test(l.detail)));
});

test("tutorialEvidenceChecks: 장면 4 는 눈 1·기록 한 줄, 장면 5 는 증거 카드·선 2·수식 줄이고 수식 줄이 [다음] 과 겹치지 않는다", () => {
  const s4 = { eye: 1, recordRows: 1, traceCard: null, links: 0, formula: null };
  assert.ok(tutorialEvidenceChecks(s4, { scene: 4 }).every((l) => l.ok));
  assert.ok(tutorialEvidenceChecks({ ...s4, eye: 0 }, { scene: 4 }).some((l) => !l.ok));
  assert.ok(tutorialEvidenceChecks({ ...s4, recordRows: 2 }, { scene: 4 }).some((l) => !l.ok));
  const s5 = { eye: 0, recordRows: 0, traceCard: RR(16, 130, 358, 120), links: 2, formula: RR(60, 700, 260, 48) };
  assert.ok(tutorialEvidenceChecks(s5, { scene: 5, next: RR(314, 760, 56, 56) }).every((l) => l.ok));
  assert.ok(tutorialEvidenceChecks({ ...s5, links: 1 }, { scene: 5, next: RR(314, 760, 56, 56) }).some((l) => !l.ok));
  assert.ok(tutorialEvidenceChecks({ ...s5, traceCard: null }, { scene: 5, next: RR(314, 760, 56, 56) }).some((l) => !l.ok));
  assert.ok(tutorialEvidenceChecks({ ...s5, formula: RR(280, 740, 100, 48) }, { scene: 5, next: RR(314, 760, 56, 56) }).some((l) => !l.ok));
  assert.ok(tutorialEvidenceChecks(null, { scene: 5, next: null }).some((l) => !l.ok && /측정값 없음/.test(l.detail)));
});

test("tutorialEntryChecks kind end: 마무리 카드 1개·진입 카드·단추 0개이고 방 코드 칸·[방 만들기] 와 교차 0", () => {
  const end = { entry: { cards: 0, buttons: 0, ends: 1, rect: RR(20, 300, 350, 84) } };
  assert.deepEqual(teFails(entryIn(end), { kind: "end" }), []);
  assert.ok(teFails(entryIn({ entry: { cards: 0, buttons: 0, ends: 0, rect: null } }), { kind: "end" }).length > 0);
  assert.ok(teFails(entryIn({ entry: { cards: 1, buttons: 0, ends: 1, rect: RR(20, 300, 350, 84) } }), { kind: "end" }).length > 0);
  assert.ok(teFails(entryIn(end), { kind: "card" }).length > 0); // 카드 기대에 카드가 없음
  assert.ok(teFails(entryIn({ entry: { cards: 1, buttons: 0, ends: 1, rect: RR(20, 300, 350, 84) } }), { kind: "card" }).length > 0); // 카드와 마무리 카드가 함께 있으면 실패
  assert.ok(teFails(entryIn({ ...end, create: RR(20, 370, 350, 52), field: RR(20, 450, 350, 56) }), { kind: "end" }).length > 0);
});

test("tutorialLineChecks EV6~EV8: 장면 5 선 두 개의 끝과 도윤 이름표가 화면 안쪽 8 안이고 증거 카드·띠·수식 줄·[다음] 과 교차 0", () => {
  const vp = { w: 390, h: 844 };
  const ev = {
    traceCard: RR(16, 130, 358, 120),
    formula: RR(95, 700, 200, 44),
    lines: [
      { from: [60, 300], to: [200, 420] },
      { from: [80, 320], to: [230, 420] },
    ],
    suspectTag: RR(170, 424, 90, 40),
  };
  const opts = { viewport: vp, band: { rect: RR(16, 70, 358, 52) }, next: RR(75, 760, 240, 56) };
  const run = (e, o = opts) => tutorialLineChecks(e, o);
  const by = (lines, id) => lines.find((l) => l.id === id);
  const good = run(ev);
  assert.deepEqual(good.map((l) => l.id), ["EV6", "EV7", "EV8"]);
  assert.ok(good.every((l) => l.ok));
  // 선 하나의 끝이 화면 밖
  const out = run({ ...ev, lines: [ev.lines[0], { from: [80, 320], to: [395, 40] }] });
  assert.equal(by(out, "EV6").ok, false);
  assert.ok(/395/.test(by(out, "EV6").detail));
  assert.equal(by(out, "EV7").ok, true);
  // 안쪽 8 안이 아닌 곳(왼쪽 5)
  assert.equal(by(run({ ...ev, lines: [{ from: [5, 300], to: [200, 420] }, ev.lines[1]] }), "EV6").ok, false);
  // 이름표가 오른쪽 밖
  const wide = run({ ...ev, suspectTag: RR(350, 424, 90, 40) });
  assert.equal(by(wide, "EV7").ok, false);
  assert.equal(by(wide, "EV6").ok, true);
  // 이름표가 증거 카드·띠·수식 줄·[다음] 과 겹침
  const onCard = run({ ...ev, suspectTag: RR(170, 200, 90, 40) });
  assert.equal(by(onCard, "EV8").ok, false);
  assert.ok(/증거 카드/.test(by(onCard, "EV8").detail));
  assert.ok(/사회자 띠/.test(by(run({ ...ev, suspectTag: RR(170, 90, 90, 40) }), "EV8").detail));
  assert.ok(/수식 줄/.test(by(run({ ...ev, suspectTag: RR(170, 690, 90, 40) }), "EV8").detail));
  assert.ok(/\[다음\]/.test(by(run({ ...ev, suspectTag: RR(170, 770, 90, 40) }), "EV8").detail));
  // 선이 1개이거나 이름표 사각형이 null 이면 세 줄 모두 측정 못 함
  for (const bad of [{ ...ev, lines: [ev.lines[0]] }, { ...ev, suspectTag: null }, null]) {
    const r = run(bad);
    assert.equal(r.length, 3);
    assert.ok(r.every((l) => !l.ok && /측정값 없음/.test(l.detail)));
  }
});

test("tutorialDimChecks TD1~TD3: 막 개수·구멍이 포커스 상자를 덮음(2px)·흐림 없음", () => {
  const focus = [{ key: "band", rect: RR(16, 70, 358, 52) }];
  const dim = { count: 1, holes: [RR(17, 70, 358, 53)], backdrop: "none", filter: "none" };
  const by = (lines, id) => lines.find((l) => l.id === id);
  const good = tutorialDimChecks(dim, { expect: 1, focus });
  assert.equal(good.map((l) => l.id).join(","), "TD1,TD2,TD3");
  assert.ok(good.every((l) => l.ok));
  assert.equal(by(tutorialDimChecks({ ...dim, holes: [RR(19, 70, 358, 52)] }, { expect: 1, focus }), "TD2").ok, false); // 구멍 중심 3px 어긋남
  assert.equal(by(tutorialDimChecks({ ...dim, holes: [] }, { expect: 1, focus }), "TD2").ok, false);
  assert.equal(by(tutorialDimChecks({ ...dim, holes: [RR(60, 400, 40, 40), RR(17, 70, 358, 53)] }, { expect: 1, focus }), "TD2").ok, true); // 여분 구멍(lit)은 괜찮다
  const none = tutorialDimChecks({ count: 0, holes: [], backdrop: null, filter: null }, { expect: 0, focus: [] });
  assert.equal(none.length, 1);
  assert.ok(none.every((l) => l.ok));
  assert.equal(by(tutorialDimChecks(dim, { expect: 0, focus: [] }), "TD1").ok, false); // 0 기대인데 막 1개
  assert.equal(by(tutorialDimChecks({ ...dim, count: 0, holes: [] }, { expect: 1, focus }), "TD1").ok, false);
  assert.equal(by(tutorialDimChecks({ ...dim, backdrop: "blur(4px)" }, { expect: 1, focus }), "TD3").ok, false);
  assert.equal(by(tutorialDimChecks({ ...dim, filter: "blur(2px)" }, { expect: 1, focus }), "TD3").ok, false);
  assert.ok(tutorialDimChecks(null, { expect: 1, focus }).every((l) => !l.ok && /측정값 없음/.test(l.detail)));
});

test("tutorialNextChecks TN3·TN4: [다음] 알약 폭·높이·가운데·글, 진행 점과 교차 0", () => {
  const by = (lines, id) => lines.find((l) => l.id === id);
  const at390 = RR(75, 760, 240, 56);
  const good = tutorialNextChecks(at390, { viewport: { w: 390, h: 844 }, errandDots: null, label: "다음" });
  assert.equal(good.map((l) => l.id).join(","), "TN3,TN4");
  assert.ok(good.every((l) => l.ok));
  assert.ok(tutorialNextChecks(RR(60, 500, 240, 56), { viewport: { w: 360, h: 640 }, errandDots: null, label: "다음" }).every((l) => l.ok)); // 360 폭에서 240
  assert.equal(by(tutorialNextChecks(RR(60, 500, 200, 56), { viewport: { w: 360, h: 640 }, errandDots: null, label: "다음" }), "TN3").ok, false); // 폭 모자람
  assert.ok(tutorialNextChecks(RR(48, 500, 264, 56), { viewport: { w: 360, h: 640 }, errandDots: null, label: "다음" }).every((l) => l.ok)); // 넉넉한 폭은 괜찮다
  assert.equal(by(tutorialNextChecks(RR(85, 760, 240, 56), { viewport: { w: 390, h: 844 }, errandDots: null, label: "다음" }), "TN3").ok, false); // 중심 10px 어긋남
  assert.equal(by(tutorialNextChecks(RR(75, 760, 240, 58), { viewport: { w: 390, h: 844 }, errandDots: null, label: "다음" }), "TN3").ok, false); // 높이
  assert.equal(by(tutorialNextChecks(at390, { viewport: { w: 390, h: 844 }, errandDots: null, label: "" }), "TN3").ok, false); // 글이 비어 있음
  assert.equal(by(tutorialNextChecks(at390, { viewport: { w: 390, h: 844 }, errandDots: RR(150, 780, 90, 12), label: "다음" }), "TN4").ok, false);
  assert.equal(by(tutorialNextChecks(at390, { viewport: { w: 390, h: 844 }, errandDots: RR(150, 700, 90, 12), label: "다음" }), "TN4").ok, true);
  assert.ok(tutorialNextChecks(null, { viewport: { w: 390, h: 844 }, errandDots: null, label: "다음" }).every((l) => !l.ok && /측정값 없음/.test(l.detail)));
});

test("tutorialHiddenChecks TH1: 아래 패널·[내 역할]·채팅 입력칸이 모두 0", () => {
  assert.ok(tutorialHiddenChecks({ worldPanel: 0, gamePanel: 0, roleBtn: 0, chatInputs: 0 }).every((l) => l.ok));
  assert.equal(tutorialHiddenChecks({ worldPanel: 0, gamePanel: 0, roleBtn: 1, chatInputs: 0 })[0].ok, false);
  assert.equal(tutorialHiddenChecks({ worldPanel: 1, gamePanel: 0, roleBtn: 0, chatInputs: 0 })[0].id, "TH1");
  assert.equal(tutorialHiddenChecks({ worldPanel: 0, gamePanel: 0, roleBtn: 0, chatInputs: 2 })[0].ok, false);
  assert.ok(tutorialHiddenChecks(null).every((l) => !l.ok && /측정값 없음/.test(l.detail)));
});

test("tutorialRoleLineChecks TC5: 직업 카드 한 줄 넷이 사본과 글자 그대로 같다", () => {
  const lines = ["당신은 시민입니다.\n추리로 마피아를 찾아내세요.", "당신은 마피아입니다.\n몰래 암살하여 승리하세요.", "당신은 의사입니다.\n시민 팀을 마피아에게서 지키세요.", "당신은 경찰입니다.\n의심되는 사람을 조사하세요."];
  assert.equal([...TUTORIAL_ROLE_LINES_E2E].join("|"), lines.join("|"));
  const ok = tutorialRoleLineChecks(lines);
  assert.equal(ok.map((l) => l.id).join(","), "TC5");
  assert.ok(ok.every((l) => l.ok));
  assert.equal(tutorialRoleLineChecks([lines[0], lines[1], lines[2] + ".", lines[3]])[0].ok, false);
  assert.equal(tutorialRoleLineChecks([lines[1], lines[0], lines[2], lines[3]])[0].ok, false); // 순서가 다름
  assert.equal(tutorialRoleLineChecks([lines[0].replace("\n", " "), lines[1], lines[2], lines[3]])[0].ok, false); // 줄바꿈이 공백으로 바뀌면 다름
  assert.equal(tutorialRoleLineChecks(lines.slice(0, 3))[0].ok, false);
  assert.ok(tutorialRoleLineChecks(null).every((l) => !l.ok && /측정값 없음/.test(l.detail)));
});


const DRESS_IDS = ["coat", "police", "doctor", "mafia", "detective", "reporter", "elder", "hood", "noir"];
/** 옷장 카드 아홉 장: taken·pressed 로 지정한 id 만 켠다 */
const dressCards = ({ taken = [], pressed = [] }) => DRESS_IDS.map((id) => ({ id, taken: taken.includes(id), disabled: taken.includes(id), pressed: pressed.includes(id) }));

test("dressLockChecks AL1~AL3: 다른 사람이 직접 고른 옷만 잠기고 눌러도 옷이 안 바뀐다", () => {
  const ok = dressLockChecks({ cards: dressCards({ taken: ["mafia"], pressed: ["noir"] }), otherLooks: ["mafia"], myLook: "noir", afterTap: "noir" });
  assert.equal(ok.map((l) => l.id).join(","), "AL1,AL2,AL3");
  assert.ok(ok.every((l) => l.ok), JSON.stringify(ok));
  // 내 옷과 같은 옷을 가진 사람이 있어도(otherLooks 에 내 옷) 내 카드는 잠기지 않는다
  assert.ok(dressLockChecks({ cards: dressCards({ taken: ["mafia"], pressed: ["noir"] }), otherLooks: ["mafia", "noir"], myLook: "noir", afterTap: "noir" }).every((l) => l.ok));
  // 내 look 이 없으면 coat
  assert.ok(dressLockChecks({ cards: dressCards({ taken: ["mafia"], pressed: ["coat"] }), otherLooks: ["mafia"], myLook: "coat", afterTap: "coat" }).every((l) => l.ok));
  // AL1: 남이 안 고른 hood 가 잠김
  const hood = dressLockChecks({ cards: dressCards({ taken: ["mafia", "hood"], pressed: ["noir"] }), otherLooks: ["mafia"], myLook: "noir", afterTap: "noir" });
  assert.equal(hood[0].ok, false);
  assert.match(hood[0].detail, /hood/);
  // AL1: 남이 고른 mafia 가 안 잠김
  const open = dressLockChecks({ cards: dressCards({ taken: [], pressed: ["noir"] }), otherLooks: ["mafia"], myLook: "noir", afterTap: "noir" });
  assert.equal(open[0].ok, false);
  assert.match(open[0].detail, /mafia/);
  // AL2: 잠긴 카드를 눌렀더니 옷이 바뀜
  const moved = dressLockChecks({ cards: dressCards({ taken: ["mafia"], pressed: ["noir"] }), otherLooks: ["mafia"], myLook: "noir", afterTap: "mafia" });
  assert.equal(moved[1].ok, false);
  assert.equal(moved[0].ok, true);
  // AL3: 내 옷 카드가 잠김, 또는 pressed 아님
  const mine = dressLockChecks({ cards: dressCards({ taken: ["mafia", "noir"], pressed: [] }), otherLooks: ["mafia"], myLook: "noir", afterTap: "noir" });
  assert.equal(mine[2].ok, false);
  // AL3: otherLooks 에 없는 coat 가 잠김
  const coat = dressLockChecks({ cards: dressCards({ taken: ["mafia", "coat"], pressed: ["noir"] }), otherLooks: ["mafia"], myLook: "noir", afterTap: "noir" });
  assert.equal(coat[2].ok, false);
  assert.match(coat[2].detail, /coat/);
  // 카드가 9장이 아님 / 입력 없음 → 세 줄 모두 측정 못 함
  for (const bad of [{ cards: dressCards({}).slice(0, 8), otherLooks: [], myLook: "coat", afterTap: "coat" }, null, { cards: dressCards({}), otherLooks: "x", myLook: "coat", afterTap: "coat" }]) {
    const l = dressLockChecks(bad);
    assert.equal(l.length, 3);
    assert.ok(l.every((x) => !x.ok && /측정값 없음/.test(x.detail)));
  }
});

test("outfitUniqueChecks OU1·OU2: 한 판 옷이 모두 다르고 같은 옷 표시는 많아야 1명", () => {
  const six = [{ seat: 0 }, { seat: 1, look: "police" }, { seat: 2, look: "doctor" }, { seat: 3, look: "mafia" }, { seat: 4, look: "detective" }, { seat: 5, look: "reporter" }];
  const ok = outfitUniqueChecks({ players: six, traceSeats: [3] });
  assert.equal(ok.map((l) => l.id).join(","), "OU1,OU2");
  assert.ok(ok.every((l) => l.ok), JSON.stringify(ok));
  assert.ok(outfitUniqueChecks({ players: six, traceSeats: [] }).every((l) => l.ok)); // 표시 0개도 통과(많아야 1)
  // OU1: 좌석 0·1 이 둘 다 look 없음(coat 둘)
  const dup = outfitUniqueChecks({ players: [{ seat: 0 }, { seat: 1 }, ...six.slice(2)], traceSeats: [] });
  assert.equal(dup[0].ok, false);
  assert.match(dup[0].detail, /coat/);
  assert.match(dup[0].detail, /0/);
  assert.match(dup[0].detail, /1/);
  assert.equal(dup[1].ok, true);
  // coat 와 명시한 coat 도 같은 옷
  assert.equal(outfitUniqueChecks({ players: [{ seat: 0 }, { seat: 1, look: "coat" }], traceSeats: [] })[0].ok, false);
  // 나간 사람의 옷은 뺀다
  assert.equal(outfitUniqueChecks({ players: [{ seat: 0 }, { seat: 1, look: "coat", left: true }, { seat: 2, look: "noir" }], traceSeats: [] })[0].ok, true);
  // OU2: 표시 좌석이 둘
  const two = outfitUniqueChecks({ players: six, traceSeats: [1, 4] });
  assert.equal(two[0].ok, true);
  assert.equal(two[1].ok, false);
  assert.match(two[1].detail, /1/);
  // 읽지 못함
  for (const bad of [{ players: null, traceSeats: [] }, { players: six, traceSeats: "x" }, null]) {
    const l = outfitUniqueChecks(bad);
    assert.equal(l.length, 2);
    assert.ok(l.every((x) => !x.ok && /측정값 없음/.test(x.detail)));
  }
});

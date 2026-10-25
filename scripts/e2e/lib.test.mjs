// 화면 E2E 순수 도우미 단위 테스트. 실행: node --test scripts/e2e/lib.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import {
  DECORATIVE_ALLOW,
  FACE_RATIO,
  ONE_LINE_FACTOR,
  PANEL_H,
  OVERLAP_EPS,
  TAP_ALLOW,
  TAP_MIN,
  UsageError,
  chromeCandidates,
  dayChecks,
  exitCodeOf,
  faceRegion,
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
  tagsOverlap,
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
});
const byId = (list, id) => list.find((x) => x.id === id);

test("genericIssues: 이상 없으면 G1~G6 모두 통과", () => {
  const list = genericIssues(cleanSnap(), { w: 360, h: 640 });
  assert.deepEqual(list.map((x) => x.id), ["G1", "G2", "G3", "G4", "G5", "G6"]);
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

/** 이상 없는 낮 장면 고정물(360x640). 자리 1·2 는 서로 떨어져 있다. */
const daySnap = () => ({
  vw: 360,
  vh: 640,
  docW: 360,
  docH: 640,
  bodyW: 360,
  h1: { rect: rect(16, 20, 200, 28.8), lineHeight: 28.8, text: "낮 · 토론" },
  extra: { rect: rect(220, 16, 130, 44), children: [rect(220, 16, 60, 44), rect(290, 16, 60, 44)] },
  scene: rect(0, 100, 360, 383),
  panel: { rect: rect(0, 483, 360, 157), text: "", children: [] },
  tt: { rect: rect(8, 108, 100, 44), hit: true },
  seats: [
    { seat: 0, rect: rect(150, 400, 72, 96), isButton: false, sel: false, pressed: false, reachable: true },
    { seat: 1, rect: rect(20, 200, 72, 96), isButton: false, sel: false, pressed: false, reachable: true },
    { seat: 2, rect: rect(270, 200, 72, 96), isButton: false, sel: false, pressed: false, reachable: true },
  ],
  tags: [
    { seat: 0, rect: rect(150, 440, 72, 36) },
    { seat: 1, rect: rect(20, 300, 72, 36) },
    { seat: 2, rect: rect(270, 300, 72, 36) },
  ],
});
const size = { w: 360, h: 640, mySeat: 0 };
const dayById = (list, id) => list.find((x) => x.id === id);

test("dayChecks: 이상 없는 고정물은 D1~D6·D8 통과", () => {
  const list = dayChecks(daySnap(), size);
  assert.deepEqual(list.map((x) => x.id), ["D1", "D2", "D3", "D4", "D5", "D6", "D8"]);
  assert.ok(list.every((x) => x.ok), JSON.stringify(list.filter((x) => !x.ok)));
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
  s.tags[1].rect = rect(20, 300, 342, 36); // right 362, 장면 right 360 보다 2 큼
  const d2 = dayById(dayChecks(s, size), "D2");
  assert.equal(d2.ok, false);
  assert.match(d2.detail, /1/);
  const s2 = daySnap();
  s2.tags[1].rect = rect(20, 470, 72, 36); // 패널(top 483)과 교차
  assert.equal(dayById(dayChecks(s2, size), "D2").ok, false);
});

test("dayChecks D3: 이름표가 남의 얼굴 위 45% 를 가리면 실패, 아래 55% 만이면 통과, 자기 얼굴은 안 센다", () => {
  const s = daySnap();
  s.tags[1].rect = rect(20, 210, 72, 36); // 자리 1 이름표가 자리 1 자기 얼굴(20,200 상자 위 45%) 위에 있다
  assert.equal(dayById(dayChecks(s, size), "D3").ok, true);
  const s1 = daySnap();
  s1.tags[1].rect = rect(270, 210, 72, 36); // 자리 1 이름표가 자리 2 얼굴(top 200~243.2)과 교차
  const d3 = dayById(dayChecks(s1, size), "D3");
  assert.equal(d3.ok, false);
  assert.match(d3.detail, /1→2/);
  const s2 = daySnap();
  s2.tags[1].rect = rect(270, 260, 72, 30); // 자리 2 상자 아래 55%(243.2~296) 안
  assert.equal(dayById(dayChecks(s2, size), "D3").ok, true);
});

test("dayChecks D4: [테스트] 가 자리 상자와 2px 겹치면 실패, 맞닿으면 통과, 버튼이 없으면 실패", () => {
  const s = daySnap();
  s.tt.rect = rect(20, 108, 100, 94); // bottom 202 > 자리 1 top 200
  assert.equal(dayById(dayChecks(s, size), "D4").ok, false);
  const s2 = daySnap();
  s2.tt.rect = rect(20, 156, 100, 44); // bottom 200 == 자리 1 top
  assert.equal(dayById(dayChecks(s2, size), "D4").ok, true);
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
    { seat: 0, rect: rect(150, 400, 72, 96), isButton: false, sel: false, pressed: false, reachable: true },
    { seat: 1, rect: rect(20, 330, 72, 96), isButton: false, sel: false, pressed: false, reachable: true },
    { seat: 2, rect: rect(270, 330, 72, 96), isButton: false, sel: false, pressed: false, reachable: true },
  ];
  s.tags = [
    { seat: 0, rect: rect(150, 440, 72, 36) },
    { seat: 1, rect: rect(20, 420, 72, 36) },
    { seat: 2, rect: rect(270, 420, 72, 36) },
  ];
  return s;
};

test("morningCardIssues: 허용 범위 안이면 통과", () => {
  assert.equal(morningCardIssues(morningSnap(), size).ok, true);
});

test("morningCardIssues: 패널·남의 얼굴·내 자리/이름표와 겹치거나 화면 밖이거나 카드가 없으면 실패", () => {
  const a = morningSnap();
  a.card = rect(54, 440, 252, 100); // 패널(top 483) 교차
  assert.equal(morningCardIssues(a, size).ok, false);
  const b = morningSnap();
  b.card = rect(54, 300, 252, 100); // 자리 1 얼굴(330~373.2) 교차
  assert.equal(morningCardIssues(b, size).ok, false);
  const c = morningSnap();
  c.card = rect(100, 380, 120, 40); // 내 자리(0) 상자 top 400 과 교차, 남의 얼굴은 아님
  assert.equal(morningCardIssues(c, size).ok, false);
  const d = morningSnap();
  d.card = rect(54, 435, 252, 40); // 내 이름표(440~476) 교차, 상자(400~)와도 교차
  assert.equal(morningCardIssues(d, size).ok, false);
  const e = morningSnap();
  e.card = rect(200, 168, 252, 100); // right 452 > 360
  assert.equal(morningCardIssues(e, size).ok, false);
  const f = morningSnap();
  f.card = null;
  assert.equal(morningCardIssues(f, size).ok, false);
});

test("morningCardIssues: 뒷자리 이름표만 덮는 것은 허용", () => {
  const s = morningSnap();
  s.card = rect(54, 380, 252, 50); // 380~430: 자리 1·2 상자(330~426)의 아래 55%(373~426)와 이름표(420~456)만 덮음, 내 자리 top 400 은 x 54~306 과 겹침
  s.seats[0].rect = rect(150, 440, 72, 96); // 내 자리를 카드 아래로
  s.tags[0].rect = rect(150, 480, 72, 36);
  assert.equal(morningCardIssues(s, size).ok, true, morningCardIssues(s, size).detail);
});

test("feltStable: 같으면 통과, 1px 옮겨지면 실패하고 상태 이름을 말한다", () => {
  const r = rect(10, 20, 300, 200);
  assert.equal(feltStable([{ state: "claim", rect: r }, { state: "discussion", rect: r }, { state: "night", rect: r }]).ok, true);
  const bad = feltStable([{ state: "claim", rect: r }, { state: "discussion", rect: rect(10, 21, 300, 200) }]);
  assert.equal(bad.ok, false);
  assert.match(bad.detail, /discussion/);
});

test("tagsOverlap: 겹치지 않으면 통과, 겹치면 자리 쌍을 말한다", () => {
  const ok = tagsOverlap([0, 1, 2, 3].map((i) => ({ seat: i, rect: rect(i * 80, 0, 72, 36) })));
  assert.equal(ok.ok, true);
  const bad = tagsOverlap([
    { seat: 0, rect: rect(0, 0, 72, 36) },
    { seat: 1, rect: rect(60, 10, 72, 36) },
  ]);
  assert.equal(bad.ok, false);
  assert.match(bad.detail, /0.*1/);
});

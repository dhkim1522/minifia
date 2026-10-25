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

test("dayChecks D3b: 인원별 바닥(4·5명 100%, 6명 85%, 7명 50%, 8명 55%)", () => {
  const withN = (n, ratio, lowSeat = 1) => {
    const s = daySnap();
    s.tagVisibility = Array.from({ length: n }, (_, i) => ({ seat: i, ratio: i === lowSeat ? ratio : 1 }));
    return dayById(dayChecks(s, size), "D3b");
  };
  assert.equal(withN(4, 1).ok, true);
  assert.equal(withN(4, 0.99).ok, false);
  assert.equal(withN(5, 1).ok, true);
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

// ---- 차례(K1·K2)·주장 채팅(K3)·기록 카드(X1) ----

const turnPanel = (over = {}) => ({ rect: rect(0, 483, 360, 157), text: "", stRow: false, emojiBtn: false, quickBtn: false, chips: [], ...over });

test("turnChecks K1: 차례 표식 spot·badge·tagTurn 이 정확히 1, 이름표 아랫줄 0 이면 통과", () => {
  const s = daySnap();
  s.panel = turnPanel({ stRow: true, emojiBtn: true });
  s.turn = { spot: 1, badge: 1, tagTurn: 1, legacyRows: 0 };
  const list = turnChecks(s, { myTurn: false, jobs: ["마피아", "경찰"] });
  assert.equal(dayById(list, "K1").ok, true, dayById(list, "K1").detail);
  for (const bad of [{ spot: 0 }, { badge: 2 }, { tagTurn: 0 }, { legacyRows: 1 }]) {
    const t = { ...s, turn: { ...s.turn, ...bad } };
    assert.equal(dayById(turnChecks(t, { myTurn: false, jobs: [] }), "K1").ok, false, JSON.stringify(bad));
  }
});

test("turnChecks K1: 차례 없는 단계(expectNone)는 세 값이 모두 0 이어야 통과하고 K2 는 돌리지 않는다", () => {
  const s = daySnap();
  s.turn = { spot: 0, badge: 0, tagTurn: 0, legacyRows: 0 };
  const list = turnChecks(s, { expectNone: true });
  assert.deepEqual(list.map((x) => x.id), ["K1"]);
  assert.equal(list[0].ok, true);
  s.turn.spot = 1;
  assert.equal(turnChecks(s, { expectNone: true })[0].ok, false);
});

test("turnChecks K2: 내 차례는 이번 판 직업 + 말 안 함 칩 · stRow/이모티콘 없음 · 높이 157", () => {
  const s = daySnap();
  s.turn = { spot: 1, badge: 1, tagTurn: 1, legacyRows: 0 };
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
  s.turn = { spot: 1, badge: 1, tagTurn: 1, legacyRows: 0 };
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

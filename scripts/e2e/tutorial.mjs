// 17페이즈 첫 사건(튜토리얼) E2E 흐름 (17-09): tutorial-solo(혼자 하기, 폰 6종)·tutorial-together(함께 진행, 390x844 한 크기).
// 이름 앞머리 tutorial — 다른 흐름 id 와 부분 일치가 겹치지 않는다(`--only tutorial` 하나로 둘 다 돈다). 흐름은 화면을 읽기만 하고 판정은 lib.mjs 의 순수 함수에 맡긴다:
// 판정 문턱은 여기서 낮추지 않는다(T-17-21 — 결과 줄에는 크기·장면 번호·판정 id·사각형만, 닉네임·토큰·view 값은 싣지 않는다).
// 앱에는 E2E 전용 단축(URL 장면 번호 등)이 없다 — 실제 사용자 경로(클릭)로만 간다. 150초 시간 초과 경로는 기다리지 않는다(워커 시험 17-12 가 맡는다, 0080-19).
// 실제 브라우저의 시간 판정은 여유를 둔다: 오프닝 자동 넘김 4.6초 ± 1.0초, [처리] 뒤 0.7초 ± 0.5초(lib.tutorialTimingChecks).
// helpers 는 flows.mjs 가 넘긴다(errand.mjs·host.mjs 와 같은 모양 — 서로 import 하지 않는다): { recorder, attempt, startHost, openGuest }
// together 는 방장·손님 두 페이지(+ 서버 봇 둘)로: 스위치 → 시작 → 두 페이지 첫 사건 → 방장 건너뛰기 → 기다림 n/N → 손님 재접속 → 손님이 끝냄 → 역할 확인, 보낸 프레임은 tutorialDone 한 번뿐.
import { SetupError, backToLobby, closeSheet, collectSnapshot, fpsStart, fpsStop, openSoloPage, openTestSheet, readHeaderContrast, readTutorial, readTutorialStable, setBots, settle, sleep, startGame, watchSockets } from "./browser.mjs";
import {
  TUTORIAL_CAST_E2E,
  WRONG_HINT_AFTER,
  genericIssues,
  headerContrastChecks,
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
  toggleRowChecks,
  tutorialTimingChecks,
} from "./lib.mjs";
import { TUTORIAL_ROLE_MAX_LINES, readRoleLineBoxes, roleLineBoxChecks, todAbsentChecks } from "./polish.mjs";

const recOne = (rec, scenario, r) => rec(scenario, r.id, r.label, r.ok, r.detail, r.relaxed === true || r.info === true);
/** 판정 줄들을 쌓는다. relax 에 든 id 가 실패하면 알려진 한계 참고 줄(통과, 내용 있음)로 남긴다 — 판정 문턱은 바꾸지 않는다 */
const recAll = (rec, sc, lines, { relax = [], note = "" } = {}) => {
  for (const l of lines) {
    if (!l.ok && relax.includes(l.id)) rec(sc, l.id, `${l.label} — 알려진 한계(${note}, 판정 아님)`, true, l.detail, true);
    else recOne(rec, sc, l);
  }
};

/** 장면 7 직업 카드가 [다음] 과 겹칠 수 있는 낮은 폰(360x560·360x640)의 높이 상한 — 17-08 이 알려진 한계로 남겼다(UI Considerations #14) */
const KNOWN_LIMIT_MAX_H = 640;
/** 장면 6 오답 문구(src/game/tutorialScript.ts 의 tutorial.vote.wrong — e2eContract 가 대조) */
export const TUTORIAL_WRONG_LINE = "흔적을 떠올려 보세요";
/** 장면 6 이름표(좌석): 민준 0·지호 3 이 오답, 도윤 1 이 정답 */
const WRONG_SEATS = [0, 3];
const RIGHT_SEAT = TUTORIAL_CAST_E2E.suspect;

const TOGETHER_HOST_NICK = "함께방장";
const TOGETHER_GUEST_NICK = "손님이둘";
/** 단계 도달 상한(ms): 튜토리얼 → 배정 3초 → 역할 확인 */
const PHASE_WAIT_MS = 15_000;

const sceneSel = (n) => `[data-tutorial-screen][data-tutorial-scene="${n}"]`;
const SCENE_WAIT_MS = 9000;

export function makeTutorialFlows({ recorder, attempt, startHost, openGuest }) {
  const vpOf = (t) => ({ w: t.vw, h: t.vh });
  /** 기다림 하나를 검사 결과 { ok, detail } 로 바꾼다(attempt 는 값을 돌려주면 그 값을 결과로 쓰므로 값을 버린다) */
  const tryDo = (fn) =>
    attempt(async () => {
      await fn();
    });

  /** 기대한 포커스 대상이 화면에 있고 상자가 그 자리에 있는지 */
  function focusLines(rec, sc, t, expected) {
    const targets = [];
    const missing = [];
    for (const k of expected) {
      const f = t.targets.find((x) => x.key === k);
      if (f) targets.push(f);
      else missing.push(k);
    }
    rec(sc, "TF0", "기대한 포커스 대상이 화면에 있다", missing.length === 0, `없는 대상 ${missing.join(",")}`);
    recAll(rec, sc, tutorialFocusChecks(t.focus, targets, vpOf(t)));
    if (t.unstable === true) rec(sc, "TF9", "참고: 위치가 두 번 연속 같은 값으로 안정되지 않았다(마지막 값으로 판정함)", true, "", true);
  }

  /** 사회자 띠 판정. 포커스 대상(band 제외)·머리·소리 독·[다음] 과 교차 0 */
  function bandLines(rec, sc, t, expectedTargets, opts) {
    const targets = expectedTargets.map((k) => t.targets.find((x) => x.key === k)).filter(Boolean);
    recAll(rec, sc, tutorialBandChecks(t.band, { header: t.header, dock: t.dock, next: t.next, targets }, opts));
  }

  /**
   * 스포트라이트 막(D-04): dimOn = 포커스 상자가 있는 구간(막 1개·구멍이 상자를 덮음·흐림 없음), dimOff = 상자 없는 구간(막 0개). TD 줄은 dot 점 판정(TD1·TD2)과 id 가 겹쳐 `/dim` 시나리오에 따로 쌓는다.
   */
  /** 18.1-08 D2: 튜토리얼의 모든 장면에 시간대 글자가 없다 — 장면마다 부르는 dimOn·dimOff 가 함께 남긴다 */
  const todOff = (rec, sc, t) => recOne(rec, `${sc}/tod`, todAbsentChecks(t.tod, { screen: "튜토리얼" }));
  const dimOn = (rec, sc, t) => {
    recAll(rec, `${sc}/dim`, tutorialDimChecks(t.dim, { expect: 1, focus: t.focus }));
    todOff(rec, sc, t);
  };
  const dimOff = (rec, sc, t) => {
    recAll(rec, `${sc}/dim`, tutorialDimChecks(t.dim, { expect: 0, focus: t.focus }));
    todOff(rec, sc, t);
  };
  /** [다음] 알약(D-05) — 보이는 구간에서만 부른다 */
  function nextLines(rec, sc, t) {
    recAll(rec, sc, tutorialNextChecks(t.next, { viewport: vpOf(t), errandDots: t.errandDots, label: t.nextLabel }));
  }
  /** 장면 2~6 에는 아래 패널·[내 역할]·채팅 입력칸이 없다(D-06) */
  function hiddenLines(rec, sc, t) {
    recAll(rec, sc, tutorialHiddenChecks(t.hidden));
  }

  /**
   * 묶음 G(탭 44·글자 14·가로 넘침·콘솔 오류·요청). [건너뛰기] 는 알약 32 + 투명 확장이라 TK1 이 누르는 영역으로 따로 판정한다.
   * 이름표 안 요소가 화면 가로 밖으로 나가는 것은 flows.mjs checkState 와 같은 알려진 한계(E8 #29)라 판정에서 빼고 참고 줄(G2k)로 남긴다 —
   * 도윤 이름표("흔적과 같은 옷" 칸)가 폭 390 에서 3px, 360 에서 더 나간다. 그 이름표 단추에 포커스가 가면 overflow:hidden 인 맵 틀이 가로로 스크롤돼(.mf-world scrollLeft) 맵 층이 같이 밀리므로,
   * 밀린 값은 참고 줄(G2s)로 남기고 스냅숏은 스크롤을 되돌린 뒤 찍는다(포커스 스크롤은 같은 한계의 부수 효과다).
   */
  async function gLine(rec, ctx, solo, sc) {
    const shift = await solo.page.evaluate(() => {
      const w = document.querySelector(".mf-world");
      const n = w ? Math.round(w.scrollLeft) : 0;
      if (w && n !== 0) w.scrollLeft = 0;
      return n;
    });
    if (shift !== 0) rec(sc, "G2s", "알려진 한계(E8 #29 계열, 판정 아님): 이름표가 화면 밖으로 나가 포커스 때 맵 틀이 가로로 스크롤됨", true, `밀린 값 ${shift}px (스크롤을 되돌리고 측정)`, true);
    const snap = await collectSnapshot(solo.page);
    snap.issues = solo.takeIssues();
    snap.interactive = snap.interactive.filter((e) => !e.desc.startsWith("button.tut-skip"));
    const w = ctx.size.w;
    const tagOut = snap.elements.filter((e) => e.inTag && (e.rect.left < -0.5 || (e.rect.right ?? e.rect.left + e.rect.width) > w + 0.5));
    const judged = { ...snap, elements: snap.elements.filter((e) => !tagOut.includes(e)) };
    const bad = genericIssues(judged, ctx.size).filter((x) => !x.ok);
    rec(sc, "G", "G 공통 검사(탭 44·글자 14·가로 넘침·콘솔·요청)", bad.length === 0, bad.map((x) => `${x.id} ${x.detail}`).join(" / "));
    if (tagOut.length > 0) {
      const xs = tagOut.map((e) => `${Math.round(e.rect.left)}~${Math.round(e.rect.right ?? e.rect.left + e.rect.width)}`);
      rec(sc, "G2k", "알려진 한계(E8 #29, 판정 아님): 이름표 안 요소가 화면 가장자리에서 잘림", true, `이름표 안 요소 ${tagOut.length}개 화면 가로(${w}) 밖: ${[...new Set(xs)].slice(0, 4).join(", ")}`, true);
    }
  }

  /** 묶음 H(헤더 제목 글씨 대비 4.5:1) — 지도 장면 머리 */
  async function hLine(rec, page, sc) {
    const r = await attempt(async () => {
      const hc = headerContrastChecks(await readHeaderContrast(page), { expectTimer: false });
      return hc.ok ? true : { ok: false, detail: hc.detail };
    });
    rec(sc, "H1", "헤더 제목 글씨 대비 4.5:1", r.ok, r.detail);
  }

  const waitScene = (page, n, ms = SCENE_WAIT_MS) => page.waitForSelector(sceneSel(n), { timeout: ms });
  /** 사회자가 말하는 동안(data-speaking)을 잡는다 */
  const waitSpeaking = (page, ms = 3000) => page.waitForFunction(() => document.querySelector("[data-tutorial-host]")?.getAttribute("data-speaking") === "true", null, { timeout: ms });
  const waitSilent = (page, ms = 6000) => page.waitForFunction(() => document.querySelector("[data-tutorial-host]")?.getAttribute("data-speaking") !== "true", null, { timeout: ms });
  const waitBandText = (page, text, ms = 4000) => page.waitForFunction((t) => (document.querySelector("[data-tutorial-host] [data-host-line]")?.textContent ?? "").includes(t), text, { timeout: ms });

  /** 내 캐릭터의 화면에 그려진 자리와 목적지 링(맵 훅) */
  const readMe = (page) =>
    page.evaluate((seat) => {
      const w = window.__mfWorld;
      const s = w?.shown(seat) ?? null;
      return { x: s?.x ?? null, z: s?.z ?? null, ring: w ? w.ring() : undefined };
    }, TUTORIAL_CAST_E2E.me);

  /** 도윤의 화면 가로 위치(무대 → 화면 px) — 오른쪽 밖에서 들어오는지 */
  const readSuspectScreenX = (page) =>
    page.evaluate((seat) => {
      const w = window.__mfWorld;
      const s = w?.shown(seat);
      if (!w || !s) return null;
      const p = w.screenOf(s.x, s.z);
      return p ? { sx: p.sx, vw: window.innerWidth } : null;
    }, TUTORIAL_CAST_E2E.suspect);

  /**
   * tutorial-solo: 방 없이 첫 화면("/", 테스트 방 아님)에서 큰 카드 1개(방 코드 칸·[방 만들기] 와 교차 0) → 장면 1~7 을 끝까지 → 마무리 카드·[다시 보기] → 장면 1 → [건너뛰기] → 첫 화면 작은 단추 → 다시 열면 작은 단추.
   * 혼자 하기 전체에서 앱 소켓은 열리지 않고 보낸 프레임은 0건이며 /api 요청도 없다(TUT-01·TUT-03·TUT-05).
   */
  async function tutorialSoloFlow(ctx) {
    const rec = recorder(ctx);
    const vp = { w: ctx.size.w, h: ctx.size.h };
    const wide = ctx.size.label === "390x844";
    /** 참고 측정값(판정 아님): 결과 표의 TTIME 줄에 남긴다 */
    const measured = { openingMs: null, errandMs: null, reducedOpeningMs: null };
    let solo = null;
    const t0 = performance.now();
    try {
      solo = await openSoloPage(ctx.browser, { origin: ctx.origin, size: ctx.size, needles: TUTORIAL_CAST_E2E.names });
      const { page, sockets } = solo;

      // ① 첫 화면: 처음 카드 1개(방 코드 칸·[방 만들기] 와 교차 0)
      const home = await attempt(async () => {
        await page.waitForSelector("[data-tutorial-entry]");
        await settle(page);
      });
      if (!home.ok) throw new SetupError(`첫 화면 진입 카드가 보이지 않음 (${home.detail})`);
      let t = await readTutorial(page);
      recAll(rec, "tutorial-solo/home", tutorialEntryChecks({ entry: t.entry, field: t.field, create: t.create, viewport: vpOf(t) }, { kind: "card" }));
      await gLine(rec, ctx, solo, "tutorial-solo/home");

      // ② 카드를 누르면 첫 사건 화면(장면 1) — 이 뒤로는 앱 소켓·/api 요청이 0 이어야 한다
      const apiAtStart = sockets.api;
      const started = await attempt(async () => {
        await page.locator('[data-tutorial-entry="card"]').click();
        await waitScene(page, 1);
      });
      rec("tutorial-solo/home", "TU1", "카드를 누르면 첫 사건 화면 장면 1", started.ok, started.detail);
      if (!started.ok) return;

      // ③ 장면 1 오프닝: 램프 번짐 2·번쩍임 1·소리 링 3, 약 4.6초 뒤 장면 2 로 자동
      await page.waitForSelector("[data-tutorial-opening]", { timeout: SCENE_WAIT_MS });
      const openedAt = performance.now();
      t = await readTutorial(page);
      const sc1 = "tutorial-solo/scene1";
      recAll(rec, sc1, tutorialDotChecks(t.dots, 1));
      recAll(rec, sc1, tutorialOpeningChecks(t.opening));
      rec(sc1, "TN0", "장면 1 에는 [다음] 이 없다(자동으로 넘어간다)", t.next === null, "");
      recAll(rec, sc1, tutorialSkipChecks({ skip: t.skip, viewport: vpOf(t) }));
      focusLines(rec, sc1, t, []);
      const toScene2 = await tryDo(() => waitScene(page, 2));
      const openingMs = performance.now() - openedAt;
      rec(sc1, "TM0", "오프닝이 장면 2 로 넘어간다", toScene2.ok, toScene2.detail);
      if (!toScene2.ok) return;
      measured.openingMs = Math.round(openingMs);
      recAll(rec, sc1, tutorialTimingChecks({ openingMs }));

      // ④ 장면 2: 띠 포커스 1개, 말하는 동안 막대·data-speaking, 2.6초 뒤 [다음]
      const sc2 = "tutorial-solo/scene2";
      if (wide) await fpsStart(page).catch(() => {});
      await waitSpeaking(page).catch(() => {});
      t = await readTutorialStable(page);
      recAll(rec, sc2, tutorialDotChecks(t.dots, 2));
      rec(sc2, "TN1", "[다음] 은 2.6초 전에는 없다", t.next === null, "");
      focusLines(rec, sc2, t, ["band"]);
      dimOn(rec, sc2, t);
      hiddenLines(rec, sc2, t);
      bandLines(rec, sc2, t, [], { speaking: true });
      const next2 = await tryDo(() => page.waitForSelector("[data-tutorial-next]", { timeout: SCENE_WAIT_MS }));
      rec(sc2, "TN2", "2.6초 뒤 [다음] 이 나타난다", next2.ok, next2.detail);
      if (!next2.ok) return;
      await waitSpeaking(page, 1500).catch(() => {});
      t = await readTutorialStable(page);
      focusLines(rec, sc2, t, []);
      dimOff(rec, sc2, t);
      nextLines(rec, sc2, t);
      bandLines(rec, sc2, t, [], { speaking: true });
      recAll(rec, sc2, tutorialSkipChecks({ skip: t.skip, viewport: vpOf(t) }));
      const silent2 = await tryDo(() => waitSilent(page));
      rec(sc2, "TB6", "말이 끝나면 막대가 멈춘다(data-speaking 해제)", silent2.ok, silent2.detail);
      t = await readTutorialStable(page);
      bandLines(rec, sc2, t, [], { speaking: false });
      await gLine(rec, ctx, solo, sc2);
      await hLine(rec, page, sc2);
      await page.locator("[data-tutorial-next]").click();

      // ⑤ 장면 3: 포커스 한 묶음(우체통 타일 + [처리]), 허용 밖 터치 무반응, [처리] 0.7초 뒤 장면 4
      const sc3 = "tutorial-solo/scene3";
      await waitScene(page, 3);
      await page.waitForSelector('[data-tutorial-focus="errand"]', { timeout: SCENE_WAIT_MS });
      await waitSpeaking(page).catch(() => {});
      t = await readTutorialStable(page);
      recAll(rec, sc3, tutorialDotChecks(t.dots, 3));
      focusLines(rec, sc3, t, ["errand"]);
      dimOn(rec, sc3, t);
      hiddenLines(rec, sc3, t);
      bandLines(rec, sc3, t, ["errand"], { speaking: true });
      await gLine(rec, ctx, solo, sc3);
      await hLine(rec, page, sc3);
      const before = await readMe(page);
      const taps = await page.evaluate(() => {
        const header = document.querySelector(".mf-game__header");
        const hr = header ? header.getBoundingClientRect() : null;
        const stage = document.querySelector("[data-world-stage]");
        const sr = stage ? stage.getBoundingClientRect() : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
        const bad = "button, [data-tutorial-host], .mf-world__tag, .mf-game__header, .mf-game__panel, [data-errand-place], [data-errand-act-layer], [data-tutorial-next]";
        let empty = null;
        for (let fy = 0.35; fy <= 0.8 && !empty; fy += 0.1) {
          for (let fx = 0.2; fx <= 0.85 && !empty; fx += 0.15) {
            const x = sr.left + sr.width * fx;
            const y = sr.top + sr.height * fy;
            const el = document.elementFromPoint(x, y);
            if (el && !el.closest(bad)) empty = { x, y };
          }
        }
        return { header: hr ? { x: hr.left + hr.width / 2, y: hr.top + hr.height / 2 } : null, empty };
      });
      if (taps.empty) await page.touchscreen.tap(taps.empty.x, taps.empty.y);
      if (taps.header) await page.touchscreen.tap(taps.header.x, taps.header.y);
      await sleep(600);
      const after = await readMe(page);
      const stillScene3 = (await page.locator(sceneSel(3)).count()) === 1;
      const samePos = before.x !== null && after.x !== null && Math.abs(before.x - after.x) < 0.05 && Math.abs(before.z - after.z) < 0.05 && before.ring === after.ring;
      rec(sc3, "TT1", "허용 목록 밖 터치(맵 빈 곳·머리 영역)에 반응이 없다: 장면 3 그대로", stillScene3 && taps.empty !== null && taps.header !== null, `장면 3 ${stillScene3}, 빈 곳 ${taps.empty !== null}, 머리 영역 ${taps.header !== null}`);
      rec(sc3, "TT2", "허용 목록 밖 터치 뒤 내 위치·목적지 링이 그대로다", samePos, `전 ${before.x === null ? "읽지 못함" : `(${before.x.toFixed(2)},${before.z.toFixed(2)})`} 후 ${after.x === null ? "읽지 못함" : `(${after.x.toFixed(2)},${after.z.toFixed(2)})`}`);
      await page.locator("[data-errand-act]").click();
      const pressedAt = performance.now();
      const toScene4 = await tryDo(() => waitScene(page, 4));
      const errandMs = performance.now() - pressedAt;
      rec(sc3, "TM0", "[처리] 뒤 장면 4 로 넘어간다", toScene4.ok, toScene4.detail);
      if (!toScene4.ok) return;
      measured.errandMs = Math.round(errandMs);
      recAll(rec, sc3, tutorialTimingChecks({ errandMs }));

      // ⑥ 장면 4: 도윤이 오른쪽 밖에서 들어옴, 눈 표시·기록 한 줄, 도윤 포커스 상자, 3.4초 뒤 [다음]
      const sc4 = "tutorial-solo/scene4";
      const startX = await readSuspectScreenX(page);
      rec(sc4, "TW1", "도윤이 화면 오른쪽 밖에서 들어온다(처음 화면 x 가 화면 폭 밖)", startX !== null && startX.sx > startX.vw, startX === null ? "측정값 없음(도윤 위치)" : `처음 x ${Math.round(startX.sx)} / 화면 ${startX.vw}`);
      await page.waitForSelector('[data-tutorial-focus="suspect"]', { timeout: SCENE_WAIT_MS });
      const endX = await readSuspectScreenX(page);
      rec(sc4, "TW2", "도윤이 걸어 들어와 화면 안에 선다", endX !== null && endX.sx > 0 && endX.sx < endX.vw, endX === null ? "측정값 없음(도윤 위치)" : `x ${Math.round(endX.sx)} / 화면 ${endX.vw}`);
      await waitBandText(page, "본 사람은").catch(() => {});
      t = await readTutorialStable(page);
      recAll(rec, sc4, tutorialDotChecks(t.dots, 4));
      focusLines(rec, sc4, t, ["suspect"]);
      dimOn(rec, sc4, t);
      hiddenLines(rec, sc4, t);
      recAll(rec, sc4, tutorialEvidenceChecks(t.evidence, { scene: 4 }));
      bandLines(rec, sc4, t, ["suspect"], {});
      const next4 = await tryDo(() => page.waitForSelector("[data-tutorial-next]", { timeout: SCENE_WAIT_MS }));
      rec(sc4, "TN2", "3.4초 뒤 [다음] 이 나타난다", next4.ok, next4.detail);
      if (!next4.ok) return;
      t = await readTutorialStable(page);
      dimOff(rec, sc4, t);
      nextLines(rec, sc4, t);
      bandLines(rec, sc4, t, [], {});
      await gLine(rec, ctx, solo, sc4);
      await page.locator("[data-tutorial-next]").click();

      // ⑦ 장면 5: 증거 카드·선 2·수식 줄, [다음] 은 바로
      const sc5 = "tutorial-solo/scene5";
      await waitScene(page, 5);
      await page.waitForSelector("[data-tutorial-next]", { timeout: SCENE_WAIT_MS });
      await sleep(2300);
      t = await readTutorialStable(page);
      recAll(rec, sc5, tutorialDotChecks(t.dots, 5));
      focusLines(rec, sc5, t, []);
      dimOff(rec, sc5, t);
      hiddenLines(rec, sc5, t);
      nextLines(rec, sc5, t);
      recAll(rec, sc5, tutorialEvidenceChecks(t.evidence, { scene: 5, next: t.next }));
      recAll(rec, sc5, tutorialLineChecks(t.evidence, { viewport: vpOf(t), band: t.band, next: t.next }), { relax: ctx.size.h <= 560 ? ["EV6", "EV7", "EV8"] : [], note: "360x560 참고 행(UI-SPEC 장면 5)" });
      {
        const tag = t.evidence.suspectTag;
        const pt = (p) => `(${Math.round(p[0])},${Math.round(p[1])})`;
        rec(sc5, "EVm", "참고 측정(판정 아님): 도윤 이름표 사각형·선 끝 좌표", true, `이름표 ${tag ? `(${Math.round(tag.left)},${Math.round(tag.top)} ${Math.round(tag.width)}x${Math.round(tag.height)})` : "읽지 못함"} · 선 ${t.evidence.lines.map((l) => `${pt(l.from)}→${pt(l.to)}`).join(" / ")}`, true);
      }
      bandLines(rec, sc5, t, [], {});
      await gLine(rec, ctx, solo, sc5);
      await hLine(rec, page, sc5);
      await page.locator("[data-tutorial-next]").click();

      // ⑧ 장면 6: 이름표 넷 포커스, 오답 두 번 → 띠 글·상자 1개, 정답 → 정체 공개 → [다음]
      const sc6 = "tutorial-solo/scene6";
      await waitScene(page, 6);
      await page.waitForFunction(() => document.querySelectorAll("[data-tutorial-focus]").length === 4, null, { timeout: SCENE_WAIT_MS });
      await waitSpeaking(page).catch(() => {});
      t = await readTutorialStable(page);
      recAll(rec, sc6, tutorialDotChecks(t.dots, 6));
      focusLines(rec, sc6, t, ["pick-0", "pick-1", "pick-3", "pick-4"]);
      dimOn(rec, sc6, t);
      hiddenLines(rec, sc6, t);
      bandLines(rec, sc6, t, ["pick-0", "pick-1", "pick-3", "pick-4"], {});
      await gLine(rec, ctx, solo, sc6);
      await hLine(rec, page, sc6);
      for (let i = 0; i < WRONG_SEATS.length; i++) {
        await page.locator(`[data-pick="${WRONG_SEATS[i]}"]`).click();
        await waitSpeaking(page).catch(() => {});
        const w = await readTutorial(page);
        rec(sc6, `TV${i + 1}`, `오답 ${i + 1}번째: 띠 글이 오답 문구다`, w.band?.text === TUTORIAL_WRONG_LINE, w.band === null ? "측정값 없음(띠)" : `띠 글 "${w.band.text}"`);
        if (i === 0) bandLines(rec, sc6, w, [], { speaking: true });
        await sleep(300);
        const st = await readTutorialStable(page);
        const expected = i + 1 >= WRONG_HINT_AFTER ? [`pick-${RIGHT_SEAT}`] : ["pick-0", "pick-1", "pick-3", "pick-4"];
        rec(sc6, `TV${i + 3}`, `오답 ${i + 1}번 뒤 포커스 상자 ${expected.length}개`, st.focus.length === expected.length, `상자 ${st.focus.length}개`);
        focusLines(rec, sc6, st, expected);
        dimOn(rec, sc6, st);
      }
      await page.locator(`[data-pick="${RIGHT_SEAT}"]`).click();
      const reveal = await attempt(async () => {
        await page.waitForSelector("[data-tutorial-reveal]", { timeout: SCENE_WAIT_MS });
        await page.waitForSelector("[data-tutorial-next]", { timeout: SCENE_WAIT_MS });
      });
      rec(sc6, "TV5", "정답 → 정체 공개 → [다음]", reveal.ok, reveal.detail);
      if (!reveal.ok) return;
      await sleep(1900);
      t = await readTutorialStable(page);
      focusLines(rec, sc6, t, []);
      dimOff(rec, `${sc6}/reveal`, t);
      nextLines(rec, `${sc6}/reveal`, t);
      recAll(rec, sc6, tutorialRevealChecks({ reveal: t.reveal, next: t.next, viewport: vpOf(t) }));
      await gLine(rec, ctx, solo, `${sc6}/reveal`);
      if (wide) {
        const fps = await fpsStop(page).catch(() => null);
        rec(sc6, "FPS", "참고 측정(판정 아님): 장면 2~6 동안 rAF 평균 fps", true, fps === null ? "측정하지 못함" : `평균 ${fps.avgFps}fps · 프레임 ${fps.frames}개 · 가장 긴 간격 ${fps.worstMs}ms`, true);
      }
      await page.locator("[data-tutorial-next]").click();

      // ⑨ 장면 7: 직업 카드 4장, [다음] → 마무리
      const sc7 = "tutorial-solo/scene7";
      await waitScene(page, 7);
      await page.waitForFunction(() => document.querySelectorAll("[data-tutorial-role-card]").length === 4, null, { timeout: SCENE_WAIT_MS });
      await page.waitForSelector("[data-tutorial-next]", { timeout: SCENE_WAIT_MS });
      await sleep(2500);
      t = await readTutorialStable(page);
      recAll(rec, sc7, tutorialDotChecks(t.dots, 7));
      recAll(rec, sc7, tutorialRoleCardChecks({ roles: t.roles, next: t.next, viewport: vpOf(t) }), { relax: ctx.size.h <= KNOWN_LIMIT_MAX_H ? ["TC4"] : [], note: "17-08 낮은 폰 직업 카드와 [다음] 겹침, UI Considerations #14" });
      recAll(rec, sc7, tutorialRoleLineChecks(t.roleLines));
      // 18.1-08 TC6(UI-SPEC A1f): 직업 카드 네 장의 문구가 한 문장(줄바꿈 문자 없음)·각 ≤ 3줄
      recOne(rec, sc7, roleLineBoxChecks(await readRoleLineBoxes(page, "[data-tutorial-role-card] .tut-role__line"), { max: TUTORIAL_ROLE_MAX_LINES, id: "TC6", count: 4 }));
      focusLines(rec, sc7, t, []);
      dimOff(rec, sc7, t);
      nextLines(rec, sc7, t);
      bandLines(rec, sc7, t, [], {});
      await gLine(rec, ctx, solo, sc7);
      await page.locator("[data-tutorial-next]").click();

      // ⑩ 마무리 카드 → [다시 보기] → 장면 1 → [건너뛰기] → 첫 화면 작은 단추 → 다시 열면 작은 단추
      const end = await tryDo(() => page.waitForSelector("[data-tutorial-end]", { timeout: SCENE_WAIT_MS }));
      rec("tutorial-solo/end", "TE0", "장면 7 [다음] 뒤 첫 화면에 마무리 카드가 뜬다", end.ok, end.detail);
      if (!end.ok) return;
      await settle(page);
      t = await readTutorial(page);
      recAll(rec, "tutorial-solo/end", tutorialEntryChecks({ entry: t.entry, field: t.field, create: t.create, viewport: vpOf(t) }, { kind: "end" }));
      await gLine(rec, ctx, solo, "tutorial-solo/end");
      await page.locator("[data-tutorial-replay]").click();
      const replay = await tryDo(() => waitScene(page, 1));
      rec("tutorial-solo/end", "TE4", "[다시 보기] 를 누르면 장면 1 부터 다시", replay.ok, replay.detail);
      if (!replay.ok) return;
      await page.locator("[data-tutorial-skip]").click();
      const skipped = await attempt(async () => {
        await page.waitForSelector('[data-tutorial-entry="button"]');
        await settle(page);
      });
      rec("tutorial-solo/end", "TE5", "다시 본 뒤 [건너뛰기] 로 첫 화면에 돌아와 작은 단추가 보인다", skipped.ok, skipped.detail);
      if (!skipped.ok) return;
      t = await readTutorial(page);
      recAll(rec, "tutorial-solo/end", tutorialEntryChecks({ entry: t.entry, field: t.field, create: t.create, viewport: vpOf(t) }, { kind: "button" }));
      await gLine(rec, ctx, solo, "tutorial-solo/skipped");

      // 이 지점까지가 혼자 하기 전체: 앱 소켓 0·보낸 프레임 0·/api 요청 0
      rec("tutorial-solo/socket", "TS0", "혼자 하기 동안 앱 소켓이 열리지 않는다", sockets.opened === 0, `열린 앱 소켓 ${sockets.opened}개`);
      recOne(rec, "tutorial-solo/socket", sentFrameChecks(sockets.frames, []));
      rec("tutorial-solo/socket", "TS2", "혼자 하기 동안 /api 요청이 없다(카드를 누른 뒤)", sockets.api - apiAtStart === 0, `/api 요청 ${sockets.api - apiAtStart}건`);

      // 다시 열면 작은 단추(저장소에 본 표시가 남는다)
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForSelector("[data-tutorial-entry]", { timeout: SCENE_WAIT_MS });
      await settle(page);
      t = await readTutorial(page);
      recAll(rec, "tutorial-solo/reopen", tutorialEntryChecks({ entry: t.entry, field: t.field, create: t.create, viewport: vpOf(t) }, { kind: "button" }));

      // 모션 줄이기: 오프닝에서 번짐·번쩍임·링이 0 이고 어둠이 정지, 그래도 4.6초 안팎에 장면 2
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.locator('[data-tutorial-entry="button"]').click();
      await waitScene(page, 1);
      await page.waitForSelector("[data-tutorial-opening]", { timeout: SCENE_WAIT_MS });
      const reducedAt = performance.now();
      t = await readTutorial(page);
      recAll(rec, "tutorial-solo/reduced", tutorialOpeningChecks(t.opening, { reduced: true }));
      const reducedTo2 = await tryDo(() => waitScene(page, 2));
      rec("tutorial-solo/reduced", "TM0", "모션 줄이기에서도 오프닝이 장면 2 로 넘어간다", reducedTo2.ok, reducedTo2.detail);
      if (reducedTo2.ok) {
        measured.reducedOpeningMs = Math.round(performance.now() - reducedAt);
        recAll(rec, "tutorial-solo/reduced", tutorialTimingChecks({ openingMs: performance.now() - reducedAt }));
      }
      await page.locator("[data-tutorial-skip]").click();
      await page.waitForSelector('[data-tutorial-entry="button"]', { timeout: SCENE_WAIT_MS });

      rec("tutorial-solo/time", "TTIME", "참고 측정(판정 아님): 흐름 소요 시간", true, `흐름 ${Math.round((performance.now() - t0) / 1000)}초 · 오프닝→장면 2 ${measured.openingMs}ms · [처리]→장면 4 ${measured.errandMs}ms · 모션 줄이기 오프닝→장면 2 ${measured.reducedOpeningMs}ms`, true);
    } finally {
      await solo?.context.close().catch(() => {});
    }
  }

  /** 페이지를 다시 열고 새 연결의 첫 state 프레임이 올 때까지 기다린다(추적 값은 이전 연결의 것이 남아 있으므로 순번으로 센다) */
  async function reconnect(page, tracker, label) {
    const seq = tracker.seq;
    await page.reload({ waitUntil: "domcontentloaded" });
    await tracker.waitFor(() => tracker.seq > seq, 15_000, label);
  }

  /** 튜토리얼 밖 화면의 DOM 에서 가짜 이름·직업 카드를 센다(이름 목록과 개수만 — DOM 글 원문은 가져오지 않는다) */
  const readLeakDom = (page, where) =>
    page.evaluate(
      ({ names, where: w }) => {
        const html = document.body.innerHTML;
        return { where: w, names: names.filter((n) => html.includes(n)), roleCards: document.querySelectorAll("[data-tutorial-role-card]").length };
      },
      { names: [...TUTORIAL_CAST_E2E.names], where },
    );

  /** 단계 도달을 기다리는 기다림 하나를 검사 결과로 바꾼다 */
  const reaches = (tracker, phase, ms = PHASE_WAIT_MS) =>
    tryDo(async () => {
      await tracker.waitFor((v) => v.phase === phase, ms, `${phase} 도착`);
    });

  /**
   * tutorial-together(TUT-02·TUT-05, DEPLOY-05): 테스트 방 방장 + 손님 + 서버 봇 둘.
   * 스위치 초기 꺼짐(테스트 방, 0080-3) → 켜고 시작 → 두 페이지 모두 첫 사건 화면 → 방장이 건너뛰면 기다림 화면 '1 / 2'·사람 원·시간 막대 → 손님 새로 고침(재접속)은 장면 1 →
   * 손님이 끝내면 두 페이지 모두 역할 확인. 시작부터 역할 확인까지 각 페이지가 보낸 게임 프레임은 tutorialDone 한 번뿐(ping·hello 제외, 방장의 start 는 시작 자체라 뺀다).
   * 같은 방을 대기실로 되돌려 스위치를 끈 채 시작하면 tutorial 단계 없이 곧장 역할 확인. 튜토리얼 밖 화면(대기실·기다림·역할 확인)의 DOM 과 받은 프레임에 가짜 이름·직업 카드가 없고 튜토리얼 중 view 에 me.role 이 없다.
   * 150초 시간 초과 경로는 기다리지 않는다(워커 시험 17-12 가 맡는다).
   */
  async function tutorialTogetherFlow(ctx) {
    const rec = recorder(ctx);
    const sc = "tutorial-together";
    const vp = { w: ctx.size.w, h: ctx.size.h };
    const t0 = performance.now();
    const host = await startHost(ctx, "tutorial-together", { nickname: TOGETHER_HOST_NICK });
    const { page: hp, tracker: ht } = host;
    let guestHandle = null;
    const watchers = [];
    try {
      const { guest } = await openGuest(ctx, TOGETHER_GUEST_NICK);
      guestHandle = guest;
      const { page: gp, tracker: gt } = guest;
      await ht.waitFor((v) => v.players.length === 2, 8000, "방장 쪽 인원 2");
      await openTestSheet(hp);
      await setBots(hp, ht, 2);
      await closeSheet(hp);
      await Promise.all([ht.waitFor((v) => v.players.length === 4, 8000, "방장 쪽 인원 4"), gt.waitFor((v) => v.players.length === 4, 8000, "손님 쪽 인원 4")]);

      // 소켓 감시는 새 연결부터 건다 — 페이지가 이미 연 소켓에는 걸 수 없으므로 두 페이지를 다시 열어 새 소켓을 감시한다
      const hs = watchSockets(hp, { needles: TUTORIAL_CAST_E2E.names });
      const gs = watchSockets(gp, { needles: TUTORIAL_CAST_E2E.names });
      watchers.push(hs, gs);
      await reconnect(hp, ht, "방장 재연결");
      await reconnect(gp, gt, "손님 재연결");
      await Promise.all([ht.waitFor((v) => v.phase === "lobby" && v.me?.isHost === true, 8000, "방장 대기실"), gt.waitFor((v) => v.phase === "lobby" && v.me?.isHost === false, 8000, "손님 대기실")]);
      const dom = [await readLeakDom(hp, "대기실(방장)"), await readLeakDom(gp, "대기실(손님)")];

      // ① 스위치: 테스트 방이라 초기 꺼짐(0080-3). 손님에게는 스위치가 없다
      const toggle = hp.locator("[data-tutorial-toggle]");
      await toggle.waitFor({ timeout: 8000 });
      rec(`${sc}/lobby`, "TG0", "테스트 방 스위치는 초기 꺼짐(aria-checked false)", (await toggle.getAttribute("aria-checked")) === "false", `aria-checked ${await toggle.getAttribute("aria-checked")}`);
      rec(`${sc}/lobby`, "TG1", "손님 대기실에는 스위치가 없다", (await gp.locator("[data-tutorial-toggle]").count()) === 0, "");
      await toggle.click();
      rec(`${sc}/lobby`, "TG2", "누르면 켜짐(aria-checked true)", (await toggle.getAttribute("aria-checked")) === "true", `aria-checked ${await toggle.getAttribute("aria-checked")}`);
      // TG3(0083-3): 스위치 줄은 기록 칸 위 한 줄 — 높이 44·기록 칸과 같은 폭·간격 10·글자 '튜토리얼 먼저' 한 줄
      const toggleRow = await hp.evaluate(() => {
        const rectOf = (el) => {
          if (!el) return null;
          const r = el.getBoundingClientRect();
          return { left: r.left, top: r.top, width: r.width, height: r.height, right: r.right, bottom: r.bottom };
        };
        const t = document.querySelector("[data-tutorial-toggle]");
        const title = t?.querySelector(".tut-toggle__title");
        const lh = title ? parseFloat(getComputedStyle(title).lineHeight) : NaN;
        return {
          toggle: rectOf(t),
          log: rectOf(document.querySelector(".mf-lobby__panel [data-chat-log]")),
          text: (t?.textContent ?? "").trim(),
          lines: title && lh > 0 ? Math.round(title.getBoundingClientRect().height / lh) : null,
        };
      });
      recAll(rec, `${sc}/lobby`, toggleRowChecks(toggleRow));

      // ② 켜고 시작 → 두 페이지 모두 tutorial 단계·첫 사건 화면
      const hMark = hs.mark();
      const gMark = gs.mark();
      await closeSheet(hp);
      await hp.locator("[data-lobby-start]").click();
      const [hTut, gTut] = await Promise.all([reaches(ht, "tutorial"), reaches(gt, "tutorial")]);
      rec(`${sc}/start`, "TT1", "켜고 시작하면 방장·손님 모두 tutorial 단계", hTut.ok && gTut.ok, `${hTut.detail} ${gTut.detail}`.trim());
      if (!hTut.ok || !gTut.ok) return;
      const scenes = await tryDo(async () => {
        await hp.waitForSelector(`${sceneSel(1)}[data-tutorial-mode="together"]`, { timeout: SCENE_WAIT_MS });
        await gp.waitForSelector(`${sceneSel(1)}[data-tutorial-mode="together"]`, { timeout: SCENE_WAIT_MS });
      });
      rec(`${sc}/start`, "TT2", "두 페이지 모두 첫 사건 화면 장면 1(함께 모드)", scenes.ok, scenes.detail);
      if (!scenes.ok) return;
      rec(`${sc}/start`, "TT3", "튜토리얼 단계 view 에 전원 총원 2·끝낸 사람 0", ht.last()?.tutorial?.total === 2 && ht.last()?.tutorial?.done === 0, `done ${ht.last()?.tutorial?.done} / total ${ht.last()?.tutorial?.total}`);
      rec(`${sc}/start`, "TT4", "튜토리얼 중 내 view 에 role 키가 없다(방장·손님)", !("role" in (ht.last()?.me ?? {})) && !("role" in (gt.last()?.me ?? {})), "");

      // ③ 손님 새로 고침(재접속): 아직 끝내지 않았으니 다시 장면 1. 방장은 끝내지 않았으므로 끊긴 손님이 있어도 전원 완료가 아니다(끊긴 사람은 끝난 것으로 센다, 0080-10)
      await reconnect(gp, gt, "손님 재접속");
      const back = await tryDo(async () => {
        await gp.waitForSelector(`${sceneSel(1)}[data-tutorial-mode="together"]`, { timeout: SCENE_WAIT_MS });
      });
      rec(`${sc}/reconnect`, "TR1", "손님이 새로 고치면 다시 장면 1(me.tutorialDone 없음)", back.ok && gt.last()?.me?.tutorialDone !== true && gt.last()?.phase === "tutorial", back.detail);
      rec(`${sc}/reconnect`, "TR2", "방장은 아직 첫 사건 화면(손님 재접속이 단계를 넘기지 않음)", ht.last()?.phase === "tutorial" && (await hp.locator(sceneSel(1)).count()) === 1, `방장 단계 ${ht.last()?.phase}`);

      // ④ 방장이 건너뛰면 기다림 화면: 1 / 2·사람 원 2·시간 막대
      await hp.locator("[data-tutorial-skip]").click();
      const waiting = await tryDo(async () => {
        await hp.waitForSelector('[data-tutorial-wait] [data-tutorial-count="1/2"]', { timeout: SCENE_WAIT_MS });
      });
      rec(`${sc}/wait`, "TW0", "방장이 건너뛰면 기다림 화면 '1 / 2'", waiting.ok, waiting.detail);
      if (!waiting.ok) return;
      await settle(hp);
      const w = await readTutorial(hp);
      rec(`${sc}/wait`, "TW1", "기다림 화면 사람 원 2개·시간 막대", w.wait !== null && w.wait.people === 2 && w.wait.bar !== null && w.wait.track !== null, w.wait === null ? "측정값 없음(기다림 화면)" : `사람 원 ${w.wait.people}개, 막대 ${w.wait.bar !== null}, 막대 틀 ${w.wait.track !== null}`);
      const inside = w.wait?.card && w.wait.card.left >= -0.5 && w.wait.card.right <= vp.w + 0.5 && w.wait.card.top >= -0.5 && w.wait.card.bottom <= vp.h + 0.5;
      rec(`${sc}/wait`, "TW2", "기다림 카드가 화면 안", !!inside, w.wait?.card ? `카드 (${Math.round(w.wait.card.left)},${Math.round(w.wait.card.top)} ${Math.round(w.wait.card.width)}x${Math.round(w.wait.card.height)})` : "측정값 없음(기다림 카드)");
      const hSnap = await collectSnapshot(hp);
      hSnap.issues = host.takeIssues();
      const hBad = genericIssues(hSnap, ctx.size).filter((x) => !x.ok);
      rec(`${sc}/wait`, "G", "G 공통 검사(기다림 화면: 가로 넘침·탭 44·글자 14·콘솔·요청)", hBad.length === 0, hBad.map((x) => `${x.id} ${x.detail}`).join(" / "));
      dom.push(await readLeakDom(hp, "기다림(방장)"));
      rec(`${sc}/wait`, "TW3", "손님은 아직 첫 사건 화면(장면 1)이다", (await gp.locator(sceneSel(1)).count()) === 1, "");

      // 방장 새로 고침: 이미 끝냈으므로(me.tutorialDone) 장면 1 이 아니라 곧바로 기다림 화면
      await reconnect(hp, ht, "방장 재접속");
      const hostBack = await tryDo(async () => {
        await hp.waitForSelector('[data-tutorial-wait] [data-tutorial-count="1/2"]', { timeout: SCENE_WAIT_MS });
      });
      rec(`${sc}/reconnect`, "TR3", "끝낸 방장이 새로 고치면 곧바로 기다림 화면(me.tutorialDone 참)", hostBack.ok && ht.last()?.me?.tutorialDone === true && (await hp.locator("[data-tutorial-screen]").count()) === 0, hostBack.detail);

      // ⑤ 손님이 끝내면 두 페이지 모두 역할 확인(전원 완료)
      await gp.locator("[data-tutorial-skip]").click();
      const [hRole, gRole] = await Promise.all([reaches(ht, "roleReveal"), reaches(gt, "roleReveal")]);
      rec(`${sc}/done`, "TD1", "손님이 끝내면 방장·손님 모두 역할 확인", hRole.ok && gRole.ok, `${hRole.detail} ${gRole.detail}`.trim());
      if (!hRole.ok || !gRole.ok) return;
      await sleep(400);
      dom.push(await readLeakDom(hp, "역할 확인(방장)"), await readLeakDom(gp, "역할 확인(손님)"));
      rec(`${sc}/done`, "TD2", "역할 확인에는 첫 사건 화면이 남지 않는다", (await hp.locator("[data-tutorial-screen], [data-tutorial-wait]").count()) === 0 && (await gp.locator("[data-tutorial-screen], [data-tutorial-wait]").count()) === 0, "");

      // 보낸 프레임: 방장은 시작(start) 뒤, 손님은 시작 전 표시부터 — tutorialDone 한 번뿐(ping·hello 제외)
      const hf = hs.since(hMark);
      const hStart = hf.indexOf("start");
      rec(`${sc}/frames`, "TS3", "방장이 [시작] 으로 start 한 번을 보냈다", hf.filter((t) => t === "start").length === 1, `start ${hf.filter((t) => t === "start").length}건`);
      const hl = sentFrameChecks(hStart < 0 ? null : hf.slice(hStart + 1), ["tutorialDone", "hello"], { once: ["tutorialDone"] });
      rec(`${sc}/frames`, "TS1h", `방장 ${hl.label}, tutorialDone 한 번`, hl.ok, hl.detail);
      const gl = sentFrameChecks(gs.since(gMark), ["tutorialDone", "hello"], { once: ["tutorialDone"] });
      rec(`${sc}/frames`, "TS1g", `손님 ${gl.label}, tutorialDone 한 번`, gl.ok, gl.detail);

      const tally = (list) => [...list.reduce((m, t) => m.set(t, (m.get(t) ?? 0) + 1), new Map())].map(([t, n]) => `${t}×${n}`).join(" ") || "(없음)";
      rec(`${sc}/frames`, "TS4", "참고 측정(판정 아님): 시작부터 역할 확인까지 보낸 프레임(t 종류별 횟수)", true, `방장 ${tally(hf)} / 손님 ${tally(gs.since(gMark))}`, true);

      // 누설: 튜토리얼 밖 화면(대기실·기다림·역할 확인)의 DOM·받은 프레임에 가짜 이름·직업 카드 0, 튜토리얼 중 me.role 0
      const hits = {};
      for (const src of [hs.hits, gs.hits]) for (const [k, n] of Object.entries(src)) hits[k] = (hits[k] ?? 0) + n;
      recAll(rec, `${sc}/leak`, tutorialLeakChecks({ dom, frames: { hits }, roleInTutorial: hs.roleInTutorial + gs.roleInTutorial }));

      // ⑥ 같은 방을 대기실로 되돌려 스위치를 끈 채 시작하면 tutorial 단계 없이 곧장 역할 확인
      await backToLobby(hp, ht);
      await gt.waitFor((v) => v.phase === "lobby", 8000, "손님 대기실 복귀");
      const toggle2 = hp.locator("[data-tutorial-toggle]");
      await toggle2.waitFor({ timeout: 8000 });
      rec(`${sc}/off`, "TF1", "대기실로 돌아오면 스위치가 꺼져 있다", (await toggle2.getAttribute("aria-checked")) === "false", `aria-checked ${await toggle2.getAttribute("aria-checked")}`);
      const hFrom = ht.phases.length;
      const gFrom = gt.phases.length;
      await startGame(hp, ht);
      await gt.waitFor((v) => v.phase === "roleReveal", 8000, "손님 역할 확인");
      const hPhases = ht.phases.slice(hFrom);
      const gPhases = gt.phases.slice(gFrom);
      rec(`${sc}/off`, "TF2", "끄고 시작하면 단계 열에 tutorial 이 없고 역할 확인에 닿는다(방장·손님)", !hPhases.includes("tutorial") && !gPhases.includes("tutorial") && hPhases.includes("roleReveal") && gPhases.includes("roleReveal"), `방장 [${hPhases.join(">")}] 손님 [${gPhases.join(">")}]`);
      rec(`${sc}/off`, "TF3", "끄고 시작하면 첫 사건 화면이 한 번도 없다", (await hp.locator("[data-tutorial-screen], [data-tutorial-wait]").count()) === 0 && (await gp.locator("[data-tutorial-screen], [data-tutorial-wait]").count()) === 0, "");
      rec(`${sc}/time`, "TTIME", "참고 측정(판정 아님): 흐름 소요 시간", true, `${Math.round((performance.now() - t0) / 1000)}초`, true);
    } finally {
      for (const wch of watchers) wch.stop();
      await guestHandle?.context.close().catch(() => {});
    }
  }

  return { tutorialSoloFlow, tutorialTogetherFlow };
}

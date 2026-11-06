// 12페이즈 소리 E2E 흐름 (12-06~). sound-render(12-06), sound-unlock(12-07), sound-script(12-08, 12-10 처형 타이밍), sound-night-parity(12-09, 12-10 동작 누설), sound-result(12-11).
// flows.mjs 가 이미 3천 줄이라 흐름 본문은 이 파일에 둔다. flows.mjs 의 도우미는 `makeSoundFlows(helpers)` 로 받는다(avatar.mjs·politics.mjs 와 같은 모양 — 서로 import 하지 않는다).
// helpers: { recorder, attempt, startHost, openGame, closeGame, nightScenario } (sound-script 는 startHost, sound-night-parity·sound-result 는 openGame·closeGame 을 쓴다)
// 판정 문턱은 lib.mjs 의 순수 검사 함수(soundRenderChecks, SOUND_RENDER_LIMITS)에만 있고 여기서는 낮추지 않는다 (T-12-22).
import { chooseRole, dropSockets, leaveLobby, openTestSheet, reconnectInit, SetupError, setBotVote, setBots, settle, skipTo, sleep, startGame, tapPick } from "./browser.mjs";
import { SOUND_RENDER_LIMITS, SOUND_SCRIPT_STEPS, soundButtonChecks, soundEmoteLeakChecks, soundNightParityChecks, soundRenderChecks, soundResultChecks, soundResultSkipChecks, soundSequenceChecks, soundVerdictTimingChecks } from "./lib.mjs";

/** [전부 계산] 56개 렌더가 끝나기를 기다리는 상한(ms) */
const CALC_LIMIT_MS = 60000;
const LAB_URL = "/?e2e=1&sound-lab=1";

const UNLOCK_URL = "/?e2e=1&test=1";
const UNLOCK_NICK = "소리방장";
/** 훅 상태 기다리는 상한(ms): 탭 → running 은 3초 안 (D-21) */
const HOOK_WAIT_MS = 3000;
const BTN = "[data-sound-button]";

const SCRIPT_NICK = "소리방장";
/** 봇 차례들이 끝나고 변론에 닿는 상한(ms): 지목 모이기 3 + 4명 × (8 + 0.9) + 끝 2 초 안쪽 */
const NOMINATION_WAIT_MS = 45000;
/** 찬반(10초) 안에서 마지막 5초 틱이 두 번 이상 쌓이기까지 기다리는 시간(ms) — 5초째·6초째 틱 */
const VERDICT_TICK_WAIT_MS = 7200;

const infoRow = (rec, scenario, id, detail) => rec(scenario, id, detail.split(" · ")[0], true, detail, true);
const recOne = (rec, scenario, r) => rec(scenario, r.id, r.label, r.ok, r.detail, r.relaxed === true || r.info === true);

/** sound-night-parity: 밤 시작 뒤 이 시각에 손님 하나를 새로고침한다(ms). 큐가 이미 한두 개 난 뒤, 밤 끝(30초)보다 한참 앞 */
const PARITY_RELOAD_AT_MS = 12000;
/** 밤이 서버 타이머로 끝나 아침이 되기를 기다리는 상한(ms): 밤 30초 + 여유 */
const PARITY_MORNING_WAIT_MS = 42000;
/** 아침 진입 뒤 아침 소리(morning.dawn · 400/700ms 분기 · kill.slash +50ms)가 로그에 쌓이도록 기다리는 시간(ms) */
const PARITY_MORNING_SETTLE_MS = 3000;

/** 처형 진입 뒤 로그를 읽기까지 기다리는 시간(ms): 결과 소리(첫 심장 박동 +2.6초)와 떠오름이 로그에 쌓이고 처형 단계(5.6초)가 끝나기 전 */
const EXECUTION_WATCH_MS = 3800;
/** 찬반 단계로 넘긴 뒤 판결 핀이 올라오기를 기다리는 시간(ms) — 로그를 비우기 전에 pin.on 이 찍히게 한다 */
const VERDICT_PIN_SETTLE_MS = 1200;
/** 낮 동작 소리·밤 동작 소리가 로그에 도착하기를 기다리는 상한(ms) */
const EMOTE_ARRIVE_MS = 6000;
/** 결과 연출이 시상 패를 모두 보이는 데까지 기다리는 상한(ms): 5.6초 + 패 1장당 2.5초(넘기기로 줄인다) 안쪽 */
const RESULT_AWARD_WAIT_MS = 14000;
/** 마지막 패 소리와 박수가 로그에 쌓이도록 기다리는 시간(ms) */
const RESULT_TAIL_MS = 600;
/** 건너뛰기 변형: 탭 뒤 원래 조명 시각(4600ms)을 넘겨 늦게 오는 소리가 없는지 볼 때까지 기다리는 시간(ms) */
const RESULT_SKIP_WATCH_MS = 5200;

/** 동작 칸이 풀리기를 기다리며 판을 여닫는 횟수(등장 걷기가 끝나야 칸이 눌린다) */
const EMOTE_OPEN_TRIES = 12;

export function makeSoundFlows({ recorder, attempt, startHost, openGame, closeGame, nightScenario }) {
  /**
   * sound-render: 방 없이 새 컨텍스트(GAME_SIZE)로 시험 페이지를 열고 [전부 계산] → 56개 렌더 결과를 순수 판정 함수로 확인한다.
   * 소리 출력은 없다(OfflineAudioContext). 서버 호출도 없다.
   */
  async function soundRenderFlow(ctx) {
    const rec = recorder(ctx);
    const { w, h } = ctx.size;
    let context = null;
    try {
      context = await ctx.browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: ctx.size.mobile !== false, hasTouch: ctx.size.mobile !== false, locale: "ko-KR" });
      const page = await context.newPage();
      page.setDefaultTimeout(8000);
      await page.goto(`${ctx.origin}${LAB_URL}`, { waitUntil: "domcontentloaded" });
      const open = await attempt(async () => {
        await page.waitForSelector("[data-sound-lab]");
        const n = await page.locator("[data-sound-id]").count();
        return n === SOUND_RENDER_LIMITS.count ? true : { ok: false, detail: `[data-sound-id] ${n}개` };
      });
      rec("sound-render/open", "SL1", `시험 페이지가 열리고 소리 단추 ${SOUND_RENDER_LIMITS.count}개`, open.ok, open.detail);
      if (!open.ok) return;
      await page.click("[data-sound-calc-all]");
      const done = await attempt(async () => {
        await page.waitForFunction(() => window.__mfSoundLab?.done === true, null, { timeout: CALC_LIMIT_MS });
      });
      rec("sound-render/calc", "SL2", `[전부 계산]이 ${CALC_LIMIT_MS / 1000}초 안에 끝남`, done.ok, done.detail);
      if (!done.ok) return;
      const results = await page.evaluate(() => (window.__mfSoundLab?.results ?? []).map((r) => ({ id: r.id, peakDb: r.peakDb, rmsDb: r.rmsDb, nan: r.nan, lengthMs: r.lengthMs, declaredMs: r.declaredMs })));
      for (const line of soundRenderChecks(results)) recOne(rec, "sound-render/results", line);
    } finally {
      await context?.close().catch(() => {});
    }
  }

  /** 훅 상태가 want 가 될 때까지(상한 HOOK_WAIT_MS). 못 되면 마지막 값을 detail 로 */
  const hookIs = (page, want) =>
    attempt(async () => {
      try {
        await page.waitForFunction((w) => window.__mfSound?.state === w, want, { timeout: HOOK_WAIT_MS });
      } catch {
        const now = await page.evaluate(() => window.__mfSound?.state ?? "(훅 없음)").catch(() => "(읽지 못함)");
        return { ok: false, detail: `기대 ${want}, 지금 ${now}` };
      }
    });
  const buttonState = (page) => page.locator(BTN).first().getAttribute("data-sound-state").catch(() => null);
  const buttonCount = (page) => page.locator(BTN).count().catch(() => -1);
  const setVisibility = (page, state) =>
    page.evaluate((st) => {
      Object.defineProperty(document, "visibilityState", { configurable: true, get: () => st });
      document.dispatchEvent(new Event("visibilitychange"));
    }, state);

  /** 단추·헤더·[테스트]·토스트·재접속 띠의 사각형을 한 번에 읽는다(soundButtonChecks 입력) */
  async function readSoundGeometry(page, viewport) {
    return page.evaluate(({ viewport: vp }) => {
      const box = (el) => {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { left: r.left, top: r.top, width: r.width, height: r.height };
      };
      const btns = [...document.querySelectorAll("[data-sound-button]")];
      const b = btns[0] ?? null;
      const header = document.querySelector(".mf-lobby__header");
      const headerButtons = [...document.querySelectorAll(".mf-lobby__header button, .mf-mapchip")].map((el) => ({ kind: el.getAttribute("aria-label") ?? el.className, rect: box(el) }));
      const toastEl = document.querySelector(".mv-toast.is-on .mv-toast__text");
      const toastRect = toastEl && (toastEl.textContent ?? "").trim() !== "" ? box(toastEl) : null;
      const banner = document.querySelector(".mf-reconnect");
      const br = box(banner);
      const rect = box(b);
      let bannerHit = { present: !!banner, covers: false, hitIsButton: false };
      if (br && rect) {
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        bannerHit.covers = cx >= br.left && cx <= br.left + br.width && cy >= br.top && cy <= br.top + br.height;
        const top = document.elementFromPoint(cx, cy);
        bannerHit.hitIsButton = !!top && top.closest("[data-sound-button]") === b;
      }
      const z = b ? getComputedStyle(b).zIndex : null;
      const bannerZ = banner ? getComputedStyle(banner).zIndex : null;
      return {
        viewport: vp,
        button: { count: btns.length, rect, disc: box(b?.querySelector(".mv-sound__face")), pill: !!b?.classList.contains("mv-sound--pill") },
        header: { bottom: header ? header.getBoundingClientRect().bottom : null, buttons: headerButtons.filter((x) => x.rect) },
        test: box(document.querySelector(".mf-lobby__test .mf-tt")),
        toast: toastRect,
        bannerHit,
        labels: { state: b?.getAttribute("data-sound-state") ?? null, name: b?.getAttribute("aria-label") ?? null, pressed: b?.getAttribute("aria-pressed") ?? null },
        z: { button: z, banner: bannerZ },
      };
    }, { viewport });
  }

  /**
   * sound-unlock (D-21): 홈에는 단추가 없고, [방 만들기] 탭 → 훅 running · 단추 on, 단추 토글(ui.toggle 로그), 끈 채 새로고침 → 알약 없음,
   * 켠 채 새로고침 → 알약 → 아무 데나 탭 → running, 탭 숨김 → suspended / 보임 → running, 단추 위치·겹침(SU1~SU7, 재접속 띠 위에서도).
   * 방 없는 새 컨텍스트로 시작해 UI 탭으로 방을 만든다. 소리 출력은 보지 않고 훅의 상태·요청 로그만 읽는다.
   */
  async function soundUnlockFlow(ctx) {
    const rec = recorder(ctx);
    const { w, h } = ctx.size;
    let context = null;
    let page = null;
    try {
      context = await ctx.browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, locale: "ko-KR" });
      await context.addInitScript(reconnectInit);
      page = await context.newPage();
      page.setDefaultTimeout(8000);
      await page.goto(`${ctx.origin}${UNLOCK_URL}`, { waitUntil: "domcontentloaded" });

      // ① 홈(방 없음)에는 소리 단추가 없다
      const home = await attempt(async () => {
        await page.getByRole("button", { name: "방 만들기" }).first().waitFor();
        const n = await buttonCount(page);
        return n === 0 ? true : { ok: false, detail: `홈에 ${BTN} ${n}개` };
      });
      rec("sound-unlock/home", "SK1", "홈에는 소리 단추가 없다", home.ok, home.detail);
      if (!home.ok) return;

      // ② [방 만들기] → 시트 [만들기] 탭 → 3초 안에 running, 단추 on
      const created = await attempt(async () => {
        await page.getByRole("button", { name: "방 만들기" }).first().click();
        await page.locator(".mf-nick-sheet input").fill(UNLOCK_NICK);
        await page.getByRole("button", { name: "만들기", exact: true }).click();
        await page.locator(BTN).first().waitFor({ timeout: 10000 });
      });
      rec("sound-unlock/create", "SK2a", "[만들기] 탭으로 방에 들어가 소리 단추가 그려짐", created.ok, created.detail);
      if (!created.ok) return;
      const running = await hookIs(page, "running");
      rec("sound-unlock/create", "SK2b", `탭 뒤 ${HOOK_WAIT_MS / 1000}초 안에 훅 running`, running.ok, running.detail);
      const st = await buttonState(page);
      rec("sound-unlock/create", "SK2c", "단추 data-sound-state=on", st === "on", `지금 ${st}`);

      // ③ 단추 탭 → off: 훅 off, 로그에 ui.toggle(played 참)이 맨 앞, 그 뒤 played 참 없음
      await page.evaluate(() => window.__mfSound?.clear());
      await page.locator(BTN).first().click();
      const off = await hookIs(page, "off");
      const log = await page.evaluate(() => window.__mfSound?.log ?? []);
      const toggle = log[0];
      const laterPlayed = log.slice(1).filter((e) => e.played).map((e) => e.id);
      rec("sound-unlock/toggle", "SK3a", "단추 탭 → 훅 off · 단추 off", off.ok && (await buttonState(page)) === "off", off.detail);
      rec("sound-unlock/toggle", "SK3b", "로그 맨 앞이 ui.toggle(played 참), 그 뒤 played 참 없음", !!toggle && toggle.id === "ui.toggle" && toggle.played === true && laterPlayed.length === 0, `log ${JSON.stringify(log.map((e) => `${e.id}:${e.played}`))}`);

      // ④ 끈 채 새로고침 → 알약 없음(끈 사람에게 다시 권하지 않는다)
      await page.reload({ waitUntil: "domcontentloaded" });
      const offReload = await attempt(async () => {
        await page.locator(BTN).first().waitFor({ timeout: 10000 });
        await sleep(600);
        const state = await buttonState(page);
        const text = ((await page.locator(BTN).first().textContent()) ?? "").trim();
        return state === "off" && text === "" ? true : { ok: false, detail: `state ${state} · 글 '${text}'` };
      });
      rec("sound-unlock/reload-off", "SK4", "끈 채 새로고침 → data-sound-state=off, 알약(글) 없음", offReload.ok, offReload.detail);

      // ⑤ 켠 채 새로고침 → 알약(locked) → 아무 데나 탭 → running
      await page.locator(BTN).first().click();
      const on = await hookIs(page, "running");
      rec("sound-unlock/reload-on", "SK5a", "off 에서 단추 탭 → 켜짐 · 훅 running", on.ok, on.detail);
      await page.reload({ waitUntil: "domcontentloaded" });
      const pill = await attempt(async () => {
        await page.locator(BTN).first().waitFor({ timeout: 10000 });
        const state = await buttonState(page);
        const text = ((await page.locator(BTN).first().textContent()) ?? "").trim();
        const hook = await page.evaluate(() => window.__mfSound?.state ?? null);
        return state === "locked" && text === "소리 켜기" && hook === "locked" ? true : { ok: false, detail: `state ${state} · 글 '${text}' · 훅 ${hook}` };
      });
      rec("sound-unlock/reload-on", "SK5b", "켠 채 새로고침 → locked, 알약 글 '소리 켜기', 훅 locked", pill.ok, pill.detail);
      const pillBox = await page.evaluate(() => {
        const f = document.querySelector("[data-sound-button] .mv-sound__face")?.getBoundingClientRect();
        return f ? { width: Math.round(f.width * 10) / 10, height: Math.round(f.height * 10) / 10 } : null;
      });
      rec("sound-unlock/reload-on", "SK5i", "참고: 알약 크기", true, pillBox ? `${pillBox.width}x${pillBox.height}` : "측정 못함", true);
      await page.touchscreen.tap(Math.round(w / 2), 6);
      const woke = await hookIs(page, "running");
      rec("sound-unlock/reload-on", "SK5c", `화면 아무 곳 탭 → ${HOOK_WAIT_MS / 1000}초 안에 running · 단추 on`, woke.ok && (await buttonState(page)) === "on", woke.detail);

      // ⑥ 탭 숨김 → suspended, 보임 → running
      await setVisibility(page, "hidden");
      const hid = await hookIs(page, "suspended");
      rec("sound-unlock/visibility", "SK6a", "탭 숨김 → 훅 suspended", hid.ok, hid.detail);
      await setVisibility(page, "visible");
      const vis = await hookIs(page, "running");
      rec("sound-unlock/visibility", "SK6b", "탭 보임 → 훅 running", vis.ok, vis.detail);

      // ⑦ 위치·겹침: 재접속 띠를 띄운 채 읽는다(띠 위에서 단추가 눌림 가능)
      const dropped = await dropSockets(page);
      const banner = await attempt(async () => {
        await page.waitForSelector(".mf-reconnect", { timeout: 8000 });
      });
      rec("sound-unlock/geometry", "SK7", "재접속 띠를 띄움(소켓 끊기)", banner.ok && dropped > 0, banner.detail || `끊은 소켓 ${dropped}개`);
      const g = await readSoundGeometry(page, { w, h });
      infoRow(rec, "sound-unlock/geometry", "SK7z", `참고: z-index 단추 ${g.z.button} · 띠 ${g.z.banner} · 단추 ${JSON.stringify(g.button.rect)} · 시각 ${JSON.stringify(g.button.disc)} · 헤더 아래 끝 ${g.header.bottom}`);
      // 테스트 방이므로 [테스트]·지도 칩이 있어야 SU4 가 공허하지 않다
      rec("sound-unlock/geometry", "SK7t", "[테스트] 버튼이 있어 겹침 검사가 공허하지 않다", !!g.test, g.test ? "" : "[테스트] 사각형을 읽지 못함");
      infoRow(rec, "sound-unlock/geometry", "SK7y", `참고: SU4 상대 ${g.header.buttons.length}개 · [테스트] ${JSON.stringify(g.test)} · 토스트 ${JSON.stringify(g.toast)}`);
      for (const line of soundButtonChecks(g)) recOne(rec, "sound-unlock/geometry", line);
    } finally {
      if (page) await leaveLobby(page);
      await context?.close().catch(() => {});
    }
  }

  const readLog = (page) => page.evaluate(() => (window.__mfSound ? window.__mfSound.log.map((e) => ({ id: e.id, at: e.at, gain: e.gain, played: e.played })) : null));
  /** 소리 id 가 로그에 찍히기를 기다린 뒤 로그를 돌려준다. 상태 프레임이 도착한 순간과 화면(감독)이 그 프레임을 처리한 순간은 부하가 높으면 몇백 ms 어긋난다 — 정해진 시점에 곧바로 읽지 않는다. 기대(판정)는 그대로이고 기다리기만 한다 */
  const readLogWith = async (page, id, ms = 3000) => {
    const t0 = Date.now();
    for (;;) {
      const log = await readLog(page);
      if (log === null || log.some((e) => e.id === id) || Date.now() - t0 > ms) return log;
      await new Promise((r) => setTimeout(r, 100));
    }
  };
  const clearLog = (page) => page.evaluate(() => window.__mfSound?.clear());

  /**
   * sound-script (D-21): 테스트 방 + 봇 3 + testSkip 으로 로비 → 시작 → 역할 확인 → 낮 → 지목 → 변론 → 찬반을 지나며
   * 단계마다 훅 로그(window.__mfSound.log)에 기대 id 가 순서대로 있는지 본다(구간은 clear() 로 나눈다, 기대는 lib.mjs SOUND_SCRIPT_STEPS).
   * 마지막에 새로고침 직후 로그에 현재 단계 침대 요청만 있고 일회성 소리가 없음을 확인한다(LS-10). 소리 출력은 보지 않는다 — 요청 로그만 읽는다.
   * 밤·아침(12-09)은 새로고침 뒤 testSkip 으로 이어서 본다. 처형·결과는 12-10·12-11 이 같은 표와 이 흐름에 단계를 더한다.
   */
  async function soundScriptSteps(ctx, rec) {
    const step = (id) => SOUND_SCRIPT_STEPS.find((x) => x.id === id);
    const judge = (scenario, id, log) => {
      if (log === null) return rec(scenario, id, step(id).label, false, "window.__mfSound 훅이 없음(?e2e=1 세션 플래그가 꺼짐)");
      recOne(rec, scenario, soundSequenceChecks([log], [step(id)])[0]);
    };
    const host = await startHost(ctx, "sound-script", { nickname: SCRIPT_NICK });
    const { page: hp, tracker: ht } = host;
    try {
      // ① 로비: 방 화면이 열리면 침대 요청 하나
      const hooked = await attempt(async () => {
        await hp.waitForFunction(() => !!window.__mfSound && window.__mfSound.log.length > 0, null, { timeout: 6000 });
        await sleep(300);
      });
      rec("sound-script/lobby", "SC0", "방 화면이 열리면 소리 훅이 있고 로그가 찬다", hooked.ok, hooked.detail);
      if (!hooked.ok) return;
      judge("sound-script/lobby", "SC1", await readLog(hp));

      // ② 봇이 앉으면 lobby.join
      await clearLog(hp);
      await openTestSheet(hp);
      await setBots(hp, ht, 3);
      await sleep(300);
      judge("sound-script/lobby", "SC2", await readLog(hp));
      await setBotVote(hp, ht, { exec: "yes", pick: "host" });
      await chooseRole(hp, ht, "citizen");

      // ③ 시작 → assigning(침대 정지 요청, game.start) → roleReveal(bed.reveal, role.flip)
      await clearLog(hp);
      // 배정(3초) 창은 startGame 이 화면을 기다리는 사이 지나갈 수 있어, game.start 가 로그에 찍히는 순간을 따로 잡는다
      const watch = hp
        .waitForFunction(() => !!window.__mfSound && window.__mfSound.log.some((e) => e.id === "game.start"), null, { timeout: 8000, polling: 30 })
        .then(async () => {
          const log = await readLog(hp);
          const bed = await hp.evaluate(() => window.__mfSound?.bed ?? null);
          await clearLog(hp);
          return { log, bed };
        })
        .catch(() => null);
      await startGame(hp, ht);
      const caught = await watch;
      const assigning = caught?.log ?? null;
      const bedAtAssigning = caught === null ? "(못 잡음)" : caught.bed;
      const reveal = await readLogWith(hp, "bed.reveal");
      judge("sound-script/assigning", "SC3", assigning ?? reveal);
      rec("sound-script/assigning", "SC3b", "assigning 동안 침대 정지 요청(훅 bed 가 null)", assigning !== null && bedAtAssigning === null, assigning === null ? "배정 3초 창을 잡지 못함" : `bed ${JSON.stringify(bedAtAssigning)}`);
      judge("sound-script/roleReveal", "SC4", reveal);

      // ④ 낮: dayAnnounce 진입 day.start + bed.day, discussion 으로 넘어가도 침대 요청은 늘지 않는다
      await clearLog(hp);
      await skipTo(hp, ht, "discussion");
      await sleep(500);
      judge("sound-script/day", "SC5", await readLog(hp));

      // ⑤ 투표(기본판, 동시 15초): 진입 phase.vote + bed.vote. 차례 소리(pin.on·pick.turn·pick.tick)는 없다
      await clearLog(hp);
      await skipTo(hp, ht, "nomination");
      await ht.waitFor((v) => v.phase === "nomination", 5000, "투표 진입").catch(() => {});
      await sleep(800);
      judge("sound-script/nomination", "SC6", await readLogWith(hp, "phase.vote"));

      // ⑥ 방장이 한 사람을 누른다: 눌림은 로컬 소리가 없고(차례 소리 pick.point·pin.move 도 없음) 새 침대도 없다
      await clearLog(hp);
      const me = ht.last().me.seat;
      const target = ht.last().players.find((x) => x.seat !== me)?.seat;
      const picked = await attempt(async () => {
        await tapPick(hp, target);
        await sleep(500);
      });
      rec("sound-script/nomination", "SC7w", "방장이 이름표 버튼을 눌러 눌림 표시가 선다", picked.ok, picked.detail);
      if (!picked.ok) return;
      judge("sound-script/nomination", "SC7", await readLog(hp));

      // ⑦ 봇 투표 → 변론: 봇 표(2~8초)가 들어오고 투표가 끝나 변론에 닿는다. 차례 소리 없음, 변론 진입에도 새 침대 없음
      await clearLog(hp);
      const defense = await attempt(async () => {
        await ht.waitFor((v) => v.phase === "defense", NOMINATION_WAIT_MS, "변론");
        await sleep(500);
      });
      rec("sound-script/defense", "SC8w", "투표가 끝나고 변론에 닿는다", defense.ok, defense.detail);
      if (!defense.ok) return;
      judge("sound-script/defense", "SC8", await readLog(hp));

      // ⑧ 찬반: 마지막 5초 timer.tick 이 초마다, 새 침대 요청 없음
      await clearLog(hp);
      await skipTo(hp, ht, "verdict");
      await sleep(VERDICT_TICK_WAIT_MS);
      judge("sound-script/verdict", "SC9", await readLog(hp));

      // ⑨ 낮 중간 새로고침: 첫 스냅샷은 현재 단계 침대만
      await hp.reload({ waitUntil: "domcontentloaded" });
      const back = await attempt(async () => {
        await hp.waitForFunction(() => !!window.__mfSound && window.__mfSound.log.length > 0, null, { timeout: 10000 });
        await sleep(1500);
      });
      rec("sound-script/reload", "SC10w", "새로고침 뒤 방 화면이 다시 열려 훅 로그가 찬다", back.ok, back.detail);
      if (!back.ok) return;
      judge("sound-script/reload", "SC10", await readLog(hp));

      // ⑩ 밤 → 아침 (12-09, testSkip): 진입 소리와 침대만 본다. 큐·역할별 동일성·암살음은 sound-night-parity 몫
      await clearLog(hp);
      await skipTo(hp, ht, "night");
      await sleep(700);
      judge("sound-script/night", "SC11", await readLog(hp));
      await clearLog(hp);
      await skipTo(hp, ht, "morning");
      await sleep(800);
      judge("sound-script/morning", "SC12", await readLog(hp));
    } finally {
      await host.context.close().catch(() => {});
    }
  }

  /**
   * 처형 판결 순간(12-10, D-13): 방장 + 봇 3 이 방장을 변론자로 세워 변론 → 찬반 → 처형에 들어서고, 처형 진입 뒤 실제 시간으로 훅 로그를 읽는다.
   * kind "pass" 는 봇 전원 찬성(처형 성립), "reject" 는 전원 반대(부결). 두 판의 로그를 lib.mjs soundVerdictTimingChecks 가 비교한다(문턱은 거기에만).
   * 투표 단계는 봇 둘 이상이 방장을 가리킬 때까지만 기다린 뒤(방장은 누르지 않는다) testSkip 으로 변론·찬반을 건너뛴다.
   */
  async function soundVerdictWatch(ctx, rec, kind) {
    const sc = `sound-script/execution-${kind}`;
    const game = await openGame(ctx, "sound-script", { guests: 0, bots: 3, role: "citizen", vote: { exec: kind === "pass" ? "yes" : "no", pick: "host" }, to: "nomination" });
    try {
      const { hp, ht, hostSeat } = game;
      const hooked = await attempt(async () => {
        await hp.waitForFunction(() => !!window.__mfSound, null, { timeout: 6000 });
      });
      rec(sc, "SV0", "방장 페이지에 소리 훅이 있다(?e2e=1 세션 플래그)", hooked.ok, hooked.detail);
      if (!hooked.ok) return null;
      const nominated = await attempt(async () => {
        await ht.waitFor((v) => (v.day?.points ?? []).filter((p) => p.target === hostSeat).length >= 2, NOMINATION_WAIT_MS, "봇 둘이 방장을 가리킴");
      });
      rec(sc, "SV1", "봇 둘 이상이 방장을 가리킨다(기본판 동시 투표, 변론자가 정해진다)", nominated.ok, nominated.detail);
      if (!nominated.ok) return null;
      await skipTo(hp, ht, "defense");
      await skipTo(hp, ht, "verdict");
      // 판결 핀(pin.on)이 올라오는 중에 로그를 비우면 pin.on 이 처형 쪽 로그 앞머리에 들어가는 판과 아닌 판이 갈린다 — 올라온 뒤에 비운다
      await sleep(VERDICT_PIN_SETTLE_MS);
      await clearLog(hp);
      await skipTo(hp, ht, "execution");
      await sleep(EXECUTION_WATCH_MS);
      const still = ht.last().phase === "execution";
      const log = await readLog(hp);
      rec(sc, "SV2", "처형 진입 뒤 로그를 읽는 순간에도 처형 단계다(처형 전체를 지켜봄)", still && log !== null, still ? (log === null ? "훅 로그 없음" : `로그 ${log.length}줄`) : `단계 ${ht.last().phase}`);
      return still ? log : null;
    } finally {
      await closeGame(game);
    }
  }

  async function soundScriptFlow(ctx) {
    const rec = recorder(ctx);
    await soundScriptSteps(ctx, rec);
    // 12-10: 처형 순간을 실제 시간으로 — 통과 판과 부결 판의 로그를 같은 순수 판정 함수에 넣는다
    const pass = await soundVerdictWatch(ctx, rec, "pass");
    const reject = await soundVerdictWatch(ctx, rec, "reject");
    for (const line of soundVerdictTimingChecks({ pass, reject })) recOne(rec, "sound-script/execution", line);
    const gap = (log, id) => {
      const heart = log?.find((e) => e.id === "verdict.heart");
      const hit = log?.find((e) => e.id === id);
      return heart && hit ? Math.round(hit.at - heart.at) : null;
    };
    const hearts = (log) => log?.filter((e) => e.id === "verdict.heart").length ?? 0;
    infoRow(rec, "sound-script/execution-info", "SVi-1", `참고: 통과 판 verdict.heart ${hearts(pass)}개 · gavel 간격 ${gap(pass, "execution.gavel")}ms · rise 간격 ${gap(pass, "execution.rise")}ms`);
    infoRow(rec, "sound-script/execution-info", "SVi-2", `참고: 부결 판 verdict.heart ${hearts(reject)}개 · reject 간격 ${gap(reject, "verdict.reject")}ms`);
  }

  /** 동작 칸을 눌러 보낸다(등장 걷기·앞 동작이 끝나 칸이 풀릴 때까지 판을 여닫으며 기다린다) */
  const sendEmote = (page, id) =>
    attempt(async () => {
      for (let i = 0; i < EMOTE_OPEN_TRIES; i += 1) {
        if ((await page.locator("[data-emote-tray]").count()) === 0) await page.locator("[data-emote-button]").click({ timeout: 3000 });
        await page.waitForSelector("[data-emote-tray]", { timeout: 1500 });
        const off = await page.locator(`[data-emote="${id}"]`).getAttribute("aria-disabled");
        if (off !== "true") {
          await page.locator(`[data-emote="${id}"]`).click({ timeout: 3000 });
          return;
        }
        await page.locator("[data-emote-button]").click({ timeout: 3000 });
        await sleep(1000);
      }
      return { ok: false, detail: "동작 칸이 풀리지 않음" };
    });
  /** 훅 로그에 emote.* 가 want 개 이상 찍히기를 기다린다(상한 EMOTE_ARRIVE_MS). 못 채워도 읽은 로그를 돌려준다 */
  async function waitEmoteLog(page, want) {
    const start = Date.now();
    let log = await readLog(page);
    while ((log?.filter((e) => e.id.startsWith("emote.")).length ?? 0) < want && Date.now() - start < EMOTE_ARRIVE_MS) {
      await sleep(150);
      log = await readLog(page);
    }
    return log;
  }

  /**
   * sound-night-parity (D-21, LS-3·LS-7·LS-8·LS-10): 방장(마피아) + 사람 손님 셋 + 봇 하나(5명 → 마피아는 방장 하나라 손님은 모두 비마피아).
   * 방장이 손님 한 명(피해자)을 일부러 고르고(밤 UI 조작) 밤 30초를 실제로 기다린다. 손님 하나는 밤 중간에 새로고침한다.
   * 판정은 lib.mjs soundNightParityChecks (문턱은 거기에만 있고 여기서는 낮추지 않는다). 소리 출력은 보지 않는다 — 훅 요청 로그만 읽는다.
   */
  async function soundNightParityRun(ctx, rec) {
    const sc = "sound-night-parity";
    const game = await openGame(ctx, "sound-night-parity", { guests: 3, bots: 1, role: "mafia", vote: { exec: "no", pick: "other" }, to: "discussion" });
    try {
      const { hp, ht, hostSeat, guests } = game;
      if (ht.last().me.role !== "mafia") throw new SetupError(`방장 직업이 마피아가 아님 (${ht.last().me.role})`);
      const roles = guests.map((g) => g.tracker.last()?.me?.role ?? "?");
      if (roles.includes("mafia")) throw new SetupError(`손님 중 마피아가 있음 (${roles.join(",")})`);
      let victim = guests[0];
      let decoy = guests[1];
      const pages = [
        { label: "방장(마피아)", page: hp, tracker: ht },
        { label: `손님1(피해자·${roles[0]})`, page: victim.page, tracker: victim.tracker },
        { label: `손님2(${roles[1]})`, page: decoy.page, tracker: decoy.tracker },
        { label: `손님3(${roles[2]}·새로고침)`, page: guests[2].page, tracker: guests[2].tracker, reloaded: true },
      ];
      let victimLabel = pages[1].label;
      const hooked = await attempt(async () => {
        for (const p of pages) await p.page.waitForFunction(() => !!window.__mfSound, null, { timeout: 6000 });
      });
      rec(`${sc}/setup`, "NP0", "네 페이지 모두 소리 훅이 있다(?e2e=1 세션 플래그)", hooked.ok, hooked.detail);
      if (!hooked.ok) return;

      // 12-10 낮 동작(E3): 방장이 박수를 보내면 보낸 쪽 로그는 gain 1, 받은 쪽(손님2) 로그는 gain 0.5 안팎(−6dB)
      for (const p of pages) await clearLog(p.page);
      const dayEmote = await sendEmote(hp, "clap");
      rec(`${sc}/emote`, "NP4", "방장이 낮에 동작 칸을 눌러 보낸다", dayEmote.ok, dayEmote.detail);
      const daySenderLog = dayEmote.ok ? await waitEmoteLog(hp, 1) : null;
      const dayReceiverLog = dayEmote.ok ? await waitEmoteLog(decoy.page, 1) : null;

      // 낮에서 밤으로: 로그를 비운 뒤 밤으로 넘긴다(밤 앞의 시험 시트 눌림은 밤 구간이 아니다 — 판정이 첫 bed.night 부터 자른다)
      for (const p of pages) await clearLog(p.page);
      await skipTo(hp, ht, "night");
      const nightStart = Date.now();
      for (const p of pages) await p.tracker.waitFor((v) => v.phase === "night", 9000, `${p.label} 밤 도착`);

      // 밤 UI 를 일부러 만진다(LS-7): 방장은 피해자 이름표를 눌러 확정하고(마피아가 하나라 바로 확정), 손님들은 화면을 만진다. 모두 무음이어야 한다
      const picked = await attempt(async () => {
        // 밤 진입 장면 전환 막이 걷히고 이름표 버튼이 그려진 뒤에 누른다(막 위에서는 눌림이 가로막힌다)
        await hp.waitForFunction(() => !document.querySelector("[data-curtain]"), null, { timeout: 8000 });
        await hp.waitForSelector(`[data-pick="${victim.seat}"]`, { timeout: 8000 });
        await settle(hp);
        // 밤 카메라가 마피아(방장)를 따라가서 어떤 이름표는 화면 밖(x<0)에 있다 — 눌림이 불가능하다(이 페이즈 이전부터의 알려진 밤 이름표 위치, 소리 단추와 무관).
        // 화면 안에 있는 쪽이 피해자가 되도록 첫 두 손님의 역할(피해자·보조)을 바꾼다. 판정은 바뀐 라벨로 한다
        const inView = (seat) => hp.evaluate((s) => { const b = document.querySelector(`[data-pick="${s}"]`); if (!b) return false; const r = b.getBoundingClientRect(); return r.left >= 0 && r.right <= window.innerWidth && r.top >= 0 && r.bottom <= window.innerHeight; }, seat);
        if (!(await inView(victim.seat)) && (await inView(decoy.seat))) {
          [victim, decoy] = [decoy, victim];
          const labels = [`손님1(피해자·${roles[1]})`, `손님2(${roles[0]})`];
          pages[1] = { label: labels[0], page: victim.page, tracker: victim.tracker };
          pages[2] = { label: labels[1], page: decoy.page, tracker: decoy.tracker };
          victimLabel = labels[0];
        }
        await tapPick(hp, victim.seat);
      });
      rec(`${sc}/night`, "NP1", "방장이 밤에 이름표를 눌러 피해자를 고른다(밤 UI 조작)", picked.ok, picked.detail);
      for (const g of guests) await g.page.touchscreen.tap(Math.round(ctx.size.w / 2), Math.round(ctx.size.h / 3)).catch(() => {});
      // 12-10 밤 동작(E1·E2): 마피아 방장만 동작 칸이 있다 — 서버가 마피아 채널로만 보내므로 시민 편 손님 로그에는 emote.* 가 없어야 한다
      const nightEmote = await sendEmote(hp, "throat");
      rec(`${sc}/emote`, "NP5", "마피아 방장이 밤에 동작 칸을 눌러 보낸다", nightEmote.ok, nightEmote.detail);
      if (nightEmote.ok) await waitEmoteLog(hp, 1);
      await sleep(Math.max(0, PARITY_RELOAD_AT_MS - (Date.now() - nightStart)));

      // 밤 중간 새로고침(LS-10): night.fall 이 없고 침대만 + 남은 시간의 새 큐
      const reloadPage = pages[3].page;
      await reloadPage.reload({ waitUntil: "domcontentloaded" });
      const back = await attempt(async () => {
        await reloadPage.waitForFunction(() => !!window.__mfSound && window.__mfSound.log.some((e) => e.id === "bed.night"), null, { timeout: 10000 });
      });
      rec(`${sc}/reload`, "NP2", "밤 중간 새로고침 뒤 방 화면이 다시 열려 훅 로그에 bed.night 가 찬다", back.ok, back.detail);
      if (!back.ok) return;

      // 밤이 끝나 아침이 되고 아침 소리가 쌓이기를 기다린다(밤은 실제로 30초)
      await ht.waitFor((v) => v.phase === "morning", PARITY_MORNING_WAIT_MS, "밤 뒤 아침(서버 타이머)");
      const morning = ht.last().day?.morning;
      // 의사 봇·의사 손님이 우연히 피해자를 지키면(구출 아침) 암살음이 날 수 없다 — 새 방으로 다시 돈다
      if (morning?.eliminated !== victim.seat) throw new SetupError(`피해자가 탈락하지 않음 (아침 결과 ${JSON.stringify(morning ?? null)}, 방장 자리 ${hostSeat})`);
      await sleep(PARITY_MORNING_SETTLE_MS);

      const logs = [];
      for (const p of pages) logs.push({ label: p.label, log: await readLog(p.page), ...(p.reloaded ? { reloaded: true } : {}) });
      if (logs.some((l) => l.log === null)) {
        rec(`${sc}/judge`, "NP3", "모든 페이지에서 훅 로그를 읽었다", false, "window.__mfSound 훅이 없음");
        return;
      }
      for (const line of soundNightParityChecks({ pages: logs, victimLabel })) recOne(rec, `${sc}/judge`, line);
      // 12-10: 동작 소리 누설 — 보낸 마피아 로그 1개, 시민 편 손님 로그 0개, 낮 동작 gain
      for (const line of soundEmoteLeakChecks({
        senderLog: logs[0].log,
        otherLogs: logs.slice(1).map((l) => ({ label: l.label, log: l.log })),
        day: daySenderLog && dayReceiverLog ? { senderLog: daySenderLog, receiverLog: dayReceiverLog } : undefined,
      })) recOne(rec, `${sc}/emote-judge`, line);
      // 참고(판정 아님): 페이지별 밤 id 집합과 night.cue 개수 — SUMMARY 에 옮긴다
      for (const l of logs) {
        const ids = l.log.map((e) => e.id);
        const from = ids.indexOf("bed.night");
        const to = ids.indexOf("bed.dawn", Math.max(0, from));
        const night = from < 0 ? [] : ids.slice(from, to < 0 ? undefined : to);
        infoRow(rec, `${sc}/info`, `NPi-${logs.indexOf(l) + 1}`, `참고: ${l.label} 밤 {${[...new Set(night)].sort().join(", ")}} · night.cue ${night.filter((id) => id === "night.cue").length}개 · 아침 [${ids.slice(to < 0 ? ids.length : to).join(", ")}]`);
      }
    } finally {
      await closeGame(game);
    }
  }

  async function soundNightParityFlow(ctx) {
    const rec = recorder(ctx);
    await nightScenario(ctx, () => soundNightParityRun(ctx, rec));
  }

  /** 처형 단계에서 훅 로그를 비운 뒤 ended 로 넘긴다. 부하로 마감이 먼저 지나 이미 ended 면 그대로 둔다 */
  async function toEndedLogged(hp, ht) {
    await skipTo(hp, ht, "execution");
    await clearLog(hp);
    try {
      await skipTo(hp, ht, "ended");
    } catch (e) {
      if (ht.last().phase !== "ended") throw e;
    }
    await ht.waitFor((v) => v.phase === "ended", 8000, "종료 도달");
  }

  /** 새 판(방장 마피아 + 봇 3, 방장이 처형되어 시민 승)을 처형까지 몰아 간다. 방장이 변론자가 되도록 봇은 방장을 가리킨다 */
  const openResultGame = (ctx) => openGame(ctx, "sound-result", { guests: 0, bots: 3, role: "mafia", vote: { exec: "yes", pick: "host" }, to: "nomination" });
  async function toExecution(game) {
    const { hp, ht } = game;
    await skipTo(hp, ht, "defense");
    await skipTo(hp, ht, "verdict");
  }

  /**
   * sound-result 본판 (D-21): ended 도착 순간부터 연출 시계를 건너뛰지 않고 끝까지 본다. 시상은 패가 뜰 때까지 기다린 뒤 [넘기기]로 줄인다(패마다 소리는 한 번).
   * 로그는 ended 도착 직전에 비운다. 판정은 lib.mjs soundResultChecks(R1~R5), 새로고침 직후 로그는 R6.
   */
  async function soundResultMain(ctx, rec) {
    const sc = "sound-result/main";
    const game = await openResultGame(ctx);
    try {
      const { hp, ht } = game;
      const hooked = await attempt(async () => {
        await hp.waitForFunction(() => !!window.__mfSound, null, { timeout: 6000 });
      });
      rec(sc, "SR0", "방장 페이지에 소리 훅이 있다(?e2e=1 세션 플래그)", hooked.ok, hooked.detail);
      if (!hooked.ok) return;
      await toExecution(game);
      await toEndedLogged(hp, ht);
      const view = ht.last();
      const seats = view.result?.seats ?? [];
      const mine = seats.find((x) => x.seat === view.me.seat);
      const expectWin = mine ? (mine.job === "mafia") === (view.result?.winner === "mafiaWin") : undefined;
      const hooks = await attempt(async () => {
        await hp.waitForFunction(() => (window.__mfResult?.awards?.length ?? 0) > 0, null, { timeout: 8000 });
      });
      rec(sc, "SR1", "결과 화면 훅에 시상 칭호 목록이 있다", hooks.ok, hooks.detail);
      if (!hooks.ok) return;
      const awards = await hp.evaluate(() => window.__mfResult.awards.length);

      // 시상: 패가 뜰 때까지 기다린 뒤 [넘기기]. 마지막 패는 소리가 쌓이도록 잠깐 기다린다
      const paged = await attempt(async () => {
        for (let k = 0; k < awards; k += 1) {
          await hp.waitForFunction((w) => window.__mfResult?.shown === w, k, { timeout: RESULT_AWARD_WAIT_MS });
          if (k < awards - 1) await hp.locator('[data-float="skip"]').click({ timeout: 2000 });
          else await sleep(RESULT_TAIL_MS);
        }
      });
      rec(sc, "SR2", `시상 패 ${awards}장이 차례로 뜬다`, paged.ok, paged.detail);
      if (!paged.ok) return;
      const log = await readLog(hp);

      // 같은 페이지 새로고침: 연출 없는 마운트라 침대만
      await hp.reload({ waitUntil: "domcontentloaded" });
      const back = await attempt(async () => {
        await hp.waitForFunction(() => !!window.__mfSound && window.__mfSound.log.some((e) => e.id === "bed.result"), null, { timeout: 10000 });
        await sleep(2500);
      });
      rec(sc, "SR3", "새로고침 뒤 결과 화면이 다시 열려 훅 로그에 bed.result 가 찬다", back.ok, back.detail);
      const reloadLog = back.ok ? await readLog(hp) : null;
      if (log === null) {
        rec(sc, "SR4", "결과 구간 훅 로그를 읽었다", false, "window.__mfSound 훅이 없음");
        return;
      }
      for (const line of soundResultChecks({ log, participants: seats.length, awards, expectWin, reloadLog })) recOne(rec, sc, line);
      const counts = (l, p) => l.filter((e) => p(e.id)).length;
      infoRow(
        rec,
        `${sc}-info`,
        "SRi-1",
        `참고: role.flip ${counts(log, (id) => id === "role.flip")}개 · result.win/lose ${counts(log, (id) => id.startsWith("result."))}회 · award.plate ${counts(log, (id) => id === "award.plate")}개 · award.final ${counts(log, (id) => id === "award.final")}개 · 박수 ${counts(log, (id) => id === "emote.clap")}개 · 참가자 ${seats.length} · 패 ${awards}`,
      );
    } finally {
      await closeGame(game);
    }
  }

  /** sound-result 건너뛰기 변형: 연출 구간(모임·뒤집기)에서 무대를 한 번 탭하면 건너뛴 뒤집기 소리가 없고 승패 소리만 한 번 난다 */
  async function soundResultSkip(ctx, rec) {
    const sc = "sound-result/skip";
    const game = await openResultGame(ctx);
    try {
      const { hp, ht } = game;
      await toExecution(game);
      await toEndedLogged(hp, ht);
      const seats = ht.last().result?.seats ?? [];
      const windowed = await attempt(async () => {
        await hp.waitForFunction(() => ["gather", "flip"].includes(window.__mfResult?.stage ?? ""), null, { timeout: 4000 });
        const mid = await hp.evaluate(() => {
          const root = document.querySelector(".mf-result");
          const head = root?.querySelector("header")?.getBoundingClientRect();
          const panel = root?.querySelector("[data-result-panel]")?.getBoundingClientRect();
          if (!root || !head || !panel) return null;
          return { x: window.innerWidth / 2, y: (head.bottom + panel.top) / 2 };
        });
        if (!mid) return { ok: false, detail: "결과 화면 무대 가운데를 못 잼" };
        await hp.mouse.click(mid.x, mid.y);
      });
      rec(sc, "SK0", "연출 구간(모임·뒤집기)에서 무대를 한 번 탭한다", windowed.ok, windowed.detail);
      if (!windowed.ok) return;
      await sleep(RESULT_SKIP_WATCH_MS);
      const log = await readLog(hp);
      if (log === null) {
        rec(sc, "SK1", "훅 로그를 읽었다", false, "window.__mfSound 훅이 없음");
        return;
      }
      for (const line of soundResultSkipChecks({ log, participants: seats.length })) recOne(rec, sc, line);
    } finally {
      await closeGame(game);
    }
  }

  async function soundResultFlow(ctx) {
    const rec = recorder(ctx);
    await soundResultMain(ctx, rec);
    await soundResultSkip(ctx, rec);
  }

  return { soundRenderFlow, soundUnlockFlow, soundScriptFlow, soundNightParityFlow, soundResultFlow };
}

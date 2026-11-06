// 12페이즈 소리 E2E 흐름 (12-06~). sound-render(12-06), sound-unlock(12-07). 이후 계획이 sound-script·sound-night-parity·sound-result 를 같은 파일에 더한다.
// flows.mjs 가 이미 3천 줄이라 흐름 본문은 이 파일에 둔다. flows.mjs 의 도우미는 `makeSoundFlows(helpers)` 로 받는다(avatar.mjs·politics.mjs 와 같은 모양 — 서로 import 하지 않는다).
// helpers: { recorder, attempt }
// 판정 문턱은 lib.mjs 의 순수 검사 함수(soundRenderChecks, SOUND_RENDER_LIMITS)에만 있고 여기서는 낮추지 않는다 (T-12-22).
import { dropSockets, leaveLobby, reconnectInit, sleep } from "./browser.mjs";
import { SOUND_RENDER_LIMITS, soundButtonChecks, soundRenderChecks } from "./lib.mjs";

/** [전부 계산] 56개 렌더가 끝나기를 기다리는 상한(ms) */
const CALC_LIMIT_MS = 60000;
const LAB_URL = "/?e2e=1&sound-lab=1";

const UNLOCK_URL = "/?e2e=1&test=1";
const UNLOCK_NICK = "소리방장";
/** 훅 상태 기다리는 상한(ms): 탭 → running 은 3초 안 (D-21) */
const HOOK_WAIT_MS = 3000;
const BTN = "[data-sound-button]";

const infoRow = (rec, scenario, id, detail) => rec(scenario, id, detail.split(" · ")[0], true, detail, true);
const recOne = (rec, scenario, r) => rec(scenario, r.id, r.label, r.ok, r.detail, r.relaxed === true || r.info === true);

export function makeSoundFlows({ recorder, attempt }) {
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

  return { soundRenderFlow, soundUnlockFlow };
}

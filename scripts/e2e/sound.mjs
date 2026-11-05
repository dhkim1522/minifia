// 12페이즈 소리 E2E 흐름 (12-06~). sound-render(12-06). 이후 계획이 sound-unlock·sound-script·sound-night-parity·sound-result 를 같은 파일에 더한다.
// flows.mjs 가 이미 3천 줄이라 흐름 본문은 이 파일에 둔다. flows.mjs 의 도우미는 `makeSoundFlows(helpers)` 로 받는다(avatar.mjs·politics.mjs 와 같은 모양 — 서로 import 하지 않는다).
// helpers: { recorder, attempt }
// 판정 문턱은 lib.mjs 의 순수 검사 함수(soundRenderChecks, SOUND_RENDER_LIMITS)에만 있고 여기서는 낮추지 않는다 (T-12-22).
import { SOUND_RENDER_LIMITS, soundRenderChecks } from "./lib.mjs";

/** [전부 계산] 56개 렌더가 끝나기를 기다리는 상한(ms) */
const CALC_LIMIT_MS = 60000;
const LAB_URL = "/?e2e=1&sound-lab=1";

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

  return { soundRenderFlow };
}

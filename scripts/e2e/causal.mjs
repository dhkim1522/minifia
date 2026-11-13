// 21페이즈 원인→결과 하루 E2E 흐름 (21-16, UI-SPEC "E2E 표식과 판정" LH1~LH14, D-29): causal-day(390x844 한 판 완주)·causal-leak(390x844 마피아·시민 DOM 비교)·causal-sizes(폰 6종 겹침·보임).
// 흐름은 화면·훅 값을 읽기만 하고 판정은 lib.mjs 의 순수 함수(causalDayChecks·causalEveningChecks·nightPlateChecks·causalWindowChecks·sceneSpotChecks·boardChecks·domShapeDiff·causalReducedChecks)에 맡긴다 — 문턱은 여기서 낮추지 않는다.
// 모두 로컬 dev 서버용이다(배포본 대상 실행 없음, Durable Object 무료 한도). 닉네임·토큰·DOM 문자열은 결과 줄에 싣지 않는다 — 좌석 번호·개수·단계 이름·표식 이름만 쓴다.
// 심부름(저녁 40초)·현장(아침 30초)은 실제 시간이라 시간 안에 못 끝낸 것은 흐름 결함이 아니라 환경 지연이다 — SetupError 로 던져 실행기가 새 방으로 다시 돈다.
// helpers 는 flows.mjs 가 넘긴다(서로 import 하지 않는다): { recorder, openGame, closeGame }
import { spawnSync } from "node:child_process";
import { SetupError, collectSnapshot, domShape, longPress, skipOnce, skipTo, sleep, waitErrandDone, walkToPlace } from "./browser.mjs";
import {
  CAUSAL_CLUE_SPOTS,
  ERRAND_ACT_R_E2E,
  boardChecks,
  causalDayChecks,
  causalEveningChecks,
  causalReducedChecks,
  causalWindowChecks,
  domShapeDiff,
  genericIssues,
  nightPlateChecks,
  sameOutfitSeatsE2E,
  sceneSpotChecks,
} from "./lib.mjs";

/** 길게 누르기 시간(ms): 서버·화면이 보는 0.6초보다 길다 */
const HOLD_MS = 700;
/** 한 가로등을 향해 걸어 켜는 최대 시간(ms) */
const LAMP_MS = 16_000;
/** 아침 지점까지 걷는 최대 시간(ms) */
const SPOT_MS = 14_000;
/** 지점 표식이 서는 것을 기다리는 최대 시간(ms): 큰 글 알림 2.8초(경찰 결과 알림이 있으면 4.8초) 뒤 */
const SPOT_APPEAR_MS = 9_000;

/** 보낸 프레임의 t 만 모은다(페이지가 열릴 때 심는 init 스크립트). 값은 싣지 않고 hold 여부만 t 에 붙인다 */
const SENT_LOG_SCRIPT = `(() => { if (window.__causalSent) return; window.__causalSent = []; const orig = WebSocket.prototype.send; WebSocket.prototype.send = function (d) { try { const m = JSON.parse(typeof d === "string" ? d : ""); window.__causalSent.push(m && typeof m.t === "string" ? (m.hold === true ? m.t + "+hold" : m.t) : "?"); } catch { window.__causalSent.push("?"); } return orig.call(this, d); }; })();`;
/** 의심 보드가 DOM 에 새로 붙은 횟수(열림 횟수) */
const BOARD_WATCH_SCRIPT = `(() => { if (window.__causalBoard) return; window.__causalBoard = { opens: 0 }; new MutationObserver((recs) => { for (const r of recs) for (const n of r.addedNodes) if (n.nodeType === 1 && ((n.matches && n.matches("[data-suspect-board]")) || (n.querySelector && n.querySelector("[data-suspect-board]")))) window.__causalBoard.opens += 1; }).observe(document, { childList: true, subtree: true }); })();`;

const box = `(el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; }`;

/** 저녁 화면 한 장: [켜기]·[건너뛰기]·점 줄·타일·독·헤더. 값은 개수·속성 유무·사각형뿐이다 */
const readEvening = (page) =>
  page.evaluate(`(() => {
    const box = ${box};
    const shown = (el) => { const r = el.getBoundingClientRect(); return !el.hidden && getComputedStyle(el).display !== "none" && r.width > 0 && r.height > 0; };
    const act = document.querySelector("[data-errand-act]");
    const skip = document.querySelector("[data-skip-phase]");
    const dots = document.querySelector("[data-errand-dots]");
    const dock = document.querySelector("[data-scene-dock]");
    const header = document.querySelector(".mf-game__header");
    const tiles = [...document.querySelectorAll("button[data-errand-place]")];
    return {
      act: act ? { disabled: act.getAttribute("aria-disabled") === "true", call: act.hasAttribute("data-call"), text: (act.textContent ?? "").replace(/\\s+/g, " ").trim(), rect: box(act) } : null,
      skip: skip ? { pressed: skip.getAttribute("aria-pressed") === "true", count: Number(skip.getAttribute("data-skip-count")), rect: box(skip) } : null,
      dots: dots ? { rect: box(dots), done: dots.querySelectorAll("[data-errand-dot][data-done]").length, total: dots.querySelectorAll("[data-errand-dot]").length } : null,
      tiles: tiles.map((el) => ({ id: el.getAttribute("data-errand-place") ?? "", done: el.hasAttribute("data-done"), shown: shown(el), call: el.hasAttribute("data-call"), rect: box(el) })),
      badges: document.querySelectorAll("button[data-errand-place] .mv-errand-pin__badge").length,
      dock: box(dock),
      headerBottom: header ? header.getBoundingClientRect().bottom : null,
    };
  })()`);

/** 마을 훅과 맵 이름 */
const readTownHook = (page) =>
  page.evaluate(() => {
    const t = window.__mfTown;
    return {
      map: typeof window.__mfMap === "string" ? window.__mfMap : null,
      town: t ? { lamps: [...t.lamps], windows: [...t.windows], owners: [...t.owners], clue: t.clue === true, night: { zoom: t.night?.zoom, fixed: t.night?.fixed === true } } : null,
    };
  });

/** 밤 화면 한 장: 집 판·독 안내·어둠 표식·스테이지 */
const readNight = (page) =>
  page.evaluate(`(() => {
    const box = ${box};
    const plates = [...document.querySelectorAll("[data-house-pick]")];
    const dock = document.querySelector("[data-dock-night]");
    const header = document.querySelector(".mf-game__header");
    return {
      dark: document.querySelector("[data-night-dark]") !== null,
      plates: plates.map((el) => ({ seat: Number(el.getAttribute("data-house-pick")), pressed: el.getAttribute("aria-pressed") === "true", call: el.hasAttribute("data-call"), off: el.hasAttribute("data-house-off"), me: el.hasAttribute("data-me"), rect: box(el) })),
      legends: document.querySelectorAll("[data-dock-guide] [data-dock-legend]").length,
      guide: document.querySelector("[data-dock-guide]") !== null,
      actions: document.querySelector("[data-dock-actions]") !== null,
      dock: box(dock),
      headerBottom: header ? header.getBoundingClientRect().bottom : null,
      vw: window.innerWidth,
    };
  })()`);

/** 아침 화면 한 장: 지점 표식·주 단추·카드 줄·꺼진 등불·독 */
const readScene = (page) =>
  page.evaluate(`(() => {
    const box = ${box};
    const act = document.querySelector("[data-scene-act]");
    const row = document.querySelector("[data-clue-row]");
    return {
      spots: [...document.querySelectorAll("button[data-clue-spot]")].map((el) => ({ n: Number(el.getAttribute("data-clue-spot")), state: el.getAttribute("data-state") ?? "", call: el.hasAttribute("data-call"), hidden: el.hidden, rect: box(el) })),
      act: act ? { disabled: act.getAttribute("aria-disabled") === "true", call: act.hasAttribute("data-call"), text: (act.textContent ?? "").replace(/\\s+/g, " ").trim() } : null,
      cards: [...document.querySelectorAll("[data-clue-row] [data-clue-chip]")].map((el) => ({ kind: el.getAttribute("data-clue-chip") ?? "", text: (el.textContent ?? "").replace(/\\s+/g, " ").trim() })),
      cardRow: box(row),
      lampOff: [...document.querySelectorAll("[data-lamp-off]")].map((el) => Number(el.getAttribute("data-lamp-off"))).sort((a, b) => a - b),
      dock: box(document.querySelector("[data-scene-dock]")),
      skip: (() => { const s = document.querySelector("[data-skip-phase]"); return s ? { pressed: s.getAttribute("aria-pressed") === "true", count: Number(s.getAttribute("data-skip-count")) } : null; })(),
    };
  })()`);

/** 의심 보드 한 장 */
const readBoard = (page) =>
  page.evaluate(`(() => {
    const box = ${box};
    const sec = document.querySelector("section[data-suspect-board]");
    const header = document.querySelector("[data-record-button] button[aria-label='의심 보드']");
    const panel = document.querySelector("[data-world-panel]");
    const close = sec ? sec.querySelector("button[aria-label='닫기']") : null;
    const witness = sec ? sec.querySelector("[data-clue-chip='witness']") : null;
    const witnessBtn = witness ? witness.closest("button") : null;
    return {
      present: sec !== null,
      rect: box(sec),
      closeRect: box(close),
      faces: sec ? [...sec.querySelectorAll("[data-board-face]")].map((el) => ({ seat: Number(el.getAttribute("data-board-face")), mark: el.getAttribute("data-board-mark") })) : [],
      chips: sec ? [...sec.querySelectorAll("ul[aria-label='내가 아는 것'] [data-clue-chip]")].map((el) => ({ kind: el.getAttribute("data-clue-chip") ?? "", text: (el.textContent ?? "").replace(/\\s+/g, " ").trim() })) : [],
      badges: sec ? sec.querySelectorAll(".mv-suspect-board__badge[data-badge]").length : 0,
      witnessBtn: witnessBtn ? { expanded: witnessBtn.getAttribute("aria-expanded") === "true" } : null,
      rows: sec ? sec.querySelectorAll("[data-record-row]").length : 0,
      headerBtn: header ? { expanded: header.getAttribute("aria-expanded") === "true" } : null,
      panelTop: panel ? panel.getBoundingClientRect().top : null,
      opens: window.__causalBoard ? window.__causalBoard.opens : null,
    };
  })()`);

/** 한 요소의 전환·애니메이션 시간(ms, 큰 쪽) — 없으면 null */
const motionMs = (page, selector) =>
  page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const cs = getComputedStyle(el);
    const parse = (s) => Math.max(0, ...String(s).split(",").map((x) => (x.trim().endsWith("ms") ? parseFloat(x) : parseFloat(x) * 1000) || 0));
    const anim = cs.animationName === "none" ? 0 : parse(cs.animationDuration);
    const trans = cs.transitionProperty === "none" ? 0 : parse(cs.transitionDuration);
    return Math.max(anim, trans);
  }, selector);

const sentOf = (page) => page.evaluate(() => (window.__causalSent ? [...window.__causalSent] : []));

async function until(fn, ms, step = 150) {
  const t0 = Date.now();
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() - t0 > ms) return null;
    await sleep(step);
  }
}

const dbg = (...a) => {
  if (process.env.CAUSAL_DEBUG) console.log("[causal]", ...a);
};
const lines = (rec, sc, ls) => {
  for (const l of ls) rec(sc, l.id, l.label, l.ok, l.detail, l.info === true);
};
const aliveSeats = (view) => view.players.filter((p) => p.alive !== false).map((p) => p.seat);
const lampNum = (id) => Number(/^lamp(\d)$/.exec(id)?.[1]);

/** 마피아 코드·상태가 src 에 없는지(LH3): git grep 이 하나도 못 찾으면(종료 1) true */
function noCutStateInSrc() {
  const r = spawnSync("git", ["grep", "-nIE", "lampCut|markCut|markSmudge|smudged", "--", "src"], { cwd: new URL("../../", import.meta.url), encoding: "utf8" });
  return { ok: r.status === 1, found: r.status === 0 ? r.stdout.split("\n").filter(Boolean).length : 0 };
}

export function makeCausalFlows({ recorder, openGame, closeGame }) {
  /** 저녁 화면(점 줄·타일)이 그려질 때까지 */
  async function untilEveningDrawn(page) {
    await page.waitForFunction(() => !document.querySelector("[data-curtain]") && document.querySelector("[data-errand-dots]") !== null && document.querySelector("[data-errand-act]") !== null && document.querySelectorAll("button[data-errand-place]").length > 0, null, { timeout: 9000 });
    await sleep(350);
  }

  /** 지금 phase 가 want 인지(아니면 SetupError — 서버 타이머가 먼저 단계를 끝냈다) */
  const assertPhase = (tracker, want, what) => {
    if (tracker.last()?.phase !== want) throw new SetupError(`${what} 도중 단계가 끝남(지금 ${tracker.last()?.phase}, 기대 ${want})`);
  };

  /**
   * 안 켠 첫 가로등을 향해 걷고, [켜기] 가 활성이 되면 켠다(hold = 길게 눌러 자르기 시도, 아니면 짧게).
   * onReady(ev) 는 활성이 된 직후(누르기 전) 한 번, onHold 는 누르는 도중 한 번 불린다. 돌려주는 값: 켠 장소 id
   */
  async function lightLamp(page, tracker, n, { hold = false, onReady = null, onHold = null, holdMs = null } = {}) {
    const t0 = Date.now();
    let target = null;
    while (Date.now() - t0 < LAMP_MS) {
      assertPhase(tracker, "errand", `가로등 ${n}번째`);
      const ev = await readEvening(page);
      target = target ?? ev.tiles.find((t) => !t.done)?.id ?? null;
      dbg("lamp", n, "loop", JSON.stringify({ act: ev.act && [ev.act.disabled, ev.act.call], dots: ev.dots?.done, tiles: ev.tiles.map((t) => `${t.id}${t.done ? "✓" : ""}${t.shown ? "" : "·"}`), target, sinceMs: Date.now() - t0 }));
      if (ev.act && !ev.act.disabled) {
        if (onReady) await onReady(ev);
        const doneBefore = new Set(ev.tiles.filter((t) => t.done).map((t) => t.id));
        dbg("lamp", n, "press", { hold, target, call: ev.act.call });
        await longPress(page, "button[data-errand-act]", holdMs ?? (hold ? HOLD_MS : 120), onHold);
        if (await waitErrandDone(page, n, 3000)) {
          const after = await readEvening(page);
          // 처리된 곳은 가장 가까운 장소다 — 걸어간 목표와 다를 수 있어 새로 done 이 된 타일을 읽는다
          return after.tiles.find((t) => t.done && !doneBefore.has(t.id))?.id ?? target;
        }
        dbg("lamp", n, "press 뒤 진행이 안 늘어남", await sentOf(page));
      } else await walkToPlace(page, target);
      await sleep(700);
    }
    throw new SetupError(`가로등 ${n}번째를 ${LAMP_MS / 1000}초 안에 켜지 못함`);
  }

  /** 내 월드 위치({x,z}, 없으면 null) */
  const readMyPos = (page, seat) => page.evaluate((me) => (window.__mfWorld ? window.__mfWorld.sample(me) : null), seat);

  /**
   * 지점 n 으로 걷는다. 표식이 화면 안에 있으면 눌러(앱의 지점 걷기), 없으면 지점의 화면 방향으로 스테이지 가장자리까지 바닥을 눌러 크게 한 걸음 나아간다.
   * 돌려주는 값: 눌렀으면 true
   */
  async function walkToSpot(page, seat, house, n) {
    const spot = CAUSAL_CLUE_SPOTS[house]?.[n - 1];
    const target = await page.evaluate(
      ({ me, sp, num }) => {
        const el = document.querySelector(`button[data-clue-spot="${num}"]`);
        if (el && !el.hidden) {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.height > 0) return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        }
        const w = window.__mfWorld;
        if (!w || !sp) return null;
        const mine = w.sample(me);
        const to = w.screenOf(sp.x, sp.z);
        const from = mine ? w.screenOf(mine.x, mine.z) : null;
        if (!to || !from) return null;
        const left = 12;
        const right = window.innerWidth - 12;
        const top = (document.querySelector(".mf-game__header")?.getBoundingClientRect().bottom ?? 0) + 12;
        const bottom = (document.querySelector("[data-scene-dock]")?.getBoundingClientRect().top ?? window.innerHeight) - 12;
        const dx = to.sx - from.sx;
        const dy = to.sy - from.sy;
        let t = 1;
        if (dx > 0) t = Math.min(t, (right - from.sx) / dx);
        if (dx < 0) t = Math.min(t, (left - from.sx) / dx);
        if (dy > 0) t = Math.min(t, (bottom - from.sy) / dy);
        if (dy < 0) t = Math.min(t, (top - from.sy) / dy);
        t = Math.max(t, 0);
        return { x: from.sx + dx * t, y: from.sy + dy * t };
      },
      { me: seat, sp: spot ?? null, num: n },
    );
    if (!target) return false;
    await page.mouse.click(target.x, target.y);
    return true;
  }

  /**
   * 지점 n 앞에서 [살펴보기] 가 켜질 때까지 걷는다. 서버는 반경 안의 가장 가까운 안 살핀 지점을 살피므로, 내 위치에서 그 지점이 n 일 때(사본 좌표)만 준비된 것으로 본다.
   * gate(약속)가 있으면 준비된 뒤 그것이 풀릴 때까지 기다린다. 돌려주는 값: 준비됐으면 true
   */
  async function walkToSpotReady(page, tracker, seat, house, n, gate = null) {
    const t0 = Date.now();
    while (Date.now() - t0 < SPOT_MS) {
      assertPhase(tracker, "morning", `지점 ${n}`);
      const sc = await readScene(page);
      const pos = await readMyPos(page, seat);
      if (sc.act && !sc.act.disabled && pos) {
        const spots = CAUSAL_CLUE_SPOTS[house] ?? [];
        const fresh = sc.spots.filter((x) => x.state === "fresh").map((x) => x.n);
        let best = null;
        let bestD = Infinity;
        for (const num of fresh) {
          const q = spots[num - 1];
          const d = q ? Math.hypot(q.x - pos.x, q.z - pos.z) : Infinity;
          if (d <= ERRAND_ACT_R_E2E && d < bestD) {
            best = num;
            bestD = d;
          }
        }
        if (best === n) {
          if (gate) await gate;
          return true;
        }
      }
      await walkToSpot(page, seat, house, n);
      await sleep(600);
    }
    return false;
  }

  async function pressScene(page) {
    await page.locator("button[data-scene-act]").click({ timeout: 3000 });
  }

  /** G 공통 검사(탭 44·글자 14·가로 넘침·콘솔·요청). 집 판은 40×40 승인 부품이라 판정에서 빼고 참고 줄(G3k)로 남긴다(tutorial.mjs gLine 과 같다) */
  async function gLine(rec, ctx, handle, sc) {
    const snap = await collectSnapshot(handle.page);
    snap.issues = handle.takeIssues();
    const w = ctx.size.w;
    const tagOut = snap.elements.filter((e) => e.inTag && (e.rect.left < -0.5 || (e.rect.right ?? e.rect.left + e.rect.width) > w + 0.5));
    const plates = snap.interactive.filter((e) => e.desc.startsWith("button.mv-house-pick__plate"));
    snap.interactive = snap.interactive.filter((e) => !plates.includes(e));
    const judged = { ...snap, elements: snap.elements.filter((e) => !tagOut.includes(e)) };
    const bad = genericIssues(judged, ctx.size).filter((x) => !x.ok);
    rec(sc, "G", "G 공통 검사(탭 44·글자 14·가로 넘침·콘솔·요청)", bad.length === 0, bad.map((x) => `${x.id} ${x.detail}`).join(" / "));
    if (plates.length > 0) {
      const sz = [...new Set(plates.map((e) => `${Math.round(e.rect.width)}x${Math.round(e.rect.height)}`))].join(", ");
      rec(sc, "G3k", "알려진 한계(21-12 승인 부품, 판정 아님): 집 판 요소 40×40 — 판 층이 가장 가까운 판을 ≤ 28 안에서 골라 실제 눌림은 더 넓다", true, `집 판 ${plates.length}개 ${sz}`, true);
    }
    if (tagOut.length > 0) rec(sc, "G2k", "알려진 한계(E8 #29, 판정 아님): 이름표 안 요소가 화면 가장자리에서 잘림", true, `이름표 안 요소 ${tagOut.length}개`, true);
  }

  /** 집 판 하나를 누른다(판이 선 뒤 — data-house-off 가 없는 판의 중심). 눌렀으면 true */
  async function clickPlate(page, seat) {
    const pt = await page.evaluate((s) => {
      const el = document.querySelector(`[data-house-pick="${s}"]`);
      if (!el || el.hasAttribute("data-house-off")) return null;
      const r = el.getBoundingClientRect();
      return r.width > 0 ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
    }, seat);
    if (!pt) return false;
    await page.mouse.click(pt.x, pt.y);
    return true;
  }

  /** 밤 판이 모두 서고(투영 끝, data-house-off 없음) 맵이 고정 시점이 될 때까지 */
  async function untilPlatesStanding(page) {
    const ok = await until(async () => {
      const n = await readNight(page);
      return n.plates.length > 0 && n.plates.every((p) => !p.off) ? n : null;
    }, 9000, 200);
    if (!ok) throw new SetupError("밤 집 판이 9초 안에 서지 않음");
    await sleep(300);
    return ok;
  }

  /** 밤 대상(T): 산 사람 중 사람·방장·마피아 동료가 아닌 가장 낮은 좌석(봇). 마피아 봇은 사람 마피아의 선택을 따른다 */
  function victimOf(view, humanSeats) {
    const allies = view.me.allies ?? [];
    const t = aliveSeats(view).filter((s) => !humanSeats.includes(s) && !allies.includes(s)).sort((a, b) => a - b);
    return { victim: t[0], other: t[1] };
  }

  /**
   * causal-day (LH1~LH8·LH14, 390x844): 방장(마피아) + 참가자 둘 + 봇 셋, 확장판. 저녁(가로등·건너뛰기) → 밤(집 찾기·창) → 아침(현장·먼저 손댄 흔적·꺼진 등불) → 토론(의심 보드) → 처형 다음 저녁.
   */
  async function causalDayFlow(ctx) {
    const id = "causal-day";
    const rec = recorder(ctx);
    const game = await openGame(ctx, id, {
      guests: 2,
      bots: 3,
      role: "mafia",
      vote: { exec: "yes", pick: "host" },
      to: "errand",
      hostInitScripts: [SENT_LOG_SCRIPT, BOARD_WATCH_SCRIPT],
      guestInitScripts: [SENT_LOG_SCRIPT],
    });
    try {
      const { host, hp, ht, hostSeat } = game;
      const gs = game.guests;
      const humanSeats = [hostSeat, ...gs.map((g) => g.seat)];
      const nonMafia = gs.find((g) => g.tracker.last()?.me?.role !== "mafia");
      if (!nonMafia) throw new SetupError("참가자 둘이 모두 마피아일 수 없는데 모두 마피아로 읽힘");
      const allyGuest = gs.find((g) => g.tracker.last()?.me?.role === "mafia") ?? null;
      const np = nonMafia.page;

      // ---------- 저녁 (LH2·LH8) ----------
      const sc1 = `${id}/evening`;
      await Promise.all([hp, ...gs.map((g) => g.page)].map(untilEveningDrawn));
      const ev0 = await readEvening(hp);
      lines(rec, sc1, causalEveningChecks("start", { places: ev0.tiles.length, actDisabled: ev0.act?.disabled, actCall: ev0.act?.call, dots: ev0.dots?.done, doneBadges: ev0.badges }));
      const hook0 = await readTownHook(hp);
      rec(sc1, "LH2m", "저녁 맵이 town 이고 __mfTown 훅이 있다", hook0.map === "town" && hook0.town !== null, `__mfMap ${hook0.map}, 훅 ${hook0.town !== null}`);
      await gLine(rec, ctx, host, sc1);

      // LH8 건너뛰기 토글: 누르면 눌림 + 서버가 센 수 1, 다시 누르면 0
      const skipBtn = (page) => page.locator("[data-skip-phase]");
      await skipBtn(hp).click();
      await ht.waitFor((v) => v.day?.skipCount === 1 && v.me.skipPhase === true, 4000, "건너뛰기 누름 반영");
      const on = (await readEvening(hp)).skip;
      rec(sc1, "LH8a", "건너뛰기를 누르면 눌림 표시(aria-pressed)와 data-skip-count 가 서버 값 1 과 같다", on?.pressed === true && on?.count === ht.last().day.skipCount, `눌림 ${on?.pressed}, 표시 ${on?.count}, 서버 ${ht.last().day?.skipCount}`);
      await skipBtn(hp).click();
      await ht.waitFor((v) => (v.day?.skipCount ?? 0) === 0 && v.me.skipPhase !== true, 4000, "건너뛰기 취소 반영");
      const off = (await readEvening(hp)).skip;
      rec(sc1, "LH8b", "다시 누르면 눌림이 풀리고 표시가 서버 값 0 과 같다", off?.pressed === false && off?.count === 0, `눌림 ${off?.pressed}, 표시 ${off?.count}`);

      // 가로등 셋: 첫째는 반경 안 빛남을 읽고 짧게, 둘째는 길게(마피아 — 자르기, 눌림 모양은 같다), 셋째는 모션 줄이기에서 채움 막대 전환을 읽고 짧게
      const cutLamps = [];
      const motion = [];
      const lit = [];
      for (let i = 1; i <= 3; i++) {
        assertPhase(ht, "errand", `가로등 ${i}`);
        const holdIt = i === 2;
        if (i === 3) {
          await hp.emulateMedia({ reducedMotion: "reduce" });
          await sleep(250);
        }
        const place = await lightLamp(hp, ht, i, {
          hold: holdIt,
          holdMs: i === 3 ? 300 : null,
          onReady: async (ev) => {
            if (i === 1) lines(rec, sc1, causalEveningChecks("near", { actDisabled: ev.act.disabled, actCall: ev.act.call }));
          },
          onHold: i === 3 ? async () => motion.push({ name: "채움 막대(저녁 [켜기])", ms: (await motionMs(hp, "[data-hold-fill]")) ?? -1 }) : null,
        });
        if (i === 3) await hp.emulateMedia({ reducedMotion: "no-preference" });
        lit.push(place);
        if (holdIt) cutLamps.push(lampNum(place));
        await sleep(400);
        const ev = await readEvening(hp);
        const hook = await readTownHook(hp);
        if (i < 3) lines(rec, sc1, causalEveningChecks("lit", { dots: ev.dots?.done, expectDots: i, lamps: hook.town?.lamps ?? [], place, doneBadges: ev.badges }));
        else {
          lines(rec, sc1, causalEveningChecks("lit", { dots: ev.dots?.done, expectDots: i, lamps: hook.town?.lamps ?? [], place, doneBadges: ev.badges }));
          lines(rec, sc1, causalEveningChecks("done", { dots: ev.dots?.done, actText: ev.act?.text ?? "", actDisabled: ev.act?.disabled ?? false }));
        }
      }
      const sent = await sentOf(hp);
      dbg("sent frames", sent.filter((t) => t.startsWith("errand")));
      rec(sc1, "LH2h", "길게 누른 켜기만 hold 를 실었고 짧은 둘은 싣지 않았다(errand 프레임 3개 중 hold 1개)", sent.filter((t) => t === "errand").length === 2 && sent.filter((t) => t === "errand+hold").length === 1, `errand ${sent.filter((t) => t === "errand").length}, errand+hold ${sent.filter((t) => t === "errand+hold").length}`);
      const eveningLamps = [...(ht.last().day?.lamps ?? [])];
      rec(sc1, "LH2p", "저녁 공개 lamps 에 내가 켠 가로등(자른 것 포함)이 모두 있다", lit.every((p) => eveningLamps.includes(lampNum(p))), `lamps [${eveningLamps}] 켠 [${lit.map(lampNum)}]`);

      // 모두 건너뛰기를 누르면 단계가 일찍 끝난다(2~3 탭): 사람 셋이 모두 누른다
      const t0Skip = Date.now();
      for (const g of gs) await skipBtn(g.page).click();
      await skipBtn(hp).click();
      const reachedNight = await ht.waitFor((v) => v.phase === "night", 6000, "모두 건너뛰기 뒤 밤").catch(() => null);
      rec(sc1, "LH8c", "사람이 모두 건너뛰기를 누르면 저녁이 일찍 끝나 밤이 된다(40초를 기다리지 않는다)", reachedNight !== null && Date.now() - t0Skip < 8000, `단계 ${ht.last().phase}, ${Date.now() - t0Skip}ms`);
      if (!reachedNight) throw new SetupError("모두 건너뛰기를 눌러도 밤이 되지 않음");

      // ---------- 밤 (LH4·LH5) ----------
      const sc2 = `${id}/night`;
      const night = await untilPlatesStanding(hp);
      const nhook = await readTownHook(hp);
      const nview = ht.last();
      rec(sc2, "LH4m", "밤 맵이 town 이고 고정 시점(__mfTown.night.fixed)이며 어둠 표식(data-night-dark)이 없다", nhook.map === "town" && nhook.town?.night.fixed === true && night.dark === false, `맵 ${nhook.map}, 고정 ${nhook.town?.night.fixed}, 어둠 ${night.dark}`);
      rec(sc2, "LH4g", "밤 독: 범례 '불 켜진 창'·'꺼진 창' 둘과 행동 줄이 있고 판 전체가 빛남(data-call)", night.legends === 2 && night.actions && night.plates.every((p) => p.call), `범례 ${night.legends}, 행동 줄 ${night.actions}, 빛남 ${night.plates.filter((p) => p.call).length}/${night.plates.length}`);
      const stageN = { left: 0, top: night.headerBottom, right: night.vw, bottom: night.dock.top, width: night.vw, height: night.dock.top - night.headerBottom };
      lines(rec, sc2, nightPlateChecks({ w: night.vw, stage: stageN, alive: aliveSeats(nview).length, zoom: nhook.town?.night.zoom, plates: night.plates.map((p) => ({ seat: p.seat, rect: p.rect })) }));
      lines(rec, sc2, causalWindowChecks({ eveningLamps, nightLamps: nview.day?.lamps ?? [], cut: cutLamps, owners: nhook.town?.owners ?? [], windows: nhook.town?.windows ?? [] }));
      await gLine(rec, ctx, host, sc2);

      // 집 찾기: 다른 집 → 목표 집 → 같은 집 다시 (pick 프레임은 처음 둘만)
      const { victim, other } = victimOf(nview, humanSeats);
      if (victim === undefined || other === undefined) throw new SetupError("밤 대상으로 삼을 봇이 둘 미만");
      const markA = (await sentOf(hp)).length;
      await clickPlate(hp, other);
      await ht.waitFor((v) => v.me.pick === other, 3000, "첫 집 고르기 반영");
      await sleep(250);
      const nA = await readNight(hp);
      const sentA = (await sentOf(hp)).slice(markA).filter((t) => t === "pick").length;
      rec(sc2, "LH4a", "집을 누르면 pick 한 번·그 판만 눌림(aria-pressed)·범례가 한 문장으로 바뀐다", sentA === 1 && nA.plates.filter((p) => p.pressed).map((p) => p.seat).join() === String(other) && nA.legends === 0, `pick ${sentA}번, 눌린 판 [${nA.plates.filter((p) => p.pressed).map((p) => p.seat)}], 범례 ${nA.legends}`);
      const markB = (await sentOf(hp)).length;
      await clickPlate(hp, victim);
      await ht.waitFor((v) => v.me.pick === victim, 3000, "다른 집 고르기 반영");
      await sleep(250);
      const nB = await readNight(hp);
      const sentB = (await sentOf(hp)).slice(markB).filter((t) => t === "pick").length;
      rec(sc2, "LH4b", "다른 집을 누르면 선택이 옮겨 가고 눌림 판은 하나뿐이다", sentB === 1 && nB.plates.filter((p) => p.pressed).map((p) => p.seat).join() === String(victim), `pick ${sentB}번, 눌린 판 [${nB.plates.filter((p) => p.pressed).map((p) => p.seat)}]`);
      const markC = (await sentOf(hp)).length;
      await clickPlate(hp, victim);
      await sleep(600);
      const nC = await readNight(hp);
      const sentC = (await sentOf(hp)).slice(markC).filter((t) => t === "pick").length;
      rec(sc2, "LH4c", "같은 집을 다시 누르면 아무 변화가 없다(pick 0번·눌림 그대로)", sentC === 0 && nC.plates.filter((p) => p.pressed).map((p) => p.seat).join() === String(victim), `pick ${sentC}번, 눌린 판 [${nC.plates.filter((p) => p.pressed).map((p) => p.seat)}]`);
      // 사람 마피아 동료가 있으면 같은 집을 고른다(봇 동료는 넘기기 때 따라 고른다)
      if (allyGuest) {
        await untilPlatesStanding(allyGuest.page);
        await clickPlate(allyGuest.page, victim);
        await allyGuest.tracker.waitFor((v) => v.me.pick === victim, 3000, "사람 동료 집 고르기 반영");
      }
      await sleep(300);
      dbg("night before skip", { victim, other, allies: ht.last().me.allies, pick: ht.last().me.pick, sure: ht.last().me.nightSure, tally: ht.last().me.nightTally, allyGuest: allyGuest?.seat ?? null, humanSeats });

      // ---------- 아침 (LH6) ----------
      await skipOnce(hp, ht);
      dbg("after skip", ht.last().phase, ht.last().day?.scene);
      const sc3 = `${id}/morning`;
      if (ht.last().phase !== "morning") throw new SetupError(`밤 뒤 아침이 아님(지금 ${ht.last().phase}) — 피해자·미수가 없는 밤`);
      const mview = ht.last();
      const sceneHouse = mview.day?.scene?.house;
      rec(sc3, "LH6h", "아침 view 의 현장 집이 내가 고른 집(밤 대상)이다", sceneHouse === victim, `현장 ${sceneHouse}, 대상 ${victim}`);
      const appeared = await until(async () => ((await readScene(hp)).spots.length === 3 ? true : null), SPOT_APPEAR_MS, 200);
      if (!appeared) throw new SetupError("지점 표식이 9초 안에 서지 않음");
      await sleep(400);
      const scene0 = await readScene(hp);
      lines(rec, sc3, sceneSpotChecks({ w: ctx.size.w, h: ctx.size.h, spots: scene0.spots.filter((s) => !s.hidden || true).map((s) => ({ n: s.n, state: s.state, rect: s.rect })), dock: scene0.dock, cardRow: scene0.cardRow, expectStates: ["fresh", "fresh", "fresh"] }));
      const hook3 = await readTownHook(hp);
      rec(sc3, "LH6k", "현장 단서 decal 이 보인다(__mfTown.clue)", (await until(async () => ((await readTownHook(hp)).town?.clue ? true : null), 3000, 200)) === true, `clue ${hook3.town?.clue}`);
      const wantOff = mview.players.map((p) => p.seat).filter((s) => !(mview.day?.lamps ?? []).includes(s));
      rec(sc3, "LH6o", "꺼진 등불 표식 = 좌석이 있는 집 중 밤에 안 켜진 곳이고, 내가 자른 등불이 그 안에 있다", wantOff.join() === scene0.lampOff.join() && cutLamps.every((n) => !mview.players.some((p) => p.seat === n) || scene0.lampOff.includes(n)), `표식 [${scene0.lampOff}] 기대 [${wantOff}] 자름 [${cutLamps}]`);
      await gLine(rec, ctx, host, sc3);

      // 방장(마피아)이 ② 를 먼저 살피고, 참가자가 ② 에서 '먼저 손댄 흔적'을 받는다. 참가자는 ① 도 살핀다
      let hostInspected = null;
      const hostDone = new Promise((resolve) => {
        hostInspected = resolve;
      });
      const hostWalk = (async () => {
        const ok = await walkToSpotReady(hp, ht, hostSeat, sceneHouse, 2);
        if (!ok) throw new SetupError(`방장이 지점 ②에 ${SPOT_MS / 1000}초 안에 닿지 못함`);
        await pressScene(hp);
        await ht.waitFor((v) => (v.me.clues ?? []).some((c) => c.spot === 2), 3000, "방장 ② 살피기 반영");
        hostInspected();
      })();
      const guestWalk = (async () => {
        const ok = await walkToSpotReady(np, nonMafia.tracker, nonMafia.seat, sceneHouse, 2, hostDone);
        if (!ok) throw new SetupError(`참가자가 지점 ②에 ${SPOT_MS / 1000}초 안에 닿지 못함`);
        await pressScene(np);
        await nonMafia.tracker.waitFor((v) => (v.me.clues ?? []).some((c) => c.spot === 2), 3000, "참가자 ② 살피기 반영");
      })();
      await Promise.all([hostWalk, guestWalk]);
      await sleep(500);
      const hs = await readScene(hp);
      const hostClue2 = (ht.last().me.clues ?? []).find((c) => c.spot === 2);
      rec(sc3, "LH6d", "방장: ② 가 done 이고 카드 한 장(옷 조각)이 생겼다", hs.spots.find((s) => s.n === 2)?.state === "done" && hs.cards.length === 1 && hs.cards[0].kind === "cloth", `② ${hs.spots.find((s) => s.n === 2)?.state}, 카드 ${hs.cards.map((c) => c.kind)}`);
      const cluesBefore = (ht.last().me.clues ?? []).length;
      await hp.locator("button[data-scene-act]").click({ timeout: 2000 }).catch(() => {});
      await sleep(600);
      const hs2 = await readScene(hp);
      rec(sc3, "LH6r", "같은 지점은 다시 살필 수 없다: [살펴보기] 비활성이고 눌러도 카드·단서가 늘지 않는다", hs2.act?.disabled === true && hs2.cards.length === hs.cards.length && (ht.last().me.clues ?? []).length === cluesBefore, `비활성 ${hs2.act?.disabled}, 카드 ${hs2.cards.length}, 단서 ${(ht.last().me.clues ?? []).length}`);
      const gs2 = await readScene(np);
      const touched = gs2.cards.find((c) => c.kind === "touched");
      rec(sc3, "LH6t", "참가자: 먼저 손댄 ② 는 blurred 이고 '먼저 손댄 흔적' 카드가 생겼다", gs2.spots.find((s) => s.n === 2)?.state === "blurred" && !!touched && touched.text.includes("먼저 손댄 흔적"), `② ${gs2.spots.find((s) => s.n === 2)?.state}, 카드 ${gs2.cards.map((c) => c.kind)}`);
      // 참가자 ①
      const ok1 = await walkToSpotReady(np, nonMafia.tracker, nonMafia.seat, sceneHouse, 1);
      if (!ok1) throw new SetupError(`참가자가 지점 ①에 ${SPOT_MS / 1000}초 안에 닿지 못함`);
      await pressScene(np);
      await nonMafia.tracker.waitFor((v) => (v.me.clues ?? []).some((c) => c.spot === 1), 3000, "참가자 ① 살피기 반영");
      await sleep(500);
      const gs3 = await readScene(np);
      rec(sc3, "LH6f", "참가자: ① 은 done 이고 발자국 카드가 생겼다(카드 둘)", gs3.spots.find((s) => s.n === 1)?.state === "done" && gs3.cards.some((c) => c.kind === "footprint") && gs3.cards.length === 2, `① ${gs3.spots.find((s) => s.n === 1)?.state}, 카드 ${gs3.cards.map((c) => c.kind)}`);
      // 모션 줄이기: 아침 카드가 올라오는 전환
      await hp.emulateMedia({ reducedMotion: "reduce" });
      await sleep(250);
      motion.push({ name: "아침 카드 올라옴", ms: (await motionMs(hp, "[data-clue-row] .mv-clue-chip--card")) ?? -1 });
      await hp.emulateMedia({ reducedMotion: "no-preference" });

      // 모두 건너뛰기: 아침이 일찍 끝난다
      const tMorning = Date.now();
      for (const g of gs) await skipBtn(g.page).click();
      await skipBtn(hp).click();
      const disc = await ht.waitFor((v) => v.phase === "discussion", 7000, "모두 건너뛰기 뒤 토론").catch(() => null);
      rec(sc3, "LH8d", "사람이 모두 건너뛰기를 누르면 아침 현장이 일찍 끝나 토론이 된다", disc !== null && Date.now() - tMorning < 9000, `단계 ${ht.last().phase}, ${Date.now() - tMorning}ms`);
      if (!disc) throw new SetupError("아침에서 토론으로 넘어가지 않음");

      // ---------- 토론 · 의심 보드 (LH7) ----------
      const sc4 = `${id}/discussion`;
      const boardUp = await until(async () => ((await readBoard(hp)).present ? true : null), 6000, 200);
      rec(sc4, "LH7o", "토론이 시작되면 의심 보드가 열려 있다(기다림 없이 단계 진입 때 한 번)", boardUp === true, "6초 안에 [data-suspect-board] 가 없음");
      if (boardUp !== true) throw new SetupError("의심 보드가 열리지 않음");
      await sleep(1500);
      const b0 = await readBoard(hp);
      const dview = ht.last();
      const clues = dview.me.clues ?? [];
      const rows = dview.me.record?.length ?? 0;
      const wantKinds = [...clues.map((c) => c.kind), ...(rows > 0 ? ["witness"] : []), ...(clues.length === 0 && rows === 0 ? ["none"] : [])].sort();
      rec(sc4, "LH7k", "보드 칩 = 내가 받은 단서(살핀 차례대로)와 목격", b0.chips.map((c) => c.kind).sort().join() === wantKinds.join(), `칩 [${b0.chips.map((c) => c.kind)}] 기대 [${wantKinds}]`);
      const pieces = clues.filter((c) => (c.kind === "cloth" || c.kind === "window") && typeof c.piece === "string").map((c) => c.piece);
      const sameOutfit = [...new Set(pieces.flatMap((p) => sameOutfitSeatsE2E(dview.players, p)))];
      lines(rec, sc4, boardChecks({ opens: b0.opens, faces: b0.faces.map((f) => f.seat), alive: aliveSeats(dview), sameOutfit, marked: b0.faces.filter((f) => f.mark).map((f) => f.seat) }));
      await gLine(rec, ctx, host, sc4);
      // 닫고 [의심 보드] 단추로 다시 연다
      await hp.locator("section[data-suspect-board] button[aria-label='닫기']").click();
      const closed = await until(async () => (!(await readBoard(hp)).present ? true : null), 2000, 100);
      const hbtn = (await readBoard(hp)).headerBtn;
      rec(sc4, "LH7c", "닫으면 보드가 사라지고 헤더 [의심 보드] 단추가 남는다(aria-expanded 거짓)", closed === true && hbtn?.expanded === false, `닫힘 ${closed}, 단추 ${JSON.stringify(hbtn)}`);
      await hp.locator("[data-record-button] button[aria-label='의심 보드']").click();
      const reopened = await until(async () => ((await readBoard(hp)).present ? true : null), 2000, 100);
      rec(sc4, "LH7r", "[의심 보드] 단추로 다시 열린다", reopened === true, "2초 안에 다시 열리지 않음");
      // 목격 칩 펼치기(목격 기록이 있을 때만 — 심부름 중 본 사람이 없으면 칩이 없다)
      const b1 = await readBoard(hp);
      if (rows > 0) {
        await hp.locator("section[data-suspect-board] button[aria-expanded]").first().click();
        await sleep(300);
        const b2 = await readBoard(hp);
        rec(sc4, "LH7w", "목격 칩을 누르면 펼쳐지고 줄 수가 기록과 같다", b2.witnessBtn?.expanded === true && b2.rows === rows, `펼침 ${b2.witnessBtn?.expanded}, 줄 ${b2.rows}, 기록 ${rows}`);
      } else rec(sc4, "LH7w", "목격 칩 펼치기(참고): 이번 판에는 목격 기록이 없어 칩이 없다", b1.witnessBtn === null, `목격 기록 ${rows}줄, 칩 ${b1.witnessBtn !== null}`, true);
      // 모션 줄이기: 보드가 열리는 전환
      await hp.emulateMedia({ reducedMotion: "reduce" });
      await sleep(250);
      motion.push({ name: "의심 보드 열림", ms: (await motionMs(hp, "section[data-suspect-board]")) ?? -1 });
      await hp.emulateMedia({ reducedMotion: "no-preference" });
      lines(rec, `${id}/motion`, causalReducedChecks({ items: motion }));

      // ---------- 처형 다음 저녁 (LH1) ----------
      await skipTo(hp, ht, "errand");
      await ht.waitFor((v) => v.phase === "errand", 4000, "처형 다음 저녁");
      lines(rec, `${id}/order`, causalDayChecks({ phases: ht.phases, victim: true }));
      const chain = ht.phases.filter((p, i) => i === 0 || p !== ht.phases[i - 1]);
      const at = chain.lastIndexOf("errand");
      rec(`${id}/order`, "LH1e", "처형(또는 처형 없는 낮) 다음에 다시 저녁(errand)이 온다", at > 0 && chain[at - 1] !== "dayAnnounce" && chain.filter((p) => p === "errand").length === 2, `단계 열 ${chain.join(">")}`);
    } finally {
      await closeGame(game);
    }
  }

  /**
   * causal-leak (LH3·LH9, 390x844): 같은 방의 참가자 탭 둘 — 마피아 참가자와 마피아 아닌 참가자(방장은 시민으로 두고 둘 다 같은 참가자 화면이라 방장 전용 단추·입장 줄 같은 방장 여부의 차이가 끼지 않는다) — 을
   * 저녁·밤·아침·토론에서 DOM 구조(태그·속성 이름·클래스)로 견준다. 허용 목록(계획): 밤 행동 줄([쪽지]/[유언])·산 마피아 본인의 합의 배지. 길게 누르기가 두 탭에서 같은 DOM 변화를 낸다.
   * 비교는 두 겹이다: (가) 월드 밖(헤더·독·패널)은 속성 이름·클래스를 그대로, (나) 월드 층(장소 타일·지점 표식·집 판·이름표)은 내 위치로 켜지는 표시(data-call·data-rest·data-front·is-call·hidden·style)만 빼고 같다.
   */
  async function causalLeakFlow(ctx) {
    const id = "causal-leak";
    const rec = recorder(ctx);
    const game = await openGame(ctx, id, { guests: 3, bots: 2, role: "citizen", vote: { exec: "yes", pick: "host" }, to: "errand", hostInitScripts: [SENT_LOG_SCRIPT], guestInitScripts: [SENT_LOG_SCRIPT] });
    try {
      const { hp, ht, hostSeat } = game;
      const gs = game.guests;
      const mafiaGuests = gs.filter((g) => g.tracker.last()?.me?.role === "mafia");
      const townGuests = gs.filter((g) => g.tracker.last()?.me?.role !== "mafia");
      if (mafiaGuests.length === 0 || townGuests.length === 0) throw new SetupError(`마피아 참가자 ${mafiaGuests.length}명·마피아 아닌 참가자 ${townGuests.length}명 — 비교할 두 탭이 없음`);
      const M = mafiaGuests[0];
      const C = townGuests[0];
      const humanSeats = [hostSeat, ...gs.map((g) => g.seat)];
      const allPages = [hp, ...gs.map((g) => g.page)];
      const ROOT = "[data-game-stage]";
      const names = ["마피아 탭", "시민 편 탭"];
      // 허용 목록: (계획) 밤 행동 줄([쪽지]/[유언])·산 마피아 본인의 합의 배지. 21페이즈 이전부터 있던 본인 역할 일지의 새 기록 점(마피아·경찰·의사 일지, 시민은 없음)도 허용 — SUMMARY 에 근거를 적었다
      const WORLD = /> div\.(?:[\w-]+\.)*mf-world\[data-world-stage\]/;
      const NOT_WORLD = /^(?!.*> div\.(?:[\w-]+\.)*mf-world\[data-world-stage\])/;
      const DOT = /span\.mf-rolecard-btn__dot/;
      // 채팅 기록 줄(입장 줄·경찰 조사 카드 등)은 방 내용이다 — 입장 순서·본인 역할 일지에 따라 달라 구조 비교 밖(기록 창 자체와 입력줄은 비교한다)
      const LOG = /mv-chat__log\[[^\]]*\] > /;
      const ACTIONS = /\[data-dock-actions\] > /;
      const BADGE = /span\.mv-face__count/;
      const POS_ATTRS = ["style", "hidden", "data-call", "data-rest", "data-front", "data-ring"];
      const POS_CLASSES = ["is-call"];
      const compare = async (sc, id2, label, { chrome = [], world = [] } = {}) => {
        const [a, b] = await Promise.all([domShape(M.page, ROOT), domShape(C.page, ROOT)]);
        const d1 = domShapeDiff(a, b, { allow: [WORLD, DOT, LOG, ...chrome], names });
        const d2 = domShapeDiff(a, b, { allow: [NOT_WORLD, ...world], names, ignoreAttrs: POS_ATTRS, ignoreClasses: POS_CLASSES });
        if (process.env.CAUSAL_DEBUG && d1.length + d2.length > 0) {
          const logOf = (p) => p.evaluate(() => [...document.querySelectorAll("[data-chat-log] > *")].map((e) => `${e.tagName}.${String(e.className).slice(0, 24)}${e.getAttribute("data-card") ? ":" + e.getAttribute("data-card") : ""}|${(e.textContent ?? "").trim().slice(0, 30)}`));
          dbg("log", id2, "M", JSON.stringify(await logOf(M.page)), "C", JSON.stringify(await logOf(C.page)));
        }
        rec(sc, id2, label, d1.length === 0 && d2.length === 0 && a.length > 0 && b.length > 0, `월드 밖 ${d1.length}곳·월드 층 ${d2.length}곳 다름: ${[...d1, ...d2].slice(0, 4).join(" | ")}`);
      };

      // ---------- 저녁 (LH3) ----------
      const sc1 = `${id}/evening`;
      await Promise.all(allPages.map(untilEveningDrawn));
      await compare(sc1, "LH3a", "저녁 처음: 마피아 탭과 시민 편 탭의 DOM 구조(태그·속성 이름·클래스)가 같다");
      const cut = noCutStateInSrc();
      rec(sc1, "LH3s", "src/ 에 심지 자르기 상태(lampCut·smudged 등)가 없다(git grep)", cut.ok, `찾은 줄 ${cut.found}개`);
      // 두 탭이 각각 첫 가로등 앞에서 0.7초 길게 누른다 — 누르기 전·후 DOM 변화(구조 차이 줄)가 같아야 한다
      const press = async (tab) => {
        const { page, tracker } = tab;
        let before = "";
        await lightLamp(page, tracker, 1, {
          hold: true,
          onReady: async () => {
            await sleep(200);
            before = await domShape(page, ROOT);
          },
        });
        await sleep(500);
        const after = await domShape(page, ROOT);
        return { before, after };
      };
      const [pm, pc] = await Promise.all([press(M), press(C)]);
      const opt = { names: ["전", "후"], ignoreAttrs: POS_ATTRS, ignoreClasses: POS_CLASSES, allow: [LOG, DOT] };
      const dm = domShapeDiff(pm.before, pm.after, opt).sort();
      const dc = domShapeDiff(pc.before, pc.after, opt).sort();
      rec(sc1, "LH3h", "길게 누르기가 마피아 탭과 시민 편 탭에서 같은 DOM 변화를 낸다(구조 변화 줄이 같다)", dm.length > 0 && dm.join("\n") === dc.join("\n"), `마피아 탭 ${dm.length}줄 변화, 시민 편 탭 ${dc.length}줄 변화`);
      const sm = (await sentOf(M.page)).filter((t) => t.startsWith("errand")).join();
      const sct = (await sentOf(C.page)).filter((t) => t.startsWith("errand")).join();
      rec(sc1, "LH3f", "두 탭이 보낸 심부름 프레임이 같다(errand+hold 한 개씩)", sm === sct && sm.includes("errand+hold"), `마피아 탭 ${sm}, 시민 편 탭 ${sct}`);
      await compare(sc1, "LH3b", "켠 뒤: 두 탭의 저녁 DOM 구조가 같다");
      // 건너뛰기: 사람이 모두 눌러 저녁을 끝낸다
      for (const p of allPages) await p.locator("[data-skip-phase]").click();
      await ht.waitFor((v) => v.phase === "night", 7000, "건너뛰기 뒤 밤");

      // ---------- 밤 (LH9) ----------
      const sc3 = `${id}/night`;
      await Promise.all(allPages.map(untilPlatesStanding));
      const NIGHT = { chrome: [ACTIONS, BADGE], world: [BADGE] };
      await compare(sc3, "LH9n", "밤 처음: 두 탭의 DOM 구조가 같다(허용: 행동 줄·합의 배지)", NIGHT);
      const { victim } = victimOf(M.tracker.last(), humanSeats);
      if (victim === undefined) throw new SetupError("밤 대상 봇 없음");
      // 마피아 참가자는 모두 같은 집을 고른다(봇 마피아는 넘기기 때 따라 고른다). 마피아 아닌 참가자도 같은 집을 고른다
      for (const g of [...mafiaGuests, C]) {
        await clickPlate(g.page, victim);
        await g.tracker.waitFor((v) => v.me.pick === victim, 3000, "집 고르기 반영");
      }
      await sleep(500);
      await compare(sc3, "LH9p", "고른 뒤: 두 탭의 DOM 구조가 같다(허용: 행동 줄·합의 배지)", NIGHT);

      // ---------- 아침 ----------
      await skipOnce(hp, ht);
      const sc4 = `${id}/morning`;
      if (ht.last().phase !== "morning") throw new SetupError(`밤 뒤 아침이 아님(지금 ${ht.last().phase})`);
      const up = await until(async () => ((await readScene(M.page)).spots.length === 3 && (await readScene(C.page)).spots.length === 3 ? true : null), SPOT_APPEAR_MS, 200);
      if (!up) throw new SetupError("아침 지점 표식이 9초 안에 서지 않음");
      await sleep(500);
      await compare(sc4, "LH9m", "아침(살피기 전): 두 탭의 DOM 구조가 같다");

      // ---------- 토론 ----------
      for (const p of allPages) await p.locator("[data-skip-phase]").click();
      await ht.waitFor((v) => v.phase === "discussion", 7000, "건너뛰기 뒤 토론");
      const sc5 = `${id}/discussion`;
      const both = await until(async () => ((await readBoard(M.page)).present && (await readBoard(C.page)).present ? true : null), 6000, 200);
      if (!both) throw new SetupError("토론 의심 보드가 두 탭에 열리지 않음");
      await sleep(1200);
      await compare(sc5, "LH9d", "토론(의심 보드): 두 탭의 DOM 구조가 같다");
    } finally {
      await closeGame(game);
    }
  }

  /**
   * causal-sizes (LH11, 폰 6종): 방장 혼자(마피아) + 봇 다섯. 저녁(점·[켜기]·타일 겹침 없음) → 밤(판 8 안쪽 8·거리 ≥ 40·배율 식) → 아침(표식 3·카드 줄·독 겹침 없음) → 토론(보드: 닫기 44·패널 위 8). 겹침·보임 판정만, 완주하지 않는다.
   */
  async function causalSizesFlow(ctx) {
    const id = "causal-sizes";
    const rec = recorder(ctx);
    const game = await openGame(ctx, id, { guests: 0, bots: 5, role: "mafia", vote: { exec: "yes", pick: "host" }, to: "errand" });
    try {
      const { hp, ht, hostSeat } = game;
      const w = ctx.size.w;
      const h = ctx.size.h;

      // 저녁
      const sc1 = `${id}/evening`;
      await untilEveningDrawn(hp);
      const ev = await readEvening(hp);
      const stageE = { left: 0, top: ev.headerBottom, right: w, bottom: ev.dock?.top ?? h, width: w, height: (ev.dock?.top ?? h) - ev.headerBottom };
      lines(rec, sc1, causalEveningChecks("size", { dock: ev.dock, dots: ev.dots?.rect, act: ev.act?.rect, skip: ev.skip?.rect, tiles: ev.tiles.filter((t) => t.shown).map((t) => t.rect), stage: stageE }));
      rec(sc1, "LH11n", "저녁 화면에 보이는 장소 타일이 있다(참고: 화면 밖 타일은 화살표 칩이 대신한다)", true, `보이는 타일 ${ev.tiles.filter((t) => t.shown).length}/${ev.tiles.length}`, true);

      // 밤
      await skipOnce(hp, ht);
      assertPhase(ht, "night", "밤");
      const sc2 = `${id}/night`;
      const night = await untilPlatesStanding(hp);
      const nhook = await readTownHook(hp);
      const stageN = { left: 0, top: night.headerBottom, right: night.vw, bottom: night.dock.top, width: night.vw, height: night.dock.top - night.headerBottom };
      lines(rec, sc2, nightPlateChecks({ w: night.vw, stage: stageN, alive: aliveSeats(ht.last()).length, zoom: nhook.town?.night.zoom, plates: night.plates.map((p) => ({ seat: p.seat, rect: p.rect })) }));
      const { victim } = victimOf(ht.last(), [hostSeat]);
      if (victim === undefined) throw new SetupError("밤 대상 봇 없음");
      await clickPlate(hp, victim);
      await ht.waitFor((v) => v.me.pick === victim, 3000, "집 고르기 반영");

      // 아침
      await skipOnce(hp, ht);
      if (ht.last().phase !== "morning") throw new SetupError(`밤 뒤 아침이 아님(지금 ${ht.last().phase})`);
      const sc3 = `${id}/morning`;
      const up = await until(async () => ((await readScene(hp)).spots.length === 3 ? true : null), SPOT_APPEAR_MS, 200);
      if (!up) throw new SetupError("아침 지점 표식이 9초 안에 서지 않음");
      await sleep(400);
      const s0 = await readScene(hp);
      lines(rec, `${sc3}/fresh`, sceneSpotChecks({ w, h, spots: s0.spots.map((s) => ({ n: s.n, state: s.state, rect: s.rect })), dock: s0.dock, cardRow: s0.cardRow, expectStates: ["fresh", "fresh", "fresh"] }));
      // 세 지점을 모두 살펴 카드 세 장(두 줄)을 만든다 — 카드 줄 겹침·덮임을 본다
      const house = ht.last().day?.scene?.house;
      for (const n of [2, 1, 3]) {
        const ok = await walkToSpotReady(hp, ht, hostSeat, house, n);
        if (!ok) throw new SetupError(`지점 ${n} 에 ${SPOT_MS / 1000}초 안에 닿지 못함`);
        await pressScene(hp);
        await ht.waitFor((v) => (v.me.clues ?? []).some((c) => c.spot === n), 3000, `지점 ${n} 살피기 반영`);
        await sleep(300);
        if (n === 2) {
          // 첫 카드 한 장: 아직 안 살핀 표식 ①③ 은 카드 줄에 가려지지 않는다
          const s2 = await readScene(hp);
          lines(rec, `${sc3}/one-card`, sceneSpotChecks({ w, h, spots: s2.spots.map((s) => ({ n: s.n, state: s.state, rect: s.rect })), dock: s2.dock, cardRow: s2.cardRow, expectStates: ["fresh", "done", "fresh"] }));
        }
      }
      const s1 = await readScene(hp);
      lines(rec, `${sc3}/cards`, sceneSpotChecks({ w, h, spots: s1.spots.map((s) => ({ n: s.n, state: s.state, rect: s.rect })), dock: s1.dock, cardRow: s1.cardRow, expectStates: ["done", "done", "done"] }));
      rec(`${sc3}/cards`, "LH6n", "세 지점을 모두 살피면 카드 세 장이 줄에 있다", s1.cards.length === 3, `카드 ${s1.cards.length}장`);

      // 토론 · 보드
      await hp.locator("[data-skip-phase]").click();
      await ht.waitFor((v) => v.phase === "discussion", 7000, "건너뛰기 뒤 토론");
      const sc4 = `${id}/discussion`;
      const boardUp = await until(async () => ((await readBoard(hp)).present ? true : null), 6000, 200);
      if (!boardUp) throw new SetupError("의심 보드가 열리지 않음");
      await sleep(900);
      const b = await readBoard(hp);
      lines(rec, sc4, boardChecks({ closeRect: b.closeRect, boardRect: b.rect, panelTop: b.panelTop }));
    } finally {
      await closeGame(game);
    }
  }

  return { causalDayFlow, causalLeakFlow, causalSizesFlow };
}

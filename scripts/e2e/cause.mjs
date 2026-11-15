// 21페이즈 원인 흐름 E2E 흐름 (21-15, 결정 D-29, UI-SPEC LH1~LH11):
//  cause-evening(LH1·LH2, 390x844: 저녁 등불 세 곳 켜기 + 마피아 길게 누르기와 시민 짧게 누르기의 마크업 비교)
//  cause-night(LH3·LH4, 390x844: 밤 문패 8·고르기·바꾸기 + 마피아·경찰·의사·시민 네 시점의 같은 화면)
//  cause-morning(LH5·LH6·LH7, 390x844: 아침 현장 지점 셋·단서 카드·먼저 손댄 흔적·어두워서 못 봄 + 토론 의심 보드, 피해자 없는 밤은 아침 없이 토론)
//  cause-skip(LH8, 390x844: 사람 셋이 [건너뛰기] 를 눌러 저녁·아침이 일찍 넘어간다)
//  cause-basic(LH9, 390x844: 기본 마피아 한 판 — 확장판 요소 0건·옛 단계 순서)
//  cause-phones(LH11, 폰 6종: 저녁 표지·밤 문패·아침 지점·단서 카드·보드가 띠·열·패널·이름표 버튼과 겹치지 않고 8자 닉네임이 보드 칸 안 한 줄. 완주하지 않고 단계마다 테스트 도구로 넘긴다)
// 이름은 모두 cause- 로 시작한다 — `--only cause-` 가 여섯을 고르고 errand·town·mode 와 `--only` 부분 일치가 겹치지 않는다.
// 흐름은 화면(data-*·__mfTown·__mfCamera·__mfWorld)을 읽기만 하고 판정은 lib.mjs 의 causeChecks 순수 함수에 맡긴다 — 문턱 숫자는 여기에 두지 않는다. 판정을 낮추지 않고, 시간이 부족한 것은 SetupError 로 던져 실행기가 다시 돌리게 한다.
// 결과 줄에는 닉네임·토큰·역할 값을 남기지 않는다 — 좌석·단계 이름·개수·진행 글자·사각형 수치만 쓴다(T-21-48).
// 역할 확인은 테스트 방 testRole(방장 본인 역할 고정)로 한다. 판 진행은 방장 + 사람 손님 + 봇이고 봇은 저녁 가로등·밤 고르기를 스스로 한다(21-06).
// helpers 는 flows.mjs 가 넘긴다(errand.mjs·town.mjs 와 같은 모양 — 서로 import 하지 않는다): { recorder, attempt, openGame, closeGame, gameGH, settledResult }
import {
  SetupError,
  holdErrandAct,
  offScannerScript,
  pressAct,
  pressErrandAct,
  pressHouseTag,
  pressSkip,
  readBoard,
  readCauseHooks,
  readCauseSignature,
  readEvening,
  readHouseTags,
  readOffScan,
  readScene,
  readStartCard,
  settle,
  skipOnce,
  sleep,
  waitErrandDone,
  walkToPlace,
  walkToSpot,
} from "./browser.mjs";
import { BASIC_ABSENT_ATTR_PREFIX, CAUSE_ABSENT_SELECTORS, CAUSE_CLUE_SPOTS_E2E, CAUSE_HOLD_MS_E2E, CAUSE_NEIGHBORS_E2E, CAUSE_PARITY_COUNTED, ERRAND_ACT_R_E2E, causeChecks, sameOutfitSeatsE2E } from "./lib.mjs";

/** 저녁 영역 서명을 읽는 범위(마크업 동일 판정) */
const EVENING_SCOPES = ["[data-errand-layer]", "[data-errand-act-layer]", "[data-errand-dots]", "[data-errand-start-card]", "[data-skip]"];
/** 등불 하나를 걸어가 켜는 최대 시간(ms) */
const LAMP_MS = 16_000;
/** 지점 하나를 걸어가 살피는 최대 시간(ms) */
const SPOT_MS = 16_000;
/** 기본 마피아 완주 칸 수 상한 */
const BASIC_MAX_STEPS = 90;
/** 8자 닉네임(보드 칸 한 줄 시험용) */
const LONG_NAMES = ["여덟글자닉네임이", "가나다라마바사아"];
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

const aliveOf = (view) => view.players.filter((p) => p.alive !== false);
/** 이웃(짝집) 좌석 */
const neighborOf = (seat) => {
  for (const [a, b] of CAUSE_NEIGHBORS_E2E) {
    if (a === seat) return b;
    if (b === seat) return a;
  }
  return undefined;
};

export function makeCauseFlows({ recorder, openGame, closeGame, gameGH }) {
  /** 판정 줄을 그대로 쌓는다. tag 는 id 꼬리, who 는 라벨 머리 */
  const recLines = (rec, sc, lines, { tag = "", who = "" } = {}) => {
    for (const l of lines) rec(sc, `${l.id}${tag}`, `${who}${l.label}`, l.ok, l.detail, l.info === true);
  };

  /** 걷는 위치(월드 단위)를 읽는다. 훅이 없으면 null */
  const posOf = (page, seat) => page.evaluate((s) => window.__mfWorld?.sample(s) ?? null, seat);

  /** 장면 막이 걷히고 저녁 화면(진행 점 줄 + 표지나 화살표)이 그려질 때까지 기다린다 */
  async function untilEvening(page) {
    await page.waitForFunction(() => !document.querySelector("[data-curtain]") && document.querySelector("[data-host-line]") !== null, null, { timeout: 10_000 });
    await settle(page);
    await page.waitForFunction(() => document.querySelector("[data-errand-dots]") !== null && (document.querySelector("button[data-errand-place]:not([hidden])") !== null || document.querySelector("[data-errand-arrow]:not([hidden])") !== null), null, { timeout: 10_000 });
    await sleep(300);
  }

  /** 밤 개관 화면(카메라 overview + 문패 층)이 그려질 때까지 기다린다 */
  async function untilNight(page) {
    await page.waitForFunction(() => !document.querySelector("[data-curtain]") && window.__mfCamera?.mode === "overview" && document.querySelectorAll("[data-house-tag]").length > 0, null, { timeout: 12_000 });
    await settle(page);
    await sleep(400);
  }

  /** 아침 현장 화면(지점 표지 셋)이 그려질 때까지 기다린다(큰 글 발표가 끝나야 지점이 나온다) */
  async function untilScene(page) {
    // 지점 표지가 화면 밖이면 화살표 칩만 보인다 — 층이 그려지고 표지 하나 또는 화살표 칩이 보이면 된다
    await page.waitForFunction(
      () => document.querySelector("[data-clue-layer]") !== null && (document.querySelectorAll("button[data-clue-spot]:not([hidden])").length >= 1 || document.querySelectorAll("[data-clue-layer] [data-errand-arrow]:not([hidden])").length >= 1),
      null,
      { timeout: 16_000 },
    );
    await settle(page);
    await sleep(400);
  }

  /** 등불 하나를 향해 걷다가 [켜기] 가 보이면 누른다(hold 면 0.7초 길게). 진행이 n/3 이 되면 끝. 시간·단계 종료는 SetupError */
  async function lightLamp(page, tracker, n, { hold = false } = {}) {
    const t0 = Date.now();
    while (Date.now() - t0 < LAMP_MS) {
      if (tracker.last()?.phase !== "errand") throw new SetupError(`등불 ${n}번째를 켜기 전에 단계가 끝남(지금 ${tracker.last()?.phase})`);
      const acts = (await readEvening(page)).acts;
      if (acts > 0) {
        const pressed = hold ? await holdErrandAct(page, CAUSE_HOLD_MS_E2E) : await pressErrandAct(page);
        if (pressed && (await waitErrandDone(page, n, 2500))) return;
      } else await walkToPlace(page);
      await sleep(900);
    }
    throw new SetupError(`등불 ${n}번째를 ${LAMP_MS / 1000}초 안에 켜지 못함`);
  }

  /**
   * 저녁 한 사람 몫: 시작 카드(2초 안·2.5초 뒤)·도착 서명·첫 등불(hold 면 길게)·누른 뒤 서명을 읽는다. full 이면 나머지 둘도 켜고 띠 문장·진행 수열·3D 켜짐을 읽는다.
   * 시작 카드가 4초 안에 보이지 않으면 SetupError(부하로 늦은 것 — 판정을 느슨하게 하지 않고 다시 돈다).
   */
  async function eveningParty(game, { hold, full }) {
    const { hp, ht } = game;
    const seat = ht.last().me.seat;
    const shown = await hp.waitForSelector("[data-errand-start-card]", { timeout: 4000 }).then(() => true, () => false);
    if (!shown) throw new SetupError("저녁 시작 카드가 4초 안에 보이지 않음");
    const cardEarly = await readStartCard(hp);
    await sleep(2500);
    const cardLate = await readStartCard(hp);
    await untilEvening(hp);
    const arrive = await readEvening(hp);
    const sigArrive = await readCauseSignature(hp, EVENING_SCOPES, CAUSE_PARITY_COUNTED);
    const hooksStart = await readCauseHooks(hp);
    const lampsMine = (ht.last().me.errand?.places ?? []).map((id) => Number(/^lamp(\d)$/.exec(id)?.[1]));
    const presses = [];
    await lightLamp(hp, ht, 1, { hold });
    await sleep(500);
    const first = await readEvening(hp);
    presses.push(first.progress);
    const sigAfter = { ...(await readCauseSignature(hp, EVENING_SCOPES, CAUSE_PARITY_COUNTED)), progress: first.progress };
    const out = { cardEarly, cardLate, arrive, sigArrive, sigAfter, lampsMine, hooksStart, presses, held: hold, bandActing: arrive.bandLine };
    if (full) {
      for (let n = 2; n <= 3; n++) {
        await lightLamp(hp, ht, n);
        await sleep(500);
        presses.push((await readEvening(hp)).progress);
      }
      await sleep(600);
      out.done = await readEvening(hp);
      out.hooksEnd = await readCauseHooks(hp);
      out.seat = seat;
    }
    return out;
  }

  // ---- cause-evening ----

  /**
   * cause-evening (LH1·LH2, 390x844): ① 마피아 판 — 시작 카드를 본 뒤 첫 등불을 0.7초 길게 눌러 켠다(영역 서명·진행을 읽는다) ②~ 시민 판 — 같은 상태를 읽고 첫 등불은 짧게 누른다, 이어서 나머지 둘을 켜
   * 시작 카드·표지·진행 1/3~3/3·띠 문장·3D 켜짐(LH1) 을 판정한다. ① 과 ② 의 서명·누른 뒤 반응이 같다(LH2). 판 두 개는 방 하나씩이다.
   */
  async function eveningFlow(ctx) {
    const id = "cause-evening";
    const rec = recorder(ctx);
    const mafiaGame = await openGame(ctx, id, { guests: 0, bots: 4, role: "mafia", vote: { exec: "yes", pick: "other" }, to: "errand" });
    let mafia;
    try {
      mafia = await eveningParty(mafiaGame, { hold: true, full: false });
    } finally {
      await closeGame(mafiaGame);
    }
    const citizenGame = await openGame(ctx, id, { guests: 0, bots: 4, role: "citizen", vote: { exec: "yes", pick: "other" }, to: "errand" });
    try {
      const citizen = await eveningParty(citizenGame, { hold: false, full: true });
      recLines(
        rec,
        `${id}/lamps`,
        causeChecks.evening({
          cardEarly: citizen.cardEarly,
          cardLate: citizen.cardLate,
          arrive: { markers: citizen.arrive.markers, shownMarkers: citizen.arrive.shownMarkers, calls: citizen.arrive.calls, acts: citizen.arrive.acts, actCalls: citizen.arrive.actCalls, progress: citizen.arrive.progress, skipPills: citizen.arrive.skipPills },
          presses: citizen.presses,
          bandActing: citizen.bandActing,
          bandDone: citizen.done.bandLine,
          lampsMine: citizen.lampsMine,
          litStart: citizen.hooksStart.lampLit ?? [],
          litEnd: citizen.hooksEnd.lampLit ?? [],
        }),
      );
      recLines(
        rec,
        `${id}/parity`,
        causeChecks.eveningParity({ held: mafia.held, arrive: mafia.sigArrive, afterAct: mafia.sigAfter }, { held: citizen.held, arrive: citizen.sigArrive, afterAct: citizen.sigAfter }),
      );
      rec(`${id}/lamps`, "LH1p", "참고: 도착 직후 표지(보임·깜빡임·처리)·화살표 수·밤 전 [켜기] 수", true, `표지 ${citizen.arrive.places.map((p) => `${p.id}${p.shown ? "보임" : "숨김"}${p.done ? "✓" : ""}`).join(",")} · 깜빡임 ${citizen.arrive.calls} · [켜기] ${citizen.arrive.acts}(깜빡임 ${citizen.arrive.actCalls}) · 화살표 ${citizen.arrive.arrows} · 띠 '${citizen.arrive.bandLine}'`, true);
      rec(`${id}/lamps`, "LH1i", "참고: 마피아 판의 첫 등불 진행(길게 누름)", true, `진행 ${mafia.presses.join(",")} · 시민 판 수열 ${citizen.presses.join(",")}`, true);
      await gameGH(ctx, id, "evening", citizenGame.host);
    } finally {
      await closeGame(citizenGame);
    }
  }

  // ---- cause-night ----

  /** 한 역할의 밤 화면을 읽는다(role 은 방장 testRole). 첫 읽기 뒤 첫 번째 다른 집을 눌러 알림이 없는지 본다. 마피아 판은 고르기·바꾸기(LH3)도 한다 */
  async function nightRole(ctx, id, role, rec, { pickFlow }) {
    // 봇 다섯(여섯 명판)이라 마피아가 둘이다 — 마피아 판에서 동료 집을 눌러 알림이 없는지 본다
    const game = await openGame(ctx, id, { guests: 0, bots: 5, role, vote: { exec: "yes", pick: "other" }, to: "night" });
    try {
      const { hp, ht } = game;
      if (ht.last().me.role !== role) throw new SetupError("방장 역할이 지정한 역할이 아님");
      if (role === "mafia" && (ht.last().me.allies ?? []).length === 0) throw new SetupError("마피아 동료가 없는 판");
      await untilNight(hp);
      const me = ht.last().me.seat;
      const alive = aliveOf(ht.last());
      const others = alive.filter((p) => p.seat !== me).map((p) => p.seat);
      const allies = ht.last().me.allies ?? [];
      const first = await readHouseTags(hp);
      const hooks = await readCauseHooks(hp);
      const view = {
        role,
        buttons: first.tags.filter((t) => t.button).length,
        tags: first.tags.length,
        panelH: first.panelH,
        ringMafia: first.ringMafia,
        eyeHeal: first.eyeHeal,
        names: first.names,
        toastsAfterTap: 0,
      };
      if (pickFlow) {
        // LH3: 동료가 아닌 두 집을 차례로 고르고 바꾼다(동료 집은 LH4 의 알림 검사로 따로 누른다)
        const candidates = others.filter((s) => !allies.includes(s));
        if (candidates.length < 2) throw new SetupError("고를 수 있는 비동료 집이 둘 미만");
        const [a, b] = candidates;
        const tagsAt = async (seat) => {
          await hp.waitForSelector(`button[data-house-tag="${seat}"][data-picked]`, { timeout: 4000 });
          await sleep(300);
          return (await readHouseTags(hp)).tags;
        };
        if (!(await pressHouseTag(hp, a))) throw new SetupError("문패 단추를 누르지 못함");
        const afterPickTags = await tagsAt(a);
        if (!(await pressHouseTag(hp, b))) throw new SetupError("문패 단추를 누르지 못함");
        const afterSwapTags = await tagsAt(b);
        recLines(
          rec,
          `${id}/${role}`,
          causeChecks.night({
            aliveCount: alive.length,
            tags: first.tags.map((t) => ({ seat: t.seat, button: t.button, lit: t.lit, picked: t.picked, call: t.call })),
            houseLit: hooks.houseLit ?? [],
            camera: { mode: hooks.mode ?? "" },
            afterPick: { seat: a, tags: afterPickTags.map((t) => ({ seat: t.seat, button: t.button, lit: t.lit, picked: t.picked, call: t.call })) },
            afterSwap: { seat: b, tags: afterSwapTags.map((t) => ({ seat: t.seat, button: t.button, lit: t.lit, picked: t.picked, call: t.call })) },
          }),
        );
      }
      // LH4: 동료가 있으면 동료 집, 없으면 다른 집을 누르고 알림이 없는지 읽는다
      const tapSeat = allies[0] ?? others.find((s) => s !== undefined);
      if (tapSeat === undefined || !(await pressHouseTag(hp, tapSeat))) throw new SetupError("문패 단추를 누르지 못함");
      await sleep(700);
      view.toastsAfterTap = (await readHouseTags(hp)).toasts;
      return { view, alliesSeen: allies.length };
    } finally {
      await closeGame(game);
    }
  }

  /**
   * cause-night (LH3·LH4, 390x844): 방장 역할을 마피아·경찰·의사·시민으로 바꿔 네 판을 차례로 밤까지 간다. 마피아 판에서 문패 8·산 사람 수만큼 단추·창 불 = houseLit·개관 카메라·깜빡임·
   * 한 집 고르기·다른 집으로 바꾸기(LH3)를 보고, 네 판 모두에서 같은 문패 수·단추 수·아래 패널 높이·data-* 이름·mafia 고리 0·eye/heal 0·알림 0(동료 집을 눌러도, LH4)을 판정한다.
   */
  async function nightFlow(ctx) {
    const id = "cause-night";
    const rec = recorder(ctx);
    const views = [];
    let allyNote = 0;
    for (const role of ["mafia", "police", "doctor", "citizen"]) {
      const r = await nightRole(ctx, id, role, rec, { pickFlow: role === "mafia" });
      views.push(r.view);
      if (role === "mafia") allyNote = r.alliesSeen;
    }
    recLines(rec, `${id}/parity`, causeChecks.nightParity(views));
    rec(`${id}/parity`, "LH4i", "참고: 네 판의 문패 수·단추 수·아래 패널 높이·마피아 판 동료 수", true, views.map((v) => `${v.role} 문패 ${v.tags}·단추 ${v.buttons}·패널 ${Math.round(v.panelH)}`).join(" / ") + ` · 동료 ${allyNote}`, true);
  }

  // ---- 아침 현장 ----

  /**
   * 한 지점으로 걸어가 [살펴보기] 를 눌러 카드 한 장이 늘 때까지 한다. target(월드 좌표)에 0.4 안으로 닿은 뒤에만 누른다. gate 가 있으면 true 가 될 때까지 서서 기다린다(마피아가 먼저 살피게).
   * 돌려주는 값: LH6 한 걸음 { spot, cardsBefore, cardsAfter, state, card }. 시간 안에 못 하면 SetupError.
   */
  async function inspect(page, tracker, seat, spotId, target, { gate = null } = {}) {
    const t0 = Date.now();
    const before = await readScene(page);
    while (Date.now() - t0 < SPOT_MS) {
      if (tracker.last()?.phase !== "morning") throw new SetupError(`${spotId} 를 살피기 전에 아침이 끝남(지금 ${tracker.last()?.phase})`);
      const pos = await posOf(page, seat);
      const sc = await readScene(page);
      if (pos && dist(pos, target) <= 0.4 && sc.acts > 0 && (gate === null || gate())) {
        const actsAtPress = sc.acts;
        if (await pressAct(page)) {
          const grew = await page.waitForFunction((n) => document.querySelectorAll("[data-clue-card]").length === n + 1, before.cards.length, { timeout: 3000 }).then(() => true, () => false);
          if (!grew) throw new SetupError(`${spotId} 를 눌렀는데 카드가 늘지 않음`);
          await sleep(300);
          const after = await readScene(page);
          const spot = after.spots.find((s) => s.id === spotId);
          const card = after.cards.find((c) => c.spot === spotId) ?? after.cards[after.cards.length - 1];
          return { spot: spotId, cardsBefore: before.cards.length, cardsAfter: after.cards.length, state: spot?.state ?? "", card: { dim: card.dim, text: card.text, count: card.count }, actsAtPress };
        }
      } else if (!(pos && dist(pos, target) <= 0.4)) await walkToSpot(page, spotId);
      await sleep(500);
    }
    throw new SetupError(`${spotId} 지점을 ${SPOT_MS / 1000}초 안에 살피지 못함`);
  }

  /** 지점 좌표(월드 단위) */
  const spotAt = (house, spotId) => CAUSE_CLUE_SPOTS_E2E[house][{ footprint: 0, cloth: 1, window: 2 }[spotId]];

  /**
   * 아침까지 판을 만든다: 방장(마피아) + 사람 손님 guests + 봇. 밤에 방장이 피해자 집을 눌러(두 사람의 집에서 가장 먼 봇) 아침(현장)에 닿는다.
   * 돌려주는 값: { game, victim, windowDark }. 아침이 안 오면(피해자 없음) SetupError.
   */
  async function morningGame(ctx, id, { guests, bots, role = "mafia" }) {
    const game = await openGame(ctx, id, { guests, bots, role, vote: { exec: "yes", pick: "other" }, to: "night" });
    try {
      const { hp, ht } = game;
      await untilNight(hp);
      const humans = [game.hostSeat, ...game.guests.map((g) => g.seat)];
      const botSeats = aliveOf(ht.last()).map((p) => p.seat).filter((s) => !humans.includes(s));
      if (botSeats.length === 0) throw new SetupError("피해자로 고를 봇이 없음");
      // 사람들이 서 있는 자리(집 앞)에서 가장 먼 봇의 집을 피해자로 — 아침 시작에 [살펴보기] 반경 밖이 되도록(LH5b)
      const where = [];
      for (const [h, seat] of [[hp, game.hostSeat], ...game.guests.map((g) => [g.page, g.seat])]) {
        const p = await posOf(h, seat);
        if (p) where.push(p);
      }
      const reach = (seat) => Math.min(...CAUSE_CLUE_SPOTS_E2E[seat].flatMap((s) => where.map((w) => dist(w, s))));
      const victim = [...botSeats].sort((a, b) => reach(b) - reach(a))[0];
      if (!(await pressHouseTag(hp, victim))) throw new SetupError("피해자 문패를 누르지 못함");
      await hp.waitForSelector(`button[data-house-tag="${victim}"][data-picked]`, { timeout: 4000 });
      await skipOnce(hp, ht);
      if (ht.last().phase !== "morning") throw new SetupError(`아침이 아닌 ${ht.last().phase} 로 넘어감(피해자 없는 밤)`);
      if (ht.last().day?.scene?.house !== victim) throw new SetupError("현장 집이 고른 피해자와 다름");
      const lamps = ht.last().day?.lamps;
      const pair = neighborOf(victim);
      return { game, victim, windowDark: lamps === undefined || pair === undefined ? true : lamps[pair] !== true };
    } catch (e) {
      await closeGame(game);
      throw e;
    }
  }

  /**
   * cause-morning (LH5·LH6·LH7, 390x844): 방장(마피아) + 손님 둘 + 봇 둘. 밤에 방장이 피해자를 고르고 아침에 닿으면 ① 지점 셋이 새 상태·[살펴보기]는 반경 밖 0·안 1(LH5) ② 방장이 옷 조각만 먼저 살피고(마피아가 손댄 지점)
   * 첫째 손님이 옷 조각(먼저 손댄 흔적) → 발자국 → 창문을 살피고 둘째 손님은 발자국만 살핀다(LH6, 두 시민의 발자국 수가 같다) ③ 토론이 열리면 세 사람의 의심 보드를 읽는다(각자 자기 단서 칩만, LH7). 피해자 없는 밤은 따로 한 판으로 아침 없이 토론에 닿는지 본다(LH5c).
   */
  async function morningFlow(ctx) {
    const id = "cause-morning";
    const rec = recorder(ctx);
    const { game, victim, windowDark } = await morningGame(ctx, id, { guests: 2, bots: 2 });
    let noVictim = null;
    try {
      const { hp, ht } = game;
      const [g1, g2] = game.guests;
      const pages = [{ page: hp, tracker: ht, seat: game.hostSeat }, g1, g2].map((p) => ({ page: p.page, tracker: p.tracker, seat: p.seat ?? game.hostSeat }));
      await Promise.all(pages.map((p) => untilScene(p.page)));
      const first = await readScene(hp);
      const hostPos = await posOf(hp, game.hostSeat);
      const nearest = Math.min(...CAUSE_CLUE_SPOTS_E2E[victim].map((s) => (hostPos ? dist(hostPos, s) : 0)));
      // LH5a·LH5b(반경 밖): 도착 시점. 반경 밖인 사람(방장)의 [살펴보기] 수를 읽는다
      const far = { acts: first.acts, shownSpots: first.spots.filter((s) => s.shown).length, arrows: first.arrows };
      if (nearest <= ERRAND_ACT_R_E2E + 0.3) throw new SetupError("방장이 아침 시작부터 지점 반경 안에 있음(반경 밖 측정 불가)");
      const spotTarget = (s) => spotAt(victim, s);
      // 마피아가 먼저 옷 조각을 살피고, 첫째 손님은 걸어가 서서 기다렸다가 뒤에 살핀다
      const flag = { hostCloth: false };
      const hostSteps = [];
      const guestSteps = [];
      const guest2Steps = [];
      await Promise.all([
        (async () => {
          const s1 = await inspect(hp, ht, game.hostSeat, "cloth", spotTarget("cloth"));
          hostSteps.push(s1);
          flag.hostCloth = true;
        })(),
        (async () => {
          guest2Steps.push(await inspect(g2.page, g2.tracker, g2.seat, "footprint", spotTarget("footprint")));
        })(),
        (async () => {
          guestSteps.push(await inspect(g1.page, g1.tracker, g1.seat, "cloth", spotTarget("cloth"), { gate: () => flag.hostCloth }));
          guestSteps.push(await inspect(g1.page, g1.tracker, g1.seat, "footprint", spotTarget("footprint")));
          guestSteps.push(await inspect(g1.page, g1.tracker, g1.seat, "window", spotTarget("window")));
        })(),
      ]);
      // 반경 안: 방장이 옷 조각 앞에 닿아 누르기 직전에 읽은 [살펴보기] 수
      recLines(rec, `${id}/arrive`, causeChecks.morning({ spots: first.spots.map((s) => ({ id: s.id, state: s.state })), far, near: { acts: hostSteps[0].actsAtPress }, noVictim: null }).filter((l) => l.id !== "LH5c"));
      // 다시 살피기: 셋 모두 살폈으므로 [살펴보기] 가 없고 카드는 셋 그대로
      await sleep(600);
      const rep = await readScene(g1.page);
      const repeatPressed = await pressAct(g1.page);
      await sleep(400);
      const rep2 = await readScene(g1.page);
      recLines(
        rec,
        `${id}/clues`,
        causeChecks.clues({ host: { steps: hostSteps }, guest: { steps: guestSteps }, guest2: { steps: guest2Steps }, windowDark, repeat: { acts: repeatPressed ? 1 : rep.acts, cardsBefore: rep.cards.length, cardsAfter: rep2.cards.length } }),
      );
      rec(`${id}/clues`, "LH6i", "참고: 창 불·카드 수", true, `이웃 창 ${windowDark ? "꺼짐" : "켜짐"} · 마피아 카드 ${hostSteps.length}장 · 시민 카드 ${guestSteps.length}장 · 시민2 카드 ${guest2Steps.length}장`, true);
      // 보드: 토론이 열리면 세 사람의 보드를 읽는다
      await skipOnce(hp, ht);
      await Promise.all(pages.map((p) => p.tracker.waitFor((v) => v.phase === "discussion", 8000, "토론 도착")));
      await Promise.all(pages.map((p) => p.page.waitForSelector("[data-board]", { timeout: 8000 })));
      await Promise.all(pages.map((p) => settle(p.page)));
      for (const [who, p] of [["마피아(옷 조각)", pages[0]], ["시민(셋 다)", pages[1]], ["시민2(발자국)", pages[2]]]) {
        const view = p.tracker.last();
        const b = await readBoard(p.page);
        const scene = view.me.scene ?? [];
        const alive = aliveOf(view).map((x) => x.seat);
        const pieces = scene.filter((l) => l.r === "clue" && l.piece && (l.spot === "cloth" || l.spot === "window")).map((l) => l.piece);
        const expectMarks = [...new Set(pieces.flatMap((pc) => sameOutfitSeatsE2E(view.players, pc)))];
        const unlit = (view.day?.lamps ?? []).filter((v) => !v).length;
        // 입력칸에 포커스를 두면 접힌다(LH7h)
        await p.page.locator(".mv-chat__input").first().focus({ timeout: 3000 });
        const collapsed = await p.page.waitForFunction(() => document.querySelector("[data-board]") === null, null, { timeout: 2000 }).then(() => true, () => false);
        recLines(
          rec,
          `${id}/board`,
          causeChecks.board({
            open: b.open === 1 && b.expanded === true,
            chipSpots: b.chips,
            inspected: scene.filter((l) => l.r !== "none").map((l) => l.spot),
            faceSeats: b.faces,
            aliveSeats: alive,
            lampsAttr: b.lampsAttr ?? -1,
            lampDots: b.lampDots,
            unlit,
            recordButtons: b.records,
            witnessCell: b.witness > 0,
            expectWitness: (view.me.record ?? []).length > 0,
            markFaces: b.marks,
            expectMarks,
            collapsedOnFocus: collapsed,
          }),
          { tag: `-${who}`, who: `${who}: ` },
        );
      }
      await gameGH(ctx, id, "board", game.host);
    } finally {
      await closeGame(game);
    }
    // 피해자도 미수도 없는 밤: 방장(마피아)이 아무 집도 고르지 않으면 아침 단계 없이 토론이다(LH5c)
    const quiet = await openGame(ctx, id, { guests: 0, bots: 4, role: "mafia", vote: { exec: "yes", pick: "other" }, to: "night" });
    try {
      const { hp, ht } = quiet;
      await skipOnce(hp, ht);
      await ht.waitFor((v) => v.phase === "discussion" || v.phase === "morning", 5000, "밤 다음 단계");
      noVictim = { phases: [...ht.phases] };
      recLines(
        rec,
        `${id}/quiet`,
        causeChecks.morning({ spots: [], far: { acts: 0 }, near: { acts: 1 }, noVictim }).filter((l) => l.id === "LH5c"),
      );
    } finally {
      await closeGame(quiet);
    }
  }

  // ---- cause-skip ----

  /** 모든 사람이 [건너뛰기] 를 눌러 과반(3/5)이 되면 단계가 일찍 넘어가는지 본다. 첫 사람의 누르기 전·후 표식(LH8a)과 일찍 넘어감(LH8b)을 판정한다 */
  async function skipRound(rec, id, tag, pages, fromPhase, toPhase) {
    const lead = pages[0];
    const ends = lead.tracker.last().phaseEndsAt;
    const read = async (p) => (fromPhase === "errand" ? readEvening(p.page) : readScene(p.page));
    const b0 = await read(lead);
    if (!(await pressSkip(lead.page))) throw new SetupError("[건너뛰기] 가 없음");
    await lead.page.waitForFunction(() => document.querySelector("[data-skip]")?.getAttribute("aria-pressed") === "true", null, { timeout: 4000 });
    await sleep(300);
    const b1 = await read(lead);
    // 나머지 사람이 눌러 과반이 된다(3/5)
    for (const p of pages.slice(1)) {
      if (lead.tracker.last().phase !== fromPhase) break;
      if (!(await pressSkip(p.page))) throw new SetupError("[건너뛰기] 가 없음");
      await sleep(250);
    }
    await lead.tracker.waitFor((v) => v.phase !== fromPhase, 6000, `${fromPhase} 에서 일찍 넘어감`);
    const remainMs = (ends ?? 0) - Date.now();
    recLines(
      rec,
      `${id}/${tag}`,
      causeChecks.skip({ count0: b0.skipCount ?? "", count1: b1.skipCount ?? "", pressed0: b0.skipPressed, pressed1: b1.skipPressed, early: { phaseBefore: fromPhase, phaseAfter: lead.tracker.last().phase, remainMs } }),
      { tag: `-${tag}` },
    );
    rec(`${id}/${tag}`, "LH8i", `참고: ${fromPhase} → ${lead.tracker.last().phase}, 남은 시간 ${Math.round(remainMs)}ms`, lead.tracker.last().phase === toPhase, `다음 단계 ${lead.tracker.last().phase} (기대 ${toPhase})`);
  }

  /**
   * cause-skip (LH8, 390x844): 방장(마피아) + 손님 둘 + 봇 둘(산 사람 5, 과반 3). 저녁에 세 사람이 [건너뛰기] 를 눌러 밤으로, 밤에 방장이 피해자를 골라 아침에 닿으면 세 사람이 다시 눌러 토론으로
   * 일찍 넘어간다. 눌렀을 때 data-skip-count 가 오르고 aria-pressed 가 true 다.
   */
  async function skipFlow(ctx) {
    const id = "cause-skip";
    const rec = recorder(ctx);
    const game = await openGame(ctx, id, { guests: 2, bots: 2, role: "mafia", vote: { exec: "yes", pick: "other" }, to: "errand" });
    try {
      const { hp, ht } = game;
      const pages = [{ page: hp, tracker: ht, seat: game.hostSeat }, ...game.guests.map((g) => ({ page: g.page, tracker: g.tracker, seat: g.seat }))];
      await Promise.all(pages.map((p) => untilEvening(p.page)));
      await skipRound(rec, id, "evening", pages, "errand", "night");
      // 밤: 방장이 가장 먼 봇의 집을 골라 아침에 닿는다
      await Promise.all(pages.map((p) => untilNight(p.page)));
      const botSeats = aliveOf(ht.last()).map((p) => p.seat).filter((s) => !pages.some((p) => p.seat === s));
      if (botSeats.length === 0 || !(await pressHouseTag(hp, botSeats[0]))) throw new SetupError("피해자 문패를 누르지 못함");
      await hp.waitForSelector(`button[data-house-tag="${botSeats[0]}"][data-picked]`, { timeout: 4000 });
      await skipOnce(hp, ht);
      if (ht.last().phase !== "morning") throw new SetupError(`아침이 아닌 ${ht.last().phase} 로 넘어감`);
      await Promise.all(pages.map((p) => p.page.waitForSelector("[data-skip]", { timeout: 16_000 })));
      await skipRound(rec, id, "morning", pages, "morning", "discussion");
    } finally {
      await closeGame(game);
    }
  }

  // ---- cause-basic ----

  /**
   * cause-basic (LH9, 390x844): 기본 마피아 한 판(방장 + 손님 하나 + 봇 넷)을 대기실부터 결과까지 한 칸씩 넘긴다. 두 페이지에 감시(확장판 요소 선택자 100ms·data-errand-* 속성)를 처음부터 걸어 두고
   * 확장판 요소(문패·지점 표지·단서 카드·보드·[보드]·[건너뛰기]·등불 표식)가 한 번도 안 나오고 단계 순서가 옛 순서(roleReveal → dayAnnounce → discussion …)임을 판정한다.
   */
  async function basicFlow(ctx) {
    const id = "cause-basic";
    const rec = recorder(ctx);
    const scripts = [offScannerScript(CAUSE_ABSENT_SELECTORS, BASIC_ABSENT_ATTR_PREFIX)];
    const game = await openGame(ctx, id, { guests: 1, bots: 4, role: "citizen", vote: { exec: "yes", pick: "other" }, to: null, mode: "basic", hostInitScripts: scripts, guestInitScripts: scripts });
    try {
      const { hp, ht } = game;
      const { page: gp, tracker: gt } = game.guests[0];
      let steps = 0;
      while (ht.last().phase !== "ended" && steps < BASIC_MAX_STEPS) {
        await skipOnce(hp, ht);
        steps += 1;
        await sleep(250); // 감시(100ms)가 이 단계 화면을 한 번은 보게
      }
      if (ht.last().phase !== "ended") throw new SetupError(`${steps}칸을 넘겼는데 ${ht.last().phase} 에서 끝나지 않음`);
      await Promise.all([ht.waitFor((v) => v.phase === "ended" && v.result !== undefined, 10_000, "방장 결과 도달"), gt.waitFor((v) => v.phase === "ended" && v.result !== undefined, 10_000, "참가자 결과 도달")]);
      for (const [who, page, tracker] of [["방장", hp, ht], ["참가자", gp, gt]]) {
        const scan = await readOffScan(page);
        recLines(rec, `${id}/basic`, causeChecks.basic({ phases: tracker.phases, scan }), { tag: `-${who}`, who: `${who}: ` });
        rec(`${id}/basic`, `LH9i-${who}`, `${who}: 감시 횟수와 받은 단계 열(참고)`, true, `${scan === null ? "감시 없음" : `감시 ${scan.scans}회`} · ${tracker.phases.join(">")}`, true);
      }
      rec(`${id}/mode`, "LH9m", "두 페이지의 view.mode 가 basic 이다", (ht.last().mode ?? "extended") === "basic" && (gt.last().mode ?? "extended") === "basic", `방장 ${ht.last().mode} · 참가자 ${gt.last().mode}`);
    } finally {
      await closeGame(game);
    }
  }

  // ---- cause-phones ----

  /** 화면 읽기 값을 LH11 입력으로 바꾼다. kinds: 이름 → 사각형 목록. 사각형 없음은 건너뛴다 */
  const itemsOf = (kinds) => Object.entries(kinds).flatMap(([kind, rects]) => (rects ?? []).filter(Boolean).map((rect) => ({ kind, rect })));

  /**
   * cause-phones (LH11, 폰 6종): 방장(마피아·8자 닉네임) + 손님 하나(8자 닉네임) + 봇 셋. 완주하지 않고 단계마다 테스트 도구로 넘기며 새 요소의 상자를 모아 겹침·보임을 판정한다 —
   * 저녁(등불 표지·[켜기]·[건너뛰기]) → 밤(문패 8) → 아침(지점 표지·[살펴보기]·단서 카드 줄·[건너뛰기]) → 토론(의심 보드 + 8자 닉네임 얼굴 칸).
   */
  async function phonesFlow(ctx) {
    const id = "cause-phones";
    const rec = recorder(ctx);
    const game = await openGame(ctx, id, { guests: 1, bots: 3, role: "mafia", vote: { exec: "yes", pick: "other" }, to: "errand", hostNick: LONG_NAMES[0], guestNames: [LONG_NAMES[1]] });
    try {
      const { hp, ht } = game;
      const guest = game.guests[0];
      // 저녁
      await untilEvening(hp);
      const ev = await readEvening(hp);
      recLines(
        rec,
        `${id}/evening`,
        causeChecks.phones({ stage: ev.stage, blockers: { band: ev.band, side: ev.side, panel: null, tagButtons: ev.tagButtons }, boardOpen: false, items: itemsOf({ "lamp-marker": ev.pinRects, arrow: ev.arrowRects, skip: [ev.skipRect] }) }),
        { tag: "-저녁" },
      );
      // 등불 쪽으로 걸어 [켜기] 가 나타난 순간
      const t0 = Date.now();
      while (Date.now() - t0 < LAMP_MS && (await readEvening(hp)).acts === 0) {
        await walkToPlace(hp);
        await sleep(900);
      }
      const near = await readEvening(hp);
      if (near.acts === 0) throw new SetupError("등불 반경 안에 닿지 못함");
      recLines(
        rec,
        `${id}/evening`,
        causeChecks.phones({ stage: near.stage, blockers: { band: near.band, side: near.side, panel: null, tagButtons: near.tagButtons }, boardOpen: false, items: itemsOf({ "lamp-marker": near.pinRects, "lamp-act": near.actRects, arrow: near.arrowRects, skip: [near.skipRect] }) }),
        { tag: "-저녁-켜기" },
      );
      // 밤
      await skipOnce(hp, ht);
      await untilNight(hp);
      const nt = await readHouseTags(hp);
      recLines(
        rec,
        `${id}/night`,
        causeChecks.phones({ stage: nt.stage, blockers: { band: nt.band, side: nt.side, panel: nt.panel, tagButtons: nt.tagButtons }, boardOpen: false, items: itemsOf({ "house-tag": nt.tags.filter((t) => t.shown).map((t) => t.rect) }) }),
        { tag: "-밤" },
      );
      const botSeats = aliveOf(ht.last()).map((p) => p.seat).filter((s) => s !== game.hostSeat && s !== guest.seat);
      if (botSeats.length === 0 || !(await pressHouseTag(hp, botSeats[0]))) throw new SetupError("피해자 문패를 누르지 못함");
      await hp.waitForSelector(`button[data-house-tag="${botSeats[0]}"][data-picked]`, { timeout: 4000 });
      // 아침
      await skipOnce(hp, ht);
      if (ht.last().phase !== "morning") throw new SetupError(`아침이 아닌 ${ht.last().phase} 로 넘어감`);
      await untilScene(hp);
      const victim = ht.last().day?.scene?.house;
      if (victim === undefined) throw new SetupError("현장 집이 없음");
      const m0 = await readScene(hp);
      recLines(
        rec,
        `${id}/morning`,
        causeChecks.phones({ stage: m0.stage, blockers: { band: m0.band, side: m0.side, panel: m0.panel, tagButtons: m0.tagButtons, chatParts: m0.chatParts }, boardOpen: false, items: itemsOf({ "clue-spot": m0.spots.filter((s) => s.shown).map((s) => s.rect), arrow: m0.arrowRects, "panel-skip": [m0.skipRect] }) }),
        { tag: "-아침" },
      );
      // 두 지점을 살펴 카드 줄(두 장)을 만든다
      await inspect(hp, ht, game.hostSeat, "cloth", spotAt(victim, "cloth"));
      await inspect(hp, ht, game.hostSeat, "footprint", spotAt(victim, "footprint"));
      await sleep(400);
      const m1 = await readScene(hp);
      recLines(
        rec,
        `${id}/morning`,
        causeChecks.phones({
          stage: m1.stage,
          blockers: { band: m1.band, side: m1.side, panel: m1.panel, tagButtons: m1.tagButtons, chatParts: m1.chatParts },
          boardOpen: false,
          items: itemsOf({ "clue-spot": m1.spots.filter((s) => s.shown).map((s) => s.rect), "clue-act": m1.actRects, arrow: m1.arrowRects, "panel-skip": [m1.skipRect], "clue-card": m1.cards.map((c) => c.rect) }),
        }),
        { tag: "-아침-카드" },
      );
      // 토론: 보드
      await skipOnce(hp, ht);
      await ht.waitFor((v) => v.phase === "discussion", 8000, "토론 도착");
      await hp.waitForSelector("[data-board]", { timeout: 8000 });
      await settle(hp);
      const bd = await readBoard(hp);
      recLines(
        rec,
        `${id}/board`,
        causeChecks.phones({ stage: { left: 0, top: bd.band?.bottom ?? 0, right: bd.vw, bottom: bd.panel?.top ?? bd.vh, width: bd.vw, height: (bd.panel?.top ?? bd.vh) - (bd.band?.bottom ?? 0) }, blockers: { band: bd.band, side: bd.side, panel: bd.panel, tagButtons: bd.tagButtons, chatParts: bd.chatParts }, boardOpen: true, items: itemsOf({ board: [bd.rect] }) }),
        { tag: "-토론" },
      );
      recLines(rec, `${id}/board`, causeChecks.boardNames({ faces: bd.faceRects.map((f) => ({ nameRect: f.nameRect, faceRect: f.faceRect, scrollW: f.scrollW, clientW: f.clientW, lineH: f.lineH, overflowX: f.overflowX })) }), { tag: "-토론" });
      rec(`${id}/board`, "LH11i", "참고: 보드 얼굴 칸 수·가장 긴 이름 칸 폭", true, `얼굴 ${bd.faceRects.length}칸 · 칸 폭 ${bd.faceRects.map((f) => Math.round(f.faceRect.width)).join("/")}`, true);
    } finally {
      await closeGame(game);
    }
  }

  return { eveningFlow, nightFlow, morningFlow, skipFlow, basicFlow, phonesFlow };
}

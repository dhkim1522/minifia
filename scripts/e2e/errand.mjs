// 15페이즈 심부름·목격 기록·아침 흔적 E2E 흐름 (15-09, 16-09 에서 증거 카드 두 행·이름표 표시 좌석(흔적 구간→낮→밤)을 더함, 16-07 에서 심부름을 장소 타일·발밑 화살표·장소 위 [처리] 알약 기준으로, 16-08 에서 아래 패널 대신 진행 점 3·시작 카드 기준으로 바꿈): errand(심부름, 폰 6종)·witness(목격 기록, 폰 6종)·trace(밤 얼굴 목록 통일 + 아침 흔적 카드, 폰 6종).
// 이름은 errand·witness·trace — 기존 흐름 이름과 `--only` 부분 일치가 겹치지 않는다. 흐름은 화면을 읽기만 하고 판정은 lib.mjs 의 순수 함수(errandChecks 등)에 맡긴다:
// 판정 문턱은 여기서 낮추지 않는다(T-15-36). 닉네임·토큰은 결과 줄에 남기지 않는다(T-15-35) — 장소 id·진행 수·개수·단계 이름만 쓴다.
// 심부름은 실제 40초라(결정 0074) 시간 안에 못 끝낸 것은 시험 결함이 아니라 환경 지연이다 — 판정을 느슨하게 하지 않고 SetupError 로 던져 실행기가 다시 돌린다.
// helpers 는 flows.mjs 가 넘긴다(host.mjs·sound.mjs 와 같은 모양 — 서로 import 하지 않는다): { recorder, attempt, startHost, openGuest, closeGame, gameGH }
import {
  SetupError,
  chooseRole,
  closeSheet,
  openTestSheet,
  pressErrandAct,
  readErrand,
  readErrandSignature,
  readNightFaces,
  readMarks,
  readRecord,
  readStartCard,
  readTrace,
  setBotVote,
  setBots,
  settle,
  skipOnce,
  skipTo,
  sleep,
  startGame,
  tapWorld,
  waitErrandDone,
  walkToPlace,
} from "./browser.mjs";
import { ERRAND_E2E_MS, ERRAND_LINES, ERRAND_NEAR_R_E2E, ERRAND_PER_PERSON, TRACE_WINDOW_MS, errandCardChecks, errandCardWalkChecks, errandChecks, errandOverlapChecks, errandParityChecks, expectedMarks, hostChimeChecks, nightFaceChecks, outfitUniqueChecks, recordChecks, traceChecks, traceMarkChecks } from "./lib.mjs";

const NICK = "심부름방장";
/** 손님 이름(모두 4자 — emcee-band 와 같은 이름 규칙) */
const GUESTS = ["가나다라", "마바사아", "자차카타", "파하거너", "더러머버", "서어저처", "커터퍼허"];
/** 근처 반경에 더하는 여유(월드 단위): 서버 표본은 1초 간격이라 걸어서 막 나간 사람이 한 칸 남아 있을 수 있다 */
const NEAR_SLACK = 2;
/** 한 장소를 향해 걸어 [처리] 를 켜는 최대 시간(ms) — 계획: 최대 16초 */
const PLACE_MS = 16_000;
/** 소리 훅 로그를 읽고 비우는 도우미(ui.host·ui.card 개수) */
const soundCount = (page, id) => page.evaluate((want) => (window.__mfSound ? window.__mfSound.log.filter((e) => e.id === want).length : -1), id);
const clearLog = (page) => page.evaluate(() => window.__mfSound?.clear());

const fold = (lines) => {
  const bad = lines.filter((l) => !l.ok);
  return { ok: bad.length === 0, detail: bad.map((l) => `${l.id} ${l.detail}`).join(" / ") };
};
const hasRect = (r) => !!r && Number.isFinite(r.left) && Number.isFinite(r.top) && Number.isFinite(r.width) && Number.isFinite(r.height);

export function makeErrandFlows({ recorder, attempt, startHost, openGuest, closeGame, gameGH }) {
  const asGame = (host) => ({ host, guests: host.guestPages ?? [] });

  /** 방장 한 명 + 사람 손님 + 봇으로 시작 직전(로비)까지 만든다. 시트는 닫아 둔다 */
  async function lobbyWith(ctx, flowId, { bots, role, vote, guests = 0 }) {
    const host = await startHost(ctx, flowId, { nickname: NICK });
    const { page: hp, tracker: ht } = host;
    host.guestPages = [];
    for (let i = 0; i < guests; i++) {
      const { guest, seat } = await openGuest(ctx, GUESTS[i]);
      host.guestPages.push({ ...guest, seat });
    }
    if (guests > 0) await ht.waitFor((v) => v.players.length === guests + 1, 8000, `방장 쪽 인원 ${guests + 1}`);
    await openTestSheet(hp);
    if (bots > 0) await setBots(hp, ht, bots);
    await setBotVote(hp, ht, vote);
    await chooseRole(hp, ht, role);
    await closeSheet(hp);
    return host;
  }

  /** 장면 막이 걷히고 띠가 그려질 때까지 기다린 뒤 한 박자 쉰다 */
  async function settleMap(page) {
    await page.waitForFunction(() => !document.querySelector("[data-curtain]") && document.querySelector("[data-host-line]") !== null, null, { timeout: 8000 });
    await settle(page);
  }

  /** 심부름 화면이 그려질 때까지(진행 점 줄 + 표지나 화살표 하나 이상) */
  async function untilErrandDrawn(page) {
    await settleMap(page);
    await page.waitForFunction(() => document.querySelector("[data-errand-dots]") !== null && (document.querySelector("button[data-errand-place]:not([hidden])") !== null || document.querySelector("[data-errand-arrow]:not([hidden])") !== null), null, { timeout: 8000 });
    await sleep(300);
  }

  /** 내 위치와 다른 좌석들의 위치를 한 번에 읽는다(월드 단위). 훅이 없으면 null */
  const readWorldSeats = (page, mySeat) =>
    page.evaluate((me) => {
      const w = window.__mfWorld;
      if (!w) return null;
      const mine = w.sample(me);
      const others = w
        .seats()
        .filter((s) => s !== me)
        .map((s) => w.sample(s));
      return { mine, others };
    }, mySeat);

  /**
   * errandChecks 입력 한 벌(DOM 읽기 + 월드 좌석). 근처를 막 벗어난 사람의 이름표는 퇴장 연출(페이드)이 끝나야 사라지므로(U-17),
   * settleTags 이면 이름표가 월드 좌석 수 이하가 될 때까지 최대 3초 다시 읽는다 — 문턱은 같고 3초 안에 사라지는지를 본다.
   */
  async function errandInput(page, mySeat, { settleTags = false, reach } = {}) {
    let r = await readErrand(page);
    let ws = await readWorldSeats(page, mySeat);
    for (let i = 0; settleTags && i < 12 && ws && Math.max(0, r.tagCount - 1) > ws.others.length; i++) {
      await sleep(250);
      r = await readErrand(page);
      ws = await readWorldSeats(page, mySeat);
    }
    const dist = (p) => (ws?.mine && p ? Math.hypot(p.x - ws.mine.x, p.z - ws.mine.z) : null);
    const others = ws?.others ?? [];
    const near = others.filter((p) => {
      const d = dist(p);
      return d !== null && d <= ERRAND_NEAR_R_E2E + NEAR_SLACK;
    });
    return {
      r,
      s: {
        total: r.dotCount,
        places: r.places.map((p) => ({ id: p.id, done: p.done, hidden: p.hidden, call: p.call, rest: p.rest })),
        doneAttr: r.doneAttr,
        progressText: r.progressText,
        bandLine: r.bandLine,
        panelCount: r.panelCount,
        dotsRows: r.dotsRows,
        dotsAria: r.dotsAria,
        dotsLive: r.dotsLive,
        dotsText: r.dotsText,
        callCount: r.callCount,
        callKinds: r.callKinds,
        reach,
        actCount: r.actCount,
        arrowCount: r.arrows.length,
        tiles: r.pins,
        seatsInWorld: ws ? others.length : null,
        nearSeats: ws ? near.length : null,
        tagSeats: Math.max(0, r.tagCount - 1),
        attrValues: r.attrValues,
      },
    };
  }

  /** 걷는 동안 월드에서 빠진 좌석이 이름표도 같이 사라지는지 보는 감시(페이지 안 폴링). 읽기는 stopExitWatch */
  const startExitWatch = (page, mySeat) =>
    page.evaluate((me) => {
      window.__errExit?.stop?.();
      const st = { prev: new Set(), exits: [], everSeen: 0 };
      const timer = setInterval(() => {
        const cur = new Set((window.__mfWorld?.seats() ?? []).filter((s) => s !== me));
        st.everSeen = Math.max(st.everSeen, cur.size);
        for (const s of st.prev) if (!cur.has(s) && !st.exits.some((e) => e.seat === s && e.back !== true)) st.exits.push({ seat: s, at: Date.now(), tagGoneAt: null });
        for (const e of st.exits) if (e.tagGoneAt === null) {
            const t = document.querySelector(`.mf-world__tag[data-seat="${e.seat}"]`);
            if (!t || Number(getComputedStyle(t).opacity) <= 0.01) e.tagGoneAt = Date.now();
          }
        for (const s of cur) {
          const e = st.exits.find((x) => x.seat === s && x.back !== true);
          if (e) e.back = true;
        }
        st.prev = cur;
      }, 150);
      st.stop = () => clearInterval(timer);
      window.__errExit = st;
    }, mySeat);
  const stopExitWatch = (page) =>
    page.evaluate(() => {
      const st = window.__errExit;
      if (!st) return null;
      st.stop();
      const now = Date.now();
      return { everSeen: st.everSeen, exits: st.exits.filter((e) => e.back !== true).map((e) => ({ goneMs: e.tagGoneAt === null ? null : e.tagGoneAt - e.at, ageMs: now - e.at })) };
    });

  /** 장소 위 [처리] 알약이 보이는가(처리 반경 안에서만 DOM 에 있다) */
  const actVisible = (page) =>
    page.evaluate(() => {
      const act = document.querySelector("button[data-errand-act]");
      if (!act || act.hidden) return false;
      const r = act.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });

  /**
   * 한 장소를 향해 걷다가 알약이 보이면(onInRange 가 있으면 먼저 그 읽기를 하고) 눌러 진행이 n 이 되게 한다. 시간(PLACE_MS)·단계 종료는 SetupError.
   * 반경 밖에서는 알약이 없으므로 걷기만 한다(타일이나 화살표 방향을 누른다).
   */
  async function doPlace(page, tracker, n, onInRange) {
    const t0 = Date.now();
    while (Date.now() - t0 < PLACE_MS) {
      if (tracker.last()?.phase !== "errand") throw new SetupError(`심부름 ${n}번째 장소를 처리하기 전에 단계가 끝남(지금 ${tracker.last()?.phase})`);
      if (await actVisible(page)) {
        if (onInRange) await onInRange();
        if (await pressErrandAct(page)) {
          if (await waitErrandDone(page, n, 2500)) return;
        }
      } else await walkToPlace(page);
      await sleep(1000);
    }
    const last = await readErrand(page).catch(() => null);
    // 알약이 보이는데 눌러지지 않는 경우(다른 요소가 위에 있다)를 가리려고 알약 중심 점의 맨 위 요소를 함께 적는다
    const top = await page
      .evaluate(() => {
        const a = document.querySelector("button[data-errand-act]");
        if (!a || a.hidden) return "알약 없음";
        const r = a.getBoundingClientRect();
        const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return `알약 ${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)} 맨 위 ${el === a ? "알약" : (el?.getAttribute("data-side-button") ?? el?.className ?? "?")}`;
      })
      .catch(() => "?");
    const note = last ? ` (진행 ${last.progressText}·타일 ${last.pins.length}/${last.places.length}·화살표 ${last.arrows.length}·알약 ${last.actCount}·타일 상태 ${last.places.map((p) => `${p.id}${p.done ? "✓" : ""}${p.hidden ? "숨김" : ""}`).join(",")}·단계 ${tracker.last()?.phase}·${top})` : "";
    throw new SetupError(`심부름 ${n}번째 장소를 ${PLACE_MS / 1000}초 안에 처리하지 못함${note}`);
  }

  // ---- errand ----

  /**
   * errand (ERRAND-01~04·07, D-02·D-03·D-06·D-07): 방장 + 봇 5 로 심부름 단계까지 가서 ① 도착 2초 안 시작 카드 1(타일 3)·2.5초 뒤 0, 그 뒤 진행 점 3(done 0)·"0/3"·아래 패널 0·타일 64·알약 0·화살표 1·남은 타일 후광(data-rest)·빛 1 이하·띠 errand.act·근처 링(errandChecks)
   * ② 반경 밖에는 [처리] 알약이 DOM 에 없다 ③ 월드·이름표에 근처 밖 좌석 0 ④ 장소 셋을 걸어 처리 — 알약이 나타난 순간 반경 안 읽기(알약 1·화살표 0·알약만 빛남)를 하고 알약을 눌러 각 단계 채운 점·타일·진행 표식을 본다 → 3/3 에서 알약·화살표 0·띠 errand.done
   * ⑤ 타일·화살표·알약 영역(errandOverlapChecks, 폰 6종) ⑥ 근처에서 빠진 좌석은 이름표도 사라진다 ⑦ 390x844: 방 둘(마피아/시민)의 심부름 영역 마크업이 같다(errandParityChecks, ER1) ⑧ 묶음 G·H ⑨ 소리: 낮 시작 → 심부름 0번·심부름 → 토론 1번.
   */
  async function errandFlow(ctx) {
    const id = "errand";
    const rec = recorder(ctx);
    const firstSize = ctx.size.label === "390x844";
    let mafiaSig = null;
    let mafiaCard = null;
    let cardWalk = null;
    if (firstSize) {
      // 마피아 판: 심부름 도착 직후(시작 카드가 떠 있는 2초 안) 서명을 읽고 카드 중 걷기를 확인한 뒤 닫는다(방 하나 더 — 이 비교는 390x844 에서만)
      const mh = await lobbyWith(ctx, id, { bots: 4, role: "mafia", vote: { exec: "yes", pick: "other" } });
      try {
        await startGame(mh.page, mh.tracker);
        await skipTo(mh.page, mh.tracker, "errand");
        // 시작 카드가 아직 떠 있을 때(2초 안) 마크업 서명·카드를 읽고, 카드 중에도 바닥을 누르면 걷는지 본다(T-16-19)
        const shownCard = await mh.page.waitForSelector("[data-errand-start-card]", { timeout: 4000 }).then(() => true, () => false);
        if (shownCard) {
          mafiaSig = await readErrandSignature(mh.page);
          mafiaCard = await readStartCard(mh.page);
          const seat = mh.tracker.last().me.seat;
          const before = await mh.page.evaluate((s) => window.__mfWorld?.sample(s) ?? null, seat);
          // 카드를 닫는 누름이 곧 걷기 누름이다 — 내 자리에서 한 칸 떨어진 바닥을 누른다
          if (before) await tapWorld(mh.page, mh.tracker, seat, before.x + 1.2, before.z + 0.6).catch(() => null);
          const closed = await mh.page.waitForFunction(() => document.querySelector("[data-errand-start-card]") === null, null, { timeout: 1500 }).then(() => true, () => false);
          await sleep(1500);
          const after = await mh.page.evaluate((s) => window.__mfWorld?.sample(s) ?? null, seat);
          const moved = !!before && !!after && Math.hypot(after.x - before.x, after.z - before.z) > 0.2;
          cardWalk = { moved, closed };
        }
        await untilErrandDrawn(mh.page);
        if (mafiaSig === null) mafiaSig = await readErrandSignature(mh.page);
        const r = await readErrand(mh.page);
        rec(`${id}/mafia`, "EF0", `마피아 판의 심부름 화면이 같은 모양으로 그려진다(진행 점 줄 ${r.dotsRows}·점 ${r.dotCount}·표지 ${r.places.length}·아래 패널 ${r.panelCount})`, r.dotsRows === 1 && r.dotCount === ERRAND_PER_PERSON && r.places.length === ERRAND_PER_PERSON && r.panelCount === 0, `점 줄 ${r.dotsRows}, 점 ${r.dotCount}, 표지 ${r.places.length}, 패널 ${r.panelCount}`);
        if (cardWalk !== null) {
          const fw = fold(errandCardWalkChecks(cardWalk));
          rec(`${id}/mafia`, "EC2", "카드 중에도 바닥을 누르면 걷고 그 누름에 카드가 닫힌다(마피아 판)", fw.ok, fw.detail || `걸음 ${cardWalk.moved}, 닫힘 ${cardWalk.closed}`);
        } else rec(`${id}/mafia`, "EC2", "카드 중에도 바닥을 누르면 걷고 그 누름에 카드가 닫힌다(마피아 판)", false, "측정값 없음(시작 카드가 4초 안에 보이지 않음)");
      } finally {
        await closeGame(asGame(mh));
      }
    }
    const host = await lobbyWith(ctx, id, { bots: 5, role: "citizen", vote: { exec: "yes", pick: "other" } });
    try {
      const { page: hp, tracker: ht } = host;
      const mySeat = ht.last().me.seat;
      await startGame(hp, ht);
      // 소리(i): 역할 확인 → 낮 시작 뒤 낮 시작 → 심부름 구간의 ui.host 를 센다
      const segs = [];
      await skipTo(hp, ht, "dayAnnounce").catch(async () => {
        if (ht.last().phase !== "errand") throw new SetupError("낮 시작에 닿지 못함");
      });
      if (ht.last().phase === "dayAnnounce") {
        await clearLog(hp);
        await ht.waitFor((v) => v.phase === "errand", 8000, "낮 시작 → 심부름 자동 전환");
        await sleep(900);
        const n = await soundCount(hp, "ui.host");
        segs.push({ kind: "dayToErrand", name: "낮 시작 → 심부름", count: n, played: n });
      }
      if (ht.last().phase !== "errand") await ht.waitFor((v) => v.phase === "errand", 8000, "심부름 도착");
      // 시작 카드(16-08): 단계 시작 2초 안에 읽고(마크업 서명 포함), 2.5초 뒤에는 사라졌는지 본다. 읽기는 도착 직후에 해야 하므로 소리 구간 읽기보다 앞이다
      const cardSeen = await hp.waitForSelector("[data-errand-start-card]", { timeout: 4000 }).then(() => true, () => false);
      const cardEarly = cardSeen ? await readStartCard(hp) : { cards: 0, tiles: 0, buttons: 0, text: "" };
      const citizenSigEarly = cardSeen && mafiaSig !== null ? await readErrandSignature(hp) : null;
      await sleep(2500);
      const cardLate = await readStartCard(hp);
      const fcard = fold(errandCardChecks({ early: cardEarly, late: cardLate }));
      rec(`${id}/start-card`, "EC1", "시작 카드: 2초 안 1개(타일 3·단추 0·제목·한 줄), 2.5초 뒤 0개", fcard.ok, fcard.detail || `2초 안 ${cardEarly.cards}개·타일 ${cardEarly.tiles}, 2.5초 뒤 ${cardLate.cards}개`);
      await untilErrandDrawn(hp);

      // ① 도착 직후
      const first = await errandInput(hp, mySeat, { reach: "out", settleTags: true }); // 근처에서 막 벗어난 사람의 퇴장 연출(180ms)과 겹치는 경쟁을 가라앉힌다(16-10)
      // 마피아 판과 견줄 시민 판의 마크업 서명은 같은 상태(도착 직후·반경 밖)에서 읽는다
      const citizenSig = citizenSigEarly;
      const f1 = fold(errandChecks(first.s));
      rec(`${id}/arrive`, "EA", `진행 점 3·"0/3"·아래 패널 0·알약 0·화살표 1·타일 64·후광·빛 1 이하·근처 밖 좌석 0·표식 값에 좌석·역할 없음 (좌석 ${first.s.seatsInWorld}·근처 ${first.s.nearSeats})`, f1.ok, f1.detail);
      rec(`${id}/arrive`, "EF1", "진행 점 줄 1개·심부름 제목·근처 링(24점 정지 모양)이 있고 시작 카드는 지나갔다", first.r.dotsRows === 1 && first.r.title.includes("심부름") && first.r.ringShown && first.r.ringPoints >= 8 && first.r.cards === 0, `점 줄 ${first.r.dotsRows}, 제목 ${first.r.title ? "있음" : "없음"}, 링 ${first.r.ringShown}(${first.r.ringPoints}점), 카드 ${first.r.cards}`);
      rec(`${id}/arrive`, "EF2", "진행 점 수 = 3, done 0", first.s.total === ERRAND_PER_PERSON && first.s.doneAttr === 0, `점 ${first.s.total}, done ${first.s.doneAttr}`);
      // ⑤ 영역: 타일·화살표·알약(보이는 것만)이 서로·이름표 버튼·띠·오른쪽 열·아래 패널과 교차 0
      const overlap = (r, when) => {
        const f = fold(errandOverlapChecks({ stage: r.stage, band: r.band, side: r.side, dots: r.dots, vh: r.vh, pins: r.pins, arrow: r.arrows, act: r.act, tagButtons: r.tagButtons }));
        rec(`${id}/${when}`, "EO", `타일 ${r.pins.length}·화살표 ${r.arrows.length}·알약 ${r.act ? 1 : 0}이 서로·이름표·띠·오른쪽 열·진행 점 줄과 겹치지 않고 스테이지 안쪽 8 안이며 점 줄 아래 변 = 창 아래 − 40 (${when})`, f.ok, f.detail);
      };
      overlap(first.r, "arrive");
      // ⑧ 묶음 G·H(콘솔 오류·14px·가로 넘침·헤더 대비)
      await gameGH(ctx, id, "errand", host);

      // ② 반경 밖에는 [처리] 알약이 DOM 에 없고(눌러 볼 것이 없다) 진행·타일·알림이 변하지 않는다
      await sleep(500);
      {
        const after = await readErrand(hp);
        const toast = await hp.evaluate(() => document.querySelectorAll(".mv-toast.is-on").length);
        rec(`${id}/out-of-range`, "EF3", "반경 밖에는 [처리] 알약이 없고 진행·타일·알림이 변하지 않는다", after.actCount === 0 && after.doneAttr === 0 && after.progressText === "0/3" && toast === 0, `알약 ${after.actCount}, done ${after.doneAttr}, 진행 ${after.progressText}, 알림 ${toast}`);
      }

      // ④ 장소 셋을 걸어 처리
      await startExitWatch(hp, mySeat);
      for (let k = 1; k <= ERRAND_PER_PERSON; k++) {
        // 첫 장소에서 알약이 나타난 순간(처리 반경 안)을 한 번 읽어 판정한다
        await doPlace(hp, ht, k, k === 1 ? async () => {
          await sleep(200);
          // 영역 겹침(EO)은 알약이 나타난 순간의 읽기(inn)로, 이름표 수(EA5)는 가라앉힌 읽기(innEa)로 판정한다. 걷는 동안 근처를 벗어난 사람의
          // 이름표가 퇴장 연출(180ms) 중이면 월드 좌석보다 많아 보이는 경쟁이 있었다(16-10) — settleTags 는 문턱 그대로 3초 안에 사라지는지를 본다.
          const inn = await errandInput(hp, mySeat, { reach: "in" });
          const innEa = await errandInput(hp, mySeat, { reach: "in", settleTags: true });
          const fi = fold(errandChecks(innEa.s));
          rec(`${id}/in-range`, "EA", `반경 안: 알약 1·화살표 0·알약만 빛남·남은 타일 후광·타일 64`, fi.ok, fi.detail);
          overlap(inn.r, "in-range");
        } : undefined);
        await sleep(700);
        const r = await readErrand(hp);
        const marks = r.places.filter((p) => p.done).length;
        rec(`${id}/place-${k}`, "EF4", `${k}번째 처리: 채운 점 ${k}·표지 done ${k}·진행 ${k}/3`, r.doneAttr === k && marks === k && r.progressText === `${k}/3`, `점 ${r.doneAttr}, 표지 ${marks}, 진행 ${r.progressText}`);
        if (k === 1) overlap(r, "mid");
      }
      const exits = await stopExitWatch(hp);
      await sleep(600);
      const done = await errandInput(hp, mySeat, { settleTags: true, reach: "done" });
      const f3 = fold(errandChecks(done.s));
      rec(`${id}/done`, "EA", `3/3: 알약·화살표 0·띠 errand.done·아래 패널 0·빛 0·표식 값 (${done.s.progressText})`, f3.ok && done.s.callCount === 0, f3.detail || `[data-call] ${done.s.callCount}개`);
      rec(`${id}/done`, "EF5", "3/3 에서 점 셋이 모두 채워지고 타일 셋이 모두 data-done 이다", done.r.doneAttr === ERRAND_PER_PERSON && done.r.places.length === ERRAND_PER_PERSON && done.r.places.every((p) => p.done), `점 ${done.r.doneAttr}, 처리한 타일 ${done.r.places.filter((p) => p.done).length}/${done.r.places.length}`);

      // ⑥ 근처에서 빠진 좌석은 월드·이름표에서 사라진다(걷는 동안 관찰한 것만 — 빠진 사람이 없었으면 참고 행)
      const settled = (exits?.exits ?? []).filter((e) => e.ageMs >= 3000);
      if (settled.length === 0) rec(`${id}/exit`, "EF6", "근처를 벗어난 좌석이 이름표와 함께 사라진다(관찰된 이탈 없음 — 건너뜀)", true, `관찰 중 최대 ${exits?.everSeen ?? 0}명이 근처에 있었고 3초 이상 지난 이탈 0건`, true);
      else rec(`${id}/exit`, "EF6", `근처를 벗어난 좌석 ${settled.length}명이 3초 안에 이름표와 함께 사라진다`, settled.every((e) => e.goneMs !== null && e.goneMs <= 3000), settled.map((e) => `이름표 소멸 ${e.goneMs === null ? "안 됨" : `${e.goneMs}ms`}`).join(", "));

      // ⑦ 마피아·시민 마크업 동일(390x844, ER1): 둘 다 도착 직후(반경 밖)에 읽은 심부름 영역의 data-* 이름·구조 표식 개수
      if (mafiaSig !== null && citizenSig !== null) {
        const f7 = fold(errandParityChecks(mafiaSig, citizenSig));
        rec(`${id}/d03`, "EF7", "마피아·시민 심부름 영역(타일·화살표·링·진행 점·시작 카드)의 data-* 이름·구조 표식 개수가 같고 가짜·역할류 표식이 없다(ER1)", f7.ok, f7.detail);
      }

      // ⑨ 소리: 심부름 → 토론 ui.host 한 번
      await clearLog(hp);
      const to = await skipOnce(hp, ht);
      await sleep(900);
      const n = await soundCount(hp, "ui.host");
      segs.push({ kind: "transition", name: `심부름 → ${to}`, count: n, played: n });
      const chime = hostChimeChecks([...segs, { kind: "first", name: "x", count: 0, played: 0 }, { kind: "muted", name: "x", count: 0, played: 0 }, ...(segs.some((s) => s.kind === "dayToErrand") ? [] : [{ kind: "dayToErrand", name: "낮 시작 → 심부름(읽지 못함)", count: -1, played: -1 }])]).filter((l) => l.id === "HS1" || l.id === "HS3");
      for (const l of chime) rec(`${id}/chime`, l.id, `${l.label} (구간 ${segs.length}개)`, l.ok, l.detail);
      rec(`${id}/chime`, "EF8", "심부름이 끝나면 토론으로 넘어간다", to === "discussion", `다음 단계 ${to}`);
      void ERRAND_E2E_MS;
    } finally {
      await closeGame(asGame(host));
    }
  }

  // ---- witness ----

  /** 한 페이지가 심부름 셋을 마친다(진행 3/3) */
  async function finishErrands(page, tracker) {
    for (let k = 1; k <= ERRAND_PER_PERSON; k++) await doPlace(page, tracker, k);
  }

  /**
   * witness (ERRAND-05, D-04): 방장·손님 둘(사람) + 봇 2. 방장과 첫 손님이 심부름 셋을 마치고 둘째 손님은 안 한다. 토론에서 마친 둘은 [기록] 1·카드 접힘(DOM 0)·띠 witness·[data-call] 1,
   * [기록] 을 누르면 카드 열림(줄 수 표식 = li 수·aria-expanded·빛 꺼짐·띠 discussion.act)·입력칸 포커스에 접힘(recordChecks). 못 마친 둘째 손님은 단추·카드 0. 지목으로 넘어가면 단추·카드 0.
   */
  async function witnessFlow(ctx) {
    const id = "witness";
    const rec = recorder(ctx);
    const host = await lobbyWith(ctx, id, { bots: 2, role: "citizen", vote: { exec: "yes", pick: "other" }, guests: 2 });
    try {
      const { page: hp, tracker: ht } = host;
      const [gb, gc] = host.guestPages;
      const mySeat = ht.last().me.seat;
      await startGame(hp, ht);
      await skipTo(hp, ht, "errand");
      await Promise.all([untilErrandDrawn(hp), untilErrandDrawn(gb.page), untilErrandDrawn(gc.page)]);
      // 마친 둘은 서로 병렬로 3곳을 처리한다(둘째 손님은 건드리지 않는다)
      await Promise.all([finishErrands(hp, ht), finishErrands(gb.page, gb.tracker)]);
      // 만남(결정적): 방장이 첫 손님의 마지막 위치로 걸어가 근처에서 표본 둘(2.2초)을 보낸다 — 남은 시간이 부족하면 만남은 건너뛴다(줄 수는 읽은 그대로 판정)
      const remainMs = (ht.last().phaseEndsAt ?? 0) - Date.now();
      let met = false;
      if (remainMs > 9000) {
        const pos = await gb.page.evaluate((s) => window.__mfWorld?.sample(s) ?? null, gb.seat);
        if (pos) {
          await tapWorld(hp, ht, mySeat, pos.x, pos.z).catch(() => null);
          await sleep(3600);
          met = true;
        }
      }
      await skipOnce(hp, ht);
      for (const g of [gb, gc]) await g.tracker.waitFor((v) => v.phase === "discussion", 8000, "토론 도착");
      await Promise.all([hp, gb.page, gc.page].map((p) => settleMap(p)));

      /** 마친 사람 한 명의 기록 판정(접힘 → 열기 → 입력칸 포커스) */
      const finishedFlow = async (handle, who, glow) => {
        const sc = `${id}/${who}`;
        const before = await readRecord(handle.page);
        rec(sc, "WF1", "마친 사람: [기록] 1개·카드 접힘(DOM 0)·띠 witness 문장·[data-call] 은 [기록] 하나", before.buttons === 1 && before.cards === 0 && before.bandLine === ERRAND_LINES.witness && before.callCount === 1 && before.buttonCall, `단추 ${before.buttons}, 카드 ${before.cards}, 띠 ${before.bandLine === ERRAND_LINES.witness ? "witness" : "다른 문장"}, 호출 ${before.callCount}`);
        await handle.page.locator("[data-record-button] button").click({ timeout: 3000 });
        await handle.page.waitForSelector("[data-record-card]", { timeout: 3000 });
        await sleep(450);
        const open = await readRecord(handle.page);
        rec(sc, "WF2", "[기록] 을 누르면 카드가 열린다(aria-expanded·[기록] 빛 꺼짐·띠 discussion.act — 빛은 입력칸으로 옮겨 간다)", open.cards === 1 && open.expanded && !open.buttonCall && open.callCount <= 1 && open.bandLine === ERRAND_LINES.discussionAct, `카드 ${open.cards}, expanded ${open.expanded}, [기록] 빛 ${open.buttonCall}, 호출 ${open.callCount}, 띠 ${open.bandLine === ERRAND_LINES.discussionAct ? "discussion.act" : "다른 문장"}`);
        if (glow) await gameGH(ctx, id, `record-${who}`, handle);
        await handle.page.locator(".mv-chat__input").first().focus({ timeout: 3000 });
        const collapsed = await handle.page.waitForFunction(() => document.querySelector("[data-record-card]") === null, null, { timeout: 2000 }).then(() => true, () => false);
        const f = fold(recordChecks({ finished: true, hasButton: before.buttons === 1, hasCard: open.cards === 1, rowsAttr: open.rowsAttr, rowCount: open.rowCount, zeroText: open.zeroText, cardRect: open.cardRect, dockRect: open.dockRect, bandRect: open.bandRect, inputRect: open.inputRect, collapsedOnFocus: collapsed }));
        rec(sc, "WR", `줄 수 표식 = li ${open.rowCount}개·줄 0이면 '0'·카드 윗변 ≥ 독 + 8·띠 교차 0·아랫변 ≤ 입력줄 − 8·입력칸 포커스에 접힘`, f.ok, f.detail);
        return open.rowCount;
      };
      const rowsA = await finishedFlow({ page: hp, tracker: ht, takeIssues: host.takeIssues }, "host", true);
      const rowsB = await finishedFlow(gb, "guest", false);
      rec(`${id}/meet`, "WF3", `만난 두 사람 가운데 한 명 이상은 기록 줄이 있다(줄 ${rowsA}·${rowsB}, 만남 ${met ? "시도함" : "시간 부족으로 건너뜀"})`, !met || rowsA + rowsB > 0, `방장 ${rowsA}줄, 손님 ${rowsB}줄`);

      // 못 마친 둘째 손님: 단추·카드 0, 다른 사람의 기록 줄도 DOM 에 없다
      const c = await readRecord(gc.page);
      const fc = fold(recordChecks({ finished: false, hasButton: c.buttons > 0, hasCard: c.cards > 0 }));
      rec(`${id}/unfinished`, "WR", "못 마친 사람: [기록]·카드 0건·기록 줄 0개", fc.ok && c.rowCount === 0, fc.detail || `줄 ${c.rowCount}개`);
      // 지목으로 넘어가면 단추·카드 0
      await skipOnce(hp, ht);
      await Promise.all([hp, gb.page].map((p) => settleMap(p)));
      const after = await readRecord(hp);
      rec(`${id}/nomination`, "WF4", "투표(지목)로 넘어가면 [기록]·카드가 없다", after.buttons === 0 && after.cards === 0, `단추 ${after.buttons}, 카드 ${after.cards}`);
    } finally {
      await closeGame(asGame(host));
    }
  }

  // ---- trace ----

  /** 밤에 닿았다고 보고 얼굴 목록이 그려질 때까지 기다린다 */
  async function untilNight(page, tracker) {
    await tracker.waitFor((v) => v.phase === "night", 8000, "밤 도착");
    await page.waitForFunction(() => !document.querySelector("[data-curtain]") && document.querySelector("[data-face]") !== null, null, { timeout: 10_000 });
    await sleep(400);
  }

  /**
   * trace (TRACE-01·02·03, D-05·D-06): 사람 8명(방장 경찰 + 손님 7). 첫 밤: 네 역할이 같은 칸 수·높이의 얼굴 목록을 받고(eye/heal 0·ring-kind mafia 0·거절 알림 0, nightFaceChecks)
   * 마피아 둘이 같은 사람을 골라 피해자가 생긴다. 아침: 흔적 구간(마지막 3초) 전에는 카드 0, 구간 안에서 모든 사람(유령 포함)에게 같은 카드 1개(traceChecks, 알림과 동시에 안 보임, ui.card 한 번).
   * 둘째 밤은 마피아 둘이 서로 다른 사람을 골라 아무도 안 죽는 아침 — 카드 0.
   */
  async function traceFlow(ctx) {
    const id = "trace";
    const rec = recorder(ctx);
    const host = await lobbyWith(ctx, id, { bots: 0, guests: 7, role: "police", vote: { exec: "yes", pick: "other" } });
    try {
      const { page: hp, tracker: ht } = host;
      const all = [{ page: hp, tracker: ht, seat: ht.last().me.seat, takeIssues: host.takeIssues }, ...host.guestPages];
      await startGame(hp, ht);
      for (const p of all) p.role = p.tracker.last().me.role;
      const byRole = (r) => all.filter((p) => p.role === r);
      const missing = ["mafia", "police", "doctor", "citizen"].filter((r) => byRole(r).length === 0);
      if (missing.length > 0 || byRole("mafia").length < 2 || byRole("citizen").length < 2) throw new SetupError("8명판에 마피아 둘·경찰·의사·시민 둘 이상이 없음");
      const [m1, m2] = byRole("mafia");
      const [c1, c2] = byRole("citizen");
      const [police] = byRole("police");
      const [doctor] = byRole("doctor");

      // ---- 첫 밤 ----
      await skipTo(hp, ht, "night");
      await Promise.all(all.map((p) => untilNight(p.page, p.tracker)));
      const aliveCount = ht.last().players.filter((p) => p.alive !== false).length;
      const before = new Map();
      for (const p of all) before.set(p, await readNightFaces(p.page));
      const victim = c1.seat;
      const other = c2.seat;
      const tapFace = async (p, seat) => {
        await p.page.locator(`[data-face="${seat}"]`).click({ timeout: 3000 });
        await sleep(700);
      };
      // 마피아 둘과 시민 하나는 피해자를, 경찰·의사는 다른 사람을 누른다(경찰·의사가 피해자를 지키거나 조사해도 판정이 달라지지 않게 피해자는 비운다)
      const picks = new Map([[m1, victim], [m2, victim], [c2, victim], [police, other], [doctor, other]]);
      const after = new Map();
      for (const [p, seat] of picks) {
        await tapFace(p, seat);
        after.set(p, await readNightFaces(p.page));
      }
      const list = [m1, police, doctor, c2].map((p) => {
        const b = before.get(p);
        const a = after.get(p);
        return { role: p.role, count: b.count, itemH: b.itemH, listH: b.listH, eyeHeal: a.eyeHeal, ringMafia: Math.max(b.ringMafia, a.ringMafia), callCount: b.callCount, disabledCount: Math.max(b.disabledCount, a.disabledCount), toastAfterTap: a.toastShown };
      });
      const nf = fold(nightFaceChecks(list));
      rec(`${id}/night1`, "NF", `마피아·경찰·의사·시민이 같은 칸 수(${list[0].count})·높이의 얼굴 목록, eye/heal 0·마피아 고리 0·거절 알림 0`, nf.ok, nf.detail);
      rec(`${id}/night1`, "NF7", `얼굴 목록 칸 수가 산 사람 수(${aliveCount})와 같다(나 포함 전원)`, list.every((x) => x.count === aliveCount), `칸 ${list.map((x) => x.count).join("/")} ≠ 산 사람 ${aliveCount}`);
      const mafiaBadge = after.get(m2);
      rec(`${id}/night1`, "NF8", "마피아 둘째의 칸이 같은 칸 수·거절 알림 없이 받아들여진다", mafiaBadge.count === aliveCount && mafiaBadge.toastShown === 0, `칸 ${mafiaBadge.count}, 알림 ${mafiaBadge.toastShown}`);

      // ---- 아침(피해자 있음) ----
      await clearLog(hp);
      await skipOnce(hp, ht);
      await Promise.all(all.map((p) => p.tracker.waitFor((v) => v.phase === "morning", 8000, "아침 도착")));
      await sleep(900);
      const early = await Promise.all(all.map((p) => readTrace(p.page)));
      const bad0 = early.filter((t) => t.cards !== 0).length;
      rec(`${id}/morning1`, "TR0", "흔적 구간 전(아침 시작 직후)에는 카드가 모든 사람에게 0개", bad0 === 0, `카드가 있는 페이지 ${bad0}곳`);
      // 구간 안: 카드가 뜨기를 기다린 뒤 모든 페이지를 한꺼번에 읽는다
      const got = await hp.waitForSelector("[data-trace-card]", { timeout: 16_000 }).then(() => true, () => false);
      if (!got) throw new SetupError("피해자가 있는 아침에 흔적 카드가 뜨지 않음(피해자 미발생 포함)");
      const inWin = await Promise.all(all.map((p) => readTrace(p.page)));
      const expectMorning = expectedMarks(ht.last());
      const texts = new Set(inWin.map((t) => t.cardText));
      for (const [i, t] of inWin.entries()) {
        const role = all[i].role;
        const f = fold(traceChecks({ expectCard: true, cards: t.cards, cardText: t.cardText, cardAttrText: t.cardAttrText, nameLines: t.nameLines, noteLines: t.noteLines, rowLines: t.rowLines, lastseenRows: t.lastseenRows, lastseenCount: t.lastseenCount, expectSeen: expectMorning.seen.length > 0, rowOverflow: t.rowOverflow, cardRect: t.cardRect, bandRect: t.bandRect, dockRect: t.dockRect, panelRect: t.panelRect, announceVisible: t.announceVisible }));
        rec(`${id}/morning1`, "TC", `${role}${all[i].seat === victim ? "(탈락)" : ""}: 증거 카드 1개·1행 두 줄·2행 한 줄 이내·금지 낱말 0·알림과 동시 0·띠·독·패널 교차 0·2행 표식·목격 count`, f.ok, f.detail);
      }
      // 이름표 표시(D-09·D-10): 카드와 같은 순간부터 같은 옷 산 사람·마지막 목격자 이름표에만 붙는다 — 모든 사람(유령 포함)이 같은 좌석 집합을 본다
      const morningMarks = await Promise.all(all.map((p) => readMarks(p.page)));
      for (const [i, m] of morningMarks.entries()) {
        const f = fold(traceMarkChecks({ stage: "morning", expectTrace: expectMorning.trace, expectSeen: expectMorning.seen, ...m }));
        rec(`${id}/morning1`, "TC7", `${all[i].role}${all[i].seat === victim ? "(탈락)" : ""}: 같은 옷 산 사람(${expectMorning.trace.length}명)·마지막 목격자(${expectMorning.seen.length}명) 이름표에만 표시`, f.ok, f.detail);
      }
      // OU1·OU2 (18-09, D-01): 시작 때 겹친 옷이 풀려 한 판 옷이 모두 다르고, 같은 옷 표시는 많아야 한 이름표(테스트 방 봇은 look 없이 들어온다)
      for (const l of outfitUniqueChecks({ players: ht.last().players, traceSeats: morningMarks[0].trace })) rec(`${id}/morning1`, l.id, l.label, l.ok, l.detail);
      rec(`${id}/morning1`, "TR7", "마피아·시민·경찰·의사·유령이 같은 표시 좌석 집합을 본다", new Set(morningMarks.map((m) => JSON.stringify([m.trace, m.seen]))).size === 1, `서로 다른 집합 ${new Set(morningMarks.map((m) => JSON.stringify([m.trace, m.seen]))).size}가지`);
      rec(`${id}/morning1`, "TR1", "모든 사람(유령 포함)에게 같은 카드 글자", texts.size === 1, `서로 다른 카드 글자 ${texts.size}가지`);
      rec(`${id}/morning1`, "TR2", "카드가 뜨는 동안 띠가 trace 문장이다", inWin.every((t) => t.bandLine === ERRAND_LINES.trace), `다른 문장 ${inWin.filter((t) => t.bandLine !== ERRAND_LINES.trace).length}곳`);
      rec(`${id}/morning1`, "TR6", "마피아 둘이 같은 사람을 골라 그 사람이 탈락한다(흔적 구간 읽기 전제)", ht.last().day?.morning?.eliminated === victim, `탈락 ${ht.last().day?.morning?.eliminated === victim ? "기대한 사람" : "다른 사람 또는 없음"}`);
      await gameGH(ctx, id, "morning-trace", all[0]);
      const cardSound = await soundCount(hp, "ui.card");
      rec(`${id}/morning1`, "TR3", "흔적 카드 도착 소리 ui.card 가 한 번", cardSound === 1, `ui.card ${cardSound}번`);
      void TRACE_WINDOW_MS;

      // ---- 낮: 같은 좌석에 표시가 남고 사회자가 근거를 가리킨다 (D-09·D-11) ----
      await skipTo(hp, ht, "discussion");
      await Promise.all(all.map((p) => p.tracker.waitFor((v) => v.phase === "discussion", 8000, "토론 도착")));
      await Promise.all(all.map((p) => settleMap(p.page)));
      const expectDay = expectedMarks(ht.last());
      rec(`${id}/discussion`, "TR8", "토론에도 같은 증거 값이 있다(day.evidence — 표시 좌석 기대가 아침과 같다)", JSON.stringify(expectDay) === JSON.stringify(expectMorning), `기대 좌석 아침 ${JSON.stringify(expectMorning)} · 토론 ${JSON.stringify(expectDay)}`);
      const dayMarks = await Promise.all(all.map((p) => readMarks(p.page)));
      for (const [i, m] of dayMarks.entries()) {
        const f = fold(traceMarkChecks({ stage: "discussion", expectTrace: expectDay.trace, expectSeen: expectDay.seen, ...m }));
        rec(`${id}/discussion`, "TC8", `${all[i].role}${all[i].seat === victim ? "(탈락)" : ""}: 토론에서도 같은 좌석에 표시가 남아 있다`, f.ok, f.detail);
      }
      // 띠: 심부름 기록이 없는 산 사람은 discussion.evidence, 기록이 있고 안 열었으면 witness(역할은 보지 않는다 — 마피아도 같은 문장)
      const dayBands = await Promise.all(all.map((p) => readTrace(p.page)));
      const wrongBands = all.filter((p, i) => p.seat !== victim && dayBands[i].bandLine !== (p.tracker.last().me.record !== undefined ? ERRAND_LINES.witness : ERRAND_LINES.discussionEvidence));
      rec(`${id}/discussion`, "TR9", "흔적이 있는 날 토론의 띠: 산 사람은 discussion.evidence(기록이 있고 안 열었으면 witness), 마피아도 같은 문장", wrongBands.length === 0, `다른 문장 ${wrongBands.length}곳`);

      // ---- 둘째 밤: 마피아가 갈려 아무도 안 죽는다 ----
      await skipTo(hp, ht, "night");
      await Promise.all(all.map((p) => (p.seat === victim ? Promise.resolve() : untilNight(p.page, p.tracker))));
      // 밤에는 서버가 day.evidence 를 싣지 않아 표시가 사라진다(D-09)
      await Promise.all(all.map((p) => p.tracker.waitFor((v) => v.phase === "night", 8000, "밤 도착(전원)")));
      await sleep(600);
      rec(`${id}/night2`, "TR10", "밤 view 에는 day.evidence 가 없다", ht.last().day?.evidence === undefined, `evidence ${ht.last().day?.evidence === undefined ? "없음" : "있음"}`);
      const expectNight = expectedMarks(ht.last());
      const nightMarks = await Promise.all(all.map((p) => readMarks(p.page)));
      for (const [i, m] of nightMarks.entries()) {
        const f = fold(traceMarkChecks({ stage: "night", expectTrace: expectNight.trace, expectSeen: expectNight.seen, ...m }));
        rec(`${id}/night2`, "TC8", `${all[i].role}${all[i].seat === victim ? "(탈락)" : ""}: 밤에는 이름표 표시가 0개`, f.ok, f.detail);
      }
      const seats = (await readNightFaces(hp)).faceSeats.filter((s) => s !== m1.seat);
      const [x1, x2] = seats;
      if (x1 === undefined || x2 === undefined) throw new SetupError("둘째 밤에 고를 수 있는 칸이 둘 미만");
      await tapFace(m1, x1);
      await tapFace(m2, x2);
      await skipOnce(hp, ht);
      await Promise.all(all.map((p) => p.tracker.waitFor((v) => v.phase === "morning", 8000, "둘째 아침 도착")));
      await sleep(1200);
      const noVictim = await Promise.all(all.map((p) => readTrace(p.page)));
      const resolved = ht.last().day?.morning;
      const nobodyDied = resolved !== undefined && resolved.eliminated === undefined && resolved.trace === undefined;
      const f2 = fold(noVictim.flatMap((t) => traceChecks({ expectCard: false, cards: t.cards, announceVisible: t.announceVisible })));
      rec(`${id}/morning2`, "TC", "피해자 없는 아침: 흔적 카드 0개(모든 사람)", f2.ok, f2.detail);
      rec(`${id}/morning2`, "TR4", "피해자 없는 아침의 띠는 trace 문장이 아니다", noVictim.every((t) => t.bandLine !== ERRAND_LINES.trace), `trace 문장 ${noVictim.filter((t) => t.bandLine === ERRAND_LINES.trace).length}곳`);
      rec(`${id}/morning2`, "TR5", "둘째 아침에는 흔적 키가 없다(갈린 밤 — 아무도 탈락하지 않음)", nobodyDied, `morning ${JSON.stringify(Object.keys(resolved ?? {}))}`);
    } finally {
      await closeGame(asGame(host));
    }
  }

  return { errandFlow, witnessFlow, traceFlow };
}

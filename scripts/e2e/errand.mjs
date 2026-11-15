// 15페이즈 심부름 E2E 흐름 (15-09, 16-07·16-08 에서 장소 타일·발밑 화살표·장소 위 [처리] 알약·진행 점 3·시작 카드 기준으로) — 21-15 에서 원인 흐름 저녁(등불 켜기) 기준으로 다시 썼다.
// 이름은 errand — 기존 흐름 이름과 `--only` 부분 일치가 겹치지 않는다(cause-* 와도 겹치지 않는다). 흐름은 화면을 읽기만 하고 판정은 lib.mjs 의 순수 함수(errandChecks 등)에 맡긴다:
// 판정 문턱은 여기서 낮추지 않는다(T-15-36). 닉네임·토큰은 결과 줄에 남기지 않는다(T-15-35) — 장소 id·진행 수·개수·단계 이름만 쓴다.
// 심부름은 실제 40초라(결정 0074) 시간 안에 못 끝낸 것은 시험 결함이 아니라 환경 지연이다 — 판정을 느슨하게 하지 않고 SetupError 로 던져 실행기가 다시 돌린다.
// 21-15: 판 종류 확장판의 낮은 '저녁 → 밤 → 아침 → 토론' 이라 심부름 단계(errand)는 저녁 등불 켜기다 — errandChecks·errandCardChecks 에 profile "lamp" 를 주어 띠 문장·시작 카드 제목·빛남 규칙(반경 안 [켜기] 하나, 밖이면 보이는 표지 전부)을 판정한다.
// 옛 목격 기록(witness)·아침 흔적 카드(trace) 흐름은 원인 흐름과 함께 사라진 기능([기록] 단추·흔적 카드·같은 옷 이름표 표시)이라 이 파일에서 뺐다 — 새 기능의 E2E 는 cause.mjs(cause-morning 의 단서 카드·의심 보드)가 맡고,
// 기본 마피아에 그 요소가 없음은 mode-basic·cause-basic 이 본다. 마피아·시민 마크업 동일(ER1)은 cause-evening 의 LH2 가 길게 누르기까지 포함해 본다.
// helpers 는 flows.mjs 가 넘긴다(host.mjs·sound.mjs 와 같은 모양 — 서로 import 하지 않는다): { recorder, openGame, closeGame, gameGH }
import {
  SetupError,
  pressErrandAct,
  readErrand,
  readStartCard,
  settle,
  skipOnce,
  sleep,
  waitErrandDone,
  walkToPlace,
} from "./browser.mjs";
import { ERRAND_NEAR_R_E2E, ERRAND_PER_PERSON, errandCardChecks, errandChecks, errandOverlapChecks } from "./lib.mjs";

/** 근처 반경에 더하는 여유(월드 단위): 서버 표본은 1초 간격이라 걸어서 막 나간 사람이 한 칸 남아 있을 수 있다 */
const NEAR_SLACK = 2;
/** 한 장소를 향해 걸어 [켜기] 를 켜는 최대 시간(ms) — 계획: 최대 16초 */
const PLACE_MS = 16_000;

const fold = (lines) => {
  const bad = lines.filter((l) => !l.ok);
  return { ok: bad.length === 0, detail: bad.map((l) => `${l.id} ${l.detail}`).join(" / ") };
};

export function makeErrandFlows({ recorder, openGame, closeGame, gameGH }) {
  /** 장면 막이 걷히고 띠가 그려질 때까지 기다린 뒤 한 박자 쉰다 */
  async function settleMap(page) {
    await page.waitForFunction(() => !document.querySelector("[data-curtain]") && document.querySelector("[data-host-line]") !== null, null, { timeout: 10_000 });
    await settle(page);
  }

  /** 저녁 화면이 그려질 때까지(진행 점 줄 + 표지나 화살표 하나 이상) */
  async function untilErrandDrawn(page) {
    await settleMap(page);
    await page.waitForFunction(() => document.querySelector("[data-errand-dots]") !== null && (document.querySelector("button[data-errand-place]:not([hidden])") !== null || document.querySelector("[data-errand-arrow]:not([hidden])") !== null), null, { timeout: 10_000 });
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

  /** 처리 반경 상태: 3곳을 다 켰으면 done, [켜기] 가 있으면 in, 아니면 out — 시작 자리에 따라 첫 장면부터 반경 안일 수 있어 읽은 값으로 정한다 */
  const reachOf = (r) => (r.doneAttr >= r.dotCount && r.dotCount > 0 ? "done" : r.actCount > 0 ? "in" : "out");

  /**
   * errandChecks 입력 한 벌(DOM 읽기 + 월드 좌석). 근처를 막 벗어난 사람의 이름표는 퇴장 연출(페이드)이 끝나야 사라지므로(U-17),
   * settleTags 이면 이름표가 월드 좌석 수 이하가 될 때까지 최대 3초 다시 읽는다 — 문턱은 같고 3초 안에 사라지는지를 본다.
   */
  async function errandInput(page, mySeat, { settleTags = false } = {}) {
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
        profile: "lamp",
        total: r.dotCount,
        places: r.places.map((p) => ({ id: p.id, done: p.done, hidden: p.hidden, call: p.call, rest: p.rest })),
        doneAttr: r.doneAttr,
        progressText: r.progressText,
        bandLine: r.bandLine,
        cards: r.cards,
        panelCount: r.panelCount,
        dotsRows: r.dotsRows,
        dotsAria: r.dotsAria,
        dotsLive: r.dotsLive,
        dotsText: r.dotsText,
        callCount: r.callCount,
        callKinds: r.callKinds,
        reach: reachOf(r),
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

  /** 장소 위 [켜기] 알약이 보이는가(처리 반경 안에서만 DOM 에 있다) */
  const actVisible = (page) =>
    page.evaluate(() => {
      const act = document.querySelector("button[data-errand-act]");
      if (!act || act.hidden) return false;
      const r = act.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });

  /**
   * 한 장소를 향해 걷다가 알약이 보이면(onInRange 가 있으면 먼저 그 읽기를 하고) 눌러 진행이 n 이 되게 한다. 시간(PLACE_MS)·단계 종료는 SetupError.
   * 반경 밖에서는 알약이 없으므로 걷기만 한다(표지나 화살표 방향을 누른다).
   */
  async function doPlace(page, tracker, n, onInRange) {
    const t0 = Date.now();
    while (Date.now() - t0 < PLACE_MS) {
      if (tracker.last()?.phase !== "errand") throw new SetupError(`등불 ${n}번째를 켜기 전에 단계가 끝남(지금 ${tracker.last()?.phase})`);
      if (await actVisible(page)) {
        if (onInRange) await onInRange();
        if (await pressErrandAct(page)) {
          if (await waitErrandDone(page, n, 2500)) return;
        }
      } else await walkToPlace(page);
      await sleep(1000);
    }
    const last = await readErrand(page).catch(() => null);
    const note = last ? ` (진행 ${last.progressText}·표지 ${last.pins.length}/${last.places.length}·화살표 ${last.arrows.length}·알약 ${last.actCount}·단계 ${tracker.last()?.phase})` : "";
    throw new SetupError(`등불 ${n}번째를 ${PLACE_MS / 1000}초 안에 켜지 못함${note}`);
  }

  // ---- errand ----

  /**
   * errand (ERRAND-01~04·07, 원인 흐름 저녁, 폰 6종): 방장(시민) + 봇 5 로 저녁(errand 단계)까지 가서 ① 도착 2초 안 시작 카드 1(타일 3·단추 0·제목 "오늘 켤 등불")·2.5초 뒤 0, 그 뒤 진행 점 3(done 0)·"0/3"·아래 패널 0·
   * 표지 64·빛 한 종류(반경 안 [켜기] 하나, 밖이면 보이는 표지 전부)·띠 errand.lamp.act·근처 링(errandChecks profile lamp) ② 근처 밖 좌석 0 ③ 등불 셋을 걸어 켠다 — [켜기] 가 나타난 순간 반경 안 읽기를 하고 눌러
   * 각 단계 채운 점·표지·진행 표식을 본다 → 3/3 에서 알약·화살표 0·띠 errand.lamp.done ④ 표지·화살표·알약 영역(errandOverlapChecks, 폰 6종) ⑤ 근처에서 빠진 좌석은 이름표도 사라진다 ⑥ 묶음 G·H ⑦ 저녁이 끝나면 밤으로 넘어간다.
   */
  async function errandFlow(ctx) {
    const id = "errand";
    const rec = recorder(ctx);
    const game = await openGame(ctx, id, { guests: 0, bots: 5, role: "citizen", vote: { exec: "yes", pick: "other" }, to: "errand" });
    try {
      const { hp, ht } = game;
      const mySeat = ht.last().me.seat;
      // 시작 카드(16-08): 단계 시작 2초 안에 읽고, 2.5초 뒤에는 사라졌는지 본다
      const cardSeen = await hp.waitForSelector("[data-errand-start-card]", { timeout: 4000 }).then(() => true, () => false);
      if (!cardSeen) throw new SetupError("저녁 시작 카드가 4초 안에 보이지 않음");
      const cardEarly = await readStartCard(hp);
      await sleep(2500);
      const cardLate = await readStartCard(hp);
      const fcard = fold(errandCardChecks({ profile: "lamp", early: cardEarly, late: cardLate }));
      rec(`${id}/start-card`, "EC1", "시작 카드: 2초 안 1개(타일 3·단추 0·제목 '오늘 켤 등불'·한 줄), 2.5초 뒤 0개", fcard.ok, fcard.detail || `2초 안 ${cardEarly.cards}개·타일 ${cardEarly.tiles}, 2.5초 뒤 ${cardLate.cards}개`);
      await untilErrandDrawn(hp);

      // ① 도착 직후
      const first = await errandInput(hp, mySeat, { settleTags: true });
      const f1 = fold(errandChecks(first.s));
      rec(`${id}/arrive`, "EA", `진행 점 3·"0/3"·아래 패널 0·표지 64·빛 한 종류(${first.s.reach === "in" ? "반경 안" : "반경 밖"})·근처 밖 좌석 0·표식 값에 좌석·역할 없음 (좌석 ${first.s.seatsInWorld}·근처 ${first.s.nearSeats})`, f1.ok, f1.detail);
      rec(`${id}/arrive`, "EF1", "진행 점 줄 1개·헤더 제목 '등불 켜기'·근처 링(24점 정지 모양)이 있고 시작 카드는 지나갔다", first.r.dotsRows === 1 && first.r.title.includes("등불") && first.r.ringShown && first.r.ringPoints >= 8 && first.r.cards === 0, `점 줄 ${first.r.dotsRows}, 제목 ${first.r.title ? "있음" : "없음"}, 링 ${first.r.ringShown}(${first.r.ringPoints}점), 카드 ${first.r.cards}`);
      rec(`${id}/arrive`, "EF2", "진행 점 수 = 3, done 0", first.s.total === ERRAND_PER_PERSON && first.s.doneAttr === 0, `점 ${first.s.total}, done ${first.s.doneAttr}`);
      // ④ 영역: 표지·화살표·알약(보이는 것만)이 서로·이름표 버튼·띠·오른쪽 열·진행 점 줄과 교차 0
      const overlap = (r, when) => {
        const f = fold(errandOverlapChecks({ stage: r.stage, band: r.band, side: r.side, dots: r.dots, vh: r.vh, pins: r.pins, arrow: r.arrows, act: r.act, tagButtons: r.tagButtons }));
        rec(`${id}/${when}`, "EO", `표지 ${r.pins.length}·화살표 ${r.arrows.length}·알약 ${r.act ? 1 : 0}이 서로·이름표·띠·오른쪽 열·진행 점 줄과 겹치지 않고 스테이지 안쪽 8 안이며 점 줄 아래 변 = 창 아래 − 40 (${when})`, f.ok, f.detail);
      };
      overlap(first.r, "arrive");
      // ⑥ 묶음 G·H(콘솔 오류·14px·가로 넘침·헤더 대비)
      await gameGH(ctx, id, "errand", game.host);

      // ③ 등불 셋을 걸어 켠다
      await startExitWatch(hp, mySeat);
      for (let k = 1; k <= ERRAND_PER_PERSON; k++) {
        await doPlace(hp, ht, k, k === 1
          ? async () => {
              await sleep(200);
              // 영역 겹침(EO)은 알약이 나타난 순간의 읽기(inn)로, 이름표 수(EA5)는 가라앉힌 읽기로 판정한다(16-10)
              const inn = await errandInput(hp, mySeat);
              const innEa = await errandInput(hp, mySeat, { settleTags: true });
              const fi = fold(errandChecks(innEa.s));
              rec(`${id}/in-range`, "EA", "반경 안: [켜기] 1·화살표 0·[켜기] 만 빛남·표지 64", fi.ok, fi.detail);
              overlap(inn.r, "in-range");
            }
          : undefined);
        await sleep(700);
        const r = await readErrand(hp);
        const marks = r.places.filter((p) => p.done).length;
        rec(`${id}/place-${k}`, "EF4", `${k}번째 켬: 채운 점 ${k}·표지 done ${k}·진행 ${k}/3`, r.doneAttr === k && marks === k && r.progressText === `${k}/3`, `점 ${r.doneAttr}, 표지 ${marks}, 진행 ${r.progressText}`);
        if (k === 1) overlap(r, "mid");
      }
      const exits = await stopExitWatch(hp);
      await sleep(600);
      const done = await errandInput(hp, mySeat, { settleTags: true });
      const f3 = fold(errandChecks(done.s));
      rec(`${id}/done`, "EA", `3/3: [켜기]·화살표 0·띠 errand.lamp.done·아래 패널 0·빛 0·표식 값 (${done.s.progressText})`, f3.ok && done.s.callCount === 0 && done.s.reach === "done", f3.detail || `[data-call] ${done.s.callCount}개·반경 ${done.s.reach}`);
      rec(`${id}/done`, "EF5", "3/3 에서 점 셋이 모두 채워지고 표지 셋이 모두 data-done 이다", done.r.doneAttr === ERRAND_PER_PERSON && done.r.places.length === ERRAND_PER_PERSON && done.r.places.every((p) => p.done), `점 ${done.r.doneAttr}, 켠 표지 ${done.r.places.filter((p) => p.done).length}/${done.r.places.length}`);

      // ⑤ 근처에서 빠진 좌석은 월드·이름표에서 사라진다(걷는 동안 관찰한 것만 — 빠진 사람이 없었으면 참고 행)
      const settled = (exits?.exits ?? []).filter((e) => e.ageMs >= 3000);
      if (settled.length === 0) rec(`${id}/exit`, "EF6", "근처를 벗어난 좌석이 이름표와 함께 사라진다(관찰된 이탈 없음 — 건너뜀)", true, `관찰 중 최대 ${exits?.everSeen ?? 0}명이 근처에 있었고 3초 이상 지난 이탈 0건`, true);
      else rec(`${id}/exit`, "EF6", `근처를 벗어난 좌석 ${settled.length}명이 3초 안에 이름표와 함께 사라진다`, settled.every((e) => e.goneMs !== null && e.goneMs <= 3000), settled.map((e) => `이름표 소멸 ${e.goneMs === null ? "안 됨" : `${e.goneMs}ms`}`).join(", "));

      // ⑦ 저녁이 끝나면 밤으로 넘어간다(원인 흐름: errand → night)
      const to = await skipOnce(hp, ht);
      rec(`${id}/next`, "EF8", "저녁이 끝나면 밤으로 넘어간다", to === "night", `다음 단계 ${to}`);
    } finally {
      await closeGame(game);
    }
  }

  return { errandFlow };
}

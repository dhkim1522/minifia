// 15페이즈 심부름·목격 기록·아침 흔적 E2E 흐름 (15-09): errand(심부름, 폰 6종)·witness(목격 기록, 폰 6종)·trace(밤 얼굴 목록 통일 + 아침 흔적 카드, 폰 6종).
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
  readNightFaces,
  readRecord,
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
import { ERRAND_E2E_MS, ERRAND_LINES, ERRAND_NEAR_R_E2E, ERRAND_PER_PERSON, TRACE_WINDOW_MS, errandChecks, errandOverlapChecks, hostChimeChecks, nightFaceChecks, recordChecks, traceChecks } from "./lib.mjs";

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

  /** 심부름 화면이 그려질 때까지(독 + 표지나 화살표 하나 이상) */
  async function untilErrandDrawn(page) {
    await settleMap(page);
    await page.waitForFunction(() => document.querySelector("[data-errand-dock]") !== null && (document.querySelector("button[data-errand-place]:not([hidden])") !== null || document.querySelector("[data-errand-arrow]:not([hidden])") !== null), null, { timeout: 8000 });
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
        total: r.chips,
        places: r.places.map((p) => ({ id: p.id, done: p.done })),
        doneAttr: r.doneAttr,
        progressText: r.progressText,
        actText: r.actText,
        actDisabled: r.actDisabled,
        bandLine: r.bandLine,
        callCount: r.callCount,
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

  /** 한 장소를 향해 걷고 [처리] 를 눌러 진행이 n 이 되게 한다. 시간(PLACE_MS)·단계 종료는 SetupError */
  async function doPlace(page, tracker, n) {
    const t0 = Date.now();
    while (Date.now() - t0 < PLACE_MS) {
      if (tracker.last()?.phase !== "errand") throw new SetupError(`심부름 ${n}번째 장소를 처리하기 전에 단계가 끝남(지금 ${tracker.last()?.phase})`);
      if (await pressErrandAct(page)) {
        if (await waitErrandDone(page, n, 2500)) return;
      } else await walkToPlace(page);
      await sleep(1000);
    }
    throw new SetupError(`심부름 ${n}번째 장소를 ${PLACE_MS / 1000}초 안에 처리하지 못함`);
  }

  /** 마피아·시민 심부름 화면 DOM 서명(D-03): 아래 패널의 data-* 이름 집합·칩 수·표지 수·단추 수 + 문서 전체에 역할류 표식 이름이 있는지 */
  const domSignature = (page) =>
    page.evaluate(() => {
      const panel = document.querySelector("[data-world-panel]");
      const names = new Set();
      for (const el of panel ? [panel, ...panel.querySelectorAll("*")] : []) for (const n of el.getAttributeNames()) if (n.startsWith("data-") && n !== "data-call" && n !== "data-done") names.add(n);
      const roleish = new Set();
      for (const el of document.querySelectorAll("[data-game-stage], [data-game-stage] *")) for (const n of el.getAttributeNames()) if (/fake|mafia|role-|decoy|bluff/i.test(n)) roleish.add(n);
      return {
        panelNames: [...names].sort(),
        panelButtons: panel ? panel.querySelectorAll("button").length : -1,
        chips: document.querySelectorAll("[data-errand-chip]").length,
        pins: document.querySelectorAll("[data-errand-place]").length,
        acts: document.querySelectorAll("[data-errand-act]").length,
        docks: document.querySelectorAll("[data-errand-dock]").length,
        roleish: [...roleish].sort(),
      };
    });

  // ---- errand ----

  /**
   * errand (ERRAND-01~04, D-02·D-03): 방장 + 봇 5 로 심부름 단계까지 가서 ① 도착 직후 독 1·칩 3(done 0)·"0/3"·[처리] aria-disabled·띠 errand.act·[data-call] 1 이하·근처 링(errandChecks)
   * ② 반경 밖 [처리] 가 아무 일 없음 ③ 월드·이름표에 근처 밖 좌석 0 ④ 장소 셋을 걸어 처리(각 단계 칩·표지·진행 숫자) → 3/3 에서 [처리] 완료·aria-disabled·띠 errand.done
   * ⑤ 표지·화살표 칩 영역(errandOverlapChecks, 폰 6종) ⑥ 근처에서 빠진 좌석은 이름표도 사라진다 ⑦ 390x844: 방 둘(마피아/시민)의 심부름 DOM 서명이 같다 ⑧ 묶음 G·H ⑨ 소리: 낮 시작 → 심부름 0번·심부름 → 토론 1번.
   */
  async function errandFlow(ctx) {
    const id = "errand";
    const rec = recorder(ctx);
    const firstSize = ctx.size.label === "390x844";
    let mafiaSig = null;
    if (firstSize) {
      // 마피아 판: 심부름 도착 직후 서명만 읽고 닫는다(방 하나 더 — 이 비교는 390x844 에서만)
      const mh = await lobbyWith(ctx, id, { bots: 4, role: "mafia", vote: { exec: "yes", pick: "other" } });
      try {
        await startGame(mh.page, mh.tracker);
        await skipTo(mh.page, mh.tracker, "errand");
        await untilErrandDrawn(mh.page);
        mafiaSig = await domSignature(mh.page);
        const r = await readErrand(mh.page);
        rec(`${id}/mafia`, "EF0", `마피아 판의 심부름 화면이 같은 모양으로 그려진다(독 ${r.docks}·칩 ${r.chips}·표지 ${r.places.length})`, r.docks === 1 && r.chips === ERRAND_PER_PERSON && r.places.length === ERRAND_PER_PERSON, `독 ${r.docks}, 칩 ${r.chips}, 표지 ${r.places.length}`);
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
      await untilErrandDrawn(hp);

      // ① 도착 직후
      const first = await errandInput(hp, mySeat);
      const f1 = fold(errandChecks(first.s));
      rec(`${id}/arrive`, "EA", `진행 칩 3·"0/3"·[처리] 규칙·호출 1 이하·근처 밖 좌석 0·표식 값에 좌석·역할 없음 (좌석 ${first.s.seatsInWorld}·근처 ${first.s.nearSeats})`, f1.ok, f1.detail);
      rec(`${id}/arrive`, "EF1", "독 1개·심부름 제목·근처 링(24점 정지 모양)이 있다", first.r.docks === 1 && first.r.title.includes("심부름") && first.r.ringShown && first.r.ringPoints >= 8, `독 ${first.r.docks}, 제목 ${first.r.title ? "있음" : "없음"}, 링 ${first.r.ringShown}(${first.r.ringPoints}점)`);
      rec(`${id}/arrive`, "EF2", "진행 칩 수 = 3, done 0", first.s.total === ERRAND_PER_PERSON && first.s.doneAttr === 0, `칩 ${first.s.total}, done ${first.s.doneAttr}`);
      // ⑤ 영역: 표지·화살표 칩(보이는 것만)이 서로·이름표 버튼·띠·독 줄·아래 패널과 교차 0
      const overlap = (r, when) => {
        const f = fold(errandOverlapChecks({ stage: r.stage, band: r.band, dock: r.dockRow, panel: r.panel, pins: r.pins, arrow: r.arrows, tagButtons: r.tagButtons }));
        rec(`${id}/${when}`, "EO", `표지 ${r.pins.length}·화살표 ${r.arrows.length}가 서로·이름표·띠·독 줄·아래 패널과 겹치지 않고 스테이지 안쪽 8 안 (${when})`, f.ok, f.detail);
      };
      overlap(first.r, "arrive");
      // ⑧ 묶음 G·H(콘솔 오류·14px·가로 넘침·헤더 대비)
      await gameGH(ctx, id, "errand", host);

      // ② 반경 밖 [처리]: 눌러도 아무 변화가 없다(알림 없음)
      if (first.s.actDisabled) {
        await hp.locator("[data-errand-act]").click({ timeout: 3000, force: true });
        await sleep(500);
        const after = await readErrand(hp);
        const toast = await hp.evaluate(() => document.querySelectorAll(".mv-toast.is-on").length);
        rec(`${id}/out-of-range`, "EF3", "반경 밖 [처리] 는 진행·표지·알림이 변하지 않는다", after.doneAttr === 0 && after.progressText === "0/3" && toast === 0, `done ${after.doneAttr}, 진행 ${after.progressText}, 알림 ${toast}`);
      } else rec(`${id}/out-of-range`, "EF3", "반경 밖 [처리] 는 진행·표지·알림이 변하지 않는다", false, "도착 직후에 이미 [처리] 가 켜져 있어 반경 밖을 시험할 수 없음");

      // ④ 장소 셋을 걸어 처리
      await startExitWatch(hp, mySeat);
      for (let k = 1; k <= ERRAND_PER_PERSON; k++) {
        await doPlace(hp, ht, k);
        await sleep(700);
        const r = await readErrand(hp);
        const marks = r.places.filter((p) => p.done).length;
        rec(`${id}/place-${k}`, "EF4", `${k}번째 처리: 칩 done ${k}·표지 done ${k}·진행 ${k}/3`, r.doneAttr === k && marks === k && r.progressText === `${k}/3`, `칩 ${r.doneAttr}, 표지 ${marks}, 진행 ${r.progressText}`);
        if (k === 1) overlap(r, "mid");
      }
      const exits = await stopExitWatch(hp);
      await sleep(600);
      const done = await errandInput(hp, mySeat, { settleTags: true });
      const f3 = fold(errandChecks(done.s));
      rec(`${id}/done`, "EA", `3/3: [처리] 완료·aria-disabled·띠 errand.done·호출 0·표식 값 (${done.s.progressText})`, f3.ok && done.s.callCount === 0, f3.detail || `[data-call] ${done.s.callCount}개`);
      rec(`${id}/done`, "EF5", "3/3 에서 [처리] 요소가 완료(data-done)로 남고 칩 셋이 모두 채워진다", done.r.actDone && done.r.doneAttr === ERRAND_PER_PERSON, `data-done ${done.r.actDone}, 칩 ${done.r.doneAttr}`);

      // ⑥ 근처에서 빠진 좌석은 월드·이름표에서 사라진다(걷는 동안 관찰한 것만 — 빠진 사람이 없었으면 참고 행)
      const settled = (exits?.exits ?? []).filter((e) => e.ageMs >= 3000);
      if (settled.length === 0) rec(`${id}/exit`, "EF6", "근처를 벗어난 좌석이 이름표와 함께 사라진다(관찰된 이탈 없음 — 건너뜀)", true, `관찰 중 최대 ${exits?.everSeen ?? 0}명이 근처에 있었고 3초 이상 지난 이탈 0건`, true);
      else rec(`${id}/exit`, "EF6", `근처를 벗어난 좌석 ${settled.length}명이 3초 안에 이름표와 함께 사라진다`, settled.every((e) => e.goneMs !== null && e.goneMs <= 3000), settled.map((e) => `이름표 소멸 ${e.goneMs === null ? "안 됨" : `${e.goneMs}ms`}`).join(", "));

      // ⑦ 마피아·시민 DOM 서명(390x844)
      if (mafiaSig !== null) {
        const citizenSig = await domSignature(hp);
        const same = JSON.stringify({ ...mafiaSig, acts: 1 }) === JSON.stringify({ ...citizenSig, acts: 1 });
        rec(`${id}/d03`, "EF7", "마피아·시민 심부름 화면의 DOM 서명(아래 패널 data-* 이름·단추·칩·표지·독 수)이 같고 역할류 표식 이름이 없다", same && citizenSig.roleish.length === 0 && mafiaSig.roleish.length === 0, same ? `역할류 표식 ${citizenSig.roleish.join(",")}` : `마피아 ${JSON.stringify(mafiaSig)} ≠ 시민 ${JSON.stringify(citizenSig)}`);
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
      const texts = new Set(inWin.map((t) => t.cardText));
      for (const [i, t] of inWin.entries()) {
        const role = all[i].role;
        const f = fold(traceChecks({ expectCard: true, cards: t.cards, cardText: t.cardText, cardAttrText: t.cardAttrText, nameLines: t.nameLines, noteLines: t.noteLines, cardRect: t.cardRect, bandRect: t.bandRect, dockRect: t.dockRect, panelRect: t.panelRect, announceVisible: t.announceVisible }));
        rec(`${id}/morning1`, "TC", `${role}${all[i].seat === victim ? "(탈락)" : ""}: 흔적 카드 1개·두 줄 이내·금지 낱말 0·알림과 동시 0·띠·독·패널 교차 0`, f.ok, f.detail);
      }
      rec(`${id}/morning1`, "TR1", "모든 사람(유령 포함)에게 같은 카드 글자", texts.size === 1, `서로 다른 카드 글자 ${texts.size}가지`);
      rec(`${id}/morning1`, "TR2", "카드가 뜨는 동안 띠가 trace 문장이다", inWin.every((t) => t.bandLine === ERRAND_LINES.trace), `다른 문장 ${inWin.filter((t) => t.bandLine !== ERRAND_LINES.trace).length}곳`);
      rec(`${id}/morning1`, "TR6", "마피아 둘이 같은 사람을 골라 그 사람이 탈락한다(흔적 구간 읽기 전제)", ht.last().day?.morning?.eliminated === victim, `탈락 ${ht.last().day?.morning?.eliminated === victim ? "기대한 사람" : "다른 사람 또는 없음"}`);
      await gameGH(ctx, id, "morning-trace", all[0]);
      const cardSound = await soundCount(hp, "ui.card");
      rec(`${id}/morning1`, "TR3", "흔적 카드 도착 소리 ui.card 가 한 번", cardSound === 1, `ui.card ${cardSound}번`);
      void TRACE_WINDOW_MS;

      // ---- 둘째 밤: 마피아가 갈려 아무도 안 죽는다 ----
      await skipTo(hp, ht, "night");
      await Promise.all(all.map((p) => (p.seat === victim ? Promise.resolve() : untilNight(p.page, p.tracker))));
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

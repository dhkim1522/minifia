// 사회자 E2E: emcee-band(공통 헤더, 폰 6종)·emcee-tools(도구 이름표 전수)·emcee-leak(역할 다섯 시점 누설)·emcee-sound(알림음).
// 이름 앞머리는 emcee — 기존 host-handoff 와 `--only host` 앞부분 일치가 겹치지 않게 한다.
// 판정 문턱은 여기서 낮추지 않는다(T-14-21). 닉네임·토큰은 결과 줄에 남기지 않는다(T-14-22) — 단계 이름·역할 이름·개수만 쓴다.
// flows.mjs 가 이미 3천 줄이라 흐름 본문은 이 파일에 둔다. flows.mjs 의 도우미는 `makeHostFlows(helpers)` 로 받는다(sound.mjs·politics.mjs 와 같은 모양 — 서로 import 하지 않는다).
// helpers: { recorder, attempt, startHost, openGuest, closeGame, gameGH, settledResult }
import {
  SetupError,
  chooseRole,
  closeRoleCard,
  openRoleCard,
  openTableDockPane,
  openTestSheet,
  readCallCount,
  readHostBand,
  readRoomText,
  readToolButtons,
  readToolLabelCounts,
  closeSheet,
  setBotVote,
  setBots,
  settle,
  showPeopleTarget,
  skipOnce,
  skipTo,
  sleep,
  startGame,
  chooseVerdict,
  tapTurnPick,
  waitForPhaseStart,
} from "./browser.mjs";
import { TOD_ABSENT_PHASES, TOD_BY_PHASE, readTodHead, todAbsentChecks, todChecks } from "./polish.mjs";
import { TIMELESS_PHASES, willLeakChecks, hostChimeChecks, hostLeakChecks, toolLabelChecks, viewKeyChecks } from "./lib.mjs";

const BAND_NICK = "띠검사방장";
/** 8명 투표 화면 시험용 손님 일곱(모두 4자 — UI-SPEC "이름표 버튼 8개 … (4자 이름, 폰 6종)", basic-vote 와 같은 이름). 봇 이름은 첫 봇이 8자 고정이라 4자 이름 전제가 맞지 않는다(결정 0052-3 과 같은 이유) */
const BAND_GUESTS = ["가나다라", "마바사아", "자차카타", "파하거너", "더러머버", "서어저처", "커터퍼허"];
/** 한 판을 한 칸씩 넘기는 최대 칸 수(부하로 날이 길어져도 ended 에 닿도록 넉넉히) */
const MAX_STEPS = 90;
/** 시간이 있는 단계의 최소 길이(ms) — src/game/hostLine.ts hostTimeOf 와 같은 값 */
const HOST_TIME_MIN_MS = 3000;
/** 공통 헤더와 화면 읽기 안내를 확인할 첫날 단계. */
const BAND_REQUIRED = ["lobby", "roleReveal", "keyword", "dayAnnounce", "answerReveal", "discussion", "verdict", "nomination", "defense", "execution", "night", "morning", "ended"];
const GH_PHASES = ["discussion", "nomination", "night", "morning"];
const GUIDED_PHASES = ["roleReveal", "keyword", "discussion", "verdict", "nomination", "defense", "night"];
/** 알림음: 낮 시작 직후 훅 로그가 쌓이도록 기다리는 시간(ms) */
const CHIME_SETTLE_MS = 900;

/** 하나의 판정 목록을 한 줄(통과면 비움, 아니면 실패 판정 id 와 이유)로 접는다 */
const fold = (lines) => {
  const bad = lines.filter((l) => !l.ok);
  return { ok: bad.length === 0, detail: bad.map((l) => `${l.id} ${l.detail}`).join(" / ") };
};

/** 받은 view 가 hostTimeOf 의 조건(시간이 있는 단계·마감 시각·3초 이상)인가 */
const timedOf = (v) => !TIMELESS_PHASES.includes(v.phase) && v.phaseEndsAt !== null && v.phaseEndsAt !== undefined && v.phaseDurationMs !== null && v.phaseDurationMs !== undefined && v.phaseDurationMs >= HOST_TIME_MIN_MS;

/** 내가 탈락했는가(players 에서 내 좌석의 alive) */
const isGhostView = (v) => v.players.find((p) => p.seat === v.me.seat)?.alive === false;

/** 장면 전환 막이 걷히고 띠가 그려질 때까지 기다린 뒤 한 박자 쉰다. 그 사이 단계가 바뀌었으면 false(읽지 않는다) */
async function settleBand(page, tracker, phase) {
  await page.waitForFunction(() => !document.querySelector("[data-curtain]") && document.querySelector("[data-host-line]") !== null, null, { timeout: 8000 });
  await settle(page);
  return tracker.last()?.phase === phase;
}

/** 결정 0100: 화면에는 헤더 게이지만 두고 기존 사회자 줄은 화면 읽기에 제공한다. */
function readCommonHeader(page) {
  return page.evaluate(() => {
    const all = (selector) => [...document.querySelectorAll(selector)];
    const headers = all("[data-phase-header]");
    const gauges = all("[data-phase-gauge]");
    const guide = all("[data-host-line]");
    const announcement = all("[data-room-announcement]");
    const clean = (node) => (node?.textContent ?? "").replace(/\s+/g, " ").trim();
    return {
      headers: headers.length,
      title: clean(headers[0]?.querySelector(".mv-phase__title")),
      timers: gauges.map((el) => ({
        role: el.getAttribute("role"),
        label: el.getAttribute("aria-label"),
        inHeader: el.closest("[data-phase-header]") !== null,
        visual: el.getBoundingClientRect().height > 0,
      })),
      guideCount: guide.length,
      guideReady: Boolean(guide[0]?.closest(".mf-sr-only")) && guide[0]?.getAttribute("role") === "status" && guide[0]?.getAttribute("aria-live") === "polite",
      guideAccessible: !!clean(guide[0]) && !guide[0].closest('[aria-hidden="true"]'),
      announcementCount: announcement.length,
      announcementReady: announcement[0]?.classList.contains("mf-sr-only") && announcement[0]?.getAttribute("aria-live") === "polite" && !announcement[0].closest('[aria-hidden="true"]'),
      announcement: clean(announcement[0]),
      obsolete: all("[data-host-time], .mv-host__bar, .mv-host__bell, .mv-ring, .mf-timer").length,
    };
  });
}

/** ended 까지 넘긴다. 처형이 없는 날이 이어지면 한 번의 skipTo(24칸)로 모자랄 수 있어 몇 번 더 시도한다(마감이 먼저 지나 이미 ended 면 그대로 둔다).
 *  15페이즈: 하루에 단계가 하나 늘어(6칸) 시도 횟수를 5 → 8 로 올렸다(15-09, 22-06 에서 그 단계가 없어졌지만 한도라 그대로 둔다). */
async function driveToEnd(hp, ht, tries = 8) {
  for (let i = 0; i < tries && ht.last().phase !== "ended"; i++) {
    try {
      await skipTo(hp, ht, "ended");
    } catch (e) {
      if (ht.last().phase === "ended") break;
      if (i === tries - 1) throw e;
    }
  }
}

/** 열린 시트를 [닫기] 아이콘 단추(aria-label)로 닫는다 */
async function closeTopSheet(page) {
  await page.locator('button[aria-label="닫기"]').first().click({ timeout: 4000 });
  await sleep(350);
}

export function makeHostFlows({ recorder, attempt, startHost, openGuest, closeGame, gameGH, settledResult }) {
  const asGame = (host) => ({ host, guests: host.guestPages ?? [] });

  /**
   * 18.1-08 시간대 글자 한 번 읽기(D1·D4·D5 또는 D2, 0083-1). 게임 맵 단계면 todChecks 줄을, 글자가 없어야 하는 화면(대기실·역할 배정·역할 확인·결과)이면 todAbsentChecks 줄을 쌓는다.
   * 읽기 실패는 띠 판정을 막지 않고 D0 실패 줄로만 남는다.
   */
  async function recordTod(page, rec, sc, phase) {
    const r = await attempt(async () => {
      const m = await readTodHead(page);
      if (Object.hasOwn(TOD_BY_PHASE, phase)) {
        for (const l of todChecks(m, { phase })) rec(sc, l.id, `${l.label} (${phase})`, l.ok, l.detail);
      } else if (TOD_ABSENT_PHASES.includes(phase)) {
        const l = todAbsentChecks(m.count, { screen: phase });
        rec(sc, l.id, l.label, l.ok, l.detail);
      }
    });
    if (!r.ok) rec(sc, "D0", `시간대 글자를 읽는다(${phase})`, false, r.detail);
  }

  /** 방장 한 명 + 봇 n 으로 시작 직전(로비)까지 만든다. 시트는 닫아 둔다. */
  async function lobbyWith(ctx, flowId, { bots, role, vote, guests = 0 }) {
    const host = await startHost(ctx, flowId, { nickname: BAND_NICK });
    const { page: hp, tracker: ht } = host;
    host.guestPages = [];
    for (let i = 0; i < guests; i++) {
      const { guest, seat } = await openGuest(ctx, BAND_GUESTS[i]);
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

  // ---- emcee-band ----

  /** 8인 첫날의 공통 헤더, 화면 읽기 안내, 지목·밤 대상 조작을 확인한다. */
  async function emceeBandFlow(ctx) {
    const id = "emcee-band";
    const rec = recorder(ctx);
    const host = await lobbyWith(ctx, id, { bots: 6, guests: 1, role: "police", vote: { exec: "yes", pick: "other" } });
    const { page: hp, tracker: ht } = host;
    const guest = host.guestPages[0];
    const announcements = new Map();
    const presentationOrders = new Set();
    let nominated = false;
    let nightSelected = false;
    let yesCast = false;

    const measure = async (view) => {
      const phase = view.phase;
      const sc = `${id}/${phase}`;
      if (!(await settleBand(hp, ht, phase))) return;
      await waitForPhaseStart(hp, view);
      if (ht.last()?.phase !== phase) return;
      const header = await readCommonHeader(hp);
      const expectHeader = !TIMELESS_PHASES.includes(phase);
      const presenting = view.day?.keyword?.presentation !== undefined;
      const expectTimers = phase === "nomination"
        ? view.day?.turn?.endsAt ? [1] : [0, 1]
        : [presenting || (phase !== "dayAnnounce" && timedOf(view)) ? 1 : 0];
      const correctTimer = expectTimers.includes(header.timers.length) &&
        header.timers.every((gauge) => gauge.role === "timer" && gauge.inHeader && gauge.visual && /^남은 시간 \d+초$/.test(gauge.label));
      const correctAnnouncement = header.announcementCount === 1 && header.announcementReady &&
        (phase === "lobby" ? header.announcement === "" : header.announcement !== "") &&
        (phase !== "dayAnnounce" || !presenting || header.announcement === "답안 공개") &&
        (phase !== "answerReveal" || header.announcement === "제시어 공개");
      const correctGuide = header.guideCount === 1 && header.guideReady && (!GUIDED_PHASES.includes(phase) || header.guideAccessible);
      rec(sc, "HB", `헤더와 화면 읽기 안내가 현재 단계에 맞는다 (${phase})`,
        header.headers === Number(expectHeader) && (!expectHeader || header.title !== "") &&
        correctTimer && correctAnnouncement && correctGuide && header.obsolete === 0,
        `헤더 ${header.headers} · 게이지 ${header.timers.length}/${expectTimers.join(" 또는 ")} · 타이머 ${correctTimer} · 단계 안내 ${correctAnnouncement} · 사회자 줄 ${correctGuide} · 구형 요소 ${header.obsolete}`);
      announcements.set(phase, header.announcement);
      // 답안 발표 머리는 토론처럼 낮 낱말을 반복하지 않는다.
      await recordTod(hp, rec, sc, presenting ? "discussion" : phase);
      if (GH_PHASES.includes(phase)) await gameGH(ctx, id, phase, host);
    };

    try {
      await ht.waitFor((v) => v.players.length === 8, 8000, "방장 포함 8인");
      await measure(ht.last());
      await startGame(hp, ht);
      for (let steps = 0; ht.last().phase !== "ended" && steps < MAX_STEPS; steps++) {
        const view = ht.last();
        const phase = view.phase;
        const order = view.day?.keyword?.presentation?.order;
        if (phase === "dayAnnounce" && order === undefined) {
          await ht.waitFor((v) => v.phase !== "dayAnnounce", 8000, "시간대 전환");
          continue;
        }
        if (!announcements.has(phase)) await measure(view);
        if (ht.last().phase !== phase) continue;
        if (phase === "dayAnnounce") {
          const current = ht.last().day?.keyword?.presentation?.order;
          const answer = hp.locator(`[data-answer-presentation][data-answer-order="${current}"]`);
          await answer.waitFor({ state: "visible", timeout: 3500 });
          presentationOrders.add(current);
        }

        if (phase === "verdict" && !yesCast) {
          await chooseVerdict(hp, true);
          await chooseVerdict(guest.page, true);
          yesCast = true;
          rec(`${id}/verdict`, "EB1", "방장과 손님이 찬성 투표를 누른다", true);
        }
        if (phase === "nomination" && !nominated) {
          // 테스트 건너뛰기는 지목을 끝까지 집계한다. 실제 사람의 차례가 올 때까지 기다린다.
          await ht.waitFor((v) => {
            const turn = v.day?.turn;
            return v.phase === "nomination" && turn?.order[turn.i] === v.me.seat && turn.doneAt === undefined;
          }, 35_000, "방장 지목 차례");
          await hp.locator('[data-phase-header] [data-phase-gauge][role="timer"]').waitFor({ timeout: 3000 });
          await tapTurnPick(hp, guest.seat);
          await ht.waitFor((v) => v.day?.points?.some((point) => point.seat === view.me.seat && point.target === guest.seat),
            4000, "방장 지목 서버 반영");
          nominated = true;
          rec(`${id}/nomination`, "EB2", "방장이 지목 차례에서 참가자 카드를 누른다", true);
        }
        if (phase === "night" && !nightSelected) {
          const target = ht.last().players.find((p) => p.alive !== false && p.seat !== view.me.seat)?.seat;
          if (target === undefined) throw new SetupError("밤의 조사 대상을 찾지 못함");
          await openTableDockPane(hp, "people");
          const face = await showPeopleTarget(hp, `[data-face="${target}"]`);
          await face.click({ timeout: 4000 });
          await ht.waitFor((v) => v.me.pick === target, 4000, "밤 조사 대상 서버 반영");
          nightSelected = true;
          rec(`${id}/night`, "EB3", "경찰이 참가자 카드에서 대상을 고르면 서버에 반영된다", true);
        }
        if (phase === "morning") break;
        if (ht.last().phase === phase) await skipOnce(hp, ht);
      }
      await driveToEnd(hp, ht);
      await measure(ht.last());
      const missing = BAND_REQUIRED.filter((phase) => !announcements.has(phase));
      const announced = BAND_REQUIRED.filter((phase) => phase !== "lobby").map((phase) => announcements.get(phase)).filter(Boolean);
      rec(`${id}/coverage`, "EB0", "로비부터 결과까지 첫날 단계 모두에서 서로 다른 화면 읽기 안내를 확인한다",
        missing.length === 0 && announced.length === BAND_REQUIRED.length - 1 && new Set(announced).size === announced.length,
        `미확인 단계 ${missing.join(", ") || "없음"} · 고유 안내 ${new Set(announced).size}/${BAND_REQUIRED.length - 1}`);
      rec(`${id}/coverage`, "EB0b", "답안 발표 카드가 8인 차례를 모두 표시한다", presentationOrders.size === 8, `발표 차례 ${presentationOrders.size}/8`);
      rec(`${id}/coverage`, "EB0c", "찬반·지목·밤 조사 조작을 모두 확인했다", yesCast && nominated && nightSelected,
        `찬반 ${yesCast} · 지목 ${nominated} · 밤 조사 ${nightSelected}`);
    } finally {
      await closeGame(asGame(host));
    }
  }

  // ---- emcee-tools ----

  /** 지금 보이는 button·[role=tab] 을 읽어 toolLabelChecks 한 줄로 쌓는다 */
  async function readTools(page, rec, sc, state) {
    const list = await readToolButtons(page);
    const lines = toolLabelChecks(list, await readToolLabelCounts(page));
    const f = fold(lines);
    rec(sc, "TL", `보이는 단추 ${list.length}개에 접근성 이름 없는 것 0건·이름표 속성·라벨 요소 0건 (${state})`, f.ok, f.detail);
    return list;
  }

  /**
   * emcee-tools (TOOL-04): 대기실(방장)·역할 확인·낮·투표·밤·아침·결과(넘기기 보이는 시점·탭 있는 패널)와 열린 시트(옷장·내 역할·유언)에서
   * 보이는 button·[role=tab] 중 접근성 이름이 빈 것 0건, 이름표 속성·아이콘 아래 라벨 요소 0건이다(toolLabelChecks).
   */
  async function emceeToolsFlow(ctx) {
    const id = "emcee-tools";
    const rec = recorder(ctx);
    const host = await lobbyWith(ctx, id, { bots: 5, role: "police", vote: { exec: "yes", pick: "other" } });
    try {
      const { page: hp, tracker: ht } = host;
      await settle(hp);
      await readTools(hp, rec, `${id}/lobby`, "대기실");
      // 옷장 시트(대기실 떠 있는 단추 '옷장')
      const dress = await attempt(async () => {
        await hp.locator('[data-float="dress"]').first().click({ timeout: 4000 });
        await hp.waitForSelector("[data-dress-sheet]", { timeout: 4000 });
        await sleep(400);
      });
      rec(`${id}/lobby-sheet`, "TL0", "대기실에서 [옷장] 을 눌러 시트가 열린다", dress.ok, dress.detail);
      if (dress.ok) {
        await readTools(hp, rec, `${id}/lobby-sheet`, "옷장 시트");
        await closeTopSheet(hp);
      }
      await startGame(hp, ht);
      await settle(hp);
      await readTools(hp, rec, `${id}/roleReveal`, "역할 확인");
      await skipTo(hp, ht, "discussion");
      await settleBand(hp, ht, "discussion").catch(() => {});
      await readTools(hp, rec, `${id}/discussion`, "토론");
      // 내 역할 시트
      const roleSheet = await attempt(async () => {
        await openRoleCard(hp);
      });
      rec(`${id}/discussion-sheet`, "TL0", "토론에서 [내 역할] 을 눌러 시트가 열린다", roleSheet.ok, roleSheet.detail);
      if (roleSheet.ok) {
        await readTools(hp, rec, `${id}/discussion-sheet`, "내 역할 시트");
        await closeRoleCard(hp).catch(async () => closeTopSheet(hp));
      }
      // 유언 시트
      const will = await attempt(async () => {
        await openTableDockPane(hp, "tools");
        await hp.locator("[data-will-button]").click({ timeout: 4000 });
        await hp.waitForSelector("[data-will-sheet]", { timeout: 4000 });
        await sleep(400);
      });
      rec(`${id}/discussion-will`, "TL0", "토론에서 [유언] 을 눌러 시트가 열린다", will.ok, will.detail);
      if (will.ok) {
        await readTools(hp, rec, `${id}/discussion-will`, "유언 시트");
        await closeTopSheet(hp);
      }
      for (const phase of ["nomination", "night", "morning"]) {
        await skipTo(hp, ht, phase);
        await settleBand(hp, ht, phase).catch(() => {});
        await readTools(hp, rec, `${id}/${phase}`, phase === "nomination" ? "지목" : phase === "night" ? "밤" : "아침");
      }
      // 결과: 연출이 끝난 패널(18.1: 탭 없이 전체 대화 하나, 18.1-16: 시상식 없음)
      await driveToEnd(hp, ht);
      const panel = await attempt(async () => {
        await settledResult(hp);
        await hp.waitForSelector("[data-result-panel]", { timeout: 5000 });
      });
      rec(`${id}/ended-panel`, "TL0", "결과 연출이 끝나 결과 패널이 보인다", panel.ok, panel.detail);
      if (panel.ok) {
        const list = await readTools(hp, rec, `${id}/ended-panel`, "결과 패널");
        // 18.1(결정 0082): 결과 패널은 탭 없이 전체 대화 하나라 탭 글 판정은 없다. 이름표 속성은 TL 이 0건으로 판정한다.
        const tabs = list.filter((b) => b.cls.includes("tab") && b.text !== "");
        rec(`${id}/ended-panel`, "TL3", "결과 패널에 탭이 없다(18.1, 전체 대화 하나)", tabs.length === 0, `탭 ${tabs.length}개(${tabs.map((b) => b.text).join("·")})`);
      }
    } finally {
      await closeGame(asGame(host));
    }
  }

  // ---- emcee-leak ----

  /** 닉네임(내 화면의 players)을 {이름} 으로 바꿔 한 판 사이 문장 비교가 이름 때문에 갈라지지 않게 한다 */
  const maskNames = (line, view) => {
    let out = line;
    for (const n of view.players.map((p) => p.nickname).sort((a, b) => b.length - a.length)) if (n) out = out.split(n).join("{이름}");
    return out;
  };

  /** 할 일이 없는 시점으로 보는 단계(모든 산 역할이 같은 문장): 낮 시작·역할 확인(카드를 본 뒤)·결과 */
  const IDLE_PHASES = ["dayAnnounce", "roleReveal-seen", "ended"];

  /**
   * 한 판을 한 시점(role = 방장 직업)으로 걸으며 단계마다 띠·목표·빛남 DOM 을 읽어 items 에 쌓는다.
   * ghost 판이면 방장이 투표로 처형되어 탈락한 뒤부터 시점이 ghost 가 된다(ownRole 은 살았을 때 직업).
   * played 에는 걸은 판의 직업과 결과에 닿았는지를 남긴다(LKm 의 근거).
   */
  async function walkLeak(ctx, flowId, role, ghostGame, items, viewKeys, { played = [], willReads = [] } = {}) {
    const rec = recorder(ctx);
    const host = await lobbyWith(ctx, flowId, { bots: 5, role, vote: ghostGame ? { exec: "yes", pick: "host" } : { exec: "yes", pick: "other" } });
    try {
      const { page: hp, tracker: ht } = host;
      const seen = new Set();
      const capture = async (phase, tag = phase, idle = false) => {
        const ok = await settleBand(hp, ht, phase).catch(() => false);
        const view = ht.last();
        if (!ok || view.phase !== phase) return false;
        const ghost = isGhostView(view);
        const stateKey = `${ghost ? "ghost" : role}/${tag}`;
        if (seen.has(stateKey)) return true;
        seen.add(stateKey);
        const band = await readHostBand(hp);
        items.push({
          role: ghost ? "ghost" : role,
          ownRole: role,
          phase: tag,
          domText: await readRoomText(hp),
          callCount: await readCallCount(hp),
          line: maskNames(band.text, view),
          idle: idle && !ghost,
        });
        return true;
      };
      // 역할 확인: 카드를 보기 전(할 일 있음) → 카드를 연 뒤(할 일 없음, 앞면의 목표 문장)
      await startGame(hp, ht);
      await capture("roleReveal");
      await hp.locator(".mf-card").first().click({ timeout: 4000 });
      await hp.waitForSelector(".mf-card--front", { timeout: 4000 }).catch(() => {});
      await settle(hp);
      await capture("roleReveal", "roleReveal-seen", true);
      const nightRoleIdle = role === "citizen";
      for (let steps = 0; ht.last().phase !== "ended" && steps < MAX_STEPS; steps++) {
        const phase = await skipOnce(hp, ht).catch((e) => {
          if (ht.last().phase === "ended") return "ended";
          throw e;
        });
        await capture(phase, phase, IDLE_PHASES.includes(phase) || (phase === "night" && nightRoleIdle));
        if (phase === "defense" || phase === "execution") {
          // 22페이즈 P22-11: 유언·처형 단계 view 의 day 키 이름과 유언 시트 DOM 수(처형자에게만 있어야 한다)
          const v = ht.last();
          await waitForPhaseStart(hp, v);
          const sheets = await hp.locator("[data-will-sheet]").count().catch(() => -1);
          willReads.push({ role: ghostGame ? "ghost" : role, phase, keys: Object.keys(v.day ?? {}).sort(), sheets, condemned: v.day?.candidate !== undefined && v.day.candidate === v.me.seat });
        }
        if (phase === "discussion" && !isGhostView(ht.last())) {
          // 내 역할 시트(목표 칩이 시트 안에도 있다) — 자기 역할의 목표만 있어야 한다
          const sheet = await attempt(async () => {
            await openRoleCard(hp);
            const view = ht.last();
            const band = await readHostBand(hp);
            items.push({ role, ownRole: role, phase: "discussion-sheet", domText: await readRoomText(hp), callCount: await readCallCount(hp), line: maskNames(band.text, view), idle: false });
            await closeRoleCard(hp);
          });
          rec(`${flowId}/${role}`, "LK0", `${role}: 토론에서 [내 역할] 시트를 읽는다`, sheet.ok, sheet.detail);
        }
        if (phase === "morning") break;
      }
      await driveToEnd(hp, ht);
      await capture("ended", "ended", true);
      for (const k of ht.viewKeys.top) viewKeys.top.add(k);
      for (const k of ht.viewKeys.me) viewKeys.me.add(k);
      for (const k of ht.viewKeys.day) viewKeys.day.add(k);
      played.push({ role: ghostGame ? "ghost" : role, ended: ht.last()?.phase === "ended" });
      return ghostGame ? seen.has(`ghost/night`) : true;
    } finally {
      await closeGame(asGame(host));
    }
  }

  /**
   * 역할 다섯 시점(마피아·경찰·의사·시민 + 처형되어 탈락한 유령)으로 판을 걸으며 ① 띠·목표·빛남 DOM 에 다른 역할 전용 줄·목표가 없다 ②
   * 받은 state 프레임의 view 키(최상위·me·day)가 13페이즈 허용 목록 안이다 ③ 같은 단계 할 일 없는 시점끼리 띠 문장이 같다 ④ 산 마피아 밤 data-call 0개·유령 띠에 역할 이름 없음.
   * 다섯 판 모두 결과까지 갔는지(LKm)도 한 줄 남긴다 — 판이 끝나지 않은 채 통과하는 것을 막는다(T-19-22).
   */
  async function leakFlow(ctx, id) {
    const rec = recorder(ctx);
    const items = [];
    const viewKeys = { top: new Set(), me: new Set(), day: new Set() };
    const played = [];
    const willReads = [];
    for (const role of ["mafia", "police", "doctor", "citizen"]) {
      await walkLeak(ctx, id, role, false, items, viewKeys, { played, willReads });
    }
    const reachedGhost = await walkLeak(ctx, id, "police", true, items, viewKeys, { played, willReads });
    const seats = new Set(items.map((i) => (i.role === "ghost" ? "ghost" : i.role)));
    const missingRoles = ["mafia", "police", "doctor", "citizen", "ghost"].filter((r) => !seats.has(r));
    rec(`${id}/coverage`, "LK1", "역할 다섯 시점(마피아·경찰·의사·시민·유령)을 모두 읽었다", missingRoles.length === 0 && reachedGhost, `못 읽은 시점: ${missingRoles.join(", ")}${reachedGhost ? "" : " (유령 판에서 탈락 뒤 밤에 닿지 못함)"}`);
    const nights = items.filter((i) => i.phase === "night").length;
    rec(`${id}/coverage`, "LK2", "밤 화면을 시점마다 읽었다(마피아·경찰·의사·시민·유령 5곳)", nights >= 5, `밤 읽기 ${nights}곳`);
    const off = played.filter((p) => !p.ended);
    rec(
      `${id}/coverage`,
      "LKm",
      "다섯 판 모두 결과까지 갔다",
      played.length === 5 && off.length === 0,
      played.length !== 5 ? `걸은 판 ${played.length}개` : off.length > 0 ? off.map((p) => `${p.role} 판: 끝나지 않음`).join(" / ") : `판 ${played.length}개`,
    );
    for (const l of hostLeakChecks(items)) rec(`${id}/leak`, l.id, `${l.label} (읽기 ${items.length}곳)`, l.ok, l.detail);
    for (const l of willLeakChecks(willReads)) rec(`${id}/leak`, l.id, `${l.label} (읽기 ${willReads.length}곳)`, l.ok, l.detail);
    const k = viewKeyChecks(viewKeys);
    rec(`${id}/frames`, k.id, `${k.label} (최상위 ${viewKeys.top.size}·me ${viewKeys.me.size}·day ${viewKeys.day.size}개)`, k.ok, k.detail);
    // 참고(판정 아님): 받은 me·day 키 이름 — 키 이름뿐, 값 없음
    rec(`${id}/frames`, "VK1i", "받은 me·day 키 이름(참고)", true, `me [${[...viewKeys.me].sort().join(",")}] · day [${[...viewKeys.day].sort().join(",")}]`, true);
  }

  /** emcee-leak (HOST-05, T-14-19·20): 판의 역할 다섯 시점 누설 — 본문은 leakFlow */
  const emceeLeakFlow = (ctx) => leakFlow(ctx, "emcee-leak");

  // ---- emcee-sound ----

  const hostLog = (page) =>
    page.evaluate(() => (window.__mfSound ? window.__mfSound.log.filter((e) => e.id === "ui.host").map((e) => ({ played: e.played === true })) : null));
  const clearLog = (page) => page.evaluate(() => window.__mfSound?.clear());

  /**
   * emcee-sound (HOST-02): 처음 입장 0번, 단계 전환마다 ui.host 한 번, 발표자 변경과 둘째 날 낮 시작 → 토론은 0번.
   * 새로고침 첫 프레임과 소리를 끈 뒤 재생도 0번인지 확인한다.
   * 소리 출력은 보지 않는다 — 훅 요청 로그만 읽는다. 구간은 로그 비우기로 나눈다.
   */
  async function emceeSoundFlow(ctx) {
    const id = "emcee-sound";
    const rec = recorder(ctx);
    const host = await startHost(ctx, id, { nickname: BAND_NICK });
    try {
      const { page: hp, tracker: ht } = host;
      const hooked = await attempt(async () => {
        await hp.waitForFunction(() => !!window.__mfSound && window.__mfSound.log.length > 0, null, { timeout: 6000 });
        await sleep(CHIME_SETTLE_MS);
      });
      rec(`${id}/setup`, "ES0", "방 화면이 열리면 소리 훅이 있고 로그가 찬다", hooked.ok, hooked.detail);
      if (!hooked.ok) return;
      const segs = [];
      const first = await hostLog(hp);
      segs.push({ kind: "first", name: "처음 입장(대기실 첫 프레임)", count: first?.length ?? -1, played: first?.filter((e) => e.played).length ?? -1 });

      await openTestSheet(hp);
      await setBots(hp, ht, 4);
      await setBotVote(hp, ht, { exec: "no", pick: "other" });
      await chooseRole(hp, ht, "citizen");
      await startGame(hp, ht);
      await settleBand(hp, ht, "roleReveal").catch(() => {});

      /** 단계를 한 칸 넘기고 그 구간의 ui.host 를 센다. 같은 발표 단계의 차례 전환도 읽는다. */
      const stepSeg = async (kind) => {
        const before = ht.last().phase;
        await clearLog(hp);
        const phase = await skipOnce(hp, ht);
        if (kind === "muted" || phase === before) await sleep(CHIME_SETTLE_MS);
        else {
          await attempt(() => hp.waitForFunction(() => window.__mfSound?.log.some((e) => e.id === "ui.host"), null, { timeout: 3800 }));
        }
        const log = await hostLog(hp);
        segs.push({
          kind: phase === before && before === "dayAnnounce" ? "presentationTurn" : kind,
          name: `${before} → ${phase}`,
          count: log?.length ?? -1,
          played: log?.filter((e) => e.played).length ?? -1,
        });
        return phase;
      };
      for (let i = 0; i < 24 && !["morning", "ended"].includes(ht.last().phase); i++) {
        await stepSeg("transition");
      }
      const firstDay = segs.filter((s) => s.kind === "transition").map((s) => s.name);
      const expected = ["roleReveal → keyword", "keyword → dayAnnounce", "dayAnnounce → answerReveal", "answerReveal → discussion", "night → morning"];
      rec(`${id}/coverage`, "ES2", "첫날 단서·답안·제시어 공개와 밤·아침 전환을 확인했다",
        expected.every((name) => firstDay.includes(name)));
      const turns = segs.filter((s) => s.kind === "presentationTurn");
      rec(`${id}/chime`, "ES3", "발표자만 바뀔 때 사회자 알림음은 울리지 않는다",
        turns.length > 0 && turns.every((s) => s.count === 0), `발표 차례 전환 ${turns.length}회 · 알림음 ${turns.map((s) => s.count).join(",")}`);

      const toDay = await stepSeg("transition");
      if (toDay !== "dayAnnounce" || ht.last().day?.keyword?.presentation !== undefined) throw new SetupError("둘째 날 낮 시작 미도달");
      const dayStart = segs.at(-1);
      await ht.waitFor((v) => v.phase === "discussion", 8000, "둘째 날 낮 시작 → 토론");
      await sleep(CHIME_SETTLE_MS);
      const dayToDiscussion = await hostLog(hp);
      segs.push({
        kind: "dayToDiscussion",
        name: "둘째 날 낮 시작 → 토론",
        count: dayToDiscussion === null ? -1 : dayToDiscussion.length - dayStart.count,
        played: dayToDiscussion === null ? -1 : dayToDiscussion.filter((e) => e.played).length - dayStart.played,
      });

      // 새로고침 첫 프레임(같은 단계에 다시 들어와도 울리지 않는다)
      const reloadSeq = ht.seq;
      await hp.reload({ waitUntil: "domcontentloaded" });
      await ht.waitFor(() => ht.seq > reloadSeq, 15000, "새로고침 뒤 새 상태 연결");
      await hp.waitForFunction(() => !!window.__mfSound, null, { timeout: 8000 }).catch(() => {});
      await settleBand(hp, ht, ht.last().phase).catch(() => {});
      await sleep(CHIME_SETTLE_MS);
      const afterReload = await hostLog(hp);
      segs.push({ kind: "reload", name: "새로고침 첫 프레임", count: afterReload?.length ?? -1, played: afterReload?.filter((e) => e.played).length ?? -1 });

      // 소리 끄기: 소리 단추를 눌러 끈 뒤 단계 하나를 넘긴다 — 재생된 ui.host 가 0 이어야 한다
      if (ht.last().phase !== "ended") {
        // 새로고침 뒤에는 잠김(locked) → 한 번 누르면 켬(on) → 한 번 더 누르면 끔(off). 끔이 될 때까지 최대 3번 누른다
        const off = await attempt(async () => {
          const btn = hp.locator("[data-sound-button]").first();
          const openMenu = (await btn.count()) === 0 && (await hp.locator("[data-game-menu]").count()) > 0;
          if (openMenu) await hp.locator("[data-game-menu]").click({ timeout: 4000 });
          try {
            for (let i = 0; i < 3; i++) {
              if ((await btn.getAttribute("data-sound-state")) === "off") return;
              await btn.click({ timeout: 4000 });
              await sleep(500);
            }
            if ((await btn.getAttribute("data-sound-state")) !== "off") return { ok: false, detail: `소리 단추 상태 ${await btn.getAttribute("data-sound-state")}` };
          } finally {
            if (openMenu) await closeSheet(hp, "게임 메뉴");
          }
        });
        rec(`${id}/muted`, "ES1", "소리 단추로 소리를 끈다", off.ok, off.detail);
        if (off.ok) await stepSeg("muted");
      }
      for (const l of hostChimeChecks(segs)) rec(`${id}/chime`, l.id, `${l.label} (구간 ${segs.length}개)`, l.ok, l.detail);
    } finally {
      await closeGame(asGame(host));
    }
  }

  return { emceeBandFlow, emceeToolsFlow, emceeLeakFlow, emceeSoundFlow };
}

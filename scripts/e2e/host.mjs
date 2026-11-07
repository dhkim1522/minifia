// 14페이즈 사회자·이름표 E2E 흐름 (14-08): emcee-band(자막 띠, 폰 6종)·emcee-tools(도구 이름표 전수)·emcee-leak(역할 다섯 시점 누설)·emcee-sound(알림음).
// 이름 앞머리는 emcee — 기존 host-handoff 와 `--only host` 앞부분 일치가 겹치지 않게 한다. 흐름은 화면을 읽기만 하고 판정은 lib.mjs 의 순수 함수(hostBandChecks 등)에 맡긴다:
// 판정 문턱은 여기서 낮추지 않는다(T-14-21). 닉네임·토큰은 결과 줄에 남기지 않는다(T-14-22) — 단계 이름·역할 이름·개수만 쓴다.
// flows.mjs 가 이미 3천 줄이라 흐름 본문은 이 파일에 둔다. flows.mjs 의 도우미는 `makeHostFlows(helpers)` 로 받는다(sound.mjs·politics.mjs 와 같은 모양 — 서로 import 하지 않는다).
// helpers: { recorder, attempt, startHost, openGuest, closeGame, gameGH, settledResult }
import {
  SetupError,
  armBandWatch,
  chooseRole,
  closeRoleCard,
  openRoleCard,
  openTestSheet,
  readBandWatch,
  readCallCount,
  readHostBand,
  readRoomText,
  readTagRects,
  readToolButtons,
  closeSheet,
  setBotVote,
  setBots,
  settle,
  skipOnce,
  skipTo,
  sleep,
  startGame,
  tapPick,
} from "./browser.mjs";
import { TIMELESS_PHASES, hostBandChecks, hostChimeChecks, hostLeakChecks, hostOverlapChecks, toolLabelChecks, viewKeyChecks } from "./lib.mjs";

const BAND_NICK = "띠검사방장";
/** 8명 투표 화면 시험용 손님 일곱(모두 4자 — UI-SPEC "이름표 버튼 8개 … (4자 이름, 폰 6종)", basic-vote 와 같은 이름). 봇 이름은 첫 봇이 8자 고정이라 4자 이름 전제가 맞지 않는다(결정 0052-3 과 같은 이유) */
const BAND_GUESTS = ["가나다라", "마바사아", "자차카타", "파하거너", "더러머버", "서어저처", "커터퍼허"];
/** 한 판을 한 칸씩 넘기는 최대 칸 수(부하로 날이 길어져도 ended 에 닿도록 넉넉히) */
const MAX_STEPS = 90;
/** 시간이 있는 단계의 최소 길이(ms) — src/game/hostLine.ts hostTimeOf 와 같은 값 */
const HOST_TIME_MIN_MS = 3000;
/** 띠 검사가 반드시 지나야 하는 단계(없으면 EB0 실패 — 공허 통과 금지). 배정은 3초 창이라 잡히면 더하고 못 잡아도 실패가 아니다 */
const BAND_REQUIRED = ["lobby", "roleReveal", "dayAnnounce", "discussion", "nomination", "defense", "verdict", "execution", "night", "morning", "ended"];
/** 이 높이(px) 미만의 폰은 방 틀 높이 575 미만의 짧은 폰이다(DEFAULT_SIZES 의 360x560 probe) — UI#14 알려진 한계 적용 대상 */
const SHORT_PHONE_H = 575;
/** 이름표·얼굴 칸이 눌려야 하는 단계(띠·이름표 겹침 검사) */
const TAG_PHASES = ["nomination", "night"];
/** G·H(묶음) 검사를 하는 맵 단계 — 헤더가 있는 화면 */
const GH_PHASES = ["discussion", "nomination", "night", "morning"];
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

/** 이름표·얼굴 칸 사각형이 두 번 연속 같아질 때까지(최대 maxMs) 0.4초 간격으로 읽는다 — 투표 때 이름표가 걸어 모이는 동안은 재지 않는다 */
async function readTagsStable(page, maxMs = 11000) {
  const key = (rs) => JSON.stringify(rs.map((r) => [Math.round(r.left), Math.round(r.top)]));
  let prev = null;
  let rects = await readTagRects(page);
  for (const t0 = performance.now(); performance.now() - t0 < maxMs; ) {
    const k = key(rects);
    if (rects.length > 0 && k === prev) return rects;
    prev = k;
    await sleep(400);
    rects = await readTagRects(page);
  }
  return rects;
}

/** ended 까지 넘긴다. 처형이 없는 날이 이어지면 한 번의 skipTo(24칸)로 모자랄 수 있어 몇 번 더 시도한다(마감이 먼저 지나 이미 ended 면 그대로 둔다) */
async function driveToEnd(hp, ht, tries = 5) {
  for (let i = 0; i < tries && ht.last().phase !== "ended"; i++) {
    try {
      await skipTo(hp, ht, "ended");
    } catch (e) {
      if (ht.last().phase === "ended") break;
      if (i === tries - 1) throw e;
    }
  }
}

/** 열린 시트를 [닫기] 이름표 단추로 닫는다 */
async function closeTopSheet(page) {
  await page.locator('[data-tool-label="닫기"]').first().click({ timeout: 4000 });
  await sleep(350);
}

export function makeHostFlows({ recorder, attempt, startHost, openGuest, closeGame, gameGH, settledResult }) {
  const asGame = (host) => ({ host, guests: host.guestPages ?? [] });

  /** 방장 한 명 + 봇 n 으로 시작 직전(로비)까지 만든다. 시트는 닫아 둔다 */
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

  /**
   * emcee-band (HOST-01, TOOL-02, UI#13): 방장(경찰) + 4자 이름 사람 손님 7 = 8명판을 로비부터 결과까지 한 칸씩 넘기며 단계마다 띠를 읽는다 — 띠 하나·문장 하나·data-guide 가 띠 안·3줄 미만·
   * 시간 단계의 막대 + 'n초'·옛 안내줄/링/타이머 0건(hostBandChecks). 투표·밤에서 이름표 단추끼리·띠와 겹침 0(hostOverlapChecks).
   * 맵 단계(토론·투표·밤·아침)는 묶음 G(14px·가로 넘침·콘솔 오류)와 H(제목·띠 문장·띠 시간 글자 대비)를 받는다. 폰 6종(extraSizes)이라 360x560 의 가장자리 잘림은 알려진 한계로 기록만 한다(판정은 그대로).
   */
  async function emceeBandFlow(ctx) {
    const id = "emcee-band";
    const rec = recorder(ctx);
    const host = await lobbyWith(ctx, id, { bots: 0, guests: 7, role: "police", vote: { exec: "yes", pick: "other" } });
    try {
      const { page: hp, tracker: ht } = host;
      const done = new Set();
      /** 지금 단계의 띠·(투표·밤이면) 이름표 겹침·(맵 단계면) G·H 를 한 번 읽는다 */
      const measure = async (phase) => {
        if (done.has(phase)) return;
        const sc = `${id}/${phase}`;
        const ok = await attempt(async () => {
          if (!(await settleBand(hp, ht, phase))) throw new SetupError(`${phase} 를 읽기 전에 단계가 바뀜`);
        });
        if (!ok.ok) {
          // 읽기 전에 단계가 지나간 것(2초짜리 낮 시작 등)은 실패 줄이 아니다 — 띠 감시 또는 EB0(덮음)이 판정한다. 그 밖의 실패(막이 안 걷힘 등)는 줄로 남긴다
          if (!/단계가 바뀜/.test(ok.detail)) rec(sc, "EB1", `띠를 읽는다(${phase})`, false, ok.detail);
          return false;
        }
        done.add(phase);
        const view = ht.last();
        const band = await readHostBand(hp);
        const f = fold(hostBandChecks(band, { phase, timed: timedOf(view) }));
        rec(sc, "HB", `띠 한 문장·3줄 미만·시간 막대+초·옛 안내/링 없음(${phase}, ${band.text.length}자 문장)`, f.ok, f.detail);
        // 묶음 G·H 를 이름표 모이기 기다림보다 먼저 한다 — 투표 15초 중 기다리는 동안 시간 숫자가 마지막 5초 색(진홍)으로 바뀌어 대비 측정이 흔들리지 않게
        if (GH_PHASES.includes(phase)) await gameGH(ctx, id, phase, host);
        if (TAG_PHASES.includes(phase)) {
          const rects = await readTagsStable(hp);
          const short = ctx.size.h < SHORT_PHONE_H;
          const o = hostOverlapChecks({ band: band.bandRect, tags: rects }, { knownBandLimit: short });
          rec(sc, o.id, `${o.label} (${phase}, 이름표 ${rects.length}개)`, o.ok, o.detail);
          // UI#14 알려진 한계: 가장 낮은 폰(방 높이 575 미만)의 띠·이름표 겹침은 판정에서 빼고 잰 값 그대로 남긴다(고치지 않는다 — 띠는 눌림을 받지 않아 이름표는 계속 눌린다)
          if (o.known !== "") rec(`${id}/${phase}`, "HO1k", `알려진 한계(UI#14): 낮은 폰(${ctx.size.label})의 이름표가 띠 아랫변과 겹침(판정 아님)`, true, o.known, true);
        }
      };

      await measure("lobby");
      await armBandWatch(hp);
      // 배정(3초 창)은 잡히면 읽는다 — 못 잡아도 실패가 아니다(필수 단계에 넣지 않았다)
      let assigningBand = null;
      await startGame(hp, ht, {
        onAssigning: async () => {
          assigningBand = await readHostBand(hp);
        },
      });
      if (assigningBand !== null) {
        const f = fold(hostBandChecks(assigningBand, { phase: "assigning", timed: false }));
        rec(`${id}/assigning`, "HB", "띠 한 문장·3줄 미만·시간 없음(assigning)", f.ok, f.detail);
        done.add("assigning");
      }
      let voted = false;
      for (let steps = 0; ht.last().phase !== "ended" && steps < MAX_STEPS; steps++) {
        // 지금 단계를 먼저 읽고(낮 시작은 2초라 띠 감시가 맡는다) 한 칸 넘긴다 — 읽기가 길어져 단계가 지나가도 그 지금 단계를 건너뛰지 않는다
        const cur = ht.last().phase;
        if (cur === "dayAnnounce") {
          // 낮 시작(2초)은 넘기지 않고 저절로 토론이 되기를 기다린다 — 넘기기를 누르면 토론까지 건너뛴다. 띠는 띠 감시가 잡는다
          await ht.waitFor((v) => v.phase !== "dayAnnounce", 8000, "낮 시작 → 토론");
          continue;
        }
        if (!done.has(cur)) await measure(cur);
        if (done.has("morning")) break;
        if (ht.last().phase !== cur) continue;
        if (cur === "nomination" && !voted) {
          // 사람 손님은 스스로 표를 던지지 않는다 — 첫째 손님 이외의 일곱이 첫째 손님을 눌러 변론·찬반·처형 단계가 열리게 한다(방장은 누르지 않아 빛남이 남는다)
          const target = host.guestPages[0].seat;
          const r = await attempt(async () => {
            for (const g of host.guestPages.slice(1)) await tapPick(g.page, target);
          });
          voted = true;
          rec(`${id}/nomination`, "EB2", "손님이 첫째 손님을 지목해 변론 단계가 열린다", r.ok, r.detail);
        }
        await skipOnce(hp, ht).catch((e) => {
          if (ht.last().phase === "ended") return;
          throw e;
        });
      }
      // 한 칸 넘기고 읽기에는 짧은 단계(낮 시작 2초 등)는 띠 감시가 잡은 값으로 판정한다 — 같은 hostBandChecks, 시간 단계 여부는 서버 길이표(낮 시작 2초 < 3초)
      const watched = (await readBandWatch(hp)) ?? [];
      const timedMs = { dayAnnounce: 2000, defense: 20000, verdict: 10000, execution: 5600 };
      for (const phase of Object.keys(timedMs)) {
        if (done.has(phase)) continue;
        const hit = watched.find((s) => s.phase === phase);
        if (!hit) continue;
        done.add(phase);
        const f = fold(hostBandChecks(hit, { phase, timed: timedMs[phase] >= HOST_TIME_MIN_MS }));
        rec(`${id}/${phase}`, "HB", `띠 한 문장·3줄 미만·시간 막대+초·옛 안내/링 없음(${phase}, 띠 감시, ${hit.text.length}자 문장)`, f.ok, f.detail);
      }
      const missingMap = BAND_REQUIRED.filter((p) => p !== "ended" && !done.has(p));
      rec(`${id}/coverage`, "EB0", "띠를 읽은 단계가 대기실·역할 확인·낮 시작·토론·투표·변론·찬반·처형·밤·아침을 모두 덮는다", missingMap.length === 0, `못 읽은 단계: ${missingMap.join(", ")}`);
    } finally {
      await closeGame(asGame(host));
    }
    // 결과(ended)는 사람 손님 판에서 닿기 어렵다(사람이 투표하지 않으면 처형이 없어 여러 날이 걸린다) — 봇 판(방장 + 봇 5, 같은 폰 크기)으로 따로 닿아 같은 띠 판정을 한다
    const endHost = await lobbyWith(ctx, id, { bots: 5, role: "police", vote: { exec: "yes", pick: "other" } });
    try {
      const { page: hp, tracker: ht } = endHost;
      await startGame(hp, ht);
      await driveToEnd(hp, ht);
      const sc = `${id}/ended`;
      const ok = await attempt(async () => {
        if (!(await settleBand(hp, ht, "ended"))) throw new SetupError("ended 를 읽기 전에 단계가 바뀜");
      });
      rec(sc, "EB1", "띠를 읽는다(ended)", ok.ok, ok.detail);
      if (ok.ok) {
        const band = await readHostBand(hp);
        const f = fold(hostBandChecks(band, { phase: "ended", timed: timedOf(ht.last()) }));
        rec(sc, "HB", `띠 한 문장·3줄 미만·시간 막대+초·옛 안내/링 없음(ended, ${band.text.length}자 문장)`, f.ok, f.detail);
      }
      rec(`${id}/coverage`, "EB0b", "결과(ended) 단계의 띠를 읽었다", ok.ok, ok.detail);
    } finally {
      await closeGame(asGame(endHost));
    }
  }

  // ---- emcee-tools ----

  /** 지금 보이는 button·[role=tab] 을 읽어 toolLabelChecks 한 줄로 쌓는다 */
  async function readTools(page, rec, sc, state) {
    const list = await readToolButtons(page);
    const lines = toolLabelChecks(list);
    const f = fold(lines);
    rec(sc, "TL", `보이는 단추 ${list.length}개에 글자 없는 것 0건(면제 E-1·E-2 밖)·data-tool-label 일치 (${state})`, f.ok, f.detail);
    return list;
  }

  /**
   * emcee-tools (TOOL-01): 대기실(방장)·역할 확인·낮·투표·밤·아침·결과(넘기기 보이는 시점·탭 있는 패널)와 열린 시트(옷장·내 역할·유언)에서
   * 보이는 button·[role=tab] 중 글자(숫자 제외)가 빈 것이 면제 E-1·E-2 밖 0건이다(toolLabelChecks).
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
        await hp.locator('[data-tool-label="옷장"]').first().click({ timeout: 4000 });
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
        await readTools(hp, rec, `${id}/${phase}`, phase === "nomination" ? "투표" : phase === "night" ? "밤" : "아침");
      }
      // 결과: 시상식에서 [넘기기] 가 보이는 시점 → 연출이 끝난 패널(탭)
      await driveToEnd(hp, ht);
      const skipBtn = await attempt(async () => {
        await hp.waitForSelector('[data-tool-label="넘기기"]', { timeout: 15000 });
        await settle(hp);
      });
      rec(`${id}/ended-ceremony`, "TL0", "결과 시상식에서 [넘기기] 가 보인다", skipBtn.ok, skipBtn.detail);
      if (skipBtn.ok) await readTools(hp, rec, `${id}/ended-ceremony`, "결과 시상식");
      const panel = await attempt(async () => {
        await settledResult(hp);
        await hp.waitForSelector('[role="tab"]', { timeout: 5000 });
      });
      rec(`${id}/ended-panel`, "TL0", "결과 연출이 끝나 기록 탭이 보인다", panel.ok, panel.detail);
      if (panel.ok) {
        const list = await readTools(hp, rec, `${id}/ended-panel`, "결과 패널");
        const tabs = list.filter((b) => b.cls.includes("tab") || b.toolLabel !== null).length;
        rec(`${id}/ended-panel`, "TL3", "결과 패널의 data-tool-label 단추가 있다(탭 이름표)", tabs > 0, `이름표 단추 ${tabs}개`);
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
   */
  async function walkLeak(ctx, flowId, role, ghostGame, items, viewKeys) {
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
      return ghostGame ? seen.has(`ghost/night`) : true;
    } finally {
      await closeGame(asGame(host));
    }
  }

  /**
   * emcee-leak (HOST-05, T-14-19·20): 역할 다섯 시점(마피아·경찰·의사·시민 + 처형되어 탈락한 유령)으로 판을 걸으며 ① 띠·목표·빛남 DOM 에 다른 역할 전용 줄·목표가 없다 ②
   * 받은 state 프레임의 view 키(최상위·me·day)가 13페이즈 허용 목록 안이다 ③ 같은 단계 할 일 없는 시점끼리 띠 문장이 같다 ④ 산 마피아 밤 data-call 0개·유령 띠에 역할 이름 없음.
   */
  async function emceeLeakFlow(ctx) {
    const id = "emcee-leak";
    const rec = recorder(ctx);
    const items = [];
    const viewKeys = { top: new Set(), me: new Set(), day: new Set() };
    for (const role of ["mafia", "police", "doctor", "citizen"]) {
      await walkLeak(ctx, id, role, false, items, viewKeys);
    }
    const reachedGhost = await walkLeak(ctx, id, "police", true, items, viewKeys);
    const seats = new Set(items.map((i) => (i.role === "ghost" ? "ghost" : i.role)));
    const missingRoles = ["mafia", "police", "doctor", "citizen", "ghost"].filter((r) => !seats.has(r));
    rec(`${id}/coverage`, "LK1", "역할 다섯 시점(마피아·경찰·의사·시민·유령)을 모두 읽었다", missingRoles.length === 0 && reachedGhost, `못 읽은 시점: ${missingRoles.join(", ")}${reachedGhost ? "" : " (유령 판에서 탈락 뒤 밤에 닿지 못함)"}`);
    const nights = items.filter((i) => i.phase === "night").length;
    rec(`${id}/coverage`, "LK2", "밤 화면을 시점마다 읽었다(마피아·경찰·의사·시민·유령 5곳)", nights >= 5, `밤 읽기 ${nights}곳`);
    for (const l of hostLeakChecks(items)) rec(`${id}/leak`, l.id, `${l.label} (읽기 ${items.length}곳)`, l.ok, l.detail);
    const k = viewKeyChecks(viewKeys);
    rec(`${id}/frames`, k.id, `${k.label} (최상위 ${viewKeys.top.size}·me ${viewKeys.me.size}·day ${viewKeys.day.size}개)`, k.ok, k.detail);
  }

  // ---- emcee-sound ----

  const hostLog = (page) =>
    page.evaluate(() => (window.__mfSound ? window.__mfSound.log.filter((e) => e.id === "ui.host").map((e) => ({ played: e.played === true })) : null));
  const clearLog = (page) => page.evaluate(() => window.__mfSound?.clear());

  /**
   * emcee-sound (HOST-02): 처음 입장 0번 → 단계 전환마다 ui.host 한 번(낮 시작 → 토론은 0번) → 새로고침 첫 프레임 0번 → 소리를 끄면 재생 0번(hostChimeChecks).
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

      /** 단계를 한 칸 넘기고 그 구간의 ui.host 를 센다 */
      const stepSeg = async (kind, name) => {
        await clearLog(hp);
        const phase = await skipOnce(hp, ht);
        await sleep(CHIME_SETTLE_MS);
        const log = await hostLog(hp);
        segs.push({ kind, name, count: log?.length ?? -1, played: log?.filter((e) => e.played).length ?? -1 });
        return phase;
      };
      // roleReveal → dayAnnounce(전환 1), dayAnnounce → discussion(0), discussion → nomination(1), nomination → …
      const toDay = await stepSeg("transition", "역할 확인 → 낮 시작");
      if (toDay === "dayAnnounce") {
        // 낮 시작은 2초 단계라 넘기기를 누르면 토론까지 건너뛰거나(14-09: 배포본은 지연이 커서 이미 토론으로 넘어간 뒤 넘기기가 토론 → 투표를 건드려 1번이 잡혔다)
        // 자동으로 넘어가는 것을 기다려 그 구간의 ui.host 를 센다. 0번이어야 한다는 문턱은 그대로다.
        await clearLog(hp);
        await ht.waitFor((v) => v.phase === "discussion", 8000, "낮 시작 → 토론 자동 전환").catch(() => {});
        await sleep(CHIME_SETTLE_MS);
        const log = await hostLog(hp);
        segs.push({ kind: "dayToDiscussion", name: "낮 시작 → 토론", count: log?.length ?? -1, played: log?.filter((e) => e.played).length ?? -1 });
      }
      for (let i = 0; i < 6 && ht.last().phase !== "ended"; i++) {
        const from = ht.last().phase;
        const to = await stepSeg("transition", `${from} → 다음 단계`);
        if (to === "morning") break;
      }

      // 새로고침 첫 프레임(같은 단계에 다시 들어와도 울리지 않는다)
      const reloadPhase = ht.last().phase;
      await hp.reload({ waitUntil: "domcontentloaded" });
      await ht.waitFor((v) => v.phase === reloadPhase || v.phase !== undefined, 15000, "새로고침 뒤 연결").catch(() => {});
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
          for (let i = 0; i < 3; i++) {
            if ((await btn.getAttribute("data-sound-state")) === "off") return;
            await btn.click({ timeout: 4000 });
            await sleep(500);
          }
          if ((await btn.getAttribute("data-sound-state")) !== "off") return { ok: false, detail: `소리 단추 상태 ${await btn.getAttribute("data-sound-state")}` };
        });
        rec(`${id}/muted`, "ES1", "소리 단추로 소리를 끈다", off.ok, off.detail);
        if (off.ok) await stepSeg("muted", "소리 끔 → 단계 전환");
      }
      for (const l of hostChimeChecks(segs)) rec(`${id}/chime`, l.id, `${l.label} (구간 ${segs.length}개)`, l.ok, l.detail);
    } finally {
      await closeGame(asGame(host));
    }
  }

  return { emceeBandFlow, emceeToolsFlow, emceeLeakFlow, emceeSoundFlow };
}

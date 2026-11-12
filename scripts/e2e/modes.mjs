// 19페이즈 방장 줄·판 종류 E2E 흐름 (19-06, 결정 D-05·D-06·D-07·D-10·D-13·D-14·D-18): mode-rail(방장 줄·참가자 칩·판 종류 시트의 기하와 색, 폰 6종)·mode-pick(판 종류 선택이 방송·새로고침·재접속·다시 하기에 남는가, 390x844).
// 19-07(D-08·D-09·D-11·D-18): mode-basic(기본 마피아 봇 판 완주 — 심부름·기록·흔적 표식 0건, 단계 순서, 띠 금지 문구 0, 390x844). 역할 다섯 시점 누설(mode-leak)의 본문은 host.mjs 에 있다.
// 이름 앞머리 mode — 기존 흐름 이름과 `--only` 부분 일치가 겹치지 않는다(`--only mode` 가 mode-* 만 고른다).
// 흐름은 화면을 읽기만 하고 판정은 lib.mjs 의 순수 함수(hostRailChecks·modeChipChecks·modeSheetChecks·basicModeChecks)에 맡긴다 — 문턱 숫자는 여기에 두지 않는다(T-19-18·T-19-22).
// 결과 줄에는 닉네임·토큰을 남기지 않는다 — 표식 값·판 이름·단계 이름·개수·사각형 수치만 쓴다.
// E2E 방은 모두 테스트 방이라 대기실 줄은 [테스트] 단추 아래(띠 아랫변 + 12 + 48)에서 시작한다. 일반 방 자리(띠 아랫변 + 12)는 화면 시험(test/client)이 맡는다.
// helpers 는 flows.mjs 가 넘긴다(errand.mjs·mapselect.mjs 와 같은 모양 — 서로 import 하지 않는다): { recorder, attempt, startHost, openGuest, openGame, closeGame, settledResult }
import {
  SetupError,
  chooseRole,
  closeModeSheet,
  closeSheet,
  collapseChatLog,
  hostLineScannerScript,
  installFakeViewport,
  offScannerScript,
  openModeSheet,
  openTestSheet,
  pickModeViaRail,
  readHostLines,
  readHostRail,
  readModeSheet,
  readOffScan,
  setBotVote,
  setBots,
  settle,
  skipOnce,
  sleep,
  startGame,
  waitWorldReady,
  watchSockets,
} from "./browser.mjs";
import { BASIC_ABSENT_ATTR_PREFIX, BASIC_ABSENT_SELECTORS, MODE_NAMES_E2E, basicModeChecks, hostRailChecks, hostRailMeasure, modeChipChecks, modeSheetChecks } from "./lib.mjs";

const HOST_NICK = "판종류방장";
const GUEST_NICK = "참가자하나";
/** 가짜 키보드 높이(chat-keyboard 흐름과 같은 값). 판정 문턱이 아니라 흉내 내는 키보드의 크기다 */
const KB_LIFT = 336;
/** 키보드 열림까지 보는 크기: 가장 낮은 폰과 승인 보드 폭 */
const KB_SIZES = ["360x560", "390x844"];
/** 한 판을 결과까지 넘기는 칸 수 상한(단계는 한 번에 하나씩 넘어간다) */
const MAX_STEPS = 40;
/** 기본 마피아 완주 흐름의 칸 수 상한(basic-off 와 같은 넉넉한 값 — 봇 투표가 갈려 날이 길어져도 ended 에 닿게) */
const BASIC_MAX_STEPS = 90;
/** 기본 마피아에서 서버가 싣지 않는 view 키(UI-SPEC E-1 의 판정 근거: 심부름·목격 기록·증거). 키 이름만 본다 */
const BASIC_OFF_VIEW_KEYS = { me: ["errand", "record"], day: ["evidence"] };
/** 이 빌드는 허용 맵이 둘 이상이라 줄에 [맵] 이 있다(map-select 흐름이 같은 전제를 쓴다) */
const MAPS_ON = true;

const modeOf = (tracker) => tracker.last()?.mode ?? "extended";
const toastOf = (mode) => `판 종류: ${MODE_NAMES_E2E[mode]}`;
const r1 = (n) => Math.round(n * 10) / 10;

/** 조건이 참이 될 때까지 50ms 간격으로 본다. 참이 된 시각(ms)을 돌려주고 시간 안에 안 되면 null */
async function until(fn, ms) {
  const t0 = Date.now();
  for (;;) {
    if (await fn().catch(() => false)) return Date.now() - t0;
    if (Date.now() - t0 > ms) return null;
    await sleep(50);
  }
}

/** readHostRail 이 읽은 값에 화면·역할·판 종류를 더해 hostRailChecks 입력으로 만든다. 키보드 열림 여부는 읽은 값이 아니라 부르는 쪽이 정한다(열림 표식이 잘못 켜진 화면이 줄 없음을 변명하지 못하게) */
const railArgs = (m, { screen, host, mode, botsOn, kbOpen = false }) => ({
  viewport: { w: m.vw, h: m.vh },
  screen,
  host,
  mode,
  kbOpen,
  mapsOn: MAPS_ON,
  botsOn,
  rail: m.rail,
  buttons: m.buttons,
  crown: m.crown,
  chip: m.chip,
  band: m.band,
  panel: m.panel,
  head: m.head,
  test: m.test,
  toast: m.toast,
  side: m.side,
  panelToggles: m.panelToggles,
});
const chipArgs = (m, viewMode) => ({ viewport: { w: m.vw, h: m.vh }, viewMode, chip: m.chip, band: m.band, panel: m.panel, head: m.head, test: m.test, toast: m.toast, side: m.side });
const sheetArgs = (m, viewMode) => ({ viewport: { w: m.vw, h: m.vh }, viewMode, sheet: m.sheet, cards: m.cards });

export function makeModeFlows({ recorder, attempt, startHost, openGuest, openGame, closeGame, settledResult }) {
  /** 판정 줄을 그대로 쌓는다. tag 는 id 꼬리(같은 판정을 화면·역할별로 가른다), who 는 라벨 머리 */
  const recLines = (rec, sc, lines, { tag = "", who = "" } = {}) => {
    for (const l of lines) rec(sc, `${l.id}${tag}`, `${who}${l.label}`, l.ok, l.detail, l.info === true);
  };
  /** 폰별 실측(판정 아님): 띠 아랫변·줄 최대 높이·단추 수·표식·열 — SUMMARY 의 실측 표가 이 줄에서 나온다 */
  const recMeasure = (rec, sc, id, label, args) => {
    const m = hostRailMeasure(args);
    const text = m
      ? `띠 아랫변 ${r1(m.bandBottom)} · 패널 윗변 ${r1(args.panel.top)} · 줄 최대 높이 ${r1(m.maxH)}${m.shift ? `(테스트 방 −${m.shift} 포함)` : ""} · 단추 ${m.n} · 표식 ${m.crown ? "있음" : "없음"} · 열 [${m.columns.join(",")}] · 식 ${m.expect.crown ? "표식 + " : ""}[${m.expect.columns.join(",")}]`
      : "잴 수 없음(줄·띠 없음)";
    rec(sc, id, `실측(판정 아님): ${label}`, true, text, true);
  };

  /** 방장 + 참가자 한 명 + 봇 둘(4명판)의 대기실. 시트는 닫아 둔다. role·vote 를 주면 테스트 도구로 정한다 */
  async function lobbyOf(ctx, flowId, { initScripts = [], role = null, vote = null } = {}) {
    const host = await startHost(ctx, flowId, { nickname: HOST_NICK, initScripts });
    const { page: hp, tracker: ht } = host;
    const { guest } = await openGuest(ctx, GUEST_NICK, { initScripts });
    try {
      const { page: gp, tracker: gt } = guest;
      await Promise.all([ht.waitFor((v) => v.players.length === 2, 6000, "방장 쪽 인원 2"), gt.waitFor((v) => v.players.length === 2, 6000, "참가자 쪽 인원 2")]);
      await openTestSheet(hp);
      await setBots(hp, ht, 2);
      if (vote) await setBotVote(hp, ht, vote);
      if (role) await chooseRole(hp, ht, role);
      await closeSheet(hp);
      await Promise.all([waitWorldReady(hp, 4), waitWorldReady(gp, 4)]);
      await Promise.all([settle(hp), settle(gp)]);
      return { host, guest, hp, ht, gp, gt, botsOn: ht.last()?.me?.testBots !== undefined };
    } catch (e) {
      await guest.context.close().catch(() => {});
      throw e;
    }
  }

  /** 페이지를 새로 고쳐 같은 자리로 다시 붙는다(새 state 프레임이 올 때까지) */
  async function reconnect(page, tracker, label) {
    const seq = tracker.seq;
    await page.reload({ waitUntil: "domcontentloaded" });
    await tracker.waitFor(() => tracker.seq > seq, 15_000, label);
  }

  /**
   * mode-rail (D-13·D-14·D-07, 폰 6종): 대기실에서 방장 줄(확장판 넷 → 기본 마피아 셋)과 참가자 칩, 판 종류 시트를 잰다.
   * ① 확장판: 방장 HR1~HR8 · 참가자 HR1·HR8·CH1·CH2 ② [판 종류] → 시트 MS1·MS1g ③ 기본 마피아: 방장 HR1~HR8(토글 없음)·참가자 칩·알림 한 줄
   * ④ 키보드 열림(두 크기만): 줄·칩 0 ⑤ 확장판으로 되돌림: 줄 넷·칩 복귀.
   */
  async function modeRailFlow(ctx) {
    const id = "mode-rail";
    const rec = recorder(ctx);
    const withKb = KB_SIZES.includes(ctx.size.label);
    const room = await lobbyOf(ctx, id, { initScripts: withKb ? [installFakeViewport] : [] });
    const { hp, ht, gp, gt, botsOn } = room;
    try {
      // ── ① 확장판(서버 기본값) ──
      const sc1 = `${id}/extended`;
      rec(sc1, "MR0", "새 방의 판 종류는 확장판(서버 기본값) — 방장·참가자가 받은 값이 같다", modeOf(ht) === "extended" && modeOf(gt) === "extended", `방장 ${modeOf(ht)} · 참가자 ${modeOf(gt)}`);
      const [h1, g1] = await Promise.all([readHostRail(hp), readHostRail(gp)]);
      const h1a = railArgs(h1, { screen: "lobby", host: true, mode: "extended", botsOn });
      recLines(rec, sc1, hostRailChecks(h1a), { who: "방장: " });
      recMeasure(rec, sc1, "HRM", "방장 대기실 확장판(테스트 방)", h1a);
      recLines(rec, sc1, hostRailChecks(railArgs(g1, { screen: "lobby", host: false, mode: "extended", botsOn })), { tag: "-참가자", who: "참가자: " });
      recLines(rec, sc1, modeChipChecks(chipArgs(g1, modeOf(gt))));

      // ── ② [판 종류] → 두 칸 시트 ──
      const sc2 = `${id}/sheet`;
      const opened = await attempt(() => openModeSheet(hp));
      rec(sc2, "MS0", "[판 종류] 를 누르면 시트가 열린다", opened.ok, opened.detail);
      if (!opened.ok) return;
      recLines(rec, sc2, modeSheetChecks(sheetArgs(await readModeSheet(hp), modeOf(ht))));

      // ── ③ 기본 마피아를 고른다 ──
      const sc3 = `${id}/basic`;
      const toastSeen = until(async () => (await readHostRail(gp)).toastText === toastOf("basic"), 4000);
      await hp.locator('[data-mode-sheet] [data-mode-card="basic"]').click({ timeout: 3000 });
      const arrived = await attempt(async () => {
        await Promise.all([ht.waitFor((v) => v.mode === "basic", 4000, "방장 쪽 판 종류 basic"), gt.waitFor((v) => v.mode === "basic", 4000, "참가자 쪽 판 종류 basic")]);
      });
      rec(sc3, "MS2", "칸을 누르면 서버 방송 뒤 방장·참가자 모두 판 종류가 기본 마피아", arrived.ok, arrived.detail);
      if (!arrived.ok) return;
      const toastMs = await toastSeen;
      rec(sc3, "MS2t", `참가자에게 알림 한 줄 "${toastOf("basic")}"`, toastMs !== null, toastMs === null ? "4초 안에 알림을 못 봄" : "");
      await sleep(250);
      recLines(rec, sc3, modeSheetChecks(sheetArgs(await readModeSheet(hp), modeOf(ht))), { tag: "-바꾼뒤", who: "바꾼 뒤 " });
      await closeModeSheet(hp);
      const [h3, g3] = await Promise.all([readHostRail(hp), readHostRail(gp)]);
      const h3a = railArgs(h3, { screen: "lobby", host: true, mode: "basic", botsOn });
      recLines(rec, sc3, hostRailChecks(h3a), { who: "방장: " });
      recMeasure(rec, sc3, "HRM", "방장 대기실 기본 마피아(테스트 방)", h3a);
      const modeBtn = h3.buttons.find((b) => b.id === "mode");
      rec(sc3, "MS2n", `방장 [판 종류] 단추의 이름이 "${toastOf("basic")}"`, modeBtn?.label === toastOf("basic"), `이름 "${modeBtn?.label ?? "단추 없음"}"`);
      recLines(rec, sc3, hostRailChecks(railArgs(g3, { screen: "lobby", host: false, mode: "basic", botsOn })), { tag: "-참가자", who: "참가자: " });
      recLines(rec, sc3, modeChipChecks(chipArgs(g3, modeOf(gt))));

      // ── ④ 키보드 열림: 줄·칩을 그리지 않는다(두 크기만) ──
      if (withKb) {
        const sc4 = `${id}/keyboard`;
        for (const [who, pg, isHost] of [["방장", hp, true], ["참가자", gp, false]]) {
          await pg.locator("[data-chat-input]").focus();
          await pg.evaluate((k) => window.__mfVv.set(window.innerHeight - k, 0), KB_LIFT);
          if ((await until(async () => (await readHostRail(pg)).kbOpen, 2500)) === null) throw new SetupError(`${who} 화면의 키보드 열림 표식이 켜지지 않음`);
          await sleep(250);
          const k = await readHostRail(pg);
          recLines(rec, sc4, hostRailChecks(railArgs(k, { screen: "lobby", host: isHost, mode: "basic", botsOn, kbOpen: true })), { tag: `-${who}`, who: `${who}(키보드 열림): ` });
          await pg.evaluate(() => {
            window.__mfVv.set(window.innerHeight, 0);
            if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
          });
          if ((await until(async () => !(await readHostRail(pg)).kbOpen, 2500)) === null) throw new SetupError(`${who} 화면의 키보드 열림 표식이 꺼지지 않음`);
          await collapseChatLog(pg);
          await sleep(300);
        }
      }

      // ── ⑤ 확장판으로 되돌린다: 줄이 다시 넷, 참가자 칩 복귀 ──
      const sc5 = `${id}/back`;
      const back = await attempt(async () => {
        await pickModeViaRail(hp, ht, "extended");
        await gt.waitFor((v) => v.mode === "extended", 4000, "참가자 쪽 판 종류 extended");
      });
      rec(sc5, "MR4", "확장판으로 되돌리면 방장·참가자 모두 판 종류가 확장판", back.ok, back.detail);
      if (!back.ok) return;
      await sleep(300);
      const [h5, g5] = await Promise.all([readHostRail(hp), readHostRail(gp)]);
      const failed = [
        ...hostRailChecks(railArgs(h5, { screen: "lobby", host: true, mode: "extended", botsOn })).map((l) => ({ ...l, who: "방장" })),
        ...hostRailChecks(railArgs(g5, { screen: "lobby", host: false, mode: "extended", botsOn })).map((l) => ({ ...l, who: "참가자" })),
        ...modeChipChecks(chipArgs(g5, modeOf(gt))).map((l) => ({ ...l, who: "참가자" })),
      ].filter((l) => !l.ok);
      rec(sc5, "MR5", "되돌린 뒤 방장 줄 넷(튜토리얼 토글 복귀)·참가자 칩이 처음과 같은 판정(HR·CH)을 통과", failed.length === 0, failed.map((l) => `${l.who} ${l.id} ${l.detail}`).join(" / "));
    } finally {
      await room.guest.context.close().catch(() => {});
    }
  }

  /**
   * mode-pick (D-05·D-06·D-07·D-10, 390x844): 판 종류 선택이 한 번만 가고, 방송·새로고침·재접속·한 판·다시 하기에 남는다.
   * MS1 시트 눌림 = 서버 값 → MS2 기본 마피아 고름(modePick 한 번·같은 칸은 안 보냄·참가자 칩) → 방장 새로고침·참가자 재접속 뒤에도 기본 마피아 →
   * D-10 확장판에서 토글을 켠 뒤 기본 마피아로 바꿔 시작하면 tutorial 단계가 없다 → MS3 진행 중에는 줄·칩이 없다 → 결과 화면 줄·칩(연출 뒤)·결과 화면에서 고르기 → 다시 하기 뒤에도 기본 마피아.
   */
  async function modePickFlow(ctx) {
    const id = "mode-pick";
    const rec = recorder(ctx);
    // 방장을 마피아로, 봇은 방장을 지목·찬성 — 첫 낮에 방장이 처형되어 한 판이 끝난다
    const room = await lobbyOf(ctx, id, { role: "mafia", vote: { exec: "yes", pick: "host" } });
    const { hp, ht, gp, gt, botsOn } = room;
    // 보낸 프레임은 새 연결부터 셀 수 있다 — 방장 페이지를 한 번 새로 고쳐 새 소켓을 감시한다(t 이름과 횟수만 본다)
    const sent = watchSockets(hp);
    const sentCount = (from, t) => sent.since(from).filter((x) => x === t).length;
    try {
      await reconnect(hp, ht, "방장 재연결(감시 시작)");
      await ht.waitFor((v) => v.phase === "lobby" && v.me?.isHost === true, 8000, "방장 대기실");
      await waitWorldReady(hp, 4);
      await settle(hp);

      // ── MS1: 시트의 눌린 칸 = 서버 값 ──
      const sc1 = `${id}/sheet`;
      await openModeSheet(hp);
      recLines(rec, sc1, modeSheetChecks(sheetArgs(await readModeSheet(hp), modeOf(ht))));

      // ── MS2: 기본 마피아를 고른다 ──
      const sc2 = `${id}/pick`;
      const m0 = sent.mark();
      await hp.locator('[data-mode-sheet] [data-mode-card="basic"]').click({ timeout: 3000 });
      const arrived = await attempt(async () => {
        await Promise.all([ht.waitFor((v) => v.mode === "basic", 4000, "방장 쪽 판 종류 basic"), gt.waitFor((v) => v.mode === "basic", 4000, "참가자 쪽 판 종류 basic")]);
      });
      rec(sc2, "MS2", "칸을 누르면 서버 방송 뒤 방장·참가자 모두 판 종류가 기본 마피아", arrived.ok, arrived.detail);
      if (!arrived.ok) return;
      await sleep(300);
      rec(sc2, "MS2a", "칸을 한 번 누르면 modePick 이 한 번 간다", sentCount(m0, "modePick") === 1, `modePick ${sentCount(m0, "modePick")}번`);
      recLines(rec, sc2, modeSheetChecks(sheetArgs(await readModeSheet(hp), modeOf(ht))), { tag: "-바꾼뒤", who: "바꾼 뒤 " });
      // 이미 고른 칸을 다시 눌러도 보내지 않는다
      await hp.locator('[data-mode-sheet] [data-mode-card="basic"]').click({ timeout: 3000 });
      await sleep(400);
      rec(sc2, "MS2b", "이미 고른 칸을 다시 눌러도 modePick 을 더 보내지 않는다", sentCount(m0, "modePick") === 1, `modePick ${sentCount(m0, "modePick")}번`);
      await closeModeSheet(hp);
      const [h2, g2] = await Promise.all([readHostRail(hp), readHostRail(gp)]);
      rec(sc2, "MS2n", `방장 [판 종류] 단추의 이름이 "${toastOf("basic")}"`, h2.buttons.find((b) => b.id === "mode")?.label === toastOf("basic"), `이름 "${h2.buttons.find((b) => b.id === "mode")?.label ?? "단추 없음"}"`);
      recLines(rec, sc2, modeChipChecks(chipArgs(g2, modeOf(gt))));

      // ── MS2: 새로고침·재접속 뒤에도 남는다 ──
      const sc3 = `${id}/reload`;
      const hBack = await attempt(async () => {
        await reconnect(hp, ht, "방장 새로고침");
        await ht.waitFor((v) => v.phase === "lobby" && v.me?.isHost === true, 8000, "방장 대기실");
        await hp.waitForSelector('[data-host-rail] [data-host-rail-btn="mode"]', { timeout: 8000 });
        await waitWorldReady(hp, 4);
        await settle(hp);
      });
      const h3 = hBack.ok ? await readHostRail(hp) : null;
      const label3 = h3?.buttons.find((b) => b.id === "mode")?.label ?? "단추 없음";
      rec(sc3, "MS2r", "방장이 새로 고쳐도 판 종류가 기본 마피아(받은 값·[판 종류] 이름)", hBack.ok && modeOf(ht) === "basic" && label3 === toastOf("basic"), hBack.detail || `받은 값 ${modeOf(ht)} · 이름 "${label3}"`);
      if (!hBack.ok) return;
      const gBack = await attempt(async () => {
        await reconnect(gp, gt, "참가자 재접속");
        await gt.waitFor((v) => v.phase === "lobby" && v.me?.isHost === false, 8000, "참가자 대기실");
        await gp.waitForSelector("[data-mode-chip]", { timeout: 8000 });
        await waitWorldReady(gp, 4);
        await settle(gp);
      });
      rec(sc3, "MS2g", "참가자가 다시 붙어도 판 종류가 기본 마피아(받은 값)", gBack.ok && modeOf(gt) === "basic", gBack.detail || `받은 값 ${modeOf(gt)}`);
      if (!gBack.ok) return;
      recLines(rec, sc3, modeChipChecks(chipArgs(await readHostRail(gp), modeOf(gt))), { tag: "-재접속", who: "재접속 뒤 " });

      // ── D-10: 확장판에서 토글을 켠 뒤 기본 마피아로 바꿔 시작하면 튜토리얼을 거치지 않는다 ──
      const sc4 = `${id}/start`;
      const prep = await attempt(async () => {
        await pickModeViaRail(hp, ht, "extended");
        const toggle = hp.locator('[data-host-rail] [data-host-rail-btn="tutorial"]');
        await toggle.waitFor({ timeout: 4000 });
        if ((await toggle.getAttribute("aria-checked")) !== "true") await toggle.click({ timeout: 3000 });
        if ((await toggle.getAttribute("aria-checked")) !== "true") return { ok: false, detail: `aria-checked ${await toggle.getAttribute("aria-checked")}` };
        await pickModeViaRail(hp, ht, "basic");
        await gt.waitFor((v) => v.mode === "basic", 4000, "참가자 쪽 판 종류 basic");
        return true;
      });
      rec(sc4, "D10a", "확장판에서 [튜토리얼 먼저] 를 켠 뒤 기본 마피아로 바꾼다(준비)", prep.ok, prep.detail);
      if (!prep.ok) return;
      await sleep(300);
      const h4 = await readHostRail(hp);
      recLines(rec, sc4, hostRailChecks(railArgs(h4, { screen: "lobby", host: true, mode: "basic", botsOn })).filter((l) => ["HR4", "HR7"].includes(l.id)), { who: "기본 마피아로 바꾼 뒤 방장: " });
      const hFrom = ht.phases.length;
      const gFrom = gt.phases.length;
      const m1 = sent.mark();
      const started = await attempt(async () => {
        await startGame(hp, ht);
        await gt.waitFor((v) => v.phase === "roleReveal", 8000, "참가자 역할 확인");
      });
      const hPhases = ht.phases.slice(hFrom);
      const gPhases = gt.phases.slice(gFrom);
      rec(sc4, "D10b", "기본 마피아에서 [시작] 하면 단계 열에 tutorial 이 없고 역할 확인에 닿는다(방장·참가자)", started.ok && !hPhases.includes("tutorial") && !gPhases.includes("tutorial") && hPhases.includes("roleReveal") && gPhases.includes("roleReveal"), started.detail || `방장 [${hPhases.join(">")}] 참가자 [${gPhases.join(">")}]`);
      if (!started.ok) return;
      rec(sc4, "D10c", "[시작] 은 start 한 번만 보내고 시작한 판의 판 종류는 기본 마피아", sentCount(m1, "start") === 1 && modeOf(ht) === "basic" && modeOf(gt) === "basic", `start ${sentCount(m1, "start")}번 · 방장 ${modeOf(ht)} · 참가자 ${modeOf(gt)}`);

      // ── MS3: 진행 중에는 줄·칩이 없다 ──
      const sc5 = `${id}/game`;
      const gameLines = async (tag) => {
        const [h, g] = await Promise.all([readHostRail(hp), readHostRail(gp)]);
        recLines(rec, sc5, hostRailChecks(railArgs(h, { screen: "game", host: true, mode: "basic", botsOn })), { tag: `-${tag}-방장`, who: `${tag} 방장: ` });
        recLines(rec, sc5, hostRailChecks(railArgs(g, { screen: "game", host: false, mode: "basic", botsOn })), { tag: `-${tag}-참가자`, who: `${tag} 참가자: ` });
      };
      await sleep(400);
      await gameLines(ht.last().phase);
      const toTalk = await attempt(async () => {
        for (let i = 0; i < 6 && ht.last().phase !== "discussion"; i++) await skipOnce(hp, ht);
        if (ht.last().phase !== "discussion") throw new Error(`낮 토론에 닿지 않음(지금 ${ht.last().phase})`);
        await gt.waitFor((v) => v.phase === "discussion", 6000, "참가자 낮 토론");
        await sleep(400);
      });
      rec(sc5, "MS3a", "기본 마피아 판이 낮 토론에 닿는다", toTalk.ok, toTalk.detail);
      if (!toTalk.ok) return;
      await gameLines("discussion");

      // ── 결과 화면: 연출 뒤 줄·칩, 결과 화면에서 고르기 ──
      const sc6 = `${id}/result`;
      const ended = await attempt(async () => {
        for (let i = 0; i < MAX_STEPS && ht.last().phase !== "ended"; i++) await skipOnce(hp, ht);
        if (ht.last().phase !== "ended") throw new Error(`${MAX_STEPS}칸을 넘겼는데 ${ht.last().phase} 에서 끝나지 않음`);
        await Promise.all([ht.waitFor((v) => v.phase === "ended" && v.result !== undefined, 10000, "방장 종료"), gt.waitFor((v) => v.phase === "ended" && v.result !== undefined, 10000, "참가자 종료")]);
        await Promise.all([settledResult(hp), settledResult(gp)]);
      });
      rec(sc6, "MS3b", "기본 마피아 판이 결과(ended)까지 닿고 연출이 끝난다", ended.ok, ended.detail);
      if (!ended.ok) return;
      const [h6, g6] = await Promise.all([readHostRail(hp), readHostRail(gp)]);
      const h6a = railArgs(h6, { screen: "result", host: true, mode: "basic", botsOn });
      recLines(rec, sc6, hostRailChecks(h6a), { who: "결과 방장: " });
      recMeasure(rec, sc6, "HRM", "결과 화면 방장", h6a);
      rec(sc6, "MS2e", `한 판이 끝난 결과 화면에서도 [판 종류] 단추의 이름이 "${toastOf("basic")}"`, h6.buttons.find((b) => b.id === "mode")?.label === toastOf("basic"), `이름 "${h6.buttons.find((b) => b.id === "mode")?.label ?? "단추 없음"}"`);
      recLines(rec, sc6, hostRailChecks(railArgs(g6, { screen: "result", host: false, mode: "basic", botsOn })), { tag: "-참가자", who: "결과 참가자: " });
      recLines(rec, sc6, modeChipChecks(chipArgs(g6, modeOf(gt))), { who: "결과 " });
      // 결과 화면에서 고르기(19-05 배선): 확장판 → 참가자 칩이 따라 바뀐다 → 다시 기본 마피아
      const onResult = await attempt(async () => {
        await pickModeViaRail(hp, ht, "extended");
        await gt.waitFor((v) => v.mode === "extended", 4000, "참가자 쪽 판 종류 extended");
        await gp.waitForSelector('[data-mode-chip="extended"]', { timeout: 3000 });
        await pickModeViaRail(hp, ht, "basic");
        await gt.waitFor((v) => v.mode === "basic", 4000, "참가자 쪽 판 종류 basic");
        await gp.waitForSelector('[data-mode-chip="basic"]', { timeout: 3000 });
      });
      rec(sc6, "MS2f", "결과 화면에서 판 종류를 바꾸면 참가자 칩이 따라 바뀐다(확장판 → 기본 마피아)", onResult.ok, onResult.detail);
      if (!onResult.ok) return;

      // ── D-06: 다시 하기 뒤에도 기본 마피아 ──
      const sc7 = `${id}/rematch`;
      const round1 = ht.last().round ?? 1;
      const again = await attempt(async () => {
        await gp.locator("[data-ready-pill]").click({ timeout: 4000 });
        await ht.waitFor((v) => v.players.filter((p) => p.ready === true && p.connected).length === v.players.filter((p) => p.connected).length, 6000, "모두 준비");
        await sleep(300);
        await hp.locator("[data-ready-pill]").click({ timeout: 4000 });
        // 쉬게 될 사람이 있으면 확인 시트가 뜬다 — 여기서는 모두 준비라 바로 시작하지만, 뜨면 [시작] 을 누른다
        const sheet = await hp.waitForSelector("dialog[open] [data-rest-faces]", { timeout: 1200 }).catch(() => null);
        if (sheet) await hp.locator("dialog[open]").getByRole("button", { name: "시작", exact: true }).click({ timeout: 3000 });
        await Promise.all([ht, gt].map((t) => t.waitFor((v) => (v.round ?? 1) === round1 + 1 && v.phase !== "ended", 10000, "새 판 도착")));
      });
      rec(sc7, "MS2d", "다시 하기로 시작한 다음 판도 판 종류가 기본 마피아(방장·참가자)", again.ok && modeOf(ht) === "basic" && modeOf(gt) === "basic", again.detail || `방장 ${modeOf(ht)} · 참가자 ${modeOf(gt)} · 판 ${ht.last().round ?? 1}`);
      if (!again.ok) return;
      const phases2 = ht.phases.slice(ht.phases.lastIndexOf("ended") + 1);
      rec(sc7, "MS2h", "다시 하기 판도 tutorial 단계를 거치지 않는다", !phases2.includes("tutorial"), `방장 [${phases2.join(">")}]`);
    } finally {
      sent.stop();
      await room.guest.context.close().catch(() => {});
    }
  }

  /**
   * mode-basic (D-08·D-09·D-11·D-18, UI-SPEC E·BM1~BM3, 390x844): 방장(시민) + 참가자 한 명 + 봇 넷의 기본 마피아 판을 대기실부터 결과까지 한 칸씩 넘긴다.
   * 방장·참가자 두 페이지에 감시 둘(없어야 할 표식 100ms·띠 글 100ms)을 처음부터 걸어 두고, 끝난 뒤 페이지마다 basicModeChecks 로 잰다 —
   * BM1 심부름·흔적·목격 표시·증거 카드·[기록] 단추 0건 · BM2 심부름 없는 단계 순서로 완주 · BM3 띠에 심부름·기록·증거 안내 0.
   * 봇은 낮은 자리의 참가자를 지목·찬성하므로 참가자는 첫날 탈락해 유령 화면으로 밤·아침을 본다(유령 시점의 표식 0건도 같이 잰다). 봇이 심부름 없이 투표·밤 고르기를 해 판이 끝나는지가 BM0 이다(D-11).
   */
  async function modeBasicFlow(ctx) {
    const id = "mode-basic";
    const rec = recorder(ctx);
    const scripts = [offScannerScript(BASIC_ABSENT_SELECTORS, BASIC_ABSENT_ATTR_PREFIX), hostLineScannerScript()];
    const game = await openGame(ctx, id, { guests: 1, bots: 4, role: "citizen", vote: { exec: "yes", pick: "other" }, to: null, mode: "basic", hostInitScripts: scripts, guestInitScripts: scripts });
    try {
      const { hp, ht } = game;
      const { page: gp, tracker: gt } = game.guests[0];
      let steps = 0;
      const walked = await attempt(async () => {
        while (ht.last().phase !== "ended" && steps < BASIC_MAX_STEPS) {
          await skipOnce(hp, ht);
          steps += 1;
          await sleep(250); // 감시(100ms)가 이 단계 화면을 한 번은 보게
        }
        if (ht.last().phase !== "ended") throw new Error(`${steps}칸을 넘겼는데 ${ht.last().phase} 에서 끝나지 않음`);
        await Promise.all([ht.waitFor((v) => v.phase === "ended" && v.result !== undefined, 10000, "방장 결과 도달"), gt.waitFor((v) => v.phase === "ended" && v.result !== undefined, 10000, "참가자 결과 도달")]);
      });
      rec(`${id}/flow`, "BM0", "기본 마피아 봇 판(방장 + 참가자 + 봇 넷)이 대기실부터 결과(ended)까지 닿는다 (D-11·D-18)", walked.ok, walked.detail || `${steps}칸`);
      if (!walked.ok) return;
      const shown = await attempt(async () => {
        await Promise.all([settledResult(hp), settledResult(gp)]);
      });

      const scenarioOf = { BM1: `${id}/dom`, BM2: `${id}/order`, BM3: `${id}/band` };
      for (const [who, page, tracker] of [
        ["방장", hp, ht],
        ["참가자", gp, gt],
      ]) {
        const [scan, band] = await Promise.all([readOffScan(page), readHostLines(page)]);
        for (const l of basicModeChecks({ phases: tracker.phases, scan, lines: band?.lines ?? null })) rec(scenarioOf[l.id], `${l.id}-${who}`, `${who}: ${l.label}`, l.ok, l.detail);
        // 참고(판정 아님): 감시 횟수·본 단계 열·띠 글 수 — 띠 글 원문은 남기지 않는다
        rec(`${id}/dom`, `BM1i-${who}`, `${who}: 감시가 돈 횟수와 본 단계 열(참고)`, true, scan === null ? "감시 없음" : `감시 ${scan.scans}회 · ${scan.phases.join(" → ")}`, true);
        rec(`${id}/order`, `BM2i-${who}`, `${who}: 받은 단계 열(참고)`, true, tracker.phases.join(">"), true);
        rec(`${id}/band`, `BM3i-${who}`, `${who}: 감시가 모은 띠 글 수(참고)`, true, band === null ? "감시 없음" : `띠 글 ${band.lines.length}가지 · 감시 ${band.scans}회`, true);
        // 프레임: 심부름·목격 기록·증거 키가 한 번도 오지 않았다(키가 비어 있는 것이 아니라 없다, D-08)
        const got = [...BASIC_OFF_VIEW_KEYS.me.filter((k) => tracker.viewKeys.me.has(k)).map((k) => `me.${k}`), ...BASIC_OFF_VIEW_KEYS.day.filter((k) => tracker.viewKeys.day.has(k)).map((k) => `day.${k}`)];
        rec(`${id}/frames`, `BM1k-${who}`, `${who}: 받은 state 프레임에 me.errand·me.record·day.evidence 키가 0건이다`, tracker.viewKeys.me.size > 0 && got.length === 0, tracker.viewKeys.me.size === 0 ? "측정값 없음(받은 me 키 0개)" : got.length > 0 ? got.join(", ") : `me 키 ${tracker.viewKeys.me.size}개 · day 키 ${tracker.viewKeys.day.size}개`);
      }

      // 판 종류 값: 두 페이지의 마지막 view.mode, 결과 화면 연출 뒤 방장 줄 [판 종류] 이름(D-06 결과 화면 쪽)
      rec(`${id}/mode`, "BMm", "결과에 닿은 두 페이지의 view.mode 가 basic 이다", modeOf(ht) === "basic" && modeOf(gt) === "basic", `방장 ${modeOf(ht)} · 참가자 ${modeOf(gt)}`);
      const rail = shown.ok ? await readHostRail(hp).catch(() => null) : null;
      const label = rail?.buttons?.find((b) => b.id === "mode")?.label;
      rec(`${id}/mode`, "BMn", `결과 화면 연출 뒤 방장 줄 [판 종류] 단추의 이름이 "${toastOf("basic")}"`, shown.ok && label === toastOf("basic"), shown.ok ? `이름 "${label ?? "단추 없음"}"` : shown.detail);
    } finally {
      await closeGame(game);
    }
  }

  return { modeRailFlow, modePickFlow, modeBasicFlow };
}

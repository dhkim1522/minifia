import {
  chooseVerdict,
  closeSheet,
  installFakeViewport,
  openTableDockPane,
  openTestSheet,
  readChatLines,
  readGame,
  setBots,
  skipOnce,
  skipTo,
  startGame,
  tapTurnPick,
  typeAndSendChat,
} from "./browser.mjs";
import { rectInside, TAP_MIN } from "./lib.mjs";

function dockMode(page, name) {
  return page.locator(`[data-table-dock][data-dock-open="${name}"]`);
}

export function makeFirstBallotDockFlow({ recorder, startHost, openGuest, checkRoomWidth }) {
  return async function firstBallotDockFlow(ctx) {
    const id = "first-ballot-dock";
    const rec = recorder(ctx);
    const { page, tracker } = await startHost(ctx, id, { playtest: true });
    const { guest, seat } = await openGuest(ctx, "첫날친구");
    try {
      await openTestSheet(page);
      await setBots(page, tracker, 6);
      await startGame(page, tracker);
      await skipTo(page, tracker, "discussion");
      await guest.tracker.waitFor((view) => view.phase === "discussion", 4000, "친구 화면의 첫 토론");
      await openTableDockPane(guest.page, "people");
      const guestSeats = guest.page.locator("[data-table-seat]");
      const seatOrder = await guestSeats.evaluateAll((seats) => seats.map((el) => el.getAttribute("data-table-seat")));

      await skipTo(page, tracker, "verdict");
      const hostBallot = page.locator('[data-dock-pane="people"] [data-first-ballot]');
      await hostBallot.waitFor({ timeout: 4000 });
      await checkRoomWidth(ctx, id, page, GAME_RAILS, ["[data-first-ballot]"]);
      rec(id, "FB1", "첫날 지목은 후보 7명과 안 뽑기 하나를 같은 하단 판에 표시한다",
        await hostBallot.locator("[data-pick]").count() === 7
        && await hostBallot.locator("[data-first-ballot-hold]").count() === 1
        && await page.locator('[data-phase-event="first-ballot"]').count() === 0);

      await guest.page.locator("[data-dock-pending]").waitFor({ timeout: 4000 });
      rec(id, "FB2", "참가자 판을 보고 있던 사람에겐 명시적으로 지목을 열기 전까지 투표 버튼이 없다",
        await guest.page.locator("[data-pick], [data-first-ballot-hold]").count() === 0);
      await openTableDockPane(guest.page, "people");
      const voteOrder = await guestSeats.evaluateAll((seats) => seats.map((el) => el.getAttribute("data-table-seat")));
      rec(id, "FB3", "바라보기와 첫날 지목에서 후보 좌석 순서가 같다",
        await guest.page.locator("[data-first-ballot] [data-pick]").count() === 7 && JSON.stringify(seatOrder) === JSON.stringify(voteOrder));

      const pick = hostBallot.locator(`[data-pick="${seat}"]`);
      const hold = hostBallot.locator("[data-first-ballot-hold]");
      await pick.click();
      await tracker.waitFor((view) => view.me.firstBallot === seat, 4000, "첫날 지목 서버 반영");
      await hostBallot.locator(`[data-pick="${seat}"][aria-pressed="true"]`).waitFor({ timeout: 2500 });
      rec(id, "FB4", "서버가 받은 첫날 지목은 같은 얼굴에 선택 표시를 남긴다",
        await pick.getAttribute("aria-pressed") === "true");
      await hold.click();
      await tracker.waitFor((view) => view.me.firstBallot === null, 4000, "첫날 안 뽑기 서버 반영");
      await hostBallot.locator('[data-first-ballot-hold][aria-pressed="true"]').waitFor({ timeout: 2500 });
      rec(id, "FB5", "마감 전 같은 화면에서 후보 선택을 안 뽑기로 바꾸고 서버 집계를 본다",
        await hold.getAttribute("aria-pressed") === "true" && /\d+\/8명 선택/.test(await hostBallot.getByRole("status").textContent()));
      await skipOnce(page, tracker);
      await tracker.waitFor((view) => view.day?.firstBallot?.result !== undefined, 4000, "첫날 지목 결과");
      const result = page.locator('[data-phase-event="first-ballot"] [data-first-ballot-result]');
      await result.waitFor({ timeout: 3000 });
      rec(id, "FB6", "첫날 집계가 끝나면 선택판이 닫히고 중앙에 공개 결과만 남는다",
        await hostBallot.count() === 0 && await result.count() === 1);
    } finally {
      await guest.context.close().catch(() => {});
    }
  };
}

async function swipe(page, selector, direction, mobile) {
  const area = await page.locator(selector).boundingBox();
  if (!area) throw new Error(`스와이프 영역이 보이지 않음: ${selector}`);
  const x = Math.round(area.x + area.width / 2);
  const y = Math.round(area.y + area.height / 2);
  if (!mobile) {
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y + direction * 76, { steps: 5 });
    await page.mouse.up();
    return;
  }
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
    for (const dy of [18, 36, 54, 76]) {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: y + direction * dy }] });
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  } finally {
    await cdp.detach().catch(() => {});
  }
}

const GAME_RAILS = [".mf-game__header", ".mf-game__panel"];

export function makeTableDockFlow({ recorder, openGame, closeGame, writeSheet, gameGH, checkRoomWidth }) {
  return async function tableDockFlow(ctx) {
    const id = ctx.size.mobile === false ? "table-dock-pc" : "table-dock";
    const sc = `${id}/discussion`;
    const rec = recorder(ctx);
    const game = await openGame(ctx, id, {
      guests: 3,
      bots: 0,
      guestInitScripts: [installFakeViewport],
    });
    try {
      const { host, hp, ht, guests } = game;
      const [first, second] = guests;
      await dockMode(hp, "chat").waitFor({ timeout: 5000 });
      await checkRoomWidth(ctx, sc, hp, GAME_RAILS, ["[data-table-dock]", '[data-dock-pane="chat"]']);
      const initial = await readGame(hp);
      const viewport = { left: 0, top: 0, right: initial.vw, bottom: initial.vh };
      const tabs = initial.tableDock.tabs;
      const usable = tabs.length === 3 && tabs.every((tab) => rectInside(tab, viewport) && tab.height >= TAP_MIN && tab.width >= TAP_MIN);
      rec(sc, "TD1", "토론에서는 채팅을 자동으로 열고 44px 이상인 하단 버튼 세 개를 제공한다",
        usable && initial.hasInput && await hp.locator("[data-dock-pane]").count() === 1, JSON.stringify(tabs));
      await gameGH(ctx, id, "discussion", host);

      await hp.locator("[data-game-menu]").click();
      const menu = hp.getByRole("dialog", { name: "게임 메뉴" });
      rec(sc, "TD2", "상단 메뉴에서 역할과 기록, 소리, 나가기에 접근할 수 있다",
        await menu.getByRole("button", { name: "내 역할과 기록" }).count() === 1
        && await menu.locator("[data-sound-button]").count() === 1
        && await menu.getByRole("button", { name: "방 나가기" }).count() === 1);
      await closeSheet(hp, "게임 메뉴");

      await openTableDockPane(hp, "people");
      const roster = hp.locator('[data-dock-pane="people"]');
      await checkRoomWidth(ctx, `${id}/people`, hp, GAME_RAILS, ["[data-table-controls]"]);
      rec(sc, "TD3", "참가자 판에는 자신을 뺀 세 명이 보이고 토론 중에는 얼굴을 지목할 수 없다",
        await roster.locator("[data-table-seat]").count() === 3
        && await roster.locator(`[data-table-seat="${game.hostSeat}"]`).count() === 0
        && await roster.locator("[data-pick]").count() === 0
        && await hp.locator("[data-chat-input]").count() === 0);
      await swipe(hp, "[data-dock-handle]", 1, ctx.size.mobile !== false);
      await dockMode(hp, "closed").waitFor({ timeout: 3500 });
      rec(sc, "TD4", "손잡이를 아래로 밀면 펼친 패널이 닫힌다", await hp.locator("[data-dock-pane]").count() === 0);
      await swipe(hp, '[data-dock-tab="people"]', -1, ctx.size.mobile !== false);
      await dockMode(hp, "people").waitFor({ timeout: 3500 });
      rec(sc, "TD4b", "참가자 탭을 위로 밀면 얼굴판이 열린다", await roster.locator("[data-table-seat]").count() === 3);
      await swipe(hp, "[data-dock-handle]", 1, ctx.size.mobile !== false);
      await dockMode(hp, "closed").waitFor({ timeout: 3500 });

      const messages = ["원탁 아래 새 메시지", "가장 최근 메시지"];
      await typeAndSendChat(first.page, messages[0]);
      await typeAndSendChat(second.page, messages[1]);
      const unread = hp.locator("[data-dock-unread]");
      await unread.filter({ hasText: "2" }).waitFor({ timeout: 3500 });
      rec(sc, "TD5", "채팅을 닫아 둔 동안 읽지 않은 상대 메시지 2건을 센다",
        await unread.textContent() === "2" && await hp.locator("[data-chat-log]").count() === 0);
      await openTableDockPane(hp, "chat");
      const lines = await readChatLines(hp);
      rec(sc, "TD6", "채팅을 열면 두 메시지가 보이고 읽지 않은 표시가 사라진다",
        messages.every((text) => lines?.some((line) => line.text === text)) && await unread.count() === 0);

      const draft = "쓰던 채팅은 남아요";
      const input = hp.locator("[data-chat-input]");
      await input.fill(draft);
      await openTableDockPane(hp, "tools");
      const tools = hp.locator('[data-dock-pane="tools"]');
      rec(sc, "TD7", "도구 탭에 반응과 의심 딱지, 유언이 모여 있다",
        await tools.locator('[data-playtest-action="reaction"]').count() > 0
        && await tools.locator("[data-suspect-btn]").count() === 1
        && await tools.locator("[data-will-button]").count() === 1);
      await tools.locator("[data-suspect-btn]").click();
      await hp.getByRole("region", { name: "딱지 붙이기" }).waitFor({ timeout: 3500 });
      rec(sc, "TD8A", "딱지 도구를 선택하면 참가자 판이 바로 열리고 무대 이름표는 대상 버튼이 되지 않는다",
        await roster.locator("[data-suspect-tag]").count() === 3 && await hp.locator("[data-world-stage] [data-suspect-tag]").count() === 0);
      await roster.locator("[data-dock-handle]").click();
      await dockMode(hp, "closed").waitFor({ timeout: 3500 });
      rec(sc, "TD8C", "딱지 대상 패널을 닫으면 보내지 않고 취소한다",
        ht.last().me.suspectTo === undefined && await hp.locator('[data-suspect-mode="off"]').count() === 1);
      await openTableDockPane(hp, "tools");
      await tools.locator("[data-suspect-btn]").click();
      await roster.locator(`[data-table-seat="${first.seat}"][data-suspect-tag]`).click();
      await ht.waitFor((view) => view.me.suspectTo === first.seat, 4000, "의심 딱지 서버 반영");
      rec(sc, "TD8", "도구에서 의심 대상을 골라 서버에 반영한다", ht.last().me.suspectTo === first.seat);
      await openTableDockPane(hp, "tools");
      await tools.locator("[data-will-button]").click();
      await writeSheet(hp, ht, "will", "제 유언을 전해 주세요");
      await openTableDockPane(hp, "chat");
      rec(sc, "TD9", "유언을 서버에 저장하고 도구 사용 뒤 채팅 초안을 이어 쓸 수 있다",
        ht.last().me.will === "제 유언을 전해 주세요" && await input.inputValue() === draft);

      const voteScenario = `${id}/nomination`;
      await skipTo(hp, ht, "verdict");
      await chooseVerdict(hp, true);
      await ht.waitFor((view) => view.phase === "verdict" && view.me.verdictVote === true, 4000, "방장 찬반 서버 반영");
      await skipTo(hp, ht, "nomination");
      await ht.waitFor(({ day, me }) => day?.turn?.order[day.turn.i] === me.seat && day.turn.doneAt === undefined, 12_000, "방장 지목 차례");
      await dockMode(hp, "people").waitFor({ timeout: 3000 });
      const voteTab = hp.locator('[data-dock-tab="people"]');
      const choices = roster.locator("[data-pick]");
      rec(voteScenario, "TD10", "자기 차례에만 얼굴판이 자동으로 열리고 자신을 뺀 후보를 고른다",
        await voteTab.getAttribute("data-dock-vote") !== null && await choices.count() === 3
        && await roster.locator(`[data-pick="${game.hostSeat}"]`).count() === 0
        && await first.page.locator("[data-pick]").count() === 0);

      const preview = first.page.locator("[data-dock-peek]").filter({ hasText: messages[1] });
      await preview.waitFor({ timeout: 3500 });
      rec(voteScenario, "TD10b", "남의 지목 차례 대기 중에는 최신 상대 메시지 한 줄만 보여 준다",
        await preview.count() === 1 && await first.page.locator("[data-chat-log]").count() === 0);
      await preview.click();
      await dockMode(first.page, "chat").waitFor({ timeout: 3500 });
      const guestInput = first.page.locator("[data-chat-input]");
      await guestInput.fill(draft);
      if (ctx.size.mobile !== false) {
        await first.page.evaluate(() => window.__mfVv.set(window.innerHeight - 240, 0));
        await first.page.locator('[data-kb-open="true"]').waitFor({ timeout: 3000 });
        await checkRoomWidth(ctx, `${id}/keyboard`, first.page, GAME_RAILS, ['[data-dock-pane="chat"]']);
      }
      await tapTurnPick(hp, first.seat);
      await ht.waitFor((view) => view.day?.points?.some((point) => point.seat === game.hostSeat && point.target === first.seat),
        4000, "방장 지목 서버 반영");
      await dockMode(hp, "closed").waitFor({ timeout: 3000 });
      rec(voteScenario, "TD11", "얼굴을 고르면 서버에 기록되고 얼굴판이 자동으로 접힌다",
        await hp.locator("[data-pick]").count() === 0);

      await first.tracker.waitFor(({ day, me }) => day?.turn?.order[day.turn.i] === me.seat && day.turn.doneAt === undefined,
        5000, "다음 사람 지목 차례");
      await first.page.locator('[data-dock-tab="people"][data-dock-vote]').waitFor({ timeout: 3500 });
      const typing = await guestInput.evaluate((el) => document.activeElement === el && el.value === "쓰던 채팅은 남아요");
      rec(voteScenario, "TD12", "입력 중 차례가 와도 채팅 초점과 초안을 유지하고 지목 탭을 알린다",
        typing && await dockMode(first.page, "chat").count() === 1);
      const guestVote = first.page.locator('[data-dock-tab="people"][data-dock-vote]');
      if (ctx.size.mobile === false) await guestVote.click();
      else await guestVote.tap();
      await dockMode(first.page, "people").waitFor({ timeout: 3000 });
      await openTableDockPane(second.page, "people");
      await tapTurnPick(first.page, game.hostSeat);
      await first.tracker.waitFor((view) => view.day?.points?.some((point) => point.seat === first.seat && point.target === game.hostSeat),
        4000, "다음 사람 지목 서버 반영");
      rec(voteScenario, "TD13", "입력 중 지목 탭을 한 번 누르면 얼굴판이 열려 대상을 고를 수 있다", true);

      const secondVote = second.page.locator('[data-dock-tab="people"][data-dock-pending]');
      await secondVote.waitFor({ timeout: 4000 });
      const viewed = second.page.locator(`[data-table-seat="${first.seat}"]`);
      await viewed.click({ timeout: 2500 });
      rec(voteScenario, "TD14", "얼굴판을 보는 중 내 차례가 와도 바라보기 터치가 표로 제출되지 않는다",
        await viewed.getAttribute("aria-pressed") === "true"
        && await second.page.locator("[data-pick]").count() === 0
        && !second.tracker.last().day?.points?.some((point) => point.seat === second.seat));
      await tapTurnPick(second.page, game.hostSeat);
      await second.tracker.waitFor((view) => view.day?.points?.some((point) => point.seat === second.seat && point.target === game.hostSeat),
        4000, "바라보기 뒤 내 표 반영");
      rec(voteScenario, "TD15", "열려 있는 참가자 탭의 지목을 누른 뒤 얼굴을 골라 표를 보낸다", true);
    } finally {
      await closeGame(game);
    }
  };
}

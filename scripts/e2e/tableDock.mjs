import {
  chooseVerdict,
  closeSheet,
  installFakeViewport,
  openTableDockPane,
  readChatLines,
  readGame,
  skipTo,
  tapTurnPick,
  typeAndSendChat,
} from "./browser.mjs";
import { rectInside, TAP_MIN } from "./lib.mjs";

function dockMode(page, name) {
  return page.locator(`[data-table-dock][data-dock-open="${name}"]`);
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

export function makeTableDockFlow({ recorder, openGame, closeGame, writeSheet, gameGH }) {
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
      await openTableDockPane(hp, "people");
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
      await tapTurnPick(first.page, game.hostSeat);
      await first.tracker.waitFor((view) => view.day?.points?.some((point) => point.seat === first.seat && point.target === game.hostSeat),
        4000, "다음 사람 지목 서버 반영");
      rec(voteScenario, "TD13", "입력 중 지목 탭을 한 번 누르면 얼굴판이 열려 대상을 고를 수 있다", true);
    } finally {
      await closeGame(game);
    }
  };
}

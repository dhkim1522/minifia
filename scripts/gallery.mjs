// 화면설계서 v1.0 용 배포본 화면 갤러리(design/screens/README.md). 테스트 방 + 서버 봇으로 한 판을 돌며 단계·시트마다 390×844(2배) 사진을 찍는다.
// 사용법: node scripts/gallery.mjs <저장 폴더> [police|mafia|doctor|citizen] [봇 수 3~7] — 경찰이면 입장·닉네임 화면도 찍는다. Chrome 경로는 E2E 와 같다.
import { existsSync } from "node:fs";
import { findChrome } from "./e2e/lib.mjs";
import { expectedOrigin, exitIfV1 } from "./deploy-target.mjs";
const B = await import("./e2e/browser.mjs");
const { createTestRoom, openHostPage, openTestSheet, closeSheet, setBots, chooseRole, startGame, skipTo, sleep, launchChrome, setBotVote, voteAs, pickCandidate, inspectSeat, openRoleCard, selectRoleCardTab, closeRoleCard, tapSeat, typeAndSendChat } = B;
const ORIGIN = expectedOrigin();
exitIfV1(ORIGIN); // 맨 앞에서 v1.0 거부(DEPLOY-02)
const OUT = process.argv[2];
const ROLE = process.argv[3] || "police";
const BOTS = Number(process.argv[4] || 5);
const size = { w: 390, h: 844 };
const browser = await launchChrome(findChrome(process.platform, process.env, existsSync));
const log = (...a) => console.log(...a);
const snap = async (page, name) => { await page.screenshot({ path: `${OUT}/${name}.png` }); log("shot", name); };
const step = async (label, fn) => { try { await fn(); } catch (e) { log("FAIL", label, String(e?.message ?? e).slice(0, 200)); } };

if (ROLE === "police") {
  // 입구·닉네임 시트(세션 없는 새 창)
  await step("entry", async () => {
    const ctx = await browser.newContext({ viewport: { width: size.w, height: size.h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "ko-KR" });
    const p = await ctx.newPage();
    await p.goto(ORIGIN);
    await sleep(2500);
    await snap(p, "01-entry");
    await p.getByRole("button", { name: "방 만들기" }).first().click();
    await sleep(900);
    await snap(p, "02-nickname");
    await ctx.close();
  });
}

const room = await createTestRoom(ORIGIN, "화면검사기");
const host = await openHostPage(browser, { origin: ORIGIN, code: room.code, token: room.token, size, dpr: 2 });
const { page, tracker } = host;
const v = () => tracker.last();
await sleep(1200);
await openTestSheet(page);
await setBots(page, tracker, BOTS);
await chooseRole(page, tracker, ROLE);
await setBotVote(page, tracker, { exec: "yes", pick: "other" });
await closeSheet(page);
await sleep(800);
await snap(page, `03-lobby-${ROLE}`);
// 로비 자유 채팅(07-20): 방장이 두 줄을 보낸 기록 칸 — 순차 주장·빠른 메시지·이모티콘 화면을 대신한다
await step("lobby-chat", async () => {
  await typeAndSendChat(page, "다들 왔나요?"); await sleep(1100); // 보내기 간격 하한(CHAT_MIN_GAP_MS 600)보다 길게
  await typeAndSendChat(page, "곧 시작할게요"); await sleep(900);
  await snap(page, `03b-lobby-chat-${ROLE}`);
});

await startGame(page, tracker, { onAssigning: async () => { await snap(page, `04-assigning-${ROLE}`); } });
await sleep(900);
await snap(page, `05-role-back-${ROLE}`);
await step("flip", async () => { await page.getByRole("button", { name: "역할 카드 뒤집기" }).click(); await sleep(1100); await snap(page, `06-role-front-${ROLE}`); });

// 낮 시작 → 토론(순차 주장 단계는 없다, CHAT-06)
await tracker.waitFor((x) => x.phase === "dayAnnounce", 20_000, "낮 시작");
await sleep(700);
await snap(page, `07-day-intro-${ROLE}`);
await tracker.waitFor((x) => x.phase === "discussion", 60_000, "토론");
const mySeat = v().me.seat;
await sleep(2500);
await snap(page, `10-discussion-${ROLE}`);
// 토론 자유 채팅: 방장이 한 줄 보낸 기록 칸
await step("discussion-chat", async () => {
  await typeAndSendChat(page, "저는 수상한 사람이 없는 것 같아요"); await sleep(1500);
  await snap(page, `11-discussion-chat-${ROLE}`);
});
await step("record", async () => {
  const other = v().players.find((p) => p.seat !== mySeat && p.alive !== false);
  await inspectSeat(page, other.seat); await sleep(700);
  await snap(page, `13-record-${ROLE}`);
  await page.keyboard.press("Escape"); await sleep(600);
});
await step("rolecard", async () => {
  await openRoleCard(page); await sleep(500);
  await snap(page, `14-rolecard-${ROLE}`);
  await selectRoleCardTab(page, "활동 기록"); await sleep(500);
  await snap(page, `15-journal-${ROLE}`);
  await closeRoleCard(page); await sleep(500);
});

// 처형 투표
await step("execvote", async () => {
  await skipTo(page, tracker, "execVote");
  await sleep(700); await snap(page, `17-exec-intro-${ROLE}`);
  await sleep(1300); await snap(page, `18-exec-intro-b-${ROLE}`);
  await sleep(1800);
  await voteAs(page, tracker, "찬성"); await sleep(600);
  await snap(page, `19-exec-vote-${ROLE}`);
});
await step("cand", async () => {
  await tracker.waitFor((x) => x.phase === "candidateVote", 20_000, "후보 선택");
  await sleep(1200); await snap(page, `20-cand-none-${ROLE}`);
  const other = v().players.find((p) => p.seat !== mySeat && p.alive !== false);
  await pickCandidate(page, tracker, other.seat); await sleep(700);
  await snap(page, `21-cand-picked-${ROLE}`);
});
await step("reveal", async () => {
  await tracker.waitFor((x) => x.phase === "candidateVoteReveal", 20_000, "공개");
  await sleep(1500); await snap(page, `22-reveal-a-${ROLE}`);
  await sleep(2000); await snap(page, `23-reveal-b-${ROLE}`);
  await tracker.waitFor((x) => x.phase !== "candidateVoteReveal", 30_000, "공개 끝");
});
await step("defense", async () => {
  if (v().phase === "defense") { await sleep(1500); await snap(page, `24-defense-${ROLE}`); }
  await tracker.waitFor((x) => x.phase === "execution" || x.phase === "night", 15_000, "처형");
  if (v().phase === "execution") { await sleep(600); await snap(page, `25-execution-a-${ROLE}`); await sleep(1800); await snap(page, `26-execution-b-${ROLE}`); }
});
await step("night", async () => {
  await tracker.waitFor((x) => x.phase === "night" || x.phase === "ended", 20_000, "밤");
  if (v().phase !== "night") return;
  await sleep(2600); await snap(page, `27-night-${ROLE}`);
  // 밤 마피아 채팅(마피아 방장만 채팅 패널이 붙는다)
  if (ROLE === "mafia" && v().me.chat === "mafia") {
    await step("night-chat", async () => {
      await typeAndSendChat(page, "오늘 밤은 누구로 할까요"); await sleep(1200);
      await snap(page, `27b-night-mafia-chat-${ROLE}`);
    });
  }
  if (v().players.find((p) => p.seat === mySeat)?.alive !== false) {
    const other = v().players.find((p) => p.seat !== mySeat && p.alive !== false);
    await tapSeat(page, other.seat).catch(() => {}); await sleep(800);
    await snap(page, `28-night-pick-${ROLE}`);
  }
});
await step("morning", async () => {
  await skipTo(page, tracker, "morning");
  await sleep(900); await snap(page, `29-morning-${ROLE}`);
  await sleep(1800); await snap(page, `30-morning-b-${ROLE}`);
});
await step("ended", async () => {
  await openTestSheet(page);
  for (let i = 0; i < 80 && v().phase !== "ended"; i++) {
    const before = v().phase, be = v().phaseEndsAt;
    await B.clickInDialog(page, "테스트 도구", "다음 단계로 넘기기").catch(() => {});
    await tracker.waitFor((x) => x.phase !== before || x.phaseEndsAt !== be, 3000, "넘김").catch(() => {});
  }
  await closeSheet(page).catch(() => {});
  await sleep(3000); await snap(page, `31-result-${ROLE}`);
  await page.evaluate(() => { const s = document.querySelector(".mf-result") ?? document.scrollingElement; s.scrollTo?.(0, 99999); window.scrollTo(0, 99999); });
  await sleep(800); await snap(page, `32-result-bottom-${ROLE}`);
});
await browser.close();
log("done");

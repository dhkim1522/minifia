// 화면 E2E 흐름(결정 0025): 흐름마다 새 테스트 방 하나와 방장 페이지 하나. 검사 ID 는 계획 261025-h1j 의 "검사 목록" 과 같다.
// 결과는 { scenario: "흐름/상태", size, id, label, ok, detail } 로 ctx.results 에 쌓인다.
import { join } from "node:path";
import { mkdirSync } from "node:fs";
import {
  SetupError,
  chooseRole,
  clickInDialog,
  clickTopmostPoint,
  closeRoleCard,
  closeSheet,
  collectSnapshot,
  createTestRoom,
  inspectSeat,
  leaveLobby,
  openChatHistory,
  openHostPage,
  openRoleCard,
  openTestSheet,
  pickChip,
  readNightIntro,
  readStage,
  resetAndLeave,
  selectRoleCardTab,
  setBots,
  settle,
  shot,
  skipTo,
  sleep,
  startGame,
  tapSeat,
} from "./browser.mjs";
import {
  ROLE_NAME,
  claimChatIssues,
  dayChecks,
  dimChecks,
  feltGapChecks,
  feltStable,
  genericIssues,
  inspectChecks,
  journalChecks,
  lineCount,
  livingRoleArtChecks,
  morningCardIssues,
  morningGoneChecks,
  nightIntroChecks,
  noNightNoticeChecks,
  rectInside,
  rectsOverlap,
  roleCardButtonChecks,
  roleCardTabChecks,
  spectatorChecks,
  stageStable,
  tagsOverlap,
  turnChecks,
} from "./lib.mjs";

export const OUT_DIR = new URL("./out/", import.meta.url).pathname;
const HOST_NICK = "화면검사기";

/** 검사 한 줄을 쌓는다. */
function recorder(ctx) {
  return (scenario, id, label, ok, detail = "") => {
    ctx.results.push({ scenario, size: ctx.size.label, id, label, ok: !!ok, detail: ok ? "" : String(detail) });
  };
}

/** 비동기 확인을 검사 결과 { ok, detail } 로 바꾼다(시간 초과·오류는 실패 + 이유). */
export async function attempt(fn) {
  try {
    const r = await fn();
    if (r === undefined || r === true) return { ok: true, detail: "" };
    if (r === false) return { ok: false, detail: "" };
    return r;
  } catch (e) {
    return { ok: false, detail: String(e instanceof Error ? e.message : e).split("\n")[0].slice(0, 160) };
  }
}

/** 방 만들기 → 방장 페이지 → S1·S2. */
export async function startHost(ctx, flowId) {
  const rec = recorder(ctx);
  const room = await createTestRoom(ctx.origin, HOST_NICK);
  ctx.secrets.push(room.token);
  const host = await openHostPage(ctx.browser, { origin: ctx.origin, code: room.code, token: room.token, size: ctx.size, dpr: ctx.shots ? 2 : 1 });
  ctx.host = host;
  const v = host.tracker.last();
  rec(`${flowId}/setup`, "S1", "방장으로 연결", v?.me?.isHost === true && v?.me?.testMode === true, `isHost ${v?.me?.isHost}, testMode ${v?.me?.testMode}`);
  rec(`${flowId}/setup`, "S2", "글꼴 Gowun Dodum", host.fontOk, host.fontDetail);
  return host;
}

/** 지금 화면을 스냅숏으로 찍고 공통 검사 G 한 줄을 쌓는다. 스냅숏(+issues)을 돌려준다. --shots 면 사진도 저장한다. */
export async function checkState(ctx, flowId, state) {
  const rec = recorder(ctx);
  const { page } = ctx.host;
  const snap = await collectSnapshot(page);
  snap.issues = ctx.host.takeIssues();
  if (ctx.shots) {
    mkdirSync(OUT_DIR, { recursive: true });
    await shot(page, join(OUT_DIR, `${flowId}-${state}-${ctx.size.label}.png`));
  }
  const g = genericIssues(snap, ctx.size);
  const bad = g.filter((x) => !x.ok);
  rec(`${flowId}/${state}`, "G", "G 공통 검사", bad.length === 0, bad.map((x) => `${x.id} ${x.detail}`).join(" / "));
  return snap;
}

const sameRect = (a, b) => Math.abs(a.left - b.left) < 0.01 && Math.abs(a.top - b.top) < 0.01 && Math.abs(a.width - b.width) < 0.01;

// ---- lobby ----

async function lobbyFlow(ctx) {
  const rec = recorder(ctx);
  const { w, h } = ctx.size;
  const host = await startHost(ctx, "lobby");
  const { page, tracker } = host;
  await settle(page);

  // 대기실, 시트 닫힘
  const s1 = await checkState(ctx, "lobby", "lobby");
  const tt = s1.tt;
  rec("lobby/lobby", "L1", "[테스트] 버튼이 보임", !!tt && tt.rect.width > 0 && tt.rect.height > 0 && rectInside(tt.rect, { left: 0, top: 0, width: w, height: h }) && tt.hit, tt ? `rect ${Math.round(tt.rect.left)},${Math.round(tt.rect.top)} ${Math.round(tt.rect.width)}x${Math.round(tt.rect.height)}, hit ${tt.hit}` : "버튼 없음");
  const clashes = tt ? s1.interactive.filter((e) => !sameRect(e.rect, tt.rect) && rectsOverlap(e.rect, tt.rect)).map((e) => e.desc) : ["버튼 없음"];
  rec("lobby/lobby", "L2", "[테스트]가 다른 조작과 안 겹침", clashes.length === 0, `겹침: ${clashes.join(", ")}`);

  // 시트 열림
  await openTestSheet(page);
  const t1 = await attempt(async () => {
    const open = await page.locator('dialog[aria-label="테스트 도구"]').evaluate((d) => d.classList.contains("mf-dialog--open"));
    const title = await page.locator('dialog[aria-label="테스트 도구"] h2').first().isVisible();
    return { ok: open && title, detail: `open ${open}, 제목 보임 ${title}` };
  });
  rec("lobby/sheet", "T1", "테스트 시트 열림", t1.ok, t1.detail);
  const s2 = await checkState(ctx, "lobby", "sheet");
  const ts = s2.testSheet;
  let l3 = { ok: false, detail: "시트 정보 없음" };
  if (ts) {
    // 같은 줄 = 세로 가운데가 같다(줄은 align-items:center 라 높이가 다른 요소의 top 은 다르다). 줄바꿈이면 가운데가 크게 벌어진다.
    const mids = ts.stepper.map((r) => r.top + r.height / 2);
    const oneRow = mids.length > 0 && Math.max(...mids) - Math.min(...mids) <= 1;
    const insideRight = ts.stepper.length > 0 && ts.stepper.every((r) => r.right <= ts.sheet.right + 0.5 && r.left >= ts.sheet.left - 0.5);
    const big = (b) => !!b && b.rect.width + 0.5 >= 44 && b.rect.height + 0.5 >= 44 && b.hit;
    const ok = oneRow && insideRight && big(ts.minus) && big(ts.plus);
    l3 = { ok, detail: `한 줄 ${oneRow}(가운데 ${mids.map((m) => Math.round(m * 10) / 10).join("/")}), 시트 안 ${insideRight}, [−] ${big(ts.minus)}, [+] ${big(ts.plus)}` };
  }
  rec("lobby/sheet", "L3", "봇 줄 한 줄·[−][+] 44px", l3.ok, l3.detail);

  // 5명 채우기
  await clickInDialog(page, "테스트 도구", "5명 채우기");
  const l4 = await attempt(async () => {
    await tracker.waitFor((v) => v.players.length === 5, 3000, "인원 5");
    await page.waitForFunction(() => document.querySelector(".mf-tt-sheet__count")?.textContent?.trim() === "4명" && document.querySelector(".mf-lobby__count")?.textContent?.trim() === "5 / 8명", null, { timeout: 3000 });
  });
  rec("lobby/sheet", "L4", "5명 채우기", l4.ok, l4.detail);

  // [+] / [−]
  const l5 = await attempt(async () => {
    await clickInDialog(page, "테스트 도구", "봇 늘리기");
    await tracker.waitFor((v) => v.players.length === 6, 3000, "인원 6");
    await page.waitForFunction(() => document.querySelector(".mf-tt-sheet__count")?.textContent?.trim() === "5명", null, { timeout: 3000 });
    await clickInDialog(page, "테스트 도구", "봇 줄이기");
    await tracker.waitFor((v) => v.players.length === 5, 3000, "인원 5");
    await page.waitForFunction(() => document.querySelector(".mf-tt-sheet__count")?.textContent?.trim() === "4명", null, { timeout: 3000 });
  });
  rec("lobby/sheet", "L5", "[+]/[−] 로 숫자가 바뀜", l5.ok, l5.detail);

  // 시트 닫힘
  const t2 = await attempt(async () => {
    await closeSheet(page);
    return (await page.locator('dialog[aria-label="테스트 도구"]').count()) === 0;
  });
  rec("lobby/sheet", "T2", "테스트 시트 닫힘", t2.ok, t2.detail);

  await leaveLobby(page);
}

// ---- 게임 흐름(과제 2) ----

/** 낮 장면 상태(claim·discussion·night·morning) 한 장: 스냅숏 + G + D1~D6·D8 + T2. 테이블 면·이름표·장면 상자는 흐름 끝의 D7·D9·T1 용으로 모아 둔다. */
async function dayState(ctx, flowId, state) {
  const rec = recorder(ctx);
  const snap = await checkState(ctx, flowId, state);
  const mySeat = ctx.host.tracker.last()?.me?.seat ?? -1;
  for (const r of dayChecks(snap, { w: ctx.size.w, h: ctx.size.h })) rec(`${flowId}/${state}`, r.id, r.label, r.ok, r.detail);
  const stage = await readStage(ctx.host.page);
  const t2 = feltGapChecks(stage);
  rec(`${flowId}/${state}`, t2.id, t2.label, t2.ok, t2.detail);
  (ctx.dayStates ??= []).push({ state, felt: snap.felt, tags: snap.tags, stage, mySeat });
  return { snap, mySeat };
}

/** 밤 하단·알약·안내 줄 수(N1·N4·N5). 누르기 전 스냅숏으로 본다. */
function nightStaticChecks(ctx, flowId, role, snap) {
  const rec = recorder(ctx);
  const sc = `${flowId}/night`;
  const text = snap.panel?.text ?? "";
  const has = (...words) => words.every((w) => text.includes(w));
  let n1;
  if (role === "police") n1 = { ok: has("조사할 사람을 고르세요", "선택 안 함"), detail: `패널 글자 "${text.slice(0, 60)}"` };
  else if (role === "doctor") n1 = { ok: has("지킬 사람을 고르세요", "선택 안 함"), detail: `패널 글자 "${text.slice(0, 60)}"` };
  else if (role === "citizen") n1 = { ok: has("밤이 되었어요", "이번 밤에는 할 수 있는 행동이 없어요"), detail: `패널 글자 "${text.slice(0, 60)}"` };
  else n1 = { ok: snap.mafiaLog && has("마피아끼리만 보여요", "빠른 메시지"), detail: `마피아 로그 ${snap.mafiaLog}, 패널 글자 "${text.slice(0, 60)}"` };
  rec(sc, "N1", "역할별 하단", n1.ok, n1.detail);

  // N4: 하단 안내 2줄 이하(경찰·의사·시민), 패널 자식이 모두 패널 안
  const bad = [];
  if (role !== "mafia") {
    if (!snap.guide) bad.push("안내 줄 없음");
    else if (lineCount(snap.guide.rect.height, snap.guide.lineHeight) > 2) bad.push(`안내 ${lineCount(snap.guide.rect.height, snap.guide.lineHeight)}줄`);
  }
  for (const c of snap.panel?.children ?? []) if (!rectInside(c.rect, snap.panel.rect)) bad.push(`${c.desc} 이 패널 밖`);
  rec(sc, "N4", "하단 안내 2줄·패널 안", bad.length === 0, bad.slice(0, 4).join("; "));

  // N5: 행위자는 모든 대상 자리를 누를 수 있다
  if (role !== "citizen") {
    const buttons = snap.seats.filter((x) => x.isButton);
    const hidden = buttons.filter((x) => !x.reachable).map((x) => x.seat);
    rec(sc, "N5", "모든 대상 자리를 누를 수 있음", buttons.length > 0 && hidden.length === 0, buttons.length === 0 ? "누를 수 있는 자리가 없음" : `가려진 자리 ${hidden.join(",")}`);
  }
}

async function selState(page, seat) {
  return page.evaluate((n) => {
    const el = document.querySelector(`.mf-dt__seat[data-seat="${n}"]`);
    return { sel: !!el?.querySelector(".mf-dt__sel"), pressed: el?.getAttribute("aria-pressed") === "true", total: document.querySelectorAll(".mf-dt__sel").length, pill: (document.querySelector(".mf-pk")?.textContent ?? "").replace(/\s+/g, " ").trim() };
  }, seat);
}

/** 밤 선택 동작(N2·N3). 행위자는 자리를 눌러 선택 링을 보고, 시민은 아무 반응이 없어야 한다. */
async function nightActions(ctx, flowId, role, snap, mySeat) {
  const rec = recorder(ctx);
  const sc = `${flowId}/night`;
  const { page, tracker } = ctx.host;
  const view = () => tracker.last();
  const buttonSeats = snap.seats.filter((x) => x.isButton).map((x) => x.seat).sort((a, b) => a - b);

  if (role === "mafia") {
    // N3: 나·동료 자리는 버튼이 아니고, 눌러도 아무 일이 없다
    const allies = view().me.allies ?? [];
    const blockedSeats = [mySeat, ...allies];
    const n3 = await attempt(async () => {
      if (allies.length < 1) return { ok: false, detail: `동료 ${allies.length}명 (8명판 마피아는 2명)` };
      const asButton = snap.seats.filter((x) => blockedSeats.includes(x.seat) && x.isButton).map((x) => x.seat);
      if (asButton.length > 0) return { ok: false, detail: `자리 ${asButton.join(",")} 이 버튼임` };
      for (const seat of blockedSeats) {
        await clickTopmostPoint(page, seat);
        await sleep(700);
        const st = await selState(page, seat);
        if (st.total !== 0 || view().me.pick != null) return { ok: false, detail: `자리 ${seat} 를 눌렀더니 선택 링 ${st.total}개, me.pick ${view().me.pick}` };
      }
      return true;
    });
    rec(sc, "N3", "마피아 자신·동료 탭 안 됨", n3.ok, n3.detail);
  }

  if (role === "citizen") {
    const n2 = await attempt(async () => {
      if (buttonSeats.length !== 0) return { ok: false, detail: `누를 수 있는 자리 ${buttonSeats.join(",")}` };
      const other = snap.seats.find((x) => x.seat !== mySeat);
      await clickTopmostPoint(page, other.seat);
      await sleep(700);
      const st = await selState(page, other.seat);
      return st.total === 0 && view().me.pick == null ? true : { ok: false, detail: `선택 링 ${st.total}개, me.pick ${view().me.pick}` };
    });
    rec(sc, "N2", "자리를 누르면 선택 링", n2.ok, n2.detail);
    return;
  }

  // 경찰·마피아는 나 아닌 가장 낮은 대상, 의사는 나
  const target = role === "doctor" ? mySeat : (buttonSeats.find((x) => x !== mySeat) ?? -1);
  const n2 = await attempt(async () => {
    if (target < 0 || !buttonSeats.includes(target)) return { ok: false, detail: `대상 자리 ${target} 가 버튼이 아님 (버튼 ${buttonSeats.join(",")})` };
    await tapSeat(page, target);
    await page.waitForFunction((n) => !!document.querySelector(`.mf-dt__seat[data-seat="${n}"] .mf-dt__sel`), target, { timeout: 2000 });
    const st = await selState(page, target);
    await tracker.waitFor((v) => v.me.pick === target, 2000, `me.pick ${target}`);
    const pillOk = role === "mafia" || (st.pill.includes("선택") && !st.pill.includes("선택 안 함"));
    return st.pressed && pillOk ? true : { ok: false, detail: `aria-pressed ${st.pressed}, 알약 "${st.pill}"` };
  });
  rec(sc, "N2", "자리를 누르면 선택 링", n2.ok, n2.detail);
}


// ---- 새 계약 도우미(03.1) ----

const mySeatOf = (tracker) => tracker.last()?.me?.seat ?? -1;
const nickOf = (view, seat) => view?.players.find((p) => p.seat === seat)?.nickname ?? "";
const jobNames = (view) => (view?.day?.roles ?? []).map((r) => ROLE_NAME[r]);
const isDeadView = (view) => view?.players.find((p) => p.seat === view.me.seat)?.alive === false;
const recOne = (rec, scenario, r) => rec(scenario, r.id, r.label, r.ok, r.detail);
const recAll = (rec, scenario, list) => {
  for (const r of list) recOne(rec, scenario, r);
};
/** 렌더 두 프레임만 기다린다(짧은 봇 차례 안에서 찍을 때). */
const frames = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

/** 내 차례: 첫 차례는 방장이다(결정 0027-3). K1·K2, 칩 하나를 눌러 잠김(K2b)을 확인한다. */
async function claimMine(ctx, id, role) {
  const rec = recorder(ctx);
  const { page, tracker } = ctx.host;
  const sc = `${id}/claim-mine`;
  await skipTo(page, tracker, "claim");
  await settle(page);
  const mySeat = mySeatOf(tracker);
  const v = tracker.last();
  if (v.phase !== "claim" || v.day?.turn?.seat !== mySeat) throw new SetupError(`첫 차례가 내 자리가 아님 (단계 ${v.phase}, 차례 ${v.day?.turn?.seat}, 내 자리 ${mySeat})`);
  const { snap } = await dayState(ctx, id, "claim-mine");
  recAll(rec, sc, turnChecks(snap, { myTurn: true, jobs: jobNames(v) }));
  const after = tracker.last();
  if (after.phase !== "claim" || after.day?.turn?.seat !== mySeat) throw new SetupError("내 차례 스냅숏 중에 차례가 넘어감");

  // 누른 직후(React 갱신 직후, 서버 답이 오기 전)의 칩 상태를 문서 수준 리스너가 붙잡아 둔다
  await page.evaluate(() => {
    window.__chipAfter = null;
    document.addEventListener(
      "click",
      () => {
        queueMicrotask(() => {
          window.__chipAfter = [...document.querySelectorAll('[aria-label="주장할 직업"] button')].map((b) => ({ t: (b.textContent || "").trim(), p: b.getAttribute("aria-pressed") === "true", d: b.disabled }));
        });
      },
      { once: true, capture: false },
    );
  });
  const label = role === "citizen" ? ROLE_NAME.citizen : jobNames(v)[0];
  const k2b = await attempt(async () => {
    await pickChip(page, tracker, label);
    const chips = await page.evaluate(() => window.__chipAfter);
    if (!chips || chips.length === 0) return { ok: false, detail: "눌린 직후 칩 상태를 읽지 못함" };
    const pressed = chips.filter((c) => c.p).map((c) => c.t);
    const enabled = chips.filter((c) => !c.d).map((c) => c.t);
    return pressed.length === 1 && pressed[0] === label && enabled.length === 0 ? true : { ok: false, detail: `눌린 칩 [${pressed.join(",")}] (기대 ${label}), 켜진 칩 [${enabled.join(",")}]` };
  });
  rec(sc, "K2b", "칩 잠금", k2b.ok, k2b.detail);
}

/** 남의 차례: 봇 차례(0.5~3.5초)가 끝나기 전에 찍는다. 찍는 동안 차례가 넘어갔으면 그 결과를 버리고 다음 남의 차례에서 다시 찍는다. */
async function claimOther(ctx, id) {
  const rec = recorder(ctx);
  const { page, tracker } = ctx.host;
  const mySeat = mySeatOf(tracker);
  const sc = `${id}/claim-other`;
  for (let tries = 0; tries < 3; tries++) {
    const v = await tracker.waitFor((n) => n.phase === "claim" && n.day?.turn !== undefined && n.day.turn.seat !== mySeat, 15_000, "남의 차례");
    const seat = v.day.turn.seat;
    const ends = v.phaseEndsAt;
    const mark = ctx.results.length;
    const dmark = (ctx.dayStates ??= []).length;
    await frames(page);
    const { snap } = await dayState(ctx, id, "claim-other");
    recAll(rec, sc, turnChecks(snap, { myTurn: false }));
    const now = tracker.last();
    if (now.phase === "claim" && now.day?.turn?.seat === seat && now.phaseEndsAt === ends) return;
    ctx.results.length = mark;
    ctx.dayStates.length = dmark;
  }
  throw new SetupError("남의 차례 스냅숏이 매번 차례 전환과 겹침");
}

/** 한 바퀴가 끝난 직후(토론 진입): 채팅 내역 줄(K3), 낮에 캐릭터를 누르면 기록 카드(X1). */
async function claimDone(ctx, id) {
  const rec = recorder(ctx);
  const { page, tracker } = ctx.host;
  const sc = `${id}/claim-done`;
  await skipTo(page, tracker, "discussion");
  await settle(page);
  const v = tracker.last();
  if (v.phase !== "discussion") throw new SetupError(`토론 진입 실패 (지금 ${v.phase})`);
  const alive = v.players.filter((p) => p.alive !== false).length;
  await openChatHistory(page);
  const snap = await collectSnapshot(page);
  // 청크 순서: 주장이 먼저 올라오고 토론 말이 그 뒤에 온다 — 앞의 alive 줄만 본다(토론 중 봇의 줄은 K3 의 대상이 아니다)
  recOne(rec, sc, claimChatIssues(snap.chatHistory.slice(0, alive), { alive }));
  await closeSheet(page, "채팅 내역");

  const mySeat = mySeatOf(tracker);
  const bot = v.players.find((p) => p.seat !== mySeat && p.alive !== false);
  await inspectSeat(page, bot.seat);
  const s2 = await collectSnapshot(page);
  recOne(rec, sc, inspectChecks(s2, { nick: bot.nickname, night: false }));
  await closeSheet(page, `${bot.nickname} 기록`);
}

/** 아침 직후 역할 카드 버튼(R1)과 밤 끝 알림이 없음(R6, 모든 역할). */
function morningRoleChecks(ctx, id, role, snap) {
  const rec = recorder(ctx);
  const sc = `${id}/morning`;
  recOne(rec, sc, roleCardButtonChecks(snap, { unread: role !== "citizen" }));
  recOne(rec, sc, noNightNoticeChecks(snap));
}

/** 경찰·의사: 버튼으로 열어 R2 → 활동 기록 탭 R3 → 시트 G → 닫고 R4. */
async function roleCardViaButton(ctx, id, role) {
  const rec = recorder(ctx);
  const { page } = ctx.host;
  const sc = `${id}/rolecard`;
  await openRoleCard(page);
  recOne(rec, sc, roleCardTabChecks(await collectSnapshot(page), { job: role, unread: true }));
  await selectRoleCardTab(page, "활동 기록");
  const snap = await checkState(ctx, id, "rolecard");
  recOne(rec, sc, journalChecks(snap, { job: role, mode: "viewing" }));
  recOne(rec, sc, livingRoleArtChecks(snap, { myJob: role }));
  await closeRoleCard(page);
  await frames(page);
  const closed = await collectSnapshot(page);
  recOne(rec, sc, journalChecks(closed, { job: role, mode: "closed" }));
  const b = roleCardButtonChecks(closed, { unread: false });
  rec(sc, "R4", "시트를 닫으면 버튼 점 소멸", b.ok, b.detail);
}

/** 시민: 버튼에 점이 없고, 열면 탭 없이 본문(R5). */
async function roleCardCitizen(ctx, id) {
  const rec = recorder(ctx);
  const { page } = ctx.host;
  const sc = `${id}/rolecard`;
  await openRoleCard(page);
  const snap = await checkState(ctx, id, "rolecard");
  recOne(rec, sc, roleCardTabChecks(snap, { job: "citizen", unread: false }));
  recOne(rec, sc, livingRoleArtChecks(snap, { myJob: "citizen" }));
  await closeRoleCard(page);
}

async function gameFlow(ctx, { id, players, role, states }) {
  const rec = recorder(ctx);
  const host = await startHost(ctx, id);
  const { page, tracker } = host;
  await settle(page);

  // 방 설정: 시트 열기 → 봇 → 직업 → 확인 → 시작
  await openTestSheet(page);
  await setBots(page, tracker, players - 1);
  await chooseRole(page, tracker, role);
  await startGame(page, tracker);
  ctx.stage = "play";
  const v0 = tracker.last();
  const s3Ok = v0.players.length === players && v0.me.role === role;
  rec(`${id}/setup`, "S3", "인원·지정 직업", s3Ok, `인원 ${v0.players.length}/${players}, 직업 ${v0.me.role}/${role}`);

  for (const state of states) {
    if (state === "claim-mine") await claimMine(ctx, id, role);
    else if (state === "claim-other") await claimOther(ctx, id);
    else if (state === "claim-done") await claimDone(ctx, id);
    else if (state === "discussion") {
      await skipTo(page, tracker, "discussion");
      await settle(page);
      const { snap } = await dayState(ctx, id, "discussion");
      recAll(rec, `${id}/discussion`, turnChecks(snap, { expectNone: true }));
      if (id === "police5") {
        const bad = snap.buttonTexts.filter((t) => /연장|넘기기/.test(t));
        rec(`${id}/discussion`, "C3", "연장·넘기기 버튼 없음", bad.length === 0, `버튼 ${bad.join(", ")}`);
      }
    } else if (state === "chat") {
      const c1 = await attempt(async () => {
        await openChatHistory(page);
        const title = await page.locator('dialog[aria-label="채팅 내역"] h2').first().textContent();
        return title?.trim() === "채팅 내역" ? true : { ok: false, detail: `제목 "${title?.trim()}"` };
      });
      rec(`${id}/chat`, "C1", "채팅 내역 모달 열림", c1.ok, c1.detail);
      await checkState(ctx, id, "chat");
      const c2 = await attempt(async () => {
        await closeSheet(page, "채팅 내역");
        return (await page.locator('dialog[aria-label="채팅 내역"]').count()) === 0;
      });
      rec(`${id}/chat`, "C2", "채팅 내역 모달 닫힘", c2.ok, c2.detail);
    } else if (state === "night") {
      await skipTo(page, tracker, "night");
      // N6: 밤에 막 들어선 직후(settle 전)에는 '밤이 되었습니다' 문구가 떠 있다. 아래 밤 검사는 문구가 아직 떠 있을 수 있는 시점에도 그대로 돌려
      // 문구가 터치·검사를 방해하지 않는 것을 함께 증명한다(pointer-events none).
      recOne(rec, `${id}/night`, nightIntroChecks(await readNightIntro(page)));
      await settle(page);
      const { snap, mySeat } = await dayState(ctx, id, "night");
      recAll(rec, `${id}/night`, turnChecks(snap, { expectNone: true }));
      nightStaticChecks(ctx, id, role, snap);
      await nightActions(ctx, id, role, snap, mySeat);
      // X1(밤): 어떤 자리를 눌러도 기록 카드가 열리지 않는다(행위자는 선택만 됨)
      recOne(rec, `${id}/night`, inspectChecks(await collectSnapshot(page), { night: true }));
      // N7: 문구는 2초 뒤 사라진다(여유를 두어 3.5초 안에 DOM 에서 없어지면 통과)
      const n7 = await attempt(async () => {
        await page.waitForSelector(".mf-nightintro", { state: "detached", timeout: 3500 });
        return true;
      });
      rec(`${id}/night`, "N7", "밤 시작 문구가 사라짐", n7.ok, n7.detail);
    } else if (state === "morning") {
      // 아침은 5초라 넘긴 직후 바로 닫고 찍는다. 앞뒤 단계가 morning 이 아니면 준비 실패(재시도).
      await skipTo(page, tracker, "morning");
      await settle(page);
      if (tracker.last()?.phase !== "morning") throw new SetupError("아침 스냅숏 전에 아침이 끝남");
      const { snap, mySeat } = await dayState(ctx, id, "morning");
      const v = tracker.last();
      if (v?.phase !== "morning") throw new SetupError("아침 스냅숏 중에 아침이 끝남");
      if (isDeadView(v)) throw new SetupError("방장이 첫 밤에 탈락해 살아 있는 사람 흐름이 아님");
      recAll(rec, `${id}/morning`, turnChecks(snap, { expectNone: true }));
      const m1 = morningCardIssues(snap, { w: ctx.size.w, mySeat });
      rec(`${id}/morning`, "M1", m1.label, m1.ok, m1.detail);
      const t = snap.panel?.text ?? "";
      rec(`${id}/morning`, "M2", "하단 '곧 낮 토론이 시작돼요'", t.includes("아침이 밝았습니다") && t.includes("곧 낮 토론이 시작돼요"), `패널 글자 "${t.slice(0, 60)}"`);
      const elim = v.day?.morning?.eliminated;
      recOne(rec, `${id}/morning`, dimChecks(snap, { w: ctx.size.w, expectSpotlit: elim !== undefined && elim !== null }));
      morningRoleChecks(ctx, id, role, snap);
    } else if (state === "rolecard-btn") await roleCardViaButton(ctx, id, role);
    else if (state === "rolecard-citizen") await roleCardCitizen(ctx, id);
    else if (state === "next-day") {
      // 아침이 끝난 뒤 첫 낮 장면: 카드·어둡게 층이 없고(M4) 고정물 검사가 그대로 통과한다
      await tracker.waitFor((n) => n.phase === "claim" && (n.day?.n ?? 0) >= 2, 25_000, "다음 낮 직업 공개");
      await settle(page);
      const { snap } = await dayState(ctx, id, "next-day");
      recOne(rec, `${id}/next-day`, morningGoneChecks(snap));
    }
  }

  // 흐름 끝: 낮 장면 상태 전부의 D7(테이블 그대로)·D9(모든 인원 이름표), 살아 있는 사람 V2·V3
  const days = ctx.dayStates ?? [];
  if (days.length >= 2) {
    const f = feltStable(days.map((d) => ({ state: d.state, rect: d.felt })));
    rec(`${id}/table`, "D7", f.label, f.ok, f.detail);
  }
  const bad = days.map((d) => ({ d, r: tagsOverlap(d.tags) })).filter((x) => !x.r.ok);
  rec(`${id}/table`, "D9", "이름표끼리 안 겹침", bad.length === 0, bad.map((x) => `${x.d.state}: ${x.r.detail}`).join("; "));
  const t1 = stageStable(days.map((d) => ({ state: d.state, stage: d.stage, mySeat: d.mySeat })));
  rec(`${id}/table`, t1.id, t1.label, t1.ok, t1.detail);
  const fin = await collectSnapshot(page);
  recOne(rec, `${id}/table`, livingRoleArtChecks(fin, { myJob: role }));
  rec(`${id}/table`, "V3", "살아 있는 사람 view 에 spectate 없음", tracker.last()?.spectate === undefined, "spectate 키가 있음");
  rec(`${id}/setup`, "S4", "단계 도달", true);
  await resetAndLeave(page, tracker);
}

// ---- 관전자 흐름(탈락한 방장) ----

/** 4명판(방장 시민 + 봇 3)에서 방장이 탈락할 때까지 밤을 넘기고, 관전자 화면(V1·M1·M3·X1)을 본다. */
async function specFlow(ctx) {
  const id = "spec4";
  const rec = recorder(ctx);
  const host = await startHost(ctx, id);
  const { page, tracker } = host;
  await settle(page);
  await openTestSheet(page);
  await setBots(page, tracker, 3);
  await chooseRole(page, tracker, "citizen");
  await startGame(page, tracker);
  ctx.stage = "play";
  const v0 = tracker.last();
  const mySeat = v0.me.seat;
  rec(`${id}/setup`, "S3", "인원·지정 직업", v0.players.length === 4 && v0.me.role === "citizen", `인원 ${v0.players.length}/4, 직업 ${v0.me.role}/citizen`);

  let dead = false;
  for (let day = 1; day <= 4 && !dead; day++) {
    await skipTo(page, tracker, "claim");
    await skipTo(page, tracker, "discussion");
    await skipTo(page, tracker, "night");
    await sleep(7000); // 봇 밤 지목(1~6초)이 끝나도록
    await skipTo(page, tracker, "morning");
    await settle(page);
    if (tracker.last()?.phase !== "morning") throw new SetupError("아침 스냅숏 전에 아침이 끝남");
    dead = isDeadView(tracker.last());
    if (!dead) continue;

    const sc = `${id}/morning`;
    const { snap } = await dayState(ctx, id, "morning");
    const v = tracker.last();
    if (v?.phase !== "morning") throw new SetupError("아침 스냅숏 중에 아침이 끝남");
    rec(sc, "V1", "관전자 view 에 spectate 있음", !!v.spectate, "spectate 키가 없음");
    const spectate = (v.spectate?.seats ?? []).map((s) => ({ seat: s.seat, job: s.job, alive: v.players.find((p) => p.seat === s.seat)?.alive !== false }));
    recOne(rec, sc, spectatorChecks(snap, { spectate, mySeat }));
    const m1 = morningCardIssues(snap, { w: ctx.size.w, mySeat });
    rec(sc, "M1", m1.label, m1.ok, m1.detail);
    recOne(rec, sc, dimChecks(snap, { w: ctx.size.w, expectSpotlit: true }));
    const mine = snap.seats.find((s) => s.seat === mySeat);
    rec(sc, "M3", "탈락한 방장 자리가 강조됨", !!mine?.spotlit, `내 자리 spotlit ${mine?.spotlit}`);
  }
  if (!dead) throw new SetupError("4일 안에 방장이 탈락하지 않음");

  const specOf = (v) => (v.spectate?.seats ?? []).map((s) => ({ seat: s.seat, job: s.job, alive: v.players.find((p) => p.seat === s.seat)?.alive !== false }));
  const aliveBot = () => tracker.last().players.find((p) => p.seat !== mySeat && p.alive !== false);

  // 낮: 관전자 테이블 + 캐릭터를 누르면 기록 카드
  await skipTo(page, tracker, "discussion");
  await settle(page);
  {
    const sc = `${id}/discussion`;
    const { snap } = await dayState(ctx, id, "discussion");
    recOne(rec, sc, spectatorChecks(snap, { spectate: specOf(tracker.last()), mySeat }));
    const bot = aliveBot();
    await inspectSeat(page, bot.seat);
    recOne(rec, sc, inspectChecks(await collectSnapshot(page), { nick: bot.nickname, night: false }));
    await closeSheet(page, `${bot.nickname} 기록`);
  }

  // 밤: 관전자는 어떤 자리도 버튼이 아니고 눌러도 아무 카드가 안 열린다
  await skipTo(page, tracker, "night");
  await settle(page);
  {
    const sc = `${id}/night`;
    const { snap } = await dayState(ctx, id, "night");
    recOne(rec, sc, spectatorChecks(snap, { spectate: specOf(tracker.last()), mySeat }));
    const buttons = snap.seats.filter((s) => s.isButton).map((s) => s.seat);
    rec(sc, "V1", "관전자 밤에는 어떤 자리도 버튼이 아님", buttons.length === 0, `버튼 자리 ${buttons.join(",")}`);
    await inspectSeat(page, aliveBot().seat);
    recOne(rec, sc, inspectChecks(await collectSnapshot(page), { night: true }));
  }

  const days = ctx.dayStates ?? [];
  if (days.length >= 2) {
    const f = feltStable(days.map((d) => ({ state: d.state, rect: d.felt })));
    rec(`${id}/table`, "D7", f.label, f.ok, f.detail);
  }
  const bad = days.map((d) => ({ d, r: tagsOverlap(d.tags) })).filter((x) => !x.r.ok);
  rec(`${id}/table`, "D9", "이름표끼리 안 겹침", bad.length === 0, bad.map((x) => `${x.d.state}: ${x.r.detail}`).join("; "));
  const t1 = stageStable(days.map((d) => ({ state: d.state, stage: d.stage, mySeat: d.mySeat })));
  rec(`${id}/table`, t1.id, t1.label, t1.ok, t1.detail);
  rec(`${id}/setup`, "S4", "단계 도달", true);
  await resetAndLeave(page, tracker);
}

const game = (id, players, role, states) => (ctx) => gameFlow(ctx, { id, players, role, states });
const CLAIMS = ["claim-mine", "claim-other", "claim-done", "discussion"];

export const FLOWS = [
  { id: "lobby", run: lobbyFlow },
  { id: "police5", run: game("police5", 5, "police", [...CLAIMS, "chat", "night", "morning", "rolecard-btn", "next-day"]) },
  { id: "citizen4", run: game("citizen4", 4, "citizen", [...CLAIMS, "night", "morning", "rolecard-citizen", "next-day"]) },
  { id: "mafia8", run: game("mafia8", 8, "mafia", [...CLAIMS, "night", "morning", "rolecard-btn", "next-day"]) },
  { id: "doctor5", run: game("doctor5", 5, "doctor", [...CLAIMS, "night", "morning", "rolecard-btn", "next-day"]) },
  { id: "spec4", run: specFlow },
];
export { SetupError };

// 화면 E2E 흐름(결정 0025): 흐름마다 새 테스트 방 하나와 방장 페이지 하나. 검사 ID 는 계획 261025-h1j 의 "검사 목록" 과 같다.
// 결과는 { scenario: "흐름/상태", size, id, label, ok, detail } 로 ctx.results 에 쌓인다.
import { join } from "node:path";
import { mkdirSync } from "node:fs";
import {
  SetupError,
  chooseRole,
  clickInDialog,
  clickTopmostPoint,
  closeSheet,
  collectSnapshot,
  createTestRoom,
  leaveLobby,
  openHostPage,
  openTestSheet,
  resetAndLeave,
  setBots,
  settle,
  shot,
  skipTo,
  startGame,
  tapSeat,
} from "./browser.mjs";
import { dayChecks, feltStable, genericIssues, lineCount, morningCardIssues, rectInside, rectsOverlap, tagsOverlap } from "./lib.mjs";

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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 낮 장면 상태(claim·discussion·night·morning) 한 장: 스냅숏 + G + D1~D6·D8. 테이블 면·이름표는 흐름 끝의 D7·D9 용으로 모아 둔다. */
async function dayState(ctx, flowId, state) {
  const rec = recorder(ctx);
  const snap = await checkState(ctx, flowId, state);
  const mySeat = ctx.host.tracker.last()?.me?.seat ?? -1;
  for (const r of dayChecks(snap, { w: ctx.size.w, h: ctx.size.h })) rec(`${flowId}/${state}`, r.id, r.label, r.ok, r.detail);
  (ctx.dayStates ??= []).push({ state, felt: snap.felt, tags: snap.tags });
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
    if (state === "claim") {
      await skipTo(page, tracker, "claim");
      await settle(page);
      await dayState(ctx, id, "claim");
    } else if (state === "discussion") {
      await skipTo(page, tracker, "discussion");
      await settle(page);
      const { snap } = await dayState(ctx, id, "discussion");
      if (id === "police5") {
        const bad = snap.buttonTexts.filter((t) => /연장|넘기기/.test(t));
        rec(`${id}/discussion`, "C3", "연장·넘기기 버튼 없음", bad.length === 0, `버튼 ${bad.join(", ")}`);
      }
    } else if (state === "chat") {
      const c1 = await attempt(async () => {
        await page.locator('[aria-label="채팅 내역 크게 보기"]').click();
        await page.locator('dialog[aria-label="채팅 내역"].mf-dialog--open').waitFor({ state: "attached", timeout: 3000 });
        await page.waitForTimeout(300);
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
      await settle(page);
      const { snap, mySeat } = await dayState(ctx, id, "night");
      nightStaticChecks(ctx, id, role, snap);
      await nightActions(ctx, id, role, snap, mySeat);
    } else if (state === "morning") {
      // 아침은 5초라 넘긴 직후 바로 닫고 찍는다. 앞뒤 단계가 morning 이 아니면 준비 실패(재시도).
      await skipTo(page, tracker, "morning");
      await settle(page);
      if (tracker.last()?.phase !== "morning") throw new SetupError("아침 스냅숏 전에 아침이 끝남");
      const { snap, mySeat } = await dayState(ctx, id, "morning");
      if (tracker.last()?.phase !== "morning") throw new SetupError("아침 스냅숏 중에 아침이 끝남");
      const m1 = morningCardIssues(snap, { w: ctx.size.w, mySeat });
      rec(`${id}/morning`, "M1", m1.label, m1.ok, m1.detail);
      const t = snap.panel?.text ?? "";
      rec(`${id}/morning`, "M2", "하단 '곧 낮 토론이 시작돼요'", t.includes("아침이 밝았습니다") && t.includes("곧 낮 토론이 시작돼요"), `패널 글자 "${t.slice(0, 60)}"`);
      if (role === "police") {
        const r = snap.records;
        rec(`${id}/morning`, "R1", "[수사 기록] 점", !!r && r.label === "수사 기록, 새 기록" && r.dot, r ? `aria-label "${r.label}", 점 ${r.dot}` : "수사 기록 버튼 없음");
      }
    } else if (state === "records") {
      const r2 = await attempt(async () => {
        await page.locator("button.mf-records-btn").click();
        await page.locator('dialog[aria-label="수사 기록"].mf-dialog--open').waitFor({ state: "attached", timeout: 3000 });
        await page.waitForFunction(() => document.querySelectorAll(".mf-records__row").length >= 1, null, { timeout: 3000 });
        await page.waitForTimeout(300);
        const row = await page.evaluate(() => {
          const r = document.querySelector(".mf-records__row");
          return { d: r?.querySelector(".mf-records__d")?.textContent?.trim(), rz: r?.querySelector(".mf-records__rz")?.textContent?.trim(), nw: !!r?.querySelector(".mf-records__new") };
        });
        const ok = row.d === "1일차 밤" && (row.rz === "마피아" || row.rz === "마피아 아님") && row.nw;
        return ok ? true : { ok: false, detail: `첫 줄 ${JSON.stringify(row)}` };
      });
      rec(`${id}/records`, "R2", "시트에 기록 줄", r2.ok, r2.detail);
      await checkState(ctx, id, "records");
      const r3 = await attempt(async () => {
        await closeSheet(page, "수사 기록");
        const b = await page.evaluate(() => {
          const btn = document.querySelector("button.mf-records-btn");
          return { label: btn?.getAttribute("aria-label"), dot: !!btn?.querySelector(".mf-records-btn__dot") };
        });
        return b.label === "수사 기록" && !b.dot ? true : { ok: false, detail: `aria-label "${b.label}", 점 ${b.dot}` };
      });
      rec(`${id}/records`, "R3", "시트 닫힘·점 꺼짐", r3.ok, r3.detail);
    }
  }

  // 흐름 끝: D7(테이블 그대로)·D9(4명 이름표)
  const days = ctx.dayStates ?? [];
  if (days.length >= 2) {
    const f = feltStable(days.map((d) => ({ state: d.state, rect: d.felt })));
    rec(`${id}/table`, "D7", f.label, f.ok, f.detail);
  }
  if (id === "citizen4") {
    const bad = days.map((d) => ({ d, r: tagsOverlap(d.tags) })).filter((x) => !x.r.ok);
    rec(`${id}/table`, "D9", "4명 이름표 안 겹침", bad.length === 0, bad.map((x) => `${x.d.state}: ${x.r.detail}`).join("; "));
  }
  rec(`${id}/setup`, "S4", "단계 도달", true);
  await resetAndLeave(page, tracker);
}

const game = (id, players, role, states) => (ctx) => gameFlow(ctx, { id, players, role, states });

export const FLOWS = [
  { id: "lobby", run: lobbyFlow },
  { id: "police5", run: game("police5", 5, "police", ["claim", "discussion", "chat", "night", "morning", "records"]) },
  { id: "citizen4", run: game("citizen4", 4, "citizen", ["claim", "discussion", "night", "morning"]) },
  { id: "mafia8", run: game("mafia8", 8, "mafia", ["claim", "discussion", "night", "morning"]) },
  { id: "doctor5", run: game("doctor5", 5, "doctor", ["claim", "discussion", "night", "morning"]) },
];
export { SetupError };

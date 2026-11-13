// 20페이즈 마을 맵 E2E 흐름 (20-08, 결정 D-10·D-11·D-14·D-15·D-19·D-21·D-22, UI-SPEC TM1~TM10):
//  town-walk(폰 6종: 방장 + 봇, 낮 토론에서 우체국 문 앞까지 걷기·내 이름표 스테이지 안 = TM9)
//  town-room(390x844: 대기실 bar·시작 뒤 town = TM1, 방 넷을 차례로 지붕 두 번 누르기로 들어갔다 나오기 = TM2·TM3·TM6, 집 주인 = TM7)
//  town-sight(390x844, 방장 + 참가자 두 페이지: 밖 탭 시야·문 연출 = TM4·TM5)
//  town-ghost(390x844: 탈락시켜 유령 화면 → 결과 화면에서 네 방이 모두 열림 = TM8)
//  town-reduced(390x844, 모션 줄이기: 방에 들어가면 같은 틱에 roofs 0·door 연출 없음 = TM10)
// 이름 앞머리 town — `--only town` 이 다섯을 모두 고르고 기존 흐름 이름과 겹치지 않는다.
// 판정 문턱은 여기서 낮추지 않는다(lib.mjs townChecks 한 곳, T-20-28). 흐름은 화면이 이미 계산한 값(__mfTown·__mfWorld·태그 data-door)만 읽고 판정은 순수 함수에 넘긴다.
// 결과 줄에는 닉네임·토큰을 남기지 않는다 — 좌석·방 id·숫자만 쓴다(T-20-26).
// 방에 들어가는 길: 닫힌 방 지붕(높이 2.36)의 화면 점을 눌러 링이 문 앞 칸에 뜨는 것을 보고(TM6), 도착(문 앞 0.3 안)하면 같은 지붕을 한 번 더 눌러 방 안으로 든다(결정 D-19, 20-06).
// 지붕 점의 화면 좌표: __mfWorld.screenOf 는 y=0 만 안다 — 높이 y 의 점은 바닥 점 screenOf(x − 12.0208153·k, z − 12.0208153·k)(k = y / 11.9)로 구한다.
// helpers 는 flows.mjs 가 넘긴다(errand.mjs·modes.mjs 와 같은 모양 — 서로 import 하지 않는다): { recorder, attempt, openGame, closeGame, executeHost, untilGame, settledResult }
import { SetupError, setBotVote, settle, skipOnce, sleep, waitWorldReady } from "./browser.mjs";
import { TOWN_E2E, townChecks } from "./lib.mjs";

const ROOMS = Object.keys(TOWN_E2E.ROOMS);
/** 지붕 판 윗면 높이(UI-SPEC P20-1) */
const ROOF_Y = 2.36;
/** 카메라 시선 방향의 바닥 투영(20-06 이 확인한 값): 높이 1 당 바닥 점이 (−12.0208153/11.9) 만큼 x·z 로 밀린다 */
const SHIFT_PER_Y = 12.0208153 / 11.9;
/** 눌러 볼 화면 점이 스테이지 가장자리에서 떨어져야 하는 거리(px) */
const TAP_PAD = 24;
/** 방 하나에 들어가는 시간 한도(ms) — 두 번 누르기·걷기 포함 */
const ENTER_LIMIT_MS = 12_000;
/** 방에서 나오는 시간 한도(ms) */
const LEAVE_LIMIT_MS = 8_000;
/** 문 앞까지 걷는 시간 한도(ms) — TM9 */
const WALK_LIMIT_MS = 10_000;
/** 방에 든 뒤 컷어웨이를 읽는 시각(ms): 0.25초 연출 + 여유 */
const ROOF_READ_MS = 300;
/** 목적지 링·도착 판정의 허용 오차(월드 단위) */
const NEAR = 0.3;
/** 낮 토론의 걷기 시작 자리에서 우체국 문 앞까지 나가는 목표 */
const WALK_ROOM = "post";

const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const near = (a, b, tol = NEAR) => !!a && !!b && dist(a, b) <= tol;
const lines = (rec, sc, ls, { tag = "", who = "" } = {}) => {
  for (const l of ls) rec(sc, `${l.id}${tag}`, `${who}${l.label}`, l.ok, l.detail, l.info === true);
};

/** 마을 훅·좌석·링을 한 번에 읽는다(없으면 null 들) */
const readTown = (page) =>
  page.evaluate(() => ({
    map: window.__mfMap ?? null,
    town: window.__mfTown ? JSON.parse(JSON.stringify(window.__mfTown)) : null,
    seats: window.__mfWorld?.seats?.() ?? [],
    ring: window.__mfWorld?.ring?.() ?? null,
  }));

/** 내 몸이 마지막 프레임에 그려진 자리(월드 단위) */
const shownOf = (page, seat) => page.evaluate((s) => window.__mfWorld?.shown?.(s) ?? null, seat);

/** 화면 점 하나를 누른다(눌렀다 바로 뗌) */
async function tapScreen(page, sx, sy) {
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  await page.mouse.up();
}

/** 조건이 참이 될 때까지 본다. 참이 된 시각(ms)을 돌려주고 시간 안에 안 되면 null */
async function until(fn, ms, step = 40) {
  const t0 = Date.now();
  for (;;) {
    if (await fn().catch(() => false)) return Date.now() - t0;
    if (Date.now() - t0 > ms) return null;
    await sleep(step);
  }
}

/**
 * 눌러 볼 수 있는 화면 점을 고른다: 스테이지 안(가장자리에서 TAP_PAD)이고 그 점의 맨 위 요소가 맵 입력 면(.mf-world__input)인 것.
 * pts 는 월드 바닥 점 [{ x, z }](지붕 점이면 이미 시선 방향으로 민 바닥 점)이고 앞쪽일수록 먼저 쓴다. 돌려주는 값: [{ x, z, sx, sy }] (보이는 것만, 입력 순서 유지)
 */
function visiblePoints(page, pts) {
  return page.evaluate(
    ({ pts: list, pad }) => {
      const w = window.__mfWorld;
      const header = document.querySelector(".mf-game__header");
      const panel = document.querySelector("[data-world-panel]");
      if (!w || !header || !panel) return [];
      const top = header.getBoundingClientRect().bottom + pad;
      const bottom = panel.getBoundingClientRect().top - pad;
      const out = [];
      for (const p of list) {
        const s = w.screenOf(p.gx, p.gz);
        if (!s || !Number.isFinite(s.sx) || !Number.isFinite(s.sy)) continue;
        if (s.sx < pad || s.sx > window.innerWidth - pad || s.sy < top || s.sy > bottom) continue;
        const el = document.elementFromPoint(s.sx, s.sy);
        if (!el || !el.classList.contains("mf-world__input")) continue;
        out.push({ x: p.x, z: p.z, sx: s.sx, sy: s.sy });
      }
      return out;
    },
    { pts: pts.map((p) => ({ ...p, gx: p.gx ?? p.x, gz: p.gz ?? p.z })), pad: TAP_PAD },
  );
}

/** 닫힌 방 지붕 위 점들(가운데에 가까운 순). 높이 ROOF_Y 의 점을 바닥 점으로 민다 */
function roofPoints(room) {
  const o = TOWN_E2E.ROOMS[room].outer;
  const cx = (o.x0 + o.x1) / 2;
  const cz = (o.z0 + o.z1) / 2;
  const shift = ROOF_Y * SHIFT_PER_Y;
  const pts = [];
  for (let x = o.x0 + 0.4; x <= o.x1 - 0.4 + 1e-9; x += 0.4) {
    for (let z = o.z0 + 0.4; z <= o.z1 - 0.4 + 1e-9; z += 0.4) pts.push({ x, z, gx: x - shift, gz: z - shift });
  }
  return pts.sort((a, b) => Math.hypot(a.x - cx, a.z - cz) - Math.hypot(b.x - cx, b.z - cz));
}

/** 광장 바닥에서 걸어갈 만한 점들(−6~6, 간격 1)과 목표 자신. 목표에 가까운 순 */
function groundPoints(target) {
  const pts = [{ x: target.x, z: target.z }];
  for (let x = -6; x <= 6; x += 1) for (let z = -6; z <= 6; z += 1) if (Math.hypot(x, z) > 1.6) pts.push({ x, z });
  return pts.sort((a, b) => dist(a, target) - dist(b, target));
}

/**
 * 내 몸이 target 의 tol 안에 닿거나(true), 0.35초 동안 거의 안 움직여 멈추거나(false) 시간이 다 될 때까지(null) 기다린다.
 * 멈춘 자리가 목표에서 멀면 호출한 쪽이 다시 고른다 — 중간 점으로 걸어가는 동안 목표만 기다리며 시간을 쓰지 않으려는 것이다.
 */
async function waitArrivalOrStill(page, seat, target, tol, ms) {
  const t0 = Date.now();
  let last = null;
  let stableSince = Date.now();
  for (;;) {
    const now = await shownOf(page, seat);
    if (now && near(now, target, tol)) return true;
    if (now && last && dist(now, last) > 0.02) stableSince = Date.now();
    last = now;
    if (Date.now() - stableSince >= 350 && Date.now() - t0 > 400) return false;
    if (Date.now() - t0 > ms) return null;
    await sleep(60);
  }
}

/**
 * 걸어서 target(tol 안)에 닿는다. 보이는 바닥 점 중 목표에 가장 가까운 점을 누르고, 닿거나 멈추면 다시 고른다(카메라가 따라 움직여 목표가 보이게 된다).
 * 닿은 시각(ms)을 돌려주고 한도 안에 못 닿으면 null. 같은 자리에서 세 번 멈추면(막힌 목표) 포기한다.
 */
async function walkTo(page, seat, target, ms, tol = NEAR) {
  const t0 = Date.now();
  let stalls = 0;
  let lastStop = null;
  while (Date.now() - t0 < ms) {
    const me = await shownOf(page, seat);
    if (me && near(me, target, tol)) return Date.now() - t0;
    const vis = await visiblePoints(page, groundPoints(target));
    if (vis.length === 0) {
      await sleep(200);
      continue;
    }
    const best = vis.reduce((a, b) => (dist(b, target) < dist(a, target) ? b : a));
    await tapScreen(page, best.sx, best.sy);
    const r = await waitArrivalOrStill(page, seat, target, tol, Math.min(7000, ms - (Date.now() - t0)));
    if (r === true) return Date.now() - t0;
    const stop = await shownOf(page, seat);
    if (r === false && stop && lastStop && dist(stop, lastStop) < 0.05) {
      stalls += 1;
      if (stalls >= 3) return null;
    }
    lastStop = stop;
  }
  return null;
}

/** 문에서 광장 가운데 쪽으로 나가는 방향(단위 벡터). 방 id 의 문 있는 면에서 정한다 */
function outwardOf(room) {
  const door = TOWN_E2E.ROOMS[room].outer.door;
  return door === "s" ? { x: 0, z: 1 } : door === "n" ? { x: 0, z: -1 } : door === "w" ? { x: -1, z: 0 } : { x: 1, z: 0 };
}

/** 지붕을 보려고 먼저 서는 자리: 문 앞에서 광장 쪽으로 2.5 나간 점(문 앞 1.0 보다 멀어 첫 누름이 문 앞 링이 된다) */
function stagingOf(room) {
  const f = TOWN_E2E.ROOMS[room].front;
  const d = outwardOf(room);
  return { x: f.x + d.x * 2.5, z: f.z + d.z * 2.5 };
}

const debug = (...a) => process.env.TOWN_DEBUG === "1" && console.error("[town]", ...a);

/**
 * 닫힌 방 지붕을 눌러 방 안으로 든다(두 번 누르기). 돌려주는 값: { ms, first }
 * first = 첫 누름의 결과 { ring, zone, farFirst } — 누를 때 내 자리가 문 앞에서 1.0 보다 멀었는가(멀 때만 링이 문 앞 칸이어야 한다, TM6).
 * 지붕이 화면에 안 보이면 문 앞에서 광장 쪽으로 2.5 나간 자리(staging)까지 먼저 걷고, 그래도 안 보이면 문 앞까지 걷는다. 한도 안에 못 들어가면 SetupError(환경 지연은 실행기가 새 방에서 다시 돈다).
 */
async function enterRoom(page, seat, room, { limitMs = ENTER_LIMIT_MS } = {}) {
  const def = TOWN_E2E.ROOMS[room];
  const t0 = Date.now();
  const left = () => limitMs - (Date.now() - t0);
  let first = null;
  let retry = 0;
  let stagedOnce = false;
  while (left() > 0) {
    const s = await readTown(page);
    if (s.town?.zone === room) return { ms: Date.now() - t0, first };
    const cands = await visiblePoints(page, roofPoints(room));
    debug(room, "cands", cands.length, "retry", retry, "staged", stagedOnce, "left", left());
    if (cands.length === 0) {
      if (!stagedOnce) {
        stagedOnce = true;
        await walkTo(page, seat, stagingOf(room), Math.min(8000, left()));
      } else {
        await walkTo(page, seat, def.front, Math.min(6000, left()));
      }
      continue;
    }
    const c = cands[retry % cands.length];
    const me = await shownOf(page, seat);
    const farFirst = !!me && dist(me, def.front) > 1.0;
    await tapScreen(page, c.sx, c.sy);
    await sleep(200);
    const after = await readTown(page);
    debug(room, "tap", Math.round(c.sx), Math.round(c.sy), "ring", JSON.stringify(after.ring), "zone", after.town?.zone, "far", farFirst);
    if (first === null) first = { ring: after.ring, zone: after.town?.zone ?? null, farFirst };
    const atFront = near(after.ring, def.front, 0.1);
    const atInside = near(after.ring, def.inside, 0.1);
    if (!atFront && !atInside) {
      retry += 1; // 시선이 다른 것(시계탑 등)에 막혔다 — 다른 지붕 점을 눌러 본다
      continue;
    }
    if (atInside) {
      const inMs = await until(async () => (await readTown(page)).town?.zone === room, Math.min(8000, left()));
      if (inMs !== null) return { ms: Date.now() - t0, first };
      continue;
    }
    // 링이 문 앞이다 — 도착(문 앞 0.3 안)을 기다린 뒤 같은 지붕을 다시 누른다
    const got = await until(async () => {
      const m = await shownOf(page, seat);
      return !!m && near(m, def.front);
    }, Math.min(9000, left()));
    debug(room, "arrived", got);
    retry = 0;
  }
  throw new SetupError(`방 ${room} 에 ${limitMs / 1000}초 안에 들어가지 못함`);
}

/**
 * 방에서 나온다: 문 앞(front)에서 광장 쪽으로 reach 만큼 나간 바닥을 누른다. zone 이 plaza 가 될 때까지 기다리고 걸린 시간(ms)을 돌려준다.
 * 앞벽이 걷히는 방(우체국·경찰서)은 문 앞 가까이를, 문이 뒷벽인 방(술집·진료소)은 시선이 벽 위로 지나도록 2.5 이상 나간 점을 먼저 본다.
 * 카메라가 방 안 내 몸을 따라가 문 앞 쪽이 화면 밖일 수 있어, 보이는 점 중 링이 그 점으로 뜬 첫 점을 쓴다(벽을 눌러 링이 방 안으로 가면 다음 점).
 */
async function leaveRoom(page, seat, room, { limitMs = LEAVE_LIMIT_MS } = {}) {
  const f = TOWN_E2E.ROOMS[room].front;
  const dir = outwardOf(room);
  const t0 = Date.now();
  const frontWallCut = room === "post" || room === "police";
  const reaches = frontWallCut ? [0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5] : [2.5, 3.0, 3.5, 2.0, 1.5, 4.0];
  while (Date.now() - t0 < limitMs) {
    let tried = false;
    for (const reach of reaches) {
      if (Date.now() - t0 >= limitMs) break;
      const target = { x: f.x + dir.x * reach, z: f.z + dir.z * reach };
      const vis = await visiblePoints(page, [target]);
      if (vis.length === 0) continue;
      tried = true;
      await tapScreen(page, vis[0].sx, vis[0].sy);
      await sleep(150);
      const ring = (await readTown(page)).ring;
      debug(room, "leave", reach, "ring", JSON.stringify(ring));
      if (!near(ring, target, 0.8)) continue; // 벽·방에 눌려 링이 다른 곳이다
      const ms = await until(async () => (await readTown(page)).town?.zone === "plaza", Math.min(5000, limitMs - (Date.now() - t0)));
      if (ms !== null) return Date.now() - t0;
    }
    if (!tried) await sleep(200);
  }
  throw new SetupError(`방 ${room} 에서 ${limitMs / 1000}초 안에 나오지 못함`);
}

/**
 * 문 연출 감시(밖 탭용): 좌석 seat 의 태그에 data-door=vanish 가 처음 붙고 떨어진 시각, seats() 에서 처음 빠진 시각, data-door=appear 가 처음 붙은 시각을 쌓는다(감시 시작 기준 ms).
 * seats() 는 서버 프레임으로 정해지는 저장소 값이라 연출은 좌석이 빠지는 프레임에 시작한다 — 두 시각을 따로 재서 판정(TM5)이 차를 본다. 값은 숫자뿐이다
 */
function armSightWatch(page, seat) {
  return page.evaluate((s) => {
    window.__townSight?.stop?.();
    const w = { t0: performance.now(), vanishAt: null, vanishEndAt: null, goneAt: null, appearAt: null, timer: 0, obs: null };
    const look = () => {
      const now = performance.now() - w.t0;
      const el = document.querySelector(`.mf-world__tag[data-seat="${s}"]`);
      const door = el ? el.getAttribute("data-door") : null;
      if (door === "vanish" && w.vanishAt === null) w.vanishAt = now;
      if (door !== "vanish" && w.vanishAt !== null && w.vanishEndAt === null) w.vanishEndAt = now;
      if (door === "appear" && w.appearAt === null) w.appearAt = now;
      const seats = window.__mfWorld?.seats?.() ?? [];
      if (!seats.includes(s) && w.goneAt === null) w.goneAt = now;
    };
    w.obs = new MutationObserver(look);
    w.obs.observe(document.body, { attributes: true, attributeFilter: ["data-door"], childList: true, subtree: true });
    w.timer = window.setInterval(look, 4);
    w.stop = () => {
      w.obs?.disconnect();
      window.clearInterval(w.timer);
    };
    window.__townSight = w;
    return true;
  }, seat);
}

const readSightWatch = (page) =>
  page.evaluate(() => {
    const w = window.__townSight;
    return w ? { vanishAt: w.vanishAt, vanishEndAt: w.vanishEndAt, goneAt: w.goneAt, appearAt: w.appearAt } : null;
  });

const stopSightWatch = (page) => page.evaluate(() => window.__townSight?.stop?.()).catch(() => {});

/** 좌석 seat 의 이름표가 지금 화면에 보이는가(DOM 에 있고 불투명도 > 0.01 이고 숨김 아님) */
const tagVisible = (page, seat) =>
  page.evaluate((s) => {
    const el = document.querySelector(`.mf-world__tag[data-seat="${s}"]`);
    if (!el) return false;
    const cs = getComputedStyle(el);
    return cs.display !== "none" && cs.visibility !== "hidden" && Number(cs.opacity) > 0.01;
  }, seat);

/** 내 이름표(.mv-tag)의 사각형과 스테이지, 보이는 이름표끼리 겹친 쌍 수 — TM9 입력 */
const readTagGeometry = (page) =>
  page.evaluate(() => {
    const header = document.querySelector(".mf-game__header");
    const panel = document.querySelector("[data-world-panel]");
    const wrappers = [...document.querySelectorAll(".mf-world__tag")].filter((el) => Number(getComputedStyle(el).opacity) > 0.01);
    const rects = wrappers.map((el) => {
      const tag = el.querySelector(".mv-tag") ?? el;
      const r = tag.getBoundingClientRect();
      return { me: el.getAttribute("data-me") === "true", x: r.left, y: r.top, w: r.width, h: r.height };
    });
    let overlaps = 0;
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i];
        const b = rects[j];
        const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
        const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
        if (ox > 1 && oy > 1) overlaps += 1;
      }
    }
    const mine = rects.find((r) => r.me) ?? null;
    return {
      tag: mine ? { x: mine.x, y: mine.y, w: mine.w, h: mine.h } : null,
      stage: header && panel ? { left: 0, top: header.getBoundingClientRect().bottom, right: window.innerWidth, bottom: panel.getBoundingClientRect().top } : null,
      overlaps,
    };
  });

export function makeTownFlows({ recorder, openGame, closeGame, executeHost, untilGame, settledResult }) {
  /**
   * town-walk (TM9, D-21, 폰 6종): 방장 + 봇 넷의 확장판(= 마을)을 낮 토론까지 열어 우체국 문 앞까지 걷는다.
   * 문 앞(front)에 한도(10초) 안에 닿는가, 닿은 뒤 내 이름표가 스테이지 안에 들어오는가를 본다. 이름표 겹침 쌍 수는 참고 줄이다(360x560 의 겹침은 알려진 한계 — backstop).
   */
  async function townWalkFlow(ctx) {
    const id = "town-walk";
    const rec = recorder(ctx);
    const game = await openGame(ctx, id, { guests: 0, bots: 4, role: "citizen", vote: { exec: "yes", pick: "host" }, to: "discussion" });
    try {
      const { hp, hostSeat } = game;
      await waitWorldReady(hp, 5);
      await settle(hp);
      const sc = `${id}/walk`;
      const front = TOWN_E2E.ROOMS[WALK_ROOM].front;
      const m0 = (await readTown(hp)).map;
      rec(sc, "TM1w", "걷기 전 맵이 town 이다", m0 === "town", `__mfMap ${m0}`);
      const arriveMs = await walkTo(hp, hostSeat, front, WALK_LIMIT_MS);
      await sleep(300);
      const geo = await readTagGeometry(hp);
      lines(rec, sc, townChecks("walk", { arriveMs, limitMs: WALK_LIMIT_MS, tag: geo.tag, stage: geo.stage, overlaps: geo.overlaps }));
      rec(sc, "TM9t", "문 앞까지 걸린 시간(참고)", true, arriveMs === null ? "도착하지 못함" : `${arriveMs}ms`, true);
    } finally {
      await closeGame(game);
    }
  }

  /**
   * town-room (TM1·TM2·TM3·TM6·TM7, 390x844): 방장 + 참가자 + 봇 셋. 대기실 두 페이지가 bar, 시작 뒤 둘 다 town(TM1), 집 주인 owners = 좌석(TM7).
   * 방 넷(우체국·술집·진료소·경찰서)을 차례로: 지붕 첫 누름 → 링이 문 앞(TM6) → 지붕 두 번째 누름 → 방 안(TM2: zone·open·0.3초 뒤 roofs) → 나오기(TM3).
   */
  async function townRoomFlow(ctx) {
    const id = "town-room";
    const rec = recorder(ctx);
    let lobbyMaps = null;
    const game = await openGame(ctx, id, {
      guests: 1,
      bots: 3,
      role: "citizen",
      vote: { exec: "yes", pick: "host" },
      to: "discussion",
      beforeStart: async ({ hp, guests }) => {
        const pages = [hp, guests[0].page];
        await Promise.all(pages.map((p) => until(async () => (await readTown(p)).map !== null, 8000)));
        lobbyMaps = await Promise.all(pages.map(async (p) => (await readTown(p)).map));
      },
    });
    try {
      const { hp, ht, hostSeat } = game;
      const gp = game.guests[0].page;
      await Promise.all([waitWorldReady(hp, 5), waitWorldReady(gp, 5)]);
      await Promise.all([settle(hp), settle(gp)]);
      const sc1 = `${id}/map`;
      const pages = [hp, gp];
      await Promise.all(pages.map((p) => until(async () => (await readTown(p)).map === "town", 8000)));
      const gameMaps = await Promise.all(pages.map(async (p) => (await readTown(p)).map));
      lines(rec, sc1, townChecks("map", { lobby: lobbyMaps ?? [], game: gameMaps }));
      rec(sc1, "TM1v", "서버 view.map 도 town 이다", ht.last().map === "town", `view.map ${ht.last().map}`);

      const hookReady = await until(async () => (await readTown(hp)).town !== null, 5000);
      rec(sc1, "TM0", "마을 훅(__mfTown)이 있다", hookReady !== null, "5초 안에 훅이 생기지 않음");
      if (hookReady === null) return;

      const seats = ht.last().players.map((p) => p.seat);
      const t0 = await readTown(hp);
      lines(rec, `${id}/owners`, townChecks("owners", { seats, owners: t0.town.owners }));

      for (const room of ROOMS) {
        const sc = `${id}/${room}`;
        const entered = await enterRoom(hp, hostSeat, room);
        if (entered.first?.farFirst) lines(rec, sc, townChecks("roof", { room, ring: entered.first.ring, zone: entered.first.zone }));
        else rec(sc, "TM6", "첫 누름이 문 앞에서 1.0 보다 먼 자리에서 시작됨(TM6 측정 전제)", false, `내 자리가 ${room} 문 앞에 가까웠음`);
        await sleep(ROOF_READ_MS);
        const inside = await readTown(hp);
        lines(rec, sc, townChecks("room", { room, zone: inside.town?.zone, open: inside.town?.open, roofsAt300: inside.town?.roofs }));
        rec(sc, "TM2m", `${room} 에 드는 데 걸린 시간(참고)`, true, `${entered.ms}ms`, true);
        const left = await leaveRoom(hp, hostSeat, room);
        await sleep(ROOF_READ_MS);
        const out = await readTown(hp);
        lines(rec, sc, townChecks("exit", { zone: out.town?.zone, open: out.town?.open, roofsAt300: out.town?.roofs }));
        rec(sc, "TM3m", `${room} 에서 나오는 데 걸린 시간(참고)`, true, `${left}ms`, true);
      }
    } finally {
      await closeGame(game);
    }
  }

  /**
   * town-sight (TM4·TM5, 390x844): 방장(안)과 참가자(밖) 두 페이지. 방장이 우체국에 들어가면 밖 탭의 seats() 에서 그 좌석이 빠지기 전에 이름표에 data-door=vanish 가 보이고,
   * 끝난 뒤 밖 탭에 그 좌석·이름표가 없다. 참가자도 들어가면 같은 방 두 탭이 서로 보인다. 참가자가 나간 뒤 방장이 나오면 밖 탭에 data-door=appear 가 보인다.
   */
  async function townSightFlow(ctx) {
    const id = "town-sight";
    const rec = recorder(ctx);
    const sc = `${id}/sight`;
    const game = await openGame(ctx, id, { guests: 1, bots: 3, role: "citizen", vote: { exec: "yes", pick: "host" }, to: "discussion" });
    try {
      const { hp, hostSeat } = game;
      const guest = game.guests[0];
      const gp = guest.page;
      const guestSeat = guest.seat;
      await Promise.all([waitWorldReady(hp, 5), waitWorldReady(gp, 5)]);
      await Promise.all([settle(hp), settle(gp)]);
      const seenAtStart = await until(async () => (await readTown(gp)).seats.includes(hostSeat) && (await readTown(hp)).seats.includes(guestSeat), 6000);
      if (seenAtStart === null) throw new SetupError("광장에서 두 탭이 서로를 보지 못함");
      const room = "post";

      // 1) 방장이 들어간다 — 밖 탭이 vanish 를 본다
      await armSightWatch(gp, hostSeat);
      await enterRoom(hp, hostSeat, room);
      await sleep(700);
      const outView = await readTown(gp);
      const outTag = await tagVisible(gp, hostSeat);
      const w1 = await readSightWatch(gp);

      // 2) 참가자도 들어간다 — 같은 방 두 탭이 서로 보인다
      await stopSightWatch(gp);
      await enterRoom(gp, guestSeat, room);
      const sameMs = await until(async () => (await readTown(hp)).seats.includes(guestSeat) && (await readTown(gp)).seats.includes(hostSeat), 5000);
      const [hv, gv] = await Promise.all([readTown(hp), readTown(gp)]);
      const sameRoom = { aSeesB: hv.seats.includes(guestSeat), bSeesA: gv.seats.includes(hostSeat) };

      // 3) 참가자가 먼저 나간 뒤(방장은 안에 남음) 밖 탭을 다시 감시하고 방장이 나온다 — appear
      await leaveRoom(gp, guestSeat, room);
      await sleep(500);
      await armSightWatch(gp, hostSeat);
      await leaveRoom(hp, hostSeat, room);
      await until(async () => (await readSightWatch(gp))?.appearAt !== null, 4000);
      const w3 = await readSightWatch(gp);
      await stopSightWatch(gp);

      lines(
        rec,
        sc,
        townChecks("sight", {
          inSeat: hostSeat,
          outSeats: outView.seats,
          outTagVisible: outTag,
          sameRoom,
          vanishAt: w1?.vanishAt ?? null,
          vanishEndAt: w1?.vanishEndAt ?? null,
          goneAt: w1?.goneAt ?? null,
          appearAt: w3?.appearAt ?? null,
        }),
      );
      rec(sc, "TM5t", "문 연출 시각(참고, 감시 시작 기준 ms)", true, `vanish ${w1?.vanishAt == null ? "없음" : Math.round(w1.vanishAt)}~${w1?.vanishEndAt == null ? "없음" : Math.round(w1.vanishEndAt)} · 좌석 빠짐 ${w1?.goneAt == null ? "없음" : Math.round(w1.goneAt)} · appear ${w3?.appearAt == null ? "없음" : Math.round(w3.appearAt)} · 서로 보임까지 ${sameMs ?? "못 봄"}ms`, true);
    } finally {
      await closeGame(game);
    }
  }

  /**
   * town-ghost (TM8, 390x844): 방장이 처형되어 유령 화면이 되면 네 방이 모두 열려 있다. 이어서 판을 결과까지 넘겨 결과 화면(방장·참가자)에서도 네 방이 열려 있다.
   */
  async function townGhostFlow(ctx) {
    const id = "town-ghost";
    const rec = recorder(ctx);
    const game = await openGame(ctx, id, { guests: 2, bots: 4, role: "citizen", vote: { exec: "yes", pick: "host" }, to: "discussion" });
    try {
      const { hp, ht, guests } = game;
      await executeHost(game);
      await untilGame(hp, (x) => x.ghostView, 9000, "유령 화면");
      await settle(hp);
      const sc = `${id}/ghost`;
      const gs = await readTown(hp);
      rec(sc, "TM8m", "유령 화면의 맵이 town 이다", gs.map === "town", `__mfMap ${gs.map}`);
      const hookReady = await until(async () => (await readTown(hp)).town?.open?.length === 4, 4000);
      const gs2 = await readTown(hp);
      lines(rec, sc, townChecks("ghost", { open: gs2.town?.open }));
      rec(sc, "TM8t", "유령 화면에서 네 방이 열리기까지(참고)", true, hookReady === null ? "4초 안에 열리지 않음" : `${hookReady}ms`, true);

      // 결과까지: 봇이 방장을 더 지목하지 않도록 바꾸고 칸을 넘긴다
      await setBotVote(hp, ht, { exec: "yes", pick: "other" }).catch(() => {});
      const sc2 = `${id}/result`;
      let steps = 0;
      while (ht.last().phase !== "ended" && steps < 90) {
        await skipOnce(hp, ht);
        steps += 1;
        await sleep(150);
      }
      if (ht.last().phase !== "ended") throw new SetupError(`${steps}칸을 넘겼는데 ${ht.last().phase} 에서 끝나지 않음`);
      await ht.waitFor((v) => v.phase === "ended" && v.result !== undefined, 10000, "방장 결과 도달");
      await settledResult(hp);
      const rs = await readTown(hp);
      lines(rec, sc2, townChecks("ghost", { open: rs.town?.open }), { who: "방장 결과 화면: " });
      for (let i = 0; i < guests.length; i++) {
        await settledResult(guests[i].page).catch(() => {});
        const g = await readTown(guests[i].page);
        lines(rec, sc2, townChecks("ghost", { open: g.town?.open }), { tag: `-참가자${i + 1}`, who: `참가자${i + 1} 결과 화면: ` });
      }
    } finally {
      await closeGame(game);
    }
  }

  /**
   * town-reduced (TM10, 390x844): 모션 줄이기(prefers-reduced-motion: reduce)에서 방에 들어가면 같은 틱에 그 방 roofs 0 이고 door 연출(훅 door·태그 data-door)이 한 번도 없다.
   */
  async function townReducedFlow(ctx) {
    const id = "town-reduced";
    const rec = recorder(ctx);
    const game = await openGame(ctx, id, { guests: 0, bots: 4, role: "citizen", vote: { exec: "yes", pick: "host" }, to: "discussion" });
    try {
      const { hp, hostSeat } = game;
      await waitWorldReady(hp, 5);
      await settle(hp);
      await hp.emulateMedia({ reducedMotion: "reduce" });
      await sleep(300);
      const room = "clinic";
      const sc = `${id}/reduced`;
      await hp.evaluate((r) => {
        window.__townReduced?.stop?.();
        const w = { room: r, roofsWhenZone: null, doorSeen: 0, zone: null, raf: 0, stopped: false };
        const frame = () => {
          if (w.stopped) return;
          const t = window.__mfTown;
          if (t) {
            if (t.door.length > w.doorSeen) w.doorSeen = t.door.length;
            if (w.roofsWhenZone === null && t.zone === r) {
              w.roofsWhenZone = t.roofs[r];
              w.zone = t.zone;
            }
          }
          if (document.querySelector("[data-door]")) w.doorSeen = Math.max(w.doorSeen, 1);
          w.raf = requestAnimationFrame(frame);
        };
        w.stop = () => {
          w.stopped = true;
          cancelAnimationFrame(w.raf);
        };
        window.__townReduced = w;
        w.raf = requestAnimationFrame(frame);
      }, room);
      await enterRoom(hp, hostSeat, room);
      await sleep(400);
      const w = await hp.evaluate(() => {
        const x = window.__townReduced;
        x?.stop?.();
        return x ? { roofsWhenZone: x.roofsWhenZone, doorSeen: x.doorSeen, zone: x.zone } : null;
      });
      const nowZone = (await readTown(hp)).town?.zone;
      lines(rec, sc, townChecks("reduced", { room, zone: w?.zone ?? nowZone, roofsWhenZone: w?.roofsWhenZone ?? null, doorSeen: w?.doorSeen ?? null }));
      // 나올 때도 door 연출이 없다(나타남은 바로 1)
      await hp.evaluate(() => {
        window.__townReduced = { doorSeen: 0, stopped: false, raf: 0 };
        const w = window.__townReduced;
        const frame = () => {
          if (w.stopped) return;
          if ((window.__mfTown?.door?.length ?? 0) > 0 || document.querySelector("[data-door]")) w.doorSeen += 1;
          w.raf = requestAnimationFrame(frame);
        };
        w.stop = () => {
          w.stopped = true;
          cancelAnimationFrame(w.raf);
        };
        w.raf = requestAnimationFrame(frame);
      });
      await leaveRoom(hp, hostSeat, room);
      await sleep(400);
      const wOut = await hp.evaluate(() => {
        const x = window.__townReduced;
        x?.stop?.();
        return x ? x.doorSeen : null;
      });
      rec(sc, "TM10x", "모션 줄이기: 방에서 나올 때도 door 연출이 없다", wOut === 0, `door 연출 ${wOut}프레임`);
      await hp.emulateMedia({ reducedMotion: "no-preference" });
    } finally {
      await closeGame(game);
    }
  }

  return { townWalkFlow, townRoomFlow, townSightFlow, townGhostFlow, townReducedFlow };
}

// 21페이즈 원인→결과 하루 흐름 서버 뼈대(21-01, D-01~D-03·D-11·D-17·D-18)를 방 DO 알람으로 확인한다.
// 단계는 advanceTo·closePhase 로 마감을 당겨 한 걸음씩 걷는다(testSkip 으로 한 판을 빨리 걸으면 연결당 1초 20개 한도에 걸린다) — 실제 시간을 기다리지 않는다.
// 맵은 순서와 무관하다: 시험 잠금 그대로 재즈 바에서 돌고, 마을 위치 시험은 openTown() 으로 판을 시작한다.
// 실패 출력은 한 줄이어야 해서(TAP) 단계 열은 '>' 로 이은 문자열로 비교한다.
import { describe, expect, it } from "vitest";
import type { PhaseId, RoomView, ServerMessage } from "../../shared/protocol";
import { ringSlots } from "../../shared/game/gather";
import { TOWN_HOUSES } from "../../shared/game/mapTown";
import { openTown } from "../helpers/playable";
import { actorsOf, advanceTo, closePhase, editRoom, idOfSeat, layOf, lastViewOf, mapPlayers, mark, memWorld, mentions, moveAs, nextFrame, seat, send, settle, snapSeatsOf, worldsIn } from "./helpers";
import type { Actor, Seated, TestSocket } from "./helpers";

const allSockets = (r: Seated): TestSocket[] => [r.host, ...r.guests.map((g) => g.sock)];

/** 소켓이 받은 state 프레임의 단계 열(연속 중복은 합친다). */
function phasesSeen(sock: TestSocket): PhaseId[] {
  const out: PhaseId[] = [];
  for (const raw of sock.frames) {
    const msg = JSON.parse(raw) as ServerMessage;
    if (msg.t !== "state") continue;
    if (out.at(-1) !== msg.view.phase) out.push(msg.view.phase);
  }
  return out;
}

/** 단계 열에서 from 단계부터 끝까지. */
const chainFrom = (phases: readonly PhaseId[], from: PhaseId): string => phases.slice(phases.indexOf(from)).join(">");

/** 방장 + 연결 참가자 `guests` 명(확장판 기본)을 시작해 역할 확인까지 걷는다. */
async function atRoleReveal(guests = 3): Promise<{ room: Seated; socks: TestSocket[]; actors: Actor[] }> {
  const room = await seat(guests, 0);
  const socks = allSockets(room);
  send(room.host, { t: "start" });
  for (const s of socks) await nextFrame(s, (m) => m.t === "state" && m.view.phase === "assigning");
  await advanceTo(room.code, socks, "roleReveal");
  return { room, socks, actors: actorsOf(room) };
}

/** 모든 소켓의 마지막 state 를 '단계/일차/길이' 한 줄로 합친다(모두 같으면 한 줄만). */
function viewLine(sock: TestSocket): string {
  const v: RoomView = lastViewOf(sock);
  return `${v.phase}/${v.day?.n}/${v.phaseDurationMs}`;
}

describe("확장판 하루 순서 트레이서 (D-01·D-02·D-03)", () => {
  it("역할 확인 → 저녁(일차 1, 40초) → 밤 → 토론: dayAnnounce·morning 이 없다", async () => {
    const { room, socks } = await atRoleReveal();
    await advanceTo(room.code, socks, "errand");
    expect(socks.map(viewLine).join(" ")).toBe(Array(socks.length).fill("errand/1/40000").join(" "));
    await advanceTo(room.code, socks, "discussion");
    expect(chainFrom(phasesSeen(room.host), "errand")).toBe("errand>night>discussion");
  });
});

describe("현장 있는 밤은 아침을 거친다 (D-03·D-17)", () => {
  it("마피아가 시민 하나를 고른 밤을 마감하면 모든 소켓이 morning(30초) → 마감하면 discussion", async () => {
    const { room, socks, actors } = await atRoleReveal();
    await advanceTo(room.code, socks, "night");
    const mafia = actors.find((a) => a.role === "mafia")!;
    const citizen = actors.find((a) => a.role === "citizen")!;
    await editRoom(room.code, (r) => mapPlayers(r, (p) => (p.seat === mafia.seat ? { ...p, nightPick: citizen.seat } : p)));
    await closePhase(room.code);
    for (const s of socks) await nextFrame(s, (m) => m.t === "state" && m.view.phase === "morning");
    expect(socks.map(viewLine).join(" ")).toBe(Array(socks.length).fill("morning/1/30000").join(" "));
    await closePhase(room.code);
    for (const s of socks) await nextFrame(s, (m) => m.t === "state" && m.view.phase === "discussion");
    expect(chainFrom(phasesSeen(room.host), "night")).toBe("night>morning>discussion");
  });
});

// ---- 위치(21-01 Task 2): 마을 밤의 집 앞 순간이동·밤 걷기 없음·아침 걷기·토론 모이기 (D-11·D-18) ----

type SnapFrame = Extract<ServerMessage, { t: "world"; k: "snap" }>;

/** 마을에서 시작한 확장판 판을 역할 확인까지 걷는다. 맵은 시작 때 정해져 저장되므로 그 뒤에는 잠금과 무관하다. */
async function townAtRoleReveal(): Promise<Awaited<ReturnType<typeof atRoleReveal>>> {
  const close = openTown();
  try {
    return await atRoleReveal();
  } finally {
    close();
  }
}

/** 이 프레임 열의 마지막 snap 에서 본인 좌석의 구간 끝점 "x,z". */
function ownEnd(msgs: ServerMessage[], seatNo: number): string {
  const snap = worldsIn(msgs).filter((f): f is SnapFrame => f.k === "snap").at(-1);
  const ent = snap?.ents.find((e) => e.s === seatNo);
  return ent === undefined ? "none" : ent.p.slice(-2).join(",");
}

const frontOf = (seatNo: number): string => `${TOWN_HOUSES[seatNo]!.front.x},${TOWN_HOUSES[seatNo]!.front.z}`;

describe("마을 밤 — 집 앞 순간이동 (D-11, T-21-01·T-21-02)", () => {
  it("밤이 시작되면 산 사람 소켓마다 받은 snap 은 본인 한 칸이고 끝점이 자기 좌석 집 문 앞이다. 밤의 이동 요청은 프레임을 만들지 않는다", async () => {
    const { room, socks, actors } = await townAtRoleReveal();
    await advanceTo(room.code, socks, "errand");
    const marks = socks.map((k) => mark(k));
    await advanceTo(room.code, socks, "night");
    const frames = await Promise.all(socks.map((k, i) => settle(k, marks[i]!)));
    expect(frames.map((f, i) => `${actors[i]!.seat}:${snapSeatsOf(f)}:${ownEnd(f, actors[i]!.seat)}`).join(" ")).toBe(
      actors.map((a) => `${a.seat}:${a.seat}:${frontOf(a.seat)}`).join(" "),
    );
    // 밤에는 산 사람의 걷기 요청이 거절된다 — 그 소켓에 move 프레임이 오지 않는다.
    const walker = actors[1]!;
    const from = mark(walker.sock);
    moveAs(walker, 0, 265);
    expect(worldsIn(await settle(walker.sock, from)).length).toBe(0);
  });
});

describe("마을 아침·토론 — 순간이동 없이 걷고, 토론은 광장 가운데로 모인다 (D-11·D-18)", () => {
  it("아침에는 그 자리(집 앞)에서 걸을 수 있고, 토론이 시작되면 world.lay.key 가 '1:talk' 이며 산 사람은 둘레 자리로 간다", async () => {
    const { room, socks, actors } = await townAtRoleReveal();
    await advanceTo(room.code, socks, "night");
    const mafia = actors.find((a) => a.role === "mafia")!;
    const victim = actors.find((a) => a.role === "citizen")!;
    await editRoom(room.code, (r) => mapPlayers(r, (p) => (p.seat === mafia.seat ? { ...p, nightPick: victim.seat } : p)));
    const living = actors.filter((a) => a.seat !== victim.seat);
    const marks = socks.map((k) => mark(k));
    await closePhase(room.code);
    for (const k of socks) await nextFrame(k, (m) => m.t === "state" && m.view.phase === "morning");
    const morning = await Promise.all(socks.map((k, i) => settle(k, marks[i]!)));
    // 아침: 산 사람의 위치는 순간이동 없이 그대로 집 앞이다.
    expect(living.map((a) => `${a.seat}:${ownEnd(morning[actors.indexOf(a)]!, a.seat)}`).join(" ")).toBe(living.map((a) => `${a.seat}:${frontOf(a.seat)}`).join(" "));
    // 아침에는 산 사람이 걷는다: 요청을 보낸 본인에게 그 사람의 move 프레임이 온다.
    const walker = living[0]!;
    const from = mark(walker.sock);
    moveAs(walker, 0, 265);
    expect(mentions(await settle(walker.sock, from), walker.seat)).toBeGreaterThan(0);
    // 토론: 모이기 배치(키 1:talk)와 산 사람마다 둘레 자리 목적지.
    await closePhase(room.code);
    for (const k of socks) await nextFrame(k, (m) => m.t === "state" && m.view.phase === "discussion");
    expect((await layOf(room.code)).key).toBe("1:talk");
    const world = await memWorld(room.code);
    const ends: string[] = [];
    for (const a of living) {
      const seg = world.segs[await idOfSeat(room.code, a.seat)]!;
      ends.push(seg.p.slice(-2).join(","));
    }
    expect(ends.sort().join(" ")).toBe(ringSlots(living.length).map((p) => `${p[0]},${p[1]}`).sort().join(" "));
  });
});

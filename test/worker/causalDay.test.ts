// 21페이즈 원인→결과 하루 흐름 서버 뼈대(21-01, D-01~D-03·D-11·D-17·D-18)를 방 DO 알람으로 확인한다.
// 단계는 advanceTo·closePhase 로 마감을 당겨 한 걸음씩 걷는다(testSkip 으로 한 판을 빨리 걸으면 연결당 1초 20개 한도에 걸린다) — 실제 시간을 기다리지 않는다.
// 맵은 순서와 무관하다: 시험 잠금 그대로 재즈 바에서 돌고, 마을 위치 시험은 openTown() 으로 판을 시작한다.
// 실패 출력은 한 줄이어야 해서(TAP) 단계 열은 '>' 로 이은 문자열로 비교한다.
import { describe, expect, it } from "vitest";
import type { PhaseId, RoomView, ServerMessage } from "../../shared/protocol";
import { actorsOf, advanceTo, closePhase, editRoom, lastViewOf, mapPlayers, nextFrame, seat, send } from "./helpers";
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

// 낮 토론 워커 통합 테스트(02-05): 실제 소켓으로 직업 공개·빠른 메시지·이모티콘·연장·넘기기를 workerd 에서 확인한다.
import { describe, expect, it } from "vitest";
import type { RoomView, ServerMessage } from "../../shared/protocol";
import { advanceTo, collect, nextFrame, nextState, seat, send } from "./helpers";
import type { Seated, TestSocket } from "./helpers";

const ROLE_VALUES = ["mafia", "police", "doctor", "citizen", "none"];

const allSockets = (r: Seated): TestSocket[] => [r.host, ...r.guests.map((g) => g.sock)];

const viewsIn = (sock: TestSocket, phase: string): RoomView[] =>
  collect(sock)
    .map((raw) => JSON.parse(raw) as ServerMessage)
    .filter((m): m is Extract<ServerMessage, { t: "state" }> => m.t === "state" && m.view.phase === phase)
    .map((m) => m.view);

/** 방장 + 연결 손님 4명(5명 방)을 시작하고 목표 단계까지 넘긴다. */
async function startedAt(phase: "claim" | "discussion"): Promise<Seated> {
  const r = await seat(4, 0);
  send(r.host, { t: "start" });
  for (const s of allSockets(r)) await nextFrame(s, (m) => m.t === "state" && m.view.phase === "assigning");
  if (phase === "discussion") {
    await advanceTo(r.code, allSockets(r), "claim");
    await advanceTo(r.code, allSockets(r), "claimReveal");
  }
  await advanceTo(r.code, allSockets(r), phase);
  return r;
}

/** JSON 을 걸어 내려가며 역할·주장 값 문자열이 있는 경로를 모은다(배열 칸은 [] 로 줄인다). */
function roleValuePaths(value: unknown, path = ""): string[] {
  if (Array.isArray(value)) return value.flatMap((v) => roleValuePaths(v, `${path}[]`));
  if (value !== null && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) => roleValuePaths(v, `${path}.${k}`));
  }
  return typeof value === "string" && ROLE_VALUES.includes(value) ? [path] : [];
}

const ALLOWED_ROLE_PATHS = new Set([".view.me.role", ".view.me.claim", ".view.day.roles[]"]);

describe("직업 공개 동시 공개 (D-01, D-03, D-05)", () => {
  it("마감 전에는 선택이 본인에게만 보이고(허용 경로 밖 값 없음), 마감 뒤 모두에게 공개된다", async () => {
    const r = await startedAt("claim");
    const [g0, g1] = r.guests as [Seated["guests"][number], Seated["guests"][number], ...Seated["guests"]];
    const sockets = allSockets(r);

    send(g0.sock, { t: "claim", claim: "doctor" });
    await nextFrame(g0.sock, (m) => m.t === "state" && m.view.me.claim === "doctor");
    send(g0.sock, { t: "claim", claim: "police" }); // 바꿔 고르기
    await nextFrame(g0.sock, (m) => m.t === "state" && m.view.me.claim === "police");
    send(g1.sock, { t: "claim", claim: "doctor" });
    const done = [g0.seat, g1.seat].sort((a, b) => a - b);
    for (const s of sockets) {
      await nextFrame(s, (m) => m.t === "state" && m.view.day?.claimDone?.length === 2);
    }

    // 마감 전: 모든 소켓의 모든 원문 프레임에서 역할·주장 문자열은 허용 경로에만 있다.
    for (const s of sockets) {
      for (const raw of collect(s)) {
        for (const path of roleValuePaths(JSON.parse(raw))) expect(ALLOWED_ROLE_PATHS.has(path)).toBe(true);
        expect(raw.includes('"claims"')).toBe(false);
      }
    }
    // 본인 선택만 me.claim 으로 보인다.
    const lastClaim = (s: TestSocket): RoomView => viewsIn(s, "claim").at(-1)!;
    expect(lastClaim(g0.sock).me.claim).toBe("police");
    expect(lastClaim(g1.sock).me.claim).toBe("doctor");
    expect(lastClaim(r.host).me.claim).toBeUndefined();
    // 완료 배지의 근거: 다른 소켓에는 고른 사람의 seat 만 claimDone 으로 보인다.
    for (const s of sockets) expect(lastClaim(s).day?.claimDone).toEqual(done);

    // 마감 뒤: 모두에게 day.claims 가 공개된다.
    await advanceTo(r.code, sockets, "claimReveal");
    for (const s of sockets) {
      const view = viewsIn(s, "claimReveal").at(-1)!;
      const claims = view.day?.claims ?? [];
      expect(claims.length).toBe(5);
      for (const c of claims) {
        const expected = c.seat === g0.seat ? "police" : c.seat === g1.seat ? "doctor" : "none";
        expect(`${c.seat}:${c.claim}`).toBe(`${c.seat}:${expected}`);
      }
    }
  });

  it("단계 밖(discussion) claim 은 WRONG_PHASE 이고 최신 state 를 다시 받는다", async () => {
    const r = await startedAt("discussion");
    const g0 = r.guests[0]!;
    send(g0.sock, { t: "claim", claim: "police" });
    const err = await nextFrame(g0.sock, (m) => m.t === "error");
    expect(JSON.stringify(err)).toBe(JSON.stringify({ t: "error", code: "WRONG_PHASE" }));
    const state = await nextState(g0.sock);
    expect(state.view.phase).toBe("discussion");
  });
});

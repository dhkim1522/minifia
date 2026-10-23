// 낮 토론 워커 통합 테스트(02-05): 실제 소켓으로 직업 공개·빠른 메시지·이모티콘·연장·넘기기를 workerd 에서 확인한다.
import { describe, expect, it } from "vitest";
import type { RoomView, ServerMessage } from "../../shared/protocol";
import { advanceTo, backdateSends, collect, flat, nextFrame, nextState, seat, send, storedRoom } from "./helpers";
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

const errorCode = async (sock: TestSocket): Promise<string> => flat(await nextFrame(sock, (m) => m.t === "error"));
const codeOf = (code: string): string => JSON.stringify({ t: "error", code });

/** 모든 소켓이 messages 가 n 줄인 discussion state 를 받을 때까지 기다린다. */
async function waitMessages(sockets: TestSocket[], n: number): Promise<void> {
  for (const s of sockets) await nextFrame(s, (m) => m.t === "state" && m.view.day?.messages?.length === n);
}

/** 서버가 앞선 요청을 모두 처리해 다른 소켓에 보낼 것을 보냈다고 볼 수 있을 때까지 보낸 소켓의 ping 왕복과 짧은 대기. */
async function settle(sock: TestSocket): Promise<void> {
  send(sock, { t: "ping", c: 1 });
  await nextFrame(sock, (m) => m.t === "pong");
  await new Promise<void>((resolve) => setTimeout(resolve, 50));
}

const lastMessages = (s: TestSocket): number => viewsIn(s, "discussion").at(-1)?.day?.messages?.length ?? -1;

describe("빠른 메시지 (COMM-01, COMM-04, D-13)", () => {
  it("claim·claimReveal 단계의 say 는 WRONG_PHASE 이고 다른 소켓 프레임에 메시지가 없다", async () => {
    const r = await startedAt("claim");
    const [g0, g1] = r.guests as [Seated["guests"][number], Seated["guests"][number], ...Seated["guests"]];
    const others = [r.host, ...r.guests.slice(1).map((g) => g.sock)];

    send(g0.sock, { t: "say", template: "suspect", target: g1.seat });
    expect(await errorCode(g0.sock)).toBe(codeOf("WRONG_PHASE"));
    await settle(g0.sock);
    for (const s of others) expect(collect(s).some((raw) => raw.includes('"template"'))).toBe(false);

    await advanceTo(r.code, allSockets(r), "claimReveal");
    send(g0.sock, { t: "say", template: "suspect", target: g1.seat });
    expect(await errorCode(g0.sock)).toBe(codeOf("WRONG_PHASE"));
    await settle(g0.sock);
    for (const s of others) expect(collect(s).some((raw) => raw.includes('"template"'))).toBe(false);
    expect((await storedRoom(r.code)).messages ?? []).toHaveLength(0);
  });

  it("discussion 에서 보낸 suspect 는 모든 소켓의 day.messages 한 줄(seat = 보낸 소켓의 자리)이 되고, 즉시 두 번째는 RATE_LIMITED 다", async () => {
    const r = await startedAt("discussion");
    const [g0, g1] = r.guests as [Seated["guests"][number], Seated["guests"][number], ...Seated["guests"]];
    const sockets = allSockets(r);

    send(g0.sock, { t: "say", template: "suspect", target: g1.seat });
    await waitMessages(sockets, 1);
    for (const s of sockets) {
      const line = viewsIn(s, "discussion").at(-1)!.day!.messages![0]!;
      expect(`${line.seat}:${line.template}:${line.target}`).toBe(`${g0.seat}:suspect:${g1.seat}`);
    }

    send(g0.sock, { t: "say", template: "trust", target: g1.seat });
    expect(await errorCode(g0.sock)).toBe(codeOf("RATE_LIMITED"));
    await settle(g0.sock);
    for (const s of sockets) expect(lastMessages(s)).toBe(1);
    expect((await storedRoom(r.code)).messages).toHaveLength(1);
  });

  it("text 키가 붙은 say·seat 키로 방장 자리를 넣은 say 는 BAD_MESSAGE 이고 다른 소켓에 나타나지 않는다", async () => {
    const r = await startedAt("discussion");
    const [g0, g1] = r.guests as [Seated["guests"][number], Seated["guests"][number], ...Seated["guests"]];
    const sockets = allSockets(r);
    const marker = "UNIQUE-TEXT-9f3a";

    send(g0.sock, { t: "say", template: "suspect", target: g1.seat, text: marker });
    expect(await errorCode(g0.sock)).toBe(codeOf("BAD_MESSAGE"));
    send(g1.sock, { t: "say", template: "suspect", target: g0.seat, seat: 0 });
    expect(await errorCode(g1.sock)).toBe(codeOf("BAD_MESSAGE"));
    await settle(g0.sock);
    await settle(g1.sock);
    for (const s of sockets) {
      expect(collect(s).some((raw) => raw.includes(marker))).toBe(false);
      expect(lastMessages(s)).toBe(0);
    }
    expect((await storedRoom(r.code)).messages ?? []).toHaveLength(0);
  });

  it("쿨다운이 지난 뒤 거짓 주장(claimed, 아무 직업)도 그대로 모든 소켓에 보내진다", async () => {
    const r = await startedAt("discussion");
    const [g0, g1, g2] = r.guests as [Seated["guests"][number], Seated["guests"][number], Seated["guests"][number], ...Seated["guests"]];
    const sockets = allSockets(r);

    send(g0.sock, { t: "say", template: "innocent" });
    await waitMessages(sockets, 1);
    await backdateSends(r.code);
    send(g0.sock, { t: "say", template: "claimed", target: g2.seat, claimedRole: "police" });
    await waitMessages(sockets, 2);
    for (const s of sockets) {
      const line = viewsIn(s, "discussion").at(-1)!.day!.messages![1]!;
      expect(`${line.seat}:${line.template}:${line.target}:${line.claimedRole}`).toBe(`${g0.seat}:claimed:${g2.seat}:police`);
    }
    expect(g1.seat).not.toBe(g2.seat);
  });
});

describe("이모티콘 (COMM-02, D-14)", () => {
  it("저장 없이 연결된 모든 소켓에 emoji 프레임이 가고, 직후 say 는 RATE_LIMITED 다", async () => {
    const r = await startedAt("discussion");
    const [g0, g1] = r.guests as [Seated["guests"][number], Seated["guests"][number], ...Seated["guests"]];
    const sockets = allSockets(r);

    send(g0.sock, { t: "say", template: "innocent" });
    await waitMessages(sockets, 1);
    await backdateSends(r.code);

    send(g0.sock, { t: "emoji", icon: "smile" });
    for (const s of sockets) {
      const m = await nextFrame(s, (f) => f.t === "emoji");
      expect(m.t === "emoji" && `${m.seat}:${m.icon}:${typeof m.at}`).toBe(`${g0.seat}:smile:number`);
    }
    expect((await storedRoom(r.code)).messages).toHaveLength(1);

    send(g0.sock, { t: "say", template: "suspect", target: g1.seat });
    expect(await errorCode(g0.sock)).toBe(codeOf("RATE_LIMITED"));
    send(g0.sock, { t: "emoji", icon: "heart" });
    expect(await errorCode(g0.sock)).toBe(codeOf("RATE_LIMITED"));
    await settle(g0.sock);
    for (const s of sockets) expect(lastMessages(s)).toBe(1);
  });

  it("단계 밖 emoji 는 WRONG_PHASE, 모르는 아이콘이나 덧붙은 키는 BAD_MESSAGE 이고 아무에게도 가지 않는다", async () => {
    const r = await startedAt("claim");
    const g0 = r.guests[0]!;
    const others = [r.host, ...r.guests.slice(1).map((g) => g.sock)];

    send(g0.sock, { t: "emoji", icon: "smile" });
    expect(await errorCode(g0.sock)).toBe(codeOf("WRONG_PHASE"));
    send(g0.sock, { t: "emoji", icon: "skull" });
    expect(await errorCode(g0.sock)).toBe(codeOf("BAD_MESSAGE"));
    send(g0.sock, { t: "emoji", icon: "smile", seat: 0 });
    expect(await errorCode(g0.sock)).toBe(codeOf("BAD_MESSAGE"));
    await settle(g0.sock);
    for (const s of others) expect(collect(s).some((raw) => raw.includes('"t":"emoji"'))).toBe(false);
  });
});

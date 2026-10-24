import { env, exports } from "cloudflare:workers";
import { runInDurableObject } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { MAX_BODY_BYTES } from "../../shared/protocol";
import type { ServerMessage } from "../../shared/protocol";
import {
  closed,
  flat,
  connect,
  createRoom,
  hello,
  joinOk,
  joinRoom,
  nextFrame,
  nextState,
  postJoinRaw,
  send,
} from "./helpers";

async function errorOf(res: Response): Promise<string> {
  return ((await res.json()) as { error: string }).error;
}

describe("POST /api/rooms/{code}/join", () => {
  it("성공하면 200 {token, seat} 이고 이미 연결된 방장 소켓이 곧바로 새 자리가 담긴 state 를 받는다", async () => {
    const { code, token } = await createRoom("방장");
    const host = await connect(code);
    await hello(host, token);

    const res = await joinRoom(code, "철수");
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = (await res.json()) as { token: string; seat: number };
    expect(body.seat).toBe(1);
    expect(body.token.length).toBeGreaterThanOrEqual(43);

    const state = await nextState(host);
    expect(state.view.players).toEqual([
      { seat: 0, nickname: "방장", connected: true, isHost: true, alive: true },
      { seat: 1, nickname: "철수", connected: false, isHost: false, alive: true },
    ]);
    // 방장 프레임에 새 참가자의 토큰이 없다.
    expect(host.frames.join("\n")).not.toContain(body.token);
  });

  it("8자리가 차면(일부 미연결 포함) 9번째는 409 ROOM_FULL", async () => {
    const { code, token } = await createRoom("방장");
    const host = await connect(code);
    await hello(host, token);
    for (let i = 1; i < 8; i += 1) await joinOk(code, `사람${i}`);
    const res = await joinRoom(code, "아홉째");
    expect(res.status).toBe(409);
    expect(await errorOf(res)).toBe("ROOM_FULL");
  });

  it("같은 이름(대소문자 무시)은 409 NICKNAME_TAKEN", async () => {
    const { code } = await createRoom("Minsu");
    const res = await joinRoom(code, "minsu");
    expect(res.status).toBe(409);
    expect(await errorOf(res)).toBe("NICKNAME_TAKEN");
  });

  it("CR-01: ZWJ 를 끼운 이름은 원래 이름과 같아 409 NICKNAME_TAKEN", async () => {
    const { code } = await createRoom("철수");
    const res = await joinRoom(code, "철\u{200D}수");
    expect(res.status).toBe(409);
    expect(await errorOf(res)).toBe("NICKNAME_TAKEN");
  });

  it("CR-01: 변형 선택자를 끼운 이름은 원래 이름과 같아 409 NICKNAME_TAKEN", async () => {
    const { code } = await createRoom("철수");
    const res = await joinRoom(code, "철\u{FE0F}수");
    expect(res.status).toBe(409);
    expect(await errorOf(res)).toBe("NICKNAME_TAKEN");
  });

  it("CR-01: 채움 문자 이름은 400 NICKNAME_INVALID", async () => {
    const { code } = await createRoom();
    const res = await joinRoom(code, "\u{3164}");
    expect(res.status).toBe(400);
    expect(await errorOf(res)).toBe("NICKNAME_INVALID");
  });

  it("6글자 닉네임 참가는 400 NICKNAME_INVALID, 5글자는 통과 (결정 0017-4)", async () => {
    const { code } = await createRoom();
    const tooLong = await joinRoom(code, "가나다라마바");
    expect(tooLong.status).toBe(400);
    expect(await errorOf(tooLong)).toBe("NICKNAME_INVALID");
    const ok = await joinRoom(code, "가나다라마");
    expect([200, 201]).toContain(ok.status);
  });

  it("빈 닉네임은 400 NICKNAME_INVALID", async () => {
    const { code } = await createRoom();
    const res = await joinRoom(code, "");
    expect(res.status).toBe(400);
    expect(await errorOf(res)).toBe("NICKNAME_INVALID");
  });

  it("1024바이트를 넘는 본문, JSON 아님, 스키마 불일치는 400 BAD_REQUEST", async () => {
    const { code } = await createRoom();
    for (const raw of [
      JSON.stringify({ nickname: "가".repeat(MAX_BODY_BYTES) }),
      "이건 JSON 이 아니다",
      JSON.stringify({ nickname: 123 }),
    ]) {
      const res = await postJoinRaw(code, raw);
      expect(res.status).toBe(400);
      expect(await errorOf(res)).toBe("BAD_REQUEST");
    }
  });

  it("없는 방과 코드 모양이 아닌 경로는 404 ROOM_NOT_FOUND", async () => {
    for (const code of ["0000", "12ab"]) {
      const res = await joinRoom(code, "철수");
      expect(res.status).toBe(404);
      expect(await errorOf(res)).toBe("ROOM_NOT_FOUND");
    }
  });
});

describe("대기실 leave", () => {
  it("참가자가 leave 하면 그 소켓은 4003 'left' 로 닫히고 방장 state 에서 그 자리가 사라진다", async () => {
    const { code, token } = await createRoom("방장");
    const guest = await joinOk(code, "철수");
    const host = await connect(code);
    await hello(host, token);
    const g = await connect(code);
    await hello(g, guest.token);

    send(g, { t: "leave" });
    expect(await closed(g)).toBe("4003 left");
    const state = await nextFrame(host, (m) => m.t === "state" && m.view.players.length === 1);
    expect(state.t === "state" && state.view.players[0]!.nickname).toBe("방장");
  });

  it("방장이 나가면 연결된 남은 사람 가운데 joinSeq 최소가 방장이 된다 (끊긴 사람이 더 일찍 왔어도)", async () => {
    const { code, token } = await createRoom("방장");
    await joinOk(code, "영희"); // joinSeq 1, 끊김
    const cheolsu = await joinOk(code, "철수"); // joinSeq 2, 연결
    const host = await connect(code);
    await hello(host, token);
    const c = await connect(code);
    await hello(c, cheolsu.token);

    send(host, { t: "leave" });
    expect(await closed(host)).toBe("4003 left");
    const state = await nextFrame(c, (m) => m.t === "state" && m.view.players.length === 2);
    if (state.t !== "state") throw new Error("state 아님");
    expect(state.view.me.isHost).toBe(true);
    expect(state.view.players.filter((p) => p.isHost).map((p) => p.nickname)).toEqual(["철수"]);
  });

  it("마지막 사람이 나가면 방 저장소와 알람이 지워져 미리보기가 404 다", async () => {
    const { code, token } = await createRoom("방장");
    const host = await connect(code);
    await hello(host, token);
    send(host, { t: "leave" });
    expect(await closed(host)).toBe("4003 left");

    const res = await exports.default.fetch(`http://x/api/rooms/${code}`);
    expect(res.status).toBe(404);
    const stub = env.ROOM.getByName(code);
    await runInDurableObject(stub, async (_i, state) => {
      expect((await state.storage.list()).size).toBe(0);
      expect(await state.storage.getAlarm()).toBeNull();
    });
  });

  it("hello 전 소켓의 leave·kick·start 는 BAD_MESSAGE", async () => {
    const { code } = await createRoom("방장");
    const sock = await connect(code);
    for (const msg of [{ t: "leave" }, { t: "kick", seat: 1 }, { t: "start" }]) {
      send(sock, msg);
      const reply = await nextFrame(sock);
      expect(flat(reply)).toBe(JSON.stringify({ t: "error", code: "BAD_MESSAGE" } satisfies ServerMessage));
    }
  });
});

describe("kick", () => {
  it("참가자의 kick 은 NOT_HOST", async () => {
    const { code, token } = await createRoom("방장");
    const guest = await joinOk(code, "철수");
    const host = await connect(code);
    await hello(host, token);
    const g = await connect(code);
    await hello(g, guest.token);

    send(g, { t: "kick", seat: 0 });
    expect(flat(await nextFrame(g, (m) => m.t === "error"))).toBe(JSON.stringify({ t: "error", code: "NOT_HOST" }));
  });

  it("방장이 연결된 사람을 kick 하면 CANNOT_KICK", async () => {
    const { code, token } = await createRoom("방장");
    const guest = await joinOk(code, "철수");
    const host = await connect(code);
    await hello(host, token);
    const g = await connect(code);
    await hello(g, guest.token);

    send(host, { t: "kick", seat: guest.seat });
    expect(flat(await nextFrame(host, (m) => m.t === "error"))).toBe(JSON.stringify({ t: "error", code: "CANNOT_KICK" }));
  });

  it("방장이 HTTP 로만 참가한 미연결 사람을 kick 하면 그 자리가 빠진 state 가 방송된다", async () => {
    const { code, token } = await createRoom("방장");
    const ghost = await joinOk(code, "유령");
    const host = await connect(code);
    await hello(host, token);

    send(host, { t: "kick", seat: ghost.seat });
    const state = await nextFrame(host, (m) => m.t === "state" && m.view.players.length === 1);
    expect(state.t).toBe("state");
    const res = await exports.default.fetch(`http://x/api/rooms/${code}`);
    expect(((await res.json()) as { playerCount: number }).playerCount).toBe(1);
  });
});

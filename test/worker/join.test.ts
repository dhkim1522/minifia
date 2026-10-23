import { describe, expect, it } from "vitest";
import { MAX_BODY_BYTES } from "../../shared/protocol";
import { connect, createRoom, hello, joinOk, joinRoom, nextState, postJoinRaw } from "./helpers";

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
      { seat: 0, nickname: "방장", connected: true, isHost: true },
      { seat: 1, nickname: "철수", connected: false, isHost: false },
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

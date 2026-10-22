// 방 코드 배정: 무작위 코드를 뽑아 그 코드의 방 Durable Object 에 만들기를 시도하고, 이미 쓰는 코드면 다른 코드로 다시 시도한다.
// Worker 라우트에서 분리해 두어 재시도 소진 경로를 테스트로 확인할 수 있다.
import { generateRoomCode } from "../shared/roomCode";
import type { CreateRoomRpcResult } from "./room";

export const MAX_CODE_ATTEMPTS = 8;

export interface RoomCreator {
  createRoom(input: { code: string; nickname: string; now: number }): Promise<CreateRoomRpcResult>;
}

export type AllocateResult =
  | { kind: "created"; code: string; token: string; seat: number }
  | { kind: "nickname_invalid" }
  | { kind: "exhausted" };

export async function allocateRoom(
  getRoom: (code: string) => RoomCreator,
  nickname: string,
  randInt: (n: number) => number,
  now: number,
): Promise<AllocateResult> {
  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
    const code = generateRoomCode(randInt);
    const result = await getRoom(code).createRoom({ code, nickname, now });
    if (result.ok) return { kind: "created", code, token: result.token, seat: result.seat };
    if (result.error === "NICKNAME_INVALID") return { kind: "nickname_invalid" };
    // CODE_TAKEN: 살아 있는 방이 있으니 덮어쓰지 않고 다른 코드로 다시 시도한다.
  }
  return { kind: "exhausted" };
}

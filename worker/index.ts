import { APP_VERSION } from "../shared/version";
import { MAX_BODY_BYTES } from "../shared/protocol";
import type { ApiErrorCode, CreateRoomResponse } from "../shared/protocol";
import { isRoomCode } from "../shared/roomCode";
import { CreateRoomBodySchema } from "../shared/schemas";
import { allocateRoom } from "./allocate";
import { cryptoRandInt } from "./random";

export { Room } from "./room";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function apiError(error: ApiErrorCode, status: number): Response {
  return json({ error }, status);
}

const WS_PATH = /^\/api\/rooms\/([^/]+)\/ws$/;

async function handleCreateRoom(request: Request, env: Env): Promise<Response> {
  // 본문은 상한을 넘으면 읽지 않고 거절한다(선언된 길이), 읽은 뒤에도 바이트 수를 다시 확인한다.
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > MAX_BODY_BYTES) return apiError("BAD_REQUEST", 400);
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) return apiError("BAD_REQUEST", 400);

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return apiError("BAD_REQUEST", 400);
  }
  const parsed = CreateRoomBodySchema.safeParse(raw);
  if (!parsed.success) return apiError("BAD_REQUEST", 400);

  const result = await allocateRoom(
    (code) => env.ROOM.getByName(code),
    parsed.data.nickname,
    cryptoRandInt,
    Date.now(),
  );
  switch (result.kind) {
    case "created": {
      const body: CreateRoomResponse = { code: result.code, token: result.token, seat: result.seat };
      return json(body, 201);
    }
    case "nickname_invalid":
      return apiError("NICKNAME_INVALID", 400);
    case "exhausted":
      return apiError("CODE_EXHAUSTED", 503);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);

    if (pathname === "/api/health" && request.method === "GET") {
      return json({ ok: true, version: APP_VERSION });
    }
    if (pathname === "/api/rooms" && request.method === "POST") {
      return handleCreateRoom(request, env);
    }
    const ws = WS_PATH.exec(pathname);
    if (ws && request.method === "GET") {
      const code = ws[1]!;
      if (!isRoomCode(code)) return apiError("ROOM_NOT_FOUND", 404);
      return env.ROOM.getByName(code).fetch(request);
    }
    if (pathname.startsWith("/api/")) {
      return apiError("NOT_FOUND", 404);
    }
    // /api/* 밖은 정적 에셋이 먼저 처리한다. 여기까지 오면 에셋이 없다는 뜻이다.
    return apiError("NOT_FOUND", 404);
  },
} satisfies ExportedHandler<Env>;

import { APP_VERSION } from "../shared/version";
import { MAX_BODY_BYTES } from "../shared/protocol";
import type { ApiErrorCode, CreateRoomResponse, JoinRoomResponse } from "../shared/protocol";
import { isRoomCode } from "../shared/roomCode";
import { CreateRoomBodySchema, JoinRoomBodySchema } from "../shared/schemas";
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
const PREVIEW_PATH = /^\/api\/rooms\/([^/]+)$/;
const JOIN_PATH = /^\/api\/rooms\/([^/]+)\/join$/;

/** 본문을 상한 안에서 읽어 JSON 으로 파싱한다. 상한 초과·JSON 아님은 null. */
async function readJsonBody(request: Request): Promise<unknown | null> {
  // 본문은 상한을 넘으면 읽지 않고 거절한다(선언된 길이), 읽은 뒤에도 바이트 수를 다시 확인한다.
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > MAX_BODY_BYTES) return null;
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function handleCreateRoom(request: Request, env: Env): Promise<Response> {
  const raw = await readJsonBody(request);
  if (raw === null) return apiError("BAD_REQUEST", 400);
  const parsed = CreateRoomBodySchema.safeParse(raw);
  if (!parsed.success) return apiError("BAD_REQUEST", 400);

  const result = await allocateRoom(
    (code) => env.ROOM.getByName(code),
    parsed.data.nickname,
    cryptoRandInt,
    Date.now(),
    parsed.data.testMode === true,
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

async function handlePreview(code: string, env: Env): Promise<Response> {
  if (!isRoomCode(code)) return apiError("ROOM_NOT_FOUND", 404);
  const preview = await env.ROOM.getByName(code).preview(Date.now());
  if (preview === null) return apiError("ROOM_NOT_FOUND", 404);
  return json(preview);
}

async function handleJoin(code: string, request: Request, env: Env): Promise<Response> {
  if (!isRoomCode(code)) return apiError("ROOM_NOT_FOUND", 404);
  const raw = await readJsonBody(request);
  if (raw === null) return apiError("BAD_REQUEST", 400);
  const parsed = JoinRoomBodySchema.safeParse(raw);
  if (!parsed.success) return apiError("BAD_REQUEST", 400);

  const result = await env.ROOM.getByName(code).join({ nickname: parsed.data.nickname, now: Date.now() });
  if (result.ok) {
    const body: JoinRoomResponse = { token: result.token, seat: result.seat };
    return json(body);
  }
  switch (result.error) {
    case "ROOM_NOT_FOUND":
      return apiError("ROOM_NOT_FOUND", 404);
    case "ROOM_FULL":
    case "GAME_STARTED":
    case "NICKNAME_TAKEN":
      return apiError(result.error, 409);
    case "NICKNAME_INVALID":
      return apiError("NICKNAME_INVALID", 400);
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
    const join = JOIN_PATH.exec(pathname);
    if (join && request.method === "POST") return handleJoin(join[1]!, request, env);
    const preview = PREVIEW_PATH.exec(pathname);
    if (preview && request.method === "GET") return handlePreview(preview[1]!, env);
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

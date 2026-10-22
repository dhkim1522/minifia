import type { ApiError, ApiErrorCode, CreateRoomResponse } from "../../shared/protocol";

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiErrorCode | "NETWORK" };

const API_ERROR_CODES: readonly string[] = [
  "BAD_REQUEST",
  "NOT_FOUND",
  "ROOM_NOT_FOUND",
  "ROOM_FULL",
  "GAME_STARTED",
  "NICKNAME_INVALID",
  "NICKNAME_TAKEN",
  "CODE_EXHAUSTED",
] satisfies ApiErrorCode[];

function isApiError(v: unknown): v is ApiError {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as { error?: unknown }).error === "string" &&
    API_ERROR_CODES.includes((v as { error: string }).error)
  );
}

async function postJson<T>(path: string, body: unknown): Promise<ApiResult<T>> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, error: "NETWORK" };
  }
  let data: unknown;
  try {
    data = await res.json();
  } catch {
    return { ok: false, error: "NETWORK" };
  }
  if (res.ok) return { ok: true, data: data as T };
  return { ok: false, error: isApiError(data) ? data.error : "NETWORK" };
}

export function createRoom(nickname: string): Promise<ApiResult<CreateRoomResponse>> {
  return postJson<CreateRoomResponse>("/api/rooms", { nickname });
}

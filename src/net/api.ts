import type { ApiError, ApiErrorCode, CreateRoomResponse, JoinRoomResponse, RoomPreview } from "../../shared/protocol";

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

async function request<T>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
  let res: Response;
  try {
    res = await fetch(path, init);
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

function postJson<T>(path: string, body: unknown): Promise<ApiResult<T>> {
  return request<T>(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function getJson<T>(path: string): Promise<ApiResult<T>> {
  return request<T>(path, { method: "GET" });
}

export function createRoom(nickname: string): Promise<ApiResult<CreateRoomResponse>> {
  return postJson<CreateRoomResponse>("/api/rooms", { nickname });
}

// 비인증 미리보기. 4자리 코드로 누구나 받는 응답이고, 앉은 사람의 자리·닉네임만 들어 있다.
export function getPreview(code: string): Promise<ApiResult<RoomPreview>> {
  return getJson<RoomPreview>(`/api/rooms/${code}`);
}

export function joinRoom(code: string, nickname: string): Promise<ApiResult<JoinRoomResponse>> {
  return postJson<JoinRoomResponse>(`/api/rooms/${code}/join`, { nickname });
}

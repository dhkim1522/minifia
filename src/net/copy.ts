// 오류·안내 문구 매핑. 문구와 위치는 UI-SPEC Copywriting Contract 의 Error state 표가 정본이다.
// 닫힌 코드 집합(api.ts 의 API_ERROR_CODES)만 문구로 바꾸고, 그 맥락에서 나올 수 없는 코드나
// 알 수 없는 응답은 서버 내부 정보를 드러내지 않도록 "연결이 불안정해요" 로 접는다(T-01-18).
import type { NicknameError } from "../../shared/nickname";
import type { ApiErrorCode } from "../../shared/protocol";

/** 문구가 나올 자리: 닉네임 칸 아래 · 코드 칸 아래 · 입력 카드 대신 · 화면 아래 토스트. */
export type MessagePlace = "nickname" | "code" | "card" | "toast";
type Message = { place: MessagePlace; text: string };
type Context = "create" | "home-code" | "link";

const NETWORK_TEXT = "연결이 불안정해요. 다시 시도해 주세요";
const NICKNAME_RANGE_TEXT = "1~8자로 입력해 주세요";

const NETWORK_MESSAGE: Message = { place: "toast", text: NETWORK_TEXT };

// 방 상태 오류: 첫 화면의 코드 입력은 코드 칸 아래, 링크 참가는 입력 카드 대신. 방 만들기에서는 나올 수 없다.
function roomStateMessage(context: Context, text: string, codeText: string = text): Message {
  if (context === "home-code") return { place: "code", text: codeText };
  if (context === "link") return { place: "card", text };
  return NETWORK_MESSAGE;
}

export function messageForApiError(error: ApiErrorCode | "NETWORK", context: Context): Message {
  switch (error) {
    case "NICKNAME_INVALID":
      return { place: "nickname", text: NICKNAME_RANGE_TEXT };
    case "NICKNAME_TAKEN":
      return { place: "nickname", text: "같은 이름이 이미 있어요" };
    case "ROOM_NOT_FOUND":
      return roomStateMessage(context, "방을 찾을 수 없어요", "방을 찾을 수 없어요. 코드를 다시 확인해 주세요");
    case "ROOM_FULL":
      return roomStateMessage(context, "이미 8명이 모였어요");
    case "GAME_STARTED":
      return roomStateMessage(context, "이미 게임이 시작된 방이에요");
    case "CODE_EXHAUSTED":
      return context === "create"
        ? { place: "toast", text: "지금은 방을 만들 수 없어요. 잠시 후 다시 해 주세요" }
        : NETWORK_MESSAGE;
    case "NETWORK":
    case "BAD_REQUEST":
    case "NOT_FOUND":
    default:
      return NETWORK_MESSAGE;
  }
}

export function nicknameErrorText(reason: NicknameError): string {
  return reason === "INVALID_CHARS" ? "쓸 수 없는 글자가 있어요" : NICKNAME_RANGE_TEXT;
}

export function exitReasonText(reason: "kicked" | "room_closed" | "invalid_token"): string {
  switch (reason) {
    case "kicked":
      return "방장이 방에서 내보냈어요";
    case "room_closed":
      return "방이 닫혔어요";
    case "invalid_token":
      return "이 방의 입장 정보가 없어요. 다시 들어와 주세요";
  }
}

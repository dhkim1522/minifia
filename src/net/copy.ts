// RED 단계의 뼈대: 테스트가 로드되어 단언에서 실패하도록 빈 문구를 돌려준다. GREEN 에서 문구를 채운다.
import type { NicknameError } from "../../shared/nickname";
import type { ApiErrorCode } from "../../shared/protocol";

export type MessagePlace = "nickname" | "code" | "card" | "toast";

export function messageForApiError(
  _error: ApiErrorCode | "NETWORK",
  _context: "create" | "home-code" | "link",
): { place: MessagePlace; text: string } {
  return { place: "toast", text: "" };
}

export function nicknameErrorText(_reason: NicknameError): string {
  return "";
}

export function exitReasonText(_reason: "kicked" | "room_closed" | "invalid_token"): string {
  return "";
}

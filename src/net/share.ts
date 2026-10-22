// RED 단계의 자리표시 구현. 다음 커밋(feat)에서 채운다.
export type ShareOutcome = "shared" | "copied" | "manual" | "cancelled";
export interface ShareInput {
  title: string;
  text: string;
  url: string;
}
export interface ShareNavigator {
  share?: (data: ShareInput) => Promise<void>;
  canShare?: (data: ShareInput) => boolean;
  clipboard?: { writeText(text: string): Promise<void> };
}

export function buildRoomLink(_origin: string, _code: string): string {
  return "";
}

export function buildShareText(_hostNickname: string, _code: string): string {
  return "";
}

export async function shareRoom(_input: { nav: ShareNavigator } & ShareInput): Promise<ShareOutcome> {
  return "manual";
}

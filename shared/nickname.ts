// RED 단계의 자리표시 구현: 시그니처만 있고 규칙은 아직 없다. 다음 커밋(feat)에서 채운다.
export const NICKNAME_MAX_GRAPHEMES = 8;
export type NicknameError = "EMPTY" | "TOO_LONG" | "INVALID_CHARS";

export function countGraphemes(s: string): number {
  return s.length;
}

export function normalizeNickname(raw: string): string {
  return raw;
}

export function nicknameKey(nickname: string): string {
  return nickname;
}

export function validateNickname(
  raw: string,
): { ok: true; nickname: string; key: string } | { ok: false; reason: NicknameError } {
  return { ok: true, nickname: raw, key: raw };
}

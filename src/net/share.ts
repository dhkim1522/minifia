// 방 링크 공유: Web Share → 클립보드 복사 → 수동(화면이 링크를 선택 가능한 입력칸으로 보여 줌).
// navigator 는 인자로만 받는다(전역을 직접 읽지 않는다). 단위 테스트가 node 에서 돌고,
// HTTP(LAN 개발)에서는 share·clipboard 가 둘 다 없을 수 있다.
// 공유 데이터에는 title·text·url 만 넣는다. 토큰·세션 값은 절대 넣지 않는다.

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

export function buildRoomLink(origin: string, code: string): string {
  return `${origin}/r/${code}`;
}

export function buildShareText(hostNickname: string, code: string): string {
  return `${hostNickname}님의 마피아 방에 들어오세요 (코드 ${code})`;
}

function isAbort(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { name?: unknown }).name === "AbortError";
}

async function runShare({ nav, title, text, url }: { nav: ShareNavigator } & ShareInput): Promise<ShareOutcome> {
  const data: ShareInput = { title, text, url };

  if (nav.share && (nav.canShare === undefined || nav.canShare(data))) {
    try {
      await nav.share(data);
      return "shared";
    } catch (error) {
      if (isAbort(error)) return "cancelled";
      // 그 밖의 공유 실패는 클립보드로 넘어간다.
    }
  }

  if (nav.clipboard) {
    try {
      await nav.clipboard.writeText(url);
      return "copied";
    } catch {
      // 클립보드도 거부되면 수동 안내로 넘어간다.
    }
  }

  return "manual";
}

export function shareRoom(input: { nav: ShareNavigator } & ShareInput): Promise<ShareOutcome> {
  return runShare(input);
}

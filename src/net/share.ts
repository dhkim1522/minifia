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

export function canWebShare(nav: ShareNavigator): boolean {
  return typeof nav.share === "function";
}

// 공유 시트만 연다. 클립보드로 넘어가지 않는다 — 화면이 [공유하기]·[링크 복사] 를 따로 보여 주기 때문이다.
// 호출은 버튼 클릭 처리기의 첫 await 앞에서 해야 iOS 가 사용자 제스처로 인정한다(Pitfall 6): 이 함수는 첫 줄에서 nav.share 를 바로 부른다.
export function shareOnly(nav: ShareNavigator, data: ShareInput): Promise<"shared" | "cancelled" | "failed"> {
  return runShareOnly(nav, data);
}

async function runShareOnly(nav: ShareNavigator, data: ShareInput): Promise<"shared" | "cancelled" | "failed"> {
  const payload: ShareInput = { title: data.title, text: data.text, url: data.url };
  if (!nav.share || (nav.canShare !== undefined && !nav.canShare(payload))) return "failed";
  try {
    await nav.share(payload);
    return "shared";
  } catch (error) {
    return isAbort(error) ? "cancelled" : "failed";
  }
}

// 클립보드 복사만. writeText 도 클릭 처리기 첫 줄에서 불러야 한다.
export function copyLink(nav: ShareNavigator, url: string): Promise<"copied" | "failed"> {
  return runCopyLink(nav, url);
}

async function runCopyLink(nav: ShareNavigator, url: string): Promise<"copied" | "failed"> {
  if (!nav.clipboard) return "failed";
  try {
    await nav.clipboard.writeText(url);
    return "copied";
  } catch {
    return "failed";
  }
}

// 공유 → 복사 → 수동 3단 체인. 위 둘을 엮을 뿐이다(01-03 동작 유지).
async function runShare({ nav, title, text, url }: { nav: ShareNavigator } & ShareInput): Promise<ShareOutcome> {
  const shared = await shareOnly(nav, { title, text, url });
  if (shared === "shared" || shared === "cancelled") return shared;
  return (await copyLink(nav, url)) === "copied" ? "copied" : "manual";
}

export function shareRoom(input: { nav: ShareNavigator } & ShareInput): Promise<ShareOutcome> {
  return runShare(input);
}

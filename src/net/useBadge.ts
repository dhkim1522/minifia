// 직업 주장 배지의 상태와 효과 (09.1.1-08, UI-SPEC A-1·A-2).
//
// useBadge — 칩 시트 열림, 내 낙관 값, 칩 한 번에 서버로 {t:"badge", role}, 거절 되돌림.
//   서버 값 = view.players[내 좌석].badge ?? "none". 낙관 값은 useViewChoice 라서 새 서버 view 가 오면 서버 값이 이긴다.
//   pick: 같은 값이면 보내지 않고 닫기만, 아니면 send 가 false 가 아닐 때 낙관 값을 바꾸고 BADGE_CLOSE_MS 뒤 닫는다.
//   rejected 번호가 늘면(오류 프레임 = 마감 직후 거절) 서버 값으로 되돌린다. 서버 view 가 같은 값을 확인하면 거절 대기(SendGuard)를 푼다.
//   이 훅이 서버로 보내는 메시지는 badge 뿐이다. 연결이 끊긴 동안(canSend false)과 주장 창이 아닌 단계에서는 아무 일도 하지 않는다.
import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import type { BadgeId, ClientMessage, RoomView } from "../../shared/protocol";
import { BADGE_CLOSE_MS, floatVisible, myClaim } from "../game/badgeView";
import type { SendGuard } from "./useSendGuard";
import { useViewChoice } from "./useViewChoice";

export interface UseBadgeOptions {
  view: RoomView;
  /** 보냈으면 true, 소켓이 닫혀 못 보냈으면 false. 반환값이 없는 함수(void)는 보낸 것으로 본다 */
  send: (msg: ClientMessage) => boolean | void;
  /** 연결이 열려 서버로 보낼 수 있는가. 기본 true */
  canSend?: boolean;
  /** 서버가 행동을 거절한 횟수. 늘어나면 낙관 값을 서버 값으로 되돌린다 */
  rejected?: number;
  /** 보낸 행동의 거절을 알아보는 기억(GameMap 의 오류 프레임 구독이 읽는다) */
  guard: SendGuard;
}

export interface BadgeApi {
  /** 떠 있는 버튼·시트를 낼 수 있는 단계인가 */
  allowed: boolean;
  open: boolean;
  setOpen: (open: boolean) => void;
  /** 떠 있는 버튼을 눌렀다 — 열고 닫는다 */
  toggle: () => void;
  /** 내 지금 주장(낙관 값. 서버가 확인하거나 거절하면 서버 값) */
  shown: BadgeId;
  /** 서버가 알려 준 내 주장 */
  server: BadgeId;
  pick: (role: BadgeId) => void;
  /** 떠 있는 버튼 요소에 붙인다 — 시트를 닫으면 초점이 여기로 돌아온다 */
  buttonRef: RefObject<HTMLButtonElement | null>;
}

export function useBadge({ view, send, canSend = true, rejected = 0, guard }: UseBadgeOptions): BadgeApi {
  const allowed = floatVisible(view);
  const server = myClaim(view);
  const [chosen, choose] = useViewChoice<BadgeId>(view, server);
  const shown: BadgeId = chosen ?? server;
  const [open, setOpen] = useState(false);
  const sentRef = useRef<BadgeId | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  // 서버가 내가 보낸 값을 확인했으면 거절을 더는 기다리지 않는다
  useEffect(() => {
    if (sentRef.current !== null && server === sentRef.current) {
      sentRef.current = null;
      guard.clear("badge");
    }
  }, [server, guard]);

  // 거절(번호 증가) = 서버 값으로 되돌림
  const seenRejected = useRef(rejected);
  useEffect(() => {
    if (seenRejected.current === rejected) return;
    seenRejected.current = rejected;
    sentRef.current = null;
    choose(server);
    // choose 는 렌더마다 새 함수지만 setState 만 부른다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rejected]);

  // 주장 창이 끝나거나 내가 탈락하면 시트가 닫힌다
  useEffect(() => {
    if (!allowed && open) setOpen(false);
  }, [allowed, open]);

  // 닫으면 초점이 떠 있는 버튼으로 돌아온다(UI-SPEC 접근성). 버튼이 사라졌으면(단계 끝) 할 일이 없다
  const wasOpen = useRef(false);
  useEffect(() => {
    if (wasOpen.current && !open) buttonRef.current?.focus({ preventScroll: true });
    wasOpen.current = open;
  }, [open]);

  useEffect(() => () => clearTimeout(timer.current), []);

  const closeSoon = (): void => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(false), BADGE_CLOSE_MS);
  };

  const pick = (role: BadgeId): void => {
    if (!canSend || !allowed) return;
    if (role === shown) {
      closeSoon(); // 같은 칩: 보내지 않는다
      return;
    }
    if (send({ t: "badge", role }) === false) return; // 소켓이 닫혀 못 보냈으면 표시도 바꾸지 않는다
    sentRef.current = role;
    guard.mark("badge");
    choose(role);
    closeSoon();
  };

  const toggle = (): void => {
    if (!canSend || !allowed) return;
    clearTimeout(timer.current);
    setOpen((o) => !o);
  };

  return { allowed, open, setOpen, toggle, shown, server, pick, buttonRef };
}

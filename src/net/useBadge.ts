// 직업 주장 배지의 상태와 효과 (09.1.1-08, UI-SPEC A-1·A-2).
//
// useBadge — 칩 시트 열림, 내 낙관 값, 칩 한 번에 서버로 {t:"badge", role}, 거절 되돌림.
//   서버 값 = view.players[내 좌석].badge ?? "none". 낙관 값은 useViewChoice 라서 새 서버 view 가 오면 서버 값이 이긴다.
//   pick: 같은 값이면 보내지 않고 닫기만, 아니면 send 가 false 가 아닐 때 낙관 값을 바꾸고 BADGE_CLOSE_MS 뒤 닫는다.
//   rejected 번호가 늘면(오류 프레임 = 마감 직후 거절) 서버 값으로 되돌린다. 서버 view 가 같은 값을 확인하면 거절 대기(SendGuard)를 푼다.
//   이 훅이 서버로 보내는 메시지는 badge 뿐이다. 연결이 끊긴 동안(canSend false)과 주장 창이 아닌 단계에서는 아무 일도 하지 않는다.
//
// useBadgeFx — 이전 view 와 비교한 효과(팝·"말 바꿈" 알약·live 한 줄). 첫 스냅샷·재접속·연결 번호(epoch) 바뀜은 이펙트 없이 현재 상태로 바로 그린다.
//   알약은 BADGE_NOTICE_MS 뒤 사라진다(모션 줄이기가 아니면 페이드 BADGE_NOTICE_FADE_MS 만큼 더). 표는 렌더 중 view 차이로 정한다(useDayFx 와 같은 "이전 값 기억" 방식).
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import type { BadgeId, ClientMessage, RoomView } from "../../shared/protocol";
import { BADGE_CLOSE_MS, BADGE_NOTICE_FADE_MS, BADGE_NOTICE_MS, badgeFxOf, floatVisible, myClaim, sayLine } from "../game/badgeView";
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

export interface BadgeFxState {
  /** 좌석 → 팝 횟수(바뀔 때마다 늘어난다). 첫 스냅샷 때는 비어 있다 */
  pops: ReadonlyMap<number, number>;
  /** 좌석 → "말 바꿈" 알약 번호. 있는 동안만 알약을 그린다 */
  notices: ReadonlyMap<number, number>;
  /** 화면에 안 보이는 live 한 줄. 바뀐 순간에만 생긴다 */
  said: string;
}

const NO_MAP: ReadonlyMap<number, number> = new Map();

export function useBadgeFx(view: RoomView, epoch: number, reducedMotion: boolean): BadgeFxState {
  const [pops, setPops] = useState<ReadonlyMap<number, number>>(NO_MAP);
  const [notices, setNotices] = useState<ReadonlyMap<number, number>>(NO_MAP);
  const [said, setSaid] = useState("");
  const [seen, setSeen] = useState<{ view: RoomView; epoch: number }>({ view, epoch });
  if (seen.view !== view || seen.epoch !== epoch) {
    const reset = seen.epoch !== epoch;
    setSeen({ view, epoch });
    const fx = badgeFxOf(reset ? null : seen.view, view);
    if (reset) {
      setPops(NO_MAP);
      setNotices(NO_MAP);
      setSaid("");
    }
    if (fx.pop.length > 0) {
      setPops((m) => {
        const next = new Map(m);
        for (const seat of fx.pop) next.set(seat, (m.get(seat) ?? 0) + 1);
        return next;
      });
    }
    if (fx.notice.length > 0) {
      setNotices((m) => {
        const next = new Map(m);
        for (const seat of fx.notice) next.set(seat, (m.get(seat) ?? 0) + 1);
        return next;
      });
    }
    const last = fx.said[fx.said.length - 1];
    if (last !== undefined) {
      const nickname = view.players.find((p) => p.seat === last.seat)?.nickname ?? "";
      setSaid(sayLine(nickname, last.claim));
    }
  }

  // 알약 타이머: 좌석마다 번호가 바뀐 때만 새로 건다. 같은 좌석의 새 알약은 이전 타이머를 끊고 다시 센다
  const timers = useRef(new Map<number, { nonce: number; id: ReturnType<typeof setTimeout> }>());
  useLayoutEffect(() => {
    const live = timers.current;
    for (const [seat, nonce] of notices) {
      const cur = live.get(seat);
      if (cur !== undefined && cur.nonce === nonce) continue;
      if (cur !== undefined) clearTimeout(cur.id);
      const id = setTimeout(
        () => {
          live.delete(seat);
          setNotices((m) => {
            if (m.get(seat) !== nonce) return m;
            const next = new Map(m);
            next.delete(seat);
            return next;
          });
        },
        BADGE_NOTICE_MS + (reducedMotion ? 0 : BADGE_NOTICE_FADE_MS),
      );
      live.set(seat, { nonce, id });
    }
  }, [notices, reducedMotion]);
  useEffect(() => {
    const live = timers.current;
    return () => {
      for (const t of live.values()) clearTimeout(t.id);
      live.clear();
    };
  }, []);

  return { pops, notices, said };
}

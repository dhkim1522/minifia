// 낮 토론에서 폰이 받은 chat·emoji 이벤트로만 만드는 화면 상태 훅 묶음(결정 0017-2·0017-7). 서버 뷰에는 메시지가 없다.
// 규칙:
//  - 이벤트에서만 만든다. 재접속·새로고침으로 처음 마운트하면 지난 줄·반전·이모티콘은 복원되지 않는다.
//  - 단계가 discussion 일 때 온 이벤트만 받는다. discussion 을 벗어나면 모두 비운다.
//  - 보낸 사람 반전(spoke)은 chat 이벤트 후 SPOKE_MS, 이모티콘은 emoji 이벤트 후 EMOJI_MS. 받은 순간의 로컬 시각 기준이다.
//  - 반전과 이모티콘은 서로 지우지 않는다(하나는 이름표, 하나는 머리 위). 같은 자리 새 이벤트는 이전 것을 바꾸고
//    key 가 달라져 애니메이션이 새로 시작한다. 나중에 처리한 것의 z 가 더 크다.
//  - 채팅 줄(useDayChat)은 허용 키만 필드별로 복사하고, 본 최대 seq 이하·모르는 템플릿은 버리며, 일차(view.day.n)가 바뀌면 비운다.
import { useEffect, useRef, useState } from "react";
import { ROLE_IDS } from "../../shared/game/roles";
import { TEMPLATE_IDS } from "../../shared/protocol";
import type { ChatLine, EmojiId, RoomView } from "../../shared/protocol";
import type { RoomConnection } from "./useRoomConnection";

/** 보낸 사람 이름표 윗줄이 반전되어 있는 시간 */
export const SPOKE_MS = 3_000;
/** 이모티콘이 떠 있는 시간 */
export const EMOJI_MS = 2_000;

export interface SeatEmoji {
  icon: EmojiId;
  key: string;
  z: number;
  until: number;
}
export interface SeatSpoke {
  key: string;
  until: number;
}
export interface SeatFloats {
  emoji: Readonly<Record<number, SeatEmoji>>;
  spoke: Readonly<Record<number, SeatSpoke>>;
}

const EMPTY: SeatFloats = { emoji: {}, spoke: {} };

const isEmpty = (f: SeatFloats): boolean => Object.keys(f.emoji).length === 0 && Object.keys(f.spoke).length === 0;

/** until 이 now 이하인 것을 걷어낸 새 객체. 바뀐 게 없으면 같은 객체. */
function expire(prev: SeatFloats, now: number): SeatFloats {
  const keep = <T extends { until: number }>(m: Readonly<Record<number, T>>): Record<number, T> =>
    Object.fromEntries(Object.entries(m).filter(([, v]) => v.until > now)) as Record<number, T>;
  const emoji = keep(prev.emoji);
  const spoke = keep(prev.spoke);
  return Object.keys(emoji).length === Object.keys(prev.emoji).length && Object.keys(spoke).length === Object.keys(prev.spoke).length
    ? prev
    : { emoji, spoke };
}

export function useSeatFloats(view: RoomView | null, onEvent: RoomConnection["onEvent"]): SeatFloats {
  const [floats, setFloats] = useState<SeatFloats>(EMPTY);
  const zRef = useRef(0);
  const inDiscussion = view?.phase === "discussion";
  const inDiscussionRef = useRef(inDiscussion);
  inDiscussionRef.current = inDiscussion;

  // 단계 전환 정리: discussion 을 벗어나면 모두 비운다
  useEffect(() => {
    if (!inDiscussion) setFloats((prev) => (isEmpty(prev) ? prev : EMPTY));
  }, [inDiscussion]);

  // chat → 보낸 사람 반전, emoji → 머리 위 이모티콘. 상태로 쌓지 않고 훅 안에서만 받는다.
  useEffect(() => {
    return onEvent((e) => {
      if (!inDiscussionRef.current) return;
      if (e.t === "chat") {
        zRef.current += 1;
        const spoke: SeatSpoke = { key: `spoke-${zRef.current}`, until: Date.now() + SPOKE_MS };
        setFloats((prev) => ({ ...prev, spoke: { ...prev.spoke, [e.seat]: spoke } }));
      } else if (e.t === "emoji") {
        zRef.current += 1;
        const z = zRef.current;
        const emoji: SeatEmoji = { icon: e.icon, key: `emoji-${z}`, z, until: Date.now() + EMOJI_MS };
        setFloats((prev) => ({ ...prev, emoji: { ...prev.emoji, [e.seat]: emoji } }));
      }
    });
  }, [onEvent]);

  // 가장 이른 until 에 맞춘 타이머 하나로 만료된 것을 지운다
  useEffect(() => {
    const untils = [...Object.values(floats.emoji), ...Object.values(floats.spoke)].map((f) => f.until);
    if (untils.length === 0) return;
    const timer = setTimeout(() => {
      setFloats((prev) => expire(prev, Date.now()));
    }, Math.max(0, Math.min(...untils) - Date.now()));
    return () => clearTimeout(timer);
  }, [floats]);

  return floats;
}

interface DayChatState {
  n: number | undefined;
  maxSeq: number;
  lines: ChatLine[];
}

/** 프레임에서 허용 키만 필드별로 복사한 줄. 모르는 템플릿·형식이 다른 값이면 null. */
function toChatLine(e: { seq?: unknown; seat?: unknown; template?: unknown; target?: unknown; claimedRole?: unknown; at?: unknown }): ChatLine | null {
  const { seq, seat, template, target, claimedRole, at } = e;
  if (typeof seq !== "number" || typeof seat !== "number" || typeof at !== "number") return null;
  if (!(TEMPLATE_IDS as readonly unknown[]).includes(template)) return null;
  const line: ChatLine = { seq, seat, template: template as ChatLine["template"], at };
  if (typeof target === "number") line.target = target;
  if ((ROLE_IDS as readonly unknown[]).includes(claimedRole)) line.claimedRole = claimedRole as NonNullable<ChatLine["claimedRole"]>;
  return line;
}

/** 이 폰이 그날 discussion 중에 받은 chat 이벤트의 줄. 재접속·새로고침 때는 빈 목록에서 시작한다. */
export function useDayChat(view: RoomView | null, onEvent: RoomConnection["onEvent"]): ChatLine[] {
  const n = view?.day?.n;
  const [state, setState] = useState<DayChatState>({ n, maxSeq: -1, lines: [] });
  const nRef = useRef(n);
  nRef.current = n;
  const inDiscussionRef = useRef(view?.phase === "discussion");
  inDiscussionRef.current = view?.phase === "discussion";

  useEffect(() => {
    return onEvent((e) => {
      if (e.t !== "chat" || !inDiscussionRef.current) return;
      const line = toChatLine(e);
      if (!line) return;
      setState((prev) => {
        const base: DayChatState = prev.n === nRef.current ? prev : { n: nRef.current, maxSeq: -1, lines: [] };
        if (line.seq <= base.maxSeq) return base === prev ? prev : base;
        return { n: base.n, maxSeq: line.seq, lines: [...base.lines, line] };
      });
    });
  }, [onEvent]);

  // 일차가 바뀌었는데 아직 새 이벤트가 없으면 이전 일차의 줄을 보이지 않는다
  return state.n === n ? (state.lines) : [];
}

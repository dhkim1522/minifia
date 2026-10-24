// 낮 토론과 밤에 폰이 받은 chat·emoji 이벤트로만 만드는 화면 상태 훅 묶음(결정 0017-2·0017-7·0019). 서버 뷰에는 메시지가 없다.
// 규칙:
//  - 이벤트에서만 만든다. 재접속·새로고침으로 처음 마운트하면 지난 줄·반전·이모티콘은 복원되지 않는다.
//  - 단계가 discussion·night(CHAT_PHASES)일 때 온 이벤트만 받는다. 밤 이벤트는 서버가 살아 있는 마피아와 관전자에게만 보낸다 —
//    화면은 역할로 다시 거르지 않는다(결정 0002·0021). 단계나 일차가 바뀌면(낮 → 밤, 밤 → 아침) 줄·반전·이모티콘을 모두 비운다.
//  - 보낸 사람 반전(spoke)은 chat 이벤트 후 SPOKE_MS, 이모티콘은 emoji 이벤트 후 EMOJI_MS. 받은 순간의 로컬 시각 기준이다.
//  - 반전과 이모티콘은 서로 지우지 않는다(하나는 이름표, 하나는 머리 위). 같은 자리 새 이벤트는 이전 것을 바꾸고
//    key 가 달라져 애니메이션이 새로 시작한다. 나중에 처리한 것의 z 가 더 크다.
//  - 채팅 줄(useDayChat)은 허용 키만 필드별로 복사하고, 본 최대 seq 이하·모르는 템플릿은 버리며, 일차(view.day.n)나 단계가 바뀌면 비운다.
//    밤 줄 번호는 낮과 따로 1부터 다시 센다(서버 nextNightSeq) — 단계마다 중복 제거 기준(maxSeq)이 따로다.
import { useEffect, useRef, useState } from "react";
import { ROLE_IDS } from "../../shared/game/roles";
import { TEMPLATE_IDS } from "../../shared/protocol";
import type { ChatLine, EmojiId, PhaseId, RoomView } from "../../shared/protocol";
import type { RoomConnection } from "./useRoomConnection";

/** chat·emoji 이벤트를 받는 단계: 낮 토론과 밤(D-17). 그 밖의 단계에서 온 이벤트는 버린다 */
export const CHAT_PHASES: ReadonlySet<PhaseId> = new Set<PhaseId>(["discussion", "night"]);

/** 수집 단계일 때만 있는 열쇠 `${일차}:${단계}`. 열쇠가 바뀌면(단계·일차) 지난 줄·반전·이모티콘을 비운다 */
function chatKey(view: RoomView | null): string | undefined {
  return view !== null && CHAT_PHASES.has(view.phase) ? `${view.day?.n}:${view.phase}` : undefined;
}

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
  const key = chatKey(view);
  const collecting = useRef(key !== undefined);
  collecting.current = key !== undefined;

  // 단계·일차 전환 정리: 수집 열쇠가 바뀌거나 수집 단계를 벗어나면 모두 비운다(낮 → 밤, 밤 → 아침)
  useEffect(() => {
    setFloats((prev) => (isEmpty(prev) ? prev : EMPTY));
  }, [key]);

  // chat → 보낸 사람 반전, emoji → 머리 위 이모티콘. 상태로 쌓지 않고 훅 안에서만 받는다.
  useEffect(() => {
    return onEvent((e) => {
      if (!collecting.current) return;
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
  key: string | undefined;
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

/** 이 폰이 그 일차 그 단계(낮 토론·밤)에 받은 chat 이벤트의 줄. 재접속·새로고침 때는 빈 목록에서 시작하고, 단계가 바뀌면 비운다. */
export function useDayChat(view: RoomView | null, onEvent: RoomConnection["onEvent"]): ChatLine[] {
  const key = chatKey(view);
  const [state, setState] = useState<DayChatState>({ key, maxSeq: -1, lines: [] });
  const keyRef = useRef(key);
  keyRef.current = key;

  useEffect(() => {
    return onEvent((e) => {
      if (e.t !== "chat" || keyRef.current === undefined) return;
      const line = toChatLine(e);
      if (!line) return;
      setState((prev) => {
        const base: DayChatState = prev.key === keyRef.current ? prev : { key: keyRef.current, maxSeq: -1, lines: [] };
        if (line.seq <= base.maxSeq) return base === prev ? prev : base;
        return { key: base.key, maxSeq: line.seq, lines: [...base.lines, line] };
      });
    });
  }, [onEvent]);

  // 열쇠가 바뀌었는데 아직 새 이벤트가 없으면 이전 단계의 줄을 보이지 않는다
  return key !== undefined && state.key === key ? state.lines : [];
}

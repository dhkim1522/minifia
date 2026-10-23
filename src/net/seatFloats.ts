// 자리별 떠 있는 것(말풍선·이모티콘) 상태 훅. 화면 부품(SeatFloat)과 분리해 시간 규칙만 계산한다(D-15, D-16).
// 규칙:
//  - 자리마다 한 번에 하나. 같은 자리에 새 것이 오면 이전 것을 바꾼다. 나중에 처리한 것의 z 가 더 크다.
//  - 말풍선은 view.day.messages 에서 이전에 본 seq 보다 큰 줄만 새로 처리한다. 남은 시간은 서버 시각끼리
//    BUBBLE_MS − (view.serverNow − line.at) 로 구하므로 시계 오프셋이 필요 없다. 0 이하면 건너뛴다.
//    첫 렌더(재접속)는 본 seq 가 없어 3초가 안 지난 줄만 남은 시간만큼 복원된다.
//  - 이모티콘은 서버 시각 기준점이 없어 받은 순간의 로컬 시각 + EMOJI_MS 로 둔다. 재접속 때 복원하지 않는다.
//  - 단계가 discussion 이 아니면 모두 비운다.
import { useEffect, useRef, useState } from "react";
import type { ChatLine, EmojiId, RoomView } from "../../shared/protocol";
import type { RoomConnection } from "./useRoomConnection";

/** 말풍선이 떠 있는 시간(UI-SPEC SeatFloat 지역 상수) */
export const BUBBLE_MS = 3_000;
/** 이모티콘이 떠 있는 시간 */
export const EMOJI_MS = 2_000;

export type SeatFloatState =
  | { kind: "bubble"; line: ChatLine; key: string; until: number; elapsedMs: number; z: number }
  | { kind: "emoji"; icon: EmojiId; key: string; until: number; elapsedMs: number; z: number };

type Floats = Readonly<Record<number, SeatFloatState>>;

/** lastSeq 보다 새롭고 아직 3초가 안 지난 줄과 그 남은 시간(ms). seq 오름차순. 시간·상태에 의존하지 않는다. */
function freshBubbles(lines: readonly ChatLine[], lastSeq: number, serverNow: number): { line: ChatLine; remaining: number }[] {
  return lines
    .filter((l) => l.seq > lastSeq)
    .sort((a, b) => a.seq - b.seq)
    .map((line) => ({ line, remaining: BUBBLE_MS - (serverNow - line.at) }))
    .filter((e) => e.remaining > 0);
}

export function useSeatFloats(view: RoomView | null, onEvent: RoomConnection["onEvent"]): Floats {
  const [floats, setFloats] = useState<Floats>({});
  const lastSeqRef = useRef(-1);
  const zRef = useRef(0);
  const inDiscussionRef = useRef(view?.phase === "discussion");
  inDiscussionRef.current = view?.phase === "discussion";

  // 새 말풍선 처리 / 단계 전환 정리
  useEffect(() => {
    if (view?.phase !== "discussion") {
      lastSeqRef.current = -1; // 다음 토론에서 다시 복원 규칙(3초 안)으로 시작한다
      setFloats((prev) => (Object.keys(prev).length === 0 ? prev : {}));
      return;
    }
    const lines = view.day?.messages ?? [];
    const fresh = freshBubbles(lines, lastSeqRef.current, view.serverNow);
    for (const l of lines) lastSeqRef.current = Math.max(lastSeqRef.current, l.seq);
    if (fresh.length === 0) return;
    const localNow = Date.now();
    const next: Record<number, SeatFloatState> = {};
    for (const { line, remaining } of fresh) {
      zRef.current += 1;
      next[line.seat] = {
        kind: "bubble",
        line,
        key: `bubble-${line.seq}`,
        until: localNow + remaining,
        elapsedMs: BUBBLE_MS - remaining,
        z: zRef.current,
      };
    }
    setFloats((prev) => ({ ...prev, ...next }));
  }, [view]);

  // 이모티콘 이벤트 구독(상태로 쌓지 않고 훅 안에서만 받는다)
  useEffect(() => {
    return onEvent((e) => {
      if (e.t !== "emoji" || !inDiscussionRef.current) return;
      zRef.current += 1;
      const z = zRef.current;
      const float: SeatFloatState = {
        kind: "emoji",
        icon: e.icon,
        key: `emoji-${z}`,
        until: Date.now() + EMOJI_MS,
        elapsedMs: 0,
        z,
      };
      setFloats((prev) => ({ ...prev, [e.seat]: float }));
    });
  }, [onEvent]);

  // 가장 이른 until 에 맞춘 타이머 하나로 만료된 것을 지운다
  useEffect(() => {
    const untils = Object.values(floats).map((f) => f.until);
    if (untils.length === 0) return;
    const timer = setTimeout(() => {
      const now = Date.now();
      setFloats((prev) => {
        const kept = Object.entries(prev).filter(([, f]) => f.until > now);
        return kept.length === Object.keys(prev).length ? prev : Object.fromEntries(kept);
      });
    }, Math.max(0, Math.min(...untils) - Date.now()));
    return () => clearTimeout(timer);
  }, [floats]);

  return floats;
}

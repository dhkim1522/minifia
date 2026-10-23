// 등장·퇴장 표시 훅. 서버 이벤트를 받지 않고 직전 players 와 지금 players 의 차이로만 만든다.
// 같은 epoch 안의 변화만 전이로 표시하고, 첫 render·epoch 변경(처음 열기·재연결 직후) 때는 전이 없이 보인다.
import { useEffect, useRef, useState } from "react";
import type { PublicPlayer } from "../../shared/protocol";

export type SeatTransition = "entering" | "leaving" | null;

export const SEAT_ENTER_MS = 420;
export const SEAT_LEAVE_MS = 320;

interface Entry {
  token: number;
  player: PublicPlayer;
}
interface State {
  players: PublicPlayer[];
  epoch: number;
  entering: Record<number, Entry>;
  leaving: Record<number, Entry>;
  nextToken: number;
}

const keyOf = (p: PublicPlayer): string => `${p.seat}:${p.nickname}`;

function advance(state: State, players: PublicPlayer[], epoch: number): State {
  // 처음 열기·재연결 직후: 지난 일을 다시 보여 주지 않는다.
  if (state.epoch !== epoch) {
    return { players, epoch, entering: {}, leaving: {}, nextToken: state.nextToken };
  }
  const before = new Map(state.players.map((p) => [keyOf(p), p]));
  const after = new Map(players.map((p) => [keyOf(p), p]));
  const entering = { ...state.entering };
  const leaving = { ...state.leaving };
  let nextToken = state.nextToken;
  // 이미 진행 중인 전이 가운데 더는 맞지 않는 것을 정리한다.
  for (const [seat, e] of Object.entries(entering)) {
    if (!after.has(keyOf(e.player))) delete entering[Number(seat)];
  }
  for (const seat of Object.keys(leaving)) {
    if (players.some((p) => p.seat === Number(seat))) delete leaving[Number(seat)]; // 같은 자리에 새 사람 — 바로 뺀다
  }
  for (const p of players) {
    if (!before.has(keyOf(p))) {
      nextToken += 1;
      entering[p.seat] = { token: nextToken, player: p };
    }
  }
  for (const p of state.players) {
    if (!after.has(keyOf(p)) && !players.some((q) => q.seat === p.seat)) {
      nextToken += 1;
      leaving[p.seat] = { token: nextToken, player: p };
    }
  }
  return { players, epoch, entering, leaving, nextToken };
}

export function useSeatTransitions(
  players: PublicPlayer[],
  epoch: number,
): (PublicPlayer & { transition: SeatTransition })[] {
  const [state, setState] = useState<State>({ players, epoch, entering: {}, leaving: {}, nextToken: 0 });
  // render 중 상태 보정: effect 로 하면 새 사람이 전이 표시 없이 한 프레임 먼저 그려진다.
  if (state.players !== players || state.epoch !== epoch) {
    setState(advance(state, players, epoch));
  }

  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  useEffect(() => {
    const schedule = (entry: Entry, ms: number) => {
      if (timers.current.has(entry.token)) return;
      timers.current.set(
        entry.token,
        setTimeout(() => {
          timers.current.delete(entry.token);
          setState((s) => {
            const entering = { ...s.entering };
            const leaving = { ...s.leaving };
            for (const [seat, e] of Object.entries(entering)) if (e.token === entry.token) delete entering[Number(seat)];
            for (const [seat, e] of Object.entries(leaving)) if (e.token === entry.token) delete leaving[Number(seat)];
            return { ...s, entering, leaving };
          });
        }, ms),
      );
    };
    for (const e of Object.values(state.entering)) schedule(e, SEAT_ENTER_MS);
    for (const e of Object.values(state.leaving)) schedule(e, SEAT_LEAVE_MS);
  }, [state.entering, state.leaving]);

  // 언마운트 때 타이머를 모두 푼다.
  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const t of pending.values()) clearTimeout(t);
      pending.clear();
    };
  }, []);

  const shown = players.map((p) => ({
    ...p,
    transition: (state.entering[p.seat]?.player && keyOf(state.entering[p.seat]!.player) === keyOf(p)
      ? "entering"
      : null) as SeatTransition,
  }));
  const gone = Object.values(state.leaving)
    .filter((e) => !players.some((p) => p.seat === e.player.seat))
    .map((e) => ({ ...e.player, transition: "leaving" as SeatTransition }));
  return [...shown, ...gone];
}

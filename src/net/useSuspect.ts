// [의심] 모드에서 대상 하나에 붙이거나 뗀다. 내 대상과 전체 쌓임은 서버 응답으로 바뀐다.
//
// - 근처 판정은 서버 구간(store.segOf) — 내 예측 위치를 쓰지 않는다(D-25). 서버가 같은 구간·같은 함수로 거리를 재므로 켠 대상은 서버가 받아 준다. 판정 함수는 suspectTargets(히스테리시스 92%/100%).
// - 근처 집합은 250ms 간격으로 다시 잰다(걷는 중 이름표가 프레임마다 켜졌다 꺼지지 않게). 모드가 아닐 때도 같은 간격으로 재서 단추의 비활성(근처 0명)을 정한다.
// - 낙관 그림은 없다(P24-8): 붙었다는 확인은 서버 view(me.suspectTo·day.suspects)가 오면 3D 가 보여 준다. 이 훅은 보내고 모드만 끝낸다.
// - 땅을 눌러 걷는 것은 모드를 끝내지 않는다. 끝나는 때: 대상 고름 · 같은 단추 · Esc · 단계나 일차가 바뀜 · 내가 죽음.
// - 거절 알림은 GameMap 이 보낸다. 화면과 서버는 같은 요청 간격으로 연타를 막는다.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isAlive } from "../../shared/game/alive";
import { SUSPECT_MIN_GAP_MS } from "../../shared/game/postit";
import type { ClientMessage, RoomView } from "../../shared/protocol";
import type { Segment } from "../../shared/game/world";
import { emitSignal } from "../audio/signals";
import { suspectTargets, suspectUsed, suspectVisible } from "../game/suspectView";
import type { SendGuard } from "./useSendGuard";

/** 근처 집합을 다시 재는 간격(ms, P24-6) */
export const SUSPECT_POLL_MS = 250;

/** 붙인 사람에게만 읽히는 안내(P24-8) */
export const suspectSaid = (nickname: string): string => `${nickname} 님에게 의심을 표시했어요`;

export interface UseSuspectOptions {
  view: RoomView;
  /** 서버 구간 조회만 쓴다(WorldStore 의 segOf) */
  store: { segOf(seat: number): Segment | undefined };
  /** 서버시각 − 로컬시각(ms) */
  offset: number;
  /** 보냈으면 true, 소켓이 닫혀 못 보냈으면 false. 반환값이 없는 함수(void)는 보낸 것으로 본다 */
  send: (msg: ClientMessage) => boolean | void;
  /** 연결이 열려 서버로 보낼 수 있는가. 기본 true */
  canSend?: boolean;
  guard: SendGuard;
}

/** toggleMode 의 결과: 켰다 / 껐다 / 근처 0명이라 못 켰다(부르는 쪽이 알림을 띄운다) / 아무 일 없음(연결 끊김·보이지 않는 때) */
export type SuspectToggle = "on" | "off" | "deny" | null;

export interface SuspectApi {
  /** 다른 산 사람이 있는 생존자가 플레이 중이면 켤 수 있다. */
  visible: boolean;
  /** 붙여 둔 표시가 있는가(서버 값) */
  used: boolean;
  /** 서버 요청 간격이 지나기를 기다리는 중 */
  coolingDown: boolean;
  /** [의심] 모드(근처 캐릭터를 누르면 붙인다) */
  mode: boolean;
  /** 지금 근처의 산 사람 좌석(나 제외, 죽은 사람 제외) */
  targets: ReadonlySet<number>;
  /** 지금 누를 수 없다(연결 끊김 또는 기본 방에서 근처 0명) */
  disabled: boolean;
  toggleMode: () => SuspectToggle;
  off: () => void;
  /** 대상 고르기 — 보내고 모드를 끈다 */
  pick: (seat: number) => void;
  /** 상대에게 표시를 붙이거나 뗀다. false 는 전송 실패다. */
  change: (seat: number) => boolean | undefined;
  /** 붙인 사람에게만 읽히는 안내 문장(role="status"). 처음 마운트 때 이미 붙어 있던 것은 비어 있다 */
  said: string;
}

const sameSet = (a: ReadonlySet<number>, b: ReadonlySet<number>): boolean => a.size === b.size && [...a].every((x) => b.has(x));
const EMPTY: ReadonlySet<number> = new Set<number>();

export function useSuspect({ view, store, offset, send, canSend = true, guard }: UseSuspectOptions): SuspectApi {
  const visible = suspectVisible(view);
  const seated = view.map === "bar";
  const walkToTarget = view.playtest === true;
  const used = suspectUsed(view);
  const dayN = view.day?.n;
  const sentAt = useRef(-Infinity);
  const [coolingDown, setCoolingDown] = useState(false);
  useEffect(() => {
    if (!coolingDown) return;
    const timer = setTimeout(() => setCoolingDown(false), Math.max(0, sentAt.current + SUSPECT_MIN_GAP_MS - Date.now()));
    return () => clearTimeout(timer);
  }, [coolingDown]);
  // 간격 타이머가 최신 값을 읽게 한다(렌더마다 타이머를 다시 걸지 않는다)
  const latest = useRef({ view, store, offset });
  latest.current = { view, store, offset };
  const measure = useCallback((prev?: ReadonlySet<number>): ReadonlySet<number> => {
    const l = latest.current;
    return suspectTargets(l.view, (seat) => l.store.segOf(seat), Date.now() + l.offset, prev);
  }, []);

  const [mode, setMode] = useState(false);
  const [near, setNear] = useState<ReadonlySet<number>>(() => (visible ? measure() : EMPTY));
  const nearRef = useRef(near);
  nearRef.current = near;
  const refresh = useCallback((): ReadonlySet<number> => {
    const next = measure(nearRef.current);
    nearRef.current = next;
    setNear((cur) => (sameSet(cur, next) ? cur : next));
    return next;
  }, [measure]);

  // 이동하는 광장에서만 거리를 반복 측정한다. 재즈 바는 공개 참가자 명단을 바로 쓴다.
  useEffect(() => {
    if (!visible || seated) {
      nearRef.current = EMPTY;
      setNear(EMPTY);
      return;
    }
    refresh();
    const timer = setInterval(refresh, SUSPECT_POLL_MS);
    return () => clearInterval(timer);
  }, [visible, seated, refresh]);

  // 단계가 바뀌거나 내가 죽으면 이전의 선택 모드를 풀어 새 단계 조작과 섞이지 않게 한다.
  useEffect(() => {
    if (!visible) setMode(false);
  }, [visible]);
  useEffect(() => {
    setMode(false);
  }, [dayN, view.phase]);

  // Esc 는 모드를 끈다(PC)
  useEffect(() => {
    if (!mode) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") setMode(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mode]);

  // 대상이 죽으면 곧바로 후보에서 빠진다(간격을 기다리지 않는다)
  const players = view.players;
  const targets = useMemo<ReadonlySet<number>>(() => {
    if (!visible) return EMPTY;
    if (seated) return measure();
    const alive = new Set(players.filter((p) => isAlive(p)).map((p) => p.seat));
    const kept = [...near].filter((s) => alive.has(s));
    return kept.length === near.size ? near : new Set(kept);
  }, [visible, seated, near, players, view.me.seat, measure]);

  // 서버가 변경을 확인하면 거절 대기를 풀고 본인에게만 안내한다.
  const suspectTo = view.me.suspectTo;
  const seenTo = useRef(suspectTo);
  const [said, setSaid] = useState("");
  useEffect(() => {
    if (suspectTo === seenTo.current) return;
    const previousTo = seenTo.current;
    seenTo.current = suspectTo;
    const confirmedRemoval = suspectTo === undefined && visible && guard.peek() === "suspect";
    guard.clear("suspect");
    const seat = suspectTo ?? (confirmedRemoval ? previousTo : undefined);
    const name = latest.current.view.players.find((p) => p.seat === seat)?.nickname;
    setSaid(name === undefined ? "" : confirmedRemoval ? `${name} 님에 대한 내 의심 표시를 해제했어요` : suspectSaid(name));
  }, [suspectTo, visible, guard]);

  const disabled = !canSend || coolingDown || (!walkToTarget && targets.size === 0);

  const toggleMode = useCallback((): SuspectToggle => {
    if (!visible || !canSend || coolingDown) return null;
    if (mode) {
      setMode(false);
      return "off";
    }
    // 눌린 순간의 근처를 바로 다시 잰다(간격 사이에 가까워졌어도 알림 없이 켜진다)
    if ((seated ? targets : refresh()).size === 0 && !walkToTarget) return "deny";
    setMode(true);
    return "on";
  }, [visible, canSend, coolingDown, mode, seated, targets, refresh, walkToTarget]);

  const off = useCallback(() => setMode(false), []);

  const change = useCallback((seat: number): boolean | undefined => {
    const now = Date.now();
    if (!visible || !canSend || now - sentAt.current < SUSPECT_MIN_GAP_MS || !targets.has(seat)) return;
    const remove = latest.current.view.me.suspectTo === seat;
    if (send({ t: "suspect", target: seat, ...(remove ? { remove: true } : {}) }) === false) return false;
    sentAt.current = now;
    setCoolingDown(true);
    guard.mark("suspect", now);
    emitSignal({ kind: "tap" });
    return true;
  }, [visible, canSend, targets, send, guard]);

  const pick = useCallback(
    (seat: number) => {
      if (visible && targets.has(seat) && change(seat) === true) setMode(false);
    },
    [visible, targets, change],
  );

  return { visible, used, coolingDown, mode, targets, disabled, toggleMode, off, pick, change, said };
}

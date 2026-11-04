// 귓속말의 상태 (09.1.1-09, UI-SPEC B-1·B-2): 모드(이름표를 눌러 상대 고르기) → 한 줄 시트 → {t:"whisper", to, text} 한 번.
//
// - 모드: 떠 있는 버튼으로 켜고 끈다(같은 버튼·Esc). 이름표를 고르면 모드가 꺼지고 시트가 열린다. 낮 토론을 벗어나면(allowed 거짓) 모드·시트가 모두 꺼진다.
// - 시트: 상대(target)와 입력값(draft)을 쥔다. 쓰는 동안 서버로 가는 신호가 없다 — send 는 보내기 한 길이다(L7·L17, T-09.1.1-27).
// - 보내기: 서버가 확인(view.me.whisperUsed)하면 시트가 닫히고 입력값을 비운다. 거절(rejected 번호 증가)이면 시트·입력값을 그대로 둔다(고쳐 다시 보낼 수 있다).
//   확인 전에 연타해도 한 번만 나간다(최근 SEND_GUARD_MS 안 같은 요청은 막는다). 거절을 알아보는 기억(SendGuard)은 GameMap 의 오류 프레임 구독이 읽는다.
// - 하루 1번은 서버가 센다 — 화면은 whisperUsed 로 버튼만 막는다. 연결이 끊긴 동안(canSend 거짓)도 막는다.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import type { ClientMessage, RoomView } from "../../shared/protocol";
import { whisperTargets, whisperUsed, whisperVisible } from "../game/whisperView";
import { SEND_GUARD_MS } from "./useSendGuard";
import type { SendGuard } from "./useSendGuard";

export interface UseWhisperOptions {
  view: RoomView;
  /** 보냈으면 true, 소켓이 닫혀 못 보냈으면 false. 반환값이 없는 함수(void)는 보낸 것으로 본다 */
  send: (msg: ClientMessage) => boolean | void;
  /** 연결이 열려 서버로 보낼 수 있는가. 기본 true */
  canSend?: boolean;
  /** 서버가 귓속말을 거절한 횟수. 늘어나면 연타 막이를 풀어 다시 보낼 수 있게 한다 */
  rejected?: number;
  guard: SendGuard;
}

export interface WhisperApi {
  /** 버튼·모드·시트를 낼 수 있는 단계인가(낮 토론 + 내가 산 사람 + 상대가 있다) */
  allowed: boolean;
  /** 오늘 이미 보냈다(서버 값) */
  used: boolean;
  /** 지금 누를 수 없다(이미 보냈거나 연결이 끊겼다) */
  disabled: boolean;
  /** 귓속말 모드(이름표가 버튼) */
  mode: boolean;
  toggleMode: () => void;
  off: () => void;
  /** 이름표 고르기 — 모드를 끄고 시트를 연다 */
  pick: (seat: number) => void;
  /** 모드의 대상 좌석(나를 뺀 산 사람) */
  targets: ReadonlySet<number>;
  /** 시트의 상대. null 이면 시트가 닫혀 있다 */
  target: number | null;
  draft: string;
  setDraft: (v: string) => void;
  /** 한 줄 보내기. 확정된 글을 받는다 */
  send: (text: string) => void;
  /** 시트 닫기(입력값도 비운다) */
  close: () => void;
  /** 떠 있는 버튼 요소에 붙인다 — 시트가 닫히면 초점이 여기로 돌아온다 */
  buttonRef: RefObject<HTMLButtonElement | null>;
}

export function useWhisper({ view, send, canSend = true, rejected = 0, guard }: UseWhisperOptions): WhisperApi {
  const allowed = whisperVisible(view);
  const used = whisperUsed(view);
  const disabled = used || !canSend;
  const targets = useMemo(() => whisperTargets(view), [view]);
  const [mode, setMode] = useState(false);
  const [target, setTarget] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const lastSendAt = useRef<number | null>(null);

  const close = useCallback(() => {
    setTarget(null);
    setDraft("");
  }, []);
  const off = useCallback(() => setMode(false), []);

  // 낮 토론을 벗어나면 모드·시트가 모두 꺼진다
  useEffect(() => {
    if (allowed) return;
    setMode(false);
    close();
  }, [allowed, close]);

  // 시트의 상대가 더는 산 사람이 아니면 시트를 닫는다
  useEffect(() => {
    if (target !== null && !targets.has(target)) close();
  }, [target, targets, close]);

  // 서버가 사용함으로 확인했다: 시트를 닫고 입력값을 비우고 거절 기다림을 푼다
  useEffect(() => {
    if (!used) return;
    lastSendAt.current = null;
    guard.clear("whisper");
    setMode(false);
    close();
  }, [used, guard, close]);

  // 거절: 연타 막이를 풀어 다시 보낼 수 있게 한다(시트·입력값은 그대로)
  const seenRejected = useRef(rejected);
  useEffect(() => {
    if (seenRejected.current === rejected) return;
    seenRejected.current = rejected;
    lastSendAt.current = null;
  }, [rejected]);

  // 닫으면 초점이 떠 있는 버튼으로 돌아온다
  const wasOpen = useRef(false);
  const open = target !== null;
  useEffect(() => {
    if (wasOpen.current && !open) buttonRef.current?.focus({ preventScroll: true });
    wasOpen.current = open;
  }, [open]);

  // Esc 는 모드를 끈다(PC)
  useEffect(() => {
    if (!mode) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") setMode(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mode]);

  const toggleMode = useCallback(() => {
    if (!allowed || disabled) return;
    setMode((m) => !m);
  }, [allowed, disabled]);

  const pick = useCallback(
    (seat: number) => {
      if (!allowed || disabled || !targets.has(seat)) return;
      setMode(false);
      setTarget(seat);
      setDraft("");
    },
    [allowed, disabled, targets],
  );

  const sendLine = useCallback(
    (text: string) => {
      if (!allowed || disabled || target === null || text.trim() === "") return;
      const now = Date.now();
      if (lastSendAt.current !== null && now - lastSendAt.current < SEND_GUARD_MS) return; // 확인을 기다리는 중
      if (send({ t: "whisper", to: target, text }) === false) return; // 소켓이 닫혀 못 보냈으면 아무것도 하지 않는다
      lastSendAt.current = now;
      guard.mark("whisper", now);
    },
    [allowed, disabled, target, send, guard],
  );

  return { allowed, used, disabled, mode, toggleMode, off, pick, targets, target, draft, setDraft, send: sendLine, close, buttonRef };
}

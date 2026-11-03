// 채팅 저장소(ChatStore)·연결·방 view 를 ChatPanel 속성으로 잇는 훅 (07-UI-SPEC "하단 채팅 패널", "보내기·제한·막힘").
// 줄은 서버 방송이 와야만 생긴다 — 보낸 글을 미리 그리지 않는다(낙관적 표시 없음).
// 보내는 메시지는 본문과 단계 키(pk)뿐이다. 채널은 서버가 보낸 사람의 상태로 정한다(결정 0002) — 화면은 채널을 보내지 않는다.
//
// 시간이 걸리는 화면 상태는 이 훅이 쥔다(저장소는 시각을 읽지 않는다, 07-05 A2):
// - 보낸 직후 SEND_DIM_MS 동안 보내기가 흐려진다(입력은 계속 된다). 서버 거절이 오면 바로 풀린다.
// - 서버 거절(chatReject)은 기록 칸 맨 아래 알림으로 NOTICE_MS 동안 뜨고, 입력칸이 비어 있으면 마지막으로 보낸 글을 되돌려 둔다.
// - 연결이 끊기면(canSend 거짓) 보내기만 막히고 입력·이미 받은 줄은 그대로다. 복원(chatLog) 직후에는 quiet 이다.
// - 입력 중(07-18, CHAT-04): 빈 칸의 첫 글자(조합 시작 포함)에 켜짐 1번, 입력이 이어지면 2초(TYPING_REFRESH_MS)마다 갱신,
//   마지막 입력 변화 뒤 4초(TYPING_IDLE_OFF_MS)에 꺼짐(글이 남아 있어도). 칸 비움·보냄·블러·단계 키 변경·채널 변경에도 꺼진다.
//   연결이 끊긴 동안은 보내지 않는다. typingSeats = 서버가 보낸 좌석(끊긴 사람 제외) + 내 입력 중이면 내 좌석(즉시).
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { phaseKey } from "../../shared/game/audience";
import type { ClientMessage, RoomView } from "../../shared/protocol";
import type { ChatPanelProps, ChatPanelMessage } from "../components/v2/ChatPanel";
import { CHAT_TEXT } from "../game/chatText";
import { SEND_DIM_MS, TYPING_IDLE_OFF_MS, TYPING_REFRESH_MS } from "../game/chatUi";
import type { ChatStore } from "./chatStore";

/** 훅이 ChatPanel 에 넘기는 속성. 기록 칸 높이(logHeight)와 입력칸 ref 는 화면 틀이 붙인다. */
export type ChatBinding = Omit<ChatPanelProps, "logHeight" | "inputRef" | "onInputFocus" | "compact" | "inputId"> & {
  /**
   * 머리 위에 입력 중 알약을 그릴 좌석: 서버가 보낸 좌석(연결이 끊긴 사람 제외) + 내가 입력 중이면 내 좌석(서버 왕복 없이 즉시).
   * ChatPanel 에는 넘기지 않고 화면 틀이 WorldStage·DayTable 로 넘긴다(받을 권리 없는 좌석은 서버가 보내지 않는다, T-07-46).
   */
  typingSeats: ReadonlySet<number>;
};

export interface ChatConnection {
  /** 보냈으면 true, 소켓이 닫혀 못 보냈으면 false. 반환값이 없는 함수(void)는 보낸 것으로 본다 */
  send: (msg: ClientMessage) => boolean | void;
  /** 연결이 열려 있어 서버로 보낼 수 있는가 */
  canSend: boolean;
}

export function useChat({ store, connection, view }: { store: ChatStore; connection: ChatConnection; view: RoomView }): ChatBinding {
  const subscribe = useCallback((cb: () => void) => store.subscribe(cb), [store]);
  const getRevision = useCallback(() => store.revision(), [store]);
  const revision = useSyncExternalStore(subscribe, getRevision);

  const [value, setValue] = useState("");
  const valueRef = useRef(value);
  valueRef.current = value;
  // 입력 중: 내 입력칸이 비어 있다가 첫 글자가 들어가면 켜고, 칸이 비면 끈다(보냄도 칸을 비우므로 끝난다).
  const [typingOn, setTypingOn] = useState(false);
  const lastSent = useRef("");

  // 줄 앞 이름: 지금 방에 있는 사람의 닉네임. 떠난 사람의 줄은 마지막으로 본 닉네임을 쓴다.
  const names = useRef(new Map<number, string>());
  const channel = view.me.chat ?? null;
  const { players } = view;
  const mySeat = view.me.seat;
  // 라이브 카드의 보류(CARD_HOLD_MS): 저장소는 시각을 읽지 않으니 가장 이른 공개 시각에 타이머를 걸어 다시 그린다.
  const [cardTick, setCardTick] = useState(0);
  useEffect(() => {
    const at = store.nextCardReveal(Date.now());
    if (at === null) return;
    const timer = setTimeout(() => setCardTick((n) => n + 1), Math.max(0, at - Date.now()));
    return () => clearTimeout(timer);
  }, [store, revision, cardTick]);
  const messages = useMemo<ChatPanelMessage[]>(() => {
    for (const p of players) names.current.set(p.seat, p.nickname);
    return store.visibleLines(channel, Date.now()).map((line): ChatPanelMessage => {
      if (line.kind === "card" && line.card) {
        // 카드는 서버 k 줄과 이 화면의 경찰 카드뿐이다. 서버 카드의 제목은 좌석 닉네임으로 만든다(UI-SPEC 427행).
        const m: ChatPanelMessage = { key: line.key, kind: "card", card: line.card, text: line.text, icon: line.card === "will" ? "quill" : line.card === "note" ? "note" : "eye" };
        if (line.card === "will") m.title = CHAT_TEXT.cardWill(line.seat === undefined ? "" : (names.current.get(line.seat) ?? ""));
        else if (line.card === "note") {
          m.title = CHAT_TEXT.cardNote;
          m.tone = "mafia";
        } else m.title = line.title ?? "";
        return m;
      }
      if (line.kind !== "player") {
        const m: ChatPanelMessage = { key: line.key, kind: line.kind === "card" ? "system" : line.kind, text: line.text };
        if (line.icon) m.icon = line.icon;
        return m;
      }
      const m: ChatPanelMessage = { key: line.key, kind: "player", text: line.text };
      if (line.seat !== undefined) {
        m.seat = line.seat;
        m.name = names.current.get(line.seat) ?? "";
        m.me = line.seat === mySeat;
      }
      if (line.ch) m.ch = line.ch;
      return m;
    });
    // revision 이 줄 변화를 알린다(저장소는 React 밖이라 visibleLines 만으로는 의존성이 보이지 않는다)
  }, [store, revision, cardTick, channel, players, mySeat]);

  // 보낸 직후 흐림
  const [sendDim, setSendDim] = useState(false);
  const dimTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const clearDim = useCallback(() => {
    if (dimTimer.current !== undefined) clearTimeout(dimTimer.current);
    dimTimer.current = undefined;
    setSendDim(false);
  }, []);
  useEffect(
    () => () => {
      if (dimTimer.current !== undefined) clearTimeout(dimTimer.current);
    },
    [],
  );

  const { send, canSend } = connection;
  const day = view.day?.n;
  const phase = view.phase;
  const pk = phaseKey(day === undefined ? { phase } : { phase, day });

  // 입력 중 보내기. 타이머·이벤트에서 최신 연결·단계 키를 읽는다(오래된 클로저 방지).
  const live = useRef({ send, canSend, pk });
  useLayoutEffect(() => {
    live.current = { send, canSend, pk };
  });
  const typingOnRef = useRef(false);
  const lastOnAt = useRef(0);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const emitTyping = useCallback((on: boolean) => {
    const l = live.current;
    if (l.canSend) l.send({ t: "typing", on, pk: l.pk });
  }, []);
  /** 입력 중을 끈다. notify 면 서버에도 꺼짐을 알린다(켜져 있었을 때만) */
  const stopTyping = useCallback(
    (notify: boolean) => {
      if (idleTimer.current !== undefined) clearTimeout(idleTimer.current);
      idleTimer.current = undefined;
      if (!typingOnRef.current) return;
      typingOnRef.current = false;
      setTypingOn(false);
      if (notify) emitTyping(false);
    },
    [emitTyping],
  );
  /** 글자가 있는 입력 변화 하나: 켜짐(처음) 또는 갱신(2초 뒤)을 보내고 무입력 꺼짐 타이머를 다시 건다 */
  const touchTyping = useCallback(() => {
    if (!live.current.canSend) return;
    const now = Date.now();
    if (!typingOnRef.current) {
      typingOnRef.current = true;
      setTypingOn(true);
      lastOnAt.current = now;
      emitTyping(true);
    } else if (now - lastOnAt.current >= TYPING_REFRESH_MS) {
      lastOnAt.current = now;
      emitTyping(true);
    }
    if (idleTimer.current !== undefined) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => {
      idleTimer.current = undefined;
      stopTyping(true);
    }, TYPING_IDLE_OFF_MS);
  }, [emitTyping, stopTyping]);
  const onChange = useCallback(
    (v: string) => {
      valueRef.current = v;
      setValue(v);
      if (v === "") stopTyping(true);
      else touchTyping();
    },
    [stopTyping, touchTyping],
  );
  // 조합 시작은 빈 칸에서도 첫 글자로 센다(글자가 칸에 닿기 전). 글자 없이 조합이 끝나면(취소) 끈다.
  const onComposingChange = useCallback(
    (composing: boolean) => {
      if (composing && valueRef.current === "") touchTyping();
      else if (!composing && valueRef.current === "") stopTyping(true);
    },
    [touchTyping, stopTyping],
  );
  const onInputBlur = useCallback(() => stopTyping(true), [stopTyping]);
  // 단계 키·채널이 바뀌면 끈다. 연결이 끊기면 보낼 수 없으니 화면에서만 끈다(돌아온 뒤 다음 입력에 다시 켜진다).
  const scope = `${pk}|${channel ?? ""}`;
  const prevScope = useRef(scope);
  useEffect(() => {
    if (prevScope.current === scope) return;
    prevScope.current = scope;
    stopTyping(true);
  }, [scope, stopTyping]);
  useEffect(() => {
    if (!canSend) stopTyping(false);
  }, [canSend, stopTyping]);
  // 화면이 사라지면(게임 시작·단계 전환으로 다른 화면이 됨) 켜져 있던 것을 끈다.
  useEffect(() => () => stopTyping(true), [stopTyping]);

  const onSend = useCallback(
    (text: string) => {
      if (!canSend) return;
      const sentOk = send({ t: "chat", text, pk });
      if (sentOk === false) {
        // 소켓이 막 닫혀 못 보냈다: ChatPanel 이 이어서 칸을 비우므로, 그 뒤에 쓴 글을 되돌려 놓는다(글이 사라지지 않게).
        queueMicrotask(() => setValue((v) => (v === "" ? text : v)));
        return;
      }
      lastSent.current = text;
      setSendDim(true);
      if (dimTimer.current !== undefined) clearTimeout(dimTimer.current);
      dimTimer.current = setTimeout(() => {
        dimTimer.current = undefined;
        setSendDim(false);
      }, SEND_DIM_MS);
    },
    [send, canSend, pk],
  );

  // 서버 거절: 새 거절이 올 때마다(n 이 바뀔 때) 흐림을 풀고, 입력칸이 비어 있으면 마지막으로 보낸 글을 되돌려 둔다.
  // 마운트 때 이미 있던 거절(낡은 알림)은 건드리지 않는다.
  const rejectN = store.lastReject()?.n ?? 0;
  const seenReject = useRef(rejectN);
  useEffect(() => {
    if (rejectN === seenReject.current) return;
    seenReject.current = rejectN;
    clearDim();
    if (valueRef.current === "" && lastSent.current !== "") setValue(lastSent.current);
  }, [rejectN, clearDim]);

  // 막힘 알림 수명: 저장소는 시각을 읽지 않으니 만료 시각에 타이머를 걸어 다시 그린다.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const expiry = store.noticeExpiry();
    if (expiry === null) return;
    const left = expiry - Date.now();
    if (left <= 0) {
      setNow(Date.now());
      return;
    }
    const timer = setTimeout(() => setNow(Math.max(Date.now(), expiry)), left);
    return () => clearTimeout(timer);
  }, [store, revision]);
  const why = store.notice(now);

  // 받은 입력 중 신호: 저장소가 만료를 now 로 판정하니, 다음 만료 시각에 타이머를 걸어 다시 계산한다.
  const [typingTick, setTypingTick] = useState(0);
  useEffect(() => {
    const expiry = store.nextTypingExpiry(Date.now());
    if (expiry === null) return;
    const timer = setTimeout(() => setTypingTick((n) => n + 1), Math.max(0, expiry - Date.now()));
    return () => clearTimeout(timer);
  }, [store, revision, typingTick]);
  const stableSeats = useRef<ReadonlySet<number>>(new Set());
  const typingSeats = useMemo<ReadonlySet<number>>(() => {
    const away = new Set<number>();
    for (const p of players) if (!p.connected) away.add(p.seat);
    const seats = new Set<number>();
    for (const seat of store.typingSeats(Date.now())) if (!away.has(seat)) seats.add(seat);
    if (typingOn) seats.add(mySeat);
    const prev = stableSeats.current;
    if (prev.size === seats.size && [...seats].every((s) => prev.has(s))) return prev;
    stableSeats.current = seats;
    return seats;
    // revision·typingTick 이 저장소의 입력 중 변화·만료를 알린다
  }, [store, revision, typingTick, players, mySeat, typingOn]);

  return {
    messages,
    value,
    onChange,
    onComposingChange,
    onInputBlur,
    onSend,
    channel: channel ?? "all",
    sendDisabled: !canSend,
    sendDim,
    notice: why === null ? null : CHAT_TEXT.reject[why],
    quiet: store.lastWasReplay(),
    typingSeats,
  };
}

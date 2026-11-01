// 채팅 저장소(ChatStore)·연결·방 view 를 ChatPanel 속성으로 잇는 훅 (07-UI-SPEC "하단 채팅 패널", "보내기·제한·막힘").
// 줄은 서버 방송이 와야만 생긴다 — 보낸 글을 미리 그리지 않는다(낙관적 표시 없음).
// 보내는 메시지는 본문과 단계 키(pk)뿐이다. 채널은 서버가 보낸 사람의 상태로 정한다(결정 0002) — 화면은 채널을 보내지 않는다.
//
// 시간이 걸리는 화면 상태는 이 훅이 쥔다(저장소는 시각을 읽지 않는다, 07-05 A2):
// - 보낸 직후 SEND_DIM_MS 동안 보내기가 흐려진다(입력은 계속 된다). 서버 거절이 오면 바로 풀린다.
// - 서버 거절(chatReject)은 기록 칸 맨 아래 알림으로 NOTICE_MS 동안 뜨고, 입력칸이 비어 있으면 마지막으로 보낸 글을 되돌려 둔다.
// - 연결이 끊기면(canSend 거짓) 보내기만 막히고 입력·이미 받은 줄은 그대로다. 복원(chatLog) 직후에는 quiet 이다.
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { phaseKey } from "../../shared/game/audience";
import type { ClientMessage, RoomView } from "../../shared/protocol";
import type { ChatPanelProps, ChatPanelMessage } from "../components/v2/ChatPanel";
import { CHAT_TEXT } from "../game/chatText";
import { SEND_DIM_MS } from "../game/chatUi";
import type { ChatStore } from "./chatStore";

/** 훅이 ChatPanel 에 넘기는 속성. 기록 칸 높이(logHeight)와 입력칸 ref 는 화면 틀이 붙인다. */
export type ChatBinding = Omit<ChatPanelProps, "logHeight" | "inputRef" | "onInputFocus" | "onInputBlur" | "onComposingChange" | "compact" | "inputId">;

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
  const lastSent = useRef("");

  // 줄 앞 이름: 지금 방에 있는 사람의 닉네임. 떠난 사람의 줄은 마지막으로 본 닉네임을 쓴다.
  const names = useRef(new Map<number, string>());
  const channel = view.me.chat ?? null;
  const { players } = view;
  const mySeat = view.me.seat;
  const messages = useMemo<ChatPanelMessage[]>(() => {
    for (const p of players) names.current.set(p.seat, p.nickname);
    return store.visibleLines(channel).map((line): ChatPanelMessage => {
      if (line.kind === "system") {
        const m: ChatPanelMessage = { key: line.key, kind: "system", text: line.text };
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
  }, [store, revision, channel, players, mySeat]);

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
  const onSend = useCallback(
    (text: string) => {
      if (!canSend) return;
      const sentOk = send({ t: "chat", text, pk: phaseKey(day === undefined ? { phase } : { phase, day }) });
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
    [send, canSend, phase, day],
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

  return {
    messages,
    value,
    onChange: setValue,
    onSend,
    channel: channel ?? "all",
    sendDisabled: !canSend,
    sendDim,
    notice: why === null ? null : CHAT_TEXT.reject[why],
    quiet: store.lastWasReplay(),
  };
}

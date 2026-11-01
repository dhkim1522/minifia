// 채팅 저장소(ChatStore)·연결·방 view 를 ChatPanel 속성으로 잇는 훅 (07-UI-SPEC "하단 채팅 패널", "보내기·제한·막힘").
// 줄은 서버 방송이 와야만 생긴다 — 보낸 글을 미리 그리지 않는다(낙관적 표시 없음).
// 보내는 메시지는 본문과 단계 키(pk)뿐이다. 채널은 서버가 보낸 사람의 상태로 정한다(결정 0002) — 화면은 채널을 보내지 않는다.
import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { phaseKey } from "../../shared/game/audience";
import type { ClientMessage, RoomView } from "../../shared/protocol";
import type { ChatPanelProps, ChatPanelMessage } from "../components/v2/ChatPanel";
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

  const { send, canSend } = connection;
  const day = view.day?.n;
  const phase = view.phase;
  const onSend = useCallback(
    (text: string) => {
      if (!canSend) return;
      send({ t: "chat", text, pk: phaseKey(day === undefined ? { phase } : { phase, day }) });
    },
    [send, canSend, phase, day],
  );

  return {
    messages,
    value,
    onChange: setValue,
    onSend,
    channel: channel ?? "all",
    sendDisabled: !canSend,
    quiet: store.lastWasReplay(),
  };
}

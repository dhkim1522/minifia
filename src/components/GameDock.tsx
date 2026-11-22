import { useId, useLayoutEffect, useRef, useState } from "react";
import type { MouseEvent, PointerEvent, ReactNode, RefObject } from "react";
import type { ChatChannel } from "../../shared/protocol";
import type { ChatStore } from "../net/chatStore";
import type { ChatPanelMessage } from "./v2/ChatPanel";
import { PlayerPortrait } from "./PlayerPortrait";
import { V2Icon } from "./v2/V2Icon";
import "../styles/game-dock.css";

type Pane = "chat" | "people" | "tools";
type DockPane = Pane | "closed";

const TABS = [
  { id: "chat", label: "채팅", icon: "chat" },
  { id: "people", label: "참가자", icon: "users" },
  { id: "tools", label: "도구", icon: "toolbox" },
] as const;

const SWIPE_DISTANCE = 32;

interface GameDockProps {
  scope: string;
  initialPane: DockPane;
  voting: boolean;
  preserveWriting: boolean;
  keepToolsOpen: boolean;
  paused: boolean;
  inputRef?: RefObject<HTMLInputElement | null>;
  chatStore: ChatStore;
  channel: ChatChannel | null;
  mySeat: number;
  latest?: ChatPanelMessage;
  peopleCount: number;
  chat: ReactNode;
  people: ReactNode;
  tools: ReactNode;
}

export function GameDock({ scope, initialPane, voting, preserveWriting, keepToolsOpen, paused, inputRef, chatStore, channel, mySeat, latest, peopleCount, chat, people, tools }: GameDockProps) {
  const id = useId();
  const [selection, setSelection] = useState({ scope, pane: initialPane });
  const contents = { chat, people, tools };
  const pane = selection.pane !== "closed" && contents[selection.pane] ? selection.pane : "closed";
  const tabs = useRef<Partial<Record<Pane, HTMLButtonElement | null>>>({});
  const paneRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<{ id: number; x: number; y: number } | undefined>(undefined);
  const lastSwipe = useRef<{ target: HTMLButtonElement; at: number } | undefined>(undefined);

  useLayoutEffect(() => {
    if (selection.scope === scope) return;
    const field = inputRef?.current;
    const writing = preserveWriting && pane === "chat" && field !== null && field !== undefined && field === document.activeElement;
    const next = writing || (keepToolsOpen && pane === "tools") ? pane : initialPane;
    if (pane !== "closed" && pane !== next && paneRef.current?.contains(document.activeElement)) {
      tabs.current[pane]?.focus({ preventScroll: true });
    }
    setSelection({ scope, pane: next });
  }, [scope, selection.scope, initialPane, pane, inputRef, preserveWriting, keepToolsOpen]);

  // Store를 읽는 GameMap의 구독이 새 채팅 줄을 그린다. 열린 채널만 읽은 것으로 표시한다.
  useLayoutEffect(() => {
    if (!paused && pane === "chat" && channel !== null) chatStore.markRead(channel);
  });

  const unread = pane !== "chat" && chat && channel !== null ? chatStore.unreadCount(channel, mySeat) : 0;
  const open = (next: DockPane) => {
    if (next !== "chat") inputRef?.current?.blur();
    setSelection({ scope, pane: next });
  };
  const close = () => {
    if (pane === "closed") return;
    tabs.current[pane]?.focus({ preventScroll: true });
    open("closed");
  };

  function startSwipe(event: PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) return;
    lastSwipe.current = undefined;
    gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
    if (event.isTrusted) event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function endSwipe(event: PointerEvent<HTMLButtonElement>, direction: 1 | -1, change: () => void) {
    const start = gesture.current;
    gesture.current = undefined;
    if (!start || start.id !== event.pointerId) return;
    const dx = Math.abs(event.clientX - start.x);
    const dy = (event.clientY - start.y) * direction;
    if (dy < SWIPE_DISTANCE || dy <= dx) return;
    lastSwipe.current = { target: event.currentTarget, at: performance.now() };
    change();
  }

  function afterSwipe(event: MouseEvent<HTMLButtonElement>, change: () => void) {
    const swipe = lastSwipe.current;
    if (event.detail === 0 || swipe?.target !== event.currentTarget || performance.now() - swipe.at > 350) change();
  }

  function holdInputUntilTap(event: MouseEvent<HTMLButtonElement>) {
    const field = inputRef?.current;
    if (field && field === document.activeElement) event.preventDefault();
  }

  return (
    <div className="mf-game-dock" data-table-dock="" data-dock-open={pane} onKeyDown={(event) => {
      if (event.key !== "Escape" || event.defaultPrevented || event.nativeEvent.isComposing || pane === "closed") return;
      event.stopPropagation();
      close();
    }}>
      {pane === "closed" && latest?.seat !== undefined ? (
        <button type="button" className="mf-game-dock__peek" aria-label={`${latest.name ? `${latest.name} 님의 메시지` : "최근 메시지"}, ${latest.text}, 채팅 열기`} data-dock-peek="" onClick={() => {
          tabs.current.chat?.focus({ preventScroll: true });
          open("chat");
        }}>
          <PlayerPortrait seat={latest.seat} animal={latest.animal} />
          <strong>{latest.name}</strong>
          <span>{latest.text}</span>
        </button>
      ) : null}
      {pane !== "closed" ? (
        <div ref={paneRef} id={id} className="mf-game-dock__pane" data-dock-pane={pane} role="region"
          aria-label={pane === "chat" ? "채팅" : pane === "people" ? voting ? "지목할 사람" : "참가자" : "도구"}>
          <button type="button" className="mf-game-dock__handle" data-dock-handle="" aria-label="하단 패널 닫기"
            onPointerDown={startSwipe} onPointerUp={(event) => endSwipe(event, 1, close)}
            onPointerCancel={() => { gesture.current = undefined; }} onClick={(event) => afterSwipe(event, close)}>
            <span aria-hidden="true" />
          </button>
          {pane === "people" ? <div className="mf-game-dock__title"><strong>{voting ? "지목할 사람" : "참가자"}</strong><span>{peopleCount}명</span></div> : null}
          {contents[pane]}
        </div>
      ) : null}
      <nav className="mf-game-dock__tabs" aria-label="게임 하단 조작">
        {TABS.map(({ id: tab, label, icon }) => {
          const vote = tab === "people" && voting;
          const count = tab === "chat" ? unread : 0;
          return (
            <button key={tab} ref={(node) => { tabs.current[tab] = node; }} type="button" data-dock-tab={tab} data-dock-vote={vote ? "" : undefined}
              disabled={!contents[tab]} aria-label={vote ? "지목" : count > 0 ? `${label}, 읽지 않은 메시지 ${count}개` : label}
              aria-expanded={pane === tab} aria-controls={pane === tab ? id : undefined}
              onPointerDown={(event) => {
                holdInputUntilTap(event);
                if (tab === "people") startSwipe(event);
              }}
              onMouseDown={holdInputUntilTap}
              onClick={(event) => afterSwipe(event, () => open(pane === tab ? "closed" : tab))}
              {...(tab === "people" ? { onPointerUp: (event: PointerEvent<HTMLButtonElement>) => endSwipe(event, -1, () => open(tab)), onPointerCancel: () => { gesture.current = undefined; } } : {})}>
              <V2Icon name={icon} size={21} />
              {vote ? <span>지목</span> : null}
              {count > 0 ? <span data-dock-unread="" className="mf-game-dock__unread" aria-hidden="true">{count}</span> : null}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

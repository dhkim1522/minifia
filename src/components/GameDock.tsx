import { useId, useLayoutEffect, useRef, useState } from "react";
import type { MouseEvent, PointerEvent, ReactNode, RefObject } from "react";
import type { ChatChannel } from "../../shared/protocol";
import type { ChatStore } from "../net/chatStore";
import type { ChatPanelMessage } from "./v2/ChatPanel";
import { PlayerName } from "./PlayerName";
import { PlayerPortrait } from "./PlayerPortrait";
import { SUSPECT_HOLD_MS, TableControls } from "./TableControls";
import type { TableControlsProps } from "./TableControls";
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
const HOLD_SLOP = 10;
const PEOPLE_PER_PAGE = 4;

interface RosterGesture {
  id: number;
  x: number;
  y: number;
  scope: string;
  page: number;
  cancelled?: true;
  hold?: { seat: number; at: number; cancelled: boolean };
}

function movedDuringHold(start: RosterGesture, event: PointerEvent): boolean {
  return Math.max(Math.abs(event.clientX - start.x), Math.abs(event.clientY - start.y)) >= HOLD_SLOP;
}

export interface PeopleAction {
  kind: "vote" | "suspect" | "night";
  title: string;
  roster: TableControlsProps;
  footer?: ReactNode;
  firstBallot?: boolean;
  onLeave?: () => void;
}

interface GameDockProps {
  scope: string;
  initialPane: DockPane;
  peopleAction?: PeopleAction;
  preserveWriting: boolean;
  keepLooking: boolean;
  keepToolsOpen: boolean;
  paused: boolean;
  inputRef?: RefObject<HTMLInputElement | null>;
  chatStore: ChatStore;
  channel: ChatChannel | null;
  mySeat: number;
  latest?: ChatPanelMessage;
  chat: ReactNode;
  people?: TableControlsProps | undefined;
  tools: ReactNode;
}

export function GameDock({ scope, initialPane, peopleAction, preserveWriting, keepLooking, keepToolsOpen, paused, inputRef, chatStore, channel, mySeat, latest, chat, people, tools }: GameDockProps) {
  const id = useId();
  const [selection, setSelection] = useState({ scope, pane: initialPane, waiting: false, action: peopleAction?.kind });
  const voting = peopleAction?.kind === "vote";
  const actionNeedsConfirmation = voting || peopleAction?.kind === "night";
  const armed = selection.scope === scope && !selection.waiting;
  const activeAction = armed ? peopleAction : undefined;
  const title = activeAction?.title ?? "참가자";
  const contents = { chat, people: activeAction?.roster ?? people, tools };
  const pane = selection.pane !== "closed" && contents[selection.pane] ? selection.pane : "closed";
  const tabs = useRef<Partial<Record<Pane, HTMLButtonElement | null>>>({});
  const paneRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<{ id: number; x: number; y: number } | undefined>(undefined);
  const lastSwipe = useRef<{ target: HTMLButtonElement; at: number } | undefined>(undefined);
  const roster = contents.people;
  const [peoplePage, setPeoplePage] = useState<number>();
  const [actionPage, setActionPage] = useState<{ scope: string; page: number }>();
  const pageCount = Math.ceil((roster?.players.length ?? 0) / PEOPLE_PER_PAGE);
  const selectedSeat = roster?.pick?.mine ?? roster?.selected ?? roster?.focus;
  const selectedIndex = roster?.players.findIndex((player) => player.seat === selectedSeat) ?? -1;
  const initialPage = selectedIndex >= 0 ? Math.floor(selectedIndex / PEOPLE_PER_PAGE) : 0;
  const savedPage = activeAction ? actionPage?.scope === scope ? actionPage.page : undefined : peoplePage;
  const page = Math.min(savedPage ?? initialPage, Math.max(0, pageCount - 1));
  const rosterGesture = useRef<RosterGesture | undefined>(undefined);
  const rosterHandledAt = useRef(-Infinity);
  const [holding, setHolding] = useState<{ scope: string; page: number; seat: number }>();
  const holdAction = paused ? undefined : roster?.suspectHold;
  const holdingSeat = holding?.scope === scope && holding.page === page && holdAction?.seats.has(holding.seat) ? holding.seat : undefined;

  const clearRosterGesture = () => {
    rosterGesture.current = undefined;
    rosterHandledAt.current = performance.now();
    setHolding(undefined);
  };

  useLayoutEffect(() => {
    const start = rosterGesture.current;
    if (!start || start.cancelled) return;
    if (pane !== "people" || start.scope !== scope || start.page !== page ||
      (start.hold && !holdAction?.seats.has(start.hold.seat))) {
      // 늦게 도착한 pointerup 뒤에 생기는 click도 소비한다.
      start.cancelled = true;
      setHolding(undefined);
    }
  });

  const changePage = (direction: number) => {
    const next = page + direction;
    if (next < 0 || next >= pageCount) return;
    if (activeAction) setActionPage({ scope, page: next });
    else setPeoplePage(next);
  };

  useLayoutEffect(() => {
    if (selection.scope === scope) return;
    const field = inputRef?.current;
    const writing = preserveWriting && pane === "chat" && field !== null && field !== undefined && field === document.activeElement;
    // 이미 상대를 바라보는 중이라면 얼굴을 누르던 조작이 새 투표가 되지 않게 한다.
    const waiting = actionNeedsConfirmation && pane === "people";
    const wasMarking = selection.action === "suspect";
    const looking = keepLooking && pane === "people" && selection.action === undefined;
    const next = waiting || looking || writing || (keepToolsOpen && pane === "tools") ? pane
      : wasMarking && !peopleAction ? (pane === "people" ? "closed" : pane)
      : initialPane;
    if (pane !== "closed" && pane !== next && paneRef.current?.contains(document.activeElement)) {
      tabs.current[pane]?.focus({ preventScroll: true });
    }
    if (peopleAction?.kind === "suspect" && next === "people") tabs.current.people?.focus({ preventScroll: true });
    if (selection.action && pane === "people" && next === "closed" && document.activeElement === document.body) {
      tabs.current.people?.focus({ preventScroll: true });
    }
    setSelection({ scope, pane: next, waiting, action: peopleAction?.kind });
  }, [scope, selection.scope, selection.action, initialPane, pane, inputRef, preserveWriting, keepLooking, keepToolsOpen, peopleAction, actionNeedsConfirmation]);

  // Store를 읽는 GameMap의 구독이 새 채팅 줄을 그린다. 열린 채널만 읽은 것으로 표시한다.
  useLayoutEffect(() => {
    if (!paused && pane === "chat" && channel !== null) chatStore.markRead(channel);
  });

  const unread = pane !== "chat" && chat && channel !== null ? chatStore.unreadCount(channel, mySeat) : 0;
  const open = (next: DockPane) => {
    if (next !== "chat") inputRef?.current?.blur();
    if (pane === "people" && next !== "people") peopleAction?.onLeave?.();
    setSelection({ scope, pane: next, waiting: false, action: peopleAction?.kind });
  };
  const startRosterGesture = (event: PointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary || event.button !== 0) return;
    rosterHandledAt.current = -Infinity;
    const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>("button[data-table-seat]") : null;
    const seat = button?.hasAttribute("data-suspect-holdable") ? Number(button.dataset.tableSeat) : undefined;
    const hold = seat !== undefined && holdAction?.seats.has(seat) ? { seat, at: performance.now(), cancelled: false } : undefined;
    if (!hold && pageCount < 2) {
      rosterGesture.current = undefined;
      return;
    }
    rosterGesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY, scope, page, hold };
    if (hold) setHolding({ scope, page, seat: hold.seat });
    if (event.isTrusted) (button ?? event.currentTarget).setPointerCapture?.(event.pointerId);
  };

  const moveRosterGesture = (event: PointerEvent<HTMLDivElement>) => {
    const start = rosterGesture.current;
    if (start?.id !== event.pointerId || start.cancelled || !start.hold || start.hold.cancelled || !movedDuringHold(start, event)) return;
    start.hold.cancelled = true;
    setHolding(undefined);
  };

  const cancelRosterGesture = (event: PointerEvent<HTMLDivElement>) => {
    if (rosterGesture.current?.id === event.pointerId) clearRosterGesture();
  };

  const endRosterGesture = (event: PointerEvent<HTMLDivElement>) => {
    const start = rosterGesture.current;
    if (!start || start.id !== event.pointerId) return;
    cancelRosterGesture(event);
    if (start.cancelled || start.scope !== scope || start.page !== page) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) >= SWIPE_DISTANCE && Math.abs(dx) > Math.abs(dy)) {
      // 경계에서 멈춘 밀기도 카드 누르기로 해석하지 않는다.
      changePage(dx < 0 ? 1 : -1);
      return;
    }
    if (start.hold) {
      const { seat, at, cancelled } = start.hold;
      if (cancelled || movedDuringHold(start, event)) return;
      if (rosterHandledAt.current - at >= SUSPECT_HOLD_MS) {
        if (holdAction?.seats.has(seat)) holdAction.onRelease(seat);
        return;
      }
    }
    rosterHandledAt.current = -Infinity; // 짧게 누르기는 기존 click의 바라보기/선택으로 보낸다.
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
          <strong><PlayerName seat={latest.seat}>{latest.name}</PlayerName></strong>
          <span>{latest.text}</span>
        </button>
      ) : null}
      {pane !== "closed" ? (
        <div ref={paneRef} id={id} className="mf-game-dock__pane" data-dock-pane={pane} role="region"
          aria-label={pane === "chat" ? "채팅" : pane === "people" ? title : "도구"}>
          <button type="button" className="mf-game-dock__handle" data-dock-handle="" aria-label="하단 패널 닫기"
            onPointerDown={startSwipe} onPointerUp={(event) => endSwipe(event, 1, close)}
            onPointerCancel={() => { gesture.current = undefined; }} onClick={(event) => afterSwipe(event, close)}>
            <span aria-hidden="true" />
          </button>
          {pane === "people" && roster ? (
            <>
              <div className="mf-game-dock__title">
                <strong>{title}</strong>
                {pageCount > 1 ? (
                  <div className="mf-game-dock__pagination">
                    <button type="button" data-people-prev="" aria-label="이전 참가자" aria-disabled={page === 0} onClick={() => changePage(-1)}>
                      <V2Icon name="chevronRight" size={18} />
                    </button>
                    <span data-people-page="" aria-live="polite">{page + 1}/{pageCount}</span>
                    <button type="button" data-people-next="" aria-label="다음 참가자" aria-disabled={page + 1 === pageCount} onClick={() => changePage(1)}>
                      <V2Icon name="chevronRight" size={18} />
                    </button>
                  </div>
                ) : null}
              </div>
              <div key={activeAction?.kind ?? "people"} className="mf-game-dock__people"
                data-first-ballot={activeAction?.firstBallot ? "" : undefined} data-night-targets={activeAction?.kind === "night" ? "" : undefined}>
                <div className="mf-game-dock__cards"
                  onPointerDownCapture={startRosterGesture}
                  onPointerMoveCapture={moveRosterGesture}
                  onPointerUpCapture={endRosterGesture}
                  onPointerCancel={cancelRosterGesture}
                  onLostPointerCapture={cancelRosterGesture}
                  onContextMenu={(event) => { if (rosterGesture.current?.hold) event.preventDefault(); }}
                  onClickCapture={(event) => {
                    if (event.detail === 0 || performance.now() - rosterHandledAt.current > 350) return;
                    event.preventDefault();
                    event.stopPropagation();
                  }}>
                  <TableControls {...roster} suspectHold={holdAction} holdingSuspect={holdingSeat}
                    cards players={roster.players.slice(page * PEOPLE_PER_PAGE, (page + 1) * PEOPLE_PER_PAGE)} />
                </div>
                {activeAction?.footer}
              </div>
            </>
          ) : pane === "chat" ? chat : tools}
        </div>
      ) : null}
      <nav className="mf-game-dock__tabs" aria-label="게임 하단 조작">
        {TABS.map(({ id: tab, label, icon }) => {
          const vote = tab === "people" && voting;
          const pending = tab === "people" && actionNeedsConfirmation && !armed;
          const count = tab === "chat" ? unread : 0;
          return (
            <button key={tab} ref={(node) => { tabs.current[tab] = node; }} type="button" data-dock-tab={tab} data-dock-vote={vote ? "" : undefined}
              data-dock-pending={pending ? "" : undefined}
              disabled={!contents[tab]} aria-label={vote ? "지목" : pending ? "밤 대상 선택" : count > 0 ? `${label}, 읽지 않은 메시지 ${count}개` : label}
              aria-expanded={pane === tab} aria-controls={pane === tab ? id : undefined}
              onPointerDown={(event) => {
                holdInputUntilTap(event);
                if (tab === "people") startSwipe(event);
              }}
              onMouseDown={holdInputUntilTap}
              onClick={(event) => afterSwipe(event, () => open(pane === tab && !pending ? "closed" : tab))}
              {...(tab === "people" ? { onPointerUp: (event: PointerEvent<HTMLButtonElement>) => endSwipe(event, -1, () => open(tab)), onPointerCancel: () => { gesture.current = undefined; } } : {})}>
              <V2Icon name={icon} size={21} />
              {vote ? <span>지목</span> : pending ? <span>밤 선택</span> : tab === "people" && pane === "people" ? <span>참가자</span> : null}
              {count > 0 ? <span data-dock-unread="" className="mf-game-dock__unread" aria-hidden="true">{count}</span> : null}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

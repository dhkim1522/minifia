import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode, RefObject } from "react";
import type { EmoteId } from "../../../shared/protocol";
import { ChatPanel } from "./ChatPanel";
import { EmoteTray } from "./EmoteTray";
import { HeadCount } from "./HeadCount";
import { V2Icon } from "./V2Icon";
import { CHAT_TEXT, EMOTE_SHORT, EMOTE_TEXT } from "../../game/chatText";
import { DISCUSSION_KB_LOG_H, DISCUSSION_LOG_H, DISCUSSION_SHORT_LOG_H, DISCUSSION_VIEWPORT_ALLOWANCE } from "../../game/chatUi";
import { SUSPECT_TEXT } from "../../game/suspectView";
import type { SuspectApi } from "../../net/useSuspect";
import type { ChatBinding } from "../../net/useChat";
import "../../styles/room-chat.css";

export type RoomChatBinding = Omit<ChatBinding, "typingSeats" | "liveWhisperIn">;

const QUICK_REACTIONS = ["praise", "deny", "surprise"] as const;
const CHAT_SIZE = {
  "--mf-room-chat-short-log": `${DISCUSSION_SHORT_LOG_H}px`,
  "--mf-room-chat-viewport-allowance": `${DISCUSSION_VIEWPORT_ALLOWANCE}px`,
} as CSSProperties;

export interface RoomChatDockProps {
  binding: RoomChatBinding;
  kbOpen: boolean;
  quickReactions?: boolean;
  discussion?: boolean;
  locked?: boolean;
  actions?: ReactNode;
  advance?: ReactNode;
  callInput?: boolean;
  onInputFocus?: () => void;
  inputRef?: RefObject<HTMLInputElement | null>;
  suspect?: Pick<SuspectApi, "mode" | "targets" | "disabled" | "used" | "off" | "toggleMode"> & {
    deny?: () => void;
  };
  skip?: { enabled: boolean; pressed: boolean; count: number; total: number; request: () => void };
  will?: { open: boolean; saved: boolean; call?: boolean; request: (opener: HTMLElement) => void };
}

export function RoomChatDock({ binding, kbOpen, quickReactions = false, discussion, locked, actions, advance, callInput, onInputFocus, inputRef, suspect, skip, will }: RoomChatDockProps) {
  const [reactionsOpen, setReactionsOpen] = useState(false);
  const [reacted, setReacted] = useState("");
  const surfaceId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const focus = useRef<"reaction" | "surface" | null>(null);
  const reactions = locked ? [] : quickReactions ? QUICK_REACTIONS : binding.emotes ?? [];
  const reactionLabel = quickReactions ? "반응" : EMOTE_TEXT.button;

  useLayoutEffect(() => {
    const target = focus.current;
    focus.current = null;
    if (target === "surface") {
      const first = surfaceRef.current?.querySelector<HTMLButtonElement>('button:not(:disabled):not([aria-disabled="true"])');
      (first ?? surfaceRef.current)?.focus({ preventScroll: true });
    } else if (target !== null) {
      panelRef.current?.querySelector<HTMLButtonElement>(`[data-playtest-action="${target}"]`)?.focus({ preventScroll: true });
    }
  }, [reactionsOpen]);

  useEffect(() => {
    if (!reactionsOpen) return;
    const closeOnOutsidePress = (event: PointerEvent) => {
      if (event.target instanceof Node && !panelRef.current?.contains(event.target)) setReactionsOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePress);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePress);
  }, [reactionsOpen]);

  useEffect(() => {
    if (binding.sendDisabled || locked) setReactionsOpen(false);
  }, [binding.sendDisabled, locked]);

  useEffect(() => setReactionsOpen(false), [discussion]);

  const toggleReactions = (keyboard: boolean) => {
    suspect?.off();
    if (reactionsOpen) {
      setReactionsOpen(false);
      return;
    }
    if (kbOpen) inputRef?.current?.blur();
    if (keyboard) focus.current = "surface";
    setReactionsOpen(true);
  };
  const pickReaction = (id: EmoteId) => {
    binding.onEmote?.(id);
    if (quickReactions) setReacted(`${EMOTE_SHORT[id]} 반응`);
    if (surfaceRef.current?.contains(document.activeElement)) focus.current = "reaction";
    setReactionsOpen(false);
  };

  return (
    <div ref={panelRef} className={kbOpen ? "mf-room-chat is-compact" : "mf-room-chat"} style={CHAT_SIZE} data-room-chat="" data-playtest-discussion={discussion ? "" : undefined} onKeyDownCapture={(event) => {
      if (event.key !== "Escape" || event.nativeEvent.isComposing || !reactionsOpen) return;
      event.stopPropagation();
      if (surfaceRef.current?.contains(document.activeElement)) focus.current = "reaction";
      setReactionsOpen(false);
    }}>
      {quickReactions ? <span className="mf-sr-only" role="status">{reacted}</span> : null}
      {(reactions.length > 0 && binding.onEmote) || suspect || will || skip || actions || advance ? (
        <div className="mf-room-chat__tools">
          <div className="mf-room-toolbar" role="group" aria-label="게임 도구">
            {reactions.length > 0 && binding.onEmote ? <button type="button" className="mf-room-tool" data-playtest-action="reaction" data-emote-button="" aria-label={reactionLabel} aria-expanded={reactionsOpen} aria-pressed={reactionsOpen} aria-controls={reactionsOpen ? surfaceId : undefined} aria-disabled={binding.sendDisabled || undefined} onMouseDown={(event) => event.preventDefault()} onClick={(event) => { if (!binding.sendDisabled) toggleReactions(event.detail === 0); }}>
              <V2Icon name="face" size={22} />
            </button> : null}
            {suspect ? <button type="button" className="mf-room-tool" data-playtest-action="suspect" data-suspect-btn="" data-suspect-stuck={suspect.used ? "" : undefined} aria-label={suspect.used ? SUSPECT_TEXT.moved : SUSPECT_TEXT.ready} aria-pressed={suspect.mode} aria-disabled={suspect.disabled || undefined} onMouseDown={(event) => { if (suspect.disabled) event.preventDefault(); }} onClick={() => {
              if (suspect.disabled) {
                suspect.deny?.();
                return;
              }
              // 맵에서 캐릭터를 고를 수 있도록 입력칸 초점을 푼다. 초안은 채팅 훅에서 보관한다.
              inputRef?.current?.blur();
              setReactionsOpen(false);
              suspect.toggleMode();
            }}>
              <V2Icon name="postit" size={22} />
              {suspect.used ? <i className="mv-chat__will-dot" aria-hidden="true" /> : null}
            </button> : null}
            {will ? <button type="button" className={will.call ? "mf-room-tool is-call" : "mf-room-tool"} data-will-button="" data-call={will.call ? "" : undefined} data-will-saved={will.saved ? "" : undefined} aria-label={will.saved ? CHAT_TEXT.willSaved : CHAT_TEXT.will} aria-pressed={will.open} aria-disabled={binding.sendDisabled || undefined} onMouseDown={(event) => event.preventDefault()} onClick={(event) => {
              setReactionsOpen(false);
              will.request(event.currentTarget);
            }}>
              <V2Icon name="quill" size={22} />
              {will.saved ? <i className="mv-chat__will-dot" aria-hidden="true" /> : null}
            </button> : null}
            {actions}
            {advance ? <div className="mf-room-chat__advance">{advance}</div> : null}
            {skip ? (
              <button
                type="button" className="mf-room-tool mf-room-tool--skip" data-playtest-action="skip" data-end-discussion=""
                aria-label={`토론 스킵${skip.pressed ? " 취소" : ""}, 필요한 ${skip.total}명 중 ${skip.count}명 요청`}
                aria-pressed={skip.pressed} aria-disabled={!skip.enabled || undefined}
                onMouseDown={(event) => event.preventDefault()} onClick={skip.request}
              >
                <span>{skip.pressed ? "스킵 취소" : "토론 스킵"}</span>
                <HeadCount count={skip.count} total={skip.total} />
              </button>
            ) : null}
          </div>
          {suspect?.mode ? <p className="mf-room-chat__surface mf-playtest__feedback" data-suspect-guidance="" role="status">{suspect.targets.size === 0 ? SUSPECT_TEXT.tooFar : suspect.used ? SUSPECT_TEXT.editHint : SUSPECT_TEXT.modeHint}</p> : null}
          {reactionsOpen ? (
            <div id={surfaceId} ref={surfaceRef} className="mf-room-chat__surface mf-room-chat__reactions" data-playtest-surface="reaction" data-quick-reactions={quickReactions ? "" : undefined} tabIndex={-1}>
              <EmoteTray ids={reactions} columns={quickReactions ? 3 : 5} onPick={pickReaction} disabled={binding.sendDisabled === true || binding.emoteBlocked === true} playing={binding.emotePlaying ?? null} />
            </div>
          ) : null}
        </div>
      ) : null}
      <ChatPanel
        {...binding}
        logHeight={kbOpen ? DISCUSSION_KB_LOG_H : DISCUSSION_LOG_H}
        compact={kbOpen}
        fixedLog
        {...(locked ? { locked: true } : {})}
        emotes={[]}
        {...(inputRef ? { inputRef } : {})}
        {...(callInput ? { callInput: true } : {})}
        {...(onInputFocus ? { onInputFocus } : {})}
      />
    </div>
  );
}

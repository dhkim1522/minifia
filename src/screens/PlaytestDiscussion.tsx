import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import type { EmoteId } from "../../shared/protocol";
import { ChatPanel } from "../components/v2/ChatPanel";
import { DiscussionEvidence } from "../components/v2/DiscussionEvidence";
import { EmoteTray } from "../components/v2/EmoteTray";
import { HeadCount } from "../components/v2/HeadCount";
import { V2Icon } from "../components/v2/V2Icon";
import { CHAT_TEXT, EMOTE_SHORT, EMOTE_TEXT } from "../game/chatText";
import { DISCUSSION_KB_LOG_H } from "../game/chatUi";
import { SUSPECT_TEXT } from "../game/suspectView";
import type { SuspectApi } from "../net/useSuspect";
import type { ChatPanelBinding } from "./GamePanel";

type Surface = "clues" | "reaction";
const QUICK_REACTIONS = ["praise", "deny", "surprise"] as const;

export interface DiscussionToolsProps {
  binding: ChatPanelBinding;
  logHeight: number;
  kbOpen: boolean;
  playtest: boolean;
  callInput?: boolean;
  onInputFocus?: () => void;
  inputRef?: RefObject<HTMLInputElement | null>;
  suspect?: Pick<SuspectApi, "mode" | "targets" | "disabled" | "used" | "off" | "toggleMode"> & {
    deny?: () => void;
  };
  vote?: { enabled: boolean; pressed: boolean; count: number; total: number; request: () => void };
  will?: { open: boolean; saved: boolean; request: (opener: HTMLElement) => void };
}

export function DiscussionPanel({ binding, logHeight, kbOpen, playtest, callInput, onInputFocus, inputRef, suspect, vote, will }: DiscussionToolsProps) {
  const [surface, setSurface] = useState<Surface | null>(null);
  const [reacted, setReacted] = useState("");
  const { evidence, ...composer } = binding;
  const surfaceId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const focus = useRef<Surface | "surface" | null>(null);
  const reactions = playtest ? QUICK_REACTIONS : binding.emotes ?? [];
  const reactionLabel = playtest ? "반응" : EMOTE_TEXT.button;

  useLayoutEffect(() => {
    const target = focus.current;
    focus.current = null;
    if (target === "surface") {
      const first = surfaceRef.current?.querySelector<HTMLButtonElement>('button:not(:disabled):not([aria-disabled="true"])');
      (first ?? surfaceRef.current)?.focus({ preventScroll: true });
    } else if (target !== null) {
      panelRef.current?.querySelector<HTMLButtonElement>(`[data-playtest-action="${target}"]`)?.focus({ preventScroll: true });
    }
  }, [surface]);

  useEffect(() => {
    if (surface === null) return;
    const closeOnOutsidePress = (event: PointerEvent) => {
      if (event.target instanceof Node && !panelRef.current?.contains(event.target)) setSurface(null);
    };
    document.addEventListener("pointerdown", closeOnOutsidePress);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePress);
  }, [surface]);

  useEffect(() => {
    if (binding.sendDisabled) setSurface((current) => current === "reaction" ? null : current);
  }, [binding.sendDisabled]);

  const toggleSurface = (next: Surface, keyboard: boolean) => {
    suspect?.off();
    if (surface === next) {
      setSurface(null);
      return;
    }
    if (kbOpen) inputRef?.current?.blur();
    if (keyboard) focus.current = "surface";
    setSurface(next);
  };
  const pickReaction = (id: EmoteId) => {
    binding.onEmote?.(id);
    if (playtest) setReacted(`${EMOTE_SHORT[id]} 반응`);
    if (surfaceRef.current?.contains(document.activeElement)) focus.current = "reaction";
    setSurface(null);
  };

  return (
    <div ref={panelRef} className="mf-playtest__discussion" data-playtest-discussion="" onKeyDownCapture={(event) => {
      if (event.key !== "Escape" || event.nativeEvent.isComposing || surface === null) return;
      event.stopPropagation();
      if (surfaceRef.current?.contains(document.activeElement)) focus.current = surface;
      setSurface(null);
    }}>
      {playtest ? <span className="mf-sr-only" role="status">{reacted}</span> : null}
      <ChatPanel
        {...composer}
        logHeight={kbOpen ? Math.min(logHeight, DISCUSSION_KB_LOG_H) : logHeight}
        compact={kbOpen}
        fixedLog
        emotes={[]}
        {...(inputRef ? { inputRef } : {})}
        {...(callInput ? { callInput: true } : {})}
        {...(onInputFocus ? { onInputFocus } : {})}
        renderTools={(addQuote) => (
          <div className="mf-playtest__tools">
            <div className="mf-playtest__toolbar" role="group" aria-label="토론 도구">
              <button type="button" className="mf-playtest__action" data-playtest-action="clues" aria-label="단서" aria-expanded={surface === "clues"} aria-controls={surface === "clues" ? surfaceId : undefined} onMouseDown={(event) => event.preventDefault()} onClick={(event) => toggleSurface("clues", event.detail === 0)}>
                <V2Icon name="lens" size={22} />
              </button>
              {reactions.length > 0 && binding.onEmote ? <button type="button" className="mf-playtest__action" data-playtest-action="reaction" data-emote-button="" aria-label={reactionLabel} aria-expanded={surface === "reaction"} aria-pressed={surface === "reaction"} aria-controls={surface === "reaction" ? surfaceId : undefined} aria-disabled={binding.sendDisabled || undefined} onMouseDown={(event) => event.preventDefault()} onClick={(event) => { if (!binding.sendDisabled) toggleSurface("reaction", event.detail === 0); }}>
                <V2Icon name="face" size={22} />
              </button> : null}
              {suspect ? <button type="button" className="mf-playtest__action" data-playtest-action="suspect" data-suspect-btn="" data-suspect-stuck={suspect.used ? "" : undefined} aria-label={suspect.used ? SUSPECT_TEXT.moved : SUSPECT_TEXT.ready} aria-pressed={suspect.mode} aria-disabled={suspect.disabled || undefined} onMouseDown={(event) => { if (suspect.disabled) event.preventDefault(); }} onClick={() => {
                if (suspect.disabled) {
                  suspect.deny?.();
                  return;
                }
                // 이름표로 대상을 골라야 해서 입력칸 초점을 푼다. 초안은 채팅 훅에서 보관한다.
                inputRef?.current?.blur();
                setSurface(null);
                suspect.toggleMode();
              }}>
                <V2Icon name="postit" size={22} />
                {suspect.used ? <i className="mv-chat__will-dot" aria-hidden="true" /> : null}
              </button> : null}
              {will ? <button type="button" className="mf-playtest__action" data-will-button="" aria-label={will.saved ? CHAT_TEXT.willSaved : CHAT_TEXT.will} aria-pressed={will.open} aria-disabled={binding.sendDisabled || undefined} onMouseDown={(event) => event.preventDefault()} onClick={(event) => {
                setSurface(null);
                will.request(event.currentTarget);
              }}>
                <V2Icon name="quill" size={22} />
                {will.saved ? <i className="mv-chat__will-dot" aria-hidden="true" /> : null}
              </button> : null}
              {vote ? <button type="button" className="mf-playtest__action mf-playtest__action--vote" data-playtest-action="vote" data-end-discussion="" aria-label={`투표 요청, ${vote.count}/${vote.total}명 요청`} aria-pressed={vote.pressed} aria-disabled={!vote.enabled || undefined} onMouseDown={(event) => event.preventDefault()} onClick={vote.request}>
                <V2Icon name="ballot" size={22} />
                <HeadCount count={vote.count} total={vote.total} />
              </button> : null}
            </div>
            {suspect?.mode ? <p className="mf-playtest__surface mf-playtest__feedback" data-suspect-guidance="" role="status">{suspect.targets.size === 0 ? SUSPECT_TEXT.tooFar : SUSPECT_TEXT.modeHint}</p> : null}
            {surface === "clues" ? (
              <div id={surfaceId} ref={surfaceRef} className="mf-playtest__surface" data-playtest-surface="clues" role="region" aria-label="단서" tabIndex={-1}>
                {evidence ? <DiscussionEvidence key={evidence.key} evidence={evidence} expanded canQuote={Boolean(binding.onSend)} onQuote={addQuote} onQuoted={() => setSurface(null)} /> : <p className="mf-playtest__feedback">공개된 단서가 없어요</p>}
              </div>
            ) : null}
            {surface === "reaction" ? (
              <div id={surfaceId} ref={surfaceRef} className="mf-playtest__surface mf-playtest__reactions" data-playtest-surface="reaction" data-quick-reactions={playtest ? "" : undefined} tabIndex={-1}>
                <EmoteTray ids={reactions} columns={playtest ? 3 : 5} onPick={pickReaction} disabled={binding.sendDisabled === true || binding.emoteBlocked === true} playing={binding.emotePlaying ?? null} />
              </div>
            ) : null}
          </div>
        )}
      />
    </div>
  );
}

export function PlaytestGhostChat({ binding, logHeight, kbOpen, inputRef }: Pick<DiscussionToolsProps, "binding" | "logHeight" | "kbOpen" | "inputRef">) {
  const [open, setOpen] = useState(false);
  const opening = useRef(false);
  const returning = useRef(false);
  const button = useRef<HTMLButtonElement>(null);

  useLayoutEffect(() => {
    if (open && opening.current) button.current?.focus({ preventScroll: true });
    if (!open && returning.current) button.current?.focus({ preventScroll: true });
    opening.current = false;
    returning.current = false;
  }, [open]);

  const close = () => {
    inputRef?.current?.blur();
    returning.current = true;
    setOpen(false);
  };

  return open ? (
    <div className="mf-playtest__ghost-chat" data-playtest-surface="chat" onKeyDown={(event) => {
      if (event.key === "Escape" && !event.nativeEvent.isComposing) close();
    }}>
      <div className="mf-playtest__ghost-chat-head">
        <strong>채팅</strong>
        <button ref={button} type="button" className="mf-playtest__action" data-playtest-chat-close="" aria-label="채팅 닫기" onMouseDown={(event) => event.preventDefault()} onClick={close}><V2Icon name="close" size={20} /></button>
      </div>
      <ChatPanel {...binding} emotes={[]} logHeight={kbOpen ? Math.min(logHeight, 48) : logHeight} compact={kbOpen} keepLogHeightOnFocus {...(inputRef ? { inputRef } : {})} />
    </div>
  ) : (
    <button ref={button} type="button" className="mf-playtest__action" data-playtest-action="chat" aria-expanded={false} onClick={(event) => {
      opening.current = event.detail === 0;
      setOpen(true);
    }}>채팅</button>
  );
}

import { useLayoutEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { CHAT_MAX_GRAPHEMES } from "../../shared/game/chatRules";
import { ChatPanel } from "../components/v2/ChatPanel";
import { V2Icon } from "../components/v2/V2Icon";
import { EMOTE_LABEL, EMOTE_SHORT } from "../game/chatText";
import { appendEvidenceQuote } from "../game/discussionEvidence";
import type { DiscussionEvidenceRow } from "../game/discussionEvidence";
import { SUSPECT_TEXT } from "../game/suspectView";
import type { SuspectApi } from "../net/useSuspect";
import type { ChatPanelBinding } from "./GamePanel";

type Surface = "clues" | "reaction" | "chat";
const REACTIONS = ["praise", "deny", "surprise"] as const;

export interface DiscussionToolsProps {
  binding: ChatPanelBinding;
  logHeight: number;
  kbOpen: boolean;
  chatOnly?: boolean;
  inputRef?: RefObject<HTMLInputElement | null>;
  suspect?: Pick<SuspectApi, "mode" | "targets" | "disabled" | "used" | "off" | "toggleMode">;
  vote?: { enabled: boolean; pressed: boolean; count: number; total: number; request: () => void };
}

export function PlaytestDiscussion({ binding, logHeight, kbOpen, chatOnly = false, inputRef, suspect, vote }: DiscussionToolsProps) {
  const [surface, setSurface] = useState<Surface | null>(null);
  const [quoteFull, setQuoteFull] = useState(false);
  const [reacted, setReacted] = useState("");
  const { evidence, ...composer } = binding;
  const surfaceRef = useRef<HTMLDivElement>(null);
  const toolsRef = useRef<HTMLDivElement>(null);
  const focus = useRef<"clues" | "reaction" | "chat" | "input" | "surface" | null>(null);

  useLayoutEffect(() => {
    const target = focus.current;
    focus.current = null;
    if (target === "input") inputRef?.current?.focus({ preventScroll: true });
    else if (target === "surface") {
      const element = surfaceRef.current?.querySelector<HTMLButtonElement>("button:not(:disabled)") ?? surfaceRef.current;
      element?.focus({ preventScroll: true });
    }
    else if (target !== null) toolsRef.current?.querySelector<HTMLButtonElement>(`[data-playtest-action="${target}"]`)?.focus({ preventScroll: true });
  }, [surface, inputRef]);

  const closeChat = () => {
    inputRef?.current?.blur();
    focus.current = "chat";
    setSurface(null);
  };

  const openSurface = (next: Surface, keyboard = false) => {
    suspect?.off();
    setQuoteFull(false);
    const closing = surface === next;
    if (!closing && keyboard) focus.current = "surface";
    setSurface(closing ? null : next);
  };

  const quote = (row: DiscussionEvidenceRow) => {
    const draft = appendEvidenceQuote(binding.value, row, CHAT_MAX_GRAPHEMES);
    if (draft === undefined) {
      setQuoteFull(true);
      return;
    }
    binding.onChange(draft);
    focus.current = "input";
    openSurface("chat");
  };

  return (
    <div className="mf-playtest__discussion" data-playtest-discussion="" onKeyDown={(event) => {
      if (event.key !== "Escape" || event.nativeEvent.isComposing || surface === null) return;
      if (surface === "chat") closeChat();
      else {
        focus.current = surface;
        setSurface(null);
      }
    }}>
      <span className="mf-sr-only" role="status">{reacted}</span>
      {suspect?.mode && suspect.targets.size === 0 ? <p className="mf-playtest__feedback" role="status">{SUSPECT_TEXT.tooFar}</p> : null}
      {surface === "clues" ? (
        <div ref={surfaceRef} className="mf-playtest__surface" data-playtest-surface="clues" role="region" aria-label="단서" tabIndex={-1}>
          {evidence ? (
            <>
              <strong className="mf-playtest__surface-label">{evidence.label}</strong>
              <ul className="mf-playtest__clues" aria-label={evidence.label}>
                {evidence.rows.map((row) => (
                  <li key={row.seat} data-evidence-row="" data-evidence-seat={row.seat}>
                    {row.order !== undefined ? <span className="mf-playtest__clue-order">{row.order}</span> : null}
                    <strong className="mf-playtest__clue-name">{row.name}</strong>
                    <span className="mf-playtest__clue-text">{row.text ?? "단서 없음"}</span>
                    {row.text !== null && binding.onSend ? (
                      <button type="button" className="mf-playtest__clue-quote" data-evidence-quote="" aria-label={`${row.name}의 ${evidence.label === "아침 유언" ? "유언" : "단서"} 인용, ${row.text}`} onClick={() => quote(row)}>인용</button>
                    ) : null}
                  </li>
                ))}
              </ul>
            </>
          ) : <p className="mf-playtest__feedback">공개된 단서가 없어요</p>}
          {quoteFull ? <p className="mf-playtest__feedback" role="status">입력 글을 줄이면 인용할 수 있어요</p> : null}
        </div>
      ) : null}
      {surface === "reaction" ? (
        <div ref={surfaceRef} className="mf-playtest__surface mf-playtest__reactions" data-playtest-surface="reaction" role="group" aria-label="반응 고르기" tabIndex={-1}>
          {REACTIONS.map((id) => (
            <button key={id} type="button" className="mf-playtest__action" data-emote={id} aria-label={EMOTE_LABEL[id]}
              disabled={!binding.onEmote || binding.emoteBlocked === true} onClick={() => {
                binding.onEmote?.(id);
                setReacted(`${EMOTE_SHORT[id]} 반응`);
                focus.current = "reaction";
                setSurface(null);
              }}>
              <V2Icon name={id} size={20} />{EMOTE_SHORT[id]}
            </button>
          ))}
        </div>
      ) : null}
      {surface === "chat" ? (
        <div ref={surfaceRef} className="mf-playtest__surface mf-playtest__chat" data-playtest-surface="chat">
          <div className="mf-playtest__chat-head">
            <strong className="mf-playtest__surface-label">채팅</strong>
            <button type="button" className="mf-playtest__action" data-playtest-chat-close="" aria-label="채팅 닫기" onMouseDown={(event) => event.preventDefault()} onClick={closeChat}><V2Icon name="close" size={20} /></button>
          </div>
          <ChatPanel {...composer} emotes={[]} logHeight={kbOpen ? Math.min(logHeight, 48) : logHeight} compact={kbOpen} keepLogHeightOnFocus {...(inputRef ? { inputRef } : {})} />
        </div>
      ) : (
        <div className="mf-playtest__toolbar" ref={toolsRef} role="group" aria-label="토론 도구">
          {chatOnly ? null : <button type="button" className="mf-playtest__action" data-playtest-action="clues" aria-expanded={surface === "clues"} onClick={(event) => openSurface("clues", event.detail === 0)}><V2Icon name="lens" size={18} />단서</button>}
          {suspect ? <button type="button" className="mf-playtest__action mf-playtest__action--stacked" data-playtest-action="suspect" aria-label={suspect.used ? SUSPECT_TEXT.moved : SUSPECT_TEXT.ready} aria-pressed={suspect.mode} disabled={suspect.disabled} onClick={() => {
            setSurface(null);
            suspect.toggleMode();
          }}><V2Icon name="postit" size={16} /><span>의심딱지</span></button> : null}
          {chatOnly ? null : <button type="button" className="mf-playtest__action" data-playtest-action="reaction" aria-expanded={surface === "reaction"} disabled={!binding.onEmote} onClick={(event) => openSurface("reaction", event.detail === 0)}><V2Icon name="face" size={18} />반응</button>}
          <button type="button" className="mf-playtest__action" data-playtest-action="chat" aria-expanded={false} onClick={(event) => openSurface("chat", event.detail === 0)}>채팅</button>
          {vote ? <button type="button" className="mf-playtest__action mf-playtest__action--stacked" data-playtest-action="vote" data-end-discussion="" aria-pressed={vote.pressed}
            aria-label={`투표 요청, ${vote.count}/${vote.total}명 요청`} disabled={!vote.enabled} onClick={vote.request}><span>투표 요청</span><small className="mv-count">{vote.count}/{vote.total}</small></button> : null}
        </div>
      )}
    </div>
  );
}

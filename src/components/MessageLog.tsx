import { useLayoutEffect, useRef } from "react";
import type { ReactElement } from "react";
import type { ChatLine, PublicPlayer } from "../../shared/protocol";
import { messageText } from "../game/messageText";
import "../styles/day.css";

export interface MessageLogProps {
  /** 서버가 보낸 최근 메시지(최대 20, seq 오름차순). 이모티콘은 담기지 않는다(D-15) */
  lines: ChatLine[];
  players: PublicPlayer[];
  mySeat: number;
}

/** 맨 아래에서 이 거리(px) 안이면 "맨 아래에 있다"고 본다 */
const STICK_PX = 24;

// 낮 토론 최근 메시지 목록(S-07). 높이는 3줄로 고정하고 줄이 더 많으면 안에서 세로로 스크롤한다.
// 문장은 서버가 보낸 문자열이 아니라 템플릿 ID·seat·직업으로 화면이 만든다(messageText) — 모두 React 텍스트로만 그린다(T-02-31).
// 새 줄이 오면 사용자가 맨 아래 근처에 있을 때만 맨 아래로 내린다. 위로 밀어 둔 동안은 그대로 둔다.
export function MessageLog({ lines, players, mySeat }: MessageLogProps): ReactElement {
  const listRef = useRef<HTMLOListElement>(null);
  // 사용자가 맨 아래 근처에 있는가. 처음엔 맨 아래다.
  const stickRef = useRef(true);

  const onScroll = (): void => {
    const el = listRef.current;
    if (!el) return;
    stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight <= STICK_PX;
  };

  const lastSeq = lines.length > 0 ? (lines[lines.length - 1]?.seq ?? -1) : -1;
  useLayoutEffect(() => {
    const el = listRef.current;
    if (el && stickRef.current) el.scrollTop = el.scrollHeight;
  }, [lastSeq, lines.length]);

  const nicknameOf = (seat: number): string | undefined => players.find((p) => p.seat === seat)?.nickname;

  return (
    <ol ref={listRef} className="mf-msglog" role="log" aria-live="polite" aria-relevant="additions" onScroll={onScroll}>
      {lines.length === 0 ? <li className="mf-msglog__empty">아직 메시지가 없어요</li> : null}
      {lines.map((l, i) => {
        const nickname = nicknameOf(l.seat) ?? "";
        const isLatest = i === lines.length - 1;
        return (
          <li key={l.seq} className={isLatest ? "mf-msglog__item mf-msglog__item--latest" : "mf-msglog__item"}>
            <span className="mf-msglog__who">
              <span className="mf-msglog__dot" aria-hidden="true" style={{ background: `var(--seat-${l.seat + 1})` }} />
              <span className="mf-msglog__name" title={nickname}>
                {l.seat === mySeat ? "나" : nickname}
              </span>
            </span>
            <span className="mf-msglog__text">{messageText(l, nicknameOf)}</span>
          </li>
        );
      })}
    </ol>
  );
}

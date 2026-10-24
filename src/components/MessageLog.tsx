import { useState } from "react";
import type { ReactElement } from "react";
import type { ChatLine, PublicPlayer } from "../../shared/protocol";
import { messageText } from "../game/messageText";
import { ChatHistorySheet } from "./ChatHistorySheet";
import { Icon } from "./Icon";
import "../styles/day.css";

export interface MessageLogProps {
  /** 이 폰이 그날 받은 채팅 줄(seq 오름차순, 02-16 의 useDayChat). 이모티콘은 담기지 않는다(D-15) */
  lines: ChatLine[];
  players: PublicPlayer[];
  mySeat: number;
  /** 첫 줄 시스템 안내(화면 문구라 seq 가 없다). 점·이름 없이 본문만, 글자는 늘 gray-500(UI-SPEC N-2) */
  systemLine?: string;
  /** 로그 이름(aria-label). 기본 "최근 채팅" — 밤 마피아 "마피아 채팅", 관전 "마피아 채팅(관전)" */
  label?: string;
  /** ^ 버튼(채팅 내역 모달) 유무. 기본 true — 밤 관전은 false(시안 E1) */
  more?: boolean;
}

/** 패널에 그리는 최근 줄 수(시안 9차 .lg 세 줄). 지난 줄은 ^ 버튼의 채팅 내역 모달에서 본다 */
const RECENT_LINES = 3;

export interface ChatLineItemProps {
  line: ChatLine;
  /** 마지막(가장 새) 줄 — 글자가 밝다 */
  latest: boolean;
  players: PublicPlayer[];
  mySeat: number;
}

/** 시스템 안내 줄(시안 .lg li.sys): 점·이름 없이 본문만. 하단 세 줄과 채팅 내역 모달이 같은 부품을 쓴다 */
export function SystemLineItem({ text }: { text: string }): ReactElement {
  return (
    <li className="mf-msglog__item mf-msglog__item--sys">
      <span className="mf-msglog__text">{text}</span>
    </li>
  );
}

// 채팅 줄 하나의 모양(점 + 굵은 이름 + 본문). 하단 세 줄과 채팅 내역 모달이 이 부품 하나를 쓴다(결정 0017-6).
// 문장은 서버가 보낸 문자열이 아니라 템플릿 ID·seat·직업으로 화면이 만든다(messageText) — 모두 React 텍스트로만 그린다(T-02-31·T-02-47).
export function ChatLineItem({ line, latest, players, mySeat }: ChatLineItemProps): ReactElement {
  const nicknameOf = (seat: number): string | undefined => players.find((p) => p.seat === seat)?.nickname;
  const nickname = nicknameOf(line.seat) ?? "";
  return (
    <li className={latest ? "mf-msglog__item mf-msglog__item--latest" : "mf-msglog__item"}>
      <span className="mf-msglog__who">
        <span className="mf-msglog__dot" aria-hidden="true" style={{ background: `var(--seat-${line.seat + 1})` }} />
        <span className="mf-msglog__name" title={nickname}>
          {line.seat === mySeat ? "나" : nickname}
        </span>
      </span>
      <span className="mf-msglog__text">{messageText(line, nicknameOf)}</span>
    </li>
  );
}

// 낮 토론 하단의 채팅 면(S-07, 시안 R9-5 .lg): 최근 세 줄 + 오른쪽 ^ 버튼. 세 줄 높이는 고정이라 줄이 적어도 출렁이지 않는다.
// ^ 버튼이 열림 상태를 쥐고 같은 lines 를 채팅 내역 모달에 넘긴다 — 단계가 바뀌어 패널이 언마운트되면 모달도 같이 닫힌다(UI-SPEC phase-change).
// systemLine 이 있으면 창은 [안내, ...줄] 의 마지막 3줄이라 줄이 쌓이면 안내가 창 밖으로 밀린다. 안내가 있으면 빈 상태 문구는 쓰지 않는다.
export function MessageLog({ lines, players, mySeat, systemLine, label = "최근 채팅", more = true }: MessageLogProps): ReactElement {
  const [open, setOpen] = useState(false);
  const entries: (ChatLine | null)[] = systemLine !== undefined ? [null, ...lines] : lines;
  const recent = entries.slice(-RECENT_LINES);

  return (
    <>
      <div className="mf-msglog">
        <ol className="mf-msglog__list" role="log" aria-label={label} aria-live="polite" aria-relevant="additions">
          {recent.length === 0 ? <li className="mf-msglog__empty">아직 메시지가 없어요</li> : null}
          {recent.map((l, i) =>
            l === null ? (
              <SystemLineItem key="system-line" text={systemLine ?? ""} />
            ) : (
              <ChatLineItem key={l.seq} line={l} latest={i === recent.length - 1} players={players} mySeat={mySeat} />
            ),
          )}
        </ol>
        {more ? (
          <button type="button" className="mf-msglog__more" aria-label="채팅 내역 크게 보기" onClick={() => setOpen(true)}>
            <Icon name="chevronUp" size={22} />
          </button>
        ) : null}
      </div>
      {more && open ? (
        <ChatHistorySheet lines={lines} players={players} mySeat={mySeat} systemLine={systemLine} onClose={() => setOpen(false)} />
      ) : null}
    </>
  );
}

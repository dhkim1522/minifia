import type { ReactElement, ReactNode } from "react";
import { VERDICT_TEXT } from "../game/verdict";
import "../styles/day.css";
import "../styles/night.css";

// 밤·아침 하단 패널(시안 N2·N3·N4·M1): 제목(24px) + 안내(14px/20px) + 알약(선택 상태·안내).
// 제목·안내 스타일은 직업 공개 패널(.mf-claimpanel__title/__guide)을 그대로 쓴다(UI-SPEC "기존 부품").
// 이 부품은 역할을 모른다 — 장면이 역할에 맞는 문구를 골라 넘긴다. 문구는 아래 표 한 곳(UI-SPEC Copywriting).

/** 밤·아침 하단 문구 표(단일 출처). 역할 이름 문자열 없이 문구만 둔다 */
export const NIGHT_PANEL_TEXT = {
  police: { title: "조사할 사람을 고르세요", guide: "결과는 밤이 끝날 때 알려 드려요 · 마감까지 바꿀 수 있어요" },
  doctor: { title: "지킬 사람을 고르세요", guide: "나 자신도 고를 수 있어요 · 마감까지 바꿀 수 있어요" },
  citizen: {
    title: "밤이 되었어요",
    guide: "다른 사람들이 행동하는 중이에요. 마감까지 기다려 주세요",
    pill: "이번 밤에는 할 수 있는 행동이 없어요",
  },
  morning: { title: "아침이 밝았습니다", guide: "곧 낮 토론이 시작돼요" },
  /** 마피아 밤 채팅 로그의 첫 줄(시스템 안내) */
  mafiaChatNotice: "마피아끼리만 보여요",
  /** 대상 선택이 서버에서 거부됐을 때(BAD_MESSAGE) 토스트 */
  pickError: "보내지 못했어요. 다시 시도해 주세요",
} as const;

export interface NightPanelProps {
  title: string;
  guide: string;
  children?: ReactNode;
}

export function NightPanel({ title, guide, children }: NightPanelProps): ReactElement {
  return (
    <div className="mf-nightpanel">
      <h2 className="mf-claimpanel__title" data-guide="">{title}</h2>
      <p className="mf-claimpanel__guide">{guide}</p>
      {children}
    </div>
  );
}

export interface PickPillProps {
  /** 지금 보이는 선택. 없으면 '선택 안 함'. label 은 닉네임(자신이면 "나") */
  pick: { seat: number; label: string } | null;
  /** "pick"(기본, 밤): `선택 ●이름`. "vote"(후보 선택, D-19): `●이름님에게 투표했어요` */
  format?: "pick" | "vote";
}

// 선택 알약(시안 .pk): "선택 ●이름". 눌리지 않는 상태 표시라 role=status 로 변화를 읽는다.
export function PickPill({ pick, format = "pick" }: PickPillProps): ReactElement {
  if (pick === null) {
    return (
      <p className="mf-pk mf-pk--empty" role="status" aria-live="polite">
        {VERDICT_TEXT.candidateNone}
      </p>
    );
  }
  const name = (
    <b>
      <i className="mf-pk__dot" aria-hidden="true" style={{ background: `var(--seat-${(pick.seat % 8) + 1})` }} />
      {pick.label}
    </b>
  );
  if (format === "vote") {
    // 이름 뒤 '님' 은 받침을 보지 않는다(D-11). 문구 조각은 VERDICT_TEXT 한 곳
    return (
      <p className="mf-pk mf-pk--vote" role="status" aria-live="polite">
        {name}
        {VERDICT_TEXT.votedSuffix}
      </p>
    );
  }
  return (
    <p className="mf-pk" role="status" aria-live="polite">
      <span>선택</span> {name}
    </p>
  );
}

// 행동이 없는 사람(시민)의 알약: 같은 모양, 회색 글자, 눌리지 않는다.
export function NoticePill({ text }: { text: string }): ReactElement {
  return <p className="mf-pk mf-pk--empty">{text}</p>;
}

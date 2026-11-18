import type { RoomView } from "../../shared/protocol";
import type { ChatStoreLine } from "../net/chatStore";
import { keywordAnswersOf } from "./keywordView";

export interface DiscussionEvidenceRow {
  seat: number;
  name: string;
  text: string | null;
  order?: number;
}

export interface DiscussionEvidence {
  key: string;
  label: string;
  rows: DiscussionEvidenceRow[];
}

export function appendEvidenceQuote(draft: string, { name, text }: Pick<DiscussionEvidenceRow, "name" | "text">, limit: number): string | undefined {
  if (text === null) return undefined;
  const separator = draft && !/\s$/.test(draft) ? " " : "";
  const quoted = `${draft}${separator}${name} “${text}”`;
  return quoted.length <= limit ? quoted : undefined;
}

/** 아침의 공개 피해자와 이어지는 토론의 일차. 아침 view를 본 연결에서만 알 수 있다. */
export interface MorningVictim {
  round: number;
  day: number;
  seat: number;
}

export function discussionEvidenceOf(view: RoomView, victim: MorningVictim | null, publicChat: readonly ChatStoreLine[]): DiscussionEvidence | undefined {
  if (view.phase !== "discussion" || view.day === undefined) return undefined;
  const day = view.day.n;
  const nameOf = (seat: number) => view.players.find((player) => player.seat === seat)?.nickname ?? `${seat + 1}번 자리`;

  if (day === 1) {
    const answers = keywordAnswersOf(view);
    if (answers === undefined || answers.length === 0) return undefined;
    return {
      key: `${view.round ?? 1}:answers`,
      label: "모두의 답",
      rows: answers.map(({ seat, text, order }) => ({ seat, name: nameOf(seat), text, order })),
    };
  }

  if (victim === null || victim.round !== (view.round ?? 1) || victim.day !== day) return undefined;
  const will = publicChat.find((line) => line.ch === "all" && line.card === "will" && line.seat === victim.seat);
  if (!will?.text.trim()) return undefined;
  return {
    key: will.key,
    label: "아침 유언",
    rows: [{ seat: victim.seat, name: nameOf(victim.seat), text: will.text }],
  };
}

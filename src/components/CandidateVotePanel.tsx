import type { ReactElement } from "react";
import { VERDICT_TEXT } from "../game/verdict";
import { NightPanel, PickPill } from "./NightPanel";
import { ReadOnlyRow } from "./ReadOnlyRow";

// 후보 선택 하단 패널(UI-SPEC 7.2·8.2, D-19·D-35): 제목 + 안내 + 알약 한 줄(전체 폭, 말하기·이모티콘 입구 없음).
// 밤 패널(NightPanel)과 같은 마크업이다. 살아 있는 viewer 는 확정 알약(`선택 안 함` → `●이름님에게 투표했어요`),
// 탈락한 viewer 는 관전 제목·안내와 `관전 중 · 볼 수만 있어요` 줄을 본다. 문구는 모두 VERDICT_TEXT 에서 읽는다.
// 이 부품은 남의 선택을 입력으로 받지 않는다(서버가 보내지 않는다, A7). 닉네임은 React 텍스트다.

export interface CandidateVotePanelProps {
  /** 내가 고른 자리(label = 닉네임). 아직 안 골랐으면 null */
  pick: { seat: number; label: string } | null;
  /** 탈락한 viewer: 알약 대신 관전 줄 */
  readOnly: boolean;
}

export function CandidateVotePanel({ pick, readOnly }: CandidateVotePanelProps): ReactElement {
  if (readOnly) {
    return (
      <NightPanel title={VERDICT_TEXT.candidateSpectatorTitle} guide={VERDICT_TEXT.candidateSpectatorHint}>
        <ReadOnlyRow text={VERDICT_TEXT.spectatorPill} />
      </NightPanel>
    );
  }
  return (
    <NightPanel title={VERDICT_TEXT.candidateTitle} guide={VERDICT_TEXT.candidateHint}>
      <PickPill pick={pick} format="vote" />
    </NightPanel>
  );
}

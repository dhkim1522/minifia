import "../../styles/v2.css";
import { CHAT_TEXT } from "../../game/chatText";
import type { RoleId } from "../../../shared/game/roles";
import type { BadgeId } from "../../../shared/protocol";
import type { ReactNode } from "react";
import { ClaimBadge } from "./ClaimBadge";
import { RoleChip } from "./RoleChip";
import { SureStamp } from "./SureStamp";
import { V2Icon } from "./V2Icon";
import { VoteBadge } from "./VoteBadge";

// 이름표(NameTag)와 머리 위 쌓임(HeadStack). design/v2.0/design-system/components/bundle.js :81·:98 을 React 19 로 옮겼다.
// 같은 마크업·클래스 이름(mv-tag·mv-head·mv-typing)을 쓴다. 속성은 name·color·me·away 와 typing(입력 중 칸)이다.
// 입력 중 칸은 7페이즈(07-03), 직업 표시·도장·배지와 mine·done·blink·ghost 는 8페이즈(08-05)가 더했다.
// 쌓임 순서(위 → 아래): typing → RoleChip(role) → SureStamp(sure) → VoteBadge(count·lead) → 이름표.
// role 은 부르는 쪽(유령 화면 분기)이 넘길 때만 칩을 그린다 — 이 부품은 역할을 스스로 판단하지 않는다(T-08-20).
// 상태 속성(data-count·lead·sure·mine·done·ghost)은 켜질 때만 .mv-head 에 실린다(E2E·누설 검사가 읽는다).
// 직업 주장 배지(09.1.1-08)는 이름표(.mv-tag) 안 오른쪽 위 모서리에 걸린다(절대 위치) — 쌓임 순서·높이를 바꾸지 않는다.
// 입력 중 알약에는 글자가 없다(점 세 개) — 채팅 본문을 머리 위 말풍선으로 띄우지 않는다.
//
// 닉네임은 React 텍스트 노드로만 그린다(innerHTML 없음, T-06-26). 말줄임도 하지 않는다:
// 최대 폭이 없고(white-space: nowrap) 전각 8자 + " (나)" 도 잘리지 않는다(MAP-07, 결정 0052-2).

// 이름표 위 아이콘의 읽을 이름(승인 bundle.js NameTag 와 같은 문구)
const MINE_LABEL = "내가 가리킨 사람";
const DONE_LABEL = "투표함";

export interface NameTagProps {
  name: string;
  /** 자리 구분색 — `var(--seat-1)` ~ `var(--seat-8)` 값 */
  color: string;
  /** 내 캐릭터: 닉네임 뒤에 " (나)" 와 안쪽 테두리 */
  me?: boolean;
  /** 연결 끊김: 불투명도 0.55, 점 gray-700 */
  away?: boolean;
  /** 내가 지목·선택한 사람: gray-100 면·night-900 글자 + 손가락 */
  mine?: boolean;
  /** 찬반에서 투표를 마친 사람: 이름 뒤 체크 16 (접근성 이름 "투표함") */
  done?: boolean;
  /** done 체크의 접근성 이름. 없으면 "투표함" — 결과 화면(다시 하기 준비)은 "준비됨" */
  doneLabel?: string;
  /** 처음 보는 지목의 처음 3초: 이름표 깜빡임 */
  blink?: boolean;
  /** 유령 표식(is-ghost). 이름표는 불투명 — 몸이 0.26 안개라 직업은 RoleChip 이 알린다(09.1-09) */
  ghost?: boolean;
  /** 이름표 모서리에 걸 요소(직업 주장 배지). 이름표 폭·쌓임 높이를 늘리지 않는다 */
  children?: ReactNode;
}

export function NameTag({ name, color, me, away, mine, done, doneLabel, blink, ghost, children }: NameTagProps) {
  const cls = ["mv-tag", me && "is-me", away && "is-away", blink && "is-blink", mine && "is-mine", ghost && "is-ghost"]
    .filter(Boolean)
    .join(" ");
  return (
    <span className={cls}>
      <span className="mv-tag__dot" style={{ background: color }} />
      <span className="mv-tag__name">{me ? `${name} (나)` : name}</span>
      {mine ? <V2Icon name="point" size={16} label={MINE_LABEL} /> : null}
      {done ? (
        <span className="mv-tag__done">
          <V2Icon name="check" size={16} label={doneLabel ?? DONE_LABEL} />
        </span>
      ) : null}
      {children}
    </span>
  );
}

export type HeadStackProps = NameTagProps & {
  /** 입력 중: 이름표 위 맨 위 칸에 알약(점 세 개)을 그린다 */
  typing?: boolean;
  /** 직업 칩. 유령 화면 분기만 넘긴다 — 없으면 칩 요소도 data-role-chip 도 DOM 에 없다 */
  role?: RoleId;
  /** 받은 표 수. 1 이상이면 배지 */
  count?: number;
  /** 최다 득표 한 명: 배지가 맥박. 배지는 이 판단을 하지 않는다 */
  lead?: boolean;
  /** 유력 도장 */
  sure?: boolean;
  /** 도장 글자. 없으면 "유력", 밤 마피아 화면은 "확정" */
  sureLabel?: string;
  /** 직업 주장 배지(09.1.1-08, UI-SPEC A-1). 서버 view.players[].badge 만 넘긴다. 없으면 배지 요소도 DOM 에 없다. data-role-chip 과 섞이지 않는다 */
  claim?: BadgeId;
  /** 말 바꿈 점 */
  claimSwapped?: boolean;
  /** 배지 팝 횟수(바뀔 때마다 늘어난다 — key 로 다시 마운트해 한 번 돈다). 없거나 0 이면 팝 없음 */
  claimPop?: number;
  /** "말 바꿈" 글자 알약을 지금 띄운다 */
  claimNotice?: boolean;
};

// 바닥 가운데를 캐릭터 머리 꼭대기에 translate(-50%, -100%) 로 놓는 일은 쓰는 쪽(이름표 층, 06-13)이 한다.
export function HeadStack({ name, color, me, away, typing, role, count, lead, sure, sureLabel, mine, done, doneLabel, blink, ghost, claim, claimSwapped, claimPop, claimNotice }: HeadStackProps) {
  const hasBadge = count !== undefined && count >= 1;
  return (
    <div
      className="mv-head"
      data-typing={typing ? "true" : undefined}
      data-count={hasBadge ? String(count) : undefined}
      data-lead={lead ? "true" : undefined}
      data-sure={sure ? "true" : undefined}
      data-mine={mine ? "true" : undefined}
      data-done={done ? "true" : undefined}
      data-ghost={ghost ? "true" : undefined}
    >
      {typing ? (
        <span className="mv-typing" role="img" aria-label={CHAT_TEXT.typing}>
          <i />
          <i />
          <i />
        </span>
      ) : null}
      {role ? <RoleChip role={role} /> : null}
      {sure ? <SureStamp {...(sureLabel !== undefined ? { label: sureLabel } : {})} /> : null}
      {hasBadge ? <VoteBadge count={count} lead={lead} /> : null}
      <NameTag name={name} color={color} me={me} away={away} mine={mine} done={done} doneLabel={doneLabel} blink={blink} ghost={ghost}>
        {claim !== undefined ? (
          <ClaimBadge key={claimPop ?? 0} claim={claim} swapped={claimSwapped === true} pop={claimPop !== undefined && claimPop > 0} notice={claimNotice === true} />
        ) : null}
      </NameTag>
    </div>
  );
}

import "../../styles/v2.css";
import { ballotsSummary, type Voter } from "../../game/ballotsView";
import { V2Icon } from "./V2Icon";

// 찬반 공개(BallotReveal, 결정 0083-9). 처형 단계에서 큰 글 아래 한 줄에 "찬성 N"·"반대 N" 두 덩이(엄지 아이콘 + 숫자)만 뜬다 — 얼굴 칩·이름 알약은 없다.
// 누가 어느 쪽이었는지는 서버 찬반 기록 카드(채팅 기록, 4.6초 도착)가 남기고, 화면 읽기용 한 줄(이름 포함)만 여기 그대로 둔다.
// 찬성/반대는 색이 아니라 아이콘과 글자로 구별한다 — 진홍·놋쇠·초록을 쓰지 않는다(역할마다 같은 화면).
// 입력은 좌석·이름·구분색뿐이라 역할을 모른다(T-09.1.1-33). 이름은 React 텍스트 노드로만 그린다(T-09.1.1-34).
// 등장: 찬성이 먼저, 0.4초 뒤 반대(stage). 위치(위 --mf-ballot-top·좌우 16)는 .mv-ballots CSS 가 정하고, 그 값을 정하는 일은 GameMap 의 몫이다.

export type BallotStage = "none" | "yes" | "both";

export interface BallotRevealProps {
  yes: readonly Voter[];
  no: readonly Voter[];
  /** none = 아직, yes = 찬성까지, both = 반대까지 */
  stage: BallotStage;
  /** 재접속 등으로 이미 지난 구간: 애니메이션 없이 바로 보인다 */
  instant?: boolean;
  reducedMotion?: boolean;
}

function Count({ side, n, shown, animate }: { side: "yes" | "no"; n: number; shown: boolean; animate: boolean }) {
  const cls = ["mv-ballots__group", !shown && "is-pending", shown && animate && "is-enter"].filter(Boolean).join(" ");
  return (
    <section className={cls} data-ballot-side={side}>
      <V2Icon name={side === "yes" ? "thumbUp" : "thumbDown"} size={24} />
      <span>{`${side === "yes" ? "찬성" : "반대"} ${n}`}</span>
    </section>
  );
}

export function BallotReveal({ yes, no, stage, instant, reducedMotion }: BallotRevealProps) {
  const still = !!instant || !!reducedMotion;
  const showYes = still || stage !== "none";
  const showNo = still || stage === "both";
  const summary = ballotsSummary({ yes: [...yes], no: [...no] });
  return (
    <div className="mv-ballots" role="status" data-ballots="" data-stage={stage}>
      {showYes ? <span className="mv-sr">{summary}</span> : null}
      <div className="mv-ballots__body" aria-hidden="true">
        <Count side="yes" n={yes.length} shown={showYes} animate={!still} />
        <Count side="no" n={no.length} shown={showNo} animate={!still} />
      </div>
    </div>
  );
}

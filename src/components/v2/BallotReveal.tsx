import { useLayoutEffect, useRef, useState } from "react";
import "../../styles/v2.css";
import { ballotsSummary, type Voter } from "../../game/ballotsView";
import { faceSrc } from "../../net/assets";
import { V2Icon } from "./V2Icon";

// 찬반 기록 공개(BallotReveal, UI-SPEC C-2, 결정 0066-3). 처형 단계에서 찬성 묶음이 위, 반대 묶음이 아래에 이름표 알약으로 나타난다.
// 찬성/반대는 색이 아니라 위치·아이콘·테두리(gray-100 / gray-500)로 구별한다 — 진홍·놋쇠·초록을 쓰지 않는다(역할마다 같은 화면).
// 입력은 좌석·이름·구분색뿐이라 역할을 모른다(T-09.1.1-33). 이름은 React 텍스트 노드로만 그린다(T-09.1.1-34).
// 변론자·미투표자는 목록에 없다. 정렬은 부르는 쪽(ballotsOf)이 자리 번호 오름차순으로 준다.
// 위치(위 131·좌우 16·아래 패널 윗변 위 8)는 .mv-ballots CSS 가 정하고, --mf-panel-h 를 설정하는 일은 GameMap(09.1.1-13)의 몫이다.
// 2단계: 자기 영역(루트)에 내용이 넘치면 이름을 빼고 얼굴 32px 원만 그린다 — 레이아웃 효과에서 한 번 재서 정하고 되돌리지 않는다.

export type BallotStage = "none" | "yes" | "both";

export interface BallotRevealProps {
  yes: readonly Voter[];
  no: readonly Voter[];
  /** none = 아직, yes = 찬성 묶음까지, both = 반대 묶음까지 */
  stage: BallotStage;
  /** 재접속 등으로 이미 지난 구간: 애니메이션 없이 바로 보인다 */
  instant?: boolean;
  /** 처음부터 얼굴만 그린다(측정이 넘침을 알아도 이 값이 켜진다) */
  compact?: boolean;
  reducedMotion?: boolean;
  /** 자기 영역의 윗변이 바뀔 때마다 바뀌는 값(GameMap 의 --mf-ballot-top). 자식 효과가 부모 효과보다 먼저 돌아 첫 측정이 옛 윗변으로 되므로, 윗변이 내려오면 다시 잰다 */
  fitKey?: number;
}

function Face({ voter, size }: { voter: Voter; size: number }) {
  const [broken, setBroken] = useState(false);
  const cls = broken ? "mv-ballots__face is-fallback" : "mv-ballots__face";
  const style = { width: size, height: size };
  if (broken) return <span className={cls} style={style} aria-hidden="true" />;
  return <img className={cls} style={style} src={faceSrc(voter.seat)} alt="" draggable={false} onError={() => setBroken(true)} />;
}

function Pill({ voter, side, compact }: { voter: Voter; side: "yes" | "no"; compact: boolean }) {
  const cls = ["mv-ballots__pill", `is-${side}`, voter.me && "is-me", compact && "is-compact"].filter(Boolean).join(" ");
  return (
    <span className={cls} data-ballot-seat={voter.seat} style={{ "--ballot-seat": voter.color } as React.CSSProperties}>
      <Face voter={voter} size={compact ? 32 : 24} />
      {compact ? null : <span className="mv-ballots__name">{voter.name}</span>}
    </span>
  );
}

function Group({ side, voters, shown, animate, compact }: { side: "yes" | "no"; voters: readonly Voter[]; shown: boolean; animate: boolean; compact: boolean }) {
  const cls = ["mv-ballots__group", !shown && "is-pending", shown && animate && "is-enter"].filter(Boolean).join(" ");
  return (
    <section className={cls} data-ballot-side={side}>
      <div className="mv-ballots__head">
        <V2Icon name={side === "yes" ? "thumbUp" : "thumbDown"} size={24} />
        <span>{`${side === "yes" ? "찬성" : "반대"} ${voters.length}`}</span>
      </div>
      <div className="mv-ballots__row">
        {voters.map((v) => (
          <Pill key={v.seat} voter={v} side={side} compact={compact} />
        ))}
      </div>
    </section>
  );
}

export function BallotReveal({ yes, no, stage, instant, compact, reducedMotion, fitKey }: BallotRevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [tight, setTight] = useState(false);
  const small = !!compact || tight;

  // 자기 영역보다 내용이 길면 얼굴만으로 줄인다(한 번 재서 정한다 — 줄어든 내용으로 다시 재면 깜빡이기 때문)
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || small) return;
    if (el.scrollHeight > el.clientHeight) setTight(true);
  }, [small, yes.length, no.length, fitKey]);

  const still = !!instant || !!reducedMotion;
  const showYes = still || stage !== "none";
  const showNo = still || stage === "both";
  const summary = ballotsSummary({ yes: [...yes], no: [...no] });
  return (
    <div ref={ref} className="mv-ballots" role="status" data-ballots="" data-stage={stage} data-compact={small ? "true" : "false"}>
      {showYes ? <span className="mv-sr">{summary}</span> : null}
      <div className="mv-ballots__body" aria-hidden="true">
        <Group side="yes" voters={yes} shown={showYes} animate={!still} compact={small} />
        <Group side="no" voters={no} shown={showNo} animate={!still} compact={small} />
      </div>
    </div>
  );
}

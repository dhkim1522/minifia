import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { isAlive } from "../../shared/game/alive";
import type { RoomView } from "../../shared/protocol";
import { CandidateVotePanel } from "../components/CandidateVotePanel";
import type { DayTableLayout, DayTableProps, DayTableSeat } from "../components/DayTable";
import { DefensePanel } from "../components/DefensePanel";
import { ExecIntroCard } from "../components/ExecIntroCard";
import { ExecVotePanel } from "../components/ExecVotePanel";
import { MorningCard, exitDelayOf } from "../components/MorningCard";
import { NoExecutionCard } from "../components/NoExecutionCard";
import { NIGHT_PANEL_TEXT, NightPanel } from "../components/NightPanel";
import { RevealLayer } from "../components/RevealLayer";
import { executionTitle } from "../game/eliminationText";
import {
  CLINCH_BEAT_MS,
  CLINCH_VIBRATE_MS,
  NO_EXEC_INTRO_DELAY_MS,
  VERDICT_BLUR_PX,
  VERDICT_DIM_PERCENT,
  VERDICT_TEXT,
  capHalos,
  clinchBeat,
  defenseInstruction,
  revealIntroHint,
  revealResultLine,
} from "../game/verdict";
import type { HaloKind, HaloRequest } from "../game/verdict";
import { usePhaseArrival } from "../net/phaseArrival";
import { useReducedMotion } from "../net/useReducedMotion";
import { useRevealState } from "../net/useRevealState";
import type { RoomConnection } from "../net/useRoomConnection";
import { useViewChoice } from "../net/useViewChoice";

// 투표 구간(execVote → execution) 전용 장면 조립 훅(04-16). DayScene 은 이 훅이 null 이 아닐 때만 제목·안내·타이머 톤·하단·좌석 덧입힘을 이 값으로 덮는다 —
// 낮·밤·아침 경로는 한 줄도 바뀌지 않는다. 이후 계획이 후보 선택·공개·변론·처형 단계를 이 파일에 더한다(DayScene 줄 수를 늘리지 않는다).
// 이 훅은 서버 view 만 따른다. 단계나 승패를 화면이 스스로 정하지 않고, 역할 문자열을 만들지 않는다.
// 투표 단계에는 말하기·이모티콘 입구가 없다(D-12 개정, P-7): FLOAT_PHASES·CHAT_PHASES 에 이 단계들이 없어 말풍선·이모티콘·채팅 줄도 뜨지 않는다.
// 처형(execution, 04-23)은 변론 무대를 그대로 이어 간다(후보는 같은 가운데 자리, 유령으로 바뀌고 앰버 카드가 뜬다). 하단은 모두에게 같은 두 줄이고 입구가 없다.
// 최후 변론(defense)의 하단은 후보 본인을 포함한 모두에게 같은 상태 줄(DefensePanel)이고, 탈락 viewer 는 관전 알약이다 — 빠른 메시지·이모티콘 입구가 없다(CHAT-06).

export interface VerdictSceneCtx {
  view: RoomView;
  connection: RoomConnection;
  /** 내 자리가 살아 있는가(탈락 viewer 는 관전 하단) */
  meAlive: boolean;
  /** 위쪽 토스트 */
  showToast: (text: string) => void;
  /** 좌석을 눌렀을 때 열 기록 카드(DayScene 이 쥔 상태) */
  onInspect: (seat: number) => void;
  /** 이 자리가 마피아 동료로 보이는가(살아 있는 마피아의 me.allies, 관전자 화면의 모든 마피아). DayScene 이 마름모를 그리는 규칙과 같은 값이다 */
  isAllySeat: (seat: number) => boolean;
  /** 채팅 패널이 붙는 단계(최후 변론)의 하단. DayScene 이 채널 판정과 함께 만든다. 패널이 없으면 null */
  chatBottom: ReactNode | null;
}

/**
 * 투표 구간 장면이 DayScene 에 넘기는 값. 단계가 늘면 필드가 늘어난다. 모든 필드가 선택이다 — 처형 무효로 온 밤(04-24)은 `layer`·`introDelayMs` 만 채운 부분 결과를 돌려주고,
 * DayScene 은 비어 있는 필드를 기존 낮·밤 값으로 읽는다(`verdict?.field ?? 기존`).
 */
export interface VerdictScene {
  /** 위쪽 바 제목 */
  title?: string;
  /** 위쪽 바 안내(제목 아래 줄) */
  instruction?: string;
  /** true 면 마지막 5초에도 타이머가 진홍이 되지 않는다(UI-SPEC 6.1 P-9) */
  calm?: boolean;
  /** 하단 패널 안쪽 */
  bottom?: ReactNode;
  /** 대상 버튼의 동사. 있으면 DayScene 의 직업별 동사(조사·보호·지목)를 대신한다 */
  pickVerb?: string;
  /** 자리별 덧입힘: 여부 투표는 모든 자리가 읽기 전용 기록 카드 버튼, 후보 선택은 살아 있는 viewer 가 자기 아닌 살아 있는 자리를 고르는 대상 버튼 */
  seatPatch?: (seat: number) => Partial<DayTableSeat>;
  /** 있으면 DayScene 의 보이지 않는 polite 영역이 읽는 문장(공개 끝 상태의 결과 한 줄). 빈 문자열은 아직 읽을 것이 없다 */
  liveLine?: string;
  /** DayTable 의 덧그림 층(후보 선택 공개의 화살표). 있으면 DayScene 이 DayTable 로 잇는다 */
  layer?: DayTableProps["layer"];
  /** DayScene 루트(<main>)에 더할 클래스: 최후 변론·처형은 헤더와 하단 패널을 어둡게 층 위로 올린다(mf-dayscene--verdict) */
  rootClassName?: string;
  /** 장면 상자(.mf-dayscene__scene) 안, DayTable 뒤에 그릴 덧그림: 처형 단계의 앰버 카드(04-23) */
  sceneOverlay?: ReactNode;
  /** DayTable 에 그대로 잇는 선택 prop(어둡게+흐림 층 verdict) */
  tableProps?: Pick<DayTableProps, "verdict">;
  /** 이 단계에서 기록 카드가 열릴 수 있는가(04-27). 처형 여부 투표는 모두, 후보 선택은 탈락 viewer 만, 그 밖의 투표 구간 단계는 false. 없으면 DayScene 의 낮 단계 규칙을 따른다 */
  inspectAllowed?: boolean;
  /** 밤 시작 문구(SceneIntro)를 미룰 시간(ms). 처형 무효로 온 밤만 NO_EXEC_INTRO_DELAY_MS 를 돌려준다(회색 카드가 먼저 1.6초, 04-24, P-3) */
  introDelayMs?: number;
  /** 후보 선택의 살아 있는 viewer 에게만: 장면의 빈 곳 탭이면 DayScene 이 부른다. 고른 표를 취소한다(결정 0040) */
  onBlankTap?: () => void;
}

// 최후 변론·처형 무대의 후광: 후보는 흰(하나), 마피아 동료는 진홍. 합이 3 을 넘으면 진홍부터 꺼진다(마름모는 남는다). 두 단계가 같은 규칙을 쓴다.
function stageHalos(view: RoomView, candidate: number, isAllySeat: (seat: number) => boolean): ReadonlyMap<number, HaloKind> {
  const requests: HaloRequest[] = [{ seat: candidate, kind: "white" }];
  for (const p of view.players) if (isAllySeat(p.seat)) requests.push({ seat: p.seat, kind: "crimson" });
  return capHalos(requests).kinds;
}

// 서버가 보낸 행동을 거절하는 단계: 여부 투표와 후보 선택(04-18 이 같은 효과를 쓴다). 밤 대상 선택의 토스트는 DayScene 이 밤에만 구독하므로 겹치지 않는다.
const REJECTING_PHASES: ReadonlySet<RoomView["phase"]> = new Set<RoomView["phase"]>(["execVote", "candidateVote"]);

export function useVerdictScene({ view, connection, meAlive, showToast, onInspect, isAllySeat }: VerdictSceneCtx): VerdictScene | null {
  const rejecting = REJECTING_PHASES.has(view.phase);
  const { onEvent } = connection;
  useEffect(() => {
    if (!rejecting) return;
    return onEvent((e) => {
      if (e.t === "error" && e.code === "BAD_MESSAGE") showToast(NIGHT_PANEL_TEXT.pickError);
    });
  }, [onEvent, rejecting, showToast]);

  // 후보 선택: 낙관적 선택. 새 서버 view 가 오면 me.voteTarget(서버 값)이 이긴다(useViewChoice). 훅이라 단계와 상관없이 항상 부른다.
  // 취소(null)도 낙관적으로 보인다: 지금 보일 선택은 picked(고른 자리 또는 null) 하나다(결정 0040).
  const [chosen, choose] = useViewChoice<number | null>(view, view.me.voteTarget);
  const picked = chosen ?? null;

  // 후보 선택 공개: 서버 시각 기준 공개 상태(경계 시각마다만 다시 그림). 훅이라 단계와 상관없이 항상 부르고 단계가 아니면 null 이다.
  const reveal = useRevealState(view, connection.offset);
  // 움직임 줄이기: 화살표는 자라지 않고 완성된 모습으로 보인다(CSS 로 끝나는 두근·박동은 미디어 쿼리가 따로 분기한다)
  const reduced = useReducedMotion();

  // 과반 확정 진동(D-31 구현 재량): 확정 후보가 null → 자리로 바뀌었고 확정 시각에서 CLINCH_BEAT_MS 이내일 때만 한 번. 중간 합류로 이미 지난 확정에는 울리지 않는다.
  // 지원하지 않는 기기(iOS·데스크톱)나 예외는 무시한다. 서버 시각 보정(offset)이 바뀌어도 다시 울리지 않게 ref 로 읽는다.
  const clinchedSeat = reveal?.state.clinched ?? null;
  const clinchAtMs = reveal?.plan.clinch?.atMs ?? null;
  const offsetRef = useRef(connection.offset);
  offsetRef.current = connection.offset;
  useEffect(() => {
    if (clinchedSeat === null || clinchAtMs === null) return;
    if (Date.now() + offsetRef.current - clinchAtMs >= CLINCH_BEAT_MS) return;
    try {
      if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") navigator.vibrate(CLINCH_VIBRATE_MS);
    } catch {
      // 진동 실패는 무시한다
    }
  }, [clinchedSeat, clinchAtMs]);

  // 처형: 이 접속이 변론에서 처형으로 넘어오는 것을 직접 봤는가(재접속·처음 마운트는 null). 보았을 때만 사람 → 유령 전환을 켠다.
  const arrivedFrom = usePhaseArrival(view.phase, connection.epoch);
  // 처형 카드 퇴장 지연: 마감 시각이 바뀔 때 한 번 정해 쥔다(렌더마다 다시 계산하면 애니메이션이 흔들린다). 중간 합류는 남은 시간만큼만 보인다.
  const [execExit, setExecExit] = useState<{ ends: number | null; delay: number }>({ ends: null, delay: exitDelayOf(5_000) });
  if (view.phase === "execution" && view.phaseEndsAt !== null && execExit.ends !== view.phaseEndsAt) {
    setExecExit({ ends: view.phaseEndsAt, delay: exitDelayOf(view.phaseEndsAt - (Date.now() + connection.offset)) });
  }

  // 처형 투표 인트로 카드(04-24, D-23): 같은 접속에서 discussion → execVote 로 바뀐 것을 직접 본 렌더에서만 켠다(재접속·처음 마운트는 arrivedFrom 이 null).
  // 열쇠는 일차(n)다 — 한 번 켜진 카드는 자기 타이머(EXEC_INTRO_MS)로 끝나고 같은 날 다시 켜지지 않는다(마감 시각이 바뀌어도 되살아나지 않는다).
  const n = view.day?.n ?? 1;
  const [execIntro, setExecIntro] = useState<{ n: number | null; on: boolean }>({ n: null, on: false });
  if (view.phase === "execVote" && arrivedFrom === "discussion" && execIntro.n !== n) setExecIntro({ n, on: true });
  const execIntroOn = execIntro.on && view.phase === "execVote" && arrivedFrom === "discussion" && execIntro.n === n;
  // 처형 무효 카드(D-34): 같은 접속에서 execVote(반대·동률·0표) 또는 candidateVoteReveal(동률·0표)에서 noExecution 이 있는 밤으로 넘어온 렌더에서만 켠다. 열쇠는 일차(밤 하나에 한 번).
  const noExecReason = view.phase === "night" ? view.day?.noExecution?.reason : undefined;
  const noExecArrival = noExecReason !== undefined && (arrivedFrom === "execVote" || arrivedFrom === "candidateVoteReveal");
  const [noExecCard, setNoExecCard] = useState<{ n: number | null; on: boolean }>({ n: null, on: false });
  if (noExecArrival && noExecCard.n !== n) setNoExecCard({ n, on: true });
  const noExecCardOn = noExecArrival && noExecCard.on && noExecCard.n === n;
  if (view.phase === "candidateVoteReveal") {
    const nicknameOf = (seat: number): string | undefined => view.players.find((p) => p.seat === seat)?.nickname;
    const state = reveal?.state;
    // 후광: 방금 닿은 대상·유일한 선두는 앰버, 마피아 동료는 진홍. 합이 3 을 넘으면 흰 > 앰버 > 진홍 순으로 낮은 쪽부터 꺼진다(마름모는 남는다).
    // 동률 선두는 선두가 없으므로(state.leader === null) 후광이 켜지지 않는다(P-14).
    const requests: HaloRequest[] = [];
    if (state?.pop != null) requests.push({ seat: state.pop, kind: "amber" });
    if (state?.leader != null) requests.push({ seat: state.leader, kind: "amber" });
    for (const p of view.players) if (isAllySeat(p.seat)) requests.push({ seat: p.seat, kind: "crimson" });
    const { kinds } = capHalos(requests);
    const caption = reveal?.caption ?? { title: VERDICT_TEXT.revealIntroTitle, hint: revealIntroHint(reveal?.plan.steps.length ?? 0) };
    // 과반 확정 연출: 확정 순간 700ms 는 clinch(크게 두근), 그 뒤는 slow(작은 느린 박동). 동률·미확정이면 null
    const beat = reveal ? clinchBeat(reveal.plan, Date.now() + connection.offset) : null;
    const serverNow = (): number => Date.now() + connection.offset;
    return {
      title: "낮 · 투표 공개",
      instruction: `${n}일차`,
      calm: true,
      inspectAllowed: false,
      // 화살표 하나에 문구 하나가 빠르게 바뀌므로 읽지 않는다(aria-live 끔). 끝 상태 한 문장만 liveLine 으로 한 번 읽는다(P-11)
      bottom: (
        <div aria-live="off">
          <NightPanel title={caption.title} guide={caption.hint} />
        </div>
      ),
      // 공개 중 좌석 탭은 비활성: onPick·onInspect 없음(기록 카드도 안 열린다)
      seatPatch: (seat) => {
        const count = state?.counts[seat] ?? 0;
        const mine = beat !== null && beat.seat === seat ? beat.beat : null;
        const tone = mine === "clinch" ? "beat" : state?.leader === seat ? "lead" : state?.pop === seat ? "pop" : "plain";
        return {
          halo: kinds.get(seat) ?? "none",
          ...(count > 0 ? { chip: { n: count, tone, ...(mine === "slow" ? { slow: true } : {}) } } : {}),
          ...(mine !== null ? { beat: mine, ...(mine === "clinch" && beat !== null && beat.replay % 2 === 1 ? { beatAlt: true } : {}) } : {}),
        };
      },
      ...(reveal ? { layer: (layout: DayTableLayout) => <RevealLayer layout={layout} plan={reveal.plan} serverNow={serverNow} reduced={reduced} /> } : {}),
      liveLine: reveal !== null && reveal.state.ended ? revealResultLine(reveal.plan, nicknameOf) : "",
    };
  }
  if (view.phase === "candidateVote") {
    const nicknameOf = (seat: number): string | undefined => view.players.find((p) => p.seat === seat)?.nickname;
    const label = picked === null ? undefined : nicknameOf(picked);
    // 한 화면 후광은 최대 3개, 흰(내 선택) > 앰버 > 진홍(동료)(결정 0030). 최종 종류를 모든 자리에 명시한다 — 상한 때문에 꺼진 동료는 마름모만 남는다.
    const requests: HaloRequest[] = [];
    if (meAlive && picked !== null) requests.push({ seat: picked, kind: "white" });
    for (const p of view.players) if (isAllySeat(p.seat)) requests.push({ seat: p.seat, kind: "crimson" });
    const { kinds } = capHalos(requests);
    const pressPick = (target: number): void => {
      if (target === picked) return; // 같은 자리 재탭은 아무 일도 없다(취소는 빈 곳 탭, 결정 0040)
      choose(target);
      connection.send({ t: "candidateVote", target });
    };
    // 빈 곳 탭 = 선택 취소(결정 0040). 고른 표가 없거나 보낼 수 없으면 아무 일도 없다.
    const cancelPick = (): void => {
      if (picked === null || !connection.canSend) return;
      choose(null);
      connection.send({ t: "candidateVote", target: null });
    };
    return {
      title: "낮 · 후보 선택",
      instruction: `${n}일차`,
      calm: true,
      inspectAllowed: !meAlive, // 살아 있는 viewer 의 좌석 탭은 투표다
      bottom: <CandidateVotePanel pick={label !== undefined && picked !== null ? { seat: picked, label } : null} readOnly={!meAlive} />,
      pickVerb: "투표",
      seatPatch: (seat) => {
        const p = view.players.find((x) => x.seat === seat);
        const halo = kinds.get(seat) ?? "none";
        if (!meAlive) return { halo, onInspect: () => onInspect(seat) }; // 탈락 viewer: 투표 버튼 없이 기록 카드
        // 나·탈락자는 버튼이 아니다. 연결이 끊긴 살아 있는 자리는 고를 수 있다(후보가 될 수 있음)
        if (seat === view.me.seat || !p || !isAlive(p)) return { halo };
        return { halo, pressed: picked === seat, onPick: () => pressPick(seat) };
      },
      ...(meAlive ? { onBlankTap: cancelPick } : {}),
    };
  }
  if (view.phase === "execVote") {
    return {
      title: "낮 · 처형 여부",
      instruction: `${n}일차`,
      calm: true,
      inspectAllowed: true,
      bottom: <ExecVotePanel view={view} canSend={connection.canSend} send={connection.send} readOnly={!meAlive} introActive={execIntroOn} />,
      seatPatch: (seat) => ({ onInspect: () => onInspect(seat) }),
      ...(execIntroOn
        ? { layer: (layout: DayTableLayout) => <ExecIntroCard layout={layout} onDone={() => setExecIntro((prev) => ({ ...prev, on: false }))} /> }
        : {}),
    };
  }
  if (view.phase === "defense") {
    const candidate = view.day?.candidate;
    const cand = candidate === undefined ? undefined : view.players.find((p) => p.seat === candidate);
    // 서버 이상(후보가 없음): 무대 없이 안내만 안전하게 그린다. 화면이 멈추지 않는 것이 목적이다
    if (candidate === undefined || !cand) {
      return {
        title: "낮 · 최후 변론",
        instruction: `${n}일차`,
        calm: true,
        inspectAllowed: false,
        bottom: <NightPanel title="최후 변론" guide={VERDICT_TEXT.executionDoneHint} />,
        seatPatch: () => ({}),
      };
    }
    const mine = candidate === view.me.seat;
    const kinds = stageHalos(view, candidate, isAllySeat);
    return {
      title: "낮 · 최후 변론",
      instruction: defenseInstruction(n, mine ? null : cand.nickname),
      calm: true,
      inspectAllowed: false,
      // 후보 본인·다른 사람 모두 같은 상태 줄(변론하는 중 · N초), 탈락 viewer 는 관전 알약
      bottom: <DefensePanel view={view} connection={connection} candidateNickname={cand.nickname} candidateConnected={cand.connected} readOnly={!meAlive} />,
      // 좌석은 버튼이 아니다(onPick·onInspect 없음): 기록 카드가 열리지 않는다
      seatPatch: (seat) => ({ halo: kinds.get(seat) ?? "none", ...(seat === candidate ? { center: true } : {}) }),
      rootClassName: "mf-dayscene--verdict",
      tableProps: { verdict: { dimPercent: VERDICT_DIM_PERCENT, blurPx: VERDICT_BLUR_PX } },
    };
  }
  if (view.phase === "execution") {
    // 처형된 자리: 처형 발표(day.execution)가 이기고, 없으면 후보. 하단은 모든 viewer(처형된 본인·탈락자 포함)에게 같은 두 줄이다 —
    // 이 시점 클라이언트는 승패를 모르므로 밤을 단정하지 않는다(P-10). 입구(이모티콘·메시지)는 없다.
    const seat = view.day?.execution?.seat ?? view.day?.candidate;
    const cand = seat === undefined ? undefined : view.players.find((p) => p.seat === seat);
    const bottom = <NightPanel title={VERDICT_TEXT.executionDoneTitle} guide={VERDICT_TEXT.executionDoneHint} />;
    // 서버 이상(처형된 자리를 못 찾음): 무대·카드 없이 안내만 그린다. 화면이 멈추지 않는 것이 목적이다
    if (seat === undefined || !cand) {
      return { title: "낮 · 처형", instruction: `${n}일차`, calm: true, inspectAllowed: false, bottom, seatPatch: () => ({}) };
    }
    const kinds = stageHalos(view, seat, isAllySeat);
    const executed = arrivedFrom === "defense";
    return {
      title: "낮 · 처형",
      instruction: `${n}일차`,
      calm: true,
      inspectAllowed: false,
      bottom,
      // 변론과 같은 가운데·배율·어둡게·원뿔을 그대로 이어 간다(이동 연출 없음, D-16). 좌석은 버튼이 아니다
      seatPatch: (s) => ({ halo: kinds.get(s) ?? "none", ...(s === seat ? { center: true, ...(executed ? { executed: true } : {}) } : {}) }),
      sceneOverlay: (
        <MorningCard
          tone="amber"
          anchor="scene"
          title={executionTitle(view.day?.execution?.phrase, cand.nickname)}
          sub={VERDICT_TEXT.executionCardSub}
          exitDelayMs={execExit.delay}
        />
      ),
      rootClassName: "mf-dayscene--verdict",
      tableProps: { verdict: { dimPercent: VERDICT_DIM_PERCENT, blurPx: VERDICT_BLUR_PX } },
    };
  }
  // 밤: 처형 무효로 온 밤만 회색 카드(layer)와 시작 문구 지연을 더한다. 나머지(제목·하단·좌석·타이머 톤)는 DayScene 의 기존 밤 경로 그대로다.
  if (view.phase === "night" && noExecReason !== undefined) {
    const reason = noExecReason;
    return {
      introDelayMs: NO_EXEC_INTRO_DELAY_MS,
      ...(noExecCardOn
        ? { layer: (layout: DayTableLayout) => <NoExecutionCard layout={layout} reason={reason} onDone={() => setNoExecCard((prev) => ({ ...prev, on: false }))} /> }
        : {}),
    };
  }
  return null;
}

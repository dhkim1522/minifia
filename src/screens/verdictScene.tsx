import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { isAlive } from "../../shared/game/alive";
import type { RoomView } from "../../shared/protocol";
import { CandidateVotePanel } from "../components/CandidateVotePanel";
import type { DayTableLayout, DayTableProps, DayTableSeat } from "../components/DayTable";
import { ExecVotePanel } from "../components/ExecVotePanel";
import { NIGHT_PANEL_TEXT, NightPanel } from "../components/NightPanel";
import { RevealLayer } from "../components/RevealLayer";
import { CLINCH_BEAT_MS, CLINCH_VIBRATE_MS, VERDICT_TEXT, capHalos, clinchBeat, revealIntroHint, revealResultLine } from "../game/verdict";
import type { HaloRequest } from "../game/verdict";
import { useReducedMotion } from "../net/useReducedMotion";
import { useRevealState } from "../net/useRevealState";
import type { RoomConnection } from "../net/useRoomConnection";
import { useViewChoice } from "../net/useViewChoice";

// 투표 구간(execVote → execution) 전용 장면 조립 훅(04-16). DayScene 은 이 훅이 null 이 아닐 때만 제목·안내·타이머 톤·하단·좌석 덧입힘을 이 값으로 덮는다 —
// 낮·밤·아침 경로는 한 줄도 바뀌지 않는다. 이후 계획이 후보 선택·공개·변론·처형 단계를 이 파일에 더한다(DayScene 줄 수를 늘리지 않는다).
// 이 훅은 서버 view 만 따른다. 단계나 승패를 화면이 스스로 정하지 않고, 역할 문자열을 만들지 않는다.
// 투표 단계에는 말하기·이모티콘 입구가 없다(D-12 개정, P-7): FLOAT_PHASES·CHAT_PHASES 에 이 단계들이 없어 말풍선·이모티콘·채팅 줄도 뜨지 않는다.

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
}

/** 투표 구간 장면이 DayScene 에 넘기는 값. 단계가 늘면 필드가 늘어난다. */
export interface VerdictScene {
  /** 위쪽 바 제목 */
  title: string;
  /** 위쪽 바 안내(제목 아래 줄) */
  instruction: string;
  /** true 면 마지막 5초에도 타이머가 진홍이 되지 않는다(UI-SPEC 6.1 P-9) */
  calm: boolean;
  /** 하단 패널 안쪽 */
  bottom: ReactNode;
  /** 대상 버튼의 동사. 있으면 DayScene 의 직업별 동사(조사·보호·지목)를 대신한다 */
  pickVerb?: string;
  /** 자리별 덧입힘: 여부 투표는 모든 자리가 읽기 전용 기록 카드 버튼, 후보 선택은 살아 있는 viewer 가 자기 아닌 살아 있는 자리를 고르는 대상 버튼 */
  seatPatch: (seat: number) => Partial<DayTableSeat>;
  /** 있으면 DayScene 의 보이지 않는 polite 영역이 읽는 문장(공개 끝 상태의 결과 한 줄). 빈 문자열은 아직 읽을 것이 없다 */
  liveLine?: string;
  /** DayTable 의 덧그림 층(후보 선택 공개의 화살표). 있으면 DayScene 이 DayTable 로 잇는다 */
  layer?: DayTableProps["layer"];
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
  const [chosen, choose] = useViewChoice<number>(view, view.me.voteTarget);

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

  const n = view.day?.n ?? 1;
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
          ...(mine !== null ? { beat: mine } : {}),
        };
      },
      ...(reveal ? { layer: (layout: DayTableLayout) => <RevealLayer layout={layout} plan={reveal.plan} serverNow={serverNow} reduced={reduced} /> } : {}),
      liveLine: reveal !== null && reveal.state.ended ? revealResultLine(reveal.plan, nicknameOf) : "",
    };
  }
  if (view.phase === "candidateVote") {
    const nicknameOf = (seat: number): string | undefined => view.players.find((p) => p.seat === seat)?.nickname;
    const label = chosen === undefined ? undefined : nicknameOf(chosen);
    // 한 화면 후광은 최대 3개, 흰(내 선택) > 앰버 > 진홍(동료)(결정 0030). 최종 종류를 모든 자리에 명시한다 — 상한 때문에 꺼진 동료는 마름모만 남는다.
    const requests: HaloRequest[] = [];
    if (meAlive && chosen !== undefined) requests.push({ seat: chosen, kind: "white" });
    for (const p of view.players) if (isAllySeat(p.seat)) requests.push({ seat: p.seat, kind: "crimson" });
    const { kinds } = capHalos(requests);
    const pressPick = (target: number): void => {
      if (target === chosen) return; // 선택 해제 없음, 같은 자리 재탭은 아무 일도 없다
      choose(target);
      connection.send({ t: "candidateVote", target });
    };
    return {
      title: "낮 · 후보 선택",
      instruction: `${n}일차`,
      calm: true,
      bottom: <CandidateVotePanel pick={label !== undefined && chosen !== undefined ? { seat: chosen, label } : null} readOnly={!meAlive} />,
      pickVerb: "투표",
      seatPatch: (seat) => {
        const p = view.players.find((x) => x.seat === seat);
        const halo = kinds.get(seat) ?? "none";
        if (!meAlive) return { halo, onInspect: () => onInspect(seat) }; // 탈락 viewer: 투표 버튼 없이 기록 카드
        // 나·탈락자는 버튼이 아니다. 연결이 끊긴 살아 있는 자리는 고를 수 있다(후보가 될 수 있음)
        if (seat === view.me.seat || !p || !isAlive(p)) return { halo };
        return { halo, pressed: chosen === seat, onPick: () => pressPick(seat) };
      },
    };
  }
  if (view.phase === "execVote") {
    return {
      title: "낮 · 처형 여부",
      instruction: `${n}일차`,
      calm: true,
      bottom: <ExecVotePanel view={view} canSend={connection.canSend} send={connection.send} readOnly={!meAlive} />,
      seatPatch: (seat) => ({ onInspect: () => onInspect(seat) }),
    };
  }
  return null;
}

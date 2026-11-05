import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { ringSlots } from "../../shared/game/gather";
import type { ClientMessage, RoomView } from "../../shared/protocol";
import { Button } from "../components/Button";
import { ConfirmSheet } from "../components/ConfirmSheet";
import { TopToast, useTopToast } from "../components/v2/TopToast";
import { V2Icon } from "../components/v2/V2Icon";
import { WorldStage } from "../components/WorldStage";
import { holdSnap } from "../game/resultDirector";
import { READY_TEXT } from "../game/resultText";
import { GATHER_CENTER } from "../world/camera";
import type { SceneLook } from "../world/presence";
import type { WorldStore } from "../world/store";
import "../styles/game.css";
import "../styles/result.css";
import "../styles/sheet.css";

export interface BenchViewProps {
  /** 쉬는 사람 본인에게만 오는 view(resting). players 는 자기 한 줄뿐이고 게임 필드가 없다 — 이 화면은 자기 한 줄과 공개 값(map·mapChoice·round)만 읽는다 */
  view: RoomView;
  /** RoomScreen 의 위치 스토어. 쉬는 사람은 월드 프레임을 받지 않아 이 화면이 자기 캐릭터 한 점만 먹인다 */
  store: WorldStore;
  send: (msg: ClientMessage) => boolean | void;
  canSend: boolean;
  /** 서버시각 − 로컬시각(ms) */
  offset: number;
  /** 연결 epoch. 스토어 snap 에 실린다 */
  epoch: number;
  /** 나가기 확인 뒤(leave 가 보내졌을 때) 부른다. RoomScreen 이 "left" 로 잇는다 */
  onExit: () => void;
}

// 쉬는 사람 전용 화면 (11-12, 결정 D-3·D-13, UI-SPEC D-3): 이번 판에 준비하지 않아 게임 밖에 있는 사람이 기다리는 곳이다.
// 방의 맵(view.map, 없으면 재즈 바)의 어두운 정지 무대 + 내 캐릭터(고른 의상) 하나 + hourglass 와 한 줄 '이번 판은 쉬어요' + [나가기] 하나.
// 타이머·단계 이름·인원 수·채팅·동작·꾸미기·역할 카드가 없다(판 정보가 보이지 않게, T-11-40). 서버가 준 쉬는 사람 view 의 자기 한 줄만 읽고 PreGame/GameMap 을 마운트하지 않는다.
// 판이 끝나면 서버가 일반 state(sat)를 보내고 RoomScreen 이 결과 화면으로 바꾼다.

/** 쉬는 사람 화면의 아래 패널 높이(px). 결과 접힌 패널(188)과 같다 — 카메라 중심을 스테이지 사각형으로 옮기는 데만 쓴다 */
const PANEL_H = 188;
const HEADER_H = 62;

export function BenchView({ view, store, send, canSend, offset, epoch, onExit }: BenchViewProps) {
  const toast = useTopToast();
  const { show } = toast;
  const [leaveOpen, setLeaveOpen] = useState(false);

  // 서버가 준 자기 한 줄만 쓴다. 장면과 WorldStage 가 받는 view 도 그 한 줄뿐이다
  const mySeat = view.me.seat;
  const mine = useMemo(() => view.players.find((p) => p.seat === mySeat), [view.players, mySeat]);
  const stageView = useMemo<RoomView>(() => (mine ? { ...view, players: [mine] } : view), [view, mine]);

  // 내 캐릭터 한 점: 월드 프레임이 없는 화면이라 이 폰이 스토어에 snap 한 프레임을 먹인다(서버 상태가 아니다). 이전 판 위치는 이 snap 이 통째로 바꾼다
  const offsetRef = useRef(offset);
  offsetRef.current = offset; // 시계 보정이 흔들려도 snap 을 다시 먹이지 않는다(먹일 때만 읽는다)
  useLayoutEffect(() => {
    const t0 = Date.now() + offsetRef.current;
    const at = ringSlots(1)[0] ?? [0, 265];
    store.applyFrame({ t: "world", k: "snap", at: t0, ents: holdSnap({ [mySeat]: at }, t0) }, Math.max(store.currentEpoch(), epoch));
  }, [store, mySeat, epoch]);

  const scene = useMemo<SceneLook>(
    () => ({
      camera: { mode: "fixed", target: { x: GATHER_CENTER.x, z: GATHER_CENTER.z }, zoom: 1 },
      lighting: "night",
      tension: 0,
      pin: null,
      seats: { [mySeat]: { show: true, ghost: false } },
    }),
    [mySeat],
  );

  return (
    <main className="mf-root mf-bench" data-bench-view="">
      <WorldStage view={stageView} store={store} send={send} canSend={canSend} offset={offset} stageInsets={{ top: HEADER_H, bottom: PANEL_H }} scene={scene} canWalk={false} onNotice={(text) => show(text)} onLeave={() => setLeaveOpen(true)} />
      <div className="mf-bench__scrim" aria-hidden="true" />
      <TopToast {...toast.props} />
      <section className="mf-bench__panel">
        <span className="mf-bench__icon" data-bench-icon="">
          <V2Icon name="hourglass" size={40} />
        </span>
        <p className="mf-bench__text">{READY_TEXT.rest}</p>
        <Button variant="secondary" disabled={!canSend} onClick={() => setLeaveOpen(true)}>
          {READY_TEXT.leave}
        </Button>
      </section>
      {leaveOpen ? (
        <ConfirmSheet
          title="방에서 나갈까요?"
          confirmLabel="나가기"
          confirmDisabled={!canSend}
          onConfirm={() => {
            // leave 가 서버에 닿지 않았는데 입장 정보를 지우면 자리만 유령으로 남는다. 보냈을 때만 나간다
            if (send({ t: "leave" }) === false) show("연결이 불안정해요. 다시 시도해 주세요");
            else onExit();
          }}
          onClose={() => setLeaveOpen(false)}
        />
      ) : null}
    </main>
  );
}

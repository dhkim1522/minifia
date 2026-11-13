import { useRef, useState } from "react";
import type { PointerEvent } from "react";
import "../../styles/v2.css";
import { nearestPlate } from "../../game/causalView";
import { V2Icon } from "./V2Icon";

// 21페이즈 밤 집 판(P21-9, D-10·D-25, 승인 시안 design/v3.0/lamp-house/Night.dc.html 의 판 64 를 보이는 40 + 최근접 누르기로 줄였다).
// 네 역할이 같은 판이다: 이 부품에는 역할 prop 이 없고 같은 입력이면 같은 DOM 을 낸다. 집을 누르는 것은 지금 pick 메시지 그대로(쓰는 쪽이 보낸다).
// 마피아 합의 배지(tally·sure)는 FaceList 와 같은 0074 규칙이다 — 산 마피아 본인 화면에서만 쓰는 쪽이 넘기고, 안 넘기면 그 칸이 DOM 에 없다.
// 위치는 쓰는 쪽(WorldStage)이 고정 시점 투영으로 정해 넘긴다(판 중심 = 집 지붕 꼭대기). 이 부품은 좌표를 계산하지 않고 누른 점을 가까운 판 하나에 맞출 뿐이다.
// 닉네임은 React 텍스트 노드가 아니라 aria-label 로만 쓴다(밤에는 이름표를 그리지 않는다, HTML 문자열 주입 없음, T-06-26).

/** 판 하나: 좌석·닉네임·얼굴 그림 주소·좌석색·내 집 여부, 화면 좌표(층 안쪽 px). 좌표가 아직 없으면(투영 전) 그리지만 보이지도 눌리지도 않는다 */
export interface HousePlateView {
  seat: number;
  name: string;
  img: string;
  color: string;
  me: boolean;
  x?: number;
  y?: number;
}

export interface HousePickProps {
  plates: readonly HousePlateView[];
  /** 고른 집의 seat. 아직 안 골랐으면 없음 */
  value?: number;
  /** 아직 안 골랐다: 판 전체가 한꺼번에 is-call(금빛 깜빡 테두리). 고르면 멎는다 */
  call?: boolean;
  /** 마피아 합의 배지: 판(seat)별 동료 선택 수(1 이상만 준다) */
  tally?: ReadonlyMap<number, number>;
  /** 마피아 합의 확정 판의 seat. 숫자 대신 check 표시(접근성 이름 '확정') */
  sure?: number;
  /** 연결 끊김 등으로 모든 판을 막는다 */
  disabled?: boolean;
  onPick?: (seat: number) => void;
}

/** 손가락 뒤에 따라오는 click 을 가려내는 시간(ms) — 눌림 하나가 두 번 나가지 않게 */
const CLICK_ECHO_MS = 700;

export function HousePick({ plates, value, call = false, tally, sure, disabled = false, onPick }: HousePickProps) {
  // 얼굴 그림이 안 뜬 좌석(onError): 판·선택은 그대로 두고 그림 자리만 좌석색 원으로 바꾼다(FaceList 규칙)
  const [failed, setFailed] = useState<ReadonlySet<number>>(() => new Set());
  const handledAt = useRef(0);

  const pick = (seat: number): void => {
    if (disabled || seat === value) return;
    onPick?.(seat);
  };

  // 판 층 전체가 눌림을 받는다: 누른 점에서 가장 가까운 판 하나(중심 거리 ≤ PLATE_TAP_MAX)를 고른다. 판이 서로 닿아도 오작동이 없다(P21-9)
  const onUp = (e: PointerEvent<HTMLDivElement>): void => {
    if (e.pointerType === "mouse" && e.button > 0) return;
    const box = e.currentTarget.getBoundingClientRect();
    const points = plates.flatMap((p) => (p.x === undefined || p.y === undefined ? [] : [{ seat: p.seat, x: p.x, y: p.y }]));
    const seat = nearestPlate(points, e.clientX - box.left, e.clientY - box.top);
    handledAt.current = Date.now();
    if (seat !== null) pick(seat);
  };

  return (
    <div className="mv-house-pick" data-house-layer="" role="group" aria-label="밤 대상" onPointerUp={onUp}>
      {plates.map((p) => {
        const on = p.seat === value;
        const placed = p.x !== undefined && p.y !== undefined;
        const broken = failed.has(p.seat);
        const callNow = call && value === undefined;
        const count = tally?.get(p.seat) ?? 0;
        return (
          <button
            key={p.seat}
            type="button"
            className={["mv-house-pick__plate", on && "is-on", callNow && "is-call"].filter(Boolean).join(" ")}
            style={placed ? { left: p.x, top: p.y } : undefined}
            data-house-pick={p.seat}
            data-me={p.me ? "true" : undefined}
            data-call={callNow ? "" : undefined}
            data-house-off={placed ? undefined : ""}
            data-house-fallback={broken ? "true" : undefined}
            aria-pressed={on}
            aria-disabled={disabled ? "true" : undefined}
            aria-label={p.me ? "나의 집 고르기" : `${p.name} 님의 집 고르기`}
            tabIndex={placed ? undefined : -1}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              // 손가락·마우스 눌림은 층이 이미 처리했다. 보조 기술이 포인터 없이 보내는 click 은 그 판을 고른다
              if (Date.now() - handledAt.current < CLICK_ECHO_MS) return;
              pick(p.seat);
            }}
          >
            {broken ? (
              <span className="mv-house-pick__fallback">
                <i style={{ background: p.color }} />
              </span>
            ) : (
              <img
                className="mv-house-pick__img"
                src={p.img}
                alt=""
                draggable={false}
                onError={() => setFailed((prev) => new Set(prev).add(p.seat))}
              />
            )}
            {p.me ? <i className="mv-house-pick__me" data-house-me-dot="" aria-hidden="true" /> : null}
            {p.seat === sure ? (
              <span className="mv-face__count" role="img" aria-label="확정">
                <V2Icon name="check" size={14} />
              </span>
            ) : count >= 1 ? (
              <span className="mv-face__count">{count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

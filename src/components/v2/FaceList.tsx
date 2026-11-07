import { useState } from "react";
import "../../styles/v2.css";
import { V2Icon } from "./V2Icon";

// 얼굴 목록(FaceList). design/v2.0/design-system/components/FaceList 와 bundle.css 124-132 를 React 19 로 옮겼다(승인 2026-10-31, 9페이즈 NIGHT-09).
// 깜깜한 밤에 경찰(조사)·의사(살리기)가 비친 얼굴을 눌러 대상을 고른다. 4열 격자, 얼굴 그림 + 자리 구분색 점 + 닉네임.
// 승인 모양에서 하나를 바꿨다: faces 의 id 대신 seat 를 쓴다(서버 pick 의 target 이 seat 라 변환이 없다).
// 마감 전까지 바꿀 수 있지만 같은 칸을 다시 눌러도 취소되지 않는다(onPick 을 부르지 않는다).
// 이 화면은 역할마다 생김새가 같아야 해서 진홍·놋쇠를 쓰지 않는다. 밤 목록은 아이콘을 주지 않는다(15페이즈 D-05 — 고른 칸의 모양이 역할마다 같다).
// 선택 수 배지(tally·sure)는 마피아의 합의 수단이다 — 산 마피아 화면만 준다. 칸 안 오른쪽 아래 절대 위치라 칸 크기·간격을 바꾸지 않는다(결정 0074).
// 닉네임은 React 텍스트 노드와 aria-label 로만 그린다(innerHTML 없음, T-06-26·T-09-08).

export interface FaceItem {
  seat: number;
  name: string;
  /** 얼굴 그림 주소(faceSrc(seat)) */
  img: string;
  /** 자리 구분색(var(--seat-N)) */
  color: string;
  /** 고를 수 없는 칸(경찰의 자기 자신). 쓰는 쪽이 정한다 */
  disabled?: boolean;
}

export interface FaceListProps {
  faces: readonly FaceItem[];
  /** 고른 칸의 seat. 아직 안 골랐으면 없음 */
  value?: number;
  onPick?: (seat: number) => void;
  /** 고른 칸 오른쪽 위 원 안의 행동 아이콘. 없으면 원만 그린다 */
  icon?: "eye" | "heal";
  /** 묶음 이름 */
  label?: string;
  /** 연결 끊김 등으로 모든 칸을 막는다 */
  disabled?: boolean;
  /** 칸의 접근성 이름. 기본은 닉네임 */
  ariaLabel?: (name: string) => string;
  /** 빛남(14-04): 지금 눌러야 할 칸의 seat 집합. 그 칸에 is-call·data-call(값 없는 표식). 없거나 비면 빛 없음 */
  callSeats?: ReadonlySet<number>;
  /** 마피아 합의 배지: 칸(seat)별 동료 선택 수(1 이상만 준다). 칸 안 오른쪽 아래 숫자 */
  tally?: ReadonlyMap<number, number>;
  /** 마피아 합의 확정 칸의 seat. 숫자 대신 check 표시(접근성 이름 '확정') */
  sure?: number;
}

export function FaceList({ faces, value, onPick, icon, label = "대상", disabled, ariaLabel, callSeats, tally, sure }: FaceListProps) {
  // 얼굴 그림이 안 뜬 좌석(onError). 칸 이름·선택은 그대로 두고 그림 자리만 색 원으로 바꾼다(E1 #5)
  const [failed, setFailed] = useState<ReadonlySet<number>>(() => new Set());
  return (
    <div className="mv-faces" data-face-list="" role="group" aria-label={label}>
      {faces.map((f) => {
        const on = f.seat === value;
        const blocked = !!disabled || !!f.disabled;
        const broken = failed.has(f.seat);
        const call = callSeats?.has(f.seat) === true;
        return (
          <button
            key={f.seat}
            type="button"
            className={["mv-face", on && "is-on", call && "is-call"].filter(Boolean).join(" ")}
            data-face={f.seat}
            data-call={call ? "" : undefined}
            data-face-fallback={broken ? "true" : undefined}
            aria-pressed={on}
            aria-disabled={blocked ? "true" : undefined}
            aria-label={ariaLabel ? ariaLabel(f.name) : f.name}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              if (blocked || on) return;
              onPick?.(f.seat);
            }}
          >
            {broken ? (
              <span className="mv-face--fallback">
                <i style={{ background: f.color }} />
              </span>
            ) : (
              <img
                className="mv-face__img"
                src={f.img}
                alt=""
                draggable={false}
                onError={() => setFailed((prev) => new Set(prev).add(f.seat))}
              />
            )}
            <span className="mv-face__name">
              <i className="mv-face__dot" style={{ background: f.color }} />
              {f.name}
            </span>
            {on && <span className="mv-face__mark">{icon && <V2Icon name={icon} size={18} />}</span>}
            {f.seat === sure ? (
              <span className="mv-face__count" role="img" aria-label="확정">
                <V2Icon name="check" size={14} />
              </span>
            ) : (tally?.get(f.seat) ?? 0) >= 1 ? (
              <span className="mv-face__count">{tally?.get(f.seat)}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

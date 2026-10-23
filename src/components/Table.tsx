import { seatLayout, SEAT_COUNT } from "../../shared/seatLayout";
import "../styles/lobby.css";
import { Figure } from "./Figure";
import { Icon } from "./Icon";

// 대기 장면 위 2.5D 원근 테이블. 상태를 받아 그리기만 한다(D-22): 입력에 역할 필드가 없다.
// 동료 표시는 서버가 마피아에게만 보낸 me.allies 에서 화면이 만든 isAlly 뿐이다.
// design/design-system/components/bundle.js 의 Table 에서 옮기되 빈 의자는 그리지 않고,
// 왕관은 이름표 아래 "방장" 알약으로 바꿨다. 좌표는 shared/seatLayout.ts 의 seatLayout 을 그대로 쓴다.
export interface TableSeat {
  nickname: string;
  connected: boolean;
  isHost: boolean;
  isMe: boolean;
  isAlly: boolean;
  /** 등장·퇴장 전이 표시. 서버 스냅샷의 차이에서 화면이 만든다. */
  transition?: "entering" | "leaving" | null;
  /** 누를 수 있는 자리(방장이 끊긴 사람을 내보낼 때) */
  pressable?: boolean;
}

export interface TableProps {
  seats: (TableSeat | null)[];
  mySeat: number;
  dimmed?: boolean;
  onSeatPress?: (seat: number) => void;
  label?: string;
}

// 인물 높이: 장면 높이 대비 %. 자리 폭 20%·그림 3:4·장면 4:5 에서만 맞는 값이라 장면 상자는 4:5 로 고정한다(Pitfall 16).
const FIG_H = 21.33;

const pct = (n: number): string => `${Math.round(n * 1000) / 1000}%`;

function seatLabel(s: TableSeat): string {
  return `${s.nickname}${s.isMe ? " (나)" : ""}${s.connected ? "" : ", 연결 끊김"}`;
}

function transitionClass(base: string, t: TableSeat["transition"]): string {
  return t === "entering" ? `${base} ${base}--enter` : t === "leaving" ? `${base} ${base}--leave` : base;
}

export function Table({ seats, mySeat, dimmed, onSeatPress, label }: TableProps) {
  const seatLayers: React.ReactNode[] = [];
  const allyLayers: React.ReactNode[] = [];
  const tagLayers: React.ReactNode[] = [];

  for (let i = 0; i < SEAT_COUNT; i++) {
    const s = seats[i];
    if (!s) continue; // 빈 자리는 비워 둔다(빈 의자 그림 없음)
    const L = seatLayout(i, mySeat);
    const placement = { left: pct(L.x), top: pct(L.y) };
    const seatStyle = { ...placement, zIndex: L.z, transform: `translate(-50%,-100%) scale(${L.scale})` };
    const front = L.depth >= 0.5;
    const ring = s.isAlly ? "mate" : s.isMe ? "me" : null;
    // 동료 링·마름모는 막(.mf-table__scrim) 위층에 있어야 하므로 dimmed 일 때는 따로 층(z 30)에 그린다(D-14).
    const allyInSeat = !dimmed && s.isAlly;
    const marks = (
      <>
        {ring ? <div className={`mf-seat__ring mf-seat__ring--${ring}`} /> : null}
        {s.isAlly ? <Icon name="diamond" label="동료" className="mf-seat__mark mf-seat__mark--mate" /> : null}
      </>
    );

    seatLayers.push(
      <div
        key={`s${i}`}
        className={transitionClass("mf-seat", s.transition)}
        style={seatStyle}
        role="group"
        aria-label={seatLabel(s)}
      >
        <div className="mf-seat__body">
          {allyInSeat ? marks : s.isMe ? <div className="mf-seat__ring mf-seat__ring--me" /> : null}
          <Figure seat={i} disconnected={!s.connected} />
          {s.pressable ? (
            <button
              type="button"
              className="mf-seat__btn"
              aria-label={seatLabel(s)}
              onClick={onSeatPress ? () => onSeatPress(i) : undefined}
            />
          ) : null}
        </div>
      </div>,
    );

    if (dimmed && s.isAlly) {
      allyLayers.push(
        <div key={`a${i}`} className="mf-seat mf-seat--ally" style={{ ...seatStyle, zIndex: 30 }}>
          <div className="mf-seat__body">{marks}</div>
        </div>,
      );
    }

    // 이름표는 크기 변환 바깥에 둔다 — 자리 크기와 관계없이 항상 14px. 뒤쪽 자리는 머리 위, 앞쪽은 발 아래.
    const headTop = L.y - FIG_H * L.scale;
    const tagTop = front ? L.y + 1.2 : headTop - 7.5 - (s.isHost ? 5 : 0);
    tagLayers.push(
      <div
        key={`t${i}`}
        className={`${transitionClass("mf-tag", s.transition)}${front ? "" : " mf-tag--back"}`}
        style={{ left: pct(L.x), top: pct(tagTop) }}
        title={s.nickname}
      >
        <span className="mf-tag__name">
          <span>{`${s.nickname}${s.isMe ? " (나)" : ""}`}</span>
          {s.connected ? null : <Icon name="disconnected" size={14} className="mf-tag__off" />}
        </span>
        {s.isHost ? <span className="mf-badge">방장</span> : null}
      </div>,
    );
  }

  return (
    <div className="mf-root mf-table mf-table--bare" role="group" aria-label={label ?? "테이블"}>
      <div className="mf-table__moon" />
      <div className="mf-table__shadow" />
      <div className="mf-table__top" />
      {seatLayers}
      {dimmed ? <div className="mf-table__scrim" /> : null}
      {allyLayers}
      {tagLayers}
    </div>
  );
}

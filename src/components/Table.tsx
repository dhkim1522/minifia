import { seatLayout, SEAT_COUNT } from "../../shared/seatLayout";
import type { Claim, EmojiId } from "../../shared/protocol";
import "../styles/lobby.css";
import "../styles/seat.css";
import { ClaimTag, claimName } from "./ClaimTag";
import { Figure } from "./Figure";
import { Icon } from "./Icon";
import { SeatFloat } from "./SeatFloat";

/** 자리 머리 위에 뜨는 것 하나(말풍선·공개 연출 말풍선·이모티콘). z 가 큰 것이 위. key 가 바뀌면 애니메이션이 새로 시작한다. */
export type TableFloat =
  | { key: string; z: number; kind: "bubble"; text: string; elapsedMs?: number }
  | { key: string; z: number; kind: "reveal"; text: string; dim: boolean; animate: boolean }
  | { key: string; z: number; kind: "emoji"; icon: EmojiId; elapsedMs?: number };

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
  /** 이번 낮 직업을 직접 골랐다(머리 위 "완료" 알약). 무엇을 골랐는지는 담지 않는다. */
  done?: boolean;
  /** 공개된 주장. job 은 그 사람이 주장한 직업이며 실제 직업이 아닐 수 있다. */
  claim?: { job: Claim; changed: boolean } | null;
  /** 머리 위에 떠 있는 것 하나(자리마다 한 번에 하나) */
  float?: TableFloat | null;
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

// 떠 있는 층 z 기준값: 이름표 층(25)보다 위. float.z 가 더해진다.
const FLOAT_Z = 26;

const pct = (n: number): string => `${Math.round(n * 1000) / 1000}%`;

// 가로 위치는 --mf-float-left 변수로 넘기고 seat.css 의 .mf-float 가 left 에 쓴다.
// (clamp() 를 left 에 바로 쓰면 happy-dom 이 값을 버려 테스트가 위치를 읽을 수 없다. 브라우저에서는 같은 결과다.)
function floatStyle(x: number, top: number, z: number): React.CSSProperties {
  return {
    ["--mf-float-left" as string]: `clamp(70px, ${pct(x)}, calc(100% - 70px))`,
    top: pct(top),
    zIndex: FLOAT_Z + z,
  };
}

function seatLabel(s: TableSeat): string {
  const claim = s.claim ? `, 직업 주장 ${claimName(s.claim.job)}${s.claim.changed ? ", 말 바꿈" : ""}` : "";
  return `${s.nickname}${s.isMe ? " (나)" : ""}${s.connected ? "" : ", 연결 끊김"}${s.done ? ", 선택 완료" : ""}${claim}`;
}

function transitionClass(base: string, t: TableSeat["transition"]): string {
  return t === "entering" ? `${base} ${base}--enter` : t === "leaving" ? `${base} ${base}--leave` : base;
}

export function Table({ seats, mySeat, dimmed, onSeatPress, label }: TableProps) {
  const seatLayers: React.ReactNode[] = [];
  const allyLayers: React.ReactNode[] = [];
  const tagLayers: React.ReactNode[] = [];
  const floatLayers: React.ReactNode[] = [];
  const doneLayers: React.ReactNode[] = [];

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
    // 뒤쪽 자리는 줄이 하나 늘 때마다(방장 배지, 주장 알약) 이름표가 머리 위로 5% 더 올라간다.
    const tagTop = front ? L.y + 1.2 : headTop - 7.5 - (s.isHost ? 5 : 0) - (s.claim ? 5 : 0);
    // 떠 있는 것: 이름표와 같이 크기 변환 바깥. 가로는 말풍선 최대 폭 140 의 절반(70px)만큼 장면 안에 가둔다.
    const floatTop = headTop - (front ? 1 : 8);
    // 완료 알약: 떠 있는 것과 같은 머리 위 자리. 공개 연출부터는 float 가 그 자리를 쓰고 done 은 화면이 끈다.
    if (s.done) {
      doneLayers.push(
        <div key={`d${i}`} className="mf-done-layer" aria-hidden="true" style={floatStyle(L.x, floatTop, 0)}>
          <span className="mf-done">완료</span>
        </div>,
      );
    }
    if (s.float) {
      floatLayers.push(
        <div
          key={`f${i}:${s.float.key}`}
          className="mf-float"
          aria-hidden="true"
          style={floatStyle(L.x, floatTop, s.float.z)}
        >
          <SeatFloat float={s.float} />
        </div>,
      );
    }

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
        {s.claim ? <ClaimTag job={s.claim.job} changed={s.claim.changed} /> : null}
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
      {doneLayers}
      {floatLayers}
    </div>
  );
}

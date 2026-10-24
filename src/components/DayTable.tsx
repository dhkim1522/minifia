import { useLayoutEffect, useRef, useState } from "react";
import type { ReactElement } from "react";
import type { Claim, EmojiId } from "../../shared/protocol";
import { DAY_SCENE_H, DAY_SCENE_W, FIG_H, FIG_W, dayTableGeometry, daySeatLayout, px } from "../game/dayTable";
import { Figure } from "./Figure";
import "../styles/daytable.css";

// 낮 화면 고정 테이블(결정 0017-1). 받은 공개 값만 그린다 — 입력에 역할 필드가 없다.
// 주장(row.job)은 공개된 주장이지 그 사람의 실제 역할이 아니다(거짓일 수 있다). 동료 표시(isAlly)는 서버가 마피아에게만 보낸
// me.allies 에서 화면이 만든 값이다.
// 캐릭터 상자·이름표·이모티콘의 좌표는 game/dayTable.ts 의 daySeatLayout 한 번의 결과에서 나온다(떠 있는 층을 따로 가두지 않는다).

/** 이름표 아랫줄. null 이면 아랫줄이 없다. 서버 값 연결은 낮 장면(02-16)이 한다. */
export type DayTagRow =
  | { kind: "wait" }
  | { kind: "done" }
  | { kind: "claim"; job: Claim; changed: boolean; pop: boolean };

export interface DayTableSeat {
  seat: number;
  nickname: string;
  connected: boolean;
  isHost: boolean;
  isMe: boolean;
  isAlly: boolean;
  row: DayTagRow | null;
  /** 방금 빠른 메시지를 보낸 사람(윗줄 반전) */
  spoke?: boolean;
  /** 머리 위에 떠 있는 이모티콘 하나. key 가 바뀌면 애니메이션이 새로 시작한다. */
  emoji?: { key: string; icon: EmojiId; z: number } | null;
}

export interface DayTableProps {
  seats: readonly DayTableSeat[];
  mySeat: number;
  /** 장면 폭·높이. 안 주면 루트(장면 상자를 100%×100% 로 채운다)를 잰다. */
  width?: number;
  height?: number;
  label?: string;
}

function seatLabel(s: DayTableSeat): string {
  return `${s.nickname}${s.isMe ? " (나)" : ""}${s.connected ? "" : ", 연결 끊김"}`;
}

export function DayTable({ seats, mySeat, width, height, label = "테이블" }: DayTableProps): ReactElement {
  const rootRef = useRef<HTMLDivElement>(null);
  const [measured, setMeasured] = useState({ w: DAY_SCENE_W, h: DAY_SCENE_H });
  const needMeasure = width === undefined || height === undefined;

  // 장면 상자를 재서 얻는다. ResizeObserver 가 없거나 0 이면 시안 기준 크기를 쓴다.
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!needMeasure || !el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const rect = entries[entries.length - 1]?.contentRect;
      if (!rect || rect.width <= 0 || rect.height <= 0) return;
      setMeasured((prev) => (prev.w === rect.width && prev.h === rect.height ? prev : { w: rect.width, h: rect.height }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [needMeasure]);

  const sceneW = width ?? measured.w;
  const sceneH = height ?? measured.h;
  const geo = dayTableGeometry(sceneW, sceneH);
  const places = daySeatLayout(seats, mySeat, sceneW, sceneH);
  const bySeat = new Map(seats.map((s) => [s.seat, s]));

  return (
    <div ref={rootRef} className="mf-root mf-dt" role="group" aria-label={label}>
      <div
        className="mf-dt__felt"
        aria-hidden="true"
        style={{ left: px(geo.felt.left), top: px(geo.felt.top), width: px(geo.felt.width), height: px(geo.felt.height) }}
      />
      {places.map((p) => {
        const s = bySeat.get(p.seat);
        if (!s) return null;
        return (
          <div
            key={`s${p.seat}`}
            className="mf-dt__seat"
            data-seat={p.seat}
            role="group"
            aria-label={seatLabel(s)}
            style={{
              left: px(p.figLeft),
              top: px(p.figTop),
              width: FIG_W,
              height: FIG_H,
              transform: `scale(${Math.round(p.scale * 1000) / 1000})`,
              zIndex: p.z,
            }}
          >
            <Figure seat={p.seat} disconnected={!s.connected} />
          </div>
        );
      })}
      {places.map((p) => {
        const s = bySeat.get(p.seat);
        if (!s) return null;
        return (
          <div
            key={`t${p.seat}`}
            className="mf-dt__tag"
            data-seat={p.seat}
            title={s.nickname}
            style={{ left: px(p.tagLeft), top: px(p.tagTop), zIndex: p.tagZ }}
          >
            <span className="mf-dt__name">
              <i className="mf-dt__dot" style={{ background: `var(--seat-${(p.seat % 8) + 1})` }} />
              <span>{s.nickname}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

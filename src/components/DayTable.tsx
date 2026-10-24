import { useLayoutEffect, useRef, useState } from "react";
import type { ReactElement } from "react";
import type { Claim, EmojiId, RoleId } from "../../shared/protocol";
import { DAY_SCENE_H, DAY_SCENE_W, FIG_H, FIG_W, dayTableGeometry, daySeatLayout, px } from "../game/dayTable";
import { claimName } from "../game/roleText";
import { Figure } from "./Figure";
import { Icon } from "./Icon";
import "../styles/daytable.css";

// 낮 화면 고정 테이블(결정 0017-1). 받은 공개 값만 그린다 — 입력에 역할 필드가 없다.
// 주장(row.job)은 공개된 주장이지 그 사람의 실제 역할이 아니다(거짓일 수 있다). 동료 표시(isAlly)는 서버가 마피아에게만 보낸
// me.allies 에서 화면이 만든 값이다.
// 밤에는 onPick 이 있는 자리만 버튼(UI-SPEC C1). 누를 수 있는지·동사는 장면이 정한다.
// real 아랫줄·관전 배지는 장면이 탈락자 전용 서버 값으로만 만든다(결정 0021).
// 캐릭터 상자·이름표·이모티콘의 좌표는 game/dayTable.ts 의 daySeatLayout 한 번의 결과에서 나온다(떠 있는 층을 따로 가두지 않는다).

/** 이름표 아랫줄. null 이면 아랫줄이 없다. 서버 값 연결은 낮 장면(02-16)이 한다. */
export type DayTagRow =
  | { kind: "wait" }
  | { kind: "done" }
  | { kind: "claim"; job: Claim; changed: boolean; pop: boolean }
  /** 탈락한 사람의 아랫줄 */
  | { kind: "dead" }
  /** 관전 화면 전용: 실제 직업(공개 주장 알약과 모양이 다르다). 값은 장면이 탈락자 전용 서버 값으로만 만든다 */
  | { kind: "real"; job: RoleId };

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
  /** 밤 선택 표시. mine = 내가 고른 대상(발밑 링 + 표적 배지) */
  pick?: { mine?: boolean };
  /** 탈락: 유령 그림·회색 이름표. 탈락 때문에 흐리게 하지 않는다 */
  dead?: boolean;
  /** 있으면 이 자리가 대상 버튼이 된다(밤). 없으면 지금 그대로의 group 노드 */
  onPick?: () => void;
}

export interface DayTableProps {
  seats: readonly DayTableSeat[];
  mySeat: number;
  /** 장면 폭·높이. 안 주면 루트(장면 상자를 100%×100% 로 채운다)를 잰다. */
  width?: number;
  height?: number;
  label?: string;
  /** 대상 버튼의 동사("조사"·"지목"·"보호"). 장면이 넘긴다 — 부품은 역할을 모른다. 기본 "선택" */
  pickVerb?: string;
  /** 연결이 끊겨 보낼 수 없을 때 모든 대상 버튼을 끈다 */
  pickDisabled?: boolean;
  /** 동료 마름모의 읽기 이름. 기본 "동료", 관전 화면은 "마피아" */
  allyMarkLabel?: string;
}

// 지금 앱의 Table seatLabel 과 같은 형식: "{닉네임}{ (나)}{, 연결 끊김}{, 선택 완료}{, 직업 주장 X}"
/** 이모티콘 층 z 기준값: 이름표(최대 30)보다 위. emoji.z 가 더해진다. */
const EMOJI_Z = 60;

function seatLabel(s: DayTableSeat): string {
  const who = `${s.nickname}${s.isMe ? " (나)" : ""}`;
  const off = s.connected ? "" : ", 연결 끊김";
  if (s.row?.kind === "real") return `${who}, ${claimName(s.row.job)}${s.dead ? ", 탈락" : ""}${off}`;
  if (s.dead) return `${who}, 탈락${off}`;
  const row =
    s.row?.kind === "done"
      ? ", 선택 완료"
      : s.row?.kind === "claim"
        ? `, 직업 주장 ${claimName(s.row.job)}${s.row.changed ? ", 말 바꿈" : ""}`
        : "";
  return `${who}${off}${row}`;
}

/** 이름표 아랫줄: 고르는 중 …, 고름 ✓ 완료(반전), 주장 직업(말 안 함은 -), 탈락, 관전용 실제 직업. 직업 이름은 말줄임하지 않는다. */
function TagRow({ row }: { row: DayTagRow }): ReactElement {
  if (row.kind === "wait") return <span className="mf-dt__claim mf-dt__claim--wait">…</span>;
  if (row.kind === "done") {
    return (
      <span className="mf-dt__claim mf-dt__claim--done">
        <Icon name="check" size={14} />
        완료
      </span>
    );
  }
  if (row.kind === "dead") return <span className="mf-dt__claim mf-dt__claim--dead">탈락</span>;
  if (row.kind === "real") {
    return (
      <span className={`mf-dt__claim mf-dt__claim--real${row.job === "mafia" ? " mf-dt__claim--mafia" : ""}`}>{claimName(row.job)}</span>
    );
  }
  const none = row.job === "none";
  const cls = `mf-dt__claim${none ? " mf-dt__claim--none" : ""}${row.pop ? " mf-dt__claim--pop" : ""}`;
  return (
    <span className={cls}>
      {none ? "-" : claimName(row.job)}
      {row.changed ? (
        <span className="mf-dt__chg" role="img" aria-label="말 바꿈">
          <Icon name="changed" size={12} />
        </span>
      ) : null}
    </span>
  );
}

export function DayTable({ seats, mySeat, width, height, label = "테이블", pickVerb = "선택", pickDisabled, allyMarkLabel = "동료" }: DayTableProps): ReactElement {
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
        const style = {
          left: px(p.figLeft),
          top: px(p.figTop),
          width: FIG_W,
          height: FIG_H,
          transform: `scale(${Math.round(p.scale * 1000) / 1000})`,
          zIndex: p.z,
        };
        const inner = (
          <>
            <Figure seat={p.seat} disconnected={!s.connected} ghost={s.dead} />
            {s.isAlly ? (
              <>
                <span className="mf-dt__ring mf-dt__ring--mate" />
                <Icon name="diamond" label={allyMarkLabel} className="mf-dt__mark" />
              </>
            ) : s.isMe ? (
              <span className="mf-dt__ring mf-dt__ring--me" />
            ) : null}
            {s.isHost ? (
              <span className="mf-dt__crown" role="img" aria-label="방장">
                <Icon name="crown" size={13} />
              </span>
            ) : null}
            {s.pick?.mine ? (
              <>
                <span className="mf-dt__sel" />
                <span className="mf-dt__pick mf-dt__pick--me" aria-hidden="true">
                  <Icon name="target" size={16} />
                </span>
              </>
            ) : null}
          </>
        );
        if (s.onPick) {
          return (
            <button
              key={`s${p.seat}`}
              type="button"
              className="mf-dt__seat mf-dt__seat--pick"
              data-seat={p.seat}
              aria-pressed={!!s.pick?.mine}
              aria-label={`${s.nickname}${s.isMe ? " (나)" : ""}, ${pickVerb} 대상`}
              disabled={pickDisabled}
              onClick={s.onPick}
              style={style}
            >
              {inner}
            </button>
          );
        }
        return (
          <div key={`s${p.seat}`} className="mf-dt__seat" data-seat={p.seat} role="group" aria-label={seatLabel(s)} style={style}>
            {inner}
          </div>
        );
      })}
      {places.map((p) => {
        const s = bySeat.get(p.seat);
        if (!s) return null;
        return (
          <div
            key={`t${p.seat}`}
            className={`mf-dt__tag${s.isMe ? " mf-dt__tag--me" : ""}${s.dead ? " mf-dt__tag--dead" : ""}${s.spoke ? " mf-dt__tag--spoke" : ""}`}
            data-seat={p.seat}
            title={s.nickname}
            style={{ left: px(p.tagLeft), top: px(p.tagTop), zIndex: p.tagZ }}
          >
            <span className="mf-dt__name">
              <i className="mf-dt__dot" style={{ background: `var(--seat-${(p.seat % 8) + 1})` }} />
              <span>{s.nickname}</span>
            </span>
            {s.row ? <TagRow row={s.row} /> : null}
          </div>
        );
      })}
      {places.map((p) => {
        const emoji = bySeat.get(p.seat)?.emoji;
        if (!emoji) return null;
        // 머리 위에는 이모티콘만 뜬다. 가로로 가두지 않고, key 가 바뀌면 새 노드라 애니메이션이 다시 시작한다.
        return (
          <div
            key={`e${p.seat}:${emoji.key}`}
            className="mf-dt__emoji"
            data-seat={p.seat}
            aria-hidden="true"
            style={{ left: px(p.emojiLeft), top: px(p.emojiTop), zIndex: EMOJI_Z + emoji.z }}
          >
            <Icon name={emoji.icon} size={22} />
          </div>
        );
      })}
    </div>
  );
}

import { useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, ReactElement } from "react";
import type { EmojiId, RoleId } from "../../shared/protocol";
import { DAY_SCENE_H, DAY_SCENE_W, FIG_H, FIG_W, SCENE_PAD_DEFAULT, dayTableGeometry, daySeatLayout, px } from "../game/dayTable";
import { ROLE_TEXT } from "../game/roleText";
import { Figure } from "./Figure";
import { Icon } from "./Icon";
import "../styles/daytable.css";

// 낮 화면 고정 테이블(결정 0017-1). 받은 공개 값만 그린다 — 입력에 역할 필드가 없다.
// 이름표는 이름 한 줄이다(남의 주장은 이름표가 아니라 채팅에서만 본다, 결정 0023). 동료 표시(isAlly)는 서버가 마피아에게만 보낸
// me.allies 에서 화면이 만든 값이다.
// 한 자리는 밤에는 onPick 이 있으면 대상 버튼, 낮에는 onInspect 가 있으면 기록 카드 버튼이다(둘이 함께 있으면 onPick 이 이긴다).
// roleArt(직업 그림)는 탈락한 본인(관전자) 화면만 만든다 — 살아 있는 사람의 입력에는 이 값이 없다(결정 0021).
// 테이블·캐릭터 기하는 모든 상황에서 시안 P2 값으로 고정이다(결정 0028): 390폭 면 216×108, rx 146, 다른 폭은 game/dayTable.ts 의 규칙.
// 장면 여백(scenePad)은 prop, 없으면 루트의 CSS 변수 --mf-scene-pad(daytable.css 한 곳), 비었으면 12.
// 차례 링(.mf-dt__spot)은 뒤쪽 호(캐릭터 뒤)와 앞쪽 호(캐릭터 앞) 둘로 나뉜다 — 마크업 순서가 Figure 다음이라 앞쪽 호가 그림 위에 그려진다(결정 0028).
// 캐릭터 상자·이름표·이모티콘의 좌표는 game/dayTable.ts 의 daySeatLayout 한 번의 결과에서 나온다(떠 있는 층을 따로 가두지 않는다).

/** 관전 화면에서 표적 배지를 다는 역할 종류. 살아 있는 사람 화면에는 넘어오지 않는다 */
export type SpectatorPick = "mafia" | "police" | "doctor";

// 관전 배지 읽기 이름(문구는 이 표 한 곳)
const SPECTATOR_PICK_LABEL: Readonly<Record<SpectatorPick, string>> = {
  mafia: "마피아 지목 대상",
  police: "경찰 조사 대상",
  doctor: "의사 보호 대상",
};

export interface DayTableSeat {
  seat: number;
  nickname: string;
  connected: boolean;
  isHost: boolean;
  isMe: boolean;
  isAlly: boolean;
  /** 방금 빠른 메시지를 보낸 사람(윗줄 반전) */
  spoke?: boolean;
  /** 머리 위에 떠 있는 이모티콘 하나. key 가 바뀌면 애니메이션이 새로 시작한다. */
  emoji?: { key: string; icon: EmojiId; z: number } | null;
  /** 밤 선택 표시. mine = 내가 고른 대상(발밑 링 + 표적 배지), ally = 마피아 화면의 동료 선택(장식 배지) */
  pick?: { mine?: boolean; ally?: boolean };
  /** 관전 화면 전용: 이 자리를 고른 역할별 표적 배지. 장면이 view.spectate 로만 만든다(결정 0021) */
  spectatorPicks?: readonly SpectatorPick[];
  /** 탈락: 유령 그림·회색 이름표. 탈락 때문에 흐리게 하지 않는다 */
  dead?: boolean;
  /** 있으면 이 자리가 대상 버튼이 된다(밤). 없으면 지금 그대로의 group 노드 */
  onPick?: () => void;
  /** 지금 주장하는 차례인 자리(한 번에 한 자리는 장면이 보장한다): 발밑 링·머리 위 말풍선 배지·이름표 반전 */
  turn?: boolean;
  /** 낮: 자리 전체가 주장 기록 카드 버튼이 된다. onPick 이 있으면 onPick 이 이긴다 */
  onInspect?: () => void;
  /** 관전자 전용: 이 살아 있는 자리를 중립 인물 대신 이 직업 그림으로 그린다. 장면이 탈락한 본인의 서버 값으로만 만든다(결정 0021) */
  roleArt?: RoleId;
  /** 아침: 어둡게 층(z 30) 위(z 31)로 올려 어두워지지 않게 한다. 방금 탈락한 자리 */
  spotlit?: boolean;
  /** spotlit 일 때만 의미: 400ms 맥동을 한 번 돈다(밤 → 아침을 직접 본 경우에만 켠다) */
  pulse?: boolean;
}

export interface DayTableProps {
  seats: readonly DayTableSeat[];
  mySeat: number;
  /** 장면 폭·높이. 안 주면 루트(장면 상자를 100%×100% 로 채운다)를 잰다. */
  width?: number;
  height?: number;
  /** 장면 상자 좌우 여백(px). 안 주면 루트의 CSS 변수 --mf-scene-pad 를 읽고, 비었으면 12 */
  scenePad?: number;
  label?: string;
  /** 대상 버튼의 동사("조사"·"지목"·"보호"). 장면이 넘긴다 — 부품은 역할을 모른다. 기본 "선택" */
  pickVerb?: string;
  /** 연결이 끊겨 보낼 수 없을 때 모든 대상 버튼을 끈다 */
  pickDisabled?: boolean;
  /** 동료 마름모의 읽기 이름. 기본 "동료", 관전 화면은 "마피아" */
  allyMarkLabel?: string;
  /** 아침 어둡게 층. exitDelayMs 는 퇴장 페이드를 시작하기까지의 지연(아침 길이 − 300ms) */
  dim?: { exitDelayMs: number };
}

/** 이모티콘 층 z 기준값: 이름표(최대 11)·캐릭터(최대 22)·어둡게 층(30)·강조(31)보다 위. emoji.z 가 더해진다. */
const EMOJI_Z = 60;
/** 어둡게 층 위로 올라온 자리(방금 탈락한 유령)의 z-index */
const SPOTLIT_Z = 31;

/** 자리 읽기 이름: "{닉네임}{ (나)}{, 직업 | , 탈락}{, 연결 끊김}{, 지금 주장하는 차례}" (낮 기록 버튼이면 ", 주장 기록 보기" 가 더해진다) */
function seatLabel(s: DayTableSeat): string {
  const who = `${s.nickname}${s.isMe ? " (나)" : ""}`;
  const art = s.dead ? undefined : s.roleArt;
  const lead = art !== undefined ? `${who}, ${ROLE_TEXT[art].name}` : s.dead ? `${who}, 탈락` : who;
  return `${lead}${s.connected ? "" : ", 연결 끊김"}${s.turn ? ", 지금 주장하는 차례" : ""}`;
}

/** 머리 위 26px 표적 배지. label 이 있으면 role=img 로 읽히고, 없으면 장식 */
function PickBadge({ kind, label }: { kind: "me" | "ally" | "police" | "doctor"; label?: string }): ReactElement {
  return (
    <span
      className={`mf-dt__pick mf-dt__pick--${kind}`}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : "true"}
    >
      <Icon name="target" size={16} />
    </span>
  );
}

/** 루트의 계산된 --mf-scene-pad. 숫자가 아니면 기본 12 */
function readScenePad(el: Element): number {
  const v = Number.parseFloat(getComputedStyle(el).getPropertyValue("--mf-scene-pad"));
  return Number.isFinite(v) ? v : SCENE_PAD_DEFAULT;
}

export function DayTable({
  seats,
  mySeat,
  width,
  height,
  scenePad,
  label = "테이블",
  pickVerb = "선택",
  pickDisabled,
  allyMarkLabel = "동료",
  dim,
}: DayTableProps): ReactElement {
  const rootRef = useRef<HTMLDivElement>(null);
  const [measured, setMeasured] = useState({ w: DAY_SCENE_W, h: DAY_SCENE_H, pad: SCENE_PAD_DEFAULT });
  const needMeasure = width === undefined || height === undefined;

  // 장면 상자를 마운트 직후 한 번 동기로 재고(첫 페인트부터 실제 크기), 이후 ResizeObserver 로 따라간다.
  // 재지 못하거나 0 이면 시안 기준 크기를 쓴다. 여백은 prop 이 없을 때만 CSS 변수에서 읽는다.
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const apply = (w: number | null, h: number | null): void => {
      const pad = scenePad ?? readScenePad(el);
      setMeasured((prev) => {
        const next = { w: w ?? prev.w, h: h ?? prev.h, pad };
        return prev.w === next.w && prev.h === next.h && prev.pad === next.pad ? prev : next;
      });
    };
    if (!needMeasure) {
      apply(null, null);
      return;
    }
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) apply(rect.width, rect.height);
    else apply(null, null);
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[entries.length - 1]?.contentRect;
      if (!r || r.width <= 0 || r.height <= 0) return;
      apply(r.width, r.height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [needMeasure, scenePad]);

  const sceneW = width ?? measured.w;
  const sceneH = height ?? measured.h;
  const pad = scenePad ?? measured.pad;
  const geo = dayTableGeometry(sceneW, sceneH, pad);
  const places = daySeatLayout(seats, mySeat, sceneW, sceneH, pad);
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
          zIndex: s.spotlit ? SPOTLIT_Z : p.z,
        };
        const art = s.dead ? undefined : s.roleArt;
        const seatClass = `mf-dt__seat${s.spotlit ? " mf-dt__seat--spotlit" : ""}${s.spotlit && s.pulse ? " mf-dt__seat--pulse" : ""}`;
        const inner = (
          <>
            {/* key: 직업 그림으로 바뀌는 자리는 노드가 새로 만들어져 300ms 페이드가 한 번 돈다 */}
            <Figure key={art !== undefined ? "role" : "fig"} seat={p.seat} disconnected={!s.connected} ghost={s.dead} {...(art !== undefined ? { roleArt: art } : {})} />
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
            {s.turn ? (
              <>
                <span className="mf-dt__spot">
                  <span className="mf-dt__spot-arc mf-dt__spot-arc--back" />
                  <span className="mf-dt__spot-arc mf-dt__spot-arc--front" />
                </span>
                <span className="mf-dt__turn" aria-hidden="true">
                  <Icon name="speech" size={16} />
                </span>
              </>
            ) : null}
            {/* 배지 쌓기: 경찰 → 의사 → 마피아 → 내 링 → 내 배지(내 것이 위) */}
            {s.spectatorPicks?.includes("police") ? <PickBadge kind="police" label={SPECTATOR_PICK_LABEL.police} /> : null}
            {s.spectatorPicks?.includes("doctor") ? <PickBadge kind="doctor" label={SPECTATOR_PICK_LABEL.doctor} /> : null}
            {s.spectatorPicks?.includes("mafia") ? (
              <PickBadge kind="ally" label={SPECTATOR_PICK_LABEL.mafia} />
            ) : s.pick?.ally ? (
              <PickBadge kind="ally" />
            ) : null}
            {s.pick?.mine ? (
              <>
                <span className="mf-dt__sel" />
                <PickBadge kind="me" />
              </>
            ) : null}
          </>
        );
        if (s.onPick) {
          return (
            <button
              key={`s${p.seat}`}
              type="button"
              className={`${seatClass} mf-dt__seat--pick`}
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
        if (s.onInspect) {
          return (
            <button
              key={`s${p.seat}`}
              type="button"
              className={`${seatClass} mf-dt__seat--pick mf-dt__seat--inspect`}
              data-seat={p.seat}
              aria-label={`${seatLabel(s)}, 주장 기록 보기`}
              onClick={s.onInspect}
              style={style}
            >
              {inner}
            </button>
          );
        }
        return (
          <div key={`s${p.seat}`} className={seatClass} data-seat={p.seat} role="group" aria-label={seatLabel(s)} style={style}>
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
            className={`mf-dt__tag${s.isMe ? " mf-dt__tag--me" : ""}${s.dead ? " mf-dt__tag--dead" : ""}${s.spoke ? " mf-dt__tag--spoke" : ""}${s.turn ? " mf-dt__tag--turn" : ""}`}
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
      {dim ? (
        <div className="mf-dt__dim" aria-hidden="true" style={{ "--mf-dim-exit-delay": `${dim.exitDelayMs}ms` } as CSSProperties} />
      ) : null}
    </div>
  );
}

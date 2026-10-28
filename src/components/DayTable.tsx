import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, ReactElement, ReactNode } from "react";
import type { EmojiId, RoleId } from "../../shared/protocol";
import { DAY_SCENE_H, DAY_SCENE_W, EMOJI_LIFT, EMOJI_SIZE, FIG_H, FIG_W, SCENE_PAD_DEFAULT, dayTableGeometry, daySeatLayout, px } from "../game/dayTable";
import type { DaySeatPlace } from "../game/dayTable";
import { ROLE_TEXT } from "../game/roleText";
import { CONE_H, CONE_W, GHOST_FADE_MS, candidateCenter, chipAnchor } from "../game/verdict";
import { Figure } from "./Figure";
import { Icon } from "./Icon";
import "../styles/daytable.css";

// 낮 화면 고정 테이블(결정 0017-1). 받은 공개 값만 그린다 — 입력에 역할 필드가 없다.
// 이름표는 이름 한 줄이다(남의 주장은 이름표가 아니라 채팅에서만 본다, 결정 0023). 동료 표시(isAlly)는 서버가 마피아에게만 보낸
// me.allies 에서 화면이 만든 값이다.
// 한 자리는 밤에는 onPick 이 있으면 대상 버튼, 낮에는 onInspect 가 있으면 기록 카드 버튼, 대기실에는 onPress 가 있으면 누르는 버튼이다
// (함께 있으면 onPick > onInspect > onPress). 대기실·역할 배정도 이 부품을 그대로 쓴다(결정 0028) — transition 은 입장·퇴장 표시,
// slide 는 인원이 바뀔 때 나머지가 새 자리로 미끄러지게 한다(첫 프레임 뒤에 켜서 처음 배치는 미끄러지지 않는다).
// roleArt(직업 그림)는 탈락한 본인(관전자) 화면만 만든다 — 살아 있는 사람의 입력에는 이 값이 없다(결정 0021).
// 테이블·캐릭터 기하는 모든 상황에서 시안 P2 값으로 고정이다(결정 0028): 390폭 면 216×108, rx 146, 다른 폭은 game/dayTable.ts 의 규칙.
// 장면 여백(scenePad)은 prop, 없으면 루트의 CSS 변수 --mf-scene-pad(daytable.css 한 곳), 비었으면 12.
// 발밑 원과 이름표 반전은 없다(결정 0030). 말하는 차례·내가 밤에 고른 대상은 그림의 흰 후광, 마피아 동료(관전자 화면의 모든 마피아)는 진홍 후광이고
// 한 자리가 둘 다면 흰 후광이 이긴다. 내 표시는 후광 없이 내 이름표 테두리뿐이다. 말하는 중(주장 차례·빠른 메시지 3초)은 머리 위 '…' 말풍선이고,
// 같은 자리에 이모티콘이 있으면 말풍선 대신 이모티콘만 보인다. 방장 왕관은 hostCrown(대기실)일 때만 그린다.
// 캐릭터 상자·이름표·이모티콘의 좌표는 game/dayTable.ts 의 daySeatLayout 한 번의 결과에서 나온다(떠 있는 층을 따로 가두지 않는다).
// 최후 변론·처형 무대(04-21): 좌석 center 는 그 자리를 candidateCenter(game/verdict.ts) 한 곳의 가운데 자리로 옮기고(x·발 y·배율 1.7), root verdict 는
// 어둡게+흐림 층(z 30)을 그린다. center 좌석이 있으면 위에서 내려오는 원뿔 층 하나도 그린다(어둡게 층 뒤 같은 z). 수치는 prop 에서만 온다 —
// 이 부품은 45·3 같은 값을 모른다(D-38). 좌표는 placeOf 한 함수를 지나 기본 좌석과 같은 경로다.

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
  /** 방금 빠른 메시지를 보낸 사람(머리 위 '…' 말풍선, 후광 없음) */
  spoke?: boolean;
  /** 머리 위에 떠 있는 이모티콘 하나. key 가 바뀌면 애니메이션이 새로 시작한다. */
  emoji?: { key: string; icon: EmojiId; z: number } | null;
  /** 밤 선택 표시. mine = 내가 고른 대상(흰 후광 + 표적 배지), ally = 마피아 화면의 동료 선택(장식 배지) */
  pick?: { mine?: boolean; ally?: boolean };
  /** 관전 화면 전용: 이 자리를 고른 역할별 표적 배지. 장면이 view.spectate 로만 만든다(결정 0021) */
  spectatorPicks?: readonly SpectatorPick[];
  /** 탈락: 유령 그림·회색 이름표. 탈락 때문에 흐리게 하지 않는다 */
  dead?: boolean;
  /** 있으면 이 자리가 대상 버튼이 된다(밤). 없으면 지금 그대로의 group 노드 */
  onPick?: () => void;
  /** 지금 주장하는 차례인 자리(한 번에 한 자리는 장면이 보장한다): 흰 후광 + 머리 위 '…' 말풍선 */
  turn?: boolean;
  /** 낮: 자리 전체가 주장 기록 카드 버튼이 된다. onPick 이 있으면 onPick 이 이긴다 */
  onInspect?: () => void;
  /** 관전자 전용: 이 살아 있는 자리를 중립 인물 대신 이 직업 그림으로 그린다. 장면이 탈락한 본인의 서버 값으로만 만든다(결정 0021) */
  roleArt?: RoleId;
  /** 대기실: 입장·퇴장 중인 자리 표시(서버 스냅샷의 차이에서 화면이 만든다). 자리 그림과 이름표에 전이 클래스가 붙는다 */
  transition?: "entering" | "leaving" | null;
  /** 대기실: 누를 수 있는 자리(방장이 끊긴 사람을 내보낼 때). onPick·onInspect 가 없을 때만 쓰인다 */
  onPress?: () => void;
  /**
   * 투표 구간이 capHalos(game/verdict.ts)로 정한 최종 후광 종류. 주면 이 값이 파생 규칙(차례·밤 선택 = 흰, 동료 = 진홍)을 이긴다 —
   * "none" 은 후광만 끄고 동료 마름모(isAlly)는 남긴다(한 화면 3개 상한, UI-SPEC 12.4). 안 주면 기존 파생 그대로다.
   */
  halo?: "white" | "amber" | "crimson" | "none";
  /** onPick 버튼의 눌림 상태(aria-pressed). 후광만 쓰는 투표 구간용 — pick.mine 과 달리 머리 위 배지를 그리지 않는다. 안 주면 !!pick.mine */
  pressed?: boolean;
  /**
   * 후보 선택 공개의 표수 칩(UI-SPEC 8.3). 그 자리 머리 위에 n 을 그린다(장식, 클릭을 가로채지 않음). tone: plain(일반) · pop(방금 닿음, 앰버 팝) ·
   * lead(유일한 최다, 앰버 유지·큰 칩) · beat(과반 확정 순간 약 0.7초, lead 모양 + 2회 크게 두근). slow 면 확정 뒤 작은 느린 박동.
   * 숫자가 오르면 새 노드라 팝이 다시 돈다.
   */
  chip?: { n: number; tone: "plain" | "pop" | "lead" | "beat"; slow?: boolean };
  /**
   * 과반 확정 연출(04-20, D-31 ③): clinch = 확정 순간 약 0.7초 동안 캐릭터가 2회 크게 두근(앰버 후광도 밝아졌다 돌아옴),
   * slow = 그 뒤 공개가 끝날 때까지 작은 느린 박동. 안 주면 지금 그대로다. 크기 변화는 개별 속성 scale 이라 좌석의 깊이 transform 과 겹치지 않는다.
   */
  beat?: "clinch" | "slow";
  /**
   * beat 가 clinch 일 때, 확정 뒤 같은 후보에게 표가 더 닿아 두근을 처음부터 다시 도는 홀수 번째 반복이면 true.
   * CSS 애니메이션은 같은 이름이면 다시 시작하지 않으므로, 다시 돌 때마다 이름이 번갈아 바뀌게(mf-dk-c ↔ mf-dk-c-b) 클래스로 구분한다.
   */
  beatAlt?: boolean;
  /** 최후 변론·처형의 후보: 테이블 가운데로 이동·1.7배(game/verdict.ts candidateCenter). z 그림 31·이름표 32. 한 화면에 한 자리 */
  center?: boolean;
  /**
   * 처형(04-23): dead 와 함께 켜면 사람 층 → 유령 층 400ms 전환을 그린다(사람 층 투명 1 → .35, 유령 층 0 → .9 + 아래 18px 에서 떠오름, 끝나면 사람 층 제거).
   * 이 접속이 직접 본 처형에만 켠다 — 재접속·중간 합류는 안 주어 곧바로 유령 한 장이다. 후광은 보이는 유령 층 하나에만 붙는다.
   */
  executed?: boolean;
  /** 아침: 어둡게 층(z 30) 위(z 31)로 올려 어두워지지 않게 한다. 방금 탈락한 자리 */
  spotlit?: boolean;
  /** spotlit 일 때만 의미: 400ms 맥동을 한 번 돈다(밤 → 아침을 직접 본 경우에만 켠다) */
  pulse?: boolean;
}

/** layer 슬롯이 받는 장면 배치: 자리별 발 위치·배율과 장면 크기(daySeatLayout 한 번의 결과) */
export interface DayTableLayout {
  places: readonly DaySeatPlace[];
  sceneW: number;
  sceneH: number;
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
  /** 대기실: 인원이 바뀌면 나머지 자리가 짧은 CSS 전이로 새 자리로 미끄러진다. 마운트 직후 첫 프레임에는 켜지 않는다 */
  slide?: boolean;
  /** 방장 왕관을 그린다. 대기실만 켠다(역할 배정·낮·밤·아침은 왕관이 없다, 결정 0030) */
  hostCrown?: boolean;
  /** 아침 어둡게 층. exitDelayMs 는 퇴장 페이드를 시작하기까지의 지연(아침 길이 − 300ms) */
  dim?: { exitDelayMs: number };
  /** 최후 변론·처형: 어둡게+흐림 층. 값은 CSS 변수(--mf-verdict-dim·--mf-verdict-blur)로 내려간다. 있으면 root 에 mf-dt--verdict(좌석 이동 전이 600ms). 아침 dim 과 함께 쓰지 않는다 */
  verdict?: { dimPercent: number; blurPx: number };
  /**
   * 좌석·이름표·칩 뒤, 루트의 마지막 자식으로 한 번 그리는 덧그림 층(후보 선택 공개의 화살표, 04-20). 장면 배치를 받아 좌표를 얻는다.
   * 없으면 렌더가 이전과 같다.
   */
  layer?: (layout: DayTableLayout) => ReactNode;
}

/** 좌석 halo → 그림 후광 클래스(none 은 클래스 없음) */
const HALO_CLASS: Readonly<Record<NonNullable<DayTableSeat["halo"]>, string | undefined>> = {
  white: "mf-figure--halo-white",
  amber: "mf-figure--halo-amber",
  crimson: "mf-figure--halo-crimson",
  none: undefined,
};

/** 이모티콘 층 z 기준값: 이름표(최대 11)·캐릭터(최대 22)·어둡게 층(30)·강조(31)보다 위. emoji.z 가 더해진다. */
const EMOJI_Z = 60;
/** 표수 칩 z-index: 캐릭터(22)·어둡게 층(30)·강조(31) 위, 이모티콘(60+) 아래 */
const CHIP_Z = 46;
/** 어둡게 층 위로 올라온 자리(방금 탈락한 유령)의 z-index */
const SPOTLIT_Z = 31;
/** 최후 변론 후보의 z-index: 그림은 어둡게 층(30) 위, 이름표는 그림 위(UI-SPEC 12) */
const CENTER_Z = 31;
const CENTER_TAG_Z = 32;
/** 원뿔 아래끝은 후보 발 y + 8 (UI-SPEC 8.4, 이름표 위와 같은 선) */
const CANDIDATE_CONE_BELOW_FOOT = 8;

/** 한 좌석의 최종 배치. center 좌석은 candidateCenter 한 곳의 가운데 자리로 덮고, 나머지는 daySeatLayout 결과 그대로다 */
function placeOf(p: DaySeatPlace, center: boolean, cc: ReturnType<typeof candidateCenter>): DaySeatPlace {
  if (!center) return p;
  return {
    ...p,
    x: cc.x,
    y: cc.footY,
    scale: cc.scale,
    z: CENTER_Z,
    tagZ: CENTER_TAG_Z,
    figLeft: cc.x - FIG_W / 2,
    figTop: cc.footY - FIG_H,
    tagLeft: cc.x,
    tagTop: cc.tagTop,
    emojiLeft: cc.x - EMOJI_SIZE / 2,
    emojiTop: Math.max(0, cc.footY - FIG_H * cc.scale - EMOJI_LIFT),
  };
}

/** 처형 전환 한 자리: 사람 층(투명으로 사라짐)과 유령 층(떠오름)을 GHOST_FADE_MS 동안 겹쳐 그리고, 지나면 사람 층을 걷어 유령 한 장만 남긴다. 타이머는 하나이고 언마운트에 정리한다 */
function ExecutedFigures({ seat, disconnected, haloClass }: { seat: number; disconnected: boolean; haloClass: string | undefined }): ReactElement {
  const [humanGone, setHumanGone] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setHumanGone(true), GHOST_FADE_MS);
    return () => clearTimeout(id);
  }, []);
  return (
    <>
      {humanGone ? null : <Figure key="exec-out" seat={seat} disconnected={disconnected} className="mf-figure--exec-out" />}
      <Figure key="exec-in" seat={seat} disconnected={disconnected} ghost className={haloClass ? `mf-figure--exec-in ${haloClass}` : "mf-figure--exec-in"} />
    </>
  );
}

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
  hostCrown,
  dim,
  verdict,
  slide,
  layer,
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

  // 미끄러짐은 첫 프레임이 그려진 뒤에 켠다 — 처음 배치(마운트·단계 전환 직후)가 튀어 보이지 않는다
  const [slideOn, setSlideOn] = useState(false);
  useEffect(() => {
    if (!slide) {
      setSlideOn(false);
      return;
    }
    const id = requestAnimationFrame(() => setSlideOn(true));
    return () => cancelAnimationFrame(id);
  }, [slide]);

  const sceneW = width ?? measured.w;
  const sceneH = height ?? measured.h;
  const pad = scenePad ?? measured.pad;
  const geo = dayTableGeometry(sceneW, sceneH, pad);
  const bySeat = new Map(seats.map((s) => [s.seat, s]));
  const cc = candidateCenter(sceneW, sceneH, pad);
  const places = daySeatLayout(seats, mySeat, sceneW, sceneH, pad).map((p) => placeOf(p, bySeat.get(p.seat)?.center === true, cc));
  const hasCenter = seats.some((s) => s.center === true);

  return (
    <div ref={rootRef} className={`mf-root mf-dt${slide && slideOn ? " mf-dt--slide" : ""}${verdict ? " mf-dt--verdict" : ""}`} role="group" aria-label={label}>
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
        const seatClass = `mf-dt__seat${s.beat ? ` mf-dt__seat--${s.beat}` : ""}${s.beat === "clinch" && s.beatAlt ? " mf-dt__seat--alt" : ""}${s.spotlit ? " mf-dt__seat--spotlit" : ""}${s.spotlit && s.pulse ? " mf-dt__seat--pulse" : ""}${
          s.transition === "entering" ? " mf-dt__seat--enter" : s.transition === "leaving" ? " mf-dt__seat--leave" : ""
        }`;
        // 후광은 그림 img 하나에만 붙는다. halo 가 있으면 그 값, 없으면 파생: 흰(차례·내가 고른 대상) > 진홍(동료)
        const derivedHalo = s.turn || s.pick?.mine ? "mf-figure--halo-white" : s.isAlly ? "mf-figure--halo-crimson" : undefined;
        const haloClass = s.halo !== undefined ? HALO_CLASS[s.halo] : derivedHalo;
        const inner = (
          <>
            {/* key: 직업 그림으로 바뀌는 자리는 노드가 새로 만들어져 300ms 페이드가 한 번 돈다 */}
            {s.dead && s.executed ? (
              <ExecutedFigures seat={p.seat} disconnected={!s.connected} haloClass={haloClass} />
            ) : (
              <Figure
                key={art !== undefined ? "role" : "fig"}
                seat={p.seat}
                disconnected={!s.connected}
                ghost={s.dead}
                {...(art !== undefined ? { roleArt: art } : {})}
                {...(haloClass ? { className: haloClass } : {})}
              />
            )}
            {s.isAlly ? <Icon name="diamond" label={allyMarkLabel} className="mf-dt__mark" /> : null}
            {hostCrown && s.isHost ? (
              <span className="mf-dt__crown" role="img" aria-label="방장">
                <img src="/characters/host/host_badge.svg" alt="" aria-hidden="true" draggable={false} />
              </span>
            ) : null}
            {(s.turn || s.spoke) && !s.emoji ? (
              <span className={`mf-dt__bubble mf-dt__bubble--${s.turn ? "turn" : "spoke"}`} aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
            ) : null}
            {/* 배지 쌓기: 경찰 → 의사 → 마피아 → 내 배지(내 것이 위) */}
            {s.spectatorPicks?.includes("police") ? <PickBadge kind="police" label={SPECTATOR_PICK_LABEL.police} /> : null}
            {s.spectatorPicks?.includes("doctor") ? <PickBadge kind="doctor" label={SPECTATOR_PICK_LABEL.doctor} /> : null}
            {s.spectatorPicks?.includes("mafia") ? (
              <PickBadge kind="ally" label={SPECTATOR_PICK_LABEL.mafia} />
            ) : s.pick?.ally ? (
              <PickBadge kind="ally" />
            ) : null}
            {s.pick?.mine ? <PickBadge kind="me" /> : null}
          </>
        );
        if (s.onPick) {
          return (
            <button
              key={`s${p.seat}`}
              type="button"
              className={`${seatClass} mf-dt__seat--pick`}
              data-seat={p.seat}
              aria-pressed={s.pressed ?? !!s.pick?.mine}
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
        if (s.onPress) {
          return (
            <button
              key={`s${p.seat}`}
              type="button"
              className={`${seatClass} mf-dt__seat--pick`}
              data-seat={p.seat}
              aria-label={seatLabel(s)}
              onClick={s.onPress}
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
            className={`mf-dt__tag${s.isMe ? " mf-dt__tag--me" : ""}${s.dead ? " mf-dt__tag--dead" : ""}${
              s.transition === "entering" ? " mf-dt__tag--enter" : s.transition === "leaving" ? " mf-dt__tag--leave" : ""
            }`}
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
      {places.map((p) => {
        const chip = bySeat.get(p.seat)?.chip;
        if (!chip) return null;
        // 위치는 chipAnchor 한 곳(머리 위 8px, 위는 4 이상·좌우는 장면 안). 숫자가 key 에 들어 오르면 새 노드가 되어 팝이 다시 돈다.
        const big = chip.tone === "lead" || chip.tone === "beat";
        const rect = chipAnchor({ x: p.x, y: p.y, scale: p.scale }, big ? "lead" : "normal", sceneW);
        return (
          <span
            key={`c${p.seat}:${chip.n}`}
            className={`mf-vchip mf-vchip--${chip.tone}${chip.slow ? " mf-vchip--slow" : ""}`}
            data-seat={p.seat}
            aria-hidden="true"
            style={{ left: px(rect.left), top: px(rect.top), width: px(rect.width), height: px(rect.height), zIndex: CHIP_Z }}
          >
            {chip.n}
          </span>
        );
      })}
      {verdict ? (
        <div
          className="mf-dt__dim mf-dt__dim--verdict"
          aria-hidden="true"
          style={{ "--mf-verdict-dim": `${verdict.dimPercent}%`, "--mf-verdict-blur": `${verdict.blurPx}px` } as CSSProperties}
        />
      ) : dim ? (
        <div className="mf-dt__dim" aria-hidden="true" style={{ "--mf-dim-exit-delay": `${dim.exitDelayMs}ms` } as CSSProperties} />
      ) : null}
      {hasCenter ? (
        <div
          className="mf-dt__cone"
          aria-hidden="true"
          style={{ left: px(cc.x - CONE_W / 2), top: px(cc.footY + CANDIDATE_CONE_BELOW_FOOT - CONE_H), width: CONE_W, height: CONE_H }}
        />
      ) : null}
      {layer ? layer({ places, sceneW, sceneH }) : null}
    </div>
  );
}

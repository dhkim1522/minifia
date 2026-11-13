import { useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent, PointerEvent, Ref } from "react";
import "../../styles/v2.css";
import { LOG_H } from "../../game/chatUi";
import { ERRAND_TEXT } from "../../game/errandView";
import { useReducedMotion } from "../../net/useReducedMotion";
import { ChatPanel } from "./ChatPanel";
import type { ChatPanelMessage } from "./ChatPanel";
import { HeadCount } from "./HeadCount";
import { V2Icon } from "./V2Icon";

// 21페이즈 저녁·아침 독(P21-1·P21-5·P21-6·P21-8, D-06·D-23·D-24): 읽기 전용 기록 두 줄 + 행동 줄(주 단추 + [건너뛰기]).
// 모든 역할이 같은 마크업이다: 이 부품에는 역할·좌석 prop 이 없고 같은 입력이면 같은 DOM 을 낸다. 길게 누르기(0.6초)는 단추 안 채움 막대를 누구에게나 똑같이
// 채울 뿐이고, 길게 눌렀는지는 떼는 순간 onPress(hold) 의 인자 하나로만 나간다 — 그 값으로 무엇이 일어나는지는 서버가 정한다(눈으로 구별되지 않는다, P21-8).
// 21-12·21-13 이 밤·아침 변형을 같은 부품에 더한다(primary.kind "scene" 은 아침 [살펴보기] 자리).

/** 길게 누르기로 보는 시간(ms). 채움 막대의 길이와 같다 */
export const HOLD_MS = 600;
/** 행동 줄 높이 */
export const DOCK_ROW_H = 56;
/** 독 높이 = 위 14 + 기록 칸 LOG_H + 간격 10 + 행동 줄 56 + 아래 22(기존 .mf-game__panel 의 패딩 14·22·간격 10 그대로) */
export const DOCK_H = 14 + LOG_H + 10 + DOCK_ROW_H + 22;

/** 손가락 뒤에 따라오는 click 을 가려내는 시간(ms) — 눌림 하나가 두 번 나가지 않게 */
const CLICK_ECHO_MS = 700;

export interface SceneDockPrimary {
  /** lamp = 저녁 [켜기], scene = 아침 [살펴보기](21-13) */
  kind: "lamp" | "scene";
  /** 비활성 모양: 누르면 아무 일 없다(안내 글 없음) */
  disabled: boolean;
  /** 금빛 깜빡 테두리(눌러야 할 때) */
  call: boolean;
  /** 할 일을 다 했다: "완료" 비활성 모양 */
  done: boolean;
  /** 눌림이 끝났다. hold = 0.6초 이상 누르고 뗐는가(키보드는 늘 false) */
  onPress(hold: boolean): void;
}

export interface SceneDockSkip {
  /** 서버가 센 누른 수 */
  count: number;
  /** 산 사람 수 */
  total: number;
  pressed: boolean;
  /** 연결이 닫혀 보낼 수 없을 때(aria-disabled) */
  disabled?: boolean;
  onToggle(next: boolean): void;
}

export interface SceneDockProps {
  /** 기록 칸(읽기 전용 두 줄). 입력줄은 없다 */
  log: { messages: ChatPanelMessage[]; channel?: "all" | "mafia" | "ghost" };
  primary: SceneDockPrimary;
  /** 유령·탈락자는 null(단추 없음) */
  skip: SceneDockSkip | null;
  /** 아래 패널 자리 측정(useMapInsets)이 쓰는 ref */
  panelRef?: Ref<HTMLElement>;
}

const NOOP = (): void => {};

/** 단추 안 채움 막대: 누르는 동안 왼→오 0.6초 선형으로 찬다(모션 줄이기는 누르는 즉시 가득). 뗄 때는 곧바로 비운다 */
function fillStyle(holding: boolean, reduced: boolean): CSSProperties {
  return {
    transform: holding ? "scaleX(1)" : "scaleX(0)",
    transition: holding && !reduced ? `transform ${HOLD_MS}ms linear` : "none",
  };
}

const PRIMARY_TEXT = {
  lamp: { label: "켜기", aria: "등불 켜기", icon: "flame" },
  scene: { label: "살펴보기", aria: "살펴보기", icon: "eye" },
} as const;

function PrimaryButton({ primary }: { primary: SceneDockPrimary }) {
  const reduced = useReducedMotion();
  const [holding, setHolding] = useState(false);
  const downAt = useRef<number | null>(null);
  const handledAt = useRef(0);
  const off = primary.disabled || primary.done;
  const text = PRIMARY_TEXT[primary.kind];

  const finish = (hold: boolean): void => {
    handledAt.current = Date.now();
    primary.onPress(hold);
  };
  const onDown = (e: PointerEvent<HTMLButtonElement>): void => {
    if (off || (e.button !== undefined && e.button > 0)) return;
    downAt.current = Date.now();
    setHolding(true);
  };
  const onUp = (): void => {
    const at = downAt.current;
    downAt.current = null;
    setHolding(false);
    if (at === null || off) return;
    finish(Date.now() - at >= HOLD_MS);
  };
  const onAbort = (): void => {
    if (downAt.current === null) return;
    downAt.current = null;
    setHolding(false);
  };
  const onKey = (e: KeyboardEvent<HTMLButtonElement>): void => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    if (e.repeat || off) return;
    finish(false);
  };
  const onKeyUp = (e: KeyboardEvent<HTMLButtonElement>): void => {
    if (e.key === " ") e.preventDefault();
  };
  // 보조 기술의 활성화처럼 포인터·키 없이 오는 click 은 짧은 눌림으로 본다. 손가락·키 눌림 뒤에 따라오는 click 은 이미 처리했으니 거른다.
  const onClick = (): void => {
    if (off || Date.now() - handledAt.current < CLICK_ECHO_MS) return;
    finish(false);
  };

  const attrs =
    primary.kind === "lamp"
      ? { "data-errand-act": "" }
      : { "data-scene-act": "" };
  return (
    <button
      type="button"
      className={primary.call ? `mv-scene-dock__main mv-scene-dock__main--${primary.kind} is-call` : `mv-scene-dock__main mv-scene-dock__main--${primary.kind}`}
      {...attrs}
      data-call={primary.call ? "" : undefined}
      aria-label={primary.done ? ERRAND_TEXT.done : text.aria}
      aria-disabled={off ? "true" : undefined}
      onPointerDown={onDown}
      onPointerUp={onUp}
      onPointerCancel={onAbort}
      onPointerLeave={onAbort}
      onKeyDown={onKey}
      onKeyUp={onKeyUp}
      onClick={onClick}
      onContextMenu={(e) => e.preventDefault()}
    >
      <span className="mv-scene-dock__clip" aria-hidden="true">
        <span className="mv-scene-dock__fill" data-hold-fill="" style={fillStyle(holding, reduced)} />
      </span>
      <V2Icon name={primary.done ? "check" : text.icon} size={22} />
      <span className="mv-scene-dock__label">{primary.done ? ERRAND_TEXT.done : text.label}</span>
    </button>
  );
}

export function SceneDock({ log, primary, skip, panelRef }: SceneDockProps) {
  return (
    <section ref={panelRef} className="mf-game__panel mf-game__dock" data-world-panel="" data-scene-dock="">
      <ChatPanel messages={log.messages} {...(log.channel !== undefined ? { channel: log.channel } : {})} value="" onChange={NOOP} logHeight={LOG_H} />
      <div className="mv-scene-dock__row">
        <PrimaryButton primary={primary} />
        {skip !== null ? (
          <button
            type="button"
            className="mf-act mv-scene-dock__skip"
            aria-label={`건너뛰기 ${skip.count}/${skip.total}`}
            aria-pressed={skip.pressed}
            aria-disabled={skip.disabled === true ? "true" : undefined}
            data-skip-phase=""
            data-skip-count={String(skip.count)}
            onClick={() => {
              if (skip.disabled === true) return;
              skip.onToggle(!skip.pressed);
            }}
          >
            <span className="mv-scene-dock__skip-top">
              <V2Icon name="skip" size={22} />
              <HeadCount count={skip.count} total={skip.total} label={`${skip.count}/${skip.total}`} />
            </span>
            <span className="mf-act__label">건너뛰기</span>
          </button>
        ) : null}
      </div>
    </section>
  );
}

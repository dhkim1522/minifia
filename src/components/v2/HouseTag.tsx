import { useState } from "react";
import type { CSSProperties } from "react";
import "../../styles/v2.css";
import { faceSrc, seatColorVar } from "../../net/assets";
import { V2Icon } from "./V2Icon";

// 밤 집 문패 단추(HouseTag) — 21페이즈 D-10·D-25, UI-SPEC P21-3~P21-5. design/v3.0/lamp-house/Night.dc.html 의 문패(얼굴 + 자리색 테두리 + 창 점 + 고른 집의 금빛 테두리).
// ErrandAct·ErrandMarker 와 같은 계약: 이 부품은 역할·좌석 비밀·가짜 표식 prop 이 없고 같은 입력에 같은 DOM 을 낸다(모든 역할이 같은 마크업, T-21-31).
// 위치(style·transform)는 맵 투영을 아는 층(WorldStage)이 프레임마다 쓴다 — 이 부품은 그리기만 한다.
// 보이는 원 40 = 얼굴 32 + 자리색 테두리 2, 누르기 영역 44. 단추가 아닌 문패(유령 화면·탈락자·주인 없음)는 button 이 아닌 요소이고 눌림을 받지 않는다(is-static).
// 닉네임은 접근성 이름(aria-label 속성 문자열)에만 있다 — 화면에 글자는 없고 innerHTML 도 없다(T-21-33).

export interface HouseTagProps {
  seat: number;
  /** 접근성 이름용 닉네임. 빈 좌석은 null */
  nickname: string | null;
  /** 주인이 있다(탈락자 포함) — 얼굴 그림을 그린다 */
  owner: boolean;
  /** 주인이 산 사람이다. 생략하면 button 과 같다 — 단추 아닌 문패가 흐린지(탈락자·주인 없음) 가리는 데만 쓴다 */
  alive?: boolean;
  /** 누를 수 있는 단추인가 */
  button: boolean;
  /** 창 점: 켜짐 = 채움 + 번짐, 꺼짐 = 속 빈 테두리. 3D 창과 같은 값(houseLitOf) */
  lit: boolean;
  /** 내가 고른 집: 정지한 금빛 3px 테두리 + check 배지 + aria-pressed */
  picked: boolean;
  /** 빛남(14 의 is-call): 아직 안 골랐을 때 고를 수 있는 모든 집 */
  call: boolean;
  /** 연결이 끊겼다: 눌러도 onPick 을 부르지 않는다(누르기 영역·모양은 그대로) */
  disabled?: boolean;
  onPick?: (seat: number) => void;
  style?: CSSProperties;
}

/** 접근성 이름: "{닉네임}의 집, 불 켜짐|불 꺼짐" + 고른 뒤 ", 고름" */
function houseLabel(nickname: string, lit: boolean, picked: boolean): string {
  return `${nickname}의 집, ${lit ? "불 켜짐" : "불 꺼짐"}${picked ? ", 고름" : ""}`;
}

export function HouseTag({ seat, nickname, owner, alive, button, lit, picked, call, disabled, onPick, style }: HouseTagProps) {
  // 얼굴 그림이 안 떴으면 그림 자리만 자리색 원으로 바꾼다(FaceList 와 같은 규칙) — 단추·선택은 그대로
  const [broken, setBroken] = useState(false);
  const color = seatColorVar(seat);
  const body = (
    <>
      <span className="mv-housetag__face" data-house-face="" style={{ "--house-seat": color } as CSSProperties}>
        {owner ? (
          broken ? (
            <i className="mv-housetag__fallback" style={{ background: color }} />
          ) : (
            <img className="mv-housetag__img" src={faceSrc(seat)} alt="" draggable={false} onError={() => setBroken(true)} />
          )
        ) : null}
      </span>
      <i className={lit ? "mv-housetag__win is-lit" : "mv-housetag__win"} data-window-dot="" aria-hidden="true" />
      {picked ? (
        <span className="mv-housetag__check" data-house-check="" aria-hidden="true">
          <V2Icon name="check" size={12} />
        </span>
      ) : null}
    </>
  );
  const dim = !(alive ?? button);
  if (!button) {
    return (
      <span
        className={dim ? "mv-housetag is-static is-dim" : "mv-housetag is-static"}
        data-house-tag={seat}
        data-lit={lit ? "true" : "false"}
        {...(owner && nickname !== null ? { role: "img", "aria-label": houseLabel(nickname, lit, false) } : { "aria-hidden": true })}
        style={style}
      >
        {body}
      </span>
    );
  }
  const name = nickname ?? "";
  return (
    <button
      type="button"
      className={["mv-housetag", picked && "is-picked", call && "is-call"].filter(Boolean).join(" ")}
      data-house-tag={seat}
      data-lit={lit ? "true" : "false"}
      data-picked={picked ? "" : undefined}
      data-call={call ? "" : undefined}
      aria-pressed={picked}
      aria-disabled={disabled ? "true" : undefined}
      aria-label={houseLabel(name, lit, picked)}
      style={style}
      // 문패를 눌러도 채팅 입력칸의 포커스(키보드)를 뺏지 않는다
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => {
        if (disabled || picked) return; // 이미 고른 집을 다시 눌러도 같은 선택이다 — 보내지 않는다(FaceList 와 같은 규칙)
        onPick?.(seat);
      }}
    >
      {body}
    </button>
  );
}

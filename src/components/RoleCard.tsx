import { useState } from "react";
import type { KeyboardEvent } from "react";
import type { RoleId } from "../../shared/game/roles";
import { ROLE_TEXT, alliesText } from "../game/roleText";
import { roleArtSrc } from "../net/assets";
import "../styles/phase.css";

export interface RoleCardProps {
  /** 서버가 me.role 로만 보낸 값. 역할이 없는 뷰는 null */
  role: RoleId | null;
  face: "back" | "front";
  /** null = 동료 줄 없음(마피아 아님), [] = "혼자예요" */
  allies: string[] | null;
  /** 사회자 줄이 이 카드를 부를 때 true — 루트에 is-call + 값 없는 data-call(14페이즈 HOST-03). 모든 역할에게 같은 모양 */
  call?: boolean;
  onFlip: () => void;
}

// 뒷면 마름모(design-system 의 Diamond). 역할과 무관하게 모든 사람에게 같은 마크업이다.
// [내 역할] 시트가 정적 뒷면 그림으로 같은 마름모를 쓰도록 내보낸다.
export function Diamond() {
  return (
    <svg className="mf-card__diamond" viewBox="0 0 100 100" aria-hidden="true">
      <path d="M50 4 96 50 50 96 4 50z" fill="none" stroke="var(--gray-500)" strokeWidth={2} />
      <path d="M50 18 82 50 50 82 18 50z" fill="var(--crimson-500)" />
      <path d="M50 34 66 50 50 66 34 50z" fill="var(--night-800)" />
    </svg>
  );
}

// 카드 루트 전체가 버튼이다(뒷면·앞면 모두 누르면 onFlip). 뒤집을지 말지는 cardFace 가 정한다.
// 뒷면 마크업은 역할과 무관하게 같고, 앞면은 면이 처음 front 가 될 때 마운트한다(Pitfall 20, T-01-26):
// 뒷면 상태의 DOM·이미지 요청에 역할이 드러나지 않는다.
export function RoleCard({ role, face, allies, call = false, onFlip }: RoleCardProps) {
  const [mountedFront, setMountedFront] = useState(face === "front" && role !== null);
  if (!mountedFront && face === "front" && role !== null) setMountedFront(true);

  const showFront = face === "front" && role !== null;
  const classes = ["mf-card", showFront && "mf-card--front", call && "is-call"].filter(Boolean).join(" ");

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault(); // Space 의 스크롤 방지
      onFlip();
    }
  }

  return (
    <div
      className={classes}
      role="button"
      tabIndex={0}
      aria-label={showFront ? undefined : "역할 카드 뒤집기"}
      {...(call ? { "data-call": "" } : {})}
      onClick={onFlip}
      onKeyDown={onKeyDown}
    >
      <div className="mf-card__inner">
        <div className="mf-card__face mf-card__back">
          <Diamond />
        </div>
        {mountedFront && role !== null ? <CardFront role={role} allies={allies} hidden={!showFront} /> : null}
      </div>
    </div>
  );
}

function CardFront({ role, allies, hidden }: { role: RoleId; allies: string[] | null; hidden: boolean }) {
  const { src, srcSet } = roleArtSrc(role);
  const text = ROLE_TEXT[role];
  return (
    <div className="mf-card__face mf-card__front" aria-hidden={hidden ? "true" : undefined}>
      <img className="mf-card__art" src={src} srcSet={srcSet} width={150} alt="" draggable={false} />
      <p className="mf-t-display">{text.name}</p>
      <p className="mf-card__desc" data-role-line="">{text.desc}</p>
      {allies !== null ? (
        <>
          <div className="mf-card__divider" aria-hidden="true" />
          <p className="mf-card__mates">{alliesText(allies)}</p>
        </>
      ) : null}
    </div>
  );
}

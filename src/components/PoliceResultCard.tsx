import { useState } from "react";
import type { AnimalId } from "../../shared/game/animals";
import { faceSrc } from "../net/assets";
import { playerColor } from "../game/playerIdentity";
import { V2Icon } from "./v2/V2Icon";
import "../styles/night.css";

export interface PoliceResultCardProps {
  seat: number;
  animal?: AnimalId | undefined;
  /** 조사 대상 닉네임 */
  name: string;
  isMafia: boolean;
  /** 모션 줄이기면 등장 모션 클래스를 붙이지 않는다 */
  reducedMotion?: boolean;
}

// GameMap의 아침 조사 장면에서 경찰 본인에게만 표시되는 내용이다.
// 얼굴 그림이 안 뜨면 플레이어 구분색으로 대신한다.
const LABEL = { mafia: "마피아", clear: "마피아 아님" } as const;

export function PoliceResultCard({ seat, animal, name, isMafia, reducedMotion = false }: PoliceResultCardProps) {
  const [broken, setBroken] = useState(false);
  const cls = ["mf-police-card", isMafia && "is-mafia", !reducedMotion && "is-enter"].filter(Boolean).join(" ");
  return (
    <div className={cls} data-police-card="">
      {broken ? (
        <span className="mf-police-card__face mf-police-card__face--fallback" data-face-fallback="true">
          <i style={{ background: playerColor(seat, animal) }} />
        </span>
      ) : (
        <img className="mf-police-card__face" src={faceSrc(seat, animal)} alt="" draggable={false} onError={() => setBroken(true)} />
      )}
      <span className="mf-police-card__name">{name}</span>
      <span className="mf-police-card__label">
        <span className="mf-police-card__icon" data-icon={isMafia ? "roleMafia" : "check"}>
          <V2Icon name={isMafia ? "roleMafia" : "check"} size={20} />
        </span>
        {isMafia ? LABEL.mafia : LABEL.clear}
      </span>
    </div>
  );
}

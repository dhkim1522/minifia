import { useState } from "react";
import { faceSrc, seatColorVar } from "../net/assets";
import { V2Icon } from "./v2/V2Icon";
import "../styles/night.css";

export interface PoliceResultCardProps {
  seat: number;
  /** 조사 대상 닉네임. 얼굴 그림의 대체 글(alt)로만 쓴다 */
  name: string;
  isMafia: boolean;
  /** 모션 줄이기면 등장 모션 클래스를 붙이지 않는다 */
  reducedMotion?: boolean;
}

// 경찰 조사 결과 카드(09-20, NIGHT-09, UI-SPEC 245행): 밤이 끝난 아침 진입에 **그 경찰의 화면에서만** 가운데 위 170 에 0~2.4초 뜬다(부르는 쪽 useDayFx 의 policeResult 신호).
// 얼굴 140(faceSrc(대상)) 아래 16px 700 한 줄: 마피아면 roleMafia 아이콘 + '마피아', 아니면 check 아이콘 + '마피아 아님'.
// 결과 문구는 이 부품 안에서만 만든다 — 경찰 분기 밖에서는 이 부품이 그려지지 않으므로 다른 신분 화면의 DOM 에 문구가 없다(L8, T-09-40).
// 닉네임은 React 텍스트 노드·alt 로만 쓴다(innerHTML 없음). 얼굴 그림이 안 뜨면 자리 구분색 원으로 대신한다. 입력을 가로채지 않는다.
const LABEL = { mafia: "마피아", clear: "마피아 아님" } as const;

export function PoliceResultCard({ seat, name, isMafia, reducedMotion = false }: PoliceResultCardProps) {
  const [broken, setBroken] = useState(false);
  const cls = ["mf-police-card", isMafia && "is-mafia", !reducedMotion && "is-enter"].filter(Boolean).join(" ");
  return (
    <div className={cls} data-police-card="">
      {broken ? (
        <span className="mf-police-card__face mf-police-card__face--fallback" data-face-fallback="true">
          <i style={{ background: seatColorVar(seat) }} />
        </span>
      ) : (
        <img className="mf-police-card__face" src={faceSrc(seat)} alt={name} draggable={false} onError={() => setBroken(true)} />
      )}
      <span className="mf-police-card__label">
        <span className="mf-police-card__icon" data-icon={isMafia ? "roleMafia" : "check"}>
          <V2Icon name={isMafia ? "roleMafia" : "check"} size={20} />
        </span>
        {isMafia ? LABEL.mafia : LABEL.clear}
      </span>
    </div>
  );
}

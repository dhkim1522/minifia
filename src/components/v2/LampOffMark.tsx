import type { CSSProperties } from "react";
import "../../styles/v2.css";
import { V2Icon } from "./V2Icon";

// 21페이즈 아침 꺼진 등불 표식(P21-13, D-08): 지름 36 점선 회색 원 + flame 18. 누를 수 없고 눌림 통과 — 누가 껐는지는 어디에도 없다.
// 이 부품은 공개 값(day.lamps 에 없는 가로등 번호 n)만 받는다. 위치(style·transform)는 맵 투영을 아는 층(WorldStage)이 프레임마다 쓴다.

export interface LampOffMarkProps {
  /** 가로등 번호(= 집 좌석) */
  n: number;
  style?: CSSProperties;
  hidden?: boolean;
}

export function LampOffMark({ n, style, hidden }: LampOffMarkProps) {
  return (
    <span className="mv-lamp-off" data-lamp-off={n} role="img" aria-label="꺼진 등불" style={style} hidden={hidden}>
      <V2Icon name="flame" size={18} />
    </span>
  );
}

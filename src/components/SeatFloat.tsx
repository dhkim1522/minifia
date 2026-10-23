import type { CSSProperties, ReactElement } from "react";
import { Icon } from "./Icon";
import type { TableFloat } from "./Table";
import "../styles/seat.css";

// 자리 머리 위에 뜨는 말풍선·이모티콘 원·공개 연출 말풍선(UI-SPEC SeatFloat). 받은 값을 그리기만 하고 역할을 모른다.
// 위치·층은 Table 이 정한다. 여기서는 모양과 수명 애니메이션만 정한다.
// 수명(ms)은 CSS 변수 --mf-life 로 seat.css 의 키프레임 길이와 같다 — 값은 src/net/seatFloats.ts 의 BUBBLE_MS·EMOJI_MS 와 같다(R18: 지역 상수).
const BUBBLE_LIFE_MS = 3_000;
const EMOJI_LIFE_MS = 2_000;
const REVEAL_LIFE_MS = 2_000;

export interface SeatFloatProps {
  float: TableFloat;
}

/** 재접속으로 이미 지난 시간만큼 애니메이션을 앞당긴다(음수 delay). 축소 모션의 사라질 시각도 같은 변수로 맞춘다. */
function resumeStyle(life: number, elapsedMs: number | undefined): CSSProperties | undefined {
  const base = { "--mf-life": `${life}ms` } as CSSProperties;
  if (elapsedMs === undefined || elapsedMs <= 0) return base;
  return { ...base, "--mf-elapsed": `${elapsedMs}ms`, animationDelay: `-${elapsedMs}ms` } as CSSProperties;
}

export function SeatFloat({ float }: SeatFloatProps): ReactElement {
  if (float.kind === "emoji") {
    return (
      <div className="mf-react mf-react--life" style={resumeStyle(EMOJI_LIFE_MS, float.elapsedMs)}>
        <Icon name={float.icon} size={22} />
      </div>
    );
  }
  if (float.kind === "reveal") {
    const classes = ["mf-bubble", "mf-bubble--reveal"];
    if (float.animate) classes.push("mf-bubble--pop", "mf-bubble--shake");
    if (float.dim) classes.push("mf-bubble--dim");
    return (
      <div className={classes.join(" ")} style={{ "--mf-life": `${REVEAL_LIFE_MS}ms` } as CSSProperties}>
        {float.text}
      </div>
    );
  }
  return (
    <div className="mf-bubble mf-bubble--life" style={resumeStyle(BUBBLE_LIFE_MS, float.elapsedMs)}>
      {float.text}
    </div>
  );
}

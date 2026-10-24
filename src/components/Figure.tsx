import { figureSrc, ghostSrc } from "../net/assets";

export interface FigureProps {
  seat: number;
  disconnected?: boolean;
  /** 탈락한 사람: 인물 대신 유령 그림. 탈락 때문에 흐리게 하지 않는다 */
  ghost?: boolean;
  label?: string;
  className?: string;
}

// 세트 C 인물 그림(논리 크기 72×96). 상태를 받아 그리기만 한다.
// 끊김은 그림 파일의 상태가 아니라 CSS 흑백 + 60% 로 나타낸다(UI-SPEC).
// 유령 그림에도 끊김 흐림은 더해진다 — 흐림은 끊김 전용이다(결정 0021).
export function Figure({ seat, disconnected, ghost, label, className }: FigureProps) {
  const { src, srcSet } = ghost ? ghostSrc() : figureSrc(seat);
  const classes = ["mf-figure", ghost && "mf-figure--ghost", disconnected && "mf-figure--disconnected", className].filter(Boolean).join(" ");
  return (
    <img
      className={classes}
      src={src}
      srcSet={srcSet}
      width={72}
      height={96}
      draggable={false}
      alt={label ?? ""}
      aria-hidden={label ? undefined : "true"}
    />
  );
}

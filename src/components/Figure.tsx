import { figureSrc } from "../net/assets";

export interface FigureProps {
  seat: number;
  disconnected?: boolean;
  label?: string;
  className?: string;
}

// 세트 C 인물 그림(논리 크기 72×96). 상태를 받아 그리기만 한다.
// 끊김은 그림 파일의 상태가 아니라 CSS 흑백 + 60% 로 나타낸다(UI-SPEC).
export function Figure({ seat, disconnected, label, className }: FigureProps) {
  const { src, srcSet } = figureSrc(seat);
  const classes = ["mf-figure", disconnected && "mf-figure--disconnected", className].filter(Boolean).join(" ");
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

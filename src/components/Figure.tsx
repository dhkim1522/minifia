import type { RoleId } from "../../shared/protocol";
import { figureSrc, ghostSrc, roleArtSrc } from "../net/assets";

export interface FigureProps {
  seat: number;
  disconnected?: boolean;
  /** 탈락한 사람: 인물 대신 유령 그림. 탈락 때문에 흐리게 하지 않는다 */
  ghost?: boolean;
  /**
   * 직업 그림(72×96 상자). roleArt 는 탈락한 본인(관전자) 화면만 넘긴다 — 살아 있는 사람 화면에서는 이 prop 을 쓰는
   * 코드 경로가 없다(결정 0021). ghost 가 있으면 유령이 이긴다.
   */
  roleArt?: RoleId;
  label?: string;
  className?: string;
}

// 세트 C 인물 그림(논리 크기 72×96). 상태를 받아 그리기만 한다.
// 끊김은 그림 파일의 상태가 아니라 CSS 흑백 + 60% 로 나타낸다(UI-SPEC).
// 유령 그림에도 끊김 흐림은 더해진다 — 흐림은 끊김 전용이다(결정 0021).
export function Figure({ seat, disconnected, ghost, roleArt, label, className }: FigureProps) {
  const art = !ghost && roleArt !== undefined ? roleArt : undefined;
  const { src, srcSet } = ghost ? ghostSrc() : art !== undefined ? roleArtSrc(art) : figureSrc(seat);
  const classes = ["mf-figure", ghost && "mf-figure--ghost", art !== undefined && "mf-figure--role", disconnected && "mf-figure--disconnected", className].filter(Boolean).join(" ");
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

import type { RoleId } from "../../shared/protocol";
import type { AnimalId } from "../../shared/game/animals";
import { figureSrc, roleArtSrc } from "../net/assets";

export interface FigureProps {
  seat: number;
  animal?: AnimalId | undefined;
  disconnected?: boolean;
  /** 관전자에게 보이는 탈락한 사람은 원래 인물을 반투명하게 표시한다. */
  ghost?: boolean;
  /**
   * 직업 그림(72×96 상자). roleArt 는 탈락한 본인(관전자) 화면만 넘긴다 — 살아 있는 사람 화면에서는 이 prop 을 쓰는
   * 코드 경로가 없다(결정 0021). ghost 가 있으면 공개 캐릭터 그림을 쓴다.
   */
  roleArt?: RoleId;
  label?: string;
  className?: string;
}

// 세트 C 인물 그림(논리 크기 72×96). 상태를 받아 그리기만 한다.
// 끊김은 그림 파일의 상태가 아니라 CSS 흑백 + 60% 로 나타낸다(UI-SPEC).
export function Figure({ seat, animal, disconnected, ghost, roleArt, label, className }: FigureProps) {
  const art = !ghost && roleArt !== undefined ? roleArt : undefined;
  const { src, srcSet } = art !== undefined ? roleArtSrc(art, animal) : figureSrc(seat, animal);
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

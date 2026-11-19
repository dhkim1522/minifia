import { useState } from "react";
import type { AnimalId } from "../../shared/game/animals";
import { playerColor } from "../game/playerIdentity";
import { faceSrc } from "../net/assets";

interface PlayerPortraitProps {
  seat: number;
  animal?: AnimalId | undefined;
  className?: string;
  label?: string;
}

/** 채팅과 기록에서 닉네임과 함께 쓰는 공개 얼굴이다. */
export function PlayerPortrait({ seat, animal, className, label }: PlayerPortraitProps) {
  const src = faceSrc(seat, animal);
  const [failedSrc, setFailedSrc] = useState<string>();
  const classes = className ? `mf-player-portrait ${className}` : "mf-player-portrait";
  if (failedSrc === src) {
    return <span className={`${classes} is-fallback`} style={{ backgroundColor: playerColor(seat, animal) }} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true} />;
  }
  return <img className={classes} src={src} width={25} height={25} alt={label ?? ""} decoding="async" draggable={false} onError={() => setFailedSrc(src)} />;
}

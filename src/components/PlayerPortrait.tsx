import { useState } from "react";
import type { AnimalId } from "../../shared/game/animals";
import type { OutfitId } from "../../shared/protocol";
import { playerColor } from "../game/playerIdentity";
import { faceSrc, participantPortraitSrc } from "../net/assets";

interface PlayerPortraitProps {
  seat: number;
  animal?: AnimalId | undefined;
  className?: string;
  label?: string;
  variant?: "participant";
  look?: OutfitId | undefined;
}

/** 채팅과 기록에서 닉네임과 함께 쓰는 공개 얼굴이다. */
export function PlayerPortrait({ seat, animal, className, label, variant, look }: PlayerPortraitProps) {
  const face = faceSrc(seat, animal);
  const participant = variant === "participant" ? participantPortraitSrc(seat, animal, look) : face;
  const [failedSrc, setFailedSrc] = useState<string>();
  const [failedFace, setFailedFace] = useState<string>();
  const src = failedSrc === participant ? face : participant;
  const participantClass = src === face ? undefined : animal === undefined ? "is-participant" : "is-participant-bust";
  const classes = ["mf-player-portrait", participantClass, className].filter(Boolean).join(" ");
  if (failedFace === src) {
    return <span className={`${classes} is-fallback`} style={{ backgroundColor: playerColor(seat, animal) }} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true} />;
  }
  return <img className={classes} src={src} width={25} height={25} alt={label ?? ""} decoding="async" draggable={false} onError={() => {
    if (src === face) setFailedFace(src);
    else setFailedSrc(src);
  }} />;
}

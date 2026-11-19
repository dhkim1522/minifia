import "../../styles/v2.css";
import type { SoundView } from "../../audio/useSound";
import { V2Icon } from "./V2Icon";

export interface SoundButtonProps {
  sound: SoundView;
}

export function SoundButton({ sound }: SoundButtonProps) {
  const { state, engine } = sound;
  function press() {
    if (state === "on") {
      engine.setOn(false);
    } else if (state === "off") {
      // 클릭 안에서 동기로 깨우고 켠다(ui.toggle 켬 변형 + 침대 페이드인)
      engine.unlock();
      engine.setOn(true);
    } else {
      engine.unlock();
    }
  }

  const playing = state === "on";
  return (
    <button
      type="button"
      className="mv-sound"
      data-sound-button=""
      data-sound-state={state}
      data-side-button="sound"
      aria-label={playing ? "소리 끄기" : "소리 켜기"}
      aria-pressed={playing}
      onClick={press}
    >
      <V2Icon name={playing ? "sound" : "soundOff"} size={24} />
    </button>
  );
}

import { useEffect, useState } from "react";
import "../../styles/v2.css";
import type { SoundView } from "../../audio/useSound";
import { V2Icon } from "./V2Icon";

// 방 화면 오른쪽 위 소리 단추 (12-07, UI-SPEC B-1·B-2; 16-06 V-2·V-4): 상자가 곧 지름 52 원 면이고 오른쪽 열의 첫 칸이다(오른쪽 16, 자막 띠 아랫변 + 12).
// 상태 셋: on(sound) · off(soundOff, 흐리게) · locked(알약 '소리 켜기', 8초 뒤 아이콘 단추로 접힘).
// DOM 표식은 data-sound-button·data-sound-state=on|off|locked·data-side-button="sound"(E2E 열 판정) 뿐이다(역할·좌석 값 없음, 결정 0051: 새 글은 '소리 켜기' 한 곳).
// 아이콘 단추라 글 이름표는 없다(16페이즈 TOOL-04). 이름은 aria-label, 켬/끔은 아이콘·aria-pressed 가 알린다. 잠김 알약('소리 켜기')이 떠 있는 8초 동안은 알약 자체가 글자다.
// 켜 둔 사람에게만 알약이 뜬다 — 끈 사람(off)에게는 다시 권하지 않는다. 소리 실패는 알리지 않는다(알약이 곧 안내).

/** 알약이 아이콘 단추로 접히기까지(ms) */
export const PILL_FOLD_MS = 8000;
const TEXT_ON = "소리 끄기";
const TEXT_OFF = "소리 켜기";

export interface SoundButtonProps {
  sound: SoundView;
}

export function SoundButton({ sound }: SoundButtonProps) {
  const { state, engine } = sound;
  // locked 로 들어갈 때마다 8초를 새로 센다(state 가 바뀌면 효과가 다시 돈다)
  const [folded, setFolded] = useState(false);
  useEffect(() => {
    setFolded(false);
    if (state !== "locked") return;
    const timer = setTimeout(() => setFolded(true), PILL_FOLD_MS);
    return () => clearTimeout(timer);
  }, [state]);

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

  const pill = state === "locked" && !folded;
  const name = state === "on" ? TEXT_ON : TEXT_OFF;
  return (
    <button
      type="button"
      className={pill ? "mv-sound mv-sound--pill" : "mv-sound"}
      data-sound-button=""
      data-sound-state={state}
      data-side-button="sound"
      aria-label={name}
      aria-pressed={state === "on"}
      onClick={press}
    >
      <V2Icon name={state === "on" ? "sound" : "soundOff"} size={24} />
      {pill ? <span className="mv-sound__text">{TEXT_OFF}</span> : null}
    </button>
  );
}

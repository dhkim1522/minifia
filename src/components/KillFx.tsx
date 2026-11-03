import { useEffect, useRef, useState } from "react";
import "../styles/night.css";

export interface KillFxProps {
  /** 암살당한 본인 신호 번호(useDayFx killFx.nonce, 없으면 0). 번호가 바뀔 때만 한 번 재생한다 — 처음 마운트 때의 번호는 지난 일이다 */
  nonce: number;
  /** 모션 줄이기면 번쩍임·베기를 만들지 않는다 */
  reducedMotion: boolean;
}

/** 번쩍임·베기가 시작하는 때: 아침 view 를 받은 뒤 0.05초 (UI-SPEC 247~252행) */
export const KILL_FX_START_MS = 50;
/** 번쩍임이 끝나 요소를 치우는 때(번쩍임 900ms) */
export const KILL_FX_FLASH_MS = 900;

// 암살 이펙트(09-20, NIGHT-11, E4 #25·#27): 암살당한 본인 화면에서만 단 한 번, 화면 전체의 붉은 번쩍임(0 → 0.8@15% → 0, 900ms)과
// 흰 베기 선(-28°, scaleX 0 → 1, 700ms). 1초에 3번 이상 깜빡이지 않는다(번쩍임은 한 번, 반복 1). 모습은 CSS(.mf-killfx)가, 시각은 이 부품이 쥔다.
// 모두 장식이라 보조기기에는 숨기고 입력을 가로채지 않는다.
export function KillFx({ nonce, reducedMotion }: KillFxProps) {
  const seen = useRef(nonce);
  const [on, setOn] = useState(false);
  const timers = useRef<Array<ReturnType<typeof setTimeout>>>([]);

  useEffect(() => {
    if (nonce === seen.current) return;
    seen.current = nonce;
    if (reducedMotion) return;
    for (const id of timers.current) clearTimeout(id);
    timers.current = [
      setTimeout(() => {
        setOn(true);
        timers.current.push(setTimeout(() => setOn(false), KILL_FX_FLASH_MS));
      }, KILL_FX_START_MS),
    ];
  }, [nonce, reducedMotion]);

  // 언마운트 때만 타이머를 푼다(번호가 바뀐 효과의 정리가 진행 중인 연출을 끊지 않게)
  useEffect(
    () => () => {
      for (const id of timers.current) clearTimeout(id);
    },
    [],
  );

  if (!on) return null;
  return (
    <div className="mf-killfx" data-kill-fx="true" aria-hidden="true">
      <div className="mf-killfx__flash" />
      <div className="mf-killfx__slash" />
    </div>
  );
}

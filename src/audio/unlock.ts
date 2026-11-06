// 12-07: 앱 전체가 쓰는 소리 엔진 하나와 참가 버튼용 동기 잠금 해제 (D-2, D-7, B-3).
// 컨텍스트는 사용자 제스처 안에서만 깨어난다: 참가 처리기가 맨 앞(await 보다 먼저)에서 unlockAudio() 를 부른다.
// 저장값이 꺼짐이면 컨텍스트를 만들지 않는다(끈 사람에게 소리를 다시 권하지 않는다).
import { createEngine, type SoundEngine } from "./engine";

let shared: SoundEngine | null = null;
let override: SoundEngine | null = null;

/** 처음 필요할 때 만들어지는 엔진 싱글턴. 시험은 setEngineForTest 로 바꿔 끼울 수 있다 */
export function getEngine(): SoundEngine {
  if (override !== null) return override;
  if (shared === null) shared = createEngine();
  return shared;
}

/** 시험 전용: 엔진을 바꿔 끼운다. null 이면 원래 싱글턴으로 돌아간다 */
export function setEngineForTest(engine: SoundEngine | null): void {
  override = engine;
}

/** 사용자 제스처 처리기 맨 앞에서 동기로 부른다. 켜짐(또는 저장값 없음)일 때만 엔진을 깨운다 */
export function unlockAudio(): void {
  try {
    const engine = getEngine();
    if (!engine.isOn()) return;
    engine.unlock();
  } catch {
    // 소리 준비 실패가 참가를 막지 않는다.
  }
}

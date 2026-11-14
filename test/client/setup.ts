// 화면 시험의 원인 흐름 잠금(21페이즈 D-01): 화면 시험도 옛 확장판 순서(낮 시작 발표 → 심부름 → 토론)로 시작한다 —
// 제품의 CAUSE_MODES 는 ["extended"] 라 확장판 view 의 제목·흐름이 새 순서를 따르지만, 이 폴더의 옛 시험은 옛 순서를 전제한다.
// 새 흐름 시험은 test/helpers/playable.ts 의 openCause() 로 그 시험 동안만 켠다. 잠금을 걷는 일은 21-14 가 한다.
import { lockCause } from "../helpers/playable";

lockCause();

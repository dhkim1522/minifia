// 단위 시험의 판 종류 고정 맵 잠금(20-01, 11-13 의 PLAYABLE_MAPS 잠금과 같은 이유). 제품의 MODE_MAPS 는 { extended: "town" } 이라 확장판 판이 늘 마을에서 시작하지만,
// 이 폴더의 시험 대부분은 확장판(기본값) 판을 재즈 바·광장 좌표로 돌린다. 시험 파일마다 방장 선택대로 맵이 나오게 extended 칸을 지우고,
// 마을이 필요한 시험은 test/helpers/playable.ts 의 openTown() 으로 그 시험 동안만 켠다.
import { lockCause, lockModeMaps } from "../helpers/playable";

lockModeMaps();
// 원인 흐름(21페이즈 D-01)도 같은 이유로 잠근다: 제품의 CAUSE_MODES 는 ["extended"] 라 확장판 판이 저녁 → 밤 → 아침 → 토론으로 돌지만, 이 폴더의 옛 시험은 낮 시작 발표 → 심부름 → 토론 순서를 전제한다.
// 새 흐름 시험은 openCause() 로 그 시험 동안만 켠다. 잠금을 걷는 일은 21-13 이 한다.
lockCause();

// 워커 통합 시험의 기본 맵 잠금(11-13). 제품의 PLAYABLE_MAPS 는 ["bar", "plaza"] 라 random 이 판마다 광장을 뽑을 수 있지만,
// 이 폴더의 시험 대부분은 재즈 바 좌표·입장 지점을 전제로 한 판을 돌린다. 시험 파일마다 같은 맵이 나오게 허용 맵을 bar 하나로 잠그고,
// 광장이 필요한 시험은 test/helpers/playable.ts 의 openPlaza() 로 그 시험 동안만 연다.
// 판 종류의 고정 맵도 같은 이유로 잠근다(20-01): 확장판(기본값) 판이 마을이 아니라 재즈 바에서 시작하게 MODE_MAPS 의 extended 칸을 지우고, 마을 시험은 openTown() 으로 연다.
import type { MapId } from "../../shared/protocol";
import { PLAYABLE_MAPS } from "../../shared/game/maps";
import { lockModeMaps } from "../helpers/playable";

(PLAYABLE_MAPS as MapId[]).splice(0, PLAYABLE_MAPS.length, "bar");
lockModeMaps();

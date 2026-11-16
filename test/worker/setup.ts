// 워커 통합 시험의 기본 맵 잠금(11-13). 제품의 PLAYABLE_MAPS 는 ["bar", "plaza"] 라 random 이 판마다 광장을 뽑을 수 있지만,
// 이 폴더의 시험 대부분은 재즈 바 좌표·입장 지점을 전제로 한 판을 돌린다. 시험 파일마다 같은 맵이 나오게 허용 맵을 bar 하나로 잠그고,
// 광장이 필요한 시험은 test/helpers/playable.ts 의 openPlaza() 로 그 시험 동안만 연다.
import type { MapId } from "../../shared/protocol";
import { PLAYABLE_MAPS } from "../../shared/game/maps";

(PLAYABLE_MAPS as MapId[]).splice(0, PLAYABLE_MAPS.length, "bar");

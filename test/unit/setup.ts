// 단위 시험 공통 준비 파일. 판 종류의 고정 맵 잠금은 마을 맵과 함께 없어졌다(22페이즈) — 지금은 할 일이 없다.
// 시험 파일마다 맵 선택이 필요하면 test/helpers/playable.ts 의 openPlaza·onlyBar 를 쓴다.
import { KEYWORD_SWITCH } from "../../shared/game/keywords";

// 첫날 키워드(23-01, D-29 "옛 시험 보호"): 기존 시험은 옛 흐름(roleReveal → dayAnnounce)·옛 난수 호출 수를 전제로 하므로 스위치를 끈다.
// 키워드 흐름을 시험하는 파일만 test/helpers/keyword.ts 의 openKeyword() 로 그 시험 동안만 켠다.
KEYWORD_SWITCH.on = false;

import { applyD1Migrations, env } from "cloudflare:test";
import { KEYWORD_SWITCH } from "../../shared/game/keywords";
import { PHASE_INTRO_SWITCH } from "../../shared/game/phases";

// 첫날 키워드(23-01, D-29 "옛 시험 보호"): 워커 시험 대부분이 {t:"start"} 를 보내 역할 확인 → 낮 시작 옛 흐름을 돈다. 스위치를 끄고,
// 키워드 흐름을 시험하는 파일만 test/helpers/keyword.ts 의 openKeyword() 로 그 시험 동안만 켠다.
KEYWORD_SWITCH.on = false;
PHASE_INTRO_SWITCH.on = false;

// 판 기록 D1(23-02, D-18): 실제 migrations/*.sql 을 시험마다 메모리 D1 에 적용한다(vitest.config.ts 가 TEST_MIGRATIONS 로 넘김).
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);

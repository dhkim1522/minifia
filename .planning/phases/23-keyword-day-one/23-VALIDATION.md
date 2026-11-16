---
phase: "23"
slug: "keyword-day-one"
status: planned
nyquist_compliant: true
wave_0_complete: false
planned: "2026-11-17"
created: "2026-11-16"
---

# Phase 23 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. 상세 매핑은 `23-RESEARCH.md` "## Validation Architecture" 가 원천이다.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.12 (unit·client·worker 프로젝트) + 로컬 E2E(`scripts/e2e`) |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run <바뀐 시험 파일들> && npm run typecheck` |
| **Full suite command** | `npm test && npm run typecheck` |
| **Estimated runtime** | ~300 seconds (전체), 빠른 실행 ~30 seconds |

---

## Sampling Rate

- **After every task commit:** 바뀐 영역의 `npx vitest run <파일들>` + `npm run typecheck`
- **After every plan wave:** `npx vitest run --project unit` / `worker` / `client` 중 닿은 것 + `npm run typecheck`
- **Before `/gsd-verify-work`:** `npm test` 전체 초록 + typecheck + 23-RESEARCH 의 바뀐 E2E 흐름(`basic-off`·`noexec`·`politics-pin`·`politics-verdict`·`vote-count`·`will-flow`·`ghost`·`sound-script`·`emcee-leak`·`result`)
- **Max feedback latency:** 60 seconds (빠른 실행 기준)

---

## Per-Task Verification Map

계획 13개·작업 35개(2026-11-17 계획). 요구사항 열은 ROADMAP 23 성공 기준 SC1~SC8 이다(요구사항 ID 없음). 모든 작업에 `<automated>` 가 있고, 새 시험 파일은 각 계획의 RED 단계(tdd)가 만든다 — 별도 Wave 0 계획은 없다. worker 시험의 부하 간헐(bots·basicDay·waitHelpers·lampLeak)은 실패 파일만 단독 재실행한다.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 23-01-T1 | 23-01 | 1 | SC1·SC7 | T-23-01·T-23-03 | 마피아 view 에 me.keyword 키 없음, 카드 표식에 값 없음 | unit·worker·client(tracer) | `npx vitest run test/unit/keywordFlow.test.ts test/worker/keyword.test.ts test/client/keywordScreen.test.tsx test/unit/timeOfDay.test.ts test/unit/emotePhases.test.ts test/client/phaseScreens.test.tsx && npm run typecheck` | ❌ RED 에서 생성 | ⬜ pending |
| 23-01-T2 | 23-01 | 1 | SC1·SC7 | T-23-02 | 번들에 키워드 목록 없음, 옛 시험 스위치로 보호 | unit·client·worker·node·build | `npx vitest run --project unit --project client && node --test scripts/*.test.mjs scripts/e2e/*.test.mjs && npm run typecheck && npx vitest run --project worker && npm run build && ls dist/client/assets/*.js >/dev/null && ! grep -l "Harry Potter" dist/client/assets/*.js` | ✅ 확장 | ⬜ pending |
| 23-02-T1 | 23-02 | 2 | SC6 | T-23-05·T-23-08 | database_id 없음(D-19), 열에 개인정보 없음 | worker | `npx vitest run test/worker/d1.test.ts test/worker/start.test.ts && npm run typecheck` | ❌ RED 에서 생성 | ⬜ pending |
| 23-02-T2 | 23-02 | 2 | SC6 | T-23-06·T-23-07 | 인자 허용 목록·고정 SQL·원격 전 계정 확인 | node:test | `node --test scripts/games.test.mjs` | ❌ RED 에서 생성 | ⬜ pending |
| 23-02-T3 | 23-02 | 2 | SC6 | T-23-05 | id 없는 D1 이면 배포 중단 | node:test | `node --test scripts/deploy-target.test.mjs scripts/check-account.test.mjs` | ✅ 확장 | ⬜ pending |
| 23-03-T1 | 23-03 | 1 | SC2 | T-23-09·T-23-10 | 우회 표기 전부 차단, 철자 틀린 우회 통과 | unit(TDD) | `npx vitest run test/unit/keywordGuard.test.ts` | ❌ RED 에서 생성 | ⬜ pending |
| 23-03-T2 | 23-03 | 1 | SC7 | T-23-11 | src 가 서버 키워드 모듈을 import 하지 않음 | unit | `npx vitest run test/unit/keywordStaticGuard.test.ts test/unit/keywordGuard.test.ts && npm run typecheck` | ❌ RED 에서 생성 | ⬜ pending |
| 23-04-T1 | 23-04 | 2 | SC5·SC2 | T-23-12·T-23-14 | 역할 단어 없음·정규화 충돌 없음·자기 검사 | unit(TDD) | `npx vitest run test/unit/keywords.test.ts test/unit/keywordGuard.test.ts test/unit/keywordFlow.test.ts` | ❌ RED 에서 생성 | ⬜ pending |
| 23-04-T2 | 23-04 | 2 | SC5 | T-23-13 | 7장르 × 30↑, 2~12자소 | unit(TDD) | `npx vitest run test/unit/keywords.test.ts test/unit/keywordGuard.test.ts test/unit/keywordFlow.test.ts && npm run typecheck` | ✅ 확장 | ⬜ pending |
| 23-05-T1 | 23-05 | 2 | SC4 | T-23-16 | keyword 없는 옛 방은 옛 흐름 | unit·client | `npx vitest run test/unit/keywordFlow.test.ts test/unit/execution.test.ts test/unit/presence.test.ts test/unit/timeOfDay.test.ts test/unit/emotePhases.test.ts test/client/phaseScreens.test.tsx test/unit/verdictRule.test.ts test/unit/nomination.test.ts test/unit/endgame.test.ts && npm run typecheck` | ✅ 확장 | ⬜ pending |
| 23-05-T2 | 23-05 | 2 | SC4·SC7 | T-23-15 | 정답은 answerReveal 진입 전 어떤 view 에도 없음 | unit·worker | `npx vitest run test/unit/keywordFlow.test.ts test/worker/keyword.test.ts test/unit/movement.test.ts test/unit/audience.test.ts && npm run typecheck` | ✅ 확장 | ⬜ pending |
| 23-05-T3 | 23-05 | 2 | SC4 | T-23-17 | 사본 전이 표 = 서버 | unit·client·worker·node | `npx vitest run --project unit --project client && node --test scripts/*.test.mjs scripts/e2e/*.test.mjs && npm run typecheck && npx vitest run --project worker` | ✅ 확장 | ⬜ pending |
| 23-06-T1 | 23-06 | 3 | SC2·SC3 | T-23-23 | 단계·생존·봇 검사, 첫 확정 불변 | unit(TDD) | `npx vitest run test/unit/keywordAnswer.test.ts test/unit/keywordFlow.test.ts test/unit/rematch.test.ts && npm run typecheck` | ❌ RED 에서 생성 | ⬜ pending |
| 23-06-T2 | 23-06 | 3 | SC2·SC3 | T-23-18·T-23-19·T-23-21·T-23-22 | 거절 두 프레임 같음, 본인에게만 전송, 400ms 키 둘 | unit·worker | `npx vitest run test/unit/schemas.test.ts test/unit/view.test.ts test/unit/e2eContract.test.ts test/worker/keyword.test.ts test/worker/chat.test.ts && npm run typecheck` | ✅ 확장 | ⬜ pending |
| 23-06-T3 | 23-06 | 3 | SC7 | T-23-20 | 마피아 프레임·preview 에 정답 없음, 열 동일(메타모픽) | worker·unit·node | `npx vitest run test/worker/keywordLeak.test.ts test/worker/leak.test.ts test/unit/view.test.ts && node --test scripts/smoke.test.mjs && npm run typecheck` | ❌ RED 에서 생성 | ⬜ pending |
| 23-07-T1 | 23-07 | 3 | SC4 | T-23-25·T-23-26 | 정답 큰 글은 view 값만, 텍스트 노드 | unit·client | `npx vitest run test/unit/dayView.test.ts test/client/answerReveal.test.tsx test/client/gameMap.test.tsx test/client/killFx.test.tsx && npm run typecheck` | ❌ RED 에서 생성 | ⬜ pending |
| 23-07-T2 | 23-07 | 3 | SC4 | T-23-27 | 역할 무관 화면, 채팅 잠금 | unit·client | `npx vitest run test/unit/hostLine.test.ts test/client/answerReveal.test.tsx test/client/willFlow.test.tsx test/client/ghostView.test.tsx && npm run typecheck` | ✅ 확장 | ⬜ pending |
| 23-08-T1 | 23-08 | 4 | SC8 | T-23-29·T-23-30 | 연장 상한 원래 마감, 봇 계획 키 유지 | unit(TDD) | `npx vitest run test/unit/early.test.ts test/unit/bots.test.ts && npm run typecheck` | ❌ RED 에서 생성 | ⬜ pending |
| 23-08-T2 | 23-08 | 4 | SC8 | T-23-28 | 줄일 때만 전원 같은 값 방송 | worker | `npx vitest run test/worker/earlyAdvance.test.ts test/worker/trial.test.ts test/worker/night.test.ts test/worker/keyword.test.ts test/unit/verdictRule.test.ts && npm run typecheck` | ❌ RED 에서 생성 | ⬜ pending |
| 23-08-T3 | 23-08 | 4 | SC8 | T-23-28·T-23-31 | 역할만 다른 두 판 밤 종료 열 동일, earlyFrom 서버 전용 | worker·unit·node | `npx vitest run test/worker/nightLeak.test.ts test/worker/leak.test.ts test/unit/view.test.ts && node --test scripts/smoke.test.mjs && npm run typecheck` | ✅ 확장 | ⬜ pending |
| 23-09-T1 | 23-09 | 4 | SC1·SC3 | T-23-34 | 입력은 서버가 다시 검사(표시 규칙만) | client | `npx vitest run test/client/useKeywordAnswer.test.tsx && npm run typecheck` | ❌ RED 에서 생성 | ⬜ pending |
| 23-09-T2 | 23-09 | 4 | SC1 | T-23-32·T-23-33·T-23-35 | 거절 문구 역할 무관, DOM 표식 값 없음 | client·unit | `npx vitest run test/client/keywordScreen.test.tsx test/client/useKeywordAnswer.test.tsx test/client/phaseScreens.test.tsx test/unit/keywordStaticGuard.test.ts && npm run typecheck` | ✅ 확장 | ⬜ pending |
| 23-09-T3 | 23-09 | 4 | SC1 | T-23-32 | 띠 문구 역할 무관 | unit·client | `npx vitest run test/unit/hostLine.test.ts test/client/keywordScreen.test.tsx test/client/hostBand.test.tsx && npm run typecheck` | ✅ 확장 | ⬜ pending |
| 23-10-T1 | 23-10 | 5 | SC6 | T-23-36 | 행에 닉네임·채팅·답 글 없음 | unit(TDD) | `npx vitest run test/unit/gameLog.test.ts test/unit/gameRoom.test.ts test/unit/rematch.test.ts && npm run typecheck` | ❌ RED 에서 생성 | ⬜ pending |
| 23-10-T2 | 23-10 | 5 | SC6 | T-23-37·T-23-38·T-23-39 | 바인딩 SQL, 실패 격리, 고정 로그 | worker | `npx vitest run test/worker/gameLog.test.ts test/worker/d1.test.ts test/worker/resultLog.test.ts test/worker/rematch.test.ts && npm run typecheck` | ❌ RED 에서 생성 | ⬜ pending |
| 23-10-T3 | 23-10 | 5 | SC6 | T-23-36 | gameId·startedAt 서버 전용 | worker·unit·node | `npx vitest run test/worker/leak.test.ts test/unit/view.test.ts && node --test scripts/smoke.test.mjs && npm run typecheck` | ✅ 확장 | ⬜ pending |
| 23-11-T1 | 23-11 | 5 | SC3·SC4 | T-23-40·T-23-41 | 정답 줄은 값 있을 때만, 텍스트 노드 | client | `npx vitest run test/client/roleCardSheet.test.tsx test/client/roleCardFlow.test.tsx && npm run typecheck` | ✅ 확장 | ⬜ pending |
| 23-11-T2 | 23-11 | 5 | SC4 | T-23-40 | 결과 정답 줄은 view 값만 | client·unit | `npx vitest run test/client/roomScreen.test.tsx test/unit/hostLine.test.ts test/client/hostBand.test.tsx test/client/resultScreen.test.tsx && npm run typecheck` | ✅ 확장 | ⬜ pending |
| 23-11-T3 | 23-11 | 5 | SC8 | T-23-42 | data-early 는 공개 phaseEndsAt 에서만 | unit·client | `npx vitest run test/unit/earlyCalm.test.ts test/client/hostBand.test.tsx test/unit/soundDirector.test.ts test/client/gameMap.test.tsx test/unit/countdown.test.ts && npm run typecheck` | ❌ RED 에서 생성 | ⬜ pending |
| 23-12-T1 | 23-12 | 6 | SC1·SC2·SC3·SC4·SC7·SC8 | T-23-43 | 판정 문턱 순수 함수·사본 대조 | node:test·unit | `node --test scripts/e2e/keyword.test.mjs scripts/e2e/*.test.mjs && npx vitest run test/unit/e2eContract.test.ts` | ❌ RED 에서 생성 | ⬜ pending |
| 23-12-T2 | 23-12 | 6 | SC1·SC2·SC3·SC4·SC7·SC8 | T-23-43·T-23-44 | 마피아 DOM·속성에 정답 없음(실제 브라우저), 로컬만 | e2e | `node --test scripts/e2e/keyword.test.mjs && npm run e2e -- --url http://localhost:5173 --only keyword,keyword-sizes,early` | ❌ 이 작업에서 생성 | ⬜ pending |
| 23-12-T3 | 23-12 | 6 | SC4·SC7 | T-23-44·T-23-45 | 기존 흐름 기대 수정 근거 기록 | unit·node·uat | `npx vitest run test/unit/e2eContract.test.ts && node --test scripts/*.test.mjs scripts/e2e/*.test.mjs && node scripts/uat-test-room.mjs http://localhost:5173` | ✅ 확장 | ⬜ pending |
| 23-13-T1 | 23-13 | 7 | SC1~SC8(D-21) | T-23-46·T-23-47 | 위생 금지어 없음 | docs grep | `test -f docs/decisions/0091-v3-keyword-day-one.md && grep -c "0091" docs/decisions/0090-v3-single-flow-day-vote-will.md && grep -cE "^- \*\*0091-[0-9]+" docs/decisions/0091-v3-keyword-day-one.md` | ❌ 이 작업에서 생성 | ⬜ pending |
| 23-13-T2 | 23-13 | 7 | SC1~SC8(D-21) | T-23-46 | 위생 금지어 없음 | docs grep | `grep -c "키워드" docs/product.md && grep -c "games" docs/architecture.md && grep -cE "keyword-sizes\|data-answer-state" docs/screen-map.md` | ✅ 확장 | ⬜ pending |
| 23-13-T3 | 23-13 | 7 | SC1~SC8 | T-23-02·T-23-46 | 번들 가드·전체 회귀·HANDOFF ≤ 6KB | 전체 | `npx vitest run test/unit/handoff.test.ts && npm test && npm run typecheck && node --test scripts/*.test.mjs scripts/e2e/*.test.mjs && npm run build && ls dist/client/assets/*.js >/dev/null && ! grep -l "Harry Potter" dist/client/assets/*.js` | ✅ 확장 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

별도 Wave 0 계획 없이 각 계획의 RED 단계가 먼저 만든다(만드는 계획을 적었다).

- [ ] `keywords`·`keywordGuard` 단위 시험(한 글자 키워드 없음, 12자소 상한, 우회 표기 표) — 23-03(guard)·23-04(목록)
- [ ] D1 마이그레이션 적용 setup(`readD1Migrations`/`applyD1Migrations`)과 `recordGame` 시험 — 23-02(setup·d1.test)·23-10(gameLog 시험)
- [ ] 키워드 누설 시험(마피아 소켓 모든 프레임·http preview 에 정답 부재, 역할만 다른 두 판의 `day.keyword` 열 동일) — 23-06 Task 3
- [ ] 조기 진행 시험(키워드·찬반·밤, 봇 제외, 번복 연장은 찬반만) 과 nightLeak 형 종료 시각 시험 — 23-08
- [ ] 새 E2E 흐름(키워드 카드·입력·공개·정답 공개·조기 진행) — 23-12
- [ ] 시험 키워드 스위치(`KEYWORD_SWITCH`·`openKeyword`)와 첫날 흐름 시험(`keywordFlow`·worker `keyword`·client `keywordScreen`) — 23-01 트레이서

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 키워드 카드·공개 목록이 실기기에서 읽기 쉬운지, 키보드가 열린 664 이하 폰 | SC1 | 눈 확인 | v3.0 실테스트 때 폰으로 첫날 한 판 |
| 자동 열린 "첫날 답" 시트가 토론 입력을 가리는 정도 | SC4 | 눈 확인 | 실테스트 때 확인(UI-SPEC unresolved) |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (35/35)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (RED 단계가 만드는 파일을 표 "File Exists" 열에 표시)
- [x] No watch-mode flags (모두 `vitest run`·`node --test`)
- [ ] Feedback latency < 60s — 작업별 빠른 명령은 60초 안, 단 전체 회귀가 든 작업(23-01-T2·23-05-T3·23-13-T3)과 E2E(23-12-T2·T3)는 길다(페이즈 게이트 성격)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** planned (2026-11-17) — 실행 중 상태 열을 갱신한다

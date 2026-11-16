---
phase: "22"
slug: "cleanup-single-mode"
status: planned
nyquist_compliant: true
wave_0_complete: false
created: "2026-11-16"
---

# Phase 22 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. 상세 매핑은 `22-RESEARCH.md` "## Validation Architecture" 가 원천이다.

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
- **Before `/gsd-verify-work`:** `npm test` 전체 초록 + typecheck + 22-RESEARCH 의 바뀐 E2E 흐름(`basic-off`·`noexec`·`politics-pin`·`politics-verdict`·`vote-count`·`will-flow`·`ghost`·`sound-script`·`emcee-leak`·`result`)
- **Max feedback latency:** 60 seconds (빠른 실행 기준)

---

## Per-Task Verification Map

계획자가 PLAN 작성 후 채운다. 성공 기준(SC1~SC6) → 시험 매핑은 `22-RESEARCH.md` "Phase Requirements → Test Map" 표를 따른다.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 22-01-T1 | 01 | 1 | SC5 | T-22-01 | 어느 프레임에도 awards 없음 | unit+worker+client | `npx vitest run test/unit/endgame.test.ts test/unit/view.test.ts test/worker/leak.test.ts test/worker/bench.test.ts test/client/resultScreen.test.tsx && npm run typecheck` | ✅(수정) | ⬜ |
| 22-01-T2 | 01 | 1 | SC5 | — | — | unit+script | `npx vitest run test/unit/soundScript.test.ts test/unit/soundLab.test.ts test/unit/soundRecipes.test.ts test/unit/soundResult.test.ts test/unit/soundEngine.test.ts test/unit/soundDirector.test.ts && node --test scripts/e2e/lib.test.mjs && npm run typecheck` | ✅(수정) | ⬜ |
| 22-02-T1 | 02 | 1 | SC5 | — | — | unit | `npx vitest run test/unit/character.test.ts test/client/ghostView.test.tsx && npm run typecheck` | ✅(수정) | ⬜ |
| 22-02-T2 | 02 | 1 | SC5 | T-22-02 | 훅은 e2e 문맥만, 역할·의상 없음 | client+script+e2e | `npx vitest run test/client/worldStage.test.tsx test/client/ghostView.test.tsx && node --test scripts/e2e/*.test.mjs && npm run typecheck` (+ `--only ghost`) | ✅(수정) | ⬜ |
| 22-03-T1 | 03 | 2 | SC2 | T-22-03·04·05 | 옛 tutorial 방만 대기실, 새 방 재기동 안전 | unit+worker | `npx vitest run test/unit/legacyRoom.test.ts test/unit/gameRoom.test.ts test/unit/tick.test.ts test/unit/view.test.ts test/unit/audience.test.ts test/worker/leak.test.ts && npx tsc -p tsconfig.worker.json --noEmit` | ❌ Wave 0(legacyRoom.test 새로) | ⬜ |
| 22-03-T2 | 03 | 2 | SC2 | — | 진입점 DOM 0건 | client+unit | `npx vitest run --project client && npx vitest run test/unit/session.test.ts test/unit/soundRecipes.test.ts test/unit/soundLab.test.ts test/unit/soundDirector.test.ts test/unit/hostLine.test.ts test/unit/scenes.test.ts test/unit/e2eContract.test.ts && npm run typecheck` | ✅(수정) | ⬜ |
| 22-03-T3 | 03 | 2 | SC2 | — | — | script+unit | `node --test scripts/*.test.mjs scripts/e2e/*.test.mjs && npx vitest run --project unit && npm run typecheck` | ✅ | ⬜ |
| 22-04-T1 | 04 | 3 | SC2 | T-22-06 | 등불·현장 키 옛 방 대기실 | unit+worker | `npx vitest run test/unit/legacyRoom.test.ts test/unit/ruleset.test.ts test/unit/phases.test.ts test/unit/tick.test.ts test/worker/morningCards.test.ts && npx tsc -p tsconfig.worker.json --noEmit` | ✅(수정) | ⬜ |
| 22-04-T2 | 04 | 3 | SC2 | — | — | unit | `npm run typecheck && npx vitest run test/unit/hostLine.test.ts test/unit/dayView.test.ts test/unit/scenes.test.ts test/unit/timeOfDay.test.ts` | ✅(수정) | ⬜ |
| 22-04-T3 | 04 | 3 | SC2 | T-22-07 | 누설 허용 목록 축소 | 전체 | `npx vitest run && node --test scripts/*.test.mjs scripts/e2e/*.test.mjs && npm run typecheck` | ✅ | ⬜ |
| 22-05-T1 | 05 | 4 | SC2 | T-22-08 | town 방이 맵 조회 전 정규화 | unit+worker | `npx vitest run test/unit/legacyRoom.test.ts test/unit/maps.test.ts test/unit/map.test.ts test/worker/mapPick.test.ts && npx tsc -p tsconfig.worker.json --noEmit` | ✅(수정) | ⬜ |
| 22-05-T2 | 05 | 4 | SC2 | — | — | unit | `npm run typecheck && npx vitest run test/unit/camera.test.ts test/unit/cameraThree.test.ts test/unit/plazaScene.test.ts test/unit/barScene.test.ts` | ✅(수정) | ⬜ |
| 22-05-T3 | 05 | 4 | SC2 | T-22-09 | 유령 위치 비공개 유지 | 전체 | `npx vitest run && node --test scripts/*.test.mjs scripts/e2e/*.test.mjs && npm run typecheck` | ✅ | ⬜ |
| 22-06-T1 | 06 | 5 | SC2 | T-22-10 | errand 옛 방 대기실 | unit | `npx vitest run test/unit/legacyRoom.test.ts test/unit/ruleset.test.ts test/unit/phases.test.ts test/unit/tick.test.ts test/unit/movement.test.ts test/unit/audience.test.ts && npx tsc -p tsconfig.worker.json --noEmit` | ✅(수정) | ⬜ |
| 22-06-T2 | 06 | 5 | SC2 | — | — | unit | `npm run typecheck && npx vitest run test/unit/hostLine.test.ts test/unit/dayView.test.ts test/unit/scenes.test.ts test/unit/soundRecipes.test.ts` | ✅(수정) | ⬜ |
| 22-06-T3 | 06 | 5 | SC2 | T-22-11 | me.record·day.evidence 허용 경로 삭제 | 전체 | `npx vitest run && node --test scripts/*.test.mjs scripts/e2e/*.test.mjs && npm run typecheck` | ✅ | ⬜ |
| 22-07-T1 | 07 | 6 | SC1 | T-22-12·13 | modePick 거절, mode 옛 방 대기실 | unit | `npx vitest run test/unit/ruleset.test.ts test/unit/legacyRoom.test.ts test/unit/gameRoom.test.ts test/unit/tick.test.ts test/unit/view.test.ts && npx tsc -p tsconfig.worker.json --noEmit` | ✅(수정) | ⬜ |
| 22-07-T2 | 07 | 6 | SC1 | — | 방장 줄 [판 종류] 0건 | client | `npm run typecheck && npx vitest run test/client/hostRail.test.tsx test/client/lobby.test.tsx test/client/resultScreen.test.tsx test/client/mapChip.test.tsx` | ✅(수정) | ⬜ |
| 22-07-T3 | 07 | 6 | SC1 | — | — | 전체 | `npx vitest run && node --test scripts/*.test.mjs scripts/e2e/*.test.mjs && npm run typecheck` | ✅ | ⬜ |
| 22-08-T1 | 08 | 7 | SC1 | T-22-14 | 시험이 제품 규칙을 바꾸는 길 없음 | 전체 | `npx vitest run && npm run typecheck` | ✅ | ⬜ |
| 22-08-T2 | 08 | 7 | SC1 | — | — | script | `node --test scripts/*.test.mjs scripts/e2e/*.test.mjs && npm run typecheck` | ✅ | ⬜ |
| 22-09-T1 | 09 | 8 | SC3 | T-22-15·16 | 집계 수만 전원 방송, day.voted·개인 표 없음 | unit+worker | `npx vitest run test/unit/verdict.test.ts test/unit/phases.test.ts test/worker/basicDay.test.ts test/worker/leak.test.ts && npx tsc -p tsconfig.worker.json --noEmit` | ✅(수정) · verdictCount 단언 ❌ Wave 0 | ⬜ |
| 22-09-T2 | 09 | 8 | SC3 | T-22-17·18 | 차례 밖 지목 거절, 통과 보존 | unit+worker | `npx vitest run test/unit/nomination.test.ts test/unit/gather.test.ts test/unit/ruleset.test.ts test/unit/execution.test.ts test/worker/pickTurn.test.ts && npx tsc -p tsconfig.worker.json --noEmit` | ✅(수정, pickTurn.test skipIf 해제) | ⬜ |
| 22-09-T3 | 09 | 8 | SC3 | T-22-15 | 누설 구역 skip 0 | 전체 | `npx vitest run && npm run typecheck` | ✅ | ⬜ |
| 22-10-T1 | 10 | 9 | SC3 | T-22-19 | 화면에 개인 표·던진 좌석 없음 | client | `npx vitest run test/client/verdictScreen.test.tsx && npm run typecheck` | ✅(수정) | ⬜ |
| 22-10-T2 | 10 | 9 | SC3 | T-22-20 | — | client+unit | `npx vitest run test/client/nominationScreen.test.tsx test/unit/pickTurn.test.ts test/unit/hostLine.test.ts && npm run typecheck` | ✅(수정) | ⬜ |
| 22-10-T3 | 10 | 9 | SC3 | — | — | unit+client | `npx vitest run test/unit/dayView.test.ts test/unit/hostLine.test.ts && npx vitest run --project client && npm run typecheck` | ✅(수정) | ⬜ |
| 22-11-T1 | 11 | 10 | SC4 | T-22-21·22·23·25 | 처형자만 쓰기·final, 유언 단계 채팅 null | unit+worker | `npx vitest run test/unit/will.test.ts test/unit/audience.test.ts test/worker/will.test.ts test/worker/bots.test.ts && npx tsc -p tsconfig.worker.json --noEmit` | ✅(수정) · final·잠금 단언 ❌ Wave 0 | ⬜ |
| 22-11-T2 | 11 | 10 | SC4 | T-22-24 | 유언 글 텍스트 노드 | client+unit | `npx vitest run test/client/willSheet.test.tsx test/client/willFlow.test.tsx test/client/willLetter.test.tsx test/client/useWillLetter.test.tsx test/unit/pinPlan.test.ts test/client/chatPanel.test.tsx && npm run typecheck` | ✅(수정) | ⬜ |
| 22-11-T3 | 11 | 10 | SC4 | — | — | unit+전체 | `npx vitest run test/unit/hostLine.test.ts test/unit/dayView.test.ts test/unit/e2eContract.test.ts && node --test scripts/*.test.mjs && npx vitest run && npm run typecheck` | ✅(수정) | ⬜ |
| 22-12-T1 | 12 | 11 | SC3·SC4 | T-22-26·28 | day.execution.will 모두 같음·처형 단계만 | unit+worker | `npx vitest run test/unit/pinPlan.test.ts test/unit/verdictMoment.test.ts test/unit/soundVerdict.test.ts test/unit/soundScript.test.ts test/unit/dayView.test.ts test/unit/e2eContract.test.ts test/worker/trial.test.ts && npm run typecheck` | ✅(수정) | ⬜ |
| 22-12-T2 | 12 | 11 | SC3 | T-22-27 | ballots 0건, 허용 경로 축소 | worker+client+unit | `npx vitest run test/worker/leak.test.ts test/client/chatPanel.test.tsx test/unit/resultLog.test.ts test/unit/soundRecipes.test.ts && npm run typecheck` | ✅(수정) | ⬜ |
| 22-12-T3 | 12 | 11 | SC3 | T-22-27 | votes·voteLog 0건 | 전체 | `npx vitest run && node --test scripts/*.test.mjs scripts/e2e/*.test.mjs && npm run typecheck` | ✅ | ⬜ |
| 22-13-T1 | 13 | 12 | SC6 | T-22-29 | — | script | `node --test scripts/e2e/*.test.mjs` | ✅(수정) | ⬜ |
| 22-13-T2 | 13 | 12 | SC6 | T-22-29 | 표식 값에 비밀 없음 | script | `node --test scripts/e2e/*.test.mjs` | ❌ Wave 0(vote-count·will-flow 새로) | ⬜ |
| 22-13-T3 | 13 | 12 | SC1~SC6 | T-22-29 | 역할 다섯 시점 동일(emcee-leak) | e2e | `npm run e2e -- --url http://localhost:5173 --only basic-off,day,noexec,politics-pin,politics-verdict,vote-count,will-flow,ghost,sound-script,emcee-leak,result` | ✅ | ⬜ |
| 22-14-T1 | 14 | 13 | SC6 | — | — | 문서 | 22-14 Task 1 verify(문서 grep) | ✅ | ⬜ |
| 22-14-T2 | 14 | 13 | SC6 | — | — | 문서 | 22-14 Task 2 verify(결정 파일 11개 표시·0090 존재) | ❌(0090 새로) | ⬜ |
| 22-14-T3 | 14 | 13 | SC6 | T-22-30 | 위생 grep 빈 결과 | 전체 | `npm test && npm run typecheck && node --test scripts/*.test.mjs scripts/e2e/*.test.mjs` | ✅ | ⬜ |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] 기준선 측정(`npm test`·`npm run typecheck` 한 번) — 22-01 Task 1 첫 단계
- [ ] 정규화 시험(옛 방 → 대기실, `normalizeStoredRoom`) — SC1 · `test/unit/legacyRoom.test.ts` 를 22-03 Task 1 이 만들고 22-04·05·06·07 이 표시를 더한다. 옛 표시가 있는 방만 되돌린다(하이버네이션 재기동 안전)
- [ ] `final` 조기 종료·처형자 전용 `saveWill`·defense 채팅 잠금 시험 — SC4 · 22-11 Task 1(RED 먼저)
- [ ] `day.verdictCount` 방송(번복 포함, 개인 표·`day.voted` 없음 — D-26) 시험 — SC3 · 22-09 Task 1(RED 먼저)
- [ ] 새 E2E 흐름 `vote-count`·`will-flow` — SC3·SC4 · 22-13 Task 2, 실행은 22-13 Task 3

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 유령 크기·옆/뒷모습이 실기기에서 자연스러운지 | SC5 | 눈 확인 | v3.0 실테스트 때 폰에서 유령으로 걸어 본다 |
| 유언 스포트라이트의 긴장감 | SC4 | 눈 확인 | v3.0 실테스트 때 처형 한 번 본다 |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (39 tasks, 14 plans)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags (`vitest run`·`node --test` 만)
- [ ] Feedback latency < 60s — 빠른 실행 명령은 60초 안. 삭제 계획 마지막 task 와 22-14 게이트는 전체 `npx vitest run`(약 300초)을 돌린다 — 컴파일러가 못 잡는 문자열 비교가 많아 전체 실행이 필요하다(RESEARCH Pitfall 4)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending (계획 확인 대기)

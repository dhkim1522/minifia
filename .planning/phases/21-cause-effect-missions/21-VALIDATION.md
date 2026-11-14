---
phase: "21"
slug: "cause-effect-missions"
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-11-14"
---

# Phase 21 — Validation Strategy

> 실행 중 피드백 표본 추출 계약. 근거: `21-RESEARCH.md` 의 `## Validation Architecture`.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.x (세 프로젝트 `unit`·`client`·`worker`) + `node --test` + playwright-core E2E |
| **Config file** | `vitest.config.ts`, `test/unit/setup.ts`, `test/worker/setup.ts` |
| **Quick run command** | `npx vitest run --project unit test/unit/<file>.test.ts` (client·worker 는 `--project` 만 바꾼다) |
| **Full suite command** | `npm test && npm run typecheck && node --test scripts/*.test.mjs scripts/e2e/*.test.mjs` |
| **Estimated runtime** | 전체 수 분 (직전 페이즈 npm test 8,569개·node --test 689개) |

---

## Sampling Rate

- **After every task commit:** 바뀐 파일의 `npx vitest run --project <p> <file>` (`shared/` 를 건드리면 `npm run typecheck` 도)
- **After every plan wave:** 전체 시험 + `node --test` + `npm run typecheck`
- **Before `/gsd-verify-work`:** 전체 green + 폰 6종 E2E + 배포본 `npm run smoke`/`e2e`
- **Max feedback latency:** 타입·단위 60초 이내, 전체는 웨이브마다 한 번

---

## Per-Task Verification Map

| Requirement | Behavior | Test Type | Automated Command | File Exists |
|-------------|----------|-----------|-------------------|-------------|
| DAYFLOW-01 | 확장판 단계 사슬·분기·일차, 기본판 불변 | unit | `npx vitest run --project unit test/unit/dayFlow.test.ts test/unit/phases.test.ts test/unit/tick.test.ts` | ❌ W0 |
| LAMP-01·02 | 등불 배정·cut 서버 전용·꺼진 등불 집계 | unit | `npx vitest run --project unit test/unit/errand.test.ts test/unit/lamps.test.ts test/unit/mapTown.test.ts` | ❌ W0 |
| LAMP-01·02 | 마피아·시민 hold 응답 동일 | worker | `npx vitest run --project worker test/worker/lampLeak.test.ts` | ❌ W0 |
| HOUSE-01·02 | 집 찾기 pick·houseLit·밤 조명 역할 무관 | unit+worker+client | `npx vitest run --project unit test/unit/night.test.ts test/unit/lighting.test.ts && npx vitest run --project client test/client/nightMap.test.tsx` | ✅ 확장 |
| SCENE-01·02 | 현장 단서·흐려짐·살피기 1회·응답 모양 동일 | unit+worker | `npx vitest run --project unit test/unit/scene.test.ts && npx vitest run --project worker test/worker/sceneLeak.test.ts` | ❌ W0 |
| BOARD-01 | 의심 보드 파생·정체 비공개 | unit+client | `npx vitest run --project unit test/unit/gather.test.ts && npx vitest run --project client test/client/suspectBoard.test.tsx` | ❌ W0 |
| SKIP-01 | 건너뛰기 과반 | unit | `npx vitest run --project unit test/unit/skip.test.ts` | ❌ W0 |
| LEAK-02 | 새 단계 × 5 역할 누설 전수 | worker | `npx vitest run --project worker test/worker/leak.test.ts test/worker/errandLeak.test.ts test/worker/townLeak.test.ts test/worker/nightLeak.test.ts` | ✅ 확장 |
| TUT-06 | 튜토리얼 새 흐름 | unit+client | `npx vitest run --project unit test/unit/tutorialScript.test.ts && npx vitest run --project client test/client/tutorialScenes.test.tsx` | ✅ 수정 |
| 전 구간 | 타입·토큰·placeart | static | `npm run typecheck` | ✅ |
| DEPLOY-06 | E2E 흐름·폰 6종·성능 | e2e | `npm run e2e -- --url http://localhost:5173 --only lamp` | ❌ W0 |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `test/unit/dayFlow.test.ts` — DAYFLOW-01
- [ ] `test/unit/lamps.test.ts` — LAMP-01·02
- [ ] `test/unit/scene.test.ts` — SCENE-01·02
- [ ] `test/unit/skip.test.ts` — SKIP-01
- [ ] `test/worker/lampLeak.test.ts`, `test/worker/sceneLeak.test.ts` — 누설
- [ ] `test/client/{houseTag,clueSpot,clueCard,suspectBoard}.test.tsx` — 신규 부품
- [ ] 시험 잠금·켜기 도우미(`openCause()`/`lockCause()`) — 기존 시험 이전
- [ ] E2E 새 흐름 파일 + `lib.mjs` 판정 함수 + `lib.test.mjs`
- [ ] 개관 카메라 문패 겹침 계산 시험(`camera.test.ts` 확장)

---

## Manual-Only Verifications

All phase behaviors have automated verification. (실기기 감각 확인은 `/gsd-verify-work` 에서 사람이 본다.)

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s (단위)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

---
phase: "6"
slug: "world-skeleton"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-31"
---

# Phase 6 — Validation Strategy

> 실행 중 피드백 샘플링을 위한 페이즈별 검증 계약. 원천은 `06-RESEARCH.md` 의 "Validation Architecture" 절.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.12 (projects: `unit`(node) · `client`(happy-dom) · `worker`(workerd)) + `node --test`(scripts) + playwright-core 1.64.1(E2E) |
| **Config file** | `vitest.config.ts` (기존), `scripts/e2e/` |
| **Quick run command** | `npx vitest run test/unit/map.test.ts test/unit/world.test.ts test/unit/camera.test.ts` (해당 파일만) |
| **Full suite command** | `npx vitest run && node --test scripts/*.test.mjs scripts/e2e/lib.test.mjs && npm run typecheck` |
| **Estimated runtime** | ~20 seconds (기준선 117 파일 3,094 테스트 12.4초 + typecheck) |

---

## Sampling Rate

- **After every task commit:** 해당 순수 모듈 테스트(1~3초) + `npm run typecheck`
- **After every plan wave:** `npx vitest run` 전체 + `node --test scripts/*.test.mjs scripts/e2e/lib.test.mjs`
- **Before `/gsd-verify-work`:** 전체 green + 로컬 `npm run e2e -- --url http://localhost:5173` + 실기기 게이트 기록 + `minifia-v2` 배포본 `smoke --prod`
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

> 플래너가 계획 20개(06-01~06-20)의 Task 를 채웠다(2026-10-31). 상태는 실행자가 갱신한다.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 06-01-T1~T3 | 06-01 | 1 | DEPLOY-02 | T-06-01·02 | v1 이름·주소 거부, 빌드 산출물 이름 가드 | node:test | `node --test scripts/deploy-target.test.mjs scripts/e2e/lib.test.mjs` | ❌ W0(06-01 이 만듦) | ⬜ pending |
| 06-07-T2·T3 | 06-07 | 2 | DEPLOY-02 | T-06-14 | 첫 배포·v1 health 불변·폰 방 만들기/참가 | smoke + 사람 | `node scripts/smoke.mjs --prod` | ✅ 스크립트 | ⬜ pending |
| 06-02-T1~T3 | 06-02 | 1 | MAP-02·MAP-01 | T-06-04·05 | 마스크 동치·경로 슈퍼커버·가려짐 없음·입장 지점 | unit | `npx vitest run test/unit/map.test.ts` | ❌ W0(06-02) | ⬜ pending |
| 06-05-T1~T3 | 06-05 | 2 | MAP-02·MAP-05 | T-06-09·10·11 | positionAt·150ms·strictObject·복원 | unit | `npx vitest run test/unit/world.test.ts test/unit/schemas.test.ts` | ❌ W0(06-05) | ⬜ pending |
| 06-08-T1~T3 | 06-08 | 3 | MAP-01·02·05 | T-06-16~20 | 로비 전용 emitWorld·state→snap·퇴거 복원·봇 배회 | worker | `npx vitest run test/worker/world.test.ts test/worker/leak.test.ts` | ❌ W0(06-08) | ⬜ pending |
| 06-03-T1·T2 | 06-03 | 2 | MAP-03 | — | 투영 왕복·6크기×전 격자점 가시성·빈 배경 없음 | unit | `npx vitest run test/unit/camera.test.ts` | ❌ W0(06-03) | ⬜ pending |
| 06-03-T3 | 06-03 | 2 | MAP-05 | T-06-06 | 소실·3초 재생성·5초 실패 | unit | `npx vitest run test/unit/status.test.ts` | ❌ W0(06-03) | ⬜ pending |
| 06-09-T1·T2 | 06-09 | 3 | MAP-05·CONN-04 | T-06-21·22 | 화이트리스트·epoch·snap 교체 | unit/client | `npx vitest run test/unit/worldStore.test.ts test/client/useRoomConnection.test.tsx test/unit/linkReducer.test.ts` | ✅ + 신규 | ⬜ pending |
| 06-10-T1~T3 | 06-10 | 3 | MAP-01·MAP-03 | T-06-23·24 | three 카메라 일치·장면 예산·사다리 | unit | `npx vitest run test/unit/cameraThree.test.ts test/unit/barScene.test.ts test/unit/palette.test.ts test/unit/ladder.test.ts` | ❌ W0(06-10) | ⬜ pending |
| 06-11-T1~T3 | 06-11 | 3 | MAP-01·MAP-02 | T-06-25 | 관절 병합·의상·동작 | unit | `npx vitest run test/unit/character.test.ts` | ❌ W0(06-11) | ⬜ pending |
| 06-12-T1·T2 | 06-12 | 3 | MAP-07·MAP-01 | T-06-26 | 이름표 말줄임 없음·React 텍스트 | client | `npx vitest run test/client/v2parts.test.tsx` | ❌ W0(06-12) | ⬜ pending |
| 06-13-T1~T3 | 06-13 | 4 | MAP-01·02·03·05·07 | T-06-27·28·29 | 탭→move·예측 없음·카드·훅 조건 | unit/client | `npx vitest run test/unit/input.test.ts test/client/worldStage.test.tsx` | ❌ W0(06-13) | ⬜ pending |
| 06-06-T1·T3 | 06-06 | 2 | MAP-07 | T-06-12·13 | 서버 검증 1~8자·봇 이름 | unit/client | `npx vitest run test/unit/nickname.test.ts test/unit/copy.test.ts test/unit/bots.test.ts test/client/joinByLink.test.tsx` | ✅ 확장 | ⬜ pending |
| 06-15-T1~T3 | 06-15 | 5 | MAP-01·05·CONN-04 | T-06-33 | 맵 로비·스토어 구독·skip 없음 | client | `npx vitest run --project client` | ✅ 갱신 | ⬜ pending |
| 06-17-T1 | 06-17 | 7 | MAP-01·02·07 | T-06-36 | 두 페이지 위치 일치·이름표 폭 | E2E | `npm run e2e -- --url http://localhost:5173 --only world` | ❌ W0(06-17) | ⬜ pending |
| 06-17-T2 | 06-17 | 7 | MAP-07·성공 기준 3 | — | 로비 6크기 계약·v1.0 게임 흐름 새 로비에서 완주 | E2E + unit | `npx vitest run test/unit/e2eContract.test.ts` / `npm run e2e -- --url http://localhost:5173 --only lobby` | ❌ W0(06-17) | ⬜ pending |
| 06-18-T1·T2 | 06-18 | 8 | CONN-04·MAP-05·렌더 예산 | T-06-41 | 5종×10회 콘솔 0·calls ≤ 120·메모리 원복 | E2E | `npm run e2e -- --url http://localhost:5173 --only reconnect` / `--only perfbudget` | ❌ W0(06-18) | ⬜ pending |
| 06-14-T2·06-19-T1 | 06-14·06-19 | 5·9 | 성공 기준 4(B) | T-06-31·32 | 크롬 CPU 4× 5분 측정 | 스크립트 | `node scripts/perf-run.mjs --scene vote --minutes 5 --throttle 4` | ❌ W0(06-14) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `test/unit/map.test.ts`, `world.test.ts`, `camera.test.ts`, `status.test.ts` — 순수 모듈(TDD 먼저)
- [ ] `test/worker/world.test.ts` — move/세그먼트/디바운스/퇴거 복원/hello 순서/로비 밖 무시; `leak.test.ts` 월드 프레임 항목 확장
- [ ] `test/client/worldStage.test.tsx` — 가짜 `MapRenderer` 주입
- [ ] `scripts/deploy-target.mjs`, `check-deploy-target.mjs`, `deploy-target.test.mjs`
- [ ] E2E 흐름 신규(`world`, `reconnect`, `perf-budget`) + `lobbyFlow` 재작성
- [ ] `src/debug/perf/` 지표 순수 함수(`avgFps`, `jank`, `percentile`, 하트비트 판정) 단위 테스트
- [ ] 의존성: `three@0.186.1` / `@types/three@0.186.0` 정확 고정 (체크포인트 뒤)
- [ ] 헤드리스 `loseContext` 후 재생성 경로 스모크

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| v2 배포본에서 다른 폰으로 방 만들기·참가, v1 `/api/health` 버전 불변 | DEPLOY-02 | 실제 배포·다른 기기 필요 | `minifia-v2` 주소를 폰으로 열고 방 생성·참가, v1 health 버전 비교 |
| iOS 화면 잠금·앱 전환 후 3D 화면 복구 | MAP-05 | iOS 가 그래픽 자원을 회수하는 조건은 시뮬레이션 불가 | 실기기에서 잠금·앱 전환 후 복귀, `06-PERF-RESULTS.md` 기록 |
| 5분 평균 ≥55fps, 끊김 ≤5, 발열·메모리 경고 없음, 조작 3초 반응 | 성공 기준 4 | 실기기·스로틀 측정 | iPhone 16 Pro + 크롬 CPU 4배 스로틀에서 `?perf=1` 결과 카드 → `06-PERF-RESULTS.md` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

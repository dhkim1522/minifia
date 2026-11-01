---
phase: "6"
slug: "world-skeleton"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-10-31"
validated: "2026-11-01"
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

> 플래너가 계획 21개(06-01~06-21)의 Task 를 채웠다(2026-10-31, 06-15 를 06-15·06-21 로 나눈 수정 반영). 2026-11-01 validate-phase 가 빠졌던 06-04·06-07-T1·06-14·06-16·06-20 줄과 코드 리뷰 수정(CR-01, WR-01~05) 회귀 테스트를 더하고 상태를 갱신했다.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 06-01-T1~T3 | 06-01 | 1 | DEPLOY-02 | T-06-01·02 | v1 이름·주소 거부(끝 점·변형 포함, CR-01), 빌드 산출물 이름 가드, deploy 추가 인자 거부(WR-05) | node:test | `node --test scripts/deploy-target.test.mjs scripts/e2e/lib.test.mjs` | ✅ | ✅ green |
| 06-07-T1 | 06-07 | 2 | DEPLOY-02 | — | 빌드 상수 WORKER_NAME·"v2.0 시험판" 표식 | client | `npx vitest run test/client/v2Marker.test.tsx test/client/screens.test.tsx` | ✅ | ✅ green |
| 06-07-T2·T3 | 06-07 | 2 | DEPLOY-02 | T-06-14 | 첫 배포·v1 health 불변·폰 방 만들기/참가 | smoke + 사람 | `node scripts/smoke.mjs --prod` (v2 배포본, 06-07 실행 기록) | ✅ 스크립트 | ✅ green (실행 기록) · 사람 확인은 Manual-Only |
| 06-02-T1~T3 | 06-02 | 1 | MAP-02·MAP-01 | T-06-04·05 | 마스크 동치·경로 슈퍼커버·가려짐 없음·입장 지점 | unit | `npx vitest run test/unit/map.test.ts` | ✅ | ✅ green |
| 06-04-T2·T3 | 06-04 | 2 | MAP-01 | — | three@0.186.1·@types/three@0.186.0 정확 고정, v2 토큰 22개 생성 일치 | unit | `npx vitest run test/unit/deps.test.ts test/unit/tokensV2.test.ts && npm run tokens:check` | ✅ | ✅ green |
| 06-05-T1~T3 | 06-05 | 2 | MAP-02·MAP-05 | T-06-09·10·11 | positionAt·150ms·strictObject·복원, 닉네임 UTF-16 상한(WR-03) | unit | `npx vitest run test/unit/world.test.ts test/unit/schemas.test.ts` | ✅ | ✅ green |
| 06-08-T1~T3 | 06-08 | 3 | MAP-01·02·05 | T-06-16~20 | 로비 전용 emitWorld·state→snap·퇴거 복원·봇 배회·world 프레임 허용 목록 | worker | `npx vitest run test/worker/world.test.ts test/worker/leak.test.ts` | ✅ | ✅ green |
| 06-03-T1·T2 | 06-03 | 2 | MAP-03 | — | 투영 왕복·6크기×전 격자점 가시성·빈 배경 없음 | unit | `npx vitest run test/unit/camera.test.ts` | ✅ | ✅ green |
| 06-03-T3 | 06-03 | 2 | MAP-05 | T-06-06 | 소실·3초 재생성·5초 실패, 숨은 탭 시계 정지(WR-02) | unit | `npx vitest run test/unit/status.test.ts` | ✅ | ✅ green |
| 06-09-T1·T2 | 06-09 | 3 | MAP-05·CONN-04 | T-06-21·22 | 화이트리스트·epoch·snap 교체·world 프레임 비간섭 회귀(describe 1개·it 4개, WR-02 회귀 포함) | unit/client | `npx vitest run test/unit/worldStore.test.ts test/client/useRoomConnection.test.tsx test/unit/linkReducer.test.ts` / `npx vitest run test/client/useRoomConnection.test.tsx -t "world 프레임 비간섭"` | ✅ | ✅ green |
| 06-10-T1~T3 | 06-10 | 3 | MAP-01·MAP-03 | T-06-23·24 | three 카메라 일치·장면 예산·사다리 | unit | `npx vitest run test/unit/cameraThree.test.ts test/unit/barScene.test.ts test/unit/palette.test.ts test/unit/ladder.test.ts` | ✅ | ✅ green |
| 06-11-T1~T3 | 06-11 | 3 | MAP-01·MAP-02 | T-06-25 | 관절 병합·의상·동작 | unit | `npx vitest run test/unit/character.test.ts` | ✅ | ✅ green |
| 06-12-T1·T2 | 06-12 | 3 | MAP-07·MAP-01 | T-06-26 | 이름표 말줄임 없음·React 텍스트 | client | `npx vitest run test/client/v2parts.test.tsx` | ✅ | ✅ green |
| 06-13-T1~T3 | 06-13 | 4 | MAP-01·02·03·05·07 | T-06-27·28·29 | 탭→move·예측 없음·카드·훅 조건, 프레임 예외 뒤 루프 유지(WR-01), 탭 간격 250ms(WR-04) | unit/client | `npx vitest run test/unit/input.test.ts test/client/worldStage.test.tsx` | ✅ | ✅ green |
| 06-06-T1·T3 | 06-06 | 2 | MAP-07 | T-06-12·13 | 서버 검증 1~8자·봇 이름, 상한 초과 NICKNAME_INVALID(WR-03) | unit/client/worker | `npx vitest run test/unit/nickname.test.ts test/unit/copy.test.ts test/unit/bots.test.ts test/client/joinByLink.test.tsx test/worker/http.test.ts test/worker/join.test.ts` | ✅ | ✅ green |
| 06-14-T1~T3 | 06-14 | 5 | MAP-01·02·03·성공 기준 4 | T-06-31·32 | ?perf=1 시나리오 결정성, avgFps·jank·percentile·하트비트·자동 강등, perf-run v1 차단 | unit/client | `npx vitest run test/unit/perfMetrics.test.ts test/unit/perfScenario.test.ts test/client/perfProbe.test.tsx` | ✅ | ✅ green |
| 06-15-T1~T3 | 06-15 | 5 | MAP-01·05·CONN-04 | T-06-33 | 맵 로비·스토어 구독·떠 있는 재접속 띠·skip 없음(웨이브 5 끝 게이트) | client | `npx vitest run --project client` | ✅ | ✅ green |
| 06-16-T1·T2 | 06-16 | 6 | MAP-01 | — | v1.0 대기실 전용 코드 삭제(잔존 0), 화면 지도·구조 문서 갱신 | client + grep | `npx vitest run test/client/dayTable.test.tsx` / `git grep -e useSeatTransitions -e hostCrown -- src test` 결과 0건 | ✅ | ✅ green |
| 06-21-T1~T3 | 06-21 | 6 | MAP-01 | T-06-43·44 | v2 알림 문구·방장 왕관·입장 화면 미리 받기·room-enter 표식·skip 없음(웨이브 6 끝 게이트) | unit/client | `npx vitest run test/unit/roomDiff.test.ts test/client/lobby.test.tsx test/client/screens.test.tsx test/client/joinByLink.test.tsx` / `npx vitest run` | ✅ | ✅ green |
| 06-17-T1 | 06-17 | 7 | MAP-01·02·07 | T-06-36 | 두 페이지 위치 일치·이름표 폭 | E2E | `npm run e2e -- --url http://localhost:5173 --only world` | ✅ | ✅ green (06-17 실행 기록, 6크기 20/20) |
| 06-17-T2 | 06-17 | 7 | MAP-07·성공 기준 3 | — | 로비 6크기 계약·v1.0 게임 흐름 새 로비에서 완주 | E2E + unit | `npx vitest run test/unit/e2eContract.test.ts` / `npm run e2e -- --url http://localhost:5173 --only lobby` | ✅ | ✅ green |
| 06-18-T1·T2 | 06-18 | 8 | CONN-04·MAP-05·렌더 예산 | T-06-41 | 5종×10회 콘솔 0·calls ≤ 120·메모리 원복 | E2E + node:test | `node --test scripts/e2e/lib.test.mjs` / `npm run e2e -- --url http://localhost:5173 --only reconnect` / `--only perfbudget` | ✅ | ✅ green (판정 함수 단위 + 06-18 로컬 E2E 전체 OK 624초) |
| 06-14-T2·06-19-T1 | 06-14·06-19 | 5·9 | 성공 기준 4(B) | T-06-31·32 | 크롬 CPU 4× 5분 측정 | 스크립트 | `node scripts/perf-run.mjs --scene vote --minutes 5 --throttle 4` | ✅ | ✅ green (06-PERF-RESULTS.md, 판정 a 통과·결정 0057) |
| 06-20-T1 | 06-20 | 10 | MAP-01·02·03 | — | 렌더 게이트 결정 기록·사다리 기본 단계 | unit | `npx vitest run test/unit/ladder.test.ts` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `test/unit/map.test.ts`, `world.test.ts`, `camera.test.ts`, `status.test.ts` — 순수 모듈(TDD 먼저)
- [x] `test/worker/world.test.ts` — move/세그먼트/디바운스/퇴거 복원/hello 순서/로비 밖 무시; `leak.test.ts` 월드 프레임 항목 확장
- [x] `test/client/worldStage.test.tsx` — 가짜 `MapRenderer` 주입
- [x] `scripts/deploy-target.mjs`, `check-deploy-target.mjs`, `deploy-target.test.mjs`
- [x] E2E 흐름 신규(`world`, `reconnect`, `perf-budget`) + `lobbyFlow` 재작성
- [x] `src/debug/perf/` 지표 순수 함수(`avgFps`, `jank`, `percentile`, 하트비트 판정) 단위 테스트 — `test/unit/perfMetrics.test.ts`
- [x] 의존성: `three@0.186.1` / `@types/three@0.186.0` 정확 고정 (체크포인트 뒤) — `test/unit/deps.test.ts`, `npm ls`
- [x] 헤드리스 `loseContext` 후 재생성 경로 스모크 — `scripts/e2e/flows.mjs` reconnect 흐름(`__mfWorld.debug.loseContext()`)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| v2 배포본에서 다른 폰으로 방 만들기·참가, v1 `/api/health` 버전 불변 | DEPLOY-02 | 실제 배포·다른 기기 필요 | `minifia-v2` 주소를 폰으로 열고 방 생성·참가, v1 health 버전 비교 |
| iOS 화면 잠금·앱 전환 후 3D 화면 복구 | MAP-05 | iOS 가 그래픽 자원을 회수하는 조건은 시뮬레이션 불가 | 실기기에서 잠금·앱 전환 후 복귀, `06-PERF-RESULTS.md` 기록 |
| 5분 평균 ≥55fps, 끊김 ≤5, 발열·메모리 경고 없음, 조작 3초 반응 | 성공 기준 4 | 실기기·스로틀 측정 | iPhone 16 Pro + 크롬 CPU 4배 스로틀에서 `?perf=1` 결과 카드 → `06-PERF-RESULTS.md` |
| 재생성 중 숨었다 돌아오면 5초 포기 시계가 복귀 시점부터 다시 시작되는 것이 의도와 맞는지 | MAP-05 (WR-02) | 동작은 `status.test.ts`·`worldStage.test.tsx` 가 고정했고, 남은 것은 제품 의도 판단 | 06-REVIEW-FIX.md WR-02 "requires human verification" 항목을 사용자가 확인 |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s (`npx vitest run` 137 파일 15.8초)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated 2026-11-01 (gsd-validate-phase)

**검증 실행 기록(2026-11-01, 오프라인):**
- `npx vitest run` — 137 파일, 3710 통과 · 1 건너뜀(`test/unit/camera.test.ts` 의 `describe.runIf(CAMERA_PRINT === "1")` 근거 표 출력 블록. 단언 없는 진단 출력이며 동작 검증 공백이 아니다)
- `npm run typecheck` — 통과
- `node --test scripts/*.test.mjs scripts/e2e/lib.test.mjs` — 267 통과
- `npm run tokens:check`, `npm ls three @types/three`, 06-16 잔존 코드 `git grep` 0건, 문서 grep — 통과
- E2E·perf 측정·`smoke --prod` 는 이번에 다시 돌리지 않았다(배포본 요청 금지). 06-17·06-18·06-19 실행 기록을 근거로 둔다

## Validation Audit 2026-11-01

| Metric | Count |
|---|---|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

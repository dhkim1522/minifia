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

> 계획 작성 후 플래너/실행자가 Task ID 를 채운다. 아래는 요구사항 기준 초안.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | DEPLOY-02 | 배포 대상 오인 | v1 이름·주소 거부 | node:test | `node --test scripts/deploy-target.test.mjs scripts/e2e/lib.test.mjs` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | MAP-02 | — | N/A | unit | `npx vitest run test/unit/world.test.ts test/unit/map.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | MAP-02 | 좌표 조작·move 폭주 | strictObject·범위·보정·150ms 버림 | worker | `npx vitest run test/worker/world.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | MAP-03 | — | N/A | unit | `npx vitest run test/unit/camera.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | MAP-01 | 닉네임 DOM 주입 | React 텍스트로만 렌더 | client | `npx vitest run test/client/worldStage.test.tsx` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | MAP-05 | — | N/A | unit/worker | `npx vitest run test/unit/status.test.ts test/worker/world.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | CONN-04 | — | N/A | client/unit | `npx vitest run test/client/useRoomConnection.test.tsx test/unit/linkReducer.test.ts test/client/lobby.test.tsx` | ✅ + 신규 | ⬜ pending |
| TBD | TBD | TBD | MAP-07 | 닉네임 길이 조작 | 서버 스키마 1~8자, 이름표 말줄임 없음 | unit/client | `npx vitest run test/unit test/client` (닉네임 스키마·이름표 케이스) | ✅ 확장 | ⬜ pending |
| TBD | TBD | TBD | 누설(MAP-01·02) | 로비 밖 위치 누설 | world 프레임 키 허용 목록·로비 밖 0 | worker | `npx vitest run test/worker/leak.test.ts` | ✅ 확장 | ⬜ pending |
| TBD | TBD | TBD | 렌더 예산 | — | N/A | E2E | `npm run e2e -- --only perf-budget` | ❌ W0 | ⬜ pending |

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

---
phase: "08"
slug: "day-execution-ghost"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-11-02"
---

# Phase 08 — Validation Strategy

> 실행 중 피드백 샘플링을 위한 페이즈별 검증 계약. 원천은 `08-RESEARCH.md` 의 `## Validation Architecture`.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.12 — projects `unit`(node) · `client`(happy-dom) · `worker`(workerd); `node --test`(scripts); playwright-core 1.64.1(E2E, 시스템 Chrome) |
| **Config file** | `vitest.config.ts` (기존, 변경 없음) |
| **Quick run command** | `npx vitest run <바꾼 테스트 파일>` |
| **Full suite command** | `npx vitest run && node --test scripts/*.test.mjs scripts/e2e/lib.test.mjs && npx tsc -p tsconfig.app.json --noEmit && npx tsc -p tsconfig.worker.json --noEmit` |
| **화면 E2E** | `npm run dev` 후 `npm run e2e -- --url http://localhost:5173 --only <흐름>` (인자 없으면 배포본) |
| **Estimated runtime** | 단위 ~60초, 전체 ~180초(E2E 제외) |
| **기준선** | vitest 143 파일 / 3897 통과 / 1 건너뜀; node --test 288 통과; 두 tsc 통과 (2026-11-02) |

---

## Sampling Rate

- **After every task commit:** 바꾼 파일의 테스트 + 해당 쪽 `tsc`(앱 또는 워커)
- **After every plan wave:** Full suite command
- **Before `/gsd-verify-work`:** 전체 + 로컬 E2E(`--only` 새 흐름들) + 배포본 smoke/E2E + 렌더 게이트(크롬 4× 스로틀) 초록
- **Max feedback latency:** 180 seconds

---

## Per-Task Verification Map

> 요구사항 단위 지도. 계획 확정 후 플래너/실행자가 Task ID 로 채운다.

| Requirement | Behavior | Threat Ref | Test Type | Automated Command | File Exists | Status |
|-------------|----------|------------|-----------|-------------------|-------------|--------|
| DAY-03 | 과반 토론 끝내기 → 즉시 지목, 취소 가능, 유령 불가, 청소 시점(discussion 진입) | T-08-07 | unit + worker | `npx vitest run test/unit/discussion.test.ts test/worker/day.test.ts` | 개정 | ✅ green |
| DAY-04 | 지목 규칙(자기 불가·산 사람만·바꾸기·취소 없음), 공개 목록, 모이기 슬롯 | T-08-04, T-08-08 | unit + worker | `npx vitest run test/unit/nomination.test.ts test/unit/gather.test.ts test/worker/trial.test.ts` | ✅ | ✅ green |
| DAY-05 | 최다 한 명 → defense(무대 STAGE_SPOT), 동률·0표 → night, A3(과반이어도 마감까지) | — | unit | `npx vitest run test/unit/nomination.test.ts test/unit/tick.test.ts` | ✅ | ✅ green |
| DAY-06 | 분모=변론자 제외 산 사람, 변론자·유령 투표 불가, 기권, 익명, 마감까지 고정(조기 종료 없음), 처형 시 역할 비공개 | T-08-02, T-08-03 | unit + worker | `npx vitest run test/unit/verdictRule.test.ts test/worker/trial.test.ts test/worker/leak.test.ts` | ✅ | ✅ green |
| DAY-07 | 단계 길이 90/15/20/10/5/30, v1.0 흐름·고정 테이블 부재(정적 가드) | — | unit(정적) + client | `npx vitest run test/unit/phases.test.ts test/unit/dayStaticGuard.test.ts` | ✅ | ✅ green |
| MAP-04 | 지목·변론·찬반·처형·밤·아침에 산 사람 `move` 프레임 없음, 토론은 가능, 채팅 통과 | T-08-05 | worker | `npx vitest run test/worker/world.test.ts -t "단계별 이동"` | 개정 + 신규 | ✅ green |
| GHOST-01 | 유령 이동·입력 중·채팅이 산 사람 소켓에 0건(메타모픽 비교 + 직접 불변식), 산 사람 snap 에 유령 없음 | T-08-01, T-08-11 | worker(누설) | `npx vitest run test/worker/ghostLeak.test.ts test/worker/chatLeak.test.ts` | ✅ | ✅ green |
| GHOST-02 | 유령 view 에 모든 직업·밤 picks, 산 사람 view 엔 키 없음, DOM 에 산 사람 `[data-role-chip]` 0건 | T-08-06 | unit + client + E2E | `npx vitest run test/unit/view.test.ts test/client/gameMap.test.tsx` | ✅ | ✅ green |
| (공통) | 화면: 지목 버튼 44×44·배지/도장/선두·찬반 줄·첫 스냅샷 무이펙트·결과 알림 | T-08-09 | client + E2E | `npx vitest run --project client` ; `npm run e2e -- --url http://localhost:5173 --only day` | ✅ | ✅ green |
| (공통) | 테스트 방 봇이 새 흐름으로 한 판 자동 완주 | — | worker + script | `npx vitest run test/worker/bots.test.ts` ; `node scripts/smoke.mjs http://localhost:5173 --stage full --players 5` | 개정 | ✅ green |
| (공통) | 렌더 게이트 낮 전체 흐름 55fps | — | script(크롬 4× 스로틀) | `node scripts/perf-run.mjs …` (낮 흐름 시나리오 추가) | 개정 | manual-only (실기기 묶음 이월, 사용자 결정 2026-11-03) |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `test/unit/nomination.test.ts`, `test/unit/verdictRule.test.ts`(신규 — 찬반 규칙; `test/unit/verdict.test.ts` 는 화면 문구 시험), `test/worker/trial.test.ts`(신규 — 옛 `test/worker/vote.test.ts` 대체), `test/unit/gather.test.ts`(N=2..8 슬롯 걷기 가능·간격 ≥ 2.0·경로, STAGE_SPOT 예외), `test/unit/movement.test.ts`(canMove 단계×신분 전수), `test/unit/audience.test.ts` 개정(world mover·`worldVisibleTo`)
- [x] `test/worker/ghostLeak.test.ts`(메타모픽), `test/worker/helpers.ts` 에 지목/찬반/토론 끝내기/유령 만들기 도우미 — `voteExec`·`voteCandidate`·`votesIn` 대체
- [x] `test/unit/dayStaticGuard.test.ts`: 삭제한 이름(`DayTable`·`ExecVotePanel`·`execVote`·`candidateVote`·`UserRecordSheet`·`RevealLayer` …) 재등장 금지
- [x] `test/client/gameMap.test.tsx`, `test/client/{voteBadge,verdictPicker,headStackV2}.test.tsx`, `test/unit/dayView.test.ts`
- [x] `scripts/e2e` 새 흐름(`day`, `ghost`) 및 `lib.test.mjs` 동기화, `e2eContract.test.ts` 상수 사본 갱신
- [x] 프레임워크 설치: 없음

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| iPhone 실기기 5분 평균 55fps(지목 8명·배지 맥박·유령 반투명), 조명 읽힘, 유령 이름표 대비 | DAY-04, GHOST-01 | 실기기·눈 | 사용자 결정(2026-11-02)에 따라 모든 개발 뒤 한꺼번에 — ROADMAP 백로그로 이월 |
| 8·9 페이즈 팀 확인(이동·채팅·긴장) | DAY-03~07 | 사람 | 9페이즈 성공 기준 5 |
| 렌더 게이트 낮 전체 흐름 55fps(데스크톱 4× 스로틀 측정 모드 포함) | DAY-04, GHOST-01 | 측정 모드를 실기기 묶음으로 미룸 | 사용자 결정(2026-11-03), `08-DEVICE-CHECKS.md` 표 B |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 180s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated 2026-11-03 — 전체 vitest 135 파일 3674 통과, node --test 195 통과, 로컬·배포본 E2E OK, 배포본 smoke OK

## Validation Audit 2026-11-02

| Metric | Count |
|---|---|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 1 |

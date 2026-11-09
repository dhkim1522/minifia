---
phase: "17"
slug: "tutorial-first-case"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-11-09"
---

# Phase 17 — Validation Strategy

> 실행 중 피드백 샘플링 계약. 원천은 `17-RESEARCH.md` "## Validation Architecture".

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.12 (projects `unit`·`client`·`worker`) / `node --test`(E2E 도우미) / playwright-core 1.64.1(E2E) |
| **Config file** | `vitest.config.ts`, `wrangler.jsonc`, `scripts/e2e/run.mjs` |
| **Quick run command** | `npx vitest run --project <unit\|client\|worker> <바꾼 시험 파일>` |
| **Full suite command** | `npm run typecheck && npm test && node --test scripts/e2e/lib.test.mjs` |
| **Estimated runtime** | 단일 파일 1~2초, 전체 vitest 수 분, E2E 전체 회귀 약 21분(페이즈 끝 한 번) |

---

## Sampling Rate

- **After every task commit:** 바꾼 영역의 단일 파일 quick run + 서버·타입 변경 때 `npm run typecheck`
- **After every plan wave:** `npx vitest run --project unit --project client` + 바뀐 워커 파일 + `node --test scripts/e2e/lib.test.mjs`
- **Before `/gsd-verify-work`:** `npm run typecheck && npm test` 전체 초록 → 로컬 `npm run dev` 후 바뀐 흐름만(`--only tutorial-solo,tutorial-together,chat-lobby,sound-render`) → 6종 전체 회귀 한 번 → 배포 → 배포본 smoke + tutorial 흐름
- **Max feedback latency:** 단일 파일 기준 10초

---

## Per-Task Verification Map

> 계획(PLAN.md) 확정 뒤 Task ID 를 채운다. 지금은 요구사항 → 시험 지도.

| Requirement | Behavior | Test Type | Automated Command | File Exists | Status |
|-------------|----------|-----------|-------------------|-------------|--------|
| TUT-01 | 큰 카드↔작은 단추(`minifia.tutorial.seen`)·Home 에만 | client | `npx vitest run --project client test/client/tutorialEntry.test.tsx` | ✅ | ✅ green |
| TUT-01 | 혼자 하기 8장면·[건너뛰기]·마무리 카드 | client | `npx vitest run --project client test/client/tutorialScreen.test.tsx` | ✅ | ✅ green |
| TUT-01·03 | 폰 6종 기하·장면 순서·소켓 프레임 0 | E2E | `npm run e2e -- --url http://localhost:5173 --only tutorial-solo` | ✅ | ✅ green |
| TUT-02 | `start.tutorial`·`tutorialDone`·전원 완료 조기 종료·150초·봇/끊김 셈 | worker | `npx vitest run --project worker test/worker/tutorial.test.ts` | ✅ | ✅ green |
| TUT-02 | 순수 규칙·`PHASE_DEFS.tutorial` | unit | `npx vitest run --project unit test/unit/tutorial.test.ts` | ✅ | ✅ green |
| TUT-02 | 대기실 스위치 줄·기다림 화면 | client | `npx vitest run --project client test/client/lobby.test.tsx test/client/tutorialWait.test.tsx` | lobby ✅ / wait ✅ | ✅ green |
| TUT-02 | 함께 진행 실제 흐름 | E2E | `npm run e2e -- --url http://localhost:5173 --only tutorial-together` | ✅ | ✅ green |
| TUT-03 | 장면 표·가짜 view(같은 옷·흔적 구간) | unit | `npx vitest run --project unit test/unit/tutorialScript.test.ts` | ✅ | ✅ green |
| TUT-03 | FocusRing·허용 목록 inert·오답 처리 | client | `npx vitest run --project client test/client/focusRing.test.tsx test/client/tutorialGate.test.tsx` | ✅ | ✅ green |
| TUT-03·04 | 사회자 파형 띠·소리 꺼짐에서 막대만 | client | `npx vitest run --project client test/client/tutorialHostBand.test.tsx` | ✅ | ✅ green |
| TUT-04 | 새 효과음 레시피 한계·해시·버스·간격 | unit | `npx vitest run --project unit test/unit/soundRecipes.test.ts test/unit/soundProvenance.test.ts` | ✅ 수정 | ✅ green |
| TUT-04 | 웅얼 목소리 예약 규칙 | unit | `npx vitest run --project unit test/unit/voice.test.ts` | ✅ | ✅ green |
| TUT-04 | `src/audio/**` 정적 가드 | unit | `npx vitest run --project unit test/unit/soundStaticGuard.test.ts` | ✅ | ✅ green |
| TUT-05 | 실제 `send` 는 끝났음 한 번뿐 | client | `npx vitest run --project client test/client/tutorialScreen.test.tsx` | ✅ | ✅ green |
| TUT-05 | 튜토리얼 소스에 역할·실제 닉네임 경로 없음 | unit | `npx vitest run --project unit test/unit/tutorialStaticGuard.test.ts` | ✅ | ✅ green |
| DEPLOY-05 | 누설 전수(`tutorial` 단계 역할 5종 시점 동일·서버 전용 키 없음) | worker | `npx vitest run --project worker test/worker/leak.test.ts test/worker/tutorialLeak.test.ts` | leak ✅ / ✅ | ✅ green |
| 회귀 | `Record<PhaseId>` 표·매트릭스 | typecheck+unit | `npm run typecheck && npx vitest run --project unit test/unit/nyquist-02-phase-matrix.test.ts test/unit/phases.test.ts` | ✅ 수정 | ✅ green |
| 회귀 | E2E 고정값 사본 | unit+node | `npx vitest run --project unit test/unit/e2eContract.test.ts && node --test scripts/e2e/lib.test.mjs` | ✅ 수정 | ✅ green |

*Status: ✅ green · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `PhaseId` + 모든 `Record<PhaseId>` 표 + `worldVisibleTo` 갱신(컴파일 먼저)
- [ ] 소리 고정 시험 갱신: `soundRecipes.test.ts`·`soundProvenance`·`soundLab`·`e2eContract`·`sound-render` 개수·`docs/audio.md`
- [ ] 신규 시험 파일: `test/unit/{tutorial,tutorialScript,voice,tutorialStaticGuard}.test.ts`, `test/client/{tutorialEntry,tutorialScreen,tutorialGate,focusRing,tutorialHostBand,tutorialWait}.test.tsx`, `test/worker/{tutorial,tutorialLeak}.test.ts`
- [ ] `test/worker/leak.test.ts` 확장(새 공개 경로·서버 전용 키·튜토리얼 중 역할 시점 동일성)
- [ ] 진홍 예약 정적 시험(`src/styles/tutorial.css` 의 crimson 사용처 = UI-SPEC T-18 세 곳)
- [ ] E2E `tutorial-solo`·`tutorial-together` 흐름, 방장 패널 상수, `chat-lobby` 방장 변형

*프레임워크 설치 불필요.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 웅얼 목소리·효과음 체감, 깜빡임이 시선을 끄는지 | TUT-03·04 | 청감·체감 | v3.0 끝 실테스트(실기기)에서 혼자 하기 한 번 |
| "흥미를 느껴 첫 판으로 이어진다" | 목표 | 사람 반응 | v3.0 실테스트에서 처음 온 사람 1명 관찰 |
| 장면 3~6 성능(5분 평균 55fps) | TUT-03 | 실기기 | v3.0 끝 실기기 측정 |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [ ] Feedback latency < 10s — 미충족 수용(20개 파일 단위 시험 묶음 수십 초, E2E 분 단위)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated 2026-11-09

## Validation Audit 2026-11-09

| Metric | Count |
|---|---|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

---
phase: "4"
slug: "execution-verdict"
status: server-wave-complete
nyquist_compliant: true
wave_0_complete: true
created: "2026-10-26"
---

# Phase 4 — Validation Strategy

> 실행 중 피드백 표본 추출 계약. 상세 근거와 요구사항별 시험 표는 `04-RESEARCH.md` §Validation Architecture.
> 이번 계획 범위는 서버·공유 로직(화면 웨이브 제외, D-26).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.12 (프로젝트 3개: `unit` node / `client` happy-dom / `worker` workerd) |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run --project unit` |
| **Full suite command** | `npm test` + `npx tsc -p tsconfig.app.json --noEmit && npx tsc -p tsconfig.worker.json --noEmit` |
| **Estimated runtime** | unit ~2초, worker ~6초, 전체 수십 초 |

---

## Sampling Rate

- **After every task commit:** `npx vitest run --project unit` (+ 만진 파일 개별 실행, 와이어·뷰를 만졌으면 두 `tsc --noEmit`)
- **After every plan wave:** `npm test` + 두 `tsc --noEmit`
- **Before `/gsd-verify-work`:** 전체 테스트와 `npm run typecheck` 통과
- **Max feedback latency:** 60초

---

## Per-Task Verification Map

작업 ID 는 `{계획}-T{번호}` 이다. 상태는 04-12 에서 실제로 돌린 결과 기준이다(`npm test` 87 파일 2157 개 통과, `npm run typecheck` 통과, 스크립트 테스트 117 개 통과; 로컬 소켓 스크립트는 각 계획 SUMMARY 에 결과가 있다).

| Task ID | Requirement | Secure Behavior | Automated Command | File Exists | Status |
|---------|-------------|-----------------|-------------------|-------------|--------|
| 04-01-T1 | VOTE-01, CONN-02 | 트레이서: 여부 투표 집계·번복·마감 분기가 실제 소켓에서 | `npx vitest run test/unit/vote.test.ts` / `--project worker test/worker/vote.test.ts` | ✅ | ✅ green |
| 04-02-T1 | VOTE-01, CONN-02 | 화면 쪽 단계 표·장면 표가 새 단계에서 app 타입 검사 초록 | `npx tsc -p tsconfig.app.json --noEmit` + `test/unit/scenes.test.ts` | ✅ | ✅ green |
| 04-02-T2 | VOTE-01, CONN-02 | discussion → night 직결 회귀를 새 흐름으로 | `npm test` | ✅ | ✅ green |
| 04-03-T1 | 전체 | 결정 0036 와이어 계약 문서 | `grep` 이름 대조(04-12-T1 에서 코드와 재대조) | ✅ | ✅ green |
| 04-03-T2 | CONN-02 | 요구사항·설계·기획 문서의 옛 표현 정정 | `grep` 문구 검사 + `test/unit/handoff.test.ts` | ✅ | ✅ green |
| 04-04-T1 | VOTE-02 | 후보 선택 집계: 자기 제외·번복·동률=후보 없음·서버 셔플 | `npx vitest run test/unit/vote.test.ts` | ✅ | ✅ green |
| 04-04-T2 | VOTE-02, VOTE-03, VOTE-04 | 공개·변론·처형 진입 훅, tick 행, view 필드 | `npx vitest run test/unit/execution.test.ts test/unit/tick.test.ts` | ✅ | ✅ green |
| 04-05-T1 | COMM-03, VOTE-03 | 변론 템플릿 여섯과 단계별 메시지 허용 | `npx vitest run test/unit/chat.test.ts` | ✅ | ✅ green |
| 04-05-T2 | VOTE-04 | 아침 문구 일곱·처형 문구 네 개 | `npx vitest run test/unit/eliminationText.test.ts` | ✅ | ✅ green |
| 04-06-T1 | END-01, CONN-02 | checkWinner 경계표(끊긴 생존자 포함) | `npx vitest run test/unit/win.test.ts` | ✅ | ✅ green |
| 04-06-T2 | END-01, END-02 | 처형·아침 마감 종료 분기, ended 진입·30분 만료 | `npx vitest run test/unit/endgame.test.ts test/unit/tick.test.ts` | ✅ | ✅ green |
| 04-06-T3 | END-02 | 판 요약과 ended 전용 result view | `npx vitest run test/unit/endgame.test.ts` | ✅ | ✅ green |
| 04-07-T1 | VOTE-02, VOTE-03, VOTE-04, COMM-03 | 후보 선택 배선(투표자에게만)과 공개·변론·처형 프레임 | `npx vitest run --project worker test/worker/vote.test.ts` | ✅ | ✅ green |
| 04-07-T2 | END-01, END-02, CONN-02 | 두 종료 경로·결과 방송·30분 정리·재접속 | `npx vitest run --project worker test/worker/endgame.test.ts` | ✅ | ✅ green |
| 04-08-T1 | VOTE-01, VOTE-02, VOTE-03 | 봇 계획: 여부·후보·후보 봇 변론 | `npx vitest run test/unit/bots.test.ts` | ✅ | ✅ green |
| 04-08-T2 | END-02 | 테스트 방 넘기기: 안 던진 봇이 먼저 던지고 분기를 따름 | `npx vitest run test/unit/testTools.test.ts` | ✅ | ✅ green |
| 04-08-T3 | VOTE-01, VOTE-02, VOTE-03, END-02 | DO 봇 실행과 테스트 방 한 판 | `npx vitest run --project worker test/worker/bots.test.ts test/worker/testTools.test.ts` | ✅ | ✅ green |
| 04-09-T1 | VOTE-01, VOTE-02, VOTE-04, END-02 | 열네 단계 허용 키 전수·익명·후보 선택 차분(4~8명 × 시드) | `npx vitest run test/unit/view.test.ts` | ✅ | ✅ green |
| 04-09-T2 | VOTE-01, VOTE-02, VOTE-04, END-02 | 처형·처형 무효·종료 한 판 전수 누출 검사 | `npx vitest run --project worker test/worker/leak.test.ts` | ✅ | ✅ green |
| 04-10-T1 | VOTE-01, CONN-02 | 스모크·uat-day·uat-night 새 단계 순서(로컬 소켓) | `node scripts/smoke.mjs http://localhost:5173 --stage full --players 5` | ✅ | ✅ green |
| 04-10-T2 | VOTE-01~04, COMM-03, END-01, END-02 | uat-vote: 처형·아침 종료 두 판을 소켓으로 끝까지(로컬) | `node scripts/uat-vote.mjs http://localhost:5173` | ✅ | ✅ green |
| 04-11-T1 | VOTE-01, VOTE-02, VOTE-03 | 수동 봇·uat-test-room 이 투표 단계·분기를 따름(로컬) | `node scripts/uat-test-room.mjs http://localhost:5173` | ✅ | ✅ green |
| 04-11-T2 | VOTE-01, END-02 | uat-test-bots 분기형 넘기기·봇 투표 검사(로컬) | `node scripts/uat-test-bots.mjs http://localhost:5173` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

서버·공유 로직 웨이브(04-01~04-12)의 표다. 화면 계획이 Add more plans 로 더해지면 그 계획이 이 표를 이어 채운다(Manual-Only 표의 화면 몫 포함).

---

## Wave 0 Requirements

- [x] `test/unit/vote.test.ts` — 투표 집계·번복·셔플
- [x] `test/unit/win.test.ts` — `checkWinner` 경계표
- [x] `test/unit/execution.test.ts` — 진입·마감 훅, 요약
- [x] `test/worker/vote.test.ts`, `test/worker/endgame.test.ts` — 소켓 방송 범위·종료
- [x] 도우미 `stateWithVerdict()` (투표 주입)

프레임워크 설치는 필요 없다.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 화살표 공개·카드 낙하·스포트라이트 연출 | VOTE-02/03 | 화면 웨이브(시안 승인 후) 범위, 실기기 확인 | 화면 웨이브의 UI-SPEC·E2E 에서 다룸 |
| 배포본에서 한 판 끝까지 | END-01/02 | 서버 단독 배포 금지(D-26) | 화면 웨이브 배포 뒤 smoke·UAT |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] frontmatter 의 nyquist_compliant 가 true

**Approval:** 서버·공유 로직 웨이브 승인(04-12). 화면 웨이브는 화면 계획이 이어서 채운다.

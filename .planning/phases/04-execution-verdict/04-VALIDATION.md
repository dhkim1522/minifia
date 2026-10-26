---
phase: "4"
slug: "execution-verdict"
status: draft
nyquist_compliant: false
wave_0_complete: false
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

작업 ID는 계획(PLAN.md) 확정 뒤 채운다. 요구사항별 시험 매핑:

| Requirement | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|-------------|-----------------|-----------|-------------------|-------------|--------|
| VOTE-01 | 과반=찬성×2>던진 표, 번복 시 마지막 값, 익명(개인 표 마감 시 삭제) | unit/worker | `npx vitest run test/unit/vote.test.ts` / `--project worker test/worker/vote.test.ts` | ❌ W0 | ⬜ pending |
| VOTE-02 | 최다 득표=후보, 동률→밤, 자기 선택 거부, 서버 셔플 순서, 진행 중 투표자에게만 | unit/worker | 위와 같음 + `test/unit/execution.test.ts` | ❌ W0 | ⬜ pending |
| VOTE-03 | 변론은 후보만, 변론 템플릿은 defense 에서만 | unit | `npx vitest run test/unit/chat.test.ts` | ✅ 확장 | ⬜ pending |
| VOTE-04 | 처형 시 후보 alive=false, 문구, 직업 비공개, voteLog | unit | `npx vitest run test/unit/execution.test.ts test/unit/view.test.ts` | ❌ W0 | ⬜ pending |
| COMM-03 | 후보만 변론 메시지, 나머지 이모티콘만 | unit/worker | `npx vitest run test/unit/chat.test.ts` | ✅ 확장 | ⬜ pending |
| CONN-02 | 끊긴 사람이 있어도 tick 진행, 못 보낸 표 무효 | unit | `npx vitest run test/unit/tick.test.ts test/unit/win.test.ts` | ✅ 확장 / ❌ W0 | ⬜ pending |
| END-01 | 승패 판정표, 처형·아침 마감에서 분기 | unit | `npx vitest run test/unit/win.test.ts test/unit/tick.test.ts` | ❌ W0 | ⬜ pending |
| END-02 | `ended` 에서만 `result` 전원 공개, 방 정리 알람 | unit/worker | `npx vitest run test/unit/view.test.ts` / `--project worker test/worker/endgame.test.ts` | ❌ W0 | ⬜ pending |
| 누출 전체 | 차분(익명) 테스트, 서버 전용 키 부재, 종료 전 직업 비공개 | unit/worker | `npx vitest run test/unit/view.test.ts` / `--project worker test/worker/leak.test.ts` | ✅ 확장 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `test/unit/vote.test.ts` — 투표 집계·번복·셔플
- [ ] `test/unit/win.test.ts` — `checkWinner` 경계표
- [ ] `test/unit/execution.test.ts` — 진입·마감 훅, 요약
- [ ] `test/worker/vote.test.ts`, `test/worker/endgame.test.ts` — 소켓 방송 범위·종료
- [ ] 도우미 `stateWithVerdict()` (투표 주입)

프레임워크 설치는 필요 없다.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 화살표 공개·카드 낙하·스포트라이트 연출 | VOTE-02/03 | 화면 웨이브(시안 승인 후) 범위, 실기기 확인 | 화면 웨이브의 UI-SPEC·E2E 에서 다룸 |
| 배포본에서 한 판 끝까지 | END-01/02 | 서버 단독 배포 금지(D-26) | 화면 웨이브 배포 뒤 smoke·UAT |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

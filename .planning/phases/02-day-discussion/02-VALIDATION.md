---
phase: "02"
slug: day-discussion
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-24"
---

# Phase 02 — Validation Strategy

> 실행 중 피드백 표집을 위한 페이즈별 검증 계약. 상세 표는 `02-RESEARCH.md` 의 "Validation Architecture" 를 원천으로 한다.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.12 — 프로젝트 3개: `unit`(node) · `client`(happy-dom) · `worker`(workerd) |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run --project unit` |
| **Full suite command** | `npx vitest run && npm run typecheck` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** `npx vitest run --project unit` (또는 해당 파일 하나)
- **After every plan wave:** `npx vitest run && npm run typecheck`
- **Before `/gsd-verify-work`:** 전체 green + `node scripts/smoke.mjs --prod --stage full`
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

플래너가 PLAN.md 작성 시 채운다. 요구사항별 테스트 매핑 원천: `02-RESEARCH.md` § Phase Requirements → Test Map.

| Plan · Task | Req | Behavior | Test Type | Automated Command | File Exists | Status |
|-------------|-----|----------|-----------|-------------------|-------------|--------|
| 02-01 · T1 | DAY-02, DAY-01 | 낮 네 단계·임시 루프·진입 훅 따라잡기 | unit | `npx vitest run test/unit/tick.test.ts` | ✅ 수정 | ⬜ pending |
| 02-01 · T2 | DAY-02 | rolesInPlay·새 루프 회귀(view·alarm·leak) | unit + worker | `npx vitest run test/unit/roles.test.ts test/unit/view.test.ts` · `npx vitest run test/worker/alarm.test.ts test/worker/leak.test.ts` | ✅ 수정 | ⬜ pending |
| 02-01 · T3 | DAY-01, DAY-02 | 낮 시작 발표·DayScene 장면 유지 | client | `npx vitest run test/client/phaseScreens.test.tsx` | ✅ 수정 | ⬜ pending |
| 02-02 · T1–T2 | DAY-02 | 마감 확정 규칙표·말 바꿈·선택 검증 | unit | `npx vitest run test/unit/claim.test.ts test/unit/tick.test.ts` | ❌ W0(claim) | ⬜ pending |
| 02-03 · T1–T2 | COMM-01, COMM-02, COMM-04 | 템플릿 검증·보관 20·이모티콘·쿨다운 1999/2000 | unit | `npx vitest run test/unit/chat.test.ts` | ❌ W0 | ⬜ pending |
| 02-03 · T3 | DAY-01 | 방장 연장 1회/낮·넘기기·단계 길이 | unit | `npx vitest run test/unit/discussion.test.ts` | ❌ W0 | ⬜ pending |
| 02-04 · T1–T3 | DAY-02, DAY-01, COMM-01 | claim 단계 비공개·허용 경로 전수 누출·옛 방 정규화 | unit | `npx vitest run test/unit/view.test.ts test/unit/gameRoom.test.ts` | ✅ 수정 | ⬜ pending |
| 02-05 · T1–T3 | 전부 | 소켓 동시 공개·거부 매트릭스·이모티콘 방송·연장 알람 | worker | `npx vitest run test/worker/day.test.ts` | ❌ W0 | ⬜ pending |
| 02-06 · T1 | COMM-02 | emoji 수신·onEvent | client | `npx vitest run test/client/useRoomConnection.test.tsx` | ✅ 수정 | ⬜ pending |
| 02-06 · T2 | COMM-01, COMM-02 | 말풍선 3초·이모티콘 2초·재접속 복원 | client | `npx vitest run test/client/seatFloats.test.tsx` | ❌ W0 | ⬜ pending |
| 02-06 · T3 | COMM-01 | 문장 만들기(은/는, 이었/였, 빈칸) | unit | `npx vitest run test/unit/messageText.test.ts` | ❌ W0 | ⬜ pending |
| 02-07 · T1–T3 | DAY-02, COMM-01, COMM-02 | 말풍선·이모티콘 층·주장 알약·완료 알약·칩 | client | `npx vitest run test/client/table.test.tsx test/client/chip.test.tsx` | ✅/❌ W0(chip) | ⬜ pending |
| 02-08 · T1–T2 | DAY-02 | 칩 낙관적 선택·완료 알약·공개 연출 | client | `npx vitest run test/client/claimPanel.test.tsx test/client/dayScene.test.tsx` | ❌ W0 | ⬜ pending |
| 02-10 · T1–T2 | COMM-01, COMM-02 | 시트 누르기 횟수·payload·트레이 | client | `npx vitest run test/client/quickMessageSheet.test.tsx test/client/emojiTraySheet.test.tsx` | ❌ W0 | ⬜ pending |
| 02-09 · T1–T3 | DAY-01, COMM-01, COMM-02, COMM-04 | 로그·말풍선·합산 쿨다운·오류 표시·방장 줄 | client | `npx vitest run test/client/discussion.test.tsx` | ❌ W0 | ⬜ pending |
| 02-11 · T1 | 전부 | 배포본 낮 한 바퀴(5명·4명) | smoke | `node scripts/smoke.mjs --prod --stage full` · `--players 4` | ✅ 수정 | ⬜ pending |

모든 tdd 작업은 해당 테스트 파일을 먼저 만들어(RED) 실패를 확인한 뒤 구현한다 — 위 ❌ W0 파일은 그 작업의 첫 커밋이 만든다. 연속 세 작업이 자동 검증 없이 이어지는 구간은 없다.

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `test/unit/{claim,chat,discussion,messageText}.test.ts` — 새 순수 함수
- [ ] `test/worker/day.test.ts`, `test/worker/helpers.ts` — 낮 단계 진행·검증 거부·누출 통합, `advanceTo` 헬퍼
- [ ] `test/client/{day,quickMessageSheet,seatFloats}.test.tsx` 및 `RoomView` 픽스처 정리
- [ ] 기존 테스트 개정: `tick`, `view`, `alarm`, `leak`, `useRoomConnection`, `phaseScreens`, `roomScreen`
- [ ] `scripts/smoke.mjs` 의 `PHASE_ORDER`·`day` 종착 단언 갱신

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 8명 360px 알약 겹침, 360×640 스크롤 없음, 말풍선 클램프, 주장 알약 최대 폭 | DAY-01, COMM-01 | 실기기 레이아웃 | UI-SPEC backstop 5건을 실기기에서 확인 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

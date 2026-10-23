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

| Req | Behavior | Test Type | Automated Command | File Exists | Status |
|-----|----------|-----------|-------------------|-------------|--------|
| DAY-01 | 방장만 연장·넘기기, 연장 1회/낮 | unit + worker | `npx vitest run test/unit/discussion.test.ts test/worker/day.test.ts` | ❌ W0 | ⬜ pending |
| DAY-02 | 직업 선택·말 바꿈·마감 전 누출 방지 | unit + worker | `npx vitest run test/unit/claim.test.ts test/unit/view.test.ts` | ❌ W0 | ⬜ pending |
| COMM-01 | 템플릿 검증·문장 만들기·최근 20개 보관 | unit + client | `npx vitest run test/unit/chat.test.ts test/unit/messageText.test.ts` | ❌ W0 | ⬜ pending |
| COMM-02 | 이모티콘 방송·표시 | worker + client | `npx vitest run test/worker/day.test.ts test/client/seatFloats.test.tsx` | ❌ W0 | ⬜ pending |
| COMM-04 | 단계·자유 텍스트·2초 쿨다운 거부 | unit + worker | `npx vitest run test/unit/chat.test.ts test/worker/day.test.ts` | ❌ W0 | ⬜ pending |

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

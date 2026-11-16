---
phase: "22"
slug: "cleanup-single-mode"
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-11-16"
---

# Phase 22 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. 상세 매핑은 `22-RESEARCH.md` "## Validation Architecture" 가 원천이다.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.12 (unit·client·worker 프로젝트) + 로컬 E2E(`scripts/e2e`) |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run <바뀐 시험 파일들> && npm run typecheck` |
| **Full suite command** | `npm test && npm run typecheck` |
| **Estimated runtime** | ~300 seconds (전체), 빠른 실행 ~30 seconds |

---

## Sampling Rate

- **After every task commit:** 바뀐 영역의 `npx vitest run <파일들>` + `npm run typecheck`
- **After every plan wave:** `npx vitest run --project unit` / `worker` / `client` 중 닿은 것 + `npm run typecheck`
- **Before `/gsd-verify-work`:** `npm test` 전체 초록 + typecheck + 22-RESEARCH 의 바뀐 E2E 흐름(`basic-off`·`noexec`·`politics-pin`·`politics-verdict`·`vote-count`·`will-flow`·`ghost`·`sound-script`·`emcee-leak`·`result`)
- **Max feedback latency:** 60 seconds (빠른 실행 기준)

---

## Per-Task Verification Map

계획자가 PLAN 작성 후 채운다. 성공 기준(SC1~SC6) → 시험 매핑은 `22-RESEARCH.md` "Phase Requirements → Test Map" 표를 따른다.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] 정규화 시험(옛 방 → 대기실, `normalizeStoredRoom`) — SC1
- [ ] `final` 조기 종료·처형자 전용 `saveWill`·defense 채팅 잠금 시험 — SC4
- [ ] `day.verdictCount` 방송(번복 포함, 개인 표 없음) 시험 — SC3
- [ ] 새 E2E 흐름 `vote-count`·`will-flow` — SC3·SC4

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 유령 크기·옆/뒷모습이 실기기에서 자연스러운지 | SC5 | 눈 확인 | v3.0 실테스트 때 폰에서 유령으로 걸어 본다 |
| 유언 스포트라이트의 긴장감 | SC4 | 눈 확인 | v3.0 실테스트 때 처형 한 번 본다 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

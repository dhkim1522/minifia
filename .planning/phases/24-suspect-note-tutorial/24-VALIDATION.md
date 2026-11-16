---
phase: "24"
slug: "suspect-note-tutorial"
status: draft
nyquist_compliant: false
wave_0_complete: false
planned: "2026-11-17"
created: "2026-11-16"
---

# Phase 24 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. 상세 매핑은 `24-RESEARCH.md` "## Validation Architecture" 가 원천이다.

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
- **Before `/gsd-verify-work`:** `npm test` 전체 초록 + typecheck + 24-RESEARCH 의 바뀐 E2E 흐름(`basic-off`·`noexec`·`politics-pin`·`politics-verdict`·`vote-count`·`will-flow`·`ghost`·`sound-script`·`emcee-leak`·`result`)
- **Max feedback latency:** 60 seconds (빠른 실행 기준)

---

## Per-Task Verification Map

계획자가 PLAN 작성 후 채운다. 성공 기준(ROADMAP 24 의 4개) → 시험 매핑은 `24-RESEARCH.md` "## Validation Architecture" 를 따른다.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `postit` 서버 규칙·`suspect` 메시지·view 누설 시험(둘째 날부터, 근처, 하루 한 장, 옮기기)
- [ ] 포스트잇 텍스처 주입식 시험 도우미(happy-dom 에 canvas 없음), `palette.test.ts` 좌석 8색 대조
- [ ] 튜토리얼 정적 가드(서버로 아무것도 보내지 않음)와 가짜 view 시험 도우미
- [ ] `perf-run --notes N` 옵션
- [ ] 새 E2E 흐름(suspect-note·tutorial-solo)과 기록 시트 개명 영향(`data-log-day`, 하네스)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 포스트잇이 캐릭터에 붙은 모양·크기가 폰에서 읽히는지 | SC2 | 눈 확인 | v3.0 실테스트 때 둘째 날 [의심] |
| 튜토리얼이 익사이팅하게 느껴지는지 | SC3 | 눈 확인 | 실테스트 때 [혼자 하기] |
| 배포본 한 판 + `npm run games -- --remote` 한 줄 | SC4 | 외부 계정 | 사용자 로그인 후 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

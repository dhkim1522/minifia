---
phase: "23"
slug: "keyword-day-one"
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-11-16"
---

# Phase 23 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. 상세 매핑은 `23-RESEARCH.md` "## Validation Architecture" 가 원천이다.

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
- **Before `/gsd-verify-work`:** `npm test` 전체 초록 + typecheck + 23-RESEARCH 의 바뀐 E2E 흐름(`basic-off`·`noexec`·`politics-pin`·`politics-verdict`·`vote-count`·`will-flow`·`ghost`·`sound-script`·`emcee-leak`·`result`)
- **Max feedback latency:** 60 seconds (빠른 실행 기준)

---

## Per-Task Verification Map

계획자가 PLAN 작성 후 채운다. 성공 기준(ROADMAP 23 의 8개) → 시험 매핑은 `23-RESEARCH.md` "## Validation Architecture" 를 따른다.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `keywords`·`keywordGuard` 단위 시험(한 글자 키워드 없음, 12자소 상한, 우회 표기 표)
- [ ] D1 마이그레이션 적용 setup(`readD1Migrations`/`applyD1Migrations`)과 `recordGame` 시험
- [ ] 키워드 누설 시험(마피아 소켓 모든 프레임·http preview 에 정답 부재, 역할만 다른 두 판의 `day.keyword` 열 동일)
- [ ] 조기 진행 시험(키워드·찬반·밤, 봇 제외, 번복 연장은 찬반만) 과 nightLeak 형 종료 시각 시험
- [ ] 새 E2E 흐름(키워드 카드·입력·공개·정답 공개·조기 진행)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 키워드 카드·공개 목록이 실기기에서 읽기 쉬운지, 키보드가 열린 664 이하 폰 | SC1 | 눈 확인 | v3.0 실테스트 때 폰으로 첫날 한 판 |
| 자동 열린 "첫날 답" 시트가 토론 입력을 가리는 정도 | SC4 | 눈 확인 | 실테스트 때 확인(UI-SPEC unresolved) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

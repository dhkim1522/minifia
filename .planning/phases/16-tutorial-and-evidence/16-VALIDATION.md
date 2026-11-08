---
phase: "16"
slug: "tutorial-and-evidence"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-11-08"
---

# Phase 16 — Validation Strategy

> 실행 중 피드백 표본을 정하는 페이즈별 검증 계약이다. 원천은 `16-RESEARCH.md` 의 "Validation Architecture" 절이다.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.12 — 프로젝트 3개(`unit` node · `client` happy-dom · `worker` cloudflare-vitest-plugin), E2E 는 node 내장 test(`scripts/e2e/*.test.mjs`) |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run <바뀐 시험 파일>` |
| **Full suite command** | `npm run typecheck && npm test` |
| **Estimated runtime** | 파일 단위 수초, 전체 vitest 수 분, 로컬 E2E 6종 전체 약 21분(제한 27분) |

---

## Sampling Rate

- **매 태스크 커밋 뒤:** 바뀐 파일의 시험 한두 개를 `npx vitest run <file>` 로 돌린다.
- **매 웨이브 뒤:** `npm run typecheck && npm test` 를 돌리고, 로컬 E2E 는 바뀐 흐름만 `npm run e2e -- --url http://localhost:5173 --only <흐름>` 으로 돌린다.
- **`/gsd-verify-work` 전:** 전체 `npm test` 가 초록이어야 한다. 로컬 E2E 6종 전체는 페이즈 끝에 한 번 돌린다. 배포본은 smoke 와 바뀐 흐름만 돌린다(결정 0076, 무료 한도).
- **최대 피드백 지연:** 태스크 단위 60초 안쪽(파일 단위 vitest).

---

## Per-Task Verification Map

> 태스크 ID 는 계획이 확정되면 플래너·실행기가 채운다. 아래는 요구사항별 기준 명령이다.

| Requirement | Behavior | Test Type | Automated Command | File Exists | Status |
|-------------|----------|-----------|-------------------|-------------|--------|
| TOOL-04 | `[data-tool-label]` 0건, 모든 button 에 접근성 이름 | client + e2e | `npx vitest run test/client/toolLabels.test.tsx` · `--only host,lobby` | ✅ 뒤집기 | ⬜ pending |
| BTN-01/02 | 머리 44 정사각 둘, 오른쪽 열 52 원, 손님에게 맵·봇 없음, 띠와 교차 0 | client + e2e | `npx vitest run test/client/lobby.test.tsx test/client/mapChip.test.tsx test/client/soundButton.test.tsx test/client/sideColumn.test.tsx` | ✅ 수정 / ❌ W0 `sideColumn` | ⬜ pending |
| ASSET-01 | 장소 16·조각 9 의 id·aria-label 1:1, 사본·JSX 일치 | unit | `npx vitest run test/unit/placeArt.test.ts` | ❌ W0 | ⬜ pending |
| ERRAND-06/07 | 시작 카드·타일·화살표·장소 위 [처리]·진행 점 | client + e2e | `npx vitest run test/client/errandScreen.test.tsx test/client/errandParts.test.tsx` · `--only errand` | ✅ 수정 | ⬜ pending |
| ERRAND-08 | 가짜 장소 처리 제외, 응답 모양 동일, 마피아 봇 2/3, 역할 누설 없음 | unit + worker | `npx vitest run test/unit/errand.test.ts test/unit/errandFake.test.ts test/worker/errand.test.ts test/worker/errandLeak.test.ts` | ✅ 수정 / ❌ W0 `errandFake` | ⬜ pending |
| EVID-01/02 | `errandLast`·`morning.seen`·`day.evidence` 공개 값, 같은 옷 표시 | unit + worker + client | `npx vitest run test/unit/trace.test.ts test/unit/view.test.ts test/worker/trace.test.ts test/client/evidenceCard.test.tsx` | ✅ 수정 / ❌ W0 | ⬜ pending |
| EVID-03 | 사회자 문구 키(`discussion.evidence` 등) | unit | `npx vitest run test/unit/hostLine.test.ts` | ✅ 수정 | ⬜ pending |
| DEPLOY-04 | view 키 허용 목록·누설 검사 확장 | worker + unit | `npx vitest run test/worker/leak.test.ts test/worker/errandLeak.test.ts test/unit/e2eContract.test.ts` | ✅ 수정 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `test/unit/placeArt.test.ts` — 장소 16·조각 9 매핑, aria-label ↔ `PLACE_NAME`/`TRACE_TEXT`, 서로 다른 그림
- [ ] `test/unit/errandFake.test.ts` — 배정 결정성(같은 상태 → 같은 가짜), 시민에게 없음, 난수 호출 수 불변, `.role` 은 이 모듈에서만 읽음
- [ ] `errandLast` 갱신·소비 시험(`test/unit/errand.test.ts` 확장) — 가장 가까운 관찰자, 동률이면 낮은 좌석, `enterNight` 보존, `enterMorning` 소비, 피해자 없음
- [ ] `test/client/sideColumn.test.tsx`·`test/client/evidenceCard.test.tsx` — 열 규칙(손님 둘 / 방장 넷), 표시 아이콘
- [ ] 에셋 변환 스크립트 `--check`(사본·JSX 일치)를 시험으로 고정

*프레임워크 설치는 필요 없다.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 장소 16개가 실제 폰에서 서로 다른 사물로 읽힌다 | ASSET-01 | 그림을 알아보는 일은 사람 눈으로만 판정한다 | v3.0 실테스트에서 폰 6종 크기 스크린샷과 실기기로 본다(UI-SPEC #20 backstop) |
| 같은 옷·목격 표시가 토론에서 실제로 의심의 근거가 된다 | EVID-01/02 | 게임 경험 판정 | v3.0 실테스트(사람 2~3 + 봇)에서 관찰한다 |

---

## Validation Sign-Off

- [ ] 모든 태스크에 `<automated>` 검증이 있거나 Wave 0 의존이 있다
- [ ] 표본 연속성: 자동 검증 없는 태스크가 3개 연속으로 나오지 않는다
- [ ] Wave 0 이 모든 MISSING 참조를 덮는다
- [ ] watch 모드 플래그가 없다
- [ ] 피드백 지연 60초 미만
- [ ] 프런트매터에 `nyquist_compliant: true` 를 둔다

**Approval:** pending

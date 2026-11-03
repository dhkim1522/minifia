---
phase: "09"
slug: "night-morning"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-11-03"
---

# Phase 09 — Validation Strategy

> 실행 중 피드백 샘플링을 위한 페이즈별 검증 계약. 원천은 `09-RESEARCH.md` 의 `## Validation Architecture`(메타모픽 누설 검사 설계 포함).

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
| **기준선** | 8페이즈 종료 시 vitest 143 파일 / 3897 통과 / 1 건너뜀; node --test 288 통과 (이번 페이즈 시작 때 재측정) |

---

## Sampling Rate

- **After every task commit:** 바꾼 파일의 테스트 + 해당 쪽 `tsc`(앱 `tsconfig.app.json` 또는 워커 `tsconfig.worker.json`)
- **After every plan wave:** Full suite command + `npm run tokens:check`
- **Before `/gsd-verify-work`:** 전체 + 로컬 E2E(`--only` 밤·아침 흐름) + 배포본 smoke/E2E + 렌더 게이트(크롬 4× 스로틀) 초록
- **Max feedback latency:** 180 seconds

---

## Per-Task Verification Map

> 작업 ID 는 계획 확정 뒤 채운다. 아래는 요구사항 단위 검증 지도(RESEARCH 그대로).

| Requirement | Behavior | Test Type | Automated Command | File Exists | Status |
|-------------|----------|-----------|-------------------|-------------|--------|
| NIGHT-07 | 마피아 이동은 {산 마피아, 유령}에게만, 시민 편 소켓 0프레임, 산 시민 move 거절, 시민 snap 본인 한 칸 | worker + unit | `npx vitest run test/worker/nightLeak.test.ts test/unit/audience.test.ts test/unit/movement.test.ts` | ❌ W0 / 개정 | ⬜ pending |
| NIGHT-07 | 메타모픽: 마피아 무행동 vs 활동 시 시민 프레임 열 동일 + 재접속 첫 프레임 열 동일 | worker | `npx vitest run test/worker/nightLeak.test.ts -t "메타모픽"` | ❌ W0 | ⬜ pending |
| NIGHT-07 | 토론 끝 자리 `home` 캡처·저장·복원(걷던 사람, 알람 지연, 퇴거) | unit + worker | `npx vitest run test/unit/world.test.ts test/worker/world.test.ts -t home` | 개정 + ❌ | ⬜ pending |
| NIGHT-08 | `confirmedTarget` 표(1~3마피아, 미선택, 불일치, 탈락·마피아 대상), 난수 0회 | unit | `npx vitest run test/unit/night.test.ts` | 개정 | ⬜ pending |
| NIGHT-08 | 불일치 밤 무사, 일치 밤 사망, 의사 보호, 경찰 조사 유지 | worker | `npx vitest run test/worker/night.test.ts` | 개정 | ⬜ pending |
| NIGHT-09 | 경찰·의사 선택 규칙 유지, 선택은 본인(+관전)에게만 | unit + worker | `npx vitest run test/unit/night.test.ts test/worker/night.test.ts` | 기존 | ⬜ pending |
| NIGHT-09 | `FaceList` 4열·선택 표시·`aria-pressed`·8자 이름·그림 실패 대체 | client | `npx vitest run test/client/faceList.test.tsx` | ❌ W0 | ⬜ pending |
| NIGHT-10 | 긴장 스케줄러(2~4회, 4~9초, 첫 큐 ≥5초, 난수·시계 주입, 모션 줄이기) | unit | `npx vitest run test/unit/tension.test.ts` | ❌ W0 | ⬜ pending |
| NIGHT-10 | 정적 검사: `tension.ts` 가 연결·스토어·world 프레임 모듈을 import 하지 않음 | unit | `npx vitest run test/unit/tensionStaticGuard.test.ts` | ❌ W0 | ⬜ pending |
| NIGHT-10 | 시민·경찰·의사 DOM 이 같은 어둠·맥박, 시민 편 DOM 에 내 이름표 외 이름표·역할칩 0 | client | `npx vitest run test/client/nightMap.test.tsx` | 개정 | ⬜ pending |
| NIGHT-11 | 피해자만 이펙트(`data-kill-fx`), 구출·재접속 첫 스냅샷 무이펙트, 모션 줄이기 | client + unit | `npx vitest run test/client/killFx.test.tsx test/unit/dayView.test.ts` | ❌ W0 / 개정 | ⬜ pending |
| NIGHT-12 | 쪽지: 마피아만·확정 때만 저장, 확정 아니면 폐기, 구출이면 비공개 | unit + worker | `npx vitest run test/unit/night.test.ts test/worker/will.test.ts` | ❌ W0 | ⬜ pending |
| MORN-01 | 피해자 `home` → `day.chalk`, 다음 밤 진입에서 제거, 처형엔 없음, 재접속 view 에 있음 | unit + worker | `npx vitest run test/unit/view.test.ts test/worker/night.test.ts -t 분필` | 개정 | ⬜ pending |
| MORN-02 | 사망 시 `all` 채널 카드 줄(k=will/note), 비면 없음, 재접속 `chatLog` 복원 | worker | `npx vitest run test/worker/morningCards.test.ts test/worker/chatReplay.test.ts` | ❌ W0 / 개정 | ⬜ pending |
| MORN-02 | 카드 렌더(제목·아이콘·쪽지 진홍 테두리·긴 본문 줄바꿈) | client | `npx vitest run test/client/chatPanel.test.tsx` | 개정 | ⬜ pending |
| MORN-03 | `saved` 공개, 구출 시 유언·쪽지·카드·길이가 "무사" 와 동일, 보호받은 사람 개별 프레임 0 | worker + unit | `npx vitest run test/worker/nightLeak.test.ts test/unit/view.test.ts` | ❌ / 개정 | ⬜ pending |
| MORN-04 | `morningMsOf` 표, `tick` 이 훅 뒤 상태로 마감, 구출·미선택·불일치 길이 동일 | unit + worker | `npx vitest run test/unit/phases.test.ts test/unit/tick.test.ts test/worker/nightLeak.test.ts` | 개정 | ⬜ pending |
| WILL-01 | 유언 규칙, 본인 소켓에만 `me.will`, 쓰는 동안 타인 0프레임, 죽기 전 남의 프레임에 canary 없음 | unit + worker | `npx vitest run test/unit/will.test.ts test/worker/will.test.ts test/worker/leak.test.ts` | ❌ W0 / 개정 | ⬜ pending |
| WILL-01 | `WillSheet`(100자·저장됨·IME 조합·실패 시 유지·`role="dialog"`) | client | `npx vitest run test/client/willSheet.test.tsx` | ❌ W0 | ⬜ pending |
| (공통) | 허용 목록에 새 필드 추가, 신분 행렬 행 추가 | worker | `npx vitest run test/worker/leak.test.ts test/worker/ghostLeak.test.ts` | 개정 | ⬜ pending |
| (공통) | 지운 이름 재등장 방지 | unit | `npx vitest run test/unit/dayStaticGuard.test.ts` | 개정 | ⬜ pending |
| (공통) | 테스트 방 봇이 새 밤 규칙으로 한 판 자동 완주(마피아 협응) | worker + script | `npx vitest run test/worker/bots.test.ts test/unit/bots.test.ts test/unit/testTools.test.ts` | 개정 | ⬜ pending |
| (공통) | 밤·아침 화면 G·H 검사·6 폰 크기·흐름 E2E | E2E | `npm run e2e -- --url http://localhost:5173 --only night` | 개정 | ⬜ pending |
| (공통) | 낮+밤+아침 5분 평균 55fps(크롬 4× 스로틀) | script | `node scripts/perf-run.mjs …`(밤·아침 시나리오 추가) | 개정 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `test/worker/nightLeak.test.ts` — 직접 불변식·메타모픽·재접속·길이 동일성
- [ ] `test/worker/helpers.ts` — `observe`/`stable` 공유, `snapshotStorage`/`restoreStorage`, `will`·`note`·`moveAs`·`pickAs` 도우미
- [ ] `test/worker/will.test.ts`, `test/worker/morningCards.test.ts`
- [ ] `test/unit/will.test.ts`, `test/unit/tension.test.ts`, `test/unit/tensionStaticGuard.test.ts`
- [ ] `test/client/faceList.test.tsx`, `test/client/willSheet.test.tsx`, `test/client/killFx.test.tsx`
- [ ] `test/unit/e2eContract.test.ts`·`scripts/e2e/lib.test.mjs` — 새 패널 높이·표식 동기화
- [ ] 프레임워크 설치: 없음

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| iPhone 실기기 5분 55fps, 시민 편 어둠 가독, 아침 가독, 유언 시트+iOS 키보드, 얼굴 칸 누르기 | NIGHT-07·09·10, WILL-01 | 실기기·눈 | 사용자 결정(2026-11-02)으로 모든 개발 뒤 한꺼번에 — ROADMAP 백로그 999.x |
| 팀(4명 이상) 한 판 느낌 기록 | 성공 기준 5 | 사람 | 배포본에서 모든 개발 뒤, UI-SPEC 관찰 항목 ①~⑥ |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 180s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

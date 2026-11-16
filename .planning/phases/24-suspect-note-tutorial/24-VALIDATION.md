---
phase: "24"
slug: "suspect-note-tutorial"
status: planned
nyquist_compliant: true
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

계획 12개·작업 31개(2026-11-17 계획). 요구사항 열은 ROADMAP 24 성공 기준 SC1~SC4 다(요구사항 ID 없음). 모든 작업에 `<automated>` 와 `<fails_when>` 이 있고, 새 시험 파일은 각 계획의 RED 단계(tdd)가 만든다 — 별도 Wave 0 계획은 없다. worker 시험의 부하 간헐(bots·basicDay·waitHelpers·lampLeak)은 실패 파일만 단독 재실행한다. E2E 는 dev 서버(5173)가 필요하고 늘 `--url http://localhost:5173` 를 붙인다.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 24-01-T1 | 24-01 | 1 | SC1 | T-24-01·T-24-04 | 서버가 world.segs 로 거리 판정, 행위자는 소켓 playerId, strict 스키마 | unit·worker(tracer) | `npx vitest run test/unit/postit.test.ts test/unit/schemas.test.ts test/unit/soundProtocol.test.ts && npx vitest run --project worker test/worker/suspect.test.ts && npm run typecheck` | ❌ RED 에서 생성(postit·suspect) / ✅ 확장 | ⬜ pending |
| 24-01-T2 | 24-01 | 1 | SC1 | T-24-02·T-24-03·T-24-05 | 거절 여섯 사유 같은 두 프레임, 600ms 간격 조용히 버림, 다시 하기 notes 없음 | worker·unit | `npx vitest run --project worker test/worker/suspect.test.ts && npx vitest run test/unit/rematch.test.ts test/unit/testTools.test.ts test/unit/postit.test.ts` | ✅ 확장 | ⬜ pending |
| 24-01-T3 | 24-01 | 1 | SC1 | T-24-01 | 화면 근처 판정은 표시용(92% ⊂ 서버 허용 성질 시험) | unit | `npx vitest run test/unit/suspectView.test.ts && npm run typecheck` | ❌ RED 에서 생성 | ⬜ pending |
| 24-02-T1 | 24-02 | 2 | SC1 | T-24-06·T-24-07 | notes 이름 부재, 마피아·시민 프레임·키 집합 동일 | unit·worker | `npx vitest run test/unit/view.test.ts test/unit/e2eContract.test.ts && npx vitest run --project worker test/worker/leak.test.ts test/worker/suspectLeak.test.ts` | ❌ RED 에서 생성(suspectLeak) / ✅ 확장 | ⬜ pending |
| 24-02-T2 | 24-02 | 2 | SC1 | T-24-08 | D1 에 장 수만(이름·관계 없음) | unit·worker | `npx vitest run test/unit/gameLog.test.ts && npx vitest run --project worker test/worker/gameLog.test.ts test/worker/d1.test.ts && npm run typecheck` | ✅ 확장 | ⬜ pending |
| 24-03-T1 | 24-03 | 2 | SC1 | T-24-11 | pick 한 번·같은 렌더 모드 끔·send guard | client | `npx vitest run test/client/suspectUi.test.tsx && npm run typecheck` | ❌ RED 에서 생성 | ⬜ pending |
| 24-03-T2 | 24-03 | 2 | SC1 | T-24-10 | 닉네임 텍스트 노드만, hex 없음 | client | `npx vitest run test/client/suspectUi.test.tsx test/client/icon.test.tsx test/client/chatPanel.test.tsx && npm run typecheck` | ✅ 확장 | ⬜ pending |
| 24-03-T3 | 24-03 | 2 | SC1 | T-24-09·T-24-10 | 거절 한 문구(BAD_MESSAGE), 분기 순서, 귓속말 배타 | client | `npx vitest run test/client/suspectUi.test.tsx test/client/gameMap.test.tsx test/client/whisperUi.test.tsx && npm run typecheck` | ✅ 확장 | ⬜ pending |
| 24-04-T1 | 24-04 | 2 | SC2 | T-24-12·T-24-13 | 텍스처 1·재질 8 캐시, 종이에 역할·닉네임 없음 | unit | `npx vitest run test/unit/palette.test.ts test/unit/postit3d.test.ts && npm run typecheck` | ❌ RED 에서 생성(postit3d) / ✅ 확장 | ⬜ pending |
| 24-04-T2 | 24-04 | 2 | SC2 | T-24-12 | 보이는 3장 상한, 유령 뗌, 공유 객체 해제 안 함 | unit | `npx vitest run test/unit/postit3d.test.ts test/unit/character.test.ts test/unit/characterBudget.test.ts && npm run typecheck` | ✅ 확장 | ⬜ pending |
| 24-05-T1 | 24-05 | 3 | SC2 | T-24-14·T-24-15 | 훅은 공개 장 수만, 같은 목록 재호출 없음 | unit·client | `npx vitest run test/unit/presence.test.ts test/client/postitRuntime.test.tsx test/client/ghostView.test.tsx && npm run typecheck` | ❌ RED 에서 생성(postitRuntime) / ✅ 확장 | ⬜ pending |
| 24-05-T2 | 24-05 | 3 | SC2 | T-24-12 | 최악 장면을 같은 조건으로 잴 수 있음 | unit·node | `npx vitest run test/unit/perfScenario.test.ts && node scripts/perf-run.mjs --notes 9 2>&1 \| grep -c '0~8 정수' && npm run typecheck` | ✅ 확장 | ⬜ pending |
| 24-06-T1 | 24-06 | 2 | SC1 | T-24-16·T-24-17 | 줄 닉네임 텍스트 노드, 공개 suspectLog 만 | client | `npx vitest run test/client/roleCardSheet.test.tsx test/client/roomScreen.test.tsx && npm run typecheck` | ✅ 수정 | ⬜ pending |
| 24-06-T2 | 24-06 | 2 | SC1 | T-24-18 | 하네스 두 제목 닫기, 꺼진 장치 접두 회피 | node | `node --test scripts/e2e/keyword.test.mjs scripts/e2e/lib.test.mjs` | ✅ 수정 | ⬜ pending |
| 24-07-T1 | 24-07 | 2 | SC3 | T-24-21 | 대본은 로컬 상수, 시각·난수 직접 읽기 없음 | unit | `npx vitest run test/unit/tutorialScript.test.ts && npm run typecheck` | ❌ RED 에서 생성 | ⬜ pending |
| 24-07-T2 | 24-07 | 2 | SC3 | — | 링·틀 pointer-events none, hex 없음 | client | `npx vitest run test/client/focusRing.test.tsx test/client/tutorialFrame.test.tsx && npm run typecheck` | ❌ RED 에서 생성(00829164^ 되살림 포함) | ⬜ pending |
| 24-07-T3 | 24-07 | 2 | SC3 | T-24-19·T-24-20 | 모듈 그래프에 api·소켓·세션 없음, 저장 값 "1" 만 | unit | `npx vitest run test/unit/session.test.ts test/unit/tutorialStaticGuard.test.ts && npm run typecheck` | ❌ RED 에서 생성(가드) / ✅ 확장 | ⬜ pending |
| 24-08-T1 | 24-08 | 3 | SC3 | T-24-22 | send 는 로컬 어댑터뿐, 가드 진입 목록 확장 | client·unit | `npx vitest run test/client/tutorialScreen.test.tsx test/unit/tutorialStaticGuard.test.ts && npm run typecheck` | ❌ RED 에서 생성 | ⬜ pending |
| 24-08-T2 | 24-08 | 3 | SC3 | T-24-23 | 마피아 맛보기 비트 DOM 에 정답 없음 | client·unit | `npx vitest run test/client/tutorialScreen.test.tsx test/client/keywordScreen.test.tsx test/unit/tutorialScript.test.ts && npm run typecheck` | ✅ 확장 | ⬜ pending |
| 24-08-T3 | 24-08 | 3 | SC3 | T-24-22 | 하기 장면 대상 밖 inert | client·unit | `npx vitest run test/client/tutorialScreen.test.tsx test/unit/tutorialScript.test.ts && npm run typecheck` | ✅ 확장 | ⬜ pending |
| 24-09-T1 | 24-09 | 4 | SC3 | T-24-26 | 처형자 직업 노출 없음 | client·unit | `npx vitest run test/client/tutorialScreen.test.tsx test/unit/tutorialScript.test.ts test/unit/tutorialStaticGuard.test.ts && npm run typecheck` | ✅ 확장 | ⬜ pending |
| 24-09-T2 | 24-09 | 4 | SC3 | T-24-25 | 장면 9 suspect 는 어댑터로만 | client·unit | `npx vitest run test/client/tutorialScreen.test.tsx test/unit/tutorialScript.test.ts && npm run typecheck` | ✅ 확장 | ⬜ pending |
| 24-09-T3 | 24-09 | 4 | SC3 | T-24-24 | 진입은 상태 전환·봤음 키뿐, pushState 없음 | client·unit | `npx vitest run test/client/screens.test.tsx test/client/joinByLink.test.tsx test/client/lobby.test.tsx test/client/resultScreen.test.tsx test/unit/tutorialStaticGuard.test.ts && npm run typecheck` | ✅ 수정(뒤집기) | ⬜ pending |
| 24-10-T1 | 24-10 | 5 | SC1·SC2 | T-24-29 | 새 표식이 꺼진 장치 접두로 시작하지 않음, 사본 상수 대조 | node·unit | `node --test scripts/e2e/suspect.test.mjs scripts/e2e/*.test.mjs && npx vitest run test/unit/e2eContract.test.ts` | ❌ RED 에서 생성 | ⬜ pending |
| 24-10-T2 | 24-10 | 5 | SC3·SC4 | T-24-30 | 튜토리얼 진입 뒤 /api·WS 0건 판정, 회귀 묶음 덮개 | node·unit | `node --test scripts/e2e/tutorial.test.mjs scripts/e2e/batches.test.mjs scripts/e2e/*.test.mjs && npx vitest run test/unit/e2eContract.test.ts` | ❌ RED 에서 생성 | ⬜ pending |
| 24-10-T3 | 24-10 | 5 | SC1·SC2·SC3 | T-24-27·T-24-28 | 로컬 주소만, 판정 완화 금지, 종이 draw call 증가 ≤ 8 | e2e·perf | `npm run e2e -- --url http://localhost:5173 --only suspect,tutorial && npm run e2e -- --url http://localhost:5173 --only keyword,day,basic-off,chat-game,ghost && npx vitest run test/unit/postit3d.test.ts` | ✅ (T1·T2 가 만든 흐름) | ⬜ pending |
| 24-11-T1 | 24-11 | 6 | SC1~SC4 | T-24-31 | 위생 git grep 출력 0, 패턴 원문 미기재 | doc check | `node -e …`(24-11 T1 automated — 0092 결정 줄 ≥ 15·필수 이름 10개) | ❌ 생성(0092) | ⬜ pending |
| 24-11-T2 | 24-11 | 6 | SC1~SC4 | T-24-31·T-24-32 | 문서에 식별자·토큰 없음 | doc check | `grep -c '포스트잇' docs/architecture.md && grep -c 'data-log-day' docs/screen-map.md && grep -c 'data-log-day' .planning/phases/24-suspect-note-tutorial/24-UI-SPEC.md && grep -c '혼자 하기' docs/product.md` | ✅ 수정 | ⬜ pending |
| 24-12-T1 | 24-12 | 7 | SC4 | T-24-37 | 전체 E2E 는 로컬에서만 | full·e2e(5묶음) | `npm run typecheck && node --test scripts/*.test.mjs scripts/e2e/*.test.mjs && npm run e2e -- --url http://localhost:5173 --only <REGRESSION_BATCHES 5묶음 차례로>`(계획 automated 에 다섯 문자열 그대로) | ✅ | ⬜ pending |
| 24-12-T2 | 24-12 | 7 | SC4 | T-24-33·T-24-34·T-24-35·T-24-36 | 정지 조건(check-account 실패 시 외부 변경 0), 가드 우회 금지, id 비커밋, 중복 생성 금지 | deploy·smoke | `node scripts/smoke.mjs --prod --print-version` (+ 경로별 acceptance) | ✅ | ⬜ pending |
| 24-12-T3 | 24-12 | 7 | SC4 | T-24-35·T-24-38·T-24-39 | HANDOFF·0092 에 id·계정 값 없음, 위생 출력 0, v3 만 push | unit·doc check | `npx vitest run test/unit/handoff.test.ts && node -e …`(0092 에 배포 버전 또는 배포 보류 줄) | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

별도 Wave 0 계획 없이 각 계획의 RED 단계가 먼저 만든다(만드는 계획을 적었다).

- [ ] `postit` 서버 규칙·`suspect` 메시지 시험 — 24-01 T1·T2(`test/unit/postit.test.ts`·`test/worker/suspect.test.ts`), view 누설 — 24-02 T1(`test/worker/suspectLeak.test.ts`)
- [ ] 포스트잇 텍스처 주입식 시험(가짜 2D 컨텍스트 기록기) — 24-04 T1(`test/unit/postit3d.test.ts`), `palette.test.ts` 좌석 8색 대조 — 24-04 T1
- [ ] 튜토리얼 정적 가드와 가짜 스테이지 도우미 — 24-07 T3(`test/unit/tutorialStaticGuard.test.ts`·`test/helpers/fakeTutorialStage.ts`), 가짜 view — 24-07 T1
- [ ] `perf-run --notes N` 옵션 — 24-05 T2
- [ ] 새 E2E 흐름(`suspect`·`suspect-sizes`·`tutorial`) — 24-10 T1·T2, 기록 시트 개명 영향(`data-log-day`, 하네스) — 24-06 T2, 전체 회귀 다섯 묶음 덮개 — 24-10 T2(`scripts/e2e/batches.test.mjs`)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 포스트잇이 캐릭터에 붙은 모양·크기가 폰에서 읽히는지 | SC2 | 눈 확인 | v3.0 실테스트 때 둘째 날 [의심] |
| 튜토리얼이 익사이팅하게 느껴지는지 | SC3 | 눈 확인 | 실테스트 때 [혼자 하기] |
| 배포본 한 판 + `npm run games -- --remote` 한 줄 | SC4 | 외부 계정 | 사용자 로그인 후 |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (31/31, 모두 `<fails_when>` 짝)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (RED 단계가 만드는 파일을 표 "File Exists" 열에 표시)
- [x] No watch-mode flags (`vitest run` 만)
- [ ] Feedback latency < 60s — 단위·클라이언트 빠른 실행은 60초 안. 예외: 24-10 T3·24-12 T1(브라우저 E2E)·24-12 T2(배포)는 수 분~수십 분
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

---
phase: "4"
slug: "execution-verdict"
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-10-26"
---

# Phase 4 — Validation Strategy

> 실행 중 피드백 표본 추출 계약. 상세 근거와 요구사항별 시험 표는 `04-RESEARCH.md` §Validation Architecture.
> 04-01~04-12 는 서버·공유 로직 웨이브, 04-13~04-34 는 화면 웨이브(D-26: 둘은 한 단위로만 배포, 배포는 04-35).

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

작업 ID 는 `{계획}-T{번호}` 이다. 04-01~04-12 상태는 04-12 에서 돌린 결과 기준이다(`npm test` 87 파일 2157 개 통과, `npm run typecheck` 통과, 스크립트 테스트 117 개 통과). 04-13~04-34 상태는 각 계획 SUMMARY 의 실행 결과와 04-34 배포 직전 게이트(SUMMARY 에 숫자)를 근거로 한다. 로컬 소켓 스크립트 결과는 각 계획 SUMMARY 에 있다.

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
| 04-13-T1 | VOTE-01, VOTE-02, VOTE-03, VOTE-04, END-01, END-02 | 상수·공개 시간표·확정 판정·기하·후광 상한 | `npx vitest run --project unit test/unit/verdict.test.ts` | ✅ | ✅ green |
| 04-13-T2 | VOTE-01, VOTE-02, VOTE-03, VOTE-04, END-01, END-02 | 문구 정본 VERDICT_TEXT 와 문구 함수 — 집계 줄·공개 문구·무효 이유·결과·판 요약 | `npx vitest run --project unit test/unit/verdict.test.ts` | ✅ | ✅ green |
| 04-14-T1 | VOTE-01, VOTE-03, END-02 | 색 토큰 세 개와 usage 개정 — 앰버 면·원뿔 색 | `npm run tokens:check` | ✅ | ✅ green |
| 04-14-T2 | VOTE-01, VOTE-03, END-02 | PHASE_SCENE 투표 다섯 단계 → dusk, ended → night, EXPECTED_SCENE 동기 | `npx vitest run --project unit test/unit/scenes.test.ts test/unit/backdropContrast.test.ts` | ✅ | ✅ green |
| 04-14-T3 | VOTE-01, VOTE-03, END-02 | dusk 배경 미리 받기 — 낮 토론 진입 때 같은 요청 하나 | `npx vitest run --project unit test/unit/assets.test.ts` | ✅ | ✅ green |
| 04-15-T1 | VOTE-01, VOTE-02, END-01, END-02 | 봇 규칙과 방장 도구 규칙 — 고정 투표, 넘기기가 따름, 대기실 복귀가 유지 | `npx vitest run --project unit test/unit/bots.test.ts test/unit/testTools.test.ts test/unit/tick.test.ts` | ✅ | ✅ green |
| 04-15-T2 | VOTE-01, VOTE-02, END-01, END-02 | 와이어·스키마·뷰·방 DO 처리기 — testBotVote 메시지와 me.testBotVote | `npx vitest run --project unit test/unit/view.test.ts` | ✅ | ✅ green |
| 04-15-T3 | VOTE-01, VOTE-02, END-01, END-02 | 한 판 소켓 시험과 누출 시험 — 넘기기가 설정을 따라 분기한다 | `npx vitest run --project worker test/worker/testTools.test.ts test/worker/leak.test.ts test/worker/bots.test.ts` | ✅ | ✅ green |
| 04-16-T1 | VOTE-01, CONN-02 | 트레이서 — 처형 여부 투표 한 경로: 방 화면 라우팅 → 장면 조립 → 하단 패널 → execVote 메시지 | `npx vitest run --project client test/client/execVote.test.tsx` | ✅ | ✅ green |
| 04-16-T2 | VOTE-01, CONN-02 | 관전·마감·집계 팝·오류 토스트·좌석 기록 카드 — execVote 화면의 나머지 상태 | `npx vitest run --project client test/client/execVote.test.tsx test/client/phaseScreens.test.tsx test/client/dayScene.test.tsx` | ✅ | ✅ green |
| 04-17-T1 | VOTE-01, VOTE-02 | 테스트 시트에 봇 처형 투표·봇 후보 선택 칩 그룹 | `npx vitest run --project client test/client/testTools.test.tsx` | ✅ | ✅ green |
| 04-18-T1 | VOTE-02, CONN-02 | DayTable 후광 종류(halo) 확장 + 앰버 후광 변수 + 낙관적 선택 훅 | `npx vitest run --project client test/client/dayTable.test.tsx test/client/nightScene.test.tsx test/client/dayScene.test.tsx` | ✅ | ✅ green |
| 04-18-T2 | VOTE-02, CONN-02 | 후보 선택 하단 — 안내와 확정 알약, 관전 모양 | `npx vitest run --project client test/client/candidateVote.test.tsx test/client/nightScene.test.tsx test/client/morning.test.tsx` | ✅ | ✅ green |
| 04-18-T3 | VOTE-02, CONN-02 | candidateVote 단계 연결 — 라우팅·장면 조립·좌석 탭 선택·흰 후광·관전 좌석 | `npx vitest run --project client test/client/candidateVote.test.tsx test/client/execVote.test.tsx test/client/dayScene.test.tsx test/client/nightScene.test.tsx` | ✅ | ✅ green |
| 04-19-T1 | VOTE-02 | useRevealState 훅과 DayTable 표수 칩 | `npx vitest run --project client test/client/dayTable.test.tsx test/client/reveal.test.tsx` | ✅ | ✅ green |
| 04-19-T2 | VOTE-02 | candidateVoteReveal 단계 연결 — 칩·앰버 후광·끝 문구·좌석 탭 비활성·읽기 안내 | `npx vitest run --project client test/client/reveal.test.tsx test/client/candidateVote.test.tsx test/client/execVote.test.tsx` | ✅ | ✅ green |
| 04-20-T1 | VOTE-02 | 화살표 층 RevealLayer + useReducedMotion + DayTable layer 슬롯 | `npx vitest run --project client test/client/revealLayer.test.tsx test/client/dayTable.test.tsx` | ✅ | ✅ green |
| 04-20-T2 | VOTE-02 | 과반 확정 두근(캐릭터·칩·후광)과 느린 박동, 진동, 축소 모션 대체 | `npx vitest run --project client test/client/reveal.test.tsx test/client/revealLayer.test.tsx test/client/dayTable.test.tsx` | ✅ | ✅ green |
| 04-21-T1 | VOTE-03, COMM-03, CONN-02 | DayTable verdict 층(어둡게+흐림+원뿔)과 center 좌석 — 후보 가운데 이동 | `npx vitest run --project client test/client/dayTable.test.tsx test/client/morning.test.tsx test/client/nightScene.test.tsx` | ✅ | ✅ green |
| 04-21-T2 | VOTE-03, COMM-03, CONN-02 | 변론 중 이모티콘·말풍선·채팅 수집 + 남의 변론 하단 DefensePanel | `npx vitest run --project client test/client/seatFloats.test.tsx test/client/defense.test.tsx test/client/turnPanel.test.tsx` | ✅ | ✅ green |
| 04-21-T3 | VOTE-03, COMM-03, CONN-02 | defense 단계 연결 — 라우팅·장면 조립·후보 흰 후광·층 규칙·안내 | `npx vitest run --project client test/client/defense.test.tsx test/client/reveal.test.tsx test/client/candidateVote.test.tsx test/client/execVote.test.tsx` | ✅ | ✅ green |
| 04-22-T1 | COMM-03, VOTE-03 | DefenseChips — 칩 6개·즉시 전송/시트 전송·보냈어요 2초·쿨다운 잠금 | `npx vitest run --project client test/client/defenseChips.test.tsx test/client/discussion.test.tsx test/client/quickMessageSheet.test.tsx` | ✅ | ✅ green |
| 04-22-T2 | COMM-03, VOTE-03 | 후보 본인 하단 연결 — 패널 높이 236 변형과 장면 안 통합 시험 | `npx vitest run --project client test/client/defense.test.tsx test/client/defenseChips.test.tsx test/client/dayScene.test.tsx` | ✅ | ✅ green |
| 04-23-T1 | VOTE-04, END-01 | 앰버 처형 카드 변형과 사람 → 유령 400ms 전환 | `npx vitest run --project client test/client/morning.test.tsx test/client/dayTable.test.tsx` | ✅ | ✅ green |
| 04-23-T2 | VOTE-04, END-01 | execution 단계 연결 — 라우팅·가운데 유지·카드·하단·읽기 안내·직업 비노출 시험 | `npx vitest run --project client test/client/execution.test.tsx test/client/defense.test.tsx test/client/morning.test.tsx test/client/dayScene.test.tsx` | ✅ | ✅ green |
| 04-24-T1 | VOTE-01, VOTE-02 | ExecIntroCard — 낙하 → 중앙 정지 → 면 지우기 + 질문 강조 + 셰브런 → 흔적 없이 사라짐 | `npx vitest run --project client test/client/execIntro.test.tsx test/client/execVote.test.tsx` | ✅ | ✅ green |
| 04-24-T2 | VOTE-01, VOTE-02 | NoExecutionCard — 회색 `처형 무효` 카드 | `npx vitest run --project client test/client/noExecution.test.tsx` | ✅ | ✅ green |
| 04-24-T3 | VOTE-01, VOTE-02 | 밤 도착 연결 — 처형 무효 카드 켜기, 밤 시작 문구 1.6초 지연, 읽기 안내 접두 | `npx vitest run --project client test/client/noExecution.test.tsx test/client/sceneIntro.test.tsx test/client/nightScene.test.tsx test/client/execIntro.test.tsx` | ✅ | ✅ green |
| 04-25-T1 | END-01, END-02 | ResultScreen 핵심 — 배너·직업 카드 격자·[처음으로]와 `ended` 라우팅 | `npx vitest run --project client test/client/resultScreen.test.tsx test/client/phaseScreens.test.tsx test/client/roomScreen.test.tsx` | ✅ | ✅ green |
| 04-25-T2 | END-01, END-02 | 판 요약 카드·스크롤·배경 크로스페이드·가로 스크롤 없음 | `npx vitest run --project client test/client/resultScreen.test.tsx` | ✅ | ✅ green |
| 04-26-T1 | END-01, END-02 | 공개 상태기계 neutral → flip → done 과 카드·배너·요약 전이 | `npx vitest run --project client test/client/resultScreen.test.tsx` | ✅ | ✅ green |
| 04-26-T2 | END-01, END-02 | RoomScreen 도착 정보 연결과 전체 게이트 — 처형·아침 두 경로 | `npx vitest run --project client test/client/resultScreen.test.tsx test/client/phaseArrival.test.tsx test/client/phaseScreens.test.tsx` | ✅ | ✅ green |
| 04-27-T1 | VOTE-04 | recordRows 순수 함수와 UserRecordSheet 투표 줄 | `npx vitest run --project unit test/unit/recordRows.test.ts` | ✅ | ✅ green |
| 04-27-T2 | VOTE-04 | 장면 연결 — voteLog 전달, 열리는 단계 규칙, 단계가 바뀌면 닫기 | `npx vitest run --project client test/client/dayScene.test.tsx test/client/execVote.test.tsx test/client/candidateVote.test.tsx test/client/userRecordSheet.test.tsx` | ✅ | ✅ green |
| 04-28-T1 | CONN-02, VOTE-01, VOTE-02, VOTE-03, VOTE-04, END-01, END-02 | 단계 × 보는 사람 상태 표 시험과 결함 수정 | `npx vitest run --project client test/client/verdictStates.test.tsx` | ✅ | ✅ green |
| 04-28-T2 | CONN-02, VOTE-01, VOTE-02, VOTE-03, VOTE-04, END-01, END-02 | 새 CSS 정적 게이트 — 글자·색·층·모션·터치 통과 | `npx vitest run --project unit test/unit/verdictCss.test.ts` | ✅ | ✅ green |
| 04-29-T1 | VOTE-01, VOTE-02, CONN-02 | P1·P9(투표 하단·익명·관전)와 P2(인트로)·P3(후보 선택) 검사 함수 + 스냅숏 계약 주석 | `node --test scripts/e2e/lib.test.mjs` | ✅ | ✅ green |
| 04-29-T2 | VOTE-01, VOTE-02, CONN-02 | P4(공개) 검사와 후광·색 규칙 확장 — 앰버 허용·진홍 동료 한정·시민 방장 진홍 0 | `node --test scripts/e2e/lib.test.mjs scripts/tsc-scoped.test.mjs` | ✅ | ✅ green |
| 04-30-T1 | VOTE-03, VOTE-04, COMM-03, END-01, END-02 | P5(변론 스포트라이트·후보 패널 236)·P6(처형 카드·유령·직업 비노출) 검사와 승인 완화 P-PANEL-236 | `node --test scripts/e2e/lib.test.mjs` | ✅ | ✅ green |
| 04-30-T2 | VOTE-03, VOTE-04, COMM-03, END-01, END-02 | P7(처형 무효 카드)·P8(결과 화면)·P10(칩·카드 배치 겹침) 검사 | `node --test scripts/e2e/lib.test.mjs scripts/tsc-scoped.test.mjs` | ✅ | ✅ green |
| 04-31-T1 | VOTE-01, VOTE-02, VOTE-03, VOTE-04, COMM-03, CONN-02, END-01, END-02 | readVerdict·readTokenColors와 앰버 후광 측정 — 스냅숏 계약 구현 | `node --check scripts/e2e/browser.mjs` | ✅ | ✅ green |
| 04-31-T2 | VOTE-01, VOTE-02, VOTE-03, VOTE-04, COMM-03, CONN-02, END-01, END-02 | 조작 도우미·관찰자·시계열 표본 — 흐름이 쓰는 도구 | `node --check scripts/e2e/browser.mjs` | ✅ | ✅ green |
| 04-32-T1 | VOTE-01, VOTE-02, VOTE-03, VOTE-04, COMM-03, CONN-02, END-01 | 기존 여섯 흐름을 새 낮 루프에 적응 — 봇 처형 투표 고정, 밤 도착의 카드·문구 시각 | `node --check scripts/e2e/flows.mjs` | ✅ | ✅ green |
| 04-32-T2 | VOTE-01, VOTE-02, VOTE-03, VOTE-04, COMM-03, CONN-02, END-01 | vote5 흐름 — 여부 투표·후보 선택·공개·변론·처형을 실제 브라우저로 | `node --check scripts/e2e/flows.mjs` | ✅ | ✅ green |
| 04-33-T1 | VOTE-01, VOTE-02, VOTE-03, VOTE-04, COMM-03, CONN-02, END-01, END-02 | noexec 흐름(P7)과 spec4 확장(P9) — 처형 무효 카드와 탈락 방장의 투표 화면 | `node --check scripts/e2e/flows.mjs` | ✅ | ✅ green |
| 04-33-T2 | VOTE-01, VOTE-02, VOTE-03, VOTE-04, COMM-03, CONN-02, END-01, END-02 | result-c 흐름 — 후보 본인 변론(P5 후보 본인)·처형·시민 팀 승리 결과 화면(P8) | `node --check scripts/e2e/flows.mjs` | ✅ | ✅ green |
| 04-33-T3 | VOTE-01, VOTE-02, VOTE-03, VOTE-04, COMM-03, CONN-02, END-01, END-02 | result-m 흐름과 전체 로컬 E2E — 마피아 팀 승리 결과(P8)와 deferred-items 닫기 | `node --check scripts/e2e/flows.mjs` + `npm run e2e -- --url http://localhost:5173` (E2E OK, 10흐름×3폭) | ✅ | ✅ green |
| 04-34-T1 | VOTE-01~04, COMM-03, CONN-02, END-01, END-02 | 결정 0037(화면 웨이브 결정)과 시안 사본 갱신 | `test -f docs/decisions/0037-execution-screens.md && grep -q "되돌리기" docs/decisions/0037-execution-screens.md && grep -q "VERDICT_DIM_PERCENT" docs/decisions/0037-execution-screens.md` | ✅ | ✅ green |
| 04-34-T2 | VOTE-01~04, COMM-03, CONN-02, END-01, END-02 | 이 검증 표의 화면 웨이브 완성(작업별 자동 명령·사람 확인 몫) | `grep -cE '^\| 04-(1[3-9]\|2[0-9]\|3[0-3])-T[1-3] ' .planning/phases/04-execution-verdict/04-VALIDATION.md` (47) | ✅ | ✅ green |
| 04-34-T3 | VOTE-01~04, COMM-03, CONN-02, END-01, END-02 | 배포 직전 로컬 전체 게이트·소켓 스크립트·E2E, HANDOFF 6KB 이하와 push (배포 없음) | `npm test` + `npm run typecheck` + `npm run build` + `npx vitest run test/unit/handoff.test.ts` + `npm run e2e -- --url http://localhost:5173` | ✅ | ✅ green |
| 04-35-T1 | VOTE-01~04, COMM-03, CONN-02, END-01, END-02 | 배포 go-ahead(체크포인트): 사용자 "지금 배포" | — (사람 결정) | ✅ | ✅ green |
| 04-35-T2 | VOTE-01~04, COMM-03, CONN-02, END-01, END-02 | 개인 계정 배포·버전 변경·배포본 스모크 4·5·8·uat-vote·uat-test-bots·uat-test-room·uat-day·uat-night | `node scripts/smoke.mjs --prod --stage full [--players 4\|8] [--previous-version V]` + `node scripts/uat-{vote,test-bots,test-room,day,night}.mjs --prod` | ✅ | ⚠️ flaky (통과, 이 PC 네트워크 지터로 재실행 필요했음 — 04-35-SUMMARY) |
| 04-35-T3 | VOTE-01~04, COMM-03, CONN-02, END-01, END-02 | 배포본 화면 E2E(10흐름×3폭)와 요구사항·로드맵·HANDOFF 갱신·push | `npm run e2e`(기본 = 배포본) + `npx vitest run test/unit/handoff.test.ts` | ✅ | ✅ green (재배포 한 번 뒤: 접두 짝 `backdrop-filter` 결함 수정) |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

04-01~04-12 서버 웨이브, 04-13~04-35 화면 웨이브와 배포본 검증(04-35). 화면 웨이브의 `node --check`·`node --test` 행은 E2E 스크립트의 문법·순수 검사이고, 실제 브라우저 검사는 `npm run e2e -- --url http://localhost:5173` 전체 실행(04-33, 04-34 재확인)이 맡는다.

---

## Wave 0 Requirements

- [x] `test/unit/vote.test.ts` — 투표 집계·번복·셔플
- [x] `test/unit/win.test.ts` — `checkWinner` 경계표
- [x] `test/unit/nyquist-04-multiday-flow.test.ts` — 여러 날 연속 처형·종료 흐름과 종료 뒤 행동 거부 (감사 2026-10-30)
- [x] `test/unit/execution.test.ts` — 진입·마감 훅, 요약
- [x] `test/worker/vote.test.ts`, `test/worker/endgame.test.ts` — 소켓 방송 범위·종료
- [x] 도우미 `stateWithVerdict()` (투표 주입)

프레임워크 설치는 필요 없다.

---

## Manual-Only Verifications

통과 표시는 사람이 실기기에서 확인한 뒤에만 한다. 아래는 모두 **실기기에서 확인할 것**이다(폰 360폭 포함). 목록과 순서는 `HANDOFF.md` 의 실기기 확인 목록이 같다.

| Behavior | Requirement | Why Manual | Test Instructions | 상태 |
|----------|-------------|------------|-------------------|------|
| 연출 체감(화살표 속도·카드 낙하·두근·결과 공개) | VOTE-01/02/03, END-02 | 타이밍·느낌은 숫자 검사로 판단되지 않는다(UI-SPEC UI Considerations backstop) | 실기기에서 확인할 것: 인트로 카드 낙하·끝 연출과 찬성/반대 탭 통과, 공개 화살표·표수 칩·두근·진동, 결과 공개 연출·스크롤·[처음으로] | 사람 확인 대기 |
| `backdrop-filter` 흐림의 iOS 동작(UI-SPEC 12.3) | VOTE-03 | Safari 렌더링은 헤드리스 Chrome 으로 못 본다 | iOS Safari 에서 변론 장면의 흐림이 배경 그림까지 먹는지 본다. 안 먹으면 UI-SPEC 12.3 대체안(`VERDICT_BLUR_PX`) | 사람 확인 대기 |
| 어둡게 45%·흐림 3px 가독성(D-38) | VOTE-03, COMM-03 | E2E H1·P5 는 숫자만 본다 | 실기기에서 확인할 것: 변론 헤더·후보 이름표·칩 글씨가 읽히는지, 수치는 `src/game/verdict.ts` 한 곳 | 사람 확인 대기 |
| 후광 8명판 프레임 | VOTE-02 | 후광 3개 상한·칩 배치의 체감 | 8명판 공개 4초에서 후광·칩·화살표가 겹치지 않고 읽히는지 | 사람 확인 대기 |
| 처형 카드·유령 전환, 처형 무효 카드 → 밤 문구 순서 | VOTE-04, END-01 | 낙하 느낌·iOS·재접속은 실기기 | 실기기에서 확인할 것: 처형 앰버 카드와 유령 전환(투명 .9), 무효 회색 카드 1.6초 뒤 밤 문구 | 사람 확인 대기 |
| 배포본에서 한 판 끝까지 | END-01/02 | 서버 단독 배포 금지(D-26) | 04-35 배포본 smoke 4·5·8 · `uat-vote` · `uat-test-bots` · `uat-test-room` · `uat-day` · `uat-night` · E2E 10흐름×3폭 통과(04-35-SUMMARY). 이어서 실기기 한 판은 위 항목들로 사람이 확인 | 통과(봇·E2E 근거), 실기기 한 판은 사람 확인 대기 |

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] frontmatter 의 nyquist_compliant 가 true

- [x] 화면 웨이브(04-13~04-34): 작업별 자동 명령이 표에 있고(47 행 + 04-34 3행), 사람 확인 몫은 Manual-Only 표에 실기기 항목으로 남았다. 요구사항 체크는 04-35 배포본 검증 뒤에 했다(8개 완료).

**Approval:** 서버·공유 로직 웨이브 승인(04-12). 화면 웨이브 로컬 검증 승인(04-34, 배포 직전). 배포본 검증 승인(04-35: 스모크 4·5·8, 봇 UAT 다섯, E2E 10흐름×3폭 통과). 연출 체감·흐림 가독성·iOS 흐림은 실기기 확인 대기.

---

## Validation Audit

감사일 2026-10-30 (`/gsd-validate-phase`, State A: 기존 문서 감사).

| 항목 | 수 |
|------|----|
| 점검한 요구사항 | 8 (VOTE-01~04, COMM-03, CONN-02, END-01, END-02) |
| 완전히 덮임 (COVERED) | 7 |
| 부분 (PARTIAL) → 해결 | 1 |
| 빠짐 (MISSING) | 0 |
| 에스컬레이션 (구현 결함) | 0 |

현재 코드(결정 0030~0040 반영) 기준으로 `shared/game/{vote,execution,endgame,win,chat,tick}.ts` 의 행동을 `test/unit` · `test/worker` · `test/client` 와 대조했다. 단일 날 규칙(집계 규칙표, 검사 순서, 익명, 셔플 호출 순서, 승패 경계표, 변론 허용 메시지, 누출 전수)은 모두 시험이 있다.

**해결한 틈 (PARTIAL):** 날짜를 건너 쌓이는 기록과 청소를 한 판 연속으로 보는 시험이 없었다. 새 시험이 6명 판을 1일차 동률 무효 → 2일차 마피아 처형(미종료) → 3일차 마피아 처형 → ended 로 실제 투표·tick 으로 끝까지 돌려 다음을 확인한다. 날마다 voteLog 가 한 줄씩 쌓이고 execVote 진입에서 verdict·execution·개인 표가 비워지며, 판 요약이 날짜 오름차순으로 후보를 정확히 싣고, 모든 viewer 의 결과가 같고, 종료 뒤 여부 투표·후보 선택·지목·이모티콘이 WRONG_PHASE 로 거부된다.

- 새 시험: `test/unit/nyquist-04-multiday-flow.test.ts` (4개, 통과) — `npx vitest run test/unit/nyquist-04-multiday-flow.test.ts`
- 구현 결함 발견: 없음.
- 수동 전용(실기기 연출 체감·iOS 흐림 등)은 위 Manual-Only 표대로 갭이 아니라 사람 확인 대기 항목으로 둔다.

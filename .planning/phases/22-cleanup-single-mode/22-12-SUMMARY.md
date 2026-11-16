---
phase: 22-cleanup-single-mode
plan: "12"
subsystem: game-flow, audio, ui
tags: [execution-timeline, will-reveal-card, record-removal, voteLog, leak-guard]
requires:
  - phase: 22-11
    provides: 유언 단계(defense 10초, 처형자 turn 핀, 유언 저장)
provides:
  - 처형 시간표 한 표(phases.ts, 6.6초)와 day.execution.will
  - 유언 공개 카드(QuoteCard mv-quote--will, data-will-reveal)
  - 처형자 존재 기준 핀·판결 순간·소리·알림
  - 찬반 기록·지목 기록의 서버 저장·와이어·화면 삭제
affects: [22-13, 22-14]
tech-stack:
  added: []
  patterns:
    - "연출 켜짐 조건 = 처형자 존재(day.execution), 찬반 기록(day.ballots)이 아니다"
    - "공개 값 하나(day.execution.will)로 재접속·도착 순서 문제를 피한다(Pattern 6)"
key-files:
  created: []
  modified:
    - shared/game/phases.ts
    - shared/game/view.ts
    - shared/game/verdict.ts
    - shared/game/nomination.ts
    - shared/game/showdown.ts
    - shared/game/execution.ts
    - shared/game/resultLog.ts
    - shared/game/chatLog.ts
    - shared/protocol.ts
    - worker/room.ts
    - src/world/pinPlan.ts
    - src/game/verdictMoment.ts
    - src/net/useVerdictMoment.ts
    - src/game/dayView.ts
    - src/game/hostLine.ts
    - src/audio/audioView.ts
    - src/audio/director.ts
    - src/audio/script.ts
    - src/audio/recipes.ts
    - src/components/v2/QuoteCard.tsx
    - src/screens/GameMap.tsx
    - src/styles/v2.css
    - scripts/smoke.mjs
  deleted:
    - shared/game/ballots.ts
    - src/components/v2/BallotReveal.tsx
    - src/game/ballotsView.ts
    - src/game/timelineView.ts
    - src/components/v2/DayDetail.tsx
    - src/components/v2/TimelineStrip.tsx
decisions:
  - "처형 시간표 상수: WILL_REVEAL_MS 3000 · EXEC_ANNOUNCE_MS 3000 · EXEC_TAIL_MS 600 → EXECUTION_MS 6600, PIN_OFF_EXEC_AT 6000. VERDICT_LEAD_MS·PIN_OFF_NO_EXEC_AT·BALLOT_*_AT 삭제. 핀·판결 순간·소리·알림·smoke 사본이 이 표에서 나온다."
  - "마지막 3인(showdown) 득표자 처형도 같은 6.6초 표를 따른다. 옛 verdict.last 예외(앞머리·줌 없음)는 없앴다 — 켜짐 조건이 처형자 존재 하나라서다(D-27, P22-14)."
  - "voteLog 는 {n, exec 집계 수, cand{candidate?}, reason?} 만 저장한다. exec yes·no 는 종료 요약(SummaryRow)이 읽어 남겼다. showdown 의 처형 없음 줄은 reason(noVotes|tie)을 직접 남기고 noExecutionOf 의 votes 길이 파생을 지웠다(결선 동점은 tie 로 파생)."
  - "verdictScript 는 입력이 없다(통과·부결·마지막 3인 갈래 삭제): 심장 박동 5, 3000ms 에 gavel+rise, 덕킹은 PIN_OFF_EXEC_AT 까지. 대본 시작 조건은 AudioView.hasExecution."
  - "옛 저장 방에 남은 k ballots 채팅 레코드는 parseRecord 가 손상 레코드처럼 버린다(일반 줄로 새지 않는다). 옛 서버의 ballots resultLog 프레임은 클라이언트 PARTS 밖이라 무시된다."
metrics:
  tasks: 3
  files-touched: 110
status: complete
actuals:
  tokens: 20600
  tasks: 3
  commits: 4
plan_head_before: 8ee694fa43b7f428514f134aed3c4eb27b6c76f5
plan_head_after: ae520b1029b115cf8dbfeabe6a7953f5df566272
commits: 4
---

# Phase 22 Plan 12: 처형 시간표·유언 공개 카드·기록 삭제 Summary

처형 단계를 유언 카드 3.0초 + 처형 발표 3.0초 + 꼬리 0.6초의 6.6초 한 표로 바꾸고, 핀·판결 순간(막·줌)·소리·알림을 찬반 기록(`day.ballots`)이 아니라 처형자 존재(`day.execution`)로 켜게 했다. 처형자의 유언은 `day.execution.will` 로 모두에게 같은 공개 값이 가고(빈 유언이면 키 없음, 카드 글 "말없이 떠났어요") `QuoteCard` 변형으로 처형 시작 3.0초 동안 모든 화면에 선다. 찬반 기록(`ballots`)과 지목 기록(`voteLog` 의 개인 선택·`day.voteLog`·타임라인·하루 상세)은 서버 저장·와이어·화면·소리 어디에도 남지 않는다. 성공 기준 4(처형자 유언이 모두에게 보인 뒤 처형)와 3(기록 화면 없음)이 선다.

`commits: 4` 는 `git rev-list --count` 로 잰 값이다(이 SUMMARY 를 담는 마지막 문서 커밋은 세지 않았다).

## 커밋

| 작업 | 종류 | 커밋 | 내용 |
|------|------|------|------|
| 1 RED | test | 319e50f6 | 처형 시간표·처형자 존재 키 단언 — unit 6개 파일에서 34건 실패(308건 중) |
| 1 GREEN | feat | 41388065 | phases 시간표 표, day.execution.will, 유언 카드, 핀·판결 순간·소리·알림·띠 재키, smoke 사본 |
| 3 RED | test | e1579847 | 지목·찬반 기록 없음 단언 — nomination unit 2건 + leak worker 2건 실패 |
| 2+3 GREEN | refactor | ae520b10 | 찬반·지목 기록 삭제(D-32 의 "기록 삭제" 커밋 한 개) |

계획의 작업 2(찬반 기록 삭제)와 3(지목 기록 삭제)은 `VoteLogEntry`·`ResultLogPart`·`timelineView`/`ResultPanel` 타입이 서로 얽혀 한 번에 타입체크가 서도록 한 커밋으로 묶었다(D-32 가 허용한 "시간표·유언 카드" / "기록 삭제" 두 커밋 분할과 같다).

## 검증 결과 (실제로 돌린 것)

- RED 증거 한 줄: 작업 1 단언 34건 실패(pinPlan·verdictMoment·soundVerdict·soundScript·dayView·e2eContract), 작업 3 단언 nomination 2건·leak 2건 실패. 구현 뒤 모두 초록.
- 작업 1 verify: `npx vitest run test/unit/pinPlan ... test/worker/trial.test.ts` + `npm run typecheck` 통과.
- 작업 3 verify(최종): `npx vitest run`(전체, 단일 프로세스) — 243개 파일 중 238 통과·5 건너뜀, 7192 통과·238 건너뜀·실패 0. `node --test scripts/*.test.mjs scripts/e2e/*.test.mjs` 610/610. `npm run typecheck`(tokens:check·wrangler types·app tsc·worker tsc) 오류 0.
- 전체 실행 중간에 `waitHelpers`(봇 알람 표 덮어쓰기)가 한 번 간헐 실패했다 — 단독 재실행 통과(알려진 부하 불안정군), 회귀로 세지 않았다.
- 인수 grep: `WILL_REVEAL_MS|EXEC_ANNOUNCE_MS|EXEC_TAIL_MS`(phases) 5 · 옛 상수(VERDICT_LEAD_MS 등) 0 · `data-will-reveal`(QuoteCard) 3 · `mv-quote--will`(v2.css) 1 · smoke `EXECUTION_MS = 6_600` 1 · 삭제 파일 6개 모두 없음 · `git grep -nE "ballots|voteLogLine|BALLOT_" -- shared worker src` 0 · `git grep voteLog -- src` 0 · leak 의 `".view.day.verdict"` 0·`.view.day.execution.will` 3.
- 커밋 전 규칙 패턴 grep(변경분): 결과 없음.

## Deviations from Plan

### 자동 수정·추가

**1. [Rule 3 - 묶음] 작업 2·3 을 한 커밋으로** — 위 커밋 절 참조.

**2. [Rule 1 - 계약] 마지막 3인 처형도 같은 시간표** — 연출 켜짐 조건이 처형자 존재 하나가 되어 옛 `verdict.last` 예외(앞머리·줌·득표 없음)가 사라졌다. 득표자 유언 카드(빈 유언이면 "말없이 떠났어요")가 같은 3.0초에 선다. showdown 기본 꺼짐이라 기본판 동작은 같다.

**3. [Rule 1] 서버 저장 voteLog 정리** — `cand.votes`·`VoteLogEntry.last`·`CandidateVoteLine` 삭제. `noExecutionOf` 는 이유를 저장된 `reason` 에서 읽고(showdown 은 reason 을 직접 남긴다), 이유가 없는 결선 동점 줄만 `tie` 로 파생한다. `exec` 집계 수(yes·no·passed)는 종료 요약(`SummaryRow`)이 읽어 그대로 뒀다(D-14 의 "최소"에서 한 칸 넓은 선택 — 개인 선택은 없다).

**4. [Rule 2 - 연쇄 수정] 계획 files_modified 밖 파일** —
- `docs/audio.md`: 소리 id 56 → 54(침대 7 + 효과음 47), `ballot.yes`·`ballot.no` 행 삭제, `verdict.reject` 가 쓰이지 않는다는 주석(시험 soundProtocol 이 문서 지도와 대조한다).
- `src/styles/result.css`: `.mf-tl__*`(일차 카드 띠·하루 상세) 규칙 삭제. `src/debug/soundLab.ts`·`soundLabTable.ts`: 판결 단추를 "처형" 하나로, count 54.
- `scripts/e2e/result.mjs`·`result.test.mjs`·`lib.mjs`·`lib.test.mjs`·`sound.mjs`: 결과 표식 3개(`data-day-card`·`data-day-detail`·`data-whisper-pair`)·`TIMELINE_CARD` 삭제, `VIEW_DAY_KEYS` 에서 `voteLog`·`verdict`·`ballots` 제거, 소리 개수 54. (e2eContract 가 앱과 사본을 대조해서 같이 움직여야 했다.)
- `src/game/hostLine.ts`: `execution.failed` 키 삭제(`execution.passed` 만; 처형자 없는 처형 view 는 fallback). `src/screens/RoomScreen.tsx`(`executionAnnounceOf` 의 "처형 없음" 갈래 삭제), `ResultScreen.tsx`·`ResultPanel.tsx`(`view` prop·`LogBody` 삭제, 기록 탭 몸통은 `logSlot` 만), `chatStore`·`useChat`·`ChatLines`·`ChatPanel`·`resultLogStore`·`chatLog`·`resultLog`(ballots 종류·부분 삭제).
- `src/game/dayView.ts`: `nominationVotesOf`(결선 앞머리 후보 득표 배지, voteLog 읽기) 삭제 — 결선 마감 전 후보 머리 배지가 없어졌다(결선은 기본 꺼짐).

**5. [Rule 1] 시험 갱신** — 삭제된 모듈 전용 시험(ballots·ballotsView·ballotReveal·timelineView·dayDetail·timelineStrip·worker ballots·timelineState 도우미)을 지웠고, `view`·`leak`·`soundEngine`(ballot 소리 대신 다른 우선 1 소리)·`tick`·`hostLine`·`verdictScreen`(처형 화면·판결 순간 두 describe 를 새 표로 다시 씀)·`chat`(처형 단계 채팅 연번 1)·`resultLog` 등 기대값을 새 규칙으로 고쳤다. 새 시험: willCardOf·will 공개·빈 유언·day.points 단계 한정·voteLog 저장 키·옛 ballots 레코드 복원 버림·재접속 카드 `is-still`.

### 인증 게이트

없음.

## 22-13 / 후속으로 넘기는 것 (이월 메모)

- **`scripts/smoke.mjs` 의 옛 순서·옛 키 가정**: `EXECUTION_MS`(6_600)·주석만 이 계획에서 바꿨다. 나머지(변론 → 찬반 순서, `day.verdict`·`day.ballots`·`day.voteLog`·`k ballots` 카드 단언, `PUBLIC_KEY_PATHS.verdict`)는 22-09 이전 순서 그대로라 배포본 smoke 는 새 서버에서 실패한다. 22-13 의 e2e 사본 정리에서 한꺼번에 고친다.
- **`scripts/e2e` 의 옛 판결 가정**: `lib.mjs` `VERDICT_TIMING`(announceAt 2600)·`soundVerdictTimingChecks`(통과/부결 쌍, V4 `verdict.reject`)·`VERDICT_FAMILY` 의 `ballot.`, `flows.mjs` EX3b·`politics.mjs`·`polish.mjs` 의 `measureBallotsBackstop`·`data-card="ballots"`, `lib.test.mjs` 의 5600 판결 시간표 줄. 표식·개수·키 사본만 최소로 맞췄다.
- **`verdict.reject` 소리 고아**: 찬반 부결에는 처형 단계가 없어 이 소리를 내는 곳이 없다(레시피·문서 행은 남김). 부결 → 밤 진입에서 낼지 지울지 결정 거리.
- **유언 채팅 기록 카드 보류**: `CARD_HOLD_EXEC_MS`(2.4초)는 그대로다. 유언 공개 카드(3.0초)와 같게 맞출지는 결정 거리(UI-SPEC 은 "채팅 기록 카드는 지금 그대로"라고만 한다).
- 22-10 이월(`SureStamp`·`sure`·`lead` 배관)·P22-3(찬반 장면 토론 그대로)은 22-13 몫이라 건드리지 않았다.

## 돌리지 못한 검증

- **폰 6종 겹침(must_haves 마지막 항목, backstop)**: 유언 카드 자리(독 아랫변 + 8, 폭 화면 − 32)가 띠·독 줄·소리 단추와 겹치지 않는지는 실기기·E2E 로 재지 않았다. CSS 규칙(`.mv-will-reveal`, `.mv-quote--will` 4줄·`pointer-events: none`)을 시험으로 고정했을 뿐이다. 360×560 에서 처형자 이름표와의 약 13px 겹침은 UI-SPEC 이 허용한다. 계획대로 실기기 검사는 끝에 몰아서(22-14 또는 배포 뒤) 한다.
- 배포본(원격)에서의 처형 6.6초 재생·smoke·E2E 는 돌리지 않았다.

## Known Stubs

없음 — 새 화면·데이터 모두 서버 값에 연결돼 있다. (`verdict.reject` 레시피는 쓰는 곳이 없는 소리이지 화면 스텁이 아니다. 위 이월 참조.)

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: public-path | shared/game/view.ts | `day.execution.will` — 처형 단계 한정·비어 있지 않을 때만·모든 소켓 동일, 계획의 T-22-26 이 다루는 경로(누설 허용 목록에 이유와 함께 추가, leak 시험이 단계·동일성 단언) |

T-22-27(개인 선택 기록 제거)·T-22-28(React 텍스트 노드만, `QuoteCard`)도 시험으로 닫았다.

## Self-Check: PASSED

- 만든·고친 파일 존재 확인: `.planning/phases/22-cleanup-single-mode/22-12-SUMMARY.md`, `shared/game/phases.ts`, `src/components/v2/QuoteCard.tsx`, `src/net/useVerdictMoment.ts` 있음. 삭제 대상 6개 파일 없음.
- 커밋 존재 확인: 319e50f6, 41388065, e1579847, ae520b10 모두 HEAD 의 조상.

---
phase: 13-basic-day-flow
plan: "02"
subsystem: server-bots-test-tools
tags: [bots, simultaneous-vote, test-tools, smoke, durable-object, vitest]

requires:
  - phase: 13-01
    provides: RULESET(다섯 값 false), castPoint·enterVote·NOMINATION_MS, worker applyPoint(250ms 간격), castPoints 시험 도우미
provides:
  - 투표(nomination) 단계 서버 봇 계획: 산 봇마다 point 한 번(2000~8000ms), 고정 pick 포함, 사람과 같은 applyPoint → castPoint
  - 테스트 방 넘기기(testSkip)가 투표에서 안 던진 산 봇의 표를 먼저 채운 뒤 마감을 당김
  - 방장 사람 1 + 봇 7 DO 시험이 시작부터 ended 까지 봇 행동·마감만으로 완주(runoff·showdown·day.turn·badge 0)
  - smoke full(사람 소켓 5명)·scripts/bots.mjs 동시 투표판, 허용 경로 좁힘
affects: [13-03, 13-04, 13-05, 13-06]

actuals:
  tokens: 11000
  tasks: 3
  commits: 5

plan_head_before: 011d9e444b150e270442fd44003676d32fbcf5e3
plan_head_after: 077f6599991584edc7c2751973b9c811b1c81a41

tech-stack:
  added: []
  patterns:
    - "꺼진 장치(RULESET)에 묶인 시험은 describe.skipIf(!RULESET.x) 로 남기고, flakeGuard 는 이 형태만 허용한다"
    - "smoke 는 허용 경로를 넓히지 않고 좁힌다 — 꺼진 장치의 키가 나오면 실패(T-13-07)"

key-files:
  created: []
  modified:
    - shared/game/bots.ts
    - shared/game/testTools.ts
    - test/unit/bots.test.ts
    - test/unit/testTools.test.ts
    - test/unit/dayStaticGuard.test.ts
    - test/unit/flakeGuard.test.ts
    - test/worker/bots.test.ts
    - test/worker/testTools.test.ts
    - scripts/smoke.mjs
    - scripts/bots.mjs

key-decisions:
  - "봇 투표 계획은 planFor 의 nomination 분기에서 pickTurn 이 없을 때만 동시 계획(botPointTarget → now + POINT_BASE_MS + randInt(POINT_SPAN_MS)), 있으면 기존 turnPointSteps 를 그대로 쓴다"
  - "넘기기는 botsVoteNow 한 함수가 투표·찬반을 모두 맡는다(투표: botPointTarget + castPoint, 이미 던진 봇은 건너뛰고 난수 없음)"
  - "smoke 의 하루 갈래는 산 사람 수가 아니라 서버가 보낸 단계(discussion·showdown)로 고른다. 기본판은 산 셋도 discussion"

requirements-completed: [FLOW-05]

duration: 약 20분
completed: 2026-11-07
status: complete
---

# Phase 13 Plan 02: 봇·테스트 도구·smoke 동시 투표 Summary

**서버 봇이 15초 동시 투표에 사람과 같은 길로 한 표씩 던지고, 넘기기가 안 던진 봇의 표를 채우며, 봇 방이 새 낮 흐름(토론 → 동시 투표 → 변론 → 찬반 → 처형)으로 한 판을 자동 완주함을 DO 시험과 로컬 smoke full 로 증명했다.**

## Performance

- **Duration:** 약 20분
- **Tasks:** 3 / **Files:** 10 수정, 신규 0
- **Commits:** 5 (측정값, `plan_head_before` 011d9e44 → `plan_head_after` 077f6599)

## Accomplishments

- `shared/game/bots.ts`: `POINT_BASE_MS = 2000`·`POINT_SPAN_MS = 6000` 되살림. 투표 진입 직후 산 봇마다 좌석 오름차순으로 `randInt(후보 수) → randInt(6000)`, point 한 행(고정 pick 이면 앞의 결정 난수 생략). 순차 지목(`pickTurn` 있음)은 기존 계획 그대로.
- `shared/game/testTools.ts`: `botsVoteNow` 에 투표 분기(`castPoint`)를 되살리고 `skipPhase` 가 투표(차례 없음)도 이 함수를 거친다. 사람 표·이미 던진 봇은 그대로.
- 단위 시험: 새 describe "기본판 투표 봇 계획 (결정 0072)"(7 it), "넘기기: 기본판 투표 봇 표 (결정 0072)"(4 it).
- DO 시험: 투표 DO 시험을 동시 투표 기대로 바꾸고, 기본판 계획 키·고정 pick host·`castPoint` 거절(자기·범위 밖) it 을 더했다.
- **자동 완주 it**("기본판 봇 방 자동 완주 (FLOW-05, 결정 0072)", 방장 사람 1·testRole citizen·testBots 7, 방장은 무행동): 세 번 반복 실행에서 모두 통과 — 지나간 일수·처형 수·승리 편: **4일·처형 2명·마피아 승 / 2일·처형 2명·마피아 승 / 4일·처형 2명·마피아 승**. 지나간 단계 열은 `lobby>assigning>roleReveal>dayAnnounce>discussion>nomination>defense>verdict>execution>night>morning>dayAnnounce>discussion>nomination>night>morning…>ended` 모양이고(동점·0표 날은 nomination 다음이 바로 night), runoff·showdown 단계와 day.turn·day.runoff·day.showdown·players[].badge 키는 어느 프레임에도 없다. 단언은 일수·처형 수의 하한(>= 1일)만 본다(봇 난수로 판마다 다름).
- **로컬 smoke full 결과**(`npm run dev` 후 `node scripts/smoke.mjs http://localhost:5173 --stage full --players 5`, 첫 시도 통과, 개발 서버는 끔): 
  - `info: 처형 1일차: 토론 끝내기 과반 → 지목 5줄 → 변론 → 찬반 찬성 4 반대 0 → 처형 seat 4`
  - `info: 판 끝: 2일차, citizenWin, 탈락 3명` (처형 2명 + 밤 암살 1명, 산 셋이 된 2일차도 토론 → 투표 흐름)
  - `SMOKE OK full code=4213 players=5 spread=0ms discSpread=0ms`
- smoke 변경: `NOMINATION_MS = 15_000` 사본, 첫 view 의 phaseDurationMs·day.points []·day.turn 없음, 유령·자기 지목 BAD_MESSAGE, 산 사람 동시 지목 후 모든 클라이언트의 day.points 가 같아질 때까지 대기, 한 사람이 300ms 쉬고 바꾸면 모두 따라감, defense 대기 한도 `NOMINATION_MS + STATE_LIMIT_MS`. 허용 경로는 좁히기만 했다: 전이 표에서 runoff·showdown 행 제거(`dayAnnounce → [discussion]`, `nomination → [defense, night]`), `PUBLIC_KEY_PATHS` 에서 turn·showdown·runoff 제거, `OPTIONAL_PLAYER_KEYS` 에서 badge·badgeSwapped 제거.
- `scripts/bots.mjs`: `day.turn` 이 없으면 일차·단계 키로 한 번, 1~3초 뒤 자기를 뺀 산 사람 하나에게 point. 순차 분기는 `day.turn` 이 있을 때만.

## Task Commits

1. Task 1 RED: `4be3155b` test(13-02) 기본판 투표 봇 계획·넘기기 봇 표 시험 (10건 실패 확인)
2. Task 1 GREEN: `5c54bbbe` feat(13-02) 봇 동시 투표 계획과 넘기기 봇 표를 기본판에 되살림
3. Task 2: `ec335b9a` test(13-02) 기본판 봇 방 자동 완주와 동시 투표 DO 시험
4. Task 3: `5af9671f` test(13-02) smoke full·소켓 봇 스크립트를 기본판 동시 투표로
5. 보정: `077f6599` test(13-02) flakeGuard 가 RULESET 조건 skipIf 만 허용하도록 좁힘

## 바뀐 시험 이름 (시드 고정 값·기대 갱신)

- `test/unit/bots.test.ts` "봇 투표·변론 계획: 회귀 > discussion·night 계획 고정값": night 값 `125073089` → `554531902`(discussion 은 `34804349` 그대로). 기본판 투표가 15초 동시라 밤 시작 시각이 순차 지목 이전 값으로 돌아간 것.
- `test/unit/bots.test.ts` "botPlanKey·syncBotPlan·planBotSteps > 같은 단계 키로 다시 부르면…": 투표 진입 직후 계획이 빈 배열이라는 기대를 산 봇 4명의 point 4행으로 바꿈.
- `test/unit/testTools.test.ts` "skipPhase: 지목·찬반에서 안 던진 봇이 먼저 던진다 > nomination": '차례 없는 지목은 마감만 당긴다' → '안 던진 봇 표를 채운 뒤 변론'.
- `skipIf(!RULESET.runoff)`: "봇 결선 투표 계획 (09.1.1-05)", "넘기기: 동점 결선 (09.1.1-05)", worker "봇 결선 투표 (09.1.1-05, 결정 0066-4)". `skipIf(!RULESET.showdown)`: "봇 마지막 3인 계획 (09.1.1-07)", "넘기기: 마지막 3인 결전 (09.1.1-07)", worker "봇 마지막 3인 (09.1.1-07, 결정 0066-5)". `it.skipIf(!RULESET.pickTurn)`: worker "nomination: 봇 차례가 시작된 알람 사슬 안에서…".
- 동시 투표 기대로 고침: worker bots "nomination: 산 봇 셋이 사람과 같은 길로 한꺼번에 던져…"(옛 `walkToBotPoint` 순차 it 대체), "누출 없음: 투표·변론·처형·종료"(순차 걷기는 `RULESET.pickTurn` 일 때만, 기본판은 `forceBotsDue`), worker testTools "discussion 에서 넘기면…"(phaseDurationMs 15000), "nomination 중 testSkip…"(모이기·차례 없이 방장 표 + 봇 표 4).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] dayStaticGuard 의 "지운 이름" 목록에서 되살린 상수 둘 제거**
- **Found during:** Task 1 (전체 unit 확인)
- **Issue:** 09.1-05 가 지웠다고 못박은 `POINT_BASE_MS`·`POINT_SPAN_MS` 를 이번 계획이 되살려 정적 검사가 실패했다(13-01 에서 `NOMINATION_MS` 등을 뺀 것과 같은 종류).
- **Fix:** 두 이름을 목록에서 빼고 주석으로 이유를 남김.
- **Files modified:** test/unit/dayStaticGuard.test.ts
- **Commit:** 5c54bbbe

**2. [Rule 1 - Bug] flakeGuard 가 계획이 요구한 `skipIf(!RULESET.x)` 를 막음**
- **Found during:** 전체 unit·worker 확인
- **Issue:** `test/unit/flakeGuard.test.ts`(12-03, D-26)가 `test/worker/bots.test.ts` 등에서 모든 `skipIf` 를 금지한다. 계획의 인수 기준(`grep -c "skipIf(!RULESET" test/worker/bots.test.ts` >= 1)과 충돌.
- **Fix:** RULESET 에 묶인 `skipIf(!RULESET.x)` 만 허용하도록 정규식을 좁힘(skip·todo, 그 밖의 `skipIf(...)` 는 그대로 금지). 간헐 실패를 덮는 우회를 허용한 것이 아니다.
- **Files modified:** test/unit/flakeGuard.test.ts
- **Commit:** 077f6599

**3. [Rule 3 - Blocking] 계획 목록 밖 시험 보정 없음, 단 보충 한 건**
- worker `testTools.test.ts` 에서 쓰이지 않게 된 `closePhase` 임포트를 지움(Task 2 커밋에 포함, amend).

**Total deviations:** 2건 (Rule 1 두 건) + 정리 한 건. **Impact:** 시험 범위 안 정리이며 서버 동작은 계획대로다.

## Issues Encountered

- **기존 간헐 실패(이 계획의 변경과 무관, 고치지 않음):** worker `bots.test.ts` 의 "discussion: 봇 셋이 모두 토론 끝내기를 누르면…"(토론 끝내기 시각이 `cryptoRandInt` 라 가끔 한 봇이 마감 − 500 밖으로 밀림 → 계획 2개)와 "봇 chat: 밤에는 마피아 봇의 줄이…"(마피아 봇 밤 채팅 60% 난수)가 여러 번 돌릴 때 가끔 실패했다. 난수 때문이며 13-02 가 건드린 경로가 아니다. 이월 메모에 남긴다.
- 개발 서버(`npm run dev`)는 smoke 후 종료했다(5173 비어 있음).

## 이월 메모 (13-03 이후)

- 전체 `--project unit --project worker` 결과: 20건 실패 → flakeGuard 1건은 077f6599 로 해결, 남은 19건은 13-04 로 넘긴 파일뿐이다: `test/unit/view.test.ts`(14건), `test/worker/leak.test.ts`(5건). 이 계획에서 건드리지 않았다.
- 위 간헐 실패 두 건(토론 끝내기 봇 수·마피아 봇 밤 채팅)은 안정화가 필요하면 별도 처리(시험이 시각·난수에 기대는 부분).
- RULESET 을 켤 때: `describe.skipIf(!RULESET.x)` 시험이 다시 돈다. smoke 는 전이 표·PUBLIC_KEY_PATHS 를 다시 넓혀야 하고, 마지막 3인·결선 구간 코드(`runShowdownDay` 등)는 지우지 않고 남겨 두었다.
- 배지·귓속말은 이 계획과 무관(13-03 이후).

## Known Stubs

없음.

## Threat Flags

없음. 계획의 위협 T-13-05(봇 표는 worker actAsBot → applyPoint → castPoint 를 지남, 넘기기는 `checkTestHost`), T-13-06(자동 완주·누출 시험이 프레임에 `botPlan` 문자열 없음을 확인), T-13-07(smoke 허용 경로를 좁히기만 함), T-13-SC(패키지 설치 없음) 모두 계획대로 처리했다.

## Self-Check: PASSED

- 수정 파일 존재: shared/game/bots.ts, shared/game/testTools.ts, test/unit/bots.test.ts, test/unit/testTools.test.ts, test/worker/bots.test.ts, test/worker/testTools.test.ts, scripts/smoke.mjs, scripts/bots.mjs, test/unit/dayStaticGuard.test.ts, test/unit/flakeGuard.test.ts
- 커밋 확인: 4be3155b, 5c54bbbe, ec335b9a, 5af9671f, 077f6599 모두 HEAD 의 조상
- Task 1·2 automated 통과(unit 193 통과 / 31 skipIf, worker bots·testTools·botTyping 67 통과 / 4 skip), `node --check scripts/*.mjs` 통과, 로컬 smoke full 통과, `npm run typecheck` 종료 코드 0

---
phase: 22-cleanup-single-mode
plan: "09"
subsystem: day-vote-server-rules
tags: [day-flow, verdict, sequential-nomination, broadcast, leak-test]
requires: [22-08]
provides:
  - "서버 낮 사슬은 discussion → verdict → nomination → defense → execution → night 이고 단계 id 를 새로 만들지 않았다(D-10). 단계 표 next 값만 바뀌었다."
  - "찬반은 후보 없이 산 사람 전원이 던지고 던진 표의 과반이 찬성(yes*2 > yes+no)이면 지목으로, 0표·동수·반대 우세는 처형 없이 밤(reason rejected). 못 던진 사람은 분모에 없다(D-11)."
  - "day.verdictCount{yes,no} 가 찬반 단계에서 모든 소켓에 같은 값이고 표가 바뀔 때마다(번복 포함) 전원에게 방송된다. day.voted·verdict 단계 day.candidate 는 싣지 않는다. 내 표는 me.verdictVote 로 본인만(D-26)."
  - "RULES.pickTurn = true. 동시 투표 서버 코드(enterVote·castPoint·worker point 동시 분기·봇 동시 계획·넘기기 동시 도우미)가 없다(D-01·D-12)."
  - "지목 마감은 찬반 통과(passed:true)를 보존하고 candidate 만 더한다. 동점·0표는 verdict 키를 지우고 night, 그날 voteLog 줄에 reason tie|noVotes 가 남는다(D-13, Pitfall 1·7)."
  - "politicsOn 이 순차 지목을 빼고 정의돼 누설 시험의 꺼진 장치 구역이 skip 되지 않고 돈다(Pitfall 2)."
affects: [22-10, 22-11, 22-12, 22-13]
key-files:
  modified:
    - shared/game/phases.ts
    - shared/game/verdict.ts
    - shared/game/nomination.ts
    - shared/game/execution.ts
    - shared/game/gather.ts
    - shared/game/tick.ts
    - shared/game/bots.ts
    - shared/game/view.ts
    - shared/game/ruleset.ts
    - shared/game/testTools.ts
    - shared/protocol.ts
    - worker/room.ts
    - src/world/presence.ts
    - src/game/verdict.ts
    - scripts/smoke.mjs
    - scripts/e2e/lib.mjs
    - test/helpers/voteState.ts
    - test/worker/helpers.ts
decisions:
  - "찬반 마감(resolveVerdict)이 그날 voteLog 줄 {n, exec:{yes,no,passed}} 을 만든다. 부결이면 줄에 reason rejected. 지목 마감이 같은 줄에 cand 와(처형 없음이면) reason tie|noVotes 를 더한다. noExecutionOf 는 밤 단계에서 그 줄의 reason 을 읽고, reason 이 없는 마지막 3인 결전 줄은 옛 cand 파생을 그대로 쓴다."
  - "VoteLogEntry.reason 은 서버 저장용이다. view 의 voteLog 줄 복사(voteLogLine)에는 옮기지 않았다 — 공개 경로는 day.noExecution 하나."
  - "PHASE_DEFS.nomination 의 durationMs 는 15000(자리 값) 그대로다. 순차 지목이라 진입 훅 뒤 phaseDurationOf 가 모이기 3000 으로 다시 구하므로 실제 진입 길이는 3000. 표 값을 바꾸지 않아 NOMINATION_MS 를 쓰는 smoke·e2e 사본이 흔들리지 않는다."
  - "DEFENSE_MS(20000)·EXECUTION_MS(5600)·verdict.ballots·day.ballots·day.verdict·voteLog cand.votes·채팅 ballots 카드는 이 계획에서 건드리지 않았다(22-11·22-12 몫). 찬반 마감이 만든 ballots 는 지목 마감을 지나도 verdict 에 보존된다."
  - "MORNING_MAX_MS 는 바꾸지 않았다(16000 유지). 22-10 이 화면 시간표를 정할 때 필요하면 바꾼다."
metrics:
  tasks: 3
  duration: 약 3시간 50분
  files-touched: 48
status: complete
actuals:
  tokens: 27000
  tasks: 3
  commits: 5
plan_head_before: e2e072bc6a84675b00a757d2f67ae3c962a65131
plan_head_after: 4af7c12ee0f20219cdfd7c2870779fb2440d057d
commits: 5
---

# Phase 22 Plan 09: 낮 투표 서버 재배선 Summary

낮 투표의 서버 규칙을 토론 → 찬반(후보 없음, 집계만) → 순차 지목 → 변론(유언 자리) → 처형으로 재배선했다. 순차 지목(0063-1)이 기본 규칙이 되었고 동시 투표 코드는 지웠다. 성공 기준 3 의 서버 판정이 선다. 유언 규칙(22-11)과 처형 연출·기록 제거(22-12)는 다음 계획이다.

## 커밋

| 커밋 | 내용 |
| ---- | ---- |
| 83c67b37 | `test(22-09)` 찬반 앞으로·과반 판정·집계 방송 실패 시험 (RED 1) |
| dd01be07 | `test(22-09)` 순차 지목·통과 보존·동점 밤 실패 시험 (RED 2) |
| bab874cd | `feat(22-09)` 찬반을 지목 앞으로, 던진 표 과반 판정과 집계 방송 (Task 1 GREEN) |
| 7ab26316 | `feat(22-09)` 순차 지목을 켜고 지목 마감이 처형자를 정한다 (Task 2 GREEN) |
| 4af7c12e | `test(22-09)` 낮 시험을 찬반 → 순차 지목 순서로 이전 (Task 3) |

## RED 증거

- RED 1(83c67b37, 소스 변경 전): `verdictRule.test`·`phases.test`·`basicDay.test` 에서 **34 failed**(`npx vitest run test/unit/verdictRule.test.ts test/unit/phases.test.ts test/worker/basicDay.test.ts`). leak.test 에 더한 신규 1건은 RED 에서 따로 돌리지 않았고 GREEN 에서 확인했다.
- RED 2(dd01be07): nomination 신규 describe 8건 실패, gather 3건, ruleset 1건(`pickTurn` 값). 커밋 메시지에는 ruleset 을 2건으로 적었으나 실제는 1건이다(politicsOn 기대는 옛 정의로도 통과했다). 이 시점 작업 트리에는 Task 1 소스 변경(phases·verdict)이 이미 있어 nomination 의 옛 기대 시험 다수도 함께 실패했다 — 신규 시험 실패 수는 위 숫자 그대로다.

## Task 1: 찬반 앞으로·과반 판정·집계 방송

- `phases.ts`: next 를 discussion→verdict, verdict→nomination, nomination→defense(그대로), defense→execution 으로.
- `verdict.ts`: 유권자는 산 사람 전원, `verdictTallyOf` 는 `{yes,no}`, `resolveVerdict` 가 `passed = yes*2 > yes+no`(주석에 `yes > no` 동치와 D-11)로 판정. 통과면 `verdict{passed:true, ballots}` + 기본 다음 단계, 부결이면 `afterDayOf()`(night) + 줄 reason rejected. `votedSeatsOf` 삭제.
- `protocol.ts`: `DayView.verdictCount`, `NoExecutionReason` 에 `rejected`, `VoteLogEntry.reason?`. `view.ts`: 찬반 단계에서 `day.verdictCount` 를 필드별 복사, 찬반의 `day.voted` 와 `day.candidate` 제거.
- `worker/room.ts` `applyVerdict`: 값이 바뀌는 모든 투표가 `persistAndBroadcast`(옛 "첫 투표만 전원·번복은 본인만" 규율 삭제). 같은 값 재전송은 같은 객체라 무전송.

## Task 2: 순차 지목 켜기·통과 보존·동시 투표 삭제

- `ruleset.ts`: `pickTurn: true`, `politicsOn` 은 badge·whisper·runoff·showdown 만 본다.
- `nomination.ts`: `resolveNomination` 이 기존 `verdict`(passed·ballots)를 보존하고 candidate 만 더하며, 그날 voteLog 줄이 있으면 `cand`·`reason` 을 이어 붙이고 없으면 새로 만든다. 동점·0표는 `verdict` 키를 지우고 `next: night`. `enterVote`·`castPoint` 삭제.
- `tick.ts`: 지목 훅이 `enterNomination`/`stepNomination` 하나. `execution.ts`: `noExecutionOf` 가 줄의 reason 을 읽는다.
- `gather.ts`(Pattern 5): 찬반 배치 null, `verdictPassed` 삭제, 변론만 무대·처형은 처형자 무대 유지. `bots.ts`: 찬반은 산 봇 모두(후보 제외 분기 삭제), 지목은 `turnPointSteps` 뿐, 난수 호출 수·순서 불변. `testTools.ts`: 동시 투표 넘기기 삭제. `presence.ts`: `tensionOf` 의 찬반 후보 초점 분기 삭제. `worker/room.ts` `applyPoint` 의 동시 분기와 `POINT_MIN_INTERVAL_MS` 삭제.

## Task 3: 시험 이전

- 도우미: `test/helpers/voteState.ts`(찬반 뒤 단계에 닿을 때 산 사람 전원 찬성으로 통과, `stateWithVerdict` 새 순서, 동시 투표 도우미 삭제), `test/worker/helpers.ts`(`advanceTo`·`advanceToKeep` 이 같은 지름길, `driveToEnded`·`endedGame4`·`richEndedGame6` 새 순서).
- 이전한 파일: unit — verdictRule·phases·ruleset·gather·nomination·tick·execution·endgame·view·bots·testTools·gameRoom·night·nyquist-04·presence·e2eContract, client — verdictScreen, worker — basicDay·leak·trial·ballots·bots·testTools·alarm·chat·emotePhases·morningCards·nightLeak·resultLog·endgame.
- 지운 시험(동시 투표만 시험하던 블록): trial.test "투표 — 동시" 6개 전체, bots.test(worker) 동시 투표 point 시험 3개와 20-03 forceBotsDue 시각 당기기 시험 1개, unit bots.test "기본판 투표 봇 계획" 7개(순차 지목 진입 시험 2개로 교체), unit nomination.test "기본판 투표 castPoint·집계" 중 castPoint 시험 2개, testTools(unit) "기본판 투표 봇 표" 4개(찬반 사람 표 시험 1개로 교체), trial.test 의 "처형이 부결이면 변론자가 돌아온다"(처형은 통과한 날만 오므로 처형자 무대 유지 시험으로 교체).
- leak.test: `OFF_KEY_PATHS` 에서 `.view.day.turn` 을 뺐다(순차 지목은 기본 규칙). 6명 한 판 전수 검사를 새 순서로 다시 짰고 `day.verdictCount` 가 단계마다 모든 소켓에서 같음·번복이 전원에게 방송됨·`day.voted` 가 어느 프레임에도 없음·찬반 단계에 `day.candidate` 가 없음을 본다.

## 검증 결과

| 명령 | 결과 |
| ---- | ---- |
| `npx vitest run` (전체) | 245 파일 통과 5 건너뜀, 7302 통과 238 건너뜀, 실패 0. 이번 실행에서 worker 부하 flake 는 보이지 않았다 |
| `npx vitest run --project unit` (voteState 마지막 수정 뒤 재실행) | 125 파일 4180 통과 |
| `npm run typecheck` | exit 0 |
| `node --test scripts/*.test.mjs scripts/e2e/*.test.mjs` | 612 통과 0 실패 |
| `npx vitest run test/worker/leak.test.ts --reporter=verbose \| grep -c "↓"` | 2 — 켜짐 전용 describe(결선·결전)뿐이다. **"기본판 — 꺼진 장치 키 0건" 구역은 건너뛰지 않고 통과**(HEAD 상태에서 pickTurn 을 켰다면 이 구역이 skip 됐을 것이다, Pitfall 2) |
| 인수 기준 grep | `phases.ts discussion next verdict` 1, `yes * 2 > yes + no` 1, `yes * 2 > voters` 0, `verdictCount` protocol·view 합 3, `state.phase === "verdict") day.voted` 0, `passed: false, candidate: leader` 0, `enterVote\|castPoint` export 0, `pickTurn: true` 1, `verdictPassed` gather 0, `pickTurn === undefined` voteState 0 |
| 사적 레포 위생 저장소 위생 금지어 git grep (변경 파일) | 0건 |

계획의 Task 1 verify 명령에 있는 `test/unit/verdict.test.ts` 는 화면 쪽 `src/game/verdict.ts` 시험이라(파일 머리 주석 참조) 서버 판정 시험이 아니다. 서버 규칙 시험은 `test/unit/verdictRule.test.ts` 이고 이 파일을 다시 썼다. 두 파일 모두 전체 실행에서 통과했다.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 찬반 기록 카드(ballots)가 새 순서에서 나오지 않았다**
- **Found during:** Task 3 (worker ballots.test 실패)
- **Issue:** `emitBallotsCard` 는 "찬반 마감이 ballots 를 남긴 전환에서 처형자(후보)가 있을 때" 한 장을 냈다. 새 순서에서는 찬반 마감 때 후보가 아직 없고 지목 마감 때는 이미 ballots 가 있어서 어느 전환에서도 카드가 나오지 않았다.
- **Fix:** 처형 발표(`execution`)가 새로 생긴 전환(`prev.execution === undefined`)에서 처형자 좌석으로 낸다. 알람 따라잡기로 처형 단계를 지나가도 한 번만 난다. 22-12 가 이 카드와 함께 지운다(D-14).
- **Files modified:** worker/room.ts
- **Commit:** 4af7c12e

**2. [Rule 3 - 블로킹] NoExecutionReason 에 rejected 를 더하자 화면 문구 switch 가 타입 오류**
- **Found during:** Task 2 typecheck
- **Fix:** `src/game/verdict.ts` `noExecutionText` 에 `rejected` 분기("처형하지 않아요")를 더했다. UI-SPEC P22-4 는 부결·동점·0표를 같은 "처형 없음" 알림으로 덮으므로 이 부제 문구는 임시이고 22-10 이 정한다.
- **Files modified:** src/game/verdict.ts
- **Commit:** bab874cd

**3. [Rule 3 - 블로킹] 계획 파일 목록 밖 변경**
- `scripts/smoke.mjs`: 단계 전이 표 `PHASE_NEXT`·첫 낮 순서 배열만 새 순서로(e2eContract 시험이 이 표를 서버 `nextPhaseOf` 와 대조한다). `scripts/e2e/lib.mjs`: `VIEW_DAY_KEYS` 에 `verdictCount`(e2eContract 가 view.test 의 DAY_KEYS 와 같게 요구).
- 시험: unit tick·execution·endgame·view·bots·testTools·gameRoom·night·nyquist-04·presence·e2eContract, client verdictScreen, worker alarm·ballots·chat·emotePhases·morningCards·nightLeak·resultLog·endgame·testTools·bots·trial.
- `test/unit/gameRoom.test.ts`: `RULES.pickTurn` 이 켜지면서 `normalizeStoredRoom` 의 "차례 정보 없는 옛 지목 방 → 모이기부터 다시 시작" 분기(`isLegacyNomination`)가 살아났다. 시험 기대를 그 분기로 바꿨다.

### 계획 대비 달라진 점

- 계획의 Task 2 파일 목록에 있는 `runoff.ts` 는 건드리지 않았다. 결선(RULES.runoff false)이 켜지면 `runoff.ts` 가 verdict 를 `passed:false` 로 쓰는데 새 순서에서는 `passed:true` 여야 처형이 선다 — 꺼진 코드라 이월(아래).
- `DayView.voted` 타입 필드는 남겼다(주석으로 22-10 이 지운다고 표시). 화면이 읽는 자리(GamePanel·GameMap)를 22-10 이 정리해야 타입을 지울 수 있다.
- `tensionOf` 는 찬반 후보 분기만 지웠고 "지목 + day.turn 없음" 분기(동시 투표용 죽은 코드)는 남겼다 — 계획이 후자를 말하지 않았다.
- 22-07 의 권고(`HOOKS.enter.nomination`·`HOOKS.deadline.nomination` 직접 시험)는 `HOOKS` 를 export 하지 않고 tick 으로 확인했다: nomination.test "찬반 통과 직후 pickTurn(i -1, 모이기 3000ms)" 과 "모이기 마감은 같은 단계에서 첫 차례로 걷는다".

## 이월 (22-10 이후)

D-31 에 따라 조용히 넘기지 않고 적는다. client 시험은 전부 통과하지만 화면 시험이 손으로 만든 view 를 쓰므로 **새 와이어를 받는 실제 화면 동작은 이 계획에서 검증하지 못했다.**

**22-10 (화면)**
- `src/screens/GamePanel.tsx:97`·`GameMap.tsx:455` 가 `day.voted` 를 읽는다 — 서버가 더는 싣지 않아 찬반 중 "던진 수/이름표 체크"가 항상 비어 있다. `day.verdictCount` 숫자 줄(UI-SPEC P22-2)로 바꿔야 한다.
- 찬반 단계에 `day.candidate` 가 없다: hostLine·dayView 헤더·RoomScreen·pinPlan·presence(FIXED_PHASES·lightingOf)의 verdict 분기가 후보를 기대하는 곳을 찾아 정리한다(Pattern 4 점검 목록).
- `dayView.ts` 처형 없음 알림은 `prev.phase` 가 `nomination|runoff|showdown` 일 때만 낸다 — 찬반 부결(verdict → night)을 더해야 한다(Pitfall 7). `noExecutionText("rejected")` 문구도 정한다.
- `presence.ts` 의 `tensionOf`·조명 판정(111행)에 남은 "day.turn 없음 = 동시 투표" 분기는 죽은 코드다.
- 찬반 단추·지목 차례 알약 등 UI-SPEC P22-2~5 전체.

**scripts (22-13 또는 별도)**
- `scripts/smoke.mjs` 의 낮 흐름 걸음(토론 끝내기 → 지목 → 변론 → 찬반 단언, 750~870행)은 아직 옛 순서 그대로다. 전이 표만 새 순서로 맞췄으므로 배포본 smoke 를 돌리면 실패한다. E2E 흐름(`scripts/e2e/flows.mjs` 등)은 22-13 계획이 맡는다. 이 계획에서는 E2E·smoke·실기기 검사를 돌리지 않았다.

**꺼진 장치**
- `shared/game/runoff.ts` 는 결선 승자를 `verdict{passed:false, candidate}` 로 쓴다. `RULES.runoff` 를 켜는 날 처형이 서지 않는다(찬반이 이미 통과를 정했으므로 `passed:true` 를 보존해야 한다). 지금은 꺼져 있어 영향이 없다.

**22-11·22-12**
- 변론 단계는 옛 길이(DEFENSE_MS 20초)·옛 규칙(처형자 채팅) 그대로 자리만 지목 뒤에 있다. 처형 단계의 `day.verdict`·`day.ballots`·채팅 ballots 카드는 그대로다. `voteLog` 의 `cand.votes` 는 D-25 최종 값(저장 안 함)이 아직 아니다.

**배포 위험(알림)**
- `normalizeStoredRoom` 의 옛 지목 방 정규화가 이제 살아 있다. 배포 순간 진행 중이던 방(옛 순서의 변론·찬반 단계 포함)은 새 순서로 이어지며 한 번 어긋날 수 있다. 사용자 결정 "배포 후 한 번에 실테스트"(v3.0) 전에 방을 비우는 것이 안전하다.

## Known Stubs

없음. (`noExecutionText("rejected")` 문구와 `DayView.voted` 타입 필드는 위 이월에 적은 의도된 임시값이다.)

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: new-public-value | shared/game/view.ts | `day.verdictCount{yes,no}` — 찬반 중 모두에게 같은 값으로 실시간 공개(T-22-15 의 감수된 귀결). 던진 좌석은 싣지 않아 첫 투표자 표 추론은 막았고, 한 사람이 번복하는 순간 수가 바뀌는 타이밍은 보인다(D-11 이 수용). leak.test 의 전수 검사가 키 집합(yes·no)·모든 소켓 동일·`day.voted` 부재를 단언한다. |

T-22-16(방송 DoS): 사람당 값이 둘뿐이고 같은 값은 무전송이라 별도 제한을 두지 않았다. T-22-17(차례 밖 지목): `castTurnPoint` 가 되살아난 `pickTurn.test` 와 trial.test "차례가 아닌 산 사람의 point 는 WRONG_PHASE" 로 단언된다. T-22-18(passed 덮어쓰기): nomination.test "그 상태로 defense → execution 에 들어가면 C 가 탈락한다"가 회귀를 막는다.

## Self-Check: PASSED

- 생성 파일 확인: `.planning/phases/22-cleanup-single-mode/22-09-SUMMARY.md`, `test/unit/verdictRule.test.ts`(다시 씀).
- 커밋 확인: 83c67b37, dd01be07, bab874cd, 7ab26316, 4af7c12e 가 HEAD 의 조상이다.
- 삭제 확인: `git grep -nE "export function (enterVote|castPoint)\(" -- shared` 0건.

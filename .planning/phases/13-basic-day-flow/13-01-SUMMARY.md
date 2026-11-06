---
phase: 13-basic-day-flow
plan: "01"
subsystem: game-rules-server
tags: [ruleset, simultaneous-vote, durable-object, tick, vitest]

requires:
  - phase: 08-day-execution-ghost
    provides: 동시 지목 구현(v2.0 git 51688d65) 과 tallyPoints·pointLinesOf 집계
  - phase: 09.1
    provides: 순차 지목·동점 결선·마지막 3인 결전 코드(이번에 설정으로 끔, 삭제 아님)
provides:
  - shared/game/ruleset.ts 의 RULESET 한 곳(badge·whisper·pickTurn·runoff·showdown, 모두 false)
  - 15초 동시 투표(nomination): castPoint·enterVote·NOMINATION_MS·worker applyPoint 동시 분기(250ms 간격 제한)
  - 동점·0표는 결선 없이 밤, 산 셋도 토론, 투표 방 재기동 안전
  - test/worker/basicDay.test.ts(트레이서 + 분기 셋), test/unit/ruleset.test.ts
affects: [13-02, 13-03, 13-04, 13-05, 13-06]

actuals:
  tokens: 11000
  tasks: 3
  commits: 5

tech-stack:
  added: []
  patterns:
    - "꺼진 장치는 코드를 지우지 않고 RULESET 값으로 끈다. 시험은 describe.skipIf(!RULESET.x) 로 남겨 두어 값을 켜면 다시 돈다"
    - "기본판 단계 길이처럼 설정에 따라 갈리는 기대값은 시험에서 RULESET 삼항으로 고른다"

key-files:
  created:
    - shared/game/ruleset.ts
    - test/unit/ruleset.test.ts
    - test/worker/basicDay.test.ts
  modified:
    - shared/game/phases.ts
    - shared/game/nomination.ts
    - shared/game/tick.ts
    - shared/game/room.ts
    - worker/room.ts
    - test/helpers/voteState.ts
    - test/unit/nomination.test.ts
    - test/unit/tick.test.ts
    - test/unit/gameRoom.test.ts
    - test/unit/phases.test.ts
    - test/unit/runoff.test.ts
    - test/unit/showdown.test.ts
    - test/unit/nyquist-03.1-multiday.test.ts
    - test/unit/dayStaticGuard.test.ts
    - test/worker/trial.test.ts
    - test/worker/pickTurn.test.ts
    - test/worker/runoff.test.ts
    - test/worker/showdown.test.ts
    - test/worker/emotePhases.test.ts

key-decisions:
  - "RULESET 는 다른 모듈을 import 하지 않는 한 파일이고, tick 표·단계 표·resolveNomination·normalizeStoredRoom 만 읽는다(결정 0072, D-01·D-05)"
  - "투표 길이는 15초(NOMINATION_MS), 모이는 걷기도 그 안. 과반이어도 마감을 당기지 않으므로 applyPoint 는 reschedule 을 부르지 않는다"
  - "동시 투표의 이름은 와이어·서버 모두 기존 nomination 그대로(화면 제목만 '투표')"

requirements-completed: [FLOW-01, FLOW-02, FLOW-03, FLOW-04]

duration: 16min
completed: 2026-11-07
status: complete
---

# Phase 13 Plan 01: 기본판 낮 흐름 서버 몸통 Summary

**RULESET 한 곳으로 순차 지목·결선·결전·배지·귓속말을 끄고, 15초 동시 투표(마감까지 바꾸기)를 토론에서 처형까지 실제 방 DO 로 끝까지 잇고 동점·0표는 결선 없이 밤으로 보낸다.**

## Performance

- **Duration:** 약 16분
- **Tasks:** 3 (트레이서 1, 자동 2) / **Files:** 3 신규 + 19 수정 (22개)
- **Commits:** 5 (측정값, `plan_head_before` 324f5df7 → `plan_head_after` 2ed478d2)

## Accomplishments

- 트레이서(`test/worker/basicDay.test.ts`): 4명 판이 토론 끝내기 과반 → 15초 투표(phaseDurationMs 15000, day.turn 키 없음) → 모든 소켓에 같은 공개 day.points → 300ms 쉬고 바꾸기·되돌리기 → 변론(day.candidate) → 찬반 → 처형에서 chat k "ballots" 카드가 모든 소켓에 정확히 한 장 → 밤. 관찰한 모든 state 프레임에 runoff·showdown 단계와 day.turn 이 0개.
- 분기: 2:2 동점·세 명 이상 동점은 `day.noExecution.reason` tie, 0표는 noVotes 로 결선 없이 night. 산 셋 낮 시작 발표 뒤에는 토론(showdown 프레임 0).
- 재기동 안전: `normalizeStoredRoom` 의 옛 지목 재시작은 `RULESET.pickTurn` 일 때만이라 동시 투표 방이 DO 를 다시 깨워도 마감·표가 그대로(단위 시험, 트레이서도 closePhase 마다 evict 하며 통과).
- `applyPoint`: 차례 정보(pickTurn)가 없으면 `castPoint`, 같은 값은 무변화, 같은 사람의 250ms 안 재지목은 저장·방송 없이 본인에게만 state 한 프레임(T-13-02).
- 규칙 영역 기존 시험을 기본판에 맞춤. 꺼진 장치의 시험은 지우지 않고 `skipIf`, 동시 투표 시험은 v2.0 원본(51688d65)에서 "투표 — 동시 (결정 0072, DAY-04)" 로 되살림.

## Task Commits

1. Task 1 RED: `aee9f9c2` test(13-01) 트레이서 시험
2. Task 1 GREEN: `a9c4d5c3` feat(13-01) RULESET·15초 동시 투표·applyPoint·정규화 게이트
3. Task 2 RED: `362137b5` test(13-01) 분기·재기동·설정 한 곳 시험
4. Task 2 GREEN: `44a5d946` feat(13-01) 결선·결전 설정 게이트, castPoints 도우미
5. Task 3: `2ed478d2` test(13-01) 규칙 영역 시험을 기본판에 맞춤

트레이서 피드백 게이트: 자동 `<verify>` 를 다시 돌려 통과 확인 후 "Tracer verified end-to-end — expanding" 로 확장 진행.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] normalizeStoredRoom 게이트를 Task 2 에서 Task 1 로 앞당김**
- **Found during:** Task 1 (트레이서)
- **Issue:** 시험 도우미 `closePhase` 가 마감마다 DO 를 evict 하므로, 차례 없는 투표 방이 깨어날 때 옛 지목 재시작(`isLegacyNomination`)이 표를 지우고 순차 차례를 세워 트레이서가 끝까지 갈 수 없었다.
- **Fix:** `isLegacyNomination` 에 `RULESET.pickTurn &&` 를 Task 1 GREEN 에서 함께 넣었다. 그래서 Task 2 의 "normalizeStoredRoom 같은 객체" 단위 시험은 RED 가 아니라 처음부터 통과했다(나머지 Task 2 시험은 RED 확인).
- **Files modified:** shared/game/room.ts
- **Commit:** a9c4d5c3

**2. [Rule 1 - Bug] dayStaticGuard 의 "지운 이름" 목록에서 되살린 상수 둘 제거**
- **Found during:** Task 3
- **Issue:** 09.1-04 가 지웠다고 못박은 `NOMINATION_MS`·`POINT_MIN_INTERVAL_MS` 를 이번 계획이 기본판 동시 투표로 되살려 정적 검사가 실패했다.
- **Fix:** 두 이름을 목록에서 빼고 이유를 주석으로 남겼다.
- **Files modified:** test/unit/dayStaticGuard.test.ts
- **Commit:** 2ed478d2

**3. [Rule 3 - Blocking] 계획 목록에 없던 시험 파일 보정**
- **Found during:** Task 3
- **Issue:** `test/unit/phases.test.ts`(단계 표 길이), `test/worker/emotePhases.test.ts`(결선·결전 앞머리 동작), `test/unit/dayStaticGuard.test.ts` 가 같은 이유로 실패.
- **Fix:** 같은 규칙으로 고침(phases 는 RULESET 삼항 기대값, emotePhases 는 해당 it 두 개 `skipIf`). 기대값을 느슨하게 바꾸지 않았다.
- **Commit:** 2ed478d2

**4. [계획 보충] 시험 도우미**
- `test/helpers/voteState.ts castPoints` 가 pickTurn 이 없으면 `castPoint` 로 동시 투표하도록 바꿨고(Task 2), `trial.test.ts` 의 로컬 `pointAll` 도 같은 분기를 넣었다.

**Total deviations:** 4건 (Rule 3 두 건, Rule 1 한 건, 보충 한 건). **Impact:** 범위 안 정리이며 서버 동작은 계획대로다.

## 이월 메모

범위 밖이라 고치지 않고 남긴 실패(전체 `--project unit --project worker` 기준, 이 계획의 파일 밖 5파일 약 54건 + worker 쪽). 모두 "기본판에서 봇·도구·view 가 아직 순차/결선/결전을 전제" 라서 난다.

**13-02 (봇·테스트 도구)**
- `test/unit/bots.test.ts` — "봇 투표·변론 계획: 회귀"(discussion·night 계획 고정값이 다시 바뀜), "봇 결선 투표 계획"(7건, runoff 로 가지 않고 night), "봇 마지막 3인 계획"(7건, showdown 으로 가지 않고 discussion). 결선·결전 describe 는 `skipIf` 대상, 고정값은 재고정 필요.
- `test/unit/testTools.test.ts` — "넘기기: 동점 결선"(9건), "넘기기: 마지막 3인 결전"(6건). 같은 이유로 `skipIf`.
- `test/worker/bots.test.ts` — "봇 투표·변론"/"봇 지목·찬반·토론 끝내기"/"누출 없음: 투표·변론·처형·종료"(봇 계획이 순차 차례 `walkToBotPoint`·`turn.doneAt` 를 전제), "봇 결선 투표", "봇 마지막 3인". **중요:** 동시 투표에서 봇이 표를 던지는 계획이 아직 없다 — 봇이 낀 판은 지금 투표가 0표가 되어 밤으로 간다. 봇 동시 투표 계획이 13-02 의 핵심이다.
- `test/worker/testTools.test.ts` — "testSkip"(투표 진입 길이 3000 기대), "투표 단계 넘기기와 종료 중 도구"(방장 표 + 봇 표 합산), "testBotVote: 넘기기가 설정을 따른다"(봇 표가 방장 지목으로 안 모여 변론이 안 열림).

**13-04 (view·누설)**
- `test/unit/view.test.ts` — "buildView 단계 길이 (D-15)"(투표 15000 기대값 2건), "buildView 전수 누출 검사 (T-01-23)"(day.turn 이 nomination 에 있어야 한다는 가정), "buildView 역할별 일지"(showdown 으로 advance), "동점 결선 day.runoff·me.ballot"(5건), "마지막 3인 day.showdown·me.ballot·day.verdict.last"(5건).
- `test/worker/leak.test.ts` — "6명 한 판 전수 누출 검사"(nomination 에서 day.turn 가정), "지목 차례는 역할의 함수가 아니다 (L14)", "차례 아닌 지목은 보낸 사람에게만 (L15)", "동점 결선 프레임 전수", "마지막 3인 결전 프레임 전수". 순차·결선·결전 전용은 `skipIf`, 기본판용 누설 검사(day.turn 없음, day.points 공개)는 새로 필요.
- 배지·귓속말 시험(`badge`, `whisper`)은 이번 실행에서 실패하지 않았다(해당 코드는 아직 RULESET 에 연결 전).

**찬반 기록 카드 (D-04):** `test/worker/ballots.test.ts` — 이 계획에서 고치지 않은 채 7개 통과(7/7).

## Known Stubs

없음.

## Threat Flags

없음. 새 네트워크 면·신뢰 경계는 없다. T-13-01(신원은 소켓 첨부 playerId 뿐, castPoint 검사), T-13-02(250ms 간격 제한), T-13-04(정규화 게이트 단위 시험)는 계획대로 완화했다.

## Next Phase Readiness

- 와이어 모양은 확정: 투표 단계에 `day.turn` 없음, `day.points` 모두에게 공개, 단계 id `nomination`.
- 13-02 는 봇 동시 투표 계획과 테스트 도구 넘기기부터, 13-04 는 view·누설 검사를 이 모양에 맞춰 이어야 한다. 위 이월 메모가 그 목록이다.

## Self-Check: PASSED

- 신규 파일 확인: shared/game/ruleset.ts, test/unit/ruleset.test.ts, test/worker/basicDay.test.ts 존재
- 커밋 확인: aee9f9c2, a9c4d5c3, 362137b5, 44a5d946, 2ed478d2 모두 HEAD 의 조상
- Task 1·2·3 automated 통과(246 통과 / 71 skipIf), `npm run typecheck` 종료 코드 0

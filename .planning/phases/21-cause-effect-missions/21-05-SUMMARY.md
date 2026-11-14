---
phase: 21-cause-effect-missions
plan: "05"
subsystem: server
tags: [cause-effect, skip, house-teleport, morning-near, gather, wire, tdd]
status: complete

requires:
  - phase: 21-cause-effect-missions
    provides: "21-01 의 원인 흐름 단계 사슬(저녁 → 밤 → 아침 → 토론)과 규칙 cause, 21-02·03 의 저녁 배정·등불, 21-04 의 아침 현장(RoomState.scene)과 근처 snap 을 쓰는 저녁 표본"
provides:
  - "shared/game/skip.ts — toggleSkip·skipCountOf·skipReached·clearSkip (토론 끝내기와 같은 majorityOf 과반, 표는 서버 전용 Player.skipVote)"
  - "와이어: ClientMessage { t: \"skip\"; on: boolean }(strictObject), MyInfo.skip?: true(본인), DayView.skipCount?: number(원인 흐름 errand·morning, 모두), 방 DO handleSkip/applySkip(과반이면 마감을 당겨 tick + afterTransition)"
  - "shared/game/movement.ts — nearPhaseOf(저녁 + 원인 흐름 아침), canMoveIn(phase, alive, rules?) 의 세 번째 선택 인자(원인 흐름 아침에 산 사람이 걷는다)"
  - "shared/game/world.ts houseHome + MapDef.houseFronts(마을) — 밤 집 앞 순간이동과 분필 집 앞, gather.ts layoutKey 의 {일차}:board — 토론 시작 모이기"
affects: [21-09, 21-10, 21-11, 21-12]

actuals:
  tokens: 20600
  tasks: 2
  commits: 4

plan_head_before: 42022b3c1ce8606faf9b7845bd5624b9e1c7d218
plan_head_after: db3d612d9fa9e8ce6abb092cbdcabc5214fceb50
commits: 4

tech-stack:
  added: []
  patterns:
    - "토론 끝내기의 거울: skip.ts 는 discussion.ts 의 toggleEnd·endCountOf·endReached 와 같은 검사 순서(단계 → 행위자 → 불리언 → 같은 상태면 입력 그대로)이고 방 DO applySkip 은 applyEndDiscussion 과 같은 길이다"
    - "근처 단계 한 곳: nearPhaseOf(state) 하나가 audience 두 함수·snapFrameFor·syncErrandView·syncErrandTransition·runErrandTick·nextWakeAt 의 `phase === \"errand\"` 를 대신한다 — 저녁과 원인 흐름 아침이 같은 규칙을 쓴다"
    - "집 앞은 좌석이 정한다: houseHome 은 시각·위치를 읽지 않고 fronts[seat] 을 HomeMemo 로 쓴다. 분필(fillChalk)과 밤 순간이동(teleportHome)은 고치지 않고 기억만 바꿔 따라온다"
    - "아침 표본은 저장하지 않는다: 원인 흐름 아침의 runErrandTick 은 목격 기록(sampleErrand)을 부르지 않고 표본 시각만 메모리에서 옮긴 뒤 근처 snap 을 보낸다(결정 0076)"

key-files:
  created:
    - shared/game/skip.ts
    - test/unit/skip.test.ts
    - test/unit/causeMove.test.ts
    - test/worker/causeSkip.test.ts
    - test/worker/causeMove.test.ts
  modified:
    - shared/game/tick.ts
    - shared/game/room.ts
    - shared/protocol.ts
    - shared/schemas.ts
    - shared/game/view.ts
    - shared/game/movement.ts
    - shared/game/audience.ts
    - shared/game/gather.ts
    - shared/game/world.ts
    - shared/game/map.ts
    - shared/game/mapTown.ts
    - worker/room.ts
    - test/unit/schemas.test.ts
    - test/unit/soundProtocol.test.ts
    - test/unit/movement.test.ts
    - test/worker/sceneLeak.test.ts

key-decisions:
  - "건너뛰기 과반 기준은 토론 끝내기와 같은 majorityOf(산 사람 수)다(Open Q 5). 산 여섯이면 넷, 다섯이면 셋. 전원 기준으로 바꾸려면 skipReached 한 줄이다"
  - "아침 근처 표본의 알람은 errandTickAt 한 키를 저녁과 같이 쓴다: 원인 흐름 아침 진입 훅이 `errandTickAt = 진입 마감 + ERRAND_TICK_MS` 를 정하고 nextWakeAt 이 nearPhaseOf 로 읽는다. 토론 진입이 키째 지운다"
  - "집 앞 목적지는 맵 데이터에서 읽는다: MapDef.houseFronts(좌석 번호가 색인, 마을만)를 더해 방 DO 가 mapTown.ts 를 직접 읽지 않는다 — clueSpots(21-04)와 같은 방식"
  - "토론 모이기 키 {일차}:board 의 layoutFor 는 지목처럼 같은 키일 때만 기억(w.lay)을 잇는다 — 지목 키 {일차}:ring 과 달라 지목에 들어서면 다시 모인다"

metrics:
  duration: 약 35분
  completed: 2026-11-14
---

# Phase 21 Plan 05: 건너뛰기·밤 집 앞·아침 근처·토론 모이기 Summary

확장판(원인 흐름) 저녁·아침에 산 사람이 [건너뛰기]를 누르고 과반이면 서버가 그 단계를 곧바로 마감하며(공개 값은 누른 수뿐), 밤이 시작되면 산 사람 모두가 자기 집 앞으로 순간이동하고, 아침에는 걸을 수 있되 근처 사람만 서로 보이고, 토론이 시작되면 둘레 자리로 모인다. 암살 피해자의 분필은 그 집 앞에 놓인다.

## Performance

- **Duration:** 약 35분
- **Tasks:** 2 (각각 RED 시험 커밋 + GREEN 구현 커밋)
- **Files:** 본 코드 11(새 파일 skip.ts 포함) · 시험 7(새 파일 4 포함)

## Accomplishments

- **Task 1 (건너뛰기):** `skip.ts`(toggleSkip·skipCountOf·skipReached·clearSkip) · 와이어 `{ t: "skip", on }`·`me.skip`·`day.skipCount` · tick 훅 표의 원인 흐름 저녁·아침 진입이 `clearSkip` 을 먼저 불러 저녁 표가 아침으로 새지 않는다 · 방 DO `applySkip`(과반이면 `tick({ …, phaseEndsAt: now })` 뒤 `afterTransition`, 아니면 `persistAndBroadcast`, 같은 값이면 저장·전송 없음).
- **Task 2 (위치·가시성):** `nearPhaseOf` 로 audience world 받는 사람·worldVisibleTo·snapFrameFor·근처 snap 들고남·표본 알람을 저녁과 원인 흐름 아침에 같이 적용 · `canMoveIn` 세 번째 인자로 원인 흐름 아침 걷기 · `houseHome`(+`MapDef.houseFronts`)이 captureHomeNow 에서 집 앞을 기억해 밤 순간이동(teleportHome)·분필(fillChalk)이 따라옴 · layoutKey 의 `{일차}:board` 로 토론 시작 모이기, 지목에서 다시 둘레로 · 아침 표본은 목격 기록을 쌓지 않고 저장하지 않는다.
- **D-10(밤 pick):** 자기 집·동료 집을 골라도 같은 응답(오류 없음, state 한 프레임)이고 마지막 선택이 이긴다 — 코드 변경 없이 워커 시험으로 고정했다(계획대로 "시험만").

## Task Commits

1. **Task 1 RED:** `a70ed83e` test(21-05): 건너뛰기 실패 시험
2. **Task 1 GREEN:** `4103fc1d` feat(21-05): 저녁·아침 건너뛰기
3. **Task 2 RED:** `1a29ae6b` test(21-05): 집 앞 순간이동·아침 근처·모이기 실패 시험
4. **Task 2 GREEN:** `db3d612d` feat(21-05): 밤 집 앞 순간이동·아침 근처 보임·토론 모이기

## TDD Gate Compliance

- **RED 증거 (Task 1):** `npx vitest run test/unit/skip.test.ts test/unit/schemas.test.ts test/worker/causeSkip.test.ts --reporter=tap-flat` → 212 중 **not ok 12**(schemas 2: `{ t: "skip", on }` 가 거부됨 · skip.test 7: 자리 함수가 WRONG_PHASE·0·false 를 돌려줘 `toggleSkip rejected …: WRONG_PHASE` 와 단언 불일치 · causeSkip 3: skip 이 스키마에서 거부되어 수가 오르지 않음). semanticAssessment: 모두 skip 규칙·스키마·day.skipCount 부재라는 의도된 이유로 실패했고 import·준비 오류가 아니다. 이미 초록이던 둘(토론·밤·잠금·기본판의 WRONG_PHASE 단언 — 자리 함수가 항상 WRONG_PHASE 라 참이어야 하는 음성 단언 / 토론에서 보낸 skip 이 받아들여지지 않는 워커 단언 — 스키마가 아직 거부)은 구현 전에도 참이어야 하는 음성 단언이다. `gsd check tdd-red-evidence` 는 21-02~21-04 와 같이 따로 돌리지 않았다.
- **RED 증거 (Task 2):** `npx vitest run test/unit/causeMove.test.ts test/worker/causeMove.test.ts --reporter=tap-flat` → 12 중 **not ok 11**(unit 7: `expected 'false,false,false,true…' to be 'true,false,false,true…'`(canMoveIn 세 번째 인자), `morning:false` vs `morning:true`(nearPhaseOf), `expected 'undefined||true|undefined' to be '2|a=100,-200 …'`(houseHome), `discussion:null` vs `discussion:1:board`(layoutKey), `135000` vs `5`(nextWakeAt) · worker 4: 밤 snap 이 집 앞이 아닌 `0@320,180`, 아침 걸음 `A:0 ghost:0`, 분필 `320,180`, 토론 모이기 `0:0:false`). 나머지 1(D-10 밤 pick 동일 응답)은 계획대로 이미 참이어야 하는 "시험만" 단언이라 RED 에서도 초록이다. semanticAssessment: 모두 근처 단계·집 앞 기억·board 키 구현 부재라는 의도된 이유이고 준비 오류가 아니다.
- RED 커밋이 GREEN 커밋보다 앞서 두 task 모두 `test(21-05)` → `feat(21-05)` 순서다. REFACTOR 커밋은 없다.

## 시험 결과 (실제 출력)

- Task 1: `npx vitest run test/unit/skip.test.ts test/unit/schemas.test.ts test/worker/causeSkip.test.ts` 초록(worker 4 passed). Task 2: `npx vitest run test/unit/causeMove.test.ts test/worker/causeMove.test.ts` → **12 passed**.
- 최종 `npx vitest run --project unit --project client` → **Test Files 241 passed | 1 skipped (242), Tests 8120 passed | 184 skipped (8304)**.
- `npm run typecheck`(tokens:check·placeart:check·wrangler types·tsc app·tsc worker) → exit 0, `error TS` 없음.
- 영향 받는 워커 파일 열다섯(`errandLeak·chat·leak·errand·sceneLeak·causeSkip·causeMove·townErrand·townLeak·nightLeak·errandNear·nightCatchup·causeFlow·lampLeak·lampErrand`) 한 번에 실행 → **15 files passed, 139 tests passed | 4 skipped**.
- `npx vitest run --project worker`(전체)는 실행할 때마다 다른 파일이 5000ms 안팎의 시간 초과·창 안 프레임 끼어듦으로 흔들렸다: `night.test.ts` 셋("관전 (결정 0021)" 둘·"탈락자 거부 (ELIM-01)" — 작업 지침이 알린 기존 간헐 실패)은 매번이고, 한 번씩 `chat.test.ts`(execution 단계)·`errandLeak.test.ts`·`leak.test.ts`·`errand.test.ts` 가 떨어졌다. **네 파일 모두 단독 실행에서 통과**했고(`errandLeak` 16/16 · `chat` 39/39 · `leak` 16 passed | 4 skipped · `errand` 4/4 ×3회) 위 열다섯 파일 묶음에서도 통과했다. `night.test.ts` 단독 19/19. 마지막 전체 실행: **Test Files 2 failed | 61 passed | 5 skipped (68), Tests 4 failed | 645 passed | 78 skipped (727)** — 실패 넷은 `night.test.ts` 셋(시간 초과)과 `errand.test.ts` 한 건(`expected [ 'stool', 'poster' ] to deeply equal [ 'stool' ]`, 단독 3회 통과). 이 계획의 시험(`causeSkip`·`causeMove`)은 전체 실행에서도 통과했다. 기준(계획 이전) 커밋에서 같은 전체 실행을 돌려 비교하지는 못했다 — 위 비결정 실패가 계획 이전에도 같은 빈도인지는 확인하지 않았다.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - 시험 설계] 아침 건너뛰기 워커 시험이 죽은 피해자를 누르는 사람에 넣었다**
- **Found during:** Task 1 GREEN
- **Issue:** RED 때 쓴 "아침: 셋이 누르면 …" 은 `g.actors.slice(0, 3)` 을 눌렀는데 그중 피해자(유령)가 있으면 규칙이 BAD_MESSAGE 로 거절해 수가 2 에 멈췄다.
- **Fix:** 피해자를 뺀 산 다섯 중 셋이 누르는 시험으로 고쳤고(피해자 좌석은 `day.morning.eliminated` 로 읽는다), 죽은 피해자의 skip 이 받아들여지지 않음을 한 줄 더했다. 규칙은 계획대로다.
- **Files modified:** test/worker/causeSkip.test.ts
- **Commit:** 4103fc1d

**2. [Rule 1 - 기존 시험 갱신] 클라이언트 메시지 종류 고정 시험에 `skip` 한 줄**
- **Found during:** Task 1 GREEN 뒤 전체 단위 실행
- **Issue:** `test/unit/soundProtocol.test.ts` (나)가 소리와 무관한 메시지 종류 목록을 고정하는데 새 메시지 `skip` 이 목록에 없었다(21-04 의 `inspect` 와 같은 선례).
- **Fix:** `"skip"` 한 줄과 "소리와 무관한 새 메시지" 주석을 더했다. 시험을 약화한 것이 아니다.
- **Files modified:** test/unit/soundProtocol.test.ts
- **Commit:** 4103fc1d

**3. [Rule 1 - 기존 시험 갱신] `canMoveIn.length` 고정 시험**
- **Found during:** Task 2 GREEN 뒤 전체 단위 실행
- **Issue:** `test/unit/movement.test.ts` 가 15페이즈 때 `expect(canMoveIn.length).toBe(2)`("인자는 단계·생존 둘뿐")로 시그니처를 고정했는데, 계획이 세 번째 선택 인자(`rules?`)를 명시했다.
- **Fix:** 길이 단언을 3 으로 고치고 이름·주석에 세 번째 선택 인자를 적었다. 인자 없이 부르는 밤·아침 동작 단언(밤 산 사람 false·유령 true, 아침 산 사람 false)은 그대로이고 옛 확장판·기본판 위치 규칙이 그대로임을 계속 지킨다.
- **Files modified:** test/unit/movement.test.ts
- **Commit:** db3d612d

**4. [Rule 1 - 기존 시험 안정화] 아침 근처 snap 표본이 21-04 sceneLeak 시험 창에 끼어들었다**
- **Found during:** Task 2 전체 워커 실행(sceneLeak 이 "다른 소켓 0프레임" 단언에서 `0,0,1,1,1` 로 실패)
- **Issue:** 원인 흐름 아침에 1초마다 근처 snap 표본 알람이 돌게 되었다(A5, 이 계획의 의도). 21-04 의 sceneLeak 시험은 아침에서 inspect 후 다른 소켓에 프레임이 없음을 재는데, 알람이 시험 창에 들어오면 그 근처 snap 이 다른 소켓에 도착한다.
- **Fix:** morningGame 이 아침에 닿은 뒤 `errandTickAt` 을 한 시간 뒤로 밀어(저장·메모리 모두) 알람이 창에 끼지 않게 했다. 단언은 건드리지 않았다.
- **Files modified:** test/worker/sceneLeak.test.ts
- **Commit:** db3d612d

**5. [Rule 3 - 설계 연결] `MapDef.houseFronts` 와 `syncPositions(now, prev?)`**
- **Found during:** Task 2 GREEN
- **Issue:** 계획은 "맵에 집이 있으면(TOWN_HOUSES — 맵 데이터에서)" 로 방 DO 가 집 앞 좌표를 얻게 하는데 `MapDef` 에 그 표가 없었고, files_modified 에 `map.ts`·`mapTown.ts` 가 없었다. 또 아침 → 토론에서 전체 snap 이 배치 move 보다 먼저 가야 해서 근처 단계 들고남 snap 을 `syncPositions` 안으로 옮겼다.
- **Fix:** `MapDef.houseFronts?`(좌석 번호가 색인)를 더하고 `TOWN_MAP.houseFronts` 를 `TOWN_HOUSES` 의 front 로 채웠다(방 DO 가 맵 데이터 파일을 직접 읽지 않는 clueSpots 선례). `syncPositions` 는 기존 시험(`nightCatchup`)이 `syncPositions(now)` 로 부르므로 `(now, prev?)` 로 두고 prev 가 없으면 들고남 snap 을 건너뛴다.
- **Files modified:** shared/game/map.ts, shared/game/mapTown.ts, worker/room.ts
- **Commit:** db3d612d

### 고치지 않은 것 — `morningMsOf` 의 집 없는 맵 30초 (21-04 가 알린 항목)

`morningMsOf`(discussion.ts)가 피해자가 나온 아침이면 맵과 무관하게 현장 시간(MORNING_SCENE_MS)을 더하는 문제를 `state.scene !== undefined` 조건으로 닫아 보았다. 그러나 이 계획의 files_modified 밖이고, **21-01 의 `test/unit/dayFlow.test.ts`("피해자가 있는 밤 뒤의 morning 은 발표 길이 + 현장 30초, 의사가 막은 밤 뒤는 기본 길이 + 현장 30초다")가 집 없는 맵(openCause 만, 마을 아님)에서 현장 30초를 기대해** 실패했다 — 그 기대를 바꾸려면 21-01 시험의 의미를 고쳐야 한다. 제품 경로(확장판 = 마을 고정)에서는 일어나지 않아 변경을 되돌리고 고치지 않았다. 닫으려면 `discussion.ts` 한 줄(`cause && state.scene !== undefined`)과 dayFlow 시험의 맵 설정(openTown) 갱신이 함께 필요하다 — 21-13·21-14(잠금 해제·옛 시험 이전)가 다루기 좋은 자리다.

## Auth Gates

없음.

## Known Stubs

없음. 클라이언트는 아직 `skip` 을 보내지 않고 `day.skipCount`·`me.skip` 을 그리지 않으며 아침 걷기(GameMap 의 canMoveIn 호출)·밤 집 앞·토론 보드 화면도 그리지 않는다 — 건너뛰기 버튼·밤 집 찾기(21-09)·아침(21-10)·보드(21-11)가 맡는다. 서버 규칙·와이어는 이 계획에서 완성이다. 방금 더한 `MapDef.houseFronts`·`canMoveIn` 의 세 번째 인자는 선택이라 화면 컴파일에 영향이 없다.

## 알려진 한계 · 열린 항목

- **집 없는 맵의 아침 길이**: 위 "고치지 않은 것" 참조(21-04 의 항목 그대로 열려 있다).
- **아침 근처 snap 방송량**: 원인 흐름 아침 동안 산 사람마다 1초 간격 근처 snap 이 간다(저녁과 같은 비용, 저장 없음). 아침은 피해자가 나오면 약 30초 + 발표 길이다. 부담이 보이면 표본 간격은 `ERRAND_TICK_MS` 한 곳이다.
- **전체 워커 실행의 비결정 실패**: 위 시험 결과 참조 — 이 계획의 파일이 단독·묶음 실행에서는 모두 초록이다.

## Threat Flags

없음 — 새 네트워크 면은 `{ t: "skip", on }` 메시지 하나와 공개 `day.skipCount` 하나뿐이고 계획의 위협 모형이 다룬다. T-21-17(아침 걸음)은 nearPhaseOf 로 받는 사람을 본인 + 유령으로 두고 근처 snap 은 같은 구역 + 반경만 싣는 것을 causeMove 워커 시험(반경 밖 소켓 무수신·근처 snap 좌석 단언·표본 뒤 errandNear·errandSeen 저장 무변화)이, T-21-18(공개 값은 수뿐)은 skip 단위·워커 시험의 view 키 단언이, T-21-19(skip 형)는 schemas 시험이, T-21-20(연타)은 같은 값이면 입력 상태 그대로(저장·전송 없음 — 워커 시험이 state 프레임 0 단언)가, T-21-21(밤 순간이동 snap)은 각 소켓 snap 이 본인 한 칸뿐임을 단언하는 causeMove 워커 시험이 완화한다.

## 위생·기타

- 소리 낱말(소리·sound·audio·효과음)·'플레이어' 는 바뀐 서버 코드 diff 의 추가 줄에서 0건이다(soundProtocol (가) 시험도 통과). 사용자 위생 git grep 스크립트는 21-01~21-04 와 같이 이 PC 에서 찾아 실행하지 않았다.
- 줄 끝은 바뀐 모든 파일이 LF 다(`grep -c $'\r'` 0). 파이썬 편집은 `newline=''` 로 했다.
- 작업 트리는 계획 시작 때 깨끗했고 마지막 코드 커밋 뒤에도 `git status` 가 깨끗하다.

## Self-Check: PASSED

- FOUND: shared/game/skip.ts, test/unit/skip.test.ts, test/unit/causeMove.test.ts, test/worker/causeSkip.test.ts, test/worker/causeMove.test.ts
- FOUND commits: a70ed83e, 4103fc1d, 1a29ae6b, db3d612d (모두 HEAD 의 조상)

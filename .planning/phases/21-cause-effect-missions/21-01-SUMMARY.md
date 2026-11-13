---
phase: 21-cause-effect-missions
plan: "01"
subsystem: game-server
tags: [phase-flow, tick, night, gather, town, durable-object]
requires:
  - phase: 20-map-expansion
    provides: 마을 판(TOWN_HOUSES·settleZones·구역 snap)·워커 시험 요령
provides:
  - 확장판 하루 순서 roleReveal → errand → night → (morning) → discussion → … → execution → errand
  - 처형 없는 날은 저녁으로, 현장 없는 밤은 토론으로(routeAfterNight)
  - 마을 밤 집 앞 순간이동(teleportTo)·밤 걷기 거절·아침 걷기·확장판 토론 모이기 키 '{일차}:talk'
affects: [21-02, 21-03, 21-06, 21-08, 21-09]
requirements-completed: [D-01, D-02, D-03, D-11, D-17, D-18, D-22]
actuals:
  tokens: 15300
  tasks: 2
  commits: 4
plan_head_before: ec2d732e4ddbb7b842c1f130c09f269f095c2b5f
plan_head_after: ff4a3b50d290071ae30d18cda453046b511908e2
commits: 4
tech-stack:
  added: []
  patterns:
    - "판 규칙(rules.errand)이 순서를 가른다: 단계 표는 데이터, nextPhaseOf 가 갈래를 고르고 tick 한 곳이 분기를 바꾼다"
    - "마을 위치는 단계 키(night/morning)가 바뀔 때 한 번 맞추고 snapEachViewer 로 시야를 새로 보낸다"
key-files:
  created:
    - test/unit/causalDay.test.ts
    - test/worker/causalDay.test.ts
  modified:
    - shared/game/phases.ts
    - shared/game/tick.ts
    - shared/game/night.ts
    - shared/game/discussion.ts
    - shared/game/execution.ts
    - shared/game/movement.ts
    - shared/game/gather.ts
    - shared/game/awards.ts
    - shared/game/world.ts
    - worker/room.ts
key-decisions:
  - "확장판 일차는 저녁 진입이 올린다(저녁 N → 밤 N → 아침 N → 토론 N → 처형 N) — 밤 일지 n·투표 줄 n 이 겹치지 않는다"
  - "처형 없는 날의 night 분기는 tick 한 곳에서 errand 로 바꾼다(nomination·runoff·showdown 모듈은 안 고침)"
  - "마을은 밤에만 순간이동한다 — 아침·토론 직전에는 순간이동이 없고 집 앞에 선 채 걷거나 토론 모이기로 걷는다"
metrics:
  duration: 약 2시간(전체 시험 실행·멈춤 진단 포함)
  completed: 2026-11-13
status: complete
---

# Phase 21 Plan 01: 원인→결과 하루 서버 뼈대 Summary

**확장판 하루가 roleReveal → 저녁(errand) → 밤 → (현장이 있을 때만 30초 아침) → 토론 순서로 서버 알람만으로 걷고, 처형 없는 날은 저녁으로, 마을의 밤은 집 문 앞 한 점에서 맞는다 — 기본 마피아의 순서·길이는 그대로다.**

## 한 일

### Task 1 (트레이서): 순서 → 분기 → 밤 판정 → 길이 → 방 DO 알람 → 소켓 프레임
- `shared/game/phases.ts`: `MORNING_SCENE_MS = 30_000`(21페이즈 D-03). `PHASE_DEFS.errand.next` 를 `"night"` 로. `nextPhaseOf` 가 `rules.errand` 판에서 roleReveal·execution → errand, morning·dayAnnounce → discussion 을 고른다(낮 시작 발표에 있던 저장 방은 토론으로 이어진다). 기본 마피아는 지금과 같다.
- `shared/game/tick.ts`: 저녁 진입 훅이 `enterDayAnnounce` 로 일차를 올린 뒤 enterErrand → assignErrandFake. 마감 훅의 분기 `next === "night"` 는 확장판에서 `"errand"` 로. `deadline.night = routeAfterNight`(확장판만).
- `shared/game/night.ts`: `routeAfterNight(state, at)` — 확정 대상이 없으면 `enterMorning(state, () => 0, rules)` 로 판정(경찰 일지·치료 일지·nightLog 한 줄)을 지금 적용하고 `next: "discussion"`. 대상이 있으면(죽음이든 구출이든) 기본 다음 단계 morning.
- `shared/game/discussion.ts`: 확장판 morning 길이는 `MORNING_SCENE_MS`, 기본 마피아는 `morningMsOf` 그대로.
- `shared/game/execution.ts`: `noExecutionOf` 가 확장판은 단계 errand·전날(day − 1) 줄, 기본 마피아는 night·그날 줄.

### Task 2: 위치
- `shared/game/world.ts`: `teleportTo(w, spots, now)` — spots 의 id 마다 구간이 있으면 `restSegment` 한 점(lastMoveAt 그대로).
- `worker/room.ts` `syncHome`: 맵이 town 이면 밤 키 `{일차}:night` 가 바뀔 때 산 사람을 `TOWN_HOUSES[seat].front` 로 `teleportTo` → `settleZones` → `flushWorld` → `snapEachViewer`. 아침 키는 순간이동 없이 키만 맞추고 snap 한 번. 알람 따라잡기·현장 없는 밤으로 아침을 건너뛴 `staleNight` 경로도 마을은 순간이동 없이 키와 snap 만 맞춘다. 마을이 아닌 맵(재즈 바·광장)은 `teleportHome` 규칙 그대로. 문 연출은 없다(결정 0087 알려진 한계).
- `shared/game/movement.ts`: `canMoveIn(phase, alive, rules?)` — 규칙이 있고 `rules.errand` 면 산 사람도 morning 에 걷는다. `canMove` 는 `rulesetOf(modeOf(state))` 를 넘긴다. 밤 걷기 거절은 그대로.
- `shared/game/gather.ts`: 확장판 discussion 의 `layoutKey` 는 `{일차}:talk`, `layoutFor` 는 nomination 과 같은 둘레 자리(산 사람만). 기본 마피아 discussion 은 null.
- `shared/game/awards.ts`: `Ctx.nightFirst`(= 확장판) — 같은 일차에서 확장판은 밤이 낮보다 먼저(처형 n → n·2+1, 밤 n → n·2).

## TDD 증거

- RED 1(`790b37dc`): `npx vitest run test/unit/causalDay.test.ts test/worker/causalDay.test.ts --reporter=tap-flat` → 16개 중 **not ok 13**(통과 3개는 기본 마피아·첫 저녁 회귀). 새 export 는 자리 값(`MORNING_SCENE_MS = 0`, `routeAfterNight` = 입력 그대로).
- RED 2(`8b3aa26f`): 같은 명령 → 전체 24개 중 **not ok 8**(Task 2 의 단위 6·워커 2; 워커 실패 값은 `0:0:320,180 …` 입장 지점 ≠ 집 문 앞). `teleportTo` 자리 함수, `canMoveIn` 세 번째 인자는 아직 안 씀.
- GREEN(`eea5082e`, `ff4a3b50`): 같은 명령 + `test/unit/ruleset.test.ts` → 3 파일 34개 전부 통과(워커 시험 연속 3회 반복 통과).

## 검증

| 명령 | 결과 |
|---|---|
| `npx vitest run test/unit/causalDay.test.ts test/worker/causalDay.test.ts test/unit/ruleset.test.ts` | 3 files, 34 passed |
| `npm run typecheck` | 통과(tokens·placeart·wrangler types·tsc app·worker, error 0) |
| 위생 `git grep -nIiE "torder|티오더|조직|회사|~/project"` (바뀐 파일) | 결과 0 |
| `npm test` 전체 | **이 커밋에서 초록이 아니다 — 아래 "21-02 에 넘기는 것"** |

## 계획과 달라진 점

1. **(Rule 1·계획 보강) `layoutFor` 의 `trial` 판정**: 토론 키가 nomination 과 같은 "둘레 자리" 규칙을 쓰려면 `trial = phase !== "nomination"` 만으론 토론이 재판 기억(변론자·같은 날 기억 이어쓰기)을 쓰게 된다. `trial` 에서 discussion 도 뺐다(`phase !== "nomination" && phase !== "discussion"`).
2. **(계획 보강) 알람 따라잡기 `staleNight` 경로**: 확장판은 현장 없는 밤에 아침 없이 토론으로 가므로 밤 키가 남은 채 토론에 들어오는 경로가 정상 경로가 된다. 마을에서 이때 `teleportHome` 을 하면 사람이 errand 가 끝난 자리로 되돌아간다 — 마을은 순간이동 없이 키·snap 만 맞추게 했다(plan 은 syncHome 의 밤·아침 갈래만 적었다).
3. **`teleportTo` 의 spots 값은 고정소수점 좌표**다(`TOWN_HOUSES[seat].front` 가 이미 고정소수점이라 변환 없이 넘긴다).
4. 탈락 순서 시험은 `survivalKey` 를 내보내는 대신 `computeAwards` 로 관찰한다(1일차 처형자·밤 피해자가 모두 3표를 받은 판의 `target` 칭호 주인이 기본 마피아는 밤 피해자, 확장판은 처형자).
5. `actuals.tokens` 15300 은 estimate(95000)보다 훨씬 작다 — 순수 모듈 변경이 작고 시험이 대부분이다. 측정값 그대로 적었다.

## 21-02 에 넘기는 것

### 가장 급한 것: 단위 시험 3개가 무한 루프로 멈춘다
`npm test` 가 끝나지 않는다. `test/unit/testTools.test.ts`·`test/unit/bots.test.ts`·`test/unit/night.test.ts` 가 `while (s.phase !== "dayAnnounce"/…)` 식 도우미 루프로 단계에 닿으려는데 확장판에는 그 단계가 없어 영원히 돈다(CPU 100% 프로세스가 남는다 — 돌리다 멈추면 `pkill -f vitest; pkill -f workerd`). 같은 모양(`while (… .phase !== …)`)을 가진 다른 단위 파일: `trace`·`will`·`e2eContract`·`nyquist-03-night-chain`·`gameMode`(앞의 셋 빼고는 돌아서 끝난다). 시험 돌릴 때는 이 세 파일을 `--exclude` 하거나 먼저 고친다.

### 실패 파일(이 커밋 기준, 단위 + client 는 7809개 중 156 실패 · 워커는 708개 중 313 실패)

단위(실패 수): audience 1 · awards 3 · discussion 1 · endgame 21 · errand 26 · errandFake 4 · errandNear(파일 로드 실패 "cannot reach dayAnnounce") · errandView 1 · errandZone(파일 로드 실패 같은 원인) · execution 1 · gameMode 5 · gameRoom 2 · gather 2 · movement 3 · nyquist-03-night-chain 5 · nyquist-03.1-multiday 12 · nyquist-04-multiday-flow 3 · showdown 1 · tick 17 · trace 1 · view 31 · viewRoles15 1 · win 15 · (멈춤: testTools·bots·night).
- `phases.test.ts`·`ruleset.test.ts` 는 통과한다(plan 이 예상한 phases 단위 시험 실패는 없었다).
- `gather.test.ts`: `layoutKey` 표가 `discussion:null` 을 기본(확장판) 상태에서 단언한다 → 확장판 `3:talk`, 기본 마피아 null 로.
- `movement.test.ts`: 확장판 아침 걷기·밤 표.

워커(실패 수): alarm 2 · ballots 7 · basicDay 4 · basicOff 3 · bench 7 · botTyping 1 · bots 3 · chat 22 · chatLeak 5 · chatReplay 5 · continuity 6 · day 2 · dress 8 · emote 1 · emoteLeak 5 · emotePhases 2 · emptyGame 2 · endedChat 4 · endgame 3 · errand 3 · errandLeak 15 · errandNear 7 · ghostLeak 6 · leak 10 · mapPick 3 · modeBasic 1 · modePick 1 · morningCards 10 · night 2 · nightCatchup 3 · nightLeak 17 · rematch 7 · resultLog 8 · stats 5 · testTools 6 · town 7 · townDoor 18 · townErrand 6 · townLeak 8 · trace 15 · trial 37 · waitHelpers 1 · will 11 · world 14.
- 대부분은 `test/worker/helpers.ts` 의 `startedGame`(roleReveal 다음 `advanceTo(…, "dayAnnounce")`)·`skipThrough`·`driveToEnded`·`townGame`·`richEndedGame6` 등이 확장판에 없는 dayAnnounce 를 기다려서 난다 — 도우미를 판 종류의 순서로 걷게 하면 한꺼번에 풀리는 묶음이다. `basicDay`·`basicOff`·`modeBasic`·`modePick` 은 기본 마피아로 시작하는 시험인데 도우미가 확장판 기본으로 시작해서 깨진다(mode 선택 인자가 필요).
- 이 실패 목록은 이 커밋 기준이다. 20페이즈 `deferred-items.md` 의 간헐 실패 후보와 섞여 있을 수 있다 — 베이스라인(`ec2d732e`)에서 같은 두 묶음을 돌린 기준선은 이 계획에서 만들지 않았다.

### 새 시그니처·헬퍼
- `nextPhaseOf(phase, rules)`: 확장판 갈래 넷(roleReveal·execution → errand, morning·dayAnnounce → discussion). `PHASE_DEFS.errand.next = "night"`.
- `MORNING_SCENE_MS = 30_000` (phases.ts), `phaseDurationOf` 는 확장판 morning 에 이 값.
- `routeAfterNight(state, at): DeadlineResult` (night.ts) — 확장판 deadline.night.
- `canMoveIn(phase, alive, rules?)`; 화면이 부르는 곳(src)은 21-09 가 규칙을 넘기게 바꾼다.
- `layoutKey` 확장판 discussion `'{일차}:talk'`; `layoutFor` 는 산 사람만 `ringSlots(산 사람 수)`.
- `teleportTo(w, spots, now)` (world.ts, 좌표는 고정소수점).
- 시험 헬퍼 패턴(`test/worker/causalDay.test.ts` 지역 함수): `atRoleReveal(guests)` — 시작 → assigning → `advanceTo(roleReveal)` 후 `actorsOf`. 확장판은 이 다음 `advanceTo(errand)` 부터 걷는다. 마을은 `openTown()` 으로 시작 직후까지만 열어 둔다. 밤 직후 snap 은 `advanceTo(…, "night")` 앞에서 `mark` → 뒤에서 `settle` 로 모은다.
- 일차 규칙: 확장판은 **저녁 진입이 일차를 올린다**. 첫 저녁 = day 1(roleReveal 마감 직후), 처형 없는 날 뒤 저녁 = day + 1. 기본 마피아의 일차는 dayAnnounce 가 올리는 그대로.

## 21-06 에 넘기는 것
- 아침 판정은 `enterMorning` 진입 훅이 한다(피해자 alive false, morning.eliminated/saved/trace/seen). 현장은 그 자리(확장판 morning 30초, `phaseDurationOf`)에 얹는다. 피해자도 미수도 없는 밤은 아침이 없다 — `routeAfterNight` 가 판정을 이미 적용하고 토론으로 가므로 현장 코드가 "morning 이 아닌 밤 마감" 을 기다리면 안 된다.
- 아침에 산 사람은 걷는다(`canMoveIn` 규칙 인자). 마을은 아침에 집 앞에서 시작한다(순간이동 없음).

## 알려진 스텁
없음.

## Threat Flags
없음(밤 snap 은 기존 worldVisibleTo 로 거른 길 그대로, T-21-01·02 시험이 고정한다).

## Self-Check: PASSED
- 만든 파일 확인: `test/unit/causalDay.test.ts`, `test/worker/causalDay.test.ts`
- 커밋 확인: 790b37dc, eea5082e, 8b3aa26f, ff4a3b50 가 HEAD 의 조상

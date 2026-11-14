---
phase: 21-cause-effect-missions
plan: "04"
subsystem: server
tags: [cause-effect, morning-scene, clue-spots, inspect, leak-test, wire, tdd]
status: complete

requires:
  - phase: 21-cause-effect-missions
    provides: "21-01 의 원인 흐름 단계 사슬(저녁 → 밤 → 아침 → 토론)과 아침 길이 0 규칙, 21-03 의 밤 집 창 불(RoomState.lamps)"
provides:
  - "shared/game/mapTown.ts — TOWN_CLUE_SPOTS(집 좌석 8 × 지점 3, 고정소수점 리터럴)·TOWN_MAP.clueSpots(MapDef.clueSpots? 선택 키)"
  - "shared/game/scene.ts — buildScene(발자국·옷 조각·창문)·inspectSpot(1회·반경 1.2·먼저 손댄 흔적). 현장에서 역할을 읽는 유일한 파일"
  - "RoomState.scene(서버 전용 현장)·Player.sceneSeen(본인이 살핀 줄) — enterMorning 이 원인 분기에서 만들고 enterErrand 가 키째 지운다"
  - "와이어: ClientMessage { t: \"inspect\" }(필드 없음), MyInfo.scene?: ClueLine[](본인), DayView.scene?: { house }(공개, morning 단계), SpotId·ClueLine 타입, 방 DO handleInspect/applyInspect"
affects: [21-05, 21-10, 21-11, 21-12]

actuals:
  tokens: 16700
  tasks: 2
  commits: 4

plan_head_before: ec023f17472cf8a96a391ad440b0f78e7c814c42
plan_head_after: f017fbf469e8a047775ac463319ef41f54f0077d
commits: 4

tech-stack:
  added: []
  patterns:
    - "역할을 읽는 현장 파일 하나: scene.ts 의 inspectSpot 이 산 마피아 한 줄(.role)만 읽고 night.ts enterMorning 본문은 buildScene 을 부를 뿐 .role 이 없다(소스 규약 시험이 고정)"
    - "응답 동일: inspect 는 applyErrand 와 같은 모양(저장 한 번 + 본인 state 한 프레임, 거절도 본인 state 한 프레임) — touched 는 같은 상태 쓰기에 실린다"
    - "공개 값은 현장 집 좌석 하나: view.ts 는 scene.house 와 sceneSeen 의 r·n·piece 필드 복사만 하고 touched·footprints 를 읽지 않는다(주석 아닌 줄 grep 0)"
    - "난수는 원인 분기 안에서만: 후보 n 명이면 buildScene 이 randInt 를 n≥2 → 2번, n=1 → 1번, n=0 → 0번 부른다"

key-files:
  created:
    - shared/game/scene.ts
    - test/unit/scene.test.ts
    - test/worker/sceneLeak.test.ts
  modified:
    - shared/game/map.ts
    - shared/game/mapTown.ts
    - shared/game/night.ts
    - shared/game/errand.ts
    - shared/game/room.ts
    - shared/protocol.ts
    - shared/schemas.ts
    - shared/game/view.ts
    - worker/room.ts
    - test/unit/mapTown.test.ts
    - test/unit/schemas.test.ts
    - test/unit/soundProtocol.test.ts

key-decisions:
  - "지점 좌표 정의식(P21-9, 결정 0088): 좌석 1~6 은 문 중심(집 중심에서 문 면으로 1.2)에서 바깥 1.3, 옆 −1.0/0/+1.0 의 점에서 가장 가까운 걷는 칸 중심. 좌석 0·7 은 문 앞 칸(front)이 시계탑 뒤 모서리 쪽이라 같은 식이 한 칸으로 뭉치므로 front 와 front 에서 집 쪽으로 1.0·2.0 간 점의 가장 가까운 걷는 칸(집 옆 걷는 줄)으로 당겼다"
  - "windowLit = state.lamps[neighborOf(house)] — buildScene 이 짝집 좌석의 등불(등불 i = 집 i)을 읽고, 난수는 켜짐과 무관하게 후보 수만큼만 부른다"
  - "me.scene 은 errand 단계를 뺀 모든 단계에서 sceneSeen 이 있는 본인에게만 간다(토론 의심 보드가 쓴다) — 발자국 수는 지점 ①을 살핀 사람의 줄에만 있고 day.scene 은 { house } 하나다(P21-16)"
  - "응답 모양 시험은 view.day 경로와 프레임 종류·수로 비교한다 — view.me 는 역할·유령에 따라 원래 키가 달라 비교 대상이 아니고 단서 줄(me.scene)은 길이·내용을 따로 본다"

metrics:
  duration: 약 70분
  completed: 2026-11-14
---

# Phase 21 Plan 04: 아침 현장 단서·살피기·흐려짐 Summary

피해자(또는 의사가 막은 미수) 집 앞에 단서 지점 셋(발자국 수 · 옷 조각 · 짝집 창문)이 생기고, 산 사람이 `inspect` 를 보내면 서버가 반경 1.2 안의 아직 안 살핀 가장 가까운 지점 하나를 살펴 본인에게만 단서를 준다. 산 마피아가 먼저 살핀 지점은 그 뒤 사람에게 "먼저 손댄 흔적"이 되고, 마피아·시민의 응답은 같은 모양이며, 모두에게 공개되는 것은 현장 집 좌석(`day.scene.house`) 하나뿐이다.

## Performance

- **Duration:** 약 70분
- **Tasks:** 2 (각각 RED 시험 커밋 + GREEN 구현 커밋)
- **Files:** 본 코드 10(새 파일 scene.ts 포함) · 시험 5(새 파일 2 포함)

## Accomplishments

- **Task 1 (순수 규칙):** `MapDef.clueSpots`·`TOWN_CLUE_SPOTS`(24점, 마스크·간격·길 닿음 시험) · `scene.ts` 의 `buildScene`(발자국 = 후보 수, 옷 조각 = `randInt(n)`, 창문 = n≥2 면 옷 조각 사람을 뺀 `randInt(n−1)`, n=1 이면 같은 조각, 짝집 창 불 반영)과 `inspectSpot`(1회·반경·가장 가까운 지점·같으면 발자국→옷→창문, 결과 계산 뒤 산 마피아면 touched) · `enterMorning` 의 원인 분기가 `nightPick` 을 지우기 전 상태로 `buildScene` 을 부르고 지난 `sceneSeen` 을 지운다 · `enterErrand` 가 `scene`·모든 `sceneSeen` 을 키째 지운다.
- **Task 2 (와이어):** `{ t: "inspect" }`(strictObject, 필드 없음) · `MyInfo.scene`·`DayView.scene` 허용 목록 게이트(view.ts 는 필드 복사만) · 방 DO `handleInspect`/`applyInspect`(간격 키 `inspect:{id}`·`ERRAND_MIN_GAP_MS`, 받아들이면 put 한 번 + 본인 `sendViewTo`, 거절이어도 본인 `sendViewTo` 한 번).

## TOWN_CLUE_SPOTS 좌표 표 (고정소수점, [발자국, 옷 조각, 창문])

| 좌석 | 발자국 | 옷 조각 | 창문 |
|------|--------|---------|------|
| 0 | (-375, -675) | (-325, -775) | (-325, -875) |
| 1 | (375, -575) | (475, -575) | (575, -575) |
| 2 | (575, -625) | (575, -525) | (575, -425) |
| 3 | (575, 375) | (575, 475) | (575, 575) |
| 4 | (375, 575) | (475, 575) | (575, 575) |
| 5 | (-625, 575) | (-525, 575) | (-425, 575) |
| 6 | (-575, 375) | (-575, 475) | (-575, 575) |
| 7 | (-675, -375) | (-775, -325) | (-875, -325) |

좌석 0·7 의 첫 점은 20페이즈 `TOWN_HOUSES` 의 `front` 와 같다.

## Task Commits

1. **Task 1 RED:** `1667fe5c` test(21-04): 현장 단서 실패 시험
2. **Task 1 GREEN:** `7a974c89` feat(21-04): 현장 단서·살피기·흐려짐 순수 규칙
3. **Task 2 RED:** `0cae2a05` test(21-04): 현장 와이어·누설 실패 시험
4. **Task 2 GREEN:** `f017fbf4` feat(21-04): inspect 와 현장 단서 와이어

## TDD Gate Compliance

- **RED 증거 (Task 1):** `npx vitest run --project unit test/unit/mapTown.test.ts test/unit/scene.test.ts --reporter=tap-flat` → 89 중 **not ok 20**(mapTown 2: `TOWN_MAP.clueSpots` 가 `TOWN_CLUE_SPOTS` 가 아님·`expected '0/true/true' to be '24/true/true'`; scene.test 18: `expected 'morning/true/false/undefined/false' to be 'morning/true/true/3/true'` 같은 단언 실패와 자리 함수가 `undefined` 를 돌려줘 생긴 `Cannot read properties of undefined (reading 'house')`, `expected '0/0/0' to be '2/1/0'`(난수 호출 수), `expected 'false/6' to be 'true/0'`(지난 sceneSeen 미청소)). semanticAssessment: 모두 현장·좌표·청소 구현 부재라는 의도된 이유로 실패했고 import·준비 오류가 아니다. 단위 시험은 자리 함수가 `undefined` 를 돌려주므로 후속 단언이 TypeError 로 끝나는 것이 많다 — 그래도 실패 원인은 같은 구현 부재다. 이미 초록이던 것(마피아가 갈린 밤의 scene 키 없음·집 없는 맵·바·광장의 clueSpots 없음 등)은 구현 전에도 참이어야 하는 음성 단언이다. `gsd check tdd-red-evidence` 는 따로 돌리지 않았다(21-02·21-03 과 같음).
- **RED 증거 (Task 2):** `npx vitest run --project unit test/unit/schemas.test.ts`(1 not ok: `{ t: "inspect" }` 가 거부됨) + `npx vitest run --project worker test/worker/sceneLeak.test.ts` → **not ok 5**(`expected '' to be '{"house":0}'`(day.scene 없음), `expected 'error error' to be 'state state'`(inspect 가 스키마에서 거부되어 오류 프레임), `expected undefined to be 'clue'`, `expected 'error error error' to be 'state state state'`, `expected '0,0,0,0,0,0' to be '0,0,0,0,1,0'`). semanticAssessment: 모두 inspect 스키마·day.scene·me.scene 부재라는 의도된 이유이고 준비 오류가 아니다.
- RED 커밋이 GREEN 커밋보다 앞서 두 task 모두 `test(21-04)` → `feat(21-04)` 순서다. REFACTOR 커밋은 없다.

## 시험 결과 (실제 출력)

- Task 1 verify: `npx vitest run --project unit test/unit/mapTown.test.ts test/unit/scene.test.ts test/unit/trace.test.ts test/unit/night.test.ts test/unit/dayFlow.test.ts test/unit/lamps.test.ts` → **6 files passed, 212 tests passed**.
- `npx vitest run --project unit`(task 1 뒤) → **148 files passed | 1 skipped, 4953 tests passed | 107 skipped**.
- Task 2: `npx vitest run --project worker test/worker/sceneLeak.test.ts` → **5 tests passed**(3회 연속 통과 — 간헐 실패 없음). `lampLeak·leak·nightLeak·errand·errandLeak·lampErrand·townErrand` 일곱 파일 → **7 files passed, 65 tests passed | 4 skipped**. `night.test.ts` 단독 → **19 passed**.
- `npx vitest run --project unit --project client`(최종) → soundProtocol 한 건(아래 편차 2)을 고친 뒤 그 파일 **4 passed**; 직전 전체 실행은 `1 failed | 237 passed (239 files), 1 failed | 8059 passed | 184 skipped` 이고 그 한 건이 soundProtocol 이었다.
- `npx vitest run --project worker`(전체): **Test Files 1 failed | 60 passed | 5 skipped (66), Tests 3 failed | 637 passed | 78 skipped** — 실패 셋은 `night.test.ts` 의 "관전 (결정 0021)"·"탈락자 거부 (ELIM-01)" 의 `Test timed out in 5000ms` 로, 작업 지침이 알린 기존 간헐 시간 초과다(같은 파일 단독 실행은 19/19 통과). 이 계획의 시험은 전체 실행에서도 통과했다.
- `npm run typecheck`(tokens:check·placeart:check·wrangler types·tsc app·tsc worker) → exit 0, `error TS` 없음.
- 계약 대조: `grep -c 't: "inspect"' protocol.ts` 1 · `grep -c inspect schemas.ts` 1 · `grep -c inspectSpot worker/room.ts` 2 · `grep -c buildScene night.ts` 2 · `grep -c SpotId protocol.ts` ≥ 1 · `grep -c TOWN_CLUE_SPOTS mapTown.ts` ≥ 2 · `grep -v '^\s*//' shared/game/view.ts | grep -cE "touched|footprints"` **0**(가드).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - 작업 환경] 파이썬 편집이 줄 끝을 CRLF 로 바꿔 첫 RED 커밋을 다시 만들었다**
- **Found during:** Task 1 GREEN 확인(`lamps.test.ts` 의 enterNight 본문 소스 규약이 깨져 원인을 찾다가 발견)
- **Issue:** 이 PC 의 파이썬 `open()` 기본 줄바꿈 변환으로 LF 파일 몇 개가 통째로 CRLF 로 바뀌어 첫 RED 커밋의 diff 가 파일 전체 재작성이 되었다.
- **Fix:** 아직 push 전인 내 RED 커밋만 `git reset --soft` 로 풀어 줄 끝을 LF 로 되돌리고 RED(자리 함수 + 시험)와 GREEN(구현)을 다시 갈라 커밋했다. 이후 파이썬 편집은 `newline=''` 로 했다. 최종 diff 는 의도한 줄만 담는다.
- **Commit:** 1667fe5c, 7a974c89

**2. [Rule 1 - 기존 시험 갱신] 클라이언트 메시지 종류 고정 시험에 `inspect` 한 줄**
- **Found during:** Task 2 GREEN 뒤 전체 단위 실행
- **Issue:** `test/unit/soundProtocol.test.ts` (나)가 12페이즈 시작 때의 메시지 종류 목록을 고정하는데, 새 메시지 `inspect` 가 목록에 없어 실패했다. 이 목록은 "소리가 새 메시지를 만들지 않았다"를 지키는 것이고 15·17·19페이즈가 새 메시지마다 한 줄씩 더해 왔다.
- **Fix:** 같은 선례대로 `"inspect"` 한 줄과 "소리와 무관한 새 메시지" 주석을 더했다. 시험을 약화하거나 건너뛴 것이 아니다.
- **Files modified:** test/unit/soundProtocol.test.ts
- **Commit:** f017fbf4

**3. [Rule 1 - 시험 설계] "같은 지점 다시 → { ok:false }" 를 "거듭 살피면 같은 지점을 두 번 받지 않고 결국 { ok:false }" 로 바꿨다**
- **Found during:** Task 1 GREEN 확인
- **Issue:** 계획의 단언은 지점 중심에서 같은 자리로 다시 살피면 곧바로 `{ ok:false }` 라고 했지만, 같은 집의 지점은 서로 1.0~1.2 떨어져 있고 반경이 1.2 라 같은 자리에 선 채로 다시 눌러도 이웃한 안 살핀 지점이 반경 안에 있으면 그것을 살핀다(D-13 "반경 안의 아직 안 살핀 가장 가까운 지점"과 UI-SPEC P21-11 의 규칙 그대로).
- **Fix:** 시험이 같은 자리에서 거듭 살피며 같은 지점이 두 번 오르지 않고 첫 줄이 옷 조각이며 마지막에는 `{ ok:false }` 임을 단언한다. 규칙은 계획대로이고 시험 기대만 규칙에 맞췄다.
- **Files modified:** test/unit/scene.test.ts
- **Commit:** 1667fe5c(RED 를 다시 커밋할 때 고친 시험이 들어갔다 — 구현 전에도 실패하는 것은 같다)

**4. [Rule 1 - 시험 설계] 워커 응답 모양 비교를 `view.day` 경로로 한정했다**
- **Found during:** Task 2 GREEN 확인
- **Issue:** `view.me` 전체의 키 경로는 마피아·시민·유령이 원래 다르다(`me.role`·`me.allies` 등). 처음 쓴 모양 비교가 그 차이 때문에 실패했다. 또 발자국 줄은 `n`, 옷 조각·창문은 `piece` 를 가져 단서 줄 안쪽의 키도 다르다.
- **Fix:** 모양 비교는 프레임 종류·수와 `view.day` 키 경로로 하고(21-03 lampLeak 의 `shapeOf` 와 같은 방침), 단서 줄은 길이·내용(r·n·piece)을 따로 단언한다. 응답 횟수(저장 한 번 + 본인 한 프레임)와 다른 소켓 0프레임은 그대로 단언한다.
- **Files modified:** test/worker/sceneLeak.test.ts
- **Commit:** f017fbf4

## Auth Gates

없음.

## Known Stubs

없음. 클라이언트는 아직 `inspect` 를 보내지 않고 `day.scene`·`me.scene` 을 그리지 않는다 — 지점 표지·[살펴보기]·단서 카드·의심 보드는 21-10·21-11 이 맡는다. 서버 규칙·와이어는 이 계획에서 완성이다.

## 알려진 한계 · 열린 항목

- **집 없는 맵의 아침 길이(결정 0088-17):** "집이 없는 맵(재즈 바·광장 — 시험 설정에서만 원인 흐름)은 현장이 없고 morning 은 길이 0 으로 건너뛴다" 는 문장 중 현장 없음(buildScene 이 `clueSpots` 가 없으면 undefined)은 이 계획이 지켰다. 그러나 `morningMsOf`(discussion.ts, 21-01 소유)는 피해자가 나온 아침이면 맵과 무관하게 현장 시간을 더해, 집 없는 맵의 시험 전용 원인 흐름에서는 현장 없는 30초 아침이 생긴다. 이 계획의 `files_modified` 밖이고 제품 경로(확장판 = 마을 고정)에서는 일어나지 않아 고치지 않았다. 필요하면 `morningMsOf` 가 `state.scene` 유무를 보게 하는 한 줄로 닫힌다.
- **의사·본인 집:** 미수 현장(의사가 막은 아침)에서 노려진 사람이 자기 집 지점을 살피는 것을 막지 않았다 — 계획에 제외 조건이 없다.

## Threat Flags

없음 — 새 네트워크 면은 필드 없는 `inspect` 메시지 하나와 공개 `day.scene.house` 하나뿐이고 계획의 위협 모형이 다룬다. T-21-12(응답 동일)는 워커 시험이 마피아·시민·흔적·거절의 프레임 종류·수와 다른 소켓 0프레임으로, T-21-13(view 의 서버 값)은 모든 프레임의 키 경로에 `footprints·touched·sceneSeen·cloth·window·windowLit·errandCut` 이 없음과 view.ts 의 주석 아닌 줄 grep 0 으로, T-21-14(위치 위조)는 스키마 시험(`spot`·`x`·`z` 거부)과 서버 world 위치로, T-21-15(연타)는 `inspect:{id}` 간격 키로, T-21-16(미수 집 공개)은 `day.scene` 의 키가 `house` 하나뿐임을 단언해 완화·수용했다.

## 위생·기타

- 소리 낱말(소리·sound·audio·효과음)은 바뀐 서버 코드 diff 에서 0건이다(soundProtocol (가) 시험도 통과). 사용자 위생 git grep 스크립트는 21-01~21-03 과 같이 이 PC 에서 찾아 실행하지 않았다.
- 작업 트리는 계획 시작 때 깨끗했고 마지막 코드 커밋 뒤에도 `git status` 가 깨끗하다.

## Self-Check: PASSED

- FOUND: shared/game/scene.ts, test/unit/scene.test.ts, test/worker/sceneLeak.test.ts
- FOUND commits: 1667fe5c, 7a974c89, 0cae2a05, f017fbf4 (모두 HEAD 의 조상)

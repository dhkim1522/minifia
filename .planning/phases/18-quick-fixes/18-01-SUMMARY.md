---
phase: 18-quick-fixes
plan: "01"
subsystem: game-rules
tags: [look, outfit, beginGame, setLook, evidence-narrowing, tdd, leak-tests]

requires:
  - phase: 10-lobby-dress
    provides: setLook·players[].look 공개 의상 (결정 D-6, L25·L26)
provides:
  - resolveLookConflicts(players) — 시작 때 겹친 옷을 2패스로 푸는 순수 함수 (shared/game/look.ts)
  - lockedOutfits(others) — 다른 사람이 직접 고른 옷 집합 (18-05·18-09 가 그대로 가져다 쓴다)
  - setLook 잠금 거절 ({ ok:false, error:"BAD_MESSAGE" }, 같은 값 검사 뒤)
  - beginGame 의 시작 때 해소 호출 (startGame·rematch·튜토리얼·테스트 방 모두 경유)
affects: [18-05, 18-09, trace, view, rematch]

actuals:
  tokens: 6216
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns:
    - "해소는 seat·look 만 읽는 순수 함수 — 입력 타입에 role·난수·시각이 없다(L25)"
    - "잠금 거절은 이유 없는 { ok:false } 하나로 DO 의 기존 !result.ok 분기를 탄다(L30)"

key-files:
  created: []
  modified:
    - shared/game/look.ts
    - shared/game/room.ts
    - test/unit/look.test.ts
    - test/unit/gameRoom.test.ts
    - test/worker/dress.test.ts
    - test/worker/leak.test.ts

key-decisions:
  - "잠금 거절은 BAD_MESSAGE — DO applyDress 가 보낸 소켓에 자기 state 한 프레임만 보내므로 250ms 간격 위반과 같은 응답이라 거절 이유가 드러나지 않는다"
  - "해소는 2패스(직접 고름 먼저 → 좌석 오름차순으로 지킬 사람을 모두 정한 뒤 진 사람에게 OUTFIT_IDS 첫 빈 옷) — 1패스는 뒤 좌석이 직접 고른 옷을 가로채 연쇄 변경이 생긴다"
  - "시작 때 풀린 옷은 look 으로 저장된다(진 사람만 키 생성) — 결과 단계와 다시 하기 뒤 대기실에도 남는다"
  - "players[].look 은 역할과 무관한 공개 의상이라 역할 단어 누설 스캔에서 이 경로만 제외한다(L25 시험이 독립성을 따로 고정)"

requirements-completed: [SC-1]

coverage:
  - id: D1
    description: "[시작] 순간 겹친 옷이 풀려 한 판 안에서 (look ?? coat) 가 모두 다르다(직접 고름 우선, 같은 순위는 좌석 번호 작은 사람이 지킴, 2패스)"
    requirement: "SC-1"
    verification:
      - kind: unit
        ref: "test/unit/look.test.ts#시작 때 겹친 옷 풀기 (P18-1, D-01)"
        status: pass
      - kind: integration
        ref: "test/worker/dress.test.ts#의상 — 시작 때 겹친 옷 풀기 (D-01, P18-1)"
        status: pass
    human_judgment: false
  - id: D2
    description: "해소가 난수·역할을 읽지 않는다: 같은 시드에서 randInt 호출·역할 열·맵이 같고, 역할만 다른 두 판의 해소 뒤 look 열이 같다"
    requirement: "SC-1"
    verification:
      - kind: unit
        ref: "test/unit/gameRoom.test.ts#startGame — 시작 때 겹친 옷 풀기와 난수 순서 (D-01, L25)"
        status: pass
      - kind: integration
        ref: "test/worker/dress.test.ts#L25: 역할 배정만 다른 두 판 A·B 에서 같은 대본을 보내고 시작하면 모든 좌석 소켓의 players[].look 열이 같다"
        status: pass
    human_judgment: false
  - id: D3
    description: "대기실·결과 단계에서 남이 직접 고른 옷은 서버가 오류 없이 버린다(보낸 소켓만 state 한 프레임, 다른 소켓 0프레임, 저장 그대로). 남의 기본 coat 와 내 옷은 잠기지 않는다"
    requirement: "SC-1"
    verification:
      - kind: unit
        ref: "test/unit/look.test.ts#옷장 잠금 (P18-2, D-02)"
        status: pass
      - kind: integration
        ref: "test/worker/dress.test.ts#옷장 잠금 — 서버 (D-02)"
        status: pass
    human_judgment: false
  - id: D4
    description: "UI Considerations #5(시작 때 옷 교체, partial): 글·토스트 없이 캐릭터만 바뀌고 다음 대기실에서 바뀐 옷이 선택 카드로 보인다 — 서버 저장은 시험으로 확인, 화면 쪽은 18-05 가 이어 간다"
    verification: []
    human_judgment: true
    rationale: "화면에서 옷이 조용히 바뀌어 보이는지와 옷장 선택 카드 표시는 사람 눈 판단이며 18-05(화면 쪽 잠금 표시)에서 만든다. 이 계획은 서버 look 저장까지만 시험한다."

duration: 25min
completed: 2026-11-10
status: complete
plan_head_before: 0665aab0cee0bd045ebcbd53fbbf0d859fdd2dcf
plan_head_after: 0dbc9d652b5ca8fe8e01ecef3ebe13e912ecec82
commits: 4
---

# Phase 18 Plan 01: 겹친 옷 풀기와 옷장 잠금 Summary

**beginGame 이 시작 순간 seat·look 만으로 겹친 옷을 2패스로 풀고(난수·역할 불변), setLook 이 남이 직접 고른 옷을 이유 없이 버려 한 판 안의 옷이 모두 달라진다 — 흔적 조각이 옷과 일대일이라 증거가 한두 명으로 좁혀진다(결정 0081-1).**

## Performance

- **Duration:** 약 25분
- **Completed:** 2026-11-10T23:56Z 무렵
- **Tasks:** 2 (각각 RED·GREEN 커밋 한 쌍)
- **Files modified:** 15 (계획 선언 7개 + 아래 "계획 밖 시험 파일" 9개 중 겹치는 것 제외)

## Accomplishments

- `resolveLookConflicts`: 직접 고른 옷이 기본 coat 보다 우선, 같은 순위는 좌석 번호가 작은 사람이 지키고, 진 사람은 OUTFIT_IDS 순서의 첫 빈 옷(2패스, 가로채기 없음). 겹침이 없으면 같은 배열 객체를 돌려주고 입력은 바꾸지 않는다. look.ts 에 `.role` 접근이 없어 기존 소스 가드가 그대로 통과한다.
- `beginGame` 이 역할을 붙이기 전에 `resolveLookConflicts(state.players)` 를 부른다. 같은 시드에서 randInt 호출 인자 열·역할 열·맵이 해소 유무와 무관하게 같다(gameRoom 시험).
- `lockedOutfits` + `setLook` 잠금: 같은 값 검사 뒤 남이 직접 고른 옷이면 `{ ok:false, error:"BAD_MESSAGE" }`. `worker/room.ts` 는 한 줄도 바뀌지 않았고(`git diff 4a5dabea -- worker/room.ts` 비어 있음), 기존 분기가 보낸 소켓에 state 한 프레임만 보낸다(워커 시험이 다른 소켓 0프레임·저장 그대로를 대기실·결과 단계 모두 고정).

## Task Commits

1. **Task 1 (tracer, tdd): 시작 때 겹친 옷 풀기**
   - RED `60464f85` test(18-01): 시작 때 겹친 옷 풀기 실패 시험
   - GREEN `f8446c37` feat(18-01): 시작 순간 겹친 옷 풀기(beginGame)
2. **Task 2 (auto, tdd): 옷장 잠금 서버 거절**
   - RED `2bacc4e8` test(18-01): 옷장 잠금 서버 거절 실패 시험
   - GREEN `0dbc9d65` feat(18-01): 남이 직접 고른 옷 잠금(setLook)

**Plan metadata:** 이 SUMMARY 와 STATE·ROADMAP 갱신은 별도 `docs(18-01)` 커밋.

## TDD RED 증거

**Task 1** — 명령 `npx vitest run test/unit/look.test.ts --reporter=tap-flat`, exit 1, 26개 중 5개 실패(해소 규칙 표 다섯. "겹침 없으면 같은 객체" 는 자리 함수가 입력을 돌려줘 RED 에서도 통과 — 정상).
- 대상: `test/unit/look.test.ts > 시작 때 겹친 옷 풀기 (P18-1, D-01) > 8명 전원 기본이면 …`
- 기대 `-,police,doctor,mafia,detective,reporter,elder,hood` / 실제 `-,-,-,-,-,-,-,-`.
- `gsd_run check tdd-red-evidence` → `RED_EVIDENCE_OK`(reason `target_test_failed`).
- 의미 판단: 불러오기 오류가 아니라 자리 함수 `resolveLookConflicts`(입력을 그대로 돌려줌)가 해소를 안 해 `toBe` 단언이 실패했다 — 계획한 이유의 실패. 같은 RED 커밋에서 gameRoom(`expected 1 to be 5`)·워커 dress(해소 안 된 `0:coat,1:hood,2:hood,3:coat`) 시험도 단언으로 실패했다.

**Task 2** — 명령 `npx vitest run test/unit/look.test.ts --reporter=tap-flat`, exit 1, 3개 실패(lockedOutfits 집합·잠금 거절·left 잠금).
- 대상: `… > 옷장 잠금 (P18-2, D-02) > 남이 직접 hood 를 입고 있으면 setLook(hood) 는 BAD_MESSAGE …`
- 기대 `BAD_MESSAGE` / 실제 `ok`.
- `RED_EVIDENCE_OK`. 의미 판단: 자리 함수(빈 집합)가 있어 불러오기 오류가 아니고, 잠금이 없어 저장이 수락되는 것이 실패 이유다. 워커 시험도 `expected '[state:lobby]' to be '[]'`(다른 소켓이 프레임을 받음)로 실패했다.

REFACTOR 커밋은 없다(정리할 변화 없음).

## Files Created/Modified

- `shared/game/look.ts` — resolveLookConflicts·lockedOutfits 추가, setLook 잠금과 머리 주석
- `shared/game/room.ts` — look 가져오기, beginGame 이 players 를 해소 결과로 만든 뒤 역할을 붙임
- `test/unit/look.test.ts`, `test/unit/gameRoom.test.ts`, `test/worker/dress.test.ts` — 새 describe 와 기대 갱신
- `test/worker/leak.test.ts` — 해소 결과 기준으로 look 단언·행 키 갱신
- 계획 밖 시험 파일(아래 편차 참고): `test/unit/bots.test.ts`, `execution.test.ts`, `nyquist-01-roleflow.test.ts`, `testTools.test.ts`, `view.test.ts`, `test/worker/bots.test.ts`, `nightLeak.test.ts`, `testTools.test.ts`, `trial.test.ts`

## Decisions Made

- 거절 모양은 계획의 선택대로 `BAD_MESSAGE`(오류 문구는 오라클이 된다).
- 해소 결과를 look 키로 저장하는 것은 계획 지침 그대로이며, 이 때문에 "기본 판은 look 키가 없다"를 가정하던 시험이 여럿 바뀌었다(편차 1).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - 시험 가정] 해소로 기본 판의 players[].look 이 생겨 기존 시험 22개가 깨짐**
- **Found during:** Task 1 (`npm test` 전체 실행, 계획 action 4 가 예고한 일)
- **Issue:** (가) 시작한 모든 판에서 좌석 0 을 뺀 사람에게 look 이 생긴다. 키 목록을 다섯 개로 고정한 시험(view·execution·bots·testTools·leak·dress)이 깨졌다. (나) 해소로 생긴 look 값이 `mafia`/`police`/`doctor` 라서 "view 어디에도 역할 단어가 없다"를 검사하는 시험(nyquist-01·execution D-09·testTools 되돌리기·trial 처형 발표)이 깨졌다. 의상은 역할의 함수가 아니라(L25) 누설이 아니다.
- **Fix:** 키 목록 시험은 `look` 키를 빼고 비교(또는 `look,` 제거), 역할 단어 스캔은 `.players[].look` 경로(또는 `"look":"…"` 값)만 제외했다. 의상이 없던 상태가 필요한 시험(view 의 look 규칙, testTools 의 resetToLobby 의상 유지)은 풀린 옷을 먼저 지우고 시작한다. leak.test.ts 의 look 단언은 "대본 + resolveLookConflicts 결과"로 바꾸고 저장된 행·bench 행의 키는 `look` 유무를 허용한다. 약화가 아니라 새 공개 규칙에 맞춘 것이며, L25(역할만 다른 두 판의 look 열이 같다) 시험은 해소 뒤 열에도 그대로 성립한다.
- **Files modified:** 위 "계획 밖 시험 파일" 아홉 개와 leak·dress
- **Verification:** `npx vitest run` 전체 통과(278 파일 통과·6 건너뜀, 7946 통과)
- **Commit:** `f8446c37`

**2. [Rule 1 - 시험 가정] 흔적 조각 비교가 간헐 실패(nightLeak 암살 밤)**
- **Found during:** Task 1 (전체 실행에서 한 번 실패, 단독 반복 시 약 50% 재현)
- **Issue:** 흔적 조각은 피해자를 고른 마피아 한 명의 옷 조각을 난수 한 번으로 뽑는다(`pickTracePiece`). 예전에는 모두 coat 라 늘 같은 조각이었지만 두 마피아의 옷이 달라지자 두 구간(조용히/바쁘게)의 조각이 달라질 수 있다. 조각은 마피아 행동과 무관한 서버 난수 값이다.
- **Fix:** 그 시험의 구간 비교에서만 `"trace":"…"` 조각 이름을 같은 자리표로 접었다. 흔적이 실린다는 정규식 단언과 마피아 열이 두 구간에서 달라야 한다는 대조는 그대로다.
- **Files modified:** `test/worker/nightLeak.test.ts`
- **Verification:** 단독 6회 반복·전체 실행 통과
- **Commit:** `f8446c37`

**3. [사실 정정] 계획 예시 문자열 하나가 틀림**
- 5명 예시 "역할을 읽지 않는다" 입력 `[-, mafia, -, mafia, -]` 의 올바른 결과는 `-,mafia,doctor,police,detective`(진 사람 순서 3→2→4)다. 시험 기대를 규칙대로 적었다. 계획의 "좌석 1·4 직접 mafia" 표 예시(`-,mafia,doctor,detective,police`)는 그대로 통과한다.

**Total deviations:** 3 (시험 가정 갱신 2, 계획 예시 정정 1). **Impact:** 제품 코드 변경은 계획 범위(look.ts·room.ts)뿐이다. `test/worker/bench.test.ts` 는 계획이 수정 대상으로 적었지만 잠금에 걸리는 대본이 없어(쉬는 사람 한 명의 단발 dress) 바꿀 것이 없었다.

## Authentication Gates

None.

## Known Stubs

None.

## Threat Flags

None — 새 네트워크 경로·권한 경로 없음. T-18-01(해소 입력에 역할 없음, L25 시험), T-18-02(거절 응답 동일, 워커 시험)가 시험으로 고정됐다.

## Issues Encountered

- 후속 관찰(범위 밖, 기록만): 이제 흔적 조각은 "피해자를 고른 사람 중 한 명의 옷"이므로 마피아가 둘이면 그 판의 조각이 두 옷 중 하나로 갈린다. 의도한 증거 좁히기(0081-1)이며 별도 조치 없음.

## Next Phase Readiness

18-05 가 `lockedOutfits` 를 그대로 가져다 옷장 잠금 표시에 쓰면 된다. 시작 때 바뀐 옷은 look 으로 저장되어 다음 대기실 옷장에서 선택 카드로 보일 근거가 서버에 있다.

## Self-Check: PASSED

- 파일: shared/game/look.ts·room.ts 및 시험 파일 존재 확인
- 커밋: 60464f85·f8446c37·2bacc4e8·0dbc9d65 모두 HEAD 의 조상
- 수락 기준: `resolveLookConflicts` 정의 1, `resolveLookConflicts(state.players)` 1, `lockedOutfits` 정의 1, `lockedOutfits(state.players.filter` 1, `worker/room.ts` 불변, `npm test`·`npm run typecheck` 통과

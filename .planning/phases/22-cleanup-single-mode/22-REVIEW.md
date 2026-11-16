---
phase: 22-cleanup-single-mode
reviewed: 2026-11-16T00:00:00Z
depth: standard
files_reviewed: 24
files_reviewed_list:
  - shared/game/verdict.ts
  - shared/game/nomination.ts
  - shared/game/phases.ts
  - shared/game/tick.ts
  - shared/game/execution.ts
  - shared/game/will.ts
  - shared/game/view.ts
  - shared/game/audience.ts
  - shared/game/room.ts
  - shared/game/bots.ts
  - shared/game/gather.ts
  - shared/protocol.ts
  - shared/schemas.ts
  - worker/room.ts
  - src/net/useWill.ts
  - src/net/useVerdictMoment.ts
  - src/game/verdictMoment.ts
  - src/game/dayView.ts
  - src/world/pinPlan.ts
  - src/world/presence.ts
  - src/world/character.ts
  - src/screens/GameMap.tsx
  - src/screens/GamePanel.tsx
  - src/components/v2/WillSheet.tsx
findings:
  critical: 0
  warning: 4
  info: 5
  total: 9
  necessity: 1
status: issues_found
---

# Phase 22: Code Review Report

**Reviewed:** 2026-11-16
**Depth:** standard
**Files Reviewed:** 24
**Status:** issues_found

## Summary

22페이즈는 삭제가 대부분이라 새로 들어온 동작 로직(찬반 → 순차 지목 → 유언 → 처형 흐름, 유언 [남기기], 정규화 안전장치, 뷰 허용 목록)만 읽었다. 삭제분과 시험은 훑지 않았다.

**누출·상태 정합성 쪽은 문제가 없다.** 확인한 것:

- 찬반 집계: `yes * 2 > yes + no` 는 `yes > no` 와 같고 0표·동수는 부결이다. 오프바이원 없음. `resolveVerdict` 가 집계 직후 모든 `verdictVote` 를 키째 지워서, 마감 뒤에는 누가 찬성했는지 어디에도 남지 않는다.
- `buildDay` 는 `verdictCount` 의 두 수만 싣고 좌석 목록은 없다. `me.verdictVote` 는 본인 view 에만 있다. `applyVerdict` 는 값이 바뀔 때만 전원에게 방송하고, 방송에 실리는 것은 두 수뿐이라 개인별 누출은 없다.
- 단계 경로: 부결·동률·0표는 모두 `afterDayOf()` → night 로 가고, 통과 + 최다 한 명은 defense → execution → night 로 간다. 막히는 경로는 찾지 못했다. `resolveNomination` 이 `verdict.passed` 를 보존하므로 이중 처형도 없다. 빈 유언·봇·끊긴 처형자도 defense 10초 뒤 정상으로 넘어간다.
- `[남기기]` 최종 경로: `advance()` 가 먼저 돌아 마감이 지난 뒤의 final 은 단계 조건(`before.phase === "defense"`)에서 걸러진다. `this.room` 을 동기로 바꾼 뒤에 await 하므로 알람과의 경합에서도 이중 처형·이중 카드가 없다. `emitDeathCards(before)` 는 저장 전 상태를 prev 로 받아 올바르게 비교한다.
- 서버에 심부름·구역 타이머 잔재 없음. `reschedule`/`nextWakeAt` 은 단계 마감·만료·continuity·봇만 본다. src·shared·worker 어디에도 `"errand"`·`"tutorial"` 문자열 비교는 남지 않았다(정규화 표 제외).
- `will` 공개 값은 처형 단계의 `day.execution.will` 하나이고 필드별 복사다. 방어 채팅 잠금은 `CHAT_PHASES` 제외로 서버 권위를 지킨다. typing·emote·chat 이 같은 `channelOf` 를 지난다.

BLOCKER 는 없다. 경고 4건은 아래와 같다. (1) 유언 클라이언트 흐름의 거절 처리 두 건, (2) 옛 방 정규화 사각지대, (3) 정규화가 채팅 저장분을 남기는 점. 정보 5건은 낡은 주석·죽은 선언이다.

`necessity-review.md` 는 읽었고 필요성 판정은 IN-05 한 건이다.

## Warnings

### WR-01: [남기기] 가 거절되거나 유실되면 시트가 '남김' 으로 굳고 다시 못 보낸다

**File:** `src/net/useWill.ts:104-105, 140-148, 258-269`
**Issue:** `save()` 의 처형자 분기는 `send({t:"will", final:true})` 직후 `setFinalFor(view.phaseEndsAt)` 로 `finalSent` 를 켠다. 이 경로는 `pending` 을 만들지 않는다. 그래서 거절 감시 effect(140-148)가 `pendingRef.current === null` 로 곧바로 return 하고 `onFail` 도 안 부른다. `finalSent` 는 `autoOn` 도 끈다(178).
실패 시나리오: 처형자가 제로폭 문자·제어문자만 입력하면 클라이언트 `normalized()` 는 `trim()` 이 비지 않아 원문을 그대로 보낸다. 서버 `readBody` 는 `sanitizeChatText` 실패로 null 을 돌려주고 `saveWill` 은 BAD_MESSAGE 를 반환한다. `applyWill` 의 final 분기는 `return saved.error` 로 tick 을 건너뛰므로 방은 defense 에 그대로 있다. 화면은 '남김' 으로 잠겨 단추가 `disabled` 이고 재전송도 없다. 남은 10초는 그대로 흐르고, 마지막 자동 저장도 꺼져 있다. 소켓 속도 제한(`overRateLimit`)으로 final 한 프레임이 조용히 버려져도 같은 상태가 된다.
**Fix:** 거절 감시를 final 에도 건다. `rejected` 가 늘면 final 대기를 푼다.
```ts
// useWill.ts 거절 effect
useEffect(() => {
  if (seenRejected.current === rejected) return;
  seenRejected.current = rejected;
  if (finalFor !== null) { setFinalFor(null); live.current.onFail(); return; }
  if (pendingRef.current === null) return;
  setPendingBoth(null);
  live.current.onFail();
}, [rejected, setPendingBoth]);
```
서버 쪽도 `normalized()` 가 실패하면 원문을 보내는 대신 클라이언트에서 [남기기] 를 막는 편이 낫다.

### WR-02: 마감 직전 자동 저장이 늦게 도착하면 처형 연출 순간에 '지금은 고를 수 없어요' 토스트가 뜬다

**File:** `src/net/useWill.ts:76, 199-204`, `src/screens/GameMap.tsx:321-325`
**Issue:** 마지막 자동 저장은 마감 700ms 전(`WILL_LAST_SEND_LEAD_MS`)에 한 번 더 non-final 로 나간다. 모바일 왕복이 700ms 를 넘으면 서버 `advance()` 가 먼저 execution 으로 넘긴 뒤 메시지를 처리한다. 이때 처형자는 이미 탈락이라 `saveWill` 이 BAD_MESSAGE 를 돌려주고 `sendRejection` 이 간다. 자동 저장은 `pending`·`busyRef` 를 만들지 않아(주석: "조용한 저장") GameMap 의 거절 분기가 `!willBusy.current` 로 `show(REJECT_TEXT)` + deny 신호를 낸다. 모두가 유언 카드를 보는 3초 동안 처형자 화면에만 오류 토스트가 뜨고 마지막 글은 사라진다. 시험에서는 지연이 없어 잡히지 않는다.
**Fix:** 자동 저장은 거절돼도 조용해야 한다. `busyRef.current = true` 를 보낸 뒤 약 1.5초 동안 켜 두거나, GameMap 거절 분기에서 `view.phase !== "defense"` 이고 `will.condemned` 였던 직후면 토스트를 건너뛴다. 근본적으로는 앞당김 값을 고정 700ms 가 아니라 측정한 왕복 시간 + 여유로 잡는다(이미 `offset` 을 받고 있다).

### WR-03: `mode` 키가 없는 옛(확장판) 방은 판 중이어도 옛 방 표시에 걸리지 않을 수 있다

**File:** `shared/game/room.ts:562-581` (표), 호출 `shared/game/room.ts:477`
**Issue:** `isLegacyV3Room` 은 표시 키(`tutorialPassed`·`lamps`·`scene`·`errandTickAt`·`errandLast`·`mode`, 개인 키 `stats` 등)와 단계 `tutorial`·`errand`·맵 `town` 만 본다. 그런데 22페이즈 이전에는 `mode` 가 optional 이었고 "없으면 extended" 였다(`git show a693661b^:shared/game/room.ts:250`). 그 키들 대부분은 단계 중에 지워진다. `errandTickAt` 은 `enterDiscussion`, `errandPlaces` 류는 `enterNight`, `lamps` 는 `enterErrand` 가 지운다. `stats` 는 처음 쓸 때 생긴다. 따라서 `mode` 가 저장되지 않은 확장판 방이 discussion → execution 사이(그날 어떤 단계든)에 있으면 표시가 하나도 없을 수 있다. 이런 방은 리셋되지 않고 새 엔진으로 이어진다.
옛 순서(지목 → 변론 → 찬반(후보 있음) → 처형)의 `verdict`·`defense` 상태가 새 순서(찬반 → 지목 → 유언 → 처형)로 해석된다. 옛 defense 에서 `verdict.passed` 가 없으면 `enterExecution` 은 아무것도 안 하고 밤으로 넘어가 처형 없이 끝난다. 옛 verdict 에서는 `resolveVerdict` 가 지목을 처음부터 다시 시작한다. 크래시는 없지만 배포 순간 진행 중이던 방 몇 개가 어긋난 판으로 이어진다. 개인 배포 후 한 번에 실테스트(project-v3-plan)라 영향 범위는 좁다.
**Fix:** 표시 키 목록을 늘리는 대신 저장 방에 버전 도장을 찍고, 도장이 없으면 옛 방으로 본다. `createRoomState` 가 `schema: 22` 를 쓰고 `REMATCH_ROOM_KEYS`(허용 목록)에도 넣어 리셋·다시 하기가 도장을 잃지 않게 해야 한다. 지금 새로 만든 방이 아직 도장이 없다는 점만 배포 순서로 처리하면(배포 직후 첫 생성 전에는 모든 방이 옛 방) 신규 방을 지우는 사고도 막는다.
```ts
// isLegacyV3Room 끝에 추가
|| stored.schema !== 22
```
이 변경은 이미 저장된 새 방(22 이후 생성, 도장 없음)을 한 번 지우므로 배포 시점에 "새 방 없음"을 확인한 뒤 넣는다.

### WR-04: 옛 방 리셋이 채팅 저장분과 월드의 `lay`·`home` 을 지우지 않는다

**File:** `worker/room.ts:126-160` (생성자), `shared/game/room.ts:597-624`
**Issue:** `toLobbyFromLegacy` 는 방 상태만 대기실로 되돌린다. 생성자는 바로 아래에서 `restoreChatLog(storage.list("chat:"))` 로 옛 판의 채팅 줄(마피아 채널·유령 채널 포함)을 그대로 되살리고, `restoreWorld` 는 저장된 `lay`·`home` 을 그대로 쓴다. 대기실로 돌아온 방의 사람들이 hello 할 때 `replayFor(chatLog, seat)` 로 옛 판 채팅을 다시 받는다(좌석 마스크가 같아 새 정보는 아니지만 대기실에 지난 판 대화가 보인다). `handleRematch`·`handleTestReset` 은 같은 상황에서 채팅 키 삭제와 월드 재배치를 한다. 또 `lay.key` 는 `${day}:ring` 처럼 판 번호가 없어서 리셋 뒤 새 판 1일차가 옛 키와 같을 수 있고, `reuse` 가 옛 자리 기억을 쓴다.
**Fix:** `normalized !== stored` 이고 옛 방 리셋이었던 경우(`isLegacyV3Room(stored)`)에 한해 `deleteChatKeys` + `dropChat()` + `respawnAll` 을 같은 길로 한 번 돌린다. 생성자 안이라 `blockConcurrencyWhile` 안에서 await 해도 된다.

## Info

### IN-01: `DayView.voted` 가 선언만 남았다

**File:** `shared/protocol.ts:134`
**Issue:** 서버가 싣지 않고 src 에서도 읽는 곳이 없다(결선·결전의 `voted` 는 별개로 쓰인다). 주석이 "화면이 읽는 자리를 22-10 이 지운 뒤 이 필드도 지운다"고 해 두었는데 아직 안 지웠다. 누출 시험은 view 에서 이 키가 안 나오는 것을 이미 보증한다.
**Fix:** `voted?: number[]` 한 줄을 삭제한다(`DayView` 쪽만, `RunoffView`·`ShowdownView` 의 `voted` 는 건드리지 않는다).

### IN-02: 낡은 주석이 지금 동작과 반대로 적혀 있다

**File:** `shared/game/nomination.ts:4`, `shared/game/phases.ts:41-44, 82`, `shared/game/view.ts:278`, `src/game/dayView.ts:6-7`
**Issue:**
- `nomination.ts:4` 는 "마감(phaseEndsAt)은 읽거나 쓰지 않는다 — 15초를 다 채운다" 라고 하지만 `castTurnPoint` 는 `phaseEndsAt: now + PICK_GAP_MS` 를 쓴다.
- `phases.ts` 의 `NOMINATION_MS` 주석과 `nomination` 행 주석은 "동시 투표 15초" 인데 동시 투표는 지웠다. `NOMINATION_MS` 는 진입 훅 직전 임시 마감 값으로만 쓰이고 시험 한 곳이 따로 참조한다.
- `view.ts:278` 은 유권자를 "변론자를 뺀 산 사람" 이라 하지만 후보가 없는 찬반의 유권자는 산 사람 전원이다.
- `dayView.ts` 머리는 "기본판: 동시 투표 — 선두·과반 줄·위 알림 재료를 되살림" 이라 적혀 있다.
**Fix:** 주석을 지금 순차 지목·후보 없는 찬반 기준으로 고친다. `NOMINATION_MS` 는 이름을 임시 마감 의미로 바꾸거나 시험과 함께 정리한다.

### IN-03: 찬반은 던진 표의 과반이라 표 한 장으로도 통과한다 (설계 확인용)

**File:** `shared/game/verdict.ts:63`
**Issue:** D-11 로 확정된 규칙이다. 산 8명 중 1명이 찬성 1표를 던지고 나머지가 안 던지면 `1*2 > 1` 로 통과한다. 이어지는 순차 지목은 최다 한 명이면 과반 없이 확정하므로, 한 명이 찬성하고 한 명이 지목하고 나머지가 기권하면 처형이 난다. 버그는 아니고 어뷰징 여지다. 플레이테스트에서 걸리면 최소 정족수(예: 던진 표 ≥ 산 사람의 과반)를 `resolveVerdict` 한 줄에 더하면 된다.
**Fix:** 지금은 그대로 두고 플레이테스트 결과를 본다.

### IN-04: `toLobbyFromLegacy` 가 나간 사람(`left`)을 되살린다

**File:** `shared/game/room.ts:597-624`
**Issue:** `ended` 에서 나간 사람(`left: true`)도 `players` 에서 `REMATCH_PLAYER_KEYS` 로 다시 만들어지므로 `left` 가 빠진다. 토큰이 다시 유효해지고 자리가 끊긴 상태로 남아, 대기실 정리(D-18) 전까지 좌석을 점유한다.
**Fix:** `left === true` 인 행은 걷어 낸다. `players: [...].filter((p) => p.left !== true)`.

### IN-05: `RULES.pickTurn` 은 단일 값 `true` 인데 분기가 두 곳 남아 있다

**Category:** necessity
**File:** `shared/game/view.ts:82`, `shared/game/room.ts:485`, `shared/game/nomination.ts:57-58`
**Issue:** `RULES` 는 `Object.freeze({... pickTurn: true ...})`(`ruleset.ts:20`)이고 다른 값을 쓰는 곳이 저장소에 없다. 22-09 가 순차 지목을 유일한 규칙으로 만들었고 주석도 "동시 투표 코드는 지웠다"고 한다. 그런데 `view.ts` 는 `RULES.pickTurn && phase === "nomination"`, `room.ts` 는 `isLegacyNomination = RULES.pickTurn && ...`, `nominationStepMs` 는 `pickTurn === undefined` 일 때 "옛 규칙" 길이로 돌아가는 분기를 가진다. 거짓일 수 없는 플래그를 읽는 분기다(판단에 기댄 지적).
**Fix:** `pickTurn` 키를 `Ruleset` 에서 빼고 두 조건을 단순화한다. `nominationStepMs` 의 `undefined` 분기는 `isLegacyNomination` 이 막는 옛 저장 방 때문에 남겨 둔다.

---

_Reviewed: 2026-11-16_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

---
phase: 17-tutorial-first-case
reviewed: 2026-11-09T00:00:00Z
depth: standard
files_reviewed: 52
files_reviewed_list:
  - shared/game/audience.ts
  - shared/game/phases.ts
  - shared/game/room.ts
  - shared/game/tick.ts
  - shared/game/tutorial.ts
  - shared/game/view.ts
  - shared/protocol.ts
  - shared/schemas.ts
  - worker/room.ts
  - scripts/bots.mjs
  - scripts/e2e/avatar.mjs
  - scripts/e2e/browser.mjs
  - scripts/e2e/flows.mjs
  - scripts/e2e/lib.mjs
  - scripts/e2e/tutorial.mjs
  - src/audio/director.ts
  - src/audio/recipes.ts
  - src/audio/voice.ts
  - src/components/TestTools.tsx
  - src/components/v2/FocusRing.tsx
  - src/components/v2/HeadStack.tsx
  - src/components/v2/HostBand.tsx
  - src/components/v2/OpeningFx.tsx
  - src/components/v2/TutorialEndCard.tsx
  - src/components/v2/TutorialEntry.tsx
  - src/components/v2/TutorialEvidence.tsx
  - src/components/v2/TutorialHostBand.tsx
  - src/components/v2/TutorialNext.tsx
  - src/components/v2/TutorialProgress.tsx
  - src/components/v2/TutorialReveal.tsx
  - src/components/v2/TutorialRoleCards.tsx
  - src/components/v2/TutorialToggle.tsx
  - src/components/v2/TutorialWait.tsx
  - src/components/v2/V2Icon.tsx
  - src/debug/soundLabTable.ts
  - src/game/chatUi.ts
  - src/game/hostLine.ts
  - src/game/scenes.ts
  - src/game/tutorialScript.ts
  - src/net/session.ts
  - src/net/useFixedRoomHeight.ts
  - src/net/useTutorialDirector.ts
  - src/net/useTutorialWarm.ts
  - src/screens/Home.tsx
  - src/screens/Lobby.tsx
  - src/screens/RoomScreen.tsx
  - src/screens/TutorialScreen.tsx
  - src/styles/phase.css
  - src/styles/tutorial.css
  - src/styles/tutorialEntry.css
  - src/styles/tutorialRoom.css
  - src/styles/world.css
findings:
  critical: 0
  warning: 2
  info: 5
  total: 7
status: issues_found
---

# Phase 17: Code Review Report

**Reviewed:** 2026-11-09
**Depth:** standard
**Files Reviewed:** 52 (`.css` 5개는 토큰·hex 사용과 z-index 만 훑었다)
**Status:** issues_found

## Summary

서버 쪽(함께 진행)은 규칙을 잘 지킨다. 아래를 직접 확인했고 문제가 없었다.

- 다른 사람의 역할이 새지 않는다. `tutorial` 단계는 `revealsOwnRole:false` 라 `me.role`·`allies` 가 view 에 실리지 않는다 (`view.ts:244`).
- 누가 끝냈는지(`tutorialPassed`)는 어떤 view 키로도 나가지 않는다. 본인 값(`me.tutorialDone`)과 숫자 두 개(`done`·`total`)만 나간다.
- 신원은 소켓 첨부 `playerId` 뿐이다. 남의 완료를 표시할 수 없고, `start` 의 `tutorial` 플래그도 `checkStart` 의 방장 검사를 먼저 지난다.
- `tutorial` 단계에서는 채팅·이동·꾸미기·나가기가 모두 단계 검사에서 막힌다. `resetToLobby` 는 허용 목록 방식이라 `tutorialPassed` 가 남지 않고, 나머지 이탈 경로(마감·전원 완료·끊김·테스트 넘기기)는 모두 `tick` 의 `ON_ENTER.assigning` 훅을 지난다.
- `tsc` 앱·워커 설정 모두 오류가 없다.

치명적 결함(CR)은 찾지 못했다. 남은 것은 클라이언트 쪽 경계 사례 두 건(WR)과 정리 항목이다. `deferred-items.md` 에 적힌 항목(작은 화면 가장자리, 360x560 겹침, `errandLeak` 간헐 실패)은 의도된 미해결이라 다시 올리지 않았다.

## Warnings

### WR-01: 첫 사건용 이름 "나" 예외가 실제 판의 닉네임 "나" 를 가린다

**File:** `src/components/v2/HeadStack.tsx:29,82`
**Issue:** `NameTag` 가 `me && name !== ME_NAME` 일 때만 " (나)" 를 붙인다. 이 예외는 첫 사건의 가짜 출연 이름이 "나" 라서 만들었다. 그런데 `NameTag` 는 실제 판에서도 같이 쓰이고, 닉네임 규칙(`shared/nickname.ts`)은 1글자("나")를 허용한다. 닉네임이 정확히 "나" 인 실제 플레이어는 자기 캐릭터에 " (나)" 표시를 받지 못한다. 튜토리얼 전용 사정이 실제 게임 화면의 동작을 바꿔 놓은 회귀이고, 닉네임 "나" 와 튜토리얼 출연 이름이 같다는 숨은 결합도 생겼다.
**Fix:** 이름을 비교하지 말고 튜토리얼이 넘기는 명시적 속성으로 가른다.
```tsx
// NameTagProps 에 추가
/** 이름이 이미 "나" 라서 " (나)" 접미를 붙이지 않는다(첫 사건 전용) */
selfNamed?: boolean;
// 렌더
<span className="mv-tag__name">{me && selfNamed !== true ? `${name} (나)` : name}</span>
```
`ME_NAME` 상수는 지우고, 튜토리얼이 만드는 내 이름표에서만 `selfNamed` 를 켠다. GameMap → HeadStack 으로 가는 경로에 속성이 없으면 `TUTORIAL_CAST` 의 좌석 번호로 정하는 방법도 있다.

### WR-02: 재접속 직후 이미 끝낸 사람에게 장면 1 이 잠깐 다시 시작된다

**File:** `src/screens/RoomScreen.tsx:392-404, 537-543`
**Issue:** 사용자가 끝냈음을 보내면 로컬 상태(`tutorialSentEpoch = connection.epoch`)만으로 곧바로 기다림 화면으로 간다. 서버가 받은 뒤 보내는 `me.tutorialDone` 상태가 오기 전에 소켓이 끊겼다 다시 붙으면(모바일의 일시 끊김) 연결 번호가 올라간다. 이때 화면이 쥔 마지막 view 에는 아직 `me.tutorialDone` 이 없으므로 `tutorialSentEpoch === connection.epoch` 가 거짓이 되고, `TutorialScreen` 이 새로 마운트되어 장면 1 을 다시 그린다. 오프닝 소리와 3D 무대 준비도 다시 시작된다. 서버가 이미 완료를 받았다면 새 state 가 도착한 뒤에야 기다림 화면으로 돌아간다. 서버가 받지 못했다면 처음부터 다시 보는 것이 의도이지만, 받았을 때까지 깜빡임과 소리가 나는 것은 의도가 아니다. 서버 완료가 기록됐는지 알 수 없는 구간이다.
**Fix:** 재접속 첫 state 가 올 때까지(연결 번호가 바뀐 뒤 서버 view 를 한 번 받을 때까지) 보낸 직후라면 기다림 쪽 화면을 유지한다.
```tsx
// 보낸 번호가 있으면 연결 번호가 바뀌어도 첫 서버 view 가 오기 전까지는 기다림 유지
const sentHere = tutorialSentRef.current !== null;
const showWait = view.me.tutorialDone === true || tutorialSentEpoch === connection.epoch || (sentHere && !freshViewSinceReconnect);
```
`freshViewSinceReconnect` 는 `useRoomConnection` 이 epoch 마다 첫 state 도착을 알리는 값으로 만든다. 단순하게 가려면 `tutorialSentRef` 를 비교하지 말고 `phase` 가 바뀔 때만 지우도록 하고, 서버가 `tutorialDone` 을 false 로 확인해 준 뒤(재접속 첫 state)에만 장면으로 되돌린다.

## Info

### IN-01: `protocol.ts` 의 주석이 이미 끝난 일을 "17-12 가 한다" 고 쓴다

**File:** `shared/protocol.ts:353, 381`
**Issue:** `tutorialDone?: true; // … view 에 싣는 일은 17-12` 와 `/** … 싣는 일은 17-12 view.ts 가 한다. */` 는 지금은 틀린 설명이다. `shared/game/view.ts:333-336, 404` 가 이미 두 값을 싣는다.
**Fix:** 두 문구를 지우거나 "view.ts 가 tutorial 단계에서만 싣는다" 로 고친다.

### IN-02: 같은 "마감 당기기 + tick + afterTransition" 가 세 곳에 복제됐다

**File:** `worker/room.ts:924-927, 953-957, 1658-1661`
**Issue:** `applyEndDiscussion`·`applyTutorialDone`·`handleDisconnect` 가 `this.room = tick({ ...state, phaseEndsAt: now }, now, cryptoRandInt); await this.afterTransition(prev, now);` 를 각자 쓴다. 한 곳을 고치면(예: 다음에 알람 따라잡기 처리를 더하면) 나머지가 어긋난다.
**Fix:** `private async advanceNow(prev: RoomState, base: RoomState, now: number)` 하나로 묶고 세 곳이 부른다.

### IN-03: `useTutorialDirector`·`playTutorialCue` 는 소리 실패를 막지 않는데 `useTutorialWarm` 은 막는다

**File:** `src/net/useTutorialDirector.ts:30,57,61,73` · `src/net/useTutorialWarm.ts:9-13`
**Issue:** `getEngine()` 호출이 한 파일에서는 `try/catch` 로 감싸이고 다른 파일에서는 그렇지 않다. 엔진 `play` 는 안쪽에서 대부분 실패를 삼키지만 `getEngine()`(`createEngine()`) 자체가 던지는 환경에서는 효과 안에서 예외가 터져 장면 시계가 멈춘다. `unlockAudio` 도 같은 이유로 `try/catch` 를 쓴다. 지금 코드가 실제로 던지는 경로는 확인하지 못했다. 일관성 문제로 둔다.
**Fix:** `getEngine()` 호출을 한 헬퍼(`safeEngine()`)로 감싸 세 곳이 같이 쓴다.

### IN-04: E2E 흐름의 쓰이지 않는 변수와 고정 sleep

**File:** `scripts/e2e/tutorial.mjs:148` (`vp` 선언만 하고 `tutorialSoloFlow` 안에서 쓰지 않음), `:290, :330, :346` (`sleep(2300)`·`sleep(1900)`·`sleep(2500)`)
**Issue:** 연출 길이에 맞춰 고정 시간을 기다리면 느린 러너에서 판정이 흔들린다. 같은 파일 다른 자리는 `readTutorialStable` 로 값이 안정되길 기다린다.
**Fix:** `vp` 를 지운다. 고정 sleep 은 "마지막 연출 요소가 보일 때(예: `[data-tutorial-formula]` 불투명도 1)" 를 기다리는 조건으로 바꾼다. 판정 문턱은 그대로 둔다.

### IN-05: 방장 스위치의 값이 화면 로컬이라 새로고침하면 초기값으로 돌아간다

**File:** `src/screens/Lobby.tsx:103`
**Issue:** `tutorialOn` 은 `useState` 초기값(첫 판이면 켜짐)뿐이라 방장이 끄고 새로고침하면 다시 켜진다. 설계(서버에 방송하지 않음, 0080-3)에는 맞다. 다만 방장이 끈 줄 알고 [시작] 을 누르면 모두가 최대 150초 튜토리얼을 거치게 된다. 지금 동작이 의도라면 코드 수정은 필요 없다.
**Fix:** 필요하면 `sessionStorage` 에 방 코드별로 한 줄 저장하고 방장 재접속 시 복원한다. 저장하지 않기로 했다면 이 항목은 닫는다.

---

_Reviewed: 2026-11-09_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

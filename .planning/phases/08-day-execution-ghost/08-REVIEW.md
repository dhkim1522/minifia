---
phase: 08-day-execution-ghost
reviewed: 2026-11-03T00:00:00Z
depth: standard
files_reviewed: 150
files_reviewed_list:
  - design/tokens.json
  - index.html
  - scripts/bots.mjs
  - scripts/e2e/browser.mjs
  - scripts/e2e/flows.mjs
  - scripts/e2e/lib.mjs
  - scripts/e2e/lib.test.mjs
  - scripts/e2e/run.mjs
  - scripts/gallery.mjs
  - scripts/gen-tokens.mjs
  - scripts/smoke.mjs
  - scripts/uat-day.mjs
  - scripts/uat-test-bots.mjs
  - scripts/uat-test-room.mjs
  - scripts/uat-vote.mjs
  - shared/game/audience.ts
  - shared/game/bots.ts
  - shared/game/discussion.ts
  - shared/game/execution.ts
  - shared/game/gather.ts
  - shared/game/map.ts
  - shared/game/movement.ts
  - shared/game/nomination.ts
  - shared/game/phases.ts
  - shared/game/room.ts
  - shared/game/testTools.ts
  - shared/game/tick.ts
  - shared/game/verdict.ts
  - shared/game/view.ts
  - shared/game/world.ts
  - shared/protocol.ts
  - shared/schemas.ts
  - src/components/Icon.tsx
  - src/components/ResultAnnounce.tsx
  - src/components/RoleCardButton.tsx
  - src/components/TestTools.tsx
  - src/components/v2/ChatPanel.tsx
  - src/components/v2/HeadStack.tsx
  - src/components/v2/PhaseHeader.tsx
  - src/components/v2/RoleChip.tsx
  - src/components/v2/SureStamp.tsx
  - src/components/v2/TopToast.tsx
  - src/components/v2/V2Icon.tsx
  - src/components/v2/VerdictPicker.tsx
  - src/components/v2/VoteBadge.tsx
  - src/components/WorldStage.tsx
  - src/debug/sheetDebug.ts
  - src/game/chatUi.ts
  - src/game/dayView.ts
  - src/game/eliminationText.ts
  - src/game/scenes.ts
  - src/game/verdict.ts
  - src/net/chatStore.ts
  - src/net/useChat.ts
  - src/net/useDayFx.ts
  - src/net/useMapInsets.ts
  - src/screens/Assigning.tsx
  - src/screens/GameMap.tsx
  - src/screens/GamePanel.tsx
  - src/screens/Lobby.tsx
  - src/screens/RoomScreen.tsx
  - src/styles/atmosphere.css
  - src/styles/game.css
  - src/styles/phase.css
  - src/styles/result.css
  - src/styles/rolecard.css
  - src/styles/testtools.css
  - src/styles/tokens.css
  - src/styles/v2.css
  - src/styles/world.css
  - src/world/camera.ts
  - src/world/character.ts
  - src/world/maps/bar.ts
  - src/world/presence.ts
  - src/world/renderer.ts
  - src/world/runtime.ts
  - src/world/tagOrder.ts
  - src/world/threeCamera.ts
  - src/world/threeRenderer.ts
  - test/client/atmosphere.test.tsx
  - test/client/characterAudit.test.tsx
  - test/client/chatPanel.test.tsx
  - test/client/chatStore.test.ts
  - test/client/gameMap.test.tsx
  - test/client/ghostView.test.tsx
  - test/client/guide.test.tsx
  - test/client/icon.test.tsx
  - test/client/lobby.test.tsx
  - test/client/nightChat.test.tsx
  - test/client/nightMap.test.tsx
  - test/client/nominationScreen.test.tsx
  - test/client/phaseArrival.test.tsx
  - test/client/phaseScreens.test.tsx
  - test/client/resultScreen.test.tsx
  - test/client/roleCard.test.tsx
  - test/client/roleCardFlow.test.tsx
  - test/client/stageBox.test.tsx
  - test/client/testTools.test.tsx
  - test/client/useChat.test.tsx
  - test/client/v2parts.test.tsx
  - test/client/verdictScreen.test.tsx
  - test/client/voteParts.test.tsx
  - test/client/worldStage.test.tsx
  - test/helpers/voteState.ts
  - test/unit/atmosphereCss.test.ts
  - test/unit/audience.test.ts
  - test/unit/barScene.test.ts
  - test/unit/bots.test.ts
  - test/unit/camera.test.ts
  - test/unit/cameraThree.test.ts
  - test/unit/character.test.ts
  - test/unit/chatUi.test.ts
  - test/unit/dayStaticGuard.test.ts
  - test/unit/dayView.test.ts
  - test/unit/discussion.test.ts
  - test/unit/e2eContract.test.ts
  - test/unit/eliminationText.test.ts
  - test/unit/endgame.test.ts
  - test/unit/execution.test.ts
  - test/unit/gameRoom.test.ts
  - test/unit/gather.test.ts
  - test/unit/map.test.ts
  - test/unit/movement.test.ts
  - test/unit/night.test.ts
  - test/unit/nomination.test.ts
  - test/unit/nyquist-04-multiday-flow.test.ts
  - test/unit/phases.test.ts
  - test/unit/presence.test.ts
  - test/unit/scenes.test.ts
  - test/unit/schemas.test.ts
  - test/unit/tagOrder.test.ts
  - test/unit/testTools.test.ts
  - test/unit/tick.test.ts
  - test/unit/tokensV2.test.ts
  - test/unit/verdict.test.ts
  - test/unit/verdictRule.test.ts
  - test/unit/view.test.ts
  - test/unit/world.test.ts
  - test/worker/alarm.test.ts
  - test/worker/bots.test.ts
  - test/worker/chat.test.ts
  - test/worker/chatReplay.test.ts
  - test/worker/endgame.test.ts
  - test/worker/ghostLeak.test.ts
  - test/worker/helpers.ts
  - test/worker/leak.test.ts
  - test/worker/testTools.test.ts
  - test/worker/trial.test.ts
  - test/worker/world.test.ts
  - worker/room.ts
findings:
  critical: 1
  warning: 3
  info: 5
  total: 9
status: issues_found
---

# Phase 08: Code Review Report

**Reviewed:** 2026-11-03
**Depth:** standard
**Files Reviewed:** 150
**Status:** issues_found

## Summary

우선순위대로 서버 규칙(worker/room.ts, shared/game/*, protocol, schemas)을 먼저 끝까지 읽고, 그다음 클라이언트 논리(GameMap, GamePanel, RoomScreen, useDayFx, dayView, runtime, presence, WorldStage, v2 부품)와 스크립트, 마지막으로 테스트를 훑었다.

서버 쪽은 역할·찬반 값·남의 지목 값이 산 사람 view 로 새는 길을 찾지 못했다. view.ts 는 허용 목록 리터럴로만 만들고, `endVote`·`nominate`·`verdictVote` 는 마감 훅이 키째 지우며, 유령 위치 프레임은 `audience`(mover 기준)와 `worldVisibleTo`(보는 사람 기준) 한 길로만 나간다. 입력 검증(strictObject, 좌석 0..7, 프레임 1024B, 20개/초)과 단계·생존·변론자 검사 순서도 이상이 없다. 새 유령 snap 의 `ghostSnapped` 가 하이버네이션으로 비면 유령에게 snap 이 한 번 더 갈 수 있으나 유령에게만 가고 무해하다(코드 주석과 같은 판단).

찾은 문제는 모두 화면 문구·접근성·결과 요약·E2E 실행기 쪽이다. 가장 무거운 것은 찬반이 부결된 처형 단계에서 화면 읽기 영역이 "○○ 님 처형"이라고 거짓으로 알리는 것이다(CR-01). 이미 알려진 열린 질문(밤 진입 알림 없음, 낮 채팅 패널 항상 그림) 뒤에 숨은 구체적 버그는 찾지 못했다.

## Critical Issues

### CR-01: 찬반 부결인데 처형 단계 화면 읽기가 "○○ 님 처형"이라고 알린다

**File:** `src/screens/RoomScreen.tsx:98-102`
**Issue:** `executionAnnounceOf` 는 `view.day?.execution?.seat ?? view.day?.candidate` 로 좌석을 고르고 곧바로 `${nickname} 님 처형` 을 돌려준다. 서버는 `day.execution` 을 찬반이 통과한 판에만 만든다(`enterExecution` 이 `verdict.passed !== true` 면 `execution` 을 만들지 않고, `buildDay` 는 `state.execution !== undefined` 일 때만 싣는다). 부결이면 `day.execution` 은 없고 `day.candidate` 만 남으므로 `??` 의 오른쪽으로 떨어져 변론자 이름으로 "처형" 문구가 만들어진다. 이 문장은 단계가 바뀔 때 읽는 `aria-live` 영역(`PHASE_ANNOUNCE.execution`)이라 스크린 리더 사용자는 처형이 없었는데 처형됐다고 듣는다. 같은 화면의 시각 알림(`dayView.ts` 의 `phaseEntry`)은 `verdict.passed` 로 갈라 "처형 없음"을 보이므로 두 채널이 서로 모순이다. 이 경로를 확인하는 테스트도 없다(`test/client` 에 execution 단계 announce 검사가 없음).
**Fix:**
```ts
function executionAnnounceOf(view: RoomView): string {
  if (view.day?.verdict?.passed !== true) return "처형 없음";
  const seat = view.day.execution?.seat ?? view.day.candidate;
  const nickname = seat === undefined ? undefined : view.players.find((p) => p.seat === seat)?.nickname;
  return nickname === undefined ? "처형" : `${nickname} 님 처형`;
}
```
그리고 부결 view 로 `PHASE_ANNOUNCE.execution` 이 "처형 없음"을 내는 테스트를 하나 더한다.

## Warnings

### WR-01: 지목 동률·0표인 날의 결과 요약이 "처형 없음 (찬성 0 · 반대 0)"으로 나오고 동률/무표 구분이 사라진다

**File:** `src/game/verdict.ts:90-104` (고정값을 쓰는 테스트: `test/unit/verdict.test.ts:95-115`, `test/client/resultScreen.test.tsx:330-345`)
**Issue:** `summaryLines` 는 `!passed` 를 먼저 보고 "처형 없음 (찬성 n · 반대 m)" 으로 끝낸다. "동률"·"던진 표 없음" 문구가 있는 마지막 `else` 는 `passed === true` 이면서 `candidate` 가 없을 때만 닿는다. v1.0 흐름에서만 생기던 모양이다. 8페이즈 서버는 지목 동률·0표일 때 `resolveNomination` 이 줄을 `exec: { yes: 0, no: 0, passed: false }`, `cand: { votes }`(candidate 없음)로 쌓고 찬반을 건너뛰므로 `buildSummary` 의 행도 `passed: false` 다. 그래서 새 흐름의 동률·0표 날은 모두 첫 갈래로 가서 결과 화면에 "처형 없음 (찬성 0 · 반대 0)" 이 찍힌다(찬반이 없었는데 0 대 0 표가 있었다는 거짓 정보이고, 밤 안내의 `noExecutionText` 와도 어긋난다). 테스트는 `passed: true` + `candidate` 없음이라는 새 서버가 만들지 않는 고정값만 쓰므로 실제 경로의 이 결함을 잡지 못한다.
**Fix:** `!passed` 갈래에서 voteLog 의 `cand` 로 먼저 구분한다.
```ts
} else if (log?.cand !== undefined && log.cand.candidate === undefined) {
  text = log.cand.votes.length === 0 ? "처형 없음 (던진 표 없음)" : "처형 없음 (동률)";
} else if (!passed) {
  text = `처형 없음 (찬성 ${yes} · 반대 ${no})`;
}
```
그리고 테스트 고정값을 서버가 실제로 내는 `{ passed: false, cand: { votes } }` 모양으로 바꾼다(옛 모양 `passed: true` 는 저장 방 이전용으로 남기려면 별도 케이스로).

### WR-02: 게임 중 방장 화면에서 연결이 끊긴 사람의 이름표가 동작 없는 "내보내기" 버튼이 된다

**File:** `src/screens/GameMap.tsx:317` (`onKick={() => {}}`), `src/components/WorldStage.tsx:277-278, 311-314`, `src/styles/world.css:21`
**Issue:** `WorldStage` 는 `kickable = !pickable && current && canKick && away && !me` 일 때 이름표를 `aria-label="○○ 님 내보내기"` 버튼으로 만든다. `canKick = view.me.isHost && props.canSend` 에는 단계 조건이 없다. 로비에서는 맞지만 `GameMap` 도 같은 `WorldStage` 를 쓰면서 `onKick` 에 빈 함수를 넘기므로, 게임 중 방장 화면에서는 연결이 끊긴 모든 사람의 이름표가 포커스되는 "내보내기" 버튼이 되는데 누르면 아무 일도 일어나지 않는다(서버 `kickPlayer` 도 로비 밖은 `CANNOT_KICK`). 접근성 이름이 거짓 기능을 알리고, `.mf-world__kick` 은 `pointer-events: auto; padding: 11px; margin: -11px` 라 그 사람 머리 주변 탭이 맵 걷기 입력을 가로챈다(낮 토론에서 방장이 걷는 중 끊긴 사람 곁을 누르면 걷기가 안 된다).
**Fix:** `WorldStage` 에 로비 전용 플래그를 두거나(`onKick` 을 선택 속성으로 바꿔 없으면 `kickable` 거짓), `GameMap` 이 `canKick` 을 끄는 prop 을 넘긴다.
```tsx
const canKick = view.me.isHost && props.canSend && props.onKick !== undefined;
```
(`GameMap` 은 `onKick` 을 넘기지 않는다.)

### WR-03: E2E 실행기가 준비 실패로 재시도할 때 먼저 기록된 검사 실패를 버려 성공으로 바꿔 놓을 수 있다

**File:** `scripts/e2e/run.mjs:121-136`
**Issue:** `runJob` 은 시도마다 새 `ctx.results` 를 만들고 `flow.run` 이 끝까지 던지지 않았을 때만 `results.push(...ctx.results)` 한다. 흐름이 중간에 `ok: false` 검사를 기록한 뒤 이후 단계에서 `SetupError`·시간 초과로 던지면 그 시도의 실패 검사는 통째로 사라지고, 재시도가 통과하면 실행 결과는 "E2E OK" 가 된다. 마지막 시도까지 실패해도 남는 것은 `S4` 한 줄뿐이라 먼저 있던 실제 실패 항목이 가려진다. 헤더 주석은 "검사 실패는 다시 돌지 않는다"고 하나 실제로는 던져진 시도에 묻힌 검사 실패가 재시도에 덮인다. 간헐 재시도 원인을 보려고 넣은 `재시도:` 한 줄 로그에도 검사 실패 수는 없다.
**Fix:** 던진 시도의 `ctx.results` 중 `ok === false` 인 항목은 재시도 전에 보존하거나 최소한 재시도 로그에 개수를 남긴다.
```js
} catch (e) {
  lastError = e;
  carried.push(...ctx.results.filter((r) => !r.ok));
  ...
}
// 성공해도 carried 를 results 에 합쳐 실패로 남긴다
```

## Info

### IN-01: RoomScreen 의 단계 안내 표에 사라진 상태를 말하는 낡은 주석이 남아 있다

**File:** `src/screens/RoomScreen.tsx:52`
**Issue:** `nomination: () => "지목", // 8페이즈: 서버가 아직 이 단계를 만들지 않는다 — 문구는 08-13 이 다시 본다`. 서버는 이미 지목 단계를 만들고 08-13 도 끝났다. 또 `defense` 안내와 달리 `nomination`·`verdict` 는 "지목"·"찬반"이라는 이름만 읽어 사용자가 할 일(의심되는 사람을 누름, 찬성·반대를 누름)이 없다.
**Fix:** 주석을 지우고, 필요하면 `GameMap` 의 `headerFor` 안내 문구와 같은 출처로 맞춘다.

### IN-02: 봇·UAT 스크립트의 서버 `ping` 응답 처리는 도달하지 않는 코드다

**File:** `scripts/bots.mjs:95`, `scripts/uat-day.mjs:62`, `scripts/uat-vote.mjs:84`, `scripts/uat-night.mjs:75`
**Issue:** `if (msg.t === "ping") ws.send({ t: "pong", c: msg.c })`. 프로토콜에서 `ping` 은 클라이언트 → 서버이고 서버가 보내는 것은 `pong` 뿐이며, 서버 스키마에는 클라이언트 `pong` 메시지가 없다(보내면 `BAD_MESSAGE`). 서버가 `ping` 을 보낼 일이 없어 죽은 코드이고, 읽는 사람에게 서버가 하트비트를 요구하는 것처럼 오해를 준다.
**Fix:** 네 줄을 지운다.

### IN-03: 공유 미리보기 이미지가 v1.0 호스트를 가리킨다

**File:** `index.html:11`
**Issue:** `og:image` 가 `https://minifia.dhplay.workers.dev/og.png`(v1.0 Worker)다. v2 는 `public/og.png` 를 같이 배포하는데도 링크 미리보기가 v1.0 배포에 의존한다. 프로젝트 규칙은 v2 가 v1.0 주소를 검사·배포하지 않는 것이므로(결정 0043), v1.0 을 내리면 v2 공유 링크 미리보기가 깨진다. (이번 단계에서 바뀐 줄은 폰트 링크뿐이라 기존 상태이지만 대상 파일이다.)
**Fix:** `https://minifia-v2.dhplay.workers.dev/og.png` 로 바꾸거나 `og:image` 를 상대 경로를 쓰지 않는 v2 출처 상수로 맞춘다.

### IN-04: 채팅 입력칸 `maxLength` 가 자소가 아니라 UTF-16 코드 단위로 센다

**File:** `src/components/v2/ChatPanel.tsx:289` (`maxLength={CHAT_MAX_GRAPHEMES}`)
**Issue:** 서버 한도는 자소 100(`sanitizeChatText`)인데 HTML `maxlength` 는 UTF-16 코드 단위다. 이모지 등 서로게이트 쌍은 한 자소가 2단위라 50개에서 막혀, 서버가 받아 줄 글이 입력단계에서 잘린다. 한글만 쓰면 영향이 없다. 안전한 쪽으로만 틀리므로 심각하지 않다.
**Fix:** 입력단계 제한을 서버 스키마 상한(300)에 맞추고 100 자소 판정은 `onChange` 에서 `countGraphemes` 로 한다.

### IN-05: 누설 테스트 보조 코드의 종료 승자 값이 와이어 값과 다르다

**File:** `test/worker/ghostLeak.test.ts:95`
**Issue:** `toPhase(room.code, "ended", (r) => ({ ...r, winner: "citizens" }))` — 와이어 값은 `"citizenWin"` | `"mafiaWin"`(`GameWinner`)이다. 이 테스트는 `ended` 에서 snap 이 없는지만 보므로 통과하지만 서버가 만들지 않는 상태를 저장한다. 같은 헬퍼를 다른 테스트가 쓰면 `buildSummary`·결과 화면 경로가 잘못된 값을 먹는다.
**Fix:** `winner: "citizenWin"` 로 고친다.

---

_Reviewed: 2026-11-03_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

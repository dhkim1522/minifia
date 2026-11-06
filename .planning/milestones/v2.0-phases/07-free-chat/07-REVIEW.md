---
phase: 07-free-chat
reviewed: 2026-11-02T04:10:00Z
depth: standard
files_reviewed: 143
files_reviewed_list:
  - HANDOFF.md
  - docs/architecture.md
  - docs/decisions/0016-day-loop-structure.md
  - docs/decisions/0017-day-table-redesign.md
  - docs/decisions/0019-mafia-night-chat.md
  - docs/decisions/0020-night-morning-contract.md
  - docs/decisions/0023-sequential-claims.md
  - docs/decisions/0058-v2-chat-retention.md
  - docs/screen-map.md
  - scripts/bots.mjs
  - scripts/e2e/browser.mjs
  - scripts/e2e/flows.mjs
  - scripts/e2e/lib.mjs
  - scripts/e2e/lib.test.mjs
  - scripts/gallery.mjs
  - scripts/perf-run.mjs
  - scripts/smoke.mjs
  - scripts/uat-day.mjs
  - scripts/uat-night.mjs
  - scripts/uat-test-bots.mjs
  - scripts/uat-test-room.mjs
  - scripts/uat-vote.mjs
  - shared/game/audience.ts
  - shared/game/bots.ts
  - shared/game/chatLog.ts
  - shared/game/chatRules.ts
  - shared/game/night.ts
  - shared/game/phases.ts
  - shared/game/room.ts
  - shared/game/testTools.ts
  - shared/game/tick.ts
  - shared/game/view.ts
  - shared/protocol.ts
  - shared/schemas.ts
  - src/components/DayTable.tsx
  - src/components/Icon.tsx
  - src/components/TestTools.tsx
  - src/components/UserRecordSheet.tsx
  - src/components/WorldStage.tsx
  - src/components/v2/ChatPanel.tsx
  - src/components/v2/HeadStack.tsx
  - src/components/v2/V2Icon.tsx
  - src/game/chatText.ts
  - src/game/chatUi.ts
  - src/game/dayTable.ts
  - src/game/recordRows.ts
  - src/game/roleText.ts
  - src/game/scenes.ts
  - src/game/verdict.ts
  - src/net/chatStore.ts
  - src/net/useChat.ts
  - src/net/useKeyboardLift.ts
  - src/net/useRoomConnection.ts
  - src/screens/DayScene.tsx
  - src/screens/Lobby.tsx
  - src/screens/RoomScreen.tsx
  - src/screens/verdictScene.tsx
  - src/styles/day.css
  - src/styles/daytable.css
  - src/styles/lobby.css
  - src/styles/room.css
  - src/styles/testtools.css
  - src/styles/v2.css
  - src/styles/verdict.css
  - src/world/camera.ts
  - test/client/atmosphere.test.tsx
  - test/client/candidateVote.test.tsx
  - test/client/characterAudit.test.tsx
  - test/client/chatPanel.test.tsx
  - test/client/chatStore.test.ts
  - test/client/dayScene.test.tsx
  - test/client/dayTable.test.tsx
  - test/client/defense.test.tsx
  - test/client/discussion.test.tsx
  - test/client/execIntro.test.tsx
  - test/client/execVote.test.tsx
  - test/client/execution.test.tsx
  - test/client/guide.test.tsx
  - test/client/icon.test.tsx
  - test/client/keyboardLift.test.tsx
  - test/client/lobby.test.tsx
  - test/client/morning.test.tsx
  - test/client/nightChat.test.tsx
  - test/client/nightScene.test.tsx
  - test/client/noExecution.test.tsx
  - test/client/phaseArrival.test.tsx
  - test/client/phaseScreens.test.tsx
  - test/client/resultScreen.test.tsx
  - test/client/reveal.test.tsx
  - test/client/roleCardFlow.test.tsx
  - test/client/roomScreen.test.tsx
  - test/client/sceneIntro.test.tsx
  - test/client/testTools.test.tsx
  - test/client/testToolsCompact.test.tsx
  - test/client/useChat.test.tsx
  - test/client/useRoomConnection.test.tsx
  - test/client/userRecordSheet.test.tsx
  - test/client/v2parts.test.tsx
  - test/client/verdictStates.test.tsx
  - test/client/worldStage.test.tsx
  - test/helpers/verdictViews.ts
  - test/unit/audience.test.ts
  - test/unit/bots.test.ts
  - test/unit/camera.test.ts
  - test/unit/chatLog.test.ts
  - test/unit/chatRules.test.ts
  - test/unit/chatStaticGuard.test.ts
  - test/unit/chatText.test.ts
  - test/unit/chatUi.test.ts
  - test/unit/dayTable.test.ts
  - test/unit/discussion.test.ts
  - test/unit/e2eContract.test.ts
  - test/unit/endgame.test.ts
  - test/unit/execution.test.ts
  - test/unit/gameRoom.test.ts
  - test/unit/night.test.ts
  - test/unit/nyquist-02-phase-matrix.test.ts
  - test/unit/nyquist-03.1-multiday.test.ts
  - test/unit/nyquist-04-multiday-flow.test.ts
  - test/unit/preview.test.ts
  - test/unit/recordRows.test.ts
  - test/unit/scenes.test.ts
  - test/unit/schemas.test.ts
  - test/unit/testTools.test.ts
  - test/unit/tick.test.ts
  - test/unit/verdict.test.ts
  - test/unit/verdictCss.test.ts
  - test/unit/view.test.ts
  - test/worker/alarm.test.ts
  - test/worker/bots.test.ts
  - test/worker/chat.test.ts
  - test/worker/chatLeak.test.ts
  - test/worker/chatReplay.test.ts
  - test/worker/day.test.ts
  - test/worker/endgame.test.ts
  - test/worker/helpers.ts
  - test/worker/http.test.ts
  - test/worker/leak.test.ts
  - test/worker/night.test.ts
  - test/worker/testTools.test.ts
  - test/worker/vote.test.ts
  - test/worker/world.test.ts
  - worker/room.ts
findings:
  critical: 0
  warning: 3
  info: 7
  total: 10
status: issues_found
---

# Phase 7: Code Review Report

**Reviewed:** 2026-11-02T04:10:00Z
**Depth:** standard
**Files Reviewed:** 143
**Status:** issues_found

## Summary

7페이즈(자유 채팅) 변경을 적대적으로 검토했다. 우선순위는 서버(worker/room.ts, shared/**)였고, 그다음 src/**, 마지막으로 scripts·test·docs를 훑었다. 방식은 다음과 같다.

- `worker/room.ts`, `shared/game/{audience,chatLog,chatRules,room,bots,tick,view,night,testTools,phases}.ts`, `shared/{protocol,schemas}.ts`, `src/net/{chatStore,useChat,useRoomConnection,useKeyboardLift}.ts`, `ChatPanel`, `DayScene`, `Lobby`, `RoomScreen`, `DayTable`, `camera.ts`와 CSS 변경분은 전문을 읽었다.
- 나머지 src 변경분(WorldStage·verdictScene·UserRecordSheet 등)과 scripts·docs는 diff를 읽었다.
- 테스트와 e2e·uat 스크립트는 약화·무력화 패턴 검색과 표본 읽기로 봤다.
- `npx tsc -p tsconfig.app.json` 과 `tsconfig.worker.json` 은 오류 0, `npx vitest run` 은 142파일 3847통과·1건 건너뜀이다. 건너뛴 1건은 `camera.test.ts` 의 `CAMERA_PRINT=1` 전용 출력 블록이다.

핵심 보안 불변식은 코드와 테스트로 확인했다. 이벤트 프레임(world·chat·typing)은 `deliver(audience(...))` 한 길로만 나간다.

- 채널은 보낸 사람의 서버 상태(`channelOf`)로만 정해진다. 단계 키(pk)가 어긋나거나 채널이 없으면 더 넓은 채널로 돌리지 않고 `phase` 하나로 폐기한다.
- 와이어 줄은 `toWire` 가 키 다섯만 복사하므로 마스크·g·n·id가 나가지 않는다.
- 재접속 복원은 보낼 때의 좌석 마스크만 쓴다.
- 입력 중 신호도 같은 audience를 지나고, 채널이 없으면 조용히 버린다.
- `view.me.chat` 은 본인 채널만 싣는다.

이 경로에서 살아 있는 사람에게 다른 편의 역할이나 비공개 채널 줄이 새는 결함은 찾지 못했다. 그래서 BLOCKER는 없다.

남은 문제는 세 가지다.

- 로비에서 좌석이 재사용될 때 복원·닉네임 귀속이 틀어진다(좌석 기반 마스크의 구조적 한계).
- 로비 시스템 줄의 시계 기준이 DayScene과 달라 정렬이 틀어질 수 있다.
- 낮 시작 화면에 사라진 기능(직업 공개)을 안내하는 문구가 그대로 배포됐다(HANDOFF가 이미 인지한 항목이지만 아직 사용자에게 보인다).

## Warnings

### WR-01: 로비에서 좌석이 재사용되면 복원 줄이 새로 들어온 사람에게 가고, 지난 줄의 보낸 사람 이름도 바뀐다

**File:** `worker/room.ts:730`, `shared/game/chatLog.ts:52-58`, `shared/game/chatLog.ts:104-112`, `src/net/useChat.ts:48-71`
**Issue:** 수신자 마스크와 줄의 보낸 사람이 모두 좌석 번호(0~7)로만 기록된다. 그런데 `lowestFreeSeat` 는 나가기(`leaveRoom`)·내보내기(`kickPlayer`) 뒤 같은 좌석을 다음 입장자에게 준다(로비에서만 가능). 그러면 두 가지가 어긋난다.

1. 서버: 나간 A(좌석 2)가 받았던 로비 `all` 줄의 마스크에는 좌석 2 비트가 켜져 있다. 새로 들어온 B가 좌석 2를 받으면, B는 hello 직후 `replayFor(this.chatLog, 2)` 로 자기가 들어오기 전의 줄을 받는다. 결정 0058-2 의 "복원이 라이브보다 넓어지지 않는다"는 불변식이 로비에서는 성립하지 않는다. 로비 `all` 채널이라 비밀 누설은 아니지만, 보낼 때의 audience 에 B가 없었다는 점은 사실이다.
2. 클라이언트: `useChat` 의 `names` 맵은 렌더 때마다 현재 `players` 로 `seat → nickname` 을 덮어쓴다. A가 쓴 줄은 이미 열려 있는 다른 사람들 화면에서도 B의 닉네임으로 바뀌어 그려진다. B 본인에게는 A의 옛 줄이 `m.me = (line.seat === mySeat)` 때문에 "나"로 표시된다.

기존 테스트(`chatReplay.test.ts`)에는 나가기·재입장 후 복원이 없어 이 경로가 검증되지 않았다.
**Fix:** 서버는 좌석이 비는 순간(`leaveRoom` 성공, `kickPlayer` 성공, `setBotCount` 로 봇을 뺄 때) 해당 좌석 비트를 기존 레코드의 마스크에서 지우고, 바뀐 레코드를 다시 저장하는 순수 함수를 둔다. 예를 들어 `chatLog.ts` 에 `clearSeat(log, seat): { log; changed: ChatRecord[] }` 를 추가하고 `handleLeave`/`handleKick`/`handleTestBots` 에서 호출해 `storage.put` 한다. 클라이언트는 줄을 받는 시점에 닉네임을 `ChatStoreLine` 에 고정해 두거나(이미 알던 이름), 줄에 `name` 을 저장하고 이후 `players` 로 덮어쓰지 않게 한다.

```ts
// shared/game/chatLog.ts (제안)
export function clearSeat(log: ChatLog, seat: number): { log: ChatLog; changed: ChatRecord[] } {
  const bit = 1 << seat;
  const changed: ChatRecord[] = [];
  const records = log.records.map((r) => {
    if ((r.r & bit) === 0) return r;
    const next = { ...r, r: r.r & ~bit };
    changed.push(next);
    return next;
  });
  return { log: { ...log, records }, changed };
}
```

### WR-02: 로비의 입장·퇴장 시스템 줄만 서버 시각 보정 없이 로컬 `Date.now()` 로 정렬된다

**File:** `src/screens/Lobby.tsx:74-76` (비교: `src/screens/DayScene.tsx:178`)
**Issue:** `ChatStore.insertAll` 은 줄을 `at` 오름차순으로 끼워 넣는다. 서버 줄의 `at` 은 서버 `Date.now()` 이고, DayScene 이 만드는 시스템 줄은 `Date.now() + connection.offset`(서버 시각 추정)을 쓴다. 그런데 Lobby 는 `const at = Date.now()` 로 시스템 줄을 만든다(`offset` prop 을 이미 받고 있는데도 쓰지 않는다). 폰 시계가 서버보다 느리면 "OO 님 입장" 줄이 최근 채팅 줄들 위쪽 중간에 끼어들어 새 줄로 보이지 않고, 빠르면 항상 맨 아래로 간다. 시계 어긋남이 수 초만 되어도 입장 줄이 한두 메시지 위로 올라가 읽는 흐름이 뒤틀리고, 위로 읽는 중이 아니면 새 줄 점도 뜨지 않는다.
**Fix:** DayScene 과 같은 기준을 쓴다.

```ts
// Lobby.tsx
const at = Date.now() + offset;
```

`offset` 은 이미 `LobbyProps` 에 있다(기본 0). 의존성 배열에는 `offset` 을 넣지 말고(`view` 마다 도는 효과라 불필요) 최신 값을 ref 로 읽는다.

### WR-03: 낮 시작 화면이 사라진 "직업 공개" 단계를 안내하는 문구를 그대로 보여 준다

**File:** `src/game/scenes.ts:71`, `src/game/scenes.ts:79`
**Issue:** 7페이즈는 순차 직업 주장(claim) 단계를 없앴다(CHAT-06). 서버는 dayAnnounce 다음에 곧바로 discussion 으로 간다. 그런데 매 낮 시작마다 보이는 문구가 `"토론 전에 먼저 직업을 공개해요"`(SceneIntro 부제, 71행)와 `"곧 직업 공개가 시작돼요"`(하단 패널 안내, 79행)로 남아 있다. 존재하지 않는 단계를 약속하는 문구라 사용자가 보기에는 오안내다. HANDOFF.md 에 이월 항목으로 적혀 있지만 이미 배포본에 나가는 문구이고, 고치는 비용이 문자열 두 개와 그에 묶인 테스트(`scenes.test.ts`, `scripts/e2e/lib.mjs`)뿐이다. "화면은 글을 최소로"(결정 0051) 지침에도 맞지 않는다.
**Fix:** 두 문구를 현재 흐름에 맞춘다. 예: 부제(`sub`)는 빼고, 하단 안내는 `guide: "곧 토론이 시작돼요"` 로 바꾼다. 문구를 바꾸면 `test/unit/scenes.test.ts` 와 `scripts/e2e/lib.mjs`(안내 검사 기대 문자열)를 같은 커밋에서 고친다.

## Info

### IN-01: 빠르게 끈 뒤 다시 켠 입력 중 신호는 최대 약 2초 동안 상대에게 보이지 않는다

**File:** `shared/game/chatRules.ts:76-88`, `src/net/useChat.ts:118-135`
**Issue:** `typingRelay` 는 마지막 "켜짐 중계" 뒤 1.5초 안에 온 켜짐을 무시하고 기록도 바꾸지 않는다. 클라이언트는 "켜져 있다고 믿는 동안" `TYPING_REFRESH_MS = 2000` 간격으로만 다시 보낸다. 줄을 보낸 직후(꺼짐 전송) 1.5초 안에 다음 줄을 치기 시작하면 첫 글자의 켜짐이 서버에서 무시되고, 클라이언트는 이미 켜졌다고 보아 2초 동안 갱신을 보내지 않는다. 연속으로 짧게 치는 사용자의 머리 위 "…" 가 늦거나 아예 안 뜬다. 보안·정합성 문제는 아니고 체감 문제다.
**Fix:** 서버가 "무시한 켜짐"의 `lastOnAt` 을 바꾸지 않는 지금 규칙은 유지하되, 클라이언트 `TYPING_REFRESH_MS` 를 1500 이하로 줄이거나, 꺼짐을 보낸 뒤 1.5초 안의 첫 켜짐은 1.5초 뒤에 한 번 더 보낸다.

### IN-02: 입력칸 `maxLength` 는 UTF-16 길이인데 문구와 서버 규칙은 "100자(자소)"다

**File:** `src/components/v2/ChatPanel.tsx:289`
**Issue:** `maxLength={CHAT_MAX_GRAPHEMES}`(100)는 HTML 에서 UTF-16 코드 단위 수로 센다. 이모지 하나가 2단위라 이모지만 쓰면 50개에서 막히고, 서버 규칙(자소 100, `CHAT_TEXT.reject.length = "100자까지…"`)보다 좁다. 반대로 서버 스키마 상한(300)과 정리 규칙은 충분히 넓어 기능상 문제는 없다. 한글만 쓰는 대부분의 경우는 영향이 없다.
**Fix:** 상수 이름과 값이 혼동을 부르므로 `maxLength` 를 별도 상수(예: `CHAT_INPUT_MAX_UTF16`)로 두고 이유를 주석으로 남기거나, 입력 시 `countGraphemes` 로 자르는 방식을 쓴다.

### IN-03: 한글 조합 꼬리 글자 제거 휴리스틱이 정상 입력도 지울 수 있다

**File:** `src/components/v2/ChatPanel.tsx:189-193`
**Issue:** 보낸 직후 `TAIL_WINDOW_MS`(500ms) 안에 끝난 조합이 보낸 문장의 끝부분(`last.text.endsWith(el.value)`)이면 되살아난 꼬리로 보고 칸을 비운다. 사용자가 "ㅋㅋㅋ" 를 보내고 0.5초 안에 "ㅋ" 을 새로 치면 정상 입력이 지워진다. 드문 경우이고 실제 IME 동작은 07-19/07-21 기기 확인 몫이라 정보로만 남긴다.
**Fix:** 기기 확인에서 꼬리 재현이 확인된 조합 이벤트 순서(예: 전송 직후 `compositionend` 가 `compositionstart` 없이 오는 경우)로 조건을 좁힌다.

### IN-04: 낡은 주석과 이름이 남았다

**File:** `shared/game/audience.ts:14`, `shared/protocol.ts:332`, `src/screens/DayScene.tsx:74`, `src/screens/DayScene.tsx:157`, `src/styles/day.css:45-47`, `src/components/ExecVotePanel.tsx:49`
**Issue:**
- `audience.ts:14` "옛 claim 은 07-08 이 PhaseId 에서 지울 때까지 여기에 들지 않는다" — 이미 지워졌다.
- `protocol.ts:332` "타입과 연결 훅만 07-11, 보내기는 07-14" — `handleHello` 가 이미 `chatLog` 를 보낸다.
- `DayScene.tsx:74` "낮 토론·밤 마피아 하단은 비어 있다(채팅 패널은 07-13·07-15)" — 패널이 붙어 있다.
- `DayScene.tsx:157` 주석 들여쓰기가 앞뒤와 어긋난다.
- `.mf-claimpanel*` 클래스 이름은 직업 공개 패널 전용이던 이름인데 지금은 `NightPanel`·`ExecVotePanel` 의 제목·안내에 쓰이고, 검사 스크립트(`scripts/e2e/browser.mjs`)도 이 이름을 선택자로 읽는다.
- `shared/game/tick.ts` 의 `DeadlineResult.stay` 분기는 이제 `stay: true` 를 돌려주는 훅이 하나도 없는 죽은 경로다(주석에도 "지금 쓰는 훅은 없다").

**Fix:** 주석을 현재 상태로 고친다. `.mf-claimpanel` 은 이름 변경을 CSS·두 컴포넌트·e2e 선택자·테스트에서 한 번에 한다. `stay` 분기는 테스트가 있으므로 지우기 전에 쓰임을 확인하고, 의도적으로 남기는 것이면 "미사용 확장점"이라고 적는다.

### IN-05: 지난 닉네임을 알 수 없는 복원 줄은 이름 칸이 빈 채로 그려진다

**File:** `src/net/useChat.ts:53-69`
**Issue:** `names` 는 현재 `players` 로만 채워진다. 새로고침 후 복원된 줄 가운데 이미 방을 나간 사람의 줄은 `names.current.get(seat) ?? ""` 로 빈 이름이 되어 `.mv-chat__name` 이 비어 있는 줄이 나온다(로비에서만 나갈 수 있으므로 WR-01 의 좌석 재사용과 같은 계열이다). 또 `useMemo` 안에서 ref 를 변경하는 부수 효과가 있다(렌더 순수성 규칙 위반, StrictMode 에서 결과는 같으나 의도가 불분명하다).
**Fix:** WR-01 의 해결(줄에 이름 고정)에 포함한다. 알 수 없는 이름은 빈 칸 대신 "(떠난 사람)" 같은 고정 문구를 쓴다. 부수 효과는 `useEffect` 나 `useRef` 갱신으로 옮긴다.

### IN-06: `chatLeak` 관측 헬퍼는 서로 다른 소켓 사이의 처리 순서를 증명하지 못한다

**File:** `test/worker/chatLeak.test.ts:12-20`, `test/worker/helpers.ts:265-271`
**Issue:** `observe` 는 보낸 쪽(first)의 ping/pong 으로 "처리 끝"을 증명한 뒤 나머지를 비운다. 그러나 누설 검사 (a) 는 마피아 A 와 B 가 함께 보내고, 시민 소켓은 B 보다 먼저 비워질 수 있다. 같은 소켓 안의 FIFO 만 보장되므로, B 의 줄이 시민 소켓을 settle 한 뒤에야 처리되면 "시민 소켓이 0프레임"이라는 단언이 우연히 통과한다(누설이 실제로 있어도 놓칠 수 있다). 현재는 항상 FIFO 로 처리되어 통과하지만 증명은 약하다.
**Fix:** `observe` 에서 `first` 뿐 아니라 이 행동에서 메시지를 보낸 모든 소켓(예: A·B)을 먼저 settle 한 다음 나머지를 settle 한다. 예: `observe(g, [mafiaA, mafiaB], …)` 형태로 `order = [...senders, ...others]`.

### IN-07: 테스트 방 생성이 공개 API 에서 `testMode` 로 열려 있다

**File:** `shared/schemas.ts:11`, `worker/room.ts:127-141`
**Issue:** `CreateRoomBodySchema` 가 누구에게나 `testMode: true` 를 허용하고, 그러면 방장이 `testSkip`·`testRole`·`testBots` 등을 쓴다. 결정 0022 의 의도된 설계이고 이번 변경에서 생긴 문제는 아니다. 다만 7페이즈에서 `testReset` 이 `chat:` 키까지 지우는 도구가 되었으므로, 비테스트 방과 같은 공개 엔드포인트에서 방 단위 격리만으로 보호된다는 점을 확인해 둔다. 현재 서버 판정은 `checkTestHost` 로 방장·testMode 를 확인하므로 다른 방에는 영향이 없다.
**Fix:** 조치 불필요. 출시 전 정리 항목(결정 0022 재검토)에 "배포본에서 testMode 방 생성 허용 여부"를 한 줄 남긴다.

---

_Reviewed: 2026-11-02T04:10:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

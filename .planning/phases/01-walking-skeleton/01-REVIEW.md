---
phase: 01-walking-skeleton
reviewed: 2026-10-23T00:00:00Z
depth: standard
files_reviewed: 44
files_reviewed_list:
  - index.html
  - shared/game/roles.ts
  - shared/game/room.ts
  - shared/game/view.ts
  - shared/nickname.ts
  - shared/seatLayout.ts
  - shared/version.ts
  - worker/index.ts
  - worker/room.ts
  - wrangler.jsonc
  - vite.config.ts
  - src/App.tsx
  - src/main.tsx
  - src/net/assets.ts
  - src/net/cardFace.ts
  - src/net/clock.ts
  - src/net/copy.ts
  - src/net/countdown.ts
  - src/net/linkReducer.ts
  - src/net/roomDiff.ts
  - src/net/session.ts
  - src/net/share.ts
  - src/net/useRoomConnection.ts
  - src/net/useSeatTransitions.ts
  - src/screens/Assigning.tsx
  - src/screens/Day.tsx
  - src/screens/ErrorScreen.tsx
  - src/screens/Home.tsx
  - src/screens/JoinByLink.tsx
  - src/screens/Lobby.tsx
  - src/screens/RoleReveal.tsx
  - src/screens/RoomScreen.tsx
  - src/components/MyRoleSheet.tsx
  - src/components/RoleCard.tsx
  - src/components/Table.tsx
  - src/components/Timer.tsx
  - src/components/ReconnectBanner.tsx
  - src/components/TextField.tsx
  - src/components/Toast.tsx
  - src/components/PhaseBar.tsx
  - src/components/Button.tsx
  - src/components/Backdrop.tsx
  - src/components/Icon.tsx
  - src/game/roleText.ts
findings:
  critical: 1
  warning: 6
  info: 9
  total: 16
status: issues_found
---

# Phase 1: Code Review Report

**Reviewed:** 2026-10-23
**Depth:** standard
**Files Reviewed:** 44
**Status:** issues_found

## Summary

지정된 소스 44개를 모두 읽었다. 문맥 확인을 위해 목록 밖의 `shared/protocol.ts`, `shared/schemas.ts`, `shared/game/tick.ts`, `shared/game/phases.ts`, `shared/roomCode.ts`, `worker/allocate.ts`, `worker/random.ts`, `src/net/api.ts`, `src/components/Sheet.tsx`, `ConfirmSheet.tsx` 도 읽었다.

핵심 원칙 확인 결과:

1. 판정은 서버가 한다. 시작 조건(방장·4명 이상·로비)·킥·나가기·단계 전환은 모두 `shared/game/*` 순수 함수를 DO 가 소켓 첨부의 playerId 로 호출해 정한다. 클라이언트가 보낸 신원·인원·연결 상태는 쓰지 않는다. 문제 없음.
2. 역할·토큰 누출. `buildView`/`buildPreview` 는 객체 리터럴 허용 목록이고, `role` 은 `revealsOwnRole` 단계의 본인에게만, `allies` 는 마피아 본인에게만 실린다. 토큰은 create/join HTTP 응답으로만 나가고 WS 프레임·미리보기·로그(`console.error` 는 `err.name` 만)에는 없다. 정적 에셋 선로드는 역할과 무관한 같은 목록이다. 누출 경로는 찾지 못했다.
3. 하이버네이션·알람. 상태는 단일 키에 저장하고, 생성자에서 알람을 건드리지 않으며, 깨어날 때 살아 있는 소켓 첨부의 connId 로 `connected` 를 다시 계산한다. 낡은 소켓의 닫힘은 connId 비교로 무시된다. 구조는 올바르다. 아래 WR-06 만 예외다.
4. 입력 검증. WS·HTTP 모두 zod 로 거르고 프레임·본문 상한과 연결당 속도 제한이 있다. 닉네임 규칙에서 CR-01 이 나왔다.

BLOCKER 는 닉네임 중복 판정이 우회되고 보이지 않는 이름이 통과하는 문제 1건이다. 나머지는 프론트엔드 연결 계층의 정리(cleanup)·순서 문제와 방 코드 공간 고갈에 대한 방어 부재다.

## Critical Issues

### CR-01: 닉네임 중복 판정이 보이지 않는 문자로 우회되고, 투명한 이름이 통과한다

**File:** `shared/nickname.ts:9-14, 28-30, 36-44`
**Issue:** 중복 비교 키 `nicknameKey` 는 NFKC + 소문자만 하고, 금지 문자 검사(`FORBIDDEN`)는 Cc/Zl/Zp/Cf 만 막는다. 그래서 다음이 모두 통과한다. 로컬에서 `validateNickname` 으로 확인했다.

- `"철‍수"` (ZWJ 를 글자 사이에 넣음)는 `ok: true` 이고 key 가 `"철수"` 와 다르다. 화면에서는 "철수" 와 똑같이 보이는 두 사람이 같은 방에 앉을 수 있다. 소셜 추론 게임에서 이름은 유일한 공개 식별자이고 이후 페이즈의 투표·지목이 이 이름에 의존한다. `NICKNAME_TAKEN` 의 목적이 무너진다.
- `"철️수"`(변형 선택자, 분류 Mn)와 결합 문자(`"철́수"`)도 같은 방식으로 우회된다.
- 한글 채움 문자 `ㅤ`, `ᅟᅠ`, 반각 `ﾠ` 는 분류가 Lo(글자)라 `VISIBLE` 을 통과한다. 점수 `ok: true` 로 화면에 아무것도 안 보이는 닉네임이 된다. 점자 빈칸 `⠀`(So)도 같다. 한국어 서비스에서 가장 흔한 투명 닉네임 수법이다.

**Fix:** 중복 키에서 보이지 않는 문자를 제거하고, 투명 문자를 금지 목록에 더한다.
```ts
// 안 보이는 채움·변형 문자. ZWJ 는 이모지 결합 때문에 표시용 이름에는 남기되 비교 키에서는 뺀다.
const INVISIBLE_FILLERS = /[ᅟᅠㅤﾠ⠀᠎​-‏⁠︀-️]/gu;
const COMBINING = /\p{M}/gu;

export function nicknameKey(nickname: string): string {
  return nickname
    .normalize("NFKC")
    .replace(INVISIBLE_FILLERS, "")
    .replace(/‍/g, "")
    .toLowerCase();
}

function hasForbiddenChar(s: string): boolean {
  return FORBIDDEN.test(s.split(ZWJ).join("")) || INVISIBLE_FILLERS.test(s.replace(/️/g, ""));
}
// VISIBLE 검사도 채움 문자를 제거한 문자열로 한다: VISIBLE.test(nickname.replace(INVISIBLE_FILLERS, ""))
```
키가 비면(`key.length === 0`) `INVALID_CHARS` 로 거절한다. 변형 선택자 U+FE0F 는 이모지 표시에 필요하니 표시용 이름에서는 허용하고 키에서만 뺀다. 같은 입력들을 단위 테스트에 추가한다.

## Warnings

### WR-01: [나가기] 확인이 연결이 끊긴 상태에서 눌리면 leave 가 사라지는데 입장 정보는 지워진다

**File:** `src/screens/Lobby.tsx:168-176`, `src/net/useRoomConnection.ts:279-282`
**Issue:** `[나가기]` 버튼은 `disabled={!canSend}` 지만, 시트가 이미 열린 뒤에 연결이 끊기면 확인 버튼은 살아 있다. `onConfirm` 은 `send({ t: "leave" })` 를 부르고 곧바로 `onLeave()` 를 부른다. `send` 는 `canSendRef` 가 거짓이면 아무것도 하지 않고(조용히 버림) `onLeave` → `onExit("left")` → `clearSession()` 이 이어진다. 결과: 서버에는 플레이어가 남고(끊긴 상태) 토큰은 사라진다. 이 사람이 같은 닉네임으로 다시 들어오면 자기 유령 때문에 `NICKNAME_TAKEN` 이 나오고, 방장이 직접 킥해야 자리가 비워진다. 같은 문제가 킥 확인(`send({t:"kick"})`)에도 있으나 그쪽은 입장 정보를 잃지 않는다.
**Fix:** 전송이 실제로 나갔을 때만 나간 것으로 처리하거나, 보낼 수 없으면 확인 버튼을 비활성화한다.
```tsx
// send 가 boolean 을 돌려주게 하고
const send = useCallback((msg: ClientMessage): boolean => {
  const ws = socketRef.current;
  if (canSendRef.current && ws && ws.readyState === OPEN) { ws.send(JSON.stringify(msg)); return true; }
  return false;
}, []);
// Lobby: 보냈을 때만 나간다. 못 보냈으면 시트를 닫고 토스트로 알린다.
onConfirm={() => { if (send({ t: "leave" })) onLeave?.(); else show("연결이 불안정해요. 다시 시도해 주세요"); }}
```
`ConfirmSheet` 에 `confirmDisabled={!canSend}` 를 전달하는 방법도 좋다.

### WR-02: 생존 확인(pong 대기) 타이머가 종료 상태(replaced/removed)에서 새 연결을 연다

**File:** `src/net/useRoomConnection.ts:194-199, 203-214`
**Issue:** `checkAlive` 가 pong 대기 타이머(2.5초)를 건 상태에서 서버가 4001(replaced)·4003(removed)로 소켓을 닫으면 `close` 핸들러는 상태만 바꾸고 `clearPongWait()` 를 부르지 않는다. 그 소켓은 `socketRef.current` 로 남아 있으므로 타이머가 터질 때 `socketRef.current !== ws` 검사를 통과하고, `emit(close)` 는 리듀서가 무시하지만 곧이어 `ws.close(); if (linkRef.current.visible) connect();` 가 실행된다. replaced 의 경우: 탭을 다시 열자마자(visibility → checkAlive) 다른 창이 가로채면, 이 탭은 "다른 창에서 이 방에 들어갔어요" 화면(리듀서가 open/state 를 무시)을 보이면서 뒤에서 새 소켓으로 hello 를 보내 상대 창을 다시 쫓아낸다. 두 창이 서로 쫓아내는 상황이 되고, 화면 상태와 실제 연결이 어긋난다.
**Fix:** 종료 상태로 넘어갈 때와 타이머 안에서 모두 막는다.
```ts
ws.addEventListener("close", (e) => {
  if (disposed || socketRef.current !== ws) return;
  const next = emit({ type: "close", code: e.code, reason: e.reason, now: Date.now() });
  if (isTerminal(next.status)) clearPongWait();
  checkRoomOnce(next);
  scheduleRetry(next);
});
// pongTimer 콜백 첫머리
if (disposed || socketRef.current !== ws || isTerminal(linkRef.current.status)) return;
```

### WR-03: 재연결 직후 지난 일을 토스트·등장 전이로 다시 보여 준다 (epoch 증가 시점이 첫 state 보다 빠르다)

**File:** `src/net/linkReducer.ts:55-57`, `src/screens/Lobby.tsx:39-47`, `src/net/useSeatTransitions.ts:688-690`
**Issue:** `epoch` 는 소켓 `open` 에서 올라가지만, 새 연결의 첫 `state` 는 hello 처리 뒤에야 도착한다. 두 소비자는 epoch 변화 시점에 "직전 스냅샷을 비운다"고 하지만 그 시점의 `view`/`players` 는 끊기기 전의 낡은 값이다. Lobby 효과는 `prevView.current = null` 직후 같은 효과에서 `prevView.current = view`(낡은 view)로 되돌려 놓는다. 이어서 도착한 새 state 가 낡은 view 와 비교되어, 끊겨 있던 동안 들어온 사람마다 "…님이 들어왔어요"/"새 방장이 되었어요" 토스트가 뜨고, `useSeatTransitions` 도 같은 이유로 등장 애니메이션을 재생한다. 코드 주석이 보장한다고 쓴 동작과 반대다.
**Fix:** epoch 가 바뀐 뒤 처음 도착하는 view 를 기준선으로 삼는다. 가장 간단한 방법은 epoch 변경 시 `prevView.current = null` 만 하고 같은 효과에서는 기록하지 않는 것이다.
```tsx
useEffect(() => {
  if (prevEpoch.current !== epoch) {
    prevEpoch.current = epoch;
    prevView.current = null;
    return; // 이 epoch 의 첫 state 가 올 때까지 기록하지 않는다
  }
  ...
}, [view, epoch, show]);
```
이 방법은 view 가 바뀌지 않은 렌더에서만 안전하므로, 리듀서가 `state` 이벤트에서 `awaitingFirstState` 같은 플래그를 두고 첫 state 에서 epoch 를 올리는 쪽이 더 확실하다(epoch 를 `open` 이 아니라 첫 `state` 에서 증가).

### WR-04: 역할 확인 화면의 카드 초기 면이 시계 오프셋 0 으로 정해진다

**File:** `src/screens/RoleReveal.tsx:31-33`, `src/net/useRoomConnection.ts:76-77, 177-178`
**Issue:** 화면이 처음 마운트될 때 `initialCardState(sinceStartMs(..., offset, ...))` 를 한 번만 계산한다. 그런데 `offset` 은 첫 pong 전에 0 이고, 서버의 state 방송이 pong 보다 먼저 도착한다(hello 처리 → 방송, 이어서 ping 3개 처리). 폰 시계가 서버보다 5초 이상 빠르면 새 판에서도 `sinceStart >= AUTO_FLIP_MS` 가 되어 카드가 처음부터 앞면으로 잠겨 열린다. 즉 사용자가 누르기도 전에 역할이 화면에 나온다(옆 사람에게 보일 수 있다). 새로고침·재접속 시에는 `offset` 이 항상 0 에서 시작하므로 더 흔하다. 오프셋이 도착한 뒤의 보정은 `autoFlip` 효과에만 있고 초기 면은 다시 계산되지 않는다. `Timer` 도 첫 pong 전까지 같은 이유로 틀린 남은 시간을 보인다.
**Fix:** 오프셋을 아직 모를 때는 view 에 실린 `serverNow` 로 초기 추정을 쓴다. 첫 state 수신 시점에 `offset0 = view.serverNow - Date.now()` 를 한 번 계산해 pong 이 오기 전까지 쓴다.
```ts
// useRoomConnection: state 수신 때, 표본이 아직 없으면 거친 오프셋을 넣는다
if (msg?.t === "state") {
  if (samples.length === 0) setOffset(msg.view.serverNow - Date.now());
  ...
}
```
또는 `RoleReveal` 이 `hasOffset` 을 받아 오프셋이 정해질 때까지 카드를 뒷면으로 고정한다.

### WR-05: 방 만들기·참가 HTTP 에 제한이 없어 4자리 코드 공간을 소진시킬 수 있다

**File:** `worker/index.ts:43-65, 74-96`, `worker/allocate.ts:21-32`
**Issue:** `POST /api/rooms` 는 속도 제한이 없고 방은 연결자가 없어도 3시간(`ROOM_TTL_MS`) 산다. 코드 공간이 10,000개라 스크립트 하나가 몇 분 안에 대부분을 채울 수 있고, 그 뒤 모든 사용자에게 `CODE_EXHAUSTED`(503)가 나온다(8번 시도 후 포기). 또 `join` 도 제한이 없어 코드를 아는 누구든 몇 요청으로 대기실 8석을 닉네임만 다른 유령으로 채울 수 있다(방장이 끊긴 자리만 킥할 수 있고, 유령은 연결된 적이 없으니 킥은 가능하지만 8번 반복해야 한다). 연결당 속도 제한은 WS 에만 있다.
**Fix:** Cloudflare Rate Limiting 바인딩(`ratelimit`)이나 IP 기준 제한을 `POST /api/rooms`, `POST /api/rooms/*/join` 에 둔다. 방 쪽으로는 "연결자가 한 번도 없었던 로비는 10~15분 뒤 만료"로 단축하면 소진 공격의 효과가 크게 줄어든다(`createRoomState` 에서 `expiresAt` 을 짧게 잡고 첫 hello 때 연장).

### WR-06: 만료됐지만 아직 정리되지 않은 방 코드로 만들면 옛 소켓을 닫지 않고 덮어쓴다

**File:** `worker/room.ts:80-98`
**Issue:** `createRoom` 은 `this.room && input.now < this.room.expiresAt` 만 보고, 만료가 지난 방이면 `advance()` 로 정리하지 않고 `this.room` 을 새 상태로 바꾼다. 옛 방의 소켓(첨부에 옛 playerId)은 닫히지 않고 남는다. 이 소켓들은 새 방에서 어떤 플레이어와도 맞지 않아 방송을 받지 못하고, hello 는 "이미 hello 함" 으로 거절되어 영원히 죽은 연결로 남는다. 알람이 먼저 울렸다면 문제가 없는 좁은 구간이지만, 알람이 한 번 실패한 뒤 재시도 사이에 오면 재현된다.
**Fix:** `createRoom` 첫머리에서 `await this.advance(input.now)` 를 먼저 부르고, 그 뒤 `this.room` 이 있으면 `CODE_TAKEN` 으로 한다.

## Info

### IN-01: hello 하지 않은 소켓에 수명 제한이 없다

**File:** `worker/room.ts:122-133, 320-353`
**Issue:** 업그레이드는 인증 없이 받아 주고(방이 존재하면), hello 를 영영 안 보내는 소켓을 정리하지 않는다. 연결 수 한도·hello 마감이 없고 `ctx.getWebSockets()` 순회(방송·교체·킥)가 그 수만큼 늘어난다. 코드를 아는 공격자가 방 하나에 수천 개를 열 수 있다. Origin 확인도 없다(토큰이 쿠키가 아니라 hello 본문이라 CSWSH 위험은 없다).
**Fix:** 업그레이드 때 소켓 수 상한(예: 32)을 확인하고, 첨부 없는 소켓은 알람(또는 첫 메시지 시각)으로 10초 안에 닫는다.

### IN-02: HTTP 본문 상한이 청크 전송에는 적용되지 않는다

**File:** `worker/index.ts:30-41`
**Issue:** 주석은 "상한 안에서 읽어" 라고 하지만, `content-length` 가 없으면(`Number("0")`) 선언 검사를 통과하고 `request.text()` 가 전체 본문을 메모리에 읽은 뒤에야 바이트를 센다.
**Fix:** `request.body` 를 `getReader()` 로 읽으며 누적 바이트가 `MAX_BODY_BYTES` 를 넘으면 즉시 취소한다.

### IN-03: 소켓 첨부의 플레이어가 방에서 빠진 뒤 들어온 메시지가 예외를 낸다

**File:** `worker/room.ts:195-197, 252-264`
**Issue:** `attachmentOf` 는 첨부 존재만 확인하고 그 playerId 가 방에 아직 있는지는 보지 않는다. 킥·나가기로 제거된 사람의 소켓이 닫히기 전에 `start` 가 도착하면 `startGame` 이 NOT_HOST 를 돌려주고 이어서 `buildView` 가 "player is not in this room" 을 던진다(처리되지 않은 예외로 로그만 남는다). 서버가 소켓을 닫으므로 도달하기 어렵지만 방어가 없다.
**Fix:** `attachmentOf` 에서 `this.room.players.some((p) => p.id === att.playerId)` 를 확인해 아니면 null 을 돌려준다.

### IN-04: 저장된 방 상태를 검증하지 않고 쓴다

**File:** `worker/room.ts:63`
**Issue:** `ctx.storage.get<RoomState>("room")` 은 형 단언일 뿐이다. 이후 페이즈에서 `Player`/`RoomState` 모양이 바뀌면 배포 시점에 살아 있는 방의 옛 모양과 맞지 않아 `tick`/`buildView` 에서 예외가 난다. 상태 버전 필드나 마이그레이션이 없다.
**Fix:** `RoomState` 에 `v: 1` 을 두고, 읽을 때 `v` 가 다르면 폐기(또는 변환)한다.

### IN-05: 입장 정보 저장 칸이 하나라 다른 방에 들어가면 이전 방 토큰을 잃는다

**File:** `src/App.tsx:44-49`, `src/screens/Home.tsx:59-65`, `src/screens/JoinByLink.tsx:159-164`
**Issue:** `enterRoom` 은 `saveSession` 으로 기존 칸을 덮어쓴다. 진행 중인 방 A 의 참가자가 뒤로 가기로 첫 화면에 와서 새 방을 만들거나 B 의 링크로 들어가면 A 의 토큰이 사라지고, A 의 자기 자리는 끊긴 유령으로 남는다. 결정된 한계(한 칸)지만 덮어쓰기 전에 알림이 없다.
**Fix:** 이미 다른 방의 입장 정보가 있으면 덮어쓰기 전에 확인을 받거나, 최소한 1페이즈 인계 문서에 한계로 기록한다.

### IN-06: 배포 도메인이 `index.html` 에 하드코딩되어 있고 보안 응답 헤더가 없다

**File:** `index.html:78`, `public/_headers`
**Issue:** `og:image` 가 `https://minifia.dhplay.workers.dev/og.png` 로 고정되어 있어 커스텀 도메인이나 다른 환경에서는 미리보기 이미지가 어긋난다. `_headers` 에는 캐시 규칙만 있고 `Content-Security-Policy`, `X-Content-Type-Options`, `Referrer-Policy`, `frame-ancestors` 가 없다. 토큰이 localStorage 에 있어 XSS 방어선(CSP)이 의미가 있다.
**Fix:** 빌드 시 `vite` 의 `transformIndexHtml` 로 도메인을 주입하거나 출시 마일스톤 체크리스트에 올린다. `_headers` 의 `/*` 에 `X-Content-Type-Options: nosniff`, `Referrer-Policy: same-origin`, `Content-Security-Policy: default-src 'self'; img-src 'self' data:; connect-src 'self' wss:; style-src 'self' 'unsafe-inline'` 를 더한다.

### IN-07: `ZWJ` 상수가 눈에 보이지 않는 리터럴 문자다

**File:** `shared/nickname.ts:10`
**Issue:** `const ZWJ = "‍";` 의 따옴표 안이 실제 U+200D 문자라 소스에서 비어 보이고, 편집기·포매터가 지우면 규칙이 조용히 바뀐다.
**Fix:** `const ZWJ = "‍";`

### IN-08: 클라이언트가 서버의 `error` 프레임을 전부 버린다

**File:** `src/net/useRoomConnection.ts:52-61, 180-193`
**Issue:** `parseServerMessage` 는 `error` 를 통과시키지만 `message` 핸들러는 `state`/`pong` 만 처리한다. 시작·킥이 거절되면(예: 사이에 누가 끊겨 `NOT_ENOUGH_PLAYERS`) 서버가 함께 보낸 state 로 화면은 맞춰지지만, 호스트는 왜 시작이 안 됐는지 안내를 받지 못하고 버튼만 2초 잠겼다 풀린다. `RATE_LIMITED` 도 마찬가지다.
**Fix:** `error` 코드를 상위로 올려 Lobby 가 토스트("지금은 시작할 수 없어요")로 알린다.

### IN-09: 알람 실패 시 만료까지 1초 간격으로 계속 다시 시도한다

**File:** `worker/room.ts:309-318`
**Issue:** 같은 예외가 계속 나는 방(예: IN-04 의 옛 모양 상태)에서는 방이 만료될 때까지(최대 3시간) 초당 알람이 반복되고 로그를 채운다. 백오프나 횟수 제한이 없다.
**Fix:** 실패 횟수를 세어 지수 백오프(1s→2s→…→60s) 하거나 N회 뒤 방을 닫는다.

---

_Reviewed: 2026-10-23_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

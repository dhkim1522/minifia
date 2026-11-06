# Phase 7: 자유 채팅 - Pattern Map

**Mapped:** 2026-11-01
**Files analyzed:** 22 (신규 11 · 수정 11, 삭제 묶음 별도)
**Analogs found:** 20 / 22

모든 analog 경로는 `git ls-files` 로 추적되는 소스다(미러 경로 없음). 줄 번호는 이 세션에서 읽은 기준이다.

## File Classification

| 신규/수정 파일 | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `shared/game/audience.ts` (신규) | utility(순수 규칙) | request-response | `shared/game/night.ts:203` `nightChatRecipientIds` + `shared/game/world.ts` 머리말 | role-match |
| `shared/game/chatRules.ts` (신규) | utility(순수 규칙) | transform | `shared/nickname.ts` + `shared/game/chat.ts` 상수/오류 구조 | role-match |
| `shared/game/chatLog.ts` (신규) | utility(순수 상태) | CRUD(보관) | `shared/game/world.ts` (`compactWorld`/`restoreWorld`) | role-match |
| `shared/protocol.ts` (수정) | model(와이어 타입) | request-response | 자기 자신(`world` 프레임 추가 선례) | exact |
| `shared/schemas.ts` (수정) | model(입력 검증) | request-response | 자기 자신 `MoveMessageSchema`(16-20) | exact |
| `worker/room.ts` (수정: handleChat/handleTyping/deliver/hello 복원/`chat:` 저장) | service(DO) | event-driven | `handleSay`(370)/`applySay`(383) + `emitWorld`(970) + 생성자(79) | exact |
| `shared/game/bots.ts` (수정) | service | event-driven | 자기 자신 `discussionAct`(173) | exact |
| `shared/game/{phases,tick,view,room}.ts` (수정: claim 제거, `me.chat`) | model | transform | `room.ts:315-335` `normalizeStoredRoom` | exact |
| `src/net/chatStore.ts` (신규) | store | pub-sub | `src/world/store.ts` `WorldStore` | exact |
| `src/net/useKeyboardLift.ts` (신규) | hook | event-driven | `src/components/Sheet.tsx:134-160` | role-match |
| `src/components/v2/ChatPanel.tsx` (신규) | component | request-response | `src/components/v2/HeadStack.tsx` (이식 규약) + `design/v2.0/design-system/components/` 승인 부품 | role-match |
| `src/components/v2/HeadStack.tsx` (수정: `typing?`) | component | event-driven | 자기 자신 | exact |
| `src/components/v2/V2Icon.tsx` (수정: send/ghost/roleMafia) | component | transform | 자기 자신 `ICONS` 표 | exact |
| `src/net/useRoomConnection.ts` (수정) | hook | streaming | 자기 자신 64행, 13행, 204행 | exact |
| `src/screens/RoomScreen.tsx` (수정: ChatStore 생성/구독) | component | pub-sub | 자기 자신 126-136 | exact |
| `src/screens/Lobby.tsx` / `DayScene.tsx` (수정: 패널 붙이기, `stageInsets.bottom`) | component | request-response | `Lobby.tsx:146` `stageInsets` | exact |
| `src/debug/chatMock.ts` (제거 또는 제품화 참고) | utility | — | 키보드 식 참고(230-243) | 참고 |
| `test/unit/{audience,chatRules,chatLog,chatStore}.test.ts` (신규) | test | — | `test/unit/worldStore.test.ts`, `test/unit/chat.test.ts` | role-match |
| `test/worker/chat.test.ts` (신규) | test | event-driven | `test/worker/world.test.ts` + `helpers.ts` | exact |
| `test/worker/leak.test.ts` (수정) | test | — | 자기 자신 45-100 | exact |
| 정적 가드 테스트(`broadcastEvent` 없음, `ws.send` 는 `sendTo` 안뿐) | test | — | `scripts/deploy-target.test.mjs`(`readFileSync` 정적 회귀) | role-match |
| `scripts/e2e/{flows,lib}.mjs` chat-* 시나리오 | test(E2E) | request-response | `scripts/e2e/flows.mjs` 기존 흐름 | exact |

## Pattern Assignments

### `shared/game/audience.ts` (utility, 순수 규칙)

**Analog:** `shared/game/night.ts:203-205` (재사용할 의미) + `shared/game/world.ts` 머리말(순수 모듈 규약: 시각은 인자, 상태 불변).

```typescript
export function nightChatRecipientIds(state: RoomState): ReadonlySet<string> {
  return new Set(state.players.filter((p) => !isAlive(p) || p.role === "mafia").map((p) => p.id));
}
```

적용: `channelOf(state, senderId)` 와 `audience(state, ev)` 가 이 규칙을 흡수한다. import 는 `chat.ts:13-19` 와 같은 상대 경로 방식(`../protocol`, `./alive` 의 `isAlive`, `./room` 의 `RoomState`). 시각·난수·DOM 을 읽지 않는다. 방어 장치(단계가 `CHAT_PHASES` 밖이면 빈 집합, `mafia` 인데 `night` 아니면 빈 집합)는 RESEARCH Pattern 1 표를 그대로 단위 테스트로 고정한다. `nightChatRecipientIds` 는 이 파일로 흡수한 뒤 `night.ts` 에서 지운다.

### `shared/game/chatRules.ts` (utility, transform)

**Analog:** `shared/nickname.ts` — 정리·자소 세기·금지 문자.

**정리 패턴** (nickname.ts:19-36, 38-41):
```typescript
const ZWJ = "\u{200D}";
const FORBIDDEN = /[\p{Cc}\p{Zl}\p{Zp}\p{Cf}]/u;
export function countGraphemes(s: string): number { /* Intl.Segmenter */ }
export function normalizeNickname(raw: string): string {
  return raw.normalize("NFC").trim().replace(/\p{Zs}+/gu, " ");
}
```
적용: `sanitizeChatText` 는 NFC, trim, `\p{Zs}+` 접기, `split(ZWJ).join("")` 뒤 FORBIDDEN 제거(ZWJ 예외)를 같은 기준으로 쓴다. 글자 수는 `countGraphemes` 를 import 해서 쓴다(새로 만들지 않는다). 상수(D5: 100자, 600ms, 5초 5줄, 3초 반복)는 한 곳에 `export const`.

**사람별 제한 판정**: 입력 상태를 바꾸지 않고 `{ ok:true, next } | { ok:false, why }` 를 돌려주는 순수 함수. 시각은 인자 `now`. 형태는 `shared/game/chat.ts` 의 `{ ok:false, error }` 결과 규약과 같다(chat.ts 는 삭제 대상이므로 규약만 가져온다). 도배 상태는 DO 메모리 Map 에 둔다(저장 안 함, `rates` WeakMap 선례 `worker/room.ts:74`).

### `shared/game/chatLog.ts` (utility, CRUD 보관)

**Analog:** `shared/game/world.ts` 의 `compactWorld`/`restoreWorld`(호출: `worker/room.ts:100`, `911`) — 순수 모듈이 직렬화 모양과 복원을 맡고 DO 가 저장 I/O 를 한다.

적용 규칙: 줄 레코드 `{ g, ch, seq, seat, text, at, n, r }`, 채널별 연번, 수신자 비트마스크 `r`, 채널별 최근 30줄 복원 조립, 채널별 상한(`all` 100 / `mafia` 300 / `ghost` 300 — 가정 A4). 저장 I/O 는 이 파일에 넣지 않는다.

### `shared/schemas.ts` (model, 입력 검증)

**Analog:** 자기 자신 16-20, 38-45.

```typescript
export const MoveMessageSchema = z.strictObject({
  t: z.literal("move"),
  x: z.number().int().min(-MOVE_COORD_LIMIT).max(MOVE_COORD_LIMIT),
  ...
}) satisfies z.ZodType<MoveMessage>;
```
적용: `chat` = `z.strictObject({ t: literal("chat"), text: z.string().max(<UTF-16 상한>), pk: z.string().max(…) })`, `typing` = `z.strictObject({ t, on: z.boolean(), pk })`. 채널 필드를 스키마에 두지 않는다(덧붙으면 strictObject 가 거부). 같은 파일 4행의 `EMOJI_IDS`/`TEMPLATE_IDS` import 와 30-38행 `claim`/`say`/`emoji` 멤버를 지운다. `satisfies z.ZodType<ClientMessage>`(56행)가 protocol.ts 변경 누락을 컴파일 오류로 잡는다. 본문 상한은 `MAX_FRAME_BYTES = 1024`(protocol.ts:17)를 넘지 않게 UTF-16 상한을 잡는다(100자 가족 이모지 대비는 프레임 한도 확인 필요).

### `shared/protocol.ts` (model)

**Analog:** 자기 자신의 `world` 프레임 추가 방식(6페이즈). `ServerMessage`(319-325)에 `{t:"typing"}`, `{t:"chatLog"}`, `{t:"chatReject"}` 를 더하고 `ChatEvent` 를 `{ t:"chat", ch, seat, seq, text, at }` 로 바꾼다. `PhaseId` 에서 `"claim"` 제거(25-28), `ClientMessage` 의 229-231 세 줄 제거, `RoomView.me` 에 `chat`. 프레임 키 이름은 `ch, seat, seq, text, at, on, why` 만 쓴다(`FORBIDDEN_KEYS` 의 `id`, `role`, `playerId` 충돌 방지 — leak.test.ts:45).

### `worker/room.ts` — `handleChat` / `handleTyping` (service, event-driven)

**Analog:** `handleSay`/`applySay` (370-394).

**진입 패턴** (370-380 — 신원은 소켓 첨부뿐):
```typescript
const att = this.attachmentOf(ws);
if (!att || !this.room) {
  this.sendTo(ws, { t: "error", code: "BAD_MESSAGE" });
  return;
}
```
**저장 후 전송 패턴** (383-393): `this.room` 갱신 → `await this.ctx.storage.put(...)` → 이벤트 전송. 이 단계의 `broadcastEvent`/`broadcastEventTo` 분기(391-392)는 `deliver(ids, msg)` 한 줄로 바뀐다.

**디스패치 패턴** (202-260 `switch (msg.t)`): `case "chat": await this.handleChat(ws, msg); return;` / `case "typing": this.handleTyping(ws, msg); return;` 를 더하고 `claim`/`say`/`emoji` 케이스(218-226)를 지운다. `default` 의 `const unhandled: never = msg` (254-258)가 누락을 컴파일 오류로 잡는다. `advance(Date.now())`(200)가 항상 먼저 돈다.

**거절 패턴**: `chatReject` 는 `sendTo(ws, {t:"chatReject", why})` 한 프레임. 단계 어긋남(`why:"phase"`)만 `sendRejection`(669-673)처럼 최신 `state` 를 그 소켓에 한 번 더 보낸다(RESEARCH Pattern 3 권고). `typing` 불일치는 조용히 버린다.

**await 앞 계산**: 채널·수신자 ids·마스크를 `await` 전에 지역 변수로 한 번 계산해 쓴다(알람이 사이에 끼어도 같은 집합으로 보냄).

### `worker/room.ts` — `deliver` / `emitWorld` (event-driven)

**Analog:** `emitWorld`(970-978)와 `sendTo`(980-987).

```typescript
private sendTo(ws: WebSocket, msg: ServerMessage): void {
  try { ws.send(JSON.stringify(msg)); } catch { /* 닫히는 중인 소켓 */ }
}
```
적용: `deliver(ids, msg)` 는 `for (const ws of this.ctx.getWebSockets())` + `ws.deserializeAttachment()` 로 `playerId` 가 ids 에 든 소켓에만 `sendTo`(846-854 `broadcastEvent` 의 루프 모양을 그대로 쓰되 필터를 ids 로). `emitWorld` 는 내부를 `deliver(audience(room,{k:"world"}), frame)` 로 교체(동작 동일, 로비일 때 전원). `broadcastEvent`/`broadcastEventTo` 는 삭제하고 정적 가드 테스트로 고정한다.

### `worker/room.ts` — 생성자 복원 / hello 복원 / 저장 키

**Analog:** 생성자 79-107, `handleHello` 788-793.

생성자: `ctx.storage.get(["room","world"])`(81) 옆에서 `ctx.storage.list({ prefix: "chat:" })` 를 읽어 메모리 사본과 채널별 다음 `seq` 를 복원한다(`blockConcurrencyWhile` 안, 79).

hello: state 다음 순서 규약(789-791 주석, epoch 규약 WR-03)을 지킨다.
```typescript
await this.persistAndBroadcast();
if (this.room.phase === "lobby") this.sendTo(ws, snapFrame(this.world, this.room.players, Date.now()));
```
적용: 이 뒤에 `chatLog` 프레임 하나(그 소켓의 좌석 비트가 켜진 줄만, 채널별 최근 30줄)를 `sendTo` 한다. 삭제 시 `deleteAll`(311, 688)이 `chat:` 도 지운다. `handleTestReset`(589)은 `chat:` 키를 직접 지운다. 줄 쓰기는 world 와 달리 디바운스 없이 즉시(`storage.put("chat:"+g6)`).

### `worker/room.ts` — `actAsBot` / `shared/game/bots.ts`

**Analog:** `actAsBot`(532-558)과 `discussionAct`(bots.ts:173-176).
`BotAct`(bots.ts:68-71)의 `claim`/`say`/`emoji` 를 빼고 `{ t:"chat"; text }` 를 더한다. `actAsBot` 의 `case "chat": await this.applyChat(step.botId, act.text)` — 사람과 같은 본체를 지난다(특권 없음, 결정 0024). `default: never` 가드(555-558)가 누락을 잡는다. 난수 호출 순서가 시드 테스트 계약이므로 `test/unit/bots.test.ts`, `test/worker/bots.test.ts` 기대값을 다시 고정한다.

### `shared/game/{phases,tick,view,room}.ts` — claim 제거

**Analog:** `shared/game/room.ts:313-335` `normalizeStoredRoom`/`LEGACY_PHASES`.
```typescript
const LEGACY_PHASES = { day: "day", claimReveal: "claimReveal" } as const;
// ...
const isLegacyReveal = phase === LEGACY_PHASES.claimReveal;
```
적용: `LEGACY_PHASES` 에 `claim: "claim"` 을 더해 저장된 `claim` 방을 `discussion` 으로 옮기고(`claimReveal` 처리와 같은 모양, 마감 `now + DISCUSSION_MS`), `claimOrder/claimIdx/claimStart/claimPick/claimLog/nextMessageSeq/nextNightSeq/Player.lastSendAt` 를 구조 분해로 제거한다. `phases.ts:58-59` `dayAnnounce.next` 를 `discussion` 으로, `tick.ts` 의 `ON_ENTER.claim`/`ON_DEADLINE.claim` 제거, `view.ts` `DAY_PHASES`/`buildDay` 에서 `claim`/`claimLog`/`turn` 제거, `buildView` 의 `me` 에 서버가 정한 `chat` 채널(`channelOf` 결과) 추가. 컴파일 오류가 곧 체크리스트다(`Record<PhaseId, …>` 사용처).

### `src/net/chatStore.ts` (store, pub-sub)

**Analog:** `src/world/store.ts` `WorldStore` (1-80) — React 밖 클래스, `subscribe`/`listeners`/`notify`, `epoch` 규칙, `reset()`.

적용: 같은 모양으로 `applyFrame(frame, epoch)` 대신 `apply(event, epoch)`. `chat` 는 `(ch, seq)` 중복 제거, `chatLog` 는 합집합 병합 후 `at`·`ch` 정렬, `typing` 은 좌석별 만료 시각(수신 + 4500ms) 맵, 단계 키/채널/epoch 변경 시 비움, 기록 최근 100줄 상한. 막힘 알림은 별도 필드(2.5초 만료).
**테스트 analog:** `test/unit/worldStore.test.ts`(1-40) — 프레임 헬퍼 함수(`snap`, `move`) 후 `describe` 로 epoch 시나리오 검증하는 형식.

### `src/screens/RoomScreen.tsx` / `src/net/useRoomConnection.ts` (연결 배선)

**Analog:** RoomScreen.tsx:126-136.
```typescript
const [store] = useState(() => new WorldStore());
const { onEvent } = connection;
useEffect(() => onEvent((e, meta) => { if (e.t === "world") store.applyFrame(e, meta.epoch); }), [onEvent, store]);
```
적용: 같은 곳에 `ChatStore` 를 하나 더 만들고 `chat/typing/chatLog/chatReject` 를 구독한다(로비 줄이 게임 시작 뒤에도 이어지도록 `Lobby`/`DayScene` 이 아니라 여기).

**필수 함정** (useRoomConnection.ts:13, 64, 204): 새 서버 `t` 는 세 곳에 모두 더해야 한다.
```typescript
export type RoomEvent = Extract<ServerMessage, { t: "emoji" | "error" | "chat" | "world" }>;   // 13
if (v && (v.t === "state" || ... || v.t === "chat" || v.t === "world")) return v as ServerMessage; // 64 화이트리스트
} else if (msg?.t === "emoji" || msg?.t === "chat" || msg?.t === "error" || msg?.t === "world") { // 204
```
`emoji` 는 `typing`/`chatLog`/`chatReject` 로 바꾸고 `world` 처럼 끝난 연결(`isTerminal`) 프레임을 버리는 줄(206)을 같이 적용한다. 6페이즈에서 같은 함정이 있었다.

### `src/net/useKeyboardLift.ts` (hook)

**Analog:** `src/components/Sheet.tsx:134-160`, 상수 19.
```typescript
const update = () => {
  const active = document.activeElement;
  const typing = active instanceof HTMLElement && dlg.contains(active) && isTextInput(active);
  const kb = typing ? Math.round(dlg.clientHeight - vv.height - vv.offsetTop) : 0;
  dlg.style.setProperty("--mf-kb", `${kb > KEYBOARD_MIN_PX ? kb : 0}px`);
};
vv.addEventListener("resize", update); vv.addEventListener("scroll", update);
dlg.addEventListener("focusin", update); dlg.addEventListener("focusout", update);
```
적용: 포커스 게이트 + 임계값(UI-SPEC 80) + `visualViewport` resize/scroll + focusin/focusout, 값은 React 상태가 아닌 CSS 변수(`--mf-kb-lift`, `--mf-vv-top`), `data-kb-open` 만 상태. rAF 합치기와 포커스 후 +100/+300/+1000ms 재읽기를 더한다. 프로토타입: `src/debug/chatMock.ts:230-243`. 로비 `stageInsets.bottom = 패널 높이 + lift`(`WorldStage.tsx:110-114`, `Lobby.tsx:146`), 캔버스 높이를 `100dvh` 에 묶지 않는다(`room.css:10` 주의).

### `src/components/v2/ChatPanel.tsx` (component)

**Analog:** `src/components/v2/HeadStack.tsx` — v2 부품 이식 규약(1-39).
`import "../../styles/v2.css";` 첫 줄, 머리 주석에 승인 출처(`design/v2.0/design-system/components/` 의 번들·`index.d.ts`)와 속성 범위를 적고, 같은 마크업·클래스 이름(`mv-*`)을 쓴다. 본문은 React 텍스트 노드로만 그린다(innerHTML 없음, T-06-26). 속성: `messages·value·onChange·onSend·placeholder·disabled·inputId` + `logHeight·compact·channel`. 제출은 `<form onSubmit>` 한 길(keydown Enter 금지), `onChange` 안에서 값을 가공하지 않는다(IME). 입력 `maxlength=100`, 글자 16px, 입력/보내기 48. 채널 필터 props 를 만들지 않는다. 단위 테스트는 `test/client/v2parts.test.tsx` 형식.

### `src/components/v2/HeadStack.tsx` / `V2Icon.tsx` (수정)

HeadStack: 위 칸 확장 주석(5행 "위 칸(입력 중…)은 7·8페이즈")을 이행 — `typing?: boolean` 속성을 `NameTagProps` 확장 대신 `HeadStackProps` 에 더하고 `mv-head` 안 `NameTag` 위에 알약 렌더. V2Icon: `V2IconName` 유니온(9행)과 `ICONS` 표(13행 이하)에 `send`·`ghost`·`roleMafia` 경로를 같은 `["p", d]` 형식으로 더한다(경로는 `design/v2.0/design-system/components/bundle.js` 의 ICONS 에서 그대로).

### `test/worker/chat.test.ts` (test, event-driven)

**Analog:** `test/worker/world.test.ts` — `cloudflare:workers`/`cloudflare:test` 사용, `helpers` 의 `connect/createRoom/hello/joinOk/send/nextFrame/settle/until`. 플러시 패턴은 leak.test.ts 의 `flush(sock)`(ping→pong 대기). 시나리오: 채널별 수신자 3종, 단계 키 불일치 폐기, 도배 거절 4종, hello 복원 30줄, 채널별 연번 틈 없음.

### `test/worker/leak.test.ts` (수정)

**Analog:** 자기 자신. `FORBIDDEN_KEYS`(45), `ROLE_WORDS`(77), `ROLE_PATHS_ALIVE`(79), `world` 프레임 허용 목록 방식(`WORLD_KEY_PATHS`/`WORLD_STRING_VALUES`, 90행 이하 `assertWorldFrames`). 적용: `claimLog` 경로(79)·`SERVER_ONLY_KEYS` 의 claim 계열 제거, chat/typing/chatLog 프레임용 키·문자열 허용 목록을 같은 방식으로 추가하되 `ch:"mafia"`/`me.chat` 는 "받을 권리가 있는 소켓에서만" 조건을 붙이고 시민 편 소켓에서는 0건을 단언한다.

### 정적 가드 테스트

**Analog:** `scripts/deploy-target.test.mjs:7-18` — `readFileSync(`${ROOT}${rel}`, "utf8")` 로 소스 문자열을 읽어 단언. 적용: `worker/room.ts` 에 `broadcastEvent` 문자열 없음, `ws.send(` 는 `sendTo` 안에만, `t: "chat"|"typing"` 은 `deliver`/복원 조립부에서만. 위치는 `test/unit/` 에 vitest 로(스크립트 `node --test` 가 아님).

### `scripts/e2e/*` (E2E)

**Analog:** `scripts/e2e/flows.mjs`(머리말 1-2: 흐름마다 새 테스트 방, `{scenario,size,id,label,ok,detail}` 결과 규약), `scripts/e2e/lib.mjs`(`TAP_MIN=44`, `PANEL_H=157` 은 claim 패널 기준이라 재정의 필요), `openChatHistory` 는 삭제. 한글 조합 시나리오는 CDP `Input.imeSetComposition`(RESEARCH 실측). `smoke.mjs` 는 85곳 영향이라 별도 묶음.

## Shared Patterns

### 서버 권위 신원
**Source:** `worker/room.ts` `attachmentOf`(280) + `handleSay` 진입부(371-375). **Apply to:** `handleChat`, `handleTyping`. 행위자는 소켓 첨부 `playerId` 뿐, 메시지의 seat/채널을 읽지 않는다.

### 수신자 한 길
**Source:** `worker/room.ts` `sendTo`(980) 가 유일한 `ws.send`. **Apply to:** `deliver`, `emitWorld`, 복원 프레임. 화면에서 거르지 않는다(결정 0002·0021).

### 컴파일이 잡는 누락
**Source:** `webSocketMessage` `default: never`(254-258), `actAsBot` `default: never`(555-558), `satisfies z.ZodType<ClientMessage>`(schemas.ts:56). **Apply to:** 새 메시지/봇 행동 추가·`PhaseId` 에서 `claim` 제거 전부.

### 순수 모듈 규약
**Source:** `shared/game/world.ts` 머리말(시각·난수를 스스로 읽지 않음, 입력 불변) · `chat.ts` 머리말. **Apply to:** `audience`, `chatRules`, `chatLog`.

### 저장 모양 이전
**Source:** `normalizeStoredRoom`(`shared/game/room.ts:332`). **Apply to:** `claim` 단계 방 이전 + 제거된 필드 탈락.

### 한국어 주석 + 결정 번호 인용
저장소 전체 관례: 주석은 한국어, 결정/위협 번호(`결정 0021`, `T-06-26`)를 근거로 단다. 새 결정 `docs/decisions/0058-*.md`(0017-7 "저장하지 않는다" 수정)를 Wave 1 첫 작업으로 쓴다.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| IME 한글 조합 E2E(CDP `Input.imeSetComposition`) | test | event-driven | 기존 E2E 에 IME 재현이 없음 — RESEARCH 실측 사용 |
| `chat:` 접두어 줄 단위 저장·`list({prefix})` 복원 | storage | CRUD | 기존은 `room`/`world` 고정 키뿐 — RESEARCH Pattern 2 사용 |
| 입력 중 사람별 간격 제한 메모리 Map | service | event-driven | 가장 가까운 것은 소켓 단위 `rates` WeakMap(74, 264-278)이라 모양만 참고 |

## 삭제 대상 (분석 생략, RESEARCH 「삭제 대상 전수」 표 따름)

`shared/game/{claim,chat}.ts`, `src/components/{ClaimPanel,TurnPanel,QuickMessageSheet,EmojiTraySheet,DefenseChips,DiscussionControls,MessageLog,ChatHistorySheet}.tsx`, `src/net/{claimLines,seatFloats,useSendLock}.ts`, `src/game/messageText.ts`, 대응 테스트 10개. 주의: `test/client/nightChat.test.tsx` 는 `DiscussionControls`/`MessageLog`/`messageText` 를 import 하므로 삭제가 아니라 `ChatPanel` 기반으로 교체해야 한다. `UserRecordSheet`/`recordRows` 는 `view.day.claimLog` 를 읽으므로 수정 항목으로 따로 챙긴다.

## Metadata

**Analog search scope:** `worker/`, `shared/`, `src/net`, `src/world`, `src/components`, `src/screens`, `test/{unit,worker,client}`, `scripts/`
**Files scanned:** 약 25(핵심 발췌 읽기), 추적 목록 전체 조회
**Pattern extraction date:** 2026-11-01

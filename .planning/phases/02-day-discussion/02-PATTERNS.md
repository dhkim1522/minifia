# Phase 2: 낮 토론 - Pattern Map

**Mapped:** 2026-10-24
**Files analyzed:** 36 (신규 21 · 수정 15)
**Analogs found:** 36 / 36 (신규 파일 중 이모티콘·말풍선 층만 부분 일치)

모든 analog 경로는 `git ls-files` 로 추적 확인한 저장소 소스다. 에뮬레이션 대상 미러 경로 없음.

## File Classification

| 신규/수정 파일 | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `shared/protocol.ts` (수정) | model(와이어 타입) | request-response | 자기 자신 (L15, L60-65, L81-102) | exact |
| `shared/schemas.ts` (수정) | validation | request-response | 자기 자신 (L10-16) | exact |
| `shared/game/phases.ts` (수정) | config(단계 표) | batch | 자기 자신 (L18-23) | exact |
| `shared/game/tick.ts` (수정, ON_ENTER 훅) | utility(순수) | transform | 자기 자신 (L12-24) | exact |
| `shared/game/claim.ts` (신규) | service(순수 규칙) | transform | `shared/game/room.ts` `kickPlayer`/`startGame` | role-match |
| `shared/game/chat.ts` (신규) | service(순수 규칙) | request-response | `shared/game/room.ts` `checkStart`/`kickPlayer` | role-match |
| `shared/game/discussion.ts` (신규) | service(순수 규칙) | request-response | `shared/game/room.ts` `kickPlayer` (NOT_HOST) | role-match |
| `shared/game/alive.ts` (신규) | utility | transform | `shared/game/room.ts` `connectedCount` (L169-170) | role-match |
| `shared/game/roles.ts` (수정, `rolesInPlay`) | utility | transform | 자기 자신 (L7, L11-21) | exact |
| `shared/game/room.ts` (수정, 필드 optional·`normalizeStoredRoom`) | model | CRUD | 자기 자신 (`everConnected?` L31-35) | exact |
| `shared/game/view.ts` (수정, `view.day?`) | service(뷰 생성) | request-response | 자기 자신 (L27-65) | exact |
| `worker/room.ts` (수정, 핸들러 5개·emoji 방송·정규화) | controller(DO) | event-driven | 자기 자신 (`handleKick` L237, `handleStart` L254, `advance` L274) | exact |
| `src/net/useRoomConnection.ts` (수정) | hook | event-driven | 자기 자신 (L52-62, L281-290) | exact |
| `src/net/seatFloats.ts` (신규) | hook | event-driven | `src/net/useSeatTransitions.ts` | role-match |
| `src/game/messageText.ts` (신규) | utility | transform | `src/game/roleText.ts` | role-match |
| `src/screens/DayScene.tsx` (신규) | component(screen) | request-response | `src/screens/RoleReveal.tsx` + `src/components/Table.tsx` | role-match |
| `src/screens/Day.tsx` (개정: 낮 시작 발표) | component(screen) | request-response | 자기 자신 | exact |
| `src/screens/RoomScreen.tsx` (수정) | component(screen shell) | request-response | 자기 자신 (L26-31, L123-152) | exact |
| `src/components/Table.tsx` (확장: 완료 알약·주장 알약·SeatFloat 슬롯) | component | request-response | 자기 자신 (tagLayers L103-117) | exact |
| `src/components/Icon.tsx` (확장: 이모티콘 8종) | component | transform | 자기 자신 | exact |
| `src/components/ClaimPanel.tsx`, `Chip.tsx` (신규) | component | request-response | `src/components/ConfirmSheet.tsx` (Button 사용) + `RoleReveal.tsx` | partial |
| `src/components/QuickMessageSheet.tsx`, `EmojiTraySheet.tsx` (신규) | component(sheet) | request-response | `src/components/ConfirmSheet.tsx` + `MyRoleSheet.tsx` | exact |
| `src/components/DiscussionControls.tsx`, `MessageLog.tsx`, `ClaimTag.tsx`, `SeatFloat.tsx` (신규) | component | request-response | `src/components/PhaseBar.tsx` / `Table.tsx` | partial |
| `src/styles/phase.css`, `room.css`, `tokens` (수정) | config(CSS) | — | 기존 `src/styles/phase.css` | exact |
| `test/unit/claim.test.ts`, `chat.test.ts`, `discussion.test.ts`, `alive.test.ts` (신규) | test | transform | `test/unit/tick.test.ts`, `test/unit/gameRoom.test.ts` | exact |
| `test/unit/tick.test.ts`, `view.test.ts` (수정) | test | transform | 자기 자신 | exact |
| `test/worker/day.test.ts` (신규) | test | event-driven | `test/worker/start.test.ts` + `helpers.ts` | exact |
| `test/worker/alarm.test.ts`, `leak.test.ts` (수정) | test | event-driven | 자기 자신 | exact |
| `test/client/*.test.tsx` (신규·수정) | test | request-response | `test/client/table.test.tsx`, `phaseScreens.test.tsx`, `useRoomConnection.test.tsx` | exact |
| `scripts/smoke.mjs` (수정) | test(배포 스모크) | request-response | 자기 자신 (`PHASE_ORDER`) | exact |

## Pattern Assignments

### `shared/game/phases.ts` (config, batch)

**Analog:** 자기 자신 `shared/game/phases.ts`

**표 모양 + 상수** (lines 15-23). `day` 행을 지우고 `dayAnnounce`(2s)·`claim`(15s)·`claimReveal`(2s)·`discussion`(90s) 행을 같은 `Object.freeze` 문법으로 더한다. `PhaseDef` 에 `onEnter` 함수를 넣지 않는다(RESEARCH Alternatives).
```typescript
export const ASSIGNING_MS = 3_000;
export const ROLE_REVEAL_MS = 15_000;

export const PHASE_DEFS: Readonly<Record<PhaseId, PhaseDef>> = Object.freeze({
  lobby: Object.freeze({ durationMs: null, next: null, revealsOwnRole: false }), // start 로만 나간다
  assigning: Object.freeze({ durationMs: ASSIGNING_MS, next: "roleReveal", revealsOwnRole: false }),
  roleReveal: Object.freeze({ durationMs: ROLE_REVEAL_MS, next: "day", revealsOwnRole: true }),
  day: Object.freeze({ durationMs: null, next: null, revealsOwnRole: true }), // 1페이즈의 끝
});
```
변경: `roleReveal.next` → `"dayAnnounce"`, `discussion.next` → `"dayAnnounce"`(임시 루프, D-19), 새 행도 `revealsOwnRole: true`. 시간 상수는 이 파일 한 곳에 둔다(Pitfall 10).

---

### `shared/game/tick.ts` (utility, transform)

**Analog:** 자기 자신 `shared/game/tick.ts`

**현재 루프** (lines 12-24). 훅은 루프 안에서 `phase = next` 직후 실행. 루프가 한 번도 안 돌면 입력 객체를 그대로 반환해야 한다(`worker/room.ts` L290 `if (next === room) return;`).
```typescript
export function tick(state: RoomState, now: number): RoomState {
  let phase = state.phase;
  let phaseEndsAt = state.phaseEndsAt;
  while (phaseEndsAt !== null && now >= phaseEndsAt) {
    const next = PHASE_DEFS[phase].next;
    if (next === null) break;
    const duration = PHASE_DEFS[next].durationMs;
    phase = next;
    phaseEndsAt = duration === null ? null : phaseEndsAt + duration;
  }
  if (phase === state.phase && phaseEndsAt === state.phaseEndsAt) return state;
  return { ...state, phase, phaseEndsAt };
}
```
RESEARCH Pattern 1 의 `ON_ENTER` 표 초안을 따라 루프 안에서 `cur = ON_ENTER[next]?.(cur) ?? cur` 를 적용하고, 루프가 안 돌았으면 `state` 를 그대로 반환한다. `nextWakeAt`(L27-29)은 건드리지 않는다.

---

### `shared/game/claim.ts`, `chat.ts`, `discussion.ts`, `alive.ts` (service, request-response/transform)

**Analog:** `shared/game/room.ts` 의 `kickPlayer`/`checkStart`

**규칙 함수 모양**: 입력은 서버 상태 + 요청자 id(+ now), 출력은 판별 유니온, 새 객체 반환·입력 불변, DOM/workerd API 금지(room.ts 머리 주석 L1-2).
```typescript
// room.ts:149-166
export type KickError = "NOT_HOST" | "CANNOT_KICK";
export function kickPlayer(state, actorId, targetSeat):
  { ok: true; state: RoomState; removedId: string } | { ok: false; error: KickError } {
  if (actorId !== state.hostId) return { ok: false, error: "NOT_HOST" };
  if (state.phase !== "lobby") return { ok: false, error: "CANNOT_KICK" };
  ...
}
```
```typescript
// room.ts:172-184 — 검사 순서가 계약. chat.ts 의 checkSay 도 RESEARCH Pattern 3 의 7단계 순서를 이렇게 쓴다.
export type StartError = "NOT_HOST" | "WRONG_PHASE" | "NOT_ENOUGH_PLAYERS";
export function checkStart(state: RoomState, actorId: string): StartError | null {
  if (actorId !== state.hostId) return "NOT_HOST";
  if (state.phase !== "lobby") return "WRONG_PHASE";
  ...
}
```
- `discussion.ts` 의 `extend`/`skip`: NOT_HOST → WRONG_PHASE → (extend 만) 이미 사용 순서. 방장 판정은 `state.hostId` 와 소켓 첨부 `playerId` 로만.
- `alive.ts` `isAlive`: 한 줄 공용 함수. 형식은 `connectedCount` (room.ts:168-170) 처럼 구조적 최소 입력 타입(`{ alive?: boolean }`)을 받는다. 이 페이즈는 항상 true.
- `claim.ts` `enterClaimReveal`: RESEARCH "Code Examples → 마감 확정" 초안을 그대로 쓰되 규칙표(Pattern 2)를 테스트로 1:1 고정.
- 난수·현재 시각은 읽지 않는다: `now` 는 인자(`startGame` L192-197 의 `now`/`randInt` 인자 규약).

---

### `shared/game/roles.ts` (utility, transform)

**Analog:** 자기 자신. 다음 줄들에서만 파생한다 (`rolesInPlay`, D-07: 목록은 이 구성표 한 곳에서).
```typescript
export const ROLE_IDS: readonly RoleId[] = ["mafia", "police", "doctor", "citizen"];  // L7
export const ROLE_TABLE = Object.freeze({ 4: Object.freeze({ mafia: 1, police: 1, doctor: 0, citizen: 2 }), ... }); // L11-17
function isSupportedCount(n: number): n is PlayerCount { ... } // L19-21
```
`rolesInPlay(n)`은 `ROLE_IDS.filter((r) => ROLE_TABLE[n][r] > 0)` (RESEARCH Code Examples).

---

### `shared/game/room.ts` (model, CRUD) 수정

**Analog:** 자기 자신 — optional 필드 + "읽는 쪽이 기본값" 선례 (lines 31-35).
```typescript
  /**
   * false 면 아직 아무도 접속한 적이 없다 — ...
   * 이 필드가 없는 옛 상태(이미 살아 있던 방)는 접속한 것으로 본다.
   */
  everConnected?: boolean;
```
- `Player` 에 `claimChoice?`, `claimShown?`, `claimLast?`, `claimChanged?`, `lastSendAt?` / `RoomState` 에 `day?`, `extendUsed?`, `messages?`, `nextMessageId?` 를 `role?: RoleId`(L24) 와 같은 방식(주석에 "뷰에는 …에서만 실린다")으로 더한다.
- `startGame`(L205-214)의 `phase: "assigning"` 반환 모양을 따라 초기값을 넣고, 전이는 불변 객체 스프레드.
- `normalizeStoredRoom(stored, now)` 는 같은 파일에 순수 함수로 두고 `test/unit/gameRoom.test.ts` 스타일로 테스트(RESEARCH Pattern 6): 저장된 `phase === "day"` 이면 `dayAnnounce`/`now+2000`/`day=1`. `worker/room.ts` 생성자(L62-76)의 `this.room = { ...stored, players: ... }` 에서 호출.

---

### `shared/game/view.ts` (service, request-response) 수정

**Analog:** 자기 자신. 허용 목록 리터럴 + "조건을 채울 때만 키를 만든다" 패턴.

**핵심 패턴** (lines 40-52):
```typescript
const myInfo: MyInfo = { seat: me.seat, isHost: me.id === state.hostId };
const def = PHASE_DEFS[state.phase];
if (def.revealsOwnRole && me.role !== undefined) {
  myInfo.role = me.role;
  ...
}
```
**바꿀 줄** (line 58): `phaseDurationMs: def.durationMs,` → `def.durationMs + (phase === "discussion" && extendUsed ? 30_000 : 0)` 파생(Pitfall 3, `null` 처리 유의).

신규 `view.day?` 는 이 방식으로 단계 조건부 객체 리터럴: `claim` 단계 → `{ roles, claimDone }` 만 + 본인 `me.claim`, `claimReveal`/`discussion` → `claims`·`messages`·`extendUsed` 추가. 키 이름은 `role` 이 아닌 `claim`/`claimedRole`/`roles`(Pitfall 2, `role` 키는 `me` 아래에만 불변식 유지). `claimLast` 는 어느 뷰에도 싣지 않는다.

---

### `shared/protocol.ts`, `shared/schemas.ts` (model/validation)

**Analog:** 자기 자신.

`protocol.ts` L15 `PhaseId` 유니온 교체, L60-65 `ClientMessage` 에 `claim/say/emoji/extend/skip`(RESEARCH Pattern 3 와이어 모양), L92-98 `WsErrorCode` 에 `ALREADY_EXTENDED`, L99-102 `ServerMessage` 에 `{ t: "emoji"; seat; icon; at }`. 파일 규약: 상수·타입만, zod 금지(L1-3). `RoomView` 에는 `day?` 를 optional 로만 더해 기존 픽스처를 깨지 않는다(Pitfall 8).

`schemas.ts` 현재 (lines 10-16):
```typescript
export const ClientMessageSchema = z.discriminatedUnion("t", [
  z.object({ t: z.literal("hello"), token: z.string().min(16).max(128) }),
  z.object({ t: z.literal("kick"), seat: z.number().int().min(0).max(7) }),
]) satisfies z.ZodType<ClientMessage>;
```
새 변형은 `z.strictObject` 로 추가(COMM-04 자유 텍스트 키 거부, RESEARCH Pattern 3). `seat` 범위 문법은 `kick` 행을 복사. `satisfies z.ZodType<ClientMessage>` 로 와이어 타입과 묶이는 구조 유지. 조합 검증(템플릿별 필수 칸)은 스키마가 아니라 `chat.ts` 가 맡는다.

---

### `worker/room.ts` (controller/DO, event-driven) 수정

**Analog:** 자기 자신. 핸들러 5개(`claim/say/emoji/extend/skip`)는 `handleKick`/`handleStart` 모양을 복사한다.

**디스패치** (lines 156-176): `advance(Date.now())` 뒤 `switch (msg.t)` 에 case 추가.

**핸들러 템플릿** (lines 237-252 `handleKick`, 254-272 `handleStart`):
```typescript
private async handleStart(ws: WebSocket): Promise<void> {
  const att = this.attachmentOf(ws);              // 신원은 소켓 첨부 playerId 에서만
  if (!att || !this.room) {
    this.sendTo(ws, { t: "error", code: "BAD_MESSAGE" });
    return;
  }
  const now = Date.now();
  const result = startGame(this.room, att.playerId, now, cryptoRandInt);
  if (!result.ok) {
    this.sendTo(ws, { t: "error", code: result.error });
    this.sendTo(ws, { t: "state", view: buildView(this.room, att.playerId, now) }); // 거절 시 최신 state 재전송
    return;
  }
  this.room = result.state;
  await this.persistAndBroadcast();
  await this.reschedule();                         // 마감이 바뀌는 핸들러(extend/skip)는 반드시 호출(Pitfall 4)
}
```
- `skip`: `{...room, phaseEndsAt: now}` 로 놓고 `tick(…, now)` 를 호출해 훅을 거친 일반 전이 경로를 쓴다.
- `emoji`: 저장 없이 `lastSendAt` 만 갱신한 뒤 `this.ctx.getWebSockets()` 에 `sendTo` 로 `{t:"emoji",...}` 방송(`broadcast` L377-386 의 소켓 순회 구조 복사).
- 2초 쿨다운은 소켓 `rates` WeakMap(L43-57, L181-195)을 쓰지 않는다. 그것은 20개/초 도배 방어용이고 소켓 단위다. 쿨다운은 `Player.lastSendAt` (Anti-Pattern).

---

### `src/net/useRoomConnection.ts` (hook, event-driven) 수정

**Analog:** 자기 자신.

**꼭 고칠 허용 목록** (line 57):
```typescript
if (v && (v.t === "state" || v.t === "pong" || v.t === "error")) return v as ServerMessage;
```
`"emoji"` 추가(Pitfall 6, 안 하면 조용히 버려진다). 이벤트는 상태로 쌓지 않고 ref 기반 `onEvent(listener) → unsubscribe` 를 노출(Pattern 7). 발송은 기존 `send`(L285-289, `canSendRef`·`OPEN` 확인) 그대로.

---

### `src/net/seatFloats.ts` (hook, event-driven)

**Analog:** `src/net/useSeatTransitions.ts` (`SEAT_ENTER_MS = 420` 상수 + 훅 + 타이머 정리 구조, L6-9, L57).
같은 형태로 `BUBBLE_MS = 3000`, `EMOJI_MS = 2000` 상수를 파일 머리에 두고 `useSeatFloats(view, onEvent)` 가 `{[seat]: {kind, content, key, expiresAt}}` 를 쥔다. 말풍선 남은 시간은 `view.serverNow - at`(서버 시각끼리, 오프셋 불필요, RESEARCH 말풍선 절).

---

### `src/game/messageText.ts` (utility, transform)

**Analog:** `src/game/roleText.ts` — 화면 문구의 단일 출처 파일, `ROLE_TEXT` 를 import 해서 쓴다.
```typescript
export const ROLE_TEXT: Readonly<Record<RoleId, { name: string; desc: string }>> = {
  mafia: { name: "마피아", ... }, police: { name: "경찰", ... }, doctor: {...}, citizen: {...},
};
```
`hasBatchim`/`eunNeun`/`iEoss` 초안은 RESEARCH "클라이언트 문장 만들기" 에 있다. 서버는 문장을 보내지 않는다.

---

### `src/screens/DayScene.tsx` (신규), `RoomScreen.tsx` (수정)

**Analog:** `src/screens/RoleReveal.tsx` (props 모양, `Backdrop`+`PhaseBar`+`Timer`) + `src/components/Table.tsx`.

**화면 뼈대** (RoleReveal.tsx L65-80):
```tsx
<Backdrop layout="game" variant="lobby" className="mf-reveal__backdrop">
  <main className="mf-root mf-reveal">
    <PhaseBar
      title="역할 확인"
      instruction={...}
      extra={myRoleButton}
      timer={endsAt !== null && durationMs !== null ? <Timer endsAt={endsAt} durationMs={durationMs} offset={offset} /> : null}
    />
```
`props = { view: RoomView; offset: number; myRoleButton: ReactNode; send }`. 마감이 지나도 화면이 스스로 단계를 넘기지 않는다(주석 L24-25).
공개 연출 중 타이머는 `Timer endsAt={0}` 으로 0:00 고정(RESEARCH Pattern 7, `src/net/clock.ts`).

**RoomScreen 수정 지점:**
- L26-31 `PHASE_ANNOUNCE` `as const` 객체 → `(view) => string` 함수(`{N}일차` 필요, Pitfall 7).
- L123-128 `<div key={view.phase} className="mf-phase-enter">` → `sceneKey = phase ∈ {claim, claimReveal, discussion} ? "dayScene" : phase`, dayScene 일 때 바깥 phase-enter 래퍼 제외(Pattern 7).
- L131-151 `renderPhase` switch: `day` case 제거, 새 4 case(`dayAnnounce` → `Day`, 나머지 → `DayScene`).
- `[내 역할]` 시트 상태는 위쪽에 유지(L45-56), 새 두 시트(빠른 메시지·이모티콘)는 반대로 `discussion` 패널 안에 둔다(Pitfall 11).

---

### `src/screens/Day.tsx` (낮 시작 발표)

**Analog:** 자기 자신 (20줄). `1일차` 고정 문구 (L14) 를 `view.day?.n` 기반으로 교체하고 `view` prop 을 받는다. 구조(`Backdrop`/`mf-day__*`)는 그대로.

---

### `src/components/Table.tsx` (확장)

**Analog:** 자기 자신. 입력에 역할 필드가 없다는 규칙(머리 주석 L5, Pitfall 12) 유지: `TableSeat` (L8-18) 에 `done?: boolean`, `claim?: { job: Claim; changed: boolean }`, `float?: ...` 를 더한다.
- 이름표 층 (L103-117) 이 완료 알약·주장 알약·"말 바꿈"이 얹힐 자리: `<span className="mf-badge">방장</span>` 형제로 추가.
- 말풍선·이모티콘은 이름표처럼 크기 변환 바깥 층에 `tagLayers` 와 같은 좌표(`left: pct(L.x)`, `top: pct(...)`)로 그린다.
- 접근성: `seatLabel`(L36-38)에 완료·주장 상태를 반영.

---

### `src/components/QuickMessageSheet.tsx`, `EmojiTraySheet.tsx` (component, request-response)

**Analog:** `src/components/ConfirmSheet.tsx` (렌더 프롭 `(requestClose, closing)` 으로 닫히는 중 버튼 끄기, L18-30) + `MyRoleSheet.tsx` (`<Sheet label onClose showClose>` + `<h2 className="mf-t-heading mf-sheet__title">`).
```tsx
<Sheet label={title} onClose={onClose} initialFocusRef={cancelRef}>
  {(requestClose, closing) => (<>
    <h2 className="mf-t-heading mf-sheet__title">{title}</h2>
    <div className="mf-sheet__actions"> <Button ... disabled={closing} onClick={requestClose}> ...
```
열림 상태는 부모(`DiscussionControls`)가 쥐어 단계가 바뀌면 언마운트와 함께 닫힌다(`Sheet` 정리 함수 `dlg.close()`, Pitfall 11). 새 모달을 만들지 않는다(Don't Hand-Roll).

---

### `src/components/ClaimPanel.tsx`, `Chip.tsx`, `DiscussionControls.tsx`, `MessageLog.tsx`

**Analog:** 부분 일치. `Button` (variant/compact/icon/block props, `RoleReveal`·`ConfirmSheet`에서 사용)로 칩·버튼 조립, `PhaseBar` (`src/components/PhaseBar.tsx` L5-17) 의 `extra`/`timer` 슬롯 규약. 토스트는 `useToast` (`src/components/Toast.tsx`, `placement="top"`) 재사용. 구체 규격은 `02-UI-SPEC.md` 를 따른다.

---

### Tests

- **순수 규칙 (unit):** `test/unit/tick.test.ts` L1-40 의 `player(i, connected)`/`stateIn(phase, phaseEndsAt, opts)` 픽스처 헬퍼 모양을 복사해 `claim/chat/discussion/alive` 테스트를 쓴다. 규칙표(Pattern 2)를 행마다 케이스로.
- **워커 통합:** `test/worker/start.test.ts` 와 `helpers.ts` (`seat`, `send`, `nextFrame`, `nextState`, `alarmOf`, `storedRoom`, `flat`) 를 그대로 쓴다.
```typescript
const r = await seat(3, 0);
send(r.host, { t: "start" });
const m = await nextFrame(s, assigning /* (m) => m.t === "state" && m.view.phase === ... */);
expect(flat(err)).toBe(JSON.stringify({ t: "error", code: "NOT_ENOUGH_PLAYERS" }));
```
  Pitfall 1 검증: 서로 다른 선택을 한 두 소켓의 `claim` 단계 프레임 전체 문자열에서 상대 선택 값 부재 확인.
- **기존 테스트 수정 (Wave 0):** `tick.test.ts`(단계 4개 단언·행 문자열), `view.test.ts`(`PHASES`, 누출 정규식 허용 경로, Pitfall 2), `alarm.test.ts`·`leak.test.ts`(`day` → `dayAnnounce`), `scripts/smoke.mjs`(`PHASE_ORDER`, 종착 `discussion`, Pitfall 9).
- **클라이언트:** `test/client/table.test.tsx`, `phaseScreens.test.tsx`, `useRoomConnection.test.tsx` 의 패턴으로 확장. `RoomView` 픽스처 3곳은 `day?` optional 이라 변경 불필요.

## Shared Patterns

### 서버 권위·신원
**Source:** `worker/room.ts` `attachmentOf` + `handleStart` (L254-272)
**Apply to:** 모든 신규 핸들러. 신원은 소켓 첨부 `att.playerId` 에서만, 메시지에 seat/보낸 사람 키 금지. 거절 시 `error` 뒤 최신 `state` 재전송.

### 불변·순수 전이 + 시각 주입
**Source:** `shared/game/room.ts` (머리 주석 L1-2, `startGame` L192-214), `shared/game/tick.ts`
**Apply to:** `claim.ts`, `chat.ts`, `discussion.ts`, ON_ENTER 훅. 새 객체 반환, `now` 인자, 전역 시각·난수 금지.

### 뷰 허용 목록 (누출 방지)
**Source:** `shared/game/view.ts` L31-38, L40-52
**Apply to:** `view.day?` 전체. 객체 리터럴로 필드를 하나씩 쓰고 조건 밖에서는 키 자체를 만들지 않는다. `Player` 를 펼쳐 복사하지 않는다.

### 옛 방 호환
**Source:** `shared/game/room.ts` L31-35 (`everConnected?`)
**Apply to:** 모든 신규 영속 필드 optional, 읽는 쪽에서 기본값(`state.messages ?? []`). 생성자 복구 지점에서 `normalizeStoredRoom`.

### 에러 코드·알람 재설정
**Source:** `shared/protocol.ts` L92-98 `WsErrorCode`; `worker/room.ts` L267-270 (`persistAndBroadcast` → `reschedule`)
**Apply to:** `extend`/`skip`(마감 변경 시 `reschedule()` 필수).

### 클라이언트 서버 시계 의존
**Source:** `src/components/Timer.tsx` (`endsAt`/`durationMs`/`offset` props), `RoleReveal.tsx` L25-28
**Apply to:** 모든 단계 패널. 화면이 스스로 단계를 넘기지 않고 서버 `view` 만 따른다.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| 이모티콘 8종 그림, 말풍선·이모티콘 층 CSS 애니메이션(팝·흔들림) | component/asset | event-driven | 1페이즈에 인물 위 임시 표시 층이 없다. `useSeatTransitions` 의 enter/leave 클래스와 `src/styles/phase.css` 의 phase-enter 만 참고. 규격은 `02-UI-SPEC.md` |
| `ON_ENTER` 진입 훅 표 | utility | transform | 선례 없는 새 구조. RESEARCH Pattern 1 의 초안 사용 |
| 한국어 조사 처리 | utility | transform | RESEARCH Code Examples 의 12줄 함수 사용 |

## Metadata

**Analog search scope:** `shared/`, `worker/`, `src/`, `test/`, `scripts/` (git ls-files 기준)
**Files scanned/read:** 약 20개 (핵심 analog 전문 또는 구간 읽기)
**Pattern extraction date:** 2026-10-24

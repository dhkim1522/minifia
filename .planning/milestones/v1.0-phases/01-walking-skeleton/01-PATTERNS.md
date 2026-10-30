# Phase 1: 걷는 뼈대 - Pattern Map (재계획 01-04 ~ 01-14)

> 번호 안내(2026-10-23 계획 개정): 이 지도는 리서치 제안 번호(04~10)로 처음 만들었다. 아래 절 제목과 본문의 계획 번호는 실제 계획 01-04~01-14 기준으로 고쳤다. 코드 주석을 그대로 인용한 곳(예: "01-08 이 붙인다")은 01-02 때 쓴 옛 번호라 인용은 두고 옆에 지금 번호를 적었다.

**Mapped:** 2026-10-23
**Files analyzed:** 52 (신규 약 40 + 수정 12)
**Analogs found:** 50 / 52 (테이블 장면 레이아웃 보정, 시트 끌기 제스처는 부분 일치)

> 모든 analog 경로는 `git ls-files` 로 추적 중임을 확인했다 (`shared/`, `worker/`, `src/`, `test/`, `scripts/`, `design/design-system/components/`, `public/`). 미러·설치 사본 경로는 없다.
> 약칭: **DS** = `design/design-system/components/bundle.js` / `bundle.css` (React.createElement IIFE, 참고 구현). **UI** = `01-UI-SPEC.md` 개정 2. **RS** = `01-RESEARCH.md`.
> 이식 규칙(RS Pattern 14): `bundle.css` 를 `src/styles/ds.css` 로 복사해 `mf-*` 클래스 이름을 유지하고, `bundle.js` 는 TSX 로 옮긴다. `window.React`, `asset()`, `ASSET_BLOBS`(`/_blob/…`) 는 쓰지 않는다. 아래 "델타" 표시는 UI-SPEC 때문에 참고 구현과 다르게 만들 곳이다.

## File Classification

### A. 서버·공유 규칙 (01-04, 01-07, 01-09)

| 신규/수정 파일 | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `shared/game/room.ts` (수정: join/leave/kick/canStart/startGame/connectedCount) | model(순수 코어) | CRUD | 같은 파일 `attachConnection`/`detachConnection` (82-97) | exact |
| `shared/game/phases.ts` (신규) | config | transform | `shared/game/roles.ts` `ROLE_TABLE` (11-17, 상수 표 한 곳) | role-match |
| `shared/game/tick.ts` (신규) | utility(순수) | event-driven | `shared/game/room.ts` 순수 전이 (새 객체 반환) | role-match |
| `shared/game/view.ts` (수정: `phaseDurationMs`, `me.role/allies`, `buildPreview`) | model(허용 목록 빌더) | request-response | 같은 파일 `buildView` (7-33) | exact |
| `shared/protocol.ts` (수정: `RoomPreview.players`, `MyInfo.role/allies`) | model(타입) | request-response | 같은 파일 (28-35, 60-64) | exact |
| `shared/schemas.ts` (수정: 필요 시) | config | request-response | 같은 파일 (10-16) | exact |
| `worker/room.ts` (수정: start/leave/kick/preview/join RPC, 알람 다중화) | service(DO) | event-driven + CRUD | 같은 파일 (`createRoom` 58-76, `webSocketMessage` 90-121, `alarm` 131-147, `persistAndBroadcast` 194-198) | exact |
| `worker/index.ts` (수정: `GET /api/rooms/:code`, `POST .../join`) | route | request-response | 같은 파일 `handleCreateRoom` (27-59), WS 라우트 (71-76) | exact |
| `test/unit/gameRoom.test.ts` 확장 / `test/unit/phases.test.ts`, `tick.test.ts`, `startCondition.test.ts`, `preview.test.ts` (신규) | test | transform | `test/unit/gameRoom.test.ts`, `test/unit/roles.test.ts` | exact |
| `test/worker/http.test.ts` 확장 / `test/worker/start.test.ts`, `preview.test.ts` (신규) | test | request-response + event-driven | `test/worker/http.test.ts` (`openSocket` 헬퍼 24-50) | exact |

### B. 클라이언트 순수 로직·네트워크 (01-05, 01-06, 01-08, 01-10, 01-11, 01-12)

| 신규/수정 파일 | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `src/net/api.ts` (수정: `getPreview`, `joinRoom`) | service | request-response | 같은 파일 `postJson`/`createRoom` (28-50) | exact |
| `src/net/session.ts` (신규: 토큰 단일 슬롯) | utility | CRUD(localStorage) | 없음 → RS Pattern 12 / Pitfall 22, 형태는 `api.ts` 의 `ApiResult` 스타일 | no analog |
| `src/net/useRoomConnection.ts` (수정: 상태기계·표본 오프셋·epoch) | hook | streaming(WebSocket) | 같은 파일 (41-114) | exact |
| `src/net/linkReducer.ts` (신규: 순수 리듀서) | utility(순수) | event-driven | `src/net/clock.ts` (순수 함수, fake timer 없이 테스트) | role-match |
| `src/net/roomDiff.ts` (신규) | utility(순수) | transform | `src/net/clock.ts` + `shared/seatLayout.ts` | role-match |
| `src/net/cardFace.ts` (신규) | utility(순수) | transform | `src/net/clock.ts` | role-match |
| `src/net/assets.ts` (신규) | utility | transform | DS `FIGURE_IDS`/`asset()` (bundle.js 196-198, 38) | role-match |
| `src/net/copy.ts` (신규: `messageForApiError` 등) | utility | transform | `src/net/api.ts` `isApiError`/`API_ERROR_CODES` (5-26) | role-match |
| `src/net/share.ts` (수정: `copyLink`, `shareOnly` 추가) | utility | request-response | 같은 파일 `runShare` (30-58) | exact |
| `src/net/countdown.ts` + `useCountdown` (신규) | utility/hook | transform | `src/net/clock.ts` `remainingMs` (25-27) | exact |
| `test/unit/*.test.ts` (roomDiff, cardFace, linkReducer, copy, assets, countdown, share 확장) | test | transform | `test/unit/clock.test.ts`, `test/unit/share.test.ts`, `test/unit/seatLayout.test.ts` | exact |
| `test/client/useRoomConnection.test.tsx` (수정) | test | streaming | 같은 파일 `FakeSocket` (6-34), `setup()` (45-54) | exact |

### C. 디자인 시스템 부품 이식 (01-05, 01-06, 01-08, 01-10, 01-11, 01-12, 01-13)

| 신규 파일 (`src/components/`) | Role | Data Flow | Reference (DS) | 기존 앱 파일 | Match |
|---|---|---|---|---|---|
| `Icon.tsx` | component | render | DS `Icon`/`ICONS` (41-79) | — | exact |
| `Button.tsx` | component | render | DS `Button` (90-96) / `.mf-btn*` | `.btn`, `.btn-primary` in `screens.css` (54-79) 대체 | exact |
| `TextField.tsx` | component | render | DS `TextField` (107-118) | `.field*` in `screens.css` + `Home.tsx` input | exact (델타 있음) |
| `Timer.tsx` | component | render(시간 구동) | DS `Timer` (121-129) | — | exact (델타) |
| `PhaseBar.tsx` | component | render | DS `PhaseBar` (132-139) | — | role-match (재배치) |
| `ReconnectBanner.tsx` | component | render | DS `ReconnectBanner` (148-151) | `RoomScreen.tsx` "연결 중…" 임시 | exact (델타) |
| `Sheet.tsx` (신규 틀) | component | event-driven | DS `ConfirmSheet` 틀 (154-163) | — | partial (RS Pattern 9 `<dialog>`) |
| `ConfirmSheet.tsx` | component | event-driven | DS `ConfirmSheet` | — | exact (Sheet 위에 얹음) |
| `MyRoleSheet.tsx`, `ShareSheet.tsx` | component | event-driven | DS 에 없음 (R18) → `Sheet` + DS `RoleCard` 내용 | — | no direct |
| `Toast.tsx` | component | event-driven | DS `Notice` (142-145) 모양만 | — | partial |
| `Figure.tsx` | component | render | DS `Figure` (200-209) | — | exact (델타) |
| `Backdrop.tsx` | component | render | DS `Backdrop` (212-220) | — | exact (델타) |
| `Table.tsx` | component | render | DS `Table` + `seatLayout` (223-286) | `shared/seatLayout.ts` 를 import | exact (델타 큼) |
| `RoleCard.tsx` | component | render(상태 구동) | DS `RoleCard` (166-185) | — | exact (델타 큼) |
| `src/styles/ds.css` | config(스타일) | — | `design/design-system/components/bundle.css` | `screens.css` 일부 대체 | exact |
| `src/styles/screens.css` (다시 씀), `base.css` (`.app-version` 수정) | config(스타일) | — | 기존 두 파일 (진홍 버튼·12/13/15/17/40/56px 제거) | 같은 파일 | rewrite |
| `test/client/components.test.tsx` 등 | test | render | `test/client/screens.test.tsx` | — | exact |

### D. 화면 (01-05, 01-06, 01-10, 01-11, 01-12, 01-13, 01-14)

| 신규/수정 파일 | Role | Data Flow | Closest Analog (앱) | Reference (DS/UI) | Match |
|---|---|---|---|---|---|
| `src/App.tsx` (수정: `/`, `/r/:code` 라우팅, 세션 이어받기) | component(루트) | request-response | 같은 파일 (5-15) | — | exact |
| `src/screens/Home.tsx` (S-01 다시 씀) | component | request-response | 같은 파일 `handleCreate` (15-27) | UI S-01, DS `TextField`/`Button`/`Backdrop` | exact |
| `src/screens/JoinByLink.tsx` (S-02 신규) | component | request-response + 폴링 | `Home.tsx` (폼·`busy` 패턴) | UI S-02, DS `Figure`/`Backdrop` | role-match |
| `src/screens/ErrorScreen.tsx` (신규) | component | render | `RoomScreen.tsx` `notice` 분기 (23-35, 37-43) | UI "오류 화면" | role-match |
| `src/screens/RoomScreen.tsx` (수정: 단계 분기·띠·시트 상태 보유·알림 영역) | component | event-driven | 같은 파일 (14-54) | UI C-01~C-03 | exact |
| `src/screens/Lobby.tsx` (S-03 교체) | component | event-driven | 같은 파일 (props 시그니처 `{view, send}`) | DS `Table`, UI S-03 | role-match |
| `src/screens/Assigning.tsx` (S-04) | component | render | `RoomScreen.tsx` `notice` 분기 (정중앙 문구) | UI S-04, DS `Table dimmed` | partial |
| `src/screens/RoleReveal.tsx` (S-05) | component | event-driven | — | DS `RoleCard`+`PhaseBar`+`Timer`, RS Pattern 10 | partial |
| `src/screens/Day.tsx` (S-06) | component | render | — | DS `Backdrop variant=day`, `Announcement` 모양만 | partial |
| `src/main.tsx` (수정: `ds.css` import) | config | — | 같은 파일 (3-6) | — | exact |
| `index.html` (수정: OG/title) | config | — | 같은 파일 | UI E13 | exact |
| `public/_headers`, `public/og.png` (신규) | config | — | 없음 (RS Pitfall 15) | — | no analog |
| `package.json` / `.gitattributes` (수정: `tokens:check`) | config | — | `"tokens"` 스크립트, `scripts/gen-tokens.mjs` `--check` | RS Pitfall 23 | exact |
| `scripts/smoke.mjs` (수정: full 단계) | utility | request-response | 같은 파일 | — | exact |

---

## Pattern Assignments

### A. 서버·공유 규칙

#### `shared/game/room.ts` — join / leave / kick / canStart / startGame / connectedCount (model, CRUD)

**Analog:** 같은 파일의 `attachConnection`/`detachConnection` (82-97), `createRoomState` (44-76). 규칙은 "입력을 바꾸지 않고 새 객체를 돌려준다".

**불변 전이 + connId 보호 패턴** (room.ts:82-97):
```typescript
export function attachConnection(state: RoomState, playerId: string, connId: string): RoomState {
  return {
    ...state,
    players: state.players.map((p) => (p.id === playerId ? { ...p, connected: true, connId } : p)),
  };
}
export function detachConnection(state: RoomState, playerId: string, connId: string): RoomState {
  return {
    ...state,
    players: state.players.map((p) =>
      p.id === playerId && p.connId === connId ? { ...p, connected: false, connId: null } : p,
    ),
  };
}
```
**복사할 점:** `...state` 스프레드 + `players.map`; 변경이 없으면 같은 참조를 돌려줘 호출자가 `next === this.room` 으로 방송을 건너뛴다(worker/room.ts:188). `join`/`leave`/`kick` 도 "거절이면 `{ ok:false, error }`, 성공이면 `{ ok:true, state, ... }`" — `createRoomState` 의 결과 모양(29, 52, 63-75)을 따른다.

**주의 (현재 코드와 어긋나는 곳):**
- room.ts:36-42 의 `normalizeNickname` 은 임시 구현이고 주석(35)이 01-04 에서 `shared/nickname.ts` 로 교체하라고 한다. `shared/nickname.ts` 는 `validateNickname`, `nicknameKey`, `normalizeNickname`(23), `countGraphemes`(16, `Intl.Segmenter`) 를 export 한다. 교체 시 `createRoomState` 시그니처와 기존 `gameRoom.test.ts` 의 "9자 이상·줄바꿈 → NICKNAME_INVALID", "이모지 8개 통과" 케이스(코드 포인트가 아닌 grapheme 기준으로 바뀌므로 기대값 재확인)를 유지한다.
- `nicknameKey` 필드가 이미 `Player` 에 있다 → 중복 검사는 `players.some(p => p.nicknameKey === key)` 로 `NICKNAME_TAKEN`.
- `joinSeq`/`nextJoinSeq` 는 방장 승계("먼저 들어온 순서") 용으로 이미 있다 → `leave` 에서 방장이면 남은 사람 가운데 **연결된 사람의** `joinSeq` 최소가 새 방장, 연결된 사람이 없으면 전체 `joinSeq` 최소(01-04, D-17 구체화 — 시작할 수 있는 방장 우선).
- 자리(`seat`)는 나간 뒤에도 재사용(가장 작은 빈 번호). 정원 판정은 `players.length`(끊긴 사람 포함, RS Pattern 8), 시작 조건은 `connectedCount`.

**새로 더할 코드 (RS Code Examples, 설계안 그대로):**
```typescript
export const connectedCount = (players: readonly { connected: boolean }[]): number =>
  players.reduce((n, p) => n + (p.connected ? 1 : 0), 0);
export function checkStart(state: RoomState, actorId: string): StartError | null {
  if (state.hostId !== actorId) return "NOT_HOST";
  if (state.phase !== "lobby") return "WRONG_PHASE";
  if (connectedCount(state.players) < MIN_PLAYERS) return "NOT_ENOUGH_PLAYERS";
  return null;
}
```
`startGame` 은 `assignRoles(state.players.map(p => p.id), randInt)`(roles.ts:27) 를 끊긴 사람 포함 전원에게 호출. `RoomState` 에 역할 저장 필드(`role: RoleId | null` on `Player`)를 더하되 `buildView` 의 허용 목록 밖에 둔다.

**테스트 analog:** `test/unit/gameRoom.test.ts` — `newRoom()` 헬퍼(10-14)와 "새 객체를 돌려주고 입력을 바꾸지 않는다" 단언 패턴(`expect(a).not.toBe(s)` + 원본 불변). RS Pattern 8 의 ①~⑧ 경계 케이스를 같은 스타일로. 난수는 `test/helpers/seededRandom.ts` 의 `seededRandInt`(roles.test.ts 가 사용).

---

#### `shared/game/phases.ts`, `shared/game/tick.ts` (config / utility, event-driven)

**Analog:** `shared/game/roles.ts` 의 `ROLE_TABLE` (11-17) — "구성표는 한 파일 한 곳, `Object.freeze`, 화면 문구는 두지 않는다" (roles.ts 주석 1-4). 

**복사할 모양:** `PHASE_DEFS` 를 `as const` 객체 하나로 (RS Pattern 1). `PhaseId` 는 `shared/protocol.ts:11` 의 `"lobby" | "assigning" | "roleReveal" | "day"` 와 동일해야 하고 D-02/D-03 에 따라 직업 공개 단계를 **미리 넣지 않는다**.
```typescript
export const PHASE_DEFS = {
  lobby:      { durationMs: null,   next: null },
  assigning:  { durationMs: 3_000,  next: "roleReveal" },
  roleReveal: { durationMs: 15_000, next: "day" },
  day:        { durationMs: null,   next: null },
} as const;
```
`tick(state, now)` 은 순수. 마감 = "이전 마감 + 길이" 연쇄(알람 지연 누적 방지). `worker/room.ts` 의 모든 진입(`webSocketMessage`, `alarm`)에서 먼저 `tick` 을 돈다.

---

#### `shared/game/view.ts` — `buildView` 확장, `buildPreview` 신규 (model, request-response)

**Analog:** 같은 파일 `buildView` (view.ts:7-33). **허용 목록 객체 리터럴**이 불변식이다.

**핵심 패턴** (view.ts:13-20):
```typescript
const players: PublicPlayer[] = [...state.players]
  .sort((a, b) => a.seat - b.seat)
  .map((p) => ({
    seat: p.seat,
    nickname: p.nickname,
    connected: p.connected,
    isHost: p.id === state.hostId,
  }));
```
**01-07 이 바꿀 곳:** (a) view.ts:27 `phaseDurationMs: null, // 01-07 이 단계 표로 채운다` → `PHASE_DEFS[state.phase].durationMs`; (b) view.ts:31 `me: { seat, isHost }` → `phase` 가 `roleReveal`·`day` 일 때만 `role`, 마피아에게만 `allies`(**seat 번호 배열**); `Player` 를 펼쳐 복사하지 않는다. `PublicPlayer` 에는 `role` 키가 타입에도 없다 — 유지.

**`buildPreview`:** RS Code Examples 의 "미리보기 빌더" 그대로. `players` 는 lobby 에서만 `{seat, nickname}` 두 키 객체 리터럴, 그 밖엔 `[]`.

**테스트:** 누출 테스트 — 모든 단계에서 `JSON.stringify(buildView(...other players))` 에 타인 `role` 문자열·`token`·`id` 없음; `buildPreview` 의 `players[*]` 키 집합이 정확히 `["nickname","seat"]`. 기존 `gameRoom.test.ts` 하단 `buildView` 케이스(파일 후반)를 확장 모델로 삼는다.

---

#### `shared/protocol.ts` (model: 타입)

**Analog:** 같은 파일. 파일 상단 주석(1-3)대로 **상수와 타입만** — zod 등 값 import 금지(클라이언트 번들에 들어감).
```typescript
export interface RoomPreview {            // 28-35 현재
  code: string; hostNickname: string; playerCount: number; maxPlayers: number; phase: PhaseId;
}
export interface MyInfo { seat: number; isHost: boolean }   // 01-07 이 role?, allies? 를 더한다 (코드 주석의 옛 번호 — 지금은 타입 01-04, 값 01-07)
```
추가: `PreviewPlayer { seat; nickname }`, `RoomPreview.players: PreviewPlayer[]`, `MyInfo.role?: RoleId`, `MyInfo.allies?: number[]`. `RoleId` 타입은 `shared/game/roles.ts` 에서 `import type`.

---

#### `worker/room.ts` — start / leave / kick / preview / join RPC / 알람 다중화 (service, event-driven)

**Analog:** 같은 파일.

**RPC 패턴 — Worker 가 부르는 메서드** (worker/room.ts:57-76): 반환은 `{ ok:true,… } | { ok:false, error }` 판별 유니온, 상태 변경 후 `await this.ctx.storage.put("room", this.room)`.
```typescript
async createRoom(input: { code: string; nickname: string; now: number }): Promise<CreateRoomRpcResult> {
  if (this.room && input.now < this.room.expiresAt) return { ok: false, error: "CODE_TAKEN" };
  ...
  this.room = created.state;
  await this.ctx.storage.put("room", this.room);
  await this.ctx.storage.setAlarm(this.room.expiresAt);
  return { ok: true, token, seat: 0 };
}
```
`join`/`preview` RPC 도 같은 모양. `join` 성공 직후 `await this.persistAndBroadcast()` 로 기존 소켓들에 방송해야 다른 사람 화면에 자리가 나타난다 (RS Pattern 6 마지막 항목). HTTP join 직후 `connected=false` 는 정상(RS Pitfall 24).

**메시지 분기 확장 지점** (worker/room.ts:110-120): 현재 `default:` 가 `start`/`leave`/`kick` 을 `BAD_MESSAGE` 로 보낸다 — 주석("01-08 이 붙인다", 옛 번호 — 지금은 01-09)이 정확히 이 자리다. `case "start"`, `"leave"`, `"kick"` 을 추가하고 `hello` 가 아닌 메시지는 `ws.deserializeAttachment()` 로 `playerId` 를 얻은 뒤 `checkStart` 등 순수 코어를 호출.
```typescript
switch (msg.t) {
  case "hello": await this.handleHello(ws, msg.token); return;
  case "ping":  this.sendTo(ws, { t: "pong", c: msg.c, serverNow: Date.now() }); return;
  default: // 01-08 이 start·leave·kick 처리기를 붙인다  (옛 번호 — 지금은 01-09)
```
**start 거절 시:** `sendTo(ws, { t:"error", code })` 에 더해 **그 소켓에 최신 `state` 를 다시 보낸다** (RS Pattern 8 ⑥, UI S-03 "시작이 거절되면 서버 view 대로 다시 그린다"). `buildView(room, att.playerId, now)` (broadcast 가 쓰는 형태, 208행)를 재사용.

**leave / kick 후 소켓 정리:** 나간 사람의 소켓은 `ws.close(CLOSE_CODES.REMOVED, "left" | "kicked")` — 클라이언트 `REMOVED_REASONS`(useRoomConnection.ts:22)와 맞는 문자열만 쓴다.

**알람 다중화** (worker/room.ts:131-147): 현재 `alarm()` 은 만료만 처리. `nextWakeAt = min(phaseEndsAt ?? ∞, expiresAt)` 로 일반화. 규칙:
- 생성자에서 알람을 설정하지 않는다(39행 주석 — 대기 알람을 덮어씀).
- `alarm()` 안에서 예외가 나면 재설정을 빠뜨리지 않게 try/finally(6회 재시도 후 멈춤, RS Pattern 4).
- 단계 전환 시: `tick` → `persistAndBroadcast` → `setAlarm(nextWakeAt)`.

**방송 패턴 유지** (worker/room.ts:194-210): "변경은 항상 저장이 끝난 뒤에 방송", 연결마다 `buildView(room, att.playerId, now)` 를 따로 만든다. 역할이 든 뷰는 이 경로로만 나간다.

**테스트 analog:** `test/worker/http.test.ts` — `openSocket()` 헬퍼(24-50: `exports.default.fetch` + `Upgrade: websocket`, `res.webSocket!.accept()`, 메시지 큐), `createRoom()` (14-18). 테스트마다 새 방 코드(POST 가 무작위 코드를 뽑음). 알람은 `runDurableObjectAlarm`/`evictDurableObject` (`cloudflare:test`, RS Don't Hand-Roll).

---

#### `worker/index.ts` — `GET /api/rooms/:code`, `POST /api/rooms/:code/join` (route, request-response)

**Analog:** 같은 파일 `handleCreateRoom` (27-59) + WS 라우트 (71-76).

**본문 제한·파싱·검증 패턴** (index.ts:27-42) — `join` 이 그대로 복사:
```typescript
const declared = Number(request.headers.get("content-length") ?? "0");
if (declared > MAX_BODY_BYTES) return apiError("BAD_REQUEST", 400);
const text = await request.text();
if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) return apiError("BAD_REQUEST", 400);
let raw: unknown;
try { raw = JSON.parse(text); } catch { return apiError("BAD_REQUEST", 400); }
const parsed = CreateRoomBodySchema.safeParse(raw);   // join 은 JoinRoomBodySchema (schemas.ts:8 이미 있음)
if (!parsed.success) return apiError("BAD_REQUEST", 400);
```
**코드 형식 선검사** (index.ts:73-75): `if (!isRoomCode(code)) return apiError("ROOM_NOT_FOUND", 404);` 를 DO 를 부르기 전에. 라우트 정규식은 `WS_PATH`(25행) 옆에 `PREVIEW_PATH = /^\/api\/rooms\/([^/]+)$/`, `JOIN_PATH = /^\/api\/rooms\/([^/]+)\/join$/` 를 두는 형태.
**에러 응답:** `apiError(code, status)` (21-23), `cache-control: no-store` 는 `json()` (11-19) 가 이미 붙인다 — 미리보기도 이 헬퍼를 통한다. `ApiErrorCode` 는 이미 `ROOM_FULL`, `GAME_STARTED`, `NICKNAME_TAKEN` 포함(protocol.ts:36-44) — 새 코드 불필요. 상태 코드 매핑: ROOM_NOT_FOUND 404, ROOM_FULL/GAME_STARTED/NICKNAME_TAKEN 409, NICKNAME_INVALID 400.

---

### B. 클라이언트 순수 로직·네트워크

#### `src/net/api.ts` — `getPreview`, `joinRoom` (service, request-response)

**Analog:** 같은 파일 `postJson` (28-46) + `createRoom` (48-50).
```typescript
export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiErrorCode | "NETWORK" };
async function postJson<T>(path: string, body: unknown): Promise<ApiResult<T>> { ...fetch → res.json → isApiError }
export function createRoom(nickname: string): Promise<ApiResult<CreateRoomResponse>> {
  return postJson<CreateRoomResponse>("/api/rooms", { nickname });
}
```
**복사할 점:** 네트워크 실패·JSON 파싱 실패는 모두 `{ ok:false, error:"NETWORK" }`. `joinRoom(code, nickname)` = `postJson<JoinRoomResponse>(\`/api/rooms/${code}/join\`, { nickname })`. `getPreview(code)` 는 `getJson<RoomPreview>` 를 `postJson` 과 같은 구조로 하나 더 만들고(`method: "GET"`, 본문 없음) 에러 처리 동일. `API_ERROR_CODES` 목록(5-14)은 `satisfies ApiErrorCode[]` 로 서버와 맞춰져 있다 — 코드를 더할 일이 없다.

#### `src/net/useRoomConnection.ts` — 상태기계로 교체 (hook, streaming)

**Analog:** 같은 파일. 지키고 가져갈 부분:
- `roomSocketUrl(loc, code)` (25-28) — export 유지(`test/unit/roomSocketUrl.test.ts` 가 직접 사용). 토큰은 주소에 넣지 않는다.
- `parseServerMessage` (30-39) — `"state" | "pong" | "error"` 만 통과.
- 테스트 주입점 `options?.createSocket` + `createSocketRef` (44, 52-53) — 새 훅도 유지(테스트의 `FakeSocket` 이 의존).
- StrictMode 대응: effect 정리에서 `disposed = true`, 타이머 해제, `ws.close()` (97-104).
- 낡은 소켓 close 무시: `if (disposed || socketRef.current !== ws) return;` (82).
- 닫힘 코드 분기: `CLOSE_CODES.REPLACED` → `replaced`, `CLOSE_CODES.REMOVED` → `removed` + 사유(83-87).

**교체/추가할 곳** (파일 주석 17-19 가 정확히 지목): 고정 1초 재시도(`RETRY_DELAY_MS`), `MAX_CONSECUTIVE_FAILURES = 5` → 지수 백오프+지터, `visibilitychange`/`pageshow`/`online` 즉시 `ping`·2~3초 무응답 시 재연결, **`ping{c}` 표본 3~5회로 `estimateOffset`**(현재 78행은 상태 메시지마다 `serverNow - Date.now()` 한 점 — RS Pattern 5), 상태에 `"failed"`·`bannerMode`·`epoch` 추가. `epoch` 는 소켓 `open` 마다 +1, 소비 쪽(`roomDiff`)이 `prevRef = null` 로 리셋(토스트 "처음 열 때 없음"). `failingSince` 는 **visible 인 동안의 첫 실패 시각**(RS Pitfall 21). 로직은 `linkReducer` 순수 함수로 빼고 훅은 이벤트만 넘긴다.

**테스트 analog:** `test/client/useRoomConnection.test.tsx` — `FakeSocket extends EventTarget`(6-34), `setup()`(45-54), `act(() => s.open())` 패턴. 리듀서는 `test/unit/` 에서 fake timer 없이.

#### `src/net/roomDiff.ts`, `cardFace.ts`, `countdown.ts` (utility, transform)

**Analog:** `src/net/clock.ts` (순수 함수, 주석 첫 줄 "순수 함수라 fake timer 없이 테스트한다"). 
```typescript
export function remainingMs(deadline: number, offset: number, localNow: number = Date.now()): number {
  return Math.max(0, deadline - (localNow + offset));
}
```
**복사할 점:** `now` 를 인자로 받는 시그니처(`localNow` 기본값만 `Date.now()`), 0 아래로 내려가지 않는 클램프. `countdown(endsAt, durationMs, offset, localNow)` 는 `remainingMs` 를 호출해 `{remainingMs, seconds(ceil), urgent(≤5000 && >0), ratio}` 를 만든다. `roomDiff.ts` / `cardFace.ts` 의 본문은 RS Pattern 11, Code Examples "뷰 차이·카드 면" 의 코드를 그대로 쓴다(`diffRoomViews`, `initialCardState`/`onTap`/`onAutoTimer`, `AUTO_FLIP_MS = 5_000`). `PublicPlayer` 필드명(`seat`, `nickname`, `connected`, `isHost`)은 protocol.ts:59-64 와 일치.

**테스트 analog:** `test/unit/clock.test.ts`(39줄), `test/unit/seatLayout.test.ts`(`it.each` 로 자리 전수 검사, 30행).

#### `src/net/share.ts` — `copyLink`, `shareOnly` 추가 (utility, request-response)

**Analog:** 같은 파일. `navigator` 를 **인자로만** 받는 설계(주석 1-3)를 유지: `ShareNavigator` 인터페이스(19-23), `isAbort`(26-28).
```typescript
if (nav.share && (nav.canShare === undefined || nav.canShare(data))) {
  try { await nav.share(data); return "shared"; }
  catch (error) { if (isAbort(error)) return "cancelled"; }
}
```
**더할 것:** `shareOnly(nav, data)` = 위 블록만(실패하면 `"manual"`), `copyLink(nav, url)` = `nav.clipboard.writeText` 만(`"copied" | "manual"`). 기존 `shareRoom` 체인(60-62)은 `test/unit/share.test.ts` 가 검증 중 → 유지 여부는 계획이 정하되 삭제하면 그 테스트도 정리. `buildShareText`(37-39) 는 "마피아 방" 문구 — UI C-03 은 "기존 그대로, 제목만 '미니피아'" 라고 했으므로 호출 쪽에서 `title: "미니피아"`. 두 핸들러는 클릭 처리기 **첫 `await` 앞**에서 호출(RS Pitfall 6).

#### `src/net/assets.ts` (utility, transform)

**Analog:** DS bundle.js 195-199 (`FIGURE_IDS`, `ROLE_ART`) — 앱은 `asset()` 을 쓰지 않고 `/characters/…` 절대 경로 + `@` → `%40`.
```javascript
var FIGURE_IDS = ['fig1_boy_brown', 'fig2_boy_black', 'fig3_boy_blonde', 'fig4_girl_brown', 'fig5_girl_black', 'fig6_girl_auburn', 'fig7_boy_blackhat', 'fig8_girl_tanhat'];
```
본문은 RS Code Examples "에셋 URL 헬퍼" (`png(dir,id,density)`, `figureSrc(seat)`, `roleArtSrc(role)`, `backdropUrl(layout,variant)`). `src/net/` 가 아니라 `src/components/` 근처가 어울린다는 판단은 계획 재량이지만 RS 구조도는 `src/net/assets.ts`. 존재 검사 테스트는 `import.meta.glob("/public/characters/**/*.png")` (node:fs 금지 — `@types/node` 미선언, RS 118/196행).

#### `src/net/copy.ts` — `messageForApiError(error, context)` (utility, transform)

**Analog:** `api.ts` 의 `isApiError`/`API_ERROR_CODES` (5-26) — 닫힌 코드 집합 → 문자열 매핑. 매핑 정본은 UI "Error state" 표(코드 칸 아래 / 닉네임 칸 아래 / 입력 카드 대신 / 토스트). 반환은 `{ field: "nickname" | "code" | "card" | "toast"; text: string }` 형태를 권한다(문구와 위치를 한 곳에서). 단위 테스트는 표의 모든 행을 `it.each`.

---

### C. 디자인 시스템 부품 이식 (`src/components/`)

공통 변환 규칙 (DS → TSX):
- `h('div', { className: cx('mf-x', cond && 'mf-x--y', p.className) }, …)` → JSX + 작은 `cx()` 헬퍼(`src/components/cx.ts`, bundle.js:5 와 동일).
- `index.d.ts` 의 props 를 타입의 출발점으로 쓴다.
- 클래스 이름 `mf-*` 유지, 루트에 `mf-root` 가 필요한 부품(Table 등)은 그대로.
- 사용자 문자열은 JSX 텍스트와 `title` 로만(UI 스타일 규칙, `Lobby.tsx` 기존 테스트 "닉네임은 텍스트로만 그린다" 유지: `container.querySelector("b")` null).

#### `Icon.tsx` — DS 41-79, 그대로 이식
`ICONS` 경로 데이터(crown 제외 가능: 왕관 → "방장" 배지로 교체, 단 `diamond`·`disconnected`·`share`·`close`·`check`·`card` 필요). **`card` 아이콘은 DS `ICONS` 에 없다**(S-04 가운데 원·[내 역할] 버튼용) → 새 경로를 만들어야 한다(UI "카드 아이콘"). `copy`, `back` 도 DS 에 없다(UI 아이콘 목록에는 있음) → no direct analog, 같은 stroke 규격(24×24, `strokeWidth: 2`, round)으로 추가.
```javascript
h('svg', { className: cx('mf-icon', p.className), viewBox: '0 0 24 24', width: size, height: size,
  fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round',
  role: p.label ? 'img' : undefined, 'aria-label': p.label, 'aria-hidden': p.label ? undefined : 'true' }, …)
```

#### `Button.tsx` — DS 90-96 + `.mf-btn*` (bundle.css 14-29)
`variant: primary | secondary | text`, `block`, `compact`, `icon`. 기존 앱의 `.btn`/`.btn-primary`(진홍 면)는 **버린다**: 주 버튼은 `--gray-100` 면 + `--night-900` 글자(bundle.css:26), 포커스 링 `--gray-100`(23). UI 컬러 표: 진홍은 버튼에 쓰지 않는다. `type: 'button'` 기본(95행 패턴 — `Object.assign({ type: 'button' }, rest, …)`)을 유지해 폼 제출을 막고, 제출 버튼만 `type="submit"` 을 넘긴다.

#### `TextField.tsx` — DS 107-118 + `.mf-field*` (bundle.css 47-58)
**델타:**
- DS 는 `defaultValue: p.value`(비제어) 이고 `maxLength: p.code ? 4 : 8` → 앱은 **제어 입력**(`value`/`onChange`)으로. 기존 `Home.tsx:36-43` 의 제어 패턴을 가져오되 `maxLength={16}` 은 8 로(UI: 1~8자).
- UI 접근성 규칙: 닉네임 `autoComplete="off" autoCapitalize="off" autoCorrect="off" spellCheck={false}`, 코드 `inputMode="numeric" pattern="[0-9]*"` — DS 는 `autoCapitalize`/`autoCorrect`/`pattern` 이 없다.
- 오류: DS 가 이미 `role="alert"` + `aria-describedby` + `aria-invalid` (113-117)를 갖고 있다 → 그대로. 단 테두리: DS `.mf-field--error .mf-field__input { border-color: var(--crimson-400) }` (bundle.css:57) → UI 는 **2px `--crimson-300`**.
- `id` 기본값 `'mf-f-' + label` 은 한국어 label 로 id 가 만들어진다 → `useId()` 로 대체.

#### `Timer.tsx` — DS 121-129 + `.mf-timer*` (bundle.css 61-66)
**델타 (RS Pattern 14·15):**
- 입력을 `remainingMs, durationMs` → `endsAt, durationMs, offset`, 내부에서 `countdown()`(위 utility)로 계산하고 250ms 간격 재그림(`remainingMs > 0` 동안만), `visibilitychange` 에서 1회 갱신.
- 숫자: DS `sec` 정수 → **`m:ss`** (`0:15`).
- `timer-pop` 220ms (scale 1.35→1) 신규, 숫자 `span` 의 `key={seconds}` 로 초마다 재생.
- 막대 `transform: scaleX(ratio)` + `transition: transform 250ms linear` (DS 는 전환 없음).
- 유지: `role="timer"`, `aria-label={\`남은 시간 ${sec}초\`}` (DS 126), `aria-live` 쓰지 않음, urgent 모디파이어 `mf-timer--urgent` (진홍 예약 1번).

#### `PhaseBar.tsx` — DS 132-139 (재배치)
DS 는 `phase`(14px/700, 위) + `instruction`(16px/700) 구조 → UI S-05 는 **제목(heading 24px) / 안내(label 14px `--gray-300`) / 오른쪽 [내 역할] / 아래 Timer**. `extra` 슬롯(DS:136)에 [내 역할] 버튼을 넣는 구조는 재사용 가능. `ds.css` 의 `.mf-phasebar__*` 규칙을 UI 크기에 맞게 수정.

#### `ReconnectBanner.tsx` — DS 148-151 + bundle.css 80-82
**델타:** `height: 32px; width:100%` → **52px**, `position` 없음(DS 도 흐름 안 flex지만 RS 는 "절대 위치 → 흐름 안" 이라 적었음 — 앱에서 확인), 면 `--night-800` → **`--night-700`**, 문구 "연결이 끊겼어요 · 다시 연결하는 중", 복구 시 "다시 연결됐어요" 2초(`mode: "reconnecting" | "restored"` prop). 점 깜빡임 `mf-blink` 유지. 게임 화면 장면은 `flex:1; min-height:0` 로 이 높이만큼 줄어든다.

#### `Sheet.tsx` (신규 틀) → `ConfirmSheet.tsx`, `MyRoleSheet.tsx`, `ShareSheet.tsx`
**Analog (모양):** DS `ConfirmSheet` (154-163) + `.mf-sheet*` (bundle.css 85-89). **Analog (동작):** 없음 → RS Pattern 9 `<dialog>` 구조와 Code Examples "시트 골격" (RS 596행 이후)을 따른다.
```javascript
h('div', { className: 'mf-sheet-wrap' },
  h('div', { className: 'mf-sheet-scrim', onClick: p.onCancel }),
  h('div', { className: 'mf-sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': p.title }, … ))
```
**델타:** DS 는 평범한 `div`(포커스 가두기·Esc 없음) → `<dialog>.showModal()` (+ `if (!dlg.open)` StrictMode 가드, `cancel` 이벤트 `preventDefault` 후 자체 닫기, 240ms 뒤 `close()` 에 타임아웃 폴백, 막은 `::backdrop` 이 아니라 안의 `<div>` + `var(--scrim)`, 명시적 `focus()`, `max-width: 430px; margin: auto auto 0`, `max-height: 80dvh; overflow-y:auto`). 열림 상태는 `RoomScreen` 이 쥔다(단계가 바뀌어도 시트 유지).
**ConfirmSheet 델타:** DS 는 `[취소]=primary`, `[confirm]=secondary` (161-162) — UI 도 같은 위계(취소 `--gray-100`, 파괴 동작 `--gray-800` 면, 진홍 없음)이므로 그대로. 열리면 포커스는 [취소]; 요청 중 두 버튼 꺼짐 prop 추가.
**테스트:** happy-dom 은 `showModal()`/`open` 동작, 포커스 가두기는 재현 안 됨 — 열림/닫힘·Esc(`cancel` 디스패치)·막 클릭·`aria-label` 까지만 단위로.

#### `Toast.tsx` — DS `Notice` (142-145) 모양만
DS `Notice` 는 `mf-notice`(night-800 면, pill, `role="status"`). UI Toast 는 **`--gray-100` 면 + `--night-900` label-strong 글자, `--shadow-card`**, 위/아래 위치 prop, 2초 후 소멸, 한 번에 하나(상태 한 칸). 모양(pill, `role="status"`)만 DS 와 같고 스타일은 새로 쓴다.

#### `Figure.tsx` — DS 200-209 + `.mf-figure*` (bundle.css 113-115)
```javascript
h('img', { className: cx('mf-figure', state !== 'default' && 'mf-figure--' + state, p.className),
  src: asset(…'characters/table/' + FIGURE_IDS[v] + '_default@4x.png'), width: 72, height: 96, draggable: false,
  alt: p.label || '', 'aria-hidden': p.label ? undefined : 'true' })
```
**델타:** `asset()`/`@4x` 단일 → `figureSrc(seat)` 의 `src` + `srcSet` (`%40` 변환; 밀도 서술자는 RS Pitfall 15 권고 `2x`↔`@2x`, `4x`↔`@4x`, UI 문구와 다르므로 계획에서 확정). `state: dead` 는 1페이즈 미사용. 끊김은 CSS `grayscale(1)` + `opacity .6` (bundle.css:114, UI 와 동일). 접근성 이름 "{닉네임}, 연결 끊김" 은 Table 쪽 `seatLabel` 에서.

#### `Backdrop.tsx` — DS 212-220 + bundle.css 211-214
**델타:** `asset('backgrounds/bg_…svg')` → `backdropUrl(layout, variant)` (`/backgrounds/bg_{layout}_{variant}.svg`, 이름에 `@` 없음이라 `%40` 불필요). 화면 매핑(UI "장면과 그림"): S-01/S-02 `entry`+`lobby`, S-03~S-05 `game`+`lobby`, S-06 `game`+`day`. `background-position: center top`, `cover` 유지. 배경 교차 페이드(`transition: background-image`)는 선택.

#### `Table.tsx` — DS 223-286 + `.mf-table*`/`.mf-seat*`/`.mf-tag*` (bundle.css 118-155)
**Analog 의 좌표 계산은 앱에 이미 있다:** `shared/seatLayout.ts` (`seatLayout(seat, mySeat, total, rx, ry)`, DS `seatLayout`(223-229)과 같은 식). `Table.tsx` 는 DS 의 로컬 함수를 쓰지 말고 `import { seatLayout } from "../../shared/seatLayout"`.
```typescript
// shared/seatLayout.ts:20-36 (이미 구현·테스트됨, 변경 없음)
const slot = (((seat - mySeat) % total) + total) % total;
const theta = Math.PI / 2 + (slot / total) * Math.PI * 2;
const depth = (Math.sin(theta) + 1) / 2;
return { slot, x: 50 + rx*Math.cos(theta), y: 50 + ry*Math.sin(theta), scale: 0.62 + 0.38*depth, z: Math.round(depth*10), depth };
```
**DS → UI 델타 (RS Pattern 14 표 + UI Table 절):**
1. **빈 의자(`Chair`, DS 231-235, 244-246) 삭제** — 빈 자리는 비워 둔다.
2. **방장 `crown` 아이콘(DS 258) → "방장" 알약 배지**(이름표 아래, `--night-700` 면, label, `--radius-pill`). DS `.mf-seat__mark--host` 도 삭제.
3. 동료 표시(링 `--crimson-400` + 머리 오른쪽 위 마름모, `aria-label="동료"`)는 유지, 막(`dimmed` → `.mf-table__scrim`, z 20)보다 위 z(30) — DS 의 `.mf-seat__ring--mate { z-index: 30 }` / `.mf-seat__mark--mate { z-index: 30 }` 그대로.
4. 이름표는 크기 변환 **바깥**(`top` 배열에 별도 레이어, DS 262-268) — 항상 14px, 한 줄 말줄임(앞쪽 96px, 뒤쪽 72px = `.mf-tag__name`/`.mf-tag--back`), `title` 에 전체 이름, 내 자리 "(나)". 이 구조 그대로.
5. 인물 높이 `FIG_H = 21.33` 은 **장면이 4:5 일 때만** 맞는 값(DS:230, RS Pitfall 16). 앱은 부모 `flex:1; min-height:0`, 장면 `height:100%; aspect-ratio:4/5; max-width:100%; margin:0 auto`.
6. 입력 모양은 DS 의 `seats[i]` 를 따르되 역할을 받지 않는다: `{name, variant?, me?, host?, mate?, state?}`; `variant` 는 seat 번호로 `FIGURE_IDS` 인덱스 — `Seat.state` 는 `'default' | 'disconnected'`.
7. seat 등장/퇴장: DS 에 없음(R18 계열) → `seat-enter` 420ms / `seat-leave` 320ms (UI Motion) 를 `useSeatTransitions` 가 `entering`/`leaving` 플래그로. `left` 는 320ms 동안 직전 뷰의 인물을 남겨야 한다.
8. 사용하지 않는 seat 필드(`claim`, `bubble`, `reaction`, `votes`, `selectable`…)와 그 CSS(`.mf-bubble`, `.mf-react`, `.mf-votes`, `.mf-tag__claim`)는 1페이즈에 이식하지 않는다. 단 `onSeatPress` + `pressable`(방장이 끊긴 사람 누르기)은 필요 — DS `mf-seat__btn`(260행) 패턴.

#### `RoleCard.tsx` — DS 166-185 + `.mf-card*` (bundle.css 92-105)
**델타 (가장 큼, RS Pitfall 20):**
| 항목 | DS | 앱 (UI/RS) |
|---|---|---|
| 앞면 렌더 | `role ? h('div', {...front}) : null` — 뒷면에서도 DOM 에 있음 (181-184) | **앞면은 면이 `front` 가 되는 렌더에서 마운트**, 뒷면 마크업은 역할과 무관하게 동일 |
| 뒤집기 시간 | 600ms (bundle.css:93) | **800ms** |
| 폭 | `min(72vw, 280px)` (92) | `min(64vw, 240px)`, 높이 ≤ `52dvh` |
| 뒷면 힌트 | 카드 안 `mf-card__hint` "눌러서 확인" (179) | 카드 **밖** 안내 두 줄 (`카드를 눌러 직업을 확인하세요` / `다른 사람에게 보이지 않게 가려 주세요`) |
| 직업 그림 | `ROLE_ART[role]` @4x, 폭 48% | `/characters/roles/{role}_default@4x` 폭 150 (`roleArtSrc`) |
| 설명 | `ROLES.desc` 긴 문장 | UI 의 새 한 줄 설명 ("밤에 함께 한 명을 지목해요" 등). 역할 이름·설명 문구는 `src/game/roleText.ts` (roles.ts 주석 4행이 이 위치를 예약함) |
| 동료 줄 | `'동료: ' + mates.join(', ')` / '이번 판 마피아는 당신 혼자입니다' (184) | `동료 · {이름}, {이름}` / `혼자예요`, 구분선 + `--crimson-300` label-strong |
| 접근성 | 뒷면 `role="button" tabIndex=0 aria-label="역할 카드 뒤집기"` (178) | 유지. Space/Enter 도 `onKeyDown` 으로 처리(DS 는 `onClick` 만 → 추가 필요) |
| 앞면에서 누르기 | 없음 | 앞면 클릭도 `onFlip` (다시 가림) |
| `me.role` 없음 | — | 뒷면 고정, 뒤집기 입력 무시 |
뒷면 다이아몬드 SVG(`Diamond`, 166-171)는 그대로 이식. 테스트: `role="mafia"` 와 `role="citizen"` 의 뒷면 `innerHTML` 동일, 앞면 이전에 역할 이름이 DOM 에 없음.

#### `ds.css` / `screens.css` / `base.css` (config)
- `ds.css`: `bundle.css` 214줄을 복사(맨 위 헤더 주석 "글자 크기는 14/16/24/36, 굵기는 400/700 뿐이다"와 `var(--…)` 만 쓰는 규칙 유지). 이식 제외: Chip, EmojiBar, QuickMessagePanel, MessageLog, VerdictPicker, Announcement, ResultList, Notice(Toast 로 대체), MyRoleButton(삭제). 아래 상수를 상단 `:root` 에 지역 선언(토큰 원천은 건드리지 않는 쪽, RS Pitfall 23 권고): 재접속 띠 52px, 시트 240ms, `phase-enter`/`card-rise` 300ms, `seat-leave` 320ms, `timer-pop` 220ms, 배정 링 1s.
- `screens.css`: 기존 161줄은 UI 와 어긋난다 — 진홍 방장 배지 (`.lobby-host { background: var(--crimson-700) }`, 148-155), 진홍 버튼 (`.btn-primary { background: var(--crimson-500) }`, 76-79), 진홍 포커스 링 (`.field-input:focus-visible { outline: 2px solid var(--crimson-400) }`, 49-52), 글자 크기 13/15/17/40/56px. 화면 틀 클래스(`.screen`: `flex:1; flex-direction:column`)는 개념만 유지해 새로 쓴다. hex 직접 사용 금지.
- `base.css`: `#root`(17-28: `max-width:430px`, `safe-area-inset`)와 reduced-motion 전역 규칙(38-46)은 그대로 둔다. `.app-version`(30-36)만 `font-size: 11px; color: var(--gray-500)` → 14px, `--gray-300` (UI: `--gray-500` 글자 금지).

---

### D. 화면

#### `src/App.tsx` — 라우팅·세션 이어받기 (component, request-response)

**Analog:** 같은 파일 (5-15). 라우터 라이브러리 없음(UI 7번 근거) — `window.location.pathname` 과 `history.pushState` 로 `/` ↔ `/r/:code`.
```typescript
type Screen = { screen: "home" } | { screen: "room"; code: string; token: string };
export function App() {
  const [current, setCurrent] = useState<Screen>({ screen: "home" });
  const goHome = useCallback(() => setCurrent({ screen: "home" }), []);
  if (current.screen === "room") return <RoomScreen code={current.code} token={current.token} onExit={goHome} />;
  return <Home onEnterRoom={(code, token) => setCurrent({ screen: "room", code, token })} />;
}
```
**복사할 점:** 판별 유니온 `Screen` 에 `{ screen: "join"; code }`, `{ screen: "error"; reason }` 추가; `onEnterRoom(code, token)` 콜백 시그니처 유지(`Home`/`JoinByLink` 공통); `goHome` 은 `useCallback`(자식 `useEffect` 의존성이므로 참조 안정 필수 — RoomScreen:19-21). 시작 시 저장된 세션이 있으면 **`getPreview(code)` 로 방이 살아 있는지 먼저 확인**(RS Pitfall 22), 404 면 세션 삭제 후 첫 화면. `test/client/app.test.tsx`(11줄)가 현재 App 스모크 — 확장.

#### `src/screens/Home.tsx` — S-01 (component, request-response)

**Analog:** 같은 파일 (10-58).
```typescript
const [nickname, setNickname] = useState("");
const [busy, setBusy] = useState(false);
async function handleCreate(e: FormEvent) {
  e.preventDefault();
  if (busy) return;
  setBusy(true); setFailed(false);
  const result = await createRoom(nickname);
  setBusy(false);
  if (result.ok) onEnterRoom(result.data.code, result.data.token); else setFailed(true);
}
```
**복사할 점:** `busy` 이중 제출 가드, `onEnterRoom` 콜백, `<footer className="app-version">v{APP_VERSION}</footer>` 와 `APP_VERSION` import (3행, 배포 확인용).
**바꿀 점 (UI S-01 / R5 / R16):**
- 임시 `<h1>minifia</h1>` → 소개 문구 + "미니피아"(display), `Backdrop layout="entry"`, 입력 카드(`--night-800` 반투명).
- 단일 `failed: boolean` → 오류 위치별 상태(`nicknameError`, `codeError`) + 토스트. 매핑은 `messageForApiError(error, "home-code" | "create")`.
- 닉네임 유효성: 첫 화면 처음에는 오류 문장 없이 두 버튼만 꺼짐, 한 번 입력한 뒤부터 문장 표시. 검증은 `shared/nickname.ts` 의 `validateNickname`(클라이언트도 import 가능 — `src/` 가 이미 `../../shared/…` 를 import).
- [참가] 버튼과 코드 입력칸 추가(4자리 미만이면 [참가]만 꺼짐), 코드 참가는 `joinRoom` 대신 먼저 `getPreview` 로 사유 확인 후 `joinRoom`.
- 마지막 닉네임 localStorage 기억(D-06), 진행 중인 방 세션이 있으면 건너뜀.
- 기존 테스트 `test/client/screens.test.tsx` 의 `Home` 케이스(`getByLabelText("닉네임")`, `getByRole("button", {name:"방 만들기"})`, `fetch` 스텁 `vi.stubGlobal`)는 라벨·버튼 이름이 UI 와 같으므로 대부분 유지, 오류 문구 단언만 UI 문구("연결이 불안정해요. 다시 시도해 주세요", "지금은 방을 만들 수 없어요. 잠시 후 다시 해 주세요")로 교체.

#### `src/screens/JoinByLink.tsx` — S-02 (component, request-response + 폴링)

**Analog:** `Home.tsx` (폼 구조·`busy` 가드·`FormEvent`) + RS Pattern 6 폴링 규칙. 
**규칙:** `document.visibilityState === "visible"` 인 동안만 10초 간격, `visibilitychange`→visible 때 즉시 1회, 화면을 떠나면 정리, 요청 직렬화(이전 요청 끝나기 전 겹쳐 보내지 않음), 404 → "방을 찾을 수 없어요" 전환(RS Pitfall 18). 앉은 사람 한 줄: DS `Figure` + 이름표(`mf-tag__name` 스타일), 폭 360px 에서 8명이 안 들어가므로 5명 이상이면 `flex-wrap` 2줄(RS Pitfall 16, 🧪 UAT). 입장 정보(토큰) 가 이미 있으면 이 화면 없이 바로 방으로.

#### `src/screens/ErrorScreen.tsx` (component, render)

**Analog:** `RoomScreen.tsx` 의 `notice` 분기 (23-35) — 중앙 정렬 문구 + 버튼.
```tsx
<main className="screen notice">
  <p className="notice-text">다른 창에서 이 방에 들어갔어요</p>
  <button className="btn btn-primary" type="button" onClick={connection.reconnect}>다시 연결</button>
  <button className="btn" type="button" onClick={() => onExit("replaced")}>처음으로</button>
</main>
```
이 마크업을 `ErrorScreen` 하나로 일반화(`message`, `actions`), 사유 → 문구 매핑은 UI Error 표(내보내짐 "방장이 방에서 내보냈어요", 방 닫힘 "방이 닫혔어요", 입장 정보 없음…). `ExitReason = RemovedReason | "replaced"`(RoomScreen:6) 타입 재사용. `.btn`/`.btn-primary` 클래스는 새 `Button` 부품으로 교체(진홍 버튼 제거).

#### `src/screens/RoomScreen.tsx` — 단계 분기·띠·시트 상태 (component, event-driven)

**Analog:** 같은 파일 (14-54).
```tsx
const connection = useRoomConnection(code, token);
const { status, view, removedReason } = connection;
useEffect(() => { if (status === "removed") onExit(removedReason ?? "room_closed"); }, [status, removedReason, onExit]);
…
switch (view.phase) {
  case "lobby": return <Lobby view={view} send={connection.send} />;
  // 아래 단계 화면은 01-09 가 붙일 자리다.  (옛 번호 — 지금은 01-13)
  case "assigning": case "roleReveal": case "day":
    return <main className="screen" data-phase={view.phase} />;
}
```
**유지:** `status === "replaced"` 분기, `!view` → "연결 중…" 전체 화면, 단계 `switch`(빠짐없는 분기 — TS `noImplicitReturns` 에 의존하는 형태). 주석(18행)이 "쫓겨난 이유별 화면은 01-05 가 붙인다"(옛 번호 — 지금은 ErrorScreen 01-06, RoomScreen 연결 01-11) 라고 한 자리 = `removed` → `ErrorScreen`.
**더할 것:** `status ∈ {connecting, reconnecting}` + `view` 있음 → 맨 위 `ReconnectBanner`(내용 밂); `canSend = status === "open"` 를 하위 화면에 내려 서버 입력 버튼 비활성(현재 `send` 는 OPEN 이 아니면 조용히 버림 — useRoomConnection:107-110); `failed` → "연결할 수 없어요" 화면; 시트 열림 상태(`myRoleOpen`, `shareOpen`, `confirm`) 보유; `seenFront` 상태 보유(RS Pattern 10); `diffRoomViews` 소비(토스트·`useSeatTransitions`); 보이지 않는 `aria-live="polite"` 영역(단계 바뀔 때만 문구: UI 접근성 절).

#### `src/screens/Lobby.tsx` — S-03 교체 (component, event-driven)

**Analog:** 같은 파일의 **props 시그니처** `{ view: RoomView; send: (msg: ClientMessage) => void }` 와 테스트가 확인하는 불변식(닉네임을 React 텍스트로만 그림). 현재 구현은 목록(`ul.lobby-players`) 임시본이고 주석(8행)이 "2.5D 테이블은 01-06 이 이 파일을 교체한다"(옛 번호 — 지금은 01-10) 고 명시.
**교체 구조 (UI S-03):** 위쪽 바([뒤로] 아이콘 / "방 코드" + 코드 display / [공유] 아이콘) → `Backdrop` + `Table`(seats ← `view.players`, `mySeat = view.me.seat`) → 하단 시트(안내 + `connectedCount` 인원, 방장 [게임 시작] 또는 참가자 [링크 공유]).
- 인원: `connectedCount(view.players)` + `view.maxPlayers` — **`shared/game/room.ts` 의 `connectedCount` 를 import** (서버와 같은 함수, RS Pattern 8). 기존 `view.players.length` (Lobby.tsx:17) 는 끊긴 사람을 센다 → 바꿔야 함.
- 활성: `canStart = connectedCount >= view.minPlayers`(`minPlayers` 는 뷰에 이미 있음). 누르면 `send({ t:"start" })` + 2초 잠금.
- 방장 끊김 안내: `view.players.find(p => p.isHost)?.connected === false`.
- 나가기: `ConfirmSheet`("방에서 나갈까요?") → `send({ t:"leave" })`. 내보내기: 방장이 끊긴 다른 사람 자리 누르기 → `ConfirmSheet`("{닉네임}님을 내보낼까요?") → `send({ t:"kick", seat })`.
- 기존 `(연결 끊김)` 텍스트 표시 → 흑백+60% 인물 + 이름표 옆 끊김 아이콘 + 접근성 이름 (UI "끊김").
**테스트:** `screens.test.tsx` 의 `Lobby` 케이스(`const view: RoomView` 고정 데이터, `render(<Lobby view={view} send={() => {}} />)`)를 같은 방식으로 확장. `Table` 은 자리마다 `<img>` 가 있으므로 `getByText` 대신 `getByTitle`/`getByRole("group", {name:"테이블"})`.

#### `Assigning.tsx` (S-04), `RoleReveal.tsx` (S-05), `Day.tsx` (S-06)

앱 안에 직접 대응 파일이 없다 (RoomScreen 의 `notice` 중앙 정렬만 비슷).
- **Assigning:** `Table dimmed` + `--night-950` 90% 막(420ms opacity) + 맥박 링 3겹(`@keyframes` 1s, scale .6→1.6/opacity .6→0, 지연 0/.33/.66s) + 카드 아이콘 원 + heading "직업을 배정하고 있습니다…" + label "잠시만 기다려 주세요". 입력 없음, [내 역할] 없음, 모든 사람 같은 마크업.
- **RoleReveal:** DS `PhaseBar`(제목 "역할 확인") + DS `Timer` + `RoleCard` + 카드 아래 안내 두 줄. 면 전이는 `cardFace.ts`. 자동 뒤집기 `setTimeout` 하나: `delay = (phaseEndsAt - phaseDurationMs + AUTO_FLIP_MS) - (Date.now() + offset)`, effect 정리에서 해제, 단계가 바뀌면 초기화(RS Pattern 10). `view.me.role` 이 없으면 뒤집기 무시.
- **Day:** `Backdrop layout="game" variant="day"` + 아침빛(`--morning` 방사형 800ms) + "1일차"(heading) + "낮이 되었습니다"(display, 800ms 번지듯, `--shadow-text`) + 오른쪽 위 [내 역할]. 타이머·테이블·행동 없음(멈추는 것이 정상). DS 에 `Announcement`(326-334)가 있으나 `tone: neutral` 도 `mf-announce` 패딩/구조라 앱 UI 와 맞지 않아 이식하지 않고 직접 쓴다(RS 표: Announcement 이식 안 함).

**[내 역할] 버튼 (S-05/S-06 우측 상단):** DS `MyRoleButton`(188-192, `aria-pressed` + 안내 "누르고 있는 동안만 보여요")은 **전부 버린다** (R14, 결정 0012). 대신 DS `Button variant="secondary" compact icon="card"` 한 개 + `onClick` 으로 시트 열기. 

---

## Shared Patterns

### 1. 상태 공개 경계 — 허용 목록 빌더
**Source:** `shared/game/view.ts:7-33` (`buildView`), `shared/protocol.ts:54-64` (`PublicPlayer` — role/token/id 키가 타입에 없음)
**Apply to:** `buildView` 확장, `buildPreview` 신규, 모든 서버 방송 경로
객체 리터럴로 키를 하나씩 쓴다. `{ ...player }` 스프레드 금지. 역할은 `me.role` 한 곳에만. 미리보기(비인증 공개 엔드포인트)에도 같은 원칙(역할·토큰·id·`connected` 없음, 키가 정확히 `{seat, nickname}`).

### 2. 순수 코어 + 얇은 어댑터
**Source:** `shared/game/room.ts` 전체(주석 1-2: "모든 함수는 새 객체를 돌려주고 입력을 바꾸지 않는다. DOM·workerd 전용 API 를 쓰지 않는다 — 앱·워커 두 tsconfig 에 모두 들어감"), `worker/room.ts` 가 호출만 함
**Apply to:** `phases.ts`, `tick.ts`, `startGame`, `roomDiff.ts`, `cardFace.ts`, `linkReducer.ts`, `countdown.ts`
규칙은 `shared/` 또는 `src/net/` 의 순수 함수, DO·훅·컴포넌트는 부르기만. 시간(`now`)·난수(`randInt`)는 인자로 받는다(roles.ts 3행 주석, clock.ts 25행).

### 3. 입력 검증 경계
**Source:** `shared/schemas.ts:5-16` (zod, 서버 전용) + `worker/room.ts:91-108` (프레임 크기 → JSON.parse → `safeParse`), `worker/index.ts:27-42` (HTTP 본문)
**Apply to:** 새 HTTP 라우트(`join`), 새 WS 메시지 처리기
```typescript
if (typeof message !== "string" || new TextEncoder().encode(message).byteLength > MAX_FRAME_BYTES) { ws.close(1009, "too_large"); return; }
let parsed: unknown; try { parsed = JSON.parse(message); } catch { this.sendTo(ws, { t: "error", code: "BAD_MESSAGE" }); return; }
const result = ClientMessageSchema.safeParse(parsed);
```
zod 는 `shared/schemas.ts` 에만 import — `src/` 가 import 하면 번들에 들어간다(schemas.ts 1-2행). 클라이언트는 `shared/protocol.ts` 의 **타입만** import.

### 4. 오류 응답·에러 코드 닫힌 집합
**Source:** `worker/index.ts:11-23` (`json`, `apiError`), `shared/protocol.ts:36-44` (`ApiErrorCode`), `src/net/api.ts:5-26`
**Apply to:** 서버 라우트, `api.ts`, `copy.ts`
서버는 `{ error: ApiErrorCode }` + `cache-control: no-store`; 클라이언트는 알 수 없는 응답이면 `"NETWORK"` 로 접는다.

### 5. 연결·소켓 수명주기 (하이버네이션)
**Source:** `worker/room.ts:78-88` (`ctx.acceptWebSocket`, `ws.accept()` 금지), `149-182` (`handleHello`, `connId`, REPLACED 4001), `184-191` (`handleDisconnect`), `37-55` (생성자에서 `connected` 재계산)
**Apply to:** 모든 새 DO 처리기. 변경 → `storage.put` → `broadcast` 순서(193행 주석), 알람은 생성자에서 설정하지 않음.

### 6. 접근성·역할 비노출 공통 규칙
**Source:** UI "접근성·상호작용 규칙", RS Pitfall 20
**Apply to:** 모든 화면·부품
44px 누르기 영역, `:focus-visible` 링 `--gray-100`, 아이콘 버튼 `aria-label`, 오류 `role="alert"`+`aria-describedby`+`aria-invalid`, 토스트 `role="status"`, 단계 안내 `aria-live="polite"` 영역 하나. 역할을 보기 전 화면(S-04, 카드 뒷면, [내 역할] 버튼, S-06)은 역할과 무관하게 같은 마크업.

### 7. 스타일 규칙
**Source:** UI "스타일 규칙", `src/styles/tokens.css`(생성 파일), `src/styles/base.css`
**Apply to:** 모든 CSS
색·간격·크기·모션 값은 `var(--…)` 만, 화면 CSS 에 hex 금지. 글자 14/16/24/36 · 굵기 400/700. 애니메이션은 `transform`·`opacity`(인물 상태 `filter` 예외). 진홍 사용처는 UI "진홍 예약" 5곳뿐. `tokens.css` 는 직접 고치지 않고 `design/tokens.json` → `npm run tokens`. `--gray-500` 은 글자 색 금지.

### 8. 테스트 구조
**Source:** `vitest.config.ts` (3 프로젝트: `unit` node `test/unit/**/*.test.ts`, `client` happy-dom `test/client/**/*.test.{ts,tsx}`, `worker` `test/worker/**/*.test.ts`)
**Apply to:** 모든 새 테스트 — 순수 로직 → `test/unit/`, 부품·화면 → `test/client/`(`@testing-library/react`, `afterEach(cleanup)`, `vi.stubGlobal("fetch", …)`/`vi.unstubAllGlobals()` 패턴은 `screens.test.tsx:7-12`), DO·라우트 → `test/worker/`(`cloudflare:workers` 의 `env`, `exports`). `passWithNoTests` 는 의도적으로 꺼져 있다. `node:fs` import 금지(`@types/node` 미선언) — 파일 존재 검사는 `import.meta.glob`.

---

## No Analog Found

| File | Role | Data Flow | Reason / 대신 쓸 것 |
|---|---|---|---|
| `src/net/session.ts` | utility | CRUD(localStorage) | 클라이언트 저장소 모듈이 아직 없음. RS Pattern 12·Pitfall 22(단일 슬롯 규칙, 낡은 세션은 미리보기로 먼저 확인). 형태는 `api.ts` 의 결과 타입 스타일 |
| `public/_headers` | config | — | 정적 에셋 캐시 헤더 파일 없음. RS Pitfall 15·26 |
| `public/og.png` | asset | — | 임시 1200×630 이미지 없음. RS Pitfall 11, Open Question 8 |
| `Sheet.tsx` 끌어서 닫기 제스처 | component | event-driven | DS 에 없음. RS Pattern 9 의 포인터 이벤트 단순형(`setPointerCapture`, `dy > 96px` 또는 속도 > 0.5px/ms) |
| `MyRoleSheet.tsx`, `ShareSheet.tsx`, `Toast.tsx` | component | event-driven | 디자인 시스템 아티팩트에 아직 없음(UI R18). UI C-01 / C-03 / Toast 절이 정본 |
| `Icon` 의 `card`, `copy`, `back` | component | render | DS `ICONS` 에 해당 경로 없음 — 같은 규격으로 새로 그린다 |
| `useSeatTransitions` (등장/퇴장 지연 표시) | hook | event-driven | 앱에 유사 훅 없음. RS Pattern 11 마지막 단락 |

## 계획자가 알아야 할 불일치·주의 (기존 코드 기준)

1. **`shared/game/room.ts:36-42` 의 임시 `normalizeNickname`** 은 `shared/nickname.ts` 의 `validateNickname`/`normalizeNickname` 로 교체 대상(주석 35행). 두 모듈에 같은 이름의 `normalizeNickname` 이 있다 — import 이름 충돌 주의.
2. **`phases.ts`, `tick.ts` 가 아직 없다.** RS 구조도에는 있으나 `git ls-files shared/game` 결과는 `room.ts`, `roles.ts`, `view.ts` 뿐. `view.ts:27` 의 `phaseDurationMs: null` 이 01-07 대기 중.
3. **`RoomPreview.players` 와 `MyInfo.role/allies` 는 아직 없다** (`protocol.ts:28-35`, `60-64`).
4. **`src/screens/` 에는 Home, Lobby, RoomScreen 3개뿐**, `src/components/` 디렉터리 자체가 없다. 모든 부품은 신규.
5. **`screens.css` 의 `.btn-primary`/`.field-input:focus-visible`/`.lobby-host`** 가 진홍을 쓰고 있다(UI "진홍을 쓰지 않는 곳: 버튼 면, 포커스 링, 방장 배지"). 부품 교체 때 같이 삭제하지 않으면 두 스타일이 공존한다.
6. **`useRoomConnection.test.tsx`** 는 `view.serverNow = Date.now() + 5000` 으로 `offset > 4000` 을 단언한다(한 점 오프셋 모델). 표본 기반 `estimateOffset` 으로 바꾸면 이 테스트를 새 모델에 맞춰 고쳐야 한다.
7. **DS `ReconnectBanner` 는 이미 흐름 안 flex (`height: 32px`, 위치 지정 없음)** 이다. RS 는 "32px absolute → 52px 흐름 안"이라 적었으나 실제 bundle.css:80 은 `position` 이 없다 — 이식할 때 높이·면·문구만 고치면 된다.
8. **DS `TextField` 는 비제어 (`defaultValue`)**, 앱은 제어 입력이 필요하다 (버튼 활성 판단, 마지막 닉네임 미리 채움).

## Metadata

**Analog search scope:** `shared/`, `worker/`, `src/`, `test/`, `scripts/`, `public/`, `design/design-system/components/`, `.planning/phases/01-walking-skeleton/`
**Files scanned:** 약 45 (전부 `git ls-files` 추적 확인; `design/design-system/components/bundle.js` 355줄·`bundle.css` 214줄은 전체 읽음)
**Pattern extraction date:** 2026-10-23

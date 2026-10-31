# Phase 6: 월드 뼈대 - Pattern Map

**Mapped:** 2026-10-31
**Files analyzed:** 36 (신규 약 28 / 수정 약 15 중 핵심)
**Analogs found:** 31 / 36 (나머지 5는 "No Analog Found")

> 근거: CONTEXT.md 없음. 06-RESEARCH.md 의 "개정" 절(A~E)이 본문보다 우선, 06-UI-SPEC.md, 결정 0044~0055. 모든 analog 경로는 `git ls-files` 로 추적 확인된 소스다(gitignored 미러 없음).

## File Classification

| 신규/수정 파일 | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `shared/game/map.ts` | utility(순수) | transform | `shared/game/tick.ts` (순수 규칙 + 결정성 주석) | role-match |
| `shared/game/world.ts` | utility(순수) | transform | `shared/game/alive.ts`, `shared/game/tick.ts` | role-match |
| `shared/protocol.ts` (수정: `move`, `world`) | model(타입) | request-response | 같은 파일 `ClientMessage`/`ServerMessage` | exact |
| `shared/schemas.ts` (수정: `move` strictObject) | validation | request-response | 같은 파일 `emoji`/`pick` 줄 | exact |
| `worker/room.ts` (수정: world 저장·복원·move·snap) | service(DO) | event-driven + CRUD | 같은 파일 `handleEmoji/applyEmoji`, 생성자, `handleHello`, `broadcastEvent` | exact |
| `src/net/useRoomConnection.ts` (수정: `parseServerMessage` 에 `world`) | hook | event-driven | 같은 파일 :62, `onEvent` :300 | exact |
| `src/world/store.ts` (WorldStore, React 밖) | store | event-driven | `src/net/useRoomConnection.ts` 의 `listenersRef` Set 구독 | partial |
| `src/world/camera.ts` | utility(순수) | transform | `src/net/clock.ts`, `src/game/blankTap.ts` | role-match |
| `src/world/status.ts` (MapStatus 상태기계) | utility(순수) | event-driven | `src/net/linkReducer.ts` | exact(role) |
| `src/world/mapRenderer.ts` + `maps/bar.ts` (three, 지연 로드) | service | streaming(rAF) | `design/v2.0/screens/blockout.js` + `bar.js` + `character.js` (시안) | partial |
| `src/components/WorldStage.tsx`, `WorldCharacter.tsx`, `Nameplate.tsx`, `DestinationRing.tsx`, `WalkHint.tsx`, `MapStatusCard.tsx` | component | event-driven | `src/components/DayTable.tsx`, `ReconnectBanner.tsx`, `Toast.tsx` | role-match |
| `src/screens/Lobby.tsx` (수정: `DayTable` -> `WorldStage`) | component | request-response | 같은 파일 | exact |
| `src/net/useSeatTransitions.ts` (삭제) + `test/client/lobby.test.tsx` 등 | cleanup | - | 같은 파일 | - |
| `src/debug/perf/*` (`?perf=1`, `?chat-mock=1`) | utility(디버그) | streaming | `src/debug/sheetProbe.ts` + `sheetDebug.ts` | exact |
| `src/main.tsx` (수정: 쿼리 지연 로드 등록) | config | - | 같은 파일 `initSheetDebug` | exact |
| `scripts/deploy-target.mjs` | utility | transform | `scripts/check-account.mjs` | exact |
| `scripts/check-deploy-target.mjs` | utility(게이트) | batch | `scripts/check-account.mjs` | exact |
| `scripts/deploy-target.test.mjs` | test | - | `scripts/check-account.test.mjs` | exact |
| `scripts/e2e/lib.mjs` `resolveTarget` (수정), `scripts/smoke.mjs`, `bots.mjs`, `uat-*.mjs` | utility | request-response | `scripts/e2e/lib.mjs:165` | exact |
| `wrangler.jsonc`, `scripts/prod-url.txt`, `package.json`(deploy, three), `index.html`, `README.md` | config | - | 같은 파일 | exact |
| `test/unit/{map,world,camera,status}.test.ts` | test | - | `test/unit/tick.test.ts`, `test/unit/linkReducer.test.ts`, `test/helpers/seededRandom.ts` | exact |
| `test/worker/world.test.ts` | test | event-driven | `test/worker/alarm.test.ts` + `test/worker/helpers.ts` | exact |
| `test/client/worldStage.test.tsx` | test | - | `test/client/lobby.test.tsx`, `useRoomConnection.test.tsx` | role-match |
| `test/unit/leak.test` (확장) | test | - | 기존 leak 검사(누설 확장) | exact |
| `scripts/e2e/flows.mjs` (로비 흐름 교체) | test(E2E) | - | 같은 파일 `lobbyFlow` | exact |
| `DEFERRED-BUGS.md` WR 줄 정리 | docs | - | 파일 머리말 규칙 | - |

## Pattern Assignments

### `worker/room.ts` (service/DO, event-driven + CRUD)

**Analog:** 같은 파일. 변경 지점 4곳: 생성자 복원, `switch` 한 case, `applyMove`/`emitWorld`, `handleHello` 직후 snap.

**생성자 복원 (lines 69-97):** 현재 `storage.get<RoomState>("room")` 한 키. R6 은 `ctx.storage.get(["room","world"])` (Map) 로 한 번에 읽고, 방에 없는 플레이어·막힌 지점은 정리한다.
```typescript
ctx.blockConcurrencyWhile(async () => {
  const stored = (await ctx.storage.get<RoomState>("room")) ?? null;
  if (stored) {
    const normalized = normalizeStoredRoom(stored, Date.now());
    const live = new Set<string>();
    for (const ws of ctx.getWebSockets()) {
      const att = ws.deserializeAttachment() as SocketAttachment | null;
      if (att) live.add(att.connId);
    }
```

**메시지 진입점 (lines 159-239):** 레이트 제한 -> JSON.parse -> `ClientMessageSchema.safeParse` -> `advance(Date.now())` -> `switch (msg.t)`. `move` case 를 더하면 `default: const unhandled: never = msg` 가 누락을 컴파일 오류로 잡는다(Pitfall 15). 
```typescript
case "emoji":
  await this.handleEmoji(ws, msg.icon);
  return;
...
default: {
  const unhandled: never = msg;
  void unhandled;
  return;
}
```

**handle/apply 분리 + 신원은 소켓 첨부만 (lines 366-388):** `handleMove`/`applyMove` 가 따를 모양. 거절은 `sendRejection` 이 아니라 조용히 버린다(UI-SPEC). 순서는 "프레임 먼저, 그다음 `markWorldDirty()`".
```typescript
private async handleEmoji(ws: WebSocket, icon: EmojiId): Promise<void> {
  const att = this.attachmentOf(ws);
  if (!att || !this.room) { this.sendTo(ws, { t: "error", code: "BAD_MESSAGE" }); return; }
  const error = await this.applyEmoji(att.playerId, icon);
  if (error !== null) this.sendTo(ws, { t: "error", code: error });
}
```
move 는 `att` 없으면 그냥 return(오류 프레임 없이), `this.room.phase !== "lobby"` 도 조용히 버림, 150ms 간격 초과도 버림.

**hello 순서 (lines 725-730):** `serializeAttachment` -> `attachConnection` -> `persistAndBroadcast()`(= 모든 소켓에 `state`). snap 은 이 뒤에 **그 소켓에게만** `sendTo(ws, {t:"world",k:"snap",...})` (로비일 때만). 클라 epoch 는 첫 `state` 에서 오르므로 `state -> snap` 순서 필수(WR-03).

**전송 헬퍼 (lines 777-804):** `emitWorld` 는 `broadcastEvent` 를 재사용하지 말고(RESEARCH R6) 같은 소켓 순회 모양을 복사한다.
```typescript
private broadcastEventTo(msg: ServerMessage, ids: ReadonlySet<string>): void {
  const room = this.room;
  if (!room) return;
  for (const ws of this.ctx.getWebSockets()) {
    const att = ws.deserializeAttachment() as SocketAttachment | null;
    if (!att || !ids.has(att.playerId) || !room.players.some((p) => p.id === att.playerId)) continue;
    this.sendTo(ws, msg);
  }
}
```
`emitWorld(kind,payload)` = 이 모양 + `phase === "lobby"` 가드 + audience 자리(7~9페이즈 확장점). 저장 모양: `persistAndBroadcast`(:744) 는 `room` 키 전용이므로 `world` 는 별도 `flushWorld()`(디바운스 `setTimeout` 1.5~2초, 즉시 플러시: `advance` 단계 전환, 마지막 소켓 `webSocketClose`, `handleLeave`/`handleKick`, 알람). `handleLeave`/`handleKick`/`join`/`handleTestBots`/`handleTestReset` 4~5곳에서 spawn/despawn (R6 표).

---

### `shared/protocol.ts` + `shared/schemas.ts` (타입/검증)

**Analog:** 같은 파일들.

protocol.ts: `ClientMessage` 유니온(line 222~)에 `| { t: "move"; x: number; z: number }`, `ServerMessage`(line 295~)에 `| { t: "world"; k: "move"|"snap"; ... }`. 규칙: 값 import 금지(타입만).

schemas.ts (lines 27-34 형태):
```typescript
z.strictObject({ t: z.literal("emoji"), icon: z.enum(EMOJI_IDS) }),
z.strictObject({ t: z.literal("pick"), target: z.number().int().min(0).max(7) }),
```
->
`z.strictObject({ t: z.literal("move"), x: z.number().int().min(...), z: z.number().int().min(...) })` (좌표는 1/100 월드 단위 정수, 범위는 map.ts 상수에서 파생).

---

### `shared/game/map.ts`, `shared/game/world.ts` (순수 모듈)

**Analog:** `shared/game/tick.ts` / `alive.ts` 스타일. 규약: 파일 머리 주석에 "현재 시각을 스스로 읽지 않는다 / 난수는 인자로"를 적고, DOM·workerd API 를 쓰지 않으며 `import type { ... } from "../protocol"` 만 쓴다.
```typescript
// 순수 단계 진행. 시각은 인자 now(호출자인 방 Durable Object 의 서버 시각) 하나뿐이다 —
// 이 파일은 현재 시각을 스스로 읽지 않고, 클라이언트가 보낸 값도 받지 않는다.
import type { PhaseId } from "../protocol";
```
`positionAt(seg, t)` 도 t 를 인자로 받는다. `Math.hypot`/삼각함수 금지, `Math.sqrt` 와 사칙연산만(R4 -4). 맵 데이터는 **재즈 바 기준**(개정 D): 14x14 방, 무대 원기둥 반지름 1.18, 서는 자리 8개 반지름 2.4, 바 카운터 `box(1.0,1.05,6.2)@(-5.7,-2.2)`, 스툴 x=-4.8, 피아노 (-4.6,-5.0) 회전 0.6, 탁자 5개(반지름 0.5)+의자. 좌표 원천은 `design/v2.0/screens/bar.js`(추적됨). 응접실 좌표(R4 -272)는 무효다. 마스크 속성 테스트는 R4 -273 목록 그대로.

---

### `src/net/useRoomConnection.ts` (hook, 수정)

**Analog:** 같은 파일.

화이트리스트 (line 62) — `world` 를 안 더하면 조용히 버려진다:
```typescript
if (v && (v.t === "state" || v.t === "pong" || v.t === "error" || v.t === "emoji" || v.t === "chat")) return v as ServerMessage;
```
`RoomEvent` (line 12) 는 `Extract<ServerMessage, { t: "emoji" | "error" | "chat" }>` — `"world"` 를 유니온에 더하면 기존 `listenersRef` 디스패치(line 203)와 `onEvent`(line 300)로 WorldStore 가 구독한다(새 채널 불필요). snap 은 새 연결의 첫 `state` 이후 적용·통째 교체, 종료 상태에서는 새 연결을 열지 않는 회귀 테스트(R5 -3 a~d).

---

### `src/world/status.ts` (순수 상태기계)

**Analog:** `src/net/linkReducer.ts` (reducer + `test/unit/linkReducer.test.ts`). `MapStatus`: loading -> ready <-> lost -> (restored | recreate) -> ready | failed | unsupported. 타이머(3초 재생성, 5초 실패)는 시각을 인자로 받는 순수 함수로 두고, 효과는 컴포넌트에서. 주입식 시각 규약은 `src/net/clock.ts`/`countdown.ts` 를 따른다.

---

### `src/world/mapRenderer.ts`, `maps/bar.ts`, 3D 캐릭터 (three 구현, 지연 로드)

**Analog (시안, 이식 원천):** `design/v2.0/screens/blockout.js`(최신) + `design/v2.0/screens/bar.js` + `design/v2.0/screens/character.js`. 
머리 위 DOM 투영 (blockout.js:219-220):
```javascript
scr.set(c.pos.x, top, c.pos.z).project(camera);
c.sx = (scr.x + 1) / 2 * W; c.sy = (1 - scr.y) / 2 * H;
```
걷기/yaw (blockout.js:207-212): `Math.atan2` 를 쓰므로 **렌더 쪽(클라이언트 전용)** 에서만 허용, `shared/` 에서는 금지. 이식 시 지킬 것: ES 모듈 `three@0.186.1`, 전역 `THREE` 제거, `Clock` 대신 rAF `time`, `PCFSoftShadowMap` 제거, 정적 그림자 `shadowMap.autoUpdate=false`, 관절 단위 버텍스 컬러 병합(1인당 약 6 call), draw call <= 120, 동적 광원 <= 3 + 반구광, 캐릭터 그림자는 발밑 원판. `LIGHT_TUNE` 한 객체로 조명 상수 모으기. 컨텍스트 소실은 R3 상태기계, 복구 첫 프레임에 `positionAt` 위치로 즉시 배치.
탭 판정: `Raycaster.setFromCamera` + `ray.intersectPlane`(y=0) — 화면설계서 보드 방식.

---

### `src/components/WorldStage.tsx` 외 DOM 층 컴포넌트 (component)

**Analog:** `src/components/DayTable.tsx`(장면 상자 + 좌석 DOM), `ReconnectBanner.tsx`(위에 얹는 띠, 흐름을 밀지 않음), `Toast.tsx`. 규약: 닉네임은 React 텍스트·`title` 로만(Lobby.tsx 주석), 위치는 React 상태가 아니라 ref + 직접 `style.transform` 쓰기(Anti-Pattern), 장치 픽셀 반올림 `Math.round(x*dpr)/dpr`, 스타일은 `src/styles/*.css` 를 컴포넌트가 import(Lobby.tsx 의 `import "../styles/lobby.css"` 방식), 토큰은 `tokens.css`(`npm run tokens` 생성) 만 사용. 글자는 모두 DOM, 입력 면 `div` 가 pointer 를 받고 캐릭터는 `pointer-events:none`.

**Lobby.tsx imports (lines 1-17):** `Backdrop`, `Button`, `ConfirmSheet`, `ShareSheet`, `Toast/useToast`, `diffRoomViews/toastForDiff`, 상대경로(`../../shared/...`, `../components/...`) — 별칭 없음. `send` 가 boolean 반환(WR-01): `send({t:"leave"}) === false` 면 토스트.
Lobby 교체 시 유지: 방 코드 바, 하단 시트, 공유/나가기/시작 로직. `DayTable`+`useSeatTransitions` 만 `WorldStage` 로 교체, `DayTable`/`Figure` 컴포넌트 자체는 낮·밤·투표가 쓰므로 삭제 금지.

---

### `src/debug/perf/*`, `src/main.tsx` (쿼리 지연 로드)

**Analog:** `src/debug/sheetProbe.ts` + `src/main.tsx`.
```typescript
// main.tsx
import { initSheetDebug } from "./debug/sheetProbe";
void initSheetDebug();
```
sheetProbe.ts 머리 주석: "운영 번들에 들어가는 몫은 플래그 판정과 등록 자리뿐이고 측정 코드는 두지 않는다. 본체는 동적 import 한 곳". `?perf=1`·`?chat-mock=1` 도 같은 2파일 구조(`perfProbe.ts` 가벼운 판정 + `perf/` 본체). 테스트는 `test/client/sheetDebug.test.tsx` 방식. `window.__mfWorld.debug.loseContext()` 는 `?e2e=1`/개발 빌드에서만 노출.

---

### `scripts/deploy-target.mjs`, `check-deploy-target.mjs` + test (게이트)

**Analog:** `scripts/check-account.mjs` + `scripts/check-account.test.mjs`. 규약: Node 내장만, 판정 함수를 `export` 하고 CLI 는 `fileURLToPath` 로 직접 실행일 때만, 실패 시 종료 상태 1, 한국어 메시지, 비밀 출력 금지.
```javascript
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
export const EXPECTED_EMAIL = "dhkim1522@naver.com";
export function judgeWhoami(output, status, expected = EXPECTED_EMAIL) { ... }
```
`deploy-target.mjs`: `WORKER_NAME="minifia-v2"`, `V1_ORIGIN`, `assertNotV1`, `expectedOrigin`. 검사 대상은 빌드 산출물 `dist/worker/wrangler.json` 의 `name`(R8 -2). `package.json` 의 `deploy` (line 15):
`node scripts/check-account.mjs && vite build && wrangler deploy` -> `... && vite build && node scripts/check-deploy-target.mjs && wrangler deploy`.

**`resolveTarget` (scripts/e2e/lib.mjs:165-179)** 에 `assertNotV1(u.origin)` 추가, `--url` 명시도 거부. USAGE 문자열(:140)의 v1 주소 교체, `lib.test.mjs:93` 의 `PROD` 교체 + v1 거부 테스트. `wrangler.jsonc:3` `"name": "minifia"` -> `minifia-v2`, `scripts/prod-url.txt` 교체. 허용 목록: `index.html` og:image(UI-SPEC: og:* 불변), `docs/`, `.planning/`.

---

### `test/unit/{map,world,camera,status}.test.ts`, `test/worker/world.test.ts` (test)

**Analog 순수:** `test/unit/tick.test.ts`·`linkReducer.test.ts`, 난수는 `test/helpers/seededRandom.ts`, 시각 주입.
**Analog 워커:** `test/worker/alarm.test.ts` imports (lines 1-6) 와 `test/worker/helpers.ts` (`createRoom`, `connect`, `hello`, `nextFrame`, `send`, `seat`, `storedRoom`, `evictDurableObject`, `runInDurableObject`):
```typescript
import { env, exports } from "cloudflare:workers";
import { runDurableObjectAlarm, runInDurableObject } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { alarmOf, closed, connect, createRoom, forceDue, hello, nextFrame, seat, send, storedRoom } from "./helpers";
const phaseIs = (phase: string) => (m: ServerMessage) => m.t === "state" && m.view.phase === phase;
```
이동 -> 플러시(`runInDurableObject(stub, inst => inst["flushWorld"]())` 또는 디바운스 시간 주입) -> `evictDurableObject` -> 재접속 후 snap 위치 일치. `test/unit/e2eContract.test.ts` 는 E2E 상수와 앱 상수의 동일성 계약 — `DEFAULT_SIZES` 를 건드리면 같이 갱신.

---

## Shared Patterns

### 서버 권위 / 신원 / 조용한 거절
**Source:** `worker/room.ts` 366-374 (`attachmentOf(ws)` 의 `playerId` 만 신뢰), `case` 의 `never` 가드(232-237).
**Apply to:** `move` 처리 전부. 메시지 본문의 seat/playerId 는 읽지 않는다. 로비 밖(`phase !== "lobby"`)에서는 어떤 `world` 프레임도 보내지 않는다(누설 표면 0, 7~9페이즈 audience 확장 자리).

### 저장은 방송 전에, 단 world 는 예외
**Source:** `worker/room.ts:743-748` `persistAndBroadcast` ("변경은 항상 저장이 끝난 뒤에 방송한다").
**Apply to:** `room` 키 변경은 그대로 이 규약. `world` 는 디바운스 저장(무료 한도 10만 행/일 설계)이라 프레임 먼저 -> `markWorldDirty()`. `room` 키에 위치를 넣지 말 것.

### 연결 계층 규약 (WR-01~04 회귀 방지)
**Source:** `src/net/useRoomConnection.ts` (62, 193, 203, 210, 223), `src/net/linkReducer.ts:68` (epoch 는 첫 `state` 에서 증가).
**Apply to:** WorldStore, `world` 프레임 수신 전부. 새 연결마다 스토어 통째 교체, 종료 상태에서 재연결 금지, 첫 스냅샷의 사람은 입장 연출 없음.

### 쿼리 플래그 지연 로드 디버그
**Source:** `src/main.tsx` + `src/debug/sheetProbe.ts`.
**Apply to:** `?perf=1`, `?chat-mock=1`, 월드 청크(`import()`), 일반 번들 무영향.

### 한국어 주석 / 상대 경로 import / 값 import 금지
**Source:** 저장소 전체. `shared/` 는 `protocol` 에서 타입만 import, 별칭 없이 `../../shared/...`. 새 한국어 주석은 "왜" 를 적는다.

### 대체 코드와 그 테스트는 같은 페이즈에서 삭제
**Source:** RESEARCH 프로젝트 제약. `useSeatTransitions`, 로비 전용 `lobby.test.tsx` 항목(`.mf-dt__seat--leave`, 좌석 퇴장 320ms), E2E `lobbyFlow`(`crownChecks`·`feltGapChecks`·`lobbyShapeChecks`·`stageStable`·`L1~L6`), `grabLobbyStage`. `skip` 금지. `leak.test` 는 지우지 말고 `world` 메시지로 확장. 별도 웨이브로 계획.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `src/world/mapRenderer.ts` (three 런타임) | service | streaming | 저장소에 three/WebGL 코드 없음. `design/v2.0/screens/*.js` 시안(r128 전역)만 있음, ES 모듈로 이식 필요 |
| `src/world/maps/bar.ts` (병합·LIGHT_TUNE) | utility | transform | 시안은 박스마다 재질을 만드는 비병합 구조, 예산 맞춰 재작성 |
| `src/world/store.ts` (WorldStore) | store | event-driven | React 밖 스토어 선례 없음. `listenersRef` Set 구독 모양만 부분 참고 |
| `shared/game/map.ts` A*/LOS | utility | transform | 경로 탐색 선례 없음. RESEARCH R4 알고리즘 명세 사용(80줄 안팎, 속성 테스트) |
| `MapStatusCard.tsx` 컨텍스트 복구 UI | component | event-driven | 복구 카드 선례 없음. `ReconnectBanner.tsx` 는 얹는 방식만 참고. UI-SPEC 문구 우선 |

## 플래너 참고 (충돌·주의)

- 개정 D 때문에 RESEARCH 본문의 응접실 좌표·입장 지점 반지름(1.9/2.5)·`pan` 3.2·이동 영역 9x9 가정은 무효. 재즈 바 좌표(bar.js)와 `pan` 재계산(걷는 영역 반폭 6.0 -> `pan` 약 4.0, [ASSUMED])으로 대체.
- 결정 번호는 0047 예약 무효, 기록 시점에 `ls docs/decisions` 로 확인(0056 이후).
- `three@0.186.1`·`@types/three@0.186.0` 정확 고정 + 설치 전 `checkpoint:human-verify`(integrity 대조).
- `npm run deploy` 가드 변경은 첫 배포 이전 0번 작업. v1 무결성은 일회성 수동 `curl`(스크립트로 v1 검사 금지).

## Metadata

**Analog search scope:** `worker/`, `shared/`, `src/net`, `src/screens`, `src/components`, `src/debug`, `scripts/`, `test/{unit,worker,client}`, `design/v2.0/{screens,blockout}`
**Files scanned:** 약 25 (git ls-files 전수 목록 + 핵심 12개 정독)
**Pattern extraction date:** 2026-10-31

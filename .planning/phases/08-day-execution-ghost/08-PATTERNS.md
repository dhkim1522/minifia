# Phase 8: 낮 처형과 유령 - Pattern Map

**Mapped:** 2026-11-02
**Files analyzed:** 24 (신규 9 · 수정 15, 삭제 묶음 별도)
**Analogs found:** 22 / 24

모든 analog 경로는 `git ls-files` 로 추적되는 소스다(미러 경로 없음). 줄 번호는 이 세션에서 직접 읽은 기준이다. 클라이언트 쪽 일부(`Lobby`, `RoomScreen`, `runtime` 등)는 줄 번호만 grep 으로 확인했고 본문은 RESEARCH 패턴 7~9 를 따른다(아래 "미확인" 표기).

## File Classification

| 신규/수정 파일 | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `shared/game/nomination.ts` (신규) | utility(순수 규칙) | request-response | `shared/game/vote.ts` `castCandidateVote`/`tallyCandidateVote` | exact |
| `shared/game/verdict.ts` (신규) | utility(순수 규칙) | request-response | `shared/game/vote.ts` `castExecVote`/`resolveExecVote` | exact |
| `shared/game/discussion.ts` (수정: 토론 끝내기) | utility | request-response | `vote.ts` `castExecVote` (같은 값이면 입력 그대로) | role-match |
| `shared/game/movement.ts` (신규) | utility | request-response | `shared/game/audience.ts` `channelOf` (상태+id → 판정, 순수) | role-match |
| `shared/game/gather.ts` (신규) | utility | transform | `shared/game/world.ts` `planMoveSegment`/`respawnAll` | role-match |
| `shared/game/world.ts` (수정: `forceSegment`, `lay`) | utility | CRUD | 자기 자신 `requestMove`(149-167) | exact |
| `shared/game/audience.ts` (수정: mover, `worldVisibleTo`) | utility | request-response | 자기 자신 (10, 16-27, 52-65) | exact |
| `shared/game/tick.ts` + `phases.ts` (수정: 단계 표·훅) | model | event-driven | 자기 자신 (43-59) | exact |
| `shared/game/execution.ts` / `endgame.ts` (수정) | utility | transform | 자기 자신 | exact |
| `shared/game/view.ts` (수정: points·voted·verdict) | model | transform | 자기 자신 `buildDay`, `spectate`(222-240) | exact |
| `shared/game/bots.ts` / `testTools.ts` (수정) | service | event-driven | 자기 자신 `botPlanKey`(150), `discussionAct`(157) | exact |
| `shared/protocol.ts` / `shared/schemas.ts` (수정) | model | request-response | `schemas.ts` 50-53 `execVote`/`candidateVote` strictObject | exact |
| `worker/room.ts` (수정: handle/apply 3종, applyMove 게이트, emitWorld, hello snap, `syncLayout`) | service(DO) | event-driven | 자기 자신 406-454, 890-901, 977-981 | exact |
| `src/screens/GameMap.tsx` (신규) | component | pub-sub | `src/screens/Lobby.tsx` (WorldStage 소유, `stageInsets`, `exiting`) | role-match |
| `src/game/dayView.ts` (신규) | utility | transform | `src/net/roomDiff.ts` `diffRoomViews`/`toastForDiff` | role-match |
| `src/world/presence.ts` (신규) | utility | transform | `src/world/store.ts` (순수 상태) | 약함 |
| `src/components/v2/{VoteBadge,SureStamp,RoleChip,VerdictPicker}.tsx` (신규) | component | request-response | `src/components/v2/HeadStack.tsx` | exact(이식 규약) |
| `src/components/v2/{HeadStack,ChatPanel,V2Icon}.tsx` (수정) | component | event-driven | 자기 자신 | exact |
| `src/world/{runtime,character,threeRenderer,renderer,maps/bar}.ts` (수정) | component | streaming | 자기 자신 (RESEARCH 패턴 7) | exact |
| `src/screens/RoomScreen.tsx` (수정: `sceneKey`, `PHASE_ANNOUNCE`) | component | pub-sub | 자기 자신 41-56, 106, 364-379 | exact |
| `test/unit/{nomination,verdict,movement,gather,audience,tick}.test.ts` | test | — | `test/unit/vote.test.ts`, `test/unit/audience.test.ts`, `test/unit/tick.test.ts` | exact |
| `test/worker/{day,vote,leak,world}.test.ts` (개정) | test | event-driven | `test/worker/vote.test.ts` + `helpers.ts` | exact |
| `scripts/e2e/{flows,lib}.mjs` | test(E2E) | request-response | 기존 `flows.mjs` 흐름 | exact |
| 삭제 묶음(v1.0 투표 화면·테스트) | — | — | RESEARCH "삭제 지도" | — |

## Pattern Assignments

### `shared/game/nomination.ts` · `shared/game/verdict.ts` (utility, request-response)

**Analog:** `shared/game/vote.ts` — 같은 계약(검사 순서 = 계약, 같은 값이면 *같은 객체* 반환, 입력 불변, 시각·난수 없음).

**헤더·임포트·오류 타입** (vote.ts:4-9):
```typescript
import type { CandidateVoteLine, ExecTally } from "../protocol";
import { isAlive } from "./alive";
import type { RoomState } from "./room";
import type { DeadlineResult } from "./tick";

export type VoteError = "WRONG_PHASE" | "BAD_MESSAGE";
```

**캐스트 패턴 (`castPoint` 가 복사)** (vote.ts:100-130, 단 취소(null) 분기는 지운다 — UI-SPEC은 바꾸기만):
```typescript
if (state.phase !== "candidateVote") return { ok: false, error: "WRONG_PHASE" };   // -> "nomination"
const actor = state.players.find((p) => p.id === actorId);
if (!actor || !isAlive(actor)) return { ok: false, error: "BAD_MESSAGE" };
const chosen = Number.isInteger(target) ? state.players.find((p) => p.seat === target) : undefined;
if (!chosen || !isAlive(chosen)) return { ok: false, error: "BAD_MESSAGE" };
if (chosen.seat === actor.seat) return { ok: false, error: "BAD_MESSAGE" };       // 자기 자신
if (actor.candidateVote === target) return { ok: true, state };                    // -> actor.nominate
return { ok: true, state: { ...state, players: state.players.map((p) => (p.id === actorId ? { ...p, candidateVote: target } : p)) } };
```
**`castVerdict` 는 `castExecVote`(vote.ts:17-31) 를 복사**하되 행위자 검사에 "변론자(후보)가 아님"을 더한다(변론자·유령은 `BAD_MESSAGE`).

**집계 (`tallyPoints`)** (vote.ts:148-160 에서 가져옴; 셔플 루프 162-165 는 **복사하지 않는다**, `randInt` 불필요):
```typescript
const counts = new Map<number, number>();
for (const v of votes) counts.set(v.target, (counts.get(v.target) ?? 0) + 1);
const top = Math.max(0, ...counts.values());
const leaders = [...counts].filter(([, count]) => count === top && top > 0).map(([seat]) => seat);
return leaders.length === 1 ? { votes, candidate: leaders[0]! } : { votes };
```

**마감 훅 (`resolveNomination`/`resolveVerdict`)** — vote.ts:60-75 `resolveExecVote` 모양:
```typescript
const players = state.players.map((p) => { const { execVote: _execVote, ...kept } = p; return kept; });   // 개인 표 키째 제거
const next: RoomState = { ...state, players, voteLog: [...(state.voteLog ?? []), { n: state.day ?? 1, exec: { yes, no, passed } }], verdict: { passed } };
return passed ? { state: next, stay: false } : { state: next, stay: false, next: "night" };
```
차이: `resolveVerdict` 의 분모는 `E`(변론자 제외 산 사람) — `passed = yes * 2 > E` (RESEARCH 패턴 2). `resolveNomination` 은 최다 한 명이 아니면 `next: "night"` 이며 `voteLog` 줄(`exec:{yes:0,no:0,passed:false}`, `cand.votes`, `cand.candidate`)을 **항상** 만든다. 집계 직후 `verdictVote` 키 제거(익명을 "데이터가 없다"로 지킴).

**청소 (`enterDiscussion`)** — vote.ts:81-90 `enterExecVote` 를 복사하되 지우는 키만 `verdict`·`execution`·`nominate`·`verdictVote`·`endVote`로 바꾸고 `ON_ENTER.discussion` 에 건다(Pitfall 1).

### `shared/game/movement.ts` (utility, request-response)

**Analog:** `shared/game/audience.ts:38-45` `channelOf` — `(state, id/player)` 만 읽는 순수 판정, `isAlive` import, `CHAT_PHASES` 같은 `ReadonlySet<PhaseId>` 상수 사용.
```typescript
export const CHAT_PHASES: ReadonlySet<PhaseId> = new Set<PhaseId>([ "lobby", "dayAnnounce", ... ]);
export function channelOf(state: RoomState, senderId: string): ChatChannel | null {
  if (!CHAT_PHASES.has(state.phase)) return null;
  ...
  if (!isAlive(me)) return "ghost";
```
`canMove` 본문은 RESEARCH 패턴 3 의 스켈레톤 그대로. `src/` 도 import 하므로 DOM·workerd API 금지(앱·워커 두 tsconfig 에 들어감).

### `shared/game/audience.ts` (수정) — mover 기반 world

**현재** (audience.ts:10, 54):
```typescript
export type AudienceEvent = { k: "chat" | "typing" | "emote"; ch: ChatChannel } | { k: "world" };
if (ev.k === "world") return state.phase === "lobby" ? pick(() => true) : new Set();
```
**개정:** `{ k: "world"; mover?: string }`. 로비 → 전원 / MAP 단계 → mover 가 산 사람이면 전원, 유령이면 `pick((p) => !isAlive(p))` / 그 밖 → 빈 집합. `CHAT_PHASES`(16-27)는 줄마다 하나라 diff 가 작다: `execVote`·`candidateVote`·`candidateVoteReveal` 행 삭제, `nomination`·`verdict` 행 추가. 새 `worldVisibleTo(state, viewerId)` 는 hello snap 용(산 viewer → 산 사람만, 유령 viewer → 전원).

### `shared/game/tick.ts` + `phases.ts` (수정)

**Analog:** 자기 자신. 표만 바꾼다(tick.ts:43-59):
```typescript
const ON_ENTER = { dayAnnounce: enterDayAnnounce, execVote: enterExecVote, candidateVoteReveal: enterCandidateVoteReveal, execution: enterExecution, night: enterNight, morning: enterMorning, ended: enterEnded };
const ON_DEADLINE = { execVote: resolveExecVote, candidateVoteReveal: routeAfterCandidateVote, execution: routeAfterExecution, morning: routeAfterMorning };
```
→ RESEARCH "마감 훅과 분기" 스켈레톤. 주의: 두 훅 타입(`(s, randInt, at)`, `(s) => DeadlineResult`)과 `tick` 루프(66-98)는 건드리지 않는다. `phaseDurationOf`(discussion.ts)는 후보 공개 길이 분기를 지우고 `PHASE_DEFS` 길이만 쓰게 단순화. 상수는 phases.ts:21-30 의 `DISCUSSION_MS`(90_000)·`NOMINATION_MS`(15_000)·`DEFENSE_MS`(20_000)·`VERDICT_MS`(10_000)·`EXECUTION_MS`(5_000)·`NIGHT_MS`(30_000).

### `shared/schemas.ts` + `shared/protocol.ts` (model, request-response)

**Analog:** schemas.ts:48-53 — 삭제할 `execVote`·`candidateVote` 행 자리에 같은 모양으로 3종:
```typescript
z.strictObject({ t: z.literal("pick"), target: z.number().int().min(0).max(7) }),
z.strictObject({ t: z.literal("execVote"), agree: z.boolean() }),   // -> verdict: agree
z.strictObject({ t: z.literal("candidateVote"), target: ... }),      // -> point: target (nullable 아님)
// + z.strictObject({ t: z.literal("endDiscussion"), on: z.boolean() })
```
`ClientMessage` 타입에도 같이 넣어야 `satisfies z.ZodType<ClientMessage>`(66행)가 통과한다. 덧붙은 키(seat·id)는 strict 가 거부(신원 위조 차단). `testBotVote`(61행) 의미는 Open Question 4 에 따라 재정의.

### `worker/room.ts` (service/DO, event-driven)

**핸들러·apply 쌍 (신규 3종이 복사)** — room.ts:406-427 (찬반 verdict 는 이것, 단 방송 규율은 아래 별도):
```typescript
private async handleExecVote(ws: WebSocket, agree: boolean): Promise<void> {
  const att = this.attachmentOf(ws);
  if (!att || !this.room) { this.sendTo(ws, { t: "error", code: "BAD_MESSAGE" }); return; }
  const error = await this.applyExecVote(att.playerId, agree);
  if (error !== null) this.sendRejection(ws, att.playerId, error);
}
private async applyExecVote(playerId: string, agree: boolean): Promise<WsErrorCode | null> {
  if (!this.room) return "BAD_MESSAGE";
  const result = castExecVote(this.room, playerId, agree);
  if (!result.ok) return result.error;
  if (result.state === this.room) return null;     // 같은 객체 = 저장·전송 없음
  this.room = result.state;
  await this.persistAndBroadcast();
  return null;
}
```
- `applyPoint`: 위와 동일(지목은 공개 정보라 전원 방송).
- `applyVerdict`: **처음 던질 때만** 위처럼 `persistAndBroadcast`, **이미 던진 사람의 값 변경**은 room.ts:445-454 `applyCandidateVote` 방식 — `await this.ctx.storage.put("room", this.room); this.sendViewTo([playerId]);` (타이밍 누설 방지, 패턴 6).
- `applyEndDiscussion`: 과반이면 `{ ...state, phaseEndsAt: now }` 후 `tick(…, now, cryptoRandInt)` → `persistAndBroadcast` + `reschedule` (RESEARCH "토론 끝내기 조기 종료"). 개수 변화 때만 방송.
- 봇은 같은 `apply*` 를 봇 id 로 호출한다(room.ts:481-484 `runDueBots` 안 `applyExecVote(step.botId, …)` 선례) — 특권 경로 금지.

**이동 게이트** — room.ts:890-901 에서 한 줄만 바꾼다:
```typescript
if (!room || room.phase !== "lobby") return;     // -> const me = ...; if (!me || !canMove(room, me)) return;
...
this.emitWorld(moveFrame(me.seat, result.seg));   // -> this.emitWorld(moveFrame(...), playerId)
```
`emitWorld`(977-981)는 `audience(room, { k: "world", mover: moverId })` 로. `handleHello`(727 `if (this.room.phase === "lobby") this.sendTo(ws, snapFrame(...))`)는 지도 단계로 넓히고 `players` 인자를 `worldVisibleTo` 로 거른 목록으로 넘긴다. 서버 주도 이동(`syncLayout`)은 `planMoveSegment`(world.ts:131) + 신규 `forceSegment`(150ms 간격·`lastMoveAt` 무시)를 쓴다. `advance()`/알람/`testSkip` 뒤에 부른다. `ws.send` 는 `sendTo` 안에서만 — `chatStaticGuard.test.ts` 정적 가드를 깨지 않는다.

**정규화:** 옛 세 단계 방은 `normalizeStoredRoom`(room.ts:315-335 근방, 07-08 `claim` 정규화 선례)에서 `discussion` 으로 옮기고 옛 Player 키·`verdict`·`execution` 제거.

### `shared/game/world.ts` (수정: `forceSegment`)

**Analog:** world.ts:149-167 `requestMove` — 간격 검사(158-159)를 뺀 형제 함수:
```typescript
const seg = planMoveSegment(cur, dest, now, map);
return { ok: true, world: { segs: { ...w.segs, [playerId]: seg }, lastMoveAt: { ...w.lastMoveAt, [playerId]: now }, wanderAt: w.wanderAt }, seg };
```
`forceSegment` 는 `lastMoveAt` 을 건드리지 않는다(Pitfall 5). `STAGE_SPOT` 예외(사용자 결정: 무대 위 서기)는 `lineWalkable`/`parseStoredSegment`(약 217행)/`snapToWalkable` 이 **하나의 함수**를 공유하게 한다(Pitfall 6). `StoredWorld`(177-180)에 선택 키 `lay?: string` 만 추가, 모르는 모양은 무시.

### `shared/game/view.ts` (수정)

**Analog:** 자기 자신 `buildDay` 와 `spectate`(222-240). 지목은 `day.points`(공개), 투표 마친 좌석은 `day.voted`(값 없음), `me.verdictVote` 는 본인·산 사람·verdict 단계만, 찬반 수는 `execution` 단계에서만 `day.verdict`. `spectate` 는 그대로 재사용(GHOST-02). `execTally`·`voteAgree`·`voteTarget` 삭제.

### `shared/game/bots.ts` / `testTools.ts` (수정)

**Analog:** bots.ts:150 `botPlanKey(state)`, 157 `discussionAct(randInt)`, 168-170 `add(first, discussionAct(…))`. 계획 단계 목록을 `discussion·nomination·defense·verdict·night` 로 바꾸고 `BotAct` 유니온과 `actAsBot` 의 `never` 검사에 3종 추가. `skipPhase` 의 `botsVoteNow` 도 새 단계로(Pitfall 10).

### `src/components/v2/{VoteBadge,SureStamp,RoleChip,VerdictPicker}.tsx` (component)

**Analog:** `src/components/v2/HeadStack.tsx` — 이식 규약. 승인 부품(`design/v2.0/design-system/components/bundle.js`)과 같은 마크업·클래스(`mv-badge`·`mv-stamp`·`mv-rolechip`·`mv-verdict`)를 React 19 로 옮긴다. 런타임에 `bundle.js` 를 불러오지 않는다.

**임포트·헤더** (HeadStack.tsx:1-8):
```tsx
import "../../styles/v2.css";
import { CHAT_TEXT } from "../../game/chatText";
// … design/v2.0/design-system/components/bundle.js :81·:98 을 React 19 로 옮겼다. 같은 마크업·클래스 이름을 쓴다.
```
**렌더 패턴** (HeadStack.tsx:47-61): 조건부 칸은 `{typing ? (<span …/>) : null}`, 상태는 `data-*` 속성(`data-typing={typing ? "true" : undefined}`)으로 노출. 닉네임은 React 텍스트 노드로만 그린다(innerHTML 없음, T-06-26), 말줄임 없음. `HeadStack` 확장(`role`·`count`·`lead`·`sure`·`mine`·`done`·`blink`)은 같은 `["mv-tag", cond && "is-x"].filter(Boolean).join(" ")` 클래스 조립(NameTag 29행) 을 따른다. 위치·z 는 런타임이 매 프레임 쓰고 React 는 내용만.

### `src/game/dayView.ts` (utility, transform)

**Analog:** `src/net/roomDiff.ts` `diffRoomViews`/`toastForDiff` (`Lobby.tsx:17, 68-70` 에서 호출). 연속 두 `view` 의 `day.points` 차이에서 이벤트를 만들고, 이전 view 없음·epoch 변경이면 이벤트 없이 정상 상태만(재접속 첫 스냅샷). 본문 미확인 — 구현 전 roomDiff.ts 를 읽을 것.

### `src/screens/GameMap.tsx` (component, pub-sub)

**Analog:** `src/screens/Lobby.tsx` — `WorldStage` 소유, `stageInsets`(142), `exiting`(46, 56, 196), `diffRoomViews`(68). `ResizeObserver` 로 헤더/패널 측정 → `stageInsets`, `useKeyboardLift`·`useChatLogHeight`·`TopToast` 배선은 복사하지 말고 `useMapInsets` 훅으로 추출해 두 화면이 쓰게 한다(RESEARCH 패턴 7). `RoomScreen`(41-56 `PHASE_ANNOUNCE`, 106 `sceneKey`, 364-379 `renderPhase`)에서 `dayAnnounce…morning` 을 한 `sceneKey` 로 묶어 한 마운트 유지. 지속 시간은 `useCountdown`(`src/net/countdown.ts`), 낙관적 내 선택은 `useViewChoice`.

### 테스트

**Analog (순수):** `test/unit/vote.test.ts:1-30` — 헤더 주석에 요구사항 ID 기재, `createRoomState/joinRoom/startGame/attachConnection` 로 방 구성, `tick`, `seededRandInt`(`test/helpers/seededRandom`), 상태 헬퍼 `stateWithVerdict`(`test/helpers/voteState`). 새 `nomination/verdict` 테스트는 이 구성을 복사. `skip` 금지.
**Analog (워커):** `test/worker/vote.test.ts:1-50` — `seat`, `send`, `advanceTo`, `forceDue`, `closeNow`(알람 1회), `castAndSettleAll`(전 소켓 프레임 수집), `storedRoom`; 누설 검사는 `hasPersonalVote` 같은 저장소 직접 검사 + 프레임 `summary()` 문자열 비교. 유령 누설 테스트는 `leak.test.ts`·`chatLeak.test.ts` 형식(산 사람 소켓이 유령의 `world` 프레임을 받지 않음)을 따른다.

## Shared Patterns

### 순수 규칙 계약
**Source:** `shared/game/vote.ts:11-16`. **Apply to:** 모든 신규 `shared/game/*.ts`. 검사 순서(단계 → 행위자 → 값 → 같은 값이면 입력 그대로 ok), 시각·난수 금지, 입력 불변. DO 가 `result.state === this.room` 으로 저장·전송을 건너뛴다.

### 받는 사람 한 길
**Source:** `shared/game/audience.ts:52-65` + `worker/room.ts:977-981`. **Apply to:** world·chat·typing 프레임 전부. `deliver(audience(room, ev), frame)` 만 쓴다. 화면에서 거르지 않는다(결정 0002·0021).

### 개인 값의 키째 제거 (익명)
**Source:** `vote.ts:64-67`. **Apply to:** `verdictVote`·`nominate`·`endVote`.
```typescript
const players = state.players.map((p) => { const { execVote: _execVote, ...kept } = p; return kept; });
```

### 오류 응답
**Source:** `worker/room.ts:406-414`. 규칙 오류는 `sendRejection`, 이동 거절은 **조용히 버림**(오류 프레임 없음).

### 이름표 DOM 층 / 텍스트 안전
**Source:** `HeadStack.tsx:11-12`. React 텍스트 노드만, 위치는 런타임.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `shared/game/gather.ts` 의 `ringSlots`/`layoutFor` | utility | transform | 모이기 레이아웃은 신규 개념. RESEARCH 패턴 4 의 고정소수점 8곳 + N=2..8 상수 표 사용. 경로 생성만 `planMoveSegment`(world.ts:131) 재사용 |
| `src/world/character.ts` 유령 재질 복제·`holdPose("point")` | component | streaming | 공유 `bodyMaterial`(character.ts:712) 때문에 선례 없음. 블록아웃 `design/v2.0/screens/blockout.js:240-247` `setGhost` 참고(불투명도는 UI-SPEC 0.6) |

## 삭제 지도 메모 (RESEARCH 와의 충돌은 이미 해소됨)

UI-SPEC 삭제 목록 중 `PhaseBar`·`Timer`(`RoleReveal` 소비), `Backdrop`·`scenes.ts`(행만 정리), `src/net/recordsSeen.ts`(`RoomScreen.tsx:17` 소비), `src/game/verdict.ts` 일부(`ResultScreen`·`NightPanel` 소비)는 **유지**한다. 나머지는 RESEARCH "삭제 지도" 표 그대로. 삭제 직전에 `grep -rl "execVote\|candidateVote" shared worker src scripts test` 로 재확인.

## Metadata

**Analog search scope:** `shared/game/`, `shared/`, `worker/`, `src/components/v2/`, `src/screens/`, `test/unit/`, `test/worker/`
**Files scanned:** 약 20 (본문 읽음: vote.ts, tick.ts, audience.ts, schemas.ts, room.ts 일부, world.ts 일부, HeadStack.tsx, vote 테스트 2종 머리)
**Pattern extraction date:** 2026-11-02

# Phase 4: 처형과 승패 - Pattern Map

**Mapped:** 2026-10-26
**범위:** 서버 + `shared/` 로직 + 테스트·스크립트 (화면 제외, D-26)
**Files analyzed:** 22 (신규 8 / 수정 14)
**Analogs found:** 22 / 22 (모든 분석 경로는 `git ls-files` 추적 소스. 미러 경로 없음)

## 공통 컨벤션 (모든 파일에 적용)

- **파일 머리 주석은 한국어**로, "순수 모듈이다 — 현재 시각·전역 난수를 읽지 않고 입력 상태는 바꾸지 않는다. 난수는 인자 `randInt` 로만 받는다" 를 적는다 (`night.ts:1-2`, `chat.ts:1-2`, `bots.ts:1-2`).
- 결정 번호·요구사항 ID·D-번호를 주석에 인용한다 (`(D-13)`, `(결정 0020)`, `(NIGHT-05)`).
- **난수 호출 순서는 계약**이다: 주석 + 시드 테스트로 고정하고 `randInt(0)` 은 절대 부르지 않는다 (`night.ts:75`, `bots.ts:13`).
- 상태 전이는 모두 새 객체 반환(스프레드), 변화가 없으면 **입력 객체 그대로** 반환 (`night.ts:34`, `tick.ts:46`).
- 서버 전용 필드는 키째 지운다: `const { nightPick: _nightPick, ...kept } = p;` (`night.ts:42-44`).
- 오류는 문자열 유니온 (`NightError = "WRONG_PHASE" | "BAD_MESSAGE"`), 반환형은 `{ ok: true; state } | { ok: false; error }`.
- 뷰는 **허용 목록 리터럴**만, 조건을 채울 때만 키를 만든다 (`view.ts:98-143`). 직업 키 이름은 `role` 이 아니라 `job`.
- **TDD RED 커밋**: `test(04-NN): ... (RED)` 로 실패하는 테스트를 먼저 커밋, 다음 `feat(04-NN): ...` 로 GREEN. 근거: `git log` 의 `test(03-12): ...`, `test(unr): ... (RED)`, `test(03-11)` → `feat(03-11)` 쌍. 서버 웨이브라도 규칙(단위) → 누출 → 소켓(워커) 순서.
- 결정 기록은 `docs/decisions/0036-*.md` (다음 번호). `HANDOFF.md` 는 6KB 이하 (`test/unit/handoff.test.ts`).

## File Classification

| 신규/수정 파일 | 구분 | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|---|
| `shared/game/vote.ts` | 신규 | service(순수 규칙) | request-response + batch(집계) | `shared/game/night.ts` (`pickTarget`, `resolveNight`) | exact |
| `shared/game/win.ts` | 신규 | utility(판정) | transform | `shared/game/night.ts` `resolveNight` 의 role 읽기 + `alive.ts` | role-match |
| `shared/game/execution.ts` | 신규 | service(진입·마감 훅) | event-driven | `night.ts` `enterNight`/`enterMorning` + `claim.ts` `resolveClaimTurn` | exact |
| `shared/game/phases.ts` | 수정 | config | — | 자기 자신 (행 추가) | exact |
| `shared/game/tick.ts` | 수정 | service | event-driven | 자기 자신 (`ON_ENTER`/`ON_DEADLINE`) | exact |
| `shared/game/chat.ts` | 수정 | service | request-response | 자기 자신 (`QUICK_TEMPLATES`, `senderOf`, `say`) | exact |
| `shared/game/view.ts` | 수정 | utility(마스킹) | transform | 자기 자신 (`buildDay`, `buildView`) | exact |
| `shared/game/night.ts` | 수정 | service | transform | 자기 자신 (`ResolvedNight` 에 `target`) | exact |
| `shared/game/bots.ts` | 수정 | service(계획) | event-driven | 자기 자신 (`botNightTarget`, `planFor`) | exact |
| `shared/game/testTools.ts` | 수정 | utility | request-response | 자기 자신 (`botsPickNow`, `skipPhase`) | exact |
| `shared/game/room.ts` | 수정 | model | CRUD | 자기 자신 (`nightPick?`, `morning?`, `lastPhrase?` 줄) | exact |
| `shared/protocol.ts` | 수정 | model(와이어) | request-response | 자기 자신 (`PhaseId`, `TEMPLATE_IDS`, `ClientMessage`) | exact |
| `shared/schemas.ts` | 수정 | validation | request-response | 자기 자신 (`pick` strictObject, 29행) | exact |
| `worker/room.ts` | 수정 | controller(DO) | request-response + pub-sub | 자기 자신 (`handlePick`/`applyPick`, `applyClaim`, `actAsBot`) | exact |
| `src/game/eliminationText.ts` | 수정 | utility(표시 문구) | transform | 자기 자신 (`ELIMINATION_TAILS`) | exact |
| `test/unit/vote.test.ts` | 신규 | test | — | `test/unit/night.test.ts` | exact |
| `test/unit/win.test.ts` | 신규 | test | — | `test/unit/night.test.ts` (`lobbyOf`/`nightOf` 헬퍼) | role-match |
| `test/unit/execution.test.ts` | 신규 | test | — | `test/unit/night.test.ts` + `test/unit/tick.test.ts` | role-match |
| `test/worker/vote.test.ts` | 신규 | test | pub-sub | `test/worker/night.test.ts` | exact |
| `test/worker/endgame.test.ts` | 신규 | test | event-driven | `test/worker/night.test.ts`, `test/worker/alarm.test.ts` | role-match |
| `test/worker/leak.test.ts`, `test/unit/view.test.ts` 외 확장 | 수정 | test | — | 자기 자신 | exact |
| `scripts/smoke.mjs`, `scripts/uat-test-room.mjs`, `scripts/bots.mjs`, `scripts/e2e/lib.mjs` | 수정 | script | — | 자기 자신 (`PHASE_NEXT` 표) | exact |

---

## Pattern Assignments

### `shared/game/vote.ts` (service, request-response + 집계)

**Analog:** `shared/game/night.ts`

**Import/오류 타입 패턴** (`night.ts:6-12`):
```typescript
import { MORNING_PHRASE_COUNT } from "../protocol";
import type { AssassinationRecord, InvestigationRecord, TreatmentRecord } from "../protocol";
import { isAlive } from "./alive";
import type { Player, RoomState } from "./room";
import type { RandInt } from "./tick";

export type NightError = "WRONG_PHASE" | "BAD_MESSAGE";
```
-> `VoteError = "WRONG_PHASE" | "BAD_MESSAGE"` 로 같게.

**수신 검사 순서 (castExecVote/castCandidateVote 의 원형)** (`night.ts:19-39`):
```typescript
if (state.phase !== "night") return { ok: false, error: "WRONG_PHASE" };
const actor = state.players.find((p) => p.id === actorId);
if (!actor || !isAlive(actor)) return { ok: false, error: "BAD_MESSAGE" };
...
const chosen = Number.isInteger(target) ? state.players.find((p) => p.seat === target) : undefined;
if (!chosen || !isAlive(chosen)) return { ok: false, error: "BAD_MESSAGE" };
...
if (actor.nightPick === target) return { ok: true, state };           // 같은 값이면 입력 그대로
return { ok: true, state: { ...state, players: state.players.map((p) => (p.id === actorId ? { ...p, nightPick: target } : p)) } };
```
- `castExecVote(state, actorId, agree: boolean)`: 단계(`execVote`) -> 행위자 -> `typeof agree === "boolean"` -> 같은 값이면 그대로 -> `execVote` 만 바꾼 새 상태.
- `castCandidateVote(state, actorId, target)`: 위 + **`target === actor.seat` 이면 `BAD_MESSAGE`** (D-03). 마감 시각(`phaseEndsAt`)은 **절대 건드리지 않는다** (`selectClaim` 과 다름).

**집계 패턴 (tally)** (`night.ts:84-98`): `Map<number, number>` 누적 -> `top = Math.max(0, ...votes.values())` -> `tied = [...]` 를 **seat 오름차순**으로 정렬. 차이점: **후보 동률은 난수 없이 "후보 없음"**(D-03, Pitfall 4), `resolveNight` 의 `tied[randInt(...)]` 를 복사하지 않는다.
- `resolveExecVote`: 던진 표만 집계(`yes*2 > yes+no`), 집계 직후 `execVote` 키 삭제(`night.ts:42-44` 의 destructure 패턴). 반환 `{ state, stay: false, next? }` 형태는 `claim.ts` 의 `resolveClaimTurn` 시그니처와 맞춘다.
- `tallyCandidateVote(state, randInt)`: 던진 표를 seat 오름차순으로 모은 뒤 Fisher-Yates (`shared/game/roles.ts:51-58`). 호출 순서 계약: n>=2 일 때 `i=n-1..1` 에 `randInt(i+1)`, n<=1 이면 무호출.
- `execTallyOf(state)`: `{ yes, no }` 만 반환(개인 정보 없음).

**수신자 헬퍼** (`night.ts:166-175` `pickRecipientIds`): 후보 선택 `sendViewTo` 대상 = **투표자 본인 1명**(관전자 제외, A7). 여부 투표는 방송이라 수신자 헬퍼가 필요 없다.

---

### `shared/game/win.ts` (utility, transform)

**Analog:** `shared/game/night.ts` 의 `living` 필터와 role 읽기 (`night.ts:78-79`), `alive.ts` 의 `isAlive`.

```typescript
const living = state.players.filter(isAlive);
...
if (p.role !== "mafia") continue;
```
- `checkWinner(state): "citizen" | "mafia" | null`. 머리 주석에 `night.ts:4-5` 처럼 "role 을 읽지만 팀 문자열 하나만 반환한다(결정 0002)" 를 적는다.
- 분모는 **연결 여부 무관 생존자**(CONN-02, D-05) — `p.connected` 를 읽지 않는다.
- 와이어에 실리는 승리 값은 `citizenWin`/`mafiaWin` (`ROLE_WORDS` 충돌 회피, Pitfall 10). `checkWinner` 내부 반환과 와이어 값의 변환 위치를 한 곳(`enterEnded`)에 둔다.
- 역할이 없는 상태(Pitfall 19)는 `null`.

---

### `shared/game/execution.ts` (service, event-driven 훅 모음)

**Analog 1:** `night.ts` `enterNight` (청소형 진입 훅, `night.ts:42-50`)
```typescript
export function enterNight(state: RoomState): RoomState {
  const { morning: _morning, nextNightSeq: _nextNightSeq, ...rest } = state;
  return { ...rest, players: state.players.map((p) => { const { nightPick: _nightPick, ...kept } = p; return kept; }) };
}
```
-> `enterExecVote`: `verdict`, `execution` 키 제거 + 각 `Player.execVote`, `candidateVote` 키 제거.

**Analog 2:** `night.ts` `enterMorning` (집계 + 문구 추첨 + 한 번의 새 상태, `night.ts:127-148`) 와 문구 추첨 (`night.ts:121-124`):
```typescript
const candidates: number[] = [];
for (let n = 1; n <= MORNING_PHRASE_COUNT; n += 1) if (n !== state.lastPhrase) candidates.push(n);
return { eliminated, phrase: candidates[randInt(candidates.length)], ... };
```
-> `enterExecution`: 후보 `alive: false`(직업은 싣지 않음, D-09), 문구는 `EXECUTION_PHRASE_COUNT` 에서 `lastExecPhrase` 제외 후 `randInt`, `execution: {seat, phrase}` 기록. 호출 순서 계약 주석 필수(문구 한 번).
-> `enterCandidateVoteReveal(state, randInt)`: `tallyCandidateVote` 호출 + `voteLog` 누적(`cand: {votes, candidate?}`) + `verdict.candidate`.
-> `enterEnded(state, randInt, at)`: `winner` 기록 + `expiresAt = at + 30분`(D-28) + `buildSummary` 재료 보존. 허용 목록으로 만드는 `buildSummary(state)` 는 `view.ts` 가 `ended` 에서만 호출.

**Analog 3:** 마감 분기 훅 — `shared/game/claim.ts` 의 `resolveClaimTurn` (반환 `{ state, stay }`). `route*` 들은 `{ state, stay: false, next? }` 를 돌려준다.
- `routeAfterExecution` / `routeAfterMorning`: `checkWinner(state) !== null ? { next: "ended" }` (D-10: 진입 훅이 아닌 **마감 훅**에서 분기 — 아침 5초를 보여 준 뒤 종료).

---

### `shared/game/tick.ts` (수정)

**Analog:** 자기 자신 (`tick.ts:31-75`)

현재:
```typescript
const ON_ENTER: Partial<Record<PhaseId, (s: RoomState, randInt: RandInt) => RoomState>> = {
  dayAnnounce: enterDayAnnounce, claim: enterClaim, night: enterNight, morning: enterMorning,
};
const ON_DEADLINE: Partial<Record<PhaseId, (s: RoomState) => { state: RoomState; stay: boolean }>> = {
  claim: resolveClaimTurn,
};
...
const next = PHASE_DEFS[closing.phase].next;
if (next === null) break;
...
current = hook ? hook(entered, randInt) : entered;
```
변경 (Pattern 1):
- `DeadlineResult = { state; stay; next?: PhaseId }`; `const next = resolved?.next ?? PHASE_DEFS[closing.phase].next;`
- `ON_ENTER` 행 추가: `execVote: enterExecVote`, `candidateVoteReveal: enterCandidateVoteReveal`, `execution: enterExecution`, `ended: enterEnded`; 훅 시그니처에 3번째 인자 `at`(= `deadline`). 기존 훅은 인자를 무시하면 되므로 타입 호환.
- `ON_DEADLINE` 행 추가: `execVote`, `candidateVoteReveal`, `execution`, `morning`.
- 머리 주석(1-11행)에 새 훅과 `next?` 규칙을 갱신. `stay` 분기는 그대로.
- 주의: `ended` 는 `durationMs: null` 이라 `phaseEndsAt: null` -> 루프 조건 `current.phaseEndsAt !== null` 이 멈춘다. `nextWakeAt`(`tick.ts:78`)은 `expiresAt` 로 알람이 가므로 `enterEnded` 의 `expiresAt` 단축이 곧 정리 시점.
- `NO_RANDOM` 문구("resolve the night")는 처형·공개 단계도 난수를 쓰므로 문구 일반화.

---

### `shared/game/phases.ts` (수정)

**Analog:** 자기 자신 (`phases.ts:20-37`)
```typescript
export const MORNING_MS = 5_000; // NIGHT-06
export const PHASE_DEFS: Readonly<Record<PhaseId, PhaseDef>> = Object.freeze({
  discussion: Object.freeze({ durationMs: DISCUSSION_MS, next: "night", revealsOwnRole: true }), // 4페이즈가 이 사이에 투표·처형을 끼운다
  morning: Object.freeze({ durationMs: MORNING_MS, next: "dayAnnounce", revealsOwnRole: true }),
});
```
- 상수 추가: `EXEC_VOTE_MS = 10_000`, `CANDIDATE_VOTE_MS = 15_000`, `CANDIDATE_REVEAL_MS = 4_000`, `DEFENSE_MS = 10_000`, `EXECUTION_MS = 5_000` (각 줄 끝에 `// D-01`/`// D-21` 식 주석).
- `discussion.next` 를 `"execVote"` 로, 해소된 "4페이즈가 ..." 주석 삭제, 머리 주석(5-6행) 갱신. `ended: { durationMs: null, next: null, revealsOwnRole: true }`. 표는 데이터만, 분기는 `tick.ts` 에.

---

### `shared/game/chat.ts` (수정)

**Analog:** 자기 자신

**템플릿 표 행 패턴** (`chat.ts:22-34`):
```typescript
innocent: Object.freeze({ target: false, role: false, when: "day" as const }), // "저 아니에요"
nightTarget: Object.freeze({ target: true, role: false, when: "night" as const }), // "{닉네임} 지목해요"
```
-> `defNotMe`, `defCitizen`, `defSuspect`(target), `defTrust`(target), `defRole`(role), `defPlead` 6행, `when: "defense" as const`, 각 줄 끝에 화면 문장 주석. `when` 유니온에 `"defense"` 추가. `TEMPLATE_IDS` (`protocol.ts:73-77`)에도 같은 6개.

**단계 집합 + senderOf** (`chat.ts:50-59`):
```typescript
const SAY_PHASES: ReadonlySet<PhaseId> = new Set<PhaseId>(["discussion", "night"]);
const EMOTE_PHASES: ReadonlySet<PhaseId> = new Set<PhaseId>(["claim", "discussion", "night"]);
function senderOf(state, actorId, allowed) {
  if (!allowed.has(state.phase)) return "WRONG_PHASE";
  const sender = state.players.find((p) => p.id === actorId);
  if (!sender || !isAlive(sender)) return "BAD_MESSAGE";
  if (state.phase === "night" && sender.role !== "mafia") return "WRONG_PHASE";
  return sender;
}
```
- `SAY_PHASES` += `execVote`, `candidateVote`, `defense`; `EMOTE_PHASES` += `execVote`, `candidateVote`, `defense` (A3: `candidateVoteReveal`·`execution` 은 제외).
- `defense` 에서 **후보가 아닌 생존자의 say 는 WRONG_PHASE** — `night` 의 "살아 있는 비마피아 -> WRONG_PHASE" 줄(57행)을 그대로 모방해 `state.phase === "defense" && sender.seat !== state.verdict?.candidate` 줄을 추가 (단, emote 는 통과해야 하므로 senderOf 에 플래그 인자 또는 say 내부에서 검사).

**when 판정 일반화** (`chat.ts:83`): 현재 이분법 `when !== (state.phase === "night" ? "night" : "day")` (Pitfall 16). `whenOf(phase)` 헬퍼로 `night`->night, `defense`->defense, 그 외->day 로 바꾼다. 투표 두 단계는 `"day"` 템플릿(D-12: 기존 찬반 중 규칙을 두 투표로 옮김) 유지.

**수신 범위** (`worker/room.ts:343-346`): 현재 `night` 만 수신자 한정, 나머지는 `broadcastEvent`. 변론·투표 단계는 전원 방송이므로 분기 변화 없음.

---

### `shared/game/view.ts` (수정)

**Analog:** 자기 자신

**DAY_PHASES** (`view.ts:28-34`) — 새 5단계(`execVote`, `candidateVote`, `candidateVoteReveal`, `defense`, `execution`) 추가 필수(Pitfall 8). `ended` 포함 여부는 UI-SPEC 이 정하되 의도적 결정 + 테스트로 고정.

**buildDay 패턴** (`view.ts:42-63`) — 조건을 채울 때만 키 생성, 줄마다 필드를 하나씩 복사:
```typescript
claimLog: (state.claimLog ?? []).map((entry) => ({ n: entry.n, seat: entry.seat, claim: entry.claim })),
if (state.phase === "morning") { const morning: MorningView = {}; ... day.morning = morning; }
```
-> `day.voteLog` = `(state.voteLog ?? []).map(e => ({ n, exec: {yes, no, passed}, ...(cand ? {cand: {votes: cand.votes.map(v => ({seat: v.seat, target: v.target})), ...} } : {}) }))` 항상(낮 단계마다, `claimLog` 선례). `day.execTally`(execVote 단계만), `day.candidate`(reveal·defense·execution), `day.execution`(execution 만, `{seat, phrase}`).

**buildView 본인 전용 필드** (`view.ts:121-124`):
```typescript
if (state.phase === "night" && isAlive(me) && me.nightPick !== undefined) { myInfo.pick = me.nightPick; }
```
-> `if (state.phase === "execVote" && isAlive(me) && me.execVote !== undefined) myInfo.voteAgree = me.execVote;` / `candidateVote` 단계의 `myInfo.voteTarget`. 남의 값은 어떤 키로도 싣지 않는다.

**result** (`view.ts:158-177` 의 `spectate.seats` 생성 루프를 재사용): `state.phase === "ended"` 에서만 `view.result = { winner, seats: 전원 {seat, job}, summary }` (**전원**, 탈락자 한정이 아님). 키 이름 `job`, `role` 금지.

**주의:** 처형된 사람은 `isAlive` 가 false 가 되므로 기존 `spectate`(탈락 본인에게 전체 직업) 규칙이 그대로 적용된다(결정 0021, D-09). 생존자 view 에는 처형자 직업이 없어야 한다.

---

### `shared/game/night.ts` (수정, 최소)

**Analog:** 자기 자신 — `ResolvedNight` (`night.ts:54-63`)에 `target?: number` 를 더하고 `enterMorning` 이 `nightLog`(서버 전용 `{n, target?, died}`)를 쌓는다. 난수 호출 순서 계약(동률 한 번, 문구 한 번, `night.ts:75`)은 건드리지 않는다. 기존 `night.test.ts` 의 호출 순서 단언이 회귀 보호.

---

### `shared/game/room.ts` / `shared/protocol.ts` / `shared/schemas.ts` (수정)

- `room.ts`: 필드 한 줄 형태를 따른다 — 모두 optional, 한국어 한 줄 주석. `Player.execVote?: boolean`, `Player.candidateVote?: number`, `RoomState.verdict?`, `voteLog?`, `execution?`, `lastExecPhrase?`, `nightLog?`, `winner?`. `resetToLobby` (`testTools.ts:63-94`)는 허용 목록 리터럴이라 자동 소거되며 `testTools.test.ts` 에 확인 케이스만 추가.
- `protocol.ts`: `PhaseId` (22-24행) += 6; `TEMPLATE_IDS` (73-77행) += 6; `ClientMessage` (164-179행) += `{ t: "execVote"; agree: boolean }`, `{ t: "candidateVote"; target: number }`; `MORNING_PHRASE_COUNT` 8->7, `EXECUTION_PHRASE_COUNT = 4`; `DayView`/`MyInfo`/`RoomView` 필드.
- `schemas.ts` (29행): 
```typescript
z.strictObject({ t: z.literal("pick"), target: z.number().int().min(0).max(7) }),
```
-> `z.strictObject({ t: z.literal("execVote"), agree: z.boolean() })`, `z.strictObject({ t: z.literal("candidateVote"), target: z.number().int().min(0).max(7) })`. `say` 의 `z.enum(TEMPLATE_IDS)` (21-26행)는 자동 통과.

---

### `worker/room.ts` (controller, request-response + pub-sub)

**Analog:** 자기 자신

**메시지 switch** (`room.ts:182-221`) — `case "pick": await this.handlePick(ws, msg.target); return;` 아래에 `execVote`, `candidateVote` 케이스 추가(Pitfall 15: 타입이 못 잡는 곳).

**핸들러 두 겹 구조** (`room.ts:403-422`, `handlePick` -> `applyPick`) 복사:
```typescript
private async applyPick(playerId: string, target: number): Promise<WsErrorCode | null> {
  if (!this.room) return "BAD_MESSAGE";
  const result = pickTarget(this.room, playerId, target);
  if (!result.ok) return result.error;
  if (result.state === this.room) return null;           // 같은 값: 저장·전송 없음
  this.room = result.state;
  await this.ctx.storage.put("room", this.room);
  this.sendViewTo(pickRecipientIds(this.room, playerId));
  return null;
}
```
- `applyCandidateVote`: 위와 동일, 수신자 = `[playerId]` 만 (방송 금지, Pitfall 7).
- `applyExecVote`: 같은 골격이되 저장 후 **`await this.persistAndBroadcast()`**(`room.ts:646`; 집계 수가 전원 공개 정보, D-02). 핸들러(`handlePick` 모양, `room.ts:403-411`)는 `sendRejection(ws, att.playerId, error)` 로 거부. 마감은 불변이라 `reschedule` 불필요 (`applyPick` 주석 `room.ts:413-414`).
- 봇: `actAsBot` switch (`room.ts:436-451`)에 `case "execVote"`, `case "candidateVote"` 추가, 사람과 같은 `apply*` 호출(특권 없음, 결정 0024-6).
- `applySay` (`room.ts:337-348`): 변론 단계도 `broadcastEvent` 경로라 수신자 변경 없음. 쿨다운·후보 검사는 `chat.ts` 에서.
- 종료 방 정리: `nextWakeAt` 이 `expiresAt` 알람을 쓰므로 DO 변경 최소. 종료 후 알람 동작은 `test/worker/alarm.test.ts` 에서 검증.

---

### `shared/game/bots.ts` (수정)

**Analog:** 자기 자신

- 계획 키 (`bots.ts:113-117` `botPlanKey`): `if (state.phase !== "discussion" && state.phase !== "night") return null;` -> `execVote`, `candidateVote`, `defense` 추가(Pitfall 20).
- 대상 선택 (`bots.ts:96-108` `botNightTarget`): 후보 목록 seat 오름차순 -> `candidates[randInt(candidates.length)]!.seat`, 후보 없으면 `undefined`, `randInt(0)` 없음. -> `botCandidateTarget`(자기 제외 생존자).
- `BotAct` 유니온 (`bots.ts:57-60`) += `{ t: "execVote"; agree: boolean }`, `{ t: "candidateVote"; target: number }`.
- `planFor` (`bots.ts:132-160`): `else if (state.phase === "night") { ...add(now + NIGHT_PICK_BASE_MS + randInt(NIGHT_PICK_SPAN_MS), {...}) }` 모양으로 `execVote`/`candidateVote`/`defense`(후보 봇만 변론 say) 분기. 지연 상수는 파일 상단 `NIGHT_PICK_BASE_MS` 식으로 이름 붙인 상수. 난수 호출 순서는 주석 + `bots.test.ts` 시드 테스트로 고정.

---

### `shared/game/testTools.ts` (수정)

**Analog:** 자기 자신 — `skipPhase` (`testTools.ts:34-40`), `botsPickNow` (`:47-56`)
```typescript
const ready = state.phase === "night" ? botsPickNow(state, randInt) : state;
return { ok: true, state: tick({ ...ready, phaseEndsAt: now }, now, randInt) };
```
- `testSkip` 로 투표 단계를 당겨 끝낼 때 아직 안 던진 봇이 던지게 하는 `botsVoteNow`(Pitfall 20): `isBot && isAlive && p.execVote === undefined` 필터 -> `castExecVote` 호출 -> 성공 시 갱신. `phase === "execVote" | "candidateVote"` 분기. 새 `next?` 분기 덕에 한 번 skip 이 다음 "기본 단계" 가 아닐 수 있음을 `testTools.test.ts` 에 케이스로 추가.

---

### `src/game/eliminationText.ts` (수정, 서버 웨이브의 최소 문구 쪽)

**Analog:** 자기 자신 (`eliminationText.ts:8-24`)
```typescript
export const ELIMINATION_TAILS = [ "이슬이 되어 사라졌습니다", "조용히 눈을 감았습니다", ... ] as const;
export function eliminationTitle(phrase, nickname): string {
  const ok = typeof phrase === "number" && Number.isInteger(phrase) && phrase >= 1 && phrase <= ELIMINATION_TAILS.length;
  ...
  return `${nickname}님이 ${tail}`;
}
```
- 아침 묶음에서 "이슬이 되어 사라졌습니다" 제거(8->7, `MORNING_PHRASE_COUNT` 도 7), 새 `EXECUTION_TAILS` 4개(D-11): 더는 함께할 수 없게 되었습니다 / 형장의 이슬이 되었습니다 / 잔혹하게 처형되었습니다 / 처형대에 올랐습니다. "님이" 고정, 범위 밖 번호는 첫 문구 폴백 같은 규칙을 `executionTitle` 로 복제.
- **연쇄**: `test/unit/eliminationText.test.ts` (표 순서·길이 단언, `MORNING_PHRASE_COUNT` 비교), `morning.test.tsx`, `phaseScreens.test.tsx`, 디자인 사본 `design/**/night-v1/SPEC.md` 갱신 (RESEARCH Pitfall 11: 하드코딩된 8 검색 필요). 번호 이동이 저장된 옛 `morning.phrase` 와 어긋나는 문제는 Pitfall 11 에 따라 확인.

---

## 테스트 패턴

### `test/unit/vote.test.ts`, `win.test.ts`, `execution.test.ts`

**Analog:** `test/unit/night.test.ts`

**헬퍼 패턴** (`night.test.ts:1-45`): `lobbyOf(n)` 로 대기실 -> `startGame(lobby, lobby.hostId, START_AT, seededRandInt(seed))` -> `while (state.phase !== target) state = tick(state, state.phaseEndsAt)` 로 **실제 전이**로 상태를 만든다. 새 도우미 `stateWithVerdict()`/`execVoteOf(n, seed)` 를 같은 방식으로 추가(Pitfall 12: `view.test.ts` 의 `stateAt` 이 새 단계에 못 닿음).
- 파일 맨 위에 한국어 주석으로 요구사항 ID 를 단 `describe` 이름 (예: `describe("castExecVote (VOTE-01)", ...)`).
- 시드 반복: 4~8명 x 시드 전수(`view.test.ts` 선례). `seededRandInt` (`test/helpers/seededRandom.ts`).
- 필수 케이스: 규칙표(RESEARCH "투표 규칙표"), 마감 뒤 `execVote` 키 부재(익명), 입력 상태 불변(`toBe` 동일 객체 / 깊은 동결), `randInt` 호출 순서·횟수(스파이로 기록), `randInt(0)` 미호출.

### `test/worker/vote.test.ts`, `endgame.test.ts`

**Analog:** `test/worker/night.test.ts` (소켓 프레임 "오지 않음" 증명 패턴, 1-80행)

**핵심 도우미 복사** (`night.test.ts:30-60`): `summary(msgs)` 한 줄 문자열 비교(TAP 한 줄 오류), `mark(sock)` + `settle(sock, from)`(ping/pong 으로 "그 사이 프레임 전부" 확정), `lastView`, `actorsOf`(전지적 seat·역할 읽기), `startedAt…(players)`.
```typescript
const marks = new Map(others.map((a) => [a, mark(a.sock)]));
const mine = await pick(police, citizen.seat);
expect(summary(mine)).toBe("[state:night]");
for (const a of others) expect(summary(await settle(a.sock, marks.get(a)!))).toBe("[]");
```
- `candidateVote`: 투표자 소켓만 `[state:candidateVote]`, 나머지 `[]`. `execVote`: **모든 소켓** `[state:execVote]` + `day.execTally` 갱신, 같은 값 재전송은 전원 `[]`. 거부 코드(자기 선택/범위 밖/문자열 target/알 수 없는 키)는 `[error:BAD_MESSAGE]` 이고 다른 소켓 `[]`.
- **차분(익명) 테스트**: 같은 판에서 A 가 찬성 vs B 가 찬성한 두 경우에 제3자 소켓이 받은 state 프레임이 동일해야 한다.
- `helpers.ts` 도구: `advanceTo(code, sockets, phase)`(`helpers.ts:218`), `forceDue(code, "phaseEndsAt")`(`:141`), `backdateSends`(`:229`, 쿨다운 우회), `storedRoom`, `alarmOf`(종료 방 알람 검증).
- 단계 도달: `advanceTo` 가 분기 단계(execVote 반대 -> night 등)를 넘을 수 있으므로 필요하면 `testSkip` 사용 또는 헬퍼 확장.

### `test/worker/leak.test.ts`, `test/unit/view.test.ts` (확장)

**Analog:** 자기 자신

- `leak.test.ts:1-70`: 실제 프레임 수집 -> `keyPaths`/`stringPaths` 로 모든 키·문자열 경로 열거. 갱신 지점:
  - `FORBIDDEN_KEYS` 는 그대로, `SERVER_ONLY_KEYS = ["claimPick", ...]` (69행)에 `execVote`(Player 필드), `candidateVote`, `verdict`, `nightLog`, `lastExecPhrase` 추가.
  - `ROLE_PATHS_ALIVE`/`ROLE_PATHS_DEAD` (64-70행)에 `ended` 전용 `".view.result.seats[].job"` 은 **ended 프레임에서만** 허용하는 별도 허용 경로 추가. `result.winner` 는 `citizenWin`/`mafiaWin` 이라 `ROLE_WORDS` 와 안 겹친다(Pitfall 10).
  - 한 판을 처형까지 돌리는 시나리오(투표 -> 변론 -> 처형 -> 밤) 추가; 처형자 직업이 `ended` 전 생존자 프레임에 없음 단언.
- `view.test.ts:18` `PHASES`, `:29` `REVEALING_PHASES` 배열에 새 단계 추가(`:325`, `:422`, `:816` 루프가 자동으로 새 단계를 전수 검사). 허용 키 전수 테스트에 새 필드 반영.

### 기타 확장

- `tick.test.ts`: 분기 케이스(반대 -> night, 동률 -> 공개 뒤 night, 승패 -> ended, 아침 마감 후 ended, 알람 지연 따라잡기).
- `chat.test.ts`: 변론 템플릿 `when`, 후보 아닌 생존자 say = WRONG_PHASE / emote 통과, 쿨다운 합산.
- `bots.test.ts`, `test/worker/bots.test.ts`, `testTools.test.ts`, `gameRoom.test.ts`, `scenes.test.ts`("dusk·verdictDusk 는 어떤 단계도 가리키지 않는다" 가 의도적으로 뒤집힘), `alarm.test.ts`.

---

## 스크립트 (수정)

**Analog:** 자기 자신 — `scripts/smoke.mjs:38-48`
```javascript
// 허용 전이 표(shared/game/phases.ts 의 next 와 같다). 낮 루프라 끝이 없다: discussion → night → morning → 다시 dayAnnounce.
const PHASE_NEXT = { lobby: ["assigning"], ..., claim: ["discussion"], discussion: ["night"], night: ["morning"], morning: ["dayAnnounce"] };
```
- 전이 표를 분기형으로 확장: `discussion: ["execVote"]`, `execVote: ["candidateVote", "night"]`, `candidateVote: ["candidateVoteReveal"]`, `candidateVoteReveal: ["defense", "night"]`, `defense: ["execution"]`, `execution: ["night", "ended"]`, `morning: ["dayAnnounce", "ended"]`, `ended: []`. 주석("끝이 없다")도 갱신. 같은 표가 `scripts/uat-test-room.mjs:179`, 시퀀스 단언 `smoke.mjs:640-642`, `scripts/bots.mjs`(실제 WS 봇 투표), `scripts/e2e/lib.mjs` `EXPECTED_SCENE` 에 있다.
- D-26: 배포본 스모크는 화면 웨이브 뒤에 돌린다. 이 웨이브에서는 스크립트의 표만 맞추고 실행·배포하지 않는다.

---

## Shared Patterns

### 비공개 수신자 한정 전송
**Source:** `worker/room.ts:413-422` (`applyPick`), `shared/game/night.ts:166-175`
**Apply to:** `candidateVote`(본인만), 변론 이전 모든 개인 선택. 여부 투표만 예외(집계 수 전원 방송).

### 허용 목록 뷰 마스킹
**Source:** `shared/game/view.ts:42-63, 88-143`
**Apply to:** 모든 신규 뷰 필드 — 리터럴 복사, 조건부 키 생성, 서버 전용 `Player.execVote`/`candidateVote`/`verdict`/`nightLog` 는 절대 펼쳐 복사하지 않는다.

### 마감 불변 + 입력 그대로 반환
**Source:** `night.ts:34`, `worker/room.ts:413-416`
**Apply to:** 투표 두 핸들러(조기 종료 없음, D-28).

### 난수 인자 주입과 호출 순서 계약
**Source:** `night.ts:75`, `tick.ts:23-29`, `shared/game/roles.ts:51-58`, `test/helpers/seededRandom.ts`
**Apply to:** `tallyCandidateVote`(셔플), `enterExecution`(문구), 봇 계획.

### 단계 표는 데이터만, 분기는 훅
**Source:** `phases.ts:1-8`, `tick.ts:5-10`
**Apply to:** `PHASE_DEFS` 행과 `ON_DEADLINE.next?`.

### 오류 코드 규칙
**Source:** `chat.ts:44-59`
**Apply to:** 틀린 단계 -> `WRONG_PHASE`, 방에 없거나 탈락 -> `BAD_MESSAGE`, 단계상 보낼 수 없는 사람(비후보 변론) -> `WRONG_PHASE`(역할 정보를 주지 않음).

## No Analog Found

| 항목 | Role | Data Flow | 사유 |
|---|---|---|---|
| 여부 투표 실시간 집계 방송 + 차분(익명) 테스트 | test/controller | pub-sub | 기존 선택은 모두 본인/팀에게만 간다. `applyPick` 골격 + `persistAndBroadcast` 조합, 차분 테스트는 RESEARCH "집계 수 방송 누출 분석" 을 따라 신규 작성 |
| `ended` 단계의 `expiresAt` 단축·종료 방 정리 | service | event-driven | `ended` 같은 종단 상태가 없음. `nextWakeAt`(`tick.ts:78`)의 `expiresAt` 알람 재사용, 테스트는 `alarm.test.ts` 확장 |
| `buildSummary` (밤+낮 요약 합성) | utility | transform | 비슷한 합성 뷰가 없음. `claimLog` 줄 복사 패턴 + `nightLog` 서버 전용 |
| 마감 훅의 `next?` 분기 | service | event-driven | 기존 훅은 `stay` 만. RESEARCH Pattern 1 제안안 |

## Metadata

**Analog 검색 범위:** `shared/`, `worker/`, `src/game/`, `test/unit`, `test/worker`, `test/helpers`, `scripts/`
**읽은 파일:** `night.ts`, `tick.ts`, `phases.ts`, `chat.ts`, `view.ts`, `bots.ts`, `testTools.ts`(발췌), `worker/room.ts`(발췌), `eliminationText.ts`, `schemas.ts`(grep), `test/unit/night.test.ts`, `test/worker/night.test.ts`, `test/worker/leak.test.ts`(발췌), `scripts/smoke.mjs`(발췌), 04-RESEARCH.md
**추적 소스 확인:** 위 경로 모두 `git ls-files` 출력에 포함됨 (미러 경로 없음)
**추출일:** 2026-10-26

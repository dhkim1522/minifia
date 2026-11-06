# Phase 9: 밤과 아침 - Pattern Map

**Mapped:** 2026-11-03
**Files analyzed:** 27 (신규 11 · 수정 16)
**Analogs found:** 26 / 27

추적 소스만 인용한다(미러 경로 없음). 줄 번호는 이 세션에 직접 읽은 기준이며, `worker/room.ts` 는 8페이즈 리뷰 수정 미배포라 바뀌면 다시 확인한다.

사용자 확정(2026-11-03): (1) 암살 확정은 선택값만 본다(연결 무시, 고르지 않은 채 끊긴 마피아가 있으면 무효, 고른 뒤 끊기면 선택 유지). (2) 밤 진입 스냅샷은 시민 편(시민·경찰·의사)에게 본인 한 칸만. "모든 소켓에 같은 내용"은 아침 스냅샷에만 적용.

## File Classification

| 신규/수정 파일 | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `shared/game/night.ts` (수정: `confirmedTarget`, `resolveNight` 난수 제거, 쪽지) | utility(순수 규칙) | request-response | 자기 자신 95-138 | exact |
| `shared/game/will.ts` (신규, 선택) | utility(순수 규칙) | request-response | `shared/game/vote.ts` `castExecVote` (08-PATTERNS 참조) | role-match |
| `shared/game/phases.ts` / `discussion.ts` (수정: `morningMsOf`, `phaseDurationOf`) | utility | transform | `phaseDurationOf` + `tick.ts:93-95` | exact |
| `shared/game/movement.ts` (수정: 밤 산 마피아 허용) | utility | request-response | 자기 자신 `canMoveIn` 27-32 | exact |
| `shared/game/audience.ts` (수정: 밤 world 분기, `worldVisibleTo` 밤 분기) | utility | request-response | 자기 자신 57-95 | exact |
| `shared/game/world.ts` (수정: `home`, `captureHome`, 저장/복원) | utility | CRUD | `lay`/`parseStoredLay`(world.ts:37, 201, 230, 279-310) | exact |
| `shared/game/view.ts` (수정: `me.will/note/nightTally/sure`, `day.chalk`, `morning.saved`) | model | transform | 자기 자신 `buildDay` 98-107, `myInfo.pick` 177-198 | exact |
| `shared/game/bots.ts` / `testTools.ts` (수정: 마피아 봇 협응) | service | event-driven | 자기 자신 `botPlanKey`, `botsPickNow` | exact |
| `shared/protocol.ts` / `shared/schemas.ts` (수정: `will`/`note`, `ChatLineWire.k`) | model | request-response | `schemas.ts:33-37` `ChatMessageSchema` | exact |
| `shared/game/chatLog.ts` (수정: `k` 필드) | model | CRUD | 자기 자신 `appendLine`/`replayFor` | exact |
| `worker/room.ts` (수정: `afterTransition` 합치기, `syncHome`, `handleWill/Note`, 카드 발행, 재접속 snap) | service(DO) | event-driven | 자기 자신 `syncLayout` 711-731, `applyChat` 948-974, `snapNewGhosts` 733- | exact |
| `src/world/tension.ts` (신규) | utility(순수 스케줄러) | event-driven | `src/world/store.ts`(순수 상태) + 주입형 시계 | 약함 |
| `src/components/v2/FaceList.tsx` (신규) | component | request-response | `src/components/v2/VerdictPicker.tsx` | exact(이식 규약) |
| `src/components/v2/WillSheet.tsx` (신규) | component | request-response | `src/components/v2/VerdictPicker.tsx` + `useChat` IME 규칙 | role-match |
| `src/components/v2/{ChatPanel,HeadStack,V2Icon}.tsx` (수정: 카드, sureLabel, 아이콘 5종) | component | event-driven | 자기 자신 | exact |
| `src/screens/{GameMap,GamePanel,RoomScreen}.tsx` (수정: 밤 임시 틀 삭제, 어둠, 가림막) | component | pub-sub | 자기 자신 (8페이즈 틀) | exact |
| `src/world/{maps/bar,renderer,runtime}.ts` (수정: 분필, 시민 어둠 조명) | component | streaming | `bar.ts:494-495` `point()` 광원 선생성 | exact |
| `src/net/chatStore.ts` / `src/game/dayView.ts` (수정: `kind:"card"`, kill-fx 판정) | utility | transform | 자기 자신 / `src/net/roomDiff.ts` | role-match |
| `public/characters/faces/face-0..7.png` (복사) | config(에셋) | file-I/O | `design/v2.0/design-system/assets/Faces/` | exact |
| `docs/decisions/0061-*.md` (신규) | config(문서) | — | `docs/decisions/0060-v2-day-execution-ghost.md` | exact |
| `test/worker/nightLeak.test.ts` (신규) | test | event-driven | `test/worker/ghostLeak.test.ts` | exact |
| `test/worker/{will,morningCards}.test.ts` (신규) | test | event-driven | `test/worker/chat.test.ts` + `helpers.ts` | exact |
| `test/worker/helpers.ts` (수정: `observe`/`stable` 이동, `snapshotStorage`/`restoreStorage`) | test util | — | `helpers.ts` `forceDue` 141-151 | exact |
| `test/unit/{will,tension,tensionStaticGuard}.test.ts` (신규) | test | — | `test/unit/chatStaticGuard.test.ts` | exact |
| `test/client/{faceList,willSheet,killFx}.test.tsx` (신규) | test | — | `test/client/v2parts.test.tsx` | role-match |
| `test/unit/{night,audience,movement,world,view,phases,tick,dayStaticGuard,bots}.test.ts` (개정) | test | — | 자기 자신 | exact |
| `scripts/e2e/{flows,lib}.mjs` (개정) | test(E2E) | request-response | 기존 `night-roles` 흐름 | exact |
| 분필 메시(`bar.ts` 이식 원본) | component | streaming | `design/v2.0/blockout/blockout.js` 276-284 `st.chalk` | exact |

## Pattern Assignments

### `shared/game/audience.ts` (utility, request-response)

**Analog:** 자기 자신 (57-95). 밤 분기는 한 줄 규모 확장이다.

**현재 world 분기(고칠 곳)** (audience.ts:59-65):
```typescript
if (ev.k === "world") {
  if (state.phase === "lobby") return pick(() => true);
  if (!MAP_PHASES.has(state.phase)) return new Set();
  const mover = ev.mover === undefined ? undefined : state.players.find((p) => p.id === ev.mover);
  if (mover === undefined) return new Set();
  return isAlive(mover) ? pick(() => true) : pick((p) => !isAlive(p));
}
```
**복사할 확장:** `!isAlive(mover)` 는 기존대로 유령만. 그다음 `state.phase === "night"` 이면 `mover.role === "mafia" ? pick((p) => !isAlive(p) || p.role === "mafia") : new Set()` (fail-closed). mafia 채널 분기(audience.ts:73-75)가 이미 같은 술어 `!isAlive(p) || p.role === "mafia"` 를 쓴다. 산 마피아 술어는 `isAlive(p) && p.role === "mafia"` 로 쓰면 탈락 마피아도 유령으로 포함되어 동일.

**`worldVisibleTo` 밤 분기** (audience.ts:89 를 대체): 밤이면 viewer 가 유령이면 `pick(() => true)`, 산 마피아면 `pick(isAlive)`, 산 시민 편이면 `new Set([viewerId])` (사용자 확정 Q2). 그 밖의 단계는 기존 줄 유지. 이 함수가 `handleHello`·밤/아침 진입 viewer별 snap 모두에서 공용이어야 한다.

---

### `shared/game/movement.ts` (utility, request-response)

**Analog:** 자기 자신 (27-32).
```typescript
export function canMoveIn(phase: PhaseId, alive: boolean): boolean {
  if (phase === "lobby") return true;
  if (!MAP_PHASES.has(phase)) return false;
  if (!alive) return true;
  return phase === "dayAnnounce" || phase === "discussion";
}
```
세 번째 인자(`isMafia = false`)를 더해 `return phase === "dayAnnounce" || phase === "discussion" || (phase === "night" && isMafia)`. `canMove(state, p)` (35행 이하)도 `p.role === "mafia"` 를 넘기도록 고치고 화면도 같은 표를 쓰게 한다.

---

### `shared/game/night.ts` (utility, request-response)

**Analog:** 자기 자신 (95-138). 의사 보호·경찰 조사·`assassinations`·`treatments` 는 그대로 두고 target 결정부만 교체.

**삭제 대상**(다수결·동률 난수, night.ts:95-109):
```typescript
const votes = new Map<number, number>();
...
const target = tied.length <= 1 ? tied[0] : tied[randInt(tied.length)];
```
**교체:** RESEARCH Pattern 8 의 `confirmedTarget(state)` 를 export 하고 `const target = confirmedTarget(state);`. 연결 상태 미참조(사용자 확정). `candidates`/`phrase`/`randInt`/`MORNING_PHRASE_COUNT` 마지막 블록(137-138행)도 제거 -- `ResolvedNight.phrase` 필드, `lastPhrase`, `ELIMINATION_TAILS` 삭제와 함께 `dayStaticGuard.test.ts` 의 제거 식별자 목록에 추가.

**유지할 모양**(night.ts:122-138): `if (eliminated === undefined) return { ...picked, records, assassinations, treatments };` -- 구출·무사·미선택이 같은 형태의 반환이 되도록 쪽지/유언 길이 계산은 `eliminated !== undefined` 때만 쓴다(Pitfall 4).

---

### `shared/game/phases.ts` / `discussion.ts` (utility, transform)

**Analog:** `phaseDurationOf` 와 `tick.ts:93-95`.
```typescript
// tick.ts:93-95
// 진입 훅이 만든 상태(공개 단계의 표)로 길이를 구해 마감을 다시 정한다.
const length = phaseDurationOf(hooked);
```
`phases.ts:24-25` 의 `MORNING_MS` 는 `MORNING_BASE_MS` 로 대체. RESEARCH "Code Examples"의 `morningMsOf` 를 그대로 사용(5/+2/+2/+2, 상한 15). `state.morning.hasWill/hasNote` 는 서버 전용, `buildDay` 는 `eliminated`·`saved` 만 복사(허용 목록 리터럴, view.ts:98-107).

---

### `shared/game/world.ts` (utility, CRUD) -- `home` 기억

**Analog:** `lay`(LayoutMemo) 의 정의·저장·복원 일체.

**형태 검사 복사 원본** (world.ts:279-297 `parseStoredLay`):
```typescript
function parseStoredLay(raw: unknown, ids: ReadonlySet<string>): LayoutMemo | null {
  if (!isRecord(raw)) return null;
  const { key, slots } = raw;
  ...
  for (const id of Object.keys(slots)) {
    if (!ids.has(id)) continue;
    const v = slots[id];
    if (!Array.isArray(v) || v.length !== 2) continue;
    const [x, z] = v as unknown[];
    if (isCoord(x) && isCoord(z)) out[id] = [x, z];
  }
```
`parseStoredHome` 은 `{ day, pos }` 로 같은 구조. 연결 지점: `WorldState`(37행 부근 `lay?:`), `StoredWorld`(201행), `compactWorld`(230), `restoreWorld`(299-308: `stored.v === 1 ? parseStoredLay(...)`), `despawnPlayer`(슬롯 제거), `respawnAll`(초기화). 순간이동은 `restSegment(xFx, zFx, t0)`(112행) + `forceSegment(w, id, seg)`(54행). 캡처는 현재 구간의 끝점(`p[len-2], p[len-1]`).

---

### `worker/room.ts` (service/DO, event-driven)

**Analog:** 자기 자신. 세 가지 복사 원본.

**1) 멱등 동기화 -- `syncHome` 은 `syncLayout` 과 같은 모양** (room.ts:711-731):
```typescript
private syncLayout(now: number): void {
  const room = this.room;
  if (!room) return;
  const key = layoutKey(room);
  if (key === null || key === this.world.lay?.key) return;
  ...
  for (const m of layout.moves) {
    ...
    this.world = forceSegment(this.world, m.playerId, seg);
    this.emitWorld(moveFrame(me.seat, seg), m.playerId);
  }
  this.world = { ...this.world, lay: { key: layout.key, slots: layout.slots } };
  this.markWorldDirty();
}
```
밤·아침은 `move` 프레임이 아니라 viewer 별 `snapFrame` 을 `deliver(new Set([v.id]), ...)` 로 보낸다(`emitWorld` 는 mover 기준이라 시민 편 밤 snap 을 못 만든다). `syncLayout` 맨 앞에서 `captureHome`, 직후 `await this.flushWorld()`(마지막 주석 "밤에는 배치를 바꾸지 않는다…9페이즈가 정한다" 711행 삭제·갱신).

**2) 전환 후처리 합치기** -- `applyEndDiscussion`(room.ts:504-505), `advance`(699-702), `handleTestSkip`(578-579)가 각각 `snapNewGhosts` → `syncLayout` 를 반복한다. 하나의 `afterTransition(now)` 로 합치고 거기에 순서대로: tick → captureHome → chalk 채움 → persistAndBroadcast → syncHome(+viewer별 snap) → snapNewGhosts → 사망자 카드 발행.

**3) 카드 발행은 `applyChat` 본체를 복사하되 속도 제한 우회** (room.ts:964-973):
```typescript
const ids = audience(room, { k: "chat", ch });
const r = seatMask(room.players, ids);
const appended = appendLine(this.chatLog, { ch, seat: me.seat, text: clean.text, at: now, n: room.day ?? 0, r });
this.chatLog = appended.log;
await this.ctx.storage.put(chatKey(appended.record.g), appended.record);
if (appended.evicted.length > 0) await this.deleteChatKeys(appended.evicted.map(chatKey));
this.deliver(ids, { t: "chat", ...toWire(appended.record) });
```
카드는 `ch:"all"`, `seat` = 피해자 seat, `k:"will"|"note"` 를 `appendLine` 레코드에 더하고 `chatRates`/`checkChatSend` 는 부르지 않는다.

**`handleWill`/`handleNote` 껍데기:** `handleChat`(room.ts ~937) 의 소켓 껍데기 모양 + `pointAt`(96행, 440-445행) 의 인메모리 `Map<playerId, lastAt>` 속도 제한(500ms, 초과는 조용히 폐기). 성공 시 저장한 본인(note 는 산 마피아 전원)에게만 `sendViewTo([...])`(417행의 `pickRecipientIds` 선례). `persistAndBroadcast` 호출 금지.

---

### `shared/schemas.ts` / `shared/protocol.ts` (model, request-response)

**Analog:** `schemas.ts:33-37` `ChatMessageSchema`.
```typescript
export const ChatMessageSchema = z.strictObject({
  t: z.literal("chat"),
  text: z.string().max(CHAT_TEXT_MAX_UTF16),
  pk: z.string().min(1).max(PHASE_KEY_MAX),
}) satisfies z.ZodType<ClientMessage>;
```
`will`/`note`: `z.strictObject({ t: z.literal("will"), text: z.string().max(CHAT_TEXT_MAX_UTF16) })`, `note` 동일. 유니온 등록은 `schemas.ts:50-53` 의 8페이즈 줄(`execVote`·`point` 등) 옆. `MAX_FRAME_BYTES = 1024`(protocol.ts:18) 한도 확인. `ChatLineWire` 에 `k?: "will"|"note"` 추가.

---

### `shared/game/view.ts` (model, transform)

**Analog:** 자기 자신. `myInfo.pick` (view.ts:177-179) 과 `allyPicks` (191-198) 가 `me.nightTally`/`me.sure`/`me.will`/`me.note` 의 복사 원본. 키는 해당 역할에서만 생성(시민 편 view 에는 키 자체가 없음). `Player.will`·`nightNote` 는 `SERVER_ONLY_KEYS` 에 추가. `buildDay` 의 허용 목록 리터럴(98-107)에 `chalk` 와 `morning.saved` 만 더한다.

---

### `src/components/v2/FaceList.tsx` · `WillSheet.tsx` (component, request-response)

**Analog:** `src/components/v2/VerdictPicker.tsx` -- 이식 규약(헤더 주석에 원본 `design/v2.0/design-system/components/<이름>` 과 승인일 명시, React 19, 텍스트 노드만).

**임포트·접근성·포커스 패턴** (VerdictPicker.tsx:1-2, 28-37):
```typescript
import "../../styles/v2.css";
import { V2Icon } from "./V2Icon";
...
<button
  type="button"
  className={["mv-verdict__btn", value === v && "is-on"].filter(Boolean).join(" ")}
  data-verdict={v}
  aria-pressed={value === v}
  disabled={disabled}
  onMouseDown={(e) => e.preventDefault()}
  onClick={() => onChange(v)}
>
```
`FaceList` 는 같은 모양에 `data-face-list`, 칸마다 `aria-pressed`, 얼굴 `public/characters/faces/face-{seat}.png`, 진홍 색 없음(경찰·의사 공통 놋쇠). `WillSheet` 는 `role="dialog"`, `data-will-sheet`, 100자 카운터, IME 조합 종료 값 확정 뒤 전송(`useChat` 규칙, Pitfall 11). 원본 참고: `design/v2.0/design-system/components/FaceList/README.md`, `WillSheet/README.md`(`bundle.js` 런타임 import 금지).

---

### `src/world/tension.ts` (utility, event-driven) -- 약한 analog

**Analog:** 순수 스케줄러라 정확한 선례 없음. 입력은 `rng`, `now`, `reducedMotion` 만, 출력은 큐 이벤트 이미터. `connection`/`store`/`useRoomConnection`/`world/store` import 금지를 `test/unit/tensionStaticGuard.test.ts` 가 소스 문자열로 고정(아래 정적 검사 패턴 사용). 상수: 2~4회, 간격 4~9초, 첫 큐 >= 밤 시작 5초 뒤(로컬 마운트 시각 기준).

---

### `src/world/maps/bar.ts` (component, streaming) -- 분필·시민 어둠

**Analog 1:** 광원 선생성 (bar.ts:494-495).
```typescript
const point = (…): PointLight => { const l = new PointLight(TOKEN_COLORS.lamp, 0, c.distance, T.point.decay);
```
"내 캐릭터 작은 빛(1.4)" 도 처음부터 만들고 세기만 바꾼다(광원 개수 불변, Pitfall 7). `RendererStats.pointLights` 단위 테스트로 개수 고정.
**Analog 2:** 분필 메시 -- `design/v2.0/blockout/blockout.js` 276-284 (`TubeGeometry` 0.022, `#e8e6dc`, opacity 0.85). 메시 1개로 이식(draw call +1).

---

### `test/worker/nightLeak.test.ts` (test, event-driven)

**Analog:** `test/worker/ghostLeak.test.ts`. 같은 도우미·`observe` 패턴을 그대로 쓴다(ghostLeak.test.ts:1-20):
```typescript
import { advanceTo, chatSend, chatsOf, connect, ghostsOf, mark, nextFrame, pause, resetChatRates, seat, send, settle, startedGame, summary, toPhase, typingSend, withRole, worldFramesOf } from "./helpers";
async function observe(g: Game, first: Actor, act: () => void | Promise<void>): Promise<ServerMessage[][]> {
  const marks = g.socks.map((s) => mark(s));
  await act();
  const order = [first, ...g.actors.filter((a) => a !== first)];
  ...
  for (const a of order) out[g.actors.indexOf(a)] = await settle(a.sock, marks[g.actors.indexOf(a)]!);
```
`observe`/`stable`(휘발 필드 `serverNow, phaseEndsAt, t0, at, c, seq` 제거)을 `helpers.ts` 로 옮겨 공유. `snapshotStorage`/`restoreStorage` 는 `helpers.ts:141-151` `forceDue` 의 `runInDurableObject` + `evictDurableObject` 방식을 확장(`state.storage.list()`/`deleteAll`/`put`). 이 파일이 서버 웨이브의 첫 RED. 대본 설계는 RESEARCH "메타모픽 누설 검사 설계" 1~5.

---

### `test/unit/tensionStaticGuard.test.ts` (test, 정적)

**Analog:** `test/unit/chatStaticGuard.test.ts` (1-30행의 `stripComments` + `read(rel)` + `git ls-files` 구조). `tension.ts` 의 import 줄만 검사.

## Shared Patterns

### 받는 사람은 `audience`/`worldVisibleTo`/`deliver`/`sendViewTo` 한 길
**Source:** `shared/game/audience.ts`, `worker/room.ts` `deliver`
**Apply to:** 밤·아침 위치 snap, 카드, will/note 응답. 새 전송 경로 금지(누설 표면). 화면에서 숨기는 방식 금지(결정 0002·0021).

### 서버 전용 필드 허용 목록
**Source:** `view.ts:98-107` 필드별 복사, 누설 검사 `SERVER_ONLY_KEYS`, `CHAT_KEY_PATHS`/`CHATLOG_KEY_PATHS`(`.k` 를 이유와 함께 추가)
**Apply to:** `Player.will`, `nightNote`, `morning.hasWill/hasNote`, 새 view 필드. 허용 목록을 넓히지 않고 항목을 이유와 함께 더한다.

### 입력 검증
**Source:** `schemas.ts` `strictObject` + `sanitizeChatText`(빈 문자열은 will 에서 "지움" 허용) + 프레임 1024B 상한
**Apply to:** `will`, `note` 핸들러. 신원은 소켓 첨부 playerId 만. 거절은 본인에게만. 사용자 문자열은 React 텍스트 노드만(innerHTML 금지).

### 규칙 함수는 순수, 같은 값이면 같은 객체
**Source:** `shared/game/vote.ts`(`castExecVote`), `night.ts` `pickTarget`
**Apply to:** `saveWill`, `saveNote`, `confirmedTarget`. 시각·난수 없음.

### 단계 키 멱등 동기화
**Source:** `worker/room.ts:711-731` `syncLayout` + `world.lay.key`
**Apply to:** 밤/아침 위치 되돌림. 단계 전환 이벤트에 걸지 않는다(알람 따라잡기 Pitfall 3). `home` 없으면 순간이동 안 함(fail-safe).

### 제거 식별자 정적 가드
**Source:** `test/unit/dayStaticGuard.test.ts` (`SERVER_REMOVED_IDENTIFIERS`/`REMOVED_DAY_IDENTIFIERS`)
**Apply to:** `lastPhrase`, `MORNING_PHRASE_COUNT`, `ELIMINATION_TAILS`, `NightPanel`, `PickPill`, `NoticePill`, `NIGHT_PANEL_TEXT`, `nightPill`, `DAY_COPY.mafiaNightHint`.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `src/world/tension.ts` | utility | event-driven | 서버 신호와 단절된 로컬 난수 스케줄러는 선례 없음. RESEARCH Pattern 10 을 따른다 |

## Metadata

**Analog search scope:** `shared/`, `worker/`, `src/components/v2/`, `src/world/`, `test/worker/`, `test/unit/`, `design/v2.0/`
**Files scanned:** 약 14 (직접 읽기 8, grep 확인 6)
**Pattern extraction date:** 2026-11-03
**미확인(줄 번호만 grep):** `src/screens/*`, `chatStore.ts`, `dayView.ts`, `chatLog.ts` 본문은 RESEARCH 패턴 6·9·10 과 `08-PATTERNS.md` 를 따른다.

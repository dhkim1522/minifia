# Phase 17: 튜토리얼 "첫 사건" - Pattern Map

**Mapped:** 2026-11-09
**Files analyzed:** 29 (신규 17 + 수정 12 묶음)
**Analogs found:** 27 / 29 (모든 경로는 `git ls-files` 추적 소스, 미러 경로 없음)

모든 경로는 `/Users/dhkim1522/personal/minifia/` 기준이다. 줄 번호는 RESEARCH.md 「검증된 값 인용」과 이 세션에서 연 파일 기준이다.

## File Classification

| 신규/수정 파일 | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `shared/game/tutorial.ts` (신규) | service(순수 규칙) | event-driven | `shared/game/discussion.ts` (`toggleEnd`/`endReached`) | exact |
| `shared/game/phases.ts` (수정: `tutorial` 행, `TUTORIAL_MS`) | config | — | 같은 파일 `assigning` 행 :76 | exact |
| `shared/game/room.ts` (수정: `beginGame(opts)`, `tutorialPassed?`) | model | CRUD | 같은 파일 `beginGame` :420-434 | exact |
| `shared/game/view.ts` (수정: `view.tutorial`, `me.tutorialDone`) | service(view 빌더) | request-response | 같은 파일 `endCount`(:92)·`me.endDiscussion`(:329) | exact |
| `shared/game/audience.ts` (수정: 방 전원 집합) | utility | — | 같은 파일 :102 | exact |
| `shared/protocol.ts` / `shared/schemas.ts` (수정) | model/schema | request-response | `mapPick` 스키마 `schemas.ts:83` | exact |
| `worker/room.ts` (수정: `handleStart`/`handleTutorialDone`) | controller(DO) | event-driven | `applyEndDiscussion` :915-926 + `case "endDiscussion"` :293 | exact |
| `src/game/tutorialScript.ts` (신규) | utility(대본·가짜 view) | transform | `test/client/errandScreen.test.tsx` `makeView` :44-60 | role-match |
| `src/screens/TutorialScreen.tsx` (신규) | component(화면) | event-driven | `src/screens/RoomScreen.tsx` + `GameMap.tsx` props 계약 | role-match |
| `src/components/v2/TutorialHostBand.tsx` (신규) | component | request-response | `src/components/v2/HostBand.tsx` | exact |
| `src/components/v2/FocusRing.tsx`, `TutorialNext/Progress/Reveal/RoleCards/Wait/Toggle/Entry.tsx`, `OpeningFx.tsx` (신규) | component | event-driven | `src/components/v2/ErrandStartCard.tsx`·`TopToast.tsx`·`SoundButton.tsx` (부품 모양) | role-match |
| `src/screens/Home.tsx` (수정: 큰 카드·`tutorial` 상태 분기) | component | event-driven | 같은 파일 :75-120 (`unlockAudio` 규칙) | exact |
| `src/screens/Lobby.tsx` (수정: `TutorialToggle`, `pressStart`) | component | request-response | 같은 파일 `mapChip`(:151)·`pressStart`(:158) | exact |
| `src/screens/RoomScreen.tsx` (수정: `renderPhase("tutorial")`) | component | request-response | 같은 파일 :313, :450 | exact |
| `src/net/session.ts` 얹기 (`minifia.tutorial.seen`) | utility | file-I/O | 같은 파일 `read/write` :37-60 | exact |
| `src/audio/voice.ts` (신규) | utility | transform/streaming | `src/audio/script.ts` `ScriptItem` + `engine.runScript` | role-match |
| `src/audio/recipes.ts` (수정: `tut.*` 12 + `voice.syl`) | config | transform | 같은 파일 `day.start` :289, `ui.tap` :252 | exact |
| `src/styles/tutorial.css` (신규) | config(CSS) | — | `src/styles/v2.css` `.is-call` 블록(:206-231) | role-match |
| `test/unit/tutorial.test.ts` 등 단위 | test | — | `test/unit/soundStaticGuard.test.ts` (가드)·`test/unit/phases.test.ts` | role-match |
| `test/client/tutorial*.test.tsx` | test | — | `test/client/errandScreen.test.tsx` | exact |
| `test/worker/tutorial.test.ts`, `tutorialLeak.test.ts` | test | event-driven | `test/worker/errandLeak.test.ts` | exact |
| `test/worker/leak.test.ts` (수정) | test | — | 같은 파일 :113 `SERVER_ONLY_KEYS` | exact |
| `scripts/e2e/flows.mjs` (`tutorial-solo`/`tutorial-together`) | test(E2E) | request-response | 같은 파일 `chat-lobby` 흐름(:572 부근) | role-match |
| 모든 `Record<PhaseId>` 표 (Pitfall 1) | config | — | RESEARCH Pitfall 1 목록 | exact |

## Pattern Assignments

### `shared/game/tutorial.ts` (순수 규칙, event-driven)

**Analog:** `shared/game/discussion.ts` (`toggleEnd` :50-70)

**헤더·반환 모양** — 시각·난수 없이 상태만 받고, 같은 값이면 입력 객체를 그대로 돌려준다(저장·전송 건너뛰기 근거):
```typescript
export function toggleEnd(state: RoomState, actorId: string, on: boolean)
  : { ok: true; state: RoomState } | { ok: false; error: VoteError } {
  if (state.phase !== "discussion") return { ok: false, error: "WRONG_PHASE" };
  const actor = state.players.find((p) => p.id === actorId);
  if (!actor || !isAlive(actor)) return { ok: false, error: "BAD_MESSAGE" };
  if ((actor.endVote === true) === on) return { ok: true, state };   // 같은 객체
  return { ok: true, state: { ...state, /* 새 값 */ } };
}
```
복사할 점: 단계 검사 → 신원 검사 → 멱등 → 새 객체. `markTutorialDone`/`tutorialProgress`/`allTutorialDone`의 전체 골격은 RESEARCH 「서버 순수 규칙」 :376-391 에 있다. `isBot` 는 `shared/game/bots.ts:141`. 파일 머리 주석 한국어 + "순수 모듈이다 — 입력 상태는 바꾸지 않는다" 문구도 따른다.

---

### `shared/game/phases.ts` (config)

**Analog:** 같은 파일 :74-76
```typescript
export const ERRAND_MS = 40_000; // 결정 0074 · ...      // :62 상수 줄 + 결정 번호 주석
assigning: Object.freeze({ durationMs: ASSIGNING_MS, next: "roleReveal", revealsOwnRole: false }),
```
새 행: `tutorial: Object.freeze({ durationMs: TUTORIAL_MS, next: "assigning", revealsOwnRole: false })`. `TUTORIAL_MS = 150_000` 은 상수 블록에 `결정 0078` 주석과 함께(`TUTORIAL_MS` 를 `tutorial.ts` 가 아니라 `phases.ts` 에 두면 `ERRAND_MS` 와 같은 "이 블록의 줄만 고친다" 규칙에 맞는다 — RESEARCH 는 두 곳 모두 언급하므로 한 곳에만 정의하고 다른 쪽은 re-export).

---

### `shared/game/room.ts` — `beginGame` (model)

**Analog:** 같은 파일 :420-434. `phase: "assigning"`(:434) 를 `opts?.tutorial === true ? "tutorial" : "assigning"`, `phaseEndsAt` 도 단계 길이로. 역할 배정·난수 호출 순서는 건드리지 않는다(시드 시험 보호). `RoomState.tutorialPassed?: string[]` 는 서버 전용 이름. 다시 하기 허용 목록(`rematch.ts` `REMATCH_ROOM_KEYS` :16)에는 넣지 않는다 — 허용 목록 방식이라 자동 소멸한다.

---

### `shared/game/view.ts` (view 빌더)

**Analog:** 같은 파일 :91-92, :327-330
```typescript
if (state.phase === "discussion") day.endCount = endCountOf(state);          // 공개 값은 단계 한정
...
if (state.phase === "discussion" && isAlive(me) && me.endVote === true) {    // 본인 값은 조건 만족 때만 키 생성
  myInfo.endDiscussion = true;
}
```
적용: `state.phase === "tutorial"` 에서만 `view.tutorial = {done,total,endsAt}`·`myInfo.tutorialDone = true`. `me.role` 은 `revealsOwnRole:false` 라 자동 제외. 허용 목록 방식(키 하나씩)을 지키고 `tutorialPassed` 를 펼쳐 싣지 않는다.

---

### `shared/protocol.ts` / `shared/schemas.ts`

**Analog:** `schemas.ts:62`(현재 `z.object`), `:83`
```typescript
z.strictObject({ t: z.literal("mapPick"), map: z.enum(MAP_CHOICES) }),
```
교체: `z.strictObject({ t: z.literal("start"), tutorial: z.boolean().optional() })` + `z.strictObject({ t: z.literal("tutorialDone") })`. `protocol.ts:275` `| { t: "start" }` → `{ t: "start"; tutorial?: boolean }`, `| { t: "tutorialDone" }`. `PhaseId`(:30-34)에 `"tutorial"`.

---

### `worker/room.ts` (controller, event-driven)

**Analog:** `applyEndDiscussion` :915-926 및 `handleMessage` switch(:293, 막다른 `never` :367)
```typescript
private async applyEndDiscussion(playerId: string, on: boolean, now: number): Promise<WsErrorCode | null> {
  if (!this.room) return "BAD_MESSAGE";
  const result = toggleEnd(this.room, playerId, on);
  if (!result.ok) return result.error;
  if (result.state === this.room) return null;
  if (endReached(result.state)) {
    const prev = this.room;
    this.room = tick({ ...result.state, phaseEndsAt: now }, now, cryptoRandInt);
    await this.afterTransition(prev, now);
    return null;
  }
  ...
```
`case "tutorialDone": await this.handleTutorialDone(ws); return;` 를 switch 에 추가(빠뜨리면 `never` 컴파일 오류). 핸들러 모양(`handleEndDiscussion` :905-910): `att.playerId` 로 신원 → `apply...` → 오류면 `this.sendRejection(ws, att.playerId, error)`. 전체 골격은 RESEARCH :395-409. `handleDisconnect` 직후에도 `allTutorialDone` 재검사를 호출. `handleStart`(:477)는 `msg.tutorial === true` 만 `beginGame` 에 전달(서버 기본 꺼짐).

---

### `src/screens/TutorialScreen.tsx` (화면, event-driven)

**Analog:** `GameMap.tsx:209` props 계약(`view`·`store`·`chat`·`send`·`canSend`·`offset`) + `test/client/errandScreen.test.tsx` 의 가짜 view 구성.

**로컬 send 어댑터** (RESEARCH Pattern 1 :183-189) — 실제 `connection.send` 는 끝났음 한 곳에서만:
```typescript
function makeLocalSend(onErrand: () => void, onPoint: (seat: number) => void) {
  return (msg: ClientMessage): boolean => {
    if (msg.t === "errand") onErrand();            // GameMap.tsx:747
    else if (msg.t === "point") onPoint(msg.target); // GameMap.tsx:543
    return true;
  };
}
```
**가짜 view 필드** (`errandScreen.test.tsx:44-60` 모양): `makeView()` 가 `players: PublicPlayer[]`(seat·nickname·connected·isHost[·alive:false])와 `code`·`phase`·`phaseEndsAt`·`phaseDurationMs`·`serverNow` 를 채운다 → 대본의 `TUTORIAL_CAST`(서연·도윤 `noir`·민준 `detective`·지호 `reporter`·하린·나 `coat`)로 같은 구조를 만든다. 장면별 `phaseEndsAt` 규칙: 장면 3 `null`, 장면 5 `Date.now()+4000`(장면 시작 때 한 번 고정).

**방 틀:** `.mf-root.mf-room` 래퍼와 `[data-host-band] .mv-host__band` 가 있어야 `useMapInsets` 가 동작(HostBand.tsx:40 `HEADER_SELECTOR`).

**solo 소리:** `useSound({ active: true, view: null })` + `SoundButton`. 오디오 잠금은 카드 탭 맨 앞 `unlockAudio()`(`Home.tsx:75,85,110`).

---

### `src/components/v2/TutorialHostBand.tsx` (component)

**Analog:** `src/components/v2/HostBand.tsx` (160줄)

**복사할 것:** 헤더 주석 스타일(한국어, UI-SPEC·결정 번호), `import "../../styles/v2.css"`, 띠 마크업·`data-host-band`·`data-host-line`·`SoundButton` 독(`sound?: SoundView | null`), 문장은 React 텍스트 노드만(닉네임 주입 방지), 역할·좌석 값을 DOM 표식에 쓰지 않는다. 다른 점: 종 아이콘 대신 파형 막대 5 + `speaking` 상태(글자수×85ms+80ms 타이머, 엔진 상태 무관 — T-13), `hostLineOf`/시간 행 없음.
```typescript
import { useEffect, useLayoutEffect, useRef } from "react";
import "../../styles/v2.css";
import type { SoundView } from "../../audio/useSound";
import { SoundButton } from "./SoundButton";
import { V2Icon } from "./V2Icon";
```

---

### `src/components/v2/FocusRing.tsx` + `src/styles/tutorial.css`

**CSS 구현 원문:** RESEARCH :437-445(`opacity` 만 애니메이션, `prefers-reduced-motion` 에서 `animation: none; opacity: .6`). 기존 `.is-call`(`src/styles/v2.css:206-231`)은 5회·대상 내부 `::before/::after` — 복제하지 말고 토큰(`--light-lamp`)만 재사용. 겹침 처리: `[data-tutorial-screen] .is-call::before { animation: none; opacity: 0; }` (A: 계획 확인 항목). 대상 위치는 rAF 에서 `getBoundingClientRect`, 이전 값과 같으면 갱신 생략. 대상 선택자: `button[data-errand-place="mail"]`, `[data-errand-act]`, `.mf-world__tag[data-seat="N"]`, `button[data-pick="N"]`. 진홍(`crimson`) 사용은 이 파일에서 T-18 세 곳만.

---

### `src/screens/Home.tsx` (수정)

**Analog:** 같은 파일 :75-120 — 탭 핸들러 맨 앞 동기 호출 규칙
```typescript
unlockAudio(); // 제출 탭이 곧 소리를 켜는 제스처다: 어떤 await 보다 먼저, 같은 틱에서(D-7, B-3)
```
큰 카드 핸들러: `unlockAudio()` → `seen` 저장 → `setTutorial(true)`. **`Home` 안에서 `tutorial` 상태로 분기 렌더**(App 에 새 `Screen` 을 만들면 `nickname`·`code` 상태 소실). 큰 카드 자리: `<div className="mf-entry__actions">`(:142) 위. `onEnterRoom` 직전에 `seen` 켬.

---

### `src/net/session.ts` (저장 한 값)

**Analog:** 같은 파일 :6-7, :37-60 (`read`/`write` + 메모리 대체)
```typescript
export const SESSION_KEY = "minifia:session";
export const NICKNAME_KEY = "minifia:lastNickname";
function read(key: string, storage: StorageLike): string | null { try { return storage.getItem(key); } catch { return memory.get(key) ?? null; } }
```
`TUTORIAL_SEEN_KEY = "minifia.tutorial.seen"`(T-2 문자열 그대로, 점 표기 — 기존 콜론 규칙과 다름, Assumption A6). `read/write` 를 얹는 작은 export 함수(`readTutorialSeen`/`writeTutorialSeen`)를 이 파일에 추가한다.

---

### `src/screens/Lobby.tsx` (수정)

**Analog:** 같은 파일 :151-169
```typescript
const mapChip = mapsOn && isHost ? <MapChip choice={mapChoice} host onPress={() => openDress("map")} /> : null; // 방장에게만
const pressStart = () => { if (!canSend || locked) return; ...; send({ t: "start" }); ... };
```
변경: `useState` 초기값 `(view.round ?? 1) === 1 && view.me.testMode !== true`, `send({ t: "start", tutorial: on })`. 방장에게만 `TutorialToggle`. 패널 높이는 `src/styles/lobby.css:29`(`gap: 10px`) 때문에 +74 vs UI-SPEC +76 불일치 — `margin-top: 2px` 로 +76 을 맞추거나 숫자를 +74 로 고친다. `data-lobby-start` 속성(:216)은 유지.

---

### `src/screens/RoomScreen.tsx` (수정)

**Analog:** 같은 파일 :313, :450 (실제 `HostBand`·`emitSignal({kind:"host"})`). `shownPhase === "tutorial"` 일 때 `HostBand`·알림음·소리 감독을 끄고 `TutorialScreen mode="together"` 만 렌더(띠·알림음 중복 방지, Pitfall 4). 그 밖의 표: `PHASE_ANNOUNCE`(:55)에 `tutorial: () => "튜토리얼"`.

---

### `src/audio/recipes.ts` (config) + `src/audio/voice.ts`

**Analog 레시피:** :252, :289-292
```typescript
"ui.tap": recipe("ui.tap", "ui", 2, -20, [osc("triangle", 0, 60, [520, 480], 1, perc(60))], { gapMs: 80 }),
"day.start": recipe("day.start", "sfx", 1, -16, [
  osc("sine", 0, 1200, 196, 1, [5, 1195, 0, 30]),
  osc("sine", 0, 1200, 392, 0.7, [5, 1195, 0, 30]),
]),
```
`SFX_IDS`(:127-)에 id 추가(50→63), `SCREEN_COUNTERPART`(:556-)에 한 줄 설명 행 필수(`"ui.tap": "눌린 버튼의 눌림 모양"` 형식). 한계: `MAX_LAYERS 4`, `MAX_RECIPE_MS 3000`, `NODE_BUDGET 48`. `voice.syl` 은 `ui` 버스, 레이어 2, `max 2`, `gapMs 0`. `tut.fanfare` 는 4음 한 레시피.

**voice.ts:** RESEARCH :419-435 골격 그대로(`sayItems(text)` → `engine.runScript("voice.host", items)`). 문구는 인자로만 받는다 — `src/audio/**` 에 `mafia|whisper`·`chat` 낱말 금지(`test/unit/soundStaticGuard.test.ts:25-26`), import 도 제한.

---

### 테스트 파일들

**클라이언트:** `test/client/errandScreen.test.tsx:1-40` 의 틀을 복사 — `vi.hoisted` 로 `useRoomConnection` 모킹, `WorldStage` 는 props 만 쥐는 가짜(`stage.props`), `"../helpers/singleLineErrors"` 임포트, `afterEach(cleanup)`. 가짜 view 의 `NOW = 1_700_000_000_000` 고정 시각.

**워커:** `test/worker/errandLeak.test.ts:1-40` — `cloudflare:workers`·`cloudflare:test` 임포트, `test/worker/helpers.ts` 의 `connect·send·settle·startedGame·storedRoom·lastViewOf` 사용, "오지 않았음" 은 `settle`(ping/pong)로 증명. 역할 5종 시점 동일성은 이 틀로.

**누설:** `test/worker/leak.test.ts:113` `SERVER_ONLY_KEYS` 끝에 `"tutorialPassed"` 추가.

**정적 가드:** `test/unit/soundStaticGuard.test.ts` 의 `{ label, re }` 배열 방식으로 `tutorialStaticGuard.test.ts`(대본에 `role`·실제 닉네임 금지, `crimson` 사용처 세 곳) 작성.

## Shared Patterns

### 구조적 비누설 (TUT-05)
**Source:** RESEARCH Pattern 1. `GameMap`/`WorldStage` 에 실제 `send`/`canSend` 를 절대 넘기지 않는다. `TutorialScreen` 의 `connection.send({t:"tutorialDone"})` 한 곳만 예외. **Apply to:** `TutorialScreen`, 모든 장면 렌더.

### 서버 조기 종료
**Source:** `worker/room.ts:915-926` (`tick({...state, phaseEndsAt: now})` + `afterTransition`). **Apply to:** `handleTutorialDone`, 연결 끊김 재검사.

### 오디오 잠금 해제
**Source:** `src/screens/Home.tsx:75,85,110`. **Apply to:** 큰 카드 탭, [방 만들기]/[참가] 기존 유지.

### 허용 목록 view 빌더 / 서버 전용 이름
**Source:** `shared/game/view.ts:91-92,327-330`, `shared/game/rematch.ts:16-17`. **Apply to:** `view.tutorial`·`me.tutorialDone`(공개 이름) vs `tutorialPassed`(서버 전용, 이름이 달라야 누설 시험 키 목록에 넣음).

### 단계 이름 표 연쇄 (Pitfall 1)
`PhaseId` 에 `"tutorial"` 을 더할 때 같은 계획에서 고칠 표: `phases.ts:74 PHASE_DEFS`, `scenes.ts:35 PHASE_SCENE`, `RoomScreen.tsx:55 PHASE_ANNOUNCE`, `TestTools.tsx:21 TEST_PHASE_LABEL`, `director.ts:25 BED_OF`, `test/worker/emotePhases.test.ts KIND`, `test/client/phaseScreens.test.tsx:401`, `audience.ts:102 worldVisibleTo`.

### 고정값 시험 갱신 (Wave 0)
소리 57→70·SFX 50→63: `soundRecipes.test.ts`, `soundProvenance`, `soundLab*`, `e2eContract.test.ts`, `sound-render` E2E, `docs/audio.md`. 방장 패널: `scripts/e2e/flows.mjs:572 CHAT_LOBBY_EXTRA = 154`, `lib.mjs`.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `src/components/v2/OpeningFx.tsx` (램프 꺼짐·비명 연출) | component | event-driven | 로컬 대본 기반 연출 오버레이는 기존에 없음. `WorldStage` 의 `scene?: SceneLook`(:238)을 직접 만들어 주입, 투영 API 없음(Pitfall 12) — RESEARCH Q1·Q3 사용 |
| 웅얼 목소리 파형 `speaking` 타이머 | hook | streaming | 기존에 엔진 무관 타이머 구동 파형 없음 — RESEARCH Q2 T-13 규칙 사용 |

## Metadata

**Analog search scope:** `shared/game/`, `worker/`, `src/screens/`, `src/components/v2/`, `src/audio/`, `src/net/`, `src/styles/`, `test/{client,worker,unit}/`, `scripts/e2e/`
**Files scanned:** 약 25 (부분 읽기 포함)
**Pattern extraction date:** 2026-11-09

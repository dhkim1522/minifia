# Phase 21: 원인→결과 하루 흐름과 등불·집 찾기·현장 조사 - Pattern Map

**Mapped:** 2026-11-14
**Files analyzed:** 신규 12 + 수정 약 25 (아래 표)
**Analogs found:** 신규 12 / 12 (모두 git 추적 소스, 미러 경로 없음)

> 이 문서는 RESEARCH.md 의 Pattern 1~9 를 대체하지 않고, "새 파일이 어느 기존 파일을 베끼는가"만 못 박는다. 줄 번호는 이 세션에서 직접 읽은 것이다. 시험 파일은 읽은 머리 부분만 발췌했다.

## File Classification

| 새/수정 파일 | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `shared/game/lamps.ts` (신규: 등불↔집 표, `houseLitOf`, `cut` 기록) | service(순수 규칙) | transform | `shared/game/errandFake.ts` (역할을 읽는 유일 모듈) + `errand.ts` | exact |
| `shared/game/scene.ts` (신규: buildScene·inspectSpot·흐려짐) | service(순수 규칙) | CRUD/transform | `shared/game/trace.ts` + `errand.ts actErrand` | exact |
| `shared/game/skip.ts` (신규 or discussion.ts 일반화) | service | request-response | `shared/game/discussion.ts` `toggleEnd`/`endCountOf`/`endReached` | exact |
| `shared/game/ruleset.ts` (수정: `cause` 플래그) | config | - | 같은 파일 `errand/witness/trace` 줄 | exact |
| `shared/game/phases.ts` (수정: `nextPhaseOf`, 길이 상수) | config | - | 같은 파일 102-105 `dayAnnounce` 분기 | exact |
| `shared/game/tick.ts` (수정: `hooksOf(rules)`) | service | event-driven | 같은 파일 `hooksOf` (nomination 줄이 규칙 주입 선례) | exact |
| `shared/game/night.ts` (수정: `enterNight`·`enterMorning`) | service | transform | 같은 파일 | exact |
| `shared/game/errand.ts` (수정: `actErrand(hold)`, 가로등 후보) | service | request-response | 같은 파일 | exact |
| `shared/game/mapTown.ts` (수정: 가로등 8·단서 지점·이웃 표) | config(상수) | - | 같은 파일 `TOWN_HOUSES` (75-84) | exact |
| `shared/game/movement.ts`·`audience.ts`·`gather.ts`·`view.ts` (수정) | service | request-response | 각자 같은 파일의 단계 분기 | exact |
| `shared/protocol.ts`·`shared/schemas.ts` (수정: `inspect`·`skip`·hold·`PlaceId`) | model | request-response | 기존 `errand` 메시지 + strictObject | exact |
| `worker/room.ts` (수정: handleInspect·handleSkip·syncHome) | controller(DO) | request-response + event-driven | 같은 파일 `applyErrand`/`handleErrand` | exact |
| `src/components/v2/HouseTag.tsx` (신규) | component | request-response | `src/components/v2/FaceList.tsx` + `ErrandAct.tsx` | role-match |
| `src/components/v2/ClueSpot.tsx` (신규) | component | event-driven | `ErrandMarker.tsx` | exact |
| `src/components/v2/ClueCard.tsx` (신규) | component | transform | `EvidenceCard.tsx` | exact |
| `src/components/v2/SuspectBoard.tsx` (신규) | component | transform | `RecordCard.tsx` (+`TutorialEvidence.tsx` 가짜 view 재사용) | role-match |
| `src/game/sceneView.ts`·`sceneText.ts` (신규, 순수) | utility | transform | `src/game/errandView.ts`, `traceMark.ts`, `traceText.ts`, `recordView.ts` | exact |
| `src/world/maps/town.ts`·`camera.ts`·`presence.ts` (수정) | provider/utility | streaming(프레임) | 같은 파일 (`setOwners` 438-455, `lightingFor` 147-151) | exact |
| `src/screens/GameMap.tsx`·`GamePanel.tsx`·`WorldStage.tsx` (수정) | component | request-response | 같은 파일 (`RecordCard` 408-447, `ErrandLayerProps`) | exact |
| `src/game/tutorialScript.ts`·`TutorialScreen.tsx` (수정) | config/component | - | 같은 파일 | exact |
| `test/unit/lamps.test.ts`·`scene.test.ts`·`skip.test.ts` (신규) | test | - | `test/unit/trace.test.ts`, `errandFake.test.ts` | exact |
| `test/worker/causeLeak.test.ts`·`causeFlow.test.ts` (신규) | test | event-driven | `test/worker/errandLeak.test.ts`, `townLeak.test.ts` | exact |
| `test/client/*.test.tsx` (신규) | test | - | `test/client/errandParts.test.tsx`, `recordTrace.test.tsx` | exact |
| `scripts/e2e/cause.mjs` (신규) + `flows.mjs`·`lib.mjs`·`browser.mjs` | test(E2E) | event-driven | `scripts/e2e/errand.mjs`, `town.mjs` | exact |
| `test/unit/e2eContract.test.ts` (수정: 새 상수 사본 대조) | test | - | 같은 파일 | exact |

## Pattern Assignments

### `shared/game/lamps.ts` (순수 규칙, 역할을 읽는 곳)

**Analog:** `shared/game/errandFake.ts` (전체 24줄). 머리 주석에서 "역할을 읽는 유일한 파일, errand.ts 는 역할을 읽지 않는다" 불변식을 선언한다. 같은 문장 구조로 `lamps.ts` 가 `errandCut` 을 쓰는 유일한 모듈임을 적는다.

**핵심 패턴** (errandFake.ts 14-24):
```ts
export function assignErrandFake(state: RoomState): RoomState {
  const day = state.day ?? 1;
  return {
    ...state,
    players: state.players.map((p) => {
      const { errandFake: _old, ...rest } = p;
      if (p.role !== "mafia" || !isAlive(p) || p.errandPlaces === undefined || p.errandPlaces.length === 0) return rest;
      return { ...rest, errandFake: p.errandPlaces[(p.seat + day) % p.errandPlaces.length] };
    }),
  };
}
```
적용: (a) 난수·시각 안 부름, 입력 불변, (b) 남은 키는 구조분해로 키째 지움, (c) 마피아 판정은 `p.role` 한 곳. `errand.ts` 의 `actErrand` 는 `hold` 인자와 `errandCut` 키 이름만 다루고 역할을 읽지 않는다(Player.errandCut 쓰기는 `lamps.ts` 에서 마피아일 때만).

**시험 이름 배치 선례:** `errandFake.test.ts` 가 "역할을 읽는 심부름 파일은 errandFake.ts 하나뿐" 을 `readFileSync` 로 소스 문자열 대조한다. `lamps.test.ts` 도 같은 방식으로 `errand.ts`/`scene.ts` 가 `.role` 을 안 읽는지 단언(scene.ts 가 `touched` 를 위해 역할을 읽어야 하면 그 유일 파일로 선언하고 시험도 맞춘다).

---

### `shared/game/scene.ts` (현장 단서)

**Analog 1:** `shared/game/trace.ts` — 풀·조각 뽑기. 머리 4줄 주석(역할 안 읽음·난수는 인자·입력 불변)과 `traceCandidates`(33-37)를 그대로 재사용한다. 발자국 수 = `traceCandidates(state, victimSeat).length`.
```ts
export function traceCandidates(state: RoomState, victimSeat: number): Player[] {
  return state.players
    .filter((p) => isAlive(p) && p.seat !== victimSeat && p.nightPick === victimSeat)
    .sort((a, b) => a.seat - b.seat);
}
```
`pickTracePiece(state, victimSeat, randInt)` 는 풀이 비면 난수를 안 부른다(trace.ts 40 이후). 창문 단서의 두 번째 난수는 **새 분기 안에서만** 호출을 늘려 기존 시드 시험(bots.ts 머리 계약)을 지킨다.

**Analog 2:** `errand.ts actErrand` (92-128) — inspect 의 모양. 단계 검사 → 행위자 산 사람 → 반경(`ERRAND_ACT_R * UNIT`) 안 가장 가까운 미처리 하나 → 모두 `{ ok: false }` 하나로 거절(사유 구별 없음 L40). 반환 타입 `{ ok:true; state } | { ok:false }` 복사.
```ts
if (state.phase !== "errand") return { ok: false };
...
const reach = ERRAND_ACT_R * UNIT;
...
if (d <= reach * reach && d < bestD) { bestD = d; best = id; }
...
if (best === undefined) return { ok: false };
```
호출 지점은 `enterMorning`(night.ts 154) 안, `nightPick` 을 지우기 전. `enterNight` 가 지우는 키 목록(night.ts 46-48 구조분해)에 확장판은 `errandPlaces/errandDone/errandSeen` 을 **지우지 않는** 분기를 더한다(토론 목격 기록용, 함정 2).

---

### `shared/game/skip.ts` (또는 `discussion.ts` 일반화)

**Analog:** `shared/game/discussion.ts` 50-81 `toggleEnd`/`endCountOf`/`endReached`. 검사 순서가 계약이다: 단계 → 행위자 산 사람 → 불리언 → 이미 그 상태면 입력 상태 그대로 ok → 키만 바뀐 새 상태. 단계 조건을 `errand`/`morning` 으로 바꾸고, 진입 훅이 키를 지운다(`enterDiscussion` 의 구조분해 88-90 모양 — 저녁 표가 아침으로 새지 않도록 각 진입 훅이 `endVote` 를 지운다).

---

### `shared/game/ruleset.ts`

**Analog:** 같은 파일의 플래그 + `RULES_BY_MODE`. 새 플래그는 인터페이스에 한 줄(결정 번호 주석) + 두 `Object.freeze` 줄에 값 추가. `Record<GameMode, Ruleset>` 라 한 곳을 빠뜨리면 컴파일 실패.
```ts
basic: Object.freeze({ ...POLITICS_OFF, errand: false, witness: false, trace: false /* cause: false */ }),
extended: Object.freeze({ ...POLITICS_OFF, errand: true, witness: true, trace: true /* cause: true */ }),
```
주의: 옛 전역 규칙 상수 이름은 어디에도 적지 않는다(`e2eContract.test.ts` 가 대조, ruleset.ts 머리 주석).

---

### `shared/game/phases.ts` / `tick.ts`

**phases.ts 102-105 (분기 확장):**
```ts
export function nextPhaseOf(phase: PhaseId, rules: Ruleset): PhaseId | null {
  if (phase === "dayAnnounce") return rules.errand ? "errand" : "discussion";
  return PHASE_DEFS[phase].next;
}
```
`rules.cause` 분기를 `roleReveal`·`errand`·`morning`·`execution` 에 추가. 길이 상수는 61-70 블록(`ERRAND_MS` 등)처럼 "결정 번호 + 플레이테스트 뒤 이 줄만 고친다" 주석 한 줄씩(`LAMP_MS`·`MORNING_SCENE_MS=30_000`). 리터럴 `"night"` 가 `nomination.ts:89`·`runoff.ts:56,100,102`·`showdown.ts:71,153` 에 있으므로 도우미 `afterDayPhase(rules)` 하나로 모은다.

**tick.ts 69-90 (훅 표):** `hooksOf(rules)` 가 이미 규칙 주입 선례를 가진다. 같은 모양으로:
```ts
errand: (s, r, at) => assignErrandFake(enterErrand(s, r, at)),   // cause 면 assignErrandFake 를 빼고 enterErrand 앞에서 day+1
morning: (s, r) => enterMorning(s, r, rules),
nomination: rules.pickTurn ? enterNomination : enterVote,
```
`HOOKS` 는 `GAME_MODES.map(mode => hooksOf(rulesetOf(mode)))` 로 모듈 로드 때 한 번 만든다(tick.ts 95 부근) — 새 분기도 이 표 안에서만 만든다. 일차 증가는 `enterDayAnnounce`(tick.ts 42-44) 의 `day: (state.day ?? 0) + 1` 을 errand 진입 훅으로 옮겨 복사.

---

### `shared/game/mapTown.ts` (가로등·단서 지점 상수)

**Analog:** 같은 파일 `HouseDef`/`TOWN_HOUSES` (60-84). 인터페이스 + 좌석 순서 고정 리터럴 표 + "리터럴, 시험이 정의식과 대조" 주석. 새 상수(`TOWN_LAMPS`, `TOWN_CLUE_SPOTS`, `LAMP_OF_HOUSE`)도 리터럴로 쓰고 `test/unit/mapTown.test.ts` 가 정의식(가장 가까운 등불·문 앞 오프셋·걷는 칸·간격 ≥ 1.0)과 대조한다. 좌석 0·7 은 `front` 가 모서리 쪽(주석 73) — 지점은 그 칸에 맞춘다.

---

### `worker/room.ts` (inspect·skip·errand hold)

**Analog:** 같은 파일 `applyErrand`(1035 부근 주석: "errandAct 는 사람의 errand 메시지와 같은 applyErrand 본체다. 난수 없음, 특권 없음"). 복사할 규칙: 받아들이면 `storage.put("room")` 한 번 + `sendViewTo([playerId])` (본인에게만), 거절은 같은 모양으로 무응답/무구별. 저장 횟수·타이밍이 역할과 무관해야 한다. `captureHomeNow` 의 `room.phase === "errand"` 조건, `snapFrameFor`(1467), `canMove`(1962) 는 `rules.cause` 분기를 더한다.

---

### `src/components/v2/ClueSpot.tsx` ← `ErrandMarker.tsx`, `HouseTag.tsx` ← `FaceList.tsx`+`ErrandAct.tsx`

**ErrandAct.tsx 머리 (복사할 계약):** 역할·좌석·가짜 prop 이 없고 id 하나만 받는다, 마크업은 모든 역할이 같다, 위치는 맵 층(WorldStage)이 프레임마다 DOM 에 쓴다, 누르면 필드 없는 메시지만.
```tsx
export interface ErrandActProps { id: PlaceId; call: boolean; onPress: () => void; style?: CSSProperties; hidden?: boolean; }
<button type="button" className={call ? "mv-errand-act is-call" : "mv-errand-act"} data-errand-act="" data-call={call ? "" : undefined} aria-label={`${PLACE_NAME[id]}에서 처리`}
```
새 부품은 `data-*` 훅 이름(`data-clue-spot`, `data-house-tag`)과 `is-call` 클래스를 같은 방식으로 쓰고 `me.role` 을 읽지 않는다(안티패턴). E2E 도우미가 `[data-errand-act]` 식 속성으로 누른다(`scripts/e2e/browser.mjs pressErrandAct`).

**SuspectBoard.tsx:** `RecordCard` 껍데기(GameMap.tsx 408-447, `recordOpenKey`)를 이어받고 파생은 `src/game/` 순수 함수(`recordView.ts`, `traceMark.ts` 의 `sameOutfitSeats`·`TRACE_MARK`)로. 튜토리얼이 같은 부품을 가짜 view 로 그리므로 서버 훅·`me.role` 직접 접근 금지(TUT-05, `TutorialEvidence.tsx` 가 선례).

---

### 시험 패턴

**유닛(순수 규칙) — `trace.test.ts` 1-50:** 머리 한 줄 주석(페이즈·결정·위협 ID) → 실제 전이로 상태 생성(`lobbyOf(n)` → `startGame(lobby, hostId, START_AT, seededRandInt(seed))` → `while (state.phase !== X) state = tick(state, state.phaseEndsAt, seededRandInt(seed))`). 새 시험도 `nightOf()` 처럼 `errandOf()`/`morningOf()` 헬퍼를 이 방식으로 만든다(수작업 상태 조립 금지). 임포트 도우미: `test/helpers/seededRandom` `seededRandInt`, `test/helpers/voteState` `startedAt(n, seed, "dayAnnounce")`.

**잠금 — `test/helpers/playable.ts:38 lockModeMaps()`**, `test/unit/setup.ts:6` 에서 전역 호출. 확장판의 고정 맵을 시험 동안 재즈 바로 잠가 둔 장치다(마을 판 시험은 49행의 켜기 도우미를 쓴다). RESEARCH Open Q 2 가 권하는 "옛 순서 시험 보호 → 마지막에 걷기" 도 같은 모양의 잠금을 `setup.ts` 에 더한다. 시험 이전 규모: `grep -rl dayAnnounce test` 81개, `errand` 직접 사용 40개 — 먼저 목록을 뽑아 계획에 넣는다.

**워커 누설 — `test/worker/errandLeak.test.ts` 1-50, `townLeak.test.ts` 1-60:**
- 머리 주석: "허용 목록 검사", "역할 다섯 시점(마피아·경찰·의사·시민·유령)이 받은 실제 소켓 프레임을 모아 단언", "오지 않았음은 `settle`(ping/pong) 로 증명", "서버 구현 함수를 다시 쓰지 않고 독립 계산", "실패 출력은 한 줄(TAP) 이라 문자열 비교".
- 임포트 도우미: `test/worker/helpers.ts` 의 `startedGame`·`actorsOf`·`advanceTo`·`connect`·`mark`·`settle`·`withRole`·`writeRoomEdit`·`worldFramesOf`·`lastViewOf`·`pickAs`·`moveAs`.
- 금지 키 검사: `const FORBIDDEN_KEYS = ["token","id","playerId","connId","nicknameKey","joinSeq","hostId"]` + 서버 전용 이름 목록. 새 서버 전용 이름(`errandCut`, `touched`, `footprints`, `sceneSeen`)을 이 목록에 더한다.
- 시간은 기다리지 않는다: `advanceTo(code, sockets, phase)`, `writeRoomEdit`(상태 직접 수정), 표본 알람은 `errandTickAt` 을 과거로 당겨 `runDurableObjectAlarm`.
- 시나리오 템플릿: `townLeak` 처럼 저녁 → 밤 → 아침 → 토론을 한 번 훑으며 모든 world 프레임을 판정 함수 한 곳(`judge`)에서 검사. 새 `causeLeak.test.ts` 는 "마피아 view 와 시민 view 의 키 집합 같음", "마피아가 먼저 살핀 응답 프레임이 시민의 것과 모양·개수 같음", "`day.lamps` 에 cut/미처리 구별 없음", "아침 world 수신자가 근처만" 을 넣는다.

**클라이언트:** `test/client/errandParts.test.tsx`, `recordTrace.test.tsx` 형태(부품 렌더 + 속성·마크업 동일성). HOST-05 시험은 hostLine 이 읽는 경로를 기록해 고정하므로 새 읽기 경로(`view.mode`, `me.scene`)를 허용 목록에 명시한다.

**E2E:** `scripts/e2e/errand.mjs` 머리 — 흐름 이름은 `--only` 부분 일치가 겹치지 않게 짓는다(`cause` 는 `errand` 와 부분 일치 안 함). helpers 는 `flows.mjs` 가 주입(`{ recorder, attempt, startHost, openGuest, closeGame, gameGH }`), 서로 import 하지 않는다. 판정은 `lib.mjs` 순수 함수(`errandChecks` 모양)에 두고 흐름은 화면을 읽기만 한다. 닉네임·토큰은 결과 줄에 남기지 않는다. 시간 부족은 `SetupError` 로 던져 재시도(판정 완화 금지). `lib.mjs` 상수는 `test/unit/e2eContract.test.ts` 의 사본 대조(앱 상수 import 후 `lib.mjs` 와 비교)에 새 상수를 더한다. 확장판·기본 마피아 두 판은 `modes.mjs` 선례를 따른다.

## Shared Patterns

### 판 규칙 분기
**Source:** `shared/game/ruleset.ts` `rulesetOf(modeOf(state|view))`. 서버·화면 모두 규칙 객체를 한 번 얻어 `rules.cause` 를 읽는다. `view.mode === "extended"` 직접 비교 금지.

### 허용 목록 리터럴 view
**Source:** `shared/game/view.ts` 285-295 (`me.errand`, `me.record`): 게이트 `rules.X && state.phase === "…" && isAlive(me)` 후 필드별 복사 `{ places: [...me.errandPlaces], done: [...] }`. 서버 상태를 펼치지 않고 역할을 읽지 않는다. 새 키 `me.scene`·`day.lamps`·`day.scene` 이 같은 모양이다.

### 거절 응답 비구별
**Source:** `errand.ts actErrand` 반환 `{ ok: false }` 하나. 새 `inspectSpot`·`skip` 도 사유 구별 없는 거절(L40).

### 난수·시각은 인자
**Source:** `trace.ts`(`type RandInt = (n: number) => number`), `errand.ts enterErrand(state, randInt, at)`. 난수 호출 순서는 시드 시험의 계약이라 기존 분기에 호출을 끼우지 않는다.

### 진입 훅의 키 청소
**Source:** `night.ts enterNight` 41-53, `discussion.ts enterDiscussion` 88-: 구조분해 `{ x: _x, ...rest }` 로 키째 지운다. 새 서버 전용 키(`errandCut`, `scene`, `sceneSeen`, 건너뛰기 표)는 해당 단계 진입 또는 다음 진입 훅이 반드시 지우는 줄을 같이 쓴다.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| 개관 카메라 기저(`camera.ts` overview 모드) | utility | streaming | 현재 카메라는 경사 시점 한 가지 상수(`CAM_YAW` 등)뿐이다. `groundToScreen`·`screenRay`·`threeCamera.ts`·`threeRenderer.ts` 를 모드별 기저로 일반화해야 하고 `cameraThree.test.ts` 로 두 구현의 일치를 증명한다(RESEARCH 함정 9, 위험 큼). |
| 의심 보드의 "꺼진 등불 줄" | component | transform | 해당 UI 없음. `RecordCard` 껍데기 + `TRACE_MARK` 로 구성하되 줄 자체는 UI-SPEC 을 따른다. |
| `houseLit` 열 조명(밤 역할 무관 통일) | config | - | `lightingFor` 가 `me.role` 로 갈린다(presence.ts 147-151). 새 규칙이 아니라 기존 분기를 확장판에서 끄는 일이라 선례 없음. `palette.test.ts` 갱신 필요. |

## Metadata

**Analog search scope:** `shared/game/`, `worker/room.ts`, `src/components/v2/`, `src/world/`, `test/unit`·`test/worker`·`test/client`·`test/helpers`, `scripts/e2e/`
**Files read:** errandFake.ts, trace.ts(1-40), errand.ts(60-140), night.ts(40-60), discussion.ts(45-95), ruleset.ts, phases.ts(60-110), tick.ts(60-110), mapTown.ts(60-95), view.ts(280-295), ErrandAct.tsx, trace.test.ts, errandFake.test.ts, errandLeak.test.ts, townLeak.test.ts, errand.mjs 머리, e2eContract.test.ts 머리, test helpers 목록
**Tracked-source gate:** 위에 인용한 경로는 모두 저장소 소스(`shared/`, `src/`, `worker/`, `test/`, `scripts/`) — `.gsd/capabilities` 미러 경로 없음. `git ls-files` 로 확인한 것은 `mapTown.ts`·`town.ts`·`e2eContract.test.ts`(나머지는 같은 추적 트리).
**Pattern extraction date:** 2026-11-14

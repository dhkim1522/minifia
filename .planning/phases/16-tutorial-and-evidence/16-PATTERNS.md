# Phase 16: 단추 정리·심부름 증거 - Pattern Map

**Mapped:** 2026-11-08
**Files analyzed:** 20 (신규 9 · 수정 11 묶음)
**Analogs found:** 19 / 20
**범위:** 튜토리얼(17페이즈) 제외. 아래 모든 경로는 git 추적 소스(`git ls-files` 로 확인한 `shared/`·`src/`·`test/`·`scripts/`·`design/v3.0/`)다.

## File Classification

| 신규/수정 파일 | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `shared/game/errandFake.ts` (신규) | service(순수 규칙) | transform | `shared/game/errand.ts` (`enterErrand`) | role-match |
| `shared/game/errand.ts` (수정: `actErrand` 가짜 제외, `sampleErrand` 가 `errandLast` 갱신) | service | request-response / batch 표본 | 자기 자신 `errand.ts:85-178` | exact |
| `shared/game/tick.ts` (수정: ON_ENTER.errand 감싸기) | config(전이 표) | event-driven | `tick.ts:52-58` | exact |
| `shared/game/night.ts` (수정: `enterNight` 키 삭제, `enterMorning` 에 `seen`) | service | transform | `night.ts:39-50` | exact |
| `shared/game/room.ts` (수정: `Player.errandFake`, `RoomState.errandLast`) | model | CRUD | `room.ts:85` `errandSeen?` | exact |
| `shared/protocol.ts` · `shared/game/view.ts` (수정: `MorningView.seen`, `DayView.evidence`) | model/view | request-response | `view.ts:131-145` morning 블록 | exact |
| `worker/room.ts` (수정: `errandMarks` 에 `errandLast` 포함) | controller(DO) | event-driven | `worker/room.ts:1954-1955`(자기 자신) | exact |
| `src/components/ToolButton.tsx` (수정: `word` 삭제, `name` 필수) | component | request-response | 자기 자신 | exact |
| `src/components/v2/SideColumn.tsx` (신규) | component | request-response | `src/components/v2/SoundButton.tsx` + `MapChip.tsx` | role-match |
| `src/components/v2/placeArt.tsx` (신규, 생성물) | component(정적 SVG 표) | transform | `src/components/v2/V2Icon.tsx:148-232` `place*` | role-match |
| `scripts/make-placeart.mjs` (신규) | utility(일회성 변환) | file-I/O | `scripts/gen-tokens.mjs` (+ `--check` 방식) | role-match |
| `src/components/v2/{ErrandStartCard,ErrandAct,ErrandDots}.tsx` (신규) | component | event-driven | `ErrandMarker.tsx`, `ErrandDock.tsx` | role-match |
| `ErrandMarker.tsx` 의 `ErrandArrow` (재작성) | component | transform | 자기 자신 `ErrandMarker.tsx:46-64` | exact |
| `src/components/v2/EvidenceCard.tsx` (신규) | component | request-response | `src/components/v2/TraceCard.tsx` | exact |
| `src/components/v2/HeadStack.tsx` (수정: `traceMark`·`seenMark`) | component | request-response | 자기 자신 | exact |
| `src/game/hostLine.ts` (수정: 문구 분기) | utility | transform | 자기 자신 + `hostLine.test.ts` 읽기 경로 고정 | exact |
| `src/styles/v2.css` (수정) | config(CSS) | — | `v2.css:89-97,216` `.mv-tool` | exact |
| `test/unit/errandFake.test.ts`·`placeArt.test.ts` (신규) | test | — | `test/unit/errand.test.ts` | role-match |
| `test/client/sideColumn.test.tsx`·`evidenceCard.test.tsx` (신규) | test | — | `test/client/toolLabels.test.tsx` | role-match |
| `shared/game/phases.ts` (수정: `MORNING_TRACE_MS`·`MORNING_MAX_MS`) | config | — | 상수 줄 자체 | exact |

## Pattern Assignments

### `shared/game/errandFake.ts` (service, transform)

**Analog:** `shared/game/errand.ts`

**머리 주석·import 규약** (errand.ts:1-15): 순수 모듈(시각·난수 인자만, 입력 불변), 한국어 머리 주석으로 불변식을 쓴다. 이 파일이 심부름 모듈 중 `.role` 을 읽는 유일한 곳이다. errand.ts 머리 주석("이 파일은 역할을 읽지 않는다")은 그대로 유지한다.
```typescript
import { isAlive } from "./alive";
import type { RoomState } from "./room";
```

**핵심 패턴**: 난수 없이 `(seat + day) % places.length` 로 배정, `players.map` 으로 새 객체를 돌려준다(입력 상태 불변). 산 마피아의 `errandPlaces` 가 있을 때만 `errandFake` 를 쓴다.
```typescript
export function assignErrandFake(state: RoomState): RoomState {
  return { ...state, players: state.players.map((p) => {
    if (p.role !== "mafia" || !isAlive(p) || p.errandPlaces === undefined) return p;
    return { ...p, errandFake: p.errandPlaces[(p.seat + (state.day ?? 1)) % p.errandPlaces.length] };
  }) };
}
```

**tick.ts 연결** (tick.ts:54): 현재 `errand: enterErrand,` 를 `errand: (s, r, at) => assignErrandFake(enterErrand(s, r, at)),` 로 감싼다. `enterErrand` 가 `errandFake` 를 비우는지 확인한다(재배정 시 삭제).

---

### `shared/game/errand.ts` (수정)

**`actErrand` 가짜 제외** (errand.ts:102): 한 줄 변경. 이 줄은 역할이 아니라 `errandFake` 키만 읽는다.
```typescript
for (const id of actor.errandPlaces) {
  if (done.includes(id) || id === actor.errandFake) continue;
```
후보가 없으면 기존 `return { ok: false }`(errand.ts:114) 경로를 그대로 탄다. 새 오류 프레임을 만들지 않는다.

**`sampleErrand` 의 `errandLast` 갱신** (errand.ts:157-178): `nearSeats` 루프에서 쓰는 `nearestPlaceId(map, there)`·`posOf`·`isAlive` 를 재사용한다. 피해자 후보 B 마다 "B 가 A 의 반경 안에 있는 표본에서 A 가 가장 가까우면 `{seat: B.seat, by: A.seat, place}`" 로 최신 한 줄을 덮어쓴다(동률은 낮은 좌석). 반환은 `{ ...state, players, errandLast, errandTickAt: at + ERRAND_TICK_MS }`.

---

### `shared/game/night.ts` (수정)

**`enterNight` 키 삭제** (night.ts:46): 구조분해 목록에 `errandFake: _errandFake` 만 더한다. `errandLast` 는 지우지 않는다(`enterMorning` 이 소비).
```typescript
const { nightPick: _nightPick, errandPlaces: _errandPlaces, errandDone: _errandDone, errandNear: _errandNear, errandSeen: _errandSeen, ...kept } = p;
```
`enterMorning` 은 피해자 줄을 `errandLast` 에서 꺼내 `morning.seen = { seat: by, place }` 로 옮기고 `errandLast` 를 지운다. 피해자·줄이 없으면 `seen` 키를 만들지 않는다.

---

### `shared/protocol.ts` · `shared/game/view.ts` (view 허용 목록)

**Analog:** `view.ts:131-145` morning 블록 — 필드별 복사, 역할·좌석 값 없음.
```typescript
const morning: MorningView = {};
if (result?.eliminated !== undefined) {
  morning.eliminated = result.eliminated;
  if (result.trace !== undefined) morning.trace = result.trace;
}
```
- `MorningView` 에 `seen?: { seat: number; place: PlaceId }` 를 더하고 같은 방식으로 필드별 복사한다.
- `buildDay` 에 새 키 `day.evidence = { trace?, seen? }` 를 더한다. 조건은 단계가 morning..execution 이고 `state.morning` 에 `trace` 또는 `seen` 이 있을 때다. `day.morning` 은 건드리지 않는다.
- 허용 키 시험 갱신 목록: `test/unit/view.test.ts`·`scripts/e2e/lib.mjs VIEW_DAY_KEYS`·`test/worker/errandLeak.test.ts`·`leak.test.ts`·`test/unit/e2eContract.test.ts`.

---

### `src/components/ToolButton.tsx` (수정, D-01)

**Analog:** 자기 자신(ToolButton.tsx:4-40). 바꿀 곳:
- `word` prop 삭제, `name` 을 필수 `aria-label` 로 한다.
- `data-tool-label` 속성과 `<span className="mv-tool__label">` 삭제.
- 면(`mv-tool__face`)만 남기고 44 정사각으로 한다.
```typescript
// 현재(삭제 대상)
data-tool-label={word}
<span className="mv-tool__label">{word}</span>
```
같은 방식으로 지울 곳: `SoundButton.tsx` 의 `TOOL_WORD`·`data-tool-label="소리"`, `MapChip.tsx:31`, `FloatAction.tsx:52`, `Button.tsx:14,31,48`, `Sheet.tsx:231`, `RoleCardButton.tsx:19`, `ChatPanel.tsx:422,434-447,486-515`, `DressSheet.tsx:74,86`, `WillSheet.tsx:108`, `RecordCard.tsx:26`, `ResultPanel.tsx:195`. 탭(`ResultPanel`·`DressSheet` 탭 2)은 글을 유지하고 `data-tool-label` 속성만 지운다(V-7).

**CSS** (`v2.css:89-97,216`): `.mv-tool__label`·`.mv-float__label`·`.mf-mapchip__label`·`.mv-sound__label` 규칙 삭제. `.mv-tool.is-call .mv-tool__label`(216) 은 `.mv-tool.is-call .mv-tool__face` 로 옮긴다(빛남 유지).

**시험 뒤집기** (analog: `test/client/toolLabels.test.tsx`): `[data-tool-label]` 0건 + 모든 `button` 이 비어 있지 않은 `aria-label` 을 갖는다는 불변식으로 바꾼다. 같이 고칠 시험은 RESEARCH Pitfall 1 목록을 따른다.

---

### `src/components/v2/SideColumn.tsx` (component, 신규)

**Analog:** `src/components/v2/SoundButton.tsx` (단추 한 개의 상태·data 표식 규약) + `MapChip.tsx`.

**data 표식 규약** (SoundButton.tsx:5-6): 표식은 `data-sound-button`·`data-sound-state=on|off|locked` 뿐이고 역할·좌석 값이 없다. SideColumn 은 같은 방식으로 `data-side-column` 하나만 둔다.

**규칙**: 방장은 소리·맵·봇·옷장 4칸, 손님은 소리·옷장 2칸. 모두 52 원, 오른쪽 정렬, 자막 띠 주변은 비운다. 소리 locked 알약(`PILL_FOLD_MS = 8000`)은 글 단추라 유지하고 오른쪽 정렬로 열이 흔들리지 않게 한다. [테스트] 버튼(`mf-lobby__test`)은 왼쪽 위에 그대로 둔다(A5).

---

### `src/components/v2/placeArt.tsx` + `scripts/make-placeart.mjs` (신규)

**Analog:** `src/components/v2/V2Icon.tsx:148-232`(`place*` 16개 삭제 대상, `thread` 는 남김). 사용처 두 곳(`RecordCard.tsx:36`, `ErrandMarker.tsx:40` 의 `placeIconOf`)과 `test/unit/errandView.test.ts:17,40` 를 먼저 `PLACE_ART` 로 바꾼 뒤 삭제한다.

**변환 규칙(RESEARCH 에셋 절)**: 원본은 `design/v3.0/tutorial/Main.dc.html` 의 `<svg … aria-label>` 25개. `viewBox="0 0 48 48"`, 속성은 camelCase 로 바꾸고(`strokeWidth`·`strokeLinejoin`·`strokeLinecap`), 루트 `width/height` 는 `size` prop 으로 대체한다. 정적 JSX 로 커밋하고 `dangerouslySetInnerHTML`·런타임 파싱은 쓰지 않는다. 사본은 `design/v3.0/assets/{id}.svg` 에 쓴다. aria-label 은 `src/game/placeText.ts` 의 `PLACE_NAME`, `src/game/traceText.ts` 의 `TRACE_TEXT` 와 1:1 이다.

**스크립트 analog:** `scripts/gen-tokens.mjs` 와 `package.json` 의 `tokens:check` — 생성 + `--check`(사본·JSX 일치 검사) 구조를 따른다. `npm install` 금지, Node 내장(`fs`, 정규식)만 쓴다.

---

### `src/components/v2/EvidenceCard.tsx` (component, 신규)

**Analog:** `src/components/v2/TraceCard.tsx` (전체 25줄) — 이 파일을 확장·대체한다.

**복사할 규약** (TraceCard.tsx:9-24): 모든 사람(유령 포함)에게 같은 카드, 누를 것이 아니라 빛도 단추도 없다. 조각 이름은 닫힌 표 `TRACE_TEXT` 에서만 오고, 속성 값에 조각 id·좌석·역할이 없다.
```tsx
<div className="mv-trace" data-trace-card="" role="status">
  <span className="mv-trace__disc"><V2Icon name="thread" size={24} /></span>
  <span className="mv-trace__text">
    <span className="mv-trace__name">{TRACE_TEXT[piece]}</span>
```
`<V2Icon name="thread">` 자리에 `TRACE_ART[piece]`(컬러), 마지막 목격(`{seat, place}`)은 `PLACE_ART[place]` 로 한 줄 더한다. 목격 줄이 없으면 "0" 표기는 UI-SPEC 을 따른다.

---

### `src/components/v2/HeadStack.tsx` + WorldStage 연결 (같은 옷 표시, D-09)

**규칙(R-3)**: 서버 계산 없음. 클라이언트가 `view.players[].look ?? "coat"` 와 `TRACE_OF_OUTFIT`(`shared/game/trace.ts:16-26`, 이미 export)의 역표(`Object.entries` 한 줄)로 계산한다. `__mfLooks`(E2E 훅)는 쓰지 않는다.
- `HeadStackProps` 에 `traceMark?: string`(`--trace-mark` CSS 변수로만 전달)·`seenMark?: boolean` 을 더한다.
- `WorldStage.tsx:210` 의 `tagProps(seat)` 훅으로 넘긴다.
- 속성은 `data-trace-mark`·`data-seen-mark` 로 하고 값에 좌석·역할을 넣지 않는다.

---

### `src/components/v2/{ErrandStartCard,ErrandAct,ErrandDots}.tsx` · `ErrandArrow` 재작성 (D-06)

**Analog:** `ErrandMarker.tsx` (표지·화살표), `ErrandDock.tsx` (삭제 대상, 진행 표시 참고).

**복사할 구조** (ErrandMarker.tsx:46-64): 화살표는 눌림을 통과하고 포커스가 없으며, 값 없는 `data-call` 표식과 `aria-hidden` 을 쓴다. `angle` 로 `rotate` 를 주는 구조를 글리프 화살표(40)로 옮긴다.
```tsx
<span className={call ? "mv-errand-arrow is-call" : "mv-errand-arrow"} data-errand-arrow="" data-call={call ? "" : undefined} aria-hidden="true" style={style} hidden={hidden}>
```
**주의**
- 시작 카드는 `pointer-events: none` 이지만 "아무 곳이나 누르면 닫힘" 이므로, 카드가 떠 있는 2초 동안만 루트에 캡처 단계 `pointerdown` 리스너를 둔다(Pitfall 5).
- 64 타일 전환 시 `WorldStage.tsx:75-76` 의 `PIN_HALF = 22`·`CHIP_HALF = 18` 이 따라와야 한다(Pitfall 6).
- 아래 패널을 없애면 `useMapInsets` 가 측정을 건너뛰므로(`panel === null`), 스테이지 아래 끝 = 0 으로 알리는 분기를 둔다. `GameMap.tsx:873-876` 의 `mf-game__panel--errand` 와 `ErrandDock`·`data-errand-dock/chip` 을 함께 삭제하고 시험은 "0건" 으로 뒤집는다(Pitfall 4).

---

### `src/game/hostLine.ts` (수정, D-11)

**Analog:** 자기 자신. `hostLine.test.ts` 가 읽기 경로를 기록·고정한다(HOST-05). `day.evidence.trace` 의 **유무**만 허용 목록에 더하고, 역할·`players[].look`·`seen` 내용은 읽지 않는다. 문구는 닫힌 표에서만 나온다.

---

### 시험 파일 (신규)

**Analog:** `test/unit/errand.test.ts` — 같은 구조를 따른다.
- `barRoom(seed, "errand", n)` 로 방을 만든다.
- `seededRandInt` 로 결정성을 확인한다.
- 입력 불변은 `JSON.stringify(base)` 동결 비교로 확인한다. 역할만 뒤집은 두 방 비교 패턴(errand.test.ts:130-139)은 `errandFake.test.ts` 에서 "마피아만 가짜를 받는다" 로 뒤집어 쓴다.

**수정할 기존 시험**
- `test/worker/errand.test.ts:125-133`: 마피아 봇은 2/3, 나머지는 3/3 으로 고친다.
- `test/worker/errandLeak.test.ts:45`: `SERVER_ONLY_NEW` 에 `errandFake`·`errandLast` 를 추가한다.
```typescript
const SERVER_ONLY_NEW = ["errandPlaces", "errandDone", "errandNear", "errandSeen", "errandTickAt", "nightPick"];
```
- `test/unit/trace.test.ts:247-249`: 아침 합 기대를 갱신한다.
- 마피아·시민 `me.errand` 프레임의 키 집합·길이가 같은지, 가짜 [처리] 응답 프레임이 반경 밖 [처리] 응답 프레임과 같은지를 새로 시험한다.

## Shared Patterns

### 서버 전용 필드 + 누설 시험
**Source:** `test/worker/errandLeak.test.ts:45,86`
**Apply to:** `errandFake`·`errandLast`·`morning.seen`·`day.evidence`. 서버 전용 키는 `SERVER_ONLY_NEW` 에 넣고, 새 공개 경로는 `ALLOWED_NEW_PATHS`/`NEW_PREFIXES` 에 명시한다. 값은 닫힌 집합 하나(`PlaceId`·`TracePiece`)와 `seat` 뿐이고 역할·의상 id·좌표는 없다.

### 순수 모듈·거절 하나
**Source:** `shared/game/errand.ts:1-4, 85-114`
**Apply to:** `errandFake.ts`, `actErrand`. 입력을 바꾸지 않고 새 객체를 돌려준다. 거절은 사유를 가르지 않는 `{ ok: false }` 하나다. 워커 `applyErrand`(`worker/room.ts:713-731`)는 거절 시 `sendViewTo([playerId])` 한 프레임만 보내며 새 오류 프레임·방송은 만들지 않는다.

### optional 필드로 저장 호환
**Source:** `shared/game/room.ts:85` (`errandSeen?: RecordLine[]`)
**Apply to:** `Player.errandFake?`, `RoomState.errandLast?`, `MorningView.seen?`. 모두 optional 이라 `normalizeStoredRoom` 변경이 필요 없다.

### 접근성 이름 불변식
**Source:** `ToolButton.tsx:27` `aria-label`
**Apply to:** 이름표를 지운 모든 아이콘 단추. `data-tool-label` 0건, `aria-label` 은 비어 있지 않아야 한다.

### 정적 JSX, 사용자 문자열 없음
**Source:** `TraceCard.tsx:9-11`, `ToolButton.tsx` 주석
**Apply to:** `placeArt.tsx`, `EvidenceCard.tsx`, SideColumn. 닉네임은 텍스트 노드로만 쓰고 SVG 는 정적 JSX 로만 쓴다.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `errandLast` 갱신 로직(`sampleErrand` 안) | service | batch 표본 | 피해자별 "마지막 관찰자" 를 쌓는 기존 규칙이 없다. `sampleErrand` 의 `errandNear` 비교 루프(errand.ts:162-176)를 뼈대로 쓰고 RESEARCH R-2 로 설계한다 |

## Metadata

**Analog search scope:** `shared/game/`, `src/components/`, `src/components/v2/`, `src/screens/`, `test/unit`, `test/client`, `test/worker`, `scripts/`
**Files scanned:** 약 15 (errand·night·view·tick·ToolButton·SoundButton·TraceCard·ErrandMarker·errand.test 등 직접 읽음)
**Pattern extraction date:** 2026-11-08
**미확인:** `MapChip`·`FloatAction`·`HeadStack`·`WorldStage` 는 줄 번호를 RESEARCH 에서 가져왔고 직접 읽지 않았다. 계획 실행 시 줄 번호를 다시 확인한다.

# Phase 18: 바로 고칠 것 - Pattern Map

**Mapped:** 2026-11-09
**Files analyzed:** 22 (수정 대부분, 신규 3)
**Analogs found:** 22 / 22 (모두 git 추적 소스. 미러 경로 없음)

이 페이즈는 기존 코드 수술이라 "분석 대상 파일 = 자기 자신의 인접 패턴"인 경우가 많다. 아래 줄 번호는 지금 저장소 기준이다. 값·선택자 계약은 18-UI-SPEC.md, 세부 근거는 18-RESEARCH.md 가 원천이다.

## File Classification

| 새/수정 파일 | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `shared/game/look.ts` (+`lockedOutfits`, `resolveLookConflicts`, `setLook` 잠금) | utility (순수 규칙) | transform | 같은 파일 `setLook` (:19-30) | exact |
| `shared/game/room.ts` `beginGame` (:446) | service | request-response | 같은 줄 `players.map(role)` | exact |
| `test/unit/look.test.ts`, `test/worker/leak.test.ts:1076` | test | transform | 기존 look.test.ts 관례(한 줄 문자열 비교) | exact |
| `src/components/v2/DressSheet.tsx` (+`taken`) | component | event-driven | 같은 파일 `aria-disabled` 카드 (:101, :135) | exact |
| `src/screens/Lobby.tsx:243`, `ResultScreen.tsx:603` | component | request-response | 기존 `<DressSheet>` 호출부 | exact |
| `src/components/v2/V2Icon.tsx` (+`lock`, `eyeOff`) | component | transform | `eye` 항목 (:91-94) | exact |
| `src/components/v2/EvidenceCard.tsx` (:41-45) | component | transform | 같은 파일 `witness === null` 분기 | exact |
| `src/world/maps/plaza.ts`, `bar.ts` (`PhaseTune.moonColor`) | config + 장면 빌더 | transform | `PhaseTune`(bar.ts:51-72) · `moon.intensity = t.moon` (plaza.ts:465, bar.ts:638) | exact |
| `test/unit/lighting.test.ts` (신규) | test | transform | `test/unit/plazaScene.test.ts:175-195` | role-match |
| `src/components/v2/FocusRing.tsx` (+스포트라이트 mask) | component | event-driven (rAF 측정) | 같은 파일 `measure`/`Box` | exact |
| `src/components/v2/TutorialNext.tsx` + `tutorial.css .tut-next` | component | event-driven | 같은 파일 (:9-24), tutorial.css:67-84 | exact |
| `src/components/v2/TutorialRoleCards.tsx` (:28-33) | component | transform | `src/game/roleText.ts` `ROLE_TEXT` | exact |
| `src/screens/GameMap.tsx` (`panelless`·`camera` prop) | component | request-response | 같은 파일 :215-216 `panelless`, :856 `roleCard` | exact |
| `src/screens/TutorialScreen.tsx` | component | event-driven | `roleCard` 전달 (:417, :425), `focusGroups` (~:358) | exact |
| `src/game/tutorialScript.ts` (`TUTORIAL_SPOTS[1]`, 고정 카메라 상수) | config | transform | 같은 파일 :302-309 | exact |
| `src/components/v2/TutorialEvidence.tsx` (`clampPoint`, 선 clamp) | component | transform | 같은 파일 `measureLines` | exact |
| `src/screens/RoleReveal.tsx` (:66-70, :86-90 삭제) | component | event-driven | 자기 자신(삭제) | exact |
| `src/game/hostLine.ts:76-79` | config (문구 표) | transform | 같은 표 `nomination.act` (:66, 유지) | exact |
| `scripts/e2e/lib.mjs:2886-2888`, `browser.mjs:2104`, `tutorial.mjs:236-250` | test (E2E) | request-response | 기존 표식·문구 표 | exact |
| `src/styles/tutorial.css`, `v2.css`, `evidence.css`, `phase.css` | config (CSS) | — | tutorial.css `.tut-focus`(z 52)·`.tut-next`(z 53) | exact |
| `docs/screen-map.md`, `HANDOFF.md` | docs | — | 직전 17 갱신 방식 | role-match |

## Pattern Assignments

### `shared/game/look.ts` — 옷 해소·잠금 (utility, transform)

**Analog:** 같은 파일. 순수 모듈이고 `.role` 접근이 없다는 소스 시험이 걸려 있다(L25). `seat`·`look` 만 읽는다.

**기존 검사 순서(계약)** (look.ts:24-29): 단계 → 행위자 → 값 → 같은 값 → 새 상태.
```ts
if (!(OUTFIT_IDS as readonly string[]).includes(look)) return { ok: false, error: "BAD_MESSAGE" };
if ((actor.look ?? DEFAULT_LOOK) === look) return { ok: true, state };
return { ok: true, state: { ...state, players: state.players.map((p) => (p.id === actorId ? { ...p, look } : p)) } };
```
**적용:** 같은 값 검사(:28) **뒤**에 `lockedOutfits(state.players.filter((p) => p.id !== actorId)).has(look)` 이면 `{ ok:false, error:"BAD_MESSAGE" }`. DO `applyDress`(worker/room.ts:584-588)는 `!result.ok` 를 전부 state 한 프레임으로 돌려 오류 문구가 없다(L30).
**신규 함수:** RESEARCH Pattern 1 의 `lockedOutfits`·2패스 `resolveLookConflicts` 예(RESEARCH 167-195)를 그대로 쓴다. 난수·`randInt` 인자 없음.

### `shared/game/room.ts` `beginGame` (service)

**Analog:** :446
```ts
players: state.players.map((p) => ({ ...p, role: roles.get(p.id) })),
```
**적용:** `resolveLookConflicts(state.players).map(...)` 한 줄 변경. `assignRoles` → 맞바꿈 → `decideMap` 난수 순서는 건드리지 않는다. `rematch`(`REMATCH_PLAYER_KEYS` 에 `look` 포함)·튜토리얼·테스트 방 봇이 모두 이 함수를 지난다.

### `src/components/v2/DressSheet.tsx` (component)

**Analog:** 같은 파일의 비활성 카드(:101·:135 `aria-disabled={disabled ? "true" : undefined}` + `onClick` 가드 `if (!disabled) …`), CSS `v2.css:398 .mv-dress-card[aria-disabled="true"] { opacity: 0.45; cursor: default; }`, 체크 자리 `v2.css:397 .mv-dress-card__check { top:4px; right:4px }`.
**적용:** `taken?: ReadonlySet<OutfitId>` prop. 카드에 `data-taken`, `aria-disabled="true"`, `onClick` 가드, 자물쇠 `V2Icon name="lock" size={16}` 를 체크와 같은 자리에. 호출부는 `taken={lockedOutfits(view.players.filter(p => p.seat !== view.me.seat))}` (`useMemo`, 서버 `view.players` 기준, 내 미리 보기 제외). 접근성 이름 조각은 `dressText.ts` 상수.

### `src/components/v2/V2Icon.tsx` — `lock`, `eyeOff` (component)

**Analog:** `eye` (:91-94)
```ts
eye: [
  ["p", "M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"],
  ["c", 12, 12, 3],
],
```
**적용:** `V2IconName` 유니온(:10)에 `"lock" | "eyeOff"` 추가. `eyeOff` = eye 경로 + `["p","M4 4l16 16"]`. `lock` = `M6 11h12v9H6z` + `M8.5 11V8a3.5 3.5 0 0 1 7 0v3`. 시험은 `test/client/icon.test.tsx` 의 `chevronRight` describe 형식.

### `src/components/v2/EvidenceCard.tsx` (component)

**Analog:** :41-45 (현재 눈 + "0")
```tsx
<span className="mv-evidence__eye"><V2Icon name="eye" size={24} /></span>
{witness === null ? (<span className="mv-evidence__zero">0</span>) : (<>…
```
**적용:** `witness === null` 이면 `eyeOff` 24 하나(접근성 이름 "목격자 없음"), 아니면 기존 `eye`. `.mv-evidence__zero` 삭제(evidence.css:19). `data-lastseen-count` 는 유지(:34). 시험 `evidenceCard.test.tsx:59-60`, `recordTrace.test.tsx:434-435`, `browser.mjs:2104` 선택자 갱신. `V2Icon` 의 `aria-label` 전달 여부 확인(안 되면 감싸는 `<span role="img">`).

### `src/world/maps/plaza.ts`, `bar.ts` — `moonColor` (config/장면)

**Analog:** `PhaseTune`(bar.ts:51-72)의 한 칸씩 + 광원 갱신 `moon.intensity = t.moon;` (plaza.ts:465, bar.ts:638).
**적용:** `PhaseTune` 에 `moonColor: string` 필수 칸(타입이 모든 행 갱신을 강제). 밤 계열 4행은 `TOKEN_COLORS.moon`. `applyLook` 에 `moon.color.set(t.moonColor);` 추가, 생성자도 `new DirectionalLight(T.talk.moonColor, T.talk.moon)`. UI-SPEC 시작값 3곳은 자기 허용 범위를 어기므로 RESEARCH 표의 권고값(`#625e72`, `#7e7a96`, `#e0dad8`)으로 시작한다. 깨지는 시험: `plazaScene.test.ts:179-191`(교체), `barScene.test.ts:83`·`:163-164`(갱신).

### `src/components/v2/FocusRing.tsx` — 스포트라이트 (component, rAF 측정)

**Analog:** 같은 파일. `measure()`(:41-77)가 `Box` 를 만들고, `FocusRing`(:85-130)이 `same()` 으로 불필요한 상태 변경을 막는다.
```tsx
return <div key={g.key} className="tut-focus" data-tutorial-focus={g.key} aria-hidden="true" style={style} />;
```
**적용:** 구멍은 새 측정 없이 같은 `Box` 재사용. `FocusGroup.lit?: readonly string[]`(구멍만) 추가, `Box` 에 숫자 `rx`(pill = height/2). `groups` 가 있고 `boxes` 가 하나라도 있을 때만 `<svg className="tut-dim" data-tutorial-dim="" aria-hidden>` + `<mask id="tut-dim-mask">`(상수 id, `useId` 금지) 렌더. RESEARCH 248-261 코드 그대로. CSS: `.tut-dim{position:fixed;inset:0;z-index:var(--z-overlay);pointer-events:none}` `.tut-dim__fill{fill:var(--night-950)}`. 흐림·`backdrop-filter` 금지. z 는 띠 51·포커스 52·[다음] 53 아래.

### `src/components/v2/TutorialNext.tsx` + `.tut-next` (component)

**Analog:** TutorialNext.tsx :9-24 (유지할 것: `data-tutorial-next=""`, `aria-label="다음"`, `emitSignal({ kind: "tap" })`), tutorial.css:67-84.
**적용:** 아이콘 하나 → `<span>다음</span>` + `chevronRight 20`. CSS 는 `right:20px; width:56px; border-radius:50%` → `left:0; right:0; margin-inline:auto; width:min(240px, calc(100% - 48px))`, `border-radius: var(--radius-pill)`. **`transform: translateX(-50%)` 금지**(`tut-fadeup` 충돌). `bottom: 28px; height: 56px` 리터럴 유지(`tutorialScenes.test.tsx:362-368` 이 읽음). `.tut-next::before` 는 `border-radius: inherit`. P18-11: `[data-tutorial-screen]:has([data-tutorial-next]) .mv-errand-dots { display:none }` (`:has` 는 v2.css:131 등에서 이미 사용).

### `src/components/v2/TutorialRoleCards.tsx` (component)

**Analog:** `src/game/roleText.ts:5-10` `ROLE_TEXT[role].desc`(타입만 import 라 정적 가드 `tutorialStaticGuard` 통과).
```ts
{ kind: "doctor", name: "의사", line: "밤에 한 명을 지켜요", icon: "shield", anim: "a-shield" },  // 현재 (:31)
```
**적용:** `line: ROLE_TEXT[kind].desc` 로 읽는다(문구 두 곳 금지). 시험 `tutorialOpening.test.tsx:261` 의 `LINES` 도 `ROLE_TEXT` 에서 계산. 장면 7 `.tut-roles` 아래 예약 96.

### `src/screens/GameMap.tsx` + `TutorialScreen.tsx` (component)

**Analog:** GameMap.tsx :215-216
```tsx
const panelless = view.phase === "errand";
const { rootRef, … } = useMapInsets(blockModeOf(view) !== null, panelless);
```
:856 `{roleCard ? <RoleCardButton iconOnly … /> : null}`.
**적용:** `GameMapProps` 에 `panelless?: boolean`, `camera?: CameraMode`. `const noPanel = view.phase === "errand" || panelless === true;` 로 `useMapInsets` 와 패널 분기를 같이 바꾼다(`errand` 만 점·카드 렌더, 그 외 `noPanel` 은 null). `scene` useMemo(:833)에서 `{ ...sceneLook(...), ...(camera ? { camera } : {}) }` 로 덮는다. `cameraModeOf`(presence.ts)·`sceneLook` 은 수정 금지. TutorialScreen 은 장면 2~6 에서 `panelless`, `roleCard` 미전달, 장면 2·5·6 에서만 고정 카메라 전달.

### `src/game/tutorialScript.ts` / `TutorialEvidence.tsx` (config / component)

**Analog:** `TUTORIAL_SPOTS`(:302-309, 도윤 `{ x: 1.3, z: -2.3 }`), `GATHER_CENTER`(camera.ts:70). 고정 카메라 상수는 `CameraMode` type-only import 로 정적 가드를 통과한다: `TUTORIAL_FIXED_CAMERA: CameraMode = { mode:"fixed", target:GATHER_CENTER 값, zoom:1 }`.
**적용:** 선 끝점·제어점을 `[8, innerWidth-8]×[8, innerHeight-8]` 로 `clampPoint`(순수 함수, 단위 시험), `.tut-links{overflow:hidden}`(tutorial.css:139). 도윤 이동은 `tutorialScript.test.ts:466`(걸을 수 있는 칸)과 E2E 겹침 측정으로 확인.

### `src/screens/RoleReveal.tsx` · `hostLine.ts` (삭제·문구)

- `RoleReveal.tsx`: `noticeShown` 상태(:66), 타이머(:68), `<p className="mf-reveal__pre" data-pre-notice …>`(:87), `PRE_NOTICE_MS` import(:8) 삭제. `.mf-reveal__hints` div 는 빈 채 유지. `RESULT_PANEL_TEXT.preNotice` 는 `LineSheet.tsx:92` 가 쓰므로 남긴다. `resultText.ts:30 PRE_NOTICE_MS`, `phase.css:70-72` 삭제. 시험 `phaseScreens.test.tsx:177`, `:818~`.
- `hostLine.ts:76-79` 현재 `"…이름표를 눌러 주세요."` → `"얼굴을"`. `nomination.act`(:66)는 유지. 같이: `hostLine.test.ts:138-141`, `scripts/e2e/lib.mjs:2886-2888`(`HOST_ACT_LINES` 3개), `e2eContract.test.ts:683`.

## Shared Patterns

### 서버 판정은 공개 값만, 거절은 침묵 (L25·L30, 결정 0002)
**Source:** `shared/game/look.ts:1-3, 24-28`, `worker/room.ts:584-588`
**Apply to:** `resolveLookConflicts`, `setLook` 잠금. 역할·난수·시각을 읽지 않고, 거절은 보낸 소켓에 state 한 프레임만(오류 문구 없음). 클라이언트 잠금 표시는 편의이고 서버가 최종이다.

### 정적 가드(튜토리얼 혼자 하기, 서버 0)
**Source:** `test/unit/tutorialStaticGuard.test.ts:52-61` (`FORBIDDEN` 정규식: `me.role`·`p.role` 등)
**Apply to:** `TutorialRoleCards`, `tutorialScript.ts`, `FocusRing`. `ROLE_TEXT`·`CameraMode` 는 타입·정적 표만 import 하므로 통과한다. 실제 방 view 의 역할을 읽는 import 를 새로 넣지 않는다.

### 측정은 rAF + `same()`, 포커스는 램프 깜빡임만
**Source:** `FocusRing.tsx:79-118`, `tutorial.css` `tut-ring`
**Apply to:** 스포트라이트·[다음]. 애니메이션은 `transform`·`opacity` 만, 모션 줄이기 규칙(tutorial.css:391) 유지, 색은 토큰만(hex 금지).

### E2E 표식·문구 사본 동기화
**Source:** `scripts/e2e/lib.mjs`(표식 상수·`HOST_ACT_LINES`), `lib.test.mjs:2680`, `test/unit/e2eContract.test.ts:359-362, 683`
**Apply to:** `data-taken`, `data-tutorial-dim` 추가·밤 띠 문구 변경. 세 곳을 같이 고치지 않으면 "알 수 없는 표식"·표 불일치로 실패한다.

### 시험 관례
**Source:** `test/unit/look.test.ts`(결과를 한 줄 문자열로 비교), `test/unit/plazaScene.test.ts`(three `Color` 휘도)
**Apply to:** 해소 규칙 표 시험, 조명 허용 범위 시험(채도 `(max-min)/max`, 휘도비).

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| SVG `<mask>` 스포트라이트 층 | component | rAF 측정 | 저장소에 mask 기반 어둡게 층이 없다. 측정은 `FocusRing` 재사용, 마크업은 RESEARCH 248-261 를 쓴다 |
| 조명 허용 범위 렌더 휘도 순서(talk>morning>vote>night) | test/측정 | batch | 렌더 휘도를 재는 기존 시험이 없다. `scripts/gallery.mjs` 촬영 + `sharp` 평균 휘도(RESEARCH Open Question 5) |

## 주의할 함정 (플래너용)

1. `test/worker/leak.test.ts:1076-1077` 은 "look 은 대본 좌석에만 있다"를 단언한다. 해소가 look 을 새로 쓰므로 `resolveLookConflicts` 결과 기준으로 고친다.
2. `scripts/e2e/tutorial.mjs:236-250` TT1 이 `.mf-game__header button`([내 역할])을 눌러 `taps.header` 를 요구한다. 숨기면 실패하므로 조건을 바꾼다.
3. 장면 4 머리 [기록] 단추는 UI-SPEC 숨김 범위 밖(채팅·입력줄·내 역할만). `data-record-button` E2E 기대와 함께 유지로 확정한다.
4. 갱신 대상 기존 시험: `plazaScene.test.ts:179-191`, `barScene.test.ts:83,163-164`, `tutorialScenes.test.tsx:362-368`(리터럴 유지), `tutorialOpening.test.tsx:261`.

## Metadata

**Analog search scope:** `shared/game/`, `src/components/v2/`, `src/screens/`, `src/game/`, `src/world/maps/`, `src/styles/`, `test/`, `scripts/e2e/`
**Files scanned:** 약 20 (직접 읽음 10, 줄 단위 확인 10). 확인한 분석 대상 `look.ts`·`FocusRing.tsx`·`plaza.ts` 는 모두 `git ls-files` 추적됨
**Pattern extraction date:** 2026-11-09

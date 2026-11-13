---
phase: 21-cause-effect-missions
plan: "08"
subsystem: screen-foundation
tags: [icons, host-line, copy, role-card, causalView, pure-functions]
requires:
  - phase: 21-cause-effect-missions
    provides: 21-05 의 day.lamps·me.skipPhase, 21-06 의 day.scene·me.clues, 21-07 의 누설 전수·srcClean
provides:
  - V2Icon flame·footprint·cloth·window (시안 경로 그대로)
  - 자막 띠 키 night.house·scene.act·scene.done·scene.ghost·discussion.clue 와 errand 문장 갱신, HostLocal.sceneOn, CallTarget house·scene
  - 헤더 제목 등불 켜기(errand)·현장 조사(확장판 morning)
  - roleHintOf 와 확장판 마피아 역할 카드·시트 한 줄
  - src/game/causalView.ts (단서 칩·지점 상태·꺼진 등불·창 켜짐·집 판·최근접·같은 옷 배지)
affects: [21-09, 21-10, 21-11, 21-12, 21-13, 21-17]
requirements-completed: [D-02, D-06, D-10, D-14, D-18, D-20, D-24, D-25, D-26, D-27]
actuals:
  tokens: 20600
  tasks: 2
  commits: 4
plan_head_before: 107b7b95e249154c03f579cc542b35e6679ee360
plan_head_after: 46ddfe0c3505e0486a3d4915a06054df2cdf5b1c
commits: 4
tech-stack:
  added: []
  patterns:
    - "확장판 갈래는 hostKeyOf 안에서 rulesetOf(modeOf(view)).errand 한 곳(extendedOf)으로만 읽는다 — 판 이름을 직접 가르지 않고, 밤은 역할(me.role)을 읽기 전에 갈린다"
    - "화면 계산은 받은 view 값만 읽는 순수 함수(causalView) — 역할·시각·난수·DOM 을 읽지 않는다"
key-files:
  created:
    - src/game/causalView.ts
    - test/unit/causalView.test.ts
  modified:
    - src/components/v2/V2Icon.tsx
    - src/game/hostLine.ts
    - src/game/dayView.ts
    - src/game/roleText.ts
    - src/components/RoleCard.tsx
    - src/components/RoleCardSheet.tsx
    - src/screens/RoleReveal.tsx
    - src/styles/phase.css
    - src/styles/rolecard.css
    - scripts/e2e/lib.mjs
    - scripts/e2e/lib.test.mjs
key-decisions:
  - "주인 없는 집(좌석에 사람이 없는 집)의 가로등은 꺼진 표식을 하지 않는다 — UI-SPEC 이 정하지 않아 소음을 줄이는 쪽으로 정한 계획 가정(lampsOffOf 는 주인 좌석만 센다). 21-17 결정 기록에 옮긴다"
  - "목격 기록이 빈 배열이면 목격 칩이 없다(펼칠 줄이 없다) — 단서도 없으면 '단서 없음'. discussion.clue 도 같은 규칙(clues 나 record 가 length > 0)"
  - "hostLine.ts 의 판 종류 읽기는 extendedOf 하나뿐이다 — 옛 19-02 시험 '판 종류를 읽지 않는다' 는 이 규칙('modeOf 호출 하나, 판 이름·.mode 직접 가르기 없음')으로 바꿨다"
metrics:
  duration: 약 50분
  completed: 2026-11-13
status: complete
---

# Phase 21 Plan 08: 아이콘·문구·계산 바탕 Summary

**화면 부품(21-10~21-13)이 함께 쓰는 바탕을 만들었다: 아이콘 넷, 확장판 자막 띠 키·문장(밤은 역할을 읽기 전에 갈려 네 역할이 같은 키 `night.house`), 헤더 제목 두 개, 확장판 마피아 역할 카드 한 줄, 받은 view 만 읽는 계산 모듈 `causalView`. `npm test` 8779 통과 · 262 건너뜀 · 실패 0, `npm run typecheck` 초록.**

## RED 증거 (단일 줄)

Task 1 (커밋 8396fd93):

- `expected '빛나는 곳을 찾아 처리해 주세요' to be '등불 세 곳을 켜 주세요'` (hostLine: errand.act)
- `expected '곧 토론이 시작됩니다' to be '곧 밤이 됩니다'` (hostLine: errand.done)
- `expected '심부름' to be '등불 켜기'` (dayView: 확장판 errand 제목)
- `expected undefined to be 1` (hostLine: hostLine.ts 의 modeOf 호출 수 — 아직 없음)
- 아이콘 네 이름·확장판 night.house·scene.*·discussion.clue·roleHintOf·카드 hint 시험은 자리(미정의 키·함수)로 실패했다.

Task 2 (커밋 a34ff814):

- `expected ',,,,,,,' to be '하나,둘,셋,넷,다섯,여섯,일곱,여덟'` (KOREAN_COUNT)
- `expected '' to be 'footprint:발자국 둘|cloth:붉은 천 조각|touched:먼저 손댄 흔적|witness:목격 2'` (clueChipsOf)
- `expected 'fresh/fresh/fresh' to be 'done/blurred/fresh'` (clueSpotStates)
- `expected '' to be '1,3'` (lampsOffOf) · `expected '' to be '0,2*,3'` (housePlatesOf) · `expected null to be +0` (nearestPlate)

## 새 키·문장 표 (UI-SPEC 자막 띠 표 그대로, 모두 19자 이하·마침표 없음)

| 키 | 문장 | 쓰는 곳 |
|----|------|---------|
| `errand.act` | 등불 세 곳을 켜 주세요 | 저녁(갱신) |
| `errand.done` | 곧 밤이 됩니다 | 저녁 3곳 완료(갱신) |
| `night.house`(새) | 집 하나를 눌러 주세요 | 확장판 밤 산 사람 — 네 역할 모두 같은 키 |
| `scene.act`(새) | 빛나는 곳을 살펴보세요 | 확장판 아침, `local.sceneOn` 참, 단서 3 미만 |
| `scene.done`(새) | 곧 토론이 시작됩니다 | 확장판 아침, me.clues 셋 |
| `scene.ghost`(새) | 지켜봐 주세요 | 확장판 아침 유령(sceneOn 참) |
| `discussion.clue`(새) | 단서를 말로 나눠 보세요 | 확장판 토론, me.clues 나 me.record 가 하나라도 있을 때 |
| `morning` | (빈 줄) | 확장판 아침 sceneOn 거짓(결과 알림 중) |

- 확장판 토론은 `witness`·`discussion.evidence`·`trace` 키를 쓰지 않는다(시험이 확장판 전 단계에서 0건을 확인). 기본 마피아 키는 하나도 지우지 않았다.
- 빛남 대상: `night.house` → `{ kind: "house", seats: 산 사람 전원(나 포함) }`(새 CallTarget 종류), `scene.act` → `{ kind: "tool", tool: "scene" }`(새 CallTool), `discussion.clue` → `chat`.
- 헤더 제목: `titles.errand` "등불 켜기"(시간대 낱말 "저녁"은 21-09 가 todOf 에서), 확장판 morning "현장 조사"(`DAY_COPY.morningScene`), 기본 마피아 morning "아침" 그대로.
- 역할 카드 한 줄: `roleHintOf(role, mode)` — mafia + extended 에만 "켜기를 길게 누르면 심지를 잘라요". RoleCard 는 `hint` prop(`.mf-card__hint`), 시트는 `.mf-rolecard__hint`. 다른 역할·기본 마피아는 마크업이 없다. 글이 18자라 계획의 "16자"는 세는 법이 틀렸다(띠 줄이 아니라 카드 줄이라 19자 제한 대상도 아니다).

## causalView 시그니처

```ts
KOREAN_COUNT: Readonly<Record<number, string>>            // 1~8 → 하나…여덟, 0·9 는 키 없음
clueChipsOf(clues, record): ClueChip[]                    // { kind: footprint|cloth|window|touched|dark|witness|none; icon: V2IconName|null; text; spot? }
clueSpotStates(clues): Record<1|2|3, "fresh"|"done"|"blurred">
lampsOffOf(lamps, ownerSeats): number[]                   // 주인 있는 집의 가로등 중 lamps 에 없는 번호
windowsLitOf(ownerSeats, lamps): number[]                 // 주인 ∩ 켜진 등불
housePlatesOf(view): { seat; me }[]                       // 산 사람 좌석 집 목록
nearestPlate(points: {seat,x,y}[], sx, sy, max = 28): number | null   // 같은 거리면 낮은 좌석
boardMarksOf(players, clues): Record<number, ("cloth"|"window")[]>    // sameOutfitSeats, cloth→window 순
// 그 밖: NO_CLUE_TEXT·TOUCHED_TEXT·DARK_TEXT·PLATE_TAP_MAX(28)·ClueChipKind·SpotState·HousePlate·OutfitMark
```

글은 `TRACE_TEXT` 와 Copywriting 닫힌 표뿐이고 역할을 읽지 않는다(소스 규약 시험: Date·Math.random·document·window.·role 없음).

## 고친 옛 시험 표 (지우기·skip·약화 없음)

확장판이 `mode` 없는 view 의 기본값(`modeOf` 기본 extended)이라, 옛 시험이 보는 기본 마피아 갈래(night.mafia 등·witness·discussion.evidence·아침 "아침")를 그대로 지키려고 뷰에 `mode: "basic"` 을 명시했다. 문장·제목 갱신은 의도된 변경이라 새 값으로 바꿨다.

| 파일 | 변경 | 이유 |
|---|---|---|
| test/unit/hostLine.test.ts | makeView 기본 mode basic, `clues` 옵션, FLAGS 에 sceneOn, 허용 목록에 `mode`·`me.clues`, 확장판 행렬 추가, 심부름 문장 갱신, 19-02 "판 종류를 읽지 않는다" → "modeOf 호출 하나·판 이름 직접 가르기 없음", 대조 시험 basic 으로 | 계획이 허용한 갱신(HOST-05 허용 목록에 view.mode) |
| test/unit/dayView.test.ts | basic morning "아침"·extended "현장 조사" 쌍 | 확장판 제목 |
| test/client/gameMap·guide·nightMap·recordTrace·callGlow.test.tsx | 뷰 빌더에 `mode: "basic"` | 옛 키(night.mafia·witness) 시험 보존 |
| test/client/gameMap.test.tsx | errand 제목 "등불 켜기" | 의도된 제목 변경 |
| test/client/errandScreen.test.tsx | 띠 문장 "등불 세 곳을 켜 주세요" | 의도된 문장 변경 |
| test/client/roleCardSheet.test.tsx | renderSheet 기본 mode basic(마피아 본문 순서 시험 보존) + 확장판 시트 시험 추가 | 카드 한 줄 |
| scripts/e2e/lib.mjs·lib.test.mjs | ERRAND_LINES·BASIC_FORBIDDEN_LINES 사본의 심부름 두 문장 | e2eContract 사본 일치 규약(HOST_LINES 와 한 글자도 다르지 않다) |

계획의 `files_modified` 밖 파일이 많다(위 표). 전체 시험에서 걸린 같은 원인이라 Rule 3 으로 고쳤다.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - 막는 문제] 계획 목록 밖 옛 시험·E2E 사본이 새 문장·기본 모드 때문에 실패**
- **Found during:** Task 1 GREEN(전체 unit·client 실행)
- **Issue:** `mode` 없는 뷰는 확장판으로 읽히고(modeOf 기본값), 심부름 문장·제목이 바뀌어 gameMap·guide·nightMap·recordTrace·callGlow·errandScreen·e2eContract 시험과 E2E 문장 사본이 실패
- **Fix:** 위 "고친 옛 시험 표" 대로 — 기본 마피아 갈래를 보는 시험은 `mode: "basic"` 을 명시, 의도된 문장·제목은 새 값으로
- **Files modified:** test/client/{gameMap,guide,nightMap,recordTrace,callGlow,errandScreen}.test.tsx, scripts/e2e/lib.mjs, scripts/e2e/lib.test.mjs
- **Commit:** 0a774f38

**2. [Rule 1 - 계획 전제 오류] 역할 카드 한 줄 글자 수**
- 계획은 "16자"라 적었으나 "켜기를 길게 누르면 심지를 잘라요" 는 공백 포함 18자다. 카드 본문 줄이라 19자 제한 대상이 아니다. 시험은 19 이하로 둔다.

**3. [계획 충돌 해소] 19-02 시험 "hostLine.ts 는 판 종류를 읽지 않는다"**
- 계획이 hostKeyOf 에 판 규칙 읽기를 넣으라고 해서 이 시험은 반드시 깨진다. 같은 의도(새 갈래가 판 이름을 직접 가르지 않는다)를 더 정확히 지키는 규칙으로 바꿨다: 주석을 뺀 소스에 `modeOf(` 호출 하나, `"basic"`·`"extended"`·`.mode` 직접 가르기 없음.

## Auth gates

없음.

## Known Stubs

없음. `HostLocal.sceneOn`·CallTarget `house`/`scene` 은 이 계획에서 정의만 하고 채우는 화면은 21-11·21-12 다(새 키가 닿는 호출부가 아직 없어 화면에 빈 값이 흐르지 않는다).

## Threat Flags

없음(새 네트워크 경로·저장 없음). T-21-21(밤 띠 역할 갈림)은 시험으로 고정: 확장판 밤 경로 기록에 `me.role` 이 없고, 역할을 지운 view 와 키·문장·빛남 대상이 같다. T-21-22(카드 줄)는 accept — 본인 카드에만 그려진다.

## 21-09~21-13 에 넘기는 것

- **21-09:** 헤더 시간대 낱말은 `todOf`·`lightingOf("errand")` 가 정한다(지금 errand 는 "낮"). 제목은 이미 "등불 켜기"·"현장 조사"다(gameMap 시험이 errand 낱말 "낮" 을 아직 기대 — 21-09 가 dusk 로 바꿀 때 그 셀의 낱말·tod 를 "저녁"·`dusk` 로).
- **21-10·21-11:** `callTargetsOf` 가 확장판 밤에 `{ kind: "house", seats }` 를 낸다 — 이 종류를 읽는 곳은 아직 없다(집 판이 읽는다). 집 판 목록·누르기는 `housePlatesOf(view)`·`nearestPlate(points, sx, sy)`. 밤 안내 띠는 `night.house`(역할 무관). 밤 창 켜짐은 `windowsLitOf(ownerSeats, day.lamps)`, 꺼진 등불 표식은 `lampsOffOf(day.lamps, ownerSeats)`(ownerSeats = 사람이 앉은 좌석 — players 의 seat 전체).
- **21-12:** 아침 띠는 `local.sceneOn` 을 채워야 시작한다(거짓이면 빈 줄 `morning`). `callTargetsOf` 가 `scene.act` 에 `{ kind: "tool", tool: "scene" }` 를 낸다([살펴보기] 단추가 읽는다). 지점 상태는 `clueSpotStates(me.clues)`, 받은 단서 카드는 `clueChipsOf(me.clues, undefined)`(목격 칩 제외 — 아침 카드는 단서만 쓰려면 record 를 넘기지 않는다). 화면은 day.lamps·day.scene.house·day.skipCount·me.clues·me.skipPhase 만 그린다(srcClean 규칙).
- **21-13:** 의심 보드 칩은 `clueChipsOf(me.clues, me.record)` — 목격 칩은 record 가 length > 0 일 때만. 얼굴 줄 배지는 `boardMarksOf(players, me.clues)`(키가 없는 좌석 = 배지 없음). 토론 띠는 확장판에서 `discussion.clue`/`discussion.act` 이고 witness·discussion.evidence 키는 확장판에서 나오지 않는다(옛 [기록]·EvidenceCard 길은 확장판에서 그리지 않는다는 UI-SPEC 과 같은 방향).
- **21-17(결정 기록):** 가정 — 주인 없는 집의 가로등은 꺼진 표식을 하지 않는다. 옛 witness·discussion.evidence 키와 쓰이지 않는 E2E 문장 사본은 21-07 이 적은 "쓰이지 않는 공개 흔적 경로" 정리 후보에 함께 둔다.
- 역할 카드 한 줄은 카드(`RoleReveal`)와 시트가 `modeOf(view)` 로 정한다. 길게 누르기 구현(21-10 [켜기] 단추)은 이 줄이 말하는 그 단추다.

## 시험 수치

- `npm test` 8779 통과 · 262 건너뜀 · 실패 0(302 파일 통과 · 6 건너뜀, 125초). 이전(21-07) 8729 + 50.
- `npm run typecheck` 초록. `node --test scripts/e2e/lib.test.mjs` 465 통과.
- 위생 `git grep -nIiE "torder|티오더|조직|회사|~/project"`: 이 계획이 더한 줄 0건(남은 결과는 옛 .planning 마일스톤 문서의 일반 용례·규칙 문구 그대로).
- 간헐 실패(deferred-items.md 의 알려진 것)는 이 실행에서 관찰되지 않았다.

## Self-Check: PASSED

- 파일 있음: src/game/causalView.ts, test/unit/causalView.test.ts, 이 SUMMARY
- 커밋 있음: 8396fd93(RED 1), 0a774f38(GREEN 1), a34ff814(RED 2), 46ddfe0c(GREEN 2) — 모두 HEAD 의 조상
- 인수 기준: `"footprint"` 1+ · `night.house` 2+ · `scene.act` 2+ · `roleHintOf` 1+ · `등불 켜기` 1+ · `export function clueChipsOf` 1 · `sameOutfitSeats` 1+ 확인

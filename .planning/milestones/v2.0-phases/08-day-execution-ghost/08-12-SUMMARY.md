---
phase: 08-day-execution-ghost
plan: "12"
subsystem: world-runtime-stage
tags: [tdd, tracer, runtime, worldstage, scene, ghost, camera, pick-button, a11y, tagprops]
status: complete

requires:
  - phase: 08-day-execution-ghost
    provides: 08-08 presence.ts(SceneLook·executionFade·ghostFloatY·stageLiftY)·camera.ts gatherView, 08-10 캐릭터·렌더러의 setGhost·setOpacity·holdPose·setRing·setLighting 다섯·setTension·setZoom, 08-05 HeadStack 속성
provides:
  - runtime.ts — WorldRuntime.setScene(look)·deny(seat), 고정 카메라(gatherView 800ms 전환)·확대, 단계 조명·긴장, 유령 떠다님·무대 높이·처형 연출·지목 자세, RingKind·RING_COLORS
  - WorldStage 속성 scene·deny({seat, nonce})·canWalk·pick(WorldPick)·tagProps
  - data 속성 data-pick·data-ring-kind·data-lead, CSS .mf-world__pick
  - tagOrder.ts TagBox.lead(순위 +10)
affects: [08-13 게임 화면(GameMap 이 sceneLook·canMoveIn·pick·tagProps 를 넘김), 08-14 이후 지목·찬반·처형 화면, 08-23 E2E(8개 버튼 44×44 무가림), 9페이즈 밤 고리 색 정식 토큰]

actuals:
  tokens: 11000
  tasks: 3
  commits: 6
plan_head_before: 010605ccacb49f4a6aebef35daf6eb883e668a71
plan_head_after: 2d3db73310596ab44a22f7d20462815a5baeebe9

tech-stack:
  added: []
  patterns:
    - "서버 공개 정보로 만든 장면 표(SceneLook)를 런타임이 그대로 그린다: 표에 없는 좌석은 캐릭터도 이름표 DOM 도 만들지 않는다(T-08-30)"
    - "렌더러로 보내는 값(조명 단계·긴장 키·확대)은 마지막에 보낸 값과 비교해 바뀔 때만 보낸다. 렌더러 재생성 뒤에는 다시 보낸다"
    - "React 가 이름표 내용·속성(data-lead·data-ring-kind)을 쓰고 런타임이 프레임마다 그 속성을 읽어 위치·z·발밑 고리를 옮긴다 — 프레임마다 React 를 다시 그리지 않는다"
    - "선언형 한 번 신호(deny {seat, nonce}): 마운트 때 값은 지난 일로 보고 nonce 가 바뀔 때만 런타임을 부른다"

key-files:
  created: []
  modified:
    - src/world/runtime.ts
    - src/components/WorldStage.tsx
    - src/styles/world.css
    - src/world/tagOrder.ts
    - test/client/worldStage.test.tsx
    - test/unit/tagOrder.test.ts

key-decisions:
  - "고정 카메라는 진입(또는 zoom 목표 변경) 때 현재 카메라·오프셋·확대를 시작점으로 잡아 800ms(dur-slow) easeOut 으로 gatherView 목표까지 옮기고, 끝난 뒤에는 stage 사각형이 바뀌어도 180ms 오프셋 감쇠로만 움직인다. 모션 줄이기·재동기화 프레임은 바로 붙는다"
  - "유령 시점(SeatLook.ghost)의 좌석은 fadeAt 이 있어도 처형 연출(떠오름·사라짐)을 하지 않고 곧바로 유령으로 그린다 — 산 사람 화면에서만 사라지는 연출이다"
  - "유령 높이 = 무대 높이 0.29(장면이 있을 때) + 떠다님(0.35 ± 0.08) + 처형 떠오름 + 등장 낙하의 합이다(계획 식 그대로). 장면이 없으면(로비) 무대 높이를 더하지 않는다"
  - "발밑 고리는 이름표 wrapper 의 data-ring-kind 를 런타임이 프레임마다 읽어(바뀔 때만) handle.setRing(RING_COLORS[kind]) 로 옮긴다. 색은 tokens.css 의 crimson-500·seat-1·seat-3 와 같은 값을 상수로 둔다(밤 임시 틀, 9페이즈가 정식 토큰으로 정한다)"
  - "손사래(deny)는 runtime.deny(seat) 에 더해 WorldStage 속성 deny={{seat, nonce}} 로 닿는다 — 게임 화면(08-13)이 런타임 참조 없이 선언형으로 부르게"
  - "선두 z 가산은 runtime 이 사후에 더하지 않고 rankTags 의 TagBox.lead 로 순위 계산 안에 넣었다 — 선두가 내 이름표보다 위가 될 때 front(겹침 맨 앞) 판정도 같이 맞는다"
  - "지목 단계(pick)에는 이름표 버튼이 같은 사람들을 읽으므로 접근성 사람 목록(ul)은 aria-hidden 으로 감춘다(가정 A1: 한 벌의 버튼만)"
  - "pick.mine 인 좌석은 HeadStack mine 을 자동으로 켠다(tagProps 가 mine 을 따로 주면 그쪽이 이긴다)"

requirements-completed: []

coverage:
  - id: D1
    description: "scene 없음 = 6페이즈 동작 그대로, show 아닌 좌석은 캐릭터·이름표 DOM 을 만들지 않고 빠지면 퇴장 뒤 지워지며 서버 구간이 남아도 다시 만들지 않는다, ghost 좌석은 setGhost(true)·이름표 data-ghost, 해제하면 setGhost(false)"
    requirement: GHOST-01
    verification:
      - kind: component
        ref: "test/client/worldStage.test.tsx '게임 장면: 보임·유령 (GHOST-01)' (5 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "fixed 카메라 800ms 전환 뒤 내 캐릭터가 걸어도 목표 불변, zoom 1 → 1.08 이 800ms 안에 전환되고 같은 값은 다시 보내지 않음, 모션 줄이기는 첫 프레임, follow 복귀 시 따라가기·확대 1·오프셋 복귀"
    requirement: DAY-05
    verification:
      - kind: component
        ref: "test/client/worldStage.test.tsx '게임 장면(08-12) > 카메라' (4 tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "조명은 바뀔 때만 setLighting, 긴장은 초점 좌석 위치로 setTension 하고 0 으로 돌아오면 setTension(0)"
    requirement: DAY-05
    verification:
      - kind: component
        ref: "test/client/worldStage.test.tsx '게임 장면(08-12) > 조명·긴장' (2 tests)"
        status: pass
    human_judgment: false
  - id: D4
    description: "유령 높이 0.35 ± 0.08 떠다님과 모션 줄이기 고정, 무대 (0,0) 위 0.29, fadeAt 좌석 700ms 에 불투명도 ≈0.8·위로 상승·이름표도 흐려짐·2400ms 뒤 캐릭터 제거(표에 남아도 재생성 없음), 유령 시점 좌석은 연출 없이 유령으로 남음"
    requirement: GHOST-01
    verification:
      - kind: component
        ref: "test/client/worldStage.test.tsx '게임 장면(08-12) > 떠다님·무대 높이·처형 연출' (5 tests)"
        status: pass
    human_judgment: false
  - id: D5
    description: "pointAt 좌석 holdPose('point') 한 번과 대상 쪽 yaw(프레임당 YAW_TURN_RATE 제한), 없어지면 holdPose(null), deny 속성 nonce 마다 playEmote('deny')·setFace('surprise') 한 번"
    requirement: DAY-04
    verification:
      - kind: component
        ref: "test/client/worldStage.test.tsx '게임 장면(08-12) > 지목 자세·손사래' (3 tests)"
        status: pass
    human_judgment: false
  - id: D6
    description: "pick 이름표 버튼: button[data-pick]·aria-label·aria-pressed, 이름표 층 role=group+aria-label, pick 이름표만 aria-hidden 없음, mousedown 기본 동작 막기(입력칸 포커스 유지), canSend 거짓이면 aria-disabled 와 onPick 없음, 닉네임은 텍스트 노드로만, 내보내기 버튼과 겹치지 않음, CSS 규칙(11/−11/auto/포커스 링)"
    requirement: DAY-04
    verification:
      - kind: component
        ref: "test/client/worldStage.test.tsx '게임 이름표 > 지목 버튼' (7 tests)"
        status: pass
    human_judgment: false
  - id: D7
    description: "tagProps 쌓임 속성 전달, 선두 이름표 z 가 다른 이름표보다 높음(rankTags lead +10, front 판정 포함), data-ring-kind 와 캐릭터 setRing 색(police #7a8fb8·mafia #c8102e)·해제 시 null"
    requirement: DAY-04
    verification:
      - kind: component
        ref: "test/client/worldStage.test.tsx '게임 이름표 > tagProps' (3 tests)"
        status: pass
      - kind: unit
        ref: "test/unit/tagOrder.test.ts 'rankTags 선두 가산 (08-12)' (3 tests)"
        status: pass
    human_judgment: false
  - id: D8
    description: "canWalk 거짓이면 탭이 move 도 링(data-ring·마커)도 보내지 않고, 켜면 다시 걷고, 입력칸 포커스 중 탭은 blur 만(D4 규칙 유지)"
    requirement: MAP-04
    verification:
      - kind: component
        ref: "test/client/worldStage.test.tsx '게임 이름표 > canWalk (MAP-04)' (3 tests)"
        status: pass
    human_judgment: false
  - id: D9
    description: "전체: 타입 검사 0 오류, unit·client 프로젝트 129 파일 4109 통과(1 skipped 는 이전부터), vite build 통과, WorldStage 의 innerHTML grep 0건"
    verification:
      - kind: command
        ref: "npm run typecheck; npx vitest run --project client --project unit; npx vite build"
        status: pass
    human_judgment: false
  - id: D10
    description: "고정 카메라 전환·유령 떠다님·처형 떠오름·지목 손가락의 실제 화면에서의 보기 좋음과 실기기 성능, 8개 지목 버튼 44×44 무가림(4자 이름, 폰 6종)"
    verification: []
    human_judgment: true
    rationale: "fake 렌더러 시험은 호출·좌표를 고정할 뿐 시각 품질을 보지 않는다. 8개 버튼 무가림은 가정 A2 대로 E2E(08-23)가, 실기기 읽힘은 개발 뒤 실기기 확인이 맡는다"

duration: 25min
completed: 2026-11-02
---

# Phase 8 Plan 12: 맵 런타임·WorldStage 게임 단계 확장 Summary

**서버 공개 정보로 만든 장면 표(SceneLook)를 맵 런타임이 그대로 그리게 했다. 안 보이는 좌석은 캐릭터도 이름표도 만들지 않고, 유령은 반투명으로 떠다니고, 처형 연출 좌석은 떠오르며 사라지고, 카메라는 모이는 자리로 800ms 에 옮겨 고정되며, 이름표는 누르는 지목 버튼이 되고, 이동이 막힌 단계의 탭은 아무것도 보내지 않는다.**

## Accomplishments

- **보임·유령 (GHOST-01, 트레이서)**: `setScene(look | null)`. `isShown` 한 곳이 캐릭터 생성·퇴장·이름표 roster 를 같이 거른다. scene 이 없으면 6페이즈 그대로(기존 96개 시험 무변경 통과). 보이지 않게 된 좌석은 퇴장 연출 뒤 지워지고 서버 구간이 남아 있어도 다시 만들지 않는다.
- **카메라 (DAY-05)**: `fixed` 는 `gatherView` 구도로 800ms 전환 뒤 고정(내 캐릭터를 따라가지 않음), `zoom` 은 같은 시간에 `renderer.setZoom?.()`, `follow` 로 돌아오면 따라가기·확대 1·오프셋 복귀. 모션 줄이기·재동기화 프레임은 즉시. 스테이지 사각형이 바뀌면 고정 중에도 180ms 감쇠로 따라간다.
- **조명·긴장·유령 높이·처형 연출 (DAY-05, GHOST-01)**: `setLighting`·`setTension?.()` 는 마지막에 보낸 값과 달라질 때만(렌더러 재생성 뒤 재전송). 유령 `ghostFloatY`, 무대 위 `stageLiftY`(장면이 있을 때만), `fadeAt` 좌석은 `executionFade` 로 불투명도·떠오름·이름표 불투명도를 맞추고 2400ms 에 제거.
- **지목 자세·손사래 (DAY-04)**: `pointAt` 이 생기면 `holdPose("point")` 한 번과 대상 쪽 yaw(걷는 중에는 걷는 방향이 먼저), 없어지면 `holdPose(null)`. `runtime.deny(seat)` = `playEmote("deny")` + `setFace("surprise")`.
- **이름표 지목 버튼 (DAY-04)**: `pick` 이 있으면 pick 좌석의 이름표가 `<button type=button data-pick>` 이 된다(`.mf-world__pick`, 안쪽 11·바깥 −11, 포커스 링 gray-100 2px). `aria-label`, `aria-pressed`, 이름표 층 `role=group`, mousedown 기본 동작 막기, `canSend` 거짓이면 `aria-disabled` 와 `onPick` 없음.
- **tagProps·선두·고리·canWalk (MAP-04)**: `tagProps(seat)` 가 HeadStack 에 그대로 들어가고, wrapper 에 `data-lead`·`data-ring-kind` 가 붙는다. 선두는 rankTags 의 `lead` 로 순위 +10, 고리 종류는 런타임이 캐릭터 `setRing(색)` 으로 옮긴다. `canWalk === false` 면 `onTap` 첫 줄에서 돌아와 링도 move 도 없다.

## TDD Gate Compliance

| 작업 | RED 커밋 | GREEN 커밋 | 비고 |
|------|----------|------------|------|
| 1 (트레이서) | — | bb1ae81 | `type="tracer"` 라 시험과 구현을 한 커밋에 넣었다(계획: auto 와 같이 커밋). 시험은 구현 직후 통과 확인 |
| 2 | 3f4dcbc | 1131055 | RED: 새 describe 15개 중 12 실패 |
| 3 | 3870ae8 | 2d3db73 직전의 de7e026 | RED: worldStage 11 + tagOrder 2 실패 |

**semanticAssessment**: 작업 2 RED 12건은 모두 `expected [['talk']] to deeply equal …`·`expected 0 to be close to 0.35`·`Cannot read properties of undefined (reading '0')`(호출 기록 없음) 같은 계획한 행동 단언 실패다(import·문법 오류 없음). 통과한 3개(유령 시점 fadeAt 무시·180ms 회전 제한·로비 회귀)는 구현이 없어도 맞는 대조 시험이다. 작업 3 RED 도 button[data-pick] 부재·z 가산 부재·`data-ring-kind` 부재의 단언 실패이며, canWalk 의 "켜면 걷는다"·"D4" 두 건은 현재 동작을 고정하는 회귀 시험이라 통과가 맞다. `gsd_run check tdd-red-evidence` 는 따로 돌리지 않았다(08-10 과 같음). 실패한 시험이 입력칸 포커스를 남겨 뒤 시험을 오염시켜 afterEach 정리를 추가했다.

**트레이서 게이트**: 작업 1 `<verify>`(`npx vitest run test/client/worldStage.test.tsx`)를 통과한 뒤 확장했다(⚡ Tracer verified end-to-end — expanding).

## Task Commits

| 작업 | 커밋 | 내용 |
|------|------|------|
| 1 | bb1ae81 | feat: 트레이서 — setScene·scene 속성, 보임·유령 좌석 |
| 2 RED | 3f4dcbc | test: 카메라·조명·긴장·떠다님·처형 연출·지목 자세·손사래 |
| 2 GREEN | 1131055 | feat: 런타임 확장(카메라 고정·확대·조명·긴장·떠다님·처형 연출·holdPose·deny) |
| 3 RED | 3870ae8 | test: 지목 버튼·tagProps·선두 z·발밑 고리·canWalk (+ tagOrder lead) |
| 3 GREEN | de7e026 | feat: pick·tagProps·canWalk·data-ring-kind·.mf-world__pick·rankTags lead |
| 3 마무리 | 2d3db73 | chore: WorldStage 주석의 innerHTML 단어 제거(게이트 grep 0건) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - 누락된 필수 기능] 손사래(deny)에 닿는 길이 없음**
- **Found during:** Task 2
- **Issue:** 계획은 `runtime.deny(seat)` 만 정했는데 WorldStage 가 런타임을 밖에 내놓지 않아 게임 화면(08-13)이 부를 수 없다.
- **Fix:** WorldStage 속성 `deny={{ seat, nonce }}` 추가. nonce 가 바뀔 때마다 한 번, 마운트 때 값은 하지 않는다.
- **Files modified:** src/components/WorldStage.tsx, test/client/worldStage.test.tsx
- **Commit:** 1131055

**2. [Rule 1 - 버그 예방] 선두 z 가산을 rankTags 안으로**
- **Found during:** Task 3 설계
- **Issue:** 계획은 "런타임 tagZ 계산에 +10" 이었으나 순위 계산 밖에서 더하면 선두가 내 이름표 위에 놓일 때 `front`(겹침 맨 앞) 판정이 어긋난다.
- **Fix:** `TagBox.lead` 와 `LEAD_Z_BOOST = 10` 을 tagOrder.ts 에 두고 순위·겹침 판정에 함께 쓴다. 계획 files_modified 밖의 두 파일(tagOrder.ts, test/unit/tagOrder.test.ts)을 건드렸다.
- **Commit:** 3870ae8, de7e026

**3. [Rule 3 - 막힘 해소] 게이트 grep 이 주석에 걸림**
- **Issue:** 인수 기준 `grep -E "dangerouslySetInnerHTML|innerHTML" src/components/WorldStage.tsx` 가 0건이어야 하는데 기존 주석 "innerHTML 없음" 이 1건으로 잡혔다.
- **Fix:** 주석 문구를 "HTML 문자열 주입 없음" 으로 바꿨다.
- **Commit:** 2d3db73

### 계획에 없던 설계 결정 (key-decisions 에도 기록)

- 유령 시점 좌석은 `fadeAt` 연출 없이 바로 유령으로 그린다(유령 viewer 의 표는 ghost 와 fadeAt 이 함께 올 수 있음).
- 고리 색 상수 `RING_COLORS` 를 runtime.ts 에 둔다(tokens.css 값과 같음, 밤 임시 틀 예외).
- pick 이 있으면 접근성 사람 목록 ul 을 aria-hidden 으로 가린다. pick.mine 좌석은 HeadStack mine 자동.
- 테스트 가짜 핸들·렌더러에 08-10 optional 메서드(setGhost·setOpacity·holdPose·setRing·playEmote·setFace·setZoom·setTension)를 vi.fn 으로 더했다.

**Total deviations:** 3 auto-fixed(Rule 1·2·3 각 1), 위 설계 결정들. **Impact:** 공개 이름·시그니처는 계획 그대로이고 `deny` 속성과 `TagBox.lead` 만 더해졌다.

## Verification

- `npx vitest run test/client/worldStage.test.tsx test/client/lobby.test.tsx` — 통과(로비 회귀 포함)
- `npm run typecheck` — 오류 0
- `npx vitest run --project client --project unit` — 129 파일 4109 통과(1 skipped 는 이전부터)
- `npx vite build` — 통과
- 인수 기준 grep: `setScene(`·`scene?: SceneLook`·`gatherView(`·`executionFade(`·`holdPose`·`deny(seat`·`data-pick`·`canWalk`·`data-ring-kind`·`mf-world__pick` 성공, innerHTML grep rc 1, `grep -c "^describe(" test/client/worldStage.test.tsx` = 25 (≥ 23)
- 레포 위생 grep: 이 계획이 건드린 파일에 결과 없음

## Known Stubs

없음. 새 화면 요소는 모두 속성으로 구동되고 기본값(scene·pick·tagProps 없음)은 로비 동작이다.

## Known limitations

- 고정 카메라의 오프셋은 전환(800ms)이 끝난 뒤 스테이지 사각형이 바뀌면 180ms 감쇠로 따라간다. 전환 중에 사각형이 바뀌면 목표가 매 프레임 갱신된다(끊김은 없지만 곡선이 약간 달라질 수 있음).
- 겹친 지목 이름표 둘의 뒤쪽 가림(UI-SPEC 남은 위험 2)은 6페이즈 순위 규칙(앞이 위)을 그대로 쓴다. 8개 버튼 44×44 무가림은 E2E(08-23)가 본다(가정 A2).
- 고리 색은 tokens.css 값을 상수로 복사했다. 토큰이 바뀌면 함께 고쳐야 하며 9페이즈가 정식 토큰으로 정한다.
- 실제 GL 에서의 시각 품질(고정 구도 읽힘·유령 떠다님·손가락)은 fake 렌더러 시험이 보지 못한다. 개발 뒤 실기기 확인과 08-24 성능 측정이 맡는다.

## Self-Check: PASSED

- 파일: src/world/runtime.ts, src/components/WorldStage.tsx, src/styles/world.css, src/world/tagOrder.ts, test/client/worldStage.test.tsx, test/unit/tagOrder.test.ts 모두 존재
- 커밋: bb1ae81, 3f4dcbc, 1131055, 3870ae8, de7e026, 2d3db73 모두 HEAD 의 조상

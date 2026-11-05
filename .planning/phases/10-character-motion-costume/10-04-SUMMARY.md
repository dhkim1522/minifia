---
phase: 10-character-motion-costume
plan: "04"
subsystem: world-client
tags: [outfit, look, runtime, three-character, ghost-mist, test-hook, geometry-release]
status: complete
requirements: [AVTR-01, AVTR-04]
requires:
  - phase: 10-02
    provides: "PublicPlayer.look, OutfitId, 서버가 모든 viewer 에게 같은 look 을 방송"
  - phase: 10-03
    provides: "prewarm·ownedGeometryCount·installEmotesHook 패턴"
provides:
  - "view.players[].look(없으면 coat)이 좌석별 캐릭터 의상이 되고, 바뀐 좌석만 갈아입는다 (OUTFIT 고정 상수 제거)"
  - "유령 직업 의상 안개가 고른 의상을 덮고 끝나면 고른 의상으로 복원 (산 사람 화면에는 이 경로 없음)"
  - "applyOutfit 이 이전 의상의 병합·돋보기 유리 지오메트리를 해제 — 최근 의상 하나만 남김, ownedGeometryCount 최대 13(<=14)"
  - "window.__mfLooks 훅, 이름표 층 동작 표시 없음 정적·DOM 가드(L31)"
affects: [10-06, 10-07, 10-08, 10-09]
tech-stack:
  added: []
  patterns: ["고른 의상(Actor.look)과 안개 의상(Actor.ghostOutfit)을 분리해 안개 중 look 변경은 값만 갱신", "의상 교체 경로 wear() 하나에서 applyOutfit + prewarm 재걸기"]
key-files:
  created:
    - test/unit/emoteStaticGuard.test.ts
  modified:
    - src/world/runtime.ts
    - src/world/character.ts
    - src/world/testHooks.ts
    - src/components/WorldStage.tsx
    - test/unit/character.test.ts
    - test/client/worldStage.test.tsx
decisions:
  - "안개가 끝나는 조건을 '유령 장면이 아니거나 spectate 의상이 없어짐(ghostOutfit !== null 이었음)'으로 넓혔다 — outfit 만 사라지고 유령으로 남는 경우도 고른 의상으로 돌아온다"
  - "__mfLooks 값은 런타임이 그리는 좌석(Actor)의 a.look 사본이다 — 안개 의상과 무관하고 액터 생성·제거·look 변경 때만 갱신"
  - "옛 시험 '의상을 바꿨다 돌아오면 같은 지오메트리 재사용'은 새 계약(최근 의상 하나만 남김)에 맞게 고쳤다"
metrics:
  tasks: 3
  tasks_completed: 3
actuals:
  tokens: 8500
  tasks: 3
  commits: 5
plan_head_before: cf173cd342b2b63135c92b495f1ffce75d8ec219
plan_head_after: 03e929d9
---

# Phase 10 Plan 04: 좌석별 의상 장면 적용 Summary

로비에서 고른 의상이 서버 view 를 거쳐 모든 폰의 장면에서 좌석별 캐릭터 의상이 되고, 유령 안개와의 우선순위·복원과 의상 교체 시 지오메트리 해제가 시험으로 고정됐다.

## 한 일

- **Task 1 (트레이서)**: `runtime.ts` 의 `OUTFIT = "coat"` 를 없애고 `lookOf(seat)`(= `deps.players()` 의 look, 없으면 coat)로 캐릭터를 만든다. `Actor.look` 이 고른 의상이고 `syncPlayers` 가 달라진 좌석만 `applyOutfit`. `deps.onLooks` → `installLooksHook()` → `window.__mfLooks`(훅 켜진 문맥에서만, DOM 속성 없음).
- **Task 2**: `character.ts` `applyOutfit` 이 `refresh(JOINTS)` 뒤 `releaseOtherOutfits()` 로 새 의상이 아닌 병합 캐시(`관절|의상`, `head|의상|표정`)와 돋보기 유리를 dispose 하고 `owned` 에서 뺀다. 런타임은 안개 중(`ghostOutfit !== null`)에는 look 값만 갱신하고, 안개가 끝나면 `setGhost` 다음 `wear(a, a.look)` 로 복원한다. `wear()` 는 `applyOutfit` 뒤 표정 prewarm 을 그 좌석에 다시 건다.
- **Task 3**: `emoteStaticGuard.test.ts` — `HeadStack.tsx`·`tagOrder.ts` 에 대소문자 무시 `emote` 와 동작 표시용 `data-` 속성이 없음을 고정. 클라이언트 시험 — 동작 재생 중 이름표 층에 `[data-emote]`·emote 속성 없음, 훅은 켜진 문맥에서만 생기고 언마운트하면 사라짐. 처음부터 통과하는 가드(제품 결함 없음).

## 검증

- `npx vitest run test/unit/character.test.ts test/client/worldStage.test.tsx test/unit/emoteStaticGuard.test.ts` 통과 (311개)
- `npm run typecheck` 오류 없음
- 계획의 웨이브 게이트(build·전체 vitest·ui.safety-gate·schema-drift)는 지시에 따라 돌리지 않았다 — 오케스트레이터가 웨이브 끝에서 돌린다.
- RED 확인: `releaseOtherOutfits()` 호출을 빼면 해제·14 이하 시험 3개가 실패(일시적으로 확인 후 복원).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - 계약 변경에 따른 옛 시험 갱신] 의상 교체 시험 두 개**
- **Found during:** Task 2 GREEN
- **Issue:** `character.test.ts` 의 "의상을 바꿨다 돌아오면 같은 지오메트리를 다시 쓴다"와 "해제 dispose"(교체 중 `mockClear` 후 마지막 dispose 호출 수 == 본 지오메트리 수)는 이전 의상 병합이 캐시에 남는다는 옛 동작을 전제로 했다.
- **Fix:** 첫째는 "돌아오면 이전 것은 해제되어 새로 만들고 개수는 그대로"로, 둘째는 `mockClear` 를 빼고 생애 전체에서 본 지오메트리가 모두 한 번씩 해제됐는지 보도록 고침.
- **Files modified:** test/unit/character.test.ts
- **Commit:** b3bff76 (RED 와 함께)

**2. [Rule 2 - 안개 해제 조건 보강]** 계획은 `wantGhost !== a.ghost` 분기 안의 안개 해제만 말했다. outfit 만 사라지고 유령 상태는 남는 경우 `ghostOutfit` 가 남아 고른 의상으로 돌아오지 못하므로 조건을 `|| a.ghostOutfit !== null` 로 넓혔다(이때 setGhost(true) 단독 호출, 기존 "outfit 없는 유령"과 같은 모양). Commit: 117a5b7.

## 커밋 (이 계획 5개, 10-05 커밋과 섞여 있음)

df8b4de test RED(트레이서) · 351f26f feat GREEN(트레이서) · b3bff76 test RED(안개·해제) · 117a5b7 feat GREEN(안개·해제) · 03e929d test(L31 가드, 처음부터 통과). `plan_head_before..plan_head_after` 범위에는 병렬 실행된 10-05 커밋이 섞여 있어 `commits: 5` 는 위 5개를 직접 센 값이다.

## Known Stubs

None.

## Threat Flags

None. T-10-13(안개는 장면 표 spectate 값에서만, 산 사람 화면 applyOutfit 0 시험), T-10-14(정적+DOM 시험), T-10-15(해제+14 이하 시험) 모두 시험으로 고정.

## 이월 메모

- 이름: `Actor.look`(고른 의상)·`Actor.ghostOutfit`(안개 의상), `WorldRuntimeDeps.onLooks`, `installLooksHook()` → `window.__mfLooks = {좌석: 의상 id}`(그리는 좌석 전부, 안개 무관), 런타임 `wear(a, outfit)` / `lookOf(seat)` / `DEFAULT_LOOK`.
- 안개 복원 규칙: 안개 중에는 view 의 look 이 바뀌어도 값(`a.look`)만 갱신, 안개가 끝나면 `setGhost` 다음 `wear(a, a.look)`. 산 사람 화면은 안개 경로 없음.
- `applyOutfit` 은 새 의상이 아닌 병합 캐시·돋보기 유리를 dispose 하고 owned 에서 뺀다(최근 의상 1개). 아홉 의상 × 7표정 × prewarm 에서 owned 최대 13.
- 10-06(에셋 검사): `WorldCharacter.ownedGeometryCount()`(character.ts)·`prewarm(face?)`(PREWARM_FACES 5개), 런타임은 `PlayableCharacter.prewarm?` 로 부른다. 가짜 키트 `makeFakeKit` 은 이제 `create(fig, outfit)` 의 outfit 을 `FakeHandle.outfit` 에 기록.
- 10-07(꾸미기 UI): `view.players[me].look` 을 바꿔 WorldStage 에 넘기면(낙관적 미리 보기 포함) `syncPlayers` 가 즉시 그 좌석만 갈아입는다. 서버가 거절하면 서버 state 가 look 을 되돌린다(10-02 규칙).
- E2E(10-08/09): `window.__mfLooks` 는 `?e2e=1`·개발에서만. 값 전체 비교는 `toEqual({0:"coat",...})` 모양.
- STATE.md/ROADMAP.md/REQUIREMENTS.md 는 병렬 실행 지시에 따라 건드리지 않았다(오케스트레이터가 갱신).

## Self-Check: PASSED

- 생성 파일 test/unit/emoteStaticGuard.test.ts 존재 확인.
- 커밋 df8b4de·351f26f·b3bff76·117a5b7·03e929d 가 HEAD 의 조상임을 확인.

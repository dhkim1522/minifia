---
phase: 10-character-motion-costume
plan: "03"
subsystem: world-client
tags: [emote, runtime, three-character, test-hook, reduced-motion]
status: complete
requirements: [AVTR-03]
requires:
  - phase: 10-01
    provides: "EmoteFrame{t,seat,id,n}, EMOTE_MS, 서버 emote 처리기 (채널별 n)"
provides:
  - "서버 emote 프레임 → 연결 → 스토어 → 런타임 → 그 좌석 3D 캐릭터 동작 재생 (로비·게임 장면)"
  - "동시 재생 상한 EMOTE_RENDER_MAX=4 (도착 순서), stopEmote, 단계 전환 정리, deny 건너뛰기"
  - "모션 줄이기 변형, 표정 병합 선행(prewarm), ownedGeometryCount, window.__mfEmotes 훅"
affects: [10-04, 10-05, 10-06, 10-07, 10-08, 10-09]
tech-stack:
  added: []
  patterns: ["사건 채널(onEmote)은 위치 상태와 분리 — 마지막 프레임을 기억하지 않는다", "순수 선택 모듈(emoteCap) + 런타임 연결", "표정 병합은 표정마다 requestIdleCallback 체인"]
key-files:
  created:
    - src/world/emoteCap.ts
    - test/unit/emoteCap.test.ts
  modified:
    - src/net/useRoomConnection.ts
    - src/screens/RoomScreen.tsx
    - src/world/store.ts
    - src/world/runtime.ts
    - src/world/character.ts
    - src/world/testHooks.ts
    - src/components/WorldStage.tsx
    - test/unit/worldStore.test.ts
    - test/unit/character.test.ts
    - test/client/worldStage.test.tsx
    - test/client/useRoomConnection.test.tsx
decisions:
  - "재생 순서는 프레임 n 이 아니라 도착 순서(배열 순서)다 — n 은 채널별이라 채널 사이에 견줄 수 없다"
  - "deny 가 사람 동작 재생 중인 좌석에서는 손사래와 놀란 표정을 모두 건너뛴다"
  - "모션 줄이기 y 절반은 서 있는 높이(base.y)에서 벗어난 만큼의 절반이다"
  - "prewarm 은 표정마다 따로, 앞 작업이 끝나면 다음을 거는 유휴 체인이다 (한 작업에 병합 한 번)"
metrics:
  tasks: 3
  tasks_completed: 3
actuals:
  tokens: 12600
  tasks: 3
  commits: 6
plan_head_before: f9c8eef
plan_head_after: 456aac2
---

# Phase 10 Plan 03: 동작 클라이언트 재생 Summary

서버 emote 프레임이 연결 → 스토어 → 런타임을 지나 그 좌석 캐릭터의 몸 동작이 되고, 동시 4개 상한·단계 전환 정리·모션 줄이기 변형·표정 병합 선행이 시험으로 고정됐다.

## 한 일

- **Task 1 (트레이서)**: `useRoomConnection` 이 emote 를 typing 과 같은 길(허용 목록·전달 조건·끝난 연결 버림)로 흘리고, `RoomScreen.onEvent` 가 `store.applyEmote(e, meta.epoch)` 로 먹인다. `WorldStore.applyEmote/onEmote` 는 사건 채널이다. 런타임이 구독해 좌석 캐릭터의 `playEmote` 를 부르고 `window.__mfEmotes` 를 갱신한다(훅 문맥에서만, DOM 속성 없음).
- **Task 2**: `emoteCap.ts` 의 `admitEmote`(만료·같은 좌석 대체·도착 순서)로 상한 4. `WorldCharacter.stopEmote()` 는 120ms 에 서 있는(유지) 자세로 섞고 yaw 를 건드리지 않는다. 걷는 좌석은 목록에서 빠지고, `deny` 는 사람 동작 중이면 건너뛰며, `phaseKey` 가 바뀌면 `stopAllEmotes()`.
- **Task 3**: `playEmote(id,{reduced})` 로 반복 2 이하·surprise/dance y 절반. `prewarm(face?)`·`ownedGeometryCount()` 추가, 런타임이 표정별 유휴 작업으로 prewarm 하고 퇴장·dispose 에서 취소. 아홉 동작 재생 중 메시·조명·병합 지오메트리(≤14)가 늘지 않음을 고정.

## 검증

- `npx vitest run test/unit/worldStore.test.ts test/client/worldStage.test.tsx test/client/useRoomConnection.test.tsx` 통과
- `npx vitest run test/unit/emoteCap.test.ts test/unit/character.test.ts test/client/worldStage.test.tsx` 통과 (302개)
- `npm run typecheck` 오류 없음
- 계획의 웨이브 게이트(build·전체 vitest·ui.safety-gate·schema-drift)는 지시에 따라 돌리지 않았다 — 오케스트레이터가 웨이브 끝에서 돌린다.

## Deviations from Plan

None - 계획대로 실행했다. 세부 선택 두 가지(계획이 열어 둔 부분):
- `playEmote` 옵션은 항상 `{ reduced: boolean }` 으로 넘긴다(계획 문구는 reduced 일 때만 의미가 있으나 호출을 한 모양으로 통일).
- 동작이 끝난 항목의 만료·걷는 좌석 제거는 프레임 루프 끝 `sweepEmotes` 에서 한다.

## 커밋 (이 계획 6개, 10-02 커밋과 섞여 있음)

3fd502b test RED(트레이서) · f45f893 feat GREEN(트레이서) · 5676003 test RED(상한) · 82f11bb feat GREEN(상한) · cb2270b test RED(줄이기·병합) · 456aac2 feat GREEN(줄이기·병합). `plan_head_before..plan_head_after` 범위에는 병렬 실행된 10-02 커밋이 섞여 있어 `commits: 6` 은 위 6개를 직접 센 값이다.

## Known Stubs

None.

## Threat Flags

None. (T-10-10 phaseKey 정리·T-10-11 상한 4 + 유휴 병합·T-10-12 훅 문맥 한정 모두 시험으로 고정.)

## 이월 메모

- 상한·시간 계산은 `src/world/emoteCap.ts`: `EMOTE_RENDER_MAX`(4)·`admitEmote`·`emoteDurationMs(id,reduced)`·`emoteCycles`·`REDUCED_MAX_CYCLES`·`REDUCED_Y_SCALE`. 순서는 도착 순서(n 미사용, 채널별 n).
- 수신: `WorldStore.applyEmote(frame, epoch)` / `onEmote(cb)`(reset 이 구독을 지우지 않음, 마지막 프레임 미기억). `RoomScreen.onEvent` 가 emote 를 채팅이 아니라 store 로 보낸다.
- 런타임: `WorldRuntime.stopAllEmotes()`, `deps.onEmotes`, `PlayableCharacter` 에 `stopEmote?`·`prewarm?`. `WorldStage` 가 `phaseKey` 변경에서 stopAllEmotes 호출(첫 마운트 제외).
- 캐릭터: `WorldCharacter.stopEmote()`·`prewarm(face?)`·`ownedGeometryCount()`·`playEmote(id,{reduced})`. `Emote` 상태는 `{id,t,stopT,reduced}`.
- 훅: `installEmotesHook()` → `window.__mfEmotes={last:{seat,id,n}|null, playing:number[]}`. E2E(10-08/09) 는 이 값만 읽고 DOM 속성은 없다.
- `ownedGeometryCount` 는 의상 교체 시 이전 의상 병합도 캐시에 남아 늘 수 있다 — 10-04(의상 적용)는 `applyOutfit` 뒤 `prewarm()` 을 다시 부르고 ≤14 가정을 의상 id 별로 다시 확인할 것.
- 10-04 가 이어받을 파일: `src/world/runtime.ts`(createActor 의 OUTFIT 상수·prewarmLater)·`src/world/character.ts`(applyOutfit/merged 캐시)·`src/world/testHooks.ts`·`src/components/WorldStage.tsx`.
- 테스트 가짜 캐릭터(`makeFakeKit`)에 `stopEmote`·`prewarm` 이 추가됨 — 다른 계획의 가짜 핸들도 필요하면 같은 모양으로.
- deny 는 사람 동작 중이면 손사래+놀란 표정 둘 다 건너뛴다(계획 문구는 playEmote 만 언급).

## Self-Check: PASSED

- src/world/emoteCap.ts, test/unit/emoteCap.test.ts 존재 확인.
- 커밋 3fd502b·f45f893·5676003·82f11bb·cb2270b·456aac2 가 HEAD 의 조상임을 확인.

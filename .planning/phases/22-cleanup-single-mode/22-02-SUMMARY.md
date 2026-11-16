---
phase: 22-cleanup-single-mode
plan: "02"
subsystem: world/ghost
tags: [ghost, scale, facing, e2e-hook]
requires: []
provides:
  - "3D 유령 모형 배율 0.75(GHOST_SCALE), 유령 headY = GHOST_ART_H × CHAR_SCALE × 0.75"
  - "유령이 산 캐릭터처럼 이동 방향을 본다(카메라 역회전 삭제)"
  - "window.__mfGhosts = { seats, ready, scale, facing }"
  - "E2E ghost 흐름 GH16(배율·facing 길이), GH17(걸은 방향·멈춘 뒤 유지)"
affects: [22-03]
key-files:
  modified:
    - src/world/character.ts
    - src/world/characterData.ts
    - src/world/runtime.ts
    - src/world/testHooks.ts
    - test/unit/character.test.ts
    - test/client/worldStage.test.tsx
    - scripts/e2e/flows.mjs
    - scripts/e2e/browser.mjs
decisions:
  - "GHOST_SCALE 은 character.ts 가 아니라 characterData.ts 에 둔다(runtime.ts 가 three 를 정적으로 부르지 않는 구조라 character.ts 를 값으로 import 할 수 없다)"
  - "facing 값은 runtime 의 actor yaw(= root.rotation.y)를 소수 둘째 자리로 반올림한 것이다"
metrics:
  tasks: 2
status: complete
actuals:
  tasks: 2
  commits: 4
plan_head_before: f3672f85516859de57579899ad2070f8f986c63b
plan_head_after: c0e41457060619e53917d7cc2eef112efdd843a0
commits: 4
---

# Phase 22 Plan 02: 유령 75% 크기·이동 방향 회전 Summary

유령이 산 캐릭터의 75% 크기로 줄고 이동 방향으로 몸을 돌리며, E2E 훅 `__mfGhosts` 가 배율과 좌석별 방향을 알려 자동으로 판정한다(결정 0089-17, D-20·D-21, 결정 0084-3 개정).

## 한 일

**Task 1 — 배율·역회전 삭제**
- `applyGhost` 가 3D 유령 묶음을 만든 직후 `sprite.root.scale.setScalar(GHOST_SCALE)`.
- `update` 유령 분기에서 `sprite.root.rotation.y = CAM_YAW - root.rotation.y` 를 지워 묶음이 root 방향을 그대로 따른다. 쓰지 않게 된 `CAM_YAW` import 삭제.
- `headY` 는 `GHOST_ART_H * CHAR_SCALE * GHOST_SCALE`. `GHOST_ART_H = 2.45` 는 그대로라 산 사람 이름표 높이는 변하지 않는다.
- 단위 시험: 높이 2.45×0.75·발밑 0, headY 0.75 배, "카메라를 본다" 시험을 "묶음 자체 회전 0 + 세계 방향 = root.rotation.y(0, 1.2, −2.0)" 로 교체.

**Task 2 — E2E 훅·ghost 흐름**
- `runtime.ts` `emitGhosts` 가 좌석 오름차순의 facing(actor.yaw 반올림)과 scale 을 더해 seats·ready·facing 중 하나라도 바뀔 때만 `onGhosts` 를 부른다.
- `testHooks.ts` 의 Window 타입·`installGhostsHook`(초기 `scale: 0, facing: []`)·set 복사 확장. `WorldStage.tsx` 는 `onGhosts: ghostsHook?.set` 로 이미 그대로 이어져 있어 수정 불필요. 직업·의상·닉네임은 싣지 않는다.
- worldStage 시험: 훅 키 넷과 facing 길이, 유령이 걸으면 facing = π/2(반올림), 멈춘 뒤 같은 방향이면 다시 알리지 않음(객체 동일성).
- E2E: `readGhosts` 에 scale·facing 추가, 산 사람 페이지 훅 키 기대값을 `["facing","ready","scale","seats"]` 로 변경, GH16·GH17 추가.

## RED 증거

- Task 1 RED(`57695f1e`): `character.test.ts` not ok 3건(높이·headY·방향).
- Task 2 RED(`59ce4c9d`): `worldStage.test.tsx` `__mfGhosts` describe not ok 2건(키 넷·걸은 방향).

## 검증 결과

- `npx vitest run test/unit/character.test.ts test/client/ghostView.test.tsx` 통과(136), `test/client/worldStage.test.tsx test/client/ghostView.test.tsx` 통과(361).
- `npx vitest run --project unit --project client`: 250 파일 통과·1 skip, 8363 통과·184 skip.
- `node --test scripts/e2e/*.test.mjs`: 625 통과, 0 실패.
- `npm run typecheck`: error TS 0건.
- `npm run e2e -- --url http://localhost:5173 --only ghost`(6개 크기, 이미 떠 있던 vite dev 서버가 HMR 로 새 코드 반영): GH14·GH14b·GH14c·GH15·GH16·GH17 전 크기 통과. 실패 1건은 아래 GH13 간헐(재실행 통과).
- `--only ghost --sizes 390x664` 재실행: E2E OK(GH13 통과 포함).

## Deviations from Plan

**1. [Rule 3 - 구조] GHOST_SCALE 위치를 characterData.ts 로**
- 계획은 character.ts 에서 export 해 runtime 이 쓰라고 했으나, `runtime.ts` 는 `character.ts`(three 포함)를 `import type` 과 동적 import 로만 쓰는 구조라 값 import 시 three 가 정적으로 번들에 들어간다. 이미 runtime 이 값으로 읽는 순수 데이터 파일 `characterData.ts` 에 상수를 두고 양쪽이 import 한다.
- 결과: character.ts 의 `GHOST_SCALE` grep 이 3(import·배율·headY). 인수 기준 ">=3" 충족.

**2. [계획 오류 정정] GH15 id 충돌**
- 계획은 새 행을 GH15·GH16 으로 지정했지만 GH15 는 이미 "산 사람 페이지 훅 모양" 행으로 쓰이고 있다(키 기대값 단언도 계획이 말한 GH14 가 아니라 이 GH15 에 있었다). 새 행은 GH16(배율·facing 길이)·GH17(걸은 방향·유지)로 번호를 매기고 기존 GH15 의 키 기대값을 `["facing","ready","scale","seats"]` 로 바꿨다. 인수 기준의 `GH15|GH16` grep 2건 이상도 충족.

**3. GH17 기대 방향**
- `window.__mfWorld` 의 시작·끝 위치 대신, tap 이 받은 구간의 마지막 걸음 선분(`tap.move.p` 의 끝 두 점)의 `atan2(dx, dz)` 를 기대값으로 썼다(runtime 의 travelYaw 가 마지막 선분 방향으로 멈추기 때문 — 꺾이는 길에서 시작·끝 직선이 틀릴 수 있다). 점이 2개 미만이면 판정 대신 정보 행으로 남긴다(이번 실행은 전 크기 판정됨).

## 알려진 사항·미실행

- **GH13 간헐 실패 1회**: 첫 6개 크기 실행에서 390x664 의 GH13(유령 이름표 글자 대비)이 자리 1 2.96:1 로 실패했고, 같은 크기 재실행은 통과(자리 0 16.75:1 만 측정). 이 항목은 밤에 죽는 사람 수·이름표 뒤 장면에 따라 측정 대상이 달라지는 값이라 이 계획 변경(크기·방향)과의 인과는 확인하지 못했다. 재현되면 유령 이름표 틈(계획자 가정, 실테스트 뒤 판단)과 함께 볼 것.
- 계획자 가정 그대로: 유령 이름표가 머리보다 높이 떠 보이는 틈은 D-20 의 결과로 허용하고 손보지 않았다.
- 실기기 시각 확인(75% 크기가 보기에 적절한지)은 하지 않았다(실기기 검사는 끝에 몰아서).
- `--project worker` 전체 실행은 이 계획 범위(world/클라이언트)와 무관해 돌리지 않았다.

## Known Stubs

없음.

## Threat Flags

없음. 새 값은 좌석·몸 방향·배율뿐이며 설치 조건(`worldTestHooksEnabled`)은 그대로다(T-22-02 mitigate 충족, 역할·의상 없음).

## Self-Check: PASSED

- 수정 파일 8개 존재 확인, 커밋 4개(`57695f1e`, `f76d9293`, `59ce4c9d`, `c0e41457`) 가 HEAD 의 조상임.

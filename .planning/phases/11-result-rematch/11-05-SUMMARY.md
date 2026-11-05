---
phase: 11-result-rematch
plan: "05"
subsystem: src/screens + src/world + src/game + scripts/e2e
tags: [result-screen, 3d-stage, resultDirector, tdd, e2e]
requires: [11-03]
provides: [ResultScreen(3D 장면), resultDirector, SeatLook costume·dim, WorldStage onStageTap·emoteCues·onCostumes, window.__mfResult, resultStageChecks]
affects: [11-07, 11-09, 11-12]
tech-stack:
  added: []
  patterns: [순수 디렉터(stateAt·markTimes·walkSnap) + 표시각마다 setTimeout, 클라이언트가 만든 snap 한 프레임을 스토어에 먹임, 런타임이 적용한 값을 콜백으로 훅에 노출]
key-files:
  created:
    - src/game/resultDirector.ts
    - scripts/e2e/result.mjs
    - scripts/e2e/result.test.mjs
    - test/unit/resultDirector.test.ts
  modified:
    - src/screens/ResultScreen.tsx
    - src/screens/RoomScreen.tsx
    - src/world/presence.ts
    - src/world/runtime.ts
    - src/world/testHooks.ts
    - src/components/WorldStage.tsx
    - src/game/verdict.ts
    - src/styles/result.css
    - test/unit/presence.test.ts
    - test/unit/verdict.test.ts
    - test/unit/e2eContract.test.ts
    - test/client/resultScreen.test.tsx
    - test/client/worldStage.test.tsx
    - test/client/atmosphere.test.tsx
    - test/client/characterAudit.test.tsx
    - test/client/guide.test.tsx
    - scripts/e2e/flows.mjs
    - scripts/e2e/lib.mjs
    - scripts/e2e/lib.test.mjs
decisions:
  - "연출 단계 이름은 구간 다섯: gather [0,1200) · flip [1200,4600) · light [4600,5200) · announce [5200,5600) · final [5600,). 승리 알림은 light 구간 플래그, 헤더 제목은 final 부터 승리 한 줄."
  - "건너뛰기는 4600 상태로 점프하되 남은 시간표(5200·5600)는 이어서 돈다. 승리 알림만 건너뛰고 박수 큐는 점프 순간에 낸다."
  - "박수·화면 연출 동작은 런타임 emote(seat,id) 로 서버 동작과 같은 재생 목록·동시 상한(4)을 쓰고 E2E 훅 last(받은 프레임)는 바꾸지 않는다."
status: complete
commits: 6
plan_head_before: 9a6f0204438a79967a0f0660ebb900f84bb43e1d
plan_head_after: 16206b8c2dae91a565a5bdf3d3adc4d9ba58ba3b
actuals:
  tokens: 28000
  tasks: 3
  commits: 6
completed: 2026-11-05
requirements: [END-03]
---

# Phase 11 Plan 05: 결과 화면을 3D 무대 위 한 장면으로 Summary

끝난 판이 2D 카드 격자가 아니라 같은 3D 무대 위 장면으로 보인다 — 모두 둘레 자리로 모이고, 칩이 한 명씩 뒤집히며 직업 의상을 입고, 이긴 팀은 무대 가운데 조명과 박수를 받고 진 팀은 어두워지며, 무대를 한 번 탭하면 건너뛴다. 읽는 글은 헤더의 승리 한 줄뿐이고 아래는 전체 채팅 한 줄과 나가기다.

## 한 일

- Task 1 (tracer): `resultDirector`(순수: RESULT_TIMELINE·castOf·slotsFor·finalState·holdSnap), `SeatLook` 에 `costume`·`dim`, 런타임이 장면 표의 costume(안개 outfit 이 우선, 탈락자는 반투명 그대로)·dim 을 적용하고 `onCostumes(입은 의상 표, 어두워진 좌석)` 를 바뀔 때만 알림. 새 `ResultScreen`(헤더 [나가기]+승리 한 줄+아이콘, 칩은 뒤집힌 사람만 tagProps role, 채팅 한 줄 패널 188/244, 나가기 확인 시트→leave→onExit("left")). 옛 카드 격자·배너·요약·[처음으로]·방 닫힘 안내와 verdict.ts 의 옛 문구·연출 시각·summaryLines 제거.
- Task 2: `stateAt`·`markTimes`·`walkSnap`, 표시각마다 setTimeout(프레임 리렌더 없음), 모임 걷기는 스토어 마지막 위치→자리 1200ms 안 도착 snap, 4600 조명·진 팀 어둠·박수 큐 최대 4(`emoteCues` nonce)·승리 알림(36px+아이콘, opacity 만), 무대 탭 `onStageTap` 으로 4600 점프, 재접속·처음 마운트·모션 줄이기·execution/morning 이외 도착은 곧바로 final. 칩 뒤집힘은 연출 마운트만 transform 0.3초.
- Task 3: `scripts/e2e/result.mjs`(`resultStageChecks` RS1~RS8, `resultSkipChecks` RS9, `readResultStage`, `RESULT_MARKERS`), flows.mjs 의 result 흐름을 새 판정으로 교체(시민 승·마피아 승, final 도달 뒤 판정, 첫 판에서 실제 마우스로 건너뛰기, 채팅 한 줄 왕복), 옛 resultChecks·resultFitChecks·summaryRowsOf 제거, 표식·표 대조 시험(e2eContract).

## 시험

- 단위·클라이언트: resultDirector 18, presence(costume·dim 키 없음 확인), worldStage 235(costume·dim·onCostumes·onStageTap·emoteCues 12건 추가), resultScreen 45, verdict, roomScreen, guide·characterAudit·atmosphere·gameMap, e2eContract 37 — 11개 파일 634건 통과. `node --test result.test.mjs lib.test.mjs` 274건 통과. typecheck 는 이 계획 파일 오류 없음.
- E2E `npm run e2e -- --url http://127.0.0.1:5391 --only result`(390x844, 개발 서버): **통과 25 / 실패 0** (시민 승·마피아 승 각 S1·S2·P8·G·RS1~RS8, 시민 승 판에 RS9 건너뛰기 실측 통과). 사진으로 최종 상태 확인(직업 의상·진 팀 어둠·칩·헤더 아이콘).
- 웨이브 게이트(전체 회귀·build·nightload)는 지시대로 돌리지 않았다.

## Deviations from Plan

**1. [Rule 3 - 막힌 작업] 옛 결과 화면을 보던 시험 세 파일을 새 계약으로 맞춤**
- test/client/guide.test.tsx(ended data-guide 는 이제 헤더 제목 `시민 승리`/`마피아 승리`), characterAudit.test.tsx(결과의 카드 → 3D 이름표), atmosphere.test.tsx(옛 배경 그림 → 런타임 장면 lighting night). 계획 파일 목록 밖이지만 ResultScreen 교체의 직접 결과다.

**2. [Rule 2] 헤더 제목에 data-guide 를 둠**
- 한 화면에 data-guide 정확히 하나(UX1) 계약이 있어 옛 배너 제목 자리를 헤더 h1 이 이어받는다.

**3. 보조 선택**
- `onCostumes` 는 의상 표와 함께 어두워진 좌석(dimmed)도 넘긴다(RS3 이 화면이 정한 값이 아니라 런타임이 적용한 값을 보게). 런타임에 `emote(seat,id)` 를 더했다(박수 큐 전용, 서버 동작과 같은 재생 목록·상한 4).
- 옛 배경 크로스페이드(arrivedFrom → fromScene)는 3D 무대로 바뀌며 없어졌다. arrivedFrom 은 연출 여부 판정에만 쓴다(RoomScreen 의 mf-phase-enter 300ms 가 장면 진입을 맡는다).
- scripts/e2e/browser.mjs 의 `readResult`·`readResultFit` 은 이제 쓰는 곳이 없다(계획 파일 목록 밖이라 지우지 않음).

## 환경 메모 (이 계획과 무관)

- 병행 작업 중인 파일 때문에 보인 실패: test/client/lobby.test.tsx 방장 변경 줄 3건(11-04 작업 중 lobby.test 수정), test/worker/leak.test.ts·src/debug/soundLab* typecheck 오류(11-04·12-05). 이 계획 변경과 무관해 손대지 않았다.

## Known Stubs

없음.

## Threat Flags

없음. 직업·의상은 ended 경로(castOf ← view.result.seats)에서만 만들고, 판 중 장면 표(visibleSeats)에 costume·dim 키가 없음을 시험으로 고정했다(T-11-15). 연출 snap 은 이 폰의 스토어에만 들어간다(T-11-16). 박수는 최대 4(T-11-17).

## 이월 메모

- `ResultScreen` props: `view(ended+result)·store·chat·send·canSend·offset·epoch·onExit()·arrivedFrom`. 패널은 `<section data-result-panel>` 안의 ChatPanel 한 개(11-07 이 이 자리를 탭 패널로 바꾼다, 동작 버튼·typing 은 `guardedSend` 로 막음). 나가기 ConfirmSheet 는 헤더 [나가기] → `leaveOpen` 상태(11-12 가 알약·방장 토스트를 여기에 더한다).
- `resultDirector`: `RESULT_TIMELINE`·`CEREMONY_START_MS`(5600, 11-09 시작 시각)·`stateAt(t,cast,winner)`·`markTimes(n)`·`finalState`·`slotsFor`(좌석 오름차순 → ringSlots)·`holdSnap`·`walkSnap`·`castOf`·`CLAP_MAX`. 단계: gather/flip/light/announce/final. 시계는 ResultScreen 의 `mark` 상태(표시각 setTimeout), 11-09 는 `mark >= 5600`(final) 에서 이어 붙이면 된다.
- WorldStage 새 prop: `onStageTap()`·`emoteCues[{seat,id,nonce}]`(처음 마운트 값은 무시)·`onCostumes(costumes,dimmed)`. `SeatLook.costume?: OutfitId`·`dim?: true`(결과 전용). 런타임 `emote(seat,id)`.
- `window.__mfResult = { stage, chips, dimmed, costumes }`(dimmed·costumes 는 런타임 적용값). `result.mjs` export: `RESULT_MARKERS·RESULT_JOB_OUTFIT·RESULT_WIN_TITLE·RESULT_PANEL_H·resultStageChecks·resultSkipChecks·readResultStage`.
- 최종 자리 snap 은 마운트·epoch 변경 때만 먹인다. 11-04 서버가 ended 에서 world snap 을 보내면 같은 epoch 에서는 서버 snap 이 이길 수 있다 — 11-08(다시 하기) 이 서버 snap 으로 이어받는다.
- 11-12 에 알림: 결과 화면은 칩을 `tagProps().role` 로만 그린다(루트 속성에 역할·의상 없음). 다시 하기 알약은 입력줄 옆이 아니라 패널 위에 두는 편이 `canSend`·guardedSend 와 겹치지 않는다.

## Self-Check: PASSED

- 생성 파일 확인: src/game/resultDirector.ts · scripts/e2e/result.mjs · scripts/e2e/result.test.mjs · test/unit/resultDirector.test.ts 존재.
- 커밋 확인: 663fbcd0 d1cdd691 a79ae570 fdff06e7 7fd6ec2d 16206b8c 모두 HEAD 의 조상.

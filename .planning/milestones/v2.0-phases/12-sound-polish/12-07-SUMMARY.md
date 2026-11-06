---
phase: 12-sound-polish
plan: "07"
subsystem: ui
tags: [web-audio, react, unlock-gesture, e2e, playwright]
requires:
  - phase: 12-sound-polish
    provides: "12-05 엔진(createEngine·subscribe·snapshot·hidden/visible·installSoundHook), 12-06 sound.mjs·SOUND_MARKERS"
provides:
  - "SoundButton(on/off/locked, 알약 8초 접힘), useSound, unlockAudio/getEngine 싱글턴"
  - "홈 [방 만들기]·[참가]·저장된 입장 분기·링크 참가 [참가하기] 가 요청보다 먼저 동기로 오디오를 깨움"
  - "E2E sound-unlock(390x844·360x560), soundButtonChecks(SU1~SU7)"
affects: [12-08, 12-09, 12-10, 12-11, 12-12]
actuals:
  tokens: 17569
  tasks: 3
  commits: 4
plan_head_before: 17bfba32
plan_head_after: 0a0d187f
tech-stack:
  added: []
  patterns: ["엔진 싱글턴 + 시험 교체(setEngineForTest)", "문서 이벤트는 useSound 한 곳에서만 걸고 언마운트에 모두 푼다"]
key-files:
  created:
    - src/audio/unlock.ts
    - src/audio/useSound.ts
    - src/components/v2/SoundButton.tsx
    - test/client/soundButton.test.tsx
    - test/client/useSound.test.tsx
  modified:
    - src/audio/engine.ts
    - src/components/v2/V2Icon.tsx
    - src/styles/v2.css
    - src/screens/RoomScreen.tsx
    - src/screens/Home.tsx
    - src/screens/JoinByLink.tsx
    - scripts/e2e/sound.mjs
    - scripts/e2e/flows.mjs
    - scripts/e2e/lib.mjs
    - scripts/e2e/lib.test.mjs
    - test/unit/e2eContract.test.ts
    - test/unit/soundEngine.test.ts
    - test/client/icon.test.tsx
    - test/client/app.test.tsx
key-decisions:
  - "단추 층은 calc(var(--z-overlay) + 1) = 51 로 확정(재접속 띠·[테스트]·지도 칩 50, 헤더 40, 시트·모달 100)"
  - "문서 pointerup·touchend·keydown 처리기는 [data-sound-button] 안에서 난 이벤트를 건너뛴다(locked 단추를 누를 때 켜자마자 꺼지지 않게)"
  - "setOn(false) 는 ui.toggle(끔)을 먼저 내고 그 보이스는 페이드 대상에서 빼며 나머지만 120ms 에 줄인다"
status: complete
---

# Phase 12 Plan 07: 소리 켜기·끄기·잠금 해제 Summary

방 화면 오른쪽 위 소리 단추(on/off/locked 알약)와, 홈·링크 참가 제출 탭에서 요청보다 먼저 동기로 오디오를 깨우는 잠금 해제를 만들고 E2E sound-unlock 을 두 폰 크기에서 통과시켰다.

## 한 일

- **Task 1(트레이서)**: `unlockAudio()`/`getEngine()`(src/audio/unlock.ts), `useSound`(useSyncExternalStore 구독), `SoundButton`, V2Icon `sound`·`soundOff`, `.mv-sound` 규칙, RoomScreen 에서 `view` 가 있고 `supported` 일 때 한 번만 렌더, Home 처리기 맨 앞 `unlockAudio()`.
- **Task 2**: 세 상태·알약(locked 로 들어갈 때마다 8초 새로 셈)·토글 저장·제스처 resume(pointerup·touchend·keydown, running 이 아닐 때만)·visibilitychange→hidden()/visible()·언마운트 stopAll·JoinByLink 연결·엔진 끄기 순서 보정.
- **Task 3**: `soundButtonChecks`(lib.mjs, 진리표는 lib.test.mjs), `SOUND_MARKERS` 에 `data-sound-button`·`data-sound-state`, `sound-unlock` 흐름(sound.mjs)과 두 크기 등록(flows.mjs).

## 시험·검증

- 타깃 vitest: soundButton·useSound·icon·app·roomScreen·joinByLink·screens·soundEngine·soundStaticGuard·soundHook·e2eContract 모두 통과(마지막 묶음 363건 중 e2eContract 한 건은 정규식 중복을 고쳐 재통과, 44/44). `node --test scripts/e2e/lib.test.mjs` 272/272. `tsc -p tsconfig.app.json`·`tsconfig.worker.json` 오류 없음(`npm run typecheck` 의 tokens:check·wrangler types 단계도 지나감).
- **E2E `sound-unlock`**(vite dev 127.0.0.1:5291, 끄고 종료): `sound-unlock 390x844` 24/24, `sound-unlock 360x560` 24/24, `E2E OK`.
- 기하 실측(두 크기 동일): 누르기 44×44, 위 70 = 헤더 아래 끝 62 + 8, 오른쪽 여백 16(360 폭 left 300, 390 폭 left 330), 시각 원 36×36(누르기 안쪽 4), 알약 116.9×44, z-index 단추 51 / 재접속 띠 50. SU4 상대는 [나가기]·[공유]·지도 칩과 [테스트](87.7×44, left 16 top 70) — 겹침 0. SU5 띠가 단추 중심을 덮은 상태에서 최상단이 단추 자신.

## Deviations from Plan

### 계획 대비 변경

**1. Task 1·2 GREEN 을 한 커밋(5e810893)으로 묶음** — 두 태스크의 RED 시험을 이미 한 커밋(c4120dc0)에 썼고 구현이 한 덩어리(useSound·SoundButton·화면 연결)라 나누면 중간 커밋에서 시험이 빨갛게 남는다. 커밋: test×2 + feat×2 = 4.

**2. [Rule 1 - Bug] 시험 자체 오류 세 가지를 GREEN 에서 고침** — (a) lib.test.mjs 의 도우미 `R` 가 기존 `R`(행 도우미)와 이름이 겹침 → `sRect`; (b) 알약 시험에 토스트 사각형을 두어 SU4 가 같이 실패 → 알약 케이스는 toast null; (c) e2eContract 표식 시험이 주석 속 `data-sound-state=` 까지 세어 중복 → 주석 제거 + 집합. soundButton.test 의 `makeRig` 반환 `storage` 는 엔진이 쓰는 저장소가 아니라서 mount 에서 시험이 주입한 저장소로 바꿈.

**3. 호출 자리 정적 시험은 `src/components`·`src/screens` 만 훑음** — 계획 문구 "단추·잠금 해제 외 소리 호출 0"을 컴포넌트·화면으로 좁혔다. src 전체로 하면 12-08 이후 감독(src/audio)이나 시험 페이지(src/debug/soundLab*)가 막힌다.

**4. 계획 files_modified 밖** — 없음. 시험 두 곳(roomScreen·joinByLink·screens)은 수정 없이 통과 확인만 했다.

**5. 웨이브 게이트 생략** — 요청에 따라 `npm run build`·전체 vitest·ui.safety-gate·schema-drift 는 돌리지 않았다(오케스트레이터 몫).

### 병렬 실행 부작용(알림)

- 커밋 `5e810893` 에 12-01 실행기가 그 순간 index 에 올려 둔 삭제(`scripts/uat-day.mjs`, `src/styles/day.css` 72줄 삭제)가 함께 들어갔다. 공유 작업 트리의 index 가 하나라 `git add <내 파일>` 뒤 `git commit` 이 그 스테이징까지 커밋한 것이다. 내용 손실은 없고 12-01 의 이력 귀속만 어긋난다. 이후 커밋은 `git commit --only -- <경로>` 로 내 경로만 커밋했다.

## Known Stubs

없음.

## Threat Flags

없음(새 네트워크 경로·서버 메시지 없음. 소리 파일에 fetch·WebSocket·send 0 은 soundButton.test 가 정적으로 고정).

## 이월 메모

- 12-08: `useSound({ engine?, active?, hook? })` → `{ supported, state: on|off|locked, engine }` (src/audio/useSound.ts, 인자 확장 지점은 `UseSoundOptions`). RoomScreen 이 한 번 호출(`active: view !== null`, `hook: worldTestHooksEnabled(...)`). 감독은 같은 엔진 `getEngine()`(src/audio/unlock.ts)을 쓰고, 시험은 `setEngineForTest(rig.engine)`.
- 정적 가드: useSound.ts 에는 주석 포함 눌림 시작 이벤트 이름(touchstart·pointerdown)이 0 이어야 한다(수용 기준 grep). src/audio 새 파일은 허용 import 와 금지 단어(chat·mafia·whisper 등)를 피한다.
- 엔진 변경: `setOn(false)` 가 `ui.toggle`(끔) 을 먼저 낸다 → 끌 때 로그에 ui.toggle 한 줄이 남는다. 꺼짐→켜짐을 새로고침 직후(컨텍스트 없음, iOS 처럼 resume 이 비동기)에 하면 ui.toggle(켬)은 played 거짓일 수 있고 침대는 statechange(running)에서 시작한다.
- 단추 기하·층: 누르기 44, 시각 36, top 70(헤더 아래 끝 62 + 8), right 16, `z-index: calc(var(--z-overlay) + 1)`=51, `translateY(var(--mf-vv-top, 0px))`. 알약 116.9×44, 8초 접힘. 12-12 screen-map 에 옮길 값.
- E2E 더하는 법: `makeSoundFlows` 안에 흐름을 쓰고 반환 객체에 더한 뒤 flows.mjs 에서 구조 분해해 FLOWS 에 등록. 도우미 `hookIs(page, state)`·`setVisibility`·`readSoundGeometry` 는 sound.mjs 안에 있다(새 컨텍스트 + `reconnectInit` + `/?e2e=1&test=1`, 훅 켜짐은 sessionStorage 로 새로고침을 넘는다).
- 미검증: TopToast 가 떠 있는 순간의 겹침(두 크기 모두 토스트 null 이라 SU4 의 토스트 항은 공허), 낮·밤·결과 화면의 헤더/패널과의 겹침(.mv-ballots 는 z 51 이나 top 131 이라 단추와 안 겹침, 나머지는 12-12 폰 6종에서). 알약(≈117 폭)은 360 폭에서 가운데 토스트와 8초간 겹칠 수 있다(층은 단추가 위).
- 실기기 대기: iOS 제스처 인정(pointerup/touchend)·무음 스위치·interrupted 복구. 문서 처리기는 `[data-sound-button]` 안의 이벤트를 건너뛴다.
- 공유 작업 트리 주의: 병렬 실행기와 index 를 같이 쓰니 `git commit --only -- <경로>` 를 쓸 것(5e810893 에 12-01 삭제가 섞인 전례).

## Self-Check: PASSED

- 파일 존재 확인: src/audio/unlock.ts · src/audio/useSound.ts · src/components/v2/SoundButton.tsx · test/client/soundButton.test.tsx · test/client/useSound.test.tsx.
- 커밋 4개(c4120dc0 · 5e810893 · a469577c · 0a0d187f)가 HEAD 의 조상임.

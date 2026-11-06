---
phase: 12-sound-polish
plan: "08"
subsystem: ui
tags: [web-audio, director, tdd, e2e, playwright]
requires:
  - phase: 12-sound-polish
    provides: "12-02 recipes·script(tickSchedule·pickTickSchedule), 12-05 엔진(setBed·play·runScript·cancelScript), 12-07 useSound·getEngine·훅"
provides:
  - "audioViewOf(RoomView 허용 필드만, 유일한 읽는 곳), 순수 direct(prev, cur, local), directSignal, 닫힌 신호 emitSignal/bindSignals"
  - "단계→침대 14개 표, 진입 소리, lobby.join, timer.tick(서버 시각 기준), 지목 pick.*·pin.*, 주요 버튼 ui.tap(밤 무음)"
  - "E2E sound-script(390x844) + soundSequenceChecks·SOUND_SCRIPT_STEPS"
affects: [12-09, 12-10, 12-11, 12-12]
actuals:
  tokens: 52000
  tasks: 3
  commits: 4
plan_head_before: 11a532c6
plan_head_after: 5dd9df6bfeda3aeb1a2e9efbc6670a75cb88802b
tech-stack:
  added: []
  patterns: ["감독은 순수(전역 시계·엔진 없음), useSound 가 ref 로 직전 상태를 쥐고 출력을 엔진에 적용", "시험 실패 모양: 구간별 훅 로그 + 기대 표(lib.mjs 순수 판정)"]
key-files:
  created:
    - src/audio/audioView.ts
    - src/audio/director.ts
    - src/audio/signals.ts
    - test/unit/soundDirector.test.ts
    - test/client/buttonSignal.test.tsx
  modified:
    - src/audio/useSound.ts
    - src/components/Button.tsx
    - src/screens/RoomScreen.tsx
    - scripts/e2e/sound.mjs
    - scripts/e2e/flows.mjs
    - scripts/e2e/lib.mjs
    - scripts/e2e/lib.test.mjs
    - test/unit/soundStaticGuard.test.ts
    - test/unit/e2eContract.test.ts
    - test/client/useSound.test.tsx
key-decisions:
  - "AudioView 필드 이름은 endsAt(phaseEndsAt 아님): 정적 가드가 audioView.ts 한 파일에만 RoomView·phaseEndsAt 를 허용하고 나머지 파일은 계속 금지"
  - "감독은 lobby.join 1초 제한을 local.lastJoinAt 입력으로 처리(순수 유지), 직전 시각은 useSound 가 ref 로 쥔다"
  - "취소 키는 prev 가 만들었을 키 중 cur 에 유효하지 않은 것(같은 키는 runScript 가 교체)"
  - "한 출력 안의 순서: 침대 요청 → 즉시 소리 → 대본 예약"
requirements-completed: [SOUND-01, SOUND-02]
status: complete
---

# Phase 12 Plan 08: 소리 감독 기본판 Summary

공개 view 의 차이(AudioView)와 닫힌 로컬 신호·로컬 시계만으로 소리를 정하는 순수 감독을 세우고, 로비~찬반의 침대·진입·지목·카운트다운 소리와 주요 버튼 ui.tap 을 RoomScreen 에서 엔진 요청까지 이었다. E2E sound-script 가 390x844 에서 18/18 통과한다.

## 한 일

- **Task 1(트레이서)**: `audioViewOf`(허용 필드 8개: phase·endsAt·dayN·turn·points·candidate·players[seat, alive]·mySeat), `direct`, `signals.ts`, `useSound({ view, epoch, offset, now })` 확장, RoomScreen 인자 연결. 첫 스냅샷·epoch 변경·같은 view 의 되풀이는 침대만(되풀이는 빈 출력).
- **Task 2**: lobby.join(사람 수가 늘 때, 1초 한 번) · timer.tick(토론·변론·찬반만, 공개 5초 규칙은 script.ts 의 tickSchedule, URGENT_MS 와 시험으로 대조) · 지목 pin.on·pick.turn(내 차례만)·pick.tick(마지막 3초, 서버 시각 기준)·pick.point+pin.move(확정, 같은 순간)·pick.skip · Button primary 클릭 `emitSignal({kind:"tap"})`, 밤에는 감독이 무음. pinOf 대조 시험이 대표 view 열에서 pin 전이와 같은 순간임을 고정.
- **Task 3**: `soundSequenceChecks`(구간별 로그 판정: 순서 부분 수열·notIds·counts·onlyPrefix)와 `SOUND_SCRIPT_STEPS`(SC1~SC10), `sound-script` 흐름(테스트 방 + 봇 3 + testSkip, 새로고침 구간 포함)을 만들고 flows.mjs 에 GAME_SIZE 로 등록.

## 검증

- 단위·클라이언트: soundDirector · soundStaticGuard · useSound · buttonSignal · roomScreen · pinPlan · countdown · e2eContract 8파일 340 통과, `test/client` 전체 73파일 2516 통과(Button 변경 영향 확인), `node --test scripts/e2e/lib.test.mjs` 279 통과, `npm run typecheck` 오류 없음.
- E2E: `vite dev --host 127.0.0.1 --port 5231 --strictPort` 에서 `npm run e2e -- --url http://127.0.0.1:5231 --only sound-script` 를 두 번 연속 돌려 **sound-script 390x844 통과(18/18)**. 서버는 껐다.
- `test/worker/leak.test.ts` 불변. 전체 회귀·nightload·웨이브 게이트는 요청대로 돌리지 않았다(12-12 몫).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] 정적 가드가 RoomView·phaseEndsAt 이름을 src/audio 전체에서 금지**
- **Found during:** Task 1 RED
- **Issue:** 12-02 가드의 "연결·스토어" 패턴에 RoomView·phaseEndsAt 가 있어 audioView.ts 가 걸린다.
- **Fix:** audioView.ts 한 파일에만 두 이름을 허용하고(`VIEW_READER`), 나머지 금지 이름은 그대로 둔다. AudioView 쪽 필드는 `endsAt`. 다른 파일이 RoomView 를 가져오면 실패하는 시험을 더했다.
- **Files modified:** test/unit/soundStaticGuard.test.ts
- **Commit:** 62f729b5, 68569375

**2. [Rule 3 - Blocking] startGame 의 onAssigning 이 배정 3초 창을 놓침 (E2E 첫 실행 SC3 실패)**
- **Fix:** 화면 대기 대신 훅 로그에 game.start 가 찍히는 순간을 병렬로 잡아 로그·bed 를 읽고 clear 한다.
- **Files modified:** scripts/e2e/sound.mjs
- **Commit:** 5dd9df6b

**3. [Plan 해석] RED/GREEN 을 태스크 1·2 합쳐 한 쌍으로 커밋**
- 감독 파일 하나가 두 태스크를 함께 채워 시험 파일도 같아서 `test(12-08)`(62f729b5) 한 번 + `feat(12-08)`(68569375) 한 번으로 묶었다. 태스크 3 은 따로(1176dfa7 · 5dd9df6b).

**4. [제한] assigning 침대 페이드아웃은 1.2초**
- 엔진 `setBed(null)` 에 페이드 길이 인자가 없어 계획의 2초 대신 엔진 기본 1.2초다. game.start 의 −10dB 덕킹은 레시피 `duck` 이 한다(`DirectOutput.duck` 은 null).

## Known Stubs

없음. (`DirectOutput.duck` 은 이 계획에서 쓰지 않는 확장 자리로 항상 null.)

## Threat Flags

없음. 새 네트워크·저장 표면 없음. T-12-27~30 은 audioViewOf 한 곳 + 경로 허용 목록·메타모픽 시험, 첫 스냅샷/epoch 무소리, 서버 시각 기준 예약 시험, 밤 무음 신호로 닫았다.

## 이월 메모

- audioView 에 12-09/10/11 이 더할 자리: `AudioView` 인터페이스·`AUDIO_VIEW_FIELDS`·`audioViewOf` 와 soundStaticGuard 의 `ALLOWED_VIEW_PATHS` 세 곳을 함께 고친다(경로는 `view.day?.…` 전체 경로로 써야 가드가 잡는다). 읽을 후보: day.morning·verdict·ballots·execution·runoff·showdown·result.
- director 출력: `{ cancel[], bed?(키 없음=변화 없음, null=페이드아웃), duck, scripts[{key,items,duck}], now[{id,gainDb?,cents?}] }`. 규칙은 `onPhaseChange`(전환)·`inPhase`(같은 단계)·`tickRun`에 더하고, `ENTER_SOUND`·`BED_OF` 표를 고친다. 대본 키는 `phase:{단계}:{일차}`·`pick:{일차}:{i}`, 취소 키 계산은 `scriptKeys`(새 대본은 여기에도 키를 더할 것).
- 신호 더하기(card·deny·vote·emote): `signals.ts` 의 `SIGNAL_KINDS`·`LocalSignal` 에 종류를 더하고 `directSignal` 에 분기 한 줄. 인자에 선택값·역할·좌석 금지. useSound 가 `bindSignals` 로 `last.current.av` 를 감독에 넘긴다.
- 핀 규칙은 `director.ts` 의 `pinOfAudio` 가 `src/world/pinPlan.ts` 의 `pinOf`(nomination 부분)를 복제한 것이다. 결선·마지막 3인·판결 핀(12-10)은 pinOf 의 해당 분기를 같은 방식으로 복제하고 soundDirector.test.ts 의 pinOf 대조 열을 늘린다.
- sound-script 에 단계 더하기: `lib.mjs` `SOUND_SCRIPT_STEPS` 에 행(SC11…)을 더하고 `sound.mjs` 의 `soundScriptFlow` 끝에 `clearLog → 조작 → judge(...)` 를 더한다(새로고침 SC10 은 마지막이라 그 앞에 끼울 것). 한 구간 순서는 침대 → 즉시 소리 → 대본. 개발 서버는 StrictMode 이중 효과라 방 화면을 막 연 구간은 같은 침대가 두 줄일 수 있어 횟수 대신 onlyPrefix 로 본다.
- 의도된 동작: 첫 스냅샷에서는 timer.tick 도 예약하지 않는다(새로고침 뒤 그 단계 카운트다운은 무음). 단계 안에서 마감이 바뀌면(토론 일찍 끝내기) 같은 키로 틱을 다시 예약한다. useSound 의 언마운트·이중 효과는 stopAll + `last=null` 로 첫 스냅샷처럼 다시 시작한다.
- E2E 실행: 포트를 직접 지정해 `vite dev --host 127.0.0.1 --port <빈 포트> --strictPort` 후 `--url` 로 돌린다(약 26초). 다음 계획의 병렬 실행기와 index 를 같이 쓰니 `git commit --only -- <경로>` 를 쓴다.

## Self-Check: PASSED

- 파일 존재: src/audio/{audioView,director,signals}.ts · test/unit/soundDirector.test.ts · test/client/buttonSignal.test.tsx · scripts/e2e/{sound,lib}.mjs 갱신.
- 커밋 4개(62f729b5 · 68569375 · 1176dfa7 · 5dd9df6b)가 HEAD 의 조상임.

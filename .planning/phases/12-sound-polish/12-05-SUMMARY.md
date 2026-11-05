---
phase: 12-sound-polish
plan: "05"
subsystem: audio
tags: [sound, web-audio, engine, tdd, fake-audio-context, test-hook]
requires: ["12-02"]
provides:
  - "src/audio/synth.ts: buildVoice·countNodes·noiseBufferFor (실시간·오프라인 공용 합성기)"
  - "src/audio/engine.ts: createEngine — 컨텍스트 수명·버스·보이스 풀·덕킹·침대 스케줄러·대본 예약·잠금/중단/숨김"
  - "src/audio/prefs.ts: minifia:sound { v:1, on } 읽기·쓰기"
  - "src/audio/testHook.ts: installSoundHook → window.__mfSound"
  - "test/helpers/fakeAudio.ts·soundRig.ts: 가짜 AudioContext·가짜 시계·엔진 도우미"
affects: [12-06, 12-07, 12-08, 12-10, 12-11]
tech-stack:
  added: []
  patterns: ["deps 주입 엔진(컨텍스트·시계·타이머·저장소·문서·내비게이터)", "가짜 시계가 컨텍스트 currentTime 과 타이머를 함께 굴림", "60ms 타이머 + 250ms lookahead 침대 스케줄러"]
key-files:
  created:
    - src/audio/synth.ts
    - src/audio/engine.ts
    - src/audio/prefs.ts
    - src/audio/testHook.ts
    - test/helpers/fakeAudio.ts
    - test/helpers/soundRig.ts
    - test/unit/soundEngine.test.ts
    - test/unit/soundHook.test.ts
    - test/unit/soundPrefs.test.ts
  modified: []
key-decisions:
  - "보이스 끊기: 같은 id 가 max 이면 같은 id 안에서 먼저, 후보가 없을 때만 전체 한도(8·노드 48)를 본다. 후보 = prio 숫자가 큰 것 → 오래된 것, prio 0 은 후보가 아니고 후보가 없으면 prio 0 새 요청만 일시 초과로 난다"
  - "필터 LFO 는 노드를 더 만들지 않고 반 주기마다 찍은 지수 램프 점(최대 24)으로 흉내 낸다 — recipeNodeCount 와 노드 수가 정확히 같다"
  - "같은 시각·길이·모양의 필터는 침대 패드 코드의 음들이 한 노드를 나눠 쓴다"
  - "침대의 예산 노드 수는 실제 생성 수가 아니라 bedNodeCount(BEDS[id]) 상수로 센다(침대 조각마다 짧게 사는 노드는 세지 않음)"
  - "엔진은 DOM 이벤트를 듣지 않는다. 가시성·제스처 연결은 12-07 이 하고 엔진은 hidden()/visible()/unlock() 메서드만 둔다"
duration: "약 40분"
completed: 2026-11-05
status: complete
actuals:
  tokens: 19700
  tasks: 3
  commits: 6
plan_head_before: 2de1537fef594ab45aadc920d183011789d1740b
plan_head_after: 42f5f13bbd43db46f80592fee1f3845d038f628c
---

# Phase 12 Plan 05: 소리 엔진과 합성기 Summary

가짜 AudioContext 로 끝까지 세운 소리 엔진: 동기 unlock, 버스·컴프레서 그래프, 보이스 풀과 노드 예산, 덕킹, 침대 스케줄러·크로스페이드, 숨김/중단 복구, 대본 예약, `window.__mfSound` 훅.

## 한 일

- **Task 1 (tracer)** `d1fefc92` RED → `2f35f8b5` GREEN: `unlock()` 이 호출 안에서 컨텍스트를 한 번 만들고(balanced, ambient 세션) resume 과 무음 한 프레임을 건다. 버스 셋→master→compressor→destination 그래프, `play` 는 요청을 항상 기록하고 running+켜짐일 때만 소리. 미지원·throw·null 은 조용히 played 거짓. `buildVoice` 는 모든 SFX 에서 노드 수가 `recipeNodeCount` 와 같다.
- **Task 2 (mix)** `68041347` RED → `b1ab150b` GREEN: 동시 8·같은 id max·노드 48·gapMs, 20ms 페이드 끊기, 침대 버스 덕킹(attack 30ms, 겹치면 깊은 쪽 승·복귀는 마지막 뒤, release 250ms), 끄기 120ms 페이드/켜기 ui.toggle, 저장값(깨진 값·예외 삼킴). 시드 5개 × 400 요청 최악 열로 상한 단언.
- **Task 3 (lifecycle)** `fa46636e` RED → `42f5f13b` GREEN: interrupted→locked, closed→none→재생성, hidden(master 120ms 뒤 suspend)/visible(resume 성공이면 현재 침대만), 침대 크로스페이드 1.2초, 침대 7종 10초 구동 중복·누락 0, 대본 key 별 예약·취소, subscribe/snapshot.

## 검증

- `npx vitest run test/unit/soundEngine.test.ts soundHook soundPrefs soundStaticGuard soundProvenance soundRecipes soundScript` — 7 파일 237 통과.
- `npx tsc -p tsconfig.app.json --noEmit` — 오류 없음.
- 지시에 따라 전체 회귀·웨이브 게이트는 돌리지 않았다.

## Deviations from Plan

**1. [Rule 3 - 범위] `rng` dep 생략** — 계획의 deps 목록에 있으나 엔진이 쓸 곳이 없다(잡음 버퍼는 시드 고정 mulberry32). 안 쓰는 인자를 두지 않았다.
**2. [Rule 2 - 공개 면 추가]** `runScript(key, items, duck?)`(DuckSpan 도 예약), `duckBed(db, holdMs, returnMs?)`, `resume()`, `voiceInfo()`·`activeNodes()`(시험·점검용 읽기 전용). 12-08 이 script.ts 의 `{items, duck}` 를 그대로 넘길 수 있게 했다.
**3. [Rule 3 - 검증 명령]** `npm run typecheck` 대신 `tsc -p tsconfig.app.json --noEmit` 만 돌렸다. 전체 명령은 `wrangler types`/토큰 생성이 공유 트리의 다른 파일을 건드릴 수 있어 피했다. 소리 파일은 app 설정에만 속한다.
**4. 기록 사항** `prefs.ts` 는 Task 2 RED 커밋 전에 작업 트리에 있어 soundPrefs 시험은 RED 가 아니라 처음부터 통과였다(엔진 쪽 믹스 시험은 정상적으로 RED). `commits: 6` 은 `(12-05)` 커밋 수로 센 값이다 — 같은 브랜치에 11페이즈 실행기의 커밋이 섞여 `rev-list` 수(9)는 맞지 않는다.

## Known Stubs

없음.

## Threat Flags

없음 — 엔진·prefs·훅에 fetch/WebSocket/XMLHttpRequest/sendBeacon·프로토콜 import 0(soundPrefs 정적 단언), 훅 로그 키는 id·at·gain·played 뿐(T-12-15~18 완화).

## 이월 메모

- 만들기: `createEngine(deps?)` — deps `{createContext(opts:{latencyHint:"balanced"}), now, setTimer, clearTimer, storage, doc:{visibilityState}, nav:{audioSession?}}` 전부 선택(기본은 브라우저 전역). 시험은 `test/helpers/soundRig.ts` 의 `makeRig()`(가짜 컨텍스트·시계·MemoryStorage).
- 제스처(click·touchend·pointerup·keydown) 핸들러 맨 앞에서 `engine.unlock()` 동기 호출; 제스처 밖 재시도는 `await engine.resume(): boolean`. 지원 여부 `supported()`, 상태 `state(): "none"|"locked"|"running"|"suspended"`.
- 소리: `play(id: SfxId, {variant?, cents?, gainDb?})` · `setBed(BedId|null)`(같은 침대면 무동작, 1.2초 크로스페이드, 로그에 침대 id) · `duckBed(db, holdMs, returnMs=250)` · `setOn(bool)`(저장 + 켜면 ui.toggle 한 번 + 침대 1.2초 페이드인).
- 대본: `runScript(key, items: ScriptItem[], duck?: DuckSpan|null)`(at ms 뒤 play, 같은 key 는 교체) · `cancelScript(key)` · `stopAll()`(대본·보이스·침대·덕킹 정리, 침대를 null 로). 시각은 감독이 단계 T0 에서 남은 ms 로 환산해 넘긴다.
- 화면: `hidden()`/`visible(): Promise<void>` 는 visibilitychange 에서 12-07 이 호출(엔진은 DOM 을 듣지 않음). `subscribe(cb)` → 해제 함수, `snapshot(): {state,on,bed,supported}`(변화 없으면 같은 객체; useSyncExternalStore 입력). 점검: `log()`·`clearLog()`·`voiceCount()`·`voiceInfo()`·`activeNodes()`·`currentBed()`·`isOn()`.
- 훅: `installSoundHook(engine, enabled: boolean, target = window)` → `window.__mfSound = {state("locked"|"running"|"suspended"|"off"), on, bed, voices, log(≤300 사본), clear()}`; `enabled` 판정(?e2e=1·개발 빌드)은 부르는 쪽(12-07).
- 합성기(12-06 오프라인 렌더): `buildVoice(ctx: BaseAudioContext, events, destination, startAt, {noise?})` → `{nodes, endAt, output, stop(atSec, fadeSec)}`; `countNodes(events)`·`noiseBufferFor(ctx)`. 이벤트 t 는 startAt 기준 ms(침대는 침대 시작 시각을 startAt 으로).
- 끊기 규칙 구현: `makeRoom` — 같은 id 가득이면 같은 id 의 prio>0 중 (prio 큰 → 오래된) 먼저, 없으면 전체 한도(8·노드 48, 침대 노드 포함) 초과 시 전체 prio>0 에서 같은 순서; 후보 없음 → prio 0 새 요청만 일시 초과. gapMs 는 마지막으로 난 같은 id 기준.
- 주의: 침대 레벨은 귀로 조정 안 됨(실기기 대기). iOS 무음 스위치·interrupted 복구는 실기기 확정 전(STACK MEDIUM). 정적 가드가 src/audio/** 전체를 훑으니 새 파일은 허용 import·금지 단어(chat·mafia·whisper·.note·.will 등)를 피한다.

## Self-Check: PASSED

- 파일 존재: src/audio/{synth,engine,prefs,testHook}.ts · test/helpers/{fakeAudio,soundRig}.ts · test/unit/{soundEngine,soundHook,soundPrefs}.test.ts.
- 커밋 6개(d1fefc92 · 2f35f8b5 · 68041347 · b1ab150b · fa46636e · 42f5f13b)가 HEAD 의 조상임.

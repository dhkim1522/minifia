---
phase: 12-sound-polish
plan: "02"
subsystem: audio
tags: [sound, web-audio-synthesis, pure-data, tdd, static-guard]
requires: []
provides:
  - "src/audio/recipes.ts: SoundId 56개 레시피 표·침대 표·renderPlan·bedPlan·화면 대응 표"
  - "src/audio/script.ts: 순수 대본(판결·밤·결과·시상·유언·카운트다운)"
  - "soundStaticGuard·soundProvenance: 소리 모듈 입력 경계(LS-6)와 외부 자산 0(D-20)"
affects: [12-05, 12-06, 12-08, 12-10, 12-11]
tech-stack:
  added: []
  patterns: ["순수 데이터 레시피 + 평면 PlanEvent", "격자 시각 + 박별 시드 난수로 접두 일관 구간 질의", "주석 제거 후 import·이름 정적 가드"]
key-files:
  created:
    - src/audio/recipes.ts
    - src/audio/script.ts
    - test/unit/soundRecipes.test.ts
    - test/unit/soundScript.test.ts
    - test/unit/soundStaticGuard.test.ts
    - test/unit/soundProvenance.test.ts
  modified: []
key-decisions:
  - "gainDb 한계 −24 때문에 표의 −26·−28·−30 행은 gainDb −24 로 막고 차이를 레이어 이득에 접었다(들리는 크기 같음)"
  - "침대 드론 D1(36.7Hz)은 FREQ_MIN 40 밖이라 D2(MIDI 38, 73.4Hz)로 한 옥타브 올렸다(bed.reveal·bed.night)"
  - "ui.toggle 켬/끔 변형만 VARIANTS 표에 따로 두고 RECIPES 모양은 모든 효과음이 같다(LS-5)"
duration: "약 25분"
completed: 2026-11-05
status: complete
actuals:
  tokens: 20500
  tasks: 3
  commits: 6
plan_head_before: 43a082d1b18362b2619e119cd64bdd9ca9c918f8
plan_head_after: 518f0ccc1e186c2672b16a56d1edb4987dfba9be
---

# Phase 12 Plan 02: 순수 소리 레시피와 대본 Summary

**56개 소리(침대 7 + 효과음 49)를 import 0개의 순수 레시피 표와 결정적 렌더 계획으로 세우고, 단계별 순수 대본과 소리 모듈 정적 가드·출처 시험을 TDD 로 고정했다.**

## 한 일

- Task 1 (tracer): ui.toggle · verdict.heart · bed.night 세 개로 레시피 → PlanEvent → planHash → 레벨 추정 전 층을 이었다. 이후 verify(시험 + typecheck)를 다시 돌려 통과를 확인하고 확장했다.
- Task 2: 효과음 49·침대 7 전수, 한계 시험(레이어 ≤ 4, 길이 ≤ 3000, 주파수 40~9000, LFO ≤ 8, gainDb −24..0, 레벨 ≤ −6 dBFS, 노드), 침대 접두 일관, 화면 대응 표(ambient 는 침대 7 + night.cue).
- Task 3: script.ts(verdictScript·nightCues·nightScript·resultScript·awardScript·willScript·tickSchedule·pickTickSchedule), soundStaticGuard(디렉터리 전체를 훑음), soundProvenance.

## 시험

- `npx vitest run test/unit/soundRecipes.test.ts test/unit/soundScript.test.ts test/unit/soundStaticGuard.test.ts test/unit/soundProvenance.test.ts`: 4파일 126 시험 통과.
- `npm run typecheck`: 오류 없음. 웨이브 게이트(build·전체 vitest·ui.safety-gate·schema-drift)는 지시에 따라 돌리지 않았다.
- 11페이즈 진행 중 변경(test/unit/audience·view, test/worker 등)과 겹치는 실패는 없었다(이 계획의 파일만 대상으로 돌림).

## Deviations from Plan

**1. [Rule 1 - 계획 내부 충돌] gainDb −24 한계 vs 표의 −26·−28·−30**
- 대상: lobby.join(−26), pin.move(−30), timer.tick(−28), execution.rise(−26), chalk.draw(−28), will.quill(−30), will.fold(−28), night.cue(−26), pick.skip(−26), emote.dance(−26)·cry(−26)·throat(−28)
- 조치: `recipe()` 가 gainDb 를 −24 로 막고 모자란 dB 를 레이어 이득에 곱한다(들리는 크기는 표와 같다). 시험은 gainDb 범위와 레이어 이득 ≤ 1 을 건다.

**2. [Rule 1 - 계획 내부 충돌] 드론 D1(36.7Hz)이 FREQ_MIN 40 밖**
- bed.reveal·bed.night 의 D1 을 D2(73.4Hz)로 올렸다. A1(55Hz)은 그대로. 폰 스피커는 40Hz 아래를 거의 못 낸다.

**3. 구조 보강(계획 문장의 해석)**
- 침대 소음 "1" 은 방 소리·바람이 같은 버퍼 소스에서 갈라지는 것으로 센다(bed.night). 노드 수는 소스 + 필터(+ LFO)로 센다.
- Filter 의 lfoHz 가 있으면 f 는 [하한, 상한] 범위를 LFO 가 오간다(패드 900±200 → [700,1100], 바람 400~800). 없으면 [시작, 끝] 램프.
- 드론·방 소리·바람은 4초 조각이 0.8초씩 겹쳐 이어지는 이벤트로 낸다(구간 질의가 접두 일관이기 위해).
- 커밋 수: 이 계획의 커밋은 6개다. `plan_head_before..HEAD` 범위는 같은 작업 트리에서 병행 중인 11페이즈 커밋 4개가 끼어 10으로 잰다.

## Known Stubs

없음. 레시피 값은 모두 "듣고 조정"하는 기본값이다(시험 페이지 12-06 에서 조정).

## Threat Flags

없음. 새 네트워크·인증·파일 경로 없음. T-12-04~07 은 정적 가드·출처 시험·전수 한계 시험·판결 앞머리 동일 시험으로 완화했다.

## 이월 메모

- 이름: `SOUND_IDS`(56) · `BED_IDS` · `SFX_IDS` · `RECIPES` · `VARIANTS`(ui.toggle on|off) · `BEDS` · `SCREEN_COUNTERPART` · `AMBIENT_IDS` · `BUS_GAIN`/`MASTER_GAIN`/`COMPRESSOR` · `NODE_BUDGET` 48 · `SFX_VOICE_MAX` 8 · `worstCaseNodes()` · `recipeNodeCount`/`bedNodeCount`.
- 엔진/시험 페이지용: `renderPlan(id, {variant?, cents?}): PlanEvent[]`(평면 `{kind,wave,t,dur,f0,f1,gain,env[a,d,s,r],filter?{type,f[2],q,lfoHz?},detune,lfoHz?,lfoCents?,seed?}`, gain 은 버스 이전) · `bedPlan(bedOrId, fromMs, toMs)`(구간 안에서 시작하는 이벤트, 드론류는 4초 조각 0.8초 겹침) · `recipeDurationMs` · `peakDbEstimate(SoundId)` · `planHash`. 잡음은 f0=f1=0 이고 `seed` 로 2초 버퍼 위치를 정한다. 덕킹은 `RECIPES[id].duck {db, holdMs}`.
- 대본(`script.ts`): `verdictScript({passed,last,hasBallots})` · `nightCues(rng, elapsedMs=0)` · `nightScript(rng, elapsedMs=0)` · `resultScript({n,win})` · `awardScript({k,total})` · `willScript({writeMs})` · `tickSchedule(remainingMs)` · `pickTickSchedule(remainingMs)` — 앞의 여섯은 `{items:{at,id,gainDb?,cents?}[], duck:{fromMs,toMs,db,returnMs}|null}`, 틱 둘은 "지금부터 ms" 목록. at 은 단계 T0 기준, 시계는 감독이 준다.
- 표와 달라진 값: gainDb −24 아래 행은 레이어 이득에 접음, 드론 D1→D2, 박수 소리 3개는 80ms 간격(결과·시상 둘 다). `RESULT_AT`(1200/400/4600/5600/2500/900)은 11페이즈 시간표 복사값이라 12-11 이 대조한다. emote 상한(초당 3·동시 4)·동작 소리 게이트는 12-10 이 script.ts 에 더한다.
- 12-05 엔진: 같은 id `max` 2 · `gapMs`(timer.tick 800, emote 250, vote.cast 120, ui.tap 80), prio 0(heart·gavel·slash·win·lose·final)은 끊지 않음. 침대 레벨(dB)은 `Bed.db` 부품별 기본값이라 귀로 조정한다. 정적 가드는 src/audio/** 전체를 훑으니 새 파일은 허용 import(./·react·protocol type·phases·dayView/verdictMoment/willLetter)만 쓴다.

## Self-Check: PASSED

- src/audio/recipes.ts · src/audio/script.ts · 시험 네 파일 존재, 커밋 6개(58246c66 · d34cdda2 · 9fa196a5 · 4f54afc4 · d546cfeb · 518f0ccc) HEAD 의 조상임.

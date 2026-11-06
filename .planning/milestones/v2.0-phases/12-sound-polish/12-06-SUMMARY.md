---
phase: 12-sound-polish
plan: "06"
subsystem: audio
tags: [sound, sound-lab, offline-audio, e2e, perf-tool, tdd]
requires: ["12-02", "12-05"]
provides:
  - "src/debug/soundLab.ts: 지연 로드 소리 시험 페이지(순수 DOM) — mount·renderOffline·analyzeSamples·declaredLengthMs·soundOk·worstSfx"
  - "src/debug/soundLabData.ts: soundLabEnabled(?sound-lab=1 + 개발 빌드/?e2e=1) — 진입 번들에 들어가는 유일한 몫"
  - "src/debug/soundLabTable.ts: SOUND_LIMITS·LAB_GROUPS·SOUND_NAMES (지연 청크 전용)"
  - "src/audio/synth.ts: buildMixGraph(ctx, trim) — 엔진과 오프라인 렌더 공용 믹스 그래프"
  - "src/audio/engine.ts: setMasterTrim(linear 0..1) — 시험 페이지 전용"
  - "src/audio/script.ts: morningScript({outcome, mine}) → {items, duck, bed}"
  - "scripts/e2e/sound.mjs: makeSoundFlows → sound-render 흐름(flows.mjs 등록, 390x844)"
  - "scripts/e2e/lib.mjs: SOUND_RENDER_LIMITS·SOUND_MARKERS·soundRenderChecks"
  - "scripts/perf-run.mjs: --sound on|off, soundInitScript·wakeAudio·readSoundState, 결과 JSON sound 칸"
affects: [12-07, 12-09, 12-12]
tech-stack:
  added: []
  patterns: ["진입 번들 몫은 게이트 한 파일뿐(표는 지연 청크 전용 파일로 분리)", "가짜 OfflineAudioContext 주입(OfflineFactory)으로 렌더·판정 단위 시험", "문턱 한 곳(lib.mjs) + 앱 쪽 사본을 e2eContract 가 대조"]
key-files:
  created:
    - src/debug/soundLab.ts
    - src/debug/soundLabData.ts
    - src/debug/soundLabTable.ts
    - scripts/e2e/sound.mjs
    - scripts/perf-run.test.mjs
    - test/unit/soundLab.test.ts
  modified:
    - src/debug/perfProbe.ts
    - src/audio/synth.ts
    - src/audio/engine.ts
    - src/audio/script.ts
    - src/audio/recipes.ts
    - scripts/e2e/flows.mjs
    - scripts/e2e/lib.mjs
    - scripts/e2e/lib.test.mjs
    - scripts/perf-run.mjs
    - test/unit/soundScript.test.ts
    - test/unit/soundEngine.test.ts
    - test/unit/e2eContract.test.ts
key-decisions:
  - "마스터 슬라이더는 master 이득에 곱하는 trim(기본 1)이다: master = MASTER_GAIN × trim, 숨김 복귀도 같은 값으로 돌아온다"
  - "오프라인 렌더는 모노·44.1kHz·한 번에 하나(순차). 효과음은 선언 길이 + 500ms, 침대는 앞 8초. RMS 는 소리가 있는 구간(처음~마지막 −60dBFS 초과 표본)에서 잰다"
  - "선언 길이는 엔벨로프(어택·디케이·서스테인·릴리스)를 같은 구간으로 풀어 −60 dBFS 아래로 내려가는 지점의 최댓값 — 디케이로 끝나는 레시피(award.final)를 정확히 본다"
  - "시험 페이지 표(묶음·이름·문턱)는 soundLabTable.ts 로 분리: soundLabData.ts 를 진입과 지연 청크가 함께 가져오면 Rollup 이 표를 진입 청크로 올린다"
  - "대본 재생·최악 합의 첫 소리는 unlock 뒤 resume 이 끝나고 낸다(press): 실기기에서 첫 탭의 소리가 running 전에 버려지지 않게"
duration: "약 30분"
completed: 2026-11-05
status: complete
actuals:
  tokens: 20600
  tasks: 3
  commits: 8
plan_head_before: 950ad95c967cb22f4e25a18fc0e00d0cd60b6692
plan_head_after: cc9f47346d7d226e3ebcb69d4f549183d1fe8b41
---

# Phase 12 Plan 06: 소리 시험 페이지·오프라인 렌더 56개·perf-run --sound Summary

**`/?sound-lab=1` 지연 로드 시험 페이지(침대 7·효과음 49·대본·최악 합)와 같은 믹스 그래프의 OfflineAudioContext [전부 계산]이 56개를 합격시키고, E2E `sound-render` 8/8 통과, 진입 번들에는 게이트만 남았다.**

## 수행한 것

- **Task 1 (트레이서)**: `soundLabEnabled` 게이트 → `perfProbe` 동적 import 한 줄 → ▶ 하나(엔진 ui.toggle)와 [계산] 하나(오프라인 렌더). `buildMixGraph` 를 synth.ts 에 두고 엔진이 그것을 쓰게 했다(동작 불변, 12-05 시험 그대로 통과). 엔진에 `setMasterTrim` 추가(제품 화면 호출 0 — 소스 검사 시험).
- **Task 2**: 시험 페이지 전체 — 상단 고정 줄(마스터·모두 멈춤·전부 계산·최악 합·상태·보이스 수), 침대 7(같은 침대 다시 누르면 정지, 다른 침대는 크로스페이드), 효과음 49(여섯 묶음, 행마다 피크·길이·[계산]), 대본 재생(판결 통과/부결/마지막 3인, 밤 시드, 아침 희생자/평화/구출 + 내가 피해자 체크, 유언, 결과·시상 4·8명 × 승·패), 최악 합(밤 침대 + 노드 많은 효과음 6개). `morningScript` 를 script.ts 에 더했다. `sound-render` 흐름과 `soundRenderChecks`(SR1~SR6).
- **Task 3**: `perf-run --sound on|off`(기본 on, 다른 모드에서는 파싱만) + 도우미 셋을 가짜 page 로 고정. 빌드 뒤 진입 청크 비노출 확인.

## 검증 결과

- **sound-render 통과 8/8**(개발 서버, 390×844, 헤드리스 Chrome): SL1 단추 56개, SL2 60초 안에 끝남, SR1 56개 · SR2 중복 없음 · SR3 피크 ≤ −3 · SR4 NaN 0 · SR5 RMS ≥ −60 · SR6 길이 ±50ms 모두 통과. 56개 중 56개 합격. 피크는 최대 −14.8 dBFS(kill.slash)·최저 −44.1(ui.card), 침대는 −24.2~−39.7. 길이 오차는 최대 12ms(award.final), 대부분 ±10ms 이내.
- **진입 청크 비노출 확인**: `dist/client/index.html` 이 부르는 진입 청크 `assets/index-Cw6zM1Zb.js` 에 `data-sound-lab`·`data-sound-id`·`__mfSoundLab`·`OfflineAudioContext`·표 문자열(대기실 배경음·peakMaxDb 등) 0건. 이 문자열이 든 파일은 지연 청크 `assets/soundLab-DJtGLXL-.js`(35.8 kB, gzip 13.9 kB) 하나. 진입 청크에는 게이트 `sound-lab` 문자열과 `import(./soundLab-….js)` 한 줄뿐.
- perf-run 소리 도우미 셋(`soundInitScript`·`wakeAudio`·`readSoundState`)은 가짜 page 시험(perf-run.test.mjs)으로 고정했고 저장값 형식은 e2eContract 가 앱의 `SOUND_PREF_KEY`·`loadSoundPref` 와 대조한다. **nightload 는 돌리지 않았다**(12-12).
- 시험: vitest 소리·계약 10개 파일 351 통과, `node --test scripts/*.test.mjs scripts/e2e/lib.test.mjs` 326 통과, `tsc -p tsconfig.app.json --noEmit` 에서 이 계획이 만진 파일의 오류 0건.

## 계획과 달랐던 점

**1. [Rule 1 - Bug] will.quill 레벨** — 첫 렌더에서 RMS −63.8 dB(문턱 −60 미달). 문턱은 두고 레시피 gainDb −30 → −22 한 줄을 올렸다(RMS −56.1, 피크 −43.9). 파일은 plan 의 files_modified 밖(`src/audio/recipes.ts`)이지만 Task 3 action 이 "레시피 값을 고쳐 SUMMARY 에 id 별로 적는다"로 허용한 수정이다. 커밋 7073db49.
**2. [Rule 1 - Bug] 선언 길이 계산** — 처음의 선언 계산이 서스테인 0 으로 끝나는 레시피(award.final: 디케이로 소리가 끝남)를 못 읽어 1026ms 대 선언 1200ms(−174ms)로 어긋났다. 문턱을 건드리지 않고 `declaredLengthMs` 를 엔벨로프 구간 전체로 풀도록 고쳤다(레시피·synth 는 그대로).
**3. [Rule 3 - 구조] soundLabTable.ts 추가** — plan 은 묶음·이름을 soundLabData.ts 에 두라 했지만, 진입(perfProbe)과 지연 청크가 같은 모듈을 가져오면 표가 진입 청크로 올라갔다(빌드로 확인). 게이트만 soundLabData.ts 에 남기고 표는 새 파일 `src/debug/soundLabTable.ts` 로 옮겼다. 정적 시험이 둘의 경계를 고정한다.
**4.** `wakeAudio(page, size, mode = "on")` — plan 의 `(page, size)` 에 모드 인자를 더했다(off 일 때 탭하지 않기 위해).
**5.** 커밋 수 `8` 은 `--grep="(12-06)"` 으로 센 값이다. 같은 브랜치에 11페이즈 실행기 두 개가 동시에 커밋해 `plan_head_before..HEAD` 범위 수는 이 계획의 것이 아니다.
**6.** `npm run typecheck`(wrangler types 포함)는 돌리지 않고 `tsc -p tsconfig.app.json --noEmit` 만 돌렸다. 앱 프로젝트 전체에는 11페이즈 진행 중인 파일(resultScreen·worldStage·continuity·resultDirector·verdict 시험 등)의 오류가 있고 이 계획과 무관해 건드리지 않았다.

## 알려진 한계

- 마스터 슬라이더·침대 ▶ 의 실제 소리, 폰 볼륨·iOS 무음 스위치는 귀로 확인하지 못했다(헤드리스 오프라인 수치만). 레벨 판단은 사용자가 아침에 폰으로 듣는다.
- 오프라인 피크는 컴프레서를 거친 값이라 `peakDbEstimate`(컴프레서 전)보다 낮다. 합격은 −3 dBFS 이하만 본다(소리가 너무 작은지는 RMS −60 하한과 귀로).
- 시상 시험의 칭호 수는 3(`AWARD_TOTAL`)으로 가정했다(실제 칭호 수는 11페이즈 데이터가 정하고 12-11 이 대조).

## Known Stubs

없음.

## Threat Flags

없음. (T-12-19 게이트·동적 import·진입 번들 비노출·정적 import 금지 시험, T-12-20 순차 렌더, T-12-22 문턱 한 곳 + 경계 시험으로 계획대로 닫음.)

## 이월 메모

- 사용자가 아침에 할 일: `npm run dev` (이미 `--host`) 후 폰으로 `http://<Mac IP>:5173/?sound-lab=1` 을 열고 ▶ 로 듣는다. [전부 계산]은 헤드리스에서도 56개를 낸다. 마음에 들지 않는 id 는 알려 주면 레시피 한 줄만 고친다(`src/audio/recipes.ts`).
- 이름: `soundLabEnabled(search, storage, dev)`·`SOUND_LAB_PARAM`(soundLabData) · `SOUND_LIMITS`·`LAB_GROUPS`·`SOUND_NAMES`(soundLabTable) · `mount(root, params, {engine?, createOffline?})`→`{dispose, idle}`·`renderOffline(id, factory?)`·`analyzeSamples`·`declaredLengthMs`·`soundOk`·`worstSfx`(soundLab) · `buildMixGraph(ctx, trim=1)`→`{master, compressor, buses}`(synth) · 엔진 `setMasterTrim(linear)` · `morningScript({outcome:"calm"|"saved"|"victim", mine})`→`{items, duck:null, bed:"bed.dawn"}`(script, 12-09 감독이 같은 표를 쓴다) · lib.mjs `SOUND_RENDER_LIMITS`·`SOUND_MARKERS`·`soundRenderChecks(results, limits?)`.
- 훅: 시험 페이지는 `window.__mfSoundLab = {done, results[{id, peakDb, rmsDb, nan, lengthMs, declaredMs|null, ok}]}` 과 `window.__mfSound` 둘을 만든다. 표식 이름은 `SOUND_MARKERS` 4개로 고정(이후 계획 sound-unlock·sound-script·sound-night-parity·sound-result 는 `scripts/e2e/sound.mjs` 의 `makeSoundFlows` 에 흐름을 더하고 `SOUND_MARKERS` 에 표식을 더한다).
- 레시피를 고친 id: `will.quill` 의 gainDb −30 → −22 (RMS −63.8 → −56.1) 하나뿐. 나머지 55개는 값 변경 없이 합격(피크 최대 −14.8 dBFS kill.slash, 길이 오차 최대 12ms).
- 진입 번들 규칙: `src/debug` 에서 perfProbe 가 가져오는 파일은 `soundLabData.ts`(게이트)뿐이다. 새 표·상수를 시험 페이지에 더하면 `soundLabTable.ts` 나 `soundLab.ts` 에 둔다(두 쪽이 함께 가져오는 모듈은 진입 청크로 올라간다). 빌드 후 `grep -c data-sound-lab dist/client/assets/index-*.js` 가 0 이어야 한다.
- 12-12(nightload): `node scripts/perf-run.mjs --mode nightload --sound on|off` 결과 JSON 의 `sound` 칸 `{mode, state, on, requests, note}`. 12-07 이 `installSoundHook` 을 앱 엔진에 연결해야 `state`·`requests` 가 채워진다(없으면 null).
- 개발 서버 포트를 직접 지정해 돌렸다(`vite dev --host 127.0.0.1 --port <빈 포트> --strictPort` 후 `npm run e2e -- --url http://127.0.0.1:<포트> --only sound-render`); 서버는 껐다.

## Self-Check: PASSED

- 파일 존재: src/debug/{soundLab,soundLabData,soundLabTable}.ts · scripts/e2e/sound.mjs · scripts/perf-run.test.mjs · test/unit/soundLab.test.ts.
- 커밋 8개(9a6f0204 · 87979d5a · 3a551feb · 7073db49 · 942d0c68 · 77521973 · 236b839c · cc9f4734)가 HEAD 의 조상임.

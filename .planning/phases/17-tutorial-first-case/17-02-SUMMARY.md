---
phase: 17-tutorial-first-case
plan: "02"
subsystem: audio
tags: [web-audio, synthesis, voice, tdd, tracer, sound-lab]
status: complete

requires:
  - phase: 12-sound
    provides: RECIPES 한 표·SCREEN_COUNTERPART·엔진 runScript(같은 key 취소)·시험 페이지와 sound-render E2E
provides:
  - "src/audio/voice.ts: VOICE_KEY(voice.host)·sayItems·say·hush — 글자마다 voice.syl 음절 85ms(띄어쓰기 +50ms, 시작 50ms), totalMs = 루프 끝 at + 80"
  - "효과음 레시피 13개: tut.lampOff·scream·whoosh·sting·step·eye·link·buzz·stamp·fanfare·flip·warm(sfx 버스) + voice.syl(ui 버스)"
  - "소리 수 고정값 70(침대 7 + 효과음 63): SOUND_IDS·SCREEN_COUNTERPART·SOUND_LIMITS·LAB_GROUPS 일곱 묶음·SOUND_NAMES·SOUND_RENDER_LIMITS·docs/audio.md"
affects: [17-04]

actuals:
  tokens: 11000
  tasks: 2
  commits: 4
plan_head_before: 5bee1a9a248d8ee572bddbca3d6db29b56a5e184
plan_head_after: e8ee10c72abc04675701c968ff2b98a934bcc4b4

tech-stack:
  added: []
  patterns:
    - "문구는 인자로만 받는 목소리 모듈: 대본·view 를 가져오지 않아 정적 가드를 그대로 통과한다"
    - "같은 소리를 여러 번 내는 연출(램프·걸음·뒤집기·링크)은 레시피 하나 + 대본 여러 번 호출"

key-files:
  created:
    - src/audio/voice.ts
    - test/unit/voice.test.ts
  modified:
    - src/audio/recipes.ts
    - src/debug/soundLabTable.ts
    - docs/audio.md
    - test/unit/soundRecipes.test.ts
    - test/unit/soundLab.test.ts
    - test/unit/soundProtocol.test.ts
    - scripts/e2e/lib.mjs
    - scripts/e2e/lib.test.mjs
    - scripts/e2e/flows.mjs

key-decisions:
  - "tut.fanfare 는 D·F·A·E 네 음 삼각파 0.5초(0.11초 간격) 한 레시피 4층: 시안의 다섯 번째 음(C)과 옥타브 겹침 사인은 층 한계(4) 때문에 뺐다 (UI-SPEC ①안)"
  - "voice.syl 은 레시피 하나(205Hz 기준)이고 음높이는 대본 항목의 cents 로만 옮긴다. 층 이득비 1 : 0.035/0.15, 표 레벨 −16 dB, ui 버스"
  - "tut.* 시작 레벨은 −16~−24 dB. 짧은 잡음 tut.step 만 RMS 문턱(−60)을 넘기려 −16 으로 올렸다(문턱은 낮추지 않음)"

patterns-established:
  - "소리 하나를 더하는 길 한 번에: SFX_IDS → RECIPES → SCREEN_COUNTERPART → soundLabTable(묶음·이름·개수) → E2E 사본 → docs/audio.md → 시험 고정값"

requirements-completed: [TUT-04]

duration: 25 min
completed: 2026-11-09
---

# Phase 17 Plan 02: 튜토리얼 소리(웅얼 목소리·장면 효과음) Summary

사회자 한 문장을 글자마다 voice.syl 음절로 예약하는 `say()`/`hush()` 와 장면 효과음 tut.* 12개를 기존 Web Audio 합성 레시피 표에 넣고, 소리 수가 박힌 시험·시험 페이지·E2E 사본·문서를 70개로 맞췄다(외부 소리 파일 0).

## Accomplishments

- **목소리 모듈** `src/audio/voice.ts`: `sayItems(text)` 는 띄어쓰기는 항목 없이 시간만 더하고 그 밖 글자마다 `{ at, id: "voice.syl", cents }` 를 만든다. 음높이는 6단계 순환(×1·1.12·1.26·1.06·1.19·0.94) + 7번째 글자마다 ×0.88. `say()` 는 `engine.runScript("voice.host", items)` 한 번에 totalMs 를 돌려주고(소리가 꺼져도 같은 값), `hush()` 는 빈 대본으로 남은 음절을 끊는다. import 는 `./engine`·`./script` 타입뿐.
- **레시피 13개**: voice.syl(삼각 75ms + 사인 50ms, ui 버스), tut.* 12개(층 수는 소리 계약 표와 같다: scream·sting·warm·fanfare 4층, whoosh·step·link·buzz 1층, lampOff·eye·stamp·flip 2층). 모두 prio 2·max 2·gapMs 0, 길이 ≤ 1900ms, 주파수 40~9000, 추정 정점 −6 dBFS 이하. 화면 대응 줄 13개는 모두 ambient 로 시작하지 않는다.
- **70개 고정값**: SOUND_IDS 70, SOUND_LIMITS.count 70(주석 "침대 7 + 효과음 63"), LAB_GROUPS 일곱 번째 묶음 `tutorial`(13개), SOUND_NAMES 70, lib.mjs SOUND_RENDER_LIMITS.count 70, flows.mjs 주석, docs/audio.md 레시피 지도 머리와 13행(tut.* 12행은 `recipes.ts → src/game/tutorialScript.ts 의 장면 표`, voice.syl 은 `recipes.ts → voice.ts`).

## Task Commits

1. **Task 1 RED:** `99d6398b` — `test(17-02): 웅얼 목소리 실패 시험`
2. **Task 1 GREEN (tracer):** `92d3ebd1` — `feat(17-02): 사회자 웅얼 목소리 voice.syl·voice.ts`
3. **Task 2 RED:** `359ee611` — `test(17-02): 튜토리얼 효과음 12개 실패 시험`
4. **Task 2 GREEN:** `e8ee10c7` — `feat(17-02): 튜토리얼 효과음 12개 레시피`

## TDD Gate Compliance

- **Task 1 RED** (`99d6398b`): voice.test.ts 7개 전부 실패("src/audio/voice.ts 모듈이 있어야 한다" — 동적 import 로 import 오류 대신 단언 실패), soundRecipes 의 "SOUND_IDS 는 58개…"·"효과음 51개는 서로 다른 해시"·voice.syl 형태 시험 실패(SOUND_IDS 57), soundLab 4건·soundProtocol 1건 실패. 계획한 이유 그대로(voice.ts·voice.syl 없음).
- **Task 1 GREEN:** vitest 7파일 261개 통과, `node --test scripts/e2e/lib.test.mjs` 386 통과 0 실패, typecheck 초록.
- **Task 2 RED** (`359ee611`): 3개 파일 22개 실패(SFX_IDS 51 ≠ 63, tut.* 층 수·버스·한계·tut.fanfare 네 음), lib.test.mjs 8개 실패(count 57/58 ≠ 70).
- **Task 2 GREEN:** vitest 8파일 369개 통과, node --test 386 통과 0 실패, typecheck 오류 0.
- REFACTOR: 없음.
- 트레이서 게이트: Task 1 의 `<verify>` 는 자동 항목뿐이라 재실행해 통과를 확인하고 확장(Task 2)으로 이어 갔다.

## 로컬 sound-render 결과 (E2E, 오프라인 렌더)

`npm run dev` 후 `npm run e2e -- --url http://localhost:5173 --only sound-render` (390x844):

- 첫 실행: 7/8 — SR5(RMS −60 dB 이상) 실패, `tut.step -62.4`. 50ms 짧은 잡음이라 평균 에너지가 낮음.
- `tut.step` 표 레벨을 −22 → −16 dB 로 올려 재실행: **8/8 통과** — SL1 소리 단추 70개, SL2 60초 안, SR1 렌더 결과 70개, SR2 중복 없음, SR3 피크 ≤ −3 dBFS, SR4 NaN 0, SR5 RMS ≥ −60, SR6 길이 ±50ms. 개발 서버는 껐다. (E2E 출력은 소리별 정점 값을 따로 출력하지 않아 "가장 높은 정점" 수치는 기록하지 않는다 — 문턱 SR3 통과로 갈음.)

## Acceptance Criteria

| 기준 | 결과 |
|------|------|
| `grep -c "export function" src/audio/voice.ts` ≥ 3 | PASS (3) |
| `grep -c '"voice.syl"' src/audio/recipes.ts` ≥ 2 | PASS (3) |
| `grep -c tutorial src/debug/soundLabTable.ts` ≥ 1 | PASS (1) |
| `grep -c voice.syl docs/audio.md` ≥ 1 | PASS (1) |
| `grep -c '"tut\.' src/audio/recipes.ts` ≥ 24 | PASS (26) |
| `count: 70` — soundLabTable.ts·lib.mjs 각각 ≥ 1 | PASS (1, 1) |
| `grep -c "tut\." docs/audio.md` ≥ 12 | PASS (12) |
| SUMMARY 에 sound-render 결과 줄(70개, 통과) | PASS (위) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] scripts/e2e/lib.test.mjs 의 EXPECTED_SCENE 키 목록에 tutorial 추가**
- **Found during:** Task 1 GREEN, `node --test scripts/e2e/lib.test.mjs` 검증
- **Issue:** 17-01 이 `EXPECTED_SCENE` 에 `tutorial` 행을 더했지만 같은 파일의 키 목록 시험(열다섯 개)이 갱신되지 않아 이 계획의 verify 명령이 실패했다(17-01 은 vitest 만 돌려 못 잡음).
- **Fix:** 시험 이름을 "열여섯 개(15-01 errand, 17-01 tutorial)"로 고치고 키 목록에 `"tutorial"` 한 줄. 판정을 넓히지 않았다.
- **Files modified:** scripts/e2e/lib.test.mjs
- **Commit:** 92d3ebd1

**2. [Rule 1 - Bug] tut.step 이 RMS 문턱(SR5) 아래**
- **Found during:** Task 2, 로컬 sound-render E2E
- **Issue:** 표 레벨 −22 dB 의 50ms 잡음이 −62.4 dB RMS 로 문턱 −60 을 못 넘음.
- **Fix:** 계획의 시작 레벨 범위(−16~−24) 안에서 −16 dB 로 올림. 문턱은 그대로. 추정 정점 시험은 여전히 통과.
- **Files modified:** src/audio/recipes.ts
- **Commit:** e8ee10c7

**3. [Rule 3 - Blocking] soundProtocol.test.ts 의 소리 수·이름 고정값 갱신**
- **Found during:** Task 1 RED/GREEN
- **Issue:** 계획 files 목록에는 없지만 같은 소리 고정값(`SOUND_IDS` 길이, `SFX_IDS` 길이)을 박은 시험이라 58→70 으로 같이 맞춰야 했다.
- **Files modified:** test/unit/soundProtocol.test.ts
- **Commits:** 99d6398b, 359ee611

**Total deviations:** 3 auto-fixed (Rule 3 둘, Rule 1 하나). **Impact:** 범위 확장 없음.

## Issues Encountered

- 없음. 새 레시피 12개는 추정 정점·층·길이·해시·노드 예산 시험을 처음 시도에 모두 통과했다(레벨은 시안 시트의 상대 이득을 −16~−24 dB 시작값에 맞춰 옮김). 듣고 조정은 v3.0 끝 실테스트.
- `git grep` 위생 검사에서 `test/unit/gameRoom.test.ts` 의 `seatOrdered`(대소문자 무시 매치)가 잡히지만 이 계획과 무관한 기존 낱말이다. 이 계획 변경분에서는 새 히트가 없다.

## Known Stubs

없음. `docs/audio.md` 의 tut.* 행이 가리키는 `src/game/tutorialScript.ts` 는 17-04 이후 계획이 만드는 장면 표다(계획이 명시한 의도된 연결).

## Threat Flags

없음. 새 표면은 소리 id·문구 길이뿐이고 계획의 위협 모델(T-17-06 같은 key 취소·max 2·NODE_BUDGET, T-17-07 정적 가드, T-17-SC 패키지 설치 없음)에 있다. soundStaticGuard·soundProvenance 초록으로 확인.

## Next Phase Readiness

17-04 이후 화면 계획이 `say(engine, text)` → totalMs(파형·글 드러남 시간), `hush(engine)`, `engine.play("tut.*")` 또는 대본 `ScriptItem` 으로 그대로 부를 수 있다. 소리 설정·소리 단추는 기존 엔진 규칙을 따른다.

## Self-Check: PASSED

- 파일 존재: src/audio/voice.ts, test/unit/voice.test.ts — FOUND
- 커밋: 99d6398b, 92d3ebd1, 359ee611, e8ee10c7 — 현재 브랜치(v3) 조상으로 확인

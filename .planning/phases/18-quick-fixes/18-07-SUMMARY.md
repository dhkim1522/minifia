---
phase: 18-quick-fixes
plan: "07"
subsystem: perf-measure-lighting
tags: [lighting, perf-run, luminance, plaza, bar, morning, tdd, sc-2]
status: complete

requires:
  - phase: 18-quick-fixes
    provides: 18-02 의 광장·재즈 바 talk·morning·vote 조명 값(허용 범위 1~3)
provides:
  - "node scripts/perf-run.mjs --mode light — 광장·재즈 바 × talk·morning·vote·night 같은 카메라 정지 화면 평균 상대 휘도와 순서·배율 판정"
  - "lightRankVerdict·LIGHT_TALK_RATIO·LIGHT_MORNING_RATIO·readCanvasLuminance(scripts/perf-run.mjs)"
  - "?perf=1 scene 이 talk·morning·vote·night 를 받는다 / runtime deps.lighting 은 LightingPhase"
  - "측정 JSON·PNG: .planning/phases/18-quick-fixes/perf/"
  - "광장·재즈 바 morning 행 hemi·moon 을 렌더 측정으로 올림"
affects: [18-10, 18-08]

actuals:
  tokens: 40000
  tasks: 2
  commits: 4

plan_head_before: 8b93b8e20fb02e21076828d3e2d26914aca96c09
plan_head_after: 0bbe32bf4aaa402a7d2112cc67932b8cead6f956
commits: 4

tech-stack:
  added: []
  patterns:
    - "캔버스만 screenshot(style 로 이름표·HUD 숨김) → 페이지 안에서 sRGB→선형 평균 휘도 (readPaintStats 와 같은 방법, 새 패키지 없음)"
    - "판정은 순수 함수(lightRankVerdict)로 떼어 node --test 로 고정하고, 측정 실행은 얇은 runLight 가 맡는다"

key-files:
  created:
    - .planning/phases/18-quick-fixes/perf/light-390x844.json
    - .planning/phases/18-quick-fixes/perf/light-390x844-before.json
    - .planning/phases/18-quick-fixes/perf/light-plaza-{talk,morning,vote,night}.png
    - .planning/phases/18-quick-fixes/perf/light-bar-{talk,morning,vote,night}.png
  modified:
    - scripts/perf-run.mjs
    - scripts/perf-run.test.mjs
    - src/debug/perf/scenario.ts
    - src/world/runtime.ts
    - test/unit/perfScenario.test.ts
    - src/world/maps/plaza.ts
    - src/world/maps/bar.ts

key-decisions:
  - "측정은 ?perf=1&shot=1(시드 1, 사람 6, 코트, 10초 정지)로 한다 — 단계마다 카메라가 다른 실제 판·튜토리얼 대신 같은 카메라·같은 배치가 보장되는 성능 스파이크 장면(RESEARCH Open Question 5)"
  - "morning 행만 0.05π 씩 올렸다 — vote 는 한 번 올려 보니 효과가 미미해(+0.0003~0.0005) 18-02 값으로 되돌렸다"
  - "문턱은 낮추지 않았다 — 남은 실패는 SUMMARY·18-10 HANDOFF 로 넘긴다"

requirements-completed: [SC-2]

coverage:
  - id: D1
    description: "?perf=1 scene 이 네 단계를 받고 perf-run --mode light 가 순서·배율을 판정한다"
    requirement: "SC-2"
    verification:
      - kind: unit
        ref: "scripts/perf-run.test.mjs#lightRankVerdict"
        status: pass
      - kind: unit
        ref: "test/unit/perfScenario.test.ts#scene 은 talk·morning·vote·night 네 값만 받고 나머지는 talk 다(18-07)"
        status: pass
    human_judgment: false
  - id: D2
    description: "같은 카메라 렌더에서 talk ≥ 2.0×night 는 두 맵 통과, morning ≥ 1.6×night 는 광장 통과·재즈 바 1.53배(미달), vote > night 는 두 맵 미달"
    requirement: "SC-2"
    verification:
      - kind: command
        ref: "node scripts/perf-run.mjs --mode light --url http://localhost:5173 --size 390x844 --out .planning/phases/18-quick-fixes/perf/"
        status: fail
    human_judgment: true
    rationale: "L4a(vote > night)·바 L4c 가 남았다. 값을 더 올리면 낮 분위기 방향이 바뀌므로 사람이 HANDOFF 에서 방향을 정한다(18-10)"
  - id: D3
    description: "낮 조명에서 머리 제목·타이머 글자가 읽힌다(E2E day H1 4.5:1)"
    requirement: "SC-2"
    verification:
      - kind: e2e
        ref: "npm run e2e -- --url http://localhost:5173 --only day (여섯 크기 111/111)"
        status: pass
    human_judgment: false
---

# Phase 18 Plan 07: 낮·밤 조명 렌더 휘도 측정 Summary

**성능 스파이크 장면(?perf=1&shot=1)을 네 단계로 확장하고 `perf-run --mode light` 로 광장·재즈 바의 같은 카메라 정지 화면 평균 휘도를 쟀다. morning 값을 올려 광장은 talk/morning 배율 문턱을 통과했지만, 두 맵의 vote 가 night 보다 어둡고 재즈 바 morning 은 1.53배로 문턱(1.6)에 못 미쳐 남은 문제로 기록했다.**

## 수행한 일

- **Task 1 (트레이서)**: `scene` 이 `talk | morning | vote | night` 를 받고(그 밖은 talk), runtime `deps.lighting` 을 `LightingPhase` 로 넓혔다. `perf-run.mjs` 에 `--mode light`(`runLight`), 순수 판정 `lightRankVerdict`(L4a 순서, L4b talk ≥ 2.0×night, L4c morning ≥ 1.6×night), 평균 휘도 `readCanvasLuminance` 를 넣었다. `--scene` 도 네 값을 받는다.
- **Task 2**: 로컬 개발 서버(이 계획이 띄웠고 끝에 껐다)에서 측정 → morning 행 조정 → 재측정. day E2E 로 H1 확인.

## TDD 증거 (RED)

RED 커밋 `6e2db849` — `lightRankVerdict` 자리 함수(늘 `{ ok: true, rows: [] }`)와 상수만 두고 시험을 썼다. `node --test scripts/perf-run.test.mjs` 가 판정·파싱 단언에서 실패(임포트 오류가 아니다):

```
✖ parseArgs --mode light: 받는다, 기본 out 은 기존 기본값 그대로
✖ parseArgs --scene: 네 단계 모두 받는다
✖ USAGE 에 --mode light 가 있다   (AssertionError: The input did not match the regular expression /light/)
✖ lightRankVerdict: 순서·배율이 맞으면 ok, L4a·L4b·L4c 모두 ok   (actual: [], expected: [ 'L4a', 'L4b', 'L4c' ])
✖ lightRankVerdict: vote 가 morning 보다 밝으면 L4a 실패…         (actual: true, expected: false)
✖ lightRankVerdict: 배율 모자라면 L4b·L4c 실패
✖ lightRankVerdict: 숫자가 아닌 값이 있으면 모든 줄이 ok false
ℹ pass 12 / ℹ fail 7
```

`test/unit/perfScenario.test.ts` 도 `expected 'talk' to be 'morning'` 으로 실패. GREEN `b93a5e35`: node --test 19 통과, vitest 42 통과, typecheck 오류 0.

## 측정 결과 (평균 상대 휘도, 390×844 DPR 2, 시드 1, 사람 6, 코트, 10초 정지)

18-02 값 그대로(조정 전, `light-390x844-before.json`):

| 맵 | talk | morning | vote | night | L4a | L4b | L4c |
|----|------|---------|------|-------|-----|-----|-----|
| 광장 | 0.0171 | 0.0099 | 0.0044 | 0.0069 | 실패 | 2.47배 통과 | 1.43배 실패 |
| 재즈 바 | 0.0203 | 0.0075 | 0.0044 | 0.0068 | 실패 | 2.96배 통과 | 1.09배 실패 |

최종(조정 뒤, `light-390x844.json`):

| 맵 | talk | morning | vote | night | L4a 순서 | L4b talk/night | L4c morning/night |
|----|------|---------|------|-------|----------|----------------|-------------------|
| 광장 | 0.0172 | 0.0118 | 0.0044 | 0.0069 | 실패(vote < night) | 2.48배 통과 | 1.71배 통과 |
| 재즈 바 | 0.0201 | 0.0105 | 0.0044 | 0.0069 | 실패(vote < night) | 2.92배 통과 | 1.53배 실패 |

같은 값을 세 번 잰 talk·night 는 소수 넷째 자리까지 같거나 ±0.0001 안이라 흔들림 문제는 없었다(5% 미만).

## 조정 내역 (18-02 값 → 최종)

| 맵 | 행 | 18-02 | 최종 | 효과 |
|----|----|-------|------|------|
| 광장 | morning hemi / moon | 0.95π / 0.6π | 1.05π / 0.7π | 0.0099 → 0.0118 (L4c 통과) |
| 재즈 바 | morning hemi / moon | 0.85π / 0.4π | 1.0π / 0.55π | 0.0075 → 0.0105 (1.09배 → 1.53배, 미달) |
| 두 맵 | vote | — | 그대로 | 첫 조정(+0.05π)은 0.0044 → 0.0047·0.0049 로 효과가 미미해 되돌림 |

- 각 맵 morning 은 0.05π 씩 세 번(단계마다 약 +0.0009), vote 는 한 번 시도했다. 조정 규칙 한도(맵당 세 번)를 다 썼다.
- 밤 네 행·재질·노출·점광원·sky 색·moonColor·문턱은 바꾸지 않았다. `lighting.test.ts`·`plazaScene.test.ts`·`barScene.test.ts` 80개 통과(허용 범위 1~3 안).

## PNG 눈 확인

- 광장 talk: 화면 아래쪽을 채운 바닥·건물 재질이 짙은 남색이라 "흐린 보랏빛 회색 낮"보다는 어두운 푸른 저녁에 가깝게 보인다. 하늘 색(sky[2])은 위쪽 구석에만 보인다. 낮에 채도 높은 파랑·보라 네온은 보이지 않는다.
- 광장 night: 거의 검은 남색 + 가로등 빛 무리와 창문 불빛이 보여 낮과는 구분된다. 광장 vote 는 night 보다도 어둡고 가로등 빛만 밝다.
- 재즈 바 talk 는 따뜻한 갈색 바닥이라 광장보다 낮스럽다. 광장 talk 의 바닥 재질이 남색인 것은 재질 색 변경 금지 범위라 이 계획이 손대지 않았다 — 사람 판단 대상(아래).

## day 흐름 H1 (허용 범위 5)

`npm run e2e -- --url http://localhost:5173 --only day` → 여섯 크기 모두 111/111, "E2E OK". `day/nomination`·`nomination-guest`·`verdict`·`verdict-guest` 의 H1 "헤더 제목·타이머 글씨 대비 4.5:1" 줄이 통과했다(scrim 은 그대로). 튜토리얼 낮 장면의 H1 은 18-08 의 tutorial 흐름이 본다.

## 남은 문제 (18-10 이 HANDOFF 확인 대기로 옮긴다)

1. **L4a 두 맵 실패**: vote(0.0044) < night(0.0069). 저녁 지목은 따뜻한 방향광(#d8b48a)이 남색 재질에 반사돼 어둡게 렌더되고, 밤은 푸른 달빛(#c9d4ff)이 같은 재질에 잘 맞는다. vote 의 hemi·moon 을 0.05π 올리면 +0.0003~0.0005 뿐이라 night 수준(+0.0025)에는 hemi·moon 만으로 닿지 않는다. 닿으려면 vote moonColor·sky 를 바꾸거나 재질을 만져야 한다(허용 범위 3·재질 금지에 걸림) — 사람이 방향을 정한다.
2. **재즈 바 L4c 실패**: morning/night = 1.53배(문턱 1.6, 필요한 morning ≥ 0.0110, 지금 0.0105). talk hemi(1.1π)를 넘기지 않는 선에서 한 번 더 올리면 닿을 가능성이 크다(약 +0.0006 필요, 단계당 +0.0009).
3. 광장 talk 렌더가 짙은 남색 바닥이라 "낮" 인상이 약하다(휘도 배율은 통과). 눈 확인은 HANDOFF 로.

## Deviations from Plan

**1. [Plan 조정 규칙의 빈칸] vote < night 처리**
- **Found during:** Task 2, 첫 측정
- **Issue:** 조정 규칙은 "vote 가 morning 보다 밝으면 낮춘다"만 있고 vote 가 night 보다 어두운 경우가 없다.
- **Fix:** 반대 방향(올림)을 같은 0.05π 로 한 번 시도했고, 효과가 미미해 되돌렸다. 문턱은 낮추지 않았다.
- **Commit:** 되돌림이라 별도 커밋 없음(작업 트리에서만).

**2. [Rule 3 - Blocking] 모듈 임포트 RED 를 단언 RED 로**
- **Found during:** Task 1 RED
- **Issue:** 자리 함수에 상수 `LIGHT_*_RATIO` 가 없어 첫 RED 가 SyntaxError(임포트)였다.
- **Fix:** 상수를 자리 함수와 함께 두고 값 단언에서 실패하게 했다.
- **Commit:** 6e2db849

**3. `<automated>` verify 불통과(예상된 경로)**
- Task 2 의 verify 는 마지막 JSON 에 `ok:false` 줄이 있으면 1 로 끝난다. 세 번 조정 뒤에도 L4a 두 줄·바 L4c 가 실패해 이 줄이 "실패 plaza L4a, plaza L4a…" 로 끝난다 — 계획이 허용한 "남은 문제" 경로이고 숫자는 위에 적었다. `lighting.test.ts`·`plazaScene`·`barScene` vitest 는 통과.

**4. [작은 일탈] `light-390x844-before.json` 추가 보관** — 조정 전 18-02 값 측정을 덮어쓰지 않으려 같은 폴더에 따로 남겼다(`light-*.json` 정렬에서는 `light-390x844.json` 이 마지막).

**Total deviations:** 4 (처리 방식 기록 위주). **Impact:** 조명 판정 일부 미달이 남음.

## Known Stubs

없음.

## Threat Flags

없음 — scene 은 닫힌 네 값이고 서버·저장소에 닿지 않는다(T-18-16). 측정은 `--url http://localhost:5173` 로컬 서버만 열었고 v1.0 주소 거부(exitIfV1)를 그대로 지났다(T-18-17). 패키지 설치 없음(T-18-SC).

## 검증

- `node --test scripts/perf-run.test.mjs` 19 통과, `npx vitest run test/unit/perfScenario.test.ts test/client/perfProbe.test.tsx` 42 통과
- `npm run typecheck` 오류 0, `npm test` 279 파일·8010 통과(6 파일·261 건 skip 은 기존)
- 위생 검사(CLAUDE.md 원격 레포 위생 절의 git grep) 변경 파일 결과 0

## Self-Check: PASSED

- 파일: scripts/perf-run.mjs, perf/light-390x844.json, perf/light-390x844-before.json, PNG 8장 존재
- 커밋: 6e2db849, b93a5e35, 4b9a2dfc, 0bbe32bf 모두 HEAD 의 조상
- acceptance: `grep -c "export function lightRankVerdict" scripts/perf-run.mjs` 1, `"light"` 2, `morning` in scenario.ts 3, perf PNG 8장

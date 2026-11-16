---
phase: 24-suspect-note-tutorial
plan: "05"
subsystem: world-3d-wiring
tags: [suspect-note, scene-look, runtime, e2e-hook, perf-run]
status: complete
requires: ["24-04"]
provides:
  - "SceneLook.notes (받은 좌석 → 붙인 좌석 배열) — sceneLook 이 suspectStacks 에서 채움"
  - "runtime drawFrame 의 syncNotes → handle.setNotes?.(목록, { animate })"
  - "WorldRuntime.suspectNotes() / window.__mfWorld.suspectNotes()"
  - "PerfParams.notes · noteLayout(n, chars) · perf-run --notes N"
affects: [24-10, 24-11]
actuals:
  tokens: 6800
  tasks: 2
  commits: 4
plan_head_before: 71e2001132a75f002d3eaaeb288b5a05036fd2c8
plan_head_after: 6740c1988a91bcd495449e3179dc8c09f8567231
tech-stack:
  added: []
  patterns:
    - "런타임 per-actor 상태(마지막으로 보낸 목록)와 비교해 달라질 때만 핸들 호출 — setScene 은 look 만 바꾸고 적용은 프레임 루프(기존 ghost·costume 과 같은 방식)"
key-files:
  created:
    - test/client/postitRuntime.test.tsx
  modified:
    - src/world/presence.ts
    - src/world/runtime.ts
    - src/world/testHooks.ts
    - src/debug/perf/scenario.ts
    - src/debug/perf/perfScene.ts
    - scripts/perf-run.mjs
    - test/unit/presence.test.ts
    - test/unit/perfScenario.test.ts
decisions:
  - "종이 적용은 setScene 이 아니라 drawFrame 의 배우 루프에서 한다 — setScene 은 look 만 갈아 끼우고(기존 구조), 배우가 늦게 생겨도 같은 경로로 현재 목록을 받는다"
  - "perf 장면은 notes 0 이어도 장면 표(look)를 항상 올린다 — 0장·8장이 종이 말고는 같은 조건이 되게"
  - "noteLayout 은 총 장수를 min(n, 8, chars) 로 자른다"
metrics:
  duration: "약 25분"
  completed: 2026-11-17
---

# Phase 24 Plan 05: 종이 장면 배선과 perf-run --notes Summary

서버 view 의 `day.suspects` 가 `sceneLook` → `SceneLook.notes` → 런타임 프레임 루프 → `handle.setNotes` 로 흘러 모든 폰의 캐릭터 몸에 종이가 붙고 떨어지게 이었고, E2E 훅 `__mfWorld.suspectNotes()` 와 성능 측정용 `perf-run --notes N`(0~8)을 더했다. GameMap.tsx 는 건드리지 않았다(이미 `sceneLook` 을 `useMemo([view, ...])` 로 부르고 WorldStage 가 scene 변화마다 `setScene` 한다).

## 한 일

**Task 1 — 장면·런타임·훅**
- `src/world/presence.ts`: `SceneLook.notes?`(전체 붙인 좌석 배열, 보이는 3장 자르기는 핸들 리그 몫). `sceneLook` 끝에서 `suspectStacks(view)` 를 그리는 좌석(`seats` 에 있고 ghost 아님)으로 걸러 비어 있지 않으면 싣는다. 받은 좌석이 죽었으면 `suspectStacks` 가 이미 뺀다. 종이가 없으면 `notes` 키 자체가 없어 기존 시험의 `toEqual` 은 그대로다. 유령 viewer 의 view 도 같은 파생이라 산 사람의 종이를 똑같이 본다(P24-17).
- `src/world/runtime.ts`: `Actor.notes`(마지막으로 보낸 목록, `null` = 장면을 받은 적 없음). 프레임 루프의 ghost 블록 바로 뒤에서 `syncNotes(a, want, instant)` 호출 — `want` 는 유령 좌석이면 빈 목록, 아니면 `look.notes[seat]`. 마지막 목록과 같으면(길이·원소 비교) 부르지 않는다(T-24-15). `animate = !(모션 줄이기 || 유령 전환 프레임 || 이 배우가 처음 받는 목록)`. 처음 받는 목록이 빈 것이면 핸들에 아무것도 부르지 않는다(종이 없는 캐릭터 비용 0). `look === null`(로비)이면 건드리지 않는다. three 를 값으로 import 하지 않는다.
- `WorldRuntime.suspectNotes()`(핸들 `noteCounts?.()` 로 `{[seat]: {total, visible}}`, `total > 0` 인 좌석만), `HookRuntime.suspectNotes?`(선택), `WorldTestHooks.suspectNotes()` → `window.__mfWorld.suspectNotes`(런타임이 안 내주면 `{}`). 설치 조건은 기존 `worldTestHooksEnabled` 그대로(T-24-14).

**Task 2 — perf**
- `scenario.ts`: `PerfParams.notes`(0~8 정수, 범위 밖은 자름, 소수·문자·빈 값은 0)와 순수 함수 `noteLayout(n, chars)`: 처음 3장은 좌석 0 에(붙인 좌석 1·2·3), 나머지는 받은 좌석 1 부터 한 장씩(붙인 좌석 = 받은 좌석 + 1, 끝이면 0). `noteLayout(8, 8)` = `{0:[1,2,3], 1:[2], 2:[3], 3:[4], 4:[5], 5:[6]}`.
- `perfScene.ts`: mount 때 `SceneLook`(follow 카메라·`lighting: p.scene`·모든 좌석 보임·`notes` 는 0 이면 키 없음)을 만들어 `runtime.setScene` 후 `start`.
- `scripts/perf-run.mjs`: `--notes N`(0~8 정수, 아니면 `--notes 는 0~8 정수: {값}` UsageError), 쿼리 `notes=N`(0 이면 생략), 0 이 아니면 파일 이름에 `-notesN`, 콘솔 요약 줄에 notes, USAGE 갱신. 결과 JSON 의 `params.notes` 는 HUD 가 `PerfParams` 를 그대로 싣는 기존 경로로 남는다.

## 커밋

| 단계 | 해시 | 내용 |
| --- | --- | --- |
| T1 RED | edc6a60f | presence notes 파생·postitRuntime 시험(15건 실패 확인) |
| T1 GREEN | cad56563 | presence·runtime·testHooks 배선 |
| T2 RED | 39ea28d2 | perfScenario 시험 확장 |
| T2 GREEN | 6740c198 | scenario·perfScene·perf-run |

## 검증 (실제로 돌린 것)

- Task 1 automated: `npx vitest run test/unit/presence.test.ts test/client/postitRuntime.test.tsx test/client/ghostView.test.tsx` → 3 파일 175 통과. `npm run typecheck` 종료 0(커밋마다).
- Task 2 automated: `npx vitest run test/unit/perfScenario.test.ts` 41 통과, `node scripts/perf-run.mjs --notes 9 2>&1 | grep -c '0~8 정수'` → 1(사용법 줄에는 `0..8` 이라 오탐 없음).
- 웨이브 끝: `npx vitest run --project client` 81 파일 2762 통과(77 skip), `--project unit` 135 파일 4525 통과(1 파일 skip). 간헐 실패 없음.
- 계획 acceptance grep: `suspectStacks(` presence.ts 1, `setNotes?.` runtime.ts 1, `suspectNotes` testHooks.ts 3, `--notes` perf-run.mjs 5, `noteLayout` scenario.ts 2, `notes` perfScene.ts 4. `git log --grep='(24-05)' -- src/screens/GameMap.tsx` 출력 비어 있음.
- 위생 grep 을 바뀐 파일 전체에 돌려 결과 없음.

## Deviations from Plan

**1. [계획 보강] Task 2 RED 를 시험만 먼저 커밋했지만 실패를 직접 보지는 못했다**
- T2 에서 시험보다 먼저 `scenario.ts`·`perf-run.mjs` 를 고쳐 버려 RED 실패 출력을 확인하지 못했다. 대신 RED 커밋은 시험 파일만 담아(소스는 GREEN 커밋) 그 커밋 시점 트리에서는 `noteLayout`·`notes`·`--notes` 가 없어 실패하는 상태다. T1 은 실패(15건)를 확인한 뒤 GREEN 으로 갔다.

**2. [Rule 1 - 기존 시험 보정] `parsePerfParams` 기본값·쿼리 시험의 `toEqual` 에 `notes: 0` 추가**
- `PerfParams` 에 필드가 늘어 기존 `toEqual` 두 곳(기본값·`scene=vote...`)이 실패하는 것이 맞아 기대값만 고쳤다.

**3. [해석] 계획의 "perfScene 의 look" — 항상 올린다**
- 계획 문장이 "mount 때 만드는 look" 이었으나 기존 perfScene 은 장면 표 없이(`look = null`, 조명은 `deps.lighting`) 돌았다. 종이 0장과 8장을 종이 말고는 같은 조건으로 재기 위해 notes 가 0 이어도 장면 표를 올린다. 기존 값과 같게 `lighting: p.scene`·follow 카메라·긴장 0·모든 좌석 보임을 주었으므로 렌더 조건이 같지만, 런타임의 `look !== null` 분기(이름표 높이의 `stageLiftY`, 분필 추적 플래그)가 켜진다 — 이름표 y 에만 영향. 과거 perf 결과(`notes` 가 없던 때)와 비교할 때는 이 점을 감안해야 한다.

**4. [해석] `noteLayout` 의 "chars 보다 많은 장은 만들지 않는다"**
- 총 장수를 `min(n, 8, chars)` 로 자르고 모든 좌석 번호를 `chars` 미만으로 둔다. `chars` 가 8 보다 작은 측정(예: `--chars` 는 perf-run 옵션이 아니라 쿼리만 해당)에서는 8장이 안 나올 수 있다 — 기본 `chars=8` 이면 영향 없음.

## 알려진 한계 / 이월 (24-10 · 24-11)

- **24-10(perf 측정):** 명령 — `node scripts/perf-run.mjs --notes 0 …` 와 `--notes 8 …`(나머지 옵션 같게, 예 `--scene talk --minutes 0.25 --dpr 2 --throttle 4 --budget 0 --seed 1`). 출력 JSON 의 `params.notes`·`renderer.calls`(draw call)로 합격선(최악 +8 이내)을 판정한다. 결과 파일은 `-notes8` 접미사가 붙어 0장 결과를 덮어쓰지 않는다. 브라우저 측정은 이 계획에서 하지 않았다.
- **24-10(훅 모양):** `await page.evaluate(() => window.__mfWorld.suspectNotes())` → `{ [seat]: { total, visible } }`. `visible ≤ 3`, 종이 없는 좌석은 키가 없고 유령으로 바뀐 좌석은 `total` 이 0 이라 키에서 빠진다. 훅은 `?e2e=1`(또는 저장된 e2e·dev)에서만 설치된다. 새 훅 이름이라 e2e 문맥이 아니면 `window.__mfWorld` 자체가 없다.
- **24-10(visible 정의):** `visible` 은 24-04 리그의 `counts()` 값이라 떨어지는 중인 메시를 포함한다. 떨어지는 동안(최대 약 0.75초) 새 종이가 붙으면 순간적으로 3 을 넘을 수 있으니 E2E 는 모션이 끝난 뒤(또는 폴링으로 안정된 값) `visible ≤ 3` 을 단언한다.
- **유령 → 산 사람:** 되돌아가는 경우는 없지만 런타임은 `ghostFlipped` 프레임에 목록을 모션 없이 다시 보내도록 했다(24-04 이월 항목 반영).
- **재접속 첫 프레임:** "처음 받는 목록" = 이 배우가 장면 표(`look !== null`)를 처음 본 프레임. 로비에서 만들어진 배우가 판 시작 뒤 처음 받는 종이도 모션 없이 맞춘다(둘째 날 이후 종이는 실제 판에서는 그 사이에 한 번 이상 프레임이 돌아 `null` 이 아님).
- **돌리지 못한 것:** 실제 브라우저·WebGL 로 본 붙음·떨어짐(24-10 스크린샷)과 E2E 훅의 실제 값(24-10). 이 계획의 시험은 가짜 렌더러·가짜 캐릭터로 호출 값·횟수만 본다.

## Known Stubs

없음.

## Threat Flags

없음 — 새 네트워크·권한 경로 없음. 훅은 좌석별 장 수만 돌려주고 역할·닉네임이 없다(T-24-14), 같은 목록은 다시 부르지 않는다(T-24-15, `postitRuntime.test.tsx` 가 호출 수를 단언). 패키지 설치 없음(T-24-SC).

## Self-Check: PASSED

- 파일 존재: test/client/postitRuntime.test.tsx, 이 SUMMARY 확인.
- 커밋 존재(HEAD 의 조상): edc6a60f, cad56563, 39ea28d2, 6740c198 확인.

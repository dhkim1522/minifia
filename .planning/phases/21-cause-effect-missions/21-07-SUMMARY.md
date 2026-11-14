---
phase: 21-cause-effect-missions
plan: "07"
subsystem: world-3d
tags: [cause-effect, lamps, house-windows, lighting, night-unify, dusk, tdd]
status: complete

requires:
  - phase: 21-cause-effect-missions
    provides: "21-02 의 가로등 8곳(TOWN_LAMPS)·저녁 배정과 21-03 의 공개 day.lamps(등불 i = 집 i 창)"
provides:
  - "src/game/lampView.ts — lampLitOf(view)·houseLitOf(view): 3D 와 DOM(21-09 문패 창 점)이 같이 쓰는 순수 파생. 역할을 읽지 않는다"
  - "마을 3D 가로등 8개(기둥 lampPosts·전구 lampBulbs·빛 무리 lampGlow 묶음 셋) + MapScene.setLamps 훅, 집 창 두 묶음이 houseLit 이나 주인 규칙을 따름"
  - "palette.ts LAMP_LIT·LAMP_OFF 두 상수와 TOWN_LIT.houseLit 열 (tokens.css 대조 시험)"
  - "런타임 sendLamps(키 비교·recreate 뒤 force·모션 줄이기 instant) · WorldStage 의 view 전달 · window.__mfTown.houseLit/lampLit"
  - "확장판 밤 조명·몸 그리기·어둠 표식의 역할 분기 해제, 확장판 저녁(errand)의 해 질 녘 조명과 '저녁' 낱말"
affects: [21-08, 21-09]

actuals:
  tokens: 11400
  tasks: 3
  commits: 6

plan_head_before: 64bc5df657fc645b1d8f1c49b1d18112eafe486a
plan_head_after: 8be553e0075bb0a8b60bdadaa4835acdf8504e68
commits: 6

tech-stack:
  added: []
  patterns:
    - "공개 값 하나에서 3D 와 DOM 이 같이 파생: lampView 의 두 함수만 view 를 읽고, 런타임은 값이 바뀔 때만 렌더러로 보낸다"
    - "묶음 + 정점 속성으로 켜짐 표현: 전구는 정점 색(LAMP_LIT/LAMP_OFF), 빛 무리는 정점 알파 — 재질·점광원을 늘리지 않고 묶음 셋(+재질 둘)만 더한다"
    - "원인 흐름 분기를 역할 읽기보다 먼저: lightingFor·visibleSeats·nightDarkOf 의 cause 분기 위치를 소스 규약 시험이 고정한다"

key-files:
  created:
    - src/game/lampView.ts
    - test/unit/lampView.test.ts
  modified:
    - src/world/maps/town.ts
    - src/world/maps/plaza.ts
    - src/world/maps/types.ts
    - src/world/palette.ts
    - src/world/renderer.ts
    - src/world/threeRenderer.ts
    - src/world/runtime.ts
    - src/world/testHooks.ts
    - src/world/presence.ts
    - src/game/nightDark.ts
    - src/game/timeOfDay.ts
    - src/game/scenes.ts
    - src/components/WorldStage.tsx
    - src/screens/GameMap.tsx
    - test/unit/townScene.test.ts
    - test/unit/palette.test.ts
    - test/unit/lighting.test.ts
    - test/unit/timeOfDay.test.ts
    - test/unit/scenes.test.ts
    - test/client/worldStage.test.tsx
    - test/client/gameMap.test.tsx

key-decisions:
  - "houseLitOf 는 night 이후 단계(저녁 앞 단계 제외)이고 day.lamps 가 있을 때만 값, 아니면 null(주인 규칙) — 저녁 앞(lobby·roleReveal·dayAnnounce·errand)은 항상 null, lampLitOf 는 errand 에서 내 진행·그 밖은 day.lamps(없으면 모두 false)"
  - "가로등 3D 는 기둥(lampPosts, 집 몸 묶음 밖)·전구(lampBulbs)·무리(lampGlow) 세 묶음 — 집 몸 묶음에 넣으면 꼭대기 1.96 시험(20-04)과 부딪혀 따로 뒀다. 번호는 TOWN_LAMPS 순서 = 정점 묶음 순서"
  - "켜짐→꺼짐 무리 페이드는 렌더러가 update(dt)로 --dur-med 420ms 에 줄이고, 모션 줄이기는 setLamps 의 선택 셋째 인자 instant 로 바로 끈다(계획의 두 인자 시그니처에 선택 인자 하나 추가)"
  - "런타임은 view 를 새 의존 deps.view?() 로 받는다(선택 — 없으면 보내지 않음). WorldStage 가 live ref 로 건네고 view.players·lampsKey 가 바뀔 때 syncPlayers 가 sendLamps 도 부른다. WorldRuntime 인터페이스에 새 메서드를 더하지 않아 메서드를 일부만 흉내 낸 기존 시험 대역이 안 깨진다"
  - "원인 흐름의 밤 visibleSeats 는 빈 표(산 사람·유령 모두) — 개관 시점이라 밤에는 아무도 걷지 않는다(21-09 개관 카메라가 이 위에 얹힌다)"

metrics:
  duration: 약 60분
  completed: 2026-11-14
---

# Phase 21 Plan 07: 가로등 8개·집 창·밤 조명 통일 Summary

확장판 마을에 가로등 8개가 서고(저녁에는 내가 켠 등불만 내 화면에서, 밤부터는 서버의 공개 day.lamps 대로 모두에게 같게 켜짐·꺼짐), 밤·아침·토론의 집 창이 주인 유무가 아니라 같은 day.lamps(등불 i = 집 i)를 따른다. 확장판 밤 조명·몸 그리기·어둠 표식은 역할로 갈라지지 않고, 확장판 저녁은 해 질 녘 조명과 "저녁" 낱말이다. 기본 마피아·옛 확장판(잠금)은 그대로다.

## Accomplishments

- **Task 1 (순수 파생 + 3D):** `lampView.ts` 의 `lampLitOf`·`houseLitOf`(역할 읽기 없음, 소스 규약 시험). `town.ts` 에 가로등 8개(기둥·전구 구·빛 무리 쿼드 — 광장 가로등과 같은 빛 무리 재질) 묶음 셋과 `setLamps`; 집 창 두 묶음은 `applyWindows()` 가 houseLit 이 있으면 그것을, 없으면 setOwners 의 주인 규칙을 따른다. `palette.ts` 에 새 색 두 상수 `LAMP_LIT`(= lampBulb #ffd59a)·`LAMP_OFF`(#3a3f4b = `--gray-700`)와 `TOWN_LIT.houseLit` 열. 새 점광원 없음(3개 그대로).
- **Task 2 (연결):** `MapScene`·`WorldRenderer`·threeRenderer 에 선택 메서드 `setLamps(lampLit, houseLit, instant?)`. 런타임 `sendLamps`(마지막 보낸 키와 같으면 안 보냄, recreate 뒤 force, 둘 다 null 이면 보낼 것 없음, 모션 줄이기면 instant). `WorldStage` 가 `view` 를 런타임에 건넨다. `window.__mfTown` 에 `houseLit`·`lampLit`(런타임이 마지막으로 보낸 값 = view 의 공개 값 + 내 진행뿐).
- **Task 3 (조명 분기):** `lightingOf(phase, rules?)`·`todOf`·`todWordOf`·`sceneOfPhase` 가 원인 규칙의 errand 를 vote 조명·dusk·"저녁"으로. `lightingFor`·`visibleSeats`·`nightDarkOf` 는 원인 흐름 밤에서 역할 읽기보다 먼저 분기(산 사람 모두 night·몸 없음·어둠 표식 없음, 유령 nightGhost). `GameMap` 헤더 세 곳에 `rulesetOf(modeOf(view))` 전달.

## TOWN_LIT.houseLit 열 값 (재량, 계획 표)

| 조명 단계 | indoor | houseOwned(옛 규칙) | houseLit(원인 흐름 day.lamps) |
|-----------|--------|---------------------|-------------------------------|
| talk | 0.5 | 0.3 | 0.3 |
| vote | 0.8 | 1 | 1 |
| trial | 0.35 | 0.06 | 0.06 |
| night | 0.7 | 0.7 | 0.9 |
| nightCitizen | 0 | 0 | 0 |
| nightGhost | 0.7 | 0.7 | 0.9 |
| morning | 0.5 | 0.3 | 0.3 |

## Task Commits

1. **Task 1 RED:** `f705b836` test(21-07): 가로등·집 창 장면 실패 시험
2. **Task 1 GREEN:** `134abbff` feat(21-07): 마을 가로등 8개와 houseLit 창
3. **Task 2 RED:** `441338bb` test(21-07): setLamps 연결 실패 시험
4. **Task 2 GREEN:** `639d96ae` feat(21-07): 가로등·창 상태 연결과 __mfTown
5. **Task 3 RED:** `aacc521d` test(21-07): 밤 조명 통일·저녁 노을 실패 시험
6. **Task 3 GREEN:** `8be553e0` feat(21-07): 확장판 밤 조명 통일과 저녁 노을

## TDD Gate Compliance

- **RED 증거 (Task 1):** `npx vitest run --project unit test/unit/lampView.test.ts test/unit/townScene.test.ts test/unit/palette.test.ts --reporter=tap-flat` → **not ok 17**(lampView 4: errand 진행·진행 없음·night/morning/discussion day.lamps·night 인데 lamps 없음; palette 2: TOWN_LIT houseLit 열·LAMP_LIT/LAMP_OFF; townScene 11: 가로등 묶음 셋·그림자·처음 꺼짐·켜짐 목록·페이드·null·강등·houseLit 창 4). 실패는 자리 함수(null 반환)·빈 훅·자리 상수라는 의도된 이유이고 import·준비 오류가 아니다. 이미 초록이던 것(기본판·마을 아닌 맵 null, 소스 규약)은 구현 전에도 참인 음성 단언이다. semanticAssessment: 목표 단언 실패가 구현 부재와 일치한다. `gsd check tdd-red-evidence` 는 따로 돌리지 않았다(21-02~21-04 와 같음).
- **RED 증거 (Task 2):** `npx vitest run --project client test/client/worldStage.test.tsx --reporter=tap-flat` → **not ok 6**(기존 `__mfTown` toEqual 에 houseLit·lampLit 을 더한 한 건 + 새 5건: 시작 때 보냄·같은 값 재전송 없음·값 바뀌면 전송, recreated force, 모션 줄이기 instant, `__mfTown` 값, 잠금 마을의 null). 재즈 바·광장에서 부르지 않음은 음성 단언이라 RED 에서도 초록이었다.
- **RED 증거 (Task 3):** `npx vitest run --project unit test/unit/lighting.test.ts test/unit/timeOfDay.test.ts test/unit/scenes.test.ts --reporter=tap-flat` → **not ok 7**(lighting 4: 밤 네 역할 동일·유령·저녁 vote·소스 순서 규약; scenes 1; timeOfDay 2). 첫 시도는 `\n` 이스케이프가 깨져 파일 전체가 파싱 오류(`not ok 1` 파일 단위)였고 고친 뒤 위 7건이 목표 단언 실패로 확인됐다.
- RED 커밋이 GREEN 보다 앞서 세 task 모두 `test(21-07)` → `feat(21-07)` 순서다. REFACTOR 커밋은 없다.

## 시험 결과 (실제 출력)

- Task 1 verify: `npx vitest run --project unit test/unit/lampView.test.ts test/unit/townScene.test.ts test/unit/palette.test.ts test/unit/lighting.test.ts` → **4 files passed, 74 tests passed**; `npm run typecheck` exit 0.
- Task 2: `npx vitest run --project client test/client/worldStage.test.tsx` → **319 passed**.
- Task 3: `npx vitest run --project unit test/unit/lighting.test.ts test/unit/timeOfDay.test.ts test/unit/scenes.test.ts test/unit/presence.test.ts` → **4 files, 187 passed**; `test/client/gameMap.test.tsx` → **87 passed | 2 skipped**.
- 최종: `npx vitest run --project unit --project client` → **Test Files 239 passed | 1 skipped (240), Tests 8097 passed | 184 skipped (8281)**. `npm run typecheck`(tokens:check·placeart:check·wrangler types·tsc app·tsc worker) → exit 0.
- 워커 시험(`--project worker`)은 이 계획이 `shared/`·`worker/` 를 건드리지 않아 돌리지 않았다.
- 계약 대조: `grep -cE "export (const|function) (LAMP_LIT|LAMP_OFF)" palette.ts` 2 · `grep -c setLamps town.ts` 4 · `grep -c setLamps runtime.ts` 1 · `renderer.ts` 1 · `grep -c houseLit testHooks.ts` 2 · `grep -v '^\s*//' lampView.ts | grep -c "\.role"` **0** · `grep -c cause presence.ts` 5 · `nightDark.ts` 1 · `timeOfDay.ts` 3.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - 기존 시험 갱신] 마을 그리기 재질 상한 26 → 28**
- **Found during:** Task 1 GREEN
- **Issue:** 가로등 전구(MeshBasicMaterial)·빛 무리(glowMat) 재질 두 개가 더해져 `townScene.test` 의 "고유 재질 26 이하"가 맞지 않게 된다(정적 그리기 호출 ≤ 36·renderer.calls ≤ 120 예산은 그대로 통과).
- **Fix:** 상한을 28 로 올리고 설명에 "가로등 전구·빛 무리 2"를 적었다. 시험을 건너뛰거나 느슨하게 우회한 것이 아니라 계획이 허용한 묶음 재질 증가(+2)를 그대로 반영했다.
- **Files modified:** test/unit/townScene.test.ts
- **Commit:** f705b836

**2. [Rule 1 - 기존 시험 갱신] `TOWN_LIT` 열 단언·`__mfTown` 모양**
- **Found during:** Task 1·2 RED 작성
- **Issue:** palette.test 의 `TOWN_LIT` toEqual·열 키 목록(`["houseOwned","indoor"]`)과 worldStage.test 의 `__mfTown` toEqual 이 새 열·새 필드(houseLit·lampLit)를 모른다.
- **Fix:** 계획이 정한 새 열·새 필드를 단언에 더했다(기존 값은 그대로, 필드 하나씩 추가).
- **Commit:** f705b836, 441338bb

**3. [작은 구현 선택] `setLamps` 에 선택 셋째 인자 `instant`**
- 계획의 시그니처는 `setLamps(lampLit, houseLit)` 였지만, 모션 줄이기를 장면이 모르므로(컷어웨이의 `instant` 와 같은 방식) 선택 인자 하나를 더했다. 두 인자로 부르면 평소 페이드, 시험은 둘 다 확인한다.

**4. [작은 구현 선택] 런타임이 view 를 `deps.view?()` 로 받는다(계획 파일 목록 밖의 `WorldStage.tsx` 수정)**
- 계획 파일 목록에는 `WorldStage.tsx` 가 없지만 런타임이 view 를 읽을 길이 deps 뿐이라(마을 view 를 아는 곳이 WorldStage) 선택 dep 하나와 변경 감지용 `lampsKey` 효과를 더했다. WorldRuntime 인터페이스는 그대로라 `createWorldRuntime` 을 일부 메서드만 흉내 낸 기존 시험 대역(nightMap 등)이 안 깨진다.
- **Files modified:** src/components/WorldStage.tsx

**5. [시험 추가] 계획 파일 목록 밖의 시험 두 개**
- `test/unit/scenes.test.ts`(sceneOfPhase 의 원인 흐름 규칙 인자)와 `test/client/gameMap.test.tsx`(헤더 "저녁 · 심부름"과 data-tod dusk, 잠금이면 "낮" 그대로)에 단언을 더했다. 계획의 `scenes.ts`·`GameMap.tsx` 변경을 고정하는 시험이다.

## Auth Gates

없음.

## Known Stubs

없음. 3D 가로등·집 창·조명 분기와 E2E 훅은 이 계획에서 완성이다. 밤 개관 카메라·문패 창 점(DOM)은 21-09, 저녁 표지·단추는 21-08 이 이 장면과 `lampView.ts` 위에 얹는다.

## 알려진 한계 · 열린 항목

- **광장 장식 가로등 4개와의 겹침(화면 확인 메모):** 광장 소품 가로등 기둥 4개(20 의 소품, 계획대로 그대로 둠)가 새 마을 가로등과 가깝다 — (3.8, −2.4)↔lamp2 (4.25, −2.25) 와 (−2.4, 3.8)↔lamp5 (−2.25, 4.25)는 약 0.47 떨어져 있어 기둥이 거의 겹쳐 보일 수 있다. 나머지 둘은 약 1.26 이다. 실기기·배포본 화면에서 두 기둥이 이상해 보이면 광장 소품 쪽 둘을 지우거나 옮기는 한 줄로 닫힌다(20 페이즈 소품이라 이 계획에서 건드리지 않았다).
- **밤 개관은 아직 빈 마을:** 원인 흐름 밤의 `visibleSeats` 를 빈 표로 만들어 밤 장면에 몸이 하나도 없다(UI-SPEC C 장면 행). 개관 카메라·문패는 21-09 가 얹는다.
- **육안 조정 필요:** 가로등 기둥 높이(2.2)·전구 구(0.13)·무리 크기(2.0)·`houseLit` 열 값은 시안 사본의 모양에 맞춘 재량값이다. 실기기 화면에서 켜진 등불의 번짐·창 밝기를 한 번 보는 것이 남는다(21-16 nightload 가 성능만 본다).
- 사용자 위생 git grep 스크립트는 이전 계획들처럼 이 PC 에서 찾아 실행하지 않았다. 대신 바뀐 `src` diff 에서 `참가자`·`효과음`·`audio` 0건, hex 색은 `palette.ts` 의 `LAMP_OFF` 한 줄뿐(화면 CSS 에 hex 없음)임을 직접 확인했다.

## Threat Flags

없음 — 새 네트워크 면은 없다. T-21-25(밤 조명·visibleSeats·어둠 표식)는 lighting 시험이 네 역할 동일 단언과 분기 순서 소스 규약으로, T-21-26(`__mfTown`)은 view 의 공개 day.lamps 와 내 me.errand.done 에서만 파생(lampView 에 역할 읽기 0, e2e 문맥에서만 설치)으로, T-21-27(그리기 예산)은 점광원 3 그대로·묶음 ≤ 36 시험으로 완화했다.

## Self-Check: PASSED

- FOUND: src/game/lampView.ts, test/unit/lampView.test.ts
- FOUND commits: f705b836, 134abbff, 441338bb, 639d96ae, aacc521d, 8be553e0 (모두 HEAD 의 조상)

---
phase: 24-suspect-note-tutorial
plan: "04"
subsystem: world-3d-asset
tags: [suspect-note, three, post-it, character, texture-bake, palette]
status: complete
requires: ["24-01"]
provides:
  - "src/world/palette.ts — SEAT_COLORS(좌석 0~7 = 토큰 seat-1..8 복사)·NOTE_COLORS(종이 gray-50, 글자 night-950)"
  - "src/world/postit.ts — NOTE_SIZE·NOTE_CENTER·NOTE_ROLL_DEG·NOTE_LIFT·NOTE_STACK_STEP·coatRadius·notePlacement·noteBoxes·noteTint·createNoteKit(주입식 굽기)·noteKit()·disposeNoteKit()·createNoteRig"
  - "CharacterHandle.setNotes / noteCounts (renderer.ts 선택 메서드), WorldCharacter.setNotes / noteCounts (character.ts 구현)"
affects: [24-05, 24-10, 24-11]
actuals:
  tokens: 14000
  tasks: 2
  commits: 4
plan_head_before: afa47986eeab6987f5093a2fc020d2e60084386f
plan_head_after: 8dfbd124f0239527e09b38bd31dbcb1ff0f0c656
tech-stack:
  added: []
  patterns:
    - "주입식 굽기: NoteBakeEnv(makeCanvas·loadFont·fontLate) — node·happy-dom 에는 canvas 2D 가 없어 시험은 가짜 2D 기록기로 호출만 단언"
    - "종이 중심을 원점으로 한 국소 좌표 지오메트리 하나 + 메시마다 position/yaw(rotation.y)/roll(rotation.z, 순서 YXZ) 로 놓는다"
    - "키트 싱글턴(noteKit) 공유: 지오메트리 1·텍스처 1·재질 8 캐시. 캐릭터 dispose 는 메시만 뗀다"
key-files:
  created:
    - src/world/postit.ts
    - test/unit/postit3d.test.ts
  modified:
    - src/world/palette.ts
    - src/world/renderer.ts
    - src/world/character.ts
    - test/unit/palette.test.ts
    - test/unit/character.test.ts
decisions:
  - "NOTE_CENTER 시작값을 계획의 (−0.15, 0.54) 에서 (−0.18, 0.51) 로 옮겼다 — 단위 시험이 기울기 ±9° 에서 윗 모서리가 넥타이·옷깃과 겹침을 잡았다(아래 편차 1)"
  - "NOTE_SIZE 는 '안쪽 종이'의 한 변(0.36)이고 그리는 판은 NOTE_QUAD = 0.36 × 128/100 이다(투명 여백이 그림자 자리)"
  - "쌓기 오프셋은 몸통 표면을 따라 적용한다(x 는 호 길이, z 는 반지름 가산) — 단순 position 가산은 몸통 안으로 파고든다"
  - "종이는 lazy 리그: 처음 종이를 받을 때에만 키트·리그를 만든다(종이 없는 캐릭터는 비용 0)"
metrics:
  duration: "약 40분"
  completed: 2026-11-17
---

# Phase 24 Plan 04: "의심" 포스트잇 3D 에셋 Summary

가슴 옆 몸통 원통을 따라 휘어 붙는 공유 지오메트리 종이 한 장(주입식 128px 텍스처 굽기·좌석별 재질 8개 캐시)과, 보이는 3장 쌓기·붙음 280ms/떨어짐 600ms 모션 리그를 만들고 `CharacterHandle.setNotes` 로 body 자식에 붙였다. 런타임·장면 배선(24-05)과 GameMap 은 건드리지 않았다.

## 한 일

**Task 1 — 좌석 8색과 종이 키트**
- `SEAT_COLORS`(토큰 복사 8색)·`NOTE_COLORS` 를 palette.ts 에 추가하고 `palette.test.ts` 가 `design/tokens.json` seat-1..8 과 대조한다(gen-tokens.mjs 불변).
- 지오메트리 하나: 7×7 정점 격자(바깥 여백 | 안쪽 종이 가장자리 | 안쪽 4등분). 모든 정점이 코트 원통 반지름 `r(y)+0.012` 위에 있고 안쪽 종이 우하단 모서리 한 점만 0.025 떠 있다. 안쪽 종이 모서리가 격자선 위에 있어 들림이 종이 모서리에 제대로 걸린다.
- 텍스처 128×128 하나를 모든 종이가 공유: 그림자(알파 .30·번짐 6·오프셋 (2,3))·종이(위→아래 밝기차)·접힌 삼각(어두운 면+밝은 가장자리)·손글씨 "의심"(−3°, Nanum Pen Script 44px, night-950)·밑줄. 글꼴은 `loadFont()` 를 기다려 굽고 실패·시간 초과(1.5초)면 `700 40px system-ui` 로 굽고 `fontLate()` 가 오면 같은 텍스처를 `needsUpdate` 로 한 번만 다시 굽는다. `makeCanvas` 가 null 이면 1×1 gray-50 `DataTexture`, `baked` 거짓.
- 재질 8개 캐시: `MeshStandardMaterial`(조명 받음), transparent·depthWrite false·polygonOffset, 색 = 좌석색 45% + gray-50 55%(sRGB 채널 혼합). `postit.ts` 안 6자리 hex 리터럴 0.

**Task 2 — 리그와 캐릭터 부착**
- `createNoteRig(kit, parent, { floorY })`: `set`(맨 위 `NOTE_MAX_VISIBLE`=3 장, 같은 좌석은 유지·새 좌석은 붙음·옮김/한 장 사라짐은 옛 종이 즉시 제거·목록이 비면 떨어짐 80ms 간격), `update(dtMs)`, `clear()`, `detach()`, `counts()`. 메시는 `raycast` 빈 함수, 그림자 없음.
- 붙음: 위 0.25·크기 1.4 에서 280ms ease-out. 떨어짐: 600ms ease-in(y 는 바닥 월드 0.02 를 몸 좌표로 환산한 값까지, 위를 보고 눕고 몸통 밖으로 0.25 밀림), 450ms 부터 150ms 동안 크기 0 → 제거. 모션 줄이기·처음 프레임(`animate: false`)은 즉시.
- `character.ts`: body 그룹에 lazy 로 리그를 달고 `setNotes`→`rig.set`, `update` 가 dt(초)×1000 으로 진행, `setGhost(true)` 에서 `rig.clear()`(유령인 동안 `setNotes` 무시), `dispose` 는 `rig.detach()` 만(공유 키트 해제 안 함). 옷·표정 병합 캐시는 종이를 건드리지 않는다.
- `renderer.ts`: `CharacterHandle` 에 선택 메서드 `setNotes?`·`noteCounts?`. runtime.ts 는 three 를 값으로 import 하지 않는다(grep 0).

## 커밋

| 단계 | 해시 | 내용 |
| --- | --- | --- |
| T1 RED | 5b91e5c8 | palette·postit3d 키트 시험(모듈 없음으로 실패) |
| T1 GREEN | a5e87fe1 | SEAT_COLORS·NOTE_COLORS·postit.ts 키트 |
| T2 RED | 50159055 | 리그·핸들 시험(`setNotes`/`createNoteRig` 없음으로 실패 18건) |
| T2 GREEN | 8dfbd124 | createNoteRig·renderer.ts·character.ts |

## 검증 (실제로 돌린 것)

- `npx vitest run test/unit/palette.test.ts test/unit/postit3d.test.ts`: 28 통과(T1), postit3d 33 통과(T2).
- `npx vitest run test/unit/postit3d.test.ts test/unit/character.test.ts test/unit/characterBudget.test.ts`: 217 통과.
- `npx vitest run --project unit`: 133 파일 통과(1 skip), 4447 통과. `--project client`: 78 파일, 2712 통과.
- `npm run typecheck`(tokens:check 포함): 종료 0, 커밋마다 초록. 계획 acceptance grep 충족: `SEAT_COLORS` 1, `createNoteKit` 2, postit.ts 6자리 hex 0, gen-tokens.mjs 불변(`git diff --quiet 24b75c17`), `createNoteRig(` character.ts 1, `setNotes` renderer.ts 1·character.ts 2, runtime.ts three 값 import 0.
- 위생 grep 을 바뀐 파일 전체에 돌려 결과 없음.

## Deviations from Plan

**1. [Rule 1 - Bug/계획 값 오류] NOTE_CENTER 시작값 (−0.15, 0.54) → (−0.18, 0.51)**
- **Found during:** Task 1 GREEN (가리지 않음 시험)
- **Issue:** NOTE_SIZE 0.36 이고 좌석별 기울기 최대 ±9° 일 때 종이 윗 모서리가 y 0.746 까지 올라가 넥타이 보이는 부분(y ≥ 0.72)·왼쪽 옷깃 아랫끝과 겹치고, 오른쪽 끝이 단추(x 0.045~0.095)에 닿는다(RESEARCH 의 겹침 검사는 기울기를 빼고 계산했다). 원통 감쌈으로 가로 폭도 호 길이 0.36 → 몸 좌표 x 폭 약 0.37 이다.
- **Fix:** 볼록 다각형 분리축 대조로 (cx, cy) 를 훑어(−0.14~−0.20, 0.50~0.54) 모든 좌석·층 0~2 가 넥타이·옷깃·별·기자·단추와 겹치지 않고 윗변이 어깨(0.775) 아래인 값을 골랐다. 여유는 약 0.005(몸 좌표)로 작다 — 24-10 이 스크린샷으로 x −0.19~−0.17·y 0.50~0.52 안에서 확정한다.
- **Files modified:** src/world/postit.ts, test/unit/postit3d.test.ts
- **Commit:** a5e87fe1

**2. [Rule 2 - 정확성] 쌓기 오프셋을 몸통 표면을 따라 적용**
- 계획은 "층마다 x +0.03, y −0.035, 앞으로 0.004" 였으나 메시 position 에 x 를 그대로 더하면 yaw −24° 인 자리에서 종이가 코트 안으로 약 0.013 파고든다(띄움 0.012 와 같다). 그래서 x 는 표면 호 길이(yaw 가산), z 는 층 반지름에 더했다. 몸통이 아래로 굵어지는 효과로 층마다 반지름이 0.0058 더 늘어 총 0.0098 앞으로 나온다. 시험이 이 식(`b.radius − a.radius ≈ 0.004 + 0.00583`)을 고정한다.

**3. [Rule 1 - 계획 보완] 그리는 판 크기와 격자 분할**
- 계획의 "4×4 분할 평면"은 안쪽 종이 100px 가 128px 텍스처 안이라 NOTE_SIZE 가 판 전체면 보이는 종이가 78% 로 작아진다. NOTE_SIZE 를 안쪽 종이 한 변으로 정의하고 판을 `NOTE_QUAD = 0.36×1.28` 로 키웠다. 안쪽 종이 모서리가 격자선에 닿도록 7×7 정점 격자를 직접 만들었다(들린 모서리가 종이 모서리에 걸린다). 지오메트리 1개·정점 49.

**4. [Rule 3 - 가정 보완] 코트 반지름 함수의 반구 구간**
- 몸통 아래 반구(y < 0.36)까지 종이 판이 내려오므로 `coatRadius` 가 원통 식 하나로는 이음이 안 맞는다. 중심 0.36 의 반지름 0.39 원호로 이어 근사했다(실제 반구 중심 0.38 과 차 0.004 이하, 띄움 0.012 안쪽).

**5. [계획 보강] 글꼴 대기 시간 상한과 `fontLate`**
- 계획은 "글꼴을 기다려 굽는다" 였으나 영영 안 오면 종이가 안 보인다. 제품 환경에서 1.5초를 넘기면 기본 글꼴로 먼저 굽고 `fontLate()` 가 오면 한 번 다시 굽는다(`NoteBakeEnv.fontLate` 선택 멤버 추가).

## 알려진 한계 / 이월 (24-05 · 24-10 · 24-11)

- **24-05(런타임 배선):** `CharacterHandle.setNotes?(fromSeats, { animate })` 를 view 의 `suspectStacks`(보이는 3장 자르기는 리그 쪽) 로 호출한다. 처음 받은 프레임·모션 줄이기는 `animate:false`. 유령 전환은 `setGhost(true)` 가 종이를 이미 뗀다. 유령이던 캐릭터가 다시 산 사람으로 돌아오는 경우는 없다(돌아오면 `setNotes` 를 다시 불러야 붙는다 — 이전 목록을 기억하지 않는다). 시험용 가짜 핸들은 선택 메서드라 영향 없음.
- **24-05 perf:** 종이 한 장 = draw call 1(투명이라 불투명 뒤에 그려짐), 최악 +8. perf-run 최악 장면 측정은 24-10 몫(P24-18). 초과 시 `NOTE_MAX_VISIBLE`(shared) 를 2 로 줄이고 칩으로 대신.
- **24-10(스크린샷):** `NOTE_SIZE`(0.34~0.36, 14px 규칙은 0.36 에서 14.1px 라 줄이면 시험이 막는다)·`NOTE_CENTER`(x −0.19~−0.17, y 0.50~0.52) 최종 확정. 상수는 `src/world/postit.ts` 한 곳. 위 범위를 벗어나면 `postit3d.test.ts` 의 가리지 않음 시험이 실패한다. 걷는 중 왼쪽 가장자리(x ≈ −0.33)가 팔 피벗(x −0.37) 안쪽에 걸치는지는 실측 필요.
- **층 1·2 와 단추:** 위로 쌓인 장(오른쪽 아래로 어긋남)은 가슴 단추(x 0.07)를 가릴 수 있다. 시험은 층 1·2 에 단추를 대조하지 않는다(넥타이·옷깃·배지·머리만).
- **24-11(0092 알려진 한계에 적을 것):** 카메라가 등 쪽을 보면 가슴 종이는 안 보인다(칩·기록 카드가 대신). 폰에서 '의심' 글자가 흐릴 수 있다 — 모양·색이 신호.
- **돌리지 못한 것:** 실제 브라우저·WebGL 로 본 모양(밤 조명에서 혼자 빛나지 않는지 = 계획의 `verification: backstop` 항목, 글꼴 실로딩, 접힌 모서리 시각 확인)은 이 계획에서 돌리지 못했다. 단위 시험은 가짜 2D 기록기·three 객체 그래프만 본다. 24-10 스크린샷에서 확인한다.
- `meshCount()` 는 이제 붙은 종이 메시를 센다(종이 없는 캐릭터는 그대로). `characterBudget` 시험의 6메시 규칙은 종이를 받지 않은 캐릭터 기준이라 영향 없음.

## Known Stubs

없음.

## Threat Flags

없음 — 종이는 좌석 색 틴트와 "의심" 글자뿐이고 새 네트워크·권한 경로가 없다(T-24-13 accept). 패키지 설치 없음(T-24-SC).

## Self-Check: PASSED

- 파일 존재: src/world/postit.ts, test/unit/postit3d.test.ts, 이 SUMMARY 확인.
- 커밋 존재(HEAD 의 조상): 5b91e5c8, a5e87fe1, 50159055, 8dfbd124 확인.

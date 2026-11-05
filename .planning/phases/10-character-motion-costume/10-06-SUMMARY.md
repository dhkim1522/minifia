---
phase: 10-character-motion-costume
plan: "06"
subsystem: character-asset-verification
tags: [asset-budget, pose-strip, perf-scenario, debug-screen, tdd]
status: complete
requirements: [AVTR-01, AVTR-02]
requires:
  - phase: 10-04
    provides: "의상 적용·ownedGeometryCount·prewarm"
provides:
  - "npm run check:character — 45조합 예산·동작 표 무결성·EMOTE_MS 일치·manifest 출처를 한 명령으로 검사"
  - "design/characters/manifest.json figure-3d 항목(저장소 자체 코드 조립, 외부 의존 없음)"
  - "?pose-strip=1 포즈 스트립 디버그 화면(개발·?e2e=1 문맥 한정, 지연 로드)과 scripts/pose-strip-shot.mjs"
  - "?perf=1 outfits=mix·burst=N·firstEmoteGapMs, perf-run.mjs --outfits/--burst"
affects: [10-09]
tech-stack:
  added: []
  patterns: ["검사 본체는 node vitest 한 파일, 스크립트는 얇은 껍데기", "운영 번들의 perfProbe 에는 게이트(poseStripData)만, 화면은 동적 import"]
key-files:
  created:
    - test/unit/characterBudget.test.ts
    - scripts/check-character.mjs
    - src/debug/poseStripData.ts
    - src/debug/poseStrip.ts
    - scripts/pose-strip-shot.mjs
    - test/unit/poseStrip.test.ts
    - .planning/phases/10-character-motion-costume/pose-strip/ (PNG 5장)
  modified:
    - package.json
    - design/characters/manifest.json
    - src/debug/perfProbe.ts
    - src/debug/perf/scenario.ts
    - src/debug/perf/perfScene.ts
    - scripts/perf-run.mjs
    - test/unit/perfScenario.test.ts
key-decisions:
  - "기자 모자 × 여자 머리 두 조합(인물 2·4)은 높이 1.918 로 밴드 1.9 를 넘는다. 밴드를 넓히지 않고 두 조합만 상한 1.92 의 명시 예외로 시험에 기록했다(부품 모양을 바꾸지 않는 계획)"
  - "포즈 스트립 데이터 모듈은 characterData·three 를 가져오지 않는다(운영 번들 보호). 의상 목록·인물 수·걷기 속도는 되풀이해 두고 시험이 원본과 어긋남을 잡는다"
  - "MIX_OUTFITS 는 시험할 수 있게 scenario.ts 에 둔다(계획은 perfScene 이라 적었다)"
metrics:
  duration: "약 20분"
  completed: "2026-11-05"
actuals:
  tokens: 36000
  tasks: 3
  commits: 6
plan_head_before: 1e47535be81fb9b5d7be6fd40e95951e283ff435
plan_head_after: 3db7d4da9ae973904b1d29939b48edd3172a46d6
---

# Phase 10 Plan 06: 인물 에셋 검증과 성능 시나리오 Summary

새 부품 없이 인물 5명 × 의상 9종 45조합이 예산 안임을 `npm run check:character` 한 명령으로 확인하고, 포즈 스트립 사진으로 겹침을 눈으로 확인했으며, 마지막 계획이 8명 서로 다른 의상과 동시 동작 4개를 한 장면에서 잴 수 있게 perf 시나리오를 넓혔다.

주의: `commits: 6` 은 이 계획의 커밋(제목에 `(10-06)`)만 센 값이다. 병렬 실행된 10-07 커밋이 같은 가지에 섞여 있어 `plan_head_before..HEAD` 전체 개수(12)는 이 계획의 몫이 아니다.

## 커밋

| 순서 | 해시 | 내용 |
| --- | --- | --- |
| 1 | 427a4942 | test: 45조합 예산·동작 표·EMOTE_MS·manifest 계약 (RED) |
| 2 | 3006ff0f | feat: check:character 와 figure-3d 출처 (GREEN) |
| 3 | c6d80939 | test: 포즈 스트립 게이트·격자·파서 (RED) |
| 4 | 197c6109 | feat: 포즈 스트립 화면·스크린샷 스크립트·사진 5장 (GREEN) |
| 5 | 2d8013c4 | test: outfits/burst 계약과 기본 시나리오 골든 (RED) |
| 6 | 3db7d4da | feat: outfits=mix·burst=N·firstEmoteGapMs (GREEN) |

## 측정값 (Task 1)

- 45조합 모두 메시 ≤ 8, 삼각형 ≤ 15,000, 병합 지오메트리 ≤ 14(dispose 뒤 0), NaN 없음, 걷기·동작 9종 재생 중 값 유한·메시 수 불변. 최대 삼각형 × 8 ≤ 120,000, 최대 메시 × 8 ≤ 64 통과.
- 높이: 최소 1.721(코트·의사 등), 최대는 기자 의상 1.888(인물 0·1·3)과 **1.918(인물 2·4 = 여자 머리)**. 1.918 두 조합이 밴드 1.5~1.9 를 0.018 넘는다 → 아래 편차 1.
- 동작 표: EMOTES 키 집합 = EMOTE_IDS, 모든 프레임 키 ∈ EMOTE_KEYS + face, face 값 ∈ FACE_IDS, EMOTE_MS 아홉 개 모두 표 계산값과 일치.

## 포즈 스트립 사진 확인 (Task 2)

사진: `.planning/phases/10-character-motion-costume/pose-strip/` (strip-fig0-coat, strip-fig0-detective, strip-fig3-hood, combos-idle, combos-walk). 에이전트가 다섯 장을 직접 열어 본 결과.

- 모자: 양호. 경찰·탐정·누아르·마피아·기자·후드·어르신(흰 머리) 45조합 모두 머리를 덮고 인물 기본 모자(도윤 검은 페도라·하은 갈색 페도라)는 코트에서만 보이고 의상 모자가 있으면 대체된다. 기자 모자는 여자 머리(서연·하은) 위에서 조금 더 높이 얹혀 보인다(높이 1.918, 겹침·뚫림은 없음).
- 소품: 양호. 탐정 돋보기가 손에 닿아 있고(서기·박수·춤에서도 손을 따라감), 어르신 지팡이·기자 카메라가 손 근처에 있다. 기자 카메라는 작아 몸에 붙은 듯 보인다(문제는 아님, 실기기에서 크기 확인 후보).
- 걷기: 양호. 위상 0·90·180·270 에서 발·팔 위치가 달라지고 팔다리가 몸통을 파고들지 않는다. 코트·후드처럼 옷이 긴 의상에서는 다리가 거의 가려져 변화가 작다(자연스러움 범위).
- 머리 위 비어 있음: 양호. 동작 열 어디에도 머리 위에 그려진 것이 없다(포즈 스트립 맨 위 글줄이 이를 표시). 도윤(후드)의 앞머리가 후드 안쪽으로 보이는 것은 의도된 모양.
- 동작 겹침: throat·cry·clap 은 손이 턱 앞~가슴에서 멈춰 머리·모자를 파고들지 않는다. 문제 없음.

## Deviations from Plan

**1. [Rule 1 - 계약 어긋남] 인물 2·4 × 기자 높이 1.918**
- 발견: Task 1 시험. 계획의 측정값(1.721~1.888)은 여자 머리 두 인물을 놓쳤다.
- 처리: 밴드를 넓히지 않았다. `KNOWN_TALL` 에 두 조합만 상한 1.92 의 명시 예외로 두고 값을 이 SUMMARY·시험 주석에 적었다. 부품 모양(기자 모자·여자 머리)을 바꾸지 않는다는 계획(D-16)을 따랐다. CHAR_SCALE 을 낮추면 맵 전체 크기·충돌이 바뀌어 하지 않았다.
- 판단 요청: UI-SPEC 밴드 상한(1.9)을 1.92 로 정식 조정할지, 기자 모자를 바꿀지 10-09 또는 사용자가 정한다.
- 커밋: 427a4942

**2. [Rule 3 - 계약 맞춤] MIX_OUTFITS 위치**
- 계획은 perfScene.ts 상수라 했지만 단위 시험에서 가져오려면 DOM 을 모르는 모듈이어야 해 scenario.ts 에 두고 perfScene 이 가져온다. 커밋: 3db7d4da

**3. [Rule 3] initPerfDebug 두 번째 인자**
- 개발 빌드에서는 `import.meta.env.DEV` 가 참이라 게이트 거짓 경로를 시험할 수 없어 `initPerfDebug(search, { dev, storage })` 를 더했다(기본은 기존 동작).

**4. 기존 시험 기대 갱신**
- `parsePerfParams` 의 기본값·쿼리 읽기 시험이 PerfParams 전체를 toEqual 로 비교해 outfits·burst 필드를 더했다.

## Known Stubs

없음.

## Threat Flags

없음. 포즈 스트립은 `poseStripEnabled`(쿼리 + 개발/e2e) 게이트와 지연 로드(번들에서 별도 청크 poseStrip-*.js 3.5 kB)로만 열리고 서버로 아무것도 보내지 않는다(T-10-19 시험으로 확인). manifest 에 출처 기록(T-10-20, 시험 포함).

## 검증

- `npx vitest run test/unit/characterBudget.test.ts test/unit/poseStrip.test.ts test/unit/perfScenario.test.ts test/unit/perfMetrics.test.ts` 143 통과, `npm run check:character` 통과, `npm run typecheck` 오류 없음, `npm run build` 성공.
- 작은 규모 측정(개발 서버, 0.25분, 4배 스로틀, 390x844, outfits=mix, burst=4): 평균 59.8fps, 끊김 0, calls 67, triangles 97,860, firstEmoteGapMs 16.7. 5분 측정·합격 판정은 10-09 몫.
- 전체 `npx vitest run`: 5,471 통과, 실패 2건은 이 계획 파일과 무관: `test/unit/tokensV2.test.ts`(직업 배지 CSS 모션 줄이기 규칙)와 `test/client/backdrop.test.tsx`(배경 그림 경로 정규식). 스타일·배경 쪽 변경(10-05·10-07 병렬 작업 또는 이전)에서 온 것으로 보이며 이 계획은 건드리지 않았다.
- 웨이브 게이트의 gsd-tools 검사(ui.safety-gate·schema-drift)는 이 실행기에서 돌리지 않았다(오케스트레이터 몫).

## 이월 메모

- 10-09 명령: `node scripts/perf-run.mjs --mode perf --scene talk --minutes 2 --throttle 4 --size 390x844 --outfits mix --burst 4 --out <폴더>` (합격 판정은 minutes ≥ 5 에서만). 결과 JSON 키: `frames.avgFps/jank/p95`, `renderer.calls/callsMax/triangles/geometries`, `params.outfits/burst`, `firstEmoteGapMs`(≤ 50 이 합격, 동작 없으면 null), `meets`(5분만). 파일 이름은 `desktop-talk-dpr2-x4-mix-burst4.json`.
- 작은 규모 값(0.25분)은 위 검증 절. 8명 mix 장면 triangles 97,860 / calls 67 은 장면 전체(맵 포함)라 캐릭터 예산 64와 별개이고 장면 합계 ≤ 120 기준으로 본다.
- `npm run check:character` 는 WebGL·서버 불필요(node vitest). 의상 카드 그림(public/outfits)의 존재는 검사하지 않는다.
- 포즈 스트립: 개발 서버를 띄운 뒤 `node scripts/pose-strip-shot.mjs --url http://localhost:5173 --out <폴더>`. 사진은 `.planning/phases/10-character-motion-costume/pose-strip/`.
- 실기기 후보: 기자 모자 × 여자 머리 높이 1.918(밴드 초과 결정 필요), 기자 카메라 소품 크기가 작아 몸에 붙어 보임.
- 전체 실행 시 실패 2건(tokensV2 모션 줄이기 배지 규칙, backdrop 경로 정규식)은 10-06 파일과 무관 — 10-07/09 가 원인 확인.

## Self-Check: PASSED

- 생성 파일(characterBudget.test.ts, check-character.mjs, poseStripData.ts, poseStrip.ts, pose-strip-shot.mjs, poseStrip.test.ts, pose-strip PNG 5장) 존재 확인.
- 커밋 427a4942·3006ff0f·c6d80939·197c6109·2d8013c4·3db7d4da 가 HEAD 의 조상임을 확인.

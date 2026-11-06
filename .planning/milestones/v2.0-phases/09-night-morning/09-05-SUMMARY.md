---
phase: 09-night-morning
plan: "05"
subsystem: ui-parts
tags: [face-list, v2-icon, assets, tdd, night-pick]
status: complete

requires:
  - phase: 09-night-morning
    provides: 승인 v2.0 디자인 시스템 FaceList (design/v2.0/design-system/components)
provides:
  - public/characters/faces/face-0~7.png (승인 원본과 바이트 동일 복사본)
  - faceSrc(seat) — "/characters/faces/face-{seat % 8}.png", 음수도 0~7
  - V2Icon quill·note·target·eye·heal (승인 bundle.js ICONS 그대로)
  - FaceList 부품 (seat 기준 props), CSS .mv-faces·.mv-face*
affects: [09-15 밤 패널(경찰·의사 pick 에 붙임), 아침 유언·쪽지 화면(quill·note), 마피아 지목 화면(target)]

actuals:
  tokens: 14000
  tasks: 3
  commits: 6
plan_head_before: 41b3a5567a238923108493a6fb7eec207dd61276
plan_head_after: 3f8102d4a0a680d4d7d3722aa16801311b661e79

tech-stack:
  added: []
  patterns:
    - "승인 부품의 id 를 seat 로 바꿔 서버 pick target 과 변환 없이 잇는다"
    - "얼굴 그림 실패는 칸 단위 useState 집합으로 처리하고 이름·선택은 그대로 둔다"

key-files:
  created:
    - public/characters/faces/face-0.png ~ face-7.png
    - src/components/v2/FaceList.tsx
    - test/client/faceList.test.tsx
  modified:
    - src/net/assets.ts
    - test/unit/assets.test.ts
    - src/components/v2/V2Icon.tsx
    - src/styles/v2.css

key-decisions:
  - "안 고른 칸의 brightness .85 saturate .85 는 승인 bundle.css 처럼 얼굴 그림(.mv-face__img)에만 건다 — 이름·점은 어둡게 하지 않는다 (가정 A2: 승인 값 그대로)"
  - "칸 면은 승인 rgba 대신 토큰 var(--night-800) 을 쓴다 (hex·rgba 금지)"
  - "선택은 aria-pressed, 연결 끊김·고를 수 없는 칸은 disabled 속성 대신 aria-disabled 로 막아 포커스를 유지한다"

requirements-completed: []

metrics:
  duration: 약 15분
  completed: 2026-11-03
---

# Phase 9 Plan 05: 얼굴 목록 부품 Summary

**경찰·의사가 깜깜한 밤에 얼굴을 눌러 고르는 FaceList(4열, 고른 칸 테두리+행동 아이콘, 그림 실패 대체, 8자 이름 두 줄 줄바꿈)와 얼굴 그림 8장·faceSrc·아이콘 다섯을 준비했다.**

## Accomplishments

- 얼굴 PNG 8장을 `public/characters/faces/` 로 복사(원본은 그대로, `cmp` 로 동일 확인)하고 `faceSrc(seat)` 를 더했다. assets.test 가 실제 파일 존재를 확인한다.
- V2Icon 에 quill·note·target·eye·heal 을 승인 정의 그대로 옮겼다. 시험이 기대 경로와 원 좌표를 직접 비교한다.
- FaceList: `faces {seat,name,img,color,disabled?}[]`, `value`, `onPick(seat)`, `icon`, `label`, `disabled`, `ariaLabel`. 같은 칸 재클릭은 onPick 을 부르지 않는다. 그림 실패는 `data-face-fallback="true"` 와 색 원. 1·4·5·8칸 모두 `.mv-faces` 한 개로 4열.
- 진홍·놋쇠·hex 가 FaceList 와 `.mv-face*` CSS 에 없음을 시험이 규칙 본문으로 검사한다. 닉네임이 `<b>` 문자열이어도 글자로만 보인다 (T-09-08, T-09-09).

## Task Commits

1. Task 1 RED `3e5adea` → GREEN `3e24c8b` (트레이서: 에셋·faceSrc·칸 누르기)
2. Task 2 RED `85eff7d`(아이콘 시험) → GREEN `76027f1`
3. Task 3 RED `72a4df6` → GREEN `3f8102d`

## 검증

- `npx vitest run --project client` 43 파일 1370 통과, `test/unit/assets.test.ts` 18 통과.
- `npm run typecheck` 오류 없음, `npm run tokens:check` 통과.
- 트레이서 게이트: 칸 하나를 눌러 seat 를 고르는 시험이 에셋 복사 직후 통과한 뒤 확장.

## Deviations from Plan

없음 — 계획대로 실행했다. 필터 위치(그림에만)는 계획 truths("안 고른 칸은 brightness .85 saturate .85")를 승인 CSS 방식으로 만족시킨 해석이다.

## Known Stubs

없음. 얼굴 그림은 좌석 번호별 공용 8장이며(가정 A1) 10페이즈가 각자의 의상 얼굴로 바꾼다 — 계획에 명시된 이월 사항.

## Threat Flags

없음.

## Self-Check: PASSED

- 파일: faces/face-0~7.png, FaceList.tsx, faceList.test.tsx 존재 확인
- 커밋: 3e5adea, 3e24c8b, 76027f1, 72a4df6, 3f8102d, 85eff7d 가 HEAD 조상에 있음

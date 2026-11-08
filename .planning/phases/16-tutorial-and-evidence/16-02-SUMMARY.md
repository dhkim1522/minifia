---
phase: 16-tutorial-and-evidence
plan: "02"
subsystem: assets-ui
tags: [svg, jsx-codegen, color-assets, vitest, react]
status: complete
requires:
  - phase: 15-errand-and-record
    provides: PLACE_IDS·PLACE_NAME(장소 16)·TRACE_PIECE_IDS·TRACE_TEXT(조각 9)
provides:
  - scripts/make-placeart.mjs — 승인 시안 A 의 svg 25개를 사본과 정적 JSX 로 옮기는 변환기(--check 포함)
  - design/v3.0/assets/{id}.svg 사본 25개
  - src/components/v2/placeArt.tsx(생성물) — PLACE_ART·TRACE_ART 표, PlaceArt·TraceArt 부품
  - npm 스크립트 placeart·placeart:check(typecheck 사슬에 포함)
affects: [16-07, 16-08, 16-09, 16-10]
actuals:
  tokens: 10506
  tasks: 2
  commits: 3
plan_head_before: 555026cb26f872fe630b0d87aa0f45c27e825b07
commits: 3
plan_head_after: 634f6a85aa30c020c53579b790d06d220fe51cf3
tech-stack:
  added: []
  patterns:
    - "생성 + --check 한 방향 변환(gen-tokens 선례): 원본 시안 → 사본 → 정적 JSX, 어긋나면 typecheck 가 실패"
    - "허용 태그·속성 목록 밖이면 변환기가 멈춘다(on* 이벤트·script·foreignObject 차단)"
key-files:
  created:
    - scripts/make-placeart.mjs
    - src/components/v2/placeArt.tsx
    - design/v3.0/assets/ (svg 25개)
    - test/unit/placeArt.test.ts
    - test/client/placeArt.test.tsx
  modified:
    - package.json
key-decisions:
  - "변환기는 .ts 를 import 하지 않는다. 낱말 → id 표(WORD_TO_ID)를 스크립트 안에 두고 PLACE_NAME·TRACE_TEXT 와의 일치는 단위 시험이 검사한다"
  - "사본 svg 는 width·height 를 빼고 xmlns·role·aria-label 을 더해 단독으로 열어도 보이게 했다. JSX 는 size·label prop 으로 대신한다"
  - "--check 는 남는 svg(표에 없는 파일)도 실패로 센다"
requirements-completed: [ASSET-01]
coverage:
  - id: D1
    description: "시안 A 의 25개가 다시 그려지지 않고 사본·정적 JSX 로 옮겨지고 --check 가 일치를 지킨다"
    requirement: ASSET-01
    verification:
      - kind: unit
        ref: "test/unit/placeArt.test.ts#컬러 에셋 이식 스크립트 --check"
        status: pass
  - id: D2
    description: "id·이름 1:1, 같은 맵 안 본문이 서로 다름, 주입·하이픈 속성 없음"
    requirement: ASSET-01
    verification:
      - kind: unit
        ref: "test/unit/placeArt.test.ts#생성 JSX(placeArt.tsx)"
        status: pass
  - id: D3
    description: "25개가 경고 없이 렌더되고 label 유무에 따라 이미지/장식으로 읽힌다"
    requirement: ASSET-01
    verification:
      - kind: unit
        ref: "test/client/placeArt.test.tsx"
        status: pass
---

# Phase 16 Plan 02: 컬러 에셋 A 25개 이식 Summary

승인 시안 A 의 컬러 svg 25개(장소 16 + 흔적 조각 9)를 다시 그리지 않고 Node 내장만 쓰는 변환기로 사본 25개와 정적 JSX 표(`placeArt.tsx`)로 옮겼고, `--check` 가 typecheck 사슬과 단위 시험에서 일치를 지킨다.

## Accomplishments

- `scripts/make-placeart.mjs`: Main.dc.html 에서 aria-label 이 있는 svg 25개를 잡아 낱말 → id 표로 이름을 붙이고, 허용 태그(circle·ellipse·path·rect)·속성 목록 밖이면 멈춘다(T-16-05). `buildArt`·`readOutputs`·`diffOutputs` 를 export 해 시험이 실패 경로를 단위로 본다.
- `design/v3.0/assets/{id}.svg` 25개와 `placeArt.tsx` 생성. 하이픈 속성은 camelCase, 루트 width·height·role·aria-label 은 size·label prop 으로 대신한다.
- `PlaceArt`/`TraceArt`: label 이 있으면 `role="img"` + `aria-label`, 없으면 `aria-hidden="true" focusable="false"`.
- 이 계획의 시험: 단위 35 + 렌더 77 = 112개 통과. `npm run typecheck` 통과.

## Task Commits

| Task | Commit | 내용 |
| --- | --- | --- |
| 1 RED | e62bff77 | test(16-02): 컬러 에셋 이식 실패 시험 |
| 1 GREEN | 9792a934 | feat(16-02): 컬러 에셋 A 25개 이식 — 사본·JSX·--check |
| 2 | 634f6a85 | test(16-02): 컬러 에셋 렌더 시험 (생성기 수정 없이 첫 실행 통과) |

## Deviations from Plan

None - plan executed exactly as written.

## Deferred Issues

- 전체 `npm test` 에서 `test/worker/bots.test.ts`("봇 chat: 밤에는 마피아 봇의 줄이…")가 두 번 연속 `mafiaBot` undefined 로 실패했고, 그 파일만 단독으로 돌리면 통과했다(27 통과). 이 계획이 건드린 파일과 무관하며, 역할 배정이 무작위라 생기는 간헐 실패로 보인다. 고치지 않고 기록만 한다.

## Known Stubs

None.

## Threat Flags

None. 새 네트워크·인증·파일 접근 표면 없음(T-16-05·T-16-06 완화는 변환기 허용 목록과 --check 로 적용).

## Self-Check: PASSED

- scripts/make-placeart.mjs, src/components/v2/placeArt.tsx, test/unit/placeArt.test.ts, test/client/placeArt.test.tsx, design/v3.0/assets/*.svg(25개) 존재
- 커밋 e62bff77, 9792a934, 634f6a85 확인

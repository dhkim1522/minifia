---
phase: 04-execution-verdict
plan: 20
subsystem: verdict-screens-reveal-motion
tags: [candidateVoteReveal, RevealLayer, arrow, requestAnimationFrame, clinch, beat, vibrate, reduced-motion, tdd]
status: complete

requires:
  - phase: 04-execution-verdict
    provides: "04-13 verdict.ts(revealStateAt·arrowEndpoints·clinch 사건·REVEAL_DRAW_MS/FADE_MS·CLINCH_VIBRATE_MS), 04-19 useRevealState·DayTable chip·앰버 후광·verdictScene 공개 분기"
provides:
  - "RevealLayer — 공개 화살표 SVG 층(.mf-varrow, z 40, aria-hidden, 클릭 통과). rAF 한 줄기로 끝점을 세제곱 ease-out 보간, 동시에 하나, 닿고 120ms 페이드, 마지막 화살표가 사라지면 프레임 요청 중단, 언마운트 시 취소. 좌석을 못 찾는 줄은 건너뜀"
  - "useReducedMotion() — prefers-reduced-motion 구독 훅(matchMedia 없으면 false, 변화를 따르고 언마운트 때 구독 해제)"
  - "DayTable layer 슬롯 — layer?: (DayTableLayout{places,sceneW,sceneH}) => ReactNode 를 루트 마지막 자식으로 한 번 그림. 없으면 렌더가 이전과 같음. DayTableSeat.beat('clinch'|'slow')·chip.slow"
  - "verdict.ts clinchBeat(plan, now) + CLINCH_BEAT_MS(700) + REVEAL_REDUCED_HOLD_MS(200) — 확정 순간 700ms clinch, 이후 slow. 순수 함수"
  - "verdict.css 확정 두근(mf-dk-c·chip·halo)·느린 박동(mf-dk-slow·chip-slow, 1200ms)·축소 모션 밝기 깜빡임(mf-dk-flash·chip-flash)"
  - "verdictScene 이 layer·beat·진동을 조립(확정 후보 null → 자리, 확정 700ms 이내일 때만 navigator.vibrate(30) 한 번, try/catch)"
affects: [04-21 — 변론·처형이 같은 layer·훅 분기 패턴을 쓸 수 있다, 04-35 — 배포본에서 화살표 모양·두근 느낌을 사용자 실기기로 확인]

actuals:
  tokens: 10200
  tasks: 2
  commits: 4
plan_head_before: 68dfeb19fbdcfc1016ebb9e4e78d6487ffa52338
plan_head_after: caf5675e78ace2eef3b87d81e62224cba752c05a

tech-stack:
  added: []
  patterns:
    - "움직임은 두 갈래다: 끝점이 매 프레임 변하는 것(화살표)은 컴포넌트 안 rAF 한 줄기 + 서버 시각, 경계 시각마다 바뀌는 것(칩·두근·박동)은 04-19 훅의 경계 타이머. 프레임은 훅에 넣지 않는다"
    - "크기 애니메이션은 개별 속성 scale 로만 한다(좌석 래퍼의 인라인 transform 깊이 배율과 겹치지 않음)"
    - "base.css 전역 축소 모션 규칙(0.01ms·1회 !important)은 비움직임인 밝기 깜빡임 둘만 더 구체적 선택자 + !important 로 되돌리고 크기 변화 애니메이션은 아예 끈다"
    - "SVG 색은 속성 stroke=\"var(--amber-400)\" 로 준다(Chrome 에서 해석됨을 확인). jsdom 은 style 속성의 stroke 를 버릴 수 있어 시험이 속성 값을 본다"

key-files:
  created:
    - src/components/RevealLayer.tsx
    - src/net/useReducedMotion.ts
    - test/client/revealLayer.test.tsx
  modified:
    - src/components/DayTable.tsx
    - src/styles/verdict.css
    - src/screens/verdictScene.tsx
    - src/screens/DayScene.tsx
    - src/game/verdict.ts
    - src/net/useRevealState.ts
    - test/client/reveal.test.tsx

key-decisions:
  - "확정 연출의 700ms 판정은 verdict.ts 의 순수 함수 clinchBeat(plan, now) 로 두었다(수치는 verdict.ts 한 곳, D-38). 계획은 verdictScene 안에서 계산하라고 했지만 시험 가능한 한 줄이 되고 훅이 같은 상수로 경계를 잡는다"
  - "useRevealState 의 경계 목록에 `확정 + 700ms` 를 더했다(계획이 필요하면 더하라고 한 부분). 04-19 의 경계 시험 목록(BOUNDARIES)에도 같은 시각을 더했다"
  - "진동은 효과 하나: 의존성 [확정 후보, 확정 시각], 서버 시각 offset 은 ref 로 읽어 offset 갱신이 다시 울리지 않게 했다. 확정 후 700ms 이내에 처음 보는 폰(합류)은 울리고, 700ms 가 지난 뒤 합류하면 울리지 않는다(계획 문구 그대로)"
  - "P-14(느린 박동): 주기 1.2초 + 진폭 작게(캐릭터 1.04, 칩 1.1)로 구현했다. 시안 dk-slow 2.2s 는 참고만. 사용자 확인 대기 상태 유지"
  - "화살표 끝점 보간은 소수 그대로 그린다(반올림하지 않음). 두 몸이 너무 가까워 시작=끝인 경우는 arrowEndpoints 가 준 점 하나를 그대로 그린다"

requirements-completed: []  # VOTE-02 는 04-35 의 배포본 검증 뒤에 체크한다(HANDOFF·사용자 지시)

coverage:
  - id: D1
    description: "공개 구간에서 앰버 직선 화살표(삼각 머리) 하나가 투표자 캐릭터에서 대상 쪽으로 자라며 나가고, 닿으면 사라지며 칩이 오른다. 화살표는 동시에 최대 하나이고 쌓이지 않는다(D-20, D-32)"
    requirement: "VOTE-02"
    verification:
      - kind: unit
        ref: "npx vitest run --project client test/client/revealLayer.test.tsx (좌표·ease-out·페이드·0~4000ms 20ms 훑기 최대 1·중간 합류·없는 좌석)"
        status: pass
      - kind: manual_procedural
        ref: "npm run dev + 테스트 방(봇 5, 봇 투표 host) + 헤드리스 Chrome 390x844·360x640: 프레임(rAF)마다 .mf-varrow 개수·끝점·불투명도 기록, 스크린샷 3장 확인"
        status: pass
    human_judgment: true
  - id: D2
    description: "과반 확정 순간 그 후보의 캐릭터와 칩이 2회 크게 두근하고(약 0.7초) 이후 공개가 끝날 때까지 작은 느린 박동(주기 1.2초)이 이어진다. 동률·미확정이면 없다(D-31 ③, P-14)"
    requirement: "VOTE-02"
    verification:
      - kind: unit
        ref: "reveal.test.tsx(세 번째·두 번째 표 확정·동률·미확정·중간 합류·확정 중 합류, clinchBeat 순수 함수, CSS 규칙 고정)"
        status: pass
      - kind: manual_procedural
        ref: "헤드리스 Chrome 프레임 표본: 확정 순간부터 700ms 동안 좌석 scale 1→1.118→1 ×2(mf-dk-c), 칩 1→1.29→1(mf-dk-chip), 그림에 mf-dk-halo, 이후 mf-dk-slow 1.2s·칩 mf-dk-chip-slow 1.2s(scale 최대 1.04·1.1)"
        status: pass
    human_judgment: true
  - id: D3
    description: "축소 모션 설정에서는 화살표가 자라는 동작 없이 완성된 모습을 200ms 보였다가 사라지고, 두근은 크기 변화 없이 밝기 깜빡임만, 느린 박동은 없다(D-31, UI-SPEC 13.4)"
    requirement: "VOTE-02"
    verification:
      - kind: unit
        ref: "revealLayer.test.tsx(축소 모션: 0·100·199ms 완성·1, 260ms 불투명도 0.5, 320ms 없음, 최대 1)·reveal.test.tsx(CSS 축소 모션 규칙: scale 없음, slow 애니메이션 없음, 깜빡임만 !important)"
        status: pass
      - kind: manual_procedural
        ref: "헤드리스 Chrome reducedMotion=reduce 390x844: 첫 프레임부터 끝점=최종 끝점, 불투명도 1 이 약 200ms 뒤 페이드, 좌석 animation none·그림 mf-dk-flash 0.7s·칩 mf-dk-chip-flash 0.7s·slow 없음 확인(전역 0.01ms 규칙을 이긴다)"
        status: pass
    human_judgment: false
  - id: D4
    description: "지원 기기에서는 확정 순간 진동이 짧게(30ms) 한 번 난다. 실패는 무시한다. 중간 합류로 이미 지난 확정에는 울리지 않는다"
    requirement: "VOTE-02"
    verification:
      - kind: unit
        ref: "reveal.test.tsx(vibrate 호출 정확히 1회·30, 700ms 뒤 합류 0회, 동률·미확정 0회, 예외를 던져도 화면 유지, 구현 없는 환경)"
        status: pass
      - kind: manual_procedural
        ref: "헤드리스 Chrome 에 navigator.vibrate 기록기를 주입해 한 판 동안 호출 1회·30ms 확인(실제 진동 하드웨어·폰 동작은 확인하지 못함)"
        status: partial
    human_judgment: true
---

# Phase 4 Plan 20: 공개 연출 완성(화살표·확정 두근) Summary

**후보 선택 공개 위에 움직임을 얹었다: 앰버 화살표가 rAF 보간으로 자라며 나가고 닿으면 사라지며, 과반이 확정되는 순간 그 후보의 캐릭터·칩·후광이 2회 두근한 뒤 느린 박동으로 이어진다. 축소 모션·중간 합류·동률에서도 안전하다.**

## 한 일

**Task 1 — 화살표 층** — RED `b3a35c0` → GREEN `a474352`
- `useReducedMotion`(구독·해제·matchMedia 없으면 false), `DayTable` 의 `layer` 슬롯(`{places, sceneW, sceneH}`, 루트 마지막 자식, 없으면 이전과 같음) + `DayTableLayout` 타입.
- `RevealLayer`: 매 프레임 `revealStateAt(plan, serverNow())` 의 화살표 하나만 읽는다. 시작·끝은 좌석 `{x, y, scale}` → `arrowEndpoints`, 끝점만 세제곱 ease-out 으로 보간(280ms). SVG 두 겹(`night-950` 55% 9px + 앰버 5px, 둥근 끝) + 삼각 머리 marker(5×5, refX 7, id 는 `useId`), 앰버 바깥 그림자는 위 선에 건다. 화살표가 없으면 SVG 자체를 그리지 않는다. 마지막 화살표가 사라진 뒤 프레임 요청 중단, 언마운트 시 `cancelAnimationFrame`. 축소 모션이면 완성된 모습 200ms 뒤 120ms 페이드.
- `verdict.css`: `.mf-varrow`(절대 위치 inset 0, z 40, `pointer-events: none`), `.mf-varrow__line` 그림자.

**Task 2 — 확정 두근·박동·진동** — RED `7d2e45c` → GREEN `caf5675`
- `verdict.ts`: `CLINCH_BEAT_MS`(700)·`clinchBeat(plan, now)`·`REVEAL_REDUCED_HOLD_MS`(200). `useRevealState` 경계에 `확정 + 700ms` 추가.
- `DayTable`: 좌석 `beat` → `mf-dt__seat--clinch/--slow`, 칩 `slow` → `mf-vchip--slow`.
- `verdict.css`: `mf-dk-c`(좌석 scale 1→1.12→1 ×2, 700ms)·`mf-dk-chip`(1→1.3→1 ×2)·`mf-dk-halo`(3px/18px, 후광 그림 한정, 끊긴 사람 그림 제외)·`mf-dk-slow`(1.04)·`mf-dk-chip-slow`(1.1, 1200ms 무한), 축소 모션 분기(밝기 깜빡임 `mf-dk-flash`·`mf-dk-chip-flash` 만 !important 로 되돌리고 크기 애니메이션은 끔).
- `verdictScene`: `layer`(RevealLayer), 좌석 `beat`·칩 tone(`beat` → `lead`)/slow, 확정 진동 효과. `DayScene` 은 `verdict.layer` 를 `DayTable` 로 잇는 한 줄.

## 검증

- `npm test`: 93 파일 2405 통과(04-19 직후 2362 → 새 시험 43개). `npm run typecheck`(토큰 검사 + wrangler types + 두 tsc): 종료 코드 0. 범위 tsc(`tsc-scoped`): 통과.
- 수용 기준: `requestAnimationFrame` RevealLayer.tsx 2·`setInterval` 0, `layer` DayTable.tsx 4, `mf-dk-` verdict.css 15, `prefers-reduced-motion` verdict.css 3, `vibrate` verdictScene.tsx 1.
- 새 시험: `revealLayer.test.tsx`(화살표 좌표·세제곱 ease-out·페이드·0~4000ms 20ms 훑기 동시 최대 1·단계별 좌표·중간 합류·없는 좌석 T-04-56·0표·축소 모션·언마운트 취소와 종료 뒤 요청 없음 T-04-55·marker id 유일·layer 슬롯·훅·CSS 규칙), `reveal.test.tsx`(clinchBeat·화살표 연결·확정 5가지·진동 5가지·CSS 규칙).

### 브라우저에서 실제로 그려지는지 (정직한 보고)

**확인했다.** `vite dev`(내가 띄운 npm PID 44270·vite PID 44292·workerd PID 44353 만 종료함)와 스크래치패드의 일회용 스크립트 `verify-arrow20.mjs`(`verify-reveal.mjs` 를 고쳐 만듦, 저장소에 넣지 않음)로, 테스트 방(봇 5 + 방장, 봇 투표 `pick: host`)을 만들고 헤드리스 Chrome 방장으로 후보 선택 → 공개까지 갔다. 페이지 안에서 `requestAnimationFrame` 마다 화면을 읽었다.
1. **화살표(390×844, 일반 모션)**: 프레임 255개 중 화살표가 보인 122개, 동시 최대 1. 끝점이 시작점(예: 288.2, 143.2)에서 최종 끝점(200.2, 242.5)으로 급하게 시작해 감속하며(ease-out) 자라고 `op 1` 로 닿은 뒤 120ms 동안 불투명도 0.72 → 0.04 로 사라진 뒤 DOM 에서 빠졌다. 다음 단계마다 새 화살표(`data-step` 1·2·…). 계산된 선 색 `rgb(242, 184, 75)`(= `--amber-400`, 속성 `stroke="var(--amber-400)"` 가 Chrome 에서 해석됨), `pointer-events: none`, `z-index: 40`. 스크린샷 3장을 눈으로 읽었다: 몸 중심에서 시작해 대상 머리 쪽으로 가는 앰버 선 + 삼각 머리 + 어두운 아랫선 + 바깥 앰버 그림자, 칩·이름표 위. 360×640 도 같은 전개(최대 동시 1, 콘솔 오류 0).
2. **확정 두근(390×844)**: 방장이 4번째 표에서 확정(칩 `4`, tone `beat`). 확정 순간부터 좌석 `mf-dt__seat--clinch`(animation `mf-dk-c` 0.7s)에서 계산된 `scale` 이 1 → 1.118 → 1 → … 로 두 번 오르내렸고(최대 약 1.118), 칩 `mf-dk-chip` scale 최대 약 1.29, 후광 그림에 `mf-dk-halo 0.7s`. 정확히 700ms 뒤 좌석 `mf-dt__seat--slow`(`mf-dk-slow` 1.2s, scale 최대 1.04)·칩 `lead + slow`(`mf-dk-chip-slow` 1.2s, 최대 1.10)로 넘어가 공개가 끝날 때까지 이어졌다. 다른 자리에는 두근·박동 클래스가 없었다.
3. **축소 모션(390×844, `reducedMotion: reduce`)**: 화살표는 첫 프레임부터 끝점이 최종 끝점과 같았고(자라지 않음) 약 200ms 보인 뒤 페이드. 좌석 `animation: none`, 그림에 `mf-dk-flash 0.7s`(전역 0.01ms 규칙을 이겨 700ms 로 유지), 칩에 `mf-dk-chip-flash 0.7s`, 두근 중 scale 변화 없음, slow 단계는 애니메이션 없음.
4. **진동**: 진동 기록기(`navigator.vibrate` 를 덮어 호출을 기록)를 넣고 한 판 동안 정확히 1회, 30ms. 세 번 돌린 판 모두 콘솔 오류 0.

**확인하지 못한 것(사용자 실기기·배포 뒤):** 실제 폰의 진동 하드웨어와 iOS(`navigator.vibrate` 미지원)에서의 동작, 실제 폰에서 화살표·두근이 부드럽게 보이는지(헤드리스 프레임은 스크린샷 촬영 때문에 간격이 불규칙했다), 두 폰이 같은 순간에 같은 모양을 보는지(서버 시각 offset 은 단위 시험으로만), 동률·미확정·탈락 viewer·관전자 화면의 실제 모양, 화살표 길이가 매우 짧은 경우(두 몸이 가까운 자리쌍)의 점 모양, 뒤쪽 자리 칩 위치와 화살표가 겹치는 보기, 배포본. 모두 04-35 이후 사용자 확인 목록이다.

## 관찰·남은 확인

- **확정 두근 안에서 다음 표가 같은 후보에게 닿으면 칩 두근이 처음부터 다시 돈다.** 칩 key 에 득표 수가 들어가(04-19 의 팝 재시작 설계) 숫자가 오르면 새 노드가 되는데, 확정 700ms 구간 안에 같은 후보에게 표가 더 닿으면(5표 중 4번째 확정 직후 5번째 표) 칩 두근이 다시 시작되고, 구간이 끝나는 순간 느린 박동으로 바로 전환된다(프레임 표본에서 관찰). 캐릭터 두근은 700ms 고정이다. UI-SPEC 은 이 경우를 말하지 않아 그대로 두었다 — 어색하면 확정 구간 동안 칩 key 에서 득표 수를 빼면 된다(한 줄).
- **프레임 간격**: 화살표가 사라지는 끝(fadeEnd)이 지나도 다음 rAF 프레임(약 16ms) 전까지는 마지막 화살표가 보일 수 있다(시험도 이 간격을 반영).
- **04-19 열린 항목(변경 없음)**: 첫 표가 닿는 순간 그 자리가 1표짜리 선두가 되어 큰 칩(lead) + 앰버 후광이 되는 규칙은 UI-SPEC 그대로 유지했고, 이번 브라우저 표본에서도 같은 모습이다. 사용자 확인 대기.
- **P-14**: 느린 박동 주기 1.2초·진폭(캐릭터 1.04, 칩 1.1)은 CONTEXT 값으로 구현, 시안 2.2초는 참고만. 사용자 확인 대기.

## Deviations from Plan

### 자동 수정

없음 — 계획대로 진행했다. 아래는 계획 문구와 다르게 한 점이다.

### 계획과 다르게 한 것

- `files_modified` 에 없던 `src/game/verdict.ts`(`CLINCH_BEAT_MS`·`clinchBeat`·`REVEAL_REDUCED_HOLD_MS`)와 `src/net/useRevealState.ts`(경계에 확정 + 700ms)를 고쳤다. 계획이 "필요하면 훅의 경계 목록에 `확정 + 700ms` 를 더한다" 고 했고, 700ms 판정과 축소 모션 유지 시간 수치를 verdict.ts 한 곳에 두려는 D-38 에 따랐다. 04-19 의 `BOUNDARIES` 시험 목록에 같은 시각을 더했다(기존 단언은 그대로).
- 계획은 선 색을 `style` 로 암시했으나 `stroke`·`fill` 속성에 `var(--…)` 를 주었다(jsdom 이 style 의 `stroke` 를 버려 시험이 어렵고, Chrome 에서 해석됨을 확인).
- 그림자 필터는 `.mf-varrow` 전체가 아니라 위(앰버) 선 `.mf-varrow__line` 에만 걸었다(시안 RA2 와 같은 구조 — 아랫선까지 앰버로 빛나지 않게).

## Known Stubs

없음. (defense·execution·ended 화면은 04-21~04-22 범위라 공개 4초 뒤 여전히 `연결 중…` 이다 — 배포 금지 상태 유지, 배포는 04-35 에서만.)

## Threat Flags

없음. 새 네트워크 경로·권한 경로·스키마 변경이 없다. T-04-55(프레임 반복 누수)는 rAF 한 줄기·종료 뒤 중단·언마운트 취소와 이후 요청 수 불변·타이머 수 0 시험으로, T-04-56(없는 좌석 이상 입력)은 건너뛰고 다음 단계는 그리는 시험으로 완화를 확인했다. 진동은 구현 재량으로 켜되 예외를 무시한다.

## Self-Check: PASSED

- 파일: `src/components/RevealLayer.tsx`, `src/net/useReducedMotion.ts`, `test/client/revealLayer.test.tsx` 존재.
- 커밋: `b3a35c0`, `a474352`, `7d2e45c`, `caf5675` 모두 HEAD 의 조상.

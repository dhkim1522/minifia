---
phase: 05-atmosphere-character
plan: 06
subsystem: e2e-browser-wiring
tags: [e2e, browser, UX-01, UX-02, LOOK-01, testtools, tdd]
status: complete

requires:
  - phase: 05-atmosphere-character
    provides: "05-05 의 순수 검사(guideChecks·docHeightChecks·joinFitChecks·vignetteChecks·glowChecks)와 5페이즈 계약, 05-01 [data-guide], 05-03 비네팅·밝아짐 층, 05-04 압축·링크 참가 압축"
provides:
  - "scripts/e2e/browser.mjs: readGuide·readAtmosphere·readJoinFit·openGuestJoinPage"
  - "scripts/e2e/flows.mjs: guideState(UX1·UX2)·atmosphereState(AT1·AT2)·joinLinkProbe(UX2-J) 배선, ctx.roomCode"
  - "src/game/dayTable.ts testButtonCompact + TestToolsButton data-compact: 짧은 장면(< 299)에서 [테스트] 버튼 폭 88 -> 44"
affects: [05-07, 05-08, 05-09]

actuals:
  tokens: 4900
  tasks: 3
  commits: 5
plan_head_before: 97ad9d212d368d337aa11bf037534714561e68a7
plan_head_after: eaf2cd802b467ab7e8289a52f1145c8ee778b692

tech-stack:
  added: []
  patterns:
    - "pointer-events: none 인 층·이름표의 칠 순서는 한 evaluate 안에서 잠시 auto 로 바꿔 elementFromPoint 로 찍고 되돌린다"
    - "짧은 장면 규칙은 순수 함수(testButtonCompact)와 한 컴포넌트의 ResizeObserver 로만 건다 — 장면 상자에 container-type 을 주지 않는다(쌓임 맥락 변화 방지)"

key-files:
  created:
    - test/client/testToolsCompact.test.tsx
  modified:
    - scripts/e2e/browser.mjs
    - scripts/e2e/flows.mjs
    - src/game/dayTable.ts
    - src/components/TestTools.tsx
    - src/styles/testtools.css
    - test/unit/dayTable.test.ts

key-decisions:
  - "360x560 의 D4([테스트] 버튼이 2번 자리 상자와 세로 35.9px 겹침)는 dayTable 압축으로는 풀 수 없었다(자리 2 의 위를 33px 내리면 맨 앞 이름표가 넘친다). 사용자 결정(a): 위치는 그대로 두고 장면 높이 299 미만에서만 버튼을 44 폭으로 좁힌다. D4 허용 3px 는 그대로."
  - "AT2 실패는 측정 결함이었다: .mf-dt__tag 가 평소 pointer-events: none 이라 프로브가 이름표를 건너뛰었다. CSS 쌓임은 정상이라 atmosphere.css 는 건드리지 않았다."

requirements-completed: []

completed: 2026-10-29
---

# Phase 5 Plan 06: E2E 브라우저 읽기·배선 Summary

**05-05 의 순수 검사를 실제 Chrome 좌표로 읽는 도우미 네 개(`readGuide`·`readAtmosphere`·`readJoinFit`·`openGuestJoinPage`)를 만들고 기존 흐름에 UX1·UX2·UX2-J·AT1·AT2 를 배선했다. 로컬 dev 서버에서 lobby·police5·result-c 가 기본 네 크기(360x560 probe 포함) 모두 `E2E OK` 이고, 360x560 에서만 남았던 [테스트] 버튼 D4 는 짧은 장면에서 버튼을 좁혀 풀었다.**

## 수행한 일

배포하지 않았다. 로컬 `npm run dev` 만 썼다(실행 뒤 껐다). 서버·와이어·새 의존성 없음.

### Task 1 — 브라우저 읽기 도우미 (`b8915a6`)

- `readGuide`: `[data-guide]` 목록(글자 공백 정리·헤더 안내줄 여부·높이·줄 높이, `normal` 이면 글자 크기 × 1.4)·`[role="timer"]` 수·문서 높이를 한 번의 evaluate 로 읽는다.
- `readAtmosphere(page, { mySeat })`: 비네팅·밝아짐 층별 `pointer-events`·`background-image`·사각형, 장면 상자 위·아래, 칠 순서(`tapHitsTable`·`tagHit`).
- `readJoinFit`: 앉은 사람 수·문서 높이·`참가하기` 아래끝. `openGuestJoinPage`: 세션 init 없이 같은 뷰포트·모바일 설정·대상 밖 요청 차단으로 새 컨텍스트를 열고 `/r/{code}` 로 간다(참가하지 않음, 토큰 없음).

### Task 2 — 흐름 배선 (`f1dc81e`)

- `guideState`(UX1·UX2): `stageChecks` 끝(기존 호출 전부), 배정 3곳(`onAssigningOf` 콜백), `gameFlow` 역할 확인, `dayIntro` 낮 시작, `resultState` 결과. 읽는 동안 단계가 바뀌면 기록하지 않고 넘어간다(낮 시작만 기존 규칙대로 `SetupError`).
- `atmosphereState`(AT1·AT2): 토론 0/0, 밤 비네팅 1·밝아짐 0, 아침 비네팅 0·밝아짐 1, 결과 0/0. 읽는 동안 단계가 바뀌면 `SetupError`.
- `joinLinkProbe`(UX2-J): 대기실 흐름 끝, 높이 ≥ 640 일 때만. 방장 + 봇 6명(앉은 사람 7)에서 손님 컨텍스트로 읽고 `finally` 에서 닫는다. `startHost` 가 `ctx.roomCode` 를 남긴다(방 코드만, 토큰 아님).

### Task 3 — 로컬 실행과 짧은 화면 결함 (`5cbed21`, `5b0cb59`, `eaf2cd8`)

1. 첫 실행: lobby `E2E OK`. police5 는 AT2 가 세 폭에서 실패했고, police5·result-c 의 360x560 은 D4 가 실패했다.
2. **AT2 (`5cbed21`)**: 이름표가 평소 `pointer-events: none` 이라 프로브가 이름표를 건너뛰고 밝아짐 층을 돌려받은 측정 결함이었다. 이름표도 같이 잠시 `auto` 로 두도록 고쳐 통과. CSS 쌓임(z-index -1)은 정상이었다.
3. **D4 (사용자 결정 (a), RED `5b0cb59` → GREEN `eaf2cd8`)**: 아래 "계획과 다르게 한 것" 참고.

## 로컬 E2E 결과 (수정 후, `--url http://localhost:5173`, 흐름 × 크기 통과/전체)

| 흐름 | 360x640 | 390x664 | 430x932 | 360x560 | 걸린 시간 |
|------|---------|---------|---------|---------|-----------|
| lobby | 26/26 | 26/26 | 26/26 | 25/25 | 18초 |
| police5 | 143/143 | 143/143 | 143/143 | 143/143 | 70초 |
| result-c | 42/42 | 42/42 | 42/42 | 42/42 | 38초 |

세 흐름 모두 마지막 줄 `E2E OK`, 실패 표 비어 있음. 로컬 dev 는 CSS 를 압축하지 않으므로 CSS 에 기대는 검사의 최종 판정은 05-09 배포본 실행이 한다.

`UX2-J`(앉은 사람 7, 별도 측정): 360x640 문서 높이 640·`참가하기` 아래끝 532, 390x664 문서 높이 664·556, 430x932 문서 높이 932·824(문서 높이는 화면 높이와 같아 스크롤 없음). 05-04 의 `.mf-join__seated--many` 값 조정은 필요 없었다. 360x560 은 계획대로 판정하지 않는다.

`--shots` 로 한 번 더 돌려 360x560 대기실(왼쪽 위에 아이콘만 남은 점선 버튼, 방 코드·이름표·하단 패널 정상)과 360x640 링크 참가(7명, 입력·`참가하기`·보조 링크가 한 화면)를 열어 보았다. 링크 참가의 이름 알약이 말줄임(`화면검…`)되고 `7 / 8명이 모였어요` 줄이 아랫줄 인물 발·시계 그림과 가깝게 붙어 보이는 것은 05-04 의 디자인 값이라 이 계획에서 고치지 않았다(사진은 커밋하지 않음, `scripts/e2e/out` 비어 있음).

## 시험 결과

| 검사 | 결과 |
|------|------|
| `node --test scripts/e2e/lib.test.mjs` | 168건 통과 |
| `npm test` | 109 파일, 2957건 통과 (HANDOFF 6KB 시험 포함, HANDOFF 4,984바이트) |
| `npm run typecheck` | 종료 코드 0 |
| 새 시험 | `test/unit/dayTable.test.ts` testButtonCompact 3건, `test/client/testToolsCompact.test.tsx` 10건 |

## 계획과 다르게 한 것

1. **[Rule 1 - 측정 결함] AT2 프로브**: 위 Task 3 의 2.
2. **[사용자 결정 (a)] [테스트] 버튼 좁힘 — 계획의 `files_modified` 밖 편차.** 360x560 에서 [테스트] 버튼(x 4~91.7, y 127.2~171.2)이 2번 자리 캐릭터 상자(x 75.5~130.5, y 135.3~208.5)와 가로 16.2·세로 35.9px 겹쳐 D4(허용 세로 3px)가 실패했다(장면 높이 283.8). 계획이 허용한 `dayTable.ts` H<299 분기 수정으로는 풀 수 없었다: 버튼 아래끝 171.2 에서 3px 를 뺀 168 아래로 자리 2 의 위를 내리려면 약 33px 를 더 내려야 하고 그러면 맨 앞 이름표가 장면 아래로 넘친다. 사용자 결정에 따라 버튼 위치(왼쪽 위)는 두고 장면 높이 299 미만에서만 폭을 88 → 44 로 좁혔다(오른쪽 끝 48 < 75.5).
   - `src/game/dayTable.ts`: `testButtonCompact(sceneH)`(299 미만의 양수에서만 참, 0·음수·NaN·Infinity 는 거짓).
   - `src/components/TestTools.tsx`: 버튼이 가장 가까운 장면 상자(`.mf-dayscene__scene`·`.mf-lobby__scene`)의 높이를 마운트 직후 동기로 재고 `ResizeObserver` 로 따라가며 `data-compact` 를 붙인다. 글자는 `.mf-tt__label` span 에 남아 접근 이름 `테스트` 가 유지된다. 장면 밖(역할 확인 위쪽 바)에서는 늘 거짓이다.
   - `src/styles/testtools.css`: `.mf-tt[data-compact]` 폭 `var(--tap-min)`·패딩 0, 라벨은 시각적으로만 숨김. 긴 화면(≥299)은 이 규칙이 닿지 않아 지금과 같다.
   - 장면 상자에 `container-type` 을 주는 CSS 전용 방법은 쓰지 않았다(layout containment 가 쌓임 맥락을 바꿔 아침 밝아짐 z-index -1 등에 영향을 줄 수 있음).
   - D4 허용 3px·E2E 기준 수치·`APPROVED_RELAXATIONS` 는 바꾸지 않았다.
3. **인수 기준 grep 개수 편차**: `vignetteChecks`·`glowChecks` 가 `flows.mjs` 에서 각각 2줄(import 한 줄 + 호출 한 줄)이라 계획의 "3 이상" 에 못 미친다. 호출을 `atmosphereState` 헬퍼 한 곳에 모았기 때문이고, 실제 배선은 토론·밤·아침·결과 네 곳이다. 나머지 기준(`guideChecks|docHeightChecks` 4, `joinFitChecks` 2, `JOIN_FIT_MIN_H` 3, `async function guideState` 1, `elementFromPoint` 7줄, 새 도우미 export 4)은 충족.
4. 사용자 결정 이후의 `npm test` 전체 통과를 확인했다(계획은 단위 두 파일만 요구).

## 남은 일

없음. 이 계획이 계획 단계에서 넘길 수 있다고 했던 "장면 높이와 무관한 고정 배치 실패"는 위 D4 가 사용자 결정으로 해소되어 남지 않았다.

## 남은 알림

- 모든 변경 후 최종 확인은 05-09 배포본 실행이다(로컬 dev 는 CSS 압축이 없다). `testtools.css` 를 바꾸었으니 배포본에서도 `.mf-tt[data-compact]` 가 살아남는지(minify 후)를 E2E 360x560 이 확인한다.
- 요구사항 UX-01·UX-02·LOOK-01 은 이 계획에서 완료 표시하지 않는다(전체 흐름·배포본 판정은 05-08·05-09).
- 새 흐름(PC·Wake Lock)은 05-07 몫이다.

## 인증 게이트

없음.

## 알려진 스텁

없음.

## 위협 표면 점검

새 엔드포인트·인증 경로·스키마 변경 없음. T-05-13: `ctx.roomCode` 만 남기고 토큰은 기존 `ctx.secrets` + `redact` 경로로만 다룬다(손님 컨텍스트는 토큰을 다루지 않음). T-05-14: 손님은 `참가하기` 를 누르지 않고 읽은 뒤 `finally` 에서 컨텍스트를 닫는다. T-05-SC: 새 패키지 없음.

## Self-Check: PASSED

- 만든 파일 `test/client/testToolsCompact.test.tsx`, 수정한 `scripts/e2e/browser.mjs`·`scripts/e2e/flows.mjs`·`src/game/dayTable.ts`·`src/components/TestTools.tsx`·`src/styles/testtools.css`·`test/unit/dayTable.test.ts` 존재 확인.
- 커밋 `b8915a6`·`f1dc81e`·`5cbed21`·`5b0cb59`·`eaf2cd8` 이 HEAD 의 조상임을 확인.
- `commits: 5` 는 `git rev-list --count 97ad9d2..HEAD` 로 쟀다(이 SUMMARY 의 docs 커밋 전). `actuals.tokens` 는 변경 diff 추가 줄 19.6k 자 / 4.

---
phase: quick-261025-unr
plan: 01
status: incomplete
subsystem: screens-day-table
tags: [day-table, halo, speech-bubble, host-crown, bot-names, decision-0030]
requirements: [QUICK-261025-unr]
completed_tasks: [1, 2]
remaining_tasks: [3, 4, 5, 6]
commits: 6
plan_head_before: 97ce65598ce58ba8c5e54a38aa44753826efe5e6
plan_head_after: b8a6b0efc990fe1005d069b8e06e2c09dfd67eeb
---

# 퀵 261025-unr 진행 체크포인트 (패스 A: 과제 1 완료 · 패스 B: 과제 2 완료)

> 상태: **미완료** (과제 6개 중 2개 완료). 이 파일은 패스마다 갱신하고 마지막 패스(E)에서 최종본으로 바꾼다.

## 완료한 과제

| 과제 | 내용 | 커밋 |
|------|------|------|
| 1-가 | 5글자 봇 이름 7개 커밋 (`shared/game/bots.ts`, `scripts/bots.mjs`, `scripts/uat-test-bots.mjs`, `test/unit/bots.test.ts`) | `9a00474` |
| 1-나 | RED: 후광·말풍선·왕관 기준 테스트 (실패 61개를 확인하고 커밋) | `1bd0ef5` |
| 1-다 | GREEN: 발밑 원·이름표 반전·머리 위 배지 제거, 후광, `…` 말풍선, 왕관은 `hostCrown`(대기실)만 | `f8a8ca8` |
| 2-가 | RED: E2E K1·K4 개정, W1 신설 단위 테스트 (모듈 가져오기 실패로 실패 확인) | `341a50f` |
| 2-나 | GREEN: `lib.mjs` `haloChecks`·`crownChecks`·`turnChecks`, `browser.mjs` 측정(`turn`·`halo`·`crowns`), `flows.mjs` 선택 후광·W1 + 부분 로컬 E2E | `b8a6b0e` |

## 남은 과제

| 과제 | 패스 | 비고 |
|------|------|------|
| 3 | B | 배경 장면·WebP·Backdrop |
| 4 | C | Day 화면 제거·SceneIntro·크로스페이드 |
| 5 | D | E2E H1·B1·N8·N9 + 오프라인 대비 |
| 6 | E | 문서·전체 검증·배포·push |

## 이번 패스의 구현 요약

- `src/game/dayTable.ts`: `HALO_CORE_BLUR_PX` 2, `HALO_BLUR_PX` 9, `HALO_MAX_SIMULTANEOUS` 3, `BUBBLE_W` 48, `BUBBLE_H` 26, `BUBBLE_TAIL` 5, `BUBBLE_TOP` 26 (좌표·z 규칙은 불변).
- `src/components/DayTable.tsx`: 후광 클래스는 그림 `img` 에만 붙는다 — 흰(`s.turn || s.pick?.mine`) > 진홍(`s.isAlly`). 차례·빠른 메시지 자리는 `span.mf-dt__bubble--turn|--spoke`(aria-hidden, 점 셋), 이모티콘이 있으면 말풍선 없음. 왕관은 `hostCrown && isHost`. `Lobby` 만 `hostCrown` 을 준다.
- `src/styles/daytable.css`: 후광 값은 `.mf-dt` 사용자 지정 속성 두 개(`--mf-halo-white`·`--mf-halo-crimson`)에 한 번만 적고, 끊김과 함께면 `grayscale(1)` 뒤에 후광. 말풍선·점 깜박임(1200ms, 0/200/400ms 지연), 축소 모션에서 `animation: none` + 정지 불투명도 1/.6/.3. 옛 링·선택 링·배지·이름표 반전 규칙 삭제.
- 계획의 확인 필요 기본값을 그대로 따랐다: 말풍선 위 −26px, 왕관은 대기실만(역할 배정에서도 없앰), 빠른 메시지 보낸 사람은 말풍선만(후광 없음).

## 패스 B 과제 2 결과 (E2E K1·K4·W1, 부분 로컬 E2E)

- 부분 로컬 E2E (dev 서버 5173, 세 크기 360x640·390x664·430x932): `mafia8` 110/110 · `citizen4` 105/105 · `lobby` 21/21, 모두 `E2E OK`. 5글자 이름표 8명판(방장 `화면검사기` + 봇 7명)에서 D2·G2(폰 가장자리 −0.5 칼날)·D3a·D3b(바닥 55%)·D9·D4·T1·T2 도 모두 통과 — 임계값은 하나도 낮추지 않았다.
- 첫 실행에서 `claim-other` K4 만 세 크기 모두 실패: 차례가 막 바뀐 순간의 후광 `filter` 계산값이 180ms 전환 중간값(`0.74px` 등)이었다. 앱 결함이 아니라 측정 시점 오류라서 `browser.mjs` 가 후광 요소의 진행 중인 CSS 전환만 끝내고(`CSSTransition.finish()`) 끝 상태를 읽게 고쳤다. 판정 기준(두 겹 drop-shadow, 9px, 3개 이하, 발밑 원 0)은 그대로.
- 단위 테스트: `node --test scripts/e2e/lib.test.mjs` 88 통과 (이전 86), `npm run typecheck` 통과. 옛 선택자 grep(`lib.mjs`·`flows.mjs`) 0건.
- 불변: `OVERLAP_EPS`·`ONE_LINE_FACTOR`·`FACE_RATIO`·`TAP_MIN`·`PANEL_H`·`TEXT_SIZE_ALLOW`·`DECORATIVE_ALLOW`·`TAP_ALLOW` 줄은 `97ce655` 대비 diff 0.

## 측정 숫자 (계획 값과 일치)

- 말풍선 위 −26: 4~8명 × 네 장면 폭에서 이웃 얼굴(상자 위 45%) 최대 겹침 0.20px (≤ 0.5), 자기보다 z 높은 이웃 상자에 가려지는 경우 0, 말풍선 x 범위 15.4~350.6(폭 366), 장면 높이 387.8 에서 맨 위 12.4.
- 시안 −30: 8명판 이웃 얼굴 4.08px 겹침 (계획의 4.1px 와 같음) — 그래서 −26.
- 후광 알파: 윤곽 4px ≤ 0.15, 9px ≤ 0.02. night-900 면에 겹쳐도 gray-50 글자 대비 ≥ 9:1.
- 번짐 9px × 배율을 더한 캐릭터 상자: 네 폰 폭 × 1~8명 모두 폰 가장자리 안, 장면 높이 387.8 에서 위쪽 ≥ 0, 299.8 에서도 ≥ −16.

## 검증 (패스 A 끝, HEAD `f8a8ca8`)

- `npx vitest run`: 76 파일 / 1794 테스트 통과 (이전 1770).
- `npm run typecheck` 통과, `node --test scripts/e2e/lib.test.mjs` 86 통과.
- `! grep -rnE "mf-dt__(spot|ring|sel|turn)|tag--(turn|spoke)" src` 통과.
- `git diff --name-only 97ce655 -- shared worker` = `shared/game/bots.ts` 한 줄뿐.
- 새 테스트 파일 없음 (대소문자만 다른 이름 중복 없음). E2E 임계값·허용 목록 파일(`scripts/e2e/lib.mjs`)은 건드리지 않았다.
- 라이브 E2E·배포는 이 패스에서 하지 않았다 (개발 서버를 띄우지 않았다).

## 계획과 다른 점

없음 — 계획대로 실행했다.

## 알려진 스텁

없음.

## 다음 패스(B) 인계

- 시작 때 `git status --short` 와 직전 커밋(`f8a8ca8`)을 확인한다. `.planning/milestone.lock` 은 추적하지 않는다.
- 커밋 원장: `.git/gsd-plan-head-before-quick-261025-unr-01` (= `97ce655`). 최종 SUMMARY 의 `commits` 는 이 원장에서 측정한다.
- 과제 2 에서 옛 선택자를 읽는 E2E 코드 위치: `scripts/e2e/lib.mjs` 약 529·557행(K1 차례 링 묶음), `scripts/e2e/browser.mjs` 약 337·463~487행, `scripts/e2e/flows.mjs` 약 263·312행(`.mf-dt__sel`). 새 계약은 후광 `img.mf-figure--halo-white|--halo-crimson`, 말풍선 `.mf-dt__bubble--turn|--spoke`, 왕관 `[aria-label="방장"]`(대기실만).
- 실기기 확인 목록 후보 (과제 6 에서 HANDOFF 로): 후광 모양, 말풍선 깜박임·위치, 8명판 5글자 이름표 칼날 경계(봇·방장 이름이 모두 5글자).

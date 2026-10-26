---
phase: quick-261025-unr
plan: 01
status: incomplete
subsystem: screens-day-table
tags: [day-table, halo, speech-bubble, host-crown, bot-names, decision-0030]
requirements: [QUICK-261025-unr]
completed_tasks: [1, 2, 3, 4, 5]
remaining_tasks: [6]
commits: 15
plan_head_before: 97ce65598ce58ba8c5e54a38aa44753826efe5e6
plan_head_after: 931b2fff1926dc952f2691702321f20d2a1bfbe3
---

# 퀵 261025-unr 진행 체크포인트 (패스 A: 과제 1 · 패스 B: 과제 2·3 · 패스 C: 과제 4 · 패스 D: 과제 5 완료)

> 상태: **미완료** (과제 6개 중 5개 완료). 패스 C 의 열린 문제(5명판 D3b)는 사용자 승인 완화(2026-10-26)로 닫혔다 — 아래 「패스 D」. 이 파일은 패스마다 갱신하고 마지막 패스(E)에서 최종본으로 바꾼다.

## 완료한 과제

| 과제 | 내용 | 커밋 |
|------|------|------|
| 1-가 | 5글자 봇 이름 7개 커밋 (`shared/game/bots.ts`, `scripts/bots.mjs`, `scripts/uat-test-bots.mjs`, `test/unit/bots.test.ts`) | `9a00474` |
| 1-나 | RED: 후광·말풍선·왕관 기준 테스트 (실패 61개를 확인하고 커밋) | `1bd0ef5` |
| 1-다 | GREEN: 발밑 원·이름표 반전·머리 위 배지 제거, 후광, `…` 말풍선, 왕관은 `hostCrown`(대기실)만 | `f8a8ca8` |
| 2-가 | RED: E2E K1·K4 개정, W1 신설 단위 테스트 (모듈 가져오기 실패로 실패 확인) | `341a50f` |
| 2-나 | GREEN: `lib.mjs` `haloChecks`·`crownChecks`·`turnChecks`, `browser.mjs` 측정(`turn`·`halo`·`crowns`), `flows.mjs` 선택 후광·W1 + 부분 로컬 E2E | `b8a6b0e` |
| 3-나 | RED: 장면 목록·WebP 예산·Backdrop 층 규칙·URL 개정 테스트 (모듈 없음·SVG 로 실패 확인, 7개 실패 + 3파일 로드 실패) | `f430930` |
| 3-다 | GREEN: `scenes.ts`, `make-backdrops.mjs`+WebP 7개, 옛 SVG 8개 제거, `assets.ts`, 크로스페이드 `Backdrop`, `ds.css`, 호출처, smoke WebP 검사 | `3043681` |
| 4-가 | RED: `sceneIntro.test.tsx`(옛 nightIntro 를 `git mv` 후 확장)·`phaseArrival.test.tsx`·`scenes.test.ts` PHASE_INTRO·낮 시작 단언 이전·E2E `sceneIntroChecks` (실패 30개 + 모듈 없음 1파일을 확인하고 커밋) | `e296fe0` |
| 4-나 | GREEN: `Day.tsx`·`NightIntro.tsx` 삭제, `SceneIntro`·`PHASE_INTRO`·`SCENE_INTRO_MS`, `usePhaseArrival`, `DayScene`(arrivedFrom·instant·fromScene), `RoomScreen`, CSS 정리, E2E 이름 맞춤 | `618f57d` |
| 5-가 | RED: E2E H1·B1·N8 단위 테스트, `D3B_FLOOR_5_PLAYERS` 98.0 고정, `APPROVED_RELAXATIONS`, `EXPECTED_SCENE` = `PHASE_SCENE`, 오프라인 `backdropContrast.test.ts` (모듈 가져오기 실패 + 28 테스트 실패를 확인하고 커밋) | `8c7eaed` |
| 5-나 | GREEN: `lib.mjs`(H1·B1·N8·D3B 상수·승인 목록), `browser.mjs`(`readHeaderContrast`·`readBackdropLayers`·`waitBackdropStable`·`armIntroWatch`/`readIntroWatch`), `flows.mjs`(`stageChecks`·`dayIntro`), `run.mjs` 승인 목록 출력, UI-SPEC F7 승인 기록 | `931b2ff` |

## 남은 과제

| 과제 | 패스 | 비고 |
|------|------|------|
| 6 | E | 문서(결정 0030·UI-SPEC·HANDOFF)·전체 검증·배포·push |

## 패스 D 과제 5 결과 (E2E H1·B1·N8·N9, 오프라인 대비, 5명판 D3b 승인 완화)

### 사용자 결정 (계획 이후, 2026-10-26 승인) — 새 승인 완화 1건

- **D3b 5명판 바닥만 99.9% → 98.0%.** 사유: 앞쪽 옆자리가 탈락해 유령 그림이 되면 그 머리 윗부분이 뒤쪽 이웃의 5글자 이름표를 약 0.4% 덮는다(패스 C 열린 문제). 사용자가 캐릭터가 이름표를 덮는 것은 이미 허용했다(UI-SPEC F2).
- 구현: `scripts/e2e/lib.mjs` 의 이름 있는 상수 `D3B_FLOOR_5_PLAYERS = 0.98`(머리 주석에 승인 날짜·사유), `visibilityFloor` 가 `n === 5` 에서만 쓴다. 4명 100%(0.999)·6명 85%·7명 50%·8명 55% 와 `OVERLAP_EPS`·`ONE_LINE_FACTOR`·`FACE_RATIO`·`TAP_MIN`·`PANEL_H`·허용 목록은 `97ce655` 대비 diff 0.
- 단위 테스트가 고정한다: 5명 0.98 통과·0.979 실패, 다른 인원 바닥 경계값(4명 0.999/0.998, 6명 0.85/0.849, 7명 0.5/0.499, 8명 0.55/0.549), `APPROVED_RELAXATIONS` = [M1, D3a/D3b, D4, D3b-5] 이고 `D3b-5` 의 승인일이 2026-10-26.
- 승인된 완화 목록을 적은 곳(이 패스가 건드린 문서 줄): `lib.mjs` 의 `APPROVED_RELAXATIONS`(실행 때 출력 머리에도 찍힘, `run.mjs`), UI-SPEC F7 행. **과제 6 이 결정 0030 본문과 0028/0025 의 「승인 완화는 M1·D3·D4」 문장 옆에도 같은 내용을 적는다.**

### 새 E2E 규칙

| 규칙 | 내용 | 기준 |
|------|------|------|
| H1 | 헤더 제목(`.mf-phasebar h1`·`.mf-assign__bar h1`·`.mf-lobby__code`)과 타이머 숫자(`.mf-timer__num`)의 글씨 대비 | 글씨를 투명하게 한 스냅숏에서 글자 사각형(Range) 안 픽셀 휘도의 p95 대 계산된 글자색, `HEADER_CONTRAST_MIN` 4.5, `HEADER_BG_PERCENTILE` 0.95. 측정값·제목·(있어야 할) 타이머 없음, 휘도 NaN 은 조용히 통과하지 않고 실패 |
| B1 | 배경 장면이 단계에 맞음 | `.mf-backdrop__art` 가 한 층·current·`data-scene` = `EXPECTED_SCENE[phase]`·계산된 background-image 가 `bg_game_*.webp`. `EXPECTED_SCENE` = `PHASE_SCENE` 임을 `scenes.test.ts` 가 단계 전부에서 확인 |
| N8·N9 | 낮 시작 문구가 처음 보인 값(MutationObserver)으로 `[N일차, 낮이 되었습니다, 토론 전에 먼저 직업을 공개해요]`·톤 day·pointer-events none·aria-hidden, 3.5초 안에 DOM 에서 사라짐 | `sceneIntroChecks(intro, { kind: "day" })` 가 N8, 밤은 N6 그대로 |
| T1·D7·D9 | 흐름에 `dayAnnounce` 항목 추가(대기실 → 배정 → 낮 시작 → 낮 → 밤 → 아침) | 새 상태 `day-intro`(아침 다음, 역할 카드 상태 앞; 경찰·시민·마피아·의사 흐름) |

- H1·B1 은 `stageChecks` 로 대기실(lobby 흐름)·토론·밤(N7 뒤)·아침(`dayState` 보다 먼저)·다음 낮에서 잰다. 재는 동안 추적 단계가 벗어나면 SetupError 로 새 방 한 번 다시.
- 측정 방법: 스크린샷(CSS 1:1) → 페이지에서 `createImageBitmap`+canvas 로 디코드 → 평평한 RGB 를 Node 로 돌려받아 `rgbP95Luminance`(순수 함수, 단위 테스트됨)로 p95. 새 패키지·네이티브 모듈 없음.

### 실제 렌더 H1 측정 (로컬 dev, 시트 확인용 프로브; gray-50 글자 대비)

| 단계(장면) | 폭 | 제목 | 타이머 |
|-----------|----|------|--------|
| 대기실(lobby, 코드) | 390 / 360 | 13.5 / 12.3 | 없음 |
| 역할 확인(lobby + 막 60%) | 390 / 360 | 16.6 / 16.6 | 8.9 / 8.8 |
| 주장·낮 시작(day + 헤더 막) | 390 / 360 | 8.4 / 8.3 | 5.3 / 5.1 |
| 토론(day + 막) | 390 / 360 | 8.7 / 8.6 | 5.3 / 5.1 |
| 밤(night) | 390 / 360 | 16.9 / 16.9 | 13.5 / 13.4 |
| 아침(morning + 막) | 390 / 360 | 9.4 / 9.3 | 5.9 / 5.9 |

- 가장 빠듯한 곳은 낮 타이머(5.09~5.31:1)로, 오프라인 계산(day 5.16/5.36/5.61, morning 5.82/5.82/6.05)과 같은 범위다. `HEADER_SCRIM_STOPS`(.70/.58/.40/0)는 보정 없이 그대로 통과 — 계획의 「다. 대비 보정」은 필요하지 않았다.
- 오프라인 `test/unit/backdropContrast.test.ts`: 장면 6장 × 폭 360·390·430 × 제목·타이머(막 합성)·대기실 코드·역할 확인 막 합성이 모두 ≥ 4.5. 막 없는 아침·낮 타이머는 2.1~2.6(< 4.5)으로 막이 필요하다는 사실을 고정했고, 막 없는 night·dusk·verdictDusk 는 ≥ 4.5 라 막을 달지 않는다(`SCENES.scrim` 과 일치). lobby 의 타이머 구역은 막 없이 1.8~2.1 이라 역할 확인의 `--scrim` 이 필요하다.

### 검증 (HEAD `931b2ff`)

- `npx vitest run` 80 파일 / **1894 테스트** 통과(이전 79 / 1865), `npm run typecheck` 오류 없음, `node --test scripts/e2e/lib.test.mjs` **107** 통과(이전 88), 새 테스트 파일 `test/unit/backdropContrast.test.ts` 한 개(대소문자만 다른 이름 중복 없음).
- 불변 가드: `git diff 97ce655 -- scripts/e2e/lib.mjs` 에 `OVERLAP_EPS|ONE_LINE_FACTOR|FACE_RATIO|TAP_MIN|PANEL_H|TEXT_SIZE_ALLOW|DECORATIVE_ALLOW|TAP_ALLOW` `export const` 줄 변경 0.
- 라이브 로컬 E2E(`npm run e2e`, dev 서버 5173, PID 로만 종료·포트 해제 확인) **전체 6흐름 × 3크기를 6회**(1회는 커밋 직전, 5회는 커밋 후) 돌렸고 매번 `E2E OK`, 실패 0. 무작위 탈락이 있는 police5·doctor5 도 모두 통과.

| 흐름 | 360x640 | 390x664 | 430x932 |
|------|---------|---------|---------|
| lobby | 23/23 | 23/23 | 23/23 |
| citizen4 | 115/115 | 115/115 | 115/115 |
| police5 | 123/123 | 123/123 | 123/123 |
| mafia8 | 120/120 | 120/120 | 120/120 |
| doctor5 | 119/119 | 119/119 | 119/119 |
| spec4 | 50/50 | 50/50 | 50/50 |

(표는 6회 모두 동일한 통과/전체. 항목 수는 B1·H1·N8·N9·W1 이 더해져 패스 C 보다 늘었다.)

- 계획과 다른 점: 계획은 페이지 안에서 p95 까지 계산하는 안이었는데, 단위 테스트로 닫으려고 픽셀 RGB 만 페이지에서 꺼내 Node(`lib.mjs` 의 순수 함수 `rgbP95Luminance`)에서 p95 를 구한다. 결과는 같다.
- 6회 모두 통과했지만 이 패스는 `tagVisibility` 값을 따로 기록하지 않아, 그중 어느 판에서 5명판 98.0% 바닥이 실제로 쓰였는지(앞쪽 옆자리 탈락 판이 있었는지)는 확인하지 못했다. 바닥은 단위 테스트가 고정한다.

## 패스 C 과제 4 결과 (낮 시작 화면 제거·SceneIntro·도착 훅)

- 구조: `src/screens/Day.tsx` 삭제. `RoomScreen.sceneKey` 가 `dayAnnounce` 를 `dayScene` 으로 묶어 claim·discussion·night·morning 과 같은 `DayScene` 이 그린다(제목 h1 `낮`, 안내 `N일차`, calm 타이머, 하단 패널 높이 157 — 살아 있는 사람은 비어 있고 탈락자는 관전 하단, 자리는 누를 수 없음, `inspectable` 아님). 배경 장면은 `day`.
- `SceneIntro`(`NightIntro` 를 `git mv`): `SceneIntro({ n, intro, onDone })`, `PHASE_INTRO` 는 `night`·`dayAnnounce` 두 행(`tone`·`title`·`sub?`), `SCENE_INTRO_MS = DAY_ANNOUNCE_MS`(2000). 막은 같은 방사형(70% 55% at 50% 38%, night-950) 에 톤별 `--mf-sceneintro-veil` 밤 85%·낮 70%, 보조줄은 옛 낮 시작 보조줄 값(16px/1.5·gray-100). z 40·pointer-events none·aria-hidden·h1 아님. 해제 타이머는 마운트 때 한 번만 건다.
- `usePhaseArrival(phase, epoch)`(`src/net/phaseArrival.ts`): 같은 epoch 에서 단계가 바뀐 뒤에는 직전 단계, 처음·epoch 변화 렌더에서는 null, 다음 변화까지 유지. `RoomScreen` 이 `arrivedFrom` 을 `DayScene` 에 넘긴다.
- `DayScene`: `prevPhase` 초기값 = `arrivedFrom ?? view.phase` 라 역할 확인 직후 새로 마운트돼도 첫 렌더가 단계 변화로 처리되어 낮 문구가 한 번 뜨고, 배경은 `fromScene`(직전 단계의 장면 = lobby)에서 day 로 크로스페이드한다. 재접속(epoch 변화와 함께 바뀐 단계)은 `instant` 로 한 층·문구 없음.
- 계획과 다른 구현 선택 하나: `instant` 를 `epochChanged` 에서 바로 계산하지 않고 상태로 쥔다. 렌더 중 상태 조정이 `prevEpoch` 를 먼저 맞추기 때문에 최종 렌더의 `epochChanged` 는 항상 거짓이 되어 `Backdrop` 이 `instant` 를 못 본다 — 단계가 바뀌는 조정에서 `setInstant(epochChanged)` 로 그 값을 남긴다(테스트 「단계와 epoch 가 함께 바뀌면 곧바로 한 층」이 닫는다).
- `sheetDebug.screenKind` 는 `main.mf-day` 가 사라져 `main.mf-dayscene` → `"day"` 로 바꿨다(낮 시작 외에 claim·밤·아침도 `day` 로 기록된다. 계측 도구 한정, 테스트 「화면 종류가 day」는 그대로 통과).
- E2E 는 이름만 맞췄다: `readNightIntro` → `readSceneIntro`(톤 `kind` 도 읽음), `nightIntroChecks` → `sceneIntroChecks(intro, { kind })`(night 만 지원, 낮은 과제 5). 임계값·허용 목록은 `97ce655` 대비 diff 0.
- 검증: `npx vitest run` 79 파일 / 1865 테스트 통과(이전 78 / 1835), `npm run typecheck` 오류 없음, `node --test scripts/e2e/lib.test.mjs` 88 통과, `! grep -rnE "mf-day__|mf-nightintro|NightIntro" src scripts/e2e` 통과, `Day.tsx`·`NightIntro.tsx`·`nightIntro.test.tsx` 없음, `git diff --name-only 97ce655 -- shared worker` = `shared/game/bots.ts` 한 줄.

### 패스 C 라이브 로컬 E2E (dev 서버 5173, 전 흐름·세 크기 한 번)

| 흐름 | 360x640 | 390x664 | 430x932 |
|------|---------|---------|---------|
| lobby | 21/21 | 21/21 | 21/21 |
| citizen4 | 105/105 | 105/105 | 105/105 |
| mafia8 | 110/110 | 110/110 | 110/110 |
| police5 | 113/113 | **111/113** | 113/113 |
| doctor5 | **107/109** | 109/109 | 109/109 |
| spec4 | 50/50 | 50/50 | 50/50 |

낮 시작이 DayScene 위에서 지나가도 D7·D9·T1·K·N6·N7 은 모두 통과했다. 실패 4건은 모두 **D3b**(5명판 이름표 보이는 비율, 바닥 99.9%): `police5/morning`·`police5/next-day`(390, 자리 2 이름표 99.9%), `doctor5/morning`·`doctor5/next-day`(360, 자리 2 또는 3 이름표 99.5~99.6%).

### 패스 C 열린 문제 — 5명판 D3b (과제 4 의 변경과 무관, 패스 A 의 5글자 이름이 원인) — **해결: 패스 D 에서 사용자 승인 완화(5명판 98.0%)**

- 재현은 무작위 탈락에 달려 있다: police5@390 을 두 번 다시 돌리면 둘 다 통과했고 doctor5@360 은 여섯 번 중 한 번(+디버그 반복의 첫 판에서 또 한 번) 실패했다. 실패한 판의 공통점은 **앞쪽 옆자리(5명판 자리 1 또는 4)가 탈락해 유령 그림**이라는 것.
- 원인(측정으로 확정): 유령 PNG 는 일반 인물보다 머리 윗부분이 상자 위쪽까지 차 있어, 뒤쪽 이웃(자리 2·3)의 이름표 알약 아래쪽 3.3px 를 알파 > 40 픽셀로 덮는다. 이름표 알약 폭이 94.3px(5글자 + 점 + 여백)이면 알약 왼/오른끝(x 62~90)이 앞 유령의 머리 위와 겹치고, 4글자(약 83px 이하)에서는 겹침이 99.9% 근처에서 멈췄다. 오프라인 모델(`dayTable.ts` 의 실제 배치 + 실제 유령/인물 PNG 알파, E2E 와 같은 0.5px 격자·알파 40)이 브라우저 측정과 소수점까지 같다: 360폭 자리 1 탈락 → 자리 2 이름표 99.60%, 자리 4 탈락 → 자리 3 99.59%, 390폭 99.91%. 탈락이 없거나 뒤쪽 자리가 탈락하면 100%.
- 이름표 요소 사각형은 알약 위에 4px 여유를 더한 26px 높이지만, 알약은 그 상자의 아래 22px 에 놓이므로(실측: 알약 top = 이름표 top + 4) 겹침은 알약에 실제로 생기는 것이다(측정 착시가 아님).
- 5글자 봇 이름(V-07, 패스 A 첫 커밋)이 5명판에서 처음 이 조합을 만들었다. 패스 A·B 의 부분 E2E 는 citizen4·mafia8·lobby 만 돌아서 걸리지 않았다.
- 임계값(D3b 5명판 99.9%)은 낮추지 않았다. 앱에서 풀려면 유령 그림 처리(크기·위치) 또는 5명판 이름표 배치 변경이 필요한데 둘 다 결정 0028 기하·ASSET_SPEC §6 에 닿으므로 이 패스에서 임의로 건드리지 않았다. 선택지는 반환 메시지에 적었다.

## 이번 패스의 구현 요약 (패스 A)

- `src/game/dayTable.ts`: `HALO_CORE_BLUR_PX` 2, `HALO_BLUR_PX` 9, `HALO_MAX_SIMULTANEOUS` 3, `BUBBLE_W` 48, `BUBBLE_H` 26, `BUBBLE_TAIL` 5, `BUBBLE_TOP` 26 (좌표·z 규칙은 불변).
- `src/components/DayTable.tsx`: 후광 클래스는 그림 `img` 에만 붙는다 — 흰(`s.turn || s.pick?.mine`) > 진홍(`s.isAlly`). 차례·빠른 메시지 자리는 `span.mf-dt__bubble--turn|--spoke`(aria-hidden, 점 셋), 이모티콘이 있으면 말풍선 없음. 왕관은 `hostCrown && isHost`. `Lobby` 만 `hostCrown` 을 준다.
- `src/styles/daytable.css`: 후광 값은 `.mf-dt` 사용자 지정 속성 두 개(`--mf-halo-white`·`--mf-halo-crimson`)에 한 번만 적고, 끊김과 함께면 `grayscale(1)` 뒤에 후광. 말풍선·점 깜박임(1200ms, 0/200/400ms 지연), 축소 모션에서 `animation: none` + 정지 불투명도 1/.6/.3. 옛 링·선택 링·배지·이름표 반전 규칙 삭제.
- 계획의 확인 필요 기본값을 그대로 따랐다: 말풍선 위 −26px, 왕관은 대기실만(역할 배정에서도 없앰), 빠른 메시지 보낸 사람은 말풍선만(후광 없음).

## 패스 B 과제 2 결과 (E2E K1·K4·W1, 부분 로컬 E2E)

- 부분 로컬 E2E (dev 서버 5173, 세 크기 360x640·390x664·430x932): `mafia8` 110/110 · `citizen4` 105/105 · `lobby` 21/21, 모두 `E2E OK`. 5글자 이름표 8명판(방장 `화면검사기` + 봇 7명)에서 D2·G2(폰 가장자리 −0.5 칼날)·D3a·D3b(바닥 55%)·D9·D4·T1·T2 도 모두 통과 — 임계값은 하나도 낮추지 않았다.
- 첫 실행에서 `claim-other` K4 만 세 크기 모두 실패: 차례가 막 바뀐 순간의 후광 `filter` 계산값이 180ms 전환 중간값(`0.74px` 등)이었다. 앱 결함이 아니라 측정 시점 오류라서 `browser.mjs` 가 후광 요소의 진행 중인 CSS 전환만 끝내고(`CSSTransition.finish()`) 끝 상태를 읽게 고쳤다. 판정 기준(두 겹 drop-shadow, 9px, 3개 이하, 발밑 원 0)은 그대로.
- 단위 테스트: `node --test scripts/e2e/lib.test.mjs` 88 통과 (이전 86), `npm run typecheck` 통과. 옛 선택자 grep(`lib.mjs`·`flows.mjs`) 0건.
- 불변: `OVERLAP_EPS`·`ONE_LINE_FACTOR`·`FACE_RATIO`·`TAP_MIN`·`PANEL_H`·`TEXT_SIZE_ALLOW`·`DECORATIVE_ALLOW`·`TAP_ALLOW` 줄은 `97ce655` 대비 diff 0.

## 패스 B 과제 3 결과 (배경 장면·WebP·Backdrop)

| WebP | 크기 | 상한 | 원본 |
|------|------|------|------|
| bg_game_lobby | 43.1KB | 48KB | set2 PNG 1080×2340 |
| bg_game_night | 39.2KB | 48KB | set2 PNG |
| bg_game_morning | 15.8KB | 24KB | set1 JPG **540×1170** (업스케일 없음) |
| bg_game_day | 18.7KB | 24KB | set1 JPG **540×1170** |
| bg_game_dusk | 36.3KB | 48KB | set2 PNG |
| bg_game_verdict_dusk | 39.3KB | 48KB | set2 PNG |
| bg_entry_lobby | 55.7KB | 64KB | set2 PNG |
| **합계** | **248.0KB** | 260KB | 옛 SVG 합 약 356KB |

- 계획 측정표(43.1·39.2·36.3·39.3·55.7·15.8·18.7KB)와 소수점까지 같다. `node scripts/make-backdrops.mjs` 를 두 번 돌려 바이트가 같음(결정적)을 확인했다. sharp 는 그대로 로드됐고 새 패키지는 없다(`package.json` 은 `backdrops` 스크립트 한 줄).
- 검증: `npx vitest run` 78 파일 / 1835 테스트 통과(이전 76 / 1794), `npm run typecheck` 통과, `node --test scripts/e2e/lib.test.mjs` 88 통과. `public/backgrounds` = WebP 7개뿐, `backgrounds/bg_*.svg` 참조 grep 0건, `shared`·`worker` diff 는 `shared/game/bots.ts` 한 줄.
- 개발 서버 sanity: `/backgrounds/bg_game_night.webp`·`bg_entry_lobby.webp` 가 `image/webp` 로 서빙되고 없어진 `.svg` 는 SPA 가 html 로 답한다(smoke 의 content-type 검사가 구분하는 이유). 로컬 E2E `lobby` 21/21 · `citizen4` 105/105 (세 크기).
- `Backdrop` 구현 선택: 새 그림이 준비되기 전까지 이전 층을 current 로 그대로 둔다(계획 문장은 이전 층을 즉시 leaving 으로 두는 꼴이었는데, 그림이 늦으면 어두운 바탕이 비칠 수 있어 준비된 순간에 current/leaving 을 함께 바꾼다). 끝 상태와 상한(1.2초)·최대 3층·instant·fromScene 규칙은 계획과 같다.
- `DayScene` 은 `sceneOfPhase(view.phase)` 로 장면을 정하므로 아침은 이제 `mf-backdrop--morning`(set1 + 헤더 막)이다. `instant`(재접속)와 `fromScene` 연결은 과제 4 몫이라 아직 걸지 않았다.
- smoke 의 WebP 검사(night·entry lobby: 200·`image/webp`·`max-age=86400`·RIFF/WEBP 머리·용량 상한)는 `--stage full` 끝에서만 돈다. 개발 서버에서는 캐시 헤더가 `no-cache` 라 배포본(과제 6)에서 처음 실제로 돈다.

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

## 다음 패스(E) 인계 — 과제 6

- 과제 6(문서·전체 검증·배포·push)만 남았다. 결정 0030(`docs/decisions/0030-visual-bundle.md`)에 **D3b 5명판 98.0% 승인 완화(2026-10-26)** 를 반드시 적고, 0028·0025 의 「승인된 완화는 M1·D3a/D3b·D4」 문장 옆에도 갱신한다. UI-SPEC F7 행은 이 패스에서 이미 갱신했다. HANDOFF 의 확인 필요에 H1 측정 숫자(낮 타이머 5.1~5.3:1, `HEADER_SCRIM_STOPS` 값 .70/.58/.40/0 이 계획 값 그대로 통과)를 적는다.
- 배포본 E2E(`node scripts/e2e/run.mjs --url https://minifia.dhplay.workers.dev`)는 새 규칙 H1·B1·N8·N9 를 처음 실제 배포본에서 돌린다. 배포본은 캐시 헤더가 있어 B1 의 background-image 가 `bg_game_*.webp` 로 나오는지, 낮 시작 2초를 MutationObserver 가 붙잡는지(네트워크 지연이 큰 환경에서 `day-intro` 의 SetupError 재시도 가능성) 눈여겨본다.
- `scripts/smoke.mjs` 의 WebP 검사는 `--stage full` 끝에서만 돌고 배포본에서 처음 실제로 돈다(패스 B 인계).
- 커밋 원장 `.git/gsd-plan-head-before-quick-261025-unr-01` (= `97ce655`) 는 그대로 쓴다. 최종 SUMMARY 의 `commits`·`plan_head_after` 는 마지막에 다시 측정한다.
- 실기기 확인 목록 후보(과제 6 에서 HANDOFF 로): 후광 모양, 말풍선 깜박임·위치, 8명판 5글자 이름표 칼날 경계, 배경 전환 속도(0.8초)·아침·낮(set1)↔밤(set2) 하늘 색 차이, 헤더 막 가독성, 5명판에서 앞쪽 옆자리 유령 머리가 5글자 이름표를 살짝 덮는 모양(승인된 98.0%).

## 이전 인계 (패스 B → C, 참고)

- 시작 때 `git status --short` 와 직전 커밋(이 체크포인트 커밋 직전은 `3043681`)을 확인한다. `.planning/milestone.lock` 은 추적하지 않는다.
- 커밋 원장: `.git/gsd-plan-head-before-quick-261025-unr-01` (= `97ce655`). 최종 SUMMARY 의 `commits` 는 이 원장에서 측정한다.
- 라이브 E2E 는 이제 새 후광·말풍선·왕관 계약을 읽는다(`mafia8`·`citizen4`·`lobby` 통과). 후광 filter 는 180ms 전환 중간값을 피하려고 `browser.mjs` 가 진행 중인 전환을 끝낸 뒤 읽는다.
- 과제 4 가 이어서 할 것: `Day.tsx` 제거, `NightIntro` → `SceneIntro`, `usePhaseArrival`, `DayScene` 의 `instant`(epoch 변화)·`fromScene`(역할 확인 직후 마운트) 연결. `Backdrop` 은 이미 `instant`·`fromScene` props 를 받고 단위 테스트가 닫혀 있다. 과제 5 의 오프라인 대비 테스트는 `HEADER_SCRIM_STOPS`(`src/game/scenes.ts`)와 `public/backgrounds/bg_game_*.webp` 를 읽는다.
- 실기기 확인 목록 후보 (과제 6 에서 HANDOFF 로): 후광 모양, 말풍선 깜박임·위치, 8명판 5글자 이름표 칼날 경계(봇·방장 이름이 모두 5글자), 배경 전환 속도(0.8초)·아침·낮(set1)↔밤(set2) 하늘 색 차이, 헤더 막(알파 상향) 가독성.

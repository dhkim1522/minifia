---
phase: 19-game-modes
plan: "08"
subsystem: release
tags: [e2e, regression, deploy, docs, decision-record]
status: in-progress
---

# Phase 19 Plan 08: 전체 회귀·배포·결정 기록 Summary

## 진행

(중단되면 이 절과 `git log --oneline --grep "(19-08)"` 로 끊긴 단계부터 다시 시작한다.)

- [x] 단계 1 로컬 검증: npm test 8293 통과(실패 0, 건너뜀 261) · 스크립트 시험 667 통과 · typecheck·build exit 0 · E2E 전 흐름(47개) 폰 6종 회귀 한 번 6971 중 6962 통과(실패 9건: chat-keyboard 3건 → 앱 결함을 고친 뒤 통과 · errand 3건 간헐 → 재실행 통과 · perfbudget 3건은 13페이즈부터의 알려진 한계) · RULESET 0줄 · 위생 검사 통과(새 결과 0)
- [x] 단계 2 배포: minifia-v3 `2026-11-12T10:59:05Z+d53d5905` → `2026-11-12T16:47:00Z+71a10fc8` · 범위 diff 37개(서버 14: shared 13·worker 1) · 개인 계정 확인 · smoke full 통과(첫 시도)

## 단계 1: 로컬 전체 검증

### 빠른 검사

| 검사 | 결과 |
| --- | --- |
| `npm run typecheck` | exit 0 (앱 고침 전·후 두 번) |
| `npm run build` | exit 0 (두 번) |
| `node --test scripts/*.test.mjs scripts/e2e/*.test.mjs` | 667 통과, 실패 0 (두 번) |
| `npm test` | 첫 실행 282 파일 8288 통과·261 건너뜀·실패 0 → 앱 고침 뒤 **8293 통과**·261 건너뜀·실패 0(시험 5개 추가) |
| `git grep -q "RULESET" -- src shared worker test scripts` | 종료 코드 1(일치 없음, 성공 기준 2) |
| 위생 검사(저장소 전체) | 통과(새 결과 0) |

19-01~19-07 이 '앱 결함'으로 넘긴 항목은 없었다. 앱 결함 하나는 이 단계의 전 흐름 회귀가 찾았다(아래).

### 폰 6종 E2E 전 흐름 회귀 (로컬 `http://localhost:5173`)

기본 실행(skipByDefault 밖 47개 흐름)을 묶음 일곱으로 나눠 차례로 한 번 돌렸다(명령 하나의 시간 제한 때문). 걸린 시간은 묶음 합 1859초(약 31분).

| 묶음 | `--only` | 걸린 시간 | 첫 실행 |
| --- | --- | --- | --- |
| A | lobby,world,chat | 142초 | 실패 3(chat-keyboard) |
| B | day,ghost,noexec,night | 330초 | 통과 |
| C | result,host-handoff,map-select,polish-reveal | 219초 | 통과 |
| D | basic-off,basic-vote,politics-verdict,mode | 243초 | 통과 |
| E | avatar-emote,avatar-dress,avatar-phases,sound-render,sound-unlock,sound-script | 162초 | 통과 |
| F | emcee,errand,witness,trace | 407초 | 실패 3(errand) |
| G | tutorial,reconnect,perfbudget,pc,wakelock | 356초 | 실패 3(perfbudget) |

**첫 실행 합계: 6971 판정 중 6962 통과, 실패 9건.**

| 실패 | 크기 | 원인 | 처리 |
| --- | --- | --- | --- |
| chat-keyboard `S4 단계 도달`(locator.click 시간 초과, 스스로 다시 시도한 4번 모두 같음) | 360x640 · 390x664 · 360x560 | **앱 결함(재현됨).** 입력칸 포커스 중 맵을 누르면 손을 뗄 때 키보드를 닫는다(D4). 포커스가 풀리는 순간 키보드 동안 그리지 않던 방장 줄이 그 자리에 새로 그려지고, 터치의 뒤따르는 click 이 다시 맞춰져 [봇] 단추를 눌러 봇 시트가 열렸다(이벤트 기록: `pointerup → focusout → touchend → mousedown·click@[data-host-rail-btn=bots]`). 낮은 폰에서만 탭 자리가 줄과 겹쳤다. 방장 줄이 왼쪽에 생긴 19페이즈의 결과이고, 같은 일이 오른쪽 열에서도 생길 수 있었다 | `fix(19-08)` `a0944711` — 키보드를 닫은 탭과 같은 자리(10px)·0.5초 안의 click 을 한 번 삼킨다. 고친 뒤 chat-keyboard 폰 6종 141/141, 묶음 A 전체 다시 731/731(다시 시도 0) |
| errand `HS3 낮 시작 → 심부름 0번`(알림음 기록을 읽지 못함) | 390x664 · 430x932 · 360x560 | **간헐(원인 미확정).** 세 크기를 함께 다시 돌리니 390x664·360x560 은 통과하고 430x932 가 다른 판정(EA3 띠 문장 3줄)으로 실패했다. 430x932 단독 두 번은 22/22 두 번, 폰 6종 다시 한 번은 여섯 크기 모두 통과(다시 시도 0). 같은 판정이 이어서 실패하지 않아 재현되는 결함으로 보지 않았다. errand 는 18.1 회귀에서도 부하 때 흔들린 흐름이다 | 고치지 않음. 알려진 한계에 적음 |
| perfbudget B2(점광원 4 > 3) 2건 · M1(지오메트리 35 > 25) 1건 | 390x844 | 13페이즈부터의 알려진 한계(문턱 불변) | 그대로 |

스스로 다시 시도해 통과한 것(실패로 세지 않음): day 360x560 `page.goto: Timeout 8000ms` 1회(그때 원인 조사용 실행을 함께 돌리고 있었다), basic-vote 390x844 `nomination 도착 8초` 1회, avatar-phases-night `손님도 마피아 — 새 방으로` 1회(설계된 다시 뽑기).

**마지막 상태(고친 뒤 다시 돈 흐름을 반영): 7039 판정 중 7036 통과. 남은 실패 3건은 perfbudget 알려진 한계뿐이다.**

| 흐름 | 360x560 | 360x640 | 390x664 | 390x844 | 402x874 | 430x932 | 그 밖 |
|---|---|---|---|---|---|---|---|
| lobby | 39/39 | 40/40 | 40/40 | 40/40 | 40/40 | 40/40 | |
| world | 23/23 | 23/23 | 23/23 | 23/23 | 23/23 | 23/23 | |
| chat-lobby | 30/30 | 30/30 | 30/30 | 30/30 | 30/30 | 30/30 | |
| chat-keyboard | 23/23 | 23/23 | 23/23 | 24/24 | 24/24 | 24/24 | |
| chat-ime · chat-ime-360x560 | 10/10 | — | — | 10/10 | — | — | |
| chat-game | — | — | — | 13/13 | — | — | |
| day | 116/116 | 116/116 | 116/116 | 116/116 | 116/116 | 116/116 | |
| ghost | 95/95 | 95/95 | 47/47 | 52/52 | 95/95 | 81/81 | |
| noexec | — | — | — | 23/23 | — | — | |
| night | — | — | — | 147/147 | — | — | |
| night-sizes | 50/50 | 50/50 | 50/50 | 50/50 | 50/50 | 50/50 | |
| result | — | — | — | 27/27 | — | — | |
| result-reveal | 34/34 | 34/34 | 34/34 | 34/34 | 34/34 | 34/34 | |
| result-rematch | 19/19 | — | — | — | — | — | |
| host-handoff | — | — | — | 8/8 | — | — | |
| map-select | 75/75 | 75/75 | 75/75 | 75/75 | 75/75 | 75/75 | |
| basic-off | — | — | — | 10/10 | — | — | |
| basic-vote | 15/15 | 15/15 | 15/15 | 15/15 | 15/15 | 14/14 | |
| politics-verdict | 32/32 | 32/32 | 32/32 | 32/32 | 32/32 | 32/32 | |
| avatar-emote | 36/36 | 36/36 | 36/36 | 36/36 | 36/36 | 36/36 | |
| avatar-dress | 35/35 | 35/35 | 35/35 | 35/35 | 35/35 | 35/35 | |
| avatar-phases | — | — | — | 19/19 | — | — | |
| avatar-phases-night | — | — | — | 5/5 | — | — | |
| sound-render | — | — | — | 8/8 | — | — | |
| sound-unlock | 24/24 | 24/24 | 24/24 | 24/24 | 24/24 | 24/24 | |
| sound-script | — | — | — | 36/36 | — | — | |
| sound-night-parity | — | — | — | 20/20 | — | — | |
| sound-result | — | — | — | 17/17 | — | — | |
| emcee-band | 61/61 | 61/61 | 61/61 | 61/61 | 61/61 | 60/60 | |
| emcee-tools | — | — | — | 17/17 | — | — | |
| emcee-leak | — | — | — | 23/23 | — | — | |
| emcee-sound | — | — | — | 8/8 | — | — | |
| errand | 22/22 | 22/22 | 22/22 | 27/27 | 22/22 | 22/22 | |
| witness | 13/13 | 13/13 | 13/13 | 13/13 | 13/13 | 13/13 | |
| trace | 53/53 | 53/53 | 53/53 | 53/53 | 53/53 | 53/53 | |
| tutorial-solo | 231/231 | 231/231 | 229/229 | 230/230 | 229/229 | 229/229 | |
| tutorial-together | — | — | — | 34/34 | — | — | |
| mode-rail | 41/41 | 39/39 | 39/39 | 41/41 | 39/39 | 39/39 | |
| mode-pick | — | — | — | 41/41 | — | — | |
| mode-basic | — | — | — | 19/19 | — | — | |
| mode-leak | — | — | — | 25/25 | — | — | |
| polish-reveal | 44/44 | 44/44 | 44/44 | 44/44 | 44/44 | 44/44 | |
| reconnect | — | — | 35/35 | — | — | — | |
| perfbudget | — | — | — | **10/13** | — | — | 알려진 한계 B2·M1 |
| pc | — | — | — | — | — | — | 1280x800 7/7 |
| wakelock | — | 2/2 | — | — | — | — | |

표의 값은 첫 실행 값이고, 고친 뒤 다시 돈 흐름만 다시 돈 값이다: 묶음 A(lobby·world·chat-* — 앱 고침 뒤 전체 다시), errand(폰 6종 다시), world·avatar-emote·avatar-dress 360x560(아래 예외 삭제 뒤). 나머지 흐름은 앱 고침 전의 한 번 실행이다(고친 곳은 "입력칸 포커스 중 맵 탭" 한 갈래라 다시 돌리지 않았다).

### 함께 고친 판정 (`test(19-08)` `f7efaed8`)

19-06 이 "낡았을 수 있다"고 넘긴 `world` 흐름의 360x560 방장 건너뛰기는 실패하지 않았지만 전제(방장 패널 +54)가 없어진 예외였다. 없애고 다시 돌렸다.

- `world`: 360x560 도 목적지를 두 화면에 보이는 칸에서 고르고 방장 겹침 단계(NT3)를 판정한다 — 21줄 → 23줄, 통과.
- `avatar-emote` EP4 · `avatar-dress` DB1 의 "낮은 폰 방장은 참고만" 처리 삭제 — 전 흐름 회귀에서 한 번도 쓰이지 않았다. 360x560 36/36 · 35/35.
- 판정 문턱은 건드리지 않았다(예외를 없앤 것이라 판정이 더 엄격해졌다).

개발 서버는 시작할 때 이미 떠 있던 것을 그대로 썼고 끄지 않았다(내가 띄운 것이 아니다).

## 단계 2: 배포

| 배포본 | 배포 전 `/api/health` version | 배포 후 |
| --- | --- | --- |
| minifia-v3 | `2026-11-12T10:59:05Z+d53d5905` | **`2026-11-12T16:47:00Z+71a10fc8`** (HEAD `71a10fc8`) |
| minifia (v1.0) | `2026-10-29T14:52:03Z+cb6979c` | 그대로 |
| minifia-v2 | `2026-11-06T13:49:18Z+e51942c6` | 그대로 |

- 배포 전 값이 HANDOFF 에 적혀 있던 `eb0463b5` 가 아니라 `d53d5905` 였다 — 2026-11-12 에 3D 유령·움직임 밀림 수정(결정 0084·0085)이 이미 배포되어 있었다. 그래서 0084·0085 의 상태 줄을 "배포됨"으로 고쳤다(단계 3).
- **개인 계정 확인**: `node scripts/check-account.mjs` 종료 코드 0. 그 뒤 `npm run deploy`(계정 가드 → 빌드 → 배포 대상 가드 → 배포)를 우회 없이 한 번 돌렸다. 종료 코드 0.
- **smoke full 1회**: `SMOKE_STACK=1 node scripts/smoke.mjs --prod --stage full --players 5 --previous-version <배포 전 version>` → `SMOKE OK full players=5 serverSpread=0ms/0ms arrivalSpread=1906ms/11ms`, version 이 새 값. 첫 시도 통과(연결·서버 시각 편차·한도 문제 없음). 출력은 작업 트리 밖 임시 파일에만 두었다.
- 배포본을 대상으로 한 E2E 는 돌리지 않았다(결정 0076, DO 하루 쓰기 한도).
- 서버가 바뀐 배포다(판 종류·`modePick`). 저장된 옛 방은 mode 가 없어 확장판으로 읽힌다(D-04, 19-01 시험).

배포 범위(`git diff --name-only d53d5905..71a10fc8 -- src shared worker public index.html wrangler.jsonc package.json package-lock.json`, 37개):

```
shared/game/bots.ts
shared/game/mode.ts
shared/game/night.ts
shared/game/nomination.ts
shared/game/phases.ts
shared/game/rematch.ts
shared/game/room.ts
shared/game/ruleset.ts
shared/game/testTools.ts
shared/game/tick.ts
shared/game/view.ts
shared/protocol.ts
shared/schemas.ts
src/components/ModeSheet.tsx
src/components/WorldStage.tsx
src/components/v2/HostRail.tsx
src/components/v2/HostRailButton.tsx
src/components/v2/LineSheet.tsx
src/components/v2/MapChip.tsx
src/components/v2/ModeChip.tsx
src/components/v2/TutorialToggle.tsx
src/components/v2/V2Icon.tsx
src/game/badgeView.ts
src/game/chatUi.ts
src/game/modeText.ts
src/game/resultText.ts
src/game/whisperView.ts
src/net/roomDiff.ts
src/screens/GameMap.tsx
src/screens/Lobby.tsx
src/screens/ResultScreen.tsx
src/styles/lobby.css
src/styles/result.css
src/styles/sheet.css
src/styles/tutorialRoom.css
src/styles/v2.css
worker/room.ts
```

---
phase: 19-game-modes
plan: "08"
subsystem: release
tags: [e2e, regression, deploy, decision-record, docs, host-rail, game-mode]

requires:
  - phase: 19-game-modes
    provides: "19-01~19-07 — 판 종류 서버·화면·방장 줄·두 판 E2E"
provides:
  - "로컬 전체 검증과 폰 6종 E2E 전 흐름 회귀 한 번(47개 흐름, 마지막 상태 7039 중 7036)"
  - "회귀가 찾은 앱 결함 수정: 키보드를 닫은 맵 탭의 뒤따르는 click 이 새로 그려진 방장 줄 단추를 누르지 않는다"
  - "minifia-v3 배포 version 2026-11-12T16:47:00Z+71a10fc8 (smoke full 통과)"
  - "결정 기록 0086, 화면 지도·기획서·구조 문서·ROADMAP·HANDOFF 갱신"
affects: [20-map-rooms, 21-day-flow, v3.0 실테스트]

actuals:
  tokens: 27000
  tasks: 3
  commits: 5
plan_head_before: fad4aa7a3573a50e1872bcaeac4a7df7a5e41cf3
plan_head_after: 97320b17f96fc6cf0e2f7e73b124323b20a5ec90

tech-stack:
  added: []
  patterns:
    - "배치가 바뀌는 탭(포커스 해제)은 뒤따르는 같은 자리 click 을 한 번 삼킨다(WorldStage swallowDismissClick)"
    - "전 흐름 회귀는 --only 묶음 일곱으로 나눠 차례로 돈다(겹치지 않는 부분 문자열 묶음)"

key-files:
  created:
    - docs/decisions/0086-v3-game-modes.md
    - .planning/phases/19-game-modes/19-08-SUMMARY.md
  modified:
    - src/components/WorldStage.tsx
    - test/client/worldStage.test.tsx
    - scripts/e2e/flows.mjs
    - scripts/e2e/avatar.mjs
    - docs/screen-map.md
    - docs/product.md
    - docs/architecture.md
    - docs/decisions/0079-v3-buttons-and-evidence.md
    - docs/decisions/0081-v3-missions-flow-and-modes.md
    - docs/decisions/0083-v3-screen-fix-plan.md
    - docs/decisions/0084-v3-ghost-3d-and-pick-check.md
    - docs/decisions/0085-v3-own-move-time-lead.md
    - HANDOFF.md
    - .planning/ROADMAP.md
    - .planning/WINDOWS.md
    - .planning/STATE.md

key-decisions:
  - "키보드를 닫은 맵 탭과 같은 자리(10px)·0.5초 안의 click 을 한 번 삼킨다 — 포커스가 풀리며 새로 그려진 방장 줄·오른쪽 열 단추가 눌리지 않게"
  - "360x560 접힌 방장 줄의 둘째 열과 위 알림 겹침은 알려진 한계로 받아들인다(사용자 방침, 열린 항목 7 닫음)"
  - "전제가 없어진 E2E 의 360x560 방장 예외 셋(world·avatar-emote·avatar-dress)을 없앤다 — 판정이 더 엄격해진다"

patterns-established:
  - "배포 전 version 은 문서가 아니라 /api/health 에서 읽는다(HANDOFF 의 값과 달랐다)"

requirements-completed: [D-05, D-18, D-19]

coverage:
  - id: D1
    description: "로컬 전체 검증(typecheck·build·스크립트 시험·npm test)과 폰 6종 E2E 전 흐름 회귀 한 번"
    requirement: D-18
    verification:
      - kind: unit
        ref: "npm test — 8293 통과·261 건너뜀·실패 0"
        status: pass
      - kind: unit
        ref: "node --test scripts/*.test.mjs scripts/e2e/*.test.mjs — 667 통과"
        status: pass
      - kind: e2e
        ref: "node scripts/e2e/run.mjs --url http://localhost:5173 (묶음 일곱) — 마지막 상태 7039 중 7036, 남은 3건은 perfbudget B2·M1 알려진 한계"
        status: fail
    human_judgment: true
    rationale: "perfbudget B2·M1 은 13페이즈부터의 알려진 한계라 실패 줄이 남는다. errand 간헐 실패(재실행 통과)를 받아들일지도 사람이 본다"
  - id: D2
    description: "키보드를 닫은 맵 탭의 뒤따르는 click 삼킴(회귀가 찾은 앱 결함 수정)"
    verification:
      - kind: unit
        ref: "test/client/worldStage.test.tsx#키보드를 닫은 탭에 뒤따르는 click (5개)"
        status: pass
      - kind: e2e
        ref: "chat-keyboard 폰 6종 141/141(고친 뒤), 묶음 A 731/731"
        status: pass
    human_judgment: false
  - id: D3
    description: "minifia-v3 배포와 health version·smoke full 확인"
    requirement: D-19
    verification:
      - kind: other
        ref: "curl /api/health — 2026-11-12T16:47:00Z+71a10fc8, 다른 두 배포본 그대로"
        status: pass
      - kind: integration
        ref: "scripts/smoke.mjs --prod --stage full --players 5 — SMOKE OK(첫 시도)"
        status: pass
    human_judgment: false
  - id: D4
    description: "결정 기록 0086·화면 지도·기획서·구조 문서·ROADMAP 성공 기준 1·HANDOFF"
    requirement: D-05
    verification:
      - kind: unit
        ref: "test/unit/handoff.test.ts (5217바이트, 머리 셋)"
        status: pass
    human_judgment: true
    rationale: "문서 내용(결정 요지·알려진 한계)이 맞는지는 사용자가 돌아와 읽고 한 줄씩 바꿀 수 있다. 실기기 눈 확인은 v3.0 끝 실테스트"

duration: 52min
completed: 2026-11-13
status: complete
---

# Phase 19 Plan 08: 전체 회귀·배포·결정 기록 Summary

**폰 6종 E2E 전 흐름 회귀가 찾은 앱 결함(키보드를 닫은 맵 탭의 click 이 새로 그려진 방장 줄 [봇] 단추를 누름)을 고치고, 개인 계정 확인 뒤 minifia-v3 에 `2026-11-12T16:47:00Z+71a10fc8` 로 배포해 smoke 로 확인했으며, 결정 0086 과 화면 지도·HANDOFF 를 남기고 v3 를 push 했다.**

## 진행

(중단되면 이 절과 `git log --oneline --grep "(19-08)"` 로 끊긴 단계부터 다시 시작한다.)

- [x] 단계 1 로컬 검증: npm test 8293 통과(실패 0, 건너뜀 261) · 스크립트 시험 667 통과 · typecheck·build exit 0 · E2E 전 흐름(47개) 폰 6종 회귀 한 번 6971 중 6962 통과(실패 9건: chat-keyboard 3건 → 앱 결함을 고친 뒤 통과 · errand 3건 간헐 → 재실행 통과 · perfbudget 3건은 13페이즈부터의 알려진 한계) · RULESET 0줄 · 위생 검사 통과(새 결과 0)
- [x] 단계 2 배포: minifia-v3 `2026-11-12T10:59:05Z+d53d5905` → `2026-11-12T16:47:00Z+71a10fc8` · 범위 diff 37개(서버 14: shared 13·worker 1) · 개인 계정 확인 · smoke full 통과(첫 시도)
- [x] 단계 3 문서·push: 결정 0086 신설(0086-1~19·위임 기본값·계획·실행 중 달라진 곳·폰 6종 실측·알려진 한계) · 0081-6·0083-3·0079-3 에 0086 표시, 0084·0085 상태를 배포됨으로 · 화면 지도(오른쪽 열 방장 둘·왼쪽 방장 줄·칩·패널 222·실측 표·새 흐름 넷) · 기획서·구조 문서 한 줄씩 · ROADMAP 성공 기준 1(D-05)·19 완료 표시 · HANDOFF 5217바이트(≤6144)·머리 셋 · 열린 항목 7 닫음 · 위생 검사 통과(새 결과 0) · `git push origin v3`

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

## 단계 3: 문서

- **결정 0086**(`docs/decisions/0086-v3-game-modes.md`, 새 파일): 결정 0086-1~19(19-CONTEXT D-01~D-19 를 한 줄씩), 위임 기본값(P19-0~P19-17), 계획 단계에서 고른 것, 실행 중 달라진 곳(19-01~19-08), 폰 6종 실측, 알려진 한계, 정하지 않은 것. 성공 기준 1 을 D-05 방식으로 바꾼 이유는 0086-5 에 있다.
- **바뀐 결정 표시**: 0081-6 "(구현: 결정 0086 …)", 0083-3 "(0086 으로 바뀜 …)", 0079-3 "(0086 으로 바뀜 …)". 본문은 지우지 않았다.
- **화면 지도**(`docs/screen-map.md`): 대기실 표에 "왼쪽 방장 줄 / 참가자 칩" 행, 오른쪽 열은 방장도 소리·옷장, 방장 패널 = 참가자 패널 222(276·옛 증분 상수 이름 삭제), 방장 줄 접기 식과 실측 표 둘(테스트 방 실측·일반 방 계산), 알려진 한계 둘(접힌 줄과 위 알림·이름표 가림), 표식 여섯, 결과 화면 절, 16·17페이즈 절의 낡은 줄, 자동 검사 절에 19페이즈 흐름 넷과 판정 id.
- **ROADMAP**: Phase 19 성공 기준 1 을 D-05 문구로, 체크 줄과 진행 표를 완료(배포 `71a10fc8`·결정 0086·실기기 확인은 v3.0 끝)로.
- **HANDOFF**: 13~19 완료·배포 version, 위임 기본값 줄에 19, 19 눈 확인 줄, 18.1 눈 확인의 유령을 3D 유령으로, 다음 할 일 1 을 20 으로. 5217바이트.
- **`.planning/WINDOWS.md`**: 19-06 이 적은 열린 항목 7(접힌 줄과 위 알림 겹침)을 "알려진 한계로 받아들임(사용자 방침, 2026-11-12)" 으로 닫았다(waived). 열린 항목 4 → 3.

## Task 커밋

| Task | 커밋 | 내용 |
| --- | --- | --- |
| 1 | `a0944711` fix | 키보드를 닫은 탭의 뒤따르는 click 삼킴(WorldStage + 시험 5개) |
| 1 | `f7efaed8` test | 낡은 360x560 방장 예외를 E2E 에서 없앰(world·avatar) |
| 1 | `71a10fc8` test | 로컬 전체 검증·전 흐름 회귀(SUMMARY 단계 1) — 배포된 커밋 |
| 2 | `fd22b093` docs | minifia-v3 배포 결과(SUMMARY 단계 2) |
| 3 | `97320b17` docs | 결정 0086·화면 지도·HANDOFF |

`commits: 5` 는 이 SUMMARY 를 마무리하는 커밋 앞에서 잰 값이다(`git rev-list --count fad4aa7a..97320b17`). SUMMARY·STATE·ROADMAP 진행을 담은 마지막 커밋이 하나 더 있다.

## 계획과 달라진 점

### 고친 것

**1. [Rule 1 - 버그] 키보드를 닫은 맵 탭이 방장 줄 단추를 눌렀다**
- **찾은 때:** Task 1, 전 흐름 회귀의 chat-keyboard 360x640·390x664·360x560(스스로 다시 시도한 4번 모두 실패 — 재현됨)
- **무엇:** 위 "첫 실행" 표. 계획은 "19-01~19-07 이 넘긴 앱 결함이 있으면 고친다"였고 넘어온 것은 없었다 — 이것은 회귀가 새로 찾은 것이다.
- **고친 것:** `src/components/WorldStage.tsx` 에 `swallowDismissClick`. 입력칸을 blur 한 탭과 같은 자리(10px)·0.5초 안의 click 을 창의 capture 단계에서 한 번 삼킨다. 자리가 다르거나 늦은 click, 걷는 탭은 건드리지 않는다. 시험을 먼저 썼다(5개 중 2개가 실패하는 것을 본 뒤 구현).
- **실기기에서:** 가짜 키보드 E2E 의 탭은 실제로는 키보드가 덮는 자리였다. 다만 큰 폰에서도 보이는 스테이지의 왼쪽 가장자리(방장 줄 자리)를 눌러 키보드를 닫으면 같은 일이 생길 수 있고, 19페이즈 전에도 오른쪽 열에서 같은 일이 가능했다. 실기기 확인은 v3.0 실테스트.
- **파일:** src/components/WorldStage.tsx, test/client/worldStage.test.tsx · **커밋:** `a0944711`

**2. [Rule 1 - 판정] 전제가 없어진 360x560 방장 예외를 없앴다**
- 위 "함께 고친 판정". 19-06 이 넘긴 `world` 의 `hostShort` 에 더해 `avatar-emote`·`avatar-dress` 의 같은 예외도 함께 없앴다(계획에는 world 만 적혀 있었다). · **커밋:** `f7efaed8`

**3. [Rule 2 - 문서] 계획의 파일 목록 밖 문서 넷을 고쳤다**
- `docs/product.md`(판 종류 한 줄, 튜토리얼 함께 진행 문장), `docs/architecture.md`(`modePick` 한 줄) — 결정이 바뀌면 원천 문서를 고친다는 저장소 규칙.
- `docs/decisions/0084`·`0085` 의 상태 줄 "로컬 반영·배포 전" → "구현·배포됨" — 배포 전 health 가 이미 그 커밋들을 담은 `d53d5905` 였다.
- `.planning/WINDOWS.md` 항목 7 닫음(이월 메모). · **커밋:** `97320b17`

### 계획에 없던 작은 선택

4. **전 흐름 회귀를 묶음 일곱으로 나눴다.** 계획은 한 번 실행을 백그라운드로 돌리라고 했지만 명령당 시간 제한 때문에 `--only` 묶음으로 나눠 차례로 돌렸다. 묶음끼리 겹치지 않고 skipByDefault 흐름을 고르지 않게 부분 문자열을 골랐다(`avatar-phases` 가 `avatar-phases-night` 도 골라 그 흐름만 두 번 돌았다 — 둘 다 5/5).
5. **이미 돈 흐름도 다시 돌렸다.** 이월 메모는 19-06·19-07 이 돌린 흐름은 빠진 크기만 채워도 된다고 했지만, 한 커밋에서 전 흐름을 한 번 본 표가 되도록 모두 돌렸다.
6. **커밋을 셋 더 나눴다.** 계획의 Task 1 은 `fix` + `test` 둘인데 판정 정리(`f7efaed8`)를 따로 두었다. SUMMARY 마무리(이 파일·STATE·ROADMAP 진행)는 `commits` 를 잰 값으로 적으려고 문서 커밋 뒤에 따로 커밋했다(19-04·19-05 와 같다).
7. **ROADMAP 진행 표의 19 를 손으로 "Complete" 로 적었다.** 도구(`roadmap.update-plan-progress`)는 8/8 · "In Progress" 로 둔다(페이즈 검증 전). 이월 메모가 완료 표시를 요구해 배포 version·결정 번호와 함께 적었다 — **페이즈 검증(verifier)은 아직 돌지 않았다.**
8. **배포된 커밋은 `71a10fc8` 이고 그 뒤 커밋은 문서뿐이다**(`git diff --stat 71a10fc8..HEAD -- src shared worker public` 은 비어 있다).
9. **nightload 성능 측정은 하지 않았다**(계획 그대로 — 3D 장면을 바꾸지 않았다).
10. **개발 서버는 끄지 않았다.** 시작할 때 이미 떠 있던 것을 썼다.

---

**합계:** 고친 것 3(버그 1·판정 1·문서 1) + 작은 선택 7.
**영향:** 1번은 앱 코드 변경이고 배포에 들어갔다. 나머지는 판정을 더 엄격하게 하거나 문서를 사실에 맞춘 것이다.

## Threat 처리

| Threat | 처리 |
| --- | --- |
| T-19-24 배포 대상 계정 | `node scripts/check-account.mjs` 종료 코드 0 을 먼저 보고 `npm run deploy` 를 가드 우회 없이 돌렸다. 계정 식별자는 어디에도 적지 않았다 |
| T-19-25 공개 저장소 누설 | 커밋마다 위생 검사를 저장소 전체로 돌려 새 결과 0(HEAD 기준 줄 수가 커밋 전후 같다). smoke·배포 출력은 작업 트리 밖 임시 파일 |
| T-19-26 저장된 옛 방 | 읽는 쪽 기본값이 확장판(19-01 시험). 배포 뒤 smoke full 한 판 통과 |
| T-19-27 DO 하루 쓰기 한도 | 회귀는 모두 로컬. 배포본은 health 와 smoke 1회뿐 |
| T-19-SC 패키지 설치 | 설치 없음 |

## 알려진 한계

- **perfbudget B2·M1**: 점광원 4 > 3(2건), 지오메트리 35 > 25(1건). 13페이즈부터 지속, 문턱 불변.
- **errand 간헐 실패(원인 미확정)**: 전 흐름 회귀 첫 실행에서 HS3(알림음 기록을 읽지 못함)가 세 크기에서, 세 크기 다시 실행에서 430x932 의 EA3(띠 문장) 3줄이 실패했다. 430x932 단독 두 번과 폰 6종 다시 한 번은 모두 통과했다. 같은 판정이 이어서 실패하지 않아 고치지 않았다 — 부하가 걸린 실행에서 다시 나올 수 있다.
- **360x560 방장 대기실**: 줄이 두 열로 접히면 입장 알림이 둘째 열 단추를 약 1.5초 덮는다(단추는 눌린다). 고치지 않는다(사용자 방침). 결정 0086.
- **결과 화면의 `expanded` 조건**은 지금 켜질 일이 없고, **`MapChip` 의 줄 아닌 변형**은 어느 화면도 쓰지 않은 채 남아 있다(결정 0086).
- **click 삼킴의 범위**: 키보드를 닫은 뒤 0.5초 안에 같은 자리(10px)를 일부러 다시 누르면 그 한 번은 먹지 않는다.
- **실기기 확인은 v3.0 끝 실테스트**: 방장 왼쪽 줄 색·왕관 표식·판 종류 시트·참가자 칩·기본 마피아 한 판, 키보드를 닫는 탭.
- **페이즈 검증**은 이 계획 밖이다(ROADMAP 완료 표시는 이월 메모에 따른 것).

## Known Stubs

없음.

## 다음에 알아야 할 것 (20페이즈)

- 전 흐름 회귀는 `--only` 묶음 일곱(위 표)으로 나눠 약 31분이다. `reconnect` 하나가 287초, 묶음 F(emcee·errand·witness·trace)가 407초로 길다.
- 배포 전 version 은 HANDOFF 가 아니라 `/api/health` 에서 읽는다.
- 포커스가 풀리며 배치가 바뀌는 곳에 새 단추를 그릴 때는 `chat-keyboard` 를 폰 6종으로 돌려 본다(가짜 키보드는 배치가 즉시 바뀌어 이런 겹침을 잘 잡는다).
- `HOST_RAIL_KNOWN_LIMITS`(접힌 줄과 위 알림)는 받아들인 한계다 — 방장 줄 단추 수가 늘면(20·21페이즈) 접히는 크기가 늘어난다. 줄에 단추를 더하면 `mode-rail` 실측 표를 다시 뜬다.

## Self-Check: PASSED

- 파일 여섯(결정 0086·SUMMARY·WorldStage·시험·화면 지도·HANDOFF) 있음, 커밋 다섯(`a0944711`·`f7efaed8`·`71a10fc8`·`fd22b093`·`97320b17`) HEAD 의 조상
- 배포본 `/api/health` version `2026-11-12T16:47:00Z+71a10fc8`, ROADMAP "19-CONTEXT D-05" 1줄, 진행 절에 단계 1~3

---
phase: 11-result-rematch
plan: "12"
subsystem: result-screen-rematch
tags: [rematch, ready-pill, bench-view, sat, host-handoff, e2e]
requires: ["11-08", "11-09", "11-11"]
provides:
  - "useReady·ReadyPill: 입력줄 오른쪽 끝 알약(손님 준비 토글, 방장 [시작] + n / m)과 쉬게 될 사람 확인"
  - "BenchView: view.resting 이면 단계와 무관하게 쉬는 사람 전용 화면"
  - "쉬었던 사람(sat) 반투명 자리, 결과 단계 꾸미기, 방장 이양 알림, round 변화 초기화"
  - "E2E result-rematch·host-handoff"
affects: ["11-13", "11-14"]
tech-stack:
  added: []
  patterns: ["상태는 훅이 쥐고 화면은 그린다", "서버 state 로 맞추고 거절은 알리지 않는다(L40)", "E2E 순수 판정 함수(rematchChecks) + 읽기 도우미"]
key-files:
  created:
    - src/net/useReady.ts
    - src/components/v2/ReadyPill.tsx
    - src/screens/BenchView.tsx
    - test/client/useReady.test.tsx
    - test/client/readyPill.test.tsx
    - test/client/benchView.test.tsx
  modified:
    - src/screens/ResultScreen.tsx
    - src/screens/RoomScreen.tsx
    - src/components/v2/ChatPanel.tsx
    - src/components/v2/HeadStack.tsx
    - src/components/v2/V2Icon.tsx
    - src/game/resultDirector.ts
    - src/game/resultText.ts
    - src/world/presence.ts
    - src/world/runtime.ts
    - src/world/testHooks.ts
    - src/styles/v2.css
    - src/styles/result.css
    - scripts/e2e/result.mjs
    - scripts/e2e/flows.mjs
decisions:
  - "round 가 바뀐 view 는 chat·resultLog 를 비우고, 월드 저장소는 그 사이 새 snap 이 오지 않았을 때만 비운다(view 보다 snap 이 먼저 와도 방금 받은 위치를 지우지 않는다)"
  - "ReadyPill 에 data-inactive(승리 조명 전)를 따로 둔다 — 방장 흐림(n < 최소)도 aria-disabled 라 둘을 가르려고"
  - "쉬게 될 사람 시트(RestSheet)는 새 파일 없이 ResultScreen.tsx 안에 둔다(계획 파일 목록 준수)"
metrics:
  tasks: 3
  completed: 2026-11-05
status: complete
actuals:
  tokens: 38000
  tasks: 3
  commits: 7
plan_head_before: fb29cd03d229a8dca8851b64ba034122007edd70
plan_head_after: 0a547922fcec96a69ccef47cf00a2b1d5d7984b9
---

# Phase 11 Plan 12: 다시 하기 화면과 방장 이양 Summary

결과 화면 입력줄 오른쪽에 알약 하나(손님 [준비] 토글 / 방장 [시작] + n / m)를 달고, 쉬게 될 사람 확인 시트·쉬는 사람 전용 BenchView·쉬었던 사람(sat) 반투명 자리·결과 단계 꾸미기·방장 이양 알림·round 변화 초기화를 만들었다. 실제 페이지 4개(방장 360×560 + 손님 430×932) + 봇 1 의 E2E `result-rematch` 19/19, `host-handoff`(390×844) 8/8 통과.

## 한 일

- **Task 1 (트레이서)**: `useReady`(손님 250ms 토글 / 방장 인원 부족 토스트·확인값·2초 잠금), `ReadyPill`(96×48, 접근성 이름 계약), ChatPanel `trailing` 슬롯, NameTag `doneLabel`('준비됨'), ResultScreen 연결(승리 조명 4600 이후 활성, 확장 탭이면 ResultPanel `pill` 자리), RoomScreen round 변화 초기화.
- **Task 2**: RestSheet(얼굴 줄 + '이번 판은 쉬어요' + [시작][취소], 초점은 [취소]), BenchView(`data-bench-view`, hourglass 아이콘 V2Icon 에 직접 그림), `satSlots`·`castOf` 의 sat 제외·`SeatLook.opacity` 0.5(런타임이 몸에만 적용), 시상식 뒤 아래 칸 [꾸미기](DressSheet·useDress 재사용), 결과 단계 방장 이양 위 알림 '방장 · 닉네임'(crown), `__mfResult.sat`.
- **Task 3**: `rematchChecks` RM1~RM12 + 읽기 도우미, 흐름 두 개, 표식 계약.

## 검증

- 대상 시험: readyPill·useReady·benchView·resultScreen·roomScreen·chatPanel·worldStage·icon·lobby·resultPanel(client) + resultDirector·presence·e2eContract(unit) + `node --test scripts/e2e/result.test.mjs lib.test.mjs` 331/331. `npm run typecheck` 오류 없음. 전체 회귀·웨이브 게이트·부하 시험은 지시에 따라 돌리지 않았다.
- E2E(개발 서버 포트 5191, 끝나고 종료): `result-rematch` 360x560 **통과 19 / 실패 0**(S1·S2, RM-TAG, RM-LEAK, RM-SAT, G, RM1~RM12, RM1b 손님 430×932), `host-handoff` 390x844 **통과 8 / 실패 0**(S1·S2 ×2, HH1 유예 안 복귀 변화 없음, HH2 길게 끊김 이양, HH3 옛 방장 복귀, HH4 결과 단계 [나가기]). 실행 시간 각 약 38초·28초. 임계값은 낮추지 않았다.
- 시상 중 알약과 패·[넘기기]가 겹치지 않음을 RM11 로 확인했다(360×560 실제 좌표).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 알약 비활성과 방장 흐림을 가를 표식이 없었다**
- **Found during:** Task 3 (RM11 첫 실행이 '시상 중 알약이 비활성' 으로 실패 — 방장 n < 4 흐림도 aria-disabled)
- **Fix:** ReadyPill 이 승리 조명 전(inactive)에만 `data-inactive="true"` 를 더 붙이고 E2E 는 그것으로 가른다. 단위 시험 추가.
- **Files modified:** src/components/v2/ReadyPill.tsx, test/client/readyPill.test.tsx, scripts/e2e/result.mjs, scripts/e2e/flows.mjs
- **Commit:** 0a547922

**2. [Rule 2 - 누락 방지] round 변화 때 월드 저장소를 무조건 비우면 방금 받은 새 판 snap 을 지울 수 있다**
- **Found during:** Task 1 설계(서버가 state 를 보낸 뒤 snap 을 보내고 React 의 렌더·효과는 그 뒤일 수 있다)
- **Fix:** RoomScreen 이 world snap 도착 횟수를 세고, 이전 view 이후 새 snap 이 이미 왔으면 `store.reset()` 을 건너뛴다(snap 이 저장소를 통째로 바꾸므로 비운 것과 같다). chat·resultLog 는 계획대로 항상 비운다. 단위 시험 두 가지(비움/건너뜀).
- **Files modified:** src/screens/RoomScreen.tsx, test/client/roomScreen.test.tsx
- **Commit:** d1934ff4

**3. [Rule 3 - Blocking] Playwright 는 aria-disabled 버튼을 비활성으로 보고 클릭을 기다린다**
- **Found during:** Task 3 (흐린 방장 알약 클릭이 4초 시간 초과)
- **Fix:** 인원 부족 토스트를 보는 한 클릭만 `force: true`(실제 탭도 흐림 상태에서 토스트를 부르는 제품 동작이다).
- **Files modified:** scripts/e2e/flows.mjs
- **Commit:** 0a547922

### 계획과 다르게 한 점(설계 판단)

- `window.__mfResult.sat` 는 런타임이 적용한 값이 아니라 화면이 정한 sat 좌석 목록이다(costumes·dimmed 와 달리). 반투명 적용 자체는 worldStage 단위 시험(`setOpacity`)이 본다.
- RestSheet 는 새 파일이 아니라 ResultScreen.tsx 안의 지역 부품이다.
- 테스트 도우미 `makeView`(resultScreen.test.tsx)에 ready·round·hostSeat·offline·sat 옵션을 더했다.

## 알려진 문제 (이 계획 범위 밖)

- `test/client/v2parts.test.tsx` 의 "hex 색이 없고 놋쇠 토큰을 쓰지 않으며…"·"8페이즈 부품 규칙을 뺀 검사 본문…" 2건이 실패한다. 병렬 실행기 11-11 이 커밋한 `v2.css` 의 `.mf-tl__chip .mv-rolechip`(ad910bd6)이 원인이다. 이 계획의 변경과 무관해 고치지 않았다.
- 병렬 작업 때문에 `plan_head_before..HEAD` 범위(12)에는 11-11 커밋이 섞여 있다. `commits: 7` 은 `git log --grep="(11-12)"` 로 센 값이다.

## Known Stubs

없음.

## Threat Flags

없음. 위협 표 대응: T-11-38(거절 알림 없음·토스트는 인원 부족뿐 — useReady 시험), T-11-39(round 변화 초기화 — 단위 + E2E RM9), T-11-40(BenchView 는 자기 한 줄만, PreGame/GameMap 미마운트 — 단위 + E2E RM-LEAK).

## 이월 메모

- `useReady({view,send,canSend,stageActive})` → `{isHost,mine,ready(n),total(m),canStart,pending,press,toast{text,n},confirm{resting[{seat,nickname}]},confirmStart,cancelConfirm}`. `ReadyPill{host,on,n,m,dim,inactive,onPress}`(표식 data-ready-pill·data-ready·data-ready-count·data-dim·data-inactive). 문구는 `resultText.ts` 의 `READY_TEXT`.
- ResultScreen: 알약 활성 = `mark >= 4600`, 입력줄은 ChatPanel `trailing`, 확장 탭은 ResultPanel `pill`. [꾸미기]는 `ceremonyDone && !expanded && !dressOpen` 일 때 `FloatActions single`(아래 칸). **11-13**: 왼쪽 위 지도 칩 자리와 DressSheet 지도 탭만 더하면 된다(`dressOpen`·`useDress` 는 ResultScreen 에 이미 있다).
- BenchView(`src/screens/BenchView.tsx`)는 RoomScreen 이 `view.resting` 이면 단계와 무관하게 렌더하고 자기 한 점 snap 을 스토어에 먹인다. `.mf-bench*`·`.mf-rest*` 는 result.css.
- sat: `satSlots(seats, mapId)`·`SAT_RADIUS_FX 360`(resultDirector), `castOf` 가 sat 를 뺀다, `SeatLook.opacity`(런타임이 몸에만 `min(처형 연출, opacity)`), 훅 `__mfResult.sat`.
- round 변화 초기화는 RoomScreen 의 `prevRound` 효과(setContext 보다 앞). 월드는 그 사이 새 snap 이 없을 때만 reset.
- result.mjs 새 export: `READY_PILL·rematchChecks(RM1~RM12)·readRematchState·readRestSheet·readBenchView`. flows.mjs: `openGuest({size})`·`openGame({guestSize})`·`ctx.hostToken`·`resultRematchFlow`(약 38초)·`hostHandoffFlow`(약 28초). 결과 화면 E2E 는 `finishCeremony`/`settledResult` 뒤에 잰다. Playwright 는 aria-disabled 를 비활성으로 본다(`force`).
- 알려진 실패: v2parts 2건은 11-11 CSS 때문(위 참고). 최종 계획은 웨이브 게이트(`npm run build`·전체 vitest·ui.safety-gate·schema-drift)를 돌려야 한다.

## Self-Check: PASSED

- 파일 존재: src/net/useReady.ts, src/components/v2/ReadyPill.tsx, src/screens/BenchView.tsx, test/client/useReady.test.tsx, test/client/readyPill.test.tsx, test/client/benchView.test.tsx 확인.
- 커밋 7개(61d58ef9, d1934ff4, 6eba1196, b4f23ba3, 7c3c0c82, ecce7575, 0a547922) 존재, HEAD 의 조상.

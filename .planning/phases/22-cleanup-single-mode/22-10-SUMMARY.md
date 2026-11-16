---
phase: 22-cleanup-single-mode
plan: "10"
subsystem: day-vote-screens
tags: [verdict-count-line, sequential-nomination, host-band, no-execution-notice, ui]
requires: [22-09]
provides:
  - "찬반 패널의 숫자 줄: thumbUp 20 + 찬성 수 · 24 간격 · thumbDown 20 + 반대 수(data-verdict-count=yes|no, role=status '찬성 n표, 반대 m표'). 산 사람 전원 두 단추, 유령은 같은 숫자 줄만. 숫자는 day.verdictCount 뿐이고 이름표 체크(day.voted)·후보 개념은 화면에 없다(D-11·D-26)."
  - "지목 화면은 순차 차례 화면 하나다: 득표 배지·유력 도장·표마다 위 알림·선두 줄·과반 줄·과반 확대·긴장 조명(동시 투표 화면)이 없고, 내 차례에만 이름표가 깜빡이며(blink) 차례 밖은 비활성이다(P22-17)."
  - "끝 줄: 단독 최다 '모두 골랐어요 · {닉네임} 님 n표', 동점(둘이든 셋 이상이든) '동점이에요', 0표 '고른 사람이 없어요'(TURN_COPY.noVotes). 동점·0표 끝에도 장면 막이 덮인다(결선이 없다)."
  - "제목 '찬반'·'지목', 헤더 안내 줄 없음(띠가 말한다). 띠: 찬반 '오늘 처형할까요?'(산 사람 전원, verdict.wait 삭제)·지목 '차례대로 한 명을 골라요'·유령 '지켜봐 주세요'."
  - "찬반 부결(rejected)·지목 동점(tie)·0표(noVotes)는 같은 큰 글 '처형 없음' 1.4초 한 가지, 찬반 통과는 알림 없이 지목으로. aria 접두와 noExecutionText 도 이유와 무관하게 '처형 없음' 한 가지."
affects: [22-11, 22-12, 22-13]
key-files:
  modified:
    - src/screens/GamePanel.tsx
    - src/screens/GameMap.tsx
    - src/screens/RoomScreen.tsx
    - src/components/SceneCurtain.tsx
    - src/game/dayView.ts
    - src/game/hostLine.ts
    - src/game/pickTurn.ts
    - src/game/verdict.ts
    - src/net/useDayFx.ts
    - src/world/presence.ts
    - src/styles/game.css
    - test/client/verdictScreen.test.tsx
    - test/client/nominationScreen.test.tsx
    - test/client/gameMap.test.tsx
    - test/client/callGlow.test.tsx
    - test/client/badgeUi.test.tsx
    - test/client/killFx.test.tsx
    - test/client/runoffScreen.test.tsx
    - test/unit/dayView.test.ts
    - test/unit/hostLine.test.ts
    - test/unit/pickTurn.test.ts
    - test/unit/presence.test.ts
    - test/unit/verdict.test.ts
decisions:
  - "MORNING_MAX_MS 는 16000 그대로 둔다(22-09 가 22-10 에 넘긴 결정). 아침 길이는 시간 목표이고 연출을 줄이는 근거로 쓰지 않는다(CLAUDE.md). 22-06 이 지운 심부름·흔적 줄이 줄었어도 피해자 유언·쪽지 가산은 그대로라 상한은 최대치 기준으로 유효하다."
  - "지목의 빛남(P22-17)은 순차 지목이 원래 쓰던 깜빡임(blink)이 맡는다. callTargetsOf 의 nomination.act 는 공개 값 day.turn 으로 내 차례일 때만 tag 대상을 돌려주도록 계약만 맞췄고(단위 시험 고정), GameMap 은 이름표 call(정지 빛)을 지목에 쓰지 않는다 — 같은 이름표에 blink 와 call 이 겹치지 않게."
  - "UI-SPEC C '끝'(누가 누구를 골랐는지 흔적이 없다)과 '채팅: 지목 줄·찬반 줄 같은 시스템 줄은 쌓이지 않는다' 를 따라 dayEvents 의 지목 vote 줄('A → B')·기권 줄·'투표 시작'·'찬반 시작' system 줄을 지웠다. 계획 문구는 '찬반·지목 줄만' 으로 모호해 UI-SPEC 쪽으로 읽었다."
  - "지목 이름표의 득표 배지(data-count, 내 표 +1 포함)도 지웠다 — UI-SPEC C '공개: 채팅 줄·토스트·득표 배지는 없다'. 누가 누구를 골랐는지는 위 한 줄·핀·손가락이, 집계는 끝 줄이 말한다."
  - "noExecutionText/noExecutionPrefix 는 인자(reason)를 받되 한 가지 글('처형 없음', '처형 없음. ')을 돌려준다 — 22-09 가 남긴 임시 rejected 문구 처리."
metrics:
  tasks: 3
  files-touched: 23
status: complete
actuals:
  tokens: 60000
  tasks: 3
  commits: 6
plan_head_before: 161b0aac
plan_head_after: cdca86823b664ee30d617ad36aa1e6f7f9a3d027
commits: 6
---

# Phase 22 Plan 10: 찬반·지목 화면 Summary

새 서버 흐름(22-09)에 맞춰 찬반(집계 두 숫자만)과 순차 지목(차례 화면 하나)의 화면, 제목·띠 문구, "처형 없음" 한 가지 알림을 정리했다. 동시 투표 화면은 지웠다. 성공 기준 3 의 화면 쪽이 선다.

## 커밋

| 커밋 | 내용 |
| ---- | ---- |
| c130e3bd | `test(22-10)` 찬반 숫자 줄 실패 시험 (RED 1) |
| 3c7dec15 | `feat(22-10)` 찬반 숫자 줄과 전원 투표 화면 (Task 1 GREEN) |
| 125c682f | `test(22-10)` 순차 지목 화면 실패 시험 (RED 2) |
| b91e9a86 | `feat(22-10)` 순차 지목 화면과 내 차례 빛남 (Task 2 GREEN) |
| c83ad49b | `test(22-10)` 찬반·지목 제목·띠·처형 없음 알림 실패 시험 (RED 3) |
| cdca8682 | `feat(22-10)` 찬반·지목 제목과 띠, 처형 없음 알림 하나 (Task 3 GREEN) |

## RED 증거

- RED 1(c130e3bd): `npx vitest run test/client/verdictScreen.test.tsx` **7 failed / 43 passed** (숫자 줄·유령 보기·키보드 열림 등, 소스 변경 전).
- RED 2(125c682f): verdict 외 3파일(`nominationScreen`·`pickTurn`·`hostLine`) **12 failed / 166 passed**.
- RED 3(c83ad49b): `npx vitest run --project client --project unit` **32 failed**(제목·안내 줄·채팅 줄·띠 문장·처형 없음 알림·verdict 문구, 소스 변경 전).

## Task 1: 찬반 숫자 줄

- `GamePanel`: 찬반 줄의 `HeadCount`("투표한 사람 n / m")를 `data-verdict-count-row`(role=status, aria-label "찬성 n표, 반대 m표") 두 덩이로 교체. 처형 후보 제외 분기(`isDefender`·`showVerdictDots`)를 지워 산 사람은 누구나 `VerdictPicker`, 유령은 숫자 줄만. 숫자는 `view.day.verdictCount`(없으면 0·0). `game.css` 에 `.mf-game__vcount`(간격 `--space-lg`·`--space-xs`, transition·animation 없음). 새 토큰·hex·글자 크기·아이콘 없음. 패널 높이 상수는 건드리지 않았다.
- `GameMap`: 찬반 `day.voted` 이름표 체크(`data-done`)를 지움 — D-26이 UI-SPEC B 의 `data-done` 보다 우선한다.
- `HeadCount` 는 토론 끝내기 줄이 쓰므로 남겼다.

## Task 2: 지목 화면

- `pickTurn.ts`: `TURN_COPY.noVotes`, 끝 줄 0표 구별, 동점은 정확히 둘이 아니라 둘 이상 모두 "동점이에요". `isRunoffTie` 삭제, `SceneCurtain.coversNext` 가 동점·0표 끝에도 막을 덮는다(결선이 없다).
- `hostLine.callTargetsOf`: `nomination.act` 는 `day.turn`(차례 중·미확정·order[i]==나)일 때만 tag 대상.
- 동시 투표 화면 삭제: `GameMap` 의 `voting` 분기·`toast` prop·표마다 위 알림 effect·call 이름표 계산, `useDayFx` 의 `toast`/`PointToastShow`, `dayEvents` 의 `toasts`·선두/과반 hot 줄·`(바꿈)`, `DAY_COPY.leadLine/majorityLine`, `presence` 의 과반 확대·선두/과반 긴장 분기(`tensionOf` 는 항상 level 0). 지목 이름표 득표 배지(count)도 지움.
- `.mf-turn__name` 에 `white-space: nowrap` — 8자 닉네임 "{닉네임} 님 차례" 한 줄.

### 지운 부품 목록 / 남긴 부품 판단

- 지움: `voting` 분기, `PointToast`·`toasts`·`PointToastShow`·`toast` prop, `leadLine`·`majorityLine`, 과반 줌·동시 투표 긴장, `isRunoffTie`, 이름표 count(지목).
- **남김(grep 근거)**: `SureStamp`·`VoteBadge`·`HeadStack` 의 `sure`/`lead`/`count`, `WorldStage` 의 `data-lead`, `runtime` 의 lead 박스, `tagOrder.lead`, `ZOOM_MAJORITY`, `pointsTally`/`leaderShift`(손사래). `git grep SureStamp -- src` 은 `HeadStack.tsx` 만 쓰고, `GameMap.tsx` 의 `{ count, sure }` 는 **변론(defense) 변론자 배지**가 쓴다 — 22-11 이 유언으로 바꿀 때 사라진다. `lead` 는 이제 아무도 켜지 않지만 부품 단위 시험(v2parts·voteParts·worldStage·tagOrder)이 묶여 있어 22-11/12 의 변론·결선 정리 때 한꺼번에 지우는 편이 안전하다고 판단했다.
- `pointsTally`·`leaderShift`(선두가 바뀌면 손사래)는 계획의 삭제 목록에 없어 남겼다.

## Task 3: 제목·띠·알림

- `dayView`: `titles.nomination` "지목", `nominationHint`·`nominationGatherHint`·`verdictHint`·`verdictHintSelf` 삭제, `headerFor` 의 nomination·verdict 는 제목만(유령 안내 줄은 그대로). 처형 없음 알림 조건에 `prev.phase === "verdict"`·`reason: rejected` 추가 — 찬반 부결·지목 동점·0표 모두 같은 큰 글 1.4초 한 가지, 찬반 → 지목(통과)에는 알림 없음.
- `hostLine`: `verdict.act` "오늘 처형할까요?"(산 사람 전원, 후보값 읽지 않음), `nomination.act` "차례대로 한 명을 골라요", `verdict.wait` 키·분기 삭제.
- `verdict.ts`: `noExecutionText`/`noExecutionPrefix` 한 가지 글. `RoomScreen` PHASE_ANNOUNCE nomination "지목" 은 이미 그 값이었다(주석만 정리).

## 검증 (실행한 것)

- `npx vitest run test/client/verdictScreen.test.tsx` → 50 passed, `npm run typecheck` 초록 (Task 1).
- `npx vitest run test/client/nominationScreen.test.tsx test/unit/pickTurn.test.ts test/unit/hostLine.test.ts` + typecheck 초록 (Task 2).
- `npx vitest run test/unit/dayView.test.ts test/unit/hostLine.test.ts`, `--project client`, `--project unit` → 201 files passed / 1 skipped, 6792 passed, typecheck 초록 (Task 3).
- 전체 `npx vitest run` 1회: 2 failed — `test/worker/basicDay.test.ts`·`bots.test.ts`(알려진 `--project worker` 부하 flake). 두 파일을 단독 재실행하면 32 passed / 3 skipped. 이 계획은 `shared/`·`worker/` 를 건드리지 않았다.
- 수용 기준 grep: `data-verdict-count` 3건, `day?.voted` 0건, `"고른 사람이 없어요"` 2건, `pointToast|leadLine|majorityLine` 0건, `"오늘 처형할까요?"`·`"차례대로 한 명을 골라요"` 각 1건, `"verdict.wait"` 0건, `nomination: "지목"` 1건.
- 커밋 위생: 저장소 지침의 금지어 검사(git grep)를 바뀐 파일에 돌려 결과 없음.

## Deviations from Plan

### Auto-fixed / 해석 결정

**1. [Rule 2 - 계약 반영] 채팅 시스템 줄(지목 vote 줄·기권·'투표 시작'·'찬반 시작') 삭제**
- **Found during:** Task 3
- **Issue:** 계획 문구는 "찬반·지목 줄만" 으로 모호했으나 UI-SPEC C 가 "다음 단계에는 누가 누구를 골랐는지 흔적이 없다"·"지목 줄·찬반 줄 같은 시스템 줄은 쌓이지 않는다" 를 못 박는다. 채팅 'A → B' 줄은 흔적이다.
- **Fix:** `dayEvents` 에서 해당 줄 삭제, 관련 단위·화면 시험을 새 계약으로 바꿈. 서버 쪽 `voteLog`·채팅 `ballots` 카드는 22-12 몫이라 그대로.
- **Commit:** cdca8682

**2. [Rule 2] 지목 이름표 득표 배지 삭제** — UI-SPEC C 공개 행. **Commit:** b91e9a86

**3. [Rule 1 - 시험 이전] 손으로 만든 view 를 쓰던 시험 정리** — `gameMap`(기본판 투표 describe → 순차 지목 이름표), `callGlow`(투표 이름표 call → blink), `badgeUi`, `killFx`, `runoffScreen`(`coversNext` 동점), `presence`(동시 투표 선두·과반), `dayView`(toasts·제목), `verdictScreen`(`voted`·후보 → `verdictCount`)을 새 wire 모양으로 옮겼다. 동시 투표 전용 시험은 "삭제됨" 단언으로 바꿨다.

그 밖은 계획대로 실행했다.

## Carry-over / 아직 안 한 것

- **22-11/12**: 변론(defense)·처형(execution) 화면 — `defenseHint`·`defenseLine`·`runoffDefenseLine`·`defenderVotes`·변론자 배지(`sure` 도장)·처형 단계의 `찬성 n · 반대 m` 알림·찬반 기록 묶음이 그대로 남아 있다. 그때 `SureStamp`·`VoteBadge` 의 `sure`/`lead`, `HeadStack` `lead` prop, `WorldStage`/`runtime`/`tagOrder` 의 lead 배관을 함께 지운다.
- **22-13**: `scripts/smoke.mjs` 낮 흐름(≈750–870)과 `scripts/e2e` 가 옛 순서·옛 문구에 의존한다. 특히 `scripts/e2e/browser.mjs` 1554행 근처(`'{이름} · 기권'` system 줄 기다림)는 이제 줄이 없어 못 찾는다. `flows.mjs` 의 "투표 시작 직후" 서술도 옛 용어.
- **장면(P22-3)**: 찬반 단계의 조명·카메라는 아직 `vote` 조명·가운데 고정(`presence.FIXED_PHASES`, `lightingOf`)이다. UI-SPEC P22-3 은 "찬반은 토론 장면 그대로, 모이기·dusk 는 지목부터" 라 `scenes.ts`·`presence` 정리가 남았다(내 시험은 현재 동작인 vote 를 고정해 두었다). 22-13 PLAN 이 P22-3 을 다루는지 확인 필요.
- 결선(`runoff`)·마지막 3인(`showdown`) 죽은 화면 코드(`SceneCurtain` runoff 분기, `TURN_COPY.runoff*`, `runoffScreen` 시험)는 이 계획 범위 밖이라 남겼다.
- 실기기·실제 배포본 확인은 하지 않았다(사용자 정책: 실기기 검사는 끝에 몰아서). 360×560 찬반 투표자 스테이지 151 은 계획 가정대로 알려진 한계로 둔다.
- `tensionOf(_view)` 는 호출부 호환용으로 시그니처만 남은 상수 함수다.

## Known Stubs

없음.

## Threat Flags

없음 (새 네트워크 경로·권한 경계 없음. T-22-19: 찬반 화면은 집계 수만 그리고 `data-done` 0건을 시험이 고정. T-22-20: 차례 밖 이름표를 비활성으로 그리되 권위는 서버 `castTurnPoint`).

## Self-Check: PASSED

- 6개 커밋(c130e3bd 3c7dec15 125c682f b91e9a86 c83ad49b cdca8682)이 HEAD 조상에 있다.
- 수정 파일 존재, `src` 쪽 `data-verdict-count`·`TURN_COPY.noVotes`·`"오늘 처형할까요?"` 확인.

---
phase: 23-keyword-day-one
plan: "11"
subsystem: client-keyword-answers-ui
tags: [rolecard, answers-tab, auto-open, result-line, early-calm, host-band, tdd]
requires: ["23-05", "23-06", "23-07", "23-08", "23-09"]
provides:
  - "src/game/keywordView.ts: keywordAnswerOf·keywordAnswersOf·keywordGenreOf — 시트·띠·결과·자동 열림이 읽는 공개 값 한 선택기"
  - "RoleCardSheet '첫날 답' 탭(RoleCardTab 'answers'), 일차 구역 section[data-answer-day] + ol[data-answer-list], 정답 줄 data-answer-correct"
  - "RoomScreen 자동 열림: 첫날 dayAnnounce→discussion 을 같은 연결에서 보면 setRoleCard({ open: true, tab: 'answers' }) 한 판에 한 번"
  - "hostLine 키 ended.answer: 결과 띠 자리에 '정답 · {키워드}' 한 줄(시간 행 없음)"
  - "src/net/earlyCalm.ts: earlyCalmNext(순수)·useEarlyCalm — 같은 단계에서 phaseEndsAt 이 줄면 그 단계 동안 true"
  - "HostBand data-early·calm 고정, PhaseHeader calm prop, 키워드 카드 'n초' calm"
affects: [23-12, 23-13, 24]
actuals:
  tokens: 15700
  tasks: 3
  commits: 7
plan_head_before: 455621a35d3d98aaee4f66f8ab9a77fbabbe795c
plan_head_after: fb8ea453ff96136a2ace7df27853d10a14086e90
tech-stack:
  added: []
  patterns:
    - "공개 값은 keywordView 선택기 한 곳으로만 읽는다(UI-SPEC 남은 위험 '한 선택기', T-23-40)"
    - "조기 진행 감지는 렌더 중 상태 조정(usePhaseArrival 과 같은 방식) — 효과를 기다리지 않아 단축이 보인 같은 렌더에서 calm 이 선다"
    - "구역은 일차 배열(days)이라 24 가 구역·줄(포스트잇)만 더하면 된다"
key-files:
  created:
    - src/game/keywordView.ts
    - src/net/earlyCalm.ts
    - test/unit/earlyCalm.test.ts
  modified:
    - src/components/RoleCardSheet.tsx
    - src/styles/rolecard.css
    - src/screens/RoomScreen.tsx
    - src/game/hostLine.ts
    - src/components/v2/HostBand.tsx
    - src/components/v2/PhaseHeader.tsx
    - src/screens/GameMap.tsx
    - src/screens/Keyword.tsx
    - test/client/roleCardSheet.test.tsx
    - test/client/roomScreen.test.tsx
    - test/client/hostBand.test.tsx
    - test/unit/hostLine.test.ts
    - test/unit/soundDirector.test.ts
decisions:
  - "HOST_HIDDEN_PHASES 는 [lobby, ended] 그대로 두고 hostBandModeOf 가 ended 만 정답 유무로 가른다 — 계획은 목록에서 ended 를 빼라고 했지만 e2e 사본 HOST_OFF_PHASES 가 앱 값과 같아야 한다는 계약 시험(e2eContract)이 걸려 있어 목록을 건드리면 e2e 가 한꺼번에 어긋난다"
  - "'ended.answer' 의 표 값은 접두 '정답 · ' 이고 hostLineOf 가 키워드를 붙인다(표는 모두 문자열이어야 하고 빈 줄 목록 시험을 깨지 않는다)"
  - "useEarlyCalm 은 연결 번호(epoch)를 키에 넣는다 — 재접속 첫 프레임에는 켜지지 않는다는 계약을 HostBand 에 epoch prop 으로 넘겨 지킨다"
  - "HostBand 가 아닌 곳은 각자 hook 을 부른다(HostBand·GameMap 머리·Keyword). 단계 중간에 새로 마운트되면 그 전 단축은 보지 못한다 — 세 곳 모두 단계 시작부터 마운트된 채라 문제없다"
status: complete
---

# Phase 23 Plan 11: 첫날 답 탭·모두의 답 자동 열림·결과 정답 줄·조기 진행 타이머 Summary

첫날 답이 판 내내 남는 기록 카드("첫날 답" 탭, 시민 포함)와 토론 시작 때 한 번 자동으로 열리는 "모두의 답", 결과 띠 자리의 "정답 · 키워드" 한 줄, 마감이 줄어든 단계에서 경고색 없이 미끄러지는 막대를 만들었다. 새 토큰·글자 크기·아이콘·단추·글은 없다. 배포·원격 작업 없음.

## 완료한 일

| Task | 이름 | 커밋 |
|------|------|------|
| 1 RED | 첫날 답 탭 실패 시험 | e6c7dd60 |
| 1 GREEN | 역할 카드에 첫날 답 탭(선택기·탭·구역 목록·정답 줄) | fbf9774f |
| 2 RED | 모두의 답 자동 열림·결과 정답 줄 실패 시험 | 1d70ad33 |
| 2 GREEN | 토론 시작 자동 열림·결과 정답 줄 | c695689b |
| 3 RED | 조기 진행 타이머 표시 실패 시험 | ed15628f |
| 3 GREEN | 조기 진행 막대 calm 고정 | 9c7de53d |
| fix | 닉네임 말줄임 제거(역할 카드 CSS 규약 시험 `journal.test` 가 `text-overflow` 전면 금지) | fb8ea453 |

## 만든 것

- **첫날 답 탭**: 시민 `내 역할 · 첫날 답`, 경찰·의사·마피아 `내 역할 · 활동 기록 · 첫날 답`(3칸은 `.mf-rolecard__tabs--3`). `day.keyword.answers` 가 없으면 탭이 없다(시민은 탭 줄도 없음). 선택되면 시트 이름·제목 "모두의 답". 방향키·Home·End 가 탭 순서대로 돈다. 점·NEW 는 없다.
- **목록**: `section[data-answer-day="1"]`(머리 "1일차" · "장르 : {장르}") 안 `ol[data-answer-list]`. 줄은 번호 원(CSS 원, 서버 `order` 그대로 — 답 없음은 맨 끝에 번호가 이어짐) · 좌석 색 점 · 닉네임 · 답(2줄까지, `keep-all`·`anywhere`). 내 줄은 `night-700` 면에 aria-label "내 답". 글은 텍스트 노드뿐이고 `<b>x</b>` 가 글자 그대로 보인다. `dangerouslySetInnerHTML` 0건.
- **정답 줄**: `keywordAnswerOf(view)` 가 있을 때만 1px `night-600` 선 아래 `정답 · {키워드}`(`data-answer-correct`). 없으면 0건.
- **자동 열림**: `arrivedFrom === "dayAnnounce" && phase === "discussion" && day.n === 1 && 답 목록 있음` 이고 `autoOpened` ref 가 거짓일 때 한 번. 새 판(lobby·assigning)에서 ref 를 되돌려 다시 한 번. 재접속 첫 프레임(arrivedFrom null)·2일차·키워드 없는 판·닫은 뒤에는 열지 않는다. 자동으로 닫히지 않는다.
- **결과 정답 줄**: ended 에서 정답이 있으면 키 `ended.answer`, 줄 `정답 · {키워드}`, 띠 모드 show, 시간 행 없음(ended 는 TIMELESS). 없으면 지금처럼 off(자리 유지, 띠 숨김).
- **조기 진행**: `earlyCalmNext`(순수)·`useEarlyCalm`. 키는 연결·판·일차·단계. 첫 프레임 false, 같은 키에서 마감이 작아지면 true, 번복으로 커져도 유지, 키가 바뀌면 해제. HostBand 루트에 `data-early`, 초·막대 톤 calm 고정. 막대는 기존 `transform 1s linear` 전환이고 모션 줄이기는 기존 CSS(`.mv-host__bar i { transition: none }`)가 이미 즉시 처리해 CSS 변경은 없다. 비율은 남은 시간 ÷ `phaseDurationMs` 그대로.

## timerTone 사용처 점검 (`git grep -n timerTone -- src`)

| 사용처 | 보이는 단계 | 조기 진행 때 | 처리 |
|--------|-------------|--------------|------|
| `HostBand` HostTime(띠 초·막대) | 모든 시간 단계(키워드·찬반·밤 포함) | calm 고정, `data-early` | 이 계획 |
| `PhaseHeader` 링 | 꺼진 장치 머리(LegacyMapHeader)에서만 time/total 이 있다. 기본판 머리에는 링이 없다 | `calm` prop, GameMap 이 단계 마감 기준(비 blocked)일 때만 전달 | 이 계획 |
| `Keyword` 카드 "n초" | 키워드 | calm 고정 | 이 계획(계획 파일 목록 밖, 아래 편차) |
| `Timer`(공통 타이머) | 역할 확인 등 | 기존 `calm` prop 있음, 조기 진행 단계 아님 | 변경 없음 |
| `WillSheet` secs | 유언(defense) | 못 넘기는 단계라 단축 없음 | 해당 없음 |
| `pickTurn.ts`(알약·막대) | 지목·결선 | 단계 마감이 아니라 차례 값, 단축 대상 아님 | 해당 없음 |

즉 키워드·찬반·밤에서 보이는 타이머(띠 초·막대, 키워드 "n초", 링)는 모두 같은 규칙이다. 밤·찬반에서 띠 말고 링·카드 타이머는 기본판에 없다.

## 소리

`director.ts` 는 바꾸지 않았다. 같은 단계에서 `endsAt` 이 바뀌면 같은 키로 대본을 교체하는 기존 규칙이 맞음을 시험 세 개로 고정했다: 찬반 마감이 줄면 같은 키 `phase:verdict:1` 로 새 틱 대본(`[500]`)을 세우고 취소는 없다, 번복으로 늘면 다시 교체, 마감이 같으면 대본을 다시 세우지 않는다(같은 초 경계 이중 발음 없음).

## 검증 결과 (실제로 돌린 것)

- Task 1: `npx vitest run test/client/roleCardSheet.test.tsx test/client/roleCardFlow.test.tsx && npm run typecheck` — 2 files, 111 tests 통과, tsc 오류 0.
- Task 2: `npx vitest run test/client/roomScreen.test.tsx test/unit/hostLine.test.ts test/client/hostBand.test.tsx test/client/resultScreen.test.tsx`(+ `test/unit/e2eContract.test.ts`) — 5 files, 384 tests 통과, tsc 오류 0.
- Task 3: `npx vitest run test/unit/earlyCalm.test.ts test/client/hostBand.test.tsx test/unit/soundDirector.test.ts test/client/gameMap.test.tsx test/unit/countdown.test.ts`(+ keyword·nominationScreen·roomScreen) — 8 files, 427 tests 통과(2 skipped), tsc 오류 0.
- 전체: `npx vitest run --project client --project unit` — 206 files 통과(1 skipped), 6985 tests 통과. 중간에 `test/client/journal.test.tsx` 의 CSS 규약 시험(전체 `text-overflow` 금지)이 닉네임 말줄임에 걸려 한 번 실패했고 말줄임을 빼서 고쳤다(fb8ea453).
- 수락 기준 grep: `data-answer-day` 1, `"answers"` 4, rolecard.css hex 0, `dangerouslySetInnerHTML` 0, `tab: "answers"` 1, `"ended.answer"` 2(HostKey·표), `data-early`(HostBand) 2, `export function earlyCalmNext` 1, PhaseHeader `calm` 5.
- 비밀 위생 grep(변경 파일 전체) 결과 없음.

## Deviations from Plan

**1. [Rule 3 - 계약 보존] HOST_HIDDEN_PHASES 목록을 바꾸지 않았다**
- 계획: "HOST_HIDDEN_PHASES 의 ended 를 이 조건으로 바꾸고". `scripts/e2e/lib.mjs` 의 `HOST_OFF_PHASES` 사본이 앱 값과 같아야 한다는 `e2eContract` 시험과 `lib.test.mjs` 가 `["lobby","ended"]` 를 고정한다. 목록에서 ended 를 빼면 e2e 쪽이 한꺼번에 어긋난다.
- 조치: 목록은 그대로 두고 주석에 예외를 적었으며 `hostBandModeOf` 가 ended 만 정답 유무로 가른다(결과는 계획과 같다: 정답 있으면 show, 없으면 off). 아래 이월 참고.

**2. [Rule 2 - 누락 보강] `src/screens/Keyword.tsx` 도 calm 처리**
- 계획 파일 목록에 없었지만 전원이 내서 마감이 줄면 키워드 카드의 "n초"(`data-tone`)가 마지막 1.5초에 urgent(진홍)가 되어 P23-23 의 취지("단축은 경고가 아니다")에 어긋난다. `useEarlyCalm(view)` 한 줄로 calm 고정.

**3. [Rule 1 - 기존 시험 갱신] hostLine 허용 목록 시험에 `day.keyword`·`day.keyword.answer` 추가**
- 결과 줄이 공개 값 정답을 읽으므로 HOST-05 읽기 허용 목록(`ALLOWED_EXACT`)에 두 경로를 주석과 함께 더했다. 답 목록·장르는 읽지 않는다.

**4. 계획에 없던 작은 추가**: `HostBand` 에 선택 prop `epoch`(RoomScreen 이 `connection.epoch` 전달), `earlyCalmNext(prev, view, epoch = 0)`. 재접속 첫 프레임에 켜지지 않는다는 계약용.

계획의 `files_modified` 중 `src/components/v2/HostBand.tsx` 는 Task 2 에서 변경이 필요 없었다(ended 에서 시간 행 없이 줄만 그리는 것은 기존 `hostTimeOf`·모드 로직이 이미 한다). Task 3 에서만 바꿨다.

## 이월·알려진 한계

- **E2E 사본(23-12·23-13 이 확인)**: `scripts/e2e/lib.mjs` 의 `hostBandChecks` HB6 는 ended 에서 띠 면이 숨김이어야 한다고 기대한다. 키워드 판의 결과 화면은 이제 정답이 있으면 띠가 **보이고** 한 줄 `정답 · {키워드}` 를 가진다. 키워드가 켜진 판의 결과를 e2e 로 훑는 곳에서는 HB6/HB7 기대를 정답 유무로 가르거나 예외를 둬야 한다. 이 계획에서는 e2e 파일을 수정하지 않았고 실행하지도 않았다.
- **자동 열림이 토론 입력을 가림(계획자 가정, 그대로 둠)**: 자동으로 열린 시트는 사용자가 닫을 때까지 열려 있고 자동 닫힘이 없다. 실테스트 뒤 판단.
- `useEarlyCalm` 은 단계 중간에 새로 마운트되는 곳에서는 그 전 단축을 보지 못한다. 현재 호출 세 곳(HostBand·GameMap 머리·Keyword)은 단계 시작부터 마운트된 채라 문제없다. 지목 등에서 같은 단계 안 `phaseEndsAt` 이 줄어드는 다른 이유가 있으면 그 단계도 calm 으로 고정된다(밤·찬반·키워드 외 단계는 서버가 줄이지 않는 것으로 알고 있다).
- 줄은 UI-SPEC 대로 닉네임을 한 줄 고정(`nowrap`)하되 말줄임은 쓸 수 없어(CSS 규약 시험) `max-width: 9em` + `overflow: hidden` 으로 잘라낸다. 닉네임 8자 상한 안에서는 잘리지 않는다.

## 실행하지 못한 확인

- 실기기·브라우저 화면 확인은 하지 않았다(실기기 검사는 끝에 몰아서 하는 방침). 특히 plan 의 backstop 둘: ① 360×560 에서 8명 판 "첫날 답" 목록이 시트 안에서 모두 읽히고 탭·[닫기]가 가려지지 않는가(스크롤 포함), ② 찬반 유예 1.5초 안 번복에서 막대가 다시 늘고 calm 이 유지되는가. 단위 수준에서는 번복 시 calm 유지·막대 비율을 시험했다.
- 결과 화면(ResultScreen) 위에 띠가 보일 때 헤더·카드와 겹치지 않는지의 시각 확인 — 띠 자리는 18.1-12 에서 이미 결과에도 확보되어 있다는 전제로 코드만 확인했다.
- 모션 줄이기의 시트 이동·막대 즉시 전환은 기존 CSS(`.mv-host__bar i`·`mv-ring__bar` `transition: none`, Sheet 의 기존 규칙)를 그대로 쓰며 이 계획에서 따로 화면으로 확인하지 않았다.
- e2e·smoke·원격 배포 확인 없음(NO deploy 지시).

## Known Stubs

없음.

## Threat Flags

없음. 새 네트워크 입구·권한 경로·저장소 변경 없음. T-23-40(정답 줄 한 선택기·값 없을 때 0건 시험), T-23-41(텍스트 노드·`<b>x</b>` 글자 그대로·`dangerouslySetInnerHTML` 0건), T-23-42(`data-early`·자동 열림은 공개 값에서만 파생, 역할 조건 없음) 완화 적용.

## Self-Check: PASSED

- 파일 존재: `src/game/keywordView.ts`, `src/net/earlyCalm.ts`, `test/unit/earlyCalm.test.ts` 확인.
- 커밋 존재: e6c7dd60, fbf9774f, 1d70ad33, c695689b, ed15628f, 9c7de53d, fb8ea453 모두 `v3` 에서 확인. `commits: 7` 은 `git rev-list --count 455621a3..HEAD` 측정값.

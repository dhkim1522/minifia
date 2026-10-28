---
phase: 04-execution-verdict
plan: 27
subsystem: verdict-screens-record-card
tags: [UserRecordSheet, recordRows, voteLog, inspectAllowed, VOTE-04, tdd]
status: complete

requires:
  - phase: 04-execution-verdict
    provides: "04-16·04-18 의 verdictScene 좌석 onInspect(execVote 모두·candidateVote 탈락 viewer), 서버가 모두에게 같게 보내는 day.voteLog·day.claimLog, 03.1-08 의 UserRecordSheet"
provides:
  - "src/game/recordRows.ts — 기록 카드 행 만들기 순수 함수 `recordRows(seat, claimLog, voteLog, nicknameOf)`. 일차 내림차순, 같은 일차는 주장(기록 역순) → 처형 여부 집계 → 후보 선택. 처형 여부 행은 모든 seat 에게 같은 `처형 여부 찬성 N · 반대 M`(미통과면 ` · 미통과`), 후보 선택 행은 voteLog[n].cand.votes 에 이 seat 의 줄이 있을 때만(없으면 탈락·무효표를 구별할 수 없어 행 없음, P-16), 대상 이름을 못 찾으면 `알 수 없는 사람`. 입력 불변, 직업 단어·DOM 없음"
  - "UserRecordSheet 선택 prop `voteLog`·`nicknameOf` — 없으면 이전과 완전히 같은 주장 줄만. 있으면 recordRows 결과를 같은 `li.mf-urecord__row`(일차 | 문장) 모양으로 그리고 투표 행에만 `mf-urecord__row--vote` 를 더한다. 빈 상태 문구 `아직 주장 기록이 없어요` → `아직 기록이 없어요`"
  - "VerdictScene.inspectAllowed — 단계별 기록 카드 허용 값(execVote true, candidateVote `!meAlive`, candidateVoteReveal·defense·execution 및 그 이상 폴백 false). DayScene 은 `verdict?.inspectAllowed ?? inspectable`(claim·discussion·morning) 한 곳으로 정하고, 열려 있는데 허용되지 않는 단계가 되면 렌더 중 상태 조정으로 닫는다. 밤에 닫는 기존 줄은 그대로"
affects: [04-30 — E2E 가 기록 카드를 열 때 빈 상태 문구가 바뀌었다, 04-35 — 배포본에서 날짜별 투표 줄 확인]

actuals:
  tokens: 6600
  tasks: 2
  commits: 4
plan_head_before: c4d6e90375210cdeda48599e36e6da69826800ea
plan_head_after: 103e34fd6ebc216d61787062a95f708c148e9c98

tech-stack:
  added: []
  patterns:
    - "행 만들기는 DOM 없는 순수 함수로 빼고 시트는 그리기만 한다 — 주장 행은 claim 값만 돌려주어 직업 이름 강조(`<b>`)를 시트가 지금 방식대로 만든다"
    - "화면 요소의 허용 단계는 장면 훅(verdictScene)이 `inspectAllowed` 로 알리고 DayScene 이 한 곳에서 닫는다 — 단계마다 DayScene 에 분기를 늘리지 않는다"

key-files:
  created:
    - src/game/recordRows.ts
    - test/unit/recordRows.test.ts
  modified:
    - src/components/UserRecordSheet.tsx
    - src/styles/urecord.css
    - src/screens/DayScene.tsx
    - src/screens/verdictScene.tsx
    - test/client/userRecordSheet.test.tsx
    - test/client/dayScene.test.tsx
    - test/client/execVote.test.tsx
    - test/client/candidateVote.test.tsx

key-decisions:
  - "P-16 확정 구현: 후보 선택 기록이 있는 일차에서 이 사람의 줄이 없으면 행을 만들지 않는다. 사용자 확인은 아직 대기(HANDOFF)"
  - "새 CSS 는 `.mf-urecord__row--vote { color: var(--gray-300) }` 한 줄뿐이다 — 행 모양은 기존 규칙을 그대로 쓴다(계획의 최소 원칙). 대상 이름 `<b>` 는 기존 `.mf-urecord__row b` 규칙(gray-50 굵게)을 그대로 받는다"
  - "닫기 조정은 verdict 계산 직후에 한 줄(`if (inspectSeat !== null && !inspectAllowed) setInspectSeat(null)`)로 두었다. 처형 무효로 온 밤처럼 verdict 가 inspectAllowed 를 비워 두면 기존 낮 단계 규칙(`inspectable`)이 이긴다"

requirements-completed: []  # VOTE-04 는 04-35 의 배포본 검증 뒤에 체크한다(HANDOFF·사용자 지시)

coverage:
  - id: C1
    description: "기록 카드에 날짜별 투표 줄이 쌓인다: 그 일차의 `처형 여부 찬성 N · 반대 M`(미통과면 ` · 미통과`, 모든 사람에게 같은 집계)와 이 사람의 `{대상}님에게 투표했어요`(대상 굵게). 최신 일차가 위, 같은 일차는 주장 → 처형 여부 → 후보 선택 순 (VOTE-04, D-08)"
    requirement: "VOTE-04"
    verification:
      - kind: unit
        ref: "recordRows.test.ts(순서·역순·미통과·cand 없음·이 사람 줄 없음·이름 폴백·불변·key 유일·소스 규약 14건), userRecordSheet.test.tsx(행 순서·굵은 대상 이름·보조 클래스·집계 모두 동일·P-16·개인 표시 없음·마크업 해석 없음·빈 상태·voteLog 없을 때 이전 렌더·입력 불변), dayScene.test.tsx(낮 토론에서 연 카드에 주장·투표 5줄이 일차 내림차순), execVote.test.tsx·candidateVote.test.tsx(해당 단계에서 연 카드에 voteLog 줄)"
        status: pass
      - kind: manual_procedural
        ref: "npm run dev + 테스트 방(봇 5, testBotVote exec=yes pick=other) + 헤드리스 Chrome(playwright-core, 390×844·360×640): testSkip 으로 1일차 전체(execVote → candidateVote → candidateVoteReveal → defense → execution → night → morning)를 지나 2일차 discussion 에 도착한 뒤 좌석 탭. 카드 rows 가 서버 voteLog 와 일치: [\"1일차말하지 않았어요\",\"1일차처형 여부 찬성 5 · 반대 0\",\"1일차봇마바사아님에게 투표했어요\"]. 2일차 execVote 에서도 같은 카드. 콘솔 오류 0. 390×844 스크린샷으로 행·굵은 이름·시트 높이 확인"
        status: pass
    human_judgment: false
  - id: C2
    description: "여부 투표는 개인별 기록이 없다 — 집계 수만 날짜별로 남고, 후보 선택은 서버가 공개 구간 이후 모두에게 보낸 줄만 쓴다. 줄이 없으면 행을 만들지 않는다 (D-02, D-07, P-16, T-04-67)"
    requirement: "VOTE-04"
    verification:
      - kind: unit
        ref: "recordRows.test.ts(집계 줄이 seat 와 무관하게 같고 `^처형 여부 찬성 \\d+ · 반대 \\d+( · 미통과)?$` 형식뿐·target 없음, 소스에 직업 단어·spectate·me.role 없음), userRecordSheet.test.tsx(집계만 있는 카드에 어떤 닉네임도 나오지 않음)"
        status: pass
    human_judgment: false
  - id: C3
    description: "기록 카드는 낮 토론·직업 공개·아침·처형 여부 투표에서 모두에게, 후보 선택에서는 탈락 관전자에게만 열린다. 공개·변론·처형·종료에서는 열리지 않고 이미 열린 카드는 그 단계가 되면 닫힌다. 낮 → 낮 사이에는 닫히지 않고 밤에 닫히는 기존 규칙은 그대로다 (D-35)"
    requirement: "VOTE-04"
    verification:
      - kind: unit
        ref: "execVote.test.tsx(execVote → candidateVote(살아 있는 viewer) 닫힘, → candidateVoteReveal·defense·execution 닫힘, 탈락 viewer 는 candidateVote 에서도 유지, dayAnnounce → discussion → execVote 에서 유지), candidateVote.test.tsx(살아 있는 viewer 의 좌석 탭은 투표·카드 없음·inspect 버튼 0개, 탈락 viewer 는 카드), dayScene.test.tsx(claim → discussion 유지, 밤에 닫힘 불변)"
        status: pass
      - kind: manual_procedural
        ref: "헤드리스 Chrome 실서버(390×844·360×640 두 번): 2일차 execVote 에서 카드를 연 채 기다리면 타임라인이 `낮 · 처형 여부|dialog=1` → 8.4s `낮 · 후보 선택|dialog=0` → 23.4s `낮 · 투표 공개|dialog=0`. 살아 있는 viewer 의 execVote → candidateVote 전환에서 카드가 닫히고 공개에서도 입구가 없다"
        status: pass
    human_judgment: false
  - id: C4
    description: "기록이 하나도 없으면 한 줄 `아직 기록이 없어요`. 이 문구가 옛 `아직 주장 기록이 없어요` 를 대신하고 voteLog·nicknameOf 를 주지 않는 기존 호출은 이전과 같다"
    requirement: "VOTE-04"
    verification:
      - kind: unit
        ref: "userRecordSheet.test.tsx(빈 상태 문구·voteLog 비었을 때·주장 없이 투표 줄만 있으면 빈 상태 없음·voteLog 없으면 투표 행 0), dayScene.test.tsx·execVote.test.tsx(빈 상태 문구). grep `아직 주장 기록이 없어요` 가 src·test 에서 0"
        status: pass
    human_judgment: false
  - id: C5
    description: "실제 폰에서 기록 카드의 가독성(투표 줄이 주장 줄과 섞일 때 한눈에 구분되는지), 다인원 방에서 줄이 많아졌을 때 안쪽 스크롤, iOS Safari 에서의 시트 동작"
    requirement: "VOTE-04"
    verification:
      - kind: manual_procedural
        ref: "헤드리스 Chrome(데스크톱 렌더링)에서 1일차 분량(3줄)만 확인했다. 여러 일차가 쌓여 스크롤이 생기는 경우와 실기기·iOS 는 확인하지 못했다(목록은 기존 `overflow-y: auto` 규칙). 04-35 배포본 + 실기기에서 한다"
        status: partial
    human_judgment: true
---

# Phase 4 Plan 27: 기록 카드 날짜별 투표 줄 Summary

**캐릭터를 눌러 여는 유저 기록 카드에 일차별 `처형 여부 찬성 N · 반대 M`(모두에게 같은 집계, 미통과 표시)와 이 사람의 `{대상}님에게 투표했어요`가 주장 줄과 함께 최신 일차 위로 쌓인다. 기록 카드는 낮 세 단계와 처형 여부 투표에서 모두에게, 후보 선택에서는 탈락 관전자에게만 열리고, 공개·변론·처형 단계가 되면 열린 카드가 닫힌다.**

## 한 일

**Task 1 — recordRows 순수 함수와 UserRecordSheet 투표 줄** — RED `2c3001c` → GREEN `88bf763`
- `src/game/recordRows.ts` 신설. 입력은 공개 `claimLog`·`voteLog` 와 닉네임 조회뿐이다. 주장 행은 문장이 아니라 `claim` 값만 돌려주고 문장화(직업 이름 `<b>` 강조)는 시트가 이전 방식 그대로 한다.
- `UserRecordSheet`: 선택 prop `voteLog`·`nicknameOf`, `recordRows` 결과를 그린다. 투표 행은 `mf-urecord__row--vote` 만 더한 같은 행 모양이다. 빈 상태 `아직 기록이 없어요`.
- 시험(RED 먼저: 유닛은 모듈 없음으로 실패, 시트는 7건 실패 확인). 기존 단언 두 곳(`userRecordSheet.test.tsx` 빈 상태, `dayScene.test.tsx`)을 새 문구로 고쳤다. dayScene 쪽은 Task 1 GREEN 이 문구를 바꾸는 순간 깨지므로 같은 커밋에 넣어 각 커밋이 초록을 유지하게 했다.

**Task 2 — 장면 연결과 열리는·닫히는 단계 규칙** — RED `877397b` → GREEN `103e34f`
- `verdictScene.tsx`: `VerdictScene.inspectAllowed` 를 더하고 단계마다 값을 정했다(execVote true, candidateVote `!meAlive`, 공개·변론·처형·이상 폴백 false).
- `DayScene.tsx`: `voteLog={view.day?.voteLog ?? []}`·`nicknameOf` 를 시트에 잇고, `inspectAllowed = verdict?.inspectAllowed ?? inspectable` 한 곳에서 허용 여부를 정해 허용되지 않는데 열려 있으면 렌더 중 상태 조정으로 닫는다.
- 시험(RED 먼저, 6건 실패 확인): dayScene·execVote·candidateVote 에 투표 줄 렌더, 단계 전환 닫힘, 낮 → 낮 유지, 밤 닫힘 불변.
- 게이트: `npm test` 100 파일 2634 통과, `npm run typecheck`(토큰 점검·wrangler types·tsc 둘) 종료 코드 0, `npm run build` 성공.

## 검증

- 위 게이트 + 헤드리스 Chrome(playwright-core) 실서버(`npm run dev`) 확인: 390×844 와 360×640 에서 봇 5 테스트 방으로 1일차를 끝까지 돌려 2일차 discussion·execVote 에서 카드 내용과 단계 전환 닫힘을 기록했다. 스크립트 `scratchpad/verify27.mjs`(저장소 밖, verify26 의 방 준비를 바탕으로 수정). `npm run dev` 는 이 세션이 띄웠고 끝에 내가 띄운 PID(npm 래퍼와 그 자식)만 종료해 5173 포트가 비었다. 배포하지 않았다.
- 확인하지 못한 것: 실기기·iOS Safari, 여러 일차가 쌓여 카드 안쪽 스크롤이 생기는 경우, 후보 선택에서 탈락한 viewer 가 카드를 여는 경로의 실서버(단위 시험으로만 확인), 후보 선택 줄이 없는 일차(P-16)의 실서버 화면. 360×640 첫 실행 한 번은 출력이 비어 같은 명령을 다시 돌렸고 두 번째 실행에서 위 결과를 얻었다(첫 실행의 원인은 확인하지 못했다).

## Deviations from Plan

None - plan executed exactly as written. 다음은 편차가 아닌 판단 기록이다.

- `dayScene.test.tsx` 의 빈 상태 단언(계획 Task 2 소속)은 Task 1 GREEN 이 문구를 바꾸는 순간 깨지기 때문에 Task 1 GREEN 커밋에 같이 넣었다. 계획의 acceptance 기준(grep 0)은 그대로 만족한다.
- 계획의 `<files>` 에 없는 `test/client/execVote.test.tsx`·`candidateVote.test.tsx` 는 계획 Task 2 (3) 이 명시한 시험 위치라 고쳤다(`<files>` 목록 누락일 뿐 범위 밖이 아니다).

## Known Stubs

없음.

## Threat Flags

없음. 새 네트워크·인증·파일 경로 없음. T-04-67(기록 카드가 개인별 여부 표를 보여 주거나 추정하게 함)은 입력에 개인 여부 표가 없고 행 만들기가 exec 집계만 쓰며 시험이 집계 형식 외 개인 표시가 없음을 단언해 mitigate. 새 패키지 설치 없음(T-04-SC).

## Self-Check: PASSED

- 파일: src/game/recordRows.ts, test/unit/recordRows.test.ts, src/components/UserRecordSheet.tsx, src/screens/DayScene.tsx, src/screens/verdictScene.tsx — 존재 확인
- 커밋: 2c3001c, 88bf763, 877397b, 103e34f — `HEAD` 의 조상 확인

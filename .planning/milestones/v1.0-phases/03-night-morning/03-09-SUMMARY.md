---
phase: 03-night-morning
plan: 09
subsystem: leak-test-and-contract-docs
tags: [tracer, leak-test, spectator, night, decision-record, workerd]
status: complete

requires:
  - phase: 03-night-morning/03-07
    provides: pick 핸들러, 받는 사람 한정 전송(sendViewTo·broadcastEventTo), 관전자 소켓 계약
  - phase: 03-night-morning/03-05
    provides: 밤·아침 view(me.pick·allyPicks·records, day.morning, 탈락자 spectate)
provides:
  - "test/worker/leak.test.ts: 6명 한 판을 두 밤·두 아침까지 실제 pick·마피아 채팅·이모티콘으로 돌리며 모든 프레임을 전수 검사"
  - "docs/decisions/0020-night-morning-contract.md: 밤·아침 와이어 계약, 판정 규칙표(A1·A2), 공개 생존 여부, 받는 사람 규칙, 되돌리기 비용"
  - "결정 0021 문장 정렬: 결정 0016 결과, ROADMAP 3페이즈 성공 기준 4·Notes, REQUIREMENTS REQ-spectator 행, 기획서 탈락자 줄"
affects: [03-10, 03-11, 03-12]

plan_head_before: c4a341b60cc08d732f413cf32242f2fc223b2d96
plan_head_after: c6a63a3f3706892b5dd48819711bb92828aacef1

actuals:
  tokens: 7900   # chars/4 over git diff c4a341b..c6a63a3 (테스트 + 문서 31710자)
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "전수 누출 검사는 소켓마다 프레임을 시간순으로 걸으며 그 시점의 단계·일차·'내가 탈락했는가' 를 따라간다. 같은 프레임에 대해 '살아 있었는가' 로 허용 경로·수신 권리를 바꿔 단언한다"
    - "행동은 보낸 뒤 그 소켓에 ping 을 보내 pong 을 기다린다(flush) — 곧바로 마감을 당겨도 행동이 뒤늦게 도착해 WRONG_PHASE 가 되지 않는다. 시나리오 전체에서 error 프레임 0개를 함께 단언한다"
    - "역할 값 문자열(mafia·police·doctor·citizen·none)이 나온 경로를 [] 로 접어 허용 목록과 대조한다(stringPaths). 탈락한 뒤에만 view.spectate.seats[].job 이 더해진다"

key-files:
  created:
    - docs/decisions/0020-night-morning-contract.md
  modified:
    - test/worker/leak.test.ts
    - docs/decisions/0016-day-loop-structure.md
    - docs/product.md
    - .planning/REQUIREMENTS.md
    - .planning/ROADMAP.md

key-decisions:
  - "결정 0020 을 03-12 직전인 이 시점에 쓴다. 와이어 계약이 코드와 같은 모습으로 굳은 뒤라 문서가 코드와 같다. 되돌리기 비용(PhaseId one-way, pick·템플릿 ID·view·spectate costly, A1·A2 기본값)을 함께 적었다"
  - "누출 검사는 새 단언을 같은 it 안에 둔다(시나리오 한 번 실행). 실패하면 원인을 고치는 규칙이었으나 실패가 없어 코드 수정은 없다"

requirements-completed: []

duration: 약 20분
completed: 2026-10-25

coverage:
  - id: C1
    description: "6명 한 판을 대기실 → 1일차 밤(마피아 지목·경찰 조사·의사 보호·마피아 채팅·이모티콘) → 아침(한 명 탈락) → 2일차 밤 → 아침까지 돌린 모든 프레임에서 남의 토큰·FORBIDDEN_KEYS 가 없고, role·allies 는 view.me 아래에만, players[] 는 다섯 키(alive 포함)이며, 역할 구성표·동료 교차 일치가 유지된다. 비인증 HTTP 응답 19건에도 토큰이 없다"
    requirement: "ROLE-02"
    verification:
      - kind: integration
        ref: "test/worker/leak.test.ts#6명 한 판(두 밤·두 아침, 행동·마피아 채팅·탈락·관전 포함) 전수 누출 검사"
        status: pass
    human_judgment: false
  - id: C2
    description: "살아 있는 소켓의 어떤 프레임에도 spectate 키가 없고, 살아 있는 비마피아 소켓은 밤 chat·emoji 프레임·allyPicks 키가 0개다. 탈락자는 탈락한 아침 state 부터 spectate.seats(실제 직업과 일치)를 받고 2일차 밤에 spectate.picks.mafia 와 마피아 chat 을 받는다. picks 는 밤 state 에만 있다"
    requirement: "ELIM-01"
    verification:
      - kind: integration
        ref: "test/worker/leak.test.ts#6명 한 판(두 밤·두 아침, 행동·마피아 채팅·탈락·관전 포함) 전수 누출 검사"
        status: pass
    human_judgment: false
  - id: C3
    description: "records 키는 경찰 소켓에만(두 밤 기록이 쌓임), pick 은 그 밤 고른 본인 소켓에만(값이 고른 대상과 같음), allyPicks 는 살아 있는 마피아 소켓에만 있다. 받을 사람은 실제로 받았다"
    requirement: "NIGHT-02"
    verification:
      - kind: integration
        ref: "test/worker/leak.test.ts#6명 한 판(두 밤·두 아침, 행동·마피아 채팅·탈락·관전 포함) 전수 누출 검사"
        status: pass
    human_judgment: false
  - id: C4
    description: "역할·주장 값 문자열은 살아 있는 소켓에서 view.me.role·view.me.claim·view.day.roles[]·view.day.claims[].claim 에만, 탈락자 소켓에서는 여기에 view.spectate.seats[].job 이 더해진 경로에만 나온다. 두 아침의 day.morning 은 모든 소켓에서 같은 JSON 이고 첫 아침은 {eliminated: X, phrase: 1..8}, 둘째 아침 문구는 첫 문구와 다르다"
    requirement: "NIGHT-04"
    verification:
      - kind: integration
        ref: "test/worker/leak.test.ts#6명 한 판(두 밤·두 아침, 행동·마피아 채팅·탈락·관전 포함) 전수 누출 검사"
        status: pass
    human_judgment: false
  - id: C5
    description: "낮 chat 프레임 seq 는 1일차 밤 마피아 채팅과 무관하게 이어지고(2일차 줄 = 1일차 줄 + 1), 밤 chat seq 는 밤마다 1부터다(마피아 둘은 1:1,2:1 · 관전자 X 는 2일차 밤 2:1 · 나머지 0줄). 밤 emoji 는 살아 있는 마피아 둘만 받는다"
    requirement: "COMM-04"
    verification:
      - kind: integration
        ref: "test/worker/leak.test.ts#6명 한 판(두 밤·두 아침, 행동·마피아 채팅·탈락·관전 포함) 전수 누출 검사"
        status: pass
    human_judgment: false
  - id: C6
    description: "결정 0020 이 밤·아침 와이어 계약(단계·pick·밤 템플릿 ID·view 필드·spectate·받는 사람 규칙·거부 코드 규칙), 판정 규칙(A1·A2·동률 무작위·의사 구출 비공개·문구 연속 반복 없음), 공개 생존 여부, 수사 기록 점의 폰 메모리, 되돌리기 비용을 적는다. 결정 0016 결과·ROADMAP 성공 기준 4·Notes·REQUIREMENTS REQ-spectator·기획서 탈락자 줄이 결정 0021 과 같은 문장이다"
    requirement: "NIGHT-06"
    verification:
      - kind: other
        ref: "Task 3 수락 기준 grep (A1|A2 4건, 계약 키워드 11건, ROADMAP '공개된 진행만 본다' 0건, 기획서 '결정 0021' 1건, REQUIREMENTS '공개된 진행만 봄' 0건)"
        status: pass
    human_judgment: false
---

# Phase 3 Plan 09: 두 밤·두 아침 전수 누출 검사와 결정 0020 Summary

6명 한 판을 workerd 에서 실제 pick·마피아 밤 채팅·이모티콘으로 두 밤·두 아침까지 돌리며 받은 모든 소켓 프레임을 전수 검사하는 테스트로 비공개 정보 경계를 고정하고, 밤·아침 와이어 계약과 판정 규칙을 결정 0020 에 기록했으며, 원천 문서의 탈락자 문장을 결정 0021 에 맞췄다.

## 한 일

- **Task 1 (tracer)**: `test/worker/leak.test.ts` 시나리오를 대기실 → 1일차 토론(시민 Y 한 줄) → 1일차 밤(마피아 둘이 X 지목, 경찰이 마피아 A 조사, 의사 자기 보호, 마피아 A 의 nightTarget 채팅·이모티콘) → 아침(X 탈락) → 2일차 토론(Y 한 줄) → 2일차 밤(마피아 둘이 Y 지목, 경찰이 마피아 B 조사, 마피아 B 의 nightAgree 채팅) → 아침(Y 탈락)까지 늘렸다. 기존 불변식(토큰·FORBIDDEN_KEYS·role/allies 경로·다섯 키 players·구성표·동료 교차 일치)을 모든 프레임에 그대로 적용했고, 비인증 응답 수 단언은 7에서 19로 맞췄다(probe 단계 6개 × 2 추가).
- **Task 2**: 같은 시나리오 프레임에 소켓별로 시간순 상태(단계·일차·탈락 여부)를 따라가며 밤·관전 불변식을 더했다: spectate 경로(살아 있는 동안 0개, 탈락 뒤 모든 state 에 있고 `seats` 가 실제 직업과 같으며 `picks` 는 밤에만), 밤 chat·emoji(살아 있는 비마피아 0개), records·pick·allyPicks 수신자, 역할 값 문자열 허용 경로, 두 아침 day.morning 일치·문구 연속 반복 없음, 낮 chat seq 연속, 밤 chat seq 밤마다 1부터, 시나리오 전체에 error 프레임 0개.
- **Task 3**: `docs/decisions/0020-night-morning-contract.md` 를 썼고, 결정 0016 결과 첫 항목에 "(3페이즈에서 확정: 결정 0020)" 을 더했으며, ROADMAP 3페이즈 성공 기준 4 둘째 문장·Notes 마지막 문장, REQUIREMENTS `REQ-spectator` 행·Last updated 줄, 기획서 "탈락자" 줄과 역할 줄(동시 해결·고른 표만 센다)을 고쳤다.

## 커밋

| 커밋 | 내용 |
| --- | --- |
| `450db5b` test(03-09) | Task 1: 두 밤·두 아침까지 실제 행동과 채팅으로 돌린 전수 누출 검사(기존 불변식) |
| `587474c` test(03-09) | Task 2: 밤·관전 불변식(spectate·밤 chat·records·pick·allyPicks·역할 값 경로·seq) |
| `c6a63a3` docs(03-09) | Task 3: 결정 0020, 결정 0016·ROADMAP·REQUIREMENTS·기획서 정렬 |

## Deviations from Plan

None - plan executed exactly as written.

계획이 정한 "단언이 실패하면 진짜 누출이다 — 원인을 고친다" 경로는 쓰이지 않았다. 새 단언은 작성 즉시 모두 통과했고(누출 없음, `fix(03-09)` 커밋 없음), 통과가 아무것도 보지 않는 것이 아님을 돌연변이로 확인했다(아래). 아래 두 가지는 계획 본문에 없는 사소한 구현 선택이다.

- 새 단언을 별도 it 로 빼지 않고 같은 it 에 두었다(시나리오를 한 번만 돌린다. 계획이 허용한 선택). 테스트 제한 시간은 60초로 두었으나 실제로는 약 0.2초에 끝난다.
- 기획서의 새 역할 줄은 계획이 말한 "역할 줄(37-39행) 아래" 에 해당하는 "시민" 줄 바로 아래에 넣었다(실제 행 번호는 계획 작성 뒤 달라졌다).

## 돌연변이 확인 (되돌림은 커밋에 없다)

테스트가 실제로 경계를 잡는지 `git checkout -- <파일>` 로 되돌릴 수 있는 임시 변경으로 확인했다.

| 임시 변경 | 결과 |
| --- | --- |
| 모든 탈락 조건을 `true` 로(살아 있는 사람에게도 spectate) | 실패: `expected true to be false` |
| allyPicks 를 마피아가 아닌 역할에도 | 실패: `expected 'police' to be 'mafia'` |
| 밤 chat 수신자를 경찰·의사까지 | 실패: `expected 'police' to be 'mafia'` |
| spectate 직업을 틀리게 | 실패: seats JSON 불일치 |
| 밤 chat 수신자를 전원 id 배열로 바꿈(집합이 아니라 마피아도 못 받음) | 실패: 마피아 밤 줄 `''` ≠ `'1:1,2:1'` — 의도한 전원 방송 변이는 아니지만 밤 줄 수신 단언이 작동함을 보인다. 전원 방송 변이는 위 "경찰·의사까지" 행이 잡는다 |
| pick 뒤 state 를 모든 플레이어에게 | 통과 — 각 소켓이 받는 것은 자기 view 라 새는 값이 없다. 프레임 개수 경계는 `night.test.ts` 의 ping/pong 단언이 지킨다 |

## Authentication Gates

없음.

## Known Stubs

없음.

## Threat Flags

없음. 새 엔드포인트·인증 경로·스키마 변경 없음(테스트와 문서만 바꿨다).

## 위협 모델 대응

| ID | 확인 |
| --- | --- |
| T-03-28 | 6명 두 밤 시나리오 전수 검사: 살아 있는 소켓 spectate·밤 chat(비마피아)·allyPicks(비마피아) 0, records 경찰만, 역할 값 허용 경로(탈락 뒤만 spectate.seats[].job), 낮 chat seq 연속·밤 seq 밤마다 1부터. 새 누출은 없었다 |
| T-03-29 | 결정 0020 이 와이어 계약·판정 규칙·되돌리기 비용을 적었다 |
| T-03-SC | 새 패키지 설치 없음 |

## 검증

- `npx vitest run test/worker/leak.test.ts` 통과, `npx vitest run test/worker/leak.test.ts test/worker/night.test.ts` 18건 통과
- `npx vitest run` 60개 파일·1254건 통과, `npm run typecheck` 종료 코드 0·`error TS` 0
- 수락 기준: leak.test.ts 의 `"morning"` 1 이상·`t: "pick"` 1 이상·`nightTarget` 1 이상·`spectate` 11·`allyPicks|records` 6·`spectate.seats[].job` 1·`seq` 5, 결정 0020 의 `A1|A2` 4·계약 키워드 11, ROADMAP 3페이즈 '공개된 진행만 본다' 0, 기획서 '결정 0021' 1, REQUIREMENTS '공개된 진행만 봄' 0

## HANDOFF 규칙 줄 확인 (PLAN-CHECK W4, 고치지 않고 보기만 함)

`HANDOFF.md` 에서 `살아 있는 사람에게는 보내지 않는다` 와 `탈락자 관전` 이 각각 0건이다. 코디네이터의 사전 정렬이 이 시점에 아직 반영되어 있지 않다. 계획 지시대로 이 계획은 HANDOFF 를 고치지 않으며(CLAUDE.md 는 사용자 소유라 건드리지 않았다), **03-12 Task 3 가 고친다**. 현재 HANDOFF 7행은 "다음은 03-08" 로 03-08 완료를 아직 반영하지 않았다(03-10 이 웨이브 5 의 HANDOFF 를 갱신).

## 다음 계획에 알릴 것

- 03-10 (아침 발표 화면): 아침 `day.morning` 이 모든 소켓에서 같은 JSON 임이 전수 검사로 고정됐다. 화면은 이 값만 읽고 역할로 거르지 않는다.
- 03-11 (수사 기록): 경찰 소켓의 `me.records` 는 두 밤 뒤 `[{n:1,…},{n:2,…}]` 로 쌓이며, 탈락 뒤에도 유지된다는 것은 view 단위 테스트가 지킨다. 기록 내용은 폰 메모리에 저장하지 않는다(개수만, 결정 0020-9).
- 03-12: 배포 직전 HANDOFF 규칙 줄을 결정 0021 문구로 고친다. 배포본 스모크·봇 시나리오가 이 한 판 시나리오와 같은 모양(두 밤·관전)을 돈다.
- 요구사항 완료 표시는 하지 않았다: NIGHT-02·04·06, ELIM-01 은 03-10·03-11 이 화면을 이어서 끝낸다.

## Self-Check: PASSED

- `docs/decisions/0020-night-morning-contract.md`, `test/worker/leak.test.ts` 존재
- 커밋 `450db5b`, `587474c`, `c6a63a3` 모두 HEAD 의 조상
- 측정한 `git rev-list --count c4a341b..HEAD` = 3 = `commits: 3`

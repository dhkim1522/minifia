---
phase: 04-execution-verdict
plan: 03
subsystem: docs-wire-contract
tags: [decision-record, wire-contract, requirements, anonymity, docs]

requires:
  - phase: 04-execution-verdict
    provides: "04-01 의 shared/protocol.ts 와이어 이름(단계 여섯·execVote·voteLog·execTally·noExecution·GameResult)과 04-02 의 초록 기준선"
provides:
  - "결정 0036: 4페이즈 와이어 계약(단계·분기·메시지 두 개·view 필드와 받는 사람·의도적으로 없는 키·처형 무효·문구·승패·종료·봇·배포), 규칙표, 알려진 한계, 바뀔 수 있는 기본값 표, 되돌리기 비용"
  - "결정 0034 14항: 0036 으로 이어지는 한 줄"
  - "REQUIREMENTS CONN-02·GAME-01·COMM-01·SOUND-02 문장과 architecture 끊긴 사람 문장, product 소통·투표 공개 방식·아침 행·효과음 줄을 새 투표 흐름에 맞춤"
affects: [04-04, 04-05, 04-06, 04-07, 04-08, 04-09, 04-12]

actuals:
  tokens: 14000
  tasks: 2
  commits: 3
plan_head_before: 34dd4ce1cdd9f2eaf0ff24b5ac3567e324db9c25
plan_head_after: 85a9e2502c8d4fa82a4346afbc1d27e4d1311c3f
commits: 3

tech-stack:
  added: []
  patterns:
    - "와이어 계약은 결정 문서 한 곳(0036)에 모으고 뒤 계획이 같은 이름을 쓴다 (0020·0027 선례)"
    - "바뀔 수 있는 기본값은 표로 모아 각 행에 '바꾸려면 고칠 곳 한 곳' 을 적는다"

key-files:
  created:
    - docs/decisions/0036-execution-vote-wire.md
  modified:
    - docs/decisions/0034-execution-vote-flow.md
    - .planning/REQUIREMENTS.md
    - docs/architecture.md
    - docs/product.md
    - HANDOFF.md

key-decisions:
  - "여부 투표 동률을 처형 무효 이유 notMajority 로 묶은 것과 A3·A7·A8·A12·A13 을 0036 의 바뀔 수 있는 기본값 표로 모았다 (사용자가 한 번에 확인)"
  - "0036 의 15개 결정 항목은 계획의 항목 순서를 따르되, 모듈 이름 대신 동작·와이어 이름만 적어 구현 위치가 바뀌어도 문서가 안 낡게 했다"

requirements-completed: [VOTE-01, VOTE-02, VOTE-03, VOTE-04, COMM-03, CONN-02, END-01, END-02]

duration: 약 6분 (2026-10-26T12:58:51Z ~ 13:04Z)
completed: 2026-10-26
status: complete
---

# Phase 4 Plan 03: 결정 0036 와이어 계약과 문서 정정 Summary

**4페이즈 와이어 계약(단계 여섯·분기·메시지 두 개·view 필드와 받는 사람·의도적으로 없는 키·처형 무효 이유 코드·승패·종료·봇)을 결정 0036 한 문서에 기록하고, 요구사항·설계·기획 문서의 옛 투표 표현(기권, 어제 주장 이월, 두 투표 모두 비공개)을 결정 0034·0036 에 맞췄다.**

## 진행 기록

Task 1 — 커밋 dd4cbb0 / 수용 기준 그렙 전부 통과 / 남은 태스크 있음(Task 2).
Task 2 — 커밋 b3f24d2 / 옛 표현 부재·새 표현 존재 그렙 통과 / HANDOFF 진행 줄 85a9e25(로컬 커밋만). 남은 태스크 없음.

## Accomplishments

- `docs/decisions/0036-execution-vote-wire.md` 신규. 15개 결정 항목: 단계와 시간(처형 구간 최대 44초, 조기 종료 없음, 투표가 마감을 바꾸지 않음) · 마감 훅 분기와 진입 훅 `at` · 여부 투표 규칙표 · 후보 선택 규칙과 받는 사람(투표자 본인에게만) · 공개 구간 셔플 난수 호출 계약 · 메시지 허용표와 변론 템플릿 ID 여섯 · 처형 문구 · 처형 무효 `day.noExecution`(이유 코드 세 개와 수명) · 아침 문구 일곱 · 승패 · `ended`(마감 없음·30분 만료·`result`) · view 필드 표와 의도적으로 없는 키·서버 전용 키 · 테스트 방·봇 · `voteLog` optional 표기 · 서버 웨이브 단독 배포 금지.
- `## 알려진 한계`(소규모 산술 추론, 1표 통과, 번복이 드러내는 것, 사회적 채널, 방송 증폭), `## 바뀔 수 있는 기본값` 표(A3·A7·A8·A12·A13, 봇 확률·지연, ended 장면, 여부 동률 notMajority, 종료 30분·단계 시간 — 각 행에 고칠 곳), `## 결과`(되돌리기 비용 costly/reversible 구분, 누출 테스트 목록, 0034 7항 종결).
- 결정 0034 에 "14. 와이어 계약·규칙표는 결정 0036 에 적었다." 한 줄(기존 항목 불변).
- `.planning/REQUIREMENTS.md`: CONN-02 새 문장(무효표·행동 없음·말 안 함·이월 없음·끊긴 사람도 생존자 수), GAME-01 단계 순서, COMM-01 보내는 단계, SOUND-02 목록, 마지막 갱신 줄. CONN-02 체크 상태는 그대로(Pending).
- `docs/architecture.md` 끊긴 사람 문장, `docs/product.md` 소통 줄·투표 공개 방식(여부 익명, 후보 선택만 4초 공개)·아침 행(승패면 종료)·효과음 줄.

## Verification

| 명령 | 결과 |
|---|---|
| Task 1 verify (파일·세 절·와이어 이름 열 개) | 통과 |
| `grep -cE '^[0-9]+\. '` 0036 | 15 (기준 15 이상) |
| `grep -c 0036` 0034 | 1 (기준선 0) |
| `grep -c A12`·`A13` 0036 | 1 · 2 |
| 옛 표현 부재 3종·새 표현 존재 5종 그렙 | 통과 |
| CONN-02 체크 상태 `- [ ] **CONN-02**` | 1 (불변) |
| `npx vitest run test/unit/handoff.test.ts` | 통과, HANDOFF 2908바이트 |
| `npm test` (unit·client·worker) | 83 파일 / 1939 통과 / 실패 0 |

코드·테스트는 바꾸지 않았다. `git push`·배포는 실행하지 않았다: push 없음 — 04-05 가 웨이브 1·2·3 을 함께 push.

## Deviations from Plan

None - plan executed exactly as written.

(참고: 0036 의 "고칠 곳" 파일 이름과 누출 테스트 상세 중 아직 만들어지지 않은 것(`execution.ts` 의 `noExecutionOf`, `leak.test.ts` 확장, `endgame.test.ts`)은 04-04~04-09 계획이 정한 이름을 적었다. 04-12 가 코드와 어긋남이 없는지 다시 확인한다 — 위협 T-04-08 의 완화.)

## Known Stubs

없음. 문서 계획이다.

## Threat Flags

없음. 새 코드·네트워크 표면 없음. T-04-07(화면 계획이 개인 투표 표시를 요구)은 0036 의 view 필드 표와 "의도적으로 없는 키" 로, T-04-08(문서·코드 어긋남)은 04-12 의 재확인으로 닫는다.

## Next Phase Readiness

Ready for 04-04. 뒤 계획과 화면 계획이 읽을 단일 기록이 생겼다. 주의: 사용자가 확인할 기본값(A3·A7·A8·A12·A13, 봇 확률)은 0036 `## 바뀔 수 있는 기본값` 표에 모았다.

## Self-Check: PASSED

- 생성 파일 존재: `docs/decisions/0036-execution-vote-wire.md` 확인.
- 커밋 존재: dd4cbb0, b3f24d2, 85a9e25 모두 HEAD 의 조상.

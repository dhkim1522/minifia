---
phase: 04-execution-verdict
plan: 12
subsystem: server-wave-closeout
tags: [docs, validation, handoff, push, no-deploy, decision-0036]
status: complete

requires:
  - phase: 04-execution-verdict
    provides: "04-03 결정 0036, 04-09 누출 회귀망, 04-10·04-11 로컬 소켓 스크립트"
provides:
  - "결정 0036 과 코드의 와이어 이름 대조 완료(어긋남 두 군데, 문서를 코드에 맞춤)"
  - "04-VALIDATION.md 작업별 검증 표(04-01-T1 … 04-11-T2, 23줄), nyquist_compliant true, status server-wave-complete"
  - "HANDOFF.md: 서버 웨이브 완료·배포 금지(D-26)·다음 할 일(화면 계획 순서)·0036 기본값 확인 요청"
  - "main 이 개인 SSH 원격에 push 됨 (배포 없음)"
affects: [화면 계획(/gsd-ui-phase 4 → Add more plans)]

actuals:
  tokens: 4000
  tasks: 2
  commits: 2
plan_head_before: 02274fb2ca07d999c935e2871fedc64a9fbabe08
plan_head_after: ec629674e62446ccd19dce92e25d23e6ac126cc3

tech-stack:
  added: []
  patterns:
    - "문서가 코드를 따른다: 0036 과 코드가 어긋나면 실행으로 검증된 코드가 기준"

key-files:
  created: []
  modified:
    - docs/decisions/0036-execution-vote-wire.md
    - .planning/phases/04-execution-verdict/04-VALIDATION.md
    - HANDOFF.md

key-decisions:
  - "0036 의 '고칠 곳' 두 군데를 코드에 맞췄다: A7 은 applyCandidateVote, 봇 확률 상수 이름은 EXEC_YES_PERCENT"
  - "VALIDATION 표의 로컬 소켓 스크립트(04-10·04-11)는 각 계획 SUMMARY 의 실행 결과를 근거로 green 으로 적었다(04-12 에서는 다시 돌리지 않음)"

requirements-completed: []
requirements-server-rules-done: [VOTE-01, VOTE-02, VOTE-03, VOTE-04, COMM-03, CONN-02, END-01, END-02]  # 서버·공유 로직 몫만. 화면이 걸린 요구사항이라 REQUIREMENTS 체크박스는 열어 둔다

coverage:
  - id: D1
    description: "0036 에 적힌 단계·메시지·view 필드·이유 코드·템플릿 ID·승리 값·상수·단계 시간·봇 확률이 코드와 같다"
    requirement: "END-02"
    verification:
      - kind: automated
        ref: "이름 grep 대조 루프(코드·문서 양쪽) — 누락은 문서의 EXEC_YES_PERCENT 한 개뿐이어서 문서에 추가"
        status: pass
    human_judgment: false
  - id: D2
    description: "전체 게이트 통과"
    requirement: "END-01"
    verification:
      - kind: automated
        ref: "npm test (87 파일 2157 테스트 통과), npm run typecheck (종료 0, error TS 0), node --test scripts/e2e/lib.test.mjs scripts/tsc-scoped.test.mjs (117 통과)"
        status: pass
    human_judgment: false
  - id: D3
    description: "HANDOFF 가 6KB 이하이고 개인 원격에 push 됨, 배포 없음"
    requirement: "END-02"
    verification:
      - kind: automated
        ref: "wc -c HANDOFF.md = 3439, test/unit/handoff.test.ts 통과, git push origin main 02274fb..ec62967"
        status: pass
    human_judgment: false
---

# Phase 4 Plan 12: 서버 웨이브 마무리 Summary

**결정 0036 을 코드와 대조해 어긋난 두 곳을 고치고, 전체 게이트(2157 테스트·두 tsc·스크립트 테스트 117)를 통과시키고, 검증 표와 HANDOFF 를 채워 개인 원격에 push 했다. 배포는 하지 않았다(D-26).**

## 한 일

### Task 1: 0036 대조, 게이트, 검증 표 (72fce7c)

- 대조 대상: 단계 여섯(`execVote`·`candidateVote`·`candidateVoteReveal`·`defense`·`execution`·`ended`), 메시지 두 개, view 필드(`execTally`·`voteAgree`·`voteTarget`·`voteLog`·`candidate`·`execution`·`noExecution`·`result`), 이유 코드 `notMajority`·`tie`·`noVotes`, 변론 템플릿 여섯, 승리 값, 문구 상수, 단계 시간(10·15·4·10·5초), 봇 확률 70%와 지연 범위(1000+[0,6000)·[0,9000)·[0,4000)ms), 종료 방 정리 30분, 마감 훅 분기 표(`ON_DEADLINE`), 이모티콘 허용 단계(`EMOTE_PHASES`).
- 결과: 와이어 이름·숫자는 모두 코드와 같았다.
- 04-VALIDATION.md: 작업별 표 23줄, Wave 0 체크, sign-off 체크, `nyquist_compliant: true`, `wave_0_complete: true`, status `server-wave-complete`. 화면 몫(Manual-Only)은 그대로 두었다.

### Task 2: HANDOFF, push (ec62967)

- HANDOFF 맨 위에 서버 웨이브 완료와 **배포 금지**, 로컬에서도 새 단계 화면이 `연결 중…` 이라는 점, `uat-vote` 확인 명령을 적었다. 다음 할 일 2번을 화면 계획 순서로 바꾸고(시안 승인본 사본 → `/gsd-ui-phase 4` → Add more plans → 함께 배포 → 배포본 검증 → `/gsd-verify-work 4`), 확인 대기에 0036 기본값 확인을 한 줄 더했다. 3439바이트.
- `git push origin main`(개인 SSH 원격) 완료: `02274fb..ec62967`.

## 결정 0036 과 코드의 어긋남

| 항목 | 0036 (이전) | 코드 | 처리 |
|---|---|---|---|
| A7 고칠 곳 | `worker/room.ts` 의 `candidateVote` 수신자 목록 | `worker/room.ts` 의 `applyCandidateVote`(수신자는 투표자 본인) | 문서를 코드에 맞춤 |
| 봇 확률 | `shared/game/bots.ts` 상수(이름 없음) | `EXEC_YES_PERCENT` | 상수 이름을 문서에 추가 |

동작·와이어 이름의 어긋남은 없다. 코드를 문서에 맞춰야 하는 확인 대기 항목도 없다.

## 사용자가 확인할 수 있는 0036 의 기본값

A3 공개·처형 중 이모티콘 거부 · A7 진행 중 후보 선택은 탈락 관전자에게도 안 보냄 · A8 번복마다 즉시 전원 방송 · A12 여부 개인 표는 마감 때 삭제·종료 뒤에도 비공개 · A13 여부 집계는 관전자에게도 같은 값(정족수 없음) · 봇 찬성 70%와 지연 범위 · 여부 투표 동률의 처형 무효 이유를 `notMajority` 로 묶음 · 종료 방 정리 30분과 단계 시간 · `ended` 장면은 임시로 lobby(화면 계획이 정함). HANDOFF "확인 대기" 3번에 요약해 두었다.

## Deviations from Plan

None - plan executed exactly as written. (참고: 검증 표 sign-off 줄의 `nyquist_compliant: true` 문구가 인수 기준 grep 을 2로 만들어 문구를 바꿔 1로 맞췄다.)

## Known Stubs

없음. 이 계획은 코드를 바꾸지 않았다.

## Threat Flags

없음. 새 네트워크·인증·파일 접근 표면 없음. HANDOFF 에 토큰·키를 적지 않았고(T-04-38), 배포를 실행하지 않았다(T-04-39).

## Self-Check: PASSED

- `docs/decisions/0036-execution-vote-wire.md`·`04-VALIDATION.md`·`HANDOFF.md` 존재 확인.
- 커밋 72fce7c·ec62967 이 HEAD 의 조상이며 origin/main 에 push 됨.
- 인수 기준: `nyquist_compliant: true` 1, 작업 ID 줄 23, `04-12 대조` 1, HANDOFF 3439바이트, `배포 금지` 포함, `이슬이 되어 사라졌습니다` 0.

---
phase: 17
review: 17-REVIEW.md
titles: json
findings:
  - id: WR-01
    severity: warning
    disposition: deferred
    title: "첫 사건용 이름 \"나\" 예외가 실제 판의 닉네임 \"나\" 를 가린다"
  - id: WR-02
    severity: warning
    disposition: deferred
    title: "재접속 직후 이미 끝낸 사람에게 장면 1 이 잠깐 다시 시작된다"
  - id: IN-01
    severity: info
    disposition: open
    title: "`protocol.ts` 의 주석이 이미 끝난 일을 \"17-12 가 한다\" 고 쓴다"
  - id: IN-02
    severity: info
    disposition: open
    title: "같은 \"마감 당기기 + tick + afterTransition\" 가 세 곳에 복제됐다"
  - id: IN-03
    severity: info
    disposition: open
    title: "`useTutorialDirector`·`playTutorialCue` 는 소리 실패를 막지 않는데 `useTutorialWarm` 은 막는다"
  - id: IN-04
    severity: info
    disposition: open
    title: "E2E 흐름의 쓰이지 않는 변수와 고정 sleep"
  - id: IN-05
    severity: info
    disposition: open
    title: "방장 스위치의 값이 화면 로컬이라 새로고침하면 초기값으로 돌아간다"
open: 5
total: 7
---

# Phase 17: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| WR-01 | warning | deferred | 닉네임이 정확히 "나" 인 실제 플레이어 한정, 진행에 지장 없음 — 가장자리 문제는 고치지 않는 원칙(작은 화면·가장자리 문제는 그대로). v3.0 끝 실테스트 때 재검토 |
| WR-02 | warning | deferred | 재접속 직후 장면 1 이 잠깐 다시 시작되는 일시 현상, 서버 상태는 정상 — 실기기 검사 때 체감 확인 후 판단 |
| IN-01 | info | open | - |
| IN-02 | info | open | - |
| IN-03 | info | open | - |
| IN-04 | info | open | - |
| IN-05 | info | open | - |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Info 항목은 기록만 하고 처리하지 않았다(advisory).

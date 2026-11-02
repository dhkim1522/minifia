---
phase: 08
review: 08-REVIEW.md
titles: json
findings:
  - id: CR-01
    severity: critical
    disposition: open
    title: "찬반 부결인데 처형 단계 화면 읽기가 \"○○ 님 처형\"이라고 알린다"
  - id: WR-01
    severity: warning
    disposition: open
    title: "지목 동률·0표인 날의 결과 요약이 \"처형 없음 (찬성 0 · 반대 0)\"으로 나오고 동률/무표 구분이 사라진다"
  - id: WR-02
    severity: warning
    disposition: open
    title: "게임 중 방장 화면에서 연결이 끊긴 사람의 이름표가 동작 없는 \"내보내기\" 버튼이 된다"
  - id: WR-03
    severity: warning
    disposition: open
    title: "E2E 실행기가 준비 실패로 재시도할 때 먼저 기록된 검사 실패를 버려 성공으로 바꿔 놓을 수 있다"
  - id: IN-01
    severity: info
    disposition: open
    title: "RoomScreen 의 단계 안내 표에 사라진 상태를 말하는 낡은 주석이 남아 있다"
  - id: IN-02
    severity: info
    disposition: open
    title: "봇·UAT 스크립트의 서버 `ping` 응답 처리는 도달하지 않는 코드다"
  - id: IN-03
    severity: info
    disposition: open
    title: "공유 미리보기 이미지가 v1.0 호스트를 가리킨다"
  - id: IN-04
    severity: info
    disposition: open
    title: "채팅 입력칸 `maxLength` 가 자소가 아니라 UTF-16 코드 단위로 센다"
  - id: IN-05
    severity: info
    disposition: open
    title: "누설 테스트 보조 코드의 종료 승자 값이 와이어 값과 다르다"
open: 9
total: 9
recorded: 2026-11-02T19:16:16.813Z
---

# Phase 08: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| CR-01 | critical | open | - |
| WR-01 | warning | open | - |
| WR-02 | warning | open | - |
| WR-03 | warning | open | - |
| IN-01 | info | open | - |
| IN-02 | info | open | - |
| IN-03 | info | open | - |
| IN-04 | info | open | - |
| IN-05 | info | open | - |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently. ONE exception: when a finding id is REUSED by a different finding, the earlier decision cannot keep a row — the id is taken — and it is dropped. A RECORDED decision (anything but `open`) is named on the console when that happens; a row still at `open` is replaced silently, because `open` records no decision to lose.

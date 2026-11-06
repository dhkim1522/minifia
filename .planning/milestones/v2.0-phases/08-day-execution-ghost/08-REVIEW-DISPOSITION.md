---
phase: 08
review: 08-REVIEW.md
titles: json
findings:
  - id: IN-06
    severity: info
    disposition: skipped
    title: "`summaryLines` 마지막 `else` 의 삼항식이 도달하지 않는 갈래가 됐다"
  - id: IN-07
    severity: info
    disposition: skipped
    title: "실행기가 모은 이전 시도의 검사 실패에 중복·재시도 원인 오인 가능성이 있다"
  - id: CR-01
    severity: critical
    disposition: fixed
    title: "찬반 부결인데 처형 단계 화면 읽기가 \"○○ 님 처형\"이라고 알린다"
  - id: WR-01
    severity: warning
    disposition: fixed
    title: "지목 동률·0표인 날의 결과 요약이 \"처형 없음 (찬성 0 · 반대 0)\"으로 나오고 동률/무표 구분이 사라진다"
  - id: WR-02
    severity: warning
    disposition: fixed
    title: "게임 중 방장 화면에서 연결이 끊긴 사람의 이름표가 동작 없는 \"내보내기\" 버튼이 된다"
  - id: WR-03
    severity: warning
    disposition: fixed
    title: "E2E 실행기가 준비 실패로 재시도할 때 먼저 기록된 검사 실패를 버려 성공으로 바꿔 놓을 수 있다"
  - id: IN-01
    severity: info
    disposition: skipped
    title: "RoomScreen 의 단계 안내 표에 사라진 상태를 말하는 낡은 주석이 남아 있다"
  - id: IN-02
    severity: info
    disposition: skipped
    title: "봇·UAT 스크립트의 서버 `ping` 응답 처리는 도달하지 않는 코드다"
  - id: IN-03
    severity: info
    disposition: skipped
    title: "공유 미리보기 이미지가 v1.0 호스트를 가리킨다"
  - id: IN-04
    severity: info
    disposition: skipped
    title: "채팅 입력칸 `maxLength` 가 자소가 아니라 UTF-16 코드 단위로 센다"
  - id: IN-05
    severity: info
    disposition: skipped
    title: "누설 테스트 보조 코드의 종료 승자 값이 와이어 값과 다르다"
open: 0
total: 11
recorded: 2026-11-03T00:36:55.489Z
---

# Phase 08: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| IN-06 | info | skipped | 수용(D-28, 12-04): 이미 사라짐: `summaryLines` 는 11페이즈가 지웠다(`test/unit/verdict.test.ts` 가 모듈에 없음을 고정). 고칠 코드가 없다 |
| IN-07 | info | skipped | 수용(D-28, 12-04): 실행기 출력(결과 표 중복·재시도 원인 표시)만의 문제이고 실패를 가리지 않는 의도에는 맞는다. 판정·제품 코드에 영향이 없어 고치는 비용이 값어치보다 크다 |
| CR-01 | critical | fixed | 08-REVIEW-FIX.md (not in the current review) |
| WR-01 | warning | fixed | 08-REVIEW-FIX.md (not in the current review) |
| WR-02 | warning | fixed | 08-REVIEW-FIX.md (not in the current review) |
| WR-03 | warning | fixed | 08-REVIEW-FIX.md (not in the current review) |
| IN-01 | info | skipped | 수용(D-28, 12-04): 이미 사라짐: `RoomScreen.tsx` 의 `PHASE_ANNOUNCE` 위 주석은 지금 단계 안내를 바르게 설명하고 사라진 상태를 말하지 않는다 (not in the current review) |
| IN-02 | info | skipped | 수용(D-28, 12-04): `scripts/bots.mjs`·`perf-run.mjs` 의 ping 응답 처리는 개발 보조 스크립트의 방어 코드로, 도달하지 않아도 해가 없고 지우면 얻는 것이 없다 (not in the current review) |
| IN-03 | info | skipped | 수용(D-28, 12-04): 공유 미리보기 이미지(`index.html` og:image) 호스트는 정식 이름·주소가 정해지는 정식 출시 마일스톤에서 한 번에 바꾼다. 지금은 링크 미리보기 그림 하나라 기능 영향이 없다 (not in the current review) |
| IN-04 | info | skipped | 수용(D-28, 12-04): 07 리뷰 IN-02 와 같은 항목: 서버가 자소 100자를 다시 판정하므로 이모지만 쓸 때 입력칸이 먼저 막히는 것은 드문 체감 차이다. 기록만 하고 고치지 않는다 (not in the current review) |
| IN-05 | info | skipped | 수용(D-28, 12-04): `test/worker/ghostLeak.test.ts` 85행의 `winner: "citizens"` 는 단계를 ended 로 강제하는 보조 값일 뿐 단언이 읽지 않는다. 와이어 값(citizenWin)과 달라도 결과가 같다 (not in the current review) |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently. ONE exception: when a finding id is REUSED by a different finding, the earlier decision cannot keep a row — the id is taken — and it is dropped. A RECORDED decision (anything but `open`) is named on the console when that happens; a row still at `open` is replaced silently, because `open` records no decision to lose.

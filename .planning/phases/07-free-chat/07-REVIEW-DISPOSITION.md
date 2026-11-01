---
phase: 07-free-chat
review: 07-REVIEW.md
recorded: 2026-11-02
---

# 07 코드 리뷰 처리 기록

치명 0 · 경고 3 · 참고 10건 중 7. 리뷰는 참고용(차단 아님)이라 실행 중에는 고치지 않았다. 사용자가 자는 동안 코드를 바꾸면 아침 iPhone 확인 대상(배포본 4147d32)과 코드가 어긋나므로, 처리는 `/gsd-verify-work 7` 때 사용자 결정으로 미룬다. 추천은 경고 3건 수정(`/gsd-code-review 07 --fix`) 뒤 재배포다.

| ID | 심각도 | 처리 | 근거 |
|---|---|---|---|
| WR-01 | Warning | open | 로비 좌석 재사용 시 입장 전 줄 복원(결정 0058-2 범위 초과)·옛 줄 이름 바뀜. 추천: 좌석 비울 때 마스크 비트 제거 + 수신 시점 이름 고정 + 나가기·재입장 복원 시험 |
| WR-02 | Warning | open | 로비 입장·퇴장 시스템 줄만 `Date.now()` — `Date.now()+offset` 으로 맞춘다 |
| WR-03 | Warning | open | 낮 시작 옛 "직업 공개" 문구. 사용자 문구 결정 필요(deferred-items.md 의 안 두 개) |
| IN-01 | Info | open | 기록만 |
| IN-02 | Info | open | 기록만 |
| IN-03 | Info | open | 기록만 |
| IN-04 | Info | open | 기록만 |
| IN-05 | Info | open | 기록만 (WR-01 수정 때 함께 다룰 수 있음) |
| IN-06 | Info | open | 기록만 |
| IN-07 | Info | open | 결정 0022 의도 설계, 확인용 |

---
phase: 07-free-chat
review: 07-REVIEW.md
recorded: 2026-11-02
---

# 07 코드 리뷰 처리 기록

치명 0 · 경고 3 · 참고 10건 중 7. 리뷰는 참고용(차단 아님)이라 실행 중에는 고치지 않았다. 사용자가 자는 동안 코드를 바꾸면 아침 iPhone 확인 대상(배포본 4147d32)과 코드가 어긋나므로, 처리는 `/gsd-verify-work 7` 때 사용자 결정으로 미룬다. 추천은 경고 3건 수정(`/gsd-code-review 07 --fix`) 뒤 재배포다.

| ID | 심각도 | 처리 | 근거 |
|---|---|---|---|
| WR-01 | Warning | resolved (12-04) | 로비 좌석 재사용 시 입장 전 줄 복원(결정 0058-2 범위 초과)·옛 줄 이름 바뀜. 추천: 좌석 비울 때 마스크 비트 제거 + 수신 시점 이름 고정 + 나가기·재입장 복원 시험 |
| WR-02 | Warning | resolved (12-04) | 로비 입장·퇴장 시스템 줄만 `Date.now()` — `Date.now()+offset` 으로 맞춘다 |
| WR-03 | Warning | resolved (07-23) | 07-UAT 8 사용자 결정(2026-11-02): 낮 보조줄 삭제, 하단 안내 곧 토론이 시작돼요 |
| IN-01 | Info | open | 기록만 |
| IN-02 | Info | open | 기록만 |
| IN-03 | Info | open | 기록만 |
| IN-04 | Info | open | 기록만 |
| IN-05 | Info | open | 기록만 (WR-01 수정 때 함께 다룰 수 있음) |
| IN-06 | Info | open | 기록만 |
| IN-07 | Info | open | 결정 0022 의도 설계, 확인용 |

## 갭 수정 회차 리뷰 (07-23~07-27, `07-REVIEW-GAPS.md`)

치명 0 · 경고 1 · 참고 5. 처리는 `/gsd-verify-work 7` 때 사용자 결정으로 정한다.

| ID | 심각도 | 처리 | 근거 |
|---|---|---|---|
| GR-WR-01 | Warning | resolved (12-04) | 서버가 150ms 안 둘째 move 를 조용히 버리면 응답 판정이 1.5초 기다린 뒤 거짓 알림·되돌림. 추천: 타이머 콜백에서 `observe` 한 번 더 + 응답 들었으면 알림 없이 비움 + 시험 추가 |
| GR-IN-01 | Info | open | smoothstep 교정 속도 주석은 왕복 약 200ms 까지만 성립 |
| GR-IN-02 | Info | open | `runtime.ts` `was` 계산의 `gapMs` 상한 없음, 영향 작음 |
| GR-IN-03 | Info | open | `notifyMoveSent` 선택 인자 경로를 성능용 메서드로 분리 권장 |
| GR-IN-04 | Info | open | E2E 보강: W11 ms 상한, 도착점 일치, `before` 없을 때 기준 프레임 |
| GR-IN-05 | Info | open | `design/design-system/components/PhaseCards/README.md:5` 옛 낮 보조줄 — 메인 세션에서 정리 |

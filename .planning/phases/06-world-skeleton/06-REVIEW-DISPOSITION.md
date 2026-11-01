---
phase: 06-world-skeleton
review: 06-REVIEW.md
fix_report: 06-REVIEW-FIX.md
recorded: 2026-11-01
---

# 06 코드 리뷰 처리 기록

사용자 결정(2026-11-01): 치명·경고 6건은 지금 수정하고, 참고 6건은 기록만 남긴다.

| ID | 심각도 | 처리 | 근거 |
|---|---|---|---|
| CR-01 | Critical | fixed | a9707d9: 호스트 끝 점 제거 뒤 v1 비교, 변형 거부 테스트 |
| WR-01 | Warning | fixed | 60fa788: frame() try/catch/finally, 다음 프레임 항상 예약 |
| WR-02 | Warning | fixed | a50547b: 숨은 동안 소실 tick 미전달, 복귀 때 시계 다시 셈(recreating 중 복귀하면 5초 포기 시계 재시작) |
| WR-03 | Warning | fixed | 7e71d9c: NICKNAME_MAX_UTF16 256, 초과 시 NICKNAME_INVALID 로 칸 아래 안내 |
| WR-04 | Warning | fixed | 167f62a: TAP_MIN_GAP_MS 250(서버 150 + 여유 100), 서버 검증 그대로 |
| WR-05 | Warning | fixed | 2f0974d: scripts/deploy.mjs 래퍼가 추가 인자를 거부 |
| IN-01 | Info | open | 기록만(사용자 결정) |
| IN-02 | Info | open | 기록만 |
| IN-03 | Info | open | 기록만 |
| IN-04 | Info | open | 기록만 |
| IN-05 | Info | open | 기록만 |
| IN-06 | Info | open | 기록만 |

수정은 배포본(350b7fb)에 아직 없다. 다음 v2 배포 때 들어간다.

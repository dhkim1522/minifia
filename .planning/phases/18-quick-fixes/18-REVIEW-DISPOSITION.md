# 18 코드 리뷰 처리 기록

REVIEW.md 의 지적 7건을 한 줄씩 기록한다. 이번 실행에서는 고치지 않았고 모두 열려 있다(자문용 리뷰, 차단 없음). WR-01·WR-02 는 사용자 판단 후 후속 계획으로 넘긴다.

| ID | 위치 | 상태 | 메모 |
|----|------|------|------|
| WR-01 | shared/game/look.ts:28 | open | 기본 옷 coat 는 저장되지 않아 잠기지 않는다. 시작 때 먼저 누른 쪽이 몰래 바뀔 수 있다 |
| WR-02 | shared/game/rematch.ts | open | 다시 하기에서 쉬는 사람(bench)이 합류하면 같은 옷이 다시 생길 수 있다 |
| IN-01 | shared/game/look.ts | open | 빈 옷이 없으면 겹침이 조용히 남는다(옷 9종 > 자리 8 이라 실제로는 닿지 않음) |
| IN-02 | src/game/tutorialScript.ts | open | 좌석 위치 주석의 반지름 값이 좌석 1과 어긋난다 |
| IN-03 | src/screens/RoleReveal.tsx | open | 빈 hints 칸과 지난 변경 설명 주석이 남았다 |
| IN-04 | scripts/e2e/lib.mjs | open | 옷 개수 9 가 박혀 있고 runLight 에 pageerror 수집이 없다 |
| IN-05 | src/components/v2/FocusRing.tsx | open | clampPoint export, MASK_ID 고정 문자열(한 곳 마운트 전제) |

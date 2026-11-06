---
phase: 09
review: 09-REVIEW.md
titles: json
findings:
  - id: WR-01
    severity: warning
    disposition: open
    title: "알람이 아침 길이 이상 늦으면 syncHome 이 밤→아침→낮을 한 번에 지나 되돌림·아침 snap 을 건너뛴다(마피아 구간이 낮에 남고 시민은 다른 사람 위치 없이 낮 시작)"
  - id: WR-02
    severity: warning
    disposition: open
    title: "PoliceResultCard 얼굴 대체 원의 좌석 색 변수가 --seat-0~7 을 참조해 0번은 색이 없고 나머지는 한 칸 어긋난다(토큰은 1~8)"
  - id: IN-01
    severity: info
    disposition: open
    title: "조합 중 [저장] 뒤 [닫기]를 누르면 첫 콜백만 남아 저장만 되고 시트가 열려 한 번 더 눌러야 닫힌다"
---

# 9페이즈 리뷰 처리 기록

차단(BLOCKER) 0건. 역할·밤 선택 누출 경로는 찾지 못했다. 세 건 모두 9페이즈 보완 계획에서 묶어 고친다(사용자 테스트 목록과 함께).

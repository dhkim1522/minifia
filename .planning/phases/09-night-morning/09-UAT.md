---
status: testing
phase: 09-night-morning
source: [09-VERIFICATION.md]
started: 2026-11-03T08:30:37Z
updated: 2026-11-03T08:30:37Z
---

## Current Test

number: 1
name: 팀(4명 이상)이 배포본에서 낮 + 밤이 이어지는 한 판을 끝까지 한다 (성공 기준 5, 표 D)
expected: |
  이동·채팅·밤 긴장이 대면 마피아 같은 느낌을 주는지 기록한다. 확정 실패 원인도 기록한다.
awaiting: 사용자 실기기·팀 테스트 (09-DEVICE-CHECKS.md 의 표 B·C·D)

## Tests

### 1. 팀 한 판 (표 D)
expected: 낮 + 밤이 맵 위에서 이어지는 한 판을 끝까지, 느낌을 기록
result: [pending]

### 2. 실기기 성능 B1/B12
expected: 5분 평균 55fps 이상, 끊김 5회 이하
result: [pending]

### 3. 시민 편 어둠 가독 B2
expected: 글자 4.5:1 이상, 내 위치를 잃지 않음
result: [pending]

### 4. 밤 이름표·얼굴 칸 누르기 B3/B6/B7
expected: 손가락으로 눌리고 8자 이름이 넘치지 않음
result: [pending]

### 5. 아침 가독과 카드 시간순 B4/B10
expected: 3초 안에 읽히고 카드가 겹치지 않음
result: [pending]

### 6. 유언 시트 + iOS 키보드 B5
expected: 키보드 위에 시트, 저장 뒤 닫힘
result: [pending]

### 7. 맥박·번쩍임·베기·막 체감 B8/B9
expected: 긴장되지만 어지럽지 않음, 모션 줄이기에서 약해짐
result: [pending]

### 8. 다른 기기·브라우저 (표 C)
expected: 각 환경에서 유언 시트·얼굴 칸·이름표 버튼 동작
result: [pending]

## Summary

total: 8
passed: 0
issues: 0
pending: 8
skipped: 0
blocked: 0

## Gaps

<!-- 보완 계획(plan-phase 9 --gaps) 입력. 출처: 사용자 테스트 피드백 09-USER-FEEDBACK.md 묶음 A + 코드 리뷰 09-REVIEW.md.
     묶음 B(5·8·9·12: 순차 지목, 직업 의상 유령, 유언 중앙 공개)는 디자인 시안이 먼저 필요해 이 계획 범위가 아니다. -->

- truth: "채팅을 입력 중인 사람은 머리 위 말풍선에 '…' 이 떠서 다른 사람이 입력 중임을 알 수 있다"
  status: failed
  reason: "User reported: 유저들 채팅치고있을 때 말풍선으로 … 이 안떠서 채팅치고있는건지 보이지않음"
  severity: major
  test: feedback-1
  artifacts: []
  missing: ["입력 중 신호(서버 경유 여부는 계획에서 결정; 비밀 정보 아님)", "말풍선 '…' 표시"]
- truth: "시작 버튼은 참여 인원을 '현재 / 최대' 숫자로 보이고, 최소 시작 인원 전에는 회색 비활성, 충족하면 활성되어 누를 수 있다"
  status: failed
  reason: "User reported: 시작 버튼이 UI/UX가 구림. 참여 인원 n /n 형태로 보이게하고 시작인원이되기전엔 회색형태로 비활성느낌, 최소시작인원되면 활성화되어 누를수있게됨"
  severity: major
  test: feedback-2
  artifacts: []
  missing: ["시작 버튼 비활성/활성 상태 디자인", "최소 시작 인원 기준(기존 규칙 값 사용)"]
- truth: "역할 카드를 고르는 화면의 배경은 v2.0 배경이다(v1 배경 에셋이 나오지 않는다)"
  status: failed
  reason: "User reported: 역할 카드 고를떄 배경이 v1 배경에셋이나옴"
  severity: major
  test: feedback-3
  artifacts: []
  missing: ["역할 카드 화면 배경을 v2.0 승인 배경으로"]
- truth: "모든 시간대(단계)의 남은 시간이 역할 카드의 남은 시간처럼 임박하면 노랑 → 빨강으로 바뀐다"
  status: failed
  reason: "User reported: 모든 시간대에 남은시간이 역할카드 남은시간처럼 노란색 빨간색 형태로 임박형태 보여주는게좋을듯함"
  severity: minor
  test: feedback-4
  artifacts: []
  missing: ["역할 카드의 임박 색 규칙을 공용으로 뽑아 모든 단계 타이머에 적용"]
- truth: "게임 종료 뒤 [처음으로] 등 버튼이 스크롤 없이 한 화면에 모두 보인다"
  status: failed
  reason: "User reported: 게임 종료후 처음으로 등의 버튼이 스크롤내려야보임 한화면에 모두 담겨보이도록 UI/UX 개선필요"
  severity: major
  test: feedback-6
  artifacts: []
  missing: ["종료 화면 레이아웃을 폰 폭·높이별로 한 화면에 (작은 폰 포함)"]
- truth: "역할 카드는 하단 빈 공간 없이 보이는 영역까지만 아래에서 올라온다"
  status: failed
  reason: "User reported: 역할카드는 하단공백이 많이 남는데 그냥 딱 보이는 영역까지만 하단카드가 올라오면될듯함"
  severity: minor
  test: feedback-7
  artifacts: []
  missing: ["역할 카드 높이를 내용에 맞춤"]
- truth: "봇 닉네임은 1~8자 허용 규칙 안에서 길이가 랜덤으로 만들어진다"
  status: failed
  reason: "User reported: 봇테스트시 닉네임 길이도 1~8자 허용규칙내에서 랜덤으로만들어지게하면좋을듯함"
  severity: minor
  test: feedback-10
  artifacts: []
  missing: ["봇 이름 생성 길이 분포(서버 기존 이름 규칙 준수, 시험은 시드 고정 유지)"]
- truth: "낮에 유언 버튼(깃펜)은 채팅 입력줄 오른쪽 끝에 있다: [입력칸][전송][유언]"
  status: failed
  reason: "User reported: 유언이 낮시간에는 채팅 왼쪽이 아니라 다른곳에 위치하는게 UX적으로 좋을듯함 → 결정: 입력줄 오른쪽 끝"
  severity: major
  test: feedback-11
  artifacts: [{path: "src/components/v2/ChatPanel.tsx", issue: "깃펜이 입력줄 왼쪽"}]
  missing: ["깃펜을 오른쪽 끝으로, 전송 버튼과 오터치 방지 간격, 밤 [유언] 행동 줄과 일관"]
- truth: "참여 인원 표시는 점(채움/빈 점)이 아니라 '1 / 5' 숫자 형태로 모든 곳에서 통일된다"
  status: failed
  reason: "User reported: 인원 카운팅 UI를 점과 채워진 점이 아니라 1 / 5 형태로 숫자로 일괄변경 → 결정: 숫자 '1 / 5'"
  severity: major
  test: feedback-13
  artifacts: []
  missing: ["인원 점 표시 부품을 찾아 숫자 표시로 일괄 교체"]
- truth: "알람이 아침 길이 이상 늦어 한 번에 밤→아침→낮을 지나가도, 밤 구간 되돌림과 아침 위치 snap 이 건너뛰어지지 않는다"
  status: failed
  reason: "코드 리뷰 WR-01 (worker/room.ts syncHome): 최종 단계만 보고 night·morning 이 아니면 return 해 마피아 걸음 구간이 낮에 남고 시민 편이 다른 사람 위치 없이 낮을 시작한다"
  severity: major
  test: review-WR-01
  artifacts: [{path: "worker/room.ts", issue: "syncHome 이 알람 지연 시 되돌림·snap 누락"}]
  missing: ["lay.key 가 ':night' 로 끝난 채 지도 단계로 들어오면 teleportHome + snap 을 한 번 수행", "이 경로를 덮는 worker 시험(알람 지연 재현)"]
- truth: "경찰 결과 카드의 얼굴 대체 원은 좌석 색 토큰(--seat-1~8)과 맞는 색이다"
  status: failed
  reason: "코드 리뷰 WR-02 (PoliceResultCard.tsx:31): --seat-0~7 을 참조해 0번은 색이 없고 나머지는 한 칸 어긋난다"
  severity: minor
  test: review-WR-02
  artifacts: [{path: "src/components/PoliceResultCard.tsx", issue: "좌석 색 변수 오프셋"}]
  missing: ["정규화 뒤 +1 (FaceList·GamePanel 과 같은 식)", "회귀 시험"]
- truth: "한글 조합 중 [저장] 뒤 [닫기]를 눌러도 시트가 한 번에 닫힌다"
  status: failed
  reason: "코드 리뷰 IN-01 (useComposedText.ts): settle 이 첫 콜백만 남기고 두 번째를 버려 저장만 되고 시트가 열려 있다"
  severity: minor
  test: review-IN-01
  artifacts: [{path: "src/net/useComposedText.ts", issue: "두 번째 콜백 버려짐"}]
  missing: ["저장 뒤 닫기까지 이어지도록 콜백 처리"]

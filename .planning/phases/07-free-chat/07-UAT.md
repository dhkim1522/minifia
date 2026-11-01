---
status: testing
phase: 07-free-chat
source: [07-VERIFICATION.md]
started: 2026-11-01T18:49:34Z
updated: 2026-11-01T18:49:34Z
---

## Current Test

number: 1
name: iPhone 16 Pro Safari + iOS용 Chrome, 로비(검사 1·2·3·5·6): https://minifia-v2.dhplay.workers.dev?test=1 에서 방 만들기 → 입력칸 탭
expected: |
  입력줄·보내기가 키보드에 안 가려짐 / 맵이 깜빡이거나 크기가 바뀌지 않음 / 내 캐릭터가 남은 맵 영역에 보임 / '안녕하세요' 전송 뒤에도 키보드가 닫히지 않음 / 맵 빈 곳을 눌러 닫을 때 화면이 튀지 않음
awaiting: user response

## Tests

### 1. iPhone 16 Pro Safari + iOS용 Chrome, 로비(검사 1·2·3·5·6): https://minifia-v2.dhplay.workers.dev?test=1 에서 방 만들기 → 입력칸 탭
expected: 입력줄·보내기가 키보드에 안 가려짐 / 맵이 깜빡이거나 크기가 바뀌지 않음 / 내 캐릭터가 남은 맵 영역에 보임 / '안녕하세요' 전송 뒤에도 키보드가 닫히지 않음 / 맵 빈 곳을 눌러 닫을 때 화면이 튀지 않음
result: [pending]

### 2. iPhone 한글 IME(검사 4): '안녕하세요' 마지막 글자 조합 중 키보드 보내기(Enter), 이어서 화면의 보내기 버튼
expected: 기록에 한 줄만, 입력칸에 남는 글자 없음
result: [pending]

### 3. iPhone 테이블 화면(검사 7): [테스트] 봇 3명 → 시작 → 낮 토론까지 넘겨 1·2 반복
expected: 낮 토론 하단에서도 입력줄이 안 가려짐(테이블 아래 인물 가림은 알려진 한계)
result: [pending]

### 4. 두 기기(폰 + PC 등)에서 한쪽이 글자를 입력 (CHAT-04)
expected: 상대 화면의 내 캐릭터 이름표 위에 '…' 가 뜨고 입력을 비우면 사라진다
result: [pending]

### 5. 5분 채팅 부하 체감: iPhone 로비를 둔 채 Mac 에서 node scripts/bots.mjs <방 코드> --count 7 --prod --chat 2 실행
expected: 끊김 체감 없음/가끔, 5분 뒤 열감 차갑다/미지근 (조건 B 데스크톱은 60.00fps·끊김 0 으로 통과, 결정 0055 로 Mac 숫자만으로 통과 선언 불가)
result: [pending]

### 6. https://minifia-v2.dhplay.workers.dev/?chat-mock=1 다섯 줄 (6페이즈 이월, 표 D)
expected: 입력줄 안 가려짐 / 캔버스 크기 불변 / 내 캐릭터 보임 / 한글 조합 Enter / 닫을 때 튐 없음
result: [pending]

### 7. Android Chrome · 삼성 인터넷 · 카카오톡 인앱(iOS·Android) — 로드맵 성공 기준 3 이 명시한 확인 기기
expected: 위 검사 1·2·4 가 같은 방식으로 통과하거나, 사용자가 9페이즈 팀 테스트로 이월을 결정한다
result: [pending]

### 8. WR-03 낮 시작 문구 결정: src/game/scenes.ts 71·79행 '토론 전에 먼저 직업을 공개해요' / '곧 직업 공개가 시작돼요'
expected: 사라진 직업 공개 단계를 안내하는 문구를 어떻게 바꿀지(deferred-items.md 의 두 안) 사용자가 정한다
result: [pending]

## Summary

total: 8
passed: 0
issues: 0
pending: 8
skipped: 0
blocked: 0

## Gaps

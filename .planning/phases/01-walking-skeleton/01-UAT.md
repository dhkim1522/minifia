---
status: complete
phase: 01-walking-skeleton
source: 01-01-SUMMARY.md ~ 01-15-SUMMARY.md (human_judgment 항목 + 01-VERIFICATION.md human_verification)
started: 2026-10-23T09:09:23Z
updated: 2026-10-23T10:12:53.308Z
---

## Current Test

[testing complete]

## Tests

### 1. 첫 화면 (새 브라우저, 배포 주소)
expected: 입장 배경 위에 minifia 제목·소개·닉네임 카드·[방 만들기]·버전 글자, 밤 남색 바탕, 글자 대비 양호
result: issue
reported: "미니피아 폰트를 더 동글동글 귀여운 폰트로 바꾸고 싶다. 전체 폰트 테마를 마피아 감성에 맞게 적용하면 좋겠고, 크기도 더 키워도 될 것 같다. 닉네임·방 코드·참가 4자리 숫자 등이 어두운 회색남색 배경 위 회색 계열이라 잘 안 보이고 비활성화처럼 느껴진다. 나머지는 pass."
severity: minor

### 2. 방 만들기 → 대기실 (8인, 360×640)
expected: 닉네임 입력 후 [방 만들기] → 4자리 방 코드가 있는 대기실. 8명이 앉으면 세로 스크롤 없이 화면에 들어가고 인물이 겹쳐도 이름표를 읽을 수 있다
result: issue
reported: "다 좋다. 다만 원형 테이블이 남색이라 배경과 겹친다. 마피아 게임에 더 적합하고 배경과 겹치지 않는 테이블 에셋을 만들어 추가하면 좋겠다."
severity: cosmetic

### 3. 링크 참가 화면 (/r/코드)
expected: 초대 문구·방 코드·먼저 앉은 사람(인물·이름표)·인원이 보이고, 8명이어도 한 줄 4명씩 두 줄로 접힌다. 마지막 닉네임이 미리 채워지고 열릴 때 포커스·전체 선택이 된다. 닉네임만 넣고 참가하면 대기실로 들어간다
result: pass

### 4. 공유하기·링크 복사·시트 포커스
expected: 방장 폰에서 [공유하기]를 누르면 공유 시트가 열리고, [링크 복사]는 '복사했어요'가 2초 나온다. 시트(나가기 확인 포함)를 열면 포커스가 시트 안으로 가고 닫으면 눌렀던 버튼으로 돌아온다 (iOS Safari)
result: pass

### 5. 카카오톡 링크 미리보기
expected: 카카오톡에 /r/{코드} 링크를 보내면 제목·설명·임시 OG 이미지가 나온다
result: issue
reported: "미리보기는 잘 나온다. 다만 OG 이미지 폰트가 나중에 적용할 앱 폰트와 통일되어야 하고, 단색 남색 배경이 아니라 배경 에셋을 적용한 이미지면 더 예쁠 것 같다. 지금은 너무 단순해서 퀄리티가 떨어진다. (스크린샷: 남색 바탕에 '미니피아' 흰 글씨만 있음)"
severity: cosmetic

### 6. 시작 → 배정 → 내 역할 카드 (360×640)
expected: 4명 이상에서 방장이 시작하면 모든 폰이 배정 화면(막·맥박 링·문구) → 약 3초 뒤 역할 확인. 카드는 내 역할만 뒤집혀 보이고(마피아는 동료도), 설명은 세 줄 이내, 세로 스크롤 없이 들어가며 뒤집기 모션이 자연스럽다
result: pass
source: automated
note: "Playwright(360×640, 8창 분리)로 배포본 확인. 역할 분포 시민4·마피아2·경찰1·의사1, 각자 자기 역할만, 마피아 동료 표시, 설명 1~2줄, 세로 스크롤 없음. 카드 뒤집기 모션 질감은 자동 확인 불가(사용자 판단)"

### 7. 여러 폰 동시 낮 전환
expected: 폰 2대 이상으로 한 판을 시작해 역할 확인 15초 카운트다운을 같이 보면, 모든 폰이 0.5초 이내로 함께 '낮이 되었습니다' 로 넘어가는 것이 체감된다
result: pass
source: automated
note: "8창 낮 전환 시각 차이 2.8ms (같은 PC 시계라 실기기 시계 오프셋은 미반영, 이전 배포 스모크 467ms/상한 500ms). 실기기 체감은 사용자 판단"

### 8. 연결 끊김 띠와 30초 포기
expected: 방 화면에서 네트워크를 끊으면 맨 위에 띠가 내려오고, 다시 붙으면 '다시 연결됐어요' 2초 뒤 사라진다. 끊긴 채 30초가 지나면 포기 화면([다시 시도]/[처음으로])이 나온다
result: pass
source: automated
note: "소켓 강제 단절→재접속: 방장 화면 인원 2→1→2, '다시 연결됐어요' 표시 후 2초 내 사라짐, 단절 지속 시 41초 뒤 포기 화면([다시 시도]/[처음으로]), [다시 시도]로 복귀. 단, 단절 직후 띠가 뜨기까지 약 10초 걸림(클라이언트 close 후 CLOSING 상태 유지, 조용한 단절 감지는 실기기 확인 필요)"

### 9. 화면 잠금 2분 뒤 복귀
expected: 역할 확인 도중과 낮 단계에서 화면을 잠그고 2분 뒤 켜면 같은 자리·같은 역할로 돌아온다
result: issue
reported: "잠금 후 복귀는 확인했다. 다만 낮 화면에서 [내 역할]을 누르면 웹(PC)에서는 괜찮은데 폰에서는 카드가 위에 잠깐 떴다가 아래로 떨어진다."
severity: minor

### 10. 배포 중 재접속
expected: 게임 중 wrangler deploy 로 재배포하면 소켓이 끊겼다가 자동 재접속되고 같은 자리·역할이다 (참고: 배포본에는 닉네임 수정 01-15 가 아직 없음 — 재배포가 필요)
result: skipped
reason: "재배포가 필요해 수정 후 재배포할 때 함께 확인 (사용자 선택)"

### 11. 이미지 해상도 선택과 느린 망
expected: 네트워크 탭에서 @2x/@4x 그림이 화면 밀도에 맞게 선택되고, 느린 망에서도 대기실이 체감상 문제 없이 채워지며 첫 화면 버전 글자가 배포본 버전과 같다
result: pass
source: automated
note: "DPR 1·2 는 @2x, DPR 3 은 @4x 이미지 요청. 첫 화면 버전 v2026-10-23T07:59:34Z+59caa32. 느린 망 체감은 미확인"

## Summary

total: 11
passed: 6
issues: 4
pending: 0
skipped: 1
blocked: 0

## Gaps

- gap_id: G-01-1a
  truth: "전체 폰트가 마피아 감성의 동글동글 귀여운 폰트이고 크기가 충분히 크다"
  status: failed
  reason: "User reported: 미니피아 폰트를 더 동글동글 귀여운 폰트로 바꾸고 싶다. 전체 폰트 테마를 마피아 감성에 맞게, 크기도 더 키워도 될 것 같다"
  severity: cosmetic
  scope: global
  test: 1
  artifacts: []
  missing: []
- gap_id: G-01-1b
  truth: "닉네임·방 코드·참가 4자리 숫자 등이 어두운 남색 배경 위에서 또렷이 보이고 비활성처럼 느껴지지 않는다"
  status: failed
  reason: "User reported: 어두운 회색남색 배경 위 회색 계열이라 잘 안 보이고 비활성화처럼 느껴진다"
  severity: minor
  test: 1
  artifacts: []
  missing: []
- gap_id: G-01-2
  truth: "대기실 원형 테이블이 배경과 구분되고 마피아 게임 분위기에 맞는다"
  status: failed
  reason: "User reported: 원형 테이블이 남색이라 배경과 겹친다. 마피아 게임에 적합하고 배경과 겹치지 않는 테이블 에셋을 새로 만들어 추가하면 좋겠다"
  severity: cosmetic
  note: "새 그림 에셋은 클로드 데스크톱에서 만들어 넘긴다 (결정 0010·0011)"
  test: 2
  artifacts: []
  missing: []
- gap_id: G-01-5
  truth: "링크 미리보기 OG 이미지가 앱 폰트와 통일되고 배경 에셋을 쓴 완성도 있는 모습이다"
  status: failed
  reason: "User reported: 단색 남색 바탕에 '미니피아' 글씨만 있어 너무 단순하다. 폰트를 나중에 적용할 앱 폰트로 통일하고 배경 에셋을 넣으면 좋겠다"
  severity: cosmetic
  note: "G-01-1a(전체 폰트) 가 정해진 뒤 같이 처리. 새 그림은 클로드 데스크톱에서 만들어 넘긴다"
  test: 5
  artifacts: []
  missing: []
- gap_id: G-01-9
  truth: "낮 화면에서 [내 역할]을 누르면 폰에서도 카드가 제자리에서 자연스럽게 열린다"
  status: failed
  reason: "User reported: 웹(PC)에서는 괜찮은데 폰에서는 카드가 위에 잠깐 떴다가 아래로 떨어진다"
  severity: minor
  note: "모바일 전용 증상. 시트 열림 애니메이션·dvh/주소창 높이·transform 기준 위치 등 모바일 브라우저 차이를 진단 대상으로"
  test: 9
  artifacts: []
  missing: []

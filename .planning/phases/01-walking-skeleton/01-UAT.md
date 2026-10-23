---
status: complete
phase: 01-walking-skeleton
source: 01-01-SUMMARY.md ~ 01-15-SUMMARY.md (human_judgment 항목 + 01-VERIFICATION.md human_verification)
started: 2026-10-23T09:09:23Z
updated: 2026-10-23T13:51:00.229Z
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
result: pass
note: "사용자 실기기 확인(2026-10-23): 폰 1 + PC 브라우저 3, 게임 중 두 번 재배포(22:49·22:50 KST). 재연결 띠는 보이지 않았고(재접속이 빨라 띠 전에 복구됐을 가능성) 모두 같은 자리·같은 역할로 유지됨"

### 11. 이미지 해상도 선택과 느린 망
expected: 네트워크 탭에서 @2x/@4x 그림이 화면 밀도에 맞게 선택되고, 느린 망에서도 대기실이 체감상 문제 없이 채워지며 첫 화면 버전 글자가 배포본 버전과 같다
result: pass
source: automated
note: "DPR 1·2 는 @2x, DPR 3 은 @4x 이미지 요청. 첫 화면 버전 v2026-10-23T07:59:34Z+59caa32. 느린 망 체감은 미확인"

## Summary

total: 11
passed: 7
issues: 4
pending: 0
skipped: 0
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
  status: resolved
  resolved_by: 01-17-PLAN.md
  resolved_at: 2026-10-23
  eye_check: "사용자 확인(2026-10-23, 재배포 6e632a0): 다 또렷하게 보인다"
  reason: "User reported: 어두운 회색남색 배경 위 회색 계열이라 잘 안 보이고 비활성화처럼 느껴진다"
  severity: minor
  test: 1
  root_cause: "입력창 라벨·placeholder·구분선 글자가 --gray-300(#a9aebb) 14px 이고 placeholder 는 opacity 0.7 까지 더해 밤 남색 카드 위에서 흐려 보이며, 비활성 [참가] 버튼의 회색과 구분되지 않는다"
  artifacts:
    - path: "src/styles/ds.css"
      issue: "35·43·68행: .mf-field__label / ::placeholder / .mf-entry__divider 가 gray-300, placeholder opacity 0.7"
    - path: "src/styles/ds.css"
      issue: "38-45행: 입력 글자·방 코드(.mf-field__input--code) 크기·대비 키울 여지"
  missing:
    - "라벨·placeholder 를 gray-100 계열로 올리고 placeholder opacity 를 높이며 글자 크기를 키운다"
    - "비활성 [참가] 버튼은 활성 버튼과 구분되되 읽히도록 대비를 맞춘다"
    - "토큰 변경이면 design/tokens.json 과 npm run tokens 로 맞추고 디자인 시스템 사본과의 차이를 기록한다"

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
  status: resolved
  resolved_by: e581bd8 (직접 수정, plan 없음)
  resolved_at: 2026-10-23
  fix: ".mf-dialog overflow: clip — 포커스 이동에 의한 다이얼로그 자동 스크롤 차단(01-18 계측 패널에서 shB 가 dlgB 위로 올라갔다 돌아오는 것으로 확인)"
  device_check: "사용자 실기기 확인(2026-10-23, 배포 e581bd8): 증상 해결"
  reason: "User reported: 웹(PC)에서는 괜찮은데 폰에서는 카드가 위에 잠깐 떴다가 아래로 떨어진다"
  severity: minor
  note: "모바일 전용 증상. 시트 열림 애니메이션·dvh/주소창 높이·transform 기준 위치 등 모바일 브라우저 차이를 진단 대상으로"
  test: 9
  root_cause: "가설(실기기 미확인): [내 역할] 시트는 <dialog> 안에서 mf-sheet-up(translateY 100%→0) 애니메이션으로 올라온다. iOS Safari 는 showModal 직후 첫 프레임을 최종 위치로 그린 뒤 애니메이션을 시작해, 시트가 위에 보였다가 아래로 내려갔다 올라오는 것처럼 보일 수 있다. PC 에서는 재현되지 않음"
  artifacts:
    - path: "src/styles/sheet.css"
      issue: "25행 animation both + 28행 --closing transition: 시트 진입이 CSS animation 하나에만 의존"
    - path: "src/components/Sheet.tsx"
      issue: "showModal 호출과 열림 상태 클래스 부여 시점(첫 프레임 처리)"
  missing:
    - "진입 모션을 열림 직후 한 프레임 뒤에 시작하도록(예: 시작 클래스를 다음 프레임에 부여, 초기 transform 을 translateY(100%) 로 고정) 바꾼다"
    - "실기기(iOS Safari·Android Chrome)에서 [내 역할]·공유 시트·나가기 시트가 모두 아래에서만 올라오는지 확인한다"
    - "가설이 틀리면 실기기 화면 녹화나 증상 순서를 받아 원인을 다시 진단한다"
  post_fix_report:
    plan: 01-16 (Task 3 실기기 확인, 2026-10-23)
    result: failed
    gap_status: open
    device: "iPhone, iOS Safari (OS 버전 미기재), 개발 서버 LAN 주소(192.168.32.80:5173, npm run dev)"
    sheet: "낮 화면('1일차 낮이 되었습니다')의 [내 역할] 시트, 두 번 열어 봄. 공유·나가기 확인 시트는 이 녹화에 없음"
    user_said: "여전합니다. 다만 중앙에 떴다 내려가네요"
    recording: "/Users/dhkim1522/Downloads/ScreenRecording_10-23-2026 19-45-10_1.MP4 (4.67초, 60fps, 1206x2622, 사용자 로컬 파일, 저장소에 넣지 않음)"
    symptom_order:
      - "1. 시트가 아래에서 올라온다. 첫 프레임이 최종 위치로 그려지는 일은 없다(수정 전 증상 '위에 먼저 뜸'과 달라짐)"
      - "2. 올라와서 멈춘 자리가 실제 화면 아래 끝보다 약 60px 위다. 보이는 시트 높이 약 330px 의 약 18%. 시트 아래로 벽돌 배경이 보이고 그 밑에 Safari 하단 툴바가 있다"
      - "3. 열린 지 약 0.2초 뒤 시트 전체가 약 60px 아래로 툭 내려와 바닥에 붙는다. 사용자는 이것을 '중앙쯤에 떴다가 내려간다'로 본다"
    observer_note: "오케스트레이터가 녹화를 60fps 프레임 단위로 본 관찰이며 원인이 검증된 것은 아니다"
    interpretation: "증상이 '첫 프레임 위치'에서 '열린 뒤 정지 위치가 바뀜'으로 이동했다. 01-16 의 두 프레임 뒤 열림 수정은 첫 프레임 문제에는 효과가 있어 보이나 갭은 닫히지 않았다. 가설(첫 프레임 처리)은 일부만 맞고 남은 원인이 따로 있다"
    next: "재진단 필요. 후보와 순위는 01-16-SUMMARY.md 참조(1순위: 열린 뒤 dvh/하단 기준선 변화). 추측 코드 수정은 하지 않았다"

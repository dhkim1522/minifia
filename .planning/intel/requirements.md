# 요구사항 (requirements)

> PRD 1건(`docs/product.md`, 초안 2026-10-21, 규칙 수치는 플레이테스트 후 조정)에서 추출. 원문에 별도의 인수 기준(acceptance criteria) 섹션이 없어 `acceptance` 는 "원문에 명시 없음"으로 표시한다. 동작 규칙은 `description` 에 원문 그대로 담았다. 경쟁하는 변형(competing variants)은 없다.

## REQ-quick-session
- source: /Users/dhkim1522/personal/minifia/docs/product.md
- description: 친구들이 점심시간에 한두 판 가볍게 할 수 있는 마피아 게임. 한 판 5~10분이며 오래 해서 피곤한 게임이 아니다. 밤부터 처형까지 한 라운드 약 3분, 보통 2~3라운드에 끝나 역할 확인·결과 화면을 합쳐 약 6~10분.
- acceptance: 원문에 명시 없음
- scope: 목표, 한 판 길이

## REQ-simple-ux
- source: /Users/dhkim1522/personal/minifia/docs/product.md
- description: 처음 하는 사람도 설명 없이 따라올 수 있는 단순한 UI/UX.
- acceptance: 원문에 명시 없음
- scope: 목표, UI/UX

## REQ-no-install-join
- source: /Users/dhkim1522/personal/minifia/docs/product.md
- description: 설치 없이 링크나 QR 로 바로 참가한다.
- acceptance: 원문에 명시 없음
- scope: 목표, 참가 방식

## REQ-play-environment
- source: /Users/dhkim1522/personal/minifia/docs/product.md
- description: 4~8명이 한 공간에 모여 각자 폰으로 같은 방에 들어간다. 토론은 실제로 얼굴을 보고 말로 한다.
- acceptance: 원문에 명시 없음
- scope: 플레이 환경, 인원

## REQ-no-in-app-chat
- source: /Users/dhkim1522/personal/minifia/docs/product.md
- description: MVP 에는 앱 안 채팅이 없다.
- acceptance: 원문에 명시 없음
- scope: 플레이 환경, 채팅

## REQ-app-as-host
- source: /Users/dhkim1522/personal/minifia/docs/product.md
- description: 앱이 사회자 역할을 한다: 역할 배정, 단계 진행과 타이머, 밤 행동과 투표 집계, 결과 발표.
- acceptance: 원문에 명시 없음
- scope: 사회자 기능, 진행 자동화

## REQ-classic-flow-dark-mood
- source: /Users/dhkim1522/personal/minifia/docs/product.md
- description: 진행은 정통 마피아 그대로("밤이 되었습니다", 마피아 지목, 처형 투표). 분위기는 무겁게(어두운 배경, 긴장감 있는 진행). (결정 ADR-0003 과 동일 내용)
- acceptance: 원문에 명시 없음
- scope: 콘셉트, 연출

## REQ-character-appearance
- source: /Users/dhkim1522/personal/minifia/docs/product.md
- description: 플레이어마다 외형과 성격이 드러나는 단순한 캐릭터를 하나씩 받는다. MVP 에서는 외형 차이만 있고 게임 능력 차이는 없다.
- acceptance: 원문에 명시 없음
- scope: 캐릭터 (캐릭터 수·성격 설정·선택 방식은 미결정, context.md 참조)

## REQ-role-distribution
- source: /Users/dhkim1522/personal/minifia/docs/product.md
- description: 인원별 역할 구성. 4명: 마피아 1 / 경찰 1 / 의사 0 / 시민 2. 5명: 1 / 1 / 1 / 2. 6명: 2 / 1 / 1 / 2. 7명: 2 / 1 / 1 / 3. 8명: 2 / 1 / 1 / 4.
- acceptance: 원문에 명시 없음
- scope: 역할 배정, 인원 4~8

## REQ-role-mafia
- source: /Users/dhkim1522/personal/minifia/docs/product.md
- description: 마피아는 밤에 함께 한 명을 지목한다. 서로 누가 마피아인지 안다. 의견이 갈리면 표가 많은 쪽, 같으면 무작위.
- acceptance: 원문에 명시 없음
- scope: 역할, 밤 행동

## REQ-role-police
- source: /Users/dhkim1522/personal/minifia/docs/product.md
- description: 경찰은 밤에 한 명을 골라 마피아인지 알아낸다. 결과는 본인에게만 보인다.
- acceptance: 원문에 명시 없음
- scope: 역할, 밤 행동

## REQ-role-doctor
- source: /Users/dhkim1522/personal/minifia/docs/product.md
- description: 의사는 밤에 한 명을 골라 지킨다. 마피아 지목과 같으면 그 사람은 살아난다. 자신을 고를 수 있다.
- acceptance: 원문에 명시 없음
- scope: 역할, 밤 행동

## REQ-role-citizen
- source: /Users/dhkim1522/personal/minifia/docs/product.md
- description: 시민은 능력이 없다.
- acceptance: 원문에 명시 없음
- scope: 역할

## REQ-phase-flow
- source: /Users/dhkim1522/personal/minifia/docs/product.md
- description: 진행 단계와 시간. 역할 확인 15초(각자 폰에서 자기 역할 카드 확인) -> 밤 30초(마피아·경찰·의사가 행동 선택) -> 아침 5초(지난밤 결과 발표: 탈락자 또는 "아무 일도 없었습니다") -> 낮 토론 90초(말로 토론) -> 투표 20초 -> 최후 변론 20초 -> 찬반 투표 10초 -> 처형 5초. 이후 밤으로 반복.
- acceptance: 원문에 명시 없음
- scope: 진행 흐름, 타이머

## REQ-day-discussion-control
- source: /Users/dhkim1522/personal/minifia/docs/product.md
- description: 낮 토론 중 방장이 한 번 연장(+30초)하거나 넘길 수 있다.
- acceptance: 원문에 명시 없음
- scope: 낮 토론, 방장 권한

## REQ-execution-vote
- source: /Users/dhkim1522/personal/minifia/docs/product.md
- description: 투표 단계에서 처형 후보를 고른다. 기권 가능. 동률이거나 기권이 최다면 후보 없이 밤으로 넘어간다. 최후 변론에서는 최다 득표자가 말로 변론하며 모든 화면에 후보가 크게 보인다. 찬반 투표에서는 후보를 뺀 생존자가 처형 찬성·반대를 고른다. 처형 단계에서 찬성이 반대보다 많으면 처형, 같거나 적으면 살아남는다. 시간 안에 고르지 않으면 기권.
- acceptance: 원문에 명시 없음
- scope: 투표, 최후 변론, 찬반 투표, 처형

## REQ-win-conditions
- source: /Users/dhkim1522/personal/minifia/docs/product.md
- description: 마피아가 모두 탈락하면 시민 팀 승리. 살아 있는 마피아 수가 나머지 생존자 수와 같거나 많아지면 마피아 팀 승리. 게임이 끝나면 모든 사람의 역할을 공개한다.
- acceptance: 원문에 명시 없음
- scope: 승리 조건, 결과 공개

## REQ-night-anonymity
- source: /Users/dhkim1522/personal/minifia/docs/product.md
- description: 밤에는 모든 사람의 화면이 같은 모양이고, 능력이 없는 사람도 화면을 눌러야 한다(예: 아무나 한 명 고르기, 결과 없음). 누가 폰을 만지는지로 역할이 드러나지 않게 한다.
- acceptance: 원문에 명시 없음
- scope: 밤 단계, 정체 은닉

## REQ-night-timer-hold
- source: /Users/dhkim1522/personal/minifia/docs/product.md
- description: 밤 단계는 행동이 일찍 끝나도 타이머가 끝날 때까지 기다린다.
- acceptance: 원문에 명시 없음
- scope: 밤 단계, 타이머

## REQ-spectator
- source: /Users/dhkim1522/personal/minifia/docs/product.md
- description: 탈락하면 관전 화면으로 바뀌고 모든 역할을 볼 수 있다. 말로 힌트를 주지 않는 것은 플레이어 매너에 맡긴다.
- acceptance: 원문에 명시 없음
- scope: 탈락자, 관전

## REQ-sound
- source: /Users/dhkim1522/personal/minifia/docs/product.md
- description: 사회자 내레이션 음성은 없고 단계 안내는 화면 문구로 한다. 배경음은 대기실·밤·낮·결과 화면별로 분위기에 맞는 곡. 효과음은 역할 공개, 밤·아침 전환, 투표·찬반 선택, 처형, 승리·패배. 각자 폰에서 소리를 끌 수 있다.
- acceptance: 원문에 명시 없음
- scope: 사운드 (모든 폰/방장 폰 재생 여부는 미결정)

## REQ-room-create-join
- source: /Users/dhkim1522/personal/minifia/docs/product.md
- description: 방장이 방을 만들면 4자리 방 코드와 QR 이 나온다. 나머지는 링크·QR·코드로 참가하고 닉네임만 입력한다. 계정·로그인 없음.
- acceptance: 원문에 명시 없음
- scope: 방 생성, 방 참가, 인증 없음

## REQ-reconnect
- source: /Users/dhkim1522/personal/minifia/docs/product.md
- description: 화면이 꺼지거나 잠깐 연결이 끊겨도 같은 폰으로 다시 들어오면 자리와 역할이 이어진다.
- acceptance: 원문에 명시 없음
- scope: 재접속

## REQ-rematch
- source: /Users/dhkim1522/personal/minifia/docs/product.md
- description: 한 판이 끝나면 같은 사람들로 바로 다음 판을 시작할 수 있다.
- acceptance: 원문에 명시 없음
- scope: 재시작

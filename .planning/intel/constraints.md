# 제약 (constraints)

> SPEC 1건(`docs/architecture.md`, 초안 2026-10-21, 분류 신뢰도 medium)에서 추출. 패키지와 버전은 페이즈 1 구현 계획에서 확정한다고 원문에 적혀 있다.

## 기술 스택
- source: /Users/dhkim1522/personal/minifia/docs/architecture.md
- type: nfr
- content: 클라이언트는 React + TypeScript + Vite, PWA (링크로 바로 참가, 설치 불필요, 결정 0001). 실시간 서버는 Cloudflare Workers + Durable Objects (방 하나 = Durable Object 하나, WebSocket, 결정 0002). 정적 파일 배포는 Cloudflare Workers 정적 에셋 (서버와 같은 곳에서 배포). 캐릭터 애니메이션은 미정(Rive 또는 Lottie 후보, 디자인 방향을 정한 뒤 결정). 앱 출시는 Capacitor 로 같은 웹 코드를 감싼다(정식 출시 단계, 결정 0001).

## 시스템 구조 (Worker -> Room Durable Object)
- source: /Users/dhkim1522/personal/minifia/docs/architecture.md
- type: protocol
- content: 브라우저(각 플레이어 폰)가 WebSocket 으로 Worker 에 연결하고, Worker 가 방 코드로 라우팅해 방마다 하나인 Room Durable Object 로 전달한다. Room Durable Object 는 참가자 목록, 역할, 단계, 타이머를 가지고, 밤 행동·투표 집계와 판정을 하며, 플레이어별로 볼 수 있는 상태만 골라서 전송한다.

## 저장소 구성
- source: /Users/dhkim1522/personal/minifia/docs/architecture.md
- type: nfr
- content: 한 저장소에 웹과 서버를 둔다. 공통 타입(메시지, 게임 상태)은 함께 쓴다.

## 서버 기준 타이머
- source: /Users/dhkim1522/personal/minifia/docs/architecture.md
- type: protocol
- content: 서버가 단계 전환과 타이머의 기준이다. 클라이언트 타이머는 서버가 보낸 마감 시각으로 표시만 한다.

## WebSocket Hibernation
- source: /Users/dhkim1522/personal/minifia/docs/architecture.md
- type: nfr
- content: Durable Object 의 WebSocket Hibernation API 를 써서 대기 중 비용을 줄인다.

## 상태 공개 원칙
- source: /Users/dhkim1522/personal/minifia/docs/architecture.md
- type: protocol
- content: 서버는 플레이어마다 다른 상태를 보낸다. 시민에게는 다른 사람의 역할을 보내지 않는다. 마피아는 서로의 정체를, 경찰은 자기 조사 결과만 받는다. 게임이 끝났을 때와 탈락자 관전 화면에서만 전체 역할을 보낸다.

## 재접속 계약
- source: /Users/dhkim1522/personal/minifia/docs/architecture.md
- type: protocol
- content: 참가할 때 서버가 플레이어 토큰을 발급하고 브라우저 저장소에 둔다. 다시 연결하면 토큰으로 같은 자리에 붙고 현재 상태를 다시 받는다. 일정 시간 돌아오지 않는 플레이어 처리(자동 기권 등)는 페이즈 1 계획에서 정한다(미결정).

## 테스트 배포
- source: /Users/dhkim1522/personal/minifia/docs/architecture.md
- type: nfr
- content: `wrangler deploy` 한 번으로 URL 이 바뀌지 않고 갱신된다. 테스터는 링크만 열면 되고 Android·iPhone 구분이 없다. 개발 중에는 PC 브라우저 탭 여러 개로 4~8명을 흉내 내고, 같은 Wi-Fi 의 폰으로 로컬 서버에 접속해 확인한다.

## iOS Safari 제약
- source: /Users/dhkim1522/personal/minifia/docs/architecture.md
- type: nfr
- content: 화면이 꺼지거나 다른 앱으로 가면 WebSocket 이 끊기므로 재접속이 필수 기능이다. 진동(Vibration API)이 동작하지 않아 앱으로 감쌀 때 Capacitor 로 붙인다. 소리는 사용자가 한 번 누른 뒤에만 재생되므로 방 참가 버튼에서 오디오를 깨운다. 웹 푸시 알림은 홈 화면에 추가한 경우에만 되며 MVP 에서는 쓰지 않는다. 게임 중 화면 꺼짐 방지는 Screen Wake Lock API 를 쓰고, 지원하지 않으면 생략한다.

## 출시 경로
- source: /Users/dhkim1522/personal/minifia/docs/architecture.md
- type: nfr
- content: (1) 웹(PWA)으로 친구들과 플레이테스트. (2) 정식 출시: 같은 코드를 Capacitor 로 감싸 Android·iOS 스토어에 올리며 웹 링크 참가는 계속 유지한다. (3) 스토어 심사(특히 iOS 의 "웹사이트를 감싼 것뿐인 앱" 거절)에 대비해 앱에는 진동, 공유 시트, 알림 같은 기기 기능을 붙인다. (4) 유료 아이템을 앱에서 팔면 스토어 인앱 결제를 써야 하며, 수익화는 출시 전에 따로 정한다.

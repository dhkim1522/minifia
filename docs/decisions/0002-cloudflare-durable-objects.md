# 0002 실시간 서버는 Cloudflare Durable Objects

- 상태: 채택
- 날짜: 2026-10-21

## 배경

각자 폰으로 참가하므로 역할 배정, 밤 행동, 투표를 모으고 판정할 실시간 서버가 필요하다. 한 판은 4~8명이 10분 정도 쓰는 짧은 방이다.

## 결정

Cloudflare Workers + Durable Objects 를 쓴다. 방 하나를 Durable Object 하나로 두고 WebSocket 으로 연결한다. 게임 규칙과 판정은 Durable Object 안에서만 한다.

## 결과

- 방 상태가 한 곳에 있어 동시 투표·타이머 처리에 경합이 없다.
- 클라이언트를 조작해도 다른 사람의 역할을 볼 수 없다. 서버가 볼 수 있는 상태만 보낸다.
- 웹 정적 파일도 Workers 에서 함께 배포한다.
- Cloudflare 계정과 `wrangler` CLI 가 필요하다.

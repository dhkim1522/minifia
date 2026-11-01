---
status: diagnosed
trigger: "UAT G-06-6: 배포본(minifia-v2, 5e6abf8)에서 reconnect E2E offline 10회 모두 재접속 띠가 한 번도 안 보임(RC6 실패). 로컬 06-18 은 10/10. goal: find_root_cause_only"
created: 2026-11-01T07:20:00Z
updated: 2026-11-01T07:50:00Z
---

## Current Focus

hypothesis: 확정 — E2E 도구(dropSockets)의 단절 흉내가 배포 주소에서 close 이벤트를 만들지 못한다. 제품 띠는 정상
test: (완료) 배포본에서 소켓 타임라인 탐침 5종, 합성 close 이벤트로 띠가 뜨는지 확인
expecting: (완료) 합성 close 에서 띠가 즉시 뜨면 제품 정상, 도구 문제로 확정
next_action: 없음(진단만). 호출자에게 ROOT CAUSE FOUND 반환 — 고침은 도구(scripts/e2e) 쪽, 선택적으로 worker/room.ts webSocketClose 위생 수정
bug_class: Bohrbug (배포 주소에서 매번 재현, 로컬에서는 매번 통과 — 환경 차이로 결정적)

## Symptoms

expected: 배포본에서 연결이 끊기면 "연결이 끊겼어요 · 다시 연결하는 중" 띠가 뜨고, 다시 연결되면 "다시 연결됐어요" 2초 뒤 사라진다(06-18 로컬 offline 10/10 과 같다)
actual: 배포본(5e6abf8, Version 0e348f6e) `npm run e2e -- --only reconnect` 에서 offline 종류 띠 본 횟수 0/10(RC6 실패), 복구 RC5 는 10/10. frozen·reload·lose·lose-idle 은 10/10 통과(띠 본 횟수는 이 종류들에서 원래 0 이 정상: requireBannerSeen=false). deployhold 도 배포본에서 띠 0
errors: 콘솔 오류 없음
reproduction: `npm run e2e -- --only reconnect` (대상 https://minifia-v2.dhplay.workers.dev). 로그 /private/tmp/claude-501/-Users-dhkim1522-personal-minifia/adb2982b-28f5-4a52-9104-ac5a88ecf657/scratchpad/reconnect.log
started: 2026-11-01 UAT 에서 발견. 로컬 06-18 은 초록

## Eliminated

- hypothesis: H2 — 제품 띠 상태기계에 디바운스·유예가 있어 빠른 재접속이면 띠가 안 보인다
  evidence: linkReducer 에 유예가 없다(close → hasView 면 즉시 banner=reconnecting, 첫 state 에서 restored 2초 유지). 재접속이 아무리 빨라도 restored 띠가 2초 보이므로 close 이벤트만 오면 띠는 반드시 뜬다. 배포본 탐침에서 합성 close(1006) 후 105ms 에 "연결이 끊겼어요 · 다시 연결하는 중", 3.6초에 "다시 연결됐어요", 5.66초에 사라짐 — 로컬과 같다
  timestamp: 2026-11-01T07:45:00Z
- hypothesis: H1a — 배포 주소에서 방 소켓 URL 패턴이 달라 dropSockets 가 소켓을 못 찾는다
  evidence: 배포본에서 dropSockets 가 1개를 닫음(readyState 1→2). URL 은 wss://minifia-v2.dhplay.workers.dev/api/rooms/X/ws 로 패턴(/api/rooms/)에 맞는다
  timestamp: 2026-11-01T07:30:00Z
- hypothesis: H1b — 오프라인 흉내(setOffline)가 배포 주소의 소켓 단절을 막는다
  evidence: setOffline 없이(nooffline)도 같은 현상. 원시 소켓 탐침(앱 없이)에서 offline=false/true 모두 client close 후 close 이벤트가 10.05~11.07초 뒤 1006으로 온다. 즉 오프라인 전환과 무관하다
  timestamp: 2026-11-01T07:38:00Z

## Evidence

- timestamp: 2026-11-01T07:20:00Z
  checked: src/net/linkReducer.ts, useRoomConnection.ts, ReconnectBanner.tsx
  found: 띠에 디바운스·유예가 없다. close 이벤트가 오면 hasView 일 때 즉시 banner="reconnecting". 재연결 성공 첫 state 에서 "restored"(2초). 띠는 close 이벤트에만 반응하고, 소켓 readyState 가 CLOSING 인 동안은 아무것도 하지 않는다. 또 `online` 이벤트의 wake() 는 소켓이 OPEN 도 CONNECTING 도 아니면(CLOSING 포함) 바로 connect() 로 새 소켓을 만들고 socketRef 를 바꾼다 — 이전 소켓의 늦은 close 는 `socketRef.current !== ws` 로 무시된다
  implication: 띠가 한 번도 안 보였다면 앱이 close 이벤트를 받지 못했다는 뜻이다. 제품 코드는 close 이벤트가 오면 항상 띠를 띄운다

- timestamp: 2026-11-01T07:28:00Z
  checked: 배포본 탐침 probe1(방장 1페이지, reconnectInit + 소켓 이벤트 로그, setOffline(true)+dropSockets, 3초 뒤 setOffline(false))
  found: dropSockets 가 방 소켓 1개를 닫는다(rs 1→2 CLOSING). 그 소켓의 close 이벤트는 끝까지 안 온다(관찰 9초). `online` 이벤트 뒤 앱이 새 소켓을 만들어 열림(lastSocketOpen true). 띠 타임라인: 전 구간 null — 띠 0회. 복구는 정상(RC5 통과 이유)
  implication: E2E 가 본 증상을 그대로 재현. dropSockets 는 소켓을 닫지만 close 이벤트를 즉시 만들지 못한다

- timestamp: 2026-11-01T07:33:00Z
  checked: 같은 탐침을 로컬 dev(5181)에서
  found: close 이벤트(code 1005, wasClean true)가 dropSockets 직후 도착 → 띠 104ms 에 "연결이 끊겼어요 · 다시 연결하는 중", 오프라인 중 재시도 실패(1006)가 이어지고, 복귀 뒤 "다시 연결됐어요", 2초 뒤 사라짐 — 06-18 과 같다
  implication: 로컬 workerd(1.20261012.1)는 클라이언트 Close 프레임에 즉시 응답한다. 배포본은 그렇지 않다 — 이 차이가 로컬 초록/배포 빨강의 전부

- timestamp: 2026-11-01T07:38:00Z
  checked: 원시 소켓 탐침 probe2(배포본, 앱·hello 없음, 페이지 안 WebSocket 직접, close() / close(1000) / close(1000,"x") / close(4000,"x") × 오프라인 on/off)
  found: 8가지 모두 close 이벤트가 10.05~11.07초 뒤 code 1006, wasClean false
  implication: 클라이언트가 Close 프레임을 보내도 서버(배포 엣지/DO)가 답하지 않아 Chrome 이 닫기 핸드셰이크 제한(약 10초) 뒤에 1006으로 끝낸다. 닫기 코드·오프라인과 무관

- timestamp: 2026-11-01T07:41:00Z
  checked: probe3 — Chrome 이 아닌 Node 내장 WebSocket(undici)으로 배포본에 같은 시험
  found: close() / close(1000) / close(1000,"x") 모두 10.14~11.33초 뒤 1006 clean=false
  implication: Chrome 특이 동작이 아니라 서버 쪽이 클라이언트 Close 에 답하지 않는 것

- timestamp: 2026-11-01T07:43:00Z
  checked: probe1 을 offline 14초로(배포본)
  found: close 이벤트가 dropSockets 뒤 약 10.2초에 1006으로 도착 → 그 시점에 띠 "연결이 끊겼어요 · 다시 연결하는 중" 표시(타임라인 10188ms). 14초에 온라인 복귀 → 14.8초 "다시 연결됐어요" → 16.7초 사라짐
  implication: 제품 띠는 배포본에서도 정상 동작한다. 하네스가 오프라인을 3초만 유지하고 `online` 으로 소켓을 바꿔 버려서 10초 뒤의 close 를 앱이 보지 못할 뿐이다

- timestamp: 2026-11-01T07:46:00Z
  checked: 배포본에서 dropSockets 대신 합성 close 이벤트(ws.dispatchEvent(new CloseEvent("close",{code:1006})) + ws.close()) + 오프라인 3초
  found: 띠 105ms 에 뜸, 3.6초 "다시 연결됐어요", 5.66초 사라짐 — 로컬 06-18 과 같은 모양
  implication: 단절 흉내를 close 핸드셰이크에 의존하지 않게 바꾸면 배포본에서도 RC6 이 성립한다(고침 방향 검증)

- timestamp: 2026-11-01T07:48:00Z
  checked: 기록 — .planning/milestones/v1.0-phases/01-walking-skeleton/01-UAT.md(테스트 8), 01-LEARNINGS.md "끊김 띠가 뜨기까지 약 10초 걸렸다"
  found: v1.0 배포본에서도 이미 같은 현상이 관찰됐다 — "소켓 강제 단절 후 클라이언트 close 가 CLOSING 상태로 남아 띠가 약 10초 뒤에 떴다". 그때는 통과로 처리하고 열린 관찰 항목으로 남김
  implication: 새 회귀가 아니라 오래된 배포 환경 특성. 06-18 하네스는 로컬에서만 검증돼 이 특성을 몰랐다
  
- timestamp: 2026-11-01T07:49:00Z
  checked: Cloudflare 문서(Durable Object webSocketClose), worker/room.ts:719, wrangler.jsonc(compatibility_date 2026-10-12)
  found: 문서는 compat 날짜 2026-04-07 이상이면 런타임이 맞받아치는 Close 프레임을 자동으로 보낸다고 한다. 우리 날짜는 그 이후이고 webSocketClose 는 ws.close() 를 부르지 않는다. 그런데 배포본은 응답하지 않는다(위 탐침). 로컬 workerd 는 문서대로 응답한다
  implication: 배포 엣지가 문서와 다르게 동작하거나 하이버네이션 소켓에는 적용되지 않는 것으로 보인다(원인은 외부 플랫폼, 확정 불가 — 배포 없이는 ws.close() 추가 효과를 검증할 수 없다). 문서가 말하는 보수적 방어는 webSocketClose 에서 ws.close(code,reason) 를 부르는 것(이미 닫혀 있으면 무시되므로 안전)

- timestamp: 2026-11-01T07:50:00Z
  checked: deployhold 의 배포본 띠 0
  found: 06-VERIFICATION.md 가 "DO 하이버네이션이 소켓을 끊지 않음"으로 이미 설명(6분 동안 띠 0), v1.0 01-LEARNINGS 도 "재배포해도 띠 안 보임". deployHoldFlow 는 배포본에서 requireBannerSeen:true 로 띠를 기다려 소켓이 안 끊기면 6분 뒤 빈손
  implication: G-06-6 과 원인이 다른 별개 항목. 소켓이 유지되는 것은 좋은 결과이고 도구 기대(띠가 떠야 함)가 배포 환경에 안 맞는다

## Resolution

root_cause: |
  주원인은 E2E 도구(scripts/e2e/browser.mjs 의 dropSockets + flows.mjs reconnectAction "offline")다. 제품 코드는 정상이다.
  AND 조건 세 개가 겹쳤다.
  (1) 도구가 단절을 ws.close() 로 흉내 낸다. 이것은 close 핸드셰이크가 끝나야 close 이벤트가 오는데, 로컬 workerd 는 Close 프레임에 즉시 응답해 이벤트가 바로 오지만
      배포 엣지/DO(minifia-v2)는 클라이언트 Close 프레임에 응답하지 않아 소켓이 CLOSING 에 머물다 약 10초 뒤 1006으로 끝난다(Chrome·Node 모두, 닫기 코드·오프라인과 무관, v1.0 때도 관찰).
  (2) 도구는 오프라인을 3초만 유지하고 setOffline(false) 한다. 앱의 `online` 핸들러 wake() 는 CLOSING 소켓을 죽은 것으로 보고 즉시 새 소켓으로 갈아끼운다 — 이전 소켓의 close 는 socketRef 불일치로 무시된다.
      그래서 앱은 close 이벤트를 한 번도 받지 못하고, linkReducer 는 close 에만 띠를 켜므로 띠가 0회다. 복구(RC5)는 새 소켓이 열려 정상 통과한다.
  (3) 서버 webSocketClose(worker/room.ts:719)가 ws.close() 를 부르지 않는다. 문서상 compat 2026-04-07 이상이면 필요 없지만 배포본은 응답하지 않는다(위생 수정 후보, 효과는 배포 없이 검증 불가).
  제품 띠 상태기계(linkReducer·useRoomConnection·ReconnectBanner)는 close 이벤트가 오면 배포본에서도 즉시 띠를 띄운다(합성 close 105ms, 오프라인 14초 실험에서 약 10.2초에 실제 close 로 띠).
  deployhold 의 배포본 띠 0은 별개 사유(DO 하이버네이션이 배포로 소켓을 끊지 않음)로 G-06-6 의 원인이 아니다.
fix: (진단만 — 적용 안 함) 하네스: dropSockets 를 close 핸드셰이크에 의존하지 않게 바꾼다. 예) 앱 방 소켓에 합성 close 이벤트(code 1006)를 먼저 dispatch 한 뒤 ws.close(); 또는 Playwright routeWebSocket 으로 서버 쪽 close; 또는 로컬 TCP 프록시로 실제 단절. 선택: worker/room.ts webSocketClose 에서 ws.close(code, reason) 호출(코드 1005/1006 등 예약 코드는 건너뜀, try/catch)
verification: 배포본 탐침 5종(스크래치패드 probe1~3)으로 원인 사슬 전 단계를 관찰. 고침 방향은 합성 close 탐침으로 배포본에서 띠 105ms·restored 3.6초·사라짐 5.66초 확인. 실제 하네스/제품 수정은 하지 않음
files_changed: []

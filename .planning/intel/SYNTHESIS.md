# 합성 요약 (SYNTHESIS)

gsd-roadmapper 가 읽는 진입점이다. 모드: new. 우선순위: ADR > SPEC > PRD > DOC.

## 문서 수 (유형별)
- 총 6건: ADR 4, SPEC 1, PRD 1, DOC 0, UNKNOWN 0
- SPEC(`docs/architecture.md`)은 분류 신뢰도 medium (SPEC/DOC 사이 모호, SPEC 으로 판정). PRD(`docs/product.md`)도 medium (인수 기준 없음).

## 잠긴 결정 (4건)
- ADR-0001 웹앱 먼저, 출시 때 Capacitor 로 감싸기: /Users/dhkim1522/personal/minifia/docs/decisions/0001-web-first.md
- ADR-0002 Cloudflare Workers + Durable Objects: /Users/dhkim1522/personal/minifia/docs/decisions/0002-cloudflare-durable-objects.md
- ADR-0003 정통 마피아 진행, 무거운 분위기, 특색 있는 캐릭터: /Users/dhkim1522/personal/minifia/docs/decisions/0003-classic-rules-dark-mood.md
- ADR-0004 GSD Core + gsd-addons 로 진행 (1페이즈에 Cloudflare 배포 포함): /Users/dhkim1522/personal/minifia/docs/decisions/0004-gsd-workflow.md

## 요구사항 (24건)
REQ-quick-session, REQ-simple-ux, REQ-no-install-join, REQ-play-environment, REQ-no-in-app-chat, REQ-app-as-host, REQ-classic-flow-dark-mood, REQ-character-appearance, REQ-role-distribution, REQ-role-mafia, REQ-role-police, REQ-role-doctor, REQ-role-citizen, REQ-phase-flow, REQ-day-discussion-control, REQ-execution-vote, REQ-win-conditions, REQ-night-anonymity, REQ-night-timer-hold, REQ-spectator, REQ-sound, REQ-room-create-join, REQ-reconnect, REQ-rematch

원문에 명시적 인수 기준이 없어 모든 항목의 acceptance 는 "원문에 명시 없음"이다. 로드맵 단계에서 성공 기준을 정해야 한다.

## 제약 (10건)
- nfr 6: 기술 스택, 저장소 구성, WebSocket Hibernation, 테스트 배포, iOS Safari 제약, 출시 경로
- protocol 4: 시스템 구조(Worker -> Room DO), 서버 기준 타이머, 상태 공개 원칙, 재접속 계약
- api-contract 0, schema 0

## 컨텍스트 주제 (8건)
DOC 문서는 없고, PRD·SPEC 의 미결정·보류 항목을 `context.md` 에 모았다 (사운드 출력 위치, 캐릭터, 원격 플레이, 애니메이션 라이브러리, 이탈 플레이어 처리, 패키지·버전, 수익화, 규칙 수치).

## 충돌
- 0 blockers, 0 competing-variants (warnings), 3 info
- 상세: /Users/dhkim1522/personal/minifia/.planning/INGEST-CONFLICTS.md

## 상태: READY (진행 가능)

## 파일
- /Users/dhkim1522/personal/minifia/.planning/intel/decisions.md
- /Users/dhkim1522/personal/minifia/.planning/intel/requirements.md
- /Users/dhkim1522/personal/minifia/.planning/intel/constraints.md
- /Users/dhkim1522/personal/minifia/.planning/intel/context.md

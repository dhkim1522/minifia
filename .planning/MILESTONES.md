# Milestones

## v2.0 같은 공간 (Shipped: 2026-11-07)

**Delivered:** 테이블에 앉은 2.5D 판을 걸어 다니는 3D 맵(지하 재즈 바·시계탑 광장)으로 바꾸고, 자유 채팅·지목→변론→찬반 처형·유령 관전·밤 이동·아침 흔적·결과 시상·다시 하기·합성 소리까지 갖춘 v2 배포본을 만들었다.

**Phases completed:** 9 phases (6·7·8·9·9.1·9.1.1·10·11·12), 172 plans, 137 tasks

**Key accomplishments:**
- three 0.186.1 정사영 3D 맵 런타임: 서버 구간 이동·내 캐릭터 예측 이동, WebGL 소실·재생성·강등 사다리, iPhone 16 Pro·CPU 4배 스로틀 60fps (결정 0055·0057·0059)
- 자유 채팅: 채널(전체·마피아·유령)별 audience 한 함수로 전송 범위 고정, 재접속 30줄 복원, 한글 IME 안전 입력 (결정 0058)
- 낮 처형 지목→변론→찬반과 유령, 밤 마피아 이동·아침 분필·유언·쪽지, 정치 장치(직업 주장 배지·귓속말·찬반 기록·결선·3인 결전) (결정 0060~0067)
- 구·원통 조립 캐릭터 동작 9종·의상 9종, 결과 공개·시상·다시 하기·방 연속성, 광장 맵 개방 (결정 0068·0069)
- 외부 자산 없는 합성 소리 56개와 시험 페이지 `/?sound-lab=1` (결정 0070)

**Stats:**
- 기간: 2026-11-01 → 2026-11-07, 커밋 약 1,275개(v1.0 이후)
- 코드: src·shared·worker·scripts 270개 파일, +47,843 / -13,742줄
- 배포본: https://minifia-v2.dhplay.workers.dev (버전 `2026-11-06T13:49:18Z+e51942c6`)
- git: 태그 `v2.0`, 브랜치 `v2`

**Closeout:** override_closeout — 요구사항 46/46, 페이즈 검증 기록은 9페이즈 `human_needed` 외 일부 stale. Known verification overrides: 26 newly acknowledged, 2 carried forward from a prior close (see STATE.md Deferred Items)

**마감 사유:** 팀 모의 플레이에서 증거 없음·할 일 모름·도구 모름 문제가 나왔다(`docs/playtest-v2.0-feedback.md`). v2.0 은 완료 처리하고 실기기 확인(`milestones/v2.0-phases/12-sound-polish/12-TEAM-TEST.md`)은 v3.0 실테스트 때 함께 한다. main 반영도 v3.0 실테스트 통과 뒤.

**Archive:** [v2.0-ROADMAP.md](milestones/v2.0-ROADMAP.md) · [v2.0-REQUIREMENTS.md](milestones/v2.0-REQUIREMENTS.md) · 페이즈 문서 `milestones/v2.0-phases/`

---

## v1.0 MVP (Shipped: 2026-10-30)

**Delivered:** 링크 하나로 4~8명이 각자 폰에서 정통 마피아 한 판을 끝까지 하는 웹 게임을 개인 Cloudflare 계정에 배포했다.

**Phases completed:** 6 phases (1·2·3·3.1·4·5, 6 삭제 — 결정 0041), 107 plans, 133 tasks

**Key accomplishments:**
- 방 Durable Object 하나가 규칙·판정·타이머를 맡고, 플레이어마다 허용 목록 뷰만 보내 다른 사람의 역할이 네트워크에도 나가지 않는 구조(단계마다 전수 누출 검사)
- 방 만들기·링크/코드 참가·재접속(화면 잠금·배포 중 끊김 복구)부터 역할 확인, 순차 직업 주장·빠른 메시지·이모티콘 토론까지 낮 루프
- 마피아·경찰·의사 밤 행동과 아침 발표, 탈락자 관전, 경찰 수사 기록
- 처형 여부 투표 → 후보 선택(익명·번복·취소) → 공개 연출 → 최후 변론 → 처형 → 승패·결과 화면
- 2.5D 고정 테이블, 캐릭터 8종, 장면 배경 5종·크로스페이드, 밤 비네팅·아침 밝아짐, 단계마다 한 문장 안내, 화면 켜짐 유지
- 실제 브라우저 E2E(10여 흐름 × 4개 폭)·배포본 smoke/uat, 테스트 방 봇 도구, 위협 310개 점검

**Stats:**
- 기간: 2026-10-21 → 2026-10-30 (10일), 커밋 약 940개
- 코드: TypeScript·CSS·스크립트 약 64,000줄 (테스트 포함)
- 배포본: https://minifia.dhplay.workers.dev (버전 `2026-10-29T14:52:03Z+cb6979c`)
- git: 태그 `v1.0`, 유지 브랜치 `v1` (결정 0043)

**Closeout:** override_closeout — 6페이즈 검증 passed, 요구사항 33/33. Known verification overrides: 2 newly acknowledged, 0 carried forward from a prior close (see STATE.md Deferred Items)

**마감 사유:** 팀 내 실게임 테스트 결과 이대로 출시는 어렵다고 판단했다. v1.0 을 보관하고 v2.0 에서 새로 기획·설계·에셋·고도화한다.

**Archive:** [v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md) · [v1.0-REQUIREMENTS.md](milestones/v1.0-REQUIREMENTS.md) · 페이즈 문서 `milestones/v1.0-phases/` · quick 작업 `milestones/v1.0-quick/`

---

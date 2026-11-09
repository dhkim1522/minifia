---
phase: "17"
slug: "tutorial-first-case"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-11-09"
---

# Phase 17 — Security

> 17페이즈(튜토리얼 "첫 사건") 위협 등록부, 수용 위험, 감사 기록.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| 클라이언트 → 방 DO | `start.tutorial`, `tutorialDone` 메시지 | 방장 스위치 값, 끝났음 신호 (역할·개인정보 없음) |
| 방 DO → 클라이언트 | tutorial 단계 view | `view.tutorial {done,total,endsAt}`, 본인의 `me.tutorialDone` (역할·allies 없음) |
| 혼자 하기 화면 ↔ 서버 | 서버와 연결 없음 | 없음 (가짜 이름·가짜 장면만 로컬 재생) |
| 브라우저 저장소 | `minifia.tutorial.seen` | 참/없음 하나 |
| 저장소·배포 | 공개 저장소 문서·커밋, 배포 계정 | 위생 규칙, 배포 대상 계정 |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-17-01 | Info Disclosure | tutorial 단계 view(역할) | high | mitigate | `phases.ts` tutorial `revealsOwnRole:false`, `view.ts` 가 role·allies 차단, `tutorialLeak.test.ts` | closed |
| T-17-02 | Elevation of Privilege | `applyTutorialDone` | medium | mitigate | 소켓 `att.playerId` 만 사용, WRONG_PHASE→BAD_MESSAGE 순서 거절 | closed |
| T-17-03 | DoS | tutorialDone 범람 | medium | mitigate | 멱등(같은 상태면 저장·전송 없음) + 속도 제한·1024B | closed |
| T-17-04 | DoS | start.tutorial 로 방 붙잡기 | low | mitigate | NOT_HOST 선검사, TUTORIAL_MS=150000 마감 | closed |
| T-17-05 | Tampering | schemas start·tutorialDone | medium | mitigate | `z.strictObject`, `tutorial` 은 `z.boolean().optional()` | closed |
| T-17-06 | DoS | `voice.ts` 음절 예약 | low | mitigate | 같은 key 예약 취소, `voice.syl` max 2, 노드 예산 | closed |
| T-17-07 | Info Disclosure | `src/audio/**` | low | mitigate | 문구를 인자로만 받음, `soundStaticGuard` | closed |
| T-17-08 | Info Disclosure | `tutorialScript.ts` | high | mitigate | 가짜 view 에 role·allies 키 없음 시험, 정적 가드 | closed |
| T-17-09 | Tampering | 가짜 이름 → DOM | low | mitigate | innerHTML 계열 사용 0, 정적 가드 | closed |
| T-17-10 | Elevation of Privilege | TutorialScreen → GameMap send | high | mitigate | `makeTutorialSend` 로컬 처리, 연결·fetch·socket 0 시험 | closed |
| T-17-11 | DoS | FocusRing rAF | low | mitigate | 직전 값 같으면 갱신 생략, opacity 키프레임만 | closed |
| T-17-12 | Info Disclosure | TutorialReveal | medium | mitigate | 상수 입력만, E2E 누설 0 판정 | closed |
| T-17-13 | Tampering | `minifia.tutorial.seen` | low | accept | 아래 수용 위험 로그 | closed |
| T-17-14 | Info Disclosure | 혼자 하기 네트워크 | low | mitigate | 로컬 상태만 변경, E2E 소켓·/api 0 | closed |
| T-17-15 | Spoofing | 손님의 start.tutorial | medium | mitigate | NOT_HOST, 방장에게만 스위치 렌더 | closed |
| T-17-16 | Info Disclosure | 스위치 값 방송 | low | mitigate | 화면 로컬 상태, [시작] 때만 전송 | closed |
| T-17-17 | Elevation of Privilege | RoomScreen tutorial 분기 | high | mitigate | 연결 `send` 는 `tutorialDone` 한 곳, 연결 epoch 당 1회 | closed |
| T-17-18 | Info Disclosure | TutorialRoleCards | medium | mitigate | 상수 카드 4종, view 를 받지 않음 | closed |
| T-17-19 | DoS | OpeningFx 진홍 번쩍임 | low | mitigate | 1.4s·1회, 모션 줄이기 시 제거 | closed |
| T-17-20 | DoS | 배포본 DO 쓰기(E2E) | medium | mitigate | E2E 하드코딩 배포 URL 없음, 로컬 실행 | closed |
| T-17-21 | Info Disclosure | E2E 결과 상세 | low | mitigate | 판정 메시지에 프레임 원문·토큰·닉네임 없음 | closed |
| T-17-22 | Spoofing | `npm run deploy` | high | mitigate | check-account·check-deploy-target 가드, 개인 계정 확인 | closed |
| T-17-23 | Info Disclosure | 문서·커밋·SUMMARY | medium | mitigate | 감사 중 17-05-SUMMARY 한 줄(위생 패턴 원문 기재)을 발견해 같은 날 문구로 교체. 재검사 시 오탐(`seatOrdered`)만 남음 | closed |
| T-17-24 | Info Disclosure | 배포본 | high | mitigate | 누설 시험 통과 후 배포, 배포본 tutorial E2E 누설 0 | closed |
| T-17-25 | DoS | 배포본 DO 쓰기 | medium | mitigate | 전체 회귀는 로컬 1회, 배포본은 smoke+tutorial 만 | closed |
| T-17-26 | Info Disclosure | REQUIREMENTS·ROADMAP·0080 | medium | mitigate | 위생 검사 결과 없음 | closed |
| T-17-27 | Tampering | `ROADMAP.md` | low | mitigate | 커밋 numstat 으로 한 줄만 변경 확인 | closed |
| T-17-28 | Info Disclosure | view.tutorial·tutorialPassed | high | mitigate | 본인 값만 true, id 목록 미전송, 허용 목록·변이 시험 | closed |
| T-17-29 | Tampering | `handleDisconnect` 전환 | medium | mitigate | tutorial 단계에서만 재검사, 같은 tick 경로 | closed |
| T-17-30 | Info Disclosure | `worldVisibleTo` tutorial | low | accept | 아래 수용 위험 로그 | closed |
| T-17-SC | Tampering | 패키지 설치(12개 계획) | high | mitigate | package.json·lockfile 변경 0, 오디오 외부 자산 0 | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-17-01 | T-17-13 | `minifia.tutorial.seen` 은 참/없음 하나이고 위조해도 첫 화면 카드 모양만 바뀐다. 개인정보·토큰 없음. `session.ts` 가 값이 `"1"` 일 때만 참으로 읽는다. | 17-06 계획 승인 | 2026-11-09 |
| AR-17-02 | T-17-30 | tutorial 단계의 월드 위치는 대기실 위치라 역할과 무관하고 lobby·assigning 과 같은 방 전원 규칙이다. `audience.test.ts` 에 포함. | 17-12 계획 승인 | 2026-11-09 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-11-09 | 31 | 30 | 1 (T-17-23, medium, 비차단) | gsd-security-auditor |
| 2026-11-09 | 31 | 31 | 0 | 오케스트레이터 (T-17-23 문구 교체 후 재확인) |

참고(위협 아님): 정적 가드 금지 목록에 `XMLHttpRequest`·`sendBeacon` 이 없고 `Home.tsx`·`RoomScreen.tsx` 는 가드 대상이 아니다. 현재는 `fetch`·`WebSocket` 스텁 시험과 E2E 의 소켓·`/api` 0 판정이 덮는다.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-11-09

---
phase: "7"
slug: "free-chat"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-11-01"
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> 근거: `07-RESEARCH.md` §Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.12 (projects: `unit`(node) · `client`(happy-dom) · `worker`(workerd)) + `node --test`(scripts) + playwright-core 1.64.1(E2E, 시스템 Chrome) |
| **Config file** | `vitest.config.ts` (기존) |
| **Quick run command** | `npx vitest run <바꾼 테스트 파일>` (예: `npx vitest run test/unit/audience.test.ts test/unit/chatRules.test.ts test/unit/chatLog.test.ts`) |
| **Full suite command** | `npx vitest run && node --test scripts/*.test.mjs scripts/e2e/lib.test.mjs && npx tsc -p tsconfig.app.json --noEmit && npx tsc -p tsconfig.worker.json --noEmit` |
| **화면 E2E** | `npm run dev` 후 `npm run e2e -- --url http://localhost:5173 --only chat` |
| **Estimated runtime** | ~30 seconds (vitest 약 16초 + node --test + tsc 두 개) |
| **기준선** | vitest 139 파일 / 3,733 통과 · 1 건너뜀; `node --test` 280 통과; 두 `tsc` 통과 (2026-11-01) |

---

## Sampling Rate

- **After every task commit:** 바꾼 파일의 테스트만 + 해당 쪽 `tsc`(앱 또는 워커)
- **After every plan wave:** `npx vitest run` + 두 `tsc`
- **Before `/gsd-verify-work`:** Full suite green + 로컬 E2E `--only chat` + 합격 검사 1~7 사람 표(iPhone) + 채팅 부하 fps 기록(5분 평균 55 이상)
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

> 계획 확정 후 작업 ID 를 채운다. 아래는 요구사항 → 테스트 지도(리서치 기준).

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | CHAT-01 | — | 로비·낮 `all` 이 방의 모두에게 간다 | worker | `npx vitest run test/worker/chat.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | CHAT-01 | T-7-access | `audience` 채널 표 전수 | unit | `npx vitest run test/unit/audience.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | CHAT-01 | — | 로비·낮 채팅 패널 | client | `npx vitest run test/client/chatPanel.test.tsx test/client/lobby.test.tsx` | ❌ / ✅ 수정 | ⬜ pending |
| TBD | TBD | TBD | CHAT-02 | T-7-leak | 밤 마피아 채팅·입력 중이 시민 소켓에 0건 | worker(누설) | `npx vitest run test/worker/leak.test.ts test/worker/chatLeak.test.ts` | ✅ 확장 / ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | CHAT-02 | T-7-phase | 단계 키 어긋난 메시지는 폐기 + `chatReject{"phase"}` | worker | `npx vitest run test/worker/chat.test.ts -t "단계 어긋남"` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | CHAT-03 | T-7-leak | 탈락자 채팅·입력 중이 산 사람 소켓에 0건 | worker(누설) | `npx vitest run test/worker/chatLeak.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | CHAT-03 | T-7-replay | 재접속 `chatLog` 도 같은 규칙 | worker | `npx vitest run test/worker/chatReplay.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | CHAT-04 | T-7-leak | 입력 중 중계 간격·채널별 수신 | worker | `npx vitest run test/worker/chat.test.ts -t "입력 중"` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | CHAT-04 | — | 수신 4.5초 만료·단계 변경 시 비움 | client | `npx vitest run test/client/chatStore.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | CHAT-04 | — | 이름표 `data-typing`, 카메라 가시성 | unit/E2E | `npx vitest run test/unit/camera.test.ts` | ✅ 수정 | ⬜ pending |
| TBD | TBD | TBD | CHAT-05 | T-7-dos | 정리·길이(자소)·600ms·5초 5줄·같은 문장 3초 | unit | `npx vitest run test/unit/chatRules.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | CHAT-05 | T-7-dos | 서버가 막고 보낸 사람에게만 `chatReject` | worker | `npx vitest run test/worker/chat.test.ts -t "거절"` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | CHAT-05 | — | 한글 조합 중 Enter: 한 번만 전송, 잔여 글자 없음 | E2E(CDP IME) | `npm run e2e -- --url http://localhost:5173 --only chat-ime` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | CHAT-05 | — | 키보드 가림·캔버스 불변 (합격 검사 1~7) | E2E(가상 viewport) | `npm run e2e -- --url http://localhost:5173 --only chat-keyboard` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | CHAT-06 | — | `claim` 단계 없음: `dayAnnounce` → `discussion` | unit | `npx vitest run test/unit/tick.test.ts test/unit/nyquist-02-phase-matrix.test.ts` | ✅ 수정 | ⬜ pending |
| TBD | TBD | TBD | CHAT-06 | T-7-input | `claim`/`say`/`emoji` 메시지는 스키마가 거부 | unit | `npx vitest run test/unit/schemas.test.ts` | ✅ 수정 | ⬜ pending |
| TBD | TBD | TBD | CHAT-06 | — | 옛 저장 방 정규화 | unit+worker | `npx vitest run test/unit/gameRoom.test.ts test/worker/alarm.test.ts` | ✅ 수정 | ⬜ pending |
| TBD | TBD | TBD | CHAT-06 | T-7-leak | `broadcastEvent` 부재·삭제 식별자 부재 정적 가드 | unit(정적) | `npx vitest run test/unit/chatStaticGuard.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `docs/decisions/0058-v2-chat-retention.md` — 채팅 서버 보관·재접속 복원(0017-7·0016-7·0019-1·0020·0023-5 개정)
- [ ] `test/unit/audience.test.ts`, `test/unit/chatRules.test.ts`, `test/unit/chatLog.test.ts` — 순수 규칙 표(TDD)
- [ ] `test/worker/chat.test.ts`, `test/worker/chatLeak.test.ts`, `test/worker/chatReplay.test.ts` + `test/worker/helpers.ts` 의 `chatSend`/`chatsOf` 도우미, `claim` 건너뛰기 정리
- [ ] `test/client/chatStore.test.ts`, `test/client/chatPanel.test.tsx`
- [ ] `test/unit/chatStaticGuard.test.ts`
- [ ] `scripts/e2e/` 의 `chat-*` 시나리오 3종(로비 채팅·키보드·IME) + `PANEL_H` 갱신 + `test/unit/e2eContract.test.ts` 동기화
- [ ] 채팅 부하 소켓 스크립트(`scripts/bots.mjs` 확장 또는 별도)
- 프레임워크 설치: 없음(모두 기존)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| iOS 키보드가 채팅창을 가리지 않음(합격 검사 1~7) | CHAT-05 | 실제 iOS 키보드·visualViewport 는 헤드리스로 재현 불가 | iPhone 16 Pro(iOS용 Chrome/Safari)로 배포본 로비에서 입력줄 탭 → UI-SPEC 합격 검사 1~7 확인, `07-VERIFICATION` 표에 기록 |
| 한글 조합 중 Enter/보내기 한 번만 전송 | CHAT-05 | 실제 iOS IME 동작 | iPhone 에서 "안녕" 조합 중 Enter·보내기 → 한 줄만, 입력칸 잔여 글자 없음 |
| Android Chrome·삼성 인터넷·카카오톡 인앱 | CHAT-05 | 실기기 없음 | 검증 때 이월 여부를 사용자에게 묻는다. 미확인은 합격으로 세지 않고 9페이즈 팀 테스트로 이월 기록 |
| 채팅 부하 fps | CHAT-01 | 실기기 렌더 | iPhone 16 Pro 로 로비 채팅 부하 5분 평균 55fps 이상 기록 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

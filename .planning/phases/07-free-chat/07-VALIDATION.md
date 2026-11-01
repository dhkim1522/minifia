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

> 2026-11-01 계획 개정(22계획·14웨이브)에서 작업 ID 를 채웠다. Status 열은 실행하며 채운다(validate-phase 전까지 frontmatter status draft·nyquist_compliant false 그대로). Task ID 는 `{계획}-T{작업 번호}` 다.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 07-01-T1·T2 | 07-01 | 1 | CHAT-01·02·03 | T-7-replay | 결정 0058 이 보관·마스크 복원·채널별 30줄·상한·0021-2 유지를 정한다 | docs(grep) | `test -f docs/decisions/0058-v2-chat-retention.md && grep -q "CHAT_REPLAY_PER_CHANNEL = 30" docs/decisions/0058-v2-chat-retention.md` | ❌ W0 | ⬜ pending |
| 07-02-T1 | 07-02 | 1 | CHAT-01·02·03 | T-7-access | `audience` 채널 표 전수 | unit | `npx vitest run test/unit/audience.test.ts` | ❌ W0 | ⬜ pending |
| 07-02-T2 | 07-02 | 1 | CHAT-05·04 | T-7-dos | 정리·길이(자소)·600ms·5초 5줄·같은 문장 3초·입력 중 1.5초 | unit | `npx vitest run test/unit/chatRules.test.ts` | ❌ W0 | ⬜ pending |
| 07-02-T3 | 07-02 | 1 | CHAT-02·03 | T-7-replay | 채널별 seq·보낼 때 마스크 복원(라이브 == 복원, 새 탈락자 지난 마피아 줄 0) | unit | `npx vitest run test/unit/chatLog.test.ts` | ❌ W0 | ⬜ pending |
| 07-03-T1·T2 | 07-03 | 1 | CHAT-01·05 | — | 하단 채팅 패널: form 제출 한 길·IME 조합 제출·채널 모양·텍스트 노드만 | client | `npx vitest run test/client/chatPanel.test.tsx` | ❌ W0 | ⬜ pending |
| 07-03-T3 | 07-03 | 1 | CHAT-04 | — | 머리 위 입력 중 알약·패널 치수 상수 | client/unit | `npx vitest run test/client/v2parts.test.tsx test/unit/chatUi.test.ts` | ✅ 수정 / ❌ W0 | ⬜ pending |
| 07-04-T1~T3 | 07-04 | 1 | CHAT-06 | — | 화면에 순차 주장 장치·claim 픽스처 없음 | client | `npx vitest run --project client --project unit` | ✅ 수정 | ⬜ pending |
| 07-05-T1·T2 | 07-05 | 2 | CHAT-04·03·05 | — | 수신 4.5초 만료·단계 변경 시 비움·복원 합치기·표시 흐름 | client | `npx vitest run test/client/chatStore.test.ts` | ❌ W0 | ⬜ pending |
| 07-05-T3 | 07-05 | 2 | CHAT-05 | — | 포커스 게이트 키보드 lift·LOG_H 고정 | client | `npx vitest run test/client/keyboardLift.test.tsx` | ❌ W0 | ⬜ pending |
| 07-06-T1·T2, 07-07-T1~T3 | 07-06, 07-07 | 2, 3 | CHAT-06 | — | 화면에 빠른 메시지·이모티콘·변론 칩·말풍선·채팅 로그 없음 | client | `npx vitest run --project client && npx vite build` | ✅ 수정 | ⬜ pending |
| 07-08-T1·T2 | 07-08 | 4 | CHAT-06 | — | `claim` 단계 없음: `dayAnnounce` → `discussion` | unit | `npx vitest run test/unit/tick.test.ts test/unit/nyquist-02-phase-matrix.test.ts` | ✅ 수정 | ⬜ pending |
| 07-08-T1, 07-11-T3, 07-12-T1 | 07-08, 07-11, 07-12 | 4, 7, 8 | CHAT-06 | T-7-input | `claim`/`say`/`emoji` 메시지는 스키마가 거부 | unit | `npx vitest run test/unit/schemas.test.ts` | ✅ 수정 | ⬜ pending |
| 07-08-T1·T3, 07-14-T2 | 07-08, 07-14 | 4, 9 | CHAT-06 | — | 옛 저장 방 정규화(claim 단계·옛 번호 필드) | unit+worker | `npx vitest run test/unit/gameRoom.test.ts test/worker/alarm.test.ts` | ✅ 수정 | ⬜ pending |
| 07-09-T1·T2 | 07-09 | 5 | CHAT-06 | T-7-leak | 와이어에 claimLog 없음, 역할 단어 허용 경로 축소 | unit+worker | `npx vitest run test/unit/view.test.ts test/worker/leak.test.ts` | ✅ 수정 | ⬜ pending |
| 07-10-T1·T2 | 07-10 | 6 | CHAT-04 | T-7-leak | 입력 중 중계 간격·채널별 수신·단계 키 폐기 | worker | `npx vitest run test/worker/chat.test.ts -t "입력 중"` | ❌ W0 | ⬜ pending |
| 07-11-T1 | 07-11 | 7 | CHAT-01 | — | 로비·낮 `all` 이 방의 모두에게 간다 | worker | `npx vitest run test/worker/chat.test.ts` | ✅ 07-10 이 만든 파일 | ⬜ pending |
| 07-11-T2 | 07-11 | 7 | CHAT-02 | T-7-phase | 단계 키 어긋난 메시지는 폐기 + `chatReject{"phase"}` | worker | `npx vitest run test/worker/chat.test.ts -t "단계 어긋남"` | ✅ 07-10 이 만든 파일 | ⬜ pending |
| 07-11-T2 | 07-11 | 7 | CHAT-05 | T-7-dos | 서버가 막고 보낸 사람에게만 `chatReject` | worker | `npx vitest run test/worker/chat.test.ts -t "거절"` | ✅ 07-10 이 만든 파일 | ⬜ pending |
| 07-10-T2, 07-11-T3, 07-12-T3, 07-14-T3 | 07-10, 07-11, 07-12, 07-14 | 6, 7, 8, 9 | CHAT-02 | T-7-leak | 밤 마피아 채팅·입력 중이 시민 소켓에 0건 | worker(누설) | `npx vitest run test/worker/leak.test.ts test/worker/chatLeak.test.ts` | ✅ 확장 / ❌ W0 | ⬜ pending |
| 07-14-T3 | 07-14 | 9 | CHAT-03 | T-7-leak | 탈락자 채팅·입력 중이 산 사람 소켓에 0건 | worker(누설) | `npx vitest run test/worker/chatLeak.test.ts` | ❌ W0 | ⬜ pending |
| 07-14-T1·T2 | 07-14 | 9 | CHAT-03 | T-7-replay | 재접속 `chatLog` 도 같은 규칙(채널별 30줄·보낼 때 마스크) | worker | `npx vitest run test/worker/chatReplay.test.ts` | ❌ W0 | ⬜ pending |
| 07-12-T1, 07-14-T3 | 07-12, 07-14 | 8, 9 | CHAT-06 | T-7-leak | `broadcastEvent` 부재·삭제 식별자 부재 정적 가드 | unit(정적) | `npx vitest run test/unit/chatStaticGuard.test.ts` | ❌ W0 | ⬜ pending |
| 07-13-T1~T3 | 07-13 | 8 | CHAT-01·05 | — | 로비 채팅 패널(보내기·흐림·막힘 알림·복원 조용히) | client + E2E | `npx vitest run test/client/useChat.test.tsx test/client/lobby.test.tsx` | ❌ W0 / ✅ 수정 | ⬜ pending |
| 07-15-T1~T3 | 07-15 | 9 | CHAT-01·02·03 | T-7-leak | 테이블 채팅 패널, 시민 편 DOM 에 마피아 채널 문구 0건 | client + E2E | `npx vitest run test/client/nightChat.test.tsx` | ❌ W0(07-07 이 지운 뒤 재작성) | ⬜ pending |
| 07-16-T1 | 07-16 | 10 | CHAT-01·02·05 | T-7-leak | 실서버 스모크: 채널·거절·재접속 복원 | script | `node scripts/smoke.mjs http://localhost:5173 --stage full --players 5` | ✅ 수정 | ⬜ pending |
| 07-18-T1~T3 | 07-18 | 10 | CHAT-04 | — | 이름표 `data-typing`, 카메라 가시성 | unit/E2E | `npx vitest run test/unit/camera.test.ts` | ✅ 수정 | ⬜ pending |
| 07-19-T1 | 07-19 | 11 | CHAT-05 | — | 한글 조합 중 Enter: 한 번만 전송, 잔여 글자 없음 | E2E(CDP IME) | `npm run e2e -- --url http://localhost:5173 --only chat-ime` | ❌ W0 | ⬜ pending |
| 07-19-T3 | 07-19 | 11 | CHAT-05 | — | 키보드 가림·캔버스 불변 (합격 검사 1·2·3·6 자동 몫) | E2E(가상 viewport) | `npm run e2e -- --url http://localhost:5173 --only chat-keyboard` | ❌ W0 | ⬜ pending |
| 07-20-T1·T2 | 07-20 | 12 | CHAT-06·01 | — | E2E 하네스에 주장·빠른 메시지 판정 없음, 사본 상수 일치 | node --test + unit | `node --test scripts/e2e/lib.test.mjs && npx vitest run test/unit/e2eContract.test.ts` | ✅ 수정 | ⬜ pending |
| 07-21-T2 | 07-21 | 13 | CHAT-01~06 | — | 배포본 smoke·E2E chat·채팅 부하 fps | deploy | `node scripts/smoke.mjs --prod --stage full` | ✅ 수정 | ⬜ pending |
| 07-21-T3 | 07-21 | 13 | CHAT-05 | — | iPhone 실기기 합격 검사 1~7·IME (Manual-Only 표) | manual | 사람 확인 — 자동 명령 없음 | — | ⬜ pending |

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

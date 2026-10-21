---
phase: "1"
slug: "walking-skeleton"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-21"
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.12 + `@cloudflare/vitest-plugin` 1.4.6 (workerd) + happy-dom 21.0.4 + @testing-library/react 16.3.3 |
| **Config file** | `vitest.config.ts` (projects: `unit` / `client` / `worker`) — none, Wave 0 installs |
| **Quick run command** | `npx vitest run --project unit` |
| **Full suite command** | `npx vitest run && npm run typecheck` |
| **Deployed smoke** | `node scripts/smoke.mjs https://<worker>.workers.dev` |
| **Estimated runtime** | ~30 seconds (full), ~1 second (unit) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --project unit`
- **After every plan wave:** Run `npx vitest run && npm run typecheck`
- **Before `/gsd-verify-work`:** Full suite green + deployed `smoke.mjs` green + real-device UAT
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD (planner fills) | — | — | ROOM-01 | — | 4자리 코드, 충돌 재시도, 생성 응답에 `code`+`token` | unit + worker | `npx vitest run test/unit/roomCode.test.ts test/unit/share.test.ts test/worker/http.test.ts` | ❌ W0 | ⬜ pending |
| TBD | — | — | ROOM-02 | — | 닉네임 1~8자·NFC·중복 거부·제어문자 거부 | unit + worker | `npx vitest run test/unit/nickname.test.ts test/worker/join.test.ts` | ❌ W0 | ⬜ pending |
| TBD | — | — | ROOM-03 | — | 9번째 join 거부, 4명 미만·비방장 start 거부 | unit + worker | `npx vitest run test/unit/room.test.ts` | ❌ W0 | ⬜ pending |
| TBD | — | — | CONN-01 | — | `hello{token}` 로 같은 seat/role 복구, 잘못된 토큰 거부 | worker | `npx vitest run test/worker/reconnect.test.ts` | ❌ W0 | ⬜ pending |
| TBD | — | — | DEPLOY-01 | — | 배포 주소에서 생성→참가→시작→`day` | smoke + manual | `node scripts/smoke.mjs <url>` | ❌ W0 | ⬜ pending |
| TBD | — | — | GAME-01 | — | 단계 연쇄·알람 다중화·마감 계산 | unit + worker | `npx vitest run test/unit/tick.test.ts test/unit/clock.test.ts test/worker/alarm.test.ts` | ❌ W0 | ⬜ pending |
| TBD | — | — | ROLE-01 | — | 4~8명 구성표 정확 | unit | `npx vitest run test/unit/roles.test.ts` | ❌ W0 | ⬜ pending |
| TBD | — | — | ROLE-02 | — | 타인 `role`/`token` 이 어떤 프레임에도 없음, 마피아만 `allies` | unit + worker + smoke | `npx vitest run test/unit/view.test.ts test/worker/leak.test.ts` | ❌ W0 | ⬜ pending |
| TBD | — | — | (UI) | — | 자리 배치·타이머 마지막 5초 | unit + client | `npx vitest run test/unit/seatLayout.test.ts test/client/timer.test.tsx` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `vitest.config.ts` (3 projects), `tsconfig.app.json`, `tsconfig.worker.json`, `package.json` scripts (`dev`/`build`/`test`/`typecheck`/`deploy`/`cf-typegen`)
- [ ] `test/unit/*`, `test/worker/*`, `test/client/*` stubs
- [ ] `scripts/smoke.mjs` (Node built-in WebSocket)
- [ ] Package install (versions from 01-RESEARCH.md) + `npx wrangler types`
- [ ] `.gitignore` 에 `worker-configuration.d.ts` 추가

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 폰 2대 이상이 배포 주소로 같은 방에 들어가 역할 확인 | DEPLOY-01, ROLE-02 | 실기기 브라우저·네트워크 | 배포 URL 을 폰 2대+ 에서 열고 방 생성·참가·시작 |
| 화면 잠금·탭 새로고침 후 같은 자리·같은 역할 복귀 | CONN-01 | 모바일 OS 의 백그라운드 동작 | 역할 확인 중 화면 끄고 켜기, 새로고침 |
| 카카오톡 공유 버튼 | ROOM-01 | Web Share API 는 HTTPS 실기기에서만 | 공유 버튼으로 카카오톡에 링크 보내고 열기 |
| 재배포 후 주소 불변·새 버전 표시 | DEPLOY-01 | 실제 배포 필요 | 문구 수정 → `npm run deploy` → 새로고침 |
| 카운트다운이 모든 폰에서 같은 시각에 끝남 | GAME-01 | 여러 기기 시계 비교 | 폰 나란히 두고 역할 확인 15초 종료 시점 비교 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

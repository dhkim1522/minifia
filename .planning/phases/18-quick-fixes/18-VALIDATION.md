---
phase: "18"
slug: "quick-fixes"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-11-09"
---

# Phase 18 — Validation Strategy

> 실행 중 피드백 샘플링을 위한 페이즈별 검증 계약. 상세 시험 지도는 `18-RESEARCH.md` §Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.12 (projects `unit`·`client`·`worker`) + `node --test`(E2E 순수 도우미) + playwright-core 1.64.1(E2E) |
| **Config file** | `vitest.config.ts`, `wrangler.jsonc`, `scripts/e2e/run.mjs` |
| **Quick run command** | `npx vitest run --project <unit\|client\|worker> <바꾼 시험 파일>` |
| **Full suite command** | `npm run typecheck && npm test && node --test scripts/e2e/lib.test.mjs` |
| **Estimated runtime** | quick ~10초, full 수 분, E2E 바뀐 흐름 수 분 · 전체 회귀 ≈26분 |

---

## Sampling Rate

- **After every task commit:** 바꾼 파일의 quick run + 서버·타입 변경 때 `npm run typecheck`
- **After every plan wave:** `npx vitest run --project unit --project client` + 바뀐 워커 시험 + `node --test scripts/e2e/lib.test.mjs`
- **Before `/gsd-verify-work`:** full suite 초록 → 로컬 `npm run dev` 후 바뀐 흐름 E2E(`--only avatar-dress,tutorial-solo,tutorial-together,errand,witness,trace,emcee-band,night,result`) → 전체 회귀 1회 → 배포 → 배포본 smoke
- **Max feedback latency:** 30초 (task 단위 quick run)

---

## Per-Task Verification Map

| SC | Behavior | Test Type | Automated Command | File Exists | Status |
|----|----------|-----------|-------------------|-------------|--------|
| SC-1 | `resolveLookConflicts`·`setLook` 잠금·`.role` 소스 가드 | unit | `npx vitest run --project unit test/unit/look.test.ts` | ✅ 확장 | ⬜ pending |
| SC-1 | `beginGame` 해소, `randInt` 호출 수 불변 | unit | `npx vitest run --project unit test/unit/gameRoom.test.ts test/unit/rematch.test.ts` | ✅ 확장 | ⬜ pending |
| SC-1 | 워커: 잠긴 옷 거절, 시작 뒤 look 전원 다름, leak 단언 수정 | worker | `npx vitest run --project worker test/worker/dress.test.ts test/worker/start.test.ts test/worker/leak.test.ts` | ✅ (leak 수정) | ⬜ pending |
| SC-1 | `DressSheet` `data-taken` 잠금 | client | `npx vitest run --project client test/client/dressSheet.test.tsx test/client/lobby.test.tsx test/client/resultScreen.test.tsx` | ✅ 확장 | ⬜ pending |
| SC-2 | 조명 허용 범위 1~3(채도·배경 비·색온도), 밤 값 불변 | unit | `npx vitest run --project unit test/unit/lighting.test.ts` | ❌ W0 | ⬜ pending |
| SC-2 | 기존 조명 시험 갱신 | unit | `npx vitest run --project unit test/unit/plazaScene.test.ts test/unit/barScene.test.ts` | ✅ 수정 | ⬜ pending |
| SC-2 | 허용 범위 4(렌더 휘도 순서)·5(가독) | 백스톱 | 갤러리 촬영 휘도 측정 + E2E H1 | ❌ W0 | ⬜ pending |
| SC-3 | 스포트라이트·[다음] 알약·패널/[내 역할] 숨김·카메라·선 clamp | client | `npx vitest run --project client test/client/focusRing.test.tsx test/client/tutorialScenes.test.tsx test/client/tutorialScreen.test.tsx test/client/tutorialGate.test.tsx` | ✅ 확장 | ⬜ pending |
| SC-3 | 직업 카드 = `ROLE_TEXT[role].desc`, 정적 가드, 도윤 자리 | unit + client | `npx vitest run test/client/tutorialOpening.test.tsx test/unit/tutorialStaticGuard.test.ts test/unit/tutorialScript.test.ts test/unit/camera.test.ts` | ✅ 수정 | ⬜ pending |
| SC-4 | 밤 띠 "얼굴", `[data-pre-notice]` 0, `eyeOff` "목격자 없음" | unit + client | `npx vitest run test/unit/hostLine.test.ts test/unit/e2eContract.test.ts test/client/phaseScreens.test.tsx test/client/evidenceCard.test.tsx test/client/recordTrace.test.tsx test/client/icon.test.tsx` | ✅ 수정 | ⬜ pending |
| SC-4 | E2E 문구·표식 표 일치 | node | `node --test scripts/e2e/lib.test.mjs` | ✅ | ⬜ pending |
| SC-5 | 바뀐 흐름 E2E(폰 6종) → 전체 회귀 1회 → 배포 → smoke | e2e | `npm run e2e -- --url http://localhost:5173 --only avatar-dress,tutorial-solo,tutorial-together,errand,witness,trace,emcee-band,night,result` / `npm run deploy` → `npm run smoke` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `test/unit/lighting.test.ts` — 허용 범위 1~3(두 맵), 낮 moonColor 따뜻함, 밤 값 불변
- [ ] 갤러리 촬영 휘도 측정 스크립트(또는 `scripts/gallery.mjs` 옵션) — 허용 범위 4·5
- [ ] `scripts/e2e/lib.mjs` 순수 검사 함수(스포트라이트, [다음] 기하, 숨김, 장면 5 선 안쪽, 흔적 같은 옷 ≤ 1) + `lib.test.mjs` 단위 시험
- [ ] 표식 상수 동기화: `AVATAR_MARKERS`(+`data-taken`), 튜토리얼 표식(+`data-tutorial-dim`) — `lib.mjs`·`lib.test.mjs`·`e2eContract.test.ts`

프레임워크 설치는 필요 없다(전부 설치됨).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 낮·밤이 장면만 보고 구분되는 느낌 | SC-2 | 지각 판단 | v3.0 실테스트에서 실기기로 확인(실기기 항목은 끝에 몰아서) |
| 튜토리얼 실기기 터치·가독 | SC-3 | 실기기 | v3.0 실테스트로 미룸 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

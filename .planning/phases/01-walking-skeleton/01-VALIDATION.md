---
phase: "1"
slug: "walking-skeleton"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-21"
revised: "2026-10-23"
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> 개정(2026-10-23): UI-SPEC 개정 2·결정 0012 를 반영한 01-RESEARCH.md "Validation Architecture" 로 다시 만들었다. 01-01~01-03 은 실행됨(현재 16 파일 / 123 테스트 통과).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.12 + `@cloudflare/vitest-plugin` 1.4.6 (workerd) + happy-dom 21.0.4 + @testing-library/react 16.3.3 |
| **Config file** | `vitest.config.ts` (projects: `unit` node / `client` happy-dom / `worker` cloudflareTest) — 있음 |
| **Quick run command** | `npx vitest run --project unit` |
| **Full suite command** | `npx vitest run && npm run typecheck` (개정 후 `typecheck` 앞에 `tokens:check`) |
| **Deployed smoke** | `node scripts/smoke.mjs --prod --stage <create\|full>` |
| **Estimated runtime** | ~30 seconds (full), ~2 seconds (unit) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --project unit` (+ 해당 client/worker 테스트 파일)
- **After every plan wave:** Run `npx vitest run && npm run typecheck`
- **Before `/gsd-verify-work`:** 전체 스위트 green + 배포본 `smoke.mjs --stage full` green + 실기기 UAT
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD (planner fills) | — | — | ROOM-01 | — | 코드 `^\d{4}$`·충돌 재시도·응답 `code+token`. 공유 시트: `shareOnly`(취소 무시)·`copyLink`(실패 시 manual), [공유하기] 숨김 조건, 링크에 토큰 없음 | unit + client | `npx vitest run test/unit/share.test.ts test/client/shareSheet.test.tsx` | share ✅ / 시트 ❌ W0 | ⬜ pending |
| TBD | — | — | ROOM-02 | — | 닉네임 규칙. 미리보기 `players` 키 집합 `["nickname","seat"]`·자리 순·lobby 아니면 `[]`·없는 방 404. S-02 폴링 10초·`hidden` 중단 | unit + worker + client | `npx vitest run test/unit/preview.test.ts test/worker/preview.test.ts test/worker/join.test.ts test/client/joinByLink.test.tsx` | ❌ W0 | ⬜ pending |
| TBD | — | — | ROOM-03 | — | `connectedCount`·`checkStart`: 연결 4/자리 6 시작 가능·6명 배정, 연결 3/자리 8 거절, 비방장 거절, 정원 = 자리 수, 거절 시 최신 `state` 재전송. 화면: [게임 시작] 활성·안내 문구·"8 / 8명 · 가득 찼어요" | unit + worker + client | `npx vitest run test/unit/gameRoom.test.ts test/worker/start.test.ts test/client/lobby.test.tsx` | gameRoom ✅(확장) / 나머지 ❌ | ⬜ pending |
| TBD | — | — | CONN-01 | — | `hello{token}` 로 같은 seat/role 복구, 잘못된 토큰 거부. 연결 상태기계: 띠 → "다시 연결됐어요" 2초 → 숨김, 30초 visible 연속 실패 → 포기 화면, `hidden` 시간은 세지 않음. 낡은 세션은 미리보기 404 로 삭제 | unit + worker + client | `npx vitest run test/unit/linkReducer.test.ts test/unit/session.test.ts test/worker/reconnect.test.ts test/client/useRoomConnection.test.tsx` | 일부 ✅ / 나머지 ❌ | ⬜ pending |
| TBD | — | — | DEPLOY-01 | — | 배포 주소에서 생성→참가→시작→`day`, 재배포 후 주소 불변·새 버전, 에셋 URL 파일 존재·배포본 `%40` URL 200 | smoke + unit + manual | `node scripts/smoke.mjs --prod --stage full`; `npx vitest run test/unit/assets.test.ts` | ❌ W0 | ⬜ pending |
| TBD | — | — | GAME-01 | — | `tick` 연쇄·알람 다중화. `formatMmSs`(15→`0:15`)·마지막 5초. 카드 면 전이: 5초 자동 한 번, 탭 토글, 5초 뒤 입장은 앞면 | unit + worker + client | `npx vitest run test/unit/tick.test.ts test/unit/countdown.test.ts test/unit/cardFace.test.ts test/worker/alarm.test.ts test/client/timer.test.tsx` | clock ✅ / 나머지 ❌ | ⬜ pending |
| TBD | — | — | ROLE-01 | — | 4~8명 구성표, 끊긴 사람 포함 전원 배정 | unit | `npx vitest run test/unit/roles.test.ts test/unit/gameRoom.test.ts` | roles ✅ | ⬜ pending |
| TBD | — | — | ROLE-02 | — | 타인 `role`/`token` 미포함, 마피아만 `allies`, 미리보기 누출 없음, 실제 소켓 프레임 전수. 카드 뒷면 DOM 이 역할마다 동일·뒷면에 역할 이름·직업 그림 없음 | unit + worker + client + smoke | `npx vitest run test/unit/view.test.ts test/worker/leak.test.ts test/client/roleCard.test.tsx` | ❌ W0 | ⬜ pending |
| TBD | — | — | (UI) 시트 | — | `Sheet`: Esc·막·[닫기]로 닫힘, 닫기 폴백 타이머, 단계 변경 후에도 열린 채, ConfirmSheet 열면 [취소] 포커스 | client | `npx vitest run test/client/sheet.test.tsx test/client/confirmSheet.test.tsx` | ❌ W0 | ⬜ pending |
| TBD | — | — | (UI) 토스트 | — | `diffRoomViews`: 처음·재연결 때 토스트 없음, 나 제외, 방장 변경 우선 | unit + client | `npx vitest run test/unit/roomDiff.test.ts test/client/toast.test.tsx` | ❌ W0 | ⬜ pending |
| TBD | — | — | (UI) 테이블 | — | Table 입력에 역할 없음, 끊김 접근성 이름, 방장 배지 한 명, 동료 표시는 `allies` 일 때만 | unit + client | `npx vitest run test/unit/seatLayout.test.ts test/client/table.test.tsx` | seatLayout ✅ | ⬜ pending |
| TBD | — | — | (문구) | — | `messageForApiError` 가 UI-SPEC Error state 표와 같은 문구·위치 | unit | `npx vitest run test/unit/copy.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] 위 표의 ❌ 테스트 파일(서버 규칙·미리보기·연결·시트·카드·토스트·에셋·문구)
- [ ] `package.json`: `"tokens:check": "node scripts/gen-tokens.mjs --check"`, `typecheck` 앞에 연결
- [ ] `.gitattributes`: `src/styles/tokens.css text eol=lf`(Windows CRLF 로 `--check` 가 깨지지 않게)
- [ ] `scripts/smoke.mjs` 에 `full` 단계(미리보기 키·연결자 4 시작 조건·재접속·누출 전수) — 01-10
- [ ] 테스트 인프라 신규 설치 없음(happy-dom `<dialog>.showModal` 지원, `import.meta.glob` 으로 파일 존재 확인)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 폰 2대 이상이 배포 주소로 같은 방에 들어가 역할 확인 | DEPLOY-01, ROLE-02 | 실기기 브라우저·네트워크 | 배포 URL 을 폰 2대+ 에서 열고 방 생성·참가·시작 |
| 360×640 급 iPhone Safari 에서 S-03~S-06 세로 스크롤 없음(재접속 띠 52px 포함), 이름표 겹침 | ROOM-02, ROLE-02 | 실기기 주소창·안전 영역 | 작은 폰에서 8명 방으로 각 단계 확인 |
| S-02 에 8명이 앉았을 때 배치 | ROOM-02 | 폭 360px 실측 | 8명 방 링크를 작은 폰으로 열기 |
| 시트 3종 포커스·막 누르기·끌어서 닫기·닫은 뒤 포커스 복귀 | CONN-01, ROLE-02 | 터치 동작 | 내 역할·공유·확인 시트를 각각 열고 닫기 |
| 카드 5초 자동 앞면·탭 토글·직업 그림이 늦게 뜨지 않음 | ROLE-02 | 실제 망·렌더링 | 역할 확인 15초 동안 관찰 |
| 화면 잠금 → 켜기 → 띠 → "다시 연결됐어요", 잠금을 길게 해도 곧바로 포기 화면이 뜨지 않음, 같은 자리·역할 복귀 | CONN-01 | 모바일 OS 백그라운드 동작 | 역할 확인 중 화면 끄고 켜기, 새로고침 |
| 카카오톡 공유·링크 복사, 임시 OG 미리보기 | ROOM-01 | HTTPS 실기기·메신저 | 공유 시트로 카카오톡에 링크 보내고 열기 |
| 느린 망에서 대기실 인물이 채워지는 정도 | ROOM-02 | 망 속도 | 스로틀 또는 실제 느린 망 |
| 재배포 후 주소 불변·새 버전 표시, 배포본 `%40` 에셋 200 | DEPLOY-01 | 실제 배포 | 문구 수정 → `npm run deploy` → 새로고침, `curl -I` |
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

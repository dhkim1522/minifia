---
phase: "1"
slug: "walking-skeleton"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-10-21"
revised: "2026-10-30"
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
| 01-04-T1·T2·T3 | 01-04 | 3 | ROOM-02, ROOM-03, ROLE-02 | T-01-13~16 | 참가 거절 순서·정원 = 자리 수·방장 승계(연결된 사람 우선 joinSeq, 아무도 연결 안 됐으면 전체 joinSeq)·끊긴 사람만 내보내기·연결자 4명 시작 조건, 미리보기 `players` 키 `["nickname","seat"]`·lobby 에서만·누출 없음 | unit | `npx vitest run test/unit/gameRoom.test.ts test/unit/preview.test.ts` | gameRoom ✅(확장) / preview ❌ W0(T1 이 만듦) | ✅ green |
| 01-05-T1 | 01-05 | 3 | ROOM-01 | T-01-17 | 새 S-01 방 만들기, ds.css 토큰·글자·진홍 규칙 | client | `npx vitest run test/client/screens.test.tsx test/client/app.test.tsx` | ✅(수정) | ✅ green |
| 01-05-T2 | 01-05 | 3 | ROOM-01 (문구) | T-01-18 | `messageForApiError` 가 UI-SPEC Error state 표 전체와 같은 문구·위치, 토스트 한 번에 하나 2초 | unit + client | `npx vitest run test/unit/copy.test.ts test/client/screens.test.tsx` | copy ❌ W0(T2 가 만듦) | ✅ green |
| 01-05-T3 | 01-05 | 3 | ROOM-01, DEPLOY-01 | — | 그림 URL `%40`·srcSet 밀도·모든 URL 이 public/ 실제 파일 | unit | `npx vitest run test/unit/assets.test.ts` | ❌ W0(T3 가 만듦) | ✅ green |
| 01-06-T1·T2·T3 | 01-06 | 4 | ROOM-02, CONN-01 | T-01-19~22 | 링크·코드 참가, 입장 정보 한 칸·주소에 토큰 없음, 낡은 세션 미리보기 확인, S-02 폴링 10초·hidden 중단·직렬화, 나간 이유별 화면 | unit + client | `npx vitest run test/unit/session.test.ts test/client/joinByLink.test.tsx test/client/app.test.tsx test/client/screens.test.tsx` | ❌ W0(T1·T2 가 만듦) | ✅ green |
| 01-07-T1·T2·T3 | 01-07 | 4 | GAME-01, ROLE-01, ROLE-02, ROOM-03 | T-01-23~25 | `tick` 연쇄·따라잡기·멱등, 연결 4/자리 6 시작 → 6명 배정, 뷰 전수 누출 검사(4~8명 × 4단계 × 전원) | unit | `npx vitest run test/unit/tick.test.ts test/unit/gameRoom.test.ts test/unit/view.test.ts` | ❌ W0(각 Task 가 만듦) | ✅ green |
| 01-08-T1·T2·T3 | 01-08 | 4 | GAME-01, ROLE-02 | T-01-26~27 | `formatMmSs`(15→`0:15`)·마지막 5초, 카드 면 전이(5초 자동 한 번·탭 토글·5초 뒤 입장 앞면), 카드 뒷면 DOM 이 역할마다 동일·앞면 지연 마운트 | unit + client | `npx vitest run test/unit/countdown.test.ts test/unit/cardFace.test.ts test/client/timer.test.tsx test/client/roleCard.test.tsx` | ❌ W0(각 Task 가 만듦) | ✅ green |
| 01-09-T1·T2·T3 | 01-09 | 5 | ROOM-02, ROOM-03, CONN-01, GAME-01, ROLE-01, ROLE-02 | T-01-28~35 | 미리보기·참가 라우트, leave·kick, 재접속·교체·evict, 연결 3 시작 거절 + state 재전송, 알람 진행, 실제 프레임 전수 누출 | worker | `npx vitest run test/worker` | http ✅ / 나머지 ❌ W0(각 Task 가 만듦) | ✅ green |
| 01-10-T1·T2·T3 | 01-10 | 5 | ROOM-02, ROOM-03 | T-01-36~38 | Table 입력에 역할 없음·끊김 접근성 이름·방장 배지 한 명·빈 의자 없음, 연결자 기준 [게임 시작]·"8 / 8명 · 가득 찼어요", `diffRoomViews` 처음·재연결 토스트 없음·방장 변경 우선 | unit + client | `npx vitest run test/unit/roomDiff.test.ts test/client/dayTable.test.tsx test/client/lobby.test.tsx test/client/screens.test.tsx` | ❌ W0(각 Task 가 만듦) | ✅ green |
| 01-11-T1·T2·T3 | 01-11 | 5 | CONN-01, GAME-01 | T-01-39~41 | 띠 52px → "다시 연결됐어요" 2초, 백오프·복귀 점검, 30초 visible 연속 실패만 포기, 3번 실패 시 방 생존 확인, ping 표본 오프셋, epoch | unit + client | `npx vitest run test/unit/linkReducer.test.ts test/client/useRoomConnection.test.tsx test/client/roomScreen.test.tsx` | useRoomConnection ✅(교체) / 나머지 ❌ W0 | ✅ green |
| 01-12-T1·T2 | 01-12 | 6 | ROOM-01, ROOM-03 | T-01-42~43 | `<dialog>` 시트(Esc·막·[닫기]·폴백 타이머·StrictMode), 확인 시트 [취소] 포커스, `shareOnly`·`copyLink`, [공유하기] 숨김 조건, 링크에 토큰 없음 | unit + client | `npx vitest run test/unit/share.test.ts test/client/sheet.test.tsx test/client/lobby.test.tsx` | share ✅(확장) / sheet ❌ W0 | ✅ green |
| 01-12-T3 | 01-12 | 6 | (스타일 정리) | — | 01-02 임시 스타일 파일·옛 클래스 없음 | client + build | `npm run typecheck && npm run build && npx vitest run --project client` | ✅ | ✅ green |
| 01-13-T1·T2·T3 | 01-13 | 7 | GAME-01, ROLE-02, CONN-01 | T-01-44~46 | 배정·[내 역할] 마크업이 역할과 무관, 5초 자동 앞면, 타이머 0 뒤 서버 낮 대기, 시트가 단계 변경에도 열린 채·앞면 본 적 없으면 뒷면·마운트 때부터 앞면(6초 경과 새로고침)이면 시트도 앞면 | client | `npx vitest run test/client/phaseScreens.test.tsx` | ❌ W0(T1 이 만듦) | ✅ green |
| 01-14-T1·T2 | 01-14 | 8 | DEPLOY-01, ROOM-03, ROLE-01, ROLE-02, GAME-01, CONN-01 | T-01-47~49 | 배포본 다인원 한 판·연결 3 시작 거절·누출 전수·마감 동일·편차 < 500ms·재접속·재배포 버전 변경·`%40` 에셋 200·OG 메타 | smoke | `node scripts/smoke.mjs --prod --stage full --players 5` | ❌ W0(T1 이 만듦) | ✅ green |
| 01-14-T3 | 01-14 | 8 | DEPLOY-01 | T-01-50~51 | HANDOFF·README push, 실기기 UAT(아래 Manual-Only) | manual + git | `git fetch origin && test "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)"` | — | ✅ green |

*Status: ✅ green · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] 위 표의 ❌ 테스트 파일(서버 규칙·미리보기·연결·시트·카드·토스트·에셋·문구)
- [x] `package.json`: `"tokens:check": "node scripts/gen-tokens.mjs --check"`, `typecheck` 앞에 연결
- [x] `.gitattributes`: `src/styles/tokens.css text eol=lf`(Windows CRLF 로 `--check` 가 깨지지 않게)
- [x] `scripts/smoke.mjs` 에 `full` 단계(미리보기 키·연결자 4 시작 조건·재접속·누출 전수) — 01-14
- [x] 테스트 인프라 신규 설치 없음(happy-dom `<dialog>.showModal` 지원, `import.meta.glob` 으로 파일 존재 확인)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 연결된 4명 이상이 배포 주소로 같은 방에 들어가 역할 확인 | DEPLOY-01, ROLE-02 | 실기기 브라우저·네트워크 | 한 브라우저 프로필 = 한 사람(입장 정보 한 칸 — 같은 프로필 두 번째 탭은 첫 탭 자리를 이어받는다). 폰 4대, 또는 폰 2대+ 와 PC 의 서로 다른 브라우저·브라우저 프로필(시크릿 창은 브라우저마다 한 사람)로 방 생성·참가·시작 |
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

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** 2026-10-30 검증 감사 통과

---

## Validation Audit 2026-10-30

현재 코드(결정 0030~0040 반영) 기준으로 감사했다. 위 표의 테스트 파일은 `table.test.tsx` 하나를 빼고 모두 존재하고, 그 몫은 `test/client/dayTable.test.tsx`(대기실 테이블이 낮과 같은 DayTable, 결정 0028)와 `lobby.test.tsx` 가 이어받았다. 표의 상태는 모두 green 으로 갱신했다. 배포본 스모크·실기기 항목은 Manual-Only 로 남긴다.

| 지표 | 값 |
|------|----|
| 찾은 갭 | 1 (PARTIAL: 시작 → 배정 → 역할 확인을 한 흐름으로 잇는 4~8명 전수 검증, 재접속 뒤 같은 역할·동료·마감) |
| 해결 | 1 |
| 보류(ESCALATE) | 0 |

신규 테스트: `test/unit/nyquist-01-roleflow.test.ts` (ROLE-01·ROLE-02·CONN-01). 4~8명 × 시드 10개로 `startGame` → `tick` → roleReveal 까지 돌려 구성표 개수, 마피아끼리만 동료 좌석, 비마피아에 `allies` 없음을 확인하고, 끊겼다 같은 토큰으로 돌아온 뒤 같은 자리·역할·동료·마감인지, 시민 view 직렬화에 남의 역할 이름·토큰이 없는지 본다. 명령: `npx vitest run test/unit/nyquist-01-roleflow.test.ts`. 전체 `npx vitest run` 116 파일 3065 테스트 통과.

---
phase: 05-atmosphere-character
verified: 2026-10-30T10:35:00Z
status: passed
score: 5/5 must-haves verified
covered_files:
  - ".planning/phases/05-atmosphere-character/05-01-PLAN.md"
  - ".planning/phases/05-atmosphere-character/05-01-SUMMARY.md"
  - ".planning/phases/05-atmosphere-character/05-02-PLAN.md"
  - ".planning/phases/05-atmosphere-character/05-02-SUMMARY.md"
  - ".planning/phases/05-atmosphere-character/05-03-PLAN.md"
  - ".planning/phases/05-atmosphere-character/05-03-SUMMARY.md"
  - ".planning/phases/05-atmosphere-character/05-04-PLAN.md"
  - ".planning/phases/05-atmosphere-character/05-04-SUMMARY.md"
  - ".planning/phases/05-atmosphere-character/05-05-PLAN.md"
  - ".planning/phases/05-atmosphere-character/05-05-SUMMARY.md"
  - ".planning/phases/05-atmosphere-character/05-06-PLAN.md"
  - ".planning/phases/05-atmosphere-character/05-06-SUMMARY.md"
  - ".planning/phases/05-atmosphere-character/05-07-PLAN.md"
  - ".planning/phases/05-atmosphere-character/05-07-SUMMARY.md"
  - ".planning/phases/05-atmosphere-character/05-08-PLAN.md"
  - ".planning/phases/05-atmosphere-character/05-08-SUMMARY.md"
  - ".planning/phases/05-atmosphere-character/05-09-PLAN.md"
  - ".planning/phases/05-atmosphere-character/05-09-SUMMARY.md"
  - "src/components/Backdrop.tsx"
  - "src/components/TestTools.tsx"
  - "src/game/dayTable.ts"
  - "src/game/scenes.ts"
  - "src/net/useWakeLock.ts"
  - "src/screens/DayScene.tsx"
  - "src/screens/JoinByLink.tsx"
  - "src/screens/RoomScreen.tsx"
  - "src/styles/atmosphere.css"
covered_digest: "v3:sha256:321e352a6342b449037d2e66fcca633e3d1393a7817cde0eb9853f99e0933a0c"
behavior_unverified: 0
overrides_applied: 0
---

# Phase 5: 분위기와 캐릭터 검증 보고서

**Phase Goal:** 화면이 무거운 분위기로 바뀌고, 플레이어마다 외형이 다른 캐릭터를 받으며, 세로 폰 화면에서 처음 하는 사람도 설명 없이 지금 할 일을 알 수 있다.
**Verified:** 2026-10-30
**Status:** passed
**Re-verification:** 아니오 — 최초 검증 (현재 코드 기준)

## 목표 달성

### 관찰 가능한 진실 (ROADMAP 성공 기준 5개)

| # | 진실 | 상태 | 근거 |
|---|------|------|------|
| 1 | 어두운 배경과 긴장감 연출이 대기실부터 결과까지 이어지고, 밤·아침·처형 단계가 바뀔 때 분위기가 눈에 띄게 달라진다 | ✓ VERIFIED | `src/game/scenes.ts` 의 `NIGHT_VIGNETTE_*`·`MORNING_GLOW_*`·`nightVignetteGradient()`·`morningGlowGradient()` 가 실재한다. `Backdrop.tsx:132-135` 가 밤 그림 층 자식 `div.mf-backdrop__vignette` 를 `vignette && scene==="night"` 일 때만 그린다. `DayScene.tsx:263-267` 이 아침 단계에 `div.mf-morningglow`(`--mf-glow`, 밤→아침 전환 렌더만 `--rise`)를 그린다. `atmosphere.css` 에 `pointer-events: none` 규칙과 애니메이션이 있다. 시험: `atmosphere.test.tsx`·`atmosphereCss.test.ts`·`scenes.test.ts` 통과. 체감 세기는 실기기 ⑨·⑩ 을 사용자가 2026-10-30 승인. |
| 2 | 8명이 한 방에 있어도 서로 다른 외형 캐릭터를 하나씩 받고, 대기실·투표·결과 화면에서 닉네임과 함께 보인다. 능력은 달라지지 않는다 | ✓ VERIFIED | `public/characters/table/fig1~fig8` (2x·4x) 8종 존재. `src/net/assets.ts:40 figureSrc(seat)` 는 자리 번호만의 함수라 역할·능력과 무관하다. `Lobby.tsx` 는 `DayTable` 로, `ResultScreen.tsx:86-91` 은 `Figure` + `player?.nickname` 으로 닉네임과 함께 그린다. `characterAudit.test.tsx` 12건 통과(8개 서로 다름, 대기실·낮·후보 선택·결과 닉네임 이름표). 움직임 없음·새 에셋 없음은 사용자 결정(0038 D-01·D-02)이라 범위 밖. |
| 3 | 모든 단계 화면에 지금 할 일이 한 문장과 남은 시간으로 보인다 | ✓ VERIFIED | `data-guide=""` 가 `Lobby`·`Assigning`·`RoleReveal`·`ResultScreen`·`PhaseBar`·`ReadOnlyRow`·`TurnPanel`·`ClaimPanel`·`NightPanel`·`ExecVotePanel`·`DefensePanel`·`DefenseChips` 에 있고(`CandidateVotePanel` 은 제목 하나가 안내) `PHASE_GUIDE_FILL` 이 `DayScene` 에서 실제로 쓰인다. 시간 없는 단계는 `TIMELESS_PHASES=[lobby, assigning, ended]` 뿐이며 `e2eContract.test.ts` 가 E2E 상수와 동일성을 지킨다. `guide.test.tsx`(14단계 × 역할 시점, 한 화면 정확히 하나·타이머) 통과. |
| 4 | 폰 폭 360~430px 세로 화면에서 스크롤 없이 지금 할 일과 메시지 영역이 함께 보이고, PC 에서는 가운데 폰 폭으로 보인다 | ✓ VERIFIED | `base.css` `#root { max-width: 430px }`, `room.css` 방 높이 `100dvh`·`overflow: hidden`. `dayTable.ts` `tableFitScale`(하한 0.77, 지원 하한 방 높이 516)·`TestTools.tsx` `data-compact`·`JoinByLink` `--many` 수정자가 짧은 폰을 처리한다. 시험 `dayTable.test.ts`·`testToolsCompact.test.tsx`·`joinByLink.test.tsx` 통과. 배포본 E2E(열 흐름 × 360x640·390x664·430x932·360x560 + `pc` 1280x800 + `wakelock`) 전부 통과(05-09, 493초, 실패 0). 실기기 ⑫·⑬ 을 사용자가 승인. |
| 5 | 지원 기기에서는 게임 중 화면이 꺼지지 않고, 미지원 기기에서도 게임은 정상 진행된다 | ✓ VERIFIED | `src/net/useWakeLock.ts` 가 `navigator.wakeLock` 부재·동기 예외·거부·release 거부를 조용히 생략하고, 재요청은 `visibilitychange`(visible) 한 곳뿐이며 비활성·언마운트 시 release 한다. `RoomScreen.tsx:124` 가 `view !== null && phase !== "ended" && status ∉ {replaced, failed, removed}` 로 연결했다. 상태 전이 성격의 진실이라 행동 시험이 필요하며 `useWakeLock.test.tsx` 13건(요청·재요청·해제·거부·미지원)이 통과해 행동 근거가 있다. 실기기 ⑪ 을 사용자가 승인. |

**점수:** 5/5 진실 검증됨 (PRESENT_BEHAVIOR_UNVERIFIED 0건)

### 요구사항 커버리지

| 요구사항 | 상태 | 근거 |
|----------|------|------|
| LOOK-01 | ✓ SATISFIED | 진실 1 |
| CHAR-01 | ✓ SATISFIED | 진실 2 |
| UX-01 | ✓ SATISFIED | 진실 3 |
| UX-02 | ✓ SATISFIED | 진실 4 |
| CONN-03 | ✓ SATISFIED | 진실 5 |

고아 요구사항 없음. REQUIREMENTS.md 추적표 5행 모두 Complete.

### 시험·행동 점검 (이번 검증에서 직접 실행)

| 점검 | 명령 | 결과 |
|------|------|------|
| 5페이즈 관련 시험 11개 파일 (guide·useWakeLock·characterAudit·atmosphere·testToolsCompact·e2eContract·scenes·atmosphereCss·dayTable·roomScreen·joinByLink) | `npx vitest run <파일들>` | 298/298 통과 |
| 전체 시험 | `npx vitest run` | 111 파일, 3035/3035 통과 |
| 타입 검사 | `npm run typecheck` | 종료 코드 0 |
| E2E 순수 판정 | `node --test scripts/e2e/lib.test.mjs` | 177/177 통과 |

배포본 E2E·smoke 는 이번에 다시 돌리지 않았고 05-09 의 기록(`E2E OK`, UAT 5종 통과)을 근거로 삼았다. 이후 quick 작업(0039 속도, 0040 후보 취소)으로 `src` 가 바뀌었으나 위 전체 시험이 현재 코드에서 통과한다.

### 안티패턴 점검

변경 파일(`useWakeLock.ts`·`scenes.ts`·`dayTable.ts`·`Backdrop.tsx`·`TestTools.tsx`·`atmosphere.css`·`DayScene.tsx`·`JoinByLink.tsx`)에서 `TBD`·`FIXME`·`XXX`·`TODO` 0건. `useWakeLock.ts` 에 `console.` 없음. `src` 에 새 `vibrate` 호출 없음(사용자 결정: 새 진동 없음).

### 데이터 흐름 (Level 4)

비네팅·밝아짐 그라데이션은 `view.phase` 와 같은 접속의 전환 여부에서 만들어져 `style` 변수로 전달된다(정적 하드코딩 아님). 안내 문장은 `PHASE_GUIDE_FILL` 에서 장면 상태(`n` 일차)를 받아 렌더된다. 캐릭터는 서버가 준 `seat` 로 `figureSrc` 를 계산한다. 끊어진 데이터 경로 없음.

### 사람 확인

실기기 항목 ⑨~⑮(밤 비네팅·아침 밝아짐·Wake Lock·짧은 폰 압축·링크 참가 7명·진행 속도·후보 취소)은 사용자가 2026-10-30 에 전체 승인했다(`05-UAT.md` status complete, 결정 0038 확인 줄). **승인으로 기록한다.** 남은 사람 확인 항목 없음.

### 참고(차단 아님)

- 사용자 승인이 항목별 기록 없이 전체 승인이다(UAT·결정 0038 에 명시). 이후 수치를 조정하려면 `scenes.ts`·`dayTable.ts` 상수 한 곳을 고치면 된다.
- 알려진 한계(결정 0038): 비네팅·아침 밝아짐의 체감과 iOS·저전력 모드의 Wake Lock 실제 효과는 자동 시험으로 알 수 없어 사용자 실기기 승인에 의존한다. 링크 참가 7명은 360x560·375x553 에서 원래부터 넘치며 지원 밖으로 문서화됐다(E2E `UX2-J` 는 높이 640 이상만 판정).
- 배포본 smoke 의 간헐 실패(8명·4명 도착 편차)는 같은 버전에서 재실행으로 통과했고 앱 결함이 아닌 네트워크 지터로 분류됐다(05-09). 4페이즈에서도 같은 경향이다.

## 갭 요약

없음. 5개 성공 기준이 현재 코드와 시험으로 확인되었고, 실기기 항목은 사용자가 승인했다.

---

_Verified: 2026-10-30_
_Verifier: Claude (gsd-verifier)_

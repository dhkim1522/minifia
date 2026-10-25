---
phase: quick-261025-qvx
plan: 01
status: incomplete
progress: "2/4 과제 완료 (과제 1·2 완료, 과제 3~4 남음)"
commits: 8
plan_head_before: bce014ff68c209d8221bf38a92679a63e4743981
plan_head_after: 133e1c57696c453a94cd4c217786cdf4b82f6d32
completed_tasks: [1, 2]
remaining_tasks: [3, 4]
requirements: [QUICK-261025-qvx]
---

# Quick 261025-qvx: 테스트 피드백 4건 수정 - 진행 체크포인트 (2/4)

> status: incomplete. 이 파일은 2회차까지(과제 1·2)의 진행 기록이다. 모든 과제가 끝나면 최종 SUMMARY 로 다시 쓴다.

## 완료한 과제

### 과제 1: 밤 끝 알림 완전 제거 (U-01)

| 단계 | 커밋 | 내용 |
|------|------|------|
| RED | 129767c | `test(qvx): 밤 끝 알림이 없다는 기준으로 바꾼다` |
| GREEN | b068558 | `feat(qvx): 밤 끝 알림을 없앤다 (결정 0028)` |

RED 시점 실패 8건(알림 없음 3 + 알림 파일 부재 1 + JOURNAL_TEXT 키 1 + roleCardFlow 3)은 모두 의도한 이유였고, E2E `lib.test.mjs` 는 `noNightNoticeChecks` export 부재로 실패했다. GREEN 후 전부 통과.

- 삭제: `src/components/RoleCardToast.tsx`, `src/styles/rolecard-toast.css`
- `src/screens/DayScene.tsx`: 알림 import·4초 `useToast`·기록 길이 효과 둘·JSX 알림 렌더·선택 props(`roleCardOpen`, `onOpenActivity`) 제거. 선택 거부 토스트용 기본 `useToast()` 는 유지. `useRef` import 제거.
- `src/screens/RoomScreen.tsx`: `onOpenActivity` 와 DayScene 에 넘기던 두 props 제거 (시트 열림·탭 상태와 읽음 처리 효과는 그대로).
- `src/game/journalText.ts`: `notice` 필드 제거 (항목 키는 name·empty 둘뿐).
- E2E: `noticeChecks` -> `noNightNoticeChecks(snap)` (id R6, 라벨 「밤 끝 알림 없음」, `roleCard.noticeTexts` 가 배열이 아니면 `측정값 없음` 으로 실패). `browser.mjs` 는 `roleCard.notice` 대신 `noticeTexts`(보이는 `[role="status"]` 중 `일지가 추가됐어요`/`눌러서 보기` 가 든 글자 배열)를 싣고 `clickNotice` 삭제. `flows.mjs` 는 `roleCardViaNotice`·`rolecard-notice` 상태 삭제, mafia8 은 `rolecard-btn`, `morningRoleChecks` 는 모든 역할(시민 포함)에 R6 을 돌린다.
- 테스트: `dayScene.test.tsx`(알림 describe 둘 -> 「DayScene 밤 끝 알림 없음」), `roleCardFlow.test.tsx`(알림 describe -> 「밤 끝 알림 없음」: 세 역할 앰버 점만, 시민 알림 없음, 버튼 경로로 활동 기록을 열면 점·탭 점 소멸·NEW·읽은 개수 `1` 저장), `journal.test.tsx`(키가 `empty,name` 뿐), `lib.test.mjs`(R6 새 함수 테스트).

### 과제 2: 차례 링 앞뒤 층 분리 (U-02) + 밤 시작 문구 (U-03)

| 단계 | 커밋 | 내용 |
|------|------|------|
| U-02 RED | 4f9589b | `test(qvx): 차례 링을 뒤쪽 호·앞쪽 호로 나누는 기준` |
| U-02 GREEN | aa077bc | `feat(qvx): 차례 링 뒤쪽 호는 캐릭터 뒤, 앞쪽 호는 캐릭터 앞 (결정 0028)` |
| U-03 RED | 8de3ac4 | `test(qvx): 밤 시작 문구의 기준` |
| U-03 GREEN | 133e1c5 | `feat(qvx): 밤이 시작되면 '밤이 되었습니다' 가 한 번 뜬다 (결정 0028)` |

U-02 (링): `.mf-dt__spot` 은 쌓임 맥락이 없는 묶음(left -20%, bottom calc(-4px - 12%), 폭 140%, 높이 24%)이고 안에 `.mf-dt__spot-arc--back`(z-index -1, `clip-path: inset(-24px -24px 50% -24px)`)과 `.mf-dt__spot-arc--front`(`inset(50% -24px -24px -24px)`, 그림 다음 마크업 순서)가 있다. 두께 3px·gray-50·빛 18px·페이드·축소 모션 처리는 그대로 호로 옮겼다. 이름표 1~11·캐릭터 12~22·어둡게 층 30·유령 31·이모티콘 60+ 와 `src/game/dayTable.ts` 는 바뀌지 않았다(D3a 단위 버전 4~8명 통과). E2E K4(`ringChecks`, 스냅숏 `turn.ring`)는 브라우저가 줄여 돌려주는 `inset(a b c)` 꼴도 네 변으로 펼쳐 읽는다. K4 는 차례가 있는 상태에서만 K1 다음에 돈다.

U-03 (밤 문구): 새 `src/components/NightIntro.tsx`(`NIGHT_INTRO_MS = DAY_ANNOUNCE_MS`, 마운트 때 한 번 거는 타이머, `onDone` 은 ref), `src/styles/night.css` 의 `.mf-nightintro`(absolute inset 0, z-index 40, pointer-events none, 막 `--night-950` 85% 방사형, 제목 800ms 번짐, 마지막 300ms 퇴장, 축소 모션 개별 규칙 없음). `DayScene` 의 렌더 중 조정에 `prevEpoch`·`nightIntroN` 을 더해 같은 epoch 에서 비밤 -> 밤일 때만 켠다. 서버·`RoomScreen`·`PHASE_ANNOUNCE` 는 건드리지 않았다. E2E: `readNightIntro`(browser), N6 `nightIntroChecks`(lib), `gameFlow` 밤 상태에서 `skipTo(night)` 직후 N6, 밤 검사 끝에 N7(`.mf-nightintro` 가 3.5초 안에 detached).

### D4 단순화 확인 (사용자 지시)

`scripts/e2e/lib.mjs` 의 `d4TestButton` 에는 알림 전용 예외 분기가 원래 없었다(코드로 확인, 수정 없음). 알림 때문에 생긴 360폭 좁은 폭 규칙(`@media (max-width: 389px)`)은 `rolecard-toast.css` 삭제로 사라졌다. `src`, `scripts/e2e`, `src/styles/testtools.css` 에서 `알림`·`S13`·`389px` 검색 결과 알림 때문에 남은 조건 없음(남은 `알림` 단어는 새 R6 주석·라벨뿐). D4 기준(깊이 <= 3px, 가운데 점 눌림)은 건드리지 않았다.

## 검증

- 과제 1 시점: `npx vitest run` 75 파일 1739 통과, `lib.test.mjs` 67 통과, typecheck 통과.
- 과제 2 시점: `npx vitest run` 76 파일 1760 통과(+21: dayTable 구조·CSS 규약, nightIntro 신규 파일 11, 그 밖 기존 갱신), `node --test scripts/e2e/lib.test.mjs` 71 통과(K4 3, N6 1 추가), `npm run typecheck` 통과.
- `git diff --quiet bce014f -- src/game/dayTable.ts shared/game worker` 변경 없음. `grep -c` 확인: `mf-dt__spot-arc--back` 은 daytable.css·DayTable.tsx 각 1, `밤이 되었습니다` 는 NightIntro.tsx 2.
- 임계값(OVERLAP_EPS 0.5, ONE_LINE_FACTOR 1.6, FACE_RATIO 0.45, TAP_MIN 44, PANEL_H 157)·TEXT_SIZE_ALLOW·z-index 규칙 변경 없음. 로컬 dev 서버·E2E 는 이 회차에서도 돌리지 않았다(서버 시작 없음). K4·N6·N7 은 과제 4 의 로컬 E2E 에서 처음 실제 브라우저로 확인된다.

## 남은 과제 (이 회차에서 시작하지 않음)

- 과제 3: 대기실·역할 배정 표시 슬롯 고정 순서(U-04) - RED -> GREEN
- 과제 4: 결정 0028 문서, UI-SPEC·HANDOFF 갱신, 전체 검증(로컬 e2e, 배포본 e2e·smoke), 배포, push

## 편차

- [Rule 1 - Bug] 과제 2 U-03: RED 커밋(8de3ac4)의 `night.css` 규약 테스트 정규식 두 개가 잘못돼 있었다(퇴장 지연 단언이 `var(--mf-nightintro-exit-delay, 1700ms)` 의 기본값 쉼표를 못 읽음, 축소 모션 단언이 다른 @media 블록을 건너 멀리 있는 `.mf-nightintro` 에 걸림). 구현을 바꾸지 않고 테스트 정규식(쉼표 허용, @media 블록 중괄호를 세어 본문만 검사)만 GREEN 커밋(133e1c5)에서 고쳤다. 기준 의미는 같다.
- `commits: 8` 은 측정값이다(`git rev-list --count`). 이 가운데 8e80abd(`docs(design): approved table geometry P2`)는 이 계획 밖에서 들어온 사용자의 디자인 문서 커밋이다(design/screens/table-v1 6개 파일, 코드 무관).

## 알려진 스텁

없음.

## Self-Check: PASSED

- FOUND: 129767c, b068558, 4f9589b, aa077bc, 8de3ac4, 133e1c5 (HEAD 의 조상)
- 삭제 확인: RoleCardToast.tsx, rolecard-toast.css
- 생성 확인: src/components/NightIntro.tsx, test/client/nightIntro.test.tsx

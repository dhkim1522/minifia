---
phase: quick-261025-qvx
plan: 01
status: incomplete
progress: "1/4 과제 완료 (과제 1 완료, 과제 2~4 남음)"
commits: 2
plan_head_before: bce014ff68c209d8221bf38a92679a63e4743981
plan_head_after: b068558c125be29e78ca462f5fbde94e489a5abc
completed_tasks: [1]
remaining_tasks: [2, 3, 4]
requirements: [QUICK-261025-qvx]
---

# Quick 261025-qvx: 테스트 피드백 4건 수정 - 진행 체크포인트 (1/4)

> status: incomplete. 이 파일은 1회차(과제 1) 진행 기록이다. 모든 과제가 끝나면 최종 SUMMARY 로 다시 쓴다.

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

### D4 단순화 확인 (사용자 지시)

`scripts/e2e/lib.mjs` 의 `d4TestButton` 에는 알림 전용 예외 분기가 원래 없었다(코드로 확인, 수정 없음). 알림 때문에 생긴 360폭 좁은 폭 규칙(`@media (max-width: 389px)`)은 `rolecard-toast.css` 삭제로 사라졌다. `src`, `scripts/e2e`, `src/styles/testtools.css` 에서 `알림`·`S13`·`389px` 검색 결과 알림 때문에 남은 조건 없음(남은 `알림` 단어는 새 R6 주석·라벨뿐). D4 기준(깊이 <= 3px, 가운데 점 눌림)은 건드리지 않았다.

## 검증 (과제 1 시점)

- `npx vitest run` 전체: 75 파일, 1739 통과 (이전 1753; 알림 테스트 삭제분 감소, 알림 없음 테스트 추가)
- `node --test scripts/e2e/lib.test.mjs`: 67 통과
- `npm run typecheck`: 통과
- `test ! -e` 두 파일, `grep RoleCardToast|rolecard-toast|onOpenActivity|roleCardOpen|clickNotice|roleCardViaNotice|rolecard-notice src scripts/e2e`: 0건
- 임계값(OVERLAP_EPS 0.5, ONE_LINE_FACTOR 1.6, FACE_RATIO 0.45, TAP_MIN 44, PANEL_H 157)·TEXT_SIZE_ALLOW 변경 없음. 로컬 dev 서버·E2E 는 이 회차에서 돌리지 않았다(서버 시작 없음).

## 남은 과제 (이 회차에서 시작하지 않음)

- 과제 2: 차례 링 앞뒤 층 분리(U-02) + 밤 시작 문구(U-03) - 각각 RED -> GREEN (커밋 4개)
- 과제 3: 대기실·역할 배정 표시 슬롯 고정 순서(U-04) - RED -> GREEN
- 과제 4: 결정 0028 문서, UI-SPEC·HANDOFF 갱신, 전체 검증(로컬 e2e, 배포본 e2e·smoke), 배포, push

## 편차

없음. 계획대로 실행했다 (과제 1 범위).

## 알려진 스텁

없음.

## Self-Check: PASSED

- FOUND: 129767c, b068558 (HEAD 의 조상)
- 삭제 확인: RoleCardToast.tsx, rolecard-toast.css

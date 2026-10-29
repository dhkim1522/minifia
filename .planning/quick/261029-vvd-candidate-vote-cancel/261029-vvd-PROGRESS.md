plan_head_before: 06725019af0f013fa702c0870175fce7dd8f02cf

# 261029-vvd 진행 메모 (Task 1~3 진행 중, Task 4 배포·검증 대기)

> 최종 SUMMARY 는 Task 4 디스패치가 쓴다. 이 파일은 그때까지의 중간 기록이다.

## Task 4 가 HANDOFF 에 쓸 문구 (오케스트레이터 메모)

- 확인 대기 1 의 실기기 목록 끝에 ⑮ 를 더한다: "⑮ 후보 선택 빈 곳 탭 취소 느낌(이름표·사람 근처 오작동 없음, **PC 마우스 클릭에서도 확인**)·무효표/취소 안내 줄(360폭 한 줄)" (조정은 `src/game/blankTap.ts`·`src/game/verdict.ts`).
- 결정 0040 "알려진 한계"에 이미 적는다: 키보드·화면 읽기 사용자는 빈 곳 탭으로 취소할 수 없다, PC 마우스 클릭 경로는 E2E 가 건드리지 않는다(터치만).

## 한 일

- **Task 1 (tracer, 완료)**: 와이어 `candidateVote.target` 을 `number | null`(스키마 nullable 한 곳), `castCandidateVote` 취소(키 지움 / 고른 표 없으면 입력 그대로), 워커 `applyCandidateVote` 는 투표자 본인에게만 state, `src/game/blankTap.ts`(closest 판정), `verdictScene` cancelPick·onBlankTap, `DayScene` 장면 상자 onClick. 로컬: unit vote·schemas 73, worker vote 28, client candidateVote 21 통과, `npm test` 110 파일 3017 시험, typecheck 통과.
  - 커밋: 3dfe7db (RED test), 98d4bee (GREEN feat)
  - 편차(계획된 기대 변경): `test/unit/vote.test.ts` "대상이 정수가 아니거나…" 목록에서 `null` 을 뺐다(null 은 이제 취소, 기대 개수 8 → 7). undefined 는 남김.
- **Task 2 (완료)**: `VERDICT_TEXT.candidateGuideNone`·`candidateGuidePicked`(옛 안내 키 삭제, src 안 문장 출처는 verdict.ts 한 곳), `CandidateVotePanel` 안내 줄, `isBlankSceneTap(target, point, scene)` + `BLANK_TAP_SLOP_PX = 8`, DayScene 이 clientX/clientY 전달. 스타일 파일은 건드리지 않음. 결정 0040 작성(알려진 한계에 키보드·화면 읽기 취소 불가, PC 마우스 클릭 E2E 미검증 포함), 개정 표기: 0036 4항·12항, 04-CONTEXT D-04, 04-UI-SPEC §7.2·§8.2, 05-UI-SPEC §8, product.md. 로컬: `npm test` 111 파일 3033 시험, typecheck·build 통과.
  - 커밋: 6c976d9 (RED), 8cafa00 (GREEN), de8de5c (docs 0040), (이어서) test: 옛 키 리터럴 제거
  - 편차: (a) 04-UI-SPEC 안에 새 두 문장이 글자 그대로 있어야 `verdict.test` 의 "값이 UI-SPEC 문서에도 그대로 있다" 가 통과하므로 §7.2 개정 표기에 두 문장을 그대로 적었다(계획의 표기 문구 "고르기 전·고른 뒤 두 문장으로 개정" 에 문장을 더함). (b) 계획의 guide.test 는 `renderCell` 하나로 네 시점을 비교하게 되어 있으나 픽스처가 alive/mafiaAlly 에 voteTarget 을 넣어 두므로, 고르기 전(voteTarget 삭제)·고른 뒤(voteTarget 설정) 두 상태 × 네 역할을 직접 그리게 했다. (c) acceptance `grep candidateHint == 0` 을 위해 부재 검사의 키 이름을 글자 그대로 두지 않았다.

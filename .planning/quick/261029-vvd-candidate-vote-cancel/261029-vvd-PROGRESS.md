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

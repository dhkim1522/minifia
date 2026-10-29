plan_head_before: 06725019af0f013fa702c0870175fce7dd8f02cf

# 261029-vvd 진행 메모 (Task 1~3 완료, Task 4 배포·검증 대기)

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
- **Task 3 (완료)**: `scripts/e2e/lib.mjs` 에 `CANDIDATE_GUIDE`·`BLANK_TAP_E2E_MARGIN`(16)·`blankPointsOf`·`candidateGuideChecks`(P11)·`cancelTapChecks`(P12) 추가(판정 상수·승인 완화 목록은 그대로, 헤더 계약 주석에 guideH·guideLH). `browser.mjs`: readVerdict bottom 에 guideH·guideLH, `findBlankScenePoint`·`findTagPassThroughPoint`·`tapAt`·`clickAt`. `flows.mjs` vote5: 도착 직후 P11(안 고름), 취소 블록(P11 고른 뒤·P12·취소 뒤 P3/P11), reveal 의 P12(공개에 내 줄). `test/worker/leak.test.ts`: 첫 투표자 취소·재선택(그 소켓만 state, 다른 소켓 `[]`, 취소 프레임 ≥1). `scripts/uat-vote.mjs`: 고르기 전 취소 무전송, C 취소(C 만 state), 공개 3표·C 줄 없음·7000ms.
  - 커밋: aed2385 (RED), 68c78cc (GREEN), 76ad3e7 (E2E 이름표 탭을 마우스 클릭으로)
  - 편차: **터치 탭의 한계**: 계획대로 `touchscreen.tap` 으로 이름표 통과 점을 눌렀더니 Chromium 탭 대상 보정이 클릭을 가까운 좌석 그림(IMG)으로 옮겨 앱의 좌표 판정을 거치지 않았고, 판정 루프를 없앤 변이에도 P12 가 통과했다(검사가 둔감). 그래서 이름표 통과 클릭만 보정 없는 `page.mouse.click`(`clickAt`)으로 바꿨고, 변이(좌표 루프 제거)에서 P12 가 실패함을 로컬에서 확인했다(변이는 되돌림). 빈 곳 탭 취소는 계획대로 터치 탭이다. 판정 기준은 그대로.
  - 편차: vote5 의 360x560 크기에서 한 번 115 건(다른 크기 132)이 나온 것은 후보가 마피아라 처형 뒤 `ended` 로 끝나 밤 구간 검사가 없는 설계상의 무작위 분기다(실패 0).

## 로컬 게이트 (Task 3 끝, 개발 서버 `npm run dev` 는 끝낸 뒤 종료함)

| 항목 | 결과 |
|---|---|
| `npm test` | 111 파일 / 3035 시험 통과 (unit 43 파일 1284, client 52 파일 1557, worker 16 파일 194) |
| `npm run typecheck` | 통과 |
| `npm run build` | 통과 |
| `node --test scripts/e2e/lib.test.mjs` | 177 통과 (이전 169) |
| 4개 스크립트 `node --check` | 통과 |
| 로컬 `node scripts/uat-vote.mjs http://localhost:5173` | 54/54 OK (이전 52; 새 check: 고르기 전 취소 무전송, C 취소 / 공개 3표·C 줄 없음 / 공개 7000ms 로 정정) |
| 로컬 `npm run e2e -- --url http://localhost:5173 --only vote5` | E2E OK, 360x640·390x664·430x932 각 132/132, 360x560 115/115 또는 132/132(처형 뒤 종료 분기), P11(고르기 전·고른 뒤·취소 뒤)·P12(취소 탭, 공개에 내 줄) 네 크기 모두 통과, 약 82~87초 |
| `--only spec4` | 돌리지 않음(spec4 는 건드리지 않음) |

로컬 dev 는 CSS 를 압축하지 않으므로 화면 판정의 최종 확인(특히 360폭 안내 줄 한 줄 P11)은 Task 4 의 배포본 E2E 다.

## 계획 acceptance 확인

- `grep -c 't: "candidateVote"; target: number | null' shared/protocol.ts` 1, `nullable()` 두 줄(testRole·candidateVote), `target: number | null` vote.ts·room.ts(서명 두 곳), `isBlankSceneTap` 존재, `onBlankTap` DayScene·verdictScene 존재.
- `candidateHint` src·test 0, 안내 두 문장의 src 출처는 `src/game/verdict.ts` 한 곳, `BLANK_TAP_SLOP_PX = 8`, `clientX` DayScene 존재, `src/styles` 변경 커밋 0.
- lib.mjs 판정 상수 줄(ONE_LINE_FACTOR·OVERLAP_EPS·TAP_MIN·D3B_FLOOR_5_PLAYERS) diff 0.

## Task 4 로 넘기는 것

- HANDOFF 실기기 ⑮ 문구: "⑮ 후보 선택 빈 곳 탭 취소 느낌(이름표·사람 근처 오작동 없음, PC 마우스 클릭에서도 확인)·무효표/취소 안내 줄(360폭 한 줄)" (조정은 `src/game/blankTap.ts`·`src/game/verdict.ts`). 통과 표시 금지.
- 결정 0040 "알려진 한계"에는 이미 키보드·화면 읽기 취소 불가, PC 마우스 빈 곳 클릭은 E2E 미검증이 적혀 있다(E2E 의 이름표 통과 클릭만 마우스, 빈 곳 취소는 터치).
- 배포본 uat-vote 의 공개 길이 기대는 (b)판 3표 7000ms. SUMMARY 편차에 Task 1 의 null 기대 목록 변경(8 → 7)을 적을 것.
- 남은 미커밋: `.planning/milestone.lock`, `.planning/state.json`, `Claude outputs/`(커밋 금지).

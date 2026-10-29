# 261029-t40 진행 메모 (Task 1~3 완료, Task 4 배포·검증 대기)

> 최종 SUMMARY 는 Task 4(배포·배포본 검증) 디스패치가 쓴다. 이 파일은 그때까지의 중간 기록이다.

## 한 일

- **Task 1 (서버)**: `DISCUSSION_MS` 40000, `EXEC_VOTE_MS` 13000, 공개 상수 넷(400·2000·600·2000)과 `candidateRevealMs(n)` 을 `shared/game/phases.ts` 에 두었다. `phaseDurationOf` 가 공개 단계 길이를 그날 `cand.votes` 길이로 파생하고, `tick` 은 진입 훅 뒤 상태로 새 마감을 정한다. 진행 중 후보 선택은 15000 고정(누출 검사 통과). 봇 토론 둘째 행동 간격 폭 30000 → 18000.
- **Task 2 (화면)**: `EXEC_INTRO_MS` 3000, 공개 앞·한 표·뒤 여유는 shared 상수를 import, `REVEAL_DRAW_MS` 1200, `REVEAL_REDUCED_HOLD_MS` = `REVEAL_DRAW_MS`. 카드 CSS 시각표를 3000ms 로(면 지우기 `--mf-vi-erase-at` 1500, 셰브런 4회, 페이드아웃 2850~3000). 처형 무효 카드 1600ms 는 그대로. 화면 시간표 끝 + 600 = 서버 마감을 단위 테스트가 지킨다.
- **Task 3 (스크립트·문서)**: E2E `INTRO_GONE_MS` 3200 + `candidateRevealMs` 사본(`test/unit/e2eContract.test.ts` 가 대조), vote5 표본 길이와 spec4 대기 시간, smoke(`DISCUSSION_MS` 40000·`EXEC_VOTE_MS` 13000), uat-vote(공개 길이·공개 뒤 변론 간격 check), uat-night/day/test-room/test-bots 주석. 결정 0039 와 0034·0036·0037·04-CONTEXT·04-UI-SPEC 개정 표기, `docs/product.md`, DAY-01.

## 테스트 합계 (로컬, 마지막 실행)

| 프로젝트 | 파일 | 테스트 |
|---|---|---|
| unit | 42 | 1258 |
| client | 51 | 1539 |
| worker | 16 | 189 |
| 합계 `npm test` | 109 | 2986 |

`npm run typecheck`, `npm run build`, `node --test scripts/e2e/lib.test.mjs`(169 통과) 모두 통과. 빌드된 CSS(minify 후): `.mf-vintro{--mf-vi-out-delay:2.85s;--mf-vi-out-ms:.15s}`, `.mf-vintro__veil{animation:3s …}`, `.mf-vintro--intro{--mf-vi-erase-at:1.5s}`, 무효 변형 veil 1.6s. (로컬 dev 는 CSS 를 압축하지 않는다. 배포본 판정은 Task 4 의 E2E P2.)

## 로컬 게이트 (dev 서버, 끝난 뒤 종료함)

- `node scripts/uat-vote.mjs http://localhost:5173`: 52/52 OK (공개 11000ms·9000ms check, 공개 약 11초/9초 뒤 변론 포함). 첫 실행은 51/52 — 계획의 "8800"(4표)이 산수 오류였고 400 + 4×2000 + 600 = **9000** 이라 스크립트 기대를 고쳤다(아래 편차 1).
- `npm run e2e -- --url http://localhost:5173 --only vote5`: E2E OK (네 크기 109/109·126/126, P2 3.2초·P4·P10 통과).
- `--only spec4`: E2E OK (52/52 × 네 크기).
- 추가로 전체 `npm run e2e -- --url http://localhost:5173` 도 E2E OK (347초; 열 흐름 × 네 크기 + pc + wakelock). 기준 수치·`APPROVED_RELAXATIONS` 는 바꾸지 않았다.

## 커밋

| 해시 | 내용 |
|---|---|
| 33da617 | test: 토론 40초·여부 13초·공개 길이 공식 기대 (RED) |
| 90db903 | feat: 서버 단계 길이·공개 길이 공식 (GREEN) |
| a29f71e | test: 카드 3초·공개 한 표 2초 화면 기대 (RED) |
| bb16788 | feat: 처형 투표 카드 3초, 공개 한 표 2초 (GREEN) |
| 3834800 | test: E2E 카드 3.2초·공개 길이 사본 기대 (RED) |
| e943566 | feat: E2E·스모크·UAT 를 새 시간에 맞춤 (GREEN) |
| 09e7b91 | docs: 결정 0039 와 개정 표기 |
| (다음) | fix: uat-vote 4표 공개 길이 9000 정정 + 0039 문서 4표 9000, 이 PROGRESS 메모 |

## 편차

1. **[Rule 1 - 계획의 산수 오류] 4표 공개 길이**: 계획은 4표를 8800ms 라고 했으나 공식(400 + n×2000 + 600)으로 9000ms 다. uat-vote 기대와 결정 0039 문서의 예시를 9000 으로 맞췄다. 서버 공식은 바뀌지 않았다. Task 4 의 SUMMARY·HANDOFF 에서 "8800" 이 아니라 "9000" 으로 적어야 한다.
2. **봇 테스트**: 오케스트레이터 메모의 `test/worker/bots.test.ts` 는 확인했으나 단계 이름으로만 기다릴 뿐 토론 시간·digest 를 담고 있지 않아 고칠 것이 없었다(변경 없이 통과). 봇 계획의 시간 기대는 `test/unit/bots.test.ts` 에 있고 거기서 토론 계획(살아 있는 봇마다 정확히 2개, 둘 다 마감 − 500 전)과 고정 digest 를 갱신했다. digest 옛 값 → 새 값: 토론 `802530989` → `289874952`, 밤 `431118882` → `760964938`(밤은 단계 시작 시각이 토론·여부 시간 변경으로 달라져 절대 시각 digest 가 바뀐 것), claim `251347194` 그대로.
3. **손으로 센 숫자 테스트를 상수로 바꿈**: `claim.test.ts`(늦은 알람 따라잡기), `tick.test.ts` 두 곳, `testTools.test.ts`(`skipPhase` 마감), `verdict.test.ts` 등. 기대를 지우거나 느슨하게 하지 않았다.
4. **확정 두근 테스트 의미 변화**: 한 표 2초에서는 두근(700ms)이 다음 닿음 전에 끝나므로 "두근 안에 같은 후보에게 표가 더 닿아 두근이 이어짐" 장면이 사라졌다. 닿음마다 두근이 처음부터 다시 돈다(replay 증가)는 계약은 같고, `alt` 클래스는 두근(clinch) 중에만 붙는다. 테스트를 이 의미로 다시 썼다(`reveal.test.tsx`).
5. 변경 파일 중 계획의 `files_modified` 밖: `test/unit/claim.test.ts`, `scripts/e2e/browser.mjs`(주석 한 줄), `src/components/ExecVotePanel.tsx`(주석 한 줄).
6. `grep '1\.8초\|4초 공개'` (scripts/shared/src): 남은 항목은 모두 처형 무효 카드 1.6/1.8초 또는 무관한 `useSendLock`(전송 쿨다운 1.8초)·밝기 대기 4초이며 처형 투표 카드·공개의 옛 숫자는 없다.

## Task 4 에서 할 일 (남음)

- `npx wrangler whoami` = dhkim1522@naver.com, `wrangler.jsonc` name = minifia, `origin` = git@github.com:dhkim1522/minifia.git 확인 후 `npm run deploy` 한 번, 버전 변경 확인, Cache-Control 세 줄.
- 배포본 순차 검사: smoke 5·8·4(`--previous-version`), uat-vote(공개 11000·9000 check), uat-test-bots, uat-test-room, uat-day, uat-night, `npm run e2e`(배포본, 네 크기 + pc + wakelock). 특히 vote5 P2(빌드된 CSS 기준 3.2초 뒤 흔적 없음).
- HANDOFF.md(6KB 이하): 맨 위 bullet(결정 0039 배포), 실기기 ⑭ 추가, 통과 표시 없음. SUMMARY 작성, STATE/ROADMAP 갱신, push.

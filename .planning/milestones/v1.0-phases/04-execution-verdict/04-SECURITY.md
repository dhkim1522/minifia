---
phase: "4"
slug: "execution-verdict"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-10-30"
---

# Phase 4 — Security

> 범위: 처형과 승패(여부 투표, 후보 선택, 공개, 변론, 처형, 종료, 결과 화면). 계획 35개의 `<threat_model>` 을 합쳐 중복 ID 를 제거한 전체 등록부(T-04-01 ~ T-04-78 + T-04-SC = 79개). block_on: high, ASVS L1(현재 코드에서 완화 존재 확인). 이후 결정 0021·0036·0039·0040 이 바꾼 현재 코드를 기준으로 검증했다. 감사 때 전체 vitest(116 파일, 3065 테스트)와 `scripts/e2e/lib.test.mjs`(177)가 통과했다.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| 클라이언트 소켓 → 방 DO (`execVote`·`candidateVote`·`say`·`emoji`·`testBotVote`) | 신원은 소켓 첨부 playerId 뿐. 값은 `strictObject` 로, 단계·생존·대상은 순수 규칙이 서버 상태로 재검증 | 불리언 표, 대상 seat 또는 null(취소), 템플릿 ID |
| 서버 상태 → 소켓 프레임 (`buildView` 한 곳) | 허용 목록 리터럴로만. 개인 표는 본인 필드만, 직업·밤 기록·결과는 단계·수신자 한정 (결정 0002·0021·0036) | 집계 수, 본인 표, 공개 투표 기록, ended 결과 |
| DO 저장소 | 개인 여부 표는 마감 훅이 키째 삭제, 후보 선택은 공개 구간 진입 훅이 삭제 | 서버 전용 표 |
| 테스트 방 도구 / 서버 봇 | testMode 방의 방장만, 봇은 사람과 같은 처리기 | `testSkip`·`testBotVote`·봇 표 |
| 클라이언트 번들 → 정적 에셋 요청 | 미리 받는 목록이 역할과 무관해야 한다 | dusk 배경 목록 |
| 스크립트·E2E → 서버 | 특권 없음, 토큰은 출력에 없음(`redact`) | 플레이어 토큰, view |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-04-01 | Information Disclosure | 여부 투표 실시간 집계 | high | mitigate | `shared/game/view.ts` execTally 는 모두에게 같은 값, voteAgree 는 생존 본인만. `test/unit/view.test.ts`(익명 차분), `test/worker/vote.test.ts` | closed |
| T-04-02 | Information Disclosure | 마감 뒤 개인 표 잔존 | high | mitigate | `shared/game/vote.ts` resolveExecVote 가 집계 직후 개인 표 제거. `vote.test.ts`, 저장소 키 부재 시험 | closed |
| T-04-03 | Spoofing | 남의 이름으로 여부 투표 | medium | mitigate | `shared/schemas.ts` strictObject, 신원은 소켓 첨부. `test/worker/vote.test.ts` | closed |
| T-04-04 | Tampering | 마감 뒤·틀린 단계 투표 | medium | mitigate | 모든 메시지 전 `advance`, WRONG_PHASE, 마감 불변. `test/unit/vote.test.ts` | closed |
| T-04-05 | Denial of Service | 번복 연타 방송 증폭 | low | accept | 같은 값 무전송, 연결당 20msg/s. R-04-01 | closed |
| T-04-06 | Repudiation | 회귀 이전 중 단언 약화 | medium | mitigate | `test/unit/tick.test.ts` 정확한 마감 숫자(40000·13000), `alarm.test.ts` | closed |
| T-04-07 | Information Disclosure | 화면 계획이 개인 표 표시를 요구 | medium | mitigate | 결정 0036 view 필드 표·"의도적으로 없는 키", UI-SPEC 이 0036 을 정본으로 지정 | closed |
| T-04-08 | Repudiation | 문서와 코드 어긋남 | low | mitigate | 0036 대조 절, 현재 와이어 이름 일치 | closed |
| T-04-09 | Tampering | 자기·탈락자·없는 자리 지목 | medium | mitigate | `vote.ts` 대상 검증 BAD_MESSAGE. `vote.test.ts` | closed |
| T-04-10 | Information Disclosure | 진행 중 후보 선택이 남의 view 로 샘 | high | mitigate | voteTarget 은 생존 본인·후보 선택 단계만. `test/unit/execution.test.ts`, `view.test.ts` | closed |
| T-04-11 | Information Disclosure | 처형자 직업이 생존자 view 에 | high | mitigate | `day.execution` 은 `{seat, phrase}` 만. `execution.test.ts`, `view.test.ts` | closed |
| T-04-12 | Information Disclosure | day.noExecution 범위·수명 | low | mitigate | night 에서만, 키는 reason 하나. `execution.test.ts` | closed |
| T-04-13 | Tampering | 공개 순서 조작 | low | mitigate | 서버 Fisher–Yates 한 번, cryptoRandInt. `vote.test.ts` | closed |
| T-04-14 | Elevation of Privilege | 비후보의 변론 메시지 | medium | mitigate | `chat.ts` defense 에서 후보가 아니면 WRONG_PHASE. `vote.test.ts` | closed |
| T-04-15 | Tampering | 프로토타입 키·알 수 없는 템플릿 | medium | mitigate | `Object.hasOwn`, `z.enum(TEMPLATE_IDS)` | closed |
| T-04-16 | Denial of Service | 변론 도배 | low | mitigate | 합산 쿨다운 1.8초, 공개·처형·종료 단계 발언 불가 | closed |
| T-04-17 | Information Disclosure | 처형 문구가 직업 암시 | low | accept | 문장에 직업 단어 없음. R-04-02 | closed |
| T-04-18 | Information Disclosure | result·요약·nightLog 가 ended 전에 실림 | high | mitigate | ended 이고 winner 가 있을 때만 result. `test/unit/endgame.test.ts`, `leak.test.ts` | closed |
| T-04-19 | Tampering | 역할 없는 상태의 거짓 승리 | medium | mitigate | `win.ts` 역할 없으면 null, 마감 훅에서만 판정. `win.test.ts` | closed |
| T-04-20 | Denial of Service | 종료 방 미정리·알람 재발화 | medium | mitigate | ended durationMs null, 만료 = 진입+30분. `test/worker/endgame.test.ts` | closed |
| T-04-21 | Repudiation | 판 요약이 실제와 다름 | low | mitigate | voteLog·nightLog 에서만 합성. `endgame.test.ts` | closed |
| T-04-22 | Information Disclosure | 후보 선택 프레임 타이밍 누출 | high | mitigate | `worker/room.ts` 투표자에게만 `sendViewTo`(취소 null 도 같은 길). `vote.test.ts`, `leak.test.ts` | closed |
| T-04-23 | Spoofing | 남의 이름으로 후보 선택 | medium | mitigate | strictObject `{t, target: 0..7 | null}`. `vote.test.ts`, `schemas.test.ts` | closed |
| T-04-24 | Elevation of Privilege | 비후보의 변론 발언 | medium | mitigate | `chat.ts` WRONG_PHASE. `vote.test.ts` | closed |
| T-04-25 | Information Disclosure | 처형 프레임에 직업 | high | mitigate | view 허용 목록 + `leak.test.ts` 역할 단어 경로 검사 | closed |
| T-04-26 | Denial of Service | 종료 방이 알람·저장소 점유 | low | mitigate | T-04-20 과 같음 | closed |
| T-04-27 | Elevation of Privilege | 봇이 사람 표를 덮음 | medium | mitigate | 봇도 같은 처리기, 안 던진 봇만. `test/worker/bots.test.ts` | closed |
| T-04-28 | Information Disclosure | 봇 표시·계획이 프레임에 | medium | mitigate | view 허용 목록. `bots.test.ts`, `leak.test.ts` | closed |
| T-04-29 | Tampering | 일반 방에서 넘기기로 마감 조작 | low | mitigate | testMode → 방장 검사. `test/worker/testTools.test.ts` | closed |
| T-04-30 | Information Disclosure | 여부 개인 표 노출 | high | mitigate | 모든 state 프레임이 `buildView` 를 지남. `view.test.ts`, `leak.test.ts` | closed |
| T-04-31 | Information Disclosure | ended 전 직업·결과·밤 기록 | high | mitigate | 서버 전용 키 목록 + 역할 단어 경로 검사. `leak.test.ts`, `view.test.ts` | closed |
| T-04-32 | Information Disclosure | 진행 중 후보 선택 타이밍 | high | mitigate | 투표자에게만 응답, 후보 선택 단계 길이는 고정(공개 길이는 공개 표 수에서만, 결정 0039) | closed |
| T-04-33 | Information Disclosure | 스크립트 출력에 토큰 | medium | mitigate | `scripts/uat-vote.mjs` 토큰 출력 없음 | closed |
| T-04-34 | Denial of Service | 다른 dev 서버 오종료 | low | mitigate | `pkill` 류 0건, PID 한정 종료 기록 | closed |
| T-04-35 | Tampering | 서버만 배포해 화면 정지 | high | mitigate | 서버·화면 한 단위 배포 규칙(결정 0036-15), HANDOFF 경고 | closed |
| T-04-36 | Information Disclosure | 스크립트 출력에 토큰 | medium | mitigate | `uat-test-bots.mjs` LEAK_NEEDLES 확장, 토큰 출력 없음 | closed |
| T-04-37 | Denial of Service | dev 서버 오종료 | low | mitigate | T-04-34 와 같음 | closed |
| T-04-38 | Information Disclosure | HANDOFF 에 토큰 | medium | mitigate | 긴 16진 0건, 크기 시험 `handoff.test.ts` | closed |
| T-04-39 | Denial of Service | 서버 웨이브만 배포 | high | mitigate | T-04-35 와 같음 | closed |
| T-04-40 | Information Disclosure | 문구 함수의 마크업 해석 | medium | mitigate | `src/` 에 innerHTML 계열 0건. `verdict.test.ts` | closed |
| T-04-41 | Denial of Service | revealPlan 잘못된 배열 | low | mitigate | 단계 수 = 입력 길이, n=0 분기. `verdict.test.ts` | closed |
| T-04-42 | Information Disclosure | dusk 미리 받기 목록 | low | mitigate | 인자 없는 고정 목록. `assets.test.ts` | closed |
| T-04-43 | Tampering | 장면 표 ↔ E2E 기대 표 어긋남 | medium | mitigate | `scenes.test.ts` 동일성 단언 | closed |
| T-04-44 | Elevation of Privilege | testBotVote 를 일반 방에서 | high | mitigate | testMode → NOT_HOST → WRONG_PHASE 순서. `testTools.test.ts` | closed |
| T-04-45 | Information Disclosure | me.testBotVote 가 손님 view 에 | medium | mitigate | 방장·testMode·대기실만. `view.test.ts`, `leak.test.ts` | closed |
| T-04-46 | Tampering | 스키마 밖 값 | medium | mitigate | strictObject + enum, 범위 재검사 | closed |
| T-04-47 | Information Disclosure | 화면이 여부 투표 익명을 깸 | high | mitigate | 서버가 남의 표를 보내지 않음. `execVote.test.tsx`, `verdictStates.test.tsx` | closed |
| T-04-48 | Tampering | 낙관적 선택 불일치 | low | mitigate | `useViewChoice.ts`. `execVote.test.tsx` | closed |
| T-04-49 | Spoofing | 클라이언트가 남의 이름으로 투표 | low | accept | 메시지에 seat 없음. R-04-03 | closed |
| T-04-50 | Elevation of Privilege | 일반 방 테스트 시트 노출 | low | accept | 방장 + testMode 일 때만 마운트, 서버 재거부. R-04-04 | closed |
| T-04-51 | Information Disclosure | 후보 선택 중 남의 선택 표시 | high | mitigate | 서버 비전송. `candidateVote.test.tsx` | closed |
| T-04-52 | Tampering | 자기·탈락자 선택 시도 | medium | mitigate | 서버 거부 + 화면 복귀. `candidateVote.test.tsx` | closed |
| T-04-53 | Tampering | 공개 순서 재정렬 | medium | mitigate | 받은 순서 유지. `reveal.test.tsx` | closed |
| T-04-54 | Denial of Service | 경계 타이머 누수 | low | mitigate | clearTimeout. `reveal.test.tsx` | closed |
| T-04-55 | Denial of Service | 프레임 반복 누수 | medium | mitigate | cancelAnimationFrame. `revealLayer.test.tsx` | closed |
| T-04-56 | Tampering | 없는 좌석 입력 | low | mitigate | 건너뜀. `revealLayer.test.tsx` | closed |
| T-04-57 | Information Disclosure | 변론 줄에 후보 직업 | high | mitigate | props 에 역할 없음. `defense.test.tsx` | closed |
| T-04-58 | Tampering | 비후보 변론 칩 | low | accept | 서버 WRONG_PHASE. R-04-05 | closed |
| T-04-59 | Tampering | 칩이 임의 필드 전송 | medium | mitigate | SayPayload 세 키, 서버 strictObject | closed |
| T-04-60 | Denial of Service | 칩 연타 | low | mitigate | useSendLock, 서버 1.8초 | closed |
| T-04-61 | Information Disclosure | 살아 있는 viewer 화면에 처형자 직업 | high | mitigate | 입력에 직업 없음. `execution.test.tsx` | closed |
| T-04-62 | Denial of Service | 카드가 터치를 막음 | medium | mitigate | `.mf-vintro` pointer-events none. `verdictCss.test.ts` | closed |
| T-04-63 | Information Disclosure | 무효 이유 외 정보 | medium | accept | 입력이 이유 코드 하나. R-04-06 | closed |
| T-04-64 | Information Disclosure | 결과 직업 입력이 다른 부품으로 | high | mitigate | `ResultScreen.tsx` 한 곳. `resultScreen.test.tsx` | closed |
| T-04-65 | Tampering | 닉네임·요약 마크업 삽입 | medium | mitigate | React 텍스트만. `resultScreen.test.tsx` | closed |
| T-04-66 | Denial of Service | 연출 타이머 잔존 | low | mitigate | `resultScreen.test.tsx` | closed |
| T-04-67 | Information Disclosure | 기록 카드가 개인 여부 표 표시 | high | mitigate | 집계만 사용. `recordRows.test.ts`, `userRecordSheet.test.tsx` | closed |
| T-04-68 | Information Disclosure | 특정 viewer 상태에서만 새는 정보 | high | mitigate | 단계 × 보는 사람 × 인원 시험. `verdictStates.test.tsx` | closed |
| T-04-69 | Tampering | 디자인 계약 회귀(진홍 번짐) | medium | mitigate | `verdictCss.test.ts` | closed |
| T-04-70 | Tampering | 검사 기준을 낮춰 거짓 통과 | medium | mitigate | `PANEL_H`·`APPROVED_RELAXATIONS` 고정. `lib.test.mjs` | closed |
| T-04-71 | Tampering | 236 패널 완화 번짐 | medium | mitigate | isCandidate 일 때만 236 | closed |
| T-04-72 | Information Disclosure | 도우미가 토큰을 로그에 | medium | mitigate | 모든 출력이 `redact` 를 지남 | closed |
| T-04-73 | Information Disclosure | E2E 출력에 방 코드·토큰 | medium | mitigate | T-04-72 와 같음 | closed |
| T-04-74 | Tampering | 결정성 훅에 기댄 거짓 통과 | medium | mitigate | winner 는 서버 값과 기대값 둘 다 단언 | closed |
| T-04-75 | Information Disclosure | HANDOFF·결정·SUMMARY 에 토큰 | medium | mitigate | 토큰 형태 문자열 0건(16진은 git SHA) | closed |
| T-04-77 | Information Disclosure | 배포 출력·HANDOFF 에 비밀 | medium | mitigate | `04-35-SUMMARY.md`, HANDOFF 16진 0건 | closed |
| T-04-78 | Denial of Service | 배포 직후 옛 번들 불일치 | low | accept | 옛 저장 방 정규화, 개발 단계. R-04-07 | closed |
| T-04-SC | Tampering | npm 설치 | high | mitigate | 4페이즈 기간 `package.json`·lock 변경 0건 | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above block_on(high) count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| R-04-01 | T-04-05 | 같은 값은 무전송, 연결당 20msg/s 한도. 문제가 되면 `applyExecVote` 한 곳에서 간격을 둔다(결정 0036 A8) | 계획 04-01 | 2026-10-30 |
| R-04-02 | T-04-17 | 네 문장은 확정 문구이며 직업 단어가 없다. 서버는 번호만 보낸다 | 계획 04-05 | 2026-10-30 |
| R-04-03 | T-04-49 | 메시지에 seat 가 없고 신원은 소켓 첨부 playerId | 계획 04-16 | 2026-10-30 |
| R-04-04 | T-04-50 | [테스트] 버튼은 방장 + testMode 일 때만, 서버가 한 번 더 거부 | 계획 04-17 | 2026-10-30 |
| R-04-05 | T-04-58 | 비후보에게는 칩 UI 가 없고 서버가 거부 | 계획 04-21 | 2026-10-30 |
| R-04-06 | T-04-63 | 입력이 이유 코드 하나뿐이라 그릴 데이터가 없다 | 계획 04-24 | 2026-10-30 |
| R-04-07 | T-04-78 | 서버가 옛 저장 방을 정규화, 개발 단계라 영향 없음 | 계획 04-35 | 2026-10-30 |

*Accepted risks do not resurface in future audit runs.*

---

## Unregistered Flags

없음. 결정 0039·0040 이 만든 표면은 T-04-10·22·23·32 로 매핑되어 현재 코드·시험이 통제를 확인했다. 퀵 태스크 `261029-t40`·`261029-vvd` 의 자체 등록부는 이 페이즈 범위 밖이다.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-30 | 79 | 79 | 0 | gsd-security-auditor |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-10-30

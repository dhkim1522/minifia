---
phase: "5"
slug: "atmosphere-character"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-10-30"
---

# Phase 5 — Security

> 5페이즈(분위기와 캐릭터) 보안 계약: 위협 등록부, 수용한 위험, 감사 기록. 계획 9개(05-01~05-09)의 `<threat_model>` 을 합쳐 중복 ID 를 하나로 만들었다(T-05-SC 는 전 계획 공통). 검증 깊이는 ASVS L1(완화 장치가 인용한 파일에 실제로 있는가)이고 block_on 은 high 다.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| 서버 view → 화면 | 서버가 보낸 공개 값만 그린다. 새 안내 문장은 상수이고 역할을 입력으로 받지 않는다. 비네팅·밝아짐 층은 `view.phase` 와 같은 접속의 전환 여부만 읽는다 (05-01, 05-03) | 공개 view (역할 값 없음) |
| 앱 → 브라우저 API | `navigator.wakeLock` 은 브라우저가 허락·거부한다. 실패는 앱이 조용히 받아들인다 (05-02) | Wake Lock 요청·거부 |
| 브라우저 측정 → 기하·판정 | ResizeObserver 가 잰 장면 높이(0·소수·NaN 포함)가 순수 기하 함수로 들어가고, E2E 측정값이 빠지면 거짓 통과가 생길 수 있다 (05-04, 05-05) | 레이아웃 수치 |
| 서버 미리보기 → 링크 참가 화면 | 앉은 사람 수·닉네임(공개 정보)만 그린다 (05-04) | 공개 미리보기 |
| E2E 실행기 → 대상 주소 | 테스트 방(testMode)만 만들고 토큰은 출력에서 가린다 (05-06) | 방 코드(공개)·방 토큰(비밀) |
| 손님 컨텍스트 → 링크 참가 화면 | 세션 없이 미리보기만 읽고 참가하지 않는다 (05-06) | 방 코드 |
| E2E init 스크립트 → 페이지 | 시험용 스크립트가 브라우저 API 를 바꾼다(시험 컨텍스트 안에서만) (05-07) | 시험 전용 코드 |
| 배포본 → 테스트 방 | 스모크·UAT·E2E 는 테스트 방(testMode)만 만든다 (05-09) | 테스트 방 |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-05-01 | Information Disclosure | 새 안내 문장·`data-guide` 가 역할을 드러냄 | medium | mitigate | `PHASE_GUIDE_FILL` 상수(`src/game/scenes.ts`)를 `DayScene.tsx` 가 쓰며 역할 입력이 없다. 모든 `data-guide=""` 는 빈 문자열. 시험: `test/client/guide.test.tsx`(속성 값 빈 문자열, 4역할·관전자 같은 글자) | closed |
| T-05-02 | Tampering | 닉네임이 든 안내 줄의 마크업 해석 | low | accept | React 텍스트로만 그린다. `src/` 전체에 `innerHTML`·`dangerouslySetInnerHTML` 없음. AR-05-01 | closed |
| T-05-03 | Denial of Service | 저전력 모드 반복 거부 시 재요청 루프 | medium | mitigate | `src/net/useWakeLock.ts` 재요청은 `visibilitychange`(visible) 한 곳, release·거부에서 재시도 없음. 시험: `test/client/useWakeLock.test.tsx`(요청 수 단언) | closed |
| T-05-04 | Information Disclosure | Wake Lock 실패 오류를 콘솔·화면에 노출 | low | mitigate | `useWakeLock.ts` 가 예외·거부를 삼키고 `console.` 없음. 시험: `useWakeLock.test.tsx`(콘솔 0), E2E WL1 | closed |
| T-05-05 | Denial of Service | 결과 화면·연결 포기 뒤에도 잠금 유지 | low | mitigate | 늦게 온 잠금 즉시 release, 정리 함수 release. `RoomScreen.tsx` 가 `ended`·`replaced`·`failed`·`removed` 에서 끈다. 시험: `useWakeLock.test.tsx` | closed |
| T-05-06 | Denial of Service | 새 층이 탭을 가로채 투표·선택을 막음 | medium | mitigate | `src/styles/atmosphere.css` 두 층 모두 `pointer-events: none`. 시험: `test/unit/atmosphereCss.test.ts`, E2E AT1·AT2 `elementFromPoint` 탭 통과 | closed |
| T-05-07 | Information Disclosure | 층 유무·모양이 역할·관전 여부에 따라 달라짐 | low | mitigate | 입력이 장면·`view.phase`·전환 여부뿐(`Backdrop.tsx`, `DayScene.tsx`). 시험: `test/client/atmosphere.test.tsx` 4역할·관전자 마크업 동일 | closed |
| T-05-08 | Tampering | CSS 접두 짝 선언이 빌드에서 사라지는 회귀(04-35) | low | mitigate | `atmosphere.css` 에 `backdrop-filter` 와 # 색 값 없음. 시험: `atmosphereCss.test.ts`. 배포본 E2E(05-09)에서 배포 CSS 에 두 층 규칙 확인 | closed |
| T-05-09 | Denial of Service | 첫 측정 0·음수 장면 높이에서 NaN·음수 배율 | low | mitigate | `src/game/dayTable.ts` `TABLE_FIT_MIN_SCALE=0.77` 하한, `tableFitScale` 가 NaN·0·음수를 하한으로. 시험: `test/unit/dayTable.test.ts`(0·-50·NaN·Infinity) | closed |
| T-05-10 | Spoofing | 캐릭터 외형으로 역할을 추측 | low | mitigate | `src/net/assets.ts` `figureSrc(seat)` 는 자리 번호만의 함수. 직업 그림은 관전자 한 곳(결정 0021). 시험: `test/client/characterAudit.test.tsx` | closed |
| T-05-11 | Repudiation | 측정값이 없을 때 E2E 검사가 조용히 통과 | medium | mitigate | `scripts/e2e/lib.mjs` `noMeasure` 와 새 검사 전부가 누락·비숫자를 실패로. 시험: `scripts/e2e/lib.test.mjs`(`측정값 없음` 단언, 177건 통과) | closed |
| T-05-12 | Tampering | 앱과 E2E 단계 목록 불일치로 UX1 거짓 판정 | low | mitigate | `test/unit/e2eContract.test.ts` 가 `lib.mjs` 와 `scenes.ts` 의 `TIMELESS_PHASES` 동일성을 단언 | closed |
| T-05-13 | Information Disclosure | 방 코드·토큰이 결과 표·사진 경로에 찍힘 | medium | mitigate | `flows.mjs` 토큰은 `ctx.secrets` 에, 모든 출력은 `run.mjs` `emit` → `redact`. 콘솔 오류도 `browser.mjs` 에서 가림 | closed |
| T-05-14 | Tampering | 링크 참가 probe 가 실제로 방에 참가해 상태를 바꿈 | low | mitigate | 손님은 `참가하기` 를 누르지 않고 읽기만(`readJoinFit`), `finally` 에서 컨텍스트 닫음 | closed |
| T-05-15 | Tampering | 시험용 init 스크립트가 앱 번들·배포본에 섞임 | low | mitigate | `browser.mjs` `addInitScript` 로 시험 컨텍스트에만 주입. 05-07 커밋은 `scripts/e2e/` 만 변경 | closed |
| T-05-16 | Information Disclosure | 새 흐름의 방 토큰이 출력에 찍힘 | medium | mitigate | `openWakeRoom` 이 `ctx.secrets.push(room.token)`, 같은 `redact` 경로 | closed |
| T-05-17 | Information Disclosure | HANDOFF·SUMMARY·결정 문서에 토큰·계정 비밀 기록 | medium | mitigate | `HANDOFF.md` 에 32자 이상 16진 문자열 0건. SUMMARY 의 긴 16진은 커밋 해시뿐, api token·bearer·ghp_ 패턴 없음 | closed |
| T-05-18 | Elevation of Privilege | 다른 계정의 git 자격 증명·원격으로 push | medium | mitigate | `git remote` = 개인 SSH 원격. `~/.gitconfig` 에 credential·gh 항목 없음, 5페이즈 이전 수정 | closed |
| T-05-19 | Repudiation | 게이트 실패를 기준 완화로 덮음 | medium | mitigate | `APPROVED_RELAXATIONS` 5건 그대로, 5페이즈 diff 에 목록 변경 없음 | closed |
| T-05-21 | Information Disclosure | 배포 출력·SUMMARY·HANDOFF 에 토큰·계정 비밀 기록 | medium | mitigate | T-05-17 과 같은 검사. SUMMARY 에는 Version ID(비밀 아님)만 | closed |
| T-05-22 | Repudiation | 실기기 확인 전 통과 표시로 체감 문제를 숨김 | medium | mitigate | 05-09 시점 통과 표시 없음. 이후 사용자 확인 2026-10-30(`05-UAT.md`), `REQUIREMENTS.md` 에 승인 날짜 | closed |
| T-05-23 | Denial of Service | 배포 직후 옛 번들 방과 새 번들의 불일치 | low | accept | 5페이즈는 서버·와이어 불변. AR-05-02 | closed |
| T-05-SC | Tampering | npm 설치(공급망) | high | mitigate | 새 패키지 없음. `package.json`·`package-lock.json` 마지막 변경이 5페이즈 이전 | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-05-01 | T-05-02 | 닉네임 안내 줄은 기존 부품 그대로 React 텍스트로만 그린다. React 가 이스케이프하고 `src/` 에 `innerHTML` 계열이 없다 (05-01-PLAN) | 05-01-PLAN 승인 | 2026-10-29 |
| AR-05-02 | T-05-23 | 서버·와이어가 불변이라 옛 번들 방도 같은 서버와 동작한다. 개발 단계라 영향이 작다 (05-09-PLAN) | 05-09-PLAN 승인 | 2026-10-29 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-30 | 24 | 24 | 0 | gsd-security-auditor |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-10-30

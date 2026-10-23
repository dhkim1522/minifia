---
phase: 01-walking-skeleton
verified: 2026-10-23T11:00:00Z
status: gaps_found
score: 5/5 로드맵 성공 기준 코드 검증, UAT 사용자 합의 truth 4건 열림 (G-01-9 실기기 FAILED, G-01-1a·G-01-2·G-01-5 디자인 세션 몫)
covered_files: [".planning/phases/01-walking-skeleton/01-01-PLAN.md",".planning/phases/01-walking-skeleton/01-01-SUMMARY.md",".planning/phases/01-walking-skeleton/01-02-PLAN.md",".planning/phases/01-walking-skeleton/01-02-SUMMARY.md",".planning/phases/01-walking-skeleton/01-03-PLAN.md",".planning/phases/01-walking-skeleton/01-03-SUMMARY.md",".planning/phases/01-walking-skeleton/01-04-PLAN.md",".planning/phases/01-walking-skeleton/01-04-SUMMARY.md",".planning/phases/01-walking-skeleton/01-05-PLAN.md",".planning/phases/01-walking-skeleton/01-05-SUMMARY.md",".planning/phases/01-walking-skeleton/01-06-PLAN.md",".planning/phases/01-walking-skeleton/01-06-SUMMARY.md",".planning/phases/01-walking-skeleton/01-07-PLAN.md",".planning/phases/01-walking-skeleton/01-07-SUMMARY.md",".planning/phases/01-walking-skeleton/01-08-PLAN.md",".planning/phases/01-walking-skeleton/01-08-SUMMARY.md",".planning/phases/01-walking-skeleton/01-09-PLAN.md",".planning/phases/01-walking-skeleton/01-09-SUMMARY.md",".planning/phases/01-walking-skeleton/01-10-PLAN.md",".planning/phases/01-walking-skeleton/01-10-SUMMARY.md",".planning/phases/01-walking-skeleton/01-11-PLAN.md",".planning/phases/01-walking-skeleton/01-11-SUMMARY.md",".planning/phases/01-walking-skeleton/01-12-PLAN.md",".planning/phases/01-walking-skeleton/01-12-SUMMARY.md",".planning/phases/01-walking-skeleton/01-13-PLAN.md",".planning/phases/01-walking-skeleton/01-13-SUMMARY.md",".planning/phases/01-walking-skeleton/01-14-PLAN.md",".planning/phases/01-walking-skeleton/01-14-SUMMARY.md",".planning/phases/01-walking-skeleton/01-15-PLAN.md",".planning/phases/01-walking-skeleton/01-15-SUMMARY.md",".planning/phases/01-walking-skeleton/01-16-PLAN.md",".planning/phases/01-walking-skeleton/01-16-SUMMARY.md",".planning/phases/01-walking-skeleton/01-17-PLAN.md",".planning/phases/01-walking-skeleton/01-17-SUMMARY.md","package.json","shared/game/room.ts","shared/nickname.ts","src/components/Sheet.tsx","src/styles/ds.css","src/styles/sheet.css","test/client/entryContrast.test.tsx","test/client/phaseScreens.test.tsx","test/client/sheet.test.tsx","test/unit/gameRoom.test.ts","test/unit/nickname.test.ts","test/worker/join.test.ts"]
covered_digest: "v3:sha256:c3717bf63da061abc0ccbd89c2663a5f93696ca6617f9a2bab1a60cd84489892"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: "5/5 로드맵 성공 기준, 플랜 truth 전부, 실기기 UAT 10건 남음"
  gaps_closed:
    - "G-01-1b (글자 대비): 01-17 로 CSS 값과 대비 테스트까지 닫힘. 눈으로 보는 확인만 남음"
  gaps_remaining:
    - "G-01-9 (시트 진입 모션): 01-16 이 첫 프레임 증상은 바꿨으나 실기기 확인 FAILED, 열림"
    - "G-01-1a (전체 폰트 테마·크기), G-01-2 (원형 테이블 에셋), G-01-5 (OG 이미지): 디자인 세션 몫, 코드 변경 없음"
  regressions: []
gaps:
  - truth: "낮 화면에서 [내 역할]을 누르면 폰에서도 카드가 제자리에서 자연스럽게 열린다 (G-01-9)"
    status: failed
    reason: "01-16 이 진입을 'CSS 시작 상태 고정 + 두 프레임 뒤 열림 클래스 + 60ms 폴백' 으로 바꿨고 자동 테스트는 통과하지만, iPhone Safari 실기기 확인이 FAILED 다(사용자: '여전합니다. 다만 중앙에 떴다 내려가네요'). 녹화 관찰: 시트가 바닥보다 약 60px 위에 멈췄다가 약 0.2초 뒤 바닥으로 툭 내려온다. 증상이 '첫 프레임 위치'에서 '열린 뒤 정지 위치 변화'로 옮겨 갔을 뿐 닫히지 않았다. 원인은 검증되지 않은 가설 단계"
    artifacts:
      - path: "src/styles/sheet.css"
        issue: ".mf-dialog 는 height:100%(8행), .mf-sheet 는 max-height:80dvh(24행)로 뷰포트 단위가 서로 다르다. 열린 뒤 iOS 하단 툴바·visual viewport 갱신 시 하단 기준선이 움직일 수 있다는 1순위 가설"
      - path: "src/components/Sheet.tsx"
        issue: "두 프레임 뒤 열림·폴백 구조는 올바르게 들어갔으나 정지 위치 변화는 다루지 않음"
    missing:
      - "원격 웹 인스펙터로 열린 직후와 0.2초 뒤의 visualViewport.height / innerHeight / 다이얼로그 getBoundingClientRect() 값을 받아 원인 확정 (01-16-SUMMARY.md 재진단 후보 1~4순위)"
      - "확정한 원인에 맞춘 수정 뒤 iOS Safari·Android Chrome 에서 [내 역할]·공유·나가기 확인 시트 세 개를 모두 실기기 확인"
  - truth: "전체 폰트가 마피아 감성의 동글동글 귀여운 폰트이고 크기가 충분히 크다 (G-01-1a)"
    status: failed
    reason: "01-UAT.md 에서 사용자가 보고한 열린 갭. 폰트 결정과 크기 토큰 변경이 필요한 디자인 세션 몫이라 이 페이즈에서 어떤 plan 도 처리하지 않았다"
    artifacts: []
    missing:
      - "디자인 세션에서 폰트 테마·글자 크기 결정 뒤 design/tokens.json 과 npm run tokens 로 반영"
  - truth: "대기실 원형 테이블이 배경과 구분되고 마피아 게임 분위기에 맞는다 (G-01-2)"
    status: failed
    reason: "01-UAT.md 열린 갭. 새 그림 에셋은 클로드 데스크톱에서 만들어 넘겨야 한다(결정 0010·0011)"
    artifacts: []
    missing:
      - "배경과 겹치지 않는 테이블 에셋을 받아 public/ 에 추가하고 대기실에 반영"
  - truth: "링크 미리보기 OG 이미지가 앱 폰트와 통일되고 배경 에셋을 쓴 완성도 있는 모습이다 (G-01-5)"
    status: failed
    reason: "01-UAT.md 열린 갭. G-01-1a 폰트가 정해진 뒤 같이 처리하기로 했다. 현재 OG 이미지는 임시(남색 바탕에 글씨만)"
    artifacts: []
    missing:
      - "폰트 확정 뒤 배경 에셋을 쓴 OG 이미지로 교체 (scripts/make-og.mjs)"
deferred: []
behavior_unverified_items: []
coincidental_reliance_items: []
human_verification:
  - test: "PC 에서 npm run dev 후 폰 폭(360×640) 또는 폰 브라우저(LAN 주소)로 / 와 /r/{방 코드} 를 연다 (G-01-1b)"
    expected: "'닉네임'·'방 코드' 라벨과 '또는' 이 본문 글자처럼 또렷하고, 방 코드 칸의 '4자리 숫자' 힌트가 읽히면서 입력한 숫자와 구분되며, 꺼진 [참가]·[방 만들기] 가 읽히되 켜진 버튼보다 분명히 흐리다. '비활성처럼 느껴진다' 는 인상이 없다"
    why_human: "화면 인상은 지각 판단이다. 비율(라벨 13.7:1, 힌트 7.56:1, 구분선 3.44:1, 꺼진 버튼 5.43~6.07:1)은 테스트가 증명하지만 '비활성 느낌' 은 눈으로만 닫힌다. 01-17-SUMMARY 가 단계 끝 UAT 로 넘긴 항목"
  - test: "360×640 실기기에서 링크 참가, 대기실 8인, 역할 확인, 낮 화면을 연다"
    expected: "세로 스크롤 없이 화면에 들어가고, 시민 역할 설명이 세 줄 이내다 (가정 A15)"
    why_human: "실제 폰 뷰포트·글꼴 렌더링은 코드·스모크로 볼 수 없다 (UAT 6번은 Playwright 로 통과, 실기기는 사람 판단)"
  - test: "방장 폰에서 [공유하기]·[링크 복사]를 누른다 / 공유·나가기 확인 시트가 G-01-9 와 같은 어긋남이 있는지 본다"
    expected: "Web Share 시트가 열리거나 링크가 복사된다. 공유·나가기 시트도 아래에서만 올라와 바닥에 붙는다"
    why_human: "브라우저 제스처 정책과 iOS 합성은 실기기에서만 확인된다 (UAT 4번 통과, 01-16 녹화에는 [내 역할] 시트만 있음)"
  - test: "폰 2대 이상(연결된 사람 4명 이상은 폰 4대, 또는 폰+PC 의 서로 다른 브라우저)으로 한 판 시작하고 역할 확인 카운트다운을 같이 본다"
    expected: "폰들이 0.5초 이내로 함께 '낮이 되었습니다' 로 넘어간다 (A1). 배포본 스모크 편차는 467ms(상한 500ms) 로 여유가 작았다"
    why_human: "체감 동기와 실기기 시계 오프셋 (UAT 7번 자동 2.8ms 는 같은 PC 시계)"
  - test: "연결이 끊긴 채 30초를 기다리고, 단절 직후 띠가 뜨기까지의 시간을 본다"
    expected: "30초 뒤 포기 화면이 나온다 (A17). 자동 확인에서 띠가 약 10초 뒤에 떴으므로 실기기에서 조용한 단절 감지를 본다"
    why_human: "실제 망 상태·타이머 체감"
  - test: "게임 중 wrangler deploy 로 재배포한다 (UAT 10번, 사용자가 재배포 뒤로 미룸)"
    expected: "소켓이 끊겼다가 자동 재접속되고 같은 자리·역할이다 (A5)"
    why_human: "배포 중 소켓 끊김은 운영 환경에서만 확인된다"
  - test: "느린 망에서 첫 대기실 채움 시간을 본다"
    expected: "체감상 문제 없다 (UAT 11번에서 이 부분만 미확인)"
    why_human: "체감 성능"
---

# Phase 1: 걷는 뼈대 검증 보고서 (재검증, 갭 클로저 01-15~01-17 이후)

**Phase Goal:** As a 친구 모임의 플레이어, I want to 링크로 방에 모여 내 역할 카드만 받아 보기, so that 서로의 역할을 모른 채 각자 폰으로 한 판을 시작할 수 있다. (Mode: mvp)
**Verified:** 2026-10-23
**Status:** gaps_found
**Re-verification:** 예 — 이전 상태 human_needed 이후 01-15, 01-16, 01-17 반영

## 한 줄 요약

로드맵 성공 기준 5개와 요구사항 8개는 코드로 성립한다. 전체 테스트 41파일 635개와 타입 검사가 통과하고, 이전 검증 이후 코드 변경(닉네임 키, Sheet 진입, ds.css 대비)에서 회귀는 찾지 못했다. 그러나 사용자 UAT 가 연 갭 중 G-01-9(폰에서 [내 역할] 시트가 떴다 내려가는 모션)는 01-16 수정 뒤 iPhone 실기기 확인에서 FAILED 였고 아직 열려 있다. G-01-1a·G-01-2·G-01-5 도 코드 작업이 없어 열려 있다. 따라서 이전의 `human_needed` 가 아니라 `gaps_found` 로 낮춘다. G-01-1b 는 자동 검증으로 닫혔고 눈 확인만 남았다.

## 열린 갭 정직 보고

| 갭 | 상태 | 근거 | 성격 |
| --- | --- | --- | --- |
| G-01-9 시트 진입 모션 | 열림 (FAILED) | 01-16-SUMMARY `status: partial`, `gap_status: open`, 01-UAT.md `post_fix_report.result: failed` | 폰 한정 모션 결함, severity minor. 원인 미확정 |
| G-01-1a 폰트 테마·크기 | 열림 | 01-UAT.md `status: failed`. 어떤 plan 도 다루지 않음 | 디자인 결정 필요, cosmetic |
| G-01-2 원형 테이블 에셋 | 열림 | 같음 | 새 그림 에셋 필요(데스크톱 디자인 세션) |
| G-01-5 OG 이미지 | 열림 | 같음. G-01-1a 이후 처리 | 새 그림·폰트 필요 |
| G-01-1b 글자 대비 | 자동 검증 닫힘, 눈 확인 대기 | 01-17 COMPLETE, 대비 테스트 5건, 01-UAT.md 에는 아직 failed 로 남아 있음 | 사람 확인 후 UAT 갱신 필요 |

로드맵상 Phase 5 가 "전체 톤·캐릭터·연출 통일"을 맡지만(Notes 및 LOOK-01) 폰트·테이블·OG 갭을 명시적으로 가져간다고 적힌 곳이 없어 `deferred` 로 옮기지 않았다.

## 이번에 직접 확인한 것

| 확인 | 방법 | 결과 |
| --- | --- | --- |
| 전체 테스트 | `npx vitest run` (한 번) | 41 files, 635 tests passed |
| 타입 검사 | `npm run typecheck` (tokens:check 포함) | 종료 코드 0 |
| 이전 검증 이후 코드 변경 범위 | `git diff --stat 59caa32 HEAD -- src worker shared index.html public scripts wrangler.jsonc design package.json` | 4파일: `shared/nickname.ts`, `src/components/Sheet.tsx`, `src/styles/ds.css`, `src/styles/sheet.css`. worker·역할 뷰·시계·재접속 경로 변경 없음 |
| 역할 누출 경로 | `shared/game/view.ts` 40-50행: 내 역할은 `revealsOwnRole` 일 때만, 마피아 동료만 `allies` 로 추가. leak.test, view.test 통과 | 변경 없음, 통과 |
| 디버트 마커 | 변경 파일 대상 `TBD/FIXME/XXX` grep | 없음 |
| G-01-1b CSS 값 | `git diff` 로 ds.css 확인: 라벨·구분선 글자 gray-100, 힌트 opacity 1, 구분선 선 gray-500, 꺼진 버튼 opacity 0.6 | SUMMARY 표와 일치 |
| G-01-9 코드 | `Sheet.tsx` 에 `entered` 상태, rAF 2회 + 60ms 폴백, 정리 함수의 `cancelEnter`, `focus({ preventScroll: true })`. `sheet.css` 의 `translateY(100%)` 초기값과 `.mf-dialog--open` 전환 | SUMMARY 와 일치. 단 실기기에서 효과 불충분 |
| 배포본 버전 | `curl https://minifia.dhplay.workers.dev/api/health` | `2026-10-23T07:59:34Z+59caa32` — 배포본에 01-15·01-16·01-17 이 들어 있지 않다 |
| 원격 동기 | `git ls-remote origin main` | `2fbade2`. 로컬 HEAD `62d3e73` 보다 뒤라 01-15 이후 UAT·01-16·01-17 커밋이 push 되지 않았다 |

`scripts/smoke.mjs --print-version` 은 주소 없이 쓰면 로컬 값(`+f7b4258`)을 찍으므로 배포본 판정에 쓰지 않았다. 판정은 `/api/health` 로 했다.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Cloudflare 배포 주소로 폰 2대 이상이 같은 방에 들어가 역할을 받는다 | VERIFIED (실기기 참가는 human) | 이전 배포본 스모크 `SMOKE OK full players=6`, UAT 6번 Playwright 8창 통과(시민4·마피아2·경찰1·의사1). 배포본은 59caa32 이고 그 뒤 변경은 이 경로에 닿지 않음 |
| 2 | 방 만들기에 4자리 코드와 참가 링크, 공유, 링크·코드로 닉네임만 입력해 대기실 진입 | VERIFIED (공유 제스처·카카오는 UAT 3·4·5번에서 사용자 확인) | join/preview/joinByLink/share 테스트 통과. UAT 3·4번 pass, 5번 미리보기 자체는 정상(OG 모양만 G-01-5) |
| 3 | 4명 이상 시작, 인원 구성표대로 배정, 자기 카드만, 마피아는 동료도, 남의 역할은 네트워크에 없음 | VERIFIED | roles, view, leak 테스트 통과, view.ts 허용 목록 구조 확인 |
| 4 | 배정 약 3초, 역할 확인 15초, 마감에 맞춰 낮 전환, 새로고침·재접속에도 같은 자리·역할 | VERIFIED (실기기 동기 체감은 human) | tick/alarm/reconnect/start 테스트 통과. UAT 9번 잠금 복귀 확인됨 |
| 5 | 재배포해도 주소는 그대로, 새 버전이 보인다 | VERIFIED (이전 검증 사실. 이번에는 재배포 안 함) | 주소 `minifia.dhplay.workers.dev` 가 그대로 200. 단 배포본은 아직 59caa32 라 이번 수정들은 배포되지 않았다 |
| P1 | 01-15: 같은 이름으로 보이는 입력은 같은 키, 보이는 글자 없는 값은 INVALID_CHARS | VERIFIED | `shared/nickname.ts` 변경 존재, nickname/gameRoom/join 테스트 통과(이전 검증에서 재현 입력으로 확인, 이후 변경 없음) |
| P2 | 01-17: 라벨·힌트·구분선·꺼진 버튼이 WCAG 대비 이상 | VERIFIED (코드·테스트). 지각 판단은 human | `entryContrast.test.tsx` 5건 통과, ds.css 값 확인 |
| P3 | 01-16: 시트가 폰에서 제자리에서 자연스럽게 열린다 | FAILED | 위 gaps 첫 항목. 자동 테스트는 통과하나 실기기 FAILED |

**점수:** 로드맵 성공 기준 5/5. 플랜·UAT truth 는 P3 와 UAT 갭 3건이 열려 있어 완전하지 않다. PRESENT_BEHAVIOR_UNVERIFIED 는 0건이다 (P3 는 behavior 가 실기기에서 반증되었으므로 UNVERIFIED 가 아니라 FAILED).

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `src/components/Sheet.tsx` | 두 프레임 뒤 열림, 폴백, preventScroll | VERIFIED (코드). 실기기 효과 부족 | 위 diff |
| `src/styles/sheet.css` | 시작 상태 고정 + 열림 전환 | VERIFIED (코드) | keyframes 제거, transition 사용 |
| `src/styles/ds.css` | 대비 값 | VERIFIED | 위 diff |
| `shared/nickname.ts` | 비교 키 정규화 | VERIFIED | 이전 검증 |
| `test/client/entryContrast.test.tsx` | 대비·가드 테스트 | VERIFIED | 존재, 통과 |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `Sheet.tsx` | `sheet.css` | `mf-dialog--open` 클래스 | WIRED | className 분기와 `.mf-dialog--open .mf-sheet` 규칙 일치 |
| `ds.css` | `tokens.css` | var(--gray-*) 토큰 | WIRED | tokens:check 통과 |
| `view.ts` | 클라이언트 | 허용 목록 `myInfo` | WIRED | leak 테스트 |

### Data-Flow Trace (Level 4)

변경분(Sheet, 대비 CSS, 닉네임 키)은 새 동적 데이터 경로가 없다. 역할 데이터 경로는 이전 검증과 같다.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| 전체 테스트 | `npx vitest run` | 41 files, 635 passed | PASS |
| 타입·토큰 | `npm run typecheck` | exit 0 | PASS |
| 배포본 생존 | `curl /api/health` | `{"ok":true,"version":"…+59caa32"}` | PASS (구버전) |
| 시트 폰 모션 | 실기기 녹화 | 정지 위치 어긋남 | FAIL (자동 불가, 사용자 실기기) |

### Probe Execution

SKIPPED. 선언된 `probe-*.sh` 없음.

### Requirements Coverage

PLAN frontmatter 의 요구사항 ID: ROOM-01, ROOM-02, ROOM-03, CONN-01, DEPLOY-01, GAME-01, ROLE-01, ROLE-02. REQUIREMENTS.md 의 Phase 1 매핑과 같다. 누락·ORPHANED 없음.

| Requirement | 판정 | 근거 |
| --- | --- | --- |
| ROOM-01 | SATISFIED (공유 제스처는 UAT 4번 사용자 통과) | share/http 테스트, UAT 4번 pass |
| ROOM-02 | SATISFIED | join 테스트, 닉네임 키 수정, UAT 3번 pass |
| ROOM-03 | SATISFIED | start/gameRoom 테스트(4~8명, 연결자 4명 이상 시작) |
| CONN-01 | SATISFIED | reconnect 테스트, UAT 9번 잠금 복귀 확인 |
| DEPLOY-01 | SATISFIED (이전 검증) | 주소 고정, 배포본 200. 단 최신 코드는 미배포 |
| GAME-01 | SATISFIED | tick/alarm 테스트, 배정 3초·확인 15초·낮 전환 |
| ROLE-01 | SATISFIED | roles.test 구성표 |
| ROLE-02 | SATISFIED (서버 누출 없음). 단 [내 역할] 시트의 폰 모션 결함 G-01-9 가 열려 있음 | leak/view 테스트. 사용자 경험상 결함이지 요구사항 미충족은 아님 |

기록 불일치: `REQUIREMENTS.md` 는 ROOM-02 만 `[x]`/Complete 이고 나머지 7개가 Pending 이다. 이 검증은 REQUIREMENTS.md 를 갱신하지 않았다. 01-16 SUMMARY 는 ROLE-02·ROOM-01 을 `requirements-completed` 에서 의도적으로 뺐다.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `src/styles/sheet.css` | 8, 24 | `.mf-dialog` height:100% 와 `.mf-sheet` max-height:80dvh 가 다른 뷰포트 단위 | WARNING | G-01-9 의 1순위 가설. 확정 전 |
| `src/screens/Lobby.tsx` | 168-176 | WR-01 (이월) | WARNING | 유령 자리 |
| `src/net/useRoomConnection.ts` | 194-214 | WR-02 (이월) | WARNING | 두 창이 서로 쫓아냄 |
| `src/net/linkReducer.ts` / `Lobby.tsx` | 55-57 / 39-47 | WR-03 (이월) | WARNING | 지난 토스트 재생 |
| `src/screens/RoleReveal.tsx` / `useRoomConnection.ts` | 31-33 / 76-77 | WR-04 (이월) | WARNING | 시계가 빠른 폰에서 카드 초기 면 |
| `worker/index.ts`, `worker/allocate.ts` | 43-96 | WR-05 (이월) | WARNING | HTTP 속도 제한 없음 |
| `worker/room.ts` | 80-98 | WR-06 (이월) | WARNING | 만료 전 방 코드 덮어쓰기 |
| 변경 파일 | - | `TBD/FIXME/XXX` | 없음 | - |

WR-01~06 은 이전 검증과 같고 로드맵 성공 기준을 깨지 않는다. 2페이즈가 같은 연결 계층을 얹으므로 WR-01~04 는 그 전에 고치는 편이 안전하다 (`01-REVIEW-DISPOSITION.md`).

### Human Verification Required

프런트매터 `human_verification` 7건. 첫 항목은 G-01-1b 눈 확인이다. 공유·나가기 시트가 G-01-9 와 같은 어긋남을 보이는지도 이번 재진단의 입력이 된다.

### Gaps Summary

닫을 일이 있는 갭은 두 갈래다.

1. **코드 재진단이 필요한 갭 — G-01-9.** 추측 수정은 같은 실기기 확인 루프를 반복하게 한다. 01-16-SUMMARY 의 권고대로 원격 웹 인스펙터로 열린 직후와 0.2초 뒤의 `visualViewport.height`, `innerHeight`, 다이얼로그 `getBoundingClientRect()` 값을 먼저 받는다. 1순위 가설은 `.mf-dialog` 높이(100%)와 `.mf-sheet` 높이 단위(dvh)가 열린 뒤 iOS 툴바 갱신으로 어긋나는 것이다. `/gsd-plan-phase 1 --gaps` 로 새 plan 을 만들거나 디버그 세션으로 넘긴다.
2. **디자인 세션이 필요한 갭 — G-01-1a, G-01-2, G-01-5.** 폰트 결정, 새 테이블 그림, OG 그림은 클로드 데스크톱에서 만들어 넘기는 몫이다 (결정 0010·0011). G-01-5 는 G-01-1a 이후에 처리한다.

추가 주의.

- **배포본이 최신이 아니다.** 배포본은 59caa32 라 01-15(닉네임 규칙), 01-16(시트), 01-17(대비) 가 반영되지 않았다. G-01-9 와 G-01-1b 의 확정 확인, UAT 10번(배포 중 재접속)은 재배포 뒤에 한다. 01-17 도 G-01-9 재진단 뒤 재배포하기로 미뤄 두었다.
- **push 되지 않은 커밋.** 원격 main 이 2fbade2 라 UAT 결과, 01-16, 01-17 커밋이 로컬에만 있다. 집 PC 와 오가며 작업하는 프로젝트라 push 가 필요하다 (이 검증은 push 하지 않았다).
- **문서 정합.** ROADMAP 진행률(16/17)과 01-16 체크박스 `[ ]` 는 현재 상태와 맞다. `01-UAT.md` 의 G-01-1b 는 눈 확인 전까지 failed 로 남아 있어도 정상이다. REQUIREMENTS.md Traceability 는 갱신되지 않았다.

---

_Verified: 2026-10-23_
_Verifier: Claude (gsd-verifier)_

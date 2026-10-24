# 작업 인계

> 다른 PC나 다음 세션에서 바로 이어서 할 수 있도록 현재 상태와 다음 할 일을 적는다. 작업을 마칠 때마다 교체한다.

## 현재 상태

- **3페이즈(밤과 아침) 실행 중**: 03-01 완료(서버 루프 낮 토론 → 밤 30초 → 아침 5초 → 다음 낮, 난수 주입 `tick(state, now, randInt)`, 3페이즈 와이어 타입, 방 화면 night·morning 라우팅·밤 안내·모르는 단계 폴백). 다음은 03-02. 배포는 03-12 에서.
- **2페이즈 갭 클로저 G-02-1·G-02-2 실행 완료(02-12~02-18, 2026-10-24) — 실기기 UAT 재확인 대기**(`/gsd-verify-work 2` 전). 새 배포 버전 `2026-10-24T11:54:33Z+59c3363`(이전 `2026-10-23T18:47:24Z+1ca2b41`).
  - 배포본 확인: `node scripts/smoke.mjs --prod --stage full`(5명)·`--players 8` 모두 `SMOKE OK full`(5명 spread 0ms·reveal 0ms, 8명 spread 7ms·reveal 32ms). 낮 한 바퀴를 방장 넘기기 없이 서버 타이머로 돌아 2일차 dayAnnounce 까지 가고, 빠른 메시지는 chat 프레임(키 `at,seat,seq,t,target,template`)으로만 오며 state 에 `messages`·`extendUsed` 가 없고, 2초 안 두 번째는 `RATE_LIMITED`, `text` 키는 `BAD_MESSAGE`, 방장·손님의 `extend`·`skip` 은 `BAD_MESSAGE` 이고 마감은 그대로다. 봇 UAT `node scripts/uat-day.mjs --prod --players 5|8` 종료 코드 0: 2000ms 간격 오탐 **5명 0/16, 8명 0/28**(2050·2150ms 도 0), 받아들인 줄 모두 도착(G-02-2 회귀 확인).
  - 바뀐 것: 고정 테이블(280×108, 인원과 상관없이 하나)·이름표 2줄(색깔점+이름 / 주장, 말 안 함 "-", 말 바꿈 ↺ 배지)·이모티콘만 머리 위·보낸 사람 이름표 반전·하단 157 고정(세 단계 같은 높이)·채팅 세 줄 + 채팅 내역 모달·방장 연장·넘기기 제거(서버 extend/skip 포함)·채팅 서버 저장 제거(방송만)·닉네임 최대 5자·서버 전송 한도 1800ms(클라이언트 잠금 2000ms). 근거는 결정 0017·0016 의 갱신 줄, 화면 기준은 `design/screens/day-v3/SPEC.md`.
  - **실기기 확인 목록**(UAT 테스트 1~5·7 — 아직 통과 표시 안 함. `/gsd-verify-work 2` 로 폰 2대 이상, iPhone Safari·Android Chrome, 폭 360px 폰 하나 포함, 8명 방(봇 `node scripts/bots.mjs <코드> --prod --count 7`)과 4명 방으로 낮 한 바퀴: 직업 공개 → 공개 연출 → 토론 → 타이머로 다음 낮): (1) 테이블이 고정이고 이름표가 화면 끝에서 잘리지 않으며 4명은 겹치지 않고 8명은 옆자리와 조금만 겹침 (2) 직업 공개 중 아랫줄이 … → ✓ 완료, 공개 순간 모든 아랫줄이 동시에 주장으로 바뀌며 팝·흔들림, 말 바꿈은 ↺ 배지 (3) 빠른 메시지는 말풍선 없이 채팅 세 줄과 보낸 사람 이름표 반전(약 3초)으로, 이모티콘만 머리 위에 약 2초 (4) 360×640·390 폭(주소창이 보이는 상태 포함)에서 직업 공개·토론 모두 세로 스크롤이 없고, 화면이 짧으면 테이블이 위로 올라가 맨 앞 이름표가 하단 패널에 가리지 않으며(장면 높이 326 미만의 아주 짧은 화면만 조금 겹침 허용), 단계가 바뀌어도 테이블이 움직이지 않음 (5) ^ 를 누르면 채팅 내역 모달에 그날 줄이 다 보임 (6) 2초 간격으로 연달아 보낸 메시지가 사라지지 않음 (7) 방장 화면에도 연장·넘기기가 없음. 배치 수치는 자동 검사(02-14 높이 300~460, 02-16·02-17 장면 높이 배선)가 지키므로 실기기에서는 글꼴 렌더링·주소창 변화의 겹침·잘림과 애니메이션 느낌만 본다.
  - 봇 UAT 시나리오: `node scripts/uat-day.mjs --prod [--players 4~8]` — 방 만들기부터 낮 두 바퀴까지 봇이 돌며 테스트 6(연속 전송 오탐)·7(동기화)·3/8(말 바꿈·안 고른 사람 공개 값)을 표로 낸다. 2000ms 간격 오탐이 나왔던 gap **G-02-2** 는 서버 한도 1800ms 로 닫았고 이 시나리오가 회귀 확인이다(오탐 0). 방장 넘기기 대신 서버 타이머(토론 90초)를 기다려 2일차로 간다(전체 약 4분).
  - 수동 시험용 봇: `node scripts/bots.mjs <방코드> --prod [--count N] [--quiet]` — 방장이 방을 만들면 봇이 들어와 직업 공개·빠른 메시지·이모티콘을 보낸다. Ctrl+C 로 나가기.
- **2페이즈(낮 토론) 실행 완료·검증 대기**(2026-10-24, 계획 02-01~02-11 모두 실행, `/gsd-verify-work 2` 전). 1페이즈는 완료·검증 통과(`01-VERIFICATION.md` passed, UAT 11/11).
  - 배포 주소: **https://minifia.dhplay.workers.dev** (Worker 이름 = 주소, 결정 0009). 최신 배포 버전 `2026-10-24T11:54:33Z+59c3363`(02-18 에서 재배포, 이전 `2026-10-23T18:47:24Z+1ca2b41`). 코드 기준은 `main` 의 최신 커밋.
  - 배포본 스모크 설명은 위 갭 클로저 항목이 최신이다. 공개 마감 전 역할·주장 문자열은 허용 경로(`view.me.role`·`view.me.claim`·`view.day.roles[]`)에만 있고 `claims` 키가 없음을 경로 단위로 확인한다. 개발 서버(`localhost`)에서는 스모크의 마지막 에셋 캐시 헤더 단언(`max-age=86400`)만 실패한다(개발 서버가 no-cache).
  - 2페이즈 구조 결정은 `docs/decisions/0016-day-loop-structure.md`(claimReveal 별도 서버 단계, ON_ENTER 진입 훅 표, day → dayAnnounce 이름 교체와 `normalizeStoredRoom`, 하루 걸러 말 바꿈 규칙, ALREADY_EXTENDED, 쿨다운 단순안, 메시지 `seq`·이모티콘 비보관). 직업 공개·빠른 메시지 규칙은 0015.
  - ROADMAP Phase 2 성공 기준 3·6 을 사용자 확정에 맞게 고쳤다(예시를 "[○○]는 [경찰]이었어요" 로, "[○○]는 [직업]이었어요" 만 네 번).
  - 실기기 확인 항목은 맨 위 갭 클로저 항목의 **실기기 확인 목록**이 최신이다(옛 말풍선·방장 줄·8자 닉네임 항목은 결정 0017 로 대상이 없어졌다).
  - 1페이즈에서 한 것: G-01-9(`.mf-dialog overflow: clip`), 코드 리뷰 WR-01~06 수정, 개발 서버 `%40`(vite 플러그인), 결정 0013(Gowun Dodum·영문 **Minifia**·크림 대리석 테이블·OG 재생성)·0014(첫 화면은 버튼과 코드 칸만, 닉네임은 시트에서), 닉네임 시트 키패드 대응, 제목 굵게, 첫 화면 버전 글자 숨김. 검증 중 한 번 `POST /api/rooms 500` 이 났으나 재현 안 됨 — 또 나면 `wrangler tail`
  - 서버가 규칙을 정하고 남의 역할·토큰은 클라이언트로 보내지 않는다(결정 0002). 마피아에게만 동료 seat 가 간다
  - 그림·폰트 시안도 이 세션의 Design 캔버스에서 만들 수 있다(결정 0013). 시안 캔버스: https://claude.ai/artifact/QmHcG4zcPswojK2YfS5ik3 (폰트·테이블·OG·첫 화면). 새로 그려야 하는 일러스트(인물·직업)만 클로드 데스크톱
  - 주 버튼은 밝은 회색(`--gray-100`)이다. 진홍은 처형·탈락 발표에만 쓴다
  - 열린 항목(`.planning/DEFERRED-BUGS.md`): WR-01~04 는 폰 확인 전(테스트로만 확인), 코드 리뷰 IN-01~09(INFO), 8명 360×640 레이아웃을 새 폰트로 다시 확인, Google Fonts 를 출시 때 자체 호스팅할지, 시계 오프셋을 실기기 여러 대로 확인, 침묵 단절 띠가 약 10초 뒤 뜸, SECURITY.md·VALIDATION.md 미작성(`/gsd-secure-phase 1`, `/gsd-validate-phase 1`)
  - **디자인 아티팩트 동기화가 남음**(디자인 세션 몫 — GSD 에이전트는 아티팩트를 못 고친다. 승인 기준은 `.planning/phases/02-day-discussion/02-UI-SPEC.md` "아티팩트 동기화"):
    - **결정 0017 을 디자인 시스템·화면설계서 S-06·S-08 아티팩트에 동기화** (고정 테이블·이름표 2줄·말풍선은 이모티콘만·하단 157·채팅 세 줄 + 모달·방장 전용 기능 제거·닉네임 5자). 승인본은 `design/screens/day-v3/SPEC.md`
    - **높이 적응 세로 위치**(장면 높이 < 359 → 좌석 원 cy 가 177 까지 올라감, 시안 크기 407·383 에서는 cy 210 그대로 — SPEC 과의 의도적 차이, 결정 0017 결과·`day-v3/SPEC.md` 구현 메모)를 화면설계서 S-07 에 반영할지 결정
    - 화면설계서 S-08: 문구 5개("[○○] 의심돼요", "[○○] 믿어요", "[○○]는 [직업]이었어요", "저 아니에요", "[○○] 투표해요"), 대상·직업 칩 규칙, 첫 칩 미리 선택, 닫으면 내용 버림
    - 화면설계서 S-06: 직업 칩은 이번 판 직업만(4명판은 의사 없음), 타이머 15초, 2일차 이후 어제 선택 미리 선택, 공개 연출(팝 + 흔들림, 약 2초), 낮 시작 발표 보조 문구. 1페이즈 쪽은 S-01(결정 0014)·`design/screens/` PNG 도 새 첫 화면·폰트·테이블로 갱신
    - 화면 흐름 `01_Flow`: 단계 시간 — 낮 시작 발표 약 2초, 직업 공개 15초, 공개 연출 약 2초, 낮 토론 90초
    - 디자인 시스템: `QuickMessagePanel` 템플릿 목록(5개), `EmojiBar` 8종 이름(웃음·크게 웃음·놀람·의심·화남·슬픔·좋아요·느낌표), 로그 면(`--night-700`), 주장 알약·완료 알약 부품 규격, 그리고 기존 R18 — "방장" 배지, 내 역할 시트, 공유 시트, 닉네임 시트, 토스트, 52px 재접속 띠, 모션 길이 토큰(코드의 지역 상수 220·240·300·320ms 와 배정 링 1s 를 토큰으로 올릴지 정한다). 디자인 시스템 아티팩트는 토큰·테이블 규칙까지만 맞춰져 있다(Version 12)
  - 한 브라우저 프로필 = 한 사람(입장 정보 localStorage 한 칸). 한 PC 로 여러 명을 시험하려면 서로 다른 브라우저를 쓴다
- **작업 방식·결정 요약**
  - 웹앱 먼저(0001), Cloudflare Durable Objects(0002), 정통 마피아 + 무거운 분위기 + 특색 캐릭터(0003), GSD Core + gsd-addons(0004), 비대면 게임·빠른 메시지·이모티콘(0005), 플레이어 몰입 우선(0006), 낮부터 시작·매 낮 직업 공개(0007), 2.5D(0008), Worker 이름·DO 선언·도구 버전 고정(0009), 디자인 먼저·산출물 두 종류(0010·0011), 시작은 연결된 4명 이상·카드 5초 자동·[내 역할] 시트·토스트(0012), 폰트·테이블·OG(0013), 첫 화면 닉네임 시트(0014), 직업 공개 15초 동시 공개·빠른 메시지 5종(0015), 낮 루프 구조(0016), 낮 화면 고정 테이블·채팅 방송만·방장 전용 기능 제거(0017)
  - 결정 0009: **Worker 이름을 바꾸면 주소가 바뀌어 이미 보낸 링크가 깨진다.** DO 를 `exports` 로 선언해 `migrations` 로 되돌릴 수 없고, 클래스 `Room` 이름을 바꾸거나 지우면 방 데이터가 지워진다
  - GitHub 비공개 저장소: https://github.com/dhkim1522/minifia (SSH 원격, `main` 직접 커밋 — `git.allow_default_branch_commits: true`)
  - 사람용 산출물은 클로드 아티팩트, AI 용 지침은 저장소(`.planning/`, `docs/`, `design/`). GSD 에이전트는 아티팩트를 못 읽어 승인본을 `design/` 에 사본으로 둔다
  - 디자인 시스템: https://claude.ai/artifact/Tp175mmuxLAHycMUtwZJ9Q (이 세션에서만 고친다) · 화면설계서 v0.2 https://claude.ai/artifact/QtbQYhk7ezy4fV7H98bZJz · 화면 흐름 https://claude.ai/artifact/NzZBqoJD8ut16J2VUwpn64 · 캐릭터 에셋 https://claude.ai/artifact/4dYpe74vxJHSnA4WhFSLTM
- **한 브라우저 프로필 = 한 사람**: 입장 정보가 localStorage 한 칸(`minifia:session`)이라 같은 프로필의 두 번째 탭으로 같은 방 링크를 열면 첫 탭의 자리를 이어받고, 첫 탭은 4001 로 "다른 창에서 이 방에 들어갔어요" 가 된다(버그가 아니라 한 칸 설계의 결과). 한 PC 로 여러 명을 시험하려면 서로 다른 브라우저(Chrome·Safari·Firefox·Edge)나 브라우저 프로필을 사람마다 하나씩 쓴다. 시크릿·개인 정보 보호 창은 같은 브라우저 안에서 저장소를 공유할 수 있으니 브라우저마다 한 사람으로만 센다
- **실기기에서 지켜볼 가정**(1페이즈 UAT 에서 확인): A1 시계 오프셋 정확도, A3 iOS 화면 잠금 복귀 좀비 소켓, A5 배포 중 소켓 끊김과 자동 재접속, A7 카카오톡 미리보기, A11 srcset 선택, A12 iOS `<dialog>` 포커스, A14 iOS 공유·복사 제스처, A15 360px 장면 크기, A17 30초 포기 기준, Open Question 7 좀비 connected 와 시작 조건

## 다음 할 일

1. `/gsd-verify-work 2` — 새 화면으로 UAT 테스트 1~5·7 을 실기기에서 재확인(위 실기기 확인 목록)
2. `/gsd-secure-phase 2`, `/gsd-validate-phase 2`, `/gsd-extract-learnings 2`(페이즈가 끝날 때마다). 1페이즈 몫도 남음: `/gsd-secure-phase 1`, `/gsd-validate-phase 1`
3. `/gsd-discuss-phase 3` — 3페이즈 밤과 아침. 각 페이즈는 몰입·이펙트·액션을 기본형으로 함께 만든다(결정 0006). 3페이즈는 `discussion.next`(임시 루프)를 밤으로 바꾸고 ON_ENTER 표에 행을 더하며, 탈락자 거부(`isAlive`, 지금은 `BAD_MESSAGE`)를 확정한다(결정 0016)
4. 디자인 아티팩트 동기화(위 목록) — 디자인 세션에서. 3페이즈 화면을 설계할 때 같이 하는 것이 효율적
5. 폰으로 1페이즈 WR-01~04 확인(연결 끊김·재접속·역할 카드), 새 폰트에서 8명 360×640 확인 — 위 2페이즈 실기기 확인과 같은 폰으로 한 번에
6. 디자인 구간을 해 본 결과로 gsd-addons 에 디자인 구간 스킬을 만든다(`docs/lifecycle.md` 구간 3 상태 갱신). 포트폴리오 명령 `/gsd-addons:portfolio`(선택)는 나중에
7. GSD 를 쓰며 불편했던 점은 gsd-addons 에서 고친다. 지금까지: 문서 분류 에이전트가 해시를 못 구해 결과 파일 이름 규칙을 어김, `ingest-docs` 는 `config.json` 을 만들지 않음, 한국어 페이즈 이름은 슬러그가 비어 `init.plan-phase` 가 폴더 경로를 못 냄, UI 게이트가 한국어 문구에서 프런트엔드 신호를 못 잡음, 엣지 프로브가 한국어 요구사항을 분류하지 못함, 첫 플랜 체커가 본문을 읽지 않고 통과로 판단함, `state.planned-phase` 가 만든 `.planning/state.json`·`milestone.lock` 이 커밋 대상에 없음, 실행자 디스패치 가드가 `branching_strategy: none` 인데도 워크트리를 요구함(`origin/HEAD` 가 있어야 병렬 실행이 됨), 계획기가 문서 적재량을 `@` 로 통째 실음, 배포 직후 몇 초는 옛 버전이 응답함(스모크 `--previous-version` 은 잠시 기다린 뒤), **verify-work 가 UAT 이슈를 '직접 수정'으로 닫는 경로가 없어 완료 판정이 막힘**(gap `resolved_by` 가 plan 이어야 함 — 이번엔 UAT 행을 pass 로 고치고 재검증으로 닫음)

## 환경 메모

- Mac: `~/personal/` 아래에서 git·gh 가 개인 계정(dhkim1522)으로 자동 전환된다.
- 개인 gh 로그인은 `gh auth login --hostname github.com --git-protocol ssh --insecure-storage` 로 했다. 토큰은 키체인이 아니라 `~/.config/gh-personal/hosts.yml` 에 둔다. 로그인 중 HTTPS 자격 증명 설정(전역 `~/.gitconfig` 변경)은 하지 않는다.
- 집 Windows: 이 저장소를 clone 한 뒤 저장소 안에서 `git config user.email dhkim1522@naver.com` 을 설정한다.
- Node.js 22.12 이상. 처음 받으면 `npm ci`(lock 기준).
- 개발 `npm run dev`(같은 Wi-Fi 폰은 표시되는 LAN 주소로 접속 — HTTP 라 [공유하기] 가 숨고 [링크 복사] 도 실패할 수 있음). 테스트 `npx vitest run`, 타입 검사 `npm run typecheck`(맨 앞에서 `tokens:check` 로 `src/styles/tokens.css` 가 `design/tokens.json` 과 같은지 확인). 배포 `npm run deploy` 후 `node scripts/smoke.mjs --prod --stage full`(옵션 `--players 4~8`, `--previous-version V`; 지금 배포본 버전은 `--print-version`).
- `worker-configuration.d.ts` 는 typecheck 가 만든다(커밋 안 함). `compatibility_date` 는 `2026-10-12` 로 고정(오늘 날짜로 두면 `vite dev` 가 실패). 토큰은 `design/tokens.json` 을 고치고 `npm run tokens`.
- Cloudflare: 개인 계정(이메일 인증 완료), workers.dev 하위 도메인 `dhplay`(계정 전체 공용, 바꾸면 모든 Worker 주소가 바뀜). **Worker 이름 `minifia` 를 바꾸면 주소가 바뀐다.** 배포 직전에는 `npx wrangler whoami` 로 개인 계정인지 확인한다.
- **집 Windows PC 에서 배포하려면 그 PC 에서 `npx wrangler login` 을 개인 Cloudflare 계정으로 한 번 해야 한다**.
- GSD·gsd-addons 설치 (PC 마다 한 번):
  - Mac: `CLAUDE_CONFIG_DIR=~/.claude-personal npx @opengsd/gsd-core@latest --claude --global` (설정 폴더를 꼭 명시한다)
  - gsd-addons: `~/personal/gsd-addons` 에 clone 한 뒤 `claude plugin marketplace add ~/personal/gsd-addons`, `claude plugin install gsd-addons@gsd-addons --scope user`. 고친 뒤에는 `claude plugin marketplace update gsd-addons`.
  - Windows: 같은 명령을 그 PC 의 개인 Claude 설정 폴더 기준으로 실행한다.

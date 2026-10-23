# 작업 인계

> 다른 PC나 다음 세션에서 바로 이어서 할 수 있도록 현재 상태와 다음 할 일을 적는다. 작업을 마칠 때마다 교체한다.

## 현재 상태

- **1페이즈(걷는 뼈대) 구현 완료, 검증 gaps_found — G-01-9 재진단 필요** (2026-10-23)
  - **갭 클로저 01-16·01-17 실행 결과**: 01-17(입력 글자 대비 G-01-1b) 완료, 테스트 41파일 635개·typecheck 통과, 눈 확인만 UAT 로 남음. **01-16(시트 진입 모션 G-01-9)은 실기기 확인 실패 → partial, 갭 열림.** iPhone Safari 녹화(`ScreenRecording_10-23-2026 19-45-10_1.MP4`, 사용자 로컬 파일) 결과: 시트는 아래에서 올라오지만 바닥보다 약 60px 위에 멈췄다가 약 0.2초 뒤 맨 아래로 내려앉는다. 원인 미확정, 1순위 가설은 `.mf-dialog` height:100% 와 `.mf-sheet` max-height:80dvh 의 뷰포트 단위 불일치(sheet.css 8·24행). 추측 수정 말고 원격 웹 인스펙터로 `visualViewport.height`·`innerHeight`·다이얼로그 `getBoundingClientRect()` 를 받아 확정한다. 상세는 `01-16-SUMMARY.md`·`01-UAT.md` post_fix_report
  - 열린 갭: G-01-9(위), G-01-1a 폰트·G-01-2 테이블 에셋·G-01-5 OG 이미지(디자인 세션·그림 에셋 필요, 어떤 plan 도 안 다룸), G-01-1b(눈 확인)
  - **배포본은 옛 버전(`59caa32`)**: 01-15·01-16·01-17 미배포. G-01-9·G-01-1b 확정 확인과 UAT 10번은 재배포 뒤에
  - 개발 서버(`npm run dev`)에서는 인물 그림이 깨져 보인다: 앱이 쓰는 `%40` 주소를 Vite dev 가 파일로 못 찾고 HTML 을 돌려준다(배포본은 정상 추정, 직접 확인은 안 함). 해결 방법(vite 미들웨어 / 파일 이름에서 @ 제거 / 보류)은 미정
  - (이하 이전 상태) 구현·배포 완료, 실기기 확인(UAT) 대기
  - 배포 주소: **https://minifia.dhplay.workers.dev** (Worker 이름 = 주소, 결정 0009). 배포본에서 `node scripts/smoke.mjs --prod --stage full` 5명·8명 한 판 통과(연결된 4명 시작 조건, 누출 없음, 낮 전환 편차 0.1초 안팎, 재접속, 시작 뒤 참가 거부, 그림 캐시·`/og.png`)
  - 만든 것: 새 첫 화면(미니피아·달 배경, 닉네임 + 방 만들기/코드 참가), 링크 참가 화면(앉은 사람 미리보기), 원근 테이블 대기실, 토스트, 공유 시트, 나가기·내보내기, 연결된 4명 이상이면 시작, 배정 3초 연출, 역할 카드 15초(5초 안에 안 누르면 자동 앞면, 다시 누르면 가림), 항상 있는 [내 역할] 시트(단계가 바뀌어도 열린 채), 낮 화면("낮이 되었습니다"), 재접속 띠와 30초 포기 화면
  - 방장이 나가면 연결된 사람 가운데 먼저 들어온 사람이 방장이 된다(결정 0012, 01-04 D-17 구체화)
  - 서버가 규칙을 정하고 남의 역할·토큰은 클라이언트로 보내지 않는다(결정 0002). 마피아에게만 동료 seat 가 간다
  - **CR-01(닉네임 비교 우회·IN-07) 갭 클로저 01-15 완료·검증 통과**(2026-10-23, 상태 gaps_found → human_needed). 비교 키가 ZWJ·변형 선택자·결합 문자·채움 문자를 무시하고 채움 문자·빈 키는 INVALID_CHARS. **배포본은 아직 옛 규칙(`59caa32`)이라 UAT 전에 `npm run deploy` 필요**
  - 테스트 40파일 617개 통과, `npm run typecheck`(맨 앞에서 `tokens:check`) 통과
  - 카카오톡 미리보기용 **임시** `public/og.png`(1200×630, `node scripts/make-og.mjs` 로 생성)와 OG 메타(`og:title` 미니피아, `og:image` 절대 주소, `og:url` 없음). 이미지를 못 가져오면 메신저는 제목·설명만 보여 준다. **카카오 캐시(약 1시간)는 카카오 공유 디버거로 초기화**한다. 정식 이름·주소가 정해지면 출시 마일스톤에서 이미지·주소를 바꾼다
  - 그림 캐시: `public/_headers` — 인물·배경 1일, `/assets/*` 불변, `/og.png` 1시간. 그림 파일 이름이 해시가 아니라 교체 때 최대 1일 늦게 바뀐다(급하면 파일 이름을 바꾼다)
  - 정적 에셋은 파일 이름의 `@` 주소를 307 로 돌린다(가정 A10 확인) — 앱은 `%40` 주소를 쓴다(`src/net/assets.ts`)
  - 상세는 `.planning/phases/01-walking-skeleton/` 의 각 SUMMARY
- **작업 방식·결정 요약**
  - 웹앱 먼저(0001), Cloudflare Durable Objects(0002), 정통 마피아 + 무거운 분위기 + 특색 캐릭터(0003), GSD Core + gsd-addons(0004), 비대면 게임·빠른 메시지·이모티콘(0005), 플레이어 몰입 우선(0006), 낮부터 시작·매 낮 직업 공개(0007), 2.5D(0008), Worker 이름·DO 선언·도구 버전 고정(0009), 디자인 먼저·산출물 두 종류(0010·0011), 시작은 연결된 4명 이상·카드 5초 자동·[내 역할] 시트·토스트(0012)
  - 결정 0009: **Worker 이름을 바꾸면 주소가 바뀌어 이미 보낸 링크가 깨진다.** DO 를 `exports` 로 선언해 `migrations` 로 되돌릴 수 없고, 클래스 `Room` 이름을 바꾸거나 지우면 방 데이터가 지워진다
  - GitHub 비공개 저장소: https://github.com/dhkim1522/minifia (SSH 원격, `main` 직접 커밋 — `git.allow_default_branch_commits: true`)
  - 사람용 산출물은 클로드 아티팩트, AI 용 지침은 저장소(`.planning/`, `docs/`, `design/`). GSD 에이전트는 아티팩트를 못 읽어 승인본을 `design/` 에 사본으로 둔다
  - 디자인 시스템: https://claude.ai/artifact/Tp175mmuxLAHycMUtwZJ9Q (이 세션에서만 고친다) · 화면설계서 v0.2 https://claude.ai/artifact/QtbQYhk7ezy4fV7H98bZJz · 화면 흐름 https://claude.ai/artifact/NzZBqoJD8ut16J2VUwpn64 · 캐릭터 에셋 https://claude.ai/artifact/4dYpe74vxJHSnA4WhFSLTM
  - 디자인 시스템 아티팩트에 아직 없는 것(R18): "방장" 배지, 내 역할 시트, 공유 시트, 토스트, 52px 재접속 띠. 코드에서 지역 상수로 둔 모션 길이 220·240·300·320ms 와 배정 링 1s 를 토큰으로 올릴지도 정한다
- **한 브라우저 프로필 = 한 사람**: 입장 정보가 localStorage 한 칸(`minifia:session`)이라 같은 프로필의 두 번째 탭으로 같은 방 링크를 열면 첫 탭의 자리를 이어받고, 첫 탭은 4001 로 "다른 창에서 이 방에 들어갔어요" 가 된다(버그가 아니라 한 칸 설계의 결과). 한 PC 로 여러 명을 시험하려면 서로 다른 브라우저(Chrome·Safari·Firefox·Edge)나 브라우저 프로필을 사람마다 하나씩 쓴다. 시크릿·개인 정보 보호 창은 같은 브라우저 안에서 저장소를 공유할 수 있으니 브라우저마다 한 사람으로만 센다
- **실기기에서 지켜볼 가정**(1페이즈 UAT 에서 확인): A1 시계 오프셋 정확도, A3 iOS 화면 잠금 복귀 좀비 소켓, A5 배포 중 소켓 끊김과 자동 재접속, A7 카카오톡 미리보기, A11 srcset 선택, A12 iOS `<dialog>` 포커스, A14 iOS 공유·복사 제스처, A15 360px 장면 크기, A17 30초 포기 기준, Open Question 7 좀비 connected 와 시작 조건

## 다음 할 일

0. **G-01-9 해결**(2026-10-23, `.mf-dialog overflow: clip`, e581bd8, 실기기 확인). **버그는 미루고 진행하기로 함**(2026-10-23, 사용자 결정). G-01-9 등 열린 갭은 `.planning/DEFERRED-BUGS.md` 에 모았다가 마지막에 한 번에 처리. 01-18(계측 도구)은 병합됐으나 실기기 측정은 안 했고 01-19 는 미실행. 다음은 아래 1·2번
1. `npm run deploy` 후 스모크(`node scripts/smoke.mjs --prod --stage full`, 낮 전환 편차 직전 467ms/한계 500ms 재확인) → `/gsd-verify-work 1` 로 실기기 UAT 10항목. WR-01~04(연결 계층)는 2페이즈 전에 고치는 것이 좋다
2. `/gsd-discuss-phase 2` — 2페이즈 낮 토론(직업 공개·빠른 메시지·이모티콘) 논의
3. 디자인 시스템 아티팩트 보정(R18, 위 목록) — 이 세션에서
4. 정식 OG 이미지를 클로드 데스크톱에서 만들어 `public/og.png` 교체(정식 출시 마일스톤, 임시 이미지는 `scripts/make-og.mjs`). 교체 뒤 카카오 공유 디버거로 캐시 초기화
5. 디자인 구간을 해 본 결과로 gsd-addons 에 디자인 구간 스킬을 만든다(`docs/lifecycle.md` 구간 3 상태 갱신). 페이즈가 끝날 때마다 `/gsd-extract-learnings`. 포트폴리오 명령 `/gsd-addons:portfolio`(선택 단계)는 나중에 만든다
6. GSD 를 쓰며 불편했던 점은 기록해 두고 gsd-addons 에서 고친다(구간별 표준 산출물은 반복 여부와 상관없이 의도적으로 만든다). 지금까지: 문서 분류 에이전트가 해시를 못 구해 결과 파일 이름 규칙을 어김, `ingest-docs` 는 `config.json` 을 만들지 않음, 한국어 페이즈 이름은 슬러그가 비어 `init.plan-phase` 가 페이즈 폴더 경로를 못 냄(영문 슬러그 폴더를 직접 만들어 해결), UI 게이트가 한국어 문구에서 프런트엔드 신호를 못 잡음, UI 상태 점검기가 한국어 요소를 `text_en` 없이는 분류 못 함, 엣지 프로브가 한국어 요구사항을 하나도 분류하지 못함(두 번 다 8개 모두 unclassified), 첫 플랜 체커가 계획 본문을 읽지 않고 통과로 판단함, `state.planned-phase` 가 `.planning/state.json` 을 새로 만들지만 커밋 대상에 없음, `.planning/milestone.lock` 도 미추적, `origin/HEAD` 가 없으면 워크트리 병렬 실행이 순차로 떨어지는데 디스패치 가드는 매번 워크트리를 요구함(`git remote set-head origin -a` 로 해결될 것으로 보임), 실행자 커밋 가드가 `branching_strategy: none` 인데도 `main` 을 막음, 두 번째 계획 검사기가 "계획마다 작업 4개"로 잘못 셈, 계획기가 문서 적재량(RESEARCH 118KB 등)을 `@` 로 통째 싣는 바람에 수정 때 줄임. 실행 단계 추가: 배포 직후 몇 초는 옛 버전이 응답할 수 있어 스모크의 `--previous-version` 검사는 배포 뒤 잠시 기다렸다 돌린다

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

# 작업 인계

> 다른 PC나 다음 세션에서 바로 이어서 할 수 있도록 현재 상태와 다음 할 일을 적는다. 작업을 마칠 때마다 교체한다.

## 현재 상태

- **1페이즈(걷는 뼈대) 완료·검증 통과**(2026-10-24, `01-VERIFICATION.md` passed, 19/19 plan, UAT 11/11). 다음은 2페이즈 "낮 토론".
  - 배포 주소: **https://minifia.dhplay.workers.dev** (Worker 이름 = 주소, 결정 0009). 최신 배포 `e92e932`. `node scripts/smoke.mjs --prod --stage full` 통과(검증 중 한 번 `POST /api/rooms 500` 이 났으나 재현 안 됨 — 또 나면 `wrangler tail`)
  - 이번 세션에서 한 것: G-01-9(`.mf-dialog overflow: clip`), 코드 리뷰 WR-01~06 수정, 개발 서버 `%40`(vite 플러그인), 결정 0013(Gowun Dodum·영문 **Minifia**·크림 대리석 테이블·OG 재생성)·0014(첫 화면은 버튼과 코드 칸만, 닉네임은 시트에서), 닉네임 시트 키패드 대응, 제목 굵게, 첫 화면 버전 글자 숨김
  - 서버가 규칙을 정하고 남의 역할·토큰은 클라이언트로 보내지 않는다(결정 0002). 마피아에게만 동료 seat 가 간다
  - 그림·폰트 시안도 이 세션의 Design 캔버스에서 만들 수 있다(결정 0013). 시안 캔버스: https://claude.ai/artifact/QmHcG4zcPswojK2YfS5ik3 (폰트·테이블·OG·첫 화면). 새로 그려야 하는 일러스트(인물·직업)만 클로드 데스크톱
  - 주 버튼은 밝은 회색(`--gray-100`)이다. 진홍은 처형·탈락 발표에만 쓴다
  - 열린 항목(`.planning/DEFERRED-BUGS.md`): WR-01~04 는 폰 확인 전(테스트로만 확인), 코드 리뷰 IN-01~09(INFO), 8명 360×640 레이아웃을 새 폰트로 다시 확인, Google Fonts 를 출시 때 자체 호스팅할지, 시계 오프셋을 실기기 여러 대로 확인, 침묵 단절 띠가 약 10초 뒤 뜸, SECURITY.md·VALIDATION.md 미작성(`/gsd-secure-phase 1`, `/gsd-validate-phase 1`)
  - **디자인 문서 동기화가 남음**: 디자인 시스템 아티팩트는 토큰·테이블 규칙까지만 맞췄다(Version 12). 아직 없는 것(R18): "방장" 배지, 내 역할 시트, 공유 시트, 닉네임 시트, 토스트, 52px 재접속 띠, 모션 길이 토큰. 화면설계서 S-01(결정 0014)·화면 흐름·`design/screens/` PNG 도 새 첫 화면·폰트·테이블로 갱신 필요
  - 한 브라우저 프로필 = 한 사람(입장 정보 localStorage 한 칸). 한 PC 로 여러 명을 시험하려면 서로 다른 브라우저를 쓴다
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

1. `/gsd-discuss-phase 2` — 2페이즈 낮 토론(직업 공개·빠른 메시지·이모티콘) 논의. 각 페이즈는 몰입·이펙트·액션을 기본형으로 함께 만든다(결정 0006)
2. 디자인 문서 동기화(위 R18 + 결정 0013·0014): 디자인 시스템 아티팩트(이 세션에서만 고친다), 화면설계서, 화면 흐름, `design/screens/` PNG. 2페이즈 화면을 설계할 때 같이 하는 것이 효율적
3. 폰으로 WR-01~04 확인(연결 끊김·재접속·역할 카드), 새 폰트에서 8명 360×640 확인
4. `/gsd-secure-phase 1`, `/gsd-validate-phase 1`, `/gsd-extract-learnings 1`(페이즈가 끝날 때마다)
5. 디자인 구간을 해 본 결과로 gsd-addons 에 디자인 구간 스킬을 만든다(`docs/lifecycle.md` 구간 3 상태 갱신). 포트폴리오 명령 `/gsd-addons:portfolio`(선택)는 나중에
6. GSD 를 쓰며 불편했던 점은 gsd-addons 에서 고친다. 지금까지: 문서 분류 에이전트가 해시를 못 구해 결과 파일 이름 규칙을 어김, `ingest-docs` 는 `config.json` 을 만들지 않음, 한국어 페이즈 이름은 슬러그가 비어 `init.plan-phase` 가 폴더 경로를 못 냄, UI 게이트가 한국어 문구에서 프런트엔드 신호를 못 잡음, 엣지 프로브가 한국어 요구사항을 분류하지 못함, 첫 플랜 체커가 본문을 읽지 않고 통과로 판단함, `state.planned-phase` 가 만든 `.planning/state.json`·`milestone.lock` 이 커밋 대상에 없음, 실행자 디스패치 가드가 `branching_strategy: none` 인데도 워크트리를 요구함(`origin/HEAD` 가 있어야 병렬 실행이 됨), 계획기가 문서 적재량을 `@` 로 통째 실음, 배포 직후 몇 초는 옛 버전이 응답함(스모크 `--previous-version` 은 잠시 기다린 뒤), **verify-work 가 UAT 이슈를 '직접 수정'으로 닫는 경로가 없어 완료 판정이 막힘**(gap `resolved_by` 가 plan 이어야 함 — 이번엔 UAT 행을 pass 로 고치고 재검증으로 닫음)

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

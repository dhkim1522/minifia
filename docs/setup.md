# 환경 설정 메모

> 새 PC를 쓰거나 다시 설치할 때만 읽는다(세션 시작 때 읽는 파일이 아니다). 예전 HANDOFF.md 의 "환경 메모"를 옮겼다.

- Mac: `~/personal/` 아래에서 git·gh 가 개인 계정(dhkim1522)으로 자동 전환된다.
- 개인 gh 로그인은 `gh auth login --hostname github.com --git-protocol ssh --insecure-storage` 로 했다. 토큰은 키체인이 아니라 `~/.config/gh-personal/hosts.yml` 에 둔다. 로그인 중 HTTPS 자격 증명 설정(전역 `~/.gitconfig` 변경)은 하지 않는다.
- 집 Windows: 이 저장소를 clone 한 뒤 저장소 안에서 `git config user.email dhkim1522@naver.com` 을 설정한다.
- Node.js 22.12 이상. 처음 받으면 `npm ci`(lock 기준).
- 배경 그림 원본(`design/backgrounds/v5/` 게임 구도, `v3/` 입구)이 바뀌면 `npm run backdrops` 로 `public/backgrounds/*.webp` 7개를 다시 만든다(`scripts/make-backdrops.mjs`, 용량 예산 초과면 실패, 결정적 출력).
- 개발 `npm run dev`(같은 Wi-Fi 폰은 표시되는 LAN 주소로 접속 — HTTP 라 [공유하기] 가 숨고 [링크 복사] 도 실패할 수 있음). 테스트 `npx vitest run`, 타입 검사 `npm run typecheck`(맨 앞에서 `tokens:check` 로 `src/styles/tokens.css` 가 `design/tokens.json` 과 같은지 확인). 배포 `npm run deploy` 후 `node scripts/smoke.mjs --prod --stage full`(옵션 `--players 4~8`, `--previous-version V`; 지금 배포본 버전은 `--print-version`; full 한 판은 밤·아침까지 약 3분). 봇 시나리오 `node scripts/uat-night.mjs --prod`, `node scripts/uat-day.mjs --prod`. 화면 E2E `npm run e2e`(흐름 여섯 lobby·police5·citizen4·mafia8·doctor5·spec4, Chrome 경로는 `CHROME_PATH`, 결정 0025).
- `worker-configuration.d.ts` 는 typecheck 가 만든다(커밋 안 함). `compatibility_date` 는 `2026-10-12` 로 고정(오늘 날짜로 두면 `vite dev` 가 실패). 토큰은 `design/tokens.json` 을 고치고 `npm run tokens`.
- Cloudflare: 개인 계정(이메일 인증 완료), workers.dev 하위 도메인 `dhplay`(계정 전체 공용, 바꾸면 모든 Worker 주소가 바뀜). **Worker 이름 `minifia` 를 바꾸면 주소가 바뀐다.** `npm run deploy` 가 배포 전에 `scripts/check-account.mjs` 로 개인 계정(`wrangler whoami`)인지 확인하고, 아니면 멈춘다(결정 0042). 버전 미리보기 주소는 꺼져 있다(`preview_urls: false`).
- **집 Windows PC 에서 배포하려면 그 PC 에서 `npx wrangler login` 을 개인 Cloudflare 계정으로 한 번 해야 한다**.
- GSD·gsd-addons 설치 (PC 마다 한 번):
  - Mac: `CLAUDE_CONFIG_DIR=~/.claude-personal npx @opengsd/gsd-core@latest --claude --global` (설정 폴더를 꼭 명시한다)
  - gsd-addons: `~/personal/gsd-addons` 에 clone 한 뒤 `claude plugin marketplace add ~/personal/gsd-addons`, `claude plugin install gsd-addons@gsd-addons --scope user`. 고친 뒤에는 `claude plugin marketplace update gsd-addons`.
  - Windows: 같은 명령을 그 PC 의 개인 Claude 설정 폴더 기준으로 실행한다.

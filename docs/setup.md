# 환경 설정 메모

> 새 PC를 쓰거나 다시 설치할 때만 읽는다(세션 시작 때 읽는 파일이 아니다). 예전 HANDOFF.md 의 "환경 메모"를 옮겼다.

- Mac: `~/personal/` 아래에서 git·gh 가 개인 계정(dhkim1522)으로 자동 전환된다.
- 개인 gh 로그인은 `gh auth login --hostname github.com --git-protocol ssh --insecure-storage` 로 했다. 토큰은 키체인이 아니라 `~/.config/gh-personal/hosts.yml` 에 둔다. 로그인 중 HTTPS 자격 증명 설정(전역 `~/.gitconfig` 변경)은 하지 않는다.
- 집 Windows: 이 저장소를 clone 한 뒤 저장소 안에서 `git config user.email dhkim1522@naver.com` 을 설정한다.
- Node.js 22.12 이상. 처음 받으면 `npm ci`(lock 기준).
- 배경 그림 원본(`design/backgrounds/v5/` 게임 구도, `v3/` 입구)이 바뀌면 `npm run backdrops` 로 `public/backgrounds/*.webp` 7개를 다시 만든다(`scripts/make-backdrops.mjs`, 용량 예산 초과면 실패, 결정적 출력).
- 개발 `npm run dev`(같은 Wi-Fi 폰은 표시되는 LAN 주소로 접속 — HTTP 라 [공유하기] 가 숨고 [링크 복사] 도 실패할 수 있음). 테스트 `npx vitest run`, 타입 검사 `npm run typecheck`(맨 앞에서 `tokens:check` 로 `src/styles/tokens.css` 가 `design/tokens.json` 과 같은지 확인). 배포 `npm run deploy` 후 `node scripts/smoke.mjs --prod --stage full`(옵션 `--players 4~8`, `--previous-version V`; 지금 배포본 버전은 `--print-version`; full 한 판은 밤·아침까지 약 3분). 테스트 방 시나리오 `node scripts/uat-test-room.mjs --prod`. 화면 E2E `npm run e2e`(흐름 여섯 lobby·police5·citizen4·mafia8·doctor5·spec4, Chrome 경로는 `CHROME_PATH`, 결정 0025).
- `worker-configuration.d.ts` 는 typecheck 가 만든다(커밋 안 함). `compatibility_date` 는 `2026-10-12` 로 고정(오늘 날짜로 두면 `vite dev` 가 실패). 토큰은 `design/tokens.json` 을 고치고 `npm run tokens`.
- Cloudflare: 개인 계정(이메일 인증 완료), workers.dev 하위 도메인 `dhplay`(계정 전체 공용, 바꾸면 모든 Worker 주소가 바뀜). **Worker 이름을 바꾸면 주소가 바뀐다.** v3 브랜치는 `minifia-v3`, v2 브랜치는 `minifia-v2`(비교용으로 남김), v1 브랜치는 `minifia` 로만 배포하고, 이름은 `scripts/deploy-target.mjs` 한 곳이 정한다(v1.0 은 v1 브랜치에서만 배포). `npm run deploy` 가 배포 전에 `scripts/check-account.mjs` 로 개인 계정(`wrangler whoami`)인지, 빌드 뒤 `scripts/check-deploy-target.mjs` 로 배포 대상이 `WORKER_NAME`(v3 브랜치는 `minifia-v3`) 인지 확인하고, 아니면 멈춘다(결정 0042·0043). 버전 미리보기 주소는 꺼져 있다(`preview_urls: false`).
- **집 Windows PC 에서 배포하려면 그 PC 에서 `npx wrangler login` 을 개인 Cloudflare 계정으로 한 번 해야 한다**.
- GSD·gsd-addons 설치 (PC 마다 한 번):
  - Mac: `CLAUDE_CONFIG_DIR=~/.claude-personal npx @opengsd/gsd-core@latest --claude --global` (설정 폴더를 꼭 명시한다)
  - gsd-addons: `~/personal/gsd-addons` 에 clone 한 뒤 `claude plugin marketplace add ~/personal/gsd-addons`, `claude plugin install gsd-addons@gsd-addons --scope user`. 고친 뒤에는 `claude plugin marketplace update gsd-addons`.
  - Windows: 같은 명령을 그 PC 의 개인 Claude 설정 폴더 기준으로 실행한다.

## Codex에서 GSD 사용

이 저장소의 `AGENTS.md`가 Codex 진입점이다. Claude Code는 `CLAUDE.md`와 `.claude/`를 사용한다. 두 환경은 `.planning/`, `HANDOFF.md`, `docs/`, `design/`를 공유한다.

새 PC나 새 체크아웃에서 저장소 루트에 **GSD Core 1.20.1**을 설치한다. 기존 Claude 설치와 같은 버전이다. `GSD_HOME`을 설치 명령에만 지정해 GSD 설치기가 만드는 기본값을 임시 디렉터리에 둔다. 설치 결과인 `.codex/`는 PC마다 생성된다.

Mac 또는 Linux

```sh
GSD_HOME="$(mktemp -d)" npx --yes @opengsd/gsd-core@1.20.1 --codex --local --relative-includes --no-legacy-cleanup
```

Windows PowerShell

```powershell
$minifiaGsdHome = [System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), "minifia-gsd-" + [guid]::NewGuid().ToString())
$minifiaPreviousGsdHome = $env:GSD_HOME
try {
    $env:GSD_HOME = $minifiaGsdHome
    npx.cmd --yes '@opengsd/gsd-core@1.20.1' --codex --local --relative-includes --no-legacy-cleanup
} finally {
    $env:GSD_HOME = $minifiaPreviousGsdHome
}
```

설치한 뒤 프로젝트에서 Codex의 새 채팅을 열고 `$gsd-progress`를 실행한다. CLI에서 페이즈별 계획을 읽기만 하려면 `node .codex/gsd-core/bin/gsd-tools.cjs query init.execute-phase 24`를 실행한다(숫자는 대상 페이즈).

- 두 환경의 GSD 디자인·계획·실행 에이전트는 `.planning/config.json`의 `agent_skills`를 통해 같은 [미니피아 디자인 참고 자료 스킬](../.agents/skills/minifia-design-refs/SKILL.md)을 읽는다. 이 스킬은 Claude 플러그인의 디자인 참고 규칙을 저장소 안에서 쓸 수 있게 옮긴 것이다.
- Codex에서는 기존 계획의 `@~/.claude-personal/gsd-core/` 참조를 로컬 `.codex/gsd-core/`의 대응 파일로 읽는다. UI 작업은 `design/`에 저장된 승인본을 기준으로 한다. Claude Design 아티팩트 편집은 Claude에서 이어간다.
- GSD의 Codex 설치기는 세션 시작 업데이트 확인 훅을 제공한다. Claude의 상태줄과 컨텍스트 사용량 경고는 Claude에서 제공된다.

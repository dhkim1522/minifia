# 작업 인계

> 다른 PC나 다음 세션에서 바로 이어서 할 수 있도록 현재 상태와 다음 할 일을 적는다. 작업을 마칠 때마다 교체한다.

## 현재 상태

- **기획 초안 단계** (2026-10-21)
  - 정한 것: 코드명 미니피아, 각자 폰으로 방 참가, 웹앱 먼저(결정 0001), Cloudflare Durable Objects(결정 0002), 정통 마피아 진행 + 무거운 분위기 + 특색 있는 캐릭터(결정 0003)
  - MVP 규칙 초안: `docs/product.md` (4~8명, 마피아·경찰·의사·시민, 최후 변론·찬반 투표 포함, 한 판 약 6~10분, 내레이션 없이 배경음·효과음)
  - 코드는 아직 없음
  - 개발 진행은 GSD Core + gsd-addons 로 하기로 함 (결정 0004). 개인 설정에 GSD 1.18.0 과 gsd-addons 0.1.0 설치 완료, `CLAUDE.md` 에 gsd-addons 원칙 구역 적용
  - GitHub 비공개 저장소: https://github.com/dhkim1522/minifia (SSH 원격, `main` 추적)

## 다음 할 일

1. **Claude Code 재시작** (GSD 훅·상태 표시줄과 gsd-addons 스킬을 불러오기 위해).
2. **GSD 프로젝트 시작.** 기존 기획 문서를 넘긴다: `/gsd-ingest-docs` 또는 `/gsd-new-project --auto @docs/product.md`. 리서치는 켠다(Durable Objects·실시간 통신). MVP 는 핵심 흐름만, 1페이즈 성공 기준에 Cloudflare 배포와 폰 여러 대 접속을 넣는다.
3. `/gsd-addons:setup` 다시 실행해 `.planning/config.json` 에 한국어 응답·TDD 모드·디자인 참고 자료 규칙을 적용한다.
4. `/gsd-mvp-phase 1` 로 걷는 뼈대(방 만들기·참가·역할 배정·배포)부터 진행한다. 이후 `/gsd-next` 가 다음 단계를 안내한다.
5. 디자인이 걸린 페이즈에서 참고 이미지가 있으면 경로를 적어 준다 (고정 폴더 없음, 결정 0004). 없으면 GSD 가 자체 판단으로 진행한다.
6. GSD 를 쓰며 불편했던 점은 기록해 두고, 반복되는 것만 gsd-addons 에 추가한다.

## 환경 메모

- Mac: `~/personal/` 아래에서 git·gh 가 개인 계정(dhkim1522)으로 자동 전환된다.
- 개인 gh 로그인은 `gh auth login --hostname github.com --git-protocol ssh --insecure-storage` 로 했다. 토큰은 키체인이 아니라 `~/.config/gh-personal/hosts.yml` 에 둔다. 로그인 중 HTTPS 자격 증명 설정(전역 `~/.gitconfig` 변경)은 하지 않는다.
- 집 Windows: 이 저장소를 clone 한 뒤 저장소 안에서 `git config user.email dhkim1522@naver.com` 을 설정한다.
- 페이즈 1 전에 필요한 것: Node.js LTS, Cloudflare 계정, `wrangler` 로그인.
- GSD·gsd-addons 설치 (PC 마다 한 번):
  - Mac: `CLAUDE_CONFIG_DIR=~/.claude-personal npx @opengsd/gsd-core@latest --claude --global` (설정 폴더를 꼭 명시한다)
  - gsd-addons: `~/personal/gsd-addons` 에 clone 한 뒤 `claude plugin marketplace add ~/personal/gsd-addons`, `claude plugin install gsd-addons@gsd-addons --scope user`. 고친 뒤에는 `claude plugin marketplace update gsd-addons`.
  - Windows: 같은 명령을 그 PC 의 개인 Claude 설정 폴더 기준으로 실행한다.

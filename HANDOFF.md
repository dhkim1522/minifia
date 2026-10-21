# 작업 인계

> 다른 PC나 다음 세션에서 바로 이어서 할 수 있도록 현재 상태와 다음 할 일을 적는다. 작업을 마칠 때마다 교체한다.

## 현재 상태

- **기획 초안 단계** (2026-10-21)
  - 정한 것: 코드명 미니피아, 각자 폰으로 방 참가, 웹앱 먼저(결정 0001), Cloudflare Durable Objects(결정 0002), 정통 마피아 진행 + 무거운 분위기 + 특색 있는 캐릭터(결정 0003)
  - MVP 규칙 초안: `docs/product.md` (4~8명, 마피아·경찰·의사·시민, 최후 변론·찬반 투표 포함, 한 판 약 6~10분, 내레이션 없이 배경음·효과음)
  - 코드는 아직 없음
  - **비대면 게임으로 전환** (결정 0005): 앱 안 소통은 빠른 메시지·이모티콘, 자유 채팅은 플레이테스트 후. 세로 폰 폭 화면, 링크 공유 참가
  - GSD 프로젝트 생성 완료 (`.planning/`): v1.0 MVP 6페이즈 — 1 걷는 뼈대, 2 밤과 아침, 3 낮 토론(빠른 메시지·이모티콘), 4 처형과 승패, 5 분위기와 캐릭터, 6 친구 플레이테스트. 페이즈 = 게임 흐름 한 구간을 서버 규칙·화면·소통까지 완성. 요구사항 35개
  - 개발 진행은 GSD Core + gsd-addons 로 하기로 함 (결정 0004). 개인 설정에 GSD 1.18.0 과 gsd-addons 0.1.0 설치 완료, `CLAUDE.md` 에 gsd-addons 원칙 구역 적용
  - **1페이즈 MVP 모드 지정** (`/gsd-mvp-phase 1`): Goal 을 사용자 스토리로 바꾸고 `**Mode:** mvp` 추가. SPIDR 분할 신호 없음
  - **결정 0006 플레이어 몰입 원칙**: 모든 기획은 참여 플레이어 몰입 기준, 각 페이즈가 자기 구간의 이펙트·액션 기본형을 만든다. 시작 후 "직업을 배정하고 있습니다…" 구간(약 3초) 추가. 방장 역할 구성 조정은 v2 ROLEX-01
  - 페이즈 폴더 `.planning/phases/01-walking-skeleton/` (비어 있음, git 미추적) — 한국어 페이즈 이름은 GSD 슬러그가 비어 폴더를 못 만들어 영문 슬러그로 직접 만듦
  - GitHub 비공개 저장소: https://github.com/dhkim1522/minifia (SSH 원격, `main` 추적)

## 다음 할 일

1. `/clear` 후 `/gsd-discuss-phase 1` 로 1페이즈 논의: 대기실 모습, 참가자 등장 액션, 배정 대기 연출, 카운트다운 강조, 이펙트 수준, 이탈 플레이어 처리 정책(CONN-02 제안 확정), 패키지·버전.
2. 이어서 `/gsd-plan-phase 1` (MVP 모드·걷는 뼈대 자동 감지, 리서치부터).
3. 디자인이 걸린 페이즈에서 참고 이미지가 있으면 경로를 적어 준다. 없으면 GSD 가 자체 판단으로 진행한다.
4. GSD 를 쓰며 불편했던 점은 기록해 두고, 반복되는 것만 gsd-addons 에 추가한다. 지금까지: 문서 분류 에이전트가 해시를 못 구해 결과 파일 이름 규칙을 어김(수동 수정), `ingest-docs` 는 `config.json` 을 만들지 않음, 한국어 페이즈 이름은 슬러그가 비어 `init.plan-phase` 가 페이즈 폴더 경로를 못 냄(영문 슬러그 폴더를 직접 만들어 해결), UI 게이트가 한국어 문구에서 프런트엔드 신호를 못 잡음.

## 환경 메모

- Mac: `~/personal/` 아래에서 git·gh 가 개인 계정(dhkim1522)으로 자동 전환된다.
- 개인 gh 로그인은 `gh auth login --hostname github.com --git-protocol ssh --insecure-storage` 로 했다. 토큰은 키체인이 아니라 `~/.config/gh-personal/hosts.yml` 에 둔다. 로그인 중 HTTPS 자격 증명 설정(전역 `~/.gitconfig` 변경)은 하지 않는다.
- 집 Windows: 이 저장소를 clone 한 뒤 저장소 안에서 `git config user.email dhkim1522@naver.com` 을 설정한다.
- 페이즈 1 전에 필요한 것: Node.js LTS, Cloudflare 계정, `wrangler` 로그인.
- GSD·gsd-addons 설치 (PC 마다 한 번):
  - Mac: `CLAUDE_CONFIG_DIR=~/.claude-personal npx @opengsd/gsd-core@latest --claude --global` (설정 폴더를 꼭 명시한다)
  - gsd-addons: `~/personal/gsd-addons` 에 clone 한 뒤 `claude plugin marketplace add ~/personal/gsd-addons`, `claude plugin install gsd-addons@gsd-addons --scope user`. 고친 뒤에는 `claude plugin marketplace update gsd-addons`.
  - Windows: 같은 명령을 그 PC 의 개인 Claude 설정 폴더 기준으로 실행한다.

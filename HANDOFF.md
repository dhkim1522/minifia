# 작업 인계

> 다른 PC나 다음 세션에서 바로 이어서 할 수 있도록 현재 상태와 다음 할 일을 적는다. 작업을 마칠 때마다 교체한다.

## 현재 상태

- **기획 초안 단계** (2026-10-21)
  - 정한 것: 코드명 미니피아, 각자 폰으로 방 참가, 웹앱 먼저(결정 0001), Cloudflare Durable Objects(결정 0002), 정통 마피아 진행 + 무거운 분위기 + 특색 있는 캐릭터(결정 0003)
  - MVP 규칙 초안: `docs/product.md` (4~8명, 마피아·경찰·의사·시민, 최후 변론·찬반 투표 포함, 한 판 약 6~10분, 내레이션 없이 배경음·효과음)
  - 코드는 아직 없음
  - GitHub 비공개 저장소: https://github.com/dhkim1522/minifia (SSH 원격, `main` 추적)

## 다음 할 일

1. **컨셉아트 시안.** 사용자가 고른 컨셉아트를 `design/references/` 에 넣거나 대화에 붙여넣으면, 분위기·색·캐릭터 특징을 정리하고 HTML 화면 시안(대기실, 역할 확인, 밤, 투표, 최후 변론, 결과)을 만든다. 캐릭터는 SVG 수준의 단순한 그림으로 그린다.
2. `docs/product.md` 미결정 항목 정리 (소리를 낼 폰, 캐릭터 설정).
3. 화면 목록과 흐름(`docs/screens.md`) 작성, 로드맵(`docs/roadmap.md`) 작성.
4. 페이즈 1: 웹·Worker 프로젝트 생성, 방 만들기·참가·역할 배정까지.

## 환경 메모

- Mac: `~/personal/` 아래에서 git·gh 가 개인 계정(dhkim1522)으로 자동 전환된다.
- 개인 gh 로그인은 `gh auth login --hostname github.com --git-protocol ssh --insecure-storage` 로 했다. 토큰은 키체인이 아니라 `~/.config/gh-personal/hosts.yml` 에 둔다. 로그인 중 HTTPS 자격 증명 설정(전역 `~/.gitconfig` 변경)은 하지 않는다.
- 집 Windows: 이 저장소를 clone 한 뒤 저장소 안에서 `git config user.email dhkim1522@naver.com` 을 설정한다.
- 페이즈 1 전에 필요한 것: Node.js LTS, Cloudflare 계정, `wrangler` 로그인.

# 작업 인계

> 다른 PC나 다음 세션에서 바로 이어서 할 수 있도록 현재 상태와 다음 할 일을 적는다. 작업을 마칠 때마다 교체한다.

## 현재 상태

- **기획 초안 단계** (2026-10-21)
  - 정한 것: 코드명 미니피아, 각자 폰으로 방 참가, 웹앱 먼저(결정 0001), Cloudflare Durable Objects(결정 0002), 정통 마피아 진행 + 무거운 분위기 + 특색 있는 캐릭터(결정 0003)
  - MVP 규칙 초안: `docs/product.md` (4~8명, 마피아·경찰·의사·시민, 최후 변론·찬반 투표 포함, 한 판 약 6~10분, 내레이션 없이 배경음·효과음)
  - 코드는 아직 없음

## 다음 할 일

1. 사용자가 `design/references/` 에 참고 이미지와 `notes.md` 메모를 채운다.
2. `docs/product.md` 미결정 항목 정리 (소리를 낼 폰, 캐릭터 설정).
3. 화면 목록과 흐름(`docs/screens.md`) 작성, 로드맵(`docs/roadmap.md`) 작성.
4. 페이즈 1: 웹·Worker 프로젝트 생성, 방 만들기·참가·역할 배정까지.

## 환경 메모

- Mac: `~/personal/` 아래에서 git·gh 가 개인 계정(dhkim1522)으로 자동 전환된다.
- 집 Windows: 이 저장소를 clone 한 뒤 저장소 안에서 `git config user.email dhkim1522@naver.com` 을 설정한다.
- 페이즈 1 전에 필요한 것: Node.js LTS, Cloudflare 계정, `wrangler` 로그인.

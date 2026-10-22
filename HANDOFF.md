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
  - **1페이즈 논의 완료** (`.planning/phases/01-walking-skeleton/01-CONTEXT.md`): 첫 화면(닉네임 + 방 만들기/코드 참가), 링크 참가 화면, 닉네임 1~8자 중복 금지, 둥근 테이블 대기실(자리 고정, 내 자리 맨 아래), 배정 3초 맥박 연출, 눌러서 뒤집는 역할 카드, 공통 타이머(마지막 5초 진홍), 끊긴 사람 흐릿하게, 방장 나가기 시 다음 사람에게, 항상 있는 [내 역할] 버튼, 색은 밤 남색 + 회색 + 진홍, 임시 정장 실루엣
  - **결정 0007**: 역할 확인 다음은 낮부터, 매 낮 시작에 직업 공개 단계(말 안 함 가능, 말 바꿈 표시, 새 요구사항 DAY-02, 요구사항 36개). 로드맵 2 낮 토론 ↔ 3 밤과 아침 교체. 1페이즈는 "낮이 되었습니다" 화면에서 멈춤
  - CONN-02 확정(서버 타이머 진행, 기권·행동 없음·말 안 함)
  - **결정 0008**: 실시간 3D 없이 2.5D. 원근 타원 테이블, 그림자·조명 레이어. 5페이즈에서 프레임 PNG 캐릭터(일러스트 vs 3D 렌더링, 에셋 도구 조사)
  - 디자인 참고 이미지 7장: `design/references/character/` (메모는 `design/references/notes.md`)
  - **1페이즈 계획 완료** (2026-10-21, `/gsd-plan-phase 1`): 리서치(`01-RESEARCH.md`), 검증 전략(`01-VALIDATION.md`), 계획 10개·6웨이브(`01-01`~`01-10-PLAN.md`), `SKELETON.md`. 플랜 체커 통과(2회차), 요구사항 8/8·결정 25/25 반영
    - 스택(리서치에서 버전 확인): React 19 + Vite 8 + `@cloudflare/vite-plugin`, Worker + Room Durable Object(WebSocket Hibernation, 알람 하나로 단계 마감·방 만료), zod, vitest 4 + `@cloudflare/vitest-plugin`(옛 이름 `vitest-pool-workers` 는 폐기됨)
    - 주의: `compatibility_date` 는 `2026-10-12` 로 고정(오늘 날짜로 두면 `vite dev` 가 실패)
    - 실행 중 사람이 할 일: 01-01 에서 Worker 이름(공개 주소가 됨)·DO 선언 방식(되돌릴 수 없음) 결정과 패키지 확인, 01-02 에서 개인 Cloudflare 계정으로 `npx wrangler login`·workers.dev 하위 도메인 설정, 01-10 에서 폰 2대 이상 실기기 확인
- **1페이즈 실행 중 — 웨이브 2까지 완료, 3/10 계획** (2026-10-22, `/gsd-execute-phase 1`)
  - 01-01 도구 세트·저장소 골격: Worker 이름 `minifia` + `exports` DO 선언(결정 0009), 리서치 버전 그대로 고정 설치
  - 01-02 방 만들기 트레이서와 **첫 배포: https://minifia.dhplay.workers.dev** (배포 주소 스모크 통과). 폰 실기기 확인은 검증 단계로 넘김
  - 01-03 순수 함수 5묶음(닉네임, 역할 배정, 자리 배치, 시계 오프셋, 공유)
  - 테스트 16파일 123개 통과
  - 화면 설계를 먼저 하려고 웨이브 3 전에 멈췄다. 1페이즈는 `/gsd-ui-phase` 를 거치지 않아 UI-SPEC.md 가 없었다
  - `main` 직접 커밋을 허용하도록 `git.allow_default_branch_commits: true` 설정(실행자 가드가 `main` 을 보호 브랜치로 막아 페이즈 브랜치를 만들었던 것을 합침)
- **1페이즈 화면 설계서 승인** (2026-10-22, `/gsd-ui-phase 1`): `.planning/phases/01-walking-skeleton/01-UI-SPEC.md`
  - shadcn 없이 일반 CSS + `tokens.css` 변수(새 패키지 설치 없음 원칙 유지). 간격 4/8/16/24/32/48/64, 글자 14/16/24/36 · 굵기 400/700, 남색 60 · 회색 30 · 진홍 10(진홍은 5곳만, 버튼·포커스 링·방장 배지에 쓰지 않음)
  - 참고 이미지 7장 반영(남색·달빛·진홍 포인트·이중 테두리 카드). 금테·따뜻한 불빛·보라 네온은 뺌
  - UI 체커 1회차 통과(7개 중 5 PASS, 2 FLAG 비차단: 확인 시트 [취소] 문구, 화면별 시선 중심 한 줄)
  - 상태 점검 75개 항목 처리(확정 63, 실기기 확인 6, 제외 6). 미정 1: 재연결이 오래 실패할 때 처리(계획은 "배너 유지하며 계속 재시도" 가정)
  - 사용자 결정: 카카오톡 미리보기 임시 이미지 넣기(`public/og.png` 1200×630, `og:image` 절대 주소) → M15
  - **계획과 계약서의 불일치 M1~M15** 를 아직 실행 안 한 계획(01-04~01-10)에 반영해야 한다. 큰 것: 글자 크기·굵기 정리(M1), 기존 `screens.css` 의 진홍 버튼·포커스 링 제거(M2, 두 계획의 `files_modified` 에 없음), `tokens.css` 보강 작업 추가(M3), 이름표를 크기 변환 바깥에(M6), 동료 표시를 어둡게 막 위층에(M7), ReconnectBanner 추가(M9), OG 이미지(M15)

- **작업 방식 확정 — 결정 0010 디자인 먼저** (2026-10-22)
  - 사용자 목적: 실무 제품개발 순서로 진행하며 구간별 산출물을 남기고, 그 흐름을 gsd-addons 스킬셋으로 번들화하고, 마지막에 포트폴리오로 짧게 정리한다(엔드투엔드 경험 + 대표 산출물 + 주요 문제·해결 몇 개)
  - 사람용 산출물은 클로드 아티팩트(Design System, Design 캔버스, 마지막에 Slides·Docs), AI 용 지침은 저장소. GSD 에이전트는 아티팩트를 못 읽어 승인 때 `design/` 에 사본(`tokens.json`, 화면 PNG)
  - 내보내기는 마지막 한 번(구간 끝에는 아티팩트 버전 이름표만). 구간 발표 자료·문제 해결 기록·PR 은 만들지 않음
  - gsd-addons 0.2.0: `docs/lifecycle.md`(구간별 산출물 지도), 원칙 3개 추가(산출물 두 종류, 디자인 먼저, 화면 페이즈 UI-SPEC 먼저). minifia `CLAUDE.md` 원칙 구역에도 반영
- **디자인 시스템 아티팩트** (2026-10-22): https://claude.ai/artifact/Tp175mmuxLAHycMUtwZJ9Q — 버전 4 "디자인 시스템 초안 2.1 — 테이블도 배경 위"
  - 토큰(색 46), 컴포넌트 20종(실제 동작 미리보기), 브랜드 문서(한국어), 표지. 소스는 세션 임시 폴더에 있었으므로 고칠 때는 아티팩트를 `read` 로 받아서 고친다
  - 사용자 피드백 "단색 배경만 있고 캐릭터가 밋밋하다" → 배경 장면 `Backdrop`(달빛 마을 광장 4종: lobby·night·day·verdict) 추가, 테이블 `bare`·두께 띠, 표지 교체. 진홍 예약 7곳, 반응은 SVG 8종
  - 캐릭터: 지금은 임시 실루엣. 사용자가 나중에 직접 만든 에셋을 `design/characters/` 에 넣으면 교체(규격은 그 폴더 README). 아직 사용자 승인 전


1. **디자인 구간 (결정 0010)**: 디자인 시스템 아티팩트(배경 반영본 검토 중) → MVP 전체 화면 설계 캔버스(1~4페이즈 화면, 사용자 흐름 순서) → 사용자 검토·승인 → 아티팩트 버전 이름표 → `design/` 사본(`tokens.json`, 화면 PNG), `tokens.css` 를 `tokens.json` 에서 만들기. 출발점은 `01-UI-SPEC.md` 의 토큰·규칙과 `design/references/`
2. 아티팩트 링크를 `CLAUDE.md` 문서 지도에 적는다
3. `01-UI-SPEC.md` 를 설계 사본에 맞춰 고친 뒤 웨이브 3 이후를 `/gsd-plan-phase 1` 로 다시 계획한다(01-01~01-03 은 그대로). UI-SPEC 의 M1~M15 도 함께 반영
4. `/clear` 후 `/gsd-execute-phase 1` 로 웨이브 3부터 재개
5. 디자인 구간을 해 본 결과로 gsd-addons 에 디자인 구간 스킬을 만든다(`docs/lifecycle.md` 구간 3 상태 갱신). 페이즈가 끝날 때마다 `/gsd-extract-learnings`. 포트폴리오 명령 `/gsd-addons:portfolio`(선택 단계)는 나중에 만든다
6. GSD 를 쓰며 불편했던 점은 기록해 두고 gsd-addons 에서 고친다(구간별 표준 산출물은 반복 여부와 상관없이 의도적으로 만든다). 지금까지: 문서 분류 에이전트가 해시를 못 구해 결과 파일 이름 규칙을 어김(수동 수정), `ingest-docs` 는 `config.json` 을 만들지 않음, 한국어 페이즈 이름은 슬러그가 비어 `init.plan-phase` 가 페이즈 폴더 경로를 못 냄(영문 슬러그 폴더를 직접 만들어 해결), UI 게이트가 한국어 문구에서 프런트엔드 신호를 못 잡음, UI 상태 점검기도 한국어 요소는 `text_en` 영어 번역이 있어야 분류함(72~75개 항목이 나와 하나씩 묻기는 불가능해 일괄 처리)(1페이즈 계획 때도 반복 — 그 결과 `ui_phase: true` 인데도 UI-SPEC 없이 계획·실행까지 감), 엣지 프로브가 한국어 요구사항을 하나도 분류하지 못함(8개 모두 unclassified), 첫 플랜 체커가 계획 본문을 읽지 않고 통과 수준으로 판단함(재검증 때 본문까지 읽게 지시), `state.planned-phase` 가 `.planning/state.json` 을 새로 만들지만 커밋 대상에 없음(미추적으로 둠). 실행 단계에서 추가: `origin/HEAD` 가 없으면 워크트리 병렬 실행이 순차로 떨어지는데, 실행자 디스패치 가드는 매번 다시 워크트리를 요구해 디스패치 직전마다 `dispatch-isolation --force-isolation none` 을 다시 기록해야 했음(`git remote set-head origin -a` 로 해결될 것으로 보임), 실행자 커밋 가드가 `branching_strategy: none` 인데도 `main` 을 막고 페이즈 브랜치를 만듦, `.planning/milestone.lock` 도 미추적으로 생김.

## 환경 메모

- Mac: `~/personal/` 아래에서 git·gh 가 개인 계정(dhkim1522)으로 자동 전환된다.
- 개인 gh 로그인은 `gh auth login --hostname github.com --git-protocol ssh --insecure-storage` 로 했다. 토큰은 키체인이 아니라 `~/.config/gh-personal/hosts.yml` 에 둔다. 로그인 중 HTTPS 자격 증명 설정(전역 `~/.gitconfig` 변경)은 하지 않는다.
- 집 Windows: 이 저장소를 clone 한 뒤 저장소 안에서 `git config user.email dhkim1522@naver.com` 을 설정한다.
- 페이즈 1 전에 필요한 것: Node.js LTS, Cloudflare 계정, `wrangler` 로그인.
- Cloudflare: 개인 계정(이메일 인증 완료), workers.dev 하위 도메인 `dhplay`(계정 전체 공용, 바꾸면 모든 Worker 주소가 바뀜). 배포는 `npm run deploy`, 배포 주소 스모크는 `node scripts/smoke.mjs --prod --stage create`.
- 집 Windows 에서 배포하려면 그 PC 에서 `npx wrangler login` 을 한 번 한다(개인 계정).
- GSD·gsd-addons 설치 (PC 마다 한 번):
  - Mac: `CLAUDE_CONFIG_DIR=~/.claude-personal npx @opengsd/gsd-core@latest --claude --global` (설정 폴더를 꼭 명시한다)
  - gsd-addons: `~/personal/gsd-addons` 에 clone 한 뒤 `claude plugin marketplace add ~/personal/gsd-addons`, `claude plugin install gsd-addons@gsd-addons --scope user`. 고친 뒤에는 `claude plugin marketplace update gsd-addons`.
  - Windows: 같은 명령을 그 PC 의 개인 Claude 설정 폴더 기준으로 실행한다.

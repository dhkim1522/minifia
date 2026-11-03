# 작업 인계

> 두 PC·다음 세션이 이어 가는 데 필요한 최소 정보만 적는다. **해결된 항목은 지운다**(기록은 결정 기록·SUMMARY·git 에 있다). 6KB 이하(`test/unit/handoff.test.ts`). 환경 설정은 `docs/setup.md`.

## 지금 상태

- **v2.0 "같은 공간" 진행 중**: 맵 이동·자유 채팅·동작 캐릭터, 처형은 지목→변론→찬반, 밤은 산 마피아만 이동·시민 어둠, 아침에 분필·유언·쪽지 공개. 범위 결정 0044, 요구사항·로드맵은 `.planning/`. 역할·승패 규칙은 그대로.
- **6~8페이즈 완료**(월드 뼈대·자유 채팅·낮 처형과 유령, 결정 0057~0060). 상세는 각 페이즈 SUMMARY.
- **9페이즈 "밤과 아침" 구현 완료(2026-11-03, 결정 0061)**: 밤 30초(마피아만 이동, 시민 편은 본인 한 칸만 받음), 마피아 전원이 같은 대상을 고르면 확정, 경찰·의사는 얼굴 목록, 아침에 모두 밤 시작 자리로 복귀하고 분필·유언 카드·쪽지 카드, 긴장 연출(맥박 비네트)·암살 번쩍임·장면 막. 구조는 `docs/architecture.md` "밤과 아침". 배포본(`04e716b`)은 앱 코드(`src`·`worker`·`shared`·`public`)가 현재와 같다(이후 커밋은 시험·스크립트·문서뿐). 배포본 자동 확인 기록은 `09-DEVICE-CHECKS.md` 표 A. 검증(`/gsd-verify-work 9`)은 아직 안 했다.
- **캐릭터(결정 0047·0048)**: 구·원통 조립 3D 인물. 원본 https://claude.ai/artifact/NP1XfUrYTTqQ5nAB1HKYT5 (사본 `design/v2.0/figure/`, 최신 모듈 `design/v2.0/blockout/character.js`). `design/v2.0/3d/mf3d.js` 의 캐릭터는 옛 방식이라 쓰지 않는다.
- **맵(결정 0050)**: v2.0 은 ① 지하 재즈 바(6~9페이즈 기준) + ③ 시계탑 광장, 방장이 고르고 기본 랜덤(11페이즈). 블록아웃 https://claude.ai/artifact/1hzgEyAufgnDPVMvPvxdhP (사본 `design/v2.0/blockout/`).
- **브랜치**: 작업은 **`v2`**. `v1` 은 v1.0 배포본 수정 전용, `main` 은 배포된 버전(v1.0). 다른 PC 에서는 `git fetch` 후 `git switch v2`.
- 배포: v1.0 `https://minifia.dhplay.workers.dev` 는 그대로 둔다. v2 배포본 https://minifia-v2.dhplay.workers.dev (Worker `minifia-v2`, 결정 0044-24). `npm run deploy` 가 계정·배포 대상 가드를 거친다.
- 도구 메모: 버전은 `/api/health`. `npm run e2e` 는 인자가 없으면 배포본을 검사한다(로컬은 `npm run dev` 후 `-- --url http://localhost:5173`, `--only 흐름1,흐름2`). CSS `backdrop-filter` 는 비접두 한 번만.
- 2026-11-02 원격 이력 재작성(강제 push): 다른 PC 의 옛 clone 은 새로 clone.
- 커밋 제외: `design/backgrounds/indoor-draft/`, `Claude outputs/`, `.planning/milestone.lock`, `.planning/state.json`.

## 확인 대기 (사용자 답·확인이 필요한 것)

- 정할 것이 생기면 질문 도구로 추천안 + 여러 안을 하나씩 묻는다. 게임 진행에 지장 없는 작은 화면 문제는 기록만 한다.
- **실기기·팀 테스트는 모든 개발이 끝난 뒤 한꺼번에(사용자 결정 2026-11-02)**: 페이즈마다 하지 않는다. 기기 없이 되는 검사는 Claude 가 직접 돌린다. 쌓인 목록은 ROADMAP 백로그 999.1~6. 9페이즈는 999.6 — iPhone 낮+밤+아침 5분 55fps(크롬 4× 스로틀 nightload 는 평균 59.99fps·끊김 0, 폰 합격 근거 아님), 시민 편 어둠 가독, 유언 시트 + iOS 키보드, 얼굴 칸 누르기, 맥박·번쩍임, 팀 4명 이상 한 판 관찰 ①~⑥. 절차는 `09-DEVICE-CHECKS.md`(07·08 것도 같은 폴더 모양).
- **360×560 경찰 밤 8자 이름**이 줄바꿈되면 내 이름표가 스테이지 위로 약 19.6px 올라감(UI-SPEC 알려진 한계). 지금은 참고 줄로만 둠 — 고칠지 사용자 판단.
- **유령 이름표 글자 대비**: 불투명도 0.6 에서 약 1.9~2.5:1(근사). 실기기에서 읽기 어려우면 값을 정한다(08-DEVICE-CHECKS B3).
- **7·8페이즈 코드 리뷰 open**: 8페이즈 Info 7건(`08-REVIEW-DISPOSITION.md`), 7페이즈 경고 3건(`07-REVIEW-GAPS.md`).
- **알려진 한계**: 작은 폰(방 높이 640 이하)에서 키보드가 열리면 스테이지가 128 미만. 8자 이름표는 폭 360 에서 가장자리가 잘릴 수 있다.
- `npm audit` 기존 의존성 취약점 6건, three 무관. 12페이즈 정리 후보: `scripts/uat-night.mjs`(낮 타이머·동률·allyPicks 단언 낡음)·`uat-vote.mjs`, `src/styles/day.css`·`night.css` 의 v1.0 잔재, `MorningView.phrase`·`MORNING_PHRASE_COUNT`, `VERDICT_TEXT.candidateNone`·`votedSuffix`. 배포본 전체 E2E 는 900초 제한을 넘길 수 있어 `--only` 로 나눠 돌린다.

## 다음 할 일

1. 배포본 smoke full 이 표 A 대로 통과하지 못했다(망이 느릴 때 타이밍 검사가 흔들림). 빠른 망에서 다시 돌리고, E2E 의 간헐 실패(night-sizes 360x640 PK3 겹침, ghost 지목 토스트 G2 화면 밖)를 지켜본다. 느린 망에서는 smoke 의 타이밍 검사(dayAnnounce 도착 편차·찬반 값 변경 방송 검사·재접속 중 놓치는 dayAnnounce)가 흔들린다 — 문턱을 낮추지 말고 망이 빠를 때 다시.
2. **`/gsd-verify-work 9`** 로 9페이즈 검증(실기기 항목은 999.6 으로 미룸).
3. **10페이즈 "캐릭터·동작·의상"**: 디자인 승인 확인 뒤 `/gsd-ui-phase 10` → `/gsd-plan-phase 10`. 9페이즈 UI-SPEC 이월 입력(입력줄 감정표현 버튼, 얼굴 목록을 의상 얼굴로, 암살·쓰러지는 동작, 지목 중 제자리 동작)을 받는다.
4. three `0.186.1` 고정, 성능 확인 폰은 iPhone 16 Pro + 크롬 CPU 4배 스로틀(결정 0055). v1.0 산출물 링크는 `CLAUDE.md`.
5. v2.0 마무리 뒤 이력서용 포트폴리오(GitHub Pages): `docs/portfolio-request.md`.

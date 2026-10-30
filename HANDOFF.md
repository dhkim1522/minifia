# 작업 인계

> 두 PC·다음 세션이 이어 가는 데 필요한 최소 정보만 적는다. **해결된 항목은 지운다**(기록은 결정 기록·SUMMARY·git 에 있다). 6KB 이하(`test/unit/handoff.test.ts`). 환경 설정은 `docs/setup.md`.

## 지금 상태

- **후보 선택 취소·무효표 안내 배포(결정 0040)**: 고른 뒤 장면의 빈 곳 탭 = 취소(와이어 `target: null`, 투표자 본인에게만), 안내 줄 `아무도 고르지 않으면 무효표가 돼요`/`빈 곳을 누르면 선택이 취소돼요`. 서버·화면 함께 배포, 배포본 `https://minifia.dhplay.workers.dev` 버전 `2026-10-29T14:52:03Z+cb6979c`(개인 Cloudflare 계정). 배포본 smoke 4·5·8명(8명 포함 한 번에 통과), UAT 5종, E2E(열 흐름 × 네 크기 + pc + wakelock) 통과. 직전 0039(토론 40초, 여부 투표 13초, 공개 한 표 2초) smoke 8명 재확인도 이 통과로 갈음.
- 5페이즈 배포 완료(결정 0038): 안내 문장·`data-guide`, 밤 비네팅·아침 밝아짐, 짧은 폰 테이블 압축(하한 0.77)·링크 참가 광장 축소, Wake Lock. 요구사항 LOOK-01·CHAR-01·UX-01·UX-02·CONN-03 완료 표시(실기기 체감·Wake Lock 실제 동작은 대기). 캐릭터 움직임·새 에셋·새 진동은 없음(사용자 결정, 앱 전환 때 재검토).
- `npm run e2e` 기본 크기는 이제 `360x640`·`390x664`·`430x932`·`360x560`(단 높이 probe). 흐름은 열 개 + 크기 고정 `pc`(1280x800)·`wakelock`.
- 4페이즈 배포 완료(결정 0036·0037, 요구사항 VOTE·COMM-03·CONN-02·END 완료).
- 소스에 `backdrop-filter` 를 접두와 짝으로 쓰면 빌드(lightningcss)가 접두만 남겨 Chrome 에서 변론 흐림이 사라진다. 비접두 한 번만 쓴다(`verdictCss.test.ts`). 로컬 dev 는 CSS 를 압축하지 않으니 CSS 를 바꾸면 배포본 E2E 로 확인.
- 이 PC 의 배포본 smoke 는 네트워크에 따라 간헐 실패한 적이 있다(0039 때 8명 2회, 0040 은 통과). 실패하면 단독 한 번 재확인, 한도(500ms)는 바꾸지 않는다.
- 버전은 `/api/health`. `npm run e2e` 는 인자가 없으면 **배포본**을 검사한다. 로컬은 `npm run dev` 후 `npm run e2e -- --url http://localhost:5173`. 소켓 확인 `node scripts/uat-vote.mjs <주소>`.
- 배경·유령 그림을 바꾸면 `ASSET_VERSION`(`src/net/assets.ts`)을 올린다. E2E 「살아 있는 방장」 흐름의 첫 밤 방장 탈락은 설계대로의 무작위다(최대 4번 재시도).
- 커밋 제외: `design/backgrounds/indoor-draft/`, `Claude outputs/`.

## 확인 대기 (사용자 답·확인이 필요한 것)

- 없음.

## 다음 할 일

1. **v1.0 개발 마무리 완료**(2026-10-30): 1~5페이즈 목표 검증(VERIFICATION)·보안 점검(SECURITY, 위협 310·열린 것 0)·테스트 빈틈(VALIDATION, nyquist 테스트 6파일)·배운 점(LEARNINGS) 완료. 6페이즈 삭제(결정 0041). 다음은 사용자 실테스트 뒤 요구.
2. 디자인 아티팩트는 v1.0 구현 기준으로 동기화됨(화면설계서·화면 흐름 v1.0 페이지, 디자인 시스템 토큰·번들·참고 카드, 캐릭터 에셋 「최종 채택」). 사본 `design/screens/v1.0/`, 재촬영 `scripts/gallery.mjs`. 영역 지도 `docs/screen-map.md`.
3. 포트폴리오: 케이스 스터디 슬라이드 https://claude.ai/artifact/P7aBWj4g2nHNTVeQHKEiY2 · 경력기술서 https://claude.ai/artifact/KMQUK84xtVpi5UcCPFwDFZ (둘 다 비공개, 공유는 페이지에서).
4. 선택 권고(보안 점검 메모): `wrangler.jsonc` 에 `preview_urls: false`(재배포 필요), `npm run deploy` 앞 `wrangler whoami` 계정 확인 가드.

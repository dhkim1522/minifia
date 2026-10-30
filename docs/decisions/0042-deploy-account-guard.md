# 0042 배포 전에 Cloudflare 계정을 스크립트로 확인하고, 버전 미리보기 주소를 끈다

- 상태: 채택
- 날짜: 2026-10-30

## 배경

- 2026-10-30 보안 점검(1~5·3.1페이즈 SECURITY)에서 두 가지 선택 권고가 나왔다. 사용자가 둘 다 적용하기로 했다.
- `wrangler.jsonc` 에 `preview_urls` 가 없어 기본값(켜짐)이었다. Cloudflare 가 배포 버전마다 미리보기 주소를 만들어, 옛 버전 화면이 그 주소로 계속 열릴 수 있다(01-02 Threat Flags `public_preview_urls`).

## 결정

1. `npm run deploy` 는 먼저 `scripts/check-account.mjs` 를 돈다. `wrangler whoami` 의 로그인 이메일이 `dhkim1522@naver.com` 이 아니거나, 로그아웃이거나, wrangler 가 실패하면 빌드·배포 전에 멈춘다(종료 상태 1). 판정 함수는 `scripts/check-account.test.mjs` 로 시험한다.
2. `wrangler.jsonc` 에 `"preview_urls": false`. 설정만 바꿨고 이 결정 때문에 따로 배포하지 않는다. 다음 정식 배포(서버·화면 함께, 결정 0036-15)부터 반영된다.

## 결과

- 계정 확인이 절차에서 코드로 바뀌었다. 수동 `whoami` 확인은 더 필요 없지만 해도 된다.
- `npm run deploy` 가 `wrangler whoami` 네트워크 호출 한 번만큼 느려진다(몇 초).
- 배포 주소 `minifia.dhplay.workers.dev` 는 그대로다.

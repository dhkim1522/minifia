# 미니피아 (minifia)

> 최신 버전은 [`v3` 브랜치](https://github.com/dhkim1522/minifia/tree/v3)에 있습니다 · [설계 문서](https://dhkim1522.github.io/minifia/design.html) · [소개 페이지](https://dhkim1522.github.io/minifia/)

친구들이 각자 폰으로 방에 들어와 점심시간에 5~10분 안에 한 판 끝내는 마피아 게임. 웹앱으로 먼저 만들고, 정식 출시 때 같은 코드를 앱으로 감싼다.

- 기획: [docs/product.md](docs/product.md)
- 설계: [docs/architecture.md](docs/architecture.md)
- 결정 기록: [docs/decisions/](docs/decisions/)
- 현재 상태와 다음 할 일: [HANDOFF.md](HANDOFF.md)

## 개발

Node.js 22.12 이상이 필요하다.

```bash
npm ci                 # 처음 받았을 때
npm run dev            # 개발 서버 (같은 Wi-Fi 폰은 표시되는 LAN 주소로 접속)
npx vitest run         # 테스트
npm run typecheck      # 타입 검사 (맨 앞에서 tokens:check)
npm run tokens         # design/tokens.json 을 고친 뒤 src/styles/tokens.css 를 다시 만든다
npm run build          # dist/ 만들기
npm run deploy         # 빌드 + Cloudflare 에 배포 (wrangler 로그인 필요)
node scripts/smoke.mjs --prod --stage full   # 배포 주소에서 한 판 끝까지 확인
```

- 배포 주소: https://minifia.dhplay.workers.dev
- 한 브라우저 프로필은 한 사람으로 센다. 여러 명을 한 PC 에서 시험하려면 브라우저나 프로필을 사람마다 하나씩 쓴다.

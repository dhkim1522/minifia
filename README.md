# 미니피아 (minifia)

친구들이 각자 폰으로 방에 들어와 점심시간에 5~10분 안에 한 판 끝내는 마피아 게임. 웹앱으로 먼저 만들고, 정식 출시 때 같은 코드를 앱으로 감싼다.

- 기획: [docs/product.md](docs/product.md)
- 설계: [docs/architecture.md](docs/architecture.md)
- 결정 기록: [docs/decisions/](docs/decisions/)
- 현재 상태와 다음 할 일: [HANDOFF.md](HANDOFF.md)
- 상태: v2.0 6페이즈(월드 뼈대) 실행 완료 — 로비가 재즈 바 3D 맵이고 캐릭터가 걷는다. 렌더 성능 게이트 통과([결정 0057](docs/decisions/0057-v2-render-gate.md)). 다음은 7페이즈 자유 채팅.

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

- 배포 주소: v2.0 시험판 https://minifia-v2.dhplay.workers.dev (v2 브랜치), v1.0 https://minifia.dhplay.workers.dev (v1 브랜치·태그 v1.0, 그대로 둔다. v1.0 은 v1 브랜치에서만 배포한다)
- 한 브라우저 프로필은 한 사람으로 센다. 여러 명을 한 PC 에서 시험하려면 브라우저나 프로필을 사람마다 하나씩 쓴다.

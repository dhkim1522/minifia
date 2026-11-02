---
phase: "08"
slug: "day-execution-ghost"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-11-03"
---

# Phase 08 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| 클라이언트 → 방 DO (WebSocket) | 지목·찬반·토론 끝내기·이동 요청은 신뢰하지 않는 입력. 행위자는 소켓 첨부의 playerId, 스키마는 strictObject | 행동 메시지 (낮음) |
| 방 DO → 산 사람 소켓 | view·world 프레임. 남의 역할·찬반 값·유령 위치가 나가면 안 됨 | 역할·투표 (높음) |
| 방 DO → 유령 소켓 | 관전 view(모든 역할·밤 picks)와 유령 이동은 유령에게만 | 역할 (높음) |
| DO 저장소 → 방 상태 | 배포 전 저장된 옛 단계 방을 정규화해 읽음 | 게임 상태 (중간) |
| 배포 경로 | 개인 Cloudflare 계정 확인 → 빌드 → 배포 대상 가드 → 배포 | 배포 자격 (높음) |
| 공개 저장소 | 커밋·문서·HANDOFF 에 개인 환경 정보가 남지 않아야 함 | 문서 (중간) |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-08-13 | Information Disclosure | docs/decisions/0060 | medium | mitigate | 공개 저장소 위생 검사(커밋·push 전 grep) 결과 0건 | closed |
| T-08-14 | Repudiation | 옛 결정 원문 | low | mitigate | 원문을 지우지 않고 항목 끝에 개정 표시만 붙인다(이력 보존) | closed |
| T-08-SC | Tampering | npm installs | high | mitigate | 이 계획은 패키지를 설치하지 않는다 | closed |
| T-08-04 | Spoofing/Tampering | castPoint·castVerdict·toggleEnd | high | mitigate | 검사 순서 계약(단계 → 산 행위자 → 대상·변론자 → 값)을 단위 시험 표로 고정. 자기 지목·죽은 대상·변론자 찬반·유령 행동은 BAD_MESSAGE | closed |
| T-08-15 | Information Disclosure | Player.verdictVote·endVote | high | mitigate | resolveVerdict 가 집계 직후 verdictVote 키째 제거, enterDiscussion 이 다음 날 시작에 nominate·verdictVote·endVote 제거(시험) | closed |
| T-08-09 | Tampering | 새 v2 부품의 문자열 렌더 | medium | mitigate | React 텍스트 노드·aria-label 만, innerHTML 계열 없음(정적 grep 은 08-20 의 정적 가드가 전 파일에 건다) | closed |
| T-08-16 | Information Disclosure | RoleChip | high | mitigate | 부품은 신분을 판단하지 않고 부르는 쪽 유령 분기만 만든다 — 산 사람 DOM 0건은 08-17 화면 시험·E2E 가 검사 | closed |
| T-08-17 | Information Disclosure | audience world·worldVisibleTo | high | mitigate | mover·viewer 신분 표 전수 단위 시험, mover 없음은 빈 집합(실패하면 닫힘). 실제 소켓 검사는 08-09 의 메타모픽 누설 시험 | closed |
| T-08-18 | Tampering | STAGE_SPOT 예외 | medium | mitigate | 예외는 정확한 한 점과 300 안 선분뿐(근처 점·먼 점 막힘 시험), BAR_MASK 문자열 불변(diff 게이트) | closed |
| T-08-19 | Tampering | 저장된 lay·segs 복원 | low | mitigate | 형태 검사(정수·±700·방에 있는 id), 틀리면 그 항목만 버림 | closed |
| T-08-20 | Information Disclosure | HeadStack role 칸 | high | mitigate | role 이 없으면 RoleChip·data-role-chip 0개(시험). 산 사람 화면이 role 을 넘기지 않음은 08-17 화면 시험이 검사 | closed |
| T-08-21 | Tampering | Google Fonts 요청 | low | accept | 새 출처가 아니고(같은 호스트), 글꼴 CSS 만 받는다. 실패하면 대체 글꼴로 그려진다 | closed (accepted) |
| T-08-22 | Information Disclosure | dayEvents 입력 | medium | mitigate | 입력을 공개 필드로 한정(me.verdictVote·me.endDiscussion·spectate 를 읽지 않음 — 시험의 view 에 넣어도 결과가 같음을 단언), dayEvents 출력 전체에 역할 단어 0건 단위 시험 | closed |
| T-08-23 | Denial of Service | 위 알림 도배 | low | mitigate | 합치기·대기 4건 상한·건너뛰기(T-08-08 의 화면 몫) | closed |
| T-08-02 | Information Disclosure | applyVerdict 방송·view | high | mitigate | 처음 투표만 전원, 변경은 sendViewTo([playerId]); me.verdictVote 본인만; 남의 값 0건 소켓 시험 | closed |
| T-08-03 | Information Disclosure | execution view | high | mitigate | day.verdict 는 수만, 처형 view 에 역할 키 없음(view 시험). 전체 누설 스캔은 08-09 leak.test | closed |
| T-08-07 | Information Disclosure / DoS | applyEndDiscussion | medium | mitigate | 개수만 공개, 같은 값 무전송, 연결당 20 msg/s 기존 한도 | closed |
| T-08-08 | Denial of Service | applyPoint 연타 | medium | mitigate | 사람당 250ms 간격(본인에게만 서버 값), 연결당 기존 한도 | closed |
| T-08-24 | Spoofing | 세 메시지 스키마 | high | mitigate | strictObject 가 덧붙은 키 거부(시험), 행위자 = 소켓 첨부 | closed |
| T-08-25 | Information Disclosure | visibleSeats | medium | mitigate | 산 사람 viewer 상태에 유령 좌석 없음(시험). 위치 자체를 보내지 않는 것은 서버 몫(08-09) | closed |
| T-08-26 | Tampering | pointingOf 낙관적 표시 | low | mitigate | 남의 지목은 서버 값만, 내 것만 덮는다(시험) — 서버 응답 전 남의 표 미리 그리기 금지 | closed |
| T-08-01 | Information Disclosure | emitWorld·handleHello snap·chat·typing | high | mitigate | mover/viewer 기준 audience 한 길 + 메타모픽 두 판 비교 + 직접 불변식 (a)~(d) + 무차별 방송 정적 가드 유지 | closed |
| T-08-05 | Tampering | 막힌 단계의 move | high | mitigate | canMove 게이트, 조용한 거절(프레임 0) 단계표 시험 | closed |
| T-08-06 | Elevation of Privilege | 산 사람이 유령 위치·채널 요청 | high | mitigate | 채널·위치 범위는 서버 상태로만 정함(클라이언트 입력 없음), snap 도 worldVisibleTo | closed |
| T-08-11 | Information Disclosure | 재접속 첫 snap | high | mitigate | snap 을 viewer 별로 거름(시험), chatLog 복원은 07 마스크 그대로 | closed |
| T-08-12 | Information Disclosure | 유령·산 사람의 앱 밖 공모 | low | accept | 결정 0018(온라인 기준, 엿보기·외부 소통은 설계 제약 아님) | closed (accepted) |
| T-08-27 | Denial of Service | 유령 재질 복제·원뿔 메시·고리 | medium | mitigate | 캐릭터당 복제 하나·dispose 시험, 그리기 호출 ≤ 120 시험, 새 광원 0 diff 게이트. 성능 실측은 08-24 | closed |
| T-08-28 | Tampering | 조기 종료·마감 연쇄 | medium | mitigate | 과반 직후 새 마감 = 그 시각 + 15000 시험, 늦은 알람 따라잡기 시험 | closed |
| T-08-29 | Information Disclosure | 새 흐름 전체 view·프레임 | high | mitigate | leak.test 6명 한 판을 새 흐름으로, 허용 목록은 받을 권리 조건으로만(줄 단위 이유 주석) | closed |
| T-08-30 | Information Disclosure | 이름표 roster·캐릭터 | medium | mitigate | 보이지 않는 좌석은 DOM·캐릭터를 만들지 않는다(시험). 위치 비전송은 서버(08-09) | closed |
| T-08-31 | Tampering | 지목 버튼 | low | mitigate | 버튼은 pick 좌석만, 서버가 자기·죽은 대상 거부. 끊김 중 aria-disabled | closed |
| T-08-32 | Tampering | 닉네임 문자열 | medium | mitigate | aria-label·텍스트 노드만, innerHTML 0건 게이트 | closed |
| T-08-33 | Tampering | 결과 알림·헤더 문자열 | medium | mitigate | 텍스트 노드·aria-label 만, innerHTML 0건 게이트 | closed |
| T-08-34 | Spoofing | 보내는 메시지 모양 | medium | mitigate | endDiscussion 은 on 하나뿐(신원 필드 없음 게이트), 서버 strictObject 가 최종 | closed |
| T-08-35 | Denial of Service | 토론 끝내기 연타 | low | accept | 같은 값 무전송(서버), 연결당 20 msg/s 기존 한도 | closed (accepted) |
| T-08-36 | Tampering | 검사 대상 주소 | medium | mitigate | 배포 대상 가드(deploy-target.test) 를 매 작업 돌린다, 스크립트는 주소 해석을 바꾸지 않는다 | closed |
| T-08-37 | Information Disclosure | 스크립트 출력 | low | mitigate | 토큰·본문을 출력하지 않는 기존 규칙 유지 | closed |
| T-08-38 | Tampering | 낙관적 표시 | low | mitigate | 내 선택만 즉시, 남의 표·배지는 서버 값만(시험) | closed |
| T-08-39 | Denial of Service | 위 알림 도배 | low | mitigate | ToastQueue 합치기·4건 상한(화면 몫), 서버 250ms(08-07) | closed |
| T-08-40 | Information Disclosure | 지목 화면 역할 표식 | medium | mitigate | 진홍·역할 클래스 0건 시험, RoleChip 은 유령 분기만(08-17) | closed |
| T-08-41 | Information Disclosure | 찬반 화면 DOM | high | mitigate | 다른 좌석은 data-done 만, 값 표시 없음(시험); 서버가 남의 값을 보내지 않음(08-07) | closed |
| T-08-42 | Information Disclosure | 처형 알림·줄 | high | mitigate | 처형 단계 DOM 역할 단어 0건 시험(결정 0053-2) | closed |
| T-08-43 | Tampering | 결과 알림 문자열 | medium | mitigate | 텍스트 노드만(08-13 게이트) | closed |
| T-08-44 | Information Disclosure | 산 사람 화면 DOM | high | mitigate | 유령 분기는 spectate 가 있을 때만 — 단계 전수 DOM 0건 시험 | closed |
| T-08-45 | Elevation of Privilege | 유령 조작 | medium | mitigate | 유령에게 지목·찬반·토론 끝내기 UI 없음(서버도 BAD_MESSAGE, 08-02·07) | closed |
| T-08-46 | Information Disclosure | 밤 고리 | high | mitigate | 산 시민 화면 고리 0건 시험, 고리 입력은 서버가 그 사람에게 보낸 값만 | closed |
| T-08-47 | Information Disclosure | 마피아 채널 문구 | medium | mitigate | 마피아 채널 문구는 서버 me.chat = mafia 일 때만 그린다(07 규칙) | closed |
| T-08-48 | Repudiation / Tampering | 화면 삭제 범위 | medium | mitigate | 지우기 직전 소비자 재grep(목록 밖이면 멈춤), 지운 파일 import 0 게이트(src·test), 누설 시험 diff 0 게이트, skip 0 게이트. 시험 삭제 범위는 08-27 대응표(T-08-61) | closed |
| T-08-49 | Tampering | 지운 코드 재등장 | low | mitigate | dayStaticGuard 정적 가드(주석 제외 이름 0건) | closed |
| T-08-50 | Denial of Service | 결과 화면 빌드 깨짐 | medium | mitigate | 결과 화면 문구 export 유지 게이트 + vite build | closed |
| T-08-10 | Tampering | 옛 번들·옛 메시지 | medium | mitigate | 스키마에서 제거 → BAD_MESSAGE(시험). 옛 저장 방 정규화는 08-22 | closed |
| T-08-51 | Repudiation | 시험 삭제 | low | mitigate | vote.test 뜻 대응표는 08-28(T-08-62), 이 계획의 시험 쪽 짝 정리는 SUMMARY 에 파일·이유, 옛 이름 0·skip 0 게이트 | closed |
| T-08-52 | Tampering / DoS | 옛 저장 방 | medium | mitigate | normalizeStoredRoom 이 토론으로 옮기고 알람 재설정(unit·worker 시험) | closed |
| T-08-53 | Information Disclosure | 처형 view | low | mitigate | 처형 view {seat} 만(시험), 역할 없음 유지 | closed |
| T-08-54 | Tampering | E2E 기준·완화 목록 | medium | mitigate | 0056 다섯 항목만 지우고 다른 완화·기준 수치 불변(diff 확인을 SUMMARY 에), 새 판정은 시험으로 고정 | closed |
| T-08-55 | Information Disclosure | 유령·찬반 화면 누설 | high | mitigate | ghostDomChecks·world 기록 유령 좌석 0건·찬반 값 표시 0건을 실제 브라우저에서 확인 | closed |
| T-08-56 | Tampering | E2E 문턱값 | medium | mitigate | 문턱값·skipByDefault 로 초록 만들기 금지(prohibition), 알려진 한계는 UI-SPEC 이 정한 비판정 항목만 | closed |
| T-08-57 | Denial of Service | 낮 흐름 렌더 부하 | medium | mitigate | 4배 감속 5분 측정·게이트 판정, 미달 시 결정 0057 사다리 순서(선두 점광 먼저) | open — below high threshold (non-blocking); 측정은 실기기 묶음 B1 로 미룸(사용자 결정 2026-11-03) |
| T-08-58 | Tampering | 검사 대상 주소 | medium | mitigate | exitIfV1·배포 대상 가드 유지 게이트 | closed |
| T-08-59 | Tampering | 배포 대상 | high | mitigate | check-account·check-deploy-target 가드(npm run deploy), v1.0 주소 검사 없음 | closed |
| T-08-60 | Information Disclosure | 공개 저장소 문서 | medium | mitigate | 공개 저장소 위생 검사(커밋·push 전 grep) 결과 0건 | closed |
| T-08-61 | Repudiation / Tampering | 시험 삭제·이전 범위 | medium | mitigate | 파일별 대응표 18행(SUMMARY, 행 수 게이트), 표에 없는 파일 삭제 금지, 누설 시험 diff 0 게이트, skip 0 게이트 | closed |
| T-08-62 | Repudiation | vote.test·옛 흐름 전용 unit 시험 삭제 | low | mitigate | describe·it 별 뜻 대응표(SUMMARY), 없는 뜻은 새 규칙 시험에 더함, 옛 view 필드의 비공개 뜻은 08-07 새 필드 시험이 지킴(없으면 지우지 않고 08-11 로 넘김), skip 0 게이트, 누설 시험 diff 0 게이트 | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

검증 근거(file:line·시험 이름)는 아래 감사 기록의 보안 감사자 판정을 따른다. T-08-SC: 프로젝트 의존성(package.json·lockfile·node_modules)은 페이즈 내내 바뀌지 않았다. 다만 실행 중 즉석 npx 실행 두 번이 개발 Mac 의 npx 캐시에 패키지를 받아 실행했다(vite-node, 무관한 biome@0.3.3). 저장소에는 아무것도 들어오지 않았다. 이후 실행기 지시에 node_modules/.bin 밖 npx 금지를 넣었다.

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-08-01 | T-08-12 | 화면 밖 공모(엿보기·말로 알려 주기)는 설계 제약으로 삼지 않음(결정 0018). 역할 판정은 서버 규칙(결정 0002) 그대로 | 계획 단계 승인 | 2026-11-02 |
| AR-08-02 | T-08-21 | 명조 글꼴은 기존과 같은 fonts.googleapis.com 출처에서 family 인자만 추가, 새 출처 없음 | 계획 단계 승인 | 2026-11-02 |
| AR-08-03 | T-08-35 | 토론 끝내기 연타는 같은 값이면 전송 없음, 초당 20개 제한으로 충분 | 계획 단계 승인 | 2026-11-02 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-11-03 | 63 | 62 | 1 (medium, non-blocking) | gsd-security-auditor |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-11-03

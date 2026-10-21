## Conflict Detection Report

### BLOCKERS (0)

(없음)

### WARNINGS (0)

(없음)

### INFO (3)

[INFO] 결정 문서와 기획서 사이 모순 없음, 교차 검증 결과
  Note: ADR-0001~0004 (모두 locked) 사이에 같은 범위(scope)를 두고 충돌하는 결정이 없다. docs/architecture.md (SPEC) 의 스택·구조·상태 공개 원칙은 docs/decisions/0001-web-first.md 와 docs/decisions/0002-cloudflare-durable-objects.md 의 결정과 일치한다. docs/product.md (PRD) 의 콘셉트(정통 진행, 무거운 분위기, 캐릭터는 외형 차이만)는 docs/decisions/0003-classic-rules-dark-mood.md 와 일치한다. 순환 참조(cycle)도 없다. cross_refs 는 모두 분류된 문서 밖의 경로(design/references/, .planning/, HANDOFF.md 등)이거나 단방향이다.

[INFO] 출처 우선순위 메모: .planning/ 이 docs/ 보다 우선
  Note: docs/decisions/0004-gsd-workflow.md (locked) 는 "docs/product.md 와 결정 기록이 어긋나면 .planning/ 을 기준으로 맞춘다" 고 정한다. 이번 수집에서 어긋나는 항목은 없으나, 이후 로드맵·요구사항에서 docs/product.md 와 달라지는 부분이 생기면 이 규칙을 따른다.

[INFO] 디자인 참고 자료 폴더 표현 차이 (충돌 아님, 후속 결정이 더 구체적)
  Note: docs/decisions/0003-classic-rules-dark-mood.md 는 참고 자료를 design/references/ 에 모은다고 적고, docs/decisions/0004-gsd-workflow.md 는 고정 폴더 없이 디자인 단계에서 경로를 주면 따르며 design/references/ 는 보관 위치로 쓸 수 있으나 필수가 아니라고 적는다. 두 결정은 양립 가능하다(0003 은 권장 위치, 0004 는 필수 아님). 합성 결과에는 0004 의 표현을 따른다 (둘 다 locked 이고 모순이 아니므로 자동 해결이 아니라 해석 메모).

// 컬러 에셋 변환기: 승인 시안 A(design/v3.0/tutorial/Main.dc.html)의 인라인 svg 25개(장소 16 + 흔적 조각 9)를
//   1) design/v3.0/assets/{id}.svg 사본 25개로, 2) src/components/v2/placeArt.tsx 정적 JSX 표로 옮긴다(결정 D-07).
// 그림은 다시 그리지 않는다 — 원본 본문 도형을 그대로 옮기고 하이픈 속성만 React 이름으로 바꾼다.
// 허용 태그·속성 밖이 나오면 멈춘다(T-16-05: on* 이벤트·script·foreignObject 차단). Node 내장만 쓴다(npm 설치 없음, .ts import 없음).
// placeArt.tsx 는 생성물이다. 직접 고치지 않는다.
//
// 그림 교체 절차: 나중에 다듬은 그림이 오면 원본(Main.dc.html)의 같은 svg 를 바꾸고 이 스크립트를 다시 돌린다(원본 → 사본 → JSX 한 방향).
//
// 사용법:
//   node scripts/make-placeart.mjs           사본 25개와 placeArt.tsx 를 다시 쓴다
//   node scripts/make-placeart.mjs --check   디스크 파일이 원본에서 다시 만든 결과와 다르면 한 줄 출력하고 exit 1
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const root = (p) => fileURLToPath(new URL(`../${p}`, import.meta.url));

export const SOURCE_PATH = "design/v3.0/tutorial/Main.dc.html";
export const ASSET_DIR = "design/v3.0/assets";
export const JSX_PATH = "src/components/v2/placeArt.tsx";

/** 낱말(aria-label) → id. 장소 16(재즈 바 8 + 광장 8)·조각 9. 이 표가 PLACE_NAME·TRACE_TEXT 와 같은지는 test/unit/placeArt.test.ts 가 검사한다. */
export const WORD_TO_ID = [
  ["place", "술잔", "glass"], ["place", "피아노", "piano"], ["place", "색소폰", "sax"], ["place", "의자", "stool"],
  ["place", "문", "door"], ["place", "포스터", "poster"], ["place", "전축", "record"], ["place", "촛불", "candle"],
  ["place", "시계탑", "clock"], ["place", "분수", "fountain"], ["place", "벤치", "bench"], ["place", "가로등", "lamp"],
  ["place", "우체통", "mail"], ["place", "나무", "tree"], ["place", "꽃", "flower"], ["place", "가판", "stand"],
  ["trace", "단추 하나", "button"], ["trace", "은빛 핀", "pin"], ["trace", "흰 천 조각", "whiteCloth"],
  ["trace", "검은 천 조각", "blackCloth"], ["trace", "갈색 천 조각", "brownCloth"], ["trace", "노란 연필 조각", "pencil"],
  ["trace", "회색 실밥", "grayThread"], ["trace", "남색 실밥", "navyThread"], ["trace", "붉은 천 조각", "redCloth"],
];

const ALLOWED_TAGS = new Set(["circle", "ellipse", "path", "rect"]);
const ALLOWED_BODY_ATTRS = new Set([
  "cx", "cy", "d", "fill", "height", "opacity", "r", "rx", "ry", "stroke", "stroke-width", "stroke-linejoin", "stroke-linecap", "width", "x", "y",
]);
/** 루트에서 prop(size·label)이나 고정값으로 대신하는 속성 */
const ROOT_DROPPED = new Set(["width", "height", "viewBox", "role", "aria-label"]);
const ALLOWED_ROOT_KEEP = new Set(["stroke", "stroke-width", "stroke-linejoin", "stroke-linecap", "fill"]);
const SAFE_VALUE = /^[#\w .,+-]*$/;

const camel = (name) => name.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

function parseAttrs(text, where) {
  const attrs = [];
  const rest = text.replace(/([A-Za-z][\w:-]*)="([^"]*)"/g, (_, k, v) => {
    attrs.push([k, v]);
    return "";
  });
  if (rest.replace(/[\s/]/g, "") !== "") throw new Error(`${where}: 해석할 수 없는 속성 조각 "${rest.trim()}"`);
  return attrs;
}

function parseBody(body, where) {
  const shapes = [];
  const rest = body.replace(/<([A-Za-z]+)\b([^>]*?)\s*\/>/g, (_, tag, attrText) => {
    if (!ALLOWED_TAGS.has(tag)) throw new Error(`${where}: 허용하지 않는 태그 <${tag}>`);
    const attrs = parseAttrs(attrText, where);
    for (const [k, v] of attrs) {
      if (!ALLOWED_BODY_ATTRS.has(k)) throw new Error(`${where}: 허용하지 않는 속성 ${k}`);
      if (!SAFE_VALUE.test(v)) throw new Error(`${where}: 속성 ${k} 값에 허용하지 않는 문자`);
    }
    shapes.push({ tag, attrs });
    return "";
  });
  if (rest.trim() !== "") throw new Error(`${where}: 본문에 도형 태그가 아닌 내용이 있다 "${rest.trim().slice(0, 40)}"`);
  if (shapes.length === 0) throw new Error(`${where}: 도형이 없다`);
  return shapes;
}

/** 원본 html 문자열(생략하면 디스크의 시안)에서 25개를 읽어 항목·생성 파일 맵(경로 → 내용)을 돌려준다. */
export function buildArt(html = readFileSync(root(SOURCE_PATH), "utf8")) {
  const found = [];
  for (const m of html.matchAll(/<svg\b([^>]*)>([\s\S]*?)<\/svg>/g)) {
    const rootAttrs = parseAttrs(m[1], "svg 루트");
    const label = rootAttrs.find(([k]) => k === "aria-label")?.[1];
    if (label !== undefined) found.push({ label, rootAttrs, bodyText: m[2] });
  }
  if (found.length !== WORD_TO_ID.length) throw new Error(`aria-label 이 있는 svg 가 ${found.length}개다(25개여야 한다)`);

  const items = WORD_TO_ID.map(([group, label, id]) => {
    const hit = found.filter((f) => f.label === label);
    if (hit.length !== 1) throw new Error(`낱말 "${label}" 의 svg 가 ${hit.length}개다(1개여야 한다)`);
    const { rootAttrs, bodyText } = hit[0];
    const vb = rootAttrs.find(([k]) => k === "viewBox")?.[1];
    if (vb !== "0 0 48 48") throw new Error(`${id}: viewBox 가 "${vb}" 다(0 0 48 48 이어야 한다)`);
    const keep = rootAttrs.filter(([k]) => !ROOT_DROPPED.has(k));
    for (const [k, v] of keep) {
      if (!ALLOWED_ROOT_KEEP.has(k)) throw new Error(`${id}: 허용하지 않는 루트 속성 ${k}`);
      if (!SAFE_VALUE.test(v)) throw new Error(`${id}: 루트 속성 ${k} 값에 허용하지 않는 문자`);
    }
    const body = bodyText.trim();
    const shapes = parseBody(body, id);
    return { id, group, label, keep, body, shapes };
  });

  const files = new Map();
  for (const it of items) {
    const rootText = it.keep.map(([k, v]) => ` ${k}="${v}"`).join("");
    files.set(
      `${ASSET_DIR}/${it.id}.svg`,
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" role="img" aria-label="${it.label}"${rootText}>${it.body}</svg>\n`,
    );
  }
  files.set(JSX_PATH, renderJsx(items));
  return { items, files };
}

function renderEntry(it) {
  const rootProps = it.keep.map(([k, v]) => `${camel(k)}: ${JSON.stringify(v)}`).join(", ");
  const shapes = it.shapes
    .map((s) => `        <${s.tag} ${s.attrs.map(([k, v]) => `${camel(k)}=${JSON.stringify(v)}`).join(" ")} />`)
    .join("\n");
  return `  ${it.id}: {\n    root: { ${rootProps} },\n    body: (\n      <>\n${shapes}\n      </>\n    ),\n  },\n`;
}

function renderJsx(items) {
  const section = (group) => items.filter((i) => i.group === group).map(renderEntry).join("");
  return `// 생성물 — scripts/make-placeart.mjs 로 다시 만든다. 직접 고치지 않는다.
// 승인 컬러 에셋 A(design/v3.0/tutorial/Main.dc.html) 25개: 장소 16(PlaceId) + 흔적 조각 9(TracePiece). 사본은 design/v3.0/assets/{id}.svg.
// 48×48 격자, 윤곽선 2, 둥근 끝, 사물 고유색. 에셋 안의 hex 는 캐릭터 에셋과 같은 지위로 허용한다(화면 CSS 에는 hex 를 더하지 않는다).
// 정적 JSX 다 — HTML 문자열 주입이나 런타임 파싱이 없다.
import type { ReactElement, SVGProps } from "react";
import type { PlaceId, TracePiece } from "../../../shared/protocol";

export interface ArtProps {
  /** 표시 크기(px). 맵 타일 44, 시작 카드 60, 증거 카드 장소 32·조각 36, 기록 카드 24 */
  size: number;
  /** 주면 role="img" + aria-label(낱말), 안 주면 aria-hidden 장식 */
  label?: string;
  className?: string;
}

interface ArtEntry {
  root: SVGProps<SVGSVGElement>;
  body: ReactElement;
}

export const PLACE_ART: Readonly<Record<PlaceId, ArtEntry>> = {
${section("place")}};

export const TRACE_ART: Readonly<Record<TracePiece, ArtEntry>> = {
${section("trace")}};

function ArtSvg({ entry, size, label, className }: ArtProps & { entry: ArtEntry }): ReactElement {
  const a11y = label !== undefined ? { role: "img", "aria-label": label } : { "aria-hidden": true as const, focusable: false as const };
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} className={className} {...entry.root} {...a11y}>
      {entry.body}
    </svg>
  );
}

export function PlaceArt({ id, ...props }: ArtProps & { id: PlaceId }): ReactElement {
  return <ArtSvg entry={PLACE_ART[id]} {...props} />;
}

export function TraceArt({ piece, ...props }: ArtProps & { piece: TracePiece }): ReactElement {
  return <ArtSvg entry={TRACE_ART[piece]} {...props} />;
}
`;
}

/** 경로(저장소 기준) 목록을 디스크에서 읽는다. 없는 파일은 맵에 넣지 않는다. */
export function readOutputs(paths) {
  const out = new Map();
  for (const p of paths) {
    try {
      out.set(p, readFileSync(root(p), "utf8"));
    } catch {
      /* 없는 파일은 diffOutputs 가 다른 것으로 센다 */
    }
  }
  return out;
}

/** expected 의 각 경로가 actual 과 다르거나(없는 것 포함) 하면 그 경로 목록을 돌려준다. 같으면 빈 배열. */
export function diffOutputs(expected, actual) {
  const diff = [];
  for (const [p, text] of expected) if (actual.get(p) !== text) diff.push(p);
  return diff;
}

function main() {
  const { files } = buildArt();
  if (process.argv.includes("--check")) {
    const diff = diffOutputs(files, readOutputs([...files.keys()]));
    const known = new Set([...files.keys()].map((p) => p.split("/").pop()));
    let extra = [];
    try {
      extra = readdirSync(root(ASSET_DIR)).filter((f) => f.endsWith(".svg") && !known.has(f));
    } catch {
      /* 폴더가 없으면 위 diff 가 이미 잡는다 */
    }
    if (diff.length > 0 || extra.length > 0) {
      const parts = [...diff, ...extra.map((f) => `${ASSET_DIR}/${f}(남는 파일)`)];
      console.error(`컬러 에셋이 원본과 다르다: ${parts.join(", ")}. node scripts/make-placeart.mjs 를 실행한다.`);
      process.exit(1);
    }
    return;
  }
  mkdirSync(root(ASSET_DIR), { recursive: true });
  for (const [p, text] of files) writeFileSync(root(p), text);
}

// import 할 때는 돌지 않는다(시험이 buildArt·diffOutputs 만 쓴다).
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();

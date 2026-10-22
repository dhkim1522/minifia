// 토큰: design/tokens.json(디자인 시스템 아티팩트의 승인본 사본)에서 src/styles/tokens.css 를 만든다.
// tokens.json 이 바뀌면 다시 실행한다. tokens.css 는 직접 고치지 않는다.
//
// 사용법:
//   node scripts/gen-tokens.mjs           tokens.css 를 다시 쓴다
//   node scripts/gen-tokens.mjs --check   tokens.css 가 tokens.json 과 다르면 실패한다
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = (p) => fileURLToPath(new URL(`../${p}`, import.meta.url));
const tokens = JSON.parse(readFileSync(root("design/tokens.json"), "utf8"));
const FAMILIES = ["spacing", "radius", "shadow", "size", "duration", "easing", "zIndex"];

const vars = [
  ...tokens.color.tokens,
  { name: "font-ui", value: tokens.type.families.ui },
  ...FAMILIES.flatMap((f) => tokens[f]?.tokens ?? []),
];
const css =
  "/* minifia 토큰. design/tokens.json 에서 scripts/gen-tokens.mjs 로 만든 파일이다. 직접 고치지 않는다. */\n" +
  ":root {\n" +
  vars.map((t) => `  --${t.name}: ${t.value};\n`).join("") +
  "}\n";

const out = root("src/styles/tokens.css");
if (process.argv.includes("--check")) {
  if (readFileSync(out, "utf8") !== css) {
    console.error("tokens.css 가 design/tokens.json 과 다르다. node scripts/gen-tokens.mjs 를 실행한다.");
    process.exit(1);
  }
} else {
  writeFileSync(out, css);
}

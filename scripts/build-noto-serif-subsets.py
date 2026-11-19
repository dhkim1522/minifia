r"""Build Minifia's self-hosted WOFF2 slices from Google's Noto Serif KR TTF.

Usage: python scripts/build-noto-serif-subsets.py /path/to/NotoSerifKR\[wght\].ttf
Requires fonttools[woff].
"""

import argparse
from copy import deepcopy
from pathlib import Path
import re

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont


ROOT = Path(__file__).resolve().parent.parent
COMMON_SOURCES = (
    "shared/game/keywords.ts",
    "src/game/dayView.ts",
    "src/game/willLetter.ts",
    "src/screens/ResultScreen.tsx",
    "src/screens/Keyword.tsx",
)
HANGUL_CHUNK_SIZE = 700


def unicode_ranges(codepoints):
    runs = []
    for point in sorted(codepoints):
        if runs and point == runs[-1][1] + 1:
            runs[-1] = (runs[-1][0], point)
        else:
            runs.append((point, point))
    return ", ".join(
        f"U+{first:X}-{last:X}" if first != last else f"U+{first:X}"
        for first, last in runs
    )


def build(source):
    font = instantiateVariableFont(TTFont(source), {"wght": 900}, static=True)
    supported = set(font.getBestCmap())
    hangul = (
        set(range(0xAC00, 0xD7A4))
        | set(range(0x1100, 0x1200))
        | set(range(0x3130, 0x3190))
    ) & supported
    brand = set(map(ord, "미니피아"))
    common = set(range(0x20, 0x7F)) | set(map(ord, "…·→「」“”‘’—"))
    for path in COMMON_SOURCES:
        common.update(map(ord, re.findall(r"[가-힣]", (ROOT / path).read_text())))
    common = (common & supported) - brand
    rare = sorted(hangul - brand - common)
    groups = [("home", brand), ("game", common)] + [
        (f"hangul-{n // HANGUL_CHUNK_SIZE + 1:02}", rare[n : n + HANGUL_CHUNK_SIZE])
        for n in range(0, len(rare), HANGUL_CHUNK_SIZE)
    ]

    output = ROOT / "public/fonts/noto-serif-kr"
    output.mkdir(exist_ok=True)
    lines = ["/* Noto Serif KR 900. 홈과 자주 나오는 게임 문구, 나머지 한글을 글리프 범위별로 로드한다. */"]
    for name, codepoints in groups:
        part = deepcopy(font)
        slicer = subset.Subsetter()
        slicer.populate(unicodes=codepoints)
        slicer.subset(part)
        part.flavor = "woff2"
        part.save(output / f"{name}.woff2", reorderTables=False)
        lines.append(
            f"""@font-face {{
  font-family: "Noto Serif KR";
  src: url("/fonts/noto-serif-kr/{name}.woff2") format("woff2");
  font-style: normal;
  font-weight: 900;
  font-display: swap;
  unicode-range: {unicode_ranges(codepoints)};
}}"""
        )
    (ROOT / "src/styles/serifFont.css").write_text("\n".join(lines) + "\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    build(parser.parse_args().source)

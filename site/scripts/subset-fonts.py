"""Subset LINE Seed JP (400 and 700) to the characters the site renders and write woff2 files.

    pnpm gen:fonts   # uv run --with fonttools --with brotli scripts/subset-fonts.py

Re-run after copy changes: characters outside the subset fall back to the system font.
"""

import argparse
import sys
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont

SITE = Path(__file__).resolve().parents[1]
REPO = SITE.parent
TEXT_GLOBS = [
    (SITE, "src/**/*.astro"),
    (SITE, "src/**/*.ts"),
    (REPO, "ui/src/i18n/messages/ja.ts"),
    (REPO, "ui/src/i18n/messages/en.ts"),
]
# ASCII, Latin-1, general punctuation, arrows, CJK punctuation, kana and full-width forms: short dynamic
# strings such as camera labels stay in the font even when the sources never spell them out.
ALWAYS = [(0x20, 0x7E), (0xA0, 0xFF), (0x2010, 0x2027), (0x2190, 0x21FF), (0x3000, 0x303F),
          (0x3041, 0x3096), (0x309B, 0x309F), (0x30A0, 0x30FF), (0xFF01, 0xFF5E)]
WEIGHTS = {400: "LINESeedJP-Regular.ttf", 700: "LINESeedJP-Bold.ttf"}


def used_codepoints():
    cps = set()
    for base, pattern in TEXT_GLOBS:
        for path in base.glob(pattern):
            if not path.name.endswith(".test.ts"):
                cps.update(ord(c) for c in path.read_text(encoding="utf-8"))
    for lo, hi in ALWAYS:
        cps.update(range(lo, hi + 1))
    return {cp for cp in cps if cp >= 0x20}


def subset_to_woff2(src, cps, out):
    options = subset.Options()
    options.layout_features = ["*"]
    options.name_IDs = ["*"]
    options.notdef_outline = True
    options.hinting = False
    font = TTFont(src)
    subsetter = subset.Subsetter(options)
    subsetter.populate(unicodes=cps)
    subsetter.subset(font)
    # TTFont.save ignores Options.flavor, so the flavor goes on the font itself.
    font.flavor = "woff2"
    font.save(out)
    print(f"{out.name}: {len(font.getBestCmap())} glyphs, {out.stat().st_size} bytes", file=sys.stderr)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--src", default=Path.home() / "Library/Fonts", type=Path, help="folder with the LINE Seed JP TTFs")
    parser.add_argument("--out", default=SITE / "src/assets/fonts", type=Path)
    args = parser.parse_args()

    cps = used_codepoints()
    args.out.mkdir(parents=True, exist_ok=True)
    for weight, name in WEIGHTS.items():
        subset_to_woff2(args.src / name, cps, args.out / f"line-seed-jp-{weight}.woff2")


if __name__ == "__main__":
    main()

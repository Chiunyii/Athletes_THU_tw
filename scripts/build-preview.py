# 產生單一檔案的預覽頁（把 js/data.js、js/game.js 內嵌進 index.html），給 Claude 的 Artifact 預覽用
# 用法：python3 scripts/build-preview.py 輸出路徑.html
import re, sys
from pathlib import Path

root = Path(__file__).resolve().parent.parent
out = Path(sys.argv[1] if len(sys.argv) > 1 else "athletic-portal.html")
s = (root / "index.html").read_text(encoding="utf-8")
# 拿掉 <!-- PREVIEW-STRIP --> 標記之間的 doctype/head/body 外殼（Artifact 會自己包）
s = re.sub(r"^.*?<!-- /PREVIEW-STRIP -->\n", "", s, count=1, flags=re.S)
s = re.sub(r"<!-- PREVIEW-STRIP -->.*?<!-- /PREVIEW-STRIP -->\n?", "", s, flags=re.S)
d = (root / "js/data.js").read_text(encoding="utf-8")
g = (root / "js/game.js").read_text(encoding="utf-8")
s = s.replace('<script src="js/data.js"></script>', "<script>\n" + d + "\n</script>")
for f in ("js/sheet-snapshot.js", "js/sheet.js"):
    s = s.replace(f'<script src="{f}"></script>', "<script>\n" + (root / f).read_text(encoding="utf-8") + "\n</script>")
s = s.replace('<script type="module" src="js/game.js"></script>', '<script type="module">\n' + g + "\n</script>")
s = s.replace('href="list.html"', 'href="#links"').replace('"list.html", false', '"#links", false')
out.write_text(s, encoding="utf-8")
print(f"已產生 {out}（{len(s):,} 字元）")

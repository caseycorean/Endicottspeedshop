"""Copy the current website build into the private ESS staging checkout."""
import argparse
from pathlib import Path
import re
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[2]

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("dist", type=Path, help="Static output of the separate private preview site")
    args = parser.parse_args()
    target = args.dist.resolve()
    if target.name != "dist" or target == ROOT / "dist":
        parser.error("Use the private staging checkout's dist directory")
    tracked = subprocess.check_output(["git", "ls-files", "-z"], cwd=ROOT).decode().split("\0")
    static_roots = ("about/", "articles/", "assets/", "build/", "contact/", "experience/",
                    "plan/", "privacy/", "tools/", "weight-distribution-calculator/")
    written = set()
    for item in tracked:
        if item not in ("index.html", "logo-round.png", "logo-horizontal-tight.png") and not item.startswith(static_roots):
            continue
        source = ROOT / item
        dest = target / item
        dest.parent.mkdir(parents=True, exist_ok=True)
        written.add(dest)
        if source.suffix != ".html":
            shutil.copyfile(source, dest)
            continue
        markup = source.read_text()
        markup = re.sub(r"<script\b[^>]*>.*?</script>", lambda m:
                        "" if any(word in m.group() for word in ("googletagmanager.com", "gtag('config'", "tool-events.js"))
                        else m.group(), markup, flags=re.S)
        markup = re.sub(r'^<link rel="canonical"[^>]+>\s*', "", markup, flags=re.M)
        if 'name="robots"' not in markup:
            markup = markup.replace("<head>", '<head>\n<meta name="robots" content="noindex,nofollow">', 1)
        dest.write_text(markup)
    robots = target / "robots.txt"
    robots.write_text("User-agent: *\nDisallow: /\n")
    written.add(robots)
    for path in target.rglob("*"):
        if path.is_file() and path not in written:
            path.unlink()

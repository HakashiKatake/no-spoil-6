"""Create unpacked Manifest V3 folders and ZIPs for each browser family."""

import json
import shutil
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "extension"
OUTPUT = ROOT / "dist"
SITE_DOWNLOADS = ROOT / "website" / "downloads"

FIREFOX_SETTINGS = {
    "gecko": {
        "id": "no-spoil-6@extension.local",
        "strict_min_version": "140.0",
        "data_collection_permissions": {"required": ["none"]},
    },
    "gecko_android": {"strict_min_version": "142.0"},
}


def build(target):
    folder = OUTPUT / target
    if folder.exists():
        shutil.rmtree(folder)
    shutil.copytree(SOURCE, folder, ignore=shutil.ignore_patterns(".DS_Store"))

    manifest_path = folder / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if target != "chromium":
        manifest["background"] = {"scripts": ["shared/settings.js", "background/worker.js"]}
    if target == "firefox":
        manifest["browser_specific_settings"] = FIREFOX_SETTINGS
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")

    archive = OUTPUT / f"no-spoil-6-{target}.zip"
    with ZipFile(archive, "w", compression=ZIP_DEFLATED) as package:
        for path in sorted(folder.rglob("*")):
            if path.is_file():
                package.write(path, path.relative_to(folder))
    SITE_DOWNLOADS.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(archive, SITE_DOWNLOADS / archive.name)
    print(archive.relative_to(ROOT))


if __name__ == "__main__":
    for browser in ("chromium", "firefox", "safari"):
        build(browser)

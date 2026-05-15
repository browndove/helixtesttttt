#!/usr/bin/env python3
"""Patch proxy routes to append facility_id for internal-admin upstream calls."""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PROXY_DIR = ROOT / "src" / "app" / "api" / "proxy"

SKIP_PREFIXES = (
    "auth/",
    "internal/facilities",
    "internal/act-as",
    "internal/exit-act-as",
    "facility-select/",
    "presence/online",
)

SKIP_FILES = {
    "facilities/route.ts",
}

IMPORT_LINE = (
    "import { buildTenantUpstreamUrl, mergeFacilityIntoBody } from '@/lib/proxy-upstream';"
)

URL_CONST_RE = re.compile(
    r"(?P<indent>\s*)const url = `\$\{API_BASE_URL\}(?P<path>/api/v1/[^`]+)`;\s*\n",
    re.MULTILINE,
)

INLINE_FETCH_RE = re.compile(
    r"(?P<indent>\s*)const res = await fetch\(`\$\{API_BASE_URL\}(?P<path>/api/v1/[^`]+)`,\s*\{",
    re.MULTILINE,
)


def rel(path: Path) -> str:
    return str(path.relative_to(PROXY_DIR)).replace("\\", "/")


def should_skip(path: Path) -> bool:
    r = rel(path)
    if r in SKIP_FILES:
        return True
    return any(r.startswith(p) for p in SKIP_PREFIXES)


def ensure_import(content: str) -> str:
    if "from '@/lib/proxy-upstream'" in content:
        return content
    lines = content.splitlines(keepends=True)
    insert_at = 0
    for i, line in enumerate(lines):
        if line.startswith("import "):
            insert_at = i + 1
    lines.insert(insert_at, IMPORT_LINE + "\n")
    return "".join(lines)


def patch_url_const(match: re.Match[str], content: str) -> str:
    indent = match.group("indent")
    api_path = match.group("path")
    replacement = (
        f"{indent}const upstream = await buildTenantUpstreamUrl(req, API_BASE_URL, `{api_path}`);\n"
        f"{indent}if (upstream instanceof NextResponse) return upstream;\n"
        f"{indent}const {{ url }} = upstream;\n"
    )
    return content[: match.start()] + replacement + content[match.end() :]


def patch_inline_fetch(match: re.Match[str], content: str) -> str:
    indent = match.group("indent")
    api_path = match.group("path")
    replacement = (
        f"{indent}const upstream = await buildTenantUpstreamUrl(req, API_BASE_URL, `{api_path}`);\n"
        f"{indent}if (upstream instanceof NextResponse) return upstream;\n"
        f"{indent}const {{ url }} = upstream;\n"
        f"{indent}const res = await fetch(url, {{"
    )
    return content[: match.start()] + replacement + content[match.end() :]


def add_body_facility_merge(content: str) -> str:
    """When upstream block is immediately followed by req.json(), merge facility into body."""
    pattern = re.compile(
        r"(const upstream = await buildTenantUpstreamUrl\([^\n]+\n"
        r"\s*if \(upstream instanceof NextResponse\) return upstream;\n"
        r"\s*const \{ url \} = upstream;\n)"
        r"(\s*const body = await req\.json\(\)[^\n]*\n)"
        r"(?!\s*const payload = mergeFacilityIntoBody)",
        re.MULTILINE,
    )

    def repl(m: re.Match[str]) -> str:
        upstream_block = m.group(1)
        body_line = m.group(2)
        indent = re.match(r"(\s*)", body_line).group(1)
        return (
            upstream_block
            + body_line
            + f"{indent}const payload = mergeFacilityIntoBody(\n"
            + f"{indent}    body as Record<string, unknown>,\n"
            + f"{indent}    upstream.facilityId,\n"
            + f"{indent});\n"
        )

    return pattern.sub(repl, content)


def fix_json_body_refs(content: str) -> str:
    # Only replace in handlers that now define payload after merge
    if "mergeFacilityIntoBody" not in content:
        return content
    return re.sub(
        r"body: JSON\.stringify\(body\),",
        "body: JSON.stringify(payload),",
        content,
    )


def process_file(path: Path) -> bool:
    if should_skip(path):
        return False
    content = path.read_text()
    if "API_BASE_URL" not in content or "/api/v1/" not in content:
        return False
    if "buildTenantUpstreamUrl" in content:
        return False

    original = content
    changed = False

    while True:
        m = URL_CONST_RE.search(content)
        if not m:
            break
        content = patch_url_const(m, content)
        changed = True

    while True:
        m = INLINE_FETCH_RE.search(content)
        if not m:
            break
        content = patch_inline_fetch(m, content)
        changed = True

    if not changed:
        return False

    content = ensure_import(content)
    content = add_body_facility_merge(content)
    content = fix_json_body_refs(content)
    path.write_text(content)
    return content != original


def main() -> int:
    changed_files: list[str] = []
    for path in sorted(PROXY_DIR.rglob("route.ts")):
        if process_file(path):
            changed_files.append(rel(path))
    print(f"Patched {len(changed_files)} files:")
    for f in changed_files:
        print(f"  - {f}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

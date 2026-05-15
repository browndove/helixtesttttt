#!/usr/bin/env python3
"""Fix proxy routes where body: JSON.stringify(payload) lacks payload definition."""

from __future__ import annotations

import re
from pathlib import Path

PROXY_DIR = Path(__file__).resolve().parents[1] / "src" / "app" / "api" / "proxy"

UPSTREAM_BLOCK = re.compile(
    r"(const upstream = await buildTenantUpstreamUrl\([^\n]+\n"
    r"\s*if \(upstream instanceof NextResponse\) return upstream;\n"
    r"\s*const \{ url \} = upstream;\n)"
    r"(?!\s*const payload = )",
    re.MULTILINE,
)

# Handlers that build their own `payload` before upstream — do not inject merge.
CUSTOM_PAYLOAD_MARKERS = (
    "const payload = {",
    "const payload: Record",
    "let payload =",
)


def fix_file(path: Path) -> bool:
    content = path.read_text()
    if "JSON.stringify(payload)" not in content:
        return False
    if "mergeFacilityIntoBody" not in content:
        content = content.replace(
            "from '@/lib/proxy-upstream';",
            "from '@/lib/proxy-upstream';\n",
        )
        if "buildTenantUpstreamUrl" in content and "mergeFacilityIntoBody" not in content:
            content = content.replace(
                "import { buildTenantUpstreamUrl } from '@/lib/proxy-upstream';",
                "import { buildTenantUpstreamUrl, mergeFacilityIntoBody } from '@/lib/proxy-upstream';",
            )
            content = content.replace(
                "import { buildTenantUpstreamUrl, mergeFacilityIntoBody } from '@/lib/proxy-upstream';\nimport { buildTenantUpstreamUrl, mergeFacilityIntoBody } from '@/lib/proxy-upstream';",
                "import { buildTenantUpstreamUrl, mergeFacilityIntoBody } from '@/lib/proxy-upstream';",
            )

    original = content

    def inject_merge(match: re.Match[str]) -> str:
        block = match.group(1)
        # Look back in content before match for `const body` in same try block
        before = content[: match.start()]
        if "const body" not in before[-800:] and "let body" not in before[-800:]:
            return match.group(0)
        if any(marker in before[-1200:] for marker in CUSTOM_PAYLOAD_MARKERS):
            return match.group(0)
        indent = re.search(r"\n(\s*)const upstream", block).group(1) if re.search(r"\n(\s*)const upstream", block) else "        "
        return (
            block
            + f"{indent}const payload = mergeFacilityIntoBody(\n"
            + f"{indent}    body as Record<string, unknown>,\n"
            + f"{indent}    upstream.facilityId,\n"
            + f"{indent});\n"
        )

    content = UPSTREAM_BLOCK.sub(inject_merge, content)

    if content != original:
        path.write_text(content)
        return True
    return False


def main() -> None:
    fixed = []
    for path in sorted(PROXY_DIR.rglob("route.ts")):
        if fix_file(path):
            fixed.append(str(path.relative_to(PROXY_DIR)))
    print(f"Fixed {len(fixed)} files")
    for f in fixed:
        print(f"  - {f}")


if __name__ == "__main__":
    main()

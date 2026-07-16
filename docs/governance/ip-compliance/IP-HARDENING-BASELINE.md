# PMFreak IP Hardening Baseline

- UTC timestamp: 2026-07-15T19:52:17Z
- Repository path: /workspace/pmfreak
- Working branch: chore/ip-hardening-sprint
- Base commit reviewed: 7c5e94cff489d4c4ba17305efd18b2c4b3c30d92
- Initial git status: clean before sprint changes.
- Remotes: none configured in this container.
- Package manager evidence: package-lock.json lockfileVersion 3; npm scripts present.
- Root package: name pmfreak, private true, license absent before sprint.
- Workspaces: no root workspaces property observed. Internal package manifests observed at src/aoc/protocol/package.json and src/aoc/enterprise/package.json.
- Potentially publishable packages: AOC package manifests contain restricted GitHub Packages publishConfig; root package is private.
- Root license files found before sprint: none.
- License/notice scan exclusions: node_modules, .git, .next, coverage, dist, build, tmp.
- Tools used: git status, git branch, git rev-parse, git remote, find, rg, node package metadata inspection.

## Preliminary Risks

| Risk | Evidence | Status |
| --- | --- | --- |
| Root package lacked explicit proprietary license marker | package.json had private true but no license property in preflight | Mitigated by adding UNLICENSED |
| No root COPYRIGHT/NOTICE | find maxdepth 3 found no root license/notice files | Mitigated in sprint |
| No reproducible third-party inventory/SBOM | no artifacts/compliance inventory or SBOM before sprint | Mitigated in sprint |
| AOC package publication path exists | src/aoc package manifests have restricted publishConfig | Documented release/publication gate |
| Assets require provenance review | public/ and docs/ui-reference images found | Documented pending provenance |

## Ownership Differentiation

PMFreak proprietary source, product-specific documentation, configuration, and proprietary assets are treated separately from third-party dependencies, AOC package components, generated artifacts, screenshots, fonts/images, SDKs, APIs, and external services. No conclusion in this baseline is a legal determination; items without repository evidence are marked for legal or operational follow-up.

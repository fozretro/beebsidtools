# Cursor rules & skills for BeebSID Tools

| Path | Purpose |
|------|---------|
| [rules/package-boundaries.mdc](rules/package-boundaries.mdc) | `src.create` / `src.player` / `src.app` separation |
| [rules/preview-hosts.mdc](rules/preview-hosts.mdc) | Node vs browser jsbeeb preview |
| [rules/architecture-lineage.mdc](rules/architecture-lineage.mdc) | Active toolchain vs parent-repo archive (not in this tree) |
| [rules/historic-conversations.mdc](rules/historic-conversations.mdc) | Lifted Cursor chats in `.tmp/conversations/` |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Longer lineage / design narrative |
| [skills/run-beebsidtools/](skills/run-beebsidtools/) | CLI + React run/test workflow |

Rules live in this directory (workspace root `.cursor/`). Historic parent-project chats are local-only under `.tmp/conversations/` (gitignored); see that rule before reconstructing “why”.

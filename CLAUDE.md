# CLAUDE.md

> Claude Code specific instructions. For general project context, see [AGENTS.md](./AGENTS.md).

## Claude Code Configuration

This file provides Claude Code specific guidance. The full project documentation is in [AGENTS.md](./AGENTS.md).

### Key Documentation Reference

| Need | Reference |
|------|-----------|
| Project overview, tech stack, structure | [AGENTS.md](./AGENTS.md) |
| Product requirements | `docs/PRD.md` |
| Implementation order | `docs/roadmap.md` |
| CLI interface | `docs/cli-specification.md` |
| Type definitions | `src/types.ts` |

### Claude Code Specific Notes

**When working in this repository:**

1. **Read AGENTS.md first** - It contains the full project context, structure, and conventions.

2. **Prompts are locked** - Never modify `docs/prompts.md` without explicit user approval.

3. **Test coverage required** - New modules must have >80% coverage. Always run tests after changes:
   ```bash
   npm test
   npm run test:coverage
   ```

4. **Documentation-first approach** - This project has comprehensive specs in `docs/`. Reference them before implementing.

### Future: MCP Integration (Phase 2)

This tool will expose an MCP server for Claude Code:

```json
{
  "mcpServers": {
    "whichmodel": {
      "command": "npx",
      "args": ["-y", "whichmodel-mcp"]
    }
  }
}
```

---

**See [AGENTS.md](./AGENTS.md) for complete project documentation.**

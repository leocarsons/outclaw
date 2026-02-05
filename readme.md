# Outclaw

CLI tool for managing Claude Code Skills - A complete registry system.

## Installation

```bash
npm install -g outclaw
```

## Usage

### Create a new skill

```bash
# Interactive mode
outclaw init

# With name
outclaw init my-skill

# Create in global directory
outclaw init my-skill --global
```

### Install a skill

```bash
# From GitHub
outclaw install github:owner/repo
outclaw install github:owner/repo@branch

# From GitHub (shorthand)
outclaw install owner/repo

# From URL
outclaw install https://github.com/owner/repo

# Install globally
outclaw install github:owner/repo --global
```

### List installed skills

```bash
# List all skills
outclaw list

# List only global skills
outclaw list --global

# List only project skills
outclaw list --project

# Output as JSON
outclaw list --json
```

### Search for skills

```bash
outclaw search <query>

# Limit results
outclaw search react --limit 10
```

### Show skill info

```bash
outclaw info my-skill
```

### Uninstall a skill

```bash
outclaw uninstall my-skill

# Uninstall global skill
outclaw uninstall my-skill --global
```

## Claude Code Skills Format

Skills follow the [Agent Skills](https://agentskills.io) open standard.

### Directory Structure

```
my-skill/
├── SKILL.md           # Main instructions (required)
├── references/        # Reference documentation (optional)
├── examples/          # Example outputs (optional)
└── scripts/           # Executable scripts (optional)
```

### SKILL.md Format

```yaml
---
name: my-skill
description: What this skill does and when to use it
version: 1.0.0
disable-model-invocation: false
user-invocable: true
allowed-tools: Read, Grep, Glob
argument-hint: [file-path]
---

Your skill instructions here...
```

### Frontmatter Options

| Field | Description |
|-------|-------------|
| `name` | Skill name (lowercase, alphanumeric, hyphens) |
| `description` | What the skill does (used for trigger matching) |
| `version` | Semantic version |
| `disable-model-invocation` | Prevent automatic triggering |
| `user-invocable` | Allow manual invocation via `/skill-name` |
| `allowed-tools` | Tools that can be used without permission |
| `argument-hint` | Hint for autocomplete |
| `model` | Override model for this skill |
| `context` | Run in `fork` for isolated subagent |
| `agent` | Subagent type when using `context: fork` |

### Skills Location

- **Global**: `~/.claude/skills/<skill-name>/SKILL.md`
- **Project**: `.claude/skills/<skill-name>/SKILL.md`

## Using as a Claude Code Skill

You can create a skill to help manage skills:

```yaml
---
name: outclaw
description: Manage Claude Code skills - create, install, search, and publish
disable-model-invocation: true
allowed-tools: Bash
---

Use outclaw CLI to manage Claude Code skills:

- Create new skill: `outclaw init <name>`
- Install skill: `outclaw install <skill>`
- List skills: `outclaw list`
- Search skills: `outclaw search <query>`
```

## License

MIT

---
name: outclaw
description: Manage Claude Code skills using the outclaw CLI - create, install, list, search, and publish skills
disable-model-invocation: true
user-invocable: true
allowed-tools: Bash
---

# Outclaw - Claude Code Skills Manager

Use the `outclaw` CLI to manage Claude Code skills.

## Available Commands

### Create a new skill
```bash
outclaw init [skill-name]
outclaw init my-skill --global
```

### Install a skill from GitHub
```bash
outclaw install github:owner/repo
outclaw install owner/repo
outclaw install github:owner/repo@branch
```

### List installed skills
```bash
outclaw list
outclaw list --global
outclaw list --json
```

### Search for skills
```bash
outclaw search <query>
```

### Show skill info
```bash
outclaw info <skill-name>
```

### Uninstall a skill
```bash
outclaw uninstall <skill-name>
outclaw uninstall <skill-name> --global
```

## Usage Notes

- Use `--global` flag to operate on `~/.claude/skills/` (global skills)
- Without `--global`, operates on `.claude/skills/` (project skills)
- After installing or creating a skill, use `/<skill-name>` in Claude Code to invoke it

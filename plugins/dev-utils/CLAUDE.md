# dev-utils

Development utilities and personal vault knowledge management.

## Skills

| Skill                     | Purpose                                                           |
| ------------------------- | ----------------------------------------------------------------- |
| `using-dev-utils`         | Establishes skill invocation discipline at conversation start     |
| `brainstorming`           | Collaborative design exploration before implementation            |
| `writing-plans`           | Create detailed implementation plans from specs                   |
| `executing-plans`         | Execute implementation plans task-by-task                         |
| `test-driven-development` | TDD workflow for features and bugfixes                            |
| `search`                  | Query the personal vault via qmd                                  |
| `session`                 | Capture session insights as a vault note                          |
| `record`                  | Record mid-conversation knowledge (decisions, research, notes...) |

## Agents

| Agent                    | Purpose                                                               | Tools            |
| ------------------------ | --------------------------------------------------------------------- | ---------------- |
| `implementer`            | Implements a single plan task — code, tests, commit, self-review      | All except Agent |
| `spec-reviewer`          | Verifies implementation matches spec (nothing missing, nothing extra) | Read-only        |
| `code-quality-reviewer`  | Reviews code quality, design, and maintainability                     | Read-only        |
| `spec-document-reviewer` | Reviews spec documents for completeness and planning readiness        | Read-only        |
| `plan-document-reviewer` | Reviews plans for completeness, spec alignment, task decomposition    | Read-only        |
| `research`               | Gathers project context without modifying anything                    | Read-only + Bash |

## Hooks

| Event              | Matcher       | Script                     | Purpose                                                                        |
| ------------------ | ------------- | -------------------------- | ------------------------------------------------------------------------------ |
| `UserPromptSubmit` | —             | `prompt-skill-reminder.sh` | Injects skill reminders when prompt mentions decisions, learnings, or sessions |
| `PostToolUse`      | `Write\|Edit` | `vault-note-indexer.sh`    | Runs `qmd update && qmd embed` when a vault `.md` is written or edited         |
| `PreToolUse`       | `Bash`        | `qmd-dehyphenate.sh`       | De-hyphenates `qmd search` queries (BM25 tokenizes on hyphens)                 |

## Plugin Configuration

- `vault_path` — Absolute path to the personal vault root

The qmd collection name `judi-vault` is hardcoded.

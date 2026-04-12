# dev-utils

Development utilities and personal vault knowledge management.

## Skills

| Skill                    | Purpose                                                           |
| ------------------------ | ----------------------------------------------------------------- |
| `using-dev-utils`        | Establishes skill invocation discipline at conversation start     |
| `brainstorming`          | Collaborative design exploration before implementation            |
| `writing-plans`          | Create detailed implementation plans from specs                   |
| `executing-plans`        | Execute implementation plans task-by-task                         |
| `test-driven-development`| TDD workflow for features and bugfixes                            |
| `search`                 | Query the personal vault via qmd                                  |
| `session`                | Capture session insights as a vault note                          |
| `record`                 | Record mid-conversation knowledge (decisions, research, notes...) |

## Plugin Configuration

- `vault_path` — Absolute path to the personal vault root

The qmd collection name `judi-vault` is hardcoded. The SessionStart hook
creates `repos/<project-name>/` under the vault path for each project.

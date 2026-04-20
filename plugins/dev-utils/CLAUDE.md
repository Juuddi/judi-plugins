# dev-utils

Development utilities: planning, execution, TDD, and issue creation workflows.

## Skills

| Skill                     | Purpose                                                            |
| ------------------------- | ------------------------------------------------------------------ |
| `using-dev-utils`         | Establishes skill invocation discipline at conversation start      |
| `brainstorming`           | Collaborative design exploration before implementation             |
| `writing-plans`           | Create detailed implementation plans from specs                    |
| `executing-plans`         | Execute implementation plans task-by-task                          |
| `test-driven-development` | TDD workflow for features and bugfixes                             |
| `creating-issues`         | Research codebase and file GitHub issues from a user-provided list |

## Agents

| Agent                    | Purpose                                                               | Tools            |
| ------------------------ | --------------------------------------------------------------------- | ---------------- |
| `implementer`            | Implements a single plan task — code, tests, commit, self-review      | All except Agent |
| `spec-reviewer`          | Verifies implementation matches spec (nothing missing, nothing extra) | Read-only        |
| `code-quality-reviewer`  | Reviews code quality, design, and maintainability                     | Read-only        |
| `spec-document-reviewer` | Reviews spec documents for completeness and planning readiness        | Read-only        |
| `plan-document-reviewer` | Reviews plans for completeness, spec alignment, task decomposition    | Read-only        |
| `research`               | Gathers project context without modifying anything                    | Read-only + Bash |

## Related

Personal vault capture and search (`record`, `session`, `search`) moved to the
separate `knowledge-vault` plugin.

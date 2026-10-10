# Project Instructions

## Project
Aun no esta expuesta aca

## Architecture
- frontend/: React application.
- backend/: Node.js and Express API.
- .agents/skills/: reusable agent skills.
- docs/: product requirements, architecture and API contracts.

## General rules
- Read existing code before changing it.
- Follow docs/SPEC.md, docs/ARCHITECTURE.md and docs/API.md
  whenever those documents exist.
- Never change the API contract unilaterally.
- Keep changes small and scoped to the requested task.
- Do not introduce unnecessary dependencies.
- Never expose secrets or commit .env files.
- Never claim tests passed unless they were executed.
- Do not overwrite unrelated user changes.

## Scoped instructions
Before modifying frontend/, read frontend/AGENTS.md.
Before modifying backend/, read backend/AGENTS.md.

## Workflow
1. Understand the task and acceptance criteria.
2. Inspect relevant files.
3. Implement the smallest correct change.
4. Run the relevant tests and build.
5. Report changes, verification results and blockers.

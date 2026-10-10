# Frontend Instructions

## Scope
This file applies to frontend/.

## Before coding
- Read the root AGENTS.md.
- Read the frontend architecture skill.
- Inspect package.json and existing source structure.
- Read docs/API.md before integrating with the backend.

## Engineering rules
- Use the project's existing React and TypeScript conventions.
- Keep components focused and reusable.
- Keep API calls separate from presentation components.
- Handle loading, empty, error and success states.
- Validate forms on the client for usability.
- Never treat client-side validation as a security boundary.
- Do not calculate authoritative order totals on the client.
- Preserve accessibility and responsive behavior.

## Testing
- Use the test framework already configured.
- Run the relevant tests and production build.
- Do not modify backend/ or the approved API contract.

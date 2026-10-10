# Backend Instructions

## Scope
This file applies to backend/.

## Before coding
- Read the root AGENTS.md.
- Read the backend architecture skill.
- Inspect package.json and the existing source structure.
- Read docs/API.md before changing endpoints.

## Engineering rules
- Follow the approved API contract.
- Separate routes, controllers, business logic and persistence
  according to the existing architecture.
- Validate all external input.
- Return consistent HTTP status codes and error responses.
- Calculate order totals on the server.
- Validate product existence, quantities and stock on the server.
- Never trust prices or totals submitted by the client.
- Keep secrets in environment variables.
- Do not modify frontend/ or change the API contract unilaterally.

## Testing
- Test successful requests and failure cases.
- Use the test framework already configured.
- Run tests and the production build.
- Report verification results accurately.

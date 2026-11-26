# Contributing to CineMatch AI

Contributions from beginners and experienced developers are welcome. Start by checking existing issues, especially those marked good first issue. Discuss substantial changes before implementation.

## Local development

Follow the [README](README.md) for JDK 25, Maven, Node.js (22.12+), PostgreSQL and TMDB configuration. Fork the repository, clone your fork, and create a descriptive feature branch.

Keep database credentials and TMDB tokens in local environment variables. Never include them in commits, logs or screenshots.

## Quality checks

- Backend: from backend/ run `mvn test` with the local database configured.
- Frontend: from frontend/ run `npm ci`, `npm run lint` and `npm run build`.
- Add regression tests for behavior changes; mock external TMDB requests in automated tests.
- Follow existing controller, service and repository boundaries; avoid unrelated refactors.

## Pull requests

Explain the problem, implementation, verification steps and limitations. Link relevant issues and include screenshots for UI changes. Keep changes focused and respond constructively to review feedback.

By submitting a contribution you agree to license your contribution under the project's MIT license. Do not submit third-party material without permission. TMDB data and imagery remain subject to their own terms.

See the [code of conduct](CODE_OF_CONDUCT.md) and [roadmap](ROADMAP.md).

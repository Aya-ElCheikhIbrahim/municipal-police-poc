# Municipal Police Field Operations App — POC

Proof of Concept for the Tripoli Municipality Digital Transformation Committee.
Built by a Beirut Arab University student team, 12 weeks.

## Repository structure

| Folder | Contents | Owning squad |
|---|---|---|
| `backend/` | Django REST Framework API | Backend |
| `android/` | Officer mobile app (Kotlin) | Android |
| `web/` | Dispatcher & supervisor dashboard | Web |
| `docs/decisions/` | Written decision records | All |
| `docs/api/` | OpenAPI specification | Backend + squad leads |
| `docs/design/` | Mockup source files | All |
| `docs/manuals/` | Arabic user manuals | All |

## Design

Figma mockups — [officer app](https://www.figma.com/design/eVZW8wpfWk3oxAmKCKlULw/Untitled?node-id=0-1) · [web dashboard](https://www.figma.com/design/eVZW8wpfWk3oxAmKCKlULw/Untitled?node-id=6-3043)

Both are in Arabic (RTL) and English. Source HTML files are in `docs/design/`.

Follows Section 8 of the requirements: municipal blue `#1F3864`, accent `#2E5496`,
status colours green `#2E7D32` / amber `#F9A825` / red `#C62828`.
Cairo for Arabic, Inter for English. Minimum 48dp touch targets on mobile.

## Working agreement

1. Never commit directly to `main`. Always branch.
2. Branch naming: `feature/short-description` or `fix/short-description`.
3. Pull `main` every morning before starting work.
4. Open a pull request within 3 days of creating a branch.
5. A squad lead reviews and merges. Authors do not merge their own work.
6. Commit at least once per working day with a meaningful message.
7. Never commit `.env`, API keys, credentials, or database files.

## Daily commands

    git checkout main
    git pull
    git checkout -b feature/my-task

    git add .
    git commit -m "Add mission detail screen"
    git push -u origin feature/my-task

Then open a pull request on GitHub and tell your squad lead.

## Setup

Each folder has its own README with setup instructions for that component.

## Team

See `docs/decisions/000-team-structure.md` for squad assignments and ownership.
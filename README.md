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
| `docs/manuals/` | Arabic user manuals | Design & docs |

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
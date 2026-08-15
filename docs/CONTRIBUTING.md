# Contributing

How we work on this repo. Twelve people, one codebase, 12 weeks.

Read this berfore you push

## The repo

municipal-police-poc/
|--- android/ Officer mobile app 
|--- backend/ API (Django, DRF, PostgreSQL)
|--- web/ Dispatcher dashboard (React, Typescipt)
|--- docs/ Documentation

--------------
**ONLY TOUCH YOUR OWN TEAM FOLDER**
if you need to change soething in another folder, ask the person who owns it. Do not edit it emmidiatly.

## The workflow

Six commands, every single time you start:

git checkout main        # 1. Go to main branch
git pull                 # 2. Get everyone's latest work
git checkout -b feat/ .. # 3. create yoour own braanch

git aadd .
git commit -m "..."
git push -u origin feat/ ...

Then open a Pull Request on github and ask someone to review it.

## Branches names

type/scope-short-description

**Types**:

feat/ (New Functionality)
fix/ (Bug fix)
chore/ (Setup, config, dependencies)
docs/ (documentations only)
refector/ (restructuring without changing behavior)
test/ (adding or fixing tests)

**Scope:** backend, web, android, docs


Example:

feat/backend-shift-endpoints
feat/web-mission-map
feat/android-login-crash
chore/backend-docker

## Commit messages


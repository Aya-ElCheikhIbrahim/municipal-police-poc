# Setup Guide

How to get the project running on your machine

Everyone on the team needs PART1 (backend), because both the web dashboard and the Android app talk to it.
Follow the parts you need below

# Part 1 - Backend for everyone

# 0. Install the tools

git from git-sm.com
Python 3.11+ from python.org (Note: Add Python to PATH during install)
Docker Desktop from docer.com

After installin Docker Desktop, open it and wait until the whale icon in your system tray stops animating, then check:

in cmd: docker --verion, then docker ps

### 1. Clone the repo

git clone https://github.com/Aya-ElCheikhIbrahim/municipal-police-poc.git
cd municipal-police-poc/backend

### 3.Create the Python environment

python -m venv venv
venv\Scripts\activate

Your prompt must start now with (venv). 

On macOS or Linux: `source venv/bin/activate`

### 3. Install the packages

pip install -r requirements.txt

### 4.Create your config file

copy .env.exaample .env

macOS/Linux: `cp .env.example .env`

### 5.Fill in your .enc

opne .env file and set two values:

Generate a secret key: 
python -c "import secrets,string; print(''.join(secrets.choice(string.ascii_letters+string.digits) for _ in range(50)))"

paste the output as SECRET_KEY= .. (with no quotes)

Then set DB_PASSWORD= ..()

### 6.Start teh database:

docker compose up -d

You should see two containers, both running in green, with postgres marked healthy
If postgres says Restarting, see Troubleshooting


### 7.Build the tables:

python manage.py migrate

you should see about 32 lines with ok in green next to them

### 8. Create your account

In order to be  able to login:
python manage.py createsuperuser

It asks the username, full name, badge number, and a passwrod twice. 
The password does not appear as you tupe it, it is normal.

### 9. Run it

python manage.py runserver

Two things to check:
 `http://localhost:8000/api/docs/` — every API endpoint with its request and
 response shapes. This is the contract for both client squads.
- `http://localhost:8000/admin` — log in with the account from step 8.

Stop the server use: Ctrl+C

### Part 2 - Web team

Leave the backend runnign and open a second terminal 

### 1. Install Node.js

node --version
npm --version

### 2. Insall and configure

cd municipal-police-poc/web
npm install

Create a file called `.env` inside `web/`:

VITE_API_URL=http://localhost:8000/api/v1

Without this line, login fails silently, the request goes to undefined/login/

Restart the dev server after creeating or changing .env 

### 3. Run it

npm run dev

Open `http://localhost:5173` and log in with the account from Part 1 step 8 (superuser)

### Part 3 - Android app 

The backend must be running (Part 1 step 9)

### The base URL

localhost does not work from an emulator, inside the emulator
localhost measn the emulator itself, not your computer

Running on: Android emulator, Base URL: `http://10.0.2.2:8000/api/v1`

Running on: Physical device: Base URL: `http://<your-laptop-LAN-IP>:8000/api/v1`

You also need to start Django so it accepts connections from outside your machine:

python manage.py runserver 0.0.0.0.:8000

### Cleartext traffic

Android blockks plain HTTP by default. For local development, add this to "AndroidManifest.xml" inside the <application> tag:

android:usesCleartextTraffic="true"

Without it, requests fail silently with no useful error


### Daily workflow:

Once set up, starting work is:
cd municipal-police-poc/backend
venv\Scripts\activate
ddocker compose up -d
python manage.py runserver

In a second terminal, if you are on web:

cd municipal-police-poc/web
npm run dev

After pullimg changes that touch the backend:

git pull
pip install -r requirements.txt
python manage.py migrate


After pulling changes that touch the web app:

npm install


### Useful commands

"docker compose up -d": docker is still working?
"docker compose logs postgres": why did postgre fail?
"docker compose down": Stop the container (data is not lost)
"docker compose down -v": Stop and delete the database

"python manage.py check": Is the project loading without errors?
"python manage.py showmigrations": whcih migrations have been applied?

"docker compose down -v" followed by "up -d" and "migrate" gives you a clean database in 30s. Useful when somehting is badly stuck. 


## Troubleshooting

| Problem | Cause and fix |
|---|---|
| `docker: command not found` | Docker Desktop is not installed, or not running. Open it and wait for the whale icon to settle. |
| postgres shows `Restarting` | Run `docker compose logs postgres`. The last few lines say why. |
| `ModuleNotFoundError: No module named 'django'` | The venv is not active. Run `venv\Scripts\activate`. |
| `password authentication failed` | `DB_PASSWORD` in `.env` does not match what the container was created with. Run `docker compose down -v`, then `docker compose up -d`, then `migrate`. |
| `port is already allocated` | Something else is using port 5433 or 6379 — often a local PostgreSQL install. Stop it, or ask the backend lead. |
| `variable is not set` warnings from Docker | Your `.env` contains a `$`. Change that value to letters and numbers only. |
| CORS error in the browser console | The dashboard is on a port the backend does not allow. Check Vite is on 5173. |
| Login "works" with any username | `web/.env` is missing, so the API call never happens. See Part 2 step 2. |
| Android requests fail with no error | Missing `usesCleartextTraffic`, or you used `localhost` instead of `10.0.2.2`. |

**When asking for help, post the full error text**, not a screenshot of part of
it. The last line of a Python traceback is usually the useful one, but the
lines above it matter too.



## Notes

**Everyone has their own database.** It runs in a container on your machine and
starts empty. Your teammates' accounts do not exist on your copy — this is
intentional, so nobody breaks anyone else's data.

**The database structure comes from Git.** The migration files in
`backend/*/migrations/` are what `migrate` replays, which is why everyone ends
up with identical tables. Never edit the database by hand — change the model,
generate a migration, commit it.

**Never commit `.env`.** It holds your password and secret key, and it is
gitignored. `.env.example` is the committed template.

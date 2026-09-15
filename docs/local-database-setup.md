# Local Database Setup

Notely uses a locally installed MySQL server for development.

## Prerequisites

- **MySQL 8.0 or newer**, running locally. MySQL 8.4 LTS is recommended; 8.0 reached end of life in April 2026.
- The `mysql` command-line client on your `PATH`
  (Windows default: `C:\Program Files\MySQL\MySQL Server 8.x\bin`).
- An admin account (usually `root`) to run the setup script once.

Check that the server is reachable:

```bash
mysql -u root -p -e "SELECT VERSION();"
```

## 1. Create the databases and application user

[`scripts/db/init.sql`](../scripts/db/init.sql) creates:

| Database        | Purpose                                                  |
| --------------- | -------------------------------------------------------- |
| `notely_dev`    | Local development data                                   |
| `notely_test`   | End-to-end tests (data is wiped between runs)            |
| `notely_shadow` | Temporary database Prisma uses to detect migration drift |

It also creates a `notely` user that can access **only** these three databases, with the
local-development password `change_me_local_password`.

Run the script. You'll be asked for the **root** password:

```bash
npm run db:init
```

The script is idempotent: running it again does not fail or duplicate anything.

**Optional, recommended:** change the default password. Do it in MySQL, never by editing
`init.sql`, so a real password can't end up in git:

```bash
mysql -u root -p -e "ALTER USER 'notely'@'localhost' IDENTIFIED BY 'your-new-password';"
```

## 2. Configure the connection

Copy the example environment file:

```bash
cp .env.example .env
```

It already points at `notely_dev` with the default password. If you changed the password, update it:

```dotenv
DATABASE_URL=mysql://notely:your-new-password@localhost:3306/notely_dev
```

The format is `mysql://USER:PASSWORD@HOST:PORT/DATABASE`. If the password contains special
characters, URL-encode them: `@` → `%40`, `#` → `%23`, `/` → `%2F`, `:` → `%3A`.

## 3. Verify least privilege

```bash
mysql -u notely -p -e "SHOW DATABASES;"
```

You should see only `information_schema`, `performance_schema`, `notely_dev`, `notely_test` and
`notely_shadow`. The `notely` user cannot read any other database on the server.

## Troubleshooting

| Problem                                                   | Fix                                                                                                                                         |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `'mysql' is not recognized`                               | Add the MySQL `bin` folder to your `PATH`, or run the script from MySQL Workbench.                                                          |
| `Can't connect to MySQL server on 'localhost'`            | Start the service: Windows **Services** → `MySQL80` → Start.                                                                                |
| Port 3306 already in use                                  | Another MySQL/MariaDB (e.g. XAMPP) is running. Stop it, or change the port in `DATABASE_URL`.                                               |
| `Access denied for user 'notely'@'127.0.0.1'`             | Your server treats `127.0.0.1` separately from `localhost`. Run the `CREATE USER` and `GRANT` statements again with `'notely'@'127.0.0.1'`. |
| App fails at startup with `Invalid environment variables` | `.env` is missing or `DATABASE_URL` is malformed. Compare it with `.env.example`.                                                           |

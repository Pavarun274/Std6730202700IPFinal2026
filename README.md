# Std6730202700IPFinal2026 — HR Manager & Salary Analytics

Express.js backend + React Native (Expo) frontend.

## Run the backend
```
cd backend && npm install && npm start
```
Runs on http://localhost:3000.

## Run the frontend
```
cd frontend && npm install && npx expo start
```
Press `w` to open in the browser.

## Login
Username `admin`, password `password123`.

## Physical phone
Edit `frontend/config.js` and put your computer's LAN IP in place of `localhost`
(e.g. `http://192.168.1.10:3000`). The Android emulator uses `10.0.2.2` automatically.

## Search
`GET /api/employees?search=<text>` (Bearer token required) returns employees whose
name, position or status contains the text (case-insensitive, trimmed). A missing or
empty `search` returns all employees. `GET /api/employees/salary-clusters` always
uses all employees. The app debounces typing by 300ms and keeps the search applied
after add/toggle/delete.

## Edit employee
`PUT /api/employees/:id` (Bearer token required) with JSON body `{ name, position, salary }`.
Same validation as create: `400` if a field is missing/blank or salary is not a number > 0,
`404` if the id does not exist, `401` without a token. Returns `200` with the updated
employee (id and status unchanged). `PUT /api/employees/:id/status` still toggles status.
In the app, press **Edit** on a card to edit inline, then **Save** or **Cancel**.

## Troubleshooting
If Expo shows `EMFILE: too many open files`, run `brew install watchman`
or `ulimit -n 65536`.

## Database setup
Employees are stored in MySQL table `ProPav_employee`. The schema and seed rows are in
`backend/schema.sql`. `backend/ProPav_employee.sql` is the phpMyAdmin export of the live table from the
instructor's server (database `ip_std6730202700`), and can be imported instead. Columns are prefixed `ProPav_` (`ProPav_id`, `ProPav_name`, `ProPav_position`,
`ProPav_status`, `ProPav_salary`, `ProPav_created_at`, `ProPav_updated_at`); the API still returns
`{ id, name, position, status, salary }`:

```sql
CREATE TABLE IF NOT EXISTS ProPav_employee (
  ProPav_id INT AUTO_INCREMENT PRIMARY KEY,
  ProPav_name VARCHAR(100) NOT NULL,
  ProPav_position VARCHAR(100) NOT NULL,
  ProPav_status ENUM('Active','On Leave') NOT NULL DEFAULT 'Active',
  ProPav_salary DECIMAL(12,2) NOT NULL,
  ProPav_created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ProPav_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT INTO ProPav_employee (ProPav_name, ProPav_position, ProPav_status, ProPav_salary) VALUES
  ('John Doe', 'Software Engineer', 'Active', 45000),
  ('Jane Smith', 'Junior Developer', 'Active', 18500),
  ('Somchai Jaidee', 'Technical Lead', 'On Leave', 85000),
  ('Mali Rakdee', 'QA Tester', 'Active', 19000),
  ('David Chen', 'Product Manager', 'Active', 72000),
  ('Anna Lee', 'Designer', 'On Leave', 38000),
  ('Peter Parker', 'Intern', 'Active', 15000),
  ('Nok Sriwong', 'Senior Engineer', 'Active', 58000);
```

Then configure credentials:

```
cd backend
cp .env.example .env   # fill in DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
```

`backend/.env` is git-ignored; never commit it. The server logs `DB connected` on startup.

## Deploy on the course server

```
ssh -p 2222 <user>@119.59.102.161
git clone <repo-url>
cd <repo>/backend
npm install
cp .env.example .env     # set PORT=3064, DB_HOST=localhost, DB_PORT=3306, DB_USER, DB_PASSWORD, DB_NAME
pm2 start server.js --name ip-final      # or: nohup node server.js &
```

The API is then available at http://119.59.102.161:3064/api (the frontend default in `frontend/config.js`).

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

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

## Troubleshooting
If Expo shows `EMFILE: too many open files`, run `brew install watchman`
or `ulimit -n 65536`.

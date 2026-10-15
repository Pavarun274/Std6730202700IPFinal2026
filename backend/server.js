require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { kmeans1D } = require('./kmeans');
const db = require('./db');
const { mockEmployees } = require('./mockData');

const app = express();
app.use(cors());
app.use(express.json());

const toEmployee = (r) => ({
  id: String(r.id),
  name: r.name,
  position: r.position,
  status: r.status,
  salary: Number(r.salary),
});

const dbError = (res, err) => {
  console.error(err);
  res.status(500).json({ success: false, message: 'Database error' });
};

const getById = async (id) => {
  const [rows] = await db.query('SELECT * FROM ProPav_employee WHERE id = ?', [id]);
  return rows[0] ? toEmployee(rows[0]) : null;
};

const isBlank = (v) => v === undefined || v === null || String(v).trim() === '';

app.get('/', (req, res) =>
  res.status(200).json({ success: true, message: 'HR backend running. API under /api' })
);

app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  if (isBlank(username) || isBlank(password)) {
    return res.status(400).json({ success: false, message: 'username and password are required' });
  }
  if (username === 'admin' && password === 'password123') {
    return res.status(200).json({ success: true, token: 'mock-jwt-token' });
  }
  res.status(401).json({ success: false, message: 'Invalid username or password' });
});

// Protect every /api/employees route (including salary-clusters).
app.use('/api/employees', (req, res, next) => {
  if (req.headers.authorization !== 'Bearer mock-jwt-token') {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
  next();
});

// Optional ?search=<text>: match on name, position or status.
app.get('/api/employees', async (req, res) => {
  try {
    const raw = Array.isArray(req.query.search) ? req.query.search[0] : req.query.search;
    const q = typeof raw === 'string' ? raw.trim() : '';
    let rows;
    if (!q) {
      [rows] = await db.query('SELECT * FROM ProPav_employee ORDER BY id');
    } else {
      const like = `%${q}%`;
      [rows] = await db.query(
        'SELECT * FROM ProPav_employee WHERE name LIKE ? OR position LIKE ? OR status LIKE ? ORDER BY id',
        [like, like, like]
      );
    }
    res.status(200).json(rows.map(toEmployee));
  } catch (err) {
    dbError(res, err);
  }
});

// Must be declared before any /api/employees/:id route.
app.get('/api/employees/salary-clusters', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT salary FROM ProPav_employee');
    const salaries = rows.map((r) => Number(r.salary));
    const clusters = kmeans1D(salaries, 3).map((c, i) => ({
      group: `Tier ${i + 1}`,
      centroid: c.centroid,
      count: c.count,
    }));
    res.status(200).json({ success: true, clusters });
  } catch (err) {
    dbError(res, err);
  }
});

app.post('/api/employees', async (req, res) => {
  const { name, position, salary } = req.body || {};
  if (isBlank(name) || isBlank(position) || isBlank(salary)) {
    return res.status(400).json({ success: false, message: 'name, position and salary are required' });
  }
  const sal = Number(salary);
  if (!Number.isFinite(sal) || sal <= 0) {
    return res.status(400).json({ success: false, message: 'salary must be a positive number' });
  }
  try {
    const [result] = await db.query(
      "INSERT INTO ProPav_employee (name, position, status, salary) VALUES (?, ?, 'Active', ?)",
      [String(name).trim(), String(position).trim(), sal]
    );
    res.status(201).json(await getById(result.insertId));
  } catch (err) {
    dbError(res, err);
  }
});

app.put('/api/employees/:id', async (req, res) => {
  try {
    if (!(await getById(req.params.id))) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }
    const { name, position, salary } = req.body || {};
    if (isBlank(name) || isBlank(position) || isBlank(salary)) {
      return res.status(400).json({ success: false, message: 'name, position and salary are required' });
    }
    const sal = Number(salary);
    if (!Number.isFinite(sal) || sal <= 0) {
      return res.status(400).json({ success: false, message: 'salary must be a positive number' });
    }
    await db.query('UPDATE ProPav_employee SET name = ?, position = ?, salary = ? WHERE id = ?', [
      String(name).trim(),
      String(position).trim(),
      sal,
      req.params.id,
    ]);
    res.status(200).json(await getById(req.params.id));
  } catch (err) {
    dbError(res, err);
  }
});

app.put('/api/employees/:id/status', async (req, res) => {
  try {
    const [result] = await db.query(
      "UPDATE ProPav_employee SET status = IF(status = 'Active', 'On Leave', 'Active') WHERE id = ?",
      [req.params.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }
    res.status(200).json(await getById(req.params.id));
  } catch (err) {
    dbError(res, err);
  }
});

app.delete('/api/employees/:id', async (req, res) => {
  try {
    const emp = await getById(req.params.id);
    if (!emp) return res.status(404).json({ success: false, message: 'Employee not found' });
    await db.query('DELETE FROM ProPav_employee WHERE id = ?', [req.params.id]);
    res.status(200).json({ success: true, employee: emp });
  } catch (err) {
    dbError(res, err);
  }
});

// Malformed JSON and other unexpected errors -> JSON responses, never a crash.
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed' || err instanceof SyntaxError) {
    return res.status(400).json({ success: false, message: 'Malformed JSON body' });
  }
  console.error(err);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

// Seed mockEmployees into ProPav_employee only when the table is empty.
const seedIfEmpty = async () => {
  const [[{ n }]] = await db.query('SELECT COUNT(*) AS n FROM ProPav_employee');
  if (n > 0) {
    console.log(`seed skipped (table has ${n} rows)`);
    return;
  }
  await db.query('INSERT INTO ProPav_employee (name, position, status, salary) VALUES ?', [
    mockEmployees.map((e) => [e.name, e.position, e.status, e.salary]),
  ]);
  console.log(`seeded ${mockEmployees.length} mock employees into ProPav_employee`);
};

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`HR backend listening on 0.0.0.0:${PORT}`);
  db.query('SELECT 1')
    .then(() => console.log('DB connected'))
    .then(seedIfEmpty)
    .catch((err) => console.error('DB startup FAILED:', err.code || '', err.message));
});

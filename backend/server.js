require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { kmeans1D } = require('./kmeans');
const { mysqlRepo, memoryRepo } = require('./repo');

// Chosen once at startup (see bottom of file): MySQL when reachable, otherwise in-memory mock data.
let repo = memoryRepo;

const app = express();
app.use(cors());
app.use(express.json());

const isBlank = (v) => v === undefined || v === null || String(v).trim() === '';

app.get('/', (req, res) =>
  res.status(200).json({ success: true, message: 'HR backend running. API under /api' })
);

app.get('/api/status', (req, res) =>
  res.status(200).json(
    repo.mode === 'mysql'
      ? { success: true, mode: 'mysql', table: repo.table }
      : { success: true, mode: 'memory' }
  )
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
    res.status(200).json(await repo.list(q));
  } catch (err) {
    dbError(res, err);
  }
});

// Must be declared before any /api/employees/:id route.
app.get('/api/employees/salary-clusters', async (req, res) => {
  try {
    const salaries = await repo.salaries();
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
    res.status(201).json(
      await repo.create({ name: String(name).trim(), position: String(position).trim(), salary: sal })
    );
  } catch (err) {
    dbError(res, err);
  }
});

app.put('/api/employees/:id', async (req, res) => {
  try {
    if (!(await repo.get(req.params.id))) {
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
    const updated = await repo.update(req.params.id, {
      name: String(name).trim(),
      position: String(position).trim(),
      salary: sal,
    });
    res.status(200).json(updated);
  } catch (err) {
    dbError(res, err);
  }
});

app.put('/api/employees/:id/status', async (req, res) => {
  try {
    const emp = await repo.toggle(req.params.id);
    if (!emp) return res.status(404).json({ success: false, message: 'Employee not found' });
    res.status(200).json(emp);
  } catch (err) {
    dbError(res, err);
  }
});

app.delete('/api/employees/:id', async (req, res) => {
  try {
    const emp = await repo.remove(req.params.id);
    if (!emp) return res.status(404).json({ success: false, message: 'Employee not found' });
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

const PORT = process.env.PORT || 3000;

(async () => {
  try {
    await mysqlRepo.init();
    repo = mysqlRepo;
    console.log('DB connected');
  } catch (err) {
    console.error('DB startup FAILED:', err.code || '', err.message);
    console.log('DB unavailable \u2013 using in-memory mockData fallback');
    await memoryRepo.init();
    repo = memoryRepo;
  }
  app.listen(PORT, '0.0.0.0', () => console.log(`HR backend listening on 0.0.0.0:${PORT} (${repo.mode})`));
})();

const express = require('express');
const cors = require('cors');
const { kmeans1D } = require('./kmeans');

const app = express();
app.use(cors());
app.use(express.json());

let employees = [
  { id: '1', name: 'John Doe', position: 'Software Engineer', status: 'Active', salary: 45000 },
  { id: '2', name: 'Jane Smith', position: 'Junior Developer', status: 'Active', salary: 18500 },
  { id: '3', name: 'Somchai Jaidee', position: 'Technical Lead', status: 'On Leave', salary: 85000 },
  { id: '4', name: 'Mali Rakdee', position: 'QA Tester', status: 'Active', salary: 19000 },
  { id: '5', name: 'David Chen', position: 'Product Manager', status: 'Active', salary: 72000 },
  { id: '6', name: 'Anna Lee', position: 'Designer', status: 'On Leave', salary: 38000 },
  { id: '7', name: 'Peter Parker', position: 'Intern', status: 'Active', salary: 15000 },
  { id: '8', name: 'Nok Sriwong', position: 'Senior Engineer', status: 'Active', salary: 58000 },
];
let nextId = 9;

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

// Optional ?search=<text>: case-insensitive match on name, position or status.
app.get('/api/employees', (req, res) => {
  const raw = Array.isArray(req.query.search) ? req.query.search[0] : req.query.search;
  const q = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (!q) return res.status(200).json(employees);
  const matches = employees.filter((e) =>
    [e.name, e.position, e.status].some((f) => String(f).toLowerCase().includes(q))
  );
  res.status(200).json(matches);
});

// Must be declared before any /api/employees/:id route.
app.get('/api/employees/salary-clusters', (req, res) => {
  const salaries = employees.map((e) => e.salary);
  const clusters = kmeans1D(salaries, 3).map((c, i) => ({
    group: `Tier ${i + 1}`,
    centroid: c.centroid,
    count: c.count,
  }));
  res.status(200).json({ success: true, clusters });
});

app.post('/api/employees', (req, res) => {
  const { name, position, salary } = req.body || {};
  if (isBlank(name) || isBlank(position) || isBlank(salary)) {
    return res.status(400).json({ success: false, message: 'name, position and salary are required' });
  }
  const sal = Number(salary);
  if (!Number.isFinite(sal) || sal <= 0) {
    return res.status(400).json({ success: false, message: 'salary must be a positive number' });
  }
  const emp = {
    id: String(nextId++),
    name: String(name).trim(),
    position: String(position).trim(),
    status: 'Active',
    salary: sal,
  };
  employees.push(emp);
  res.status(201).json(emp);
});

app.put('/api/employees/:id/status', (req, res) => {
  const emp = employees.find((e) => e.id === req.params.id);
  if (!emp) return res.status(404).json({ success: false, message: 'Employee not found' });
  emp.status = emp.status === 'Active' ? 'On Leave' : 'Active';
  res.status(200).json(emp);
});

app.delete('/api/employees/:id', (req, res) => {
  const idx = employees.findIndex((e) => e.id === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false, message: 'Employee not found' });
  const [removed] = employees.splice(idx, 1);
  res.status(200).json({ success: true, employee: removed });
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
app.listen(PORT, () => console.log(`HR backend listening on http://localhost:${PORT}`));

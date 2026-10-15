// Data access layer. Two implementations share one async interface:
//   list(search) · salaries() · get(id) · create(data) · update(id, data) · toggle(id) · remove(id)
// `get/update/toggle/remove` resolve to null when the id does not exist.
const { mockEmployees } = require('./mockData');

const TABLE = 'ProPav_employee';

const toEmployee = (r) => ({
  id: String(r.id),
  name: r.name,
  position: r.position,
  status: r.status,
  salary: Number(r.salary),
});

const mysqlRepo = {
  mode: 'mysql',
  table: TABLE,

  // Connect and seed mockEmployees when the table is empty. Throws if the DB is unusable.
  async init() {
    const required = ['DB_HOST', 'DB_USER', 'DB_NAME'];
    const missing = required.filter((k) => !process.env[k]);
    if (missing.length) throw new Error(`missing env: ${missing.join(', ')}`);
    this.db = require('./db');
    await this.db.query('SELECT 1');
    const [[{ n }]] = await this.db.query(`SELECT COUNT(*) AS n FROM ${TABLE}`);
    if (n > 0) {
      console.log(`seed skipped (table has ${n} rows)`);
      return;
    }
    await this.db.query(`INSERT INTO ${TABLE} (name, position, status, salary) VALUES ?`, [
      mockEmployees.map((e) => [e.name, e.position, e.status, e.salary]),
    ]);
    console.log(`seeded ${mockEmployees.length} mock employees into ${TABLE}`);
  },

  async list(search) {
    if (!search) {
      const [rows] = await this.db.query(`SELECT * FROM ${TABLE} ORDER BY id`);
      return rows.map(toEmployee);
    }
    const like = `%${search}%`;
    const [rows] = await this.db.query(
      `SELECT * FROM ${TABLE} WHERE name LIKE ? OR position LIKE ? OR status LIKE ? ORDER BY id`,
      [like, like, like]
    );
    return rows.map(toEmployee);
  },

  async salaries() {
    const [rows] = await this.db.query(`SELECT salary FROM ${TABLE}`);
    return rows.map((r) => Number(r.salary));
  },

  async get(id) {
    const [rows] = await this.db.query(`SELECT * FROM ${TABLE} WHERE id = ?`, [id]);
    return rows[0] ? toEmployee(rows[0]) : null;
  },

  async create({ name, position, salary }) {
    const [result] = await this.db.query(
      `INSERT INTO ${TABLE} (name, position, status, salary) VALUES (?, ?, 'Active', ?)`,
      [name, position, salary]
    );
    return this.get(result.insertId);
  },

  async update(id, { name, position, salary }) {
    await this.db.query(`UPDATE ${TABLE} SET name = ?, position = ?, salary = ? WHERE id = ?`, [
      name,
      position,
      salary,
      id,
    ]);
    return this.get(id);
  },

  async toggle(id) {
    const [result] = await this.db.query(
      `UPDATE ${TABLE} SET status = IF(status = 'Active', 'On Leave', 'Active') WHERE id = ?`,
      [id]
    );
    return result.affectedRows === 0 ? null : this.get(id);
  },

  async remove(id) {
    const emp = await this.get(id);
    if (!emp) return null;
    await this.db.query(`DELETE FROM ${TABLE} WHERE id = ?`, [id]);
    return emp;
  },
};

const memoryRepo = {
  mode: 'memory',

  async init() {
    this.rows = mockEmployees.map((e) => ({ ...e, id: String(e.id), salary: Number(e.salary) }));
    this.nextId = this.rows.reduce((m, e) => Math.max(m, Number(e.id)), 0) + 1;
  },

  async list(search) {
    const q = (search || '').toLowerCase();
    const rows = q
      ? this.rows.filter((e) =>
          [e.name, e.position, e.status].some((v) => String(v).toLowerCase().includes(q))
        )
      : this.rows;
    return rows.map((e) => ({ ...e }));
  },

  async salaries() {
    return this.rows.map((e) => e.salary);
  },

  async get(id) {
    const e = this.rows.find((r) => r.id === String(id));
    return e ? { ...e } : null;
  },

  async create({ name, position, salary }) {
    const e = { id: String(this.nextId++), name, position, status: 'Active', salary };
    this.rows.push(e);
    return { ...e };
  },

  async update(id, { name, position, salary }) {
    const e = this.rows.find((r) => r.id === String(id));
    if (!e) return null;
    Object.assign(e, { name, position, salary });
    return { ...e };
  },

  async toggle(id) {
    const e = this.rows.find((r) => r.id === String(id));
    if (!e) return null;
    e.status = e.status === 'Active' ? 'On Leave' : 'Active';
    return { ...e };
  },

  async remove(id) {
    const i = this.rows.findIndex((r) => r.id === String(id));
    if (i === -1) return null;
    return this.rows.splice(i, 1)[0];
  },
};

module.exports = { mysqlRepo, memoryRepo };

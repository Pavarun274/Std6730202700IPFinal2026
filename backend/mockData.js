// Initial mock employee data (the exam's "array of at least 5 mock employees").
// It is seeded into the MySQL table ProPav_employee on server startup, only
// when that table is empty. The `id` field is ignored on insert so that
// AUTO_INCREMENT assigns the real ids.
const mockEmployees = [
  { id: '1', name: 'John Doe', position: 'Software Engineer', status: 'Active', salary: 45000 },
  { id: '2', name: 'Jane Smith', position: 'Junior Developer', status: 'Active', salary: 18500 },
  { id: '3', name: 'Somchai Jaidee', position: 'Technical Lead', status: 'On Leave', salary: 85000 },
  { id: '4', name: 'Mali Rakdee', position: 'QA Tester', status: 'Active', salary: 19000 },
  { id: '5', name: 'David Chen', position: 'Product Manager', status: 'Active', salary: 72000 },
  { id: '6', name: 'Anna Lee', position: 'Designer', status: 'On Leave', salary: 38000 },
  { id: '7', name: 'Peter Parker', position: 'Intern', status: 'Active', salary: 15000 },
  { id: '8', name: 'Nok Sriwong', position: 'Senior Engineer', status: 'Active', salary: 58000 },
];

module.exports = { mockEmployees };

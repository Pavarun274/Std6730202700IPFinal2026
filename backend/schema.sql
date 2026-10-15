CREATE TABLE IF NOT EXISTS ProPav_employee (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  position VARCHAR(100) NOT NULL,
  status ENUM('Active','On Leave') NOT NULL DEFAULT 'Active',
  salary DECIMAL(12,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT INTO ProPav_employee (name, position, status, salary) VALUES
  ('John Doe', 'Software Engineer', 'Active', 45000),
  ('Jane Smith', 'Junior Developer', 'Active', 18500),
  ('Somchai Jaidee', 'Technical Lead', 'On Leave', 85000),
  ('Mali Rakdee', 'QA Tester', 'Active', 19000),
  ('David Chen', 'Product Manager', 'Active', 72000),
  ('Anna Lee', 'Designer', 'On Leave', 38000),
  ('Peter Parker', 'Intern', 'Active', 15000),
  ('Nok Sriwong', 'Senior Engineer', 'Active', 58000);

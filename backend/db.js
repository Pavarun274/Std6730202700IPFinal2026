const mysql = require('mysql2/promise');
const config = require('./dbconfig');

module.exports = mysql.createPool({
  ...config,
  waitForConnections: true,
  connectionLimit: 5,
  connectTimeout: 10000,
});

const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'doin-demo-trial',
  port: process.env.DB_PORT || 3306,
});

// pool.connect((err) => {
//   if (err) {
//     console.error('Database connection error:', err.stack);
//     return;
//   }
//   console.log('Connected to MySQL database.');
// });

async function testConnection() {
  try {
    // Execute a simple query to check if the connection is successful
    const [rows, fields] = await pool.query('SELECT 1');
    console.log('Connected to MySQL database.');
  } catch (err) {
    console.error('Database connection error:', err.stack);
  }
}

const queryDatabase = async (query, params) => {
  try {
    const [rows, fields] = await pool.query(query, params);
    return [rows, fields];  // returns the result of the query
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
};

testConnection();

module.exports = {queryDatabase, pool};
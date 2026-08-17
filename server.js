const {app, server} = require('./app');
const pool = require('./src/config/db');
const { port } = require('./src/config/config.js');

// process.env.TZ = 'UTC';

// Start server
server.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});

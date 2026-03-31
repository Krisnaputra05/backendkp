require('dotenv').config();
const http = require('http');
const app = require('./app');
const { initSocket } = require('./socket');

const PORT = process.env.PORT || 3000;
const server = http.createServer(app);

// Initialize Socket.io only when NOT on Vercel
// Vercel serverless functions do not support long-lived socket connections
if (!process.env.VERCEL) {
  initSocket(server);
  server.listen(PORT, () => {
    const url = `http://localhost:${PORT}`;
    console.log(`Server running at: ${url}`);
  });
}

// Crucial for Vercel: Export the express app as a module
module.exports = app;
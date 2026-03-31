require('dotenv').config();
const http = require('http');
const app = require('./app');
const { initSocket } = require('./socket');

const PORT = process.env.PORT || 3000;

const server = http.createServer(app);

// Initialize Socket.io
initSocket(server);

server.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log(`Server running at: \x1b[36m${url}\x1b[0m`);
});
const { Server } = require('socket.io');
const sessionSocket = require('./session.socket');

let io;

const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: '*', // Allow all for now, configure in production
      methods: ['GET', 'POST']
    }
  });

  io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Initialize individual module sockets
    sessionSocket(io, socket);

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
    });
  });

  return io;
};

const getIO = () => {
  if (!io) {
    console.warn('Socket.io not initialized (Expected on Vercel/Serverless)');
    return null;
  }
  return io;
};

module.exports = { initSocket, getIO };

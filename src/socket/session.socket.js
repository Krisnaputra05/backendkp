module.exports = (io, socket) => {
  // Join Session Room (Queue-based)
  socket.on('join:session', (sessionId) => {
    socket.join(`session:${sessionId}`);
    console.log(`Socket ${socket.id} joined session:${sessionId}`);
  });

  // Join Role Room (e.g. 'cashier', 'kitchen', 'admin')
  socket.on('join:role', (role) => {
      socket.join(`role:${role}`);
      console.log(`Socket ${socket.id} joined role:${role}`);
  });

  // Call Staff
  socket.on('call:staff', (data) => {
    // Notify cashier/admin room
    io.to('role:cashier').emit('notification:new', {
        title: 'Staff Needed',
        message: `Queue #${data.queueNumber} requested assistance`,
        sessionId: data.sessionId
    });
  });
};

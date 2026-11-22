const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const User = require("../models/user");

let io;

function initSocket(server) {
  io = new Server(server, {
    cors: {
      origin: true,
      credentials: true,
    },
  });

  // Verify user before allowing socket connection.
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;

      if (!token) {
        return next(new Error("Authentication required"));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      const user = await User.findById(decoded.id).select(
        "_id name email role"
      );

      if (!user) {
        return next(new Error("User not found"));
      }

      socket.user = user;
      next();
    } catch (error) {
      next(new Error("Invalid or expired token"));
    }
  });

  io.on("connection", (socket) => {
    const userId = socket.user._id.toString();

    // Every user joins their personal notification room.
    socket.join(`user:${userId}`);

    // Admins also join the common admin notification room.
    if (socket.user.role === "admin") {
      socket.join("admins");
    }

    console.log(`Socket connected: ${socket.user.role} - ${userId}`);

    socket.on("disconnect", () => {
      console.log(`Socket disconnected: ${userId}`);
    });
  });

  return io;
}

function getIO() {
  if (!io) {
    throw new Error("Socket.IO has not been initialized");
  }

  return io;
}

module.exports = {
  initSocket,
  getIO,
};
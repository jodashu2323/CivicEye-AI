
const express = require("express");
const cors = require("cors");
require("dotenv").config();
const http = require("http");
const { spawn } = require("child_process");

const { initSocket } = require("./config/socket");
require("./config/notificationAutomation");

const connectDB = require("./config/db");

const app = express();

// Ollama configuration
const OLLAMA_URL = (
  process.env.OLLAMA_URL || "http://127.0.0.1:11434"
).replace(/\/$/, "");

// Check whether Ollama is running
async function isOllamaRunning() {
  try {
    const response = await fetch(`${OLLAMA_URL}/api/tags`);
    return response.ok;
  } catch (error) {
    return false;
  }
}

// Start Ollama automatically if it is not running
async function ensureOllamaRunning() {
  const running = await isOllamaRunning();

  if (running) {
    console.log("✅ Ollama is already running.");
    return;
  }

  console.log("⏳ Ollama is not running. Starting Ollama...");

  try {
    const ollamaProcess = spawn("ollama", ["serve"], {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    });

    ollamaProcess.on("error", (error) => {
      console.error("❌ Could not start Ollama:", error.message);
    });

    ollamaProcess.unref();

    // Wait for Ollama to become available
    for (let i = 0; i < 20; i++) {
      await new Promise((resolve) => setTimeout(resolve, 1000));

      if (await isOllamaRunning()) {
        console.log("✅ Ollama started successfully!");
        return;
      }
    }

    console.warn(
      "⚠️ Ollama did not respond. Check Ollama installation and status."
    );
  } catch (error) {
    console.error("❌ Ollama startup error:", error.message);
  }
}

// Connect MongoDB
connectDB();

// Middleware
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// Routes
app.use("/api/auth", require("./routes/auth"));
app.use("/api/issues", require("./routes/issues"));
app.use("/api/admin", require("./routes/admin"));
app.use("/api/ai", require("./routes/ai"));
app.use("/api/assistant", require("./routes/assistant"));

// Notification routes
app.use("/api/notifications", require("./routes/notifications"));

// Test route
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "CivicEye AI Backend is running 🚀",
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error("SERVER ERROR:", err);

  if (res.headersSent) {
    return next(err);
  }

  return res.status(500).json({
    success: false,
    message: "Internal server error.",
  });
});

// HTTP Server + Socket.IO
const PORT = process.env.PORT || 5000;

const server = http.createServer(app);

initSocket(server);

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);

  // Automatically check and start Ollama
  ensureOllamaRunning();
});

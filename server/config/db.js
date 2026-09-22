const mongoose = require('mongoose');
const dns = require('dns');

// Configure reliable DNS servers to prevent SRV lookup failures on Windows/local ISPs
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {}

let isConnecting = false;

const connectDB = async () => {
  if (mongoose.connection.readyState === 1) {
    return true;
  }

  if (isConnecting) {
    // Wait for in-flight connection
    await new Promise(resolve => setTimeout(resolve, 500));
    return mongoose.connection.readyState === 1;
  }

  isConnecting = true;
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/islam_portfolio';

  try {
    const conn = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 8000
    });
    console.log(`[Database] MongoDB Connected: ${conn.connection.host}`);
    isConnecting = false;
    return true;
  } catch (error) {
    console.warn(`[Database] Warning: Could not connect to MongoDB server (${error.message}).`);
    console.warn(`[Database] Running in Fallback / In-Memory cache mode if needed.`);
    isConnecting = false;
    return false;
  }
};

module.exports = connectDB;

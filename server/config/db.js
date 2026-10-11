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

  // Candidate connection URIs in priority order
  const candidates = [];
  if (process.env.MONGODB_URI) candidates.push({ name: 'MONGODB_URI', uri: process.env.MONGODB_URI });
  if (process.env.MONGODB_ATLAS_URI && !candidates.some(c => c.uri === process.env.MONGODB_ATLAS_URI)) {
    candidates.push({ name: 'MongoDB Atlas Cloud', uri: process.env.MONGODB_ATLAS_URI });
  }
  const localTarget = process.env.MONGODB_LOCAL_URI || 'mongodb://127.0.0.1:27017/islam_portfolio';
  if (!candidates.some(c => c.uri === localTarget)) {
    candidates.push({ name: 'Local MongoDB', uri: localTarget });
  }

  for (const candidate of candidates) {
    try {
      const conn = await mongoose.connect(candidate.uri, {
        serverSelectionTimeoutMS: 5000
      });
      console.log(`[Database] MongoDB Connected successfully (${candidate.name}): ${conn.connection.host}`);
      isConnecting = false;
      return true;
    } catch (err) {
      console.warn(`[Database] Could not connect to ${candidate.name} (${err.message}). Trying next fallback...`);
    }
  }

  console.warn(`[Database] Running in Fallback / In-Memory cache mode.`);
  isConnecting = false;
  return false;
};

module.exports = connectDB;


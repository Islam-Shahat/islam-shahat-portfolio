const mongoose = require('mongoose');
const dns = require('dns');

// Configure reliable DNS servers to prevent SRV lookup failures on Windows/local ISPs
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {}

let cached = global.mongoose || (global.mongoose = { conn: null });

async function connectDB() {
  if (cached.conn) return cached.conn;

  const uri = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.MONGODB_ATLAS_URI || 'mongodb://127.0.0.1:27017/islam_portfolio';
  try {
    cached.conn = await mongoose.connect(uri);
    return cached.conn;
  } catch (err) {
    console.warn(`[Database] Mongoose connect error: ${err.message}`);
    return null;
  }
}

module.exports = connectDB;

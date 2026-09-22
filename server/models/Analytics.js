const mongoose = require('mongoose');

const analyticsSchema = new mongoose.Schema({
  date: {
    type: String, // Format: YYYY-MM-DD
    required: true,
    unique: true
  },
  views: {
    type: Number,
    default: 0
  },
  uniqueVisitors: {
    type: Number,
    default: 0
  },
  visitorIPs: {
    type: [String],
    default: []
  }
}, { timestamps: true });

module.exports = mongoose.model('Analytics', analyticsSchema);

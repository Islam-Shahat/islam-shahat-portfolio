const mongoose = require('mongoose');

const educationSchema = new mongoose.Schema({
  degree: { type: String, required: true, trim: true },
  institution: { type: String, required: true, trim: true },
  location: { type: String, default: '' },
  startDate: { type: String, required: true },
  endDate: { type: String, default: 'Present' },
  description: { type: String, default: '' },
  gpa: { type: String, default: '' },
  logo: { type: String, default: '' },
  certificateFile: { type: String, default: '' },
  certificateOriginalName: { type: String, default: '' },
  status: { type: String, enum: ['published', 'draft'], default: 'published' },
  orderIndex: { type: Number, default: 1 }
}, {
  timestamps: true
});

module.exports = mongoose.model('Education', educationSchema);

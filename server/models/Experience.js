const mongoose = require('mongoose');

const experienceSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  company: { type: String, required: true, trim: true },
  location: { type: String, default: '' },
  startDate: { type: String, required: true },
  endDate: { type: String, default: 'Present' },
  current: { type: Boolean, default: false },
  description: { type: String, default: '' },
  skills: [{ type: String, trim: true }],
  companyLogo: { type: String, default: '' },
  certificateFile: { type: String, default: '' },
  certificateOriginalName: { type: String, default: '' },
  status: { type: String, enum: ['published', 'draft'], default: 'published' },
  orderIndex: { type: Number, default: 1 }
}, {
  timestamps: true
});

module.exports = mongoose.model('Experience', experienceSchema);

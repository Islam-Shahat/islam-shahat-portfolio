const mongoose = require('mongoose');

const volunteeringSchema = new mongoose.Schema({
  organization: { type: String, required: true, trim: true },
  role: { type: String, required: true, trim: true },
  location: { type: String, default: '' },
  startDate: { type: String, required: true },
  endDate: { type: String, default: 'Present' },
  description: { type: String, default: '' },
  skills: [{ type: String, trim: true }],
  image: { type: String, default: '' },
  supportingFiles: [{
    path: String,
    originalName: String
  }],
  status: { type: String, enum: ['published', 'draft'], default: 'published' },
  orderIndex: { type: Number, default: 1 }
}, {
  timestamps: true
});

module.exports = mongoose.model('Volunteering', volunteeringSchema);

const mongoose = require('mongoose');

const certificateSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  issuer: { type: String, required: true, trim: true },
  issueDate: { type: String, required: true },
  credentialId: { type: String, default: '' },
  description: { type: String, default: '' },
  image: { type: String, default: '' },
  pdfFile: { type: String, default: '' },
  originalPdfName: { type: String, default: '' },
  status: { type: String, enum: ['published', 'draft'], default: 'published' },
  orderIndex: { type: Number, default: 1 }
}, {
  timestamps: true
});

module.exports = mongoose.model('Certificate', certificateSchema);

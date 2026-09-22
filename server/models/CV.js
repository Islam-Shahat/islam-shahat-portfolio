const mongoose = require('mongoose');

const cvSchema = new mongoose.Schema({
  name: { type: String, required: true, default: 'Islam_Shahat_CV.pdf' },
  version: { type: String, default: '1.0' },
  pdfFile: { type: String, required: true },
  originalName: { type: String, required: true },
  fileSize: { type: Number, default: 0 },
  active: { type: Boolean, default: true },
  fileData: { type: String, default: '' }, // Base64 encoded binary data for persistent serverless storage
  cloudinaryUrl: { type: String, default: '' },
  cloudinaryPublicId: { type: String, default: '' }
}, {
  timestamps: true
});

module.exports = mongoose.model('CV', cvSchema);

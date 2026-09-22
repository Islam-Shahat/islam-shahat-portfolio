const mongoose = require('mongoose');

const testimonialSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Author name is required (اسم صاحب الرأي مطلوب)'],
    trim: true
  },
  role: {
    type: String,
    required: [true, 'Role or title is required (المسمى الوظيفي مطلوب)'],
    trim: true
  },
  company: {
    type: String,
    default: '',
    trim: true
  },
  avatar: {
    type: String,
    default: ''
  },
  rating: {
    type: Number,
    min: 1,
    max: 5,
    default: 5
  },
  content: {
    type: String,
    required: [true, 'Testimonial content is required (نص التوصية مطلوب)'],
    trim: true
  },
  platform: {
    type: String,
    enum: ['LinkedIn', 'Upwork', 'Freelance', 'Colleague', 'Client', 'Other'],
    default: 'LinkedIn'
  },
  screenshotUrl: {
    type: String,
    default: ''
  },
  isFeatured: {
    type: Boolean,
    default: true
  },
  status: {
    type: String,
    enum: ['published', 'draft'],
    default: 'published'
  },
  orderIndex: {
    type: Number,
    default: 0
  }
}, { timestamps: true });

module.exports = mongoose.model('Testimonial', testimonialSchema);

const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  // --- REQUIRED FIELDS (حقول إجبارية) ---
  title: {
    type: String,
    required: [true, 'Project title is required (عنوان المشروع مطلوب)'],
    trim: true
  },
  category: {
    type: String,
    required: [true, 'Project category is required (تصنيف المشروع مطلوب)'],
    trim: true
  },
  description: {
    type: String,
    required: [true, 'Project description is required (وصف المشروع مطلوب)'],
    trim: true
  },
  // Main Cover Image
  coverImage: {
    type: String,
    default: 'assets/img/backend_api.webp'
  },
  // Alias for backward compatibility
  image: {
    type: String,
    default: 'assets/img/backend_api.webp'
  },
  // Multi-image gallery array (3-6 photos per project)
  gallery: {
    type: [String],
    default: []
  },
  // Alias for backward compatibility
  images: {
    type: [String],
    default: []
  },
  date: {
    type: String,
    required: [true, 'Project date is required (تاريخ المشروع مطلوب)'],
    default: '2026'
  },

  // --- OPTIONAL FIELDS (حقول اختيارية) ---
  subtitle: {
    type: String,
    default: '',
    trim: true
  },
  fullDescription: {
    type: String,
    default: '',
    trim: true
  },
  demo: {
    type: String,
    default: '',
    trim: true
  },
  github: {
    type: String,
    default: '',
    trim: true
  },
  technologies: {
    type: [String],
    default: []
  },
  isFeatured: {
    type: Boolean,
    default: false
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

// Sync coverImage and image, gallery and images before saving
projectSchema.pre('save', function (next) {
  if (!this.coverImage && this.image) {
    this.coverImage = this.image;
  }
  if (!this.image && this.coverImage) {
    this.image = this.coverImage;
  }
  if ((!this.gallery || this.gallery.length === 0) && this.images && this.images.length > 0) {
    this.gallery = this.images;
  }
  if ((!this.images || this.images.length === 0) && this.gallery && this.gallery.length > 0) {
    this.images = this.gallery;
  }
  next();
});

module.exports = mongoose.model('Project', projectSchema);

const mongoose = require('mongoose');

const skillSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Skill name is required'],
    trim: true
  },
  category: {
    type: String,
    required: [true, 'Skill category is required'],
    trim: true,
    default: 'Frontend'
  },
  level: {
    type: String,
    enum: ['Advanced', 'Intermediate', 'Basic'],
    default: 'Advanced'
  },
  proficiency: {
    type: Number,
    min: 1,
    max: 100,
    default: 85
  },
  icon: {
    type: String,
    default: 'ri-code-line',
    trim: true
  },
  iconClass: {
    type: String,
    default: 'ri-code-line',
    trim: true
  },
  status: {
    type: String,
    enum: ['published', 'draft'],
    default: 'published'
  },
  active: {
    type: Boolean,
    default: true
  },
  orderIndex: {
    type: Number,
    default: 1
  }
}, {
  timestamps: true
});

// Pre-save middleware to keep icon, iconClass, level, active and status synchronized
skillSchema.pre('save', function (next) {
  if (!this.icon && this.iconClass) this.icon = this.iconClass;
  if (!this.iconClass && this.icon) this.iconClass = this.icon;
  if (!this.icon) this.icon = 'ri-code-line';
  if (!this.iconClass) this.iconClass = 'ri-code-line';

  if (this.active !== undefined && this.status === undefined) {
    this.status = this.active ? 'published' : 'draft';
  } else if (this.status !== undefined) {
    this.active = this.status !== 'draft';
  }

  if (!this.level && this.proficiency) {
    this.level = this.proficiency >= 85 ? 'Advanced' : this.proficiency >= 70 ? 'Intermediate' : 'Basic';
  }

  next();
});

module.exports = mongoose.model('Skill', skillSchema);


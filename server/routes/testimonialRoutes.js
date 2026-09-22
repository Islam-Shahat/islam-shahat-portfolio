const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const Testimonial = require('../models/Testimonial');
const { protect } = require('../middleware/authMiddleware');

const jsonPath = path.join(__dirname, '../../client/assets/data/testimonials.json');

// Helper to read fallback JSON
const getFallbackTestimonials = () => {
  try {
    if (fs.existsSync(jsonPath)) {
      const raw = fs.readFileSync(jsonPath, 'utf8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn('Notice: Error reading testimonials.json fallback:', err.message);
  }
  return [];
};

// Helper to write fallback JSON
const saveFallbackTestimonials = (items) => {
  try {
    fs.writeFileSync(jsonPath, JSON.stringify(items, null, 2), 'utf8');
  } catch (err) {
    console.warn('Notice: Error writing testimonials.json fallback:', err.message);
  }
};

const isMongoReady = () => mongoose.connection.readyState === 1;

const isAuthorizedAdmin = (req) => {
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ') && process.env.JWT_SECRET) {
    try {
      const token = req.headers.authorization.split(' ')[1];
      jwt.verify(token, process.env.JWT_SECRET);
      return true;
    } catch {
      return false;
    }
  }
  return false;
};

// @route   GET /api/testimonials
// @desc    Get all published testimonials (or all drafts if authorized admin)
// @access  Public
router.get('/', async (req, res) => {
  try {
    const includeDrafts = req.query.includeDrafts === 'true' && isAuthorizedAdmin(req);
    
    if (isMongoReady()) {
      const query = includeDrafts ? {} : { status: 'published' };
      let items = await Testimonial.find(query).sort({ orderIndex: 1, createdAt: -1 });
      if (items.length === 0) {
        items = getFallbackTestimonials();
        if (!includeDrafts) {
          items = items.filter(t => t.status !== 'draft');
        }
      }
      return res.json({ success: true, count: items.length, data: items });
    }

    let items = getFallbackTestimonials();
    if (!includeDrafts) {
      items = items.filter(t => t.status !== 'draft');
    }
    return res.json({ success: true, count: items.length, data: items });
  } catch (error) {
    console.error('Error fetching testimonials:', error);
    let items = getFallbackTestimonials();
    return res.json({ success: true, count: items.length, data: items });
  }
});

// @route   POST /api/testimonials
// @desc    Create new testimonial
// @access  Admin Private
router.post('/', protect, async (req, res) => {
  try {
    const { name, role, company, avatar, rating, content, platform, screenshotUrl, isFeatured, status, orderIndex } = req.body;

    if (!name || !role || !content) {
      return res.status(400).json({ success: false, message: 'الاسم والمسمى الوظيفي ونص التوصية حقول إجبارية' });
    }

    const payload = {
      name: name.trim(),
      role: role.trim(),
      company: (company || '').trim(),
      avatar: (avatar || '').trim(),
      rating: Number(rating) || 5,
      content: content.trim(),
      platform: platform || 'LinkedIn',
      screenshotUrl: (screenshotUrl || '').trim(),
      isFeatured: isFeatured !== undefined ? isFeatured : true,
      status: status || 'published',
      orderIndex: Number(orderIndex) || 0
    };

    if (isMongoReady()) {
      const created = await Testimonial.create(payload);
      return res.status(201).json({ success: true, message: 'تمت إضافة الرأي بنجاح', data: created });
    }

    // Fallback JSON mode
    const items = getFallbackTestimonials();
    const newDoc = { _id: Date.now().toString(), id: Date.now().toString(), ...payload, createdAt: new Date().toISOString() };
    items.push(newDoc);
    saveFallbackTestimonials(items);

    return res.status(201).json({ success: true, message: 'تمت إضافة الرأي بنجاح (وضع الملفات)', data: newDoc });
  } catch (error) {
    console.error('Error creating testimonial:', error);
    return res.status(500).json({ success: false, message: 'فشل حفظ الرأي', error: error.message });
  }
});

// @route   PUT /api/testimonials/:id
// @desc    Update testimonial
// @access  Admin Private
router.put('/:id', protect, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    if (isMongoReady()) {
      const updated = await Testimonial.findByIdAndUpdate(id, updates, { new: true, runValidators: true });
      if (!updated) {
        return res.status(404).json({ success: false, message: 'التوصية غير موجودة' });
      }
      return res.json({ success: true, message: 'تم تحديث البيانات بنجاح', data: updated });
    }

    // Fallback JSON mode
    let items = getFallbackTestimonials();
    const index = items.findIndex(t => (t._id && t._id.toString() === id) || (t.id && t.id.toString() === id));
    if (index === -1) {
      return res.status(404).json({ success: false, message: 'التوصية غير موجودة' });
    }
    items[index] = { ...items[index], ...updates, updatedAt: new Date().toISOString() };
    saveFallbackTestimonials(items);

    return res.json({ success: true, message: 'تم تحديث البيانات بنجاح', data: items[index] });
  } catch (error) {
    console.error('Error updating testimonial:', error);
    return res.status(500).json({ success: false, message: 'فشل التحديث', error: error.message });
  }
});

// @route   DELETE /api/testimonials/:id
// @desc    Delete testimonial
// @access  Admin Private
router.delete('/:id', protect, async (req, res) => {
  try {
    const { id } = req.params;

    if (isMongoReady()) {
      const deleted = await Testimonial.findByIdAndDelete(id);
      if (!deleted) {
        return res.status(404).json({ success: false, message: 'التوصية غير موجودة' });
      }
      return res.json({ success: true, message: 'تم حذف التوصية بنجاح' });
    }

    // Fallback JSON mode
    let items = getFallbackTestimonials();
    const initialLen = items.length;
    items = items.filter(t => (t._id && t._id.toString() !== id) && (t.id && t.id.toString() !== id));
    if (items.length === initialLen) {
      return res.status(404).json({ success: false, message: 'التوصية غير موجودة' });
    }
    saveFallbackTestimonials(items);

    return res.json({ success: true, message: 'تم حذف التوصية بنجاح' });
  } catch (error) {
    console.error('Error deleting testimonial:', error);
    return res.status(500).json({ success: false, message: 'فشل الحذف', error: error.message });
  }
});

module.exports = router;

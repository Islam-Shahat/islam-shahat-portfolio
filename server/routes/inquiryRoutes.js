const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const mongoose = require('mongoose');
const Inquiry = require('../models/Inquiry');
const { protect } = require('../middleware/authMiddleware');

const isMongoReady = () => mongoose.connection.readyState === 1;

// In-memory fallback inquiries array
const fallbackInquiries = [
  {
    _id: 'inq-sample-1',
    name: 'أحمد محمود',
    email: 'ahmed.mahmoud@example.com',
    subject: 'استفسار عن تطوير تطبيق ويب',
    message: 'مرحباً إسلام، أريد الاستفسار عن إمكانية بناء نظام إدارة عقارات باستخدام MEAN Stack.',
    status: 'unread',
    createdAt: new Date()
  }
];

// Strict Contact Rate Limiter: 5 messages per 15 minutes per IP
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many messages sent from this IP. Please wait 15 minutes before sending another message. (تم إرسال عدد كبير من الرسائل من هذا الجهاز، يرجى الانتظار 15 دقيقة).'
  }
});

// Validation & Sanitization Middleware
const validateInquiry = [
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required (الاسم مطلوب)')
    .isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters')
    .escape(),
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required (البريد الإلكتروني مطلوب)')
    .isEmail().withMessage('Please provide a valid email address (يرجى كتابة بريد إلكتروني صالح)')
    .normalizeEmail(),
  body('message')
    .trim()
    .notEmpty().withMessage('Message is required (نص الرسالة مطلوب)')
    .isLength({ min: 5, max: 5000 }).withMessage('Message must be between 5 and 5000 characters')
    .escape(),
  body('subject')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .escape()
];

// @route   POST /api/inquiries
// @desc    Submit a new contact message/inquiry with sanitization, bot prevention & rate limiting
// @access  Public
router.post('/', contactLimiter, validateInquiry, async (req, res) => {
  try {
    // 1. Honeypot Bot Trap: if hidden bot field is filled, silently discard without saving
    if (req.body._website_url || req.body._gotcha || req.body.hp_website) {
      console.log(`[Security Alert] Bot submission trapped and silently dropped from IP: ${req.ip}`);
      return res.status(200).json({
        success: true,
        message: 'Thank you! Your message has been sent successfully.'
      });
    }

    // 2. Input Validation Results
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: errors.array()[0].msg,
        errors: errors.array()
      });
    }

    // 3. NoSQL Injection Prevention: ensure inputs are strictly primitive strings
    const { name, email, subject, message } = req.body;
    if (typeof name !== 'string' || typeof email !== 'string' || typeof message !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Invalid input format.'
      });
    }

    const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    let createdInq = null;
    if (isMongoReady()) {
      const inquiry = new Inquiry({
        name: name.trim(),
        email: email.trim(),
        subject: (typeof subject === 'string' && subject.trim()) || `Portfolio Contact Inquiry from ${name.trim()}`,
        message: message.trim(),
        ipAddress
      });
      createdInq = await inquiry.save();
    } else {
      createdInq = {
        _id: 'inq-' + Date.now(),
        name: name.trim(),
        email: email.trim(),
        subject: (typeof subject === 'string' && subject.trim()) || `Portfolio Contact Inquiry from ${name.trim()}`,
        message: message.trim(),
        status: 'unread',
        createdAt: new Date(),
        ipAddress
      };
      fallbackInquiries.unshift(createdInq);
    }

    res.status(201).json({
      success: true,
      message: 'Thank you! Your message has been sent successfully. (تم إرسال رسالتك بنجاح وسنقوم بالرد عليك في أقرب وقت)',
      data: createdInq
    });
  } catch (error) {
    console.error('Error submitting inquiry:', error);
    res.status(500).json({ success: false, message: 'Failed to send message. Please try again later.' });
  }
});

// ==================== ADMIN PROTECTED ROUTES ====================

const handleGetInquiries = async (req, res) => {
  try {
    if (isMongoReady()) {
      const inquiries = await Inquiry.find().sort({ createdAt: -1 });
      const unreadCount = await Inquiry.countDocuments({ status: 'unread' });
      return res.json({ success: true, count: inquiries.length, unreadCount, data: inquiries });
    }

    const unreadCount = fallbackInquiries.filter(i => i.status === 'unread').length;
    res.json({
      success: true,
      count: fallbackInquiries.length,
      unreadCount,
      data: fallbackInquiries
    });
  } catch (error) {
    console.error('Error fetching inquiries:', error);
    res.status(500).json({ success: false, message: 'Server error loading inquiries' });
  }
};

router.get('/', protect, handleGetInquiries);
router.get('/admin/inquiries', protect, handleGetInquiries);

const handleUpdateInquiryStatus = async (req, res) => {
  try {
    const status = req.body && req.body.status ? req.body.status : (req.path.includes('read') ? 'read' : 'read');
    const id = req.params.id;
    let updated = null;

    if (isMongoReady()) {
      updated = await Inquiry.findByIdAndUpdate(id, { status }, { new: true });
    }
    const item = fallbackInquiries.find(i => i._id === id);
    if (item) item.status = status;
    res.json({ success: true, message: 'Status updated', data: updated || item || { _id: id, status } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

router.patch('/:id/status', protect, handleUpdateInquiryStatus);
router.put('/:id/status', protect, handleUpdateInquiryStatus);
router.patch('/:id/read', protect, handleUpdateInquiryStatus);
router.put('/:id/read', protect, handleUpdateInquiryStatus);
router.patch('/admin/inquiries/:id/status', protect, handleUpdateInquiryStatus);
router.put('/admin/inquiries/:id/status', protect, handleUpdateInquiryStatus);

const handleDeleteInquiry = async (req, res) => {
  try {
    const id = req.params.id;
    if (isMongoReady()) {
      await Inquiry.findByIdAndDelete(id);
    }
    const idx = fallbackInquiries.findIndex(i => i._id === id);
    if (idx !== -1) fallbackInquiries.splice(idx, 1);

    res.json({ success: true, message: 'Inquiry deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

router.delete('/:id', protect, handleDeleteInquiry);
router.delete('/admin/inquiries/:id', protect, handleDeleteInquiry);

module.exports = router;

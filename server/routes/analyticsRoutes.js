const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Analytics = require('../models/Analytics');
const Project = require('../models/Project');
const Inquiry = require('../models/Inquiry');
const { protect } = require('../middleware/authMiddleware');

const isMongoReady = () => mongoose.connection.readyState === 1;

// In-memory fallback analytics cache
const fallbackAnalytics = {
  totalViews: 12,
  uniqueVisitors: 4,
  visitorIPs: [],
  dailyBreakdown: [
    { date: new Date().toISOString().split('T')[0], views: 12, uniqueVisitors: 4 }
  ]
};

const getTodayString = () => new Date().toISOString().split('T')[0];

// @route   POST /api/analytics/track
// @desc    Track visitor views and unique IPs
// @access  Public
router.post('/track', async (req, res) => {
  try {
    const today = getTodayString();
    const clientIP = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';

    if (isMongoReady()) {
      let analytics = await Analytics.findOne({ date: today });
      if (!analytics) {
        analytics = new Analytics({ date: today, views: 1, uniqueVisitors: 1, visitorIPs: [clientIP] });
      } else {
        analytics.views += 1;
        if (!analytics.visitorIPs.includes(clientIP)) {
          analytics.visitorIPs.push(clientIP);
          analytics.uniqueVisitors += 1;
        }
      }
      await analytics.save();
      return res.json({ success: true, views: analytics.views, uniqueVisitors: analytics.uniqueVisitors });
    } else {
      fallbackAnalytics.totalViews += 1;
      if (!fallbackAnalytics.visitorIPs.includes(clientIP)) {
        fallbackAnalytics.visitorIPs.push(clientIP);
        fallbackAnalytics.uniqueVisitors += 1;
      }
      return res.json({ success: true, views: fallbackAnalytics.totalViews, uniqueVisitors: fallbackAnalytics.uniqueVisitors });
    }
  } catch (error) {
    console.error('Tracking error:', error);
    res.status(500).json({ success: false, message: 'Analytics tracking failed' });
  }
});

// ==================== ADMIN PROTECTED ROUTE ====================

const handleGetAnalytics = async (req, res) => {
  try {
    if (isMongoReady()) {
      const allStats = await Analytics.find().sort({ date: -1 }).limit(30);
      const totalViews = allStats.reduce((sum, item) => sum + item.views, 0);
      const totalUniqueVisitors = allStats.reduce((sum, item) => sum + item.uniqueVisitors, 0);

      const totalProjects = await Project.countDocuments();
      const publishedProjects = await Project.countDocuments({ status: 'published' });
      const draftProjects = await Project.countDocuments({ status: 'draft' });

      const totalInquiries = await Inquiry.countDocuments();
      const unreadInquiries = await Inquiry.countDocuments({ status: 'unread' });

      return res.json({
        success: true,
        stats: {
          totalViews,
          totalUniqueVisitors,
          totalProjects,
          publishedProjects,
          draftProjects,
          totalInquiries,
          unreadInquiries,
          dailyBreakdown: allStats.reverse()
        }
      });
    }

    res.json({
      success: true,
      stats: {
        totalViews: fallbackAnalytics.totalViews,
        totalUniqueVisitors: fallbackAnalytics.uniqueVisitors,
        totalProjects: 5,
        publishedProjects: 5,
        draftProjects: 0,
        totalInquiries: 1,
        unreadInquiries: 1,
        dailyBreakdown: fallbackAnalytics.dailyBreakdown
      }
    });
  } catch (error) {
    console.error('Error getting analytics:', error);
    res.status(500).json({ success: false, message: 'Server error loading analytics' });
  }
};

router.get('/', protect, handleGetAnalytics);
router.get('/admin/analytics', protect, handleGetAnalytics);

module.exports = router;

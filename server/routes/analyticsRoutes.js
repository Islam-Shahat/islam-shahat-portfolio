const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Analytics = require('../models/Analytics');
const Project = require('../models/Project');
const Inquiry = require('../models/Inquiry');
const { protect } = require('../middleware/authMiddleware');
const connectDB = require('../config/db');

// Check if MongoDB connection is ready and auto-reconnect if needed
const ensureDb = async () => {
  if (mongoose.connection.readyState !== 1) {
    try { await connectDB(); } catch (e) {}
  }
  return mongoose.connection.readyState === 1;
};
const isMongoReady = () => mongoose.connection.readyState === 1;

// Helper to read projects from fallback JSON if MongoDB is not available
const jsonProjectsPath = path.join(__dirname, '../../client/assets/data/projects.json');
const getFallbackProjects = () => {
  try {
    if (fs.existsSync(jsonProjectsPath)) {
      const raw = fs.readFileSync(jsonProjectsPath, 'utf8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn('Notice: Error reading projects.json for analytics:', err.message);
  }
  return [];
};

// In-memory fallback analytics cache initialized to 0
const fallbackAnalytics = {
  totalViews: 0,
  uniqueVisitors: 0,
  visitorIPs: [],
  dailyBreakdown: [
    { date: new Date().toISOString().split('T')[0], views: 0, uniqueVisitors: 0 }
  ]
};

const getTodayString = () => new Date().toISOString().split('T')[0];

// @route   POST /api/analytics/track
// @desc    Track visitor views and unique IPs
// @access  Public
router.post('/track', async (req, res) => {
  try {
    await ensureDb();
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
    await ensureDb();

    if (isMongoReady()) {
      const allStats = await Analytics.find().sort({ date: -1 }).limit(30);
      const totalViews = allStats.reduce((sum, item) => sum + item.views, 0);

      // Extract unique IPs across all recorded days
      const allIPs = new Set();
      allStats.forEach(item => {
        if (Array.isArray(item.visitorIPs)) {
          item.visitorIPs.forEach(ip => allIPs.add(ip));
        }
      });
      const totalUniqueVisitors = allIPs.size > 0 
        ? allIPs.size 
        : allStats.reduce((sum, item) => sum + item.uniqueVisitors, 0);

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

    // Dynamic Fallback mode using real local data files
    const fallbackProjects = getFallbackProjects();
    const totalProjects = fallbackProjects.length;
    const publishedProjects = fallbackProjects.filter(p => p.status !== 'draft').length;
    const draftProjects = fallbackProjects.filter(p => p.status === 'draft').length;

    res.json({
      success: true,
      stats: {
        totalViews: fallbackAnalytics.totalViews || 0,
        totalUniqueVisitors: fallbackAnalytics.uniqueVisitors || 0,
        totalProjects,
        publishedProjects,
        draftProjects,
        totalInquiries: 0,
        unreadInquiries: 0,
        dailyBreakdown: fallbackAnalytics.dailyBreakdown || []
      }
    });
  } catch (error) {
    console.error('Error getting analytics:', error);
    const fallbackProjects = getFallbackProjects();
    res.json({
      success: true,
      stats: {
        totalViews: fallbackAnalytics.totalViews || 0,
        totalUniqueVisitors: fallbackAnalytics.uniqueVisitors || 0,
        totalProjects: fallbackProjects.length,
        publishedProjects: fallbackProjects.filter(p => p.status !== 'draft').length,
        draftProjects: fallbackProjects.filter(p => p.status === 'draft').length,
        totalInquiries: 0,
        unreadInquiries: 0,
        dailyBreakdown: fallbackAnalytics.dailyBreakdown || []
      }
    });
  }
};

router.get('/', protect, handleGetAnalytics);
router.get('/admin/analytics', protect, handleGetAnalytics);

module.exports = router;

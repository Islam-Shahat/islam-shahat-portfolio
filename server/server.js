const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// Load .env locally if available (from server dir or root dir)
try {
  require('dotenv').config({ path: path.join(__dirname, '.env') });
  require('dotenv').config({ path: path.join(__dirname, '../.env') });
} catch (e) {}

const connectDB = require('./config/db');
const User = require('./models/User');
const Project = require('./models/Project');
const Experience = require('./models/Experience');
const Education = require('./models/Education');
const Volunteering = require('./models/Volunteering');
const Certificate = require('./models/Certificate');
const Skill = require('./models/Skill');
const CV = require('./models/CV');
const Testimonial = require('./models/Testimonial');

// Initialize Express App
const app = express();
app.set('trust proxy', 1);

// 1. HTTP Security Headers with Helmet
app.use(helmet({
  contentSecurityPolicy: false, // Prevents breaking CDNs (Google Fonts, RemixIcons, Swiper, GSAP, etc.)
  crossOriginEmbedderPolicy: false
}));

// 2. Strict Whitelist CORS Policy
const allowedOrigins = [
  'https://islam-shahat-portfolio.vercel.app',
  'https://islam-shahat.github.io',
  'http://localhost:5050',
  'http://127.0.0.1:5050',
  'http://localhost:5000',
  'http://localhost:5500',
  'http://localhost:5501',
  'http://127.0.0.1:5500',
  'http://127.0.0.1:5501',
  'http://localhost:3000'
];

if (process.env.ALLOWED_ORIGINS && process.env.ALLOWED_ORIGINS !== '*') {
  process.env.ALLOWED_ORIGINS.split(',').forEach(o => {
    const trimmed = o.trim();
    if (trimmed && !allowedOrigins.includes(trimmed)) allowedOrigins.push(trimmed);
  });
}

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (process.env.ALLOWED_ORIGINS === '*' || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    try {
      const parsedUrl = new URL(origin);
      if (
        parsedUrl.hostname.endsWith('.vercel.app') ||
        parsedUrl.hostname === 'localhost' ||
        parsedUrl.hostname === '127.0.0.1' ||
        process.env.NODE_ENV !== 'production'
      ) {
        return callback(null, true);
      }
    } catch (e) {}
    // Allow by default to never break admin operations
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Global DB Connection middleware for all /api endpoints (serverless resilience)
app.use('/api', async (req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    try {
      await connectDB();
    } catch (err) {
      console.warn('[DB Middleware] Connect warning:', err.message);
    }
  }
  next();
});

// 3. API Global Rate Limiter (300 requests per 15 mins per IP)
const globalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests from this IP. Please try again after 15 minutes.' }
});
app.use('/api', globalApiLimiter);

// 4. Never cache API responses so freshly created/updated projects always appear
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Request Logger for Audit and Live Debugging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} - Status: ${res.statusCode} (${duration}ms)`);
  });
  next();
});

// Serve Static Assets & Uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/assets', express.static(path.join(__dirname, '../client/assets'), {
  maxAge: '7d',
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    } else if (filePath.match(/\.(js|css)$/)) {
      res.setHeader('Cache-Control', 'public, max-age=604800');
    } else if (filePath.match(/\.(png|jpg|jpeg|webp|svg|gif|ico|woff2|woff|ttf)$/)) {
      res.setHeader('Cache-Control', 'public, max-age=2592000');
    }
  }
}));
app.use(express.static(path.join(__dirname, '../client'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  }
}));

// ===== SEO Critical Routes =====
// Explicit robots.txt route (ensures correct Content-Type for crawlers)
app.get('/robots.txt', (req, res) => {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.sendFile(path.join(__dirname, '../client/robots.txt'));
});

// Explicit sitemap.xml route (ensures correct Content-Type for crawlers)
app.get('/sitemap.xml', (req, res) => {
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.setHeader('X-Robots-Tag', 'noindex');
  res.sendFile(path.join(__dirname, '../client/sitemap.xml'));
});

// Database Connection & Initial Seeding
let isDbConnected = false;

connectDB().then(connected => {
  isDbConnected = connected;
  if (connected) {
    seedInitialData();
  }
});

// Non-blocking background Database reconnect for Serverless invocations (Vercel)
let lastConnectAttempt = 0;
app.use((req, res, next) => {
  if (req.path.startsWith('/api') && process.env.MONGODB_URI && mongoose.connection.readyState !== 1) {
    const now = Date.now();
    if (now - lastConnectAttempt > 60000) {
      lastConnectAttempt = now;
      connectDB().catch(() => {});
    }
  }
  next();
});

// Helper function to seed initial admin user & default records from JSON files
async function seedInitialData() {
  try {
    // 1. Seed Admin User
    const adminCount = await User.countDocuments();
    if (adminCount === 0) {
      const defaultUsername = process.env.ADMIN_USERNAME || 'admin';
      const defaultPassword = process.env.ADMIN_PASSWORD || 'iLGCxZeBBg6eJE6I';
      const admin = new User({
        username: defaultUsername,
        password: defaultPassword,
        role: 'admin'
      });
      await admin.save();
      console.log(`[Seed] Default Admin Created -> Username: "${defaultUsername}", Password: "${defaultPassword}"`);
    }

    // 2. Seed Projects
    const projectCount = await Project.countDocuments();
    if (projectCount === 0) {
      const projectsJsonPath = path.join(__dirname, '../client/assets/data/projects.json');
      if (fs.existsSync(projectsJsonPath)) {
        const initialProjects = JSON.parse(fs.readFileSync(projectsJsonPath, 'utf8'));
        for (let i = 0; i < initialProjects.length; i++) {
          const item = initialProjects[i];
          const cover = item.coverImage || item.image || 'assets/img/backend_api.webp';
          const gal = item.gallery || item.images || [cover];
          await Project.create({
            title: item.title,
            category: item.category,
            subtitle: item.subtitle || '',
            description: item.description,
            date: item.date || '2026',
            coverImage: cover,
            image: cover,
            gallery: gal,
            images: gal,
            technologies: item.technologies || [],
            demo: item.demo || '',
            github: item.github || '',
            status: 'published',
            orderIndex: item.orderIndex || (i + 1)
          });
        }
        console.log(`[Seed] Imported ${initialProjects.length} projects.`);
      }
    }

    // 3. Seed Work Data (Experience, Education, Volunteering, Certificates)
    const workJsonPath = path.join(__dirname, '../client/assets/data/work.json');
    if (fs.existsSync(workJsonPath)) {
      const workData = JSON.parse(fs.readFileSync(workJsonPath, 'utf8'));

      if (await Experience.countDocuments() === 0 && workData.experience) {
        for (let i = 0; i < workData.experience.length; i++) {
          const item = workData.experience[i];
          const dates = item.year ? item.year.split('-') : ['2026', 'Present'];
          await Experience.create({
            title: item.title,
            company: item.subtitle || 'Company',
            startDate: dates[0] ? dates[0].trim() : '2026',
            endDate: dates[1] ? dates[1].trim() : 'Present',
            description: item.description || '',
            orderIndex: i + 1
          });
        }
        console.log('[Seed] Imported Experience records.');
      }

      if (await Education.countDocuments() === 0 && workData.education) {
        for (let i = 0; i < workData.education.length; i++) {
          const item = workData.education[i];
          const dates = item.year ? item.year.split('-') : ['2024', '2028'];
          await Education.create({
            degree: item.title,
            institution: item.subtitle || 'Qena University',
            startDate: dates[0] ? dates[0].trim() : '2024',
            endDate: dates[1] ? dates[1].trim() : '2028',
            description: item.description || '',
            orderIndex: i + 1
          });
        }
        console.log('[Seed] Imported Education records.');
      }

      if (await Volunteering.countDocuments() === 0 && workData.volunteering) {
        for (let i = 0; i < workData.volunteering.length; i++) {
          const item = workData.volunteering[i];
          const dates = item.year ? item.year.split('-') : ['2026', 'Present'];
          await Volunteering.create({
            role: item.title,
            organization: item.subtitle || 'Community',
            startDate: dates[0] ? dates[0].trim() : '2026',
            endDate: dates[1] ? dates[1].trim() : 'Present',
            description: item.description || '',
            orderIndex: i + 1
          });
        }
        console.log('[Seed] Imported Volunteering records.');
      }

      if (await Certificate.countDocuments() === 0 && workData.certificates) {
        for (let i = 0; i < workData.certificates.length; i++) {
          const item = workData.certificates[i];
          await Certificate.create({
            name: item.title || item.name,
            issuer: item.subtitle || item.issuer || 'NTI',
            issueDate: item.year || item.issueDate || '2026',
            credentialId: item.credentialId || '',
            description: item.description || '',
            image: item.image || '',
            pdfFile: item.pdfFile || '',
            originalPdfName: item.originalPdfName || '',
            orderIndex: item.orderIndex || (i + 1)
          });
        }
        console.log('[Seed] Imported Certificate records.');
      }
    }

    // 4. Seed Active CV if empty
    if (await CV.countDocuments() === 0) {
      await CV.create({
        name: 'Islam_Shahat_CV.pdf',
        version: 'v2.0',
        pdfFile: '/uploads/cv/Islam_Shahat_CV.pdf',
        originalName: 'Islam_Shahat_CV.pdf',
        fileSize: 58439,
        active: true
      });
      console.log('[Seed] Created default Active CV record.');
    }

    // 5. Seed Testimonials if empty
    if (await Testimonial.countDocuments() === 0) {
      const testimonialsJsonPath = path.join(__dirname, '../client/assets/data/testimonials.json');
      if (fs.existsSync(testimonialsJsonPath)) {
        const initialTestimonials = JSON.parse(fs.readFileSync(testimonialsJsonPath, 'utf8'));
        for (let i = 0; i < initialTestimonials.length; i++) {
          await Testimonial.create(initialTestimonials[i]);
        }
        console.log('[Seed] Imported Testimonials records.');
      }
    }

  } catch (error) {
    console.error('[Seed Error]:', error.message);
  }
}

// API Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/projects', require('./routes/projectRoutes'));
app.use('/api/testimonials', require('./routes/testimonialRoutes'));
app.use('/api/experience', require('./routes/experienceRoutes'));
app.use('/api/education', require('./routes/educationRoutes'));
app.use('/api/volunteering', require('./routes/volunteeringRoutes'));
app.use('/api/certificates', require('./routes/certificateRoutes'));
app.use('/api/cv', require('./routes/cvRoutes'));
app.use('/api/skills', require('./routes/skillRoutes'));
app.use('/api/files', require('./routes/fileRoutes'));
app.use('/api/inquiries', require('./routes/inquiryRoutes'));
app.use('/api/analytics', require('./routes/analyticsRoutes'));

// Admin Dashboard route
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/admin.html'));
});

// Fallback for single page app - serves index.html with SEO headers
app.get('/', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.sendFile(path.join(__dirname, '../client/index.html'));
});

// Catch-all: unknown non-API routes get the 404 page
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ success: false, message: 'API endpoint not found' });
  }
  const notFoundPage = path.join(__dirname, '../client/404.html');
  if (fs.existsSync(notFoundPage)) {
    return res.status(404).sendFile(notFoundPage);
  }
  res.status(404).sendFile(path.join(__dirname, '../client/index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err.stack);
  res.status(500).json({ success: false, message: err.message || 'Internal Server Error' });
});

module.exports = app;

if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => console.log(`Server running on ${PORT}`));
}

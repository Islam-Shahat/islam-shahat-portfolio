const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Base uploads directory inside server, or /tmp in serverless environments (Vercel)
const isVercel = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME;
const baseUploadDir = isVercel ? path.join('/tmp', 'uploads') : path.join(__dirname, '../uploads');

// Clean category directories
const dirs = {
  cv: path.join(baseUploadDir, 'cv'),
  certificates: path.join(baseUploadDir, 'certificates'),
  projects: path.join(baseUploadDir, 'projects'),
  documents: path.join(baseUploadDir, 'documents'),
  images: path.join(baseUploadDir, 'images')
};

// Safe directory creator
const ensureDir = (dirPath) => {
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  } catch (e) {
    // Ignore error in read-only environment
  }
};

// Ensure all upload directories exist safely without throwing errors on import
Object.values(dirs).forEach(ensureDir);

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const category = req.body.fileCategory || req.query.category || req.body.category || '';
    const fieldname = file.fieldname ? file.fieldname.toLowerCase() : '';
    const originalName = file.originalname ? file.originalname.toLowerCase() : '';

    let targetDir = dirs.documents;
    if (category === 'cv' || fieldname === 'cv' || originalName.includes('cv') || req.baseUrl.includes('cv')) {
      targetDir = dirs.cv;
    } else if (category === 'certificates' || category === 'certificate' || fieldname === 'certificate' || req.baseUrl.includes('certificate')) {
      targetDir = dirs.certificates;
    } else if (category === 'projects' || category === 'project' || req.baseUrl.includes('project')) {
      targetDir = dirs.projects;
    } else if (file.mimetype.startsWith('image/')) {
      targetDir = dirs.images;
    } else if (file.mimetype.startsWith('video/')) {
      targetDir = dirs.videos;
    }

    ensureDir(targetDir);
    cb(null, targetDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e6);
    const ext = path.extname(file.originalname).toLowerCase();
    const baseName = path.basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9_\u0600-\u06FF-]/g, '_')
      .substring(0, 50);
    cb(null, `${baseName}-${uniqueSuffix}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    // Images
    'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml',
    // PDFs & Documents
    'application/pdf', 'application/zip', 'application/x-zip-compressed',
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    // Videos
    'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Unsupported file type: ${file.mimetype}`), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB general limit
});

// Dedicated strict CV Upload Middleware (PDF only, max 10MB)
const cvFileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (file.mimetype === 'application/pdf' && ext === '.pdf') {
    cb(null, true);
  } else {
    cb(new Error('Invalid file format: Only valid PDF documents (.pdf) are allowed for CV upload.'), false);
  }
};

const uploadCv = multer({
  storage: storage,
  fileFilter: cvFileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB strict limit for CV
});

module.exports = {
  upload,
  uploadCv,
  baseUploadDir,
  dirs
};

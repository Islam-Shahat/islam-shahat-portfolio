const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

const CV = require('../models/CV');
const File = require('../models/File');
const authMiddleware = require('../middleware/authMiddleware');
const { uploadCv } = require('../middleware/uploadMiddleware');
const { initialCv, loadCvsFromFile, saveCvsToFile } = require('../utils/cvStore');
const { uploadToCloudinary } = require('../config/cloudinary');

const isMongoReady = () => mongoose.connection.readyState === 1;

// Path to canonical static PDF
const CLIENT_STATIC_PDF = path.resolve(__dirname, '../../client/assets/pdf/Islam_Shahat_CV.pdf');
const CLIENT_STATIC_PDF_ALT = path.resolve(__dirname, '../client/assets/pdf/Islam_Shahat_CV.pdf');
const getStaticFallbackPdf = () => {
  if (fs.existsSync(CLIENT_STATIC_PDF)) return CLIENT_STATIC_PDF;
  if (fs.existsSync(CLIENT_STATIC_PDF_ALT)) return CLIENT_STATIC_PDF_ALT;
  return null;
};

// Format CV item to include url property
const formatCvItem = (item) => {
  if (!item) return item;
  const obj = typeof item.toObject === 'function' ? item.toObject() : { ...item };
  delete obj.fileData;
  obj.url = obj.cloudinaryUrl || obj.pdfFile || `/api/cv/download/${obj._id || ''}`;
  obj.downloadUrl = `/api/cv/download/${obj._id || ''}`;
  obj.viewUrl = `/api/cv/view/${obj._id || ''}`;
  return obj;
};

const connectDB = require('../config/db');

// Helper to get active CV record instantly without blocking on disconnected DB
async function getActiveCvDoc() {
  if (mongoose.connection.readyState === 1) {
    try {
      let cv = await CV.findOne({ active: true }).sort({ updatedAt: -1, createdAt: -1 });
      if (!cv) cv = await CV.findOne().sort({ updatedAt: -1, createdAt: -1 });
      if (cv) return cv;
    } catch (err) {
      console.warn('[Mongo getActiveCvDoc Warning]:', err.message);
    }
  }
  const fileCvs = loadCvsFromFile();
  return fileCvs.find(x => x.active) || fileCvs[0] || initialCv;
}

// ==========================================
// 1. GET /api/cv/active - Public Metadata
// ==========================================
router.get('/active', async (req, res) => {
  try {
    const activeCv = await getActiveCvDoc();
    return res.json({ success: true, data: formatCvItem(activeCv) });
  } catch (err) {
    console.error('[Get Active CV Error]:', err);
    return res.json({ success: true, data: formatCvItem(initialCv) });
  }
});

// ==========================================
// 2. GET /api/cv/download & /api/cv/download/:id
// Guaranteed Dynamic Binary Download
// ==========================================
const handleDownloadCv = async (req, res) => {
  try {
    const id = req.params.id;
    let cv = null;

    if (id && id !== 'active') {
      if (mongoose.connection.readyState === 1) {
        try {
          if (mongoose.Types.ObjectId.isValid(id)) {
            cv = await CV.findById(id);
          } else {
            cv = await CV.findOne({ _id: id });
          }
        } catch (e) {}
      }
      if (!cv) {
        const fileCvs = loadCvsFromFile();
        cv = fileCvs.find(x => x._id === id);
      }
    }

    if (!cv) {
      cv = await getActiveCvDoc();
    }

    const fileName = (cv && (cv.originalName || cv.name)) || 'Islam_Shahat_CV.pdf';
    const cleanAsciiName = fileName.replace(/[^\w\s.()\-]/g, '_');
    const utf8EncodedName = encodeURIComponent(fileName);

    // 1. If CV has base64 fileData saved in MongoDB (Serverless persistent)
    if (cv && cv.fileData) {
      const buffer = Buffer.from(cv.fileData, 'base64');
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Length', buffer.length);
      res.setHeader('Content-Disposition', `attachment; filename="${cleanAsciiName}"; filename*=UTF-8''${utf8EncodedName}`);
      res.setHeader('Cache-Control', 'public, max-age=60');
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.end(buffer);
    }

    // 2. If CV has a Cloudinary CDN URL
    if (cv && cv.cloudinaryUrl && (cv.cloudinaryUrl.startsWith('http://') || cv.cloudinaryUrl.startsWith('https://'))) {
      return res.redirect(cv.cloudinaryUrl);
    }

    // 3. If CV has a local disk file that exists
    if (cv && cv.pdfFile) {
      let localPath = path.resolve(__dirname, '..', cv.pdfFile.replace(/^[/\\]+/, ''));
      if (fs.existsSync(localPath) && fs.statSync(localPath).isFile()) {
        const stat = fs.statSync(localPath);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Length', stat.size);
        res.setHeader('Content-Disposition', `attachment; filename="${cleanAsciiName}"; filename*=UTF-8''${utf8EncodedName}`);
        return fs.createReadStream(localPath).pipe(res);
      }
    }

    // 4. Fallback to default static Master PDF
    const fallbackPath = getStaticFallbackPdf();
    if (fallbackPath && fs.existsSync(fallbackPath)) {
      const stat = fs.statSync(fallbackPath);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Length', stat.size);
      res.setHeader('Content-Disposition', `attachment; filename="Islam_Shahat_CV.pdf"; filename*=UTF-8''Islam_Shahat_CV.pdf`);
      return fs.createReadStream(fallbackPath).pipe(res);
    }

    return res.status(404).json({ success: false, message: 'CV file not found on server' });
  } catch (err) {
    console.error('[Download CV Error]:', err);
    res.status(500).json({ success: false, message: 'Server error downloading CV' });
  }
};

router.get('/download', handleDownloadCv);
router.get('/download/:id', handleDownloadCv);

// ==========================================
// 3. GET /api/cv/view & /api/cv/view/:id
// In-Browser Inline PDF Preview
// ==========================================
const handleViewCv = async (req, res) => {
  try {
    const id = req.params.id;
    let cv = null;

    if (id && id !== 'active') {
      if (mongoose.connection.readyState === 1) {
        try {
          if (mongoose.Types.ObjectId.isValid(id)) {
            cv = await CV.findById(id);
          } else {
            cv = await CV.findOne({ _id: id });
          }
        } catch (e) {}
      }
      if (!cv) {
        const fileCvs = loadCvsFromFile();
        cv = fileCvs.find(x => x._id === id);
      }
    }

    if (!cv) {
      cv = await getActiveCvDoc();
    }

    const fileName = (cv && (cv.originalName || cv.name)) || 'Islam_Shahat_CV.pdf';
    const cleanAsciiName = fileName.replace(/[^\w\s.()\-]/g, '_');
    const utf8EncodedName = encodeURIComponent(fileName);

    if (cv && cv.fileData) {
      const buffer = Buffer.from(cv.fileData, 'base64');
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Length', buffer.length);
      res.setHeader('Content-Disposition', `inline; filename="${cleanAsciiName}"; filename*=UTF-8''${utf8EncodedName}`);
      res.setHeader('Cache-Control', 'public, max-age=60');
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.end(buffer);
    }

    if (cv && cv.cloudinaryUrl && (cv.cloudinaryUrl.startsWith('http://') || cv.cloudinaryUrl.startsWith('https://'))) {
      return res.redirect(cv.cloudinaryUrl);
    }

    if (cv && cv.pdfFile) {
      let localPath = path.resolve(__dirname, '..', cv.pdfFile.replace(/^[/\\]+/, ''));
      if (fs.existsSync(localPath) && fs.statSync(localPath).isFile()) {
        const stat = fs.statSync(localPath);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Length', stat.size);
        res.setHeader('Content-Disposition', `inline; filename="${cleanAsciiName}"; filename*=UTF-8''${utf8EncodedName}`);
        return fs.createReadStream(localPath).pipe(res);
      }
    }

    const fallbackPath = getStaticFallbackPdf();
    if (fallbackPath && fs.existsSync(fallbackPath)) {
      const stat = fs.statSync(fallbackPath);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Length', stat.size);
      res.setHeader('Content-Disposition', `inline; filename="Islam_Shahat_CV.pdf"; filename*=UTF-8''Islam_Shahat_CV.pdf`);
      return fs.createReadStream(fallbackPath).pipe(res);
    }

    return res.status(404).json({ success: false, message: 'CV file not found' });
  } catch (err) {
    console.error('[View CV Error]:', err);
    res.status(500).json({ success: false, message: 'Server error viewing CV' });
  }
};

router.get('/view', handleViewCv);
router.get('/view/:id', handleViewCv);

// ==========================================
// 4. GET /api/cv - List All CVs
// ==========================================
const handleListCvs = async (req, res) => {
  try {
    // Ensure DB connection is available (non-blocking reconnect for serverless)
    if (mongoose.connection.readyState !== 1) {
      try { await connectDB(); } catch (e) {}
    }
    const cvs = await CV.find().sort({ createdAt: -1 });
    if (cvs.length > 0) return res.json({ success: true, count: cvs.length, data: cvs.map(formatCvItem) });
    const fileCvs = loadCvsFromFile();
    return res.json({ success: true, count: fileCvs.length, data: fileCvs.map(formatCvItem) });
  } catch (err) {
    const fileCvs = loadCvsFromFile();
    return res.json({ success: true, count: fileCvs.length, data: fileCvs.map(formatCvItem) });
  }
};

router.get('/', authMiddleware, handleListCvs);
router.get('/all', authMiddleware, handleListCvs);
router.get('/admin/cv', authMiddleware, handleListCvs);

// ==========================================
// 5. POST /api/cv - Create/Upload New CV
// ==========================================
const handleSaveCv = async (req, res) => {
  try {
    // Ensure DB connection is available (non-blocking reconnect for serverless)
    if (mongoose.connection.readyState !== 1) {
      try { await connectDB(); } catch (e) {}
    }
    const { name, version, pdfFile, active, setAsActive, fileData } = req.body || {};
    const isFileActive = active === true || active === 'true' || setAsActive === true || setAsActive === 'true';

    let finalPdfPath = pdfFile || '/uploads/cv/Islam_Shahat_CV.pdf';
    let originalName = name || 'Islam_Shahat_CV.pdf';
    let fileSize = 74803;
    let base64Data = fileData || '';
    let cloudinaryUrl = '';
    let cloudinaryPublicId = '';

    // If direct Multer file was uploaded
    if (req.file) {
      finalPdfPath = `/uploads/cv/${req.file.filename}`;
      originalName = req.file.originalname;
      fileSize = req.file.size;

      if (fs.existsSync(req.file.path)) {
        try {
          const buf = fs.readFileSync(req.file.path);
          base64Data = buf.toString('base64');
        } catch (e) {}

        try {
          const cloudRes = await uploadToCloudinary(req.file.path, 'portfolio/cv', 'raw');
          if (cloudRes && cloudRes.secure_url) {
            cloudinaryUrl = cloudRes.secure_url;
            cloudinaryPublicId = cloudRes.public_id || '';
            finalPdfPath = cloudRes.secure_url;
          }
        } catch (e) {}
      }
    } else if (pdfFile) {
      // If a file was uploaded previously via /api/files/upload, check if Mongo File model has its base64 data
      if (isMongoReady()) {
        try {
          const existingFile = await File.findOne({
            $or: [{ path: pdfFile }, { storedName: path.basename(pdfFile) }, { originalName: originalName }]
          });
          if (existingFile) {
            if (existingFile.fileData && !base64Data) base64Data = existingFile.fileData;
            if (existingFile.cloudinaryUrl && !cloudinaryUrl) cloudinaryUrl = existingFile.cloudinaryUrl;
            if (existingFile.size && !fileSize) fileSize = existingFile.size;
          }
        } catch (e) {}
      }
    }

    let savedRecord = null;

    if (isMongoReady()) {
      if (isFileActive) {
        await CV.updateMany({}, { active: false });
      }
      const cv = new CV({
        name: name || originalName,
        version: version || 'v2.0',
        pdfFile: finalPdfPath,
        originalName: originalName,
        fileSize: fileSize,
        active: isFileActive,
        fileData: base64Data,
        cloudinaryUrl: cloudinaryUrl,
        cloudinaryPublicId: cloudinaryPublicId
      });
      savedRecord = await cv.save();
    }

    // Always update JSON disk file as well for persistence
    let fileCvs = loadCvsFromFile();
    if (isFileActive) {
      fileCvs.forEach(item => { item.active = false; });
    }
    const newFileCv = {
      _id: savedRecord ? savedRecord._id.toString() : 'cv-' + Date.now(),
      name: name || originalName,
      version: version || 'v2.0',
      pdfFile: finalPdfPath,
      originalName: originalName,
      fileSize: fileSize,
      active: isFileActive,
      cloudinaryUrl: cloudinaryUrl,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    fileCvs.unshift(newFileCv);
    saveCvsToFile(fileCvs);

    return res.json({
      success: true,
      message: 'CV record saved and persisted successfully',
      data: formatCvItem(savedRecord || newFileCv)
    });
  } catch (err) {
    console.error('Save CV error:', err);
    res.status(500).json({ success: false, message: err.message || 'Server error saving CV' });
  }
};

const optionalCvUpload = (req, res, next) => {
  const contentType = (req.headers['content-type'] || '').toLowerCase();
  if (contentType.includes('multipart/form-data')) {
    return uploadCv.single('pdf')(req, res, (err) => {
      if (err) {
        console.warn('[Multer Warning]:', err.message);
      }
      next();
    });
  }
  next();
};

router.post('/', authMiddleware, optionalCvUpload, handleSaveCv);
router.post('/admin/cv', authMiddleware, optionalCvUpload, handleSaveCv);

// ==========================================
// 6. PATCH /api/cv/:id/active - Activate CV
// ==========================================
const handleActivateCv = async (req, res) => {
  try {
    const id = req.params.id;
    let activatedRecord = null;

    if (isMongoReady()) {
      await CV.updateMany({}, { active: false });
      activatedRecord = await CV.findByIdAndUpdate(id, { active: true }, { new: true });
    }

    let fileCvs = loadCvsFromFile();
    fileCvs.forEach(item => {
      item.active = (item._id.toString() === id.toString());
    });
    saveCvsToFile(fileCvs);

    const result = activatedRecord || fileCvs.find(x => x.active) || fileCvs[0];
    return res.json({ success: true, message: 'CV set as active successfully', data: formatCvItem(result) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

router.patch('/:id/active', authMiddleware, handleActivateCv);
router.put('/:id/active', authMiddleware, handleActivateCv);
router.put('/admin/cv/:id/activate', authMiddleware, handleActivateCv);
router.patch('/admin/cv/:id/activate', authMiddleware, handleActivateCv);

// ==========================================
// 7. DELETE /api/cv/:id - Delete CV
// ==========================================
const handleDeleteCv = async (req, res) => {
  try {
    const id = req.params.id;
    if (isMongoReady()) {
      await CV.findByIdAndDelete(id);
    }

    let fileCvs = loadCvsFromFile();
    fileCvs = fileCvs.filter(x => x._id.toString() !== id.toString());
    saveCvsToFile(fileCvs);

    res.json({ success: true, message: 'CV deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

router.delete('/:id', authMiddleware, handleDeleteCv);
router.delete('/admin/cv/:id', authMiddleware, handleDeleteCv);

module.exports = router;

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

const File = require('../models/File');
const CV = require('../models/CV');
const authMiddleware = require('../middleware/authMiddleware');
const { upload, baseUploadDir } = require('../middleware/uploadMiddleware');
const { uploadToCloudinary } = require('../config/cloudinary');

const isMongoReady = () => mongoose.connection.readyState === 1;

// Allowed roots for public and uploaded files
const ALLOWED_ROOTS = [
  path.resolve(__dirname, '../../client/assets'),
  path.resolve(__dirname, '../client/assets'),
  path.resolve(__dirname, '../uploads'),
  baseUploadDir
];

const DEFAULT_RESUME_PATH = path.resolve(__dirname, '../uploads/cv/Islam_Shahat_CV.pdf');
const CLIENT_FALLBACK_RESUME = path.resolve(__dirname, '../../client/assets/pdf/Islam_Shahat_CV.pdf');
const CLIENT_FALLBACK_RESUME_ALT = path.resolve(__dirname, '../client/assets/pdf/Islam_Shahat_CV.pdf');

const getCanonicalResumePath = () => {
  if (fs.existsSync(DEFAULT_RESUME_PATH)) return DEFAULT_RESUME_PATH;
  if (fs.existsSync(CLIENT_FALLBACK_RESUME)) return CLIENT_FALLBACK_RESUME;
  if (fs.existsSync(CLIENT_FALLBACK_RESUME_ALT)) return CLIENT_FALLBACK_RESUME_ALT;
  return null;
};

// Common MIME Types lookup map
const MIME_TYPES = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.ogg': 'video/ogg',
  '.mov': 'video/quicktime',
  '.zip': 'application/zip',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.json': 'application/json'
};

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

/**
 * Securely resolves a requested file path, ensuring it stays strictly within ALLOWED_ROOTS.
 */
function safeResolvePath(requestedPath) {
  const defaultCv = getCanonicalResumePath();
  if (!requestedPath || typeof requestedPath !== 'string') {
    return defaultCv;
  }

  let clean = requestedPath
    .replace(/^https?:\/\/[^\/]+/i, '')
    .trim();

  clean = decodeURIComponent(clean)
    .replace(/^(\.\.[\/\\])+/, '')
    .replace(/^[/\\]+/, '')
    .trim();

  clean = clean.replace(/^(client|server|public)[/\\]+/i, '');

  // 1. Direct check relative to server/
  const serverCandidate = path.resolve(__dirname, '..', clean);
  for (const root of ALLOWED_ROOTS) {
    if (serverCandidate.toLowerCase().startsWith(root.toLowerCase()) && fs.existsSync(serverCandidate) && fs.statSync(serverCandidate).isFile()) {
      return serverCandidate;
    }
  }

  // 2. Direct check in client/assets
  const clientCandidate = path.resolve(__dirname, '../../client', clean);
  for (const root of ALLOWED_ROOTS) {
    if (clientCandidate.toLowerCase().startsWith(root.toLowerCase()) && fs.existsSync(clientCandidate) && fs.statSync(clientCandidate).isFile()) {
      return clientCandidate;
    }
  }

  // 3. Direct check in client/assets/pdf/
  const clientAssetsPdf = path.resolve(__dirname, '../../client/assets/pdf', path.basename(clean));
  if (fs.existsSync(clientAssetsPdf) && fs.statSync(clientAssetsPdf).isFile()) {
    return clientAssetsPdf;
  }

  // 4. Check inside uploads subdirectories by base filename
  const fileName = path.basename(clean);
  const subdirs = ['cv', 'certificates', 'documents', 'projects', 'videos', 'images'];
  for (const sub of subdirs) {
    const candidate = path.resolve(baseUploadDir, sub, fileName);
    if (candidate.toLowerCase().startsWith(baseUploadDir.toLowerCase()) && fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }

  const lowerClean = clean.toLowerCase();
  if (lowerClean === 'cv' || lowerClean === 'resume' || lowerClean === 'cv.pdf' || lowerClean === 'resume.pdf') {
    return defaultCv;
  }

  return null;
}

/**
 * GET /api/files/download
 * Unified Guaranteed Binary Download Endpoint
 */
router.get('/download', async (req, res) => {
  try {
    const requestedPath = req.query.filePath || req.query.path || req.query.file || req.query.url || req.query.id;
    let customName = req.query.name;

    if (requestedPath && (requestedPath.startsWith('http://') || requestedPath.startsWith('https://'))) {
      return res.redirect(requestedPath);
    }

    // 1. Check MongoDB File or CV models first (handles serverless Base64 / Cloudinary persistence)
    if (isMongoReady() && requestedPath) {
      try {
        const query = [
          { path: requestedPath },
          { path: `/${requestedPath.replace(/^[/\\]+/, '')}` },
          { storedName: path.basename(requestedPath) },
          { originalName: path.basename(requestedPath) }
        ];
        if (mongoose.Types.ObjectId.isValid(requestedPath)) {
          query.push({ _id: requestedPath });
        }

        const dbFile = await File.findOne({ $or: query });
        if (dbFile) {
          const finalName = customName || dbFile.originalName || dbFile.storedName || 'download.pdf';
          const cleanAsciiName = finalName.replace(/[^\w\s.()\-]/g, '_');
          const utf8EncodedName = encodeURIComponent(finalName);

          if (dbFile.fileData) {
            const buffer = Buffer.from(dbFile.fileData, 'base64');
            res.setHeader('Content-Type', dbFile.mimeType || getMimeType(finalName));
            res.setHeader('Content-Length', buffer.length);
            res.setHeader('Content-Disposition', `attachment; filename="${cleanAsciiName}"; filename*=UTF-8''${utf8EncodedName}`);
            res.setHeader('Access-Control-Allow-Origin', '*');
            return res.end(buffer);
          }

          if (dbFile.cloudinaryUrl && (dbFile.cloudinaryUrl.startsWith('http://') || dbFile.cloudinaryUrl.startsWith('https://'))) {
            return res.redirect(dbFile.cloudinaryUrl);
          }
        }

        // Also check CV collection
        const dbCv = await CV.findOne({ $or: [{ _id: mongoose.Types.ObjectId.isValid(requestedPath) ? requestedPath : null }, { pdfFile: requestedPath }, { originalName: path.basename(requestedPath) }] });
        if (dbCv) {
          const finalName = customName || dbCv.originalName || dbCv.name || 'Islam_Shahat_CV.pdf';
          const cleanAsciiName = finalName.replace(/[^\w\s.()\-]/g, '_');
          const utf8EncodedName = encodeURIComponent(finalName);

          if (dbCv.fileData) {
            const buffer = Buffer.from(dbCv.fileData, 'base64');
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Length', buffer.length);
            res.setHeader('Content-Disposition', `attachment; filename="${cleanAsciiName}"; filename*=UTF-8''${utf8EncodedName}`);
            res.setHeader('Access-Control-Allow-Origin', '*');
            return res.end(buffer);
          }

          if (dbCv.cloudinaryUrl && (dbCv.cloudinaryUrl.startsWith('http://') || dbCv.cloudinaryUrl.startsWith('https://'))) {
            return res.redirect(dbCv.cloudinaryUrl);
          }
        }
      } catch (dbErr) {
        console.warn('[DB Download Lookup Notice]:', dbErr.message);
      }
    }

    // 2. Local Disk file check
    const absolutePath = safeResolvePath(requestedPath);
    if (absolutePath && fs.existsSync(absolutePath)) {
      const stat = fs.statSync(absolutePath);
      const mimeType = getMimeType(absolutePath);
      let rawName = customName || path.basename(absolutePath);
      if (!path.extname(rawName)) {
        rawName += path.extname(absolutePath);
      }
      const cleanAsciiName = rawName.replace(/[^\w\s.()\-]/g, '_');
      const utf8EncodedName = encodeURIComponent(rawName);

      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Length', stat.size);
      res.setHeader('Content-Disposition', `attachment; filename="${cleanAsciiName}"; filename*=UTF-8''${utf8EncodedName}`);
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'public, max-age=86400');

      return fs.createReadStream(absolutePath).pipe(res);
    }

    return res.status(404).json({ success: false, message: 'File not found on server.' });
  } catch (err) {
    console.error('[Download Handler Error]:', err);
    res.status(500).json({ success: false, message: 'Server error during download' });
  }
});

/**
 * GET /api/files/view (and /api/files/view-pdf)
 * In-Browser Inline Stream
 */
const handleFileView = async (req, res) => {
  try {
    const requestedPath = req.query.filePath || req.query.path || req.query.file || req.query.url;

    if (requestedPath && (requestedPath.startsWith('http://') || requestedPath.startsWith('https://'))) {
      return res.redirect(requestedPath);
    }

    // Check Mongo File or CV
    if (isMongoReady() && requestedPath) {
      try {
        const query = [
          { path: requestedPath },
          { storedName: path.basename(requestedPath) },
          { originalName: path.basename(requestedPath) }
        ];
        if (mongoose.Types.ObjectId.isValid(requestedPath)) {
          query.push({ _id: requestedPath });
        }

        const dbFile = await File.findOne({ $or: query });
        if (dbFile) {
          if (dbFile.fileData) {
            const buffer = Buffer.from(dbFile.fileData, 'base64');
            res.setHeader('Content-Type', dbFile.mimeType || 'application/pdf');
            res.setHeader('Content-Length', buffer.length);
            res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(dbFile.originalName)}"`);
            res.setHeader('Access-Control-Allow-Origin', '*');
            return res.end(buffer);
          }
          if (dbFile.cloudinaryUrl) return res.redirect(dbFile.cloudinaryUrl);
        }
      } catch (dbErr) {}
    }

    const absolutePath = safeResolvePath(requestedPath);
    if (!absolutePath || !fs.existsSync(absolutePath)) {
      return res.status(404).json({ success: false, message: 'File not found on server.' });
    }

    const stat = fs.statSync(absolutePath);
    const fileSize = stat.size;
    const mimeType = getMimeType(absolutePath);
    const fileName = path.basename(absolutePath);
    const cleanAsciiName = fileName.replace(/[^\w\s.()\-]/g, '_');
    const utf8EncodedName = encodeURIComponent(fileName);
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      if (start >= fileSize || end >= fileSize) {
        res.status(416).setHeader('Content-Range', `bytes */${fileSize}`);
        return res.end();
      }

      const chunkSize = (end - start) + 1;
      const fileStream = fs.createReadStream(absolutePath, { start, end });

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': mimeType,
        'Content-Disposition': `inline; filename="${cleanAsciiName}"; filename*=UTF-8''${utf8EncodedName}`,
        'Access-Control-Allow-Origin': '*'
      });
      return fileStream.pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': mimeType,
        'Content-Disposition': `inline; filename="${cleanAsciiName}"; filename*=UTF-8''${utf8EncodedName}`,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*'
      });
      return fs.createReadStream(absolutePath).pipe(res);
    }
  } catch (err) {
    console.error('[View Handler Error]:', err);
    res.status(500).json({ success: false, message: 'Server error serving file' });
  }
};

router.get('/view', handleFileView);
router.get('/view-pdf', handleFileView);

/**
 * POST /api/files/upload
 * Unified File Upload Handler with Base64 + Cloudinary persistence
 */
router.post('/upload', authMiddleware, upload.any(), async (req, res) => {
  try {
    const file = req.file || (req.files && req.files[0]);
    if (!file) {
      return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }

    const relativeFolder = path.basename(file.destination || 'documents');
    let filePath = `/uploads/${relativeFolder}/${file.filename}`;

    let category = 'document';
    if (relativeFolder === 'cv') category = 'cv';
    else if (relativeFolder === 'certificates') category = 'certificate';
    else if (relativeFolder === 'images') category = 'image';
    else if (relativeFolder === 'videos') category = 'video';
    else if (relativeFolder === 'projects') category = 'project';

    let base64Data = '';
    let cloudinaryUrl = '';
    let cloudinaryPublicId = '';

    if (file.path && fs.existsSync(file.path)) {
      try {
        const buffer = fs.readFileSync(file.path);
        base64Data = buffer.toString('base64');
      } catch (e) {}

      try {
        const cloudRes = await uploadToCloudinary(
          file.path,
          `portfolio/${category}`,
          category === 'image' ? 'image' : (category === 'video' ? 'video' : 'raw')
        );
        if (cloudRes && cloudRes.secure_url) {
          cloudinaryUrl = cloudRes.secure_url;
          cloudinaryPublicId = cloudRes.public_id || '';
          filePath = cloudRes.secure_url;
        }
      } catch (e) {}
    }

    if (isMongoReady()) {
      try {
        await File.create({
          originalName: file.originalname,
          storedName: file.filename,
          mimeType: file.mimetype,
          size: file.size,
          path: filePath,
          category: category,
          relatedSection: req.body.relatedSection || 'Admin Upload',
          fileData: base64Data,
          cloudinaryUrl: cloudinaryUrl,
          cloudinaryPublicId: cloudinaryPublicId
        });
      } catch (dbErr) {
        console.warn('[File Model Save Warning]:', dbErr.message);
      }
    }

    return res.json({
      success: true,
      message: 'File uploaded successfully!',
      filePath: filePath,
      originalName: file.originalname,
      storedName: file.filename,
      size: file.size,
      mimeType: file.mimetype,
      category: category,
      cloudinaryUrl: cloudinaryUrl
    });
  } catch (err) {
    console.error('[Upload Handler Error]:', err);
    return res.status(500).json({ success: false, message: err.message || 'File upload failed' });
  }
});

/**
 * GET /api/files
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    if (isMongoReady()) {
      const files = await File.find().sort({ createdAt: -1 });
      return res.json({ success: true, count: files.length, data: files });
    }
    return res.json({ success: true, count: 0, data: [] });
  } catch (err) {
    return res.json({ success: true, count: 0, data: [] });
  }
});

/**
 * DELETE /api/files/:id
 */
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    if (isMongoReady()) {
      const file = await File.findById(req.params.id);
      if (!file) return res.status(404).json({ success: false, message: 'File record not found' });

      const absolutePath = safeResolvePath(file.path);
      if (absolutePath && fs.existsSync(absolutePath)) {
        try { fs.unlinkSync(absolutePath); } catch(e){}
      }
      await File.findByIdAndDelete(req.params.id);
      return res.json({ success: true, message: 'File deleted successfully.' });
    }
    res.json({ success: true, message: 'Delete processed.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;

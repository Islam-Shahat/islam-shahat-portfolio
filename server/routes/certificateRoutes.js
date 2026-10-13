const express = require('express');
const router = express.Router();
const Certificate = require('../models/Certificate');
const File = require('../models/File');
const authMiddleware = require('../middleware/authMiddleware');
const { upload } = require('../middleware/uploadMiddleware');
const { uploadToCloudinary, isCloudinaryConfigured } = require('../config/cloudinary');

const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

const isMongoReady = () => mongoose.connection.readyState === 1;

const workJsonPath = path.join(__dirname, '../../client/assets/data/work.json');

const getWorkData = () => {
  if (fs.existsSync(workJsonPath)) {
    try {
      return JSON.parse(fs.readFileSync(workJsonPath, 'utf8'));
    } catch {
      return { experience: [], education: [], volunteering: [], certificates: [] };
    }
  }
  return { experience: [], education: [], volunteering: [], certificates: [] };
};

const saveWorkData = (data) => {
  try {
    fs.writeFileSync(workJsonPath, JSON.stringify(data, null, 4), 'utf8');
  } catch (err) {
    console.warn('Failed to save work.json fallback:', err.message);
  }
};

const isImgUrl = (url) => {
  if (!url || typeof url !== 'string') return false;
  const clean = url.trim().toLowerCase().split('?')[0].split('#')[0];
  return clean.startsWith('data:image/') || clean.includes('/image/upload/') || clean.includes('/uploads/images/') || /\.(png|jpe?g|webp|gif|svg|avif|bmp|ico)$/i.test(clean);
};

const getFallbackCertificates = () => {
  const data = getWorkData();
  return (data.certificates || []).map((x, idx) => {
    const isImage = isImgUrl(x.image) || isImgUrl(x.pdfFile) || isImgUrl(x.fileUrl);
    const imageUrl = x.image || (isImage ? (x.pdfFile || x.fileUrl) : '');
    return {
      _id: x._id || `cert-${idx}`,
      title: x.title || x.name || 'Certificate',
      name: x.name || x.title || 'Certificate',
      subtitle: x.subtitle || x.issuer || 'Issuer',
      issuer: x.issuer || x.subtitle || 'Issuer',
      issuerLogo: x.issuerLogo || '',
      year: x.year || x.issueDate || '2026',
      issueDate: x.issueDate || x.year || '2026',
      duration: x.duration || 'Verified Credential',
      credentialId: x.credentialId || `CERT-${idx + 101}`,
      skills: x.skills || ['Software Engineering', 'Problem Solving'],
      description: x.description || '',
      image: imageUrl || '',
      pdfFile: x.pdfFile || (isImage ? imageUrl : '/assets/pdf/Islam_Shahat_CV.pdf'),
      originalPdfName: x.originalPdfName || '',
      link: x.link || '',
      orderIndex: x.orderIndex || idx + 1
    };
  });
};

// GET /api/certificates - Public
router.get('/', async (req, res) => {
  try {
    if (isMongoReady()) {
      const items = await Certificate.find().sort({ orderIndex: 1, createdAt: -1 });
      if (items.length > 0) {
        return res.json({ success: true, count: items.length, data: items });
      }
    }
    const fallback = getFallbackCertificates();
    res.json({ success: true, count: fallback.length, data: fallback });
  } catch (err) {
    const fallback = getFallbackCertificates();
    res.json({ success: true, count: fallback.length, data: fallback });
  }
});

const uploadFields = upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'pdf', maxCount: 1 }
]);

// Admin Routes - Create Certificate
const handleCreateCertificate = async (req, res) => {
  try {
    const data = { ...req.body };

    if (req.files) {
      if (req.files.image && req.files.image[0]) {
        const file = req.files.image[0];
        data.image = `/uploads/images/${file.filename}`;

        // Upload image to Cloudinary for persistent storage on Vercel
        if (file.path && fs.existsSync(file.path)) {
          try {
            const cloudRes = await uploadToCloudinary(file.path, 'portfolio/certificates', 'image');
            if (cloudRes && cloudRes.secure_url) {
              data.image = cloudRes.secure_url;
              data.cloudinaryUrl = cloudRes.secure_url;
              data.cloudinaryPublicId = cloudRes.public_id || '';
            }
          } catch (e) {
            console.warn('[Certificate] Cloudinary image upload warning:', e.message);
          }
        }

        if (isMongoReady()) {
          await File.create({
            originalName: file.originalname,
            storedName: file.filename,
            mimeType: file.mimetype,
            size: file.size,
            path: data.image,
            category: 'image',
            relatedSection: 'Certificates',
            cloudinaryUrl: data.cloudinaryUrl || '',
            cloudinaryPublicId: data.cloudinaryPublicId || ''
          }).catch(() => {});
        }
      }
      if (req.files.pdf && req.files.pdf[0]) {
        const file = req.files.pdf[0];
        data.pdfFile = `/uploads/certificates/${file.filename}`;
        data.originalPdfName = file.originalname;

        // Upload PDF to Cloudinary for persistent storage on Vercel
        if (file.path && fs.existsSync(file.path)) {
          try {
            const cloudRes = await uploadToCloudinary(file.path, 'portfolio/certificates', 'raw');
            if (cloudRes && cloudRes.secure_url) {
              data.pdfFile = cloudRes.secure_url;
              data.pdfCloudinaryUrl = cloudRes.secure_url;
              data.pdfCloudinaryPublicId = cloudRes.public_id || '';
            }
          } catch (e) {
            console.warn('[Certificate] Cloudinary PDF upload warning:', e.message);
          }
        }

        if (isMongoReady()) {
          await File.create({
            originalName: file.originalname,
            storedName: file.filename,
            mimeType: file.mimetype,
            size: file.size,
            path: data.pdfFile,
            category: 'certificate',
            relatedSection: 'Certificates',
            cloudinaryUrl: data.pdfCloudinaryUrl || '',
            cloudinaryPublicId: data.pdfCloudinaryPublicId || ''
          }).catch(() => {});
        }
      }
    }

    if (data.pdfFile && isImgUrl(data.pdfFile) && !data.image) {
      data.image = data.pdfFile;
    } else if (data.image && !data.pdfFile) {
      data.pdfFile = data.image;
    }

    if (isMongoReady()) {
      const item = new Certificate(data);
      await item.save();
      return res.json({ success: true, message: 'Certificate added successfully', data: item });
    }

    const workData = getWorkData();
    if (!workData.certificates) workData.certificates = [];
    const newEntry = {
      _id: `cert-${Date.now()}`,
      title: data.name || data.title,
      name: data.name || data.title,
      subtitle: data.issuer || data.subtitle,
      issuer: data.issuer || data.subtitle,
      issuerLogo: data.issuerLogo || '',
      year: data.issueDate || data.year || '2026',
      issueDate: data.issueDate || data.year || '2026',
      duration: data.duration || 'Verified Credential',
      credentialId: data.credentialId || `CERT-${Date.now().toString().slice(-6)}`,
      skills: Array.isArray(data.skills) ? data.skills : (typeof data.skills === 'string' ? data.skills.split(',').map(s=>s.trim()) : []),
      description: data.description || '',
      image: data.image || '',
      pdfFile: data.pdfFile || (data.image ? data.image : '/assets/pdf/Islam_Shahat_CV.pdf'),
      originalPdfName: data.originalPdfName || '',
      link: data.link || '',
      orderIndex: data.orderIndex ? parseInt(data.orderIndex) : workData.certificates.length + 1
    };
    workData.certificates.unshift(newEntry);
    saveWorkData(workData);
    return res.json({ success: true, message: 'Certificate added successfully', data: newEntry });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

router.post('/', authMiddleware, uploadFields, handleCreateCertificate);
router.post('/admin/certificates', authMiddleware, uploadFields, handleCreateCertificate);

// Admin Routes - Update Certificate
const handleUpdateCertificate = async (req, res) => {
  try {
    const data = { ...req.body };
    const id = req.params.id;

    if (req.files) {
      if (req.files.image && req.files.image[0]) {
        const file = req.files.image[0];
        data.image = `/uploads/images/${file.filename}`;

        // Upload image to Cloudinary for persistent storage on Vercel
        if (file.path && fs.existsSync(file.path)) {
          try {
            const cloudRes = await uploadToCloudinary(file.path, 'portfolio/certificates', 'image');
            if (cloudRes && cloudRes.secure_url) {
              data.image = cloudRes.secure_url;
              data.cloudinaryUrl = cloudRes.secure_url;
              data.cloudinaryPublicId = cloudRes.public_id || '';
            }
          } catch (e) {
            console.warn('[Certificate] Cloudinary image upload warning:', e.message);
          }
        }

        if (isMongoReady()) {
          await File.create({
            originalName: file.originalname,
            storedName: file.filename,
            mimeType: file.mimetype,
            size: file.size,
            path: data.image,
            category: 'image',
            relatedSection: 'Certificates',
            cloudinaryUrl: data.cloudinaryUrl || '',
            cloudinaryPublicId: data.cloudinaryPublicId || ''
          }).catch(() => {});
        }
      }
      if (req.files.pdf && req.files.pdf[0]) {
        const file = req.files.pdf[0];
        data.pdfFile = `/uploads/certificates/${file.filename}`;
        data.originalPdfName = file.originalname;

        // Upload PDF to Cloudinary for persistent storage on Vercel
        if (file.path && fs.existsSync(file.path)) {
          try {
            const cloudRes = await uploadToCloudinary(file.path, 'portfolio/certificates', 'raw');
            if (cloudRes && cloudRes.secure_url) {
              data.pdfFile = cloudRes.secure_url;
              data.pdfCloudinaryUrl = cloudRes.secure_url;
              data.pdfCloudinaryPublicId = cloudRes.public_id || '';
            }
          } catch (e) {
            console.warn('[Certificate] Cloudinary PDF upload warning:', e.message);
          }
        }

        if (isMongoReady()) {
          await File.create({
            originalName: file.originalname,
            storedName: file.filename,
            mimeType: file.mimetype,
            size: file.size,
            path: data.pdfFile,
            category: 'certificate',
            relatedSection: 'Certificates',
            cloudinaryUrl: data.pdfCloudinaryUrl || '',
            cloudinaryPublicId: data.pdfCloudinaryPublicId || ''
          }).catch(() => {});
        }
      }
    }

    if (data.pdfFile && isImgUrl(data.pdfFile) && !data.image) {
      data.image = data.pdfFile;
    } else if (data.image && !data.pdfFile) {
      data.pdfFile = data.image;
    }

    if (isMongoReady()) {
      const item = await Certificate.findByIdAndUpdate(id, data, { new: true });
      if (item) {
        return res.json({ success: true, message: 'Certificate updated successfully', data: item });
      }
    }

    const workData = getWorkData();
    if (workData.certificates) {
      const index = workData.certificates.findIndex((x, idx) => (x._id === id || `cert-${idx}` === id));
      if (index !== -1) {
        workData.certificates[index] = {
          ...workData.certificates[index],
          title: data.name || data.title || workData.certificates[index].title,
          name: data.name || data.title || workData.certificates[index].name,
          subtitle: data.issuer || data.subtitle || workData.certificates[index].subtitle,
          issuer: data.issuer || data.subtitle || workData.certificates[index].issuer,
          issuerLogo: data.issuerLogo !== undefined ? data.issuerLogo : workData.certificates[index].issuerLogo,
          year: data.issueDate || data.year || workData.certificates[index].year,
          issueDate: data.issueDate || data.year || workData.certificates[index].issueDate,
          duration: data.duration !== undefined ? data.duration : workData.certificates[index].duration,
          credentialId: data.credentialId !== undefined ? data.credentialId : workData.certificates[index].credentialId,
          skills: data.skills !== undefined ? (Array.isArray(data.skills) ? data.skills : (typeof data.skills === 'string' ? data.skills.split(',').map(s=>s.trim()) : workData.certificates[index].skills)) : workData.certificates[index].skills,
          image: data.image !== undefined ? data.image : workData.certificates[index].image,
          pdfFile: data.pdfFile || workData.certificates[index].pdfFile,
          originalPdfName: data.originalPdfName !== undefined ? data.originalPdfName : workData.certificates[index].originalPdfName,
          link: data.link !== undefined ? data.link : workData.certificates[index].link,
          orderIndex: data.orderIndex !== undefined ? parseInt(data.orderIndex) : workData.certificates[index].orderIndex,
          description: data.description !== undefined ? data.description : workData.certificates[index].description
        };
        workData.certificates.sort((a, b) => (a.orderIndex || 99) - (b.orderIndex || 99));
        saveWorkData(workData);
        return res.json({ success: true, message: 'Certificate updated successfully', data: workData.certificates[index] });
      }
    }

    res.json({ success: true, message: 'Certificate updated successfully', data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

router.put('/:id', authMiddleware, uploadFields, handleUpdateCertificate);
router.put('/admin/certificates/:id', authMiddleware, uploadFields, handleUpdateCertificate);

// Admin Routes - Delete Certificate
const handleDeleteCertificate = async (req, res) => {
  try {
    const id = req.params.id;
    if (isMongoReady()) {
      const item = await Certificate.findByIdAndDelete(id);
      if (item) {
        return res.json({ success: true, message: 'Certificate deleted successfully' });
      }
    }

    const workData = getWorkData();
    if (workData.certificates) {
      workData.certificates = workData.certificates.filter((x, idx) => x._id !== id && `cert-${idx}` !== id);
      saveWorkData(workData);
    }

    res.json({ success: true, message: 'Certificate deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

router.delete('/:id', authMiddleware, handleDeleteCertificate);
router.delete('/admin/certificates/:id', authMiddleware, handleDeleteCertificate);

module.exports = router;

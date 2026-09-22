const express = require('express');
const router = express.Router();
const Education = require('../models/Education');
const File = require('../models/File');
const authMiddleware = require('../middleware/authMiddleware');
const { upload } = require('../middleware/uploadMiddleware');

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

const getFallbackEducation = () => {
  const data = getWorkData();
  return (data.education || []).map((x, idx) => ({
    _id: x._id || `edu-${idx}`,
    degree: x.title || x.degree,
    institution: x.subtitle || x.institution || 'Qena University',
    startDate: x.startDate || (x.year ? x.year.split('-')[0].trim() : '2024'),
    endDate: x.endDate || (x.year && x.year.includes('-') ? x.year.split('-')[1].trim() : '2028'),
    description: x.description || '',
    orderIndex: x.orderIndex || idx + 1
  }));
};

// GET /api/education - Public
router.get('/', async (req, res) => {
  try {
    if (isMongoReady()) {
      const items = await Education.find().sort({ orderIndex: 1, createdAt: -1 });
      if (items.length > 0) {
        return res.json({ success: true, count: items.length, data: items });
      }
    }
    const fallback = getFallbackEducation();
    res.json({ success: true, count: fallback.length, data: fallback });
  } catch (err) {
    const fallback = getFallbackEducation();
    res.json({ success: true, count: fallback.length, data: fallback });
  }
});

const uploadFields = upload.fields([
  { name: 'logo', maxCount: 1 },
  { name: 'certificate', maxCount: 1 }
]);

// Admin Routes - Create Education
const handleCreateEducation = async (req, res) => {
  try {
    const data = { ...req.body };

    if (req.files) {
      if (req.files.logo && req.files.logo[0]) {
        const file = req.files.logo[0];
        data.logo = `/uploads/images/${file.filename}`;
        if (isMongoReady()) {
          await File.create({
            originalName: file.originalname,
            storedName: file.filename,
            mimeType: file.mimetype,
            size: file.size,
            path: data.logo,
            category: 'image',
            relatedSection: 'Education'
          }).catch(() => {});
        }
      }
      if (req.files.certificate && req.files.certificate[0]) {
        const file = req.files.certificate[0];
        const isPdf = file.mimetype === 'application/pdf';
        data.certificateFile = `/uploads/${isPdf ? 'certificates' : 'images'}/${file.filename}`;
        data.certificateOriginalName = file.originalname;
        if (isMongoReady()) {
          await File.create({
            originalName: file.originalname,
            storedName: file.filename,
            mimeType: file.mimetype,
            size: file.size,
            path: data.certificateFile,
            category: isPdf ? 'certificate' : 'image',
            relatedSection: 'Education'
          }).catch(() => {});
        }
      }
    }

    if (isMongoReady()) {
      const item = new Education(data);
      await item.save();
      return res.json({ success: true, message: 'Education added successfully', data: item });
    }

    const workData = getWorkData();
    if (!workData.education) workData.education = [];
    const newEntry = {
      _id: `edu-${Date.now()}`,
      title: data.degree,
      degree: data.degree,
      subtitle: data.institution,
      institution: data.institution,
      year: `${data.startDate || '2024'} - ${data.endDate || '2028'}`,
      startDate: data.startDate || '2024',
      endDate: data.endDate || '2028',
      description: data.description || '',
      orderIndex: data.orderIndex ? parseInt(data.orderIndex) : workData.education.length + 1
    };
    workData.education.unshift(newEntry);
    saveWorkData(workData);
    return res.json({ success: true, message: 'Education added successfully', data: newEntry });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

router.post('/', authMiddleware, uploadFields, handleCreateEducation);
router.post('/admin/education', authMiddleware, uploadFields, handleCreateEducation);

// Admin Routes - Update Education
const handleUpdateEducation = async (req, res) => {
  try {
    const data = { ...req.body };
    const id = req.params.id;

    if (req.files) {
      if (req.files.logo && req.files.logo[0]) {
        const file = req.files.logo[0];
        data.logo = `/uploads/images/${file.filename}`;
        if (isMongoReady()) {
          await File.create({
            originalName: file.originalname,
            storedName: file.filename,
            mimeType: file.mimetype,
            size: file.size,
            path: data.logo,
            category: 'image',
            relatedSection: 'Education'
          }).catch(() => {});
        }
      }
      if (req.files.certificate && req.files.certificate[0]) {
        const file = req.files.certificate[0];
        const isPdf = file.mimetype === 'application/pdf';
        data.certificateFile = `/uploads/${isPdf ? 'certificates' : 'images'}/${file.filename}`;
        data.certificateOriginalName = file.originalname;
        if (isMongoReady()) {
          await File.create({
            originalName: file.originalname,
            storedName: file.filename,
            mimeType: file.mimetype,
            size: file.size,
            path: data.certificateFile,
            category: isPdf ? 'certificate' : 'image',
            relatedSection: 'Education'
          }).catch(() => {});
        }
      }
    }

    if (isMongoReady()) {
      const item = await Education.findByIdAndUpdate(id, data, { new: true });
      if (item) {
        return res.json({ success: true, message: 'Education updated successfully', data: item });
      }
    }

    const workData = getWorkData();
    if (workData.education) {
      const index = workData.education.findIndex((x, idx) => (x._id === id || `edu-${idx}` === id));
      if (index !== -1) {
        workData.education[index] = {
          ...workData.education[index],
          title: data.degree || workData.education[index].title,
          degree: data.degree || workData.education[index].degree,
          subtitle: data.institution || workData.education[index].subtitle,
          institution: data.institution || workData.education[index].institution,
          startDate: data.startDate || workData.education[index].startDate,
          endDate: data.endDate || workData.education[index].endDate,
          year: `${data.startDate || '2024'} - ${data.endDate || '2028'}`,
          description: data.description !== undefined ? data.description : workData.education[index].description
        };
        saveWorkData(workData);
        return res.json({ success: true, message: 'Education updated successfully', data: workData.education[index] });
      }
    }

    res.json({ success: true, message: 'Education updated successfully', data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

router.put('/:id', authMiddleware, uploadFields, handleUpdateEducation);
router.put('/admin/education/:id', authMiddleware, uploadFields, handleUpdateEducation);

// Admin Routes - Delete Education
const handleDeleteEducation = async (req, res) => {
  try {
    const id = req.params.id;
    if (isMongoReady()) {
      const item = await Education.findByIdAndDelete(id);
      if (item) {
        return res.json({ success: true, message: 'Education deleted successfully' });
      }
    }

    const workData = getWorkData();
    if (workData.education) {
      workData.education = workData.education.filter((x, idx) => x._id !== id && `edu-${idx}` !== id);
      saveWorkData(workData);
    }

    res.json({ success: true, message: 'Education deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

router.delete('/:id', authMiddleware, handleDeleteEducation);
router.delete('/admin/education/:id', authMiddleware, handleDeleteEducation);

module.exports = router;

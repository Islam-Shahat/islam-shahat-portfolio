const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const Experience = require('../models/Experience');
const File = require('../models/File');
const authMiddleware = require('../middleware/authMiddleware');
const { upload } = require('../middleware/uploadMiddleware');

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

const getFallbackExperience = () => {
  const data = getWorkData();
  return (data.experience || []).map((x, idx) => ({
    _id: x._id || `exp-${idx}`,
    title: x.title,
    company: x.subtitle || x.company || 'Company',
    startDate: x.startDate || (x.year ? (x.year.includes('-') ? x.year.split('-')[0].trim() : x.year.trim()) : '2026'),
    endDate: x.endDate || (x.year && x.year.includes('-') ? x.year.split('-')[1].trim() : (x.startDate || 'Present')),
    description: x.description || '',
    orderIndex: x.orderIndex || idx + 1
  }));
};

// GET /api/experience - Public
router.get('/', async (req, res) => {
  try {
    if (isMongoReady()) {
      const items = await Experience.find().sort({ orderIndex: 1, createdAt: -1 });
      if (items.length > 0) {
        return res.json({ success: true, count: items.length, data: items });
      }
    }
    const fallback = getFallbackExperience();
    res.json({ success: true, count: fallback.length, data: fallback });
  } catch (err) {
    const fallback = getFallbackExperience();
    res.json({ success: true, count: fallback.length, data: fallback });
  }
});

// Admin Routes - Create Experience
const handleCreateExperience = async (req, res) => {
  try {
    const data = { ...req.body };
    if (data.skills && typeof data.skills === 'string') {
      data.skills = data.skills.split(',').map(s => s.trim()).filter(Boolean);
    }

    if (req.files) {
      if (req.files.logo && req.files.logo[0]) {
        const file = req.files.logo[0];
        data.companyLogo = `/uploads/images/${file.filename}`;
        if (isMongoReady()) {
          await File.create({
            originalName: file.originalname,
            storedName: file.filename,
            mimeType: file.mimetype,
            size: file.size,
            path: data.companyLogo,
            category: 'image',
            relatedSection: 'Experience'
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
            relatedSection: 'Experience'
          }).catch(() => {});
        }
      }
    }

    if (isMongoReady()) {
      const item = new Experience(data);
      await item.save();
      return res.json({ success: true, message: 'Experience added successfully', data: item });
    }

    const workData = getWorkData();
    if (!workData.experience) workData.experience = [];
    const entryTitle = data.title || data.role || data.position || 'Software Engineer';
    const newEntry = {
      _id: `exp-${Date.now()}`,
      title: entryTitle,
      role: entryTitle,
      subtitle: data.company || '',
      company: data.company || '',
      year: `${data.startDate || '2026'} - ${data.endDate || 'Present'}`,
      startDate: data.startDate || '2026',
      endDate: data.endDate || 'Present',
      description: data.description || '',
      orderIndex: data.orderIndex ? parseInt(data.orderIndex) : workData.experience.length + 1
    };
    workData.experience.unshift(newEntry);
    saveWorkData(workData);
    return res.json({ success: true, message: 'Experience added successfully', data: newEntry });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const uploadFields = upload.fields([
  { name: 'logo', maxCount: 1 },
  { name: 'certificate', maxCount: 1 }
]);

router.post('/', authMiddleware, uploadFields, handleCreateExperience);
router.post('/admin/experience', authMiddleware, uploadFields, handleCreateExperience);

// Admin Routes - Update Experience
const handleUpdateExperience = async (req, res) => {
  try {
    const data = { ...req.body };
    const id = req.params.id;

    if (data.skills && typeof data.skills === 'string') {
      data.skills = data.skills.split(',').map(s => s.trim()).filter(Boolean);
    }

    if (isMongoReady()) {
      const item = await Experience.findByIdAndUpdate(id, data, { new: true });
      if (item) {
        return res.json({ success: true, message: 'Experience updated successfully', data: item });
      }
    }

    const workData = getWorkData();
    if (workData.experience) {
      const index = workData.experience.findIndex((x, idx) => (x._id === id || `exp-${idx}` === id));
      if (index !== -1) {
        const updatedTitle = data.title || data.role || data.position || workData.experience[index].title;
        workData.experience[index] = {
          ...workData.experience[index],
          title: updatedTitle,
          role: updatedTitle,
          subtitle: data.company || workData.experience[index].subtitle,
          company: data.company || workData.experience[index].company,
          startDate: data.startDate || workData.experience[index].startDate,
          endDate: data.endDate || workData.experience[index].endDate,
          year: `${data.startDate || '2026'} - ${data.endDate || 'Present'}`,
          description: data.description !== undefined ? data.description : workData.experience[index].description
        };
        saveWorkData(workData);
        return res.json({ success: true, message: 'Experience updated successfully', data: workData.experience[index] });
      }
    }

    res.json({ success: true, message: 'Experience updated successfully', data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

router.put('/:id', authMiddleware, uploadFields, handleUpdateExperience);
router.put('/admin/experience/:id', authMiddleware, uploadFields, handleUpdateExperience);

// Admin Routes - Delete Experience
const handleDeleteExperience = async (req, res) => {
  try {
    const id = req.params.id;
    if (isMongoReady()) {
      const item = await Experience.findByIdAndDelete(id);
      if (item) {
        return res.json({ success: true, message: 'Experience deleted successfully' });
      }
    }

    const workData = getWorkData();
    if (workData.experience) {
      workData.experience = workData.experience.filter((x, idx) => x._id !== id && `exp-${idx}` !== id);
      saveWorkData(workData);
    }

    res.json({ success: true, message: 'Experience deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

router.delete('/:id', authMiddleware, handleDeleteExperience);
router.delete('/admin/experience/:id', authMiddleware, handleDeleteExperience);

module.exports = router;

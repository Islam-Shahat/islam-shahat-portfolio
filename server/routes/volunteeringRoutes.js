const express = require('express');
const router = express.Router();
const Volunteering = require('../models/Volunteering');
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

const getFallbackVolunteering = () => {
  const data = getWorkData();
  return (data.volunteering || []).map((x, idx) => ({
    _id: x._id || `vol-${idx}`,
    role: x.role || x.title,
    organization: x.organization || x.subtitle || 'Support Community',
    location: x.location || '',
    startDate: x.startDate || (x.year ? x.year.split('-')[0].trim() : '2026'),
    endDate: x.endDate || (x.year && x.year.includes('-') ? x.year.split('-')[1].trim() : 'Present'),
    description: x.description || '',
    orderIndex: x.orderIndex || idx + 1
  }));
};

// GET /api/volunteering - Public
router.get('/', async (req, res) => {
  try {
    if (isMongoReady()) {
      const items = await Volunteering.find().sort({ orderIndex: 1, createdAt: -1 });
      if (items.length > 0) {
        return res.json({ success: true, count: items.length, data: items });
      }
    }
    const fallback = getFallbackVolunteering();
    res.json({ success: true, count: fallback.length, data: fallback });
  } catch (err) {
    const fallback = getFallbackVolunteering();
    res.json({ success: true, count: fallback.length, data: fallback });
  }
});

const uploadFields = upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'files', maxCount: 5 }
]);

// Admin Routes - Create Volunteering
const handleCreateVolunteering = async (req, res) => {
  try {
    const data = { ...req.body };
    if (data.skills && typeof data.skills === 'string') {
      data.skills = data.skills.split(',').map(s => s.trim()).filter(Boolean);
    }

    if (req.files) {
      if (req.files.image && req.files.image[0]) {
        const file = req.files.image[0];
        data.image = `/uploads/images/${file.filename}`;
        if (isMongoReady()) {
          await File.create({
            originalName: file.originalname,
            storedName: file.filename,
            mimeType: file.mimetype,
            size: file.size,
            path: data.image,
            category: 'image',
            relatedSection: 'Volunteering'
          }).catch(() => {});
        }
      }
      if (req.files.files && req.files.files.length > 0) {
        data.supportingFiles = [];
        for (const file of req.files.files) {
          const isPdf = file.mimetype === 'application/pdf';
          const filePath = `/uploads/documents/${file.filename}`;
          data.supportingFiles.push({
            path: filePath,
            originalName: file.originalname
          });
          if (isMongoReady()) {
            await File.create({
              originalName: file.originalname,
              storedName: file.filename,
              mimeType: file.mimetype,
              size: file.size,
              path: filePath,
              category: isPdf ? 'document' : 'document',
              relatedSection: 'Volunteering'
            }).catch(() => {});
          }
        }
      }
    }

    if (isMongoReady()) {
      const item = new Volunteering(data);
      await item.save();
      return res.json({ success: true, message: 'Volunteering entry added successfully', data: item });
    }

    const workData = getWorkData();
    if (!workData.volunteering) workData.volunteering = [];
    const newEntry = {
      _id: `vol-${Date.now()}`,
      title: data.role,
      role: data.role,
      subtitle: data.organization,
      organization: data.organization,
      year: `${data.startDate || '2026'} - ${data.endDate || 'Present'}`,
      startDate: data.startDate || '2026',
      endDate: data.endDate || 'Present',
      description: data.description || '',
      orderIndex: data.orderIndex ? parseInt(data.orderIndex) : workData.volunteering.length + 1
    };
    workData.volunteering.unshift(newEntry);
    saveWorkData(workData);
    return res.json({ success: true, message: 'Volunteering entry added successfully', data: newEntry });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

router.post('/', authMiddleware, uploadFields, handleCreateVolunteering);
router.post('/admin/volunteering', authMiddleware, uploadFields, handleCreateVolunteering);

// Admin Routes - Update Volunteering
const handleUpdateVolunteering = async (req, res) => {
  try {
    const data = { ...req.body };
    const id = req.params.id;

    if (data.skills && typeof data.skills === 'string') {
      data.skills = data.skills.split(',').map(s => s.trim()).filter(Boolean);
    }

    if (req.files) {
      if (req.files.image && req.files.image[0]) {
        const file = req.files.image[0];
        data.image = `/uploads/images/${file.filename}`;
        if (isMongoReady()) {
          await File.create({
            originalName: file.originalname,
            storedName: file.filename,
            mimeType: file.mimetype,
            size: file.size,
            path: data.image,
            category: 'image',
            relatedSection: 'Volunteering'
          }).catch(() => {});
        }
      }
      if (req.files.files && req.files.files.length > 0) {
        data.supportingFiles = [];
        for (const file of req.files.files) {
          const isPdf = file.mimetype === 'application/pdf';
          const filePath = `/uploads/documents/${file.filename}`;
          data.supportingFiles.push({
            path: filePath,
            originalName: file.originalname
          });
          if (isMongoReady()) {
            await File.create({
              originalName: file.originalname,
              storedName: file.filename,
              mimeType: file.mimetype,
              size: file.size,
              path: filePath,
              category: isPdf ? 'document' : 'document',
              relatedSection: 'Volunteering'
            }).catch(() => {});
          }
        }
      }
    }

    if (isMongoReady()) {
      const item = await Volunteering.findByIdAndUpdate(id, data, { new: true });
      if (item) {
        return res.json({ success: true, message: 'Volunteering updated successfully', data: item });
      }
    }

    const workData = getWorkData();
    if (workData.volunteering) {
      const index = workData.volunteering.findIndex((x, idx) => (x._id === id || `vol-${idx}` === id));
      if (index !== -1) {
        workData.volunteering[index] = {
          ...workData.volunteering[index],
          title: data.role || workData.volunteering[index].title,
          role: data.role || workData.volunteering[index].role,
          subtitle: data.organization || workData.volunteering[index].subtitle,
          organization: data.organization || workData.volunteering[index].organization,
          startDate: data.startDate || workData.volunteering[index].startDate,
          endDate: data.endDate || workData.volunteering[index].endDate,
          year: `${data.startDate || '2026'} - ${data.endDate || 'Present'}`,
          description: data.description !== undefined ? data.description : workData.volunteering[index].description
        };
        saveWorkData(workData);
        return res.json({ success: true, message: 'Volunteering updated successfully', data: workData.volunteering[index] });
      }
    }

    res.json({ success: true, message: 'Volunteering updated successfully', data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

router.put('/:id', authMiddleware, uploadFields, handleUpdateVolunteering);
router.put('/admin/volunteering/:id', authMiddleware, uploadFields, handleUpdateVolunteering);

// Admin Routes - Delete Volunteering
const handleDeleteVolunteering = async (req, res) => {
  try {
    const id = req.params.id;
    if (isMongoReady()) {
      const item = await Volunteering.findByIdAndDelete(id);
      if (item) {
        return res.json({ success: true, message: 'Volunteering entry deleted successfully' });
      }
    }

    const workData = getWorkData();
    if (workData.volunteering) {
      workData.volunteering = workData.volunteering.filter((x, idx) => x._id !== id && `vol-${idx}` !== id);
      saveWorkData(workData);
    }

    res.json({ success: true, message: 'Volunteering deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

router.delete('/:id', authMiddleware, handleDeleteVolunteering);
router.delete('/admin/volunteering/:id', authMiddleware, handleDeleteVolunteering);

module.exports = router;

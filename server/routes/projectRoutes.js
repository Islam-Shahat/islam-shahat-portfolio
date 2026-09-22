const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const Project = require('../models/Project');
const { protect } = require('../middleware/authMiddleware');
const { upload } = require('../middleware/uploadMiddleware');
const { uploadToCloudinary, isCloudinaryConfigured, deleteFromCloudinary, extractPublicId } = require('../config/cloudinary');

const jsonPath = path.join(__dirname, '../../client/assets/data/projects.json');

// Helper to read fallback JSON projects
const getFallbackProjects = () => {
  try {
    if (fs.existsSync(jsonPath)) {
      const raw = fs.readFileSync(jsonPath, 'utf8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn('Notice: Error reading projects.json fallback:', err.message);
  }
  return [];
};

// Helper to write fallback JSON projects
const saveFallbackProjects = (projects) => {
  try {
    fs.writeFileSync(jsonPath, JSON.stringify(projects, null, 4), 'utf8');
  } catch (err) {
    console.warn('Notice: Error writing projects.json fallback:', err.message);
  }
};

// Check if MongoDB connection is ready
const isMongoReady = () => mongoose.connection.readyState === 1;

// Helper to check if caller has valid admin token
const isAuthorizedAdmin = (req) => {
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ') && process.env.JWT_SECRET) {
    try {
      const token = req.headers.authorization.split(' ')[1];
      jwt.verify(token, process.env.JWT_SECRET);
      return true;
    } catch {
      return false;
    }
  }
  return false;
};

// @route   GET /api/projects
// @desc    Get all published projects (or all drafts if authenticated admin)
// @access  Public (Drafts restricted to Authenticated Admin)
router.get('/', async (req, res) => {
  try {
    const includeDraftsRequested = req.query.includeDrafts === 'true';
    const allowDrafts = includeDraftsRequested && isAuthorizedAdmin(req);

    if (isMongoReady()) {
      const query = allowDrafts ? {} : { status: 'published' };
      let projects = await Project.find(query).sort({ orderIndex: 1, createdAt: -1 });
      if (projects.length === 0) {
        projects = getFallbackProjects();
        if (!allowDrafts) {
          projects = projects.filter(p => p.status !== 'draft');
        }
      }
      return res.json({ success: true, count: projects.length, data: projects });
    } else {
      // Fallback mode using JSON file
      let projects = getFallbackProjects();
      if (!allowDrafts) {
        projects = projects.filter(p => p.status !== 'draft');
      }
      return res.json({ success: true, count: projects.length, data: projects });
    }
  } catch (error) {
    console.warn('MongoDB error, using fallback JSON projects:', error.message);
    const allowDrafts = req.query.includeDrafts === 'true' && isAuthorizedAdmin(req);
    let projects = getFallbackProjects();
    if (!allowDrafts) {
      projects = projects.filter(p => p.status !== 'draft');
    }
    return res.json({ success: true, count: projects.length, data: projects });
  }
});

// @route   GET /api/projects/:id
// @desc    Get single project details
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    if (isMongoReady()) {
      const project = await Project.findById(req.params.id);
      if (project) return res.json({ success: true, data: project });
    }
    
    const projects = getFallbackProjects();
    const project = projects.find(p => p.id === req.params.id || p._id === req.params.id);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }
    res.json({ success: true, data: project });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ==================== ADMIN PROTECTED ROUTES ====================

// @route   POST /api/projects or /api/projects/admin/projects
// @desc    Create new project
// @access  Private (Admin)
const handleCreateProject = async (req, res) => {
  try {
    const {
      title,
      category,
      description,
      subtitle,
      fullDescription,
      coverImage,
      image,
      gallery,
      images,
      date,
      demo,
      github,
      technologies,
      isFeatured,
      status,
      orderIndex
    } = req.body;

    if (!title || !category || !description) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields: Title, Category, and Description.'
      });
    }

    let parsedTech = [];
    if (Array.isArray(technologies)) {
      parsedTech = technologies;
    } else if (typeof technologies === 'string' && technologies.trim()) {
      parsedTech = technologies.split(',').map(t => t.trim());
    }

    // Parse gallery images array (may come as JSON string or array or comma-separated)
    let parsedGallery = [];
    const rawImages = gallery || images;
    if (Array.isArray(rawImages)) {
      parsedGallery = rawImages.filter(Boolean);
    } else if (typeof rawImages === 'string' && rawImages.trim()) {
      try { parsedGallery = JSON.parse(rawImages); } catch { parsedGallery = rawImages.split(',').map(s => s.trim()).filter(Boolean); }
    }

    const mainCover = coverImage || image || 'assets/img/backend_api.webp';

    let newProjectData = {
      title,
      category,
      description,
      subtitle: subtitle || '',
      fullDescription: fullDescription || '',
      coverImage: mainCover,
      image: mainCover,
      gallery: parsedGallery,
      images: parsedGallery,
      date: date || new Date().getFullYear().toString(),
      demo: demo || '',
      github: github || '',
      technologies: parsedTech,
      isFeatured: isFeatured === true || isFeatured === 'true',
      status: status || 'published',
      orderIndex: orderIndex ? parseInt(orderIndex) : 0
    };

    if (isMongoReady()) {
      const newProject = new Project(newProjectData);
      await newProject.save();
      return res.status(201).json({
        success: true,
        message: 'Project created successfully! (تم إضافة المشروع بنجاح)',
        data: newProject
      });
    } else {
      const projects = getFallbackProjects();
      newProjectData.id = Date.now().toString();
      newProjectData._id = newProjectData.id;
      projects.unshift(newProjectData);
      saveFallbackProjects(projects);

      return res.status(201).json({
        success: true,
        message: 'Project created successfully! (تم إضافة المشروع بنجاح)',
        data: newProjectData
      });
    }
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error creating project' });
  }
};

router.post('/', protect, handleCreateProject);
router.post('/admin/projects', protect, handleCreateProject);

// @route   PUT /api/projects/:id or /api/projects/admin/projects/:id
// @desc    Update project
// @access  Private (Admin)
const handleUpdateProject = async (req, res) => {
  try {
    const id = req.params.id;

    if (isMongoReady()) {
      let project = await Project.findById(id);
      if (project) {
        if (req.body.technologies && typeof req.body.technologies === 'string') {
          req.body.technologies = req.body.technologies.split(',').map(t => t.trim());
        }
        // Parse gallery / images array if sent as string
        const rawGallery = req.body.gallery || req.body.images;
        if (rawGallery && typeof rawGallery === 'string') {
          try {
            const parsed = JSON.parse(rawGallery);
            req.body.gallery = parsed;
            req.body.images = parsed;
          } catch {
            const parsed = rawGallery.split(',').map(s => s.trim()).filter(Boolean);
            req.body.gallery = parsed;
            req.body.images = parsed;
          }
        }
        if (req.body.coverImage) req.body.image = req.body.coverImage;
        if (req.body.image && !req.body.coverImage) req.body.coverImage = req.body.image;

        project = await Project.findByIdAndUpdate(id, req.body, { new: true, runValidators: true });
        return res.json({
          success: true,
          message: 'Project updated successfully! (تم تعديل المشروع بنجاح)',
          data: project
        });
      }
    }

    const projects = getFallbackProjects();
    const index = projects.findIndex(p => p.id === id || p._id === id);
    if (index === -1) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    projects[index] = { ...projects[index], ...req.body };
    saveFallbackProjects(projects);

    res.json({
      success: true,
      message: 'Project updated successfully! (تم تعديل المشروع بنجاح)',
      data: projects[index]
    });
  } catch (error) {
    console.error('Error updating project:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error updating project' });
  }
};

router.put('/:id', protect, handleUpdateProject);
router.put('/admin/projects/:id', protect, handleUpdateProject);

// @route   DELETE /api/projects/:id or /api/projects/admin/projects/:id
// @desc    Delete project
// @access  Private (Admin)
const handleDeleteProject = async (req, res) => {
  try {
    const id = req.params.id;

    if (isMongoReady()) {
      const project = await Project.findById(id);
      if (project) {
        await project.deleteOne();
        return res.json({ success: true, message: 'Project deleted successfully! (تم حذف المشروع بنجاح)' });
      }
    }

    let projects = getFallbackProjects();
    const initialLen = projects.length;
    projects = projects.filter(p => p.id !== id && p._id !== id);
    
    if (projects.length === initialLen) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    saveFallbackProjects(projects);
    res.json({ success: true, message: 'Project deleted successfully! (تم حذف المشروع بنجاح)' });
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({ success: false, message: 'Server error deleting project' });
  }
};

router.delete('/:id', protect, handleDeleteProject);
router.delete('/admin/projects/:id', protect, handleDeleteProject);

// @route   POST /api/projects/upload or /api/projects/admin/upload
// @desc    Upload single project image (local fallback or Cloudinary)
// @access  Private (Admin)
const handleUpload = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please upload an image file' });
    }

    // Try Cloudinary first
    if (isCloudinaryConfigured()) {
      const cloudResult = await uploadToCloudinary(req.file.path, 'portfolio/projects', 'image');
      if (cloudResult) {
        return res.json({
          success: true,
          message: 'Image uploaded to Cloudinary!',
          filePath: cloudResult.secure_url,
          cloudinaryUrl: cloudResult.secure_url,
          publicId: cloudResult.public_id
        });
      }
    }

    // Fallback to local storage
    const relativePath = `/uploads/projects/${req.file.filename}`;
    res.json({
      success: true,
      message: 'Image uploaded locally!',
      filePath: relativePath
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ success: false, message: 'Failed to upload image' });
  }
};

router.post('/upload', protect, upload.single('image'), handleUpload);
router.post('/admin/upload', protect, upload.single('image'), handleUpload);

// @route   POST /api/projects/upload-multiple or /api/projects/admin/upload-multiple
// @desc    Upload multiple project images (gallery support)
// @access  Private (Admin)
const handleUploadMultiple = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'Please upload at least one image' });
    }

    const uploadedUrls = [];

    for (const file of req.files) {
      if (isCloudinaryConfigured()) {
        const cloudResult = await uploadToCloudinary(file.path, 'portfolio/projects', 'image');
        if (cloudResult) {
          uploadedUrls.push({ url: cloudResult.secure_url, publicId: cloudResult.public_id });
          continue;
        }
      }
      // Fallback: local path
      uploadedUrls.push({ url: `/uploads/projects/${file.filename}`, publicId: null });
    }

    res.json({
      success: true,
      message: `${uploadedUrls.length} image(s) uploaded successfully!`,
      files: uploadedUrls,
      urls: uploadedUrls.map(f => f.url)
    });
  } catch (error) {
    console.error('Multi-upload error:', error);
    res.status(500).json({ success: false, message: 'Failed to upload images' });
  }
};

router.post('/upload-multiple', protect, upload.array('images', 10), handleUploadMultiple);
router.post('/admin/upload-multiple', protect, upload.array('images', 10), handleUploadMultiple);

module.exports = router;

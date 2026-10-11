const express = require('express');
const router = express.Router();
const Skill = require('../models/Skill');
const authMiddleware = require('../middleware/authMiddleware');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

const isMongoReady = () => mongoose.connection.readyState === 1;

const skillsJsonPath = path.join(__dirname, '../../client/assets/data/skills.json');

// Default initial skills for Islam Shahat's portfolio
const defaultPortfolioSkills = [
  // Frontend
  { name: 'HTML5 & CSS3', category: 'Frontend', level: 'Advanced', proficiency: 95, icon: 'ri-html5-fill', iconClass: 'ri-html5-fill', status: 'published', active: true, orderIndex: 1 },
  { name: 'JavaScript / TypeScript', category: 'Frontend', level: 'Advanced', proficiency: 90, icon: 'ri-javascript-fill', iconClass: 'ri-javascript-fill', status: 'published', active: true, orderIndex: 2 },
  { name: 'React.js', category: 'Frontend', level: 'Advanced', proficiency: 90, icon: 'ri-reactjs-line', iconClass: 'ri-reactjs-line', status: 'published', active: true, orderIndex: 3 },
  { name: 'Responsive Web Design', category: 'Frontend', level: 'Advanced', proficiency: 95, icon: 'ri-layout-masonry-line', iconClass: 'ri-layout-masonry-line', status: 'published', active: true, orderIndex: 4 },
  { name: 'Tailwind & Bootstrap', category: 'Frontend', level: 'Advanced', proficiency: 88, icon: 'ri-palette-line', iconClass: 'ri-palette-line', status: 'published', active: true, orderIndex: 5 },

  // Backend & Databases
  { name: 'Node.js', category: 'Backend', level: 'Advanced', proficiency: 90, icon: 'ri-nodejs-line', iconClass: 'ri-nodejs-line', status: 'published', active: true, orderIndex: 6 },
  { name: 'Express.js', category: 'Backend', level: 'Advanced', proficiency: 90, icon: 'ri-settings-5-line', iconClass: 'ri-settings-5-line', status: 'published', active: true, orderIndex: 7 },
  { name: 'RESTful APIs & Auth (JWT)', category: 'Backend', level: 'Advanced', proficiency: 92, icon: 'ri-shield-keyhole-line', iconClass: 'ri-shield-keyhole-line', status: 'published', active: true, orderIndex: 8 },
  { name: 'MongoDB', category: 'Database', level: 'Advanced', proficiency: 88, icon: 'ri-database-2-line', iconClass: 'ri-database-2-line', status: 'published', active: true, orderIndex: 9 },
  { name: 'SQL (SQL Server / PostgreSQL)', category: 'Database', level: 'Intermediate', proficiency: 80, icon: 'ri-database-line', iconClass: 'ri-database-line', status: 'published', active: true, orderIndex: 10 },
  { name: 'Docker', category: 'Backend', level: 'Intermediate', proficiency: 75, icon: 'ri-docker-fill', iconClass: 'ri-docker-fill', status: 'published', active: true, orderIndex: 11 },

  // Core CS & Tools
  { name: 'C++ & OOP', category: 'Tools', level: 'Advanced', proficiency: 90, icon: 'ri-braces-line', iconClass: 'ri-braces-line', status: 'published', active: true, orderIndex: 12 },
  { name: 'Data Structures & Algorithms', category: 'Tools', level: 'Intermediate', proficiency: 85, icon: 'ri-node-tree', iconClass: 'ri-node-tree', status: 'published', active: true, orderIndex: 13 },
  { name: 'Git & GitHub', category: 'Tools', level: 'Advanced', proficiency: 90, icon: 'ri-git-branch-line', iconClass: 'ri-git-branch-line', status: 'published', active: true, orderIndex: 14 },
  { name: 'Postman', category: 'Tools', level: 'Advanced', proficiency: 90, icon: 'ri-send-plane-2-line', iconClass: 'ri-send-plane-2-line', status: 'published', active: true, orderIndex: 15 }
];

const loadFallbackSkills = () => {
  if (fs.existsSync(skillsJsonPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(skillsJsonPath, 'utf8'));
      if (Array.isArray(data) && data.length > 0) return data;
    } catch (e) {
      console.warn('Error reading skills.json fallback:', e.message);
    }
  }
  return [...defaultPortfolioSkills.map((s, i) => ({ ...s, _id: `skill-${i + 1}` }))];
};

const saveFallbackSkills = (skills) => {
  try {
    fs.writeFileSync(skillsJsonPath, JSON.stringify(skills, null, 4), 'utf8');
  } catch (err) {
    console.warn('Failed to save skills.json fallback:', err.message);
  }
};

let fallbackSkills = loadFallbackSkills();

const sanitizeSkillData = (body) => {
  const proficiency = body.proficiency !== undefined && body.proficiency !== ''
    ? Math.min(100, Math.max(1, parseInt(body.proficiency, 10) || 85))
    : 85;

  const level = body.level && ['Advanced', 'Intermediate', 'Basic'].includes(body.level)
    ? body.level
    : (proficiency >= 85 ? 'Advanced' : proficiency >= 70 ? 'Intermediate' : 'Basic');

  const icon = (body.icon || body.iconClass || 'ri-code-line').trim();
  const active = body.active !== undefined
    ? (body.active === true || body.active === 'true' || body.active === 1)
    : (body.status !== 'draft');
  const status = body.status || (active ? 'published' : 'draft');
  const orderIndex = body.orderIndex !== undefined && body.orderIndex !== ''
    ? parseInt(body.orderIndex, 10)
    : 1;

  return {
    name: body.name ? body.name.trim() : '',
    category: body.category ? body.category.trim() : 'Frontend',
    level,
    proficiency,
    icon,
    iconClass: icon,
    status,
    active,
    orderIndex: isNaN(orderIndex) ? 1 : orderIndex
  };
};

// GET /api/skills - Public
router.get('/', async (req, res) => {
  try {
    if (isMongoReady()) {
      let items = await Skill.find().sort({ orderIndex: 1, createdAt: 1 });
      if (items.length === 0) {
        // Auto-seed default skills into MongoDB
        try {
          await Skill.insertMany(defaultPortfolioSkills);
          items = await Skill.find().sort({ orderIndex: 1, createdAt: 1 });
        } catch (seedErr) {
          console.warn('[Skills Seed Warning]:', seedErr.message);
        }
      }
      if (items && items.length > 0) {
        return res.json({ success: true, count: items.length, data: items });
      }
    }
    return res.json({ success: true, count: fallbackSkills.length, data: fallbackSkills });
  } catch (err) {
    return res.json({ success: true, count: fallbackSkills.length, data: fallbackSkills });
  }
});

// Admin Routes - Create Skill
const handleCreateSkill = async (req, res) => {
  try {
    const data = sanitizeSkillData(req.body);
    if (!data.name) {
      return res.status(400).json({ success: false, message: 'اسم المهارة مطلوب' });
    }

    if (isMongoReady()) {
      const item = await Skill.create(data);
      return res.status(201).json({ success: true, message: 'تمت إضافة المهارة بنجاح', data: item });
    }

    const newSkill = {
      _id: `skill-${Date.now()}`,
      ...data
    };
    fallbackSkills.push(newSkill);
    saveFallbackSkills(fallbackSkills);
    res.status(201).json({ success: true, message: 'تمت إضافة المهارة بنجاح', data: newSkill });
  } catch (err) {
    console.error('[Skill Create Error]:', err);
    res.status(400).json({ success: false, message: err.message || 'فشل في حفظ المهارة' });
  }
};

router.post('/', authMiddleware, handleCreateSkill);
router.post('/admin/skills', authMiddleware, handleCreateSkill);

// Admin Routes - Update Skill
const handleUpdateSkill = async (req, res) => {
  try {
    const id = req.params.id;
    const data = sanitizeSkillData(req.body);

    if (isMongoReady() && mongoose.isValidObjectId(id)) {
      const item = await Skill.findByIdAndUpdate(id, data, { new: true, runValidators: true });
      if (item) {
        return res.json({ success: true, message: 'تم تحديث المهارة بنجاح', data: item });
      }
    }

    const index = fallbackSkills.findIndex(s => s._id === id);
    if (index !== -1) {
      fallbackSkills[index] = { ...fallbackSkills[index], ...data, _id: id };
      saveFallbackSkills(fallbackSkills);
      return res.json({ success: true, message: 'تم تحديث المهارة بنجاح', data: fallbackSkills[index] });
    }

    res.status(404).json({ success: false, message: 'المهارة المطلوبة غير موجودة' });
  } catch (err) {
    console.error('[Skill Update Error]:', err);
    res.status(400).json({ success: false, message: err.message || 'فشل في تحديث المهارة' });
  }
};

router.put('/:id', authMiddleware, handleUpdateSkill);
router.put('/admin/skills/:id', authMiddleware, handleUpdateSkill);

// Admin Routes - Delete Skill
const handleDeleteSkill = async (req, res) => {
  try {
    const id = req.params.id;
    if (isMongoReady() && mongoose.isValidObjectId(id)) {
      await Skill.findByIdAndDelete(id);
    }
    fallbackSkills = fallbackSkills.filter(s => s._id !== id);
    saveFallbackSkills(fallbackSkills);
    res.json({ success: true, message: 'تم حذف المهارة بنجاح' });
  } catch (err) {
    console.error('[Skill Delete Error]:', err);
    res.status(500).json({ success: false, message: err.message || 'فشل في حذف المهارة' });
  }
};

router.delete('/:id', authMiddleware, handleDeleteSkill);
router.delete('/admin/skills/:id', authMiddleware, handleDeleteSkill);

module.exports = router;


const dns = require('dns');
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {}

const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

const atlasUri = 'mongodb+srv://islam-shahat:Moe011222@portfolio.dryjpre.mongodb.net/islam_portfolio?retryWrites=true&w=majority&appName=portfolio';
const localUri = 'mongodb://127.0.0.1:27017/islam_portfolio';

async function migrate() {
  console.log('--- Starting Migration to MongoDB Atlas Cloud Database ---');

  // 1. Connect to Local MongoDB
  let localConn = null;
  try {
    localConn = await mongoose.createConnection(localUri, { serverSelectionTimeoutMS: 4000 }).asPromise();
    console.log('✅ Connected to Local MongoDB');
  } catch (err) {
    console.log('⚠️ Local MongoDB not reachable:', err.message);
  }

  // 2. Connect to Atlas
  const atlasConn = await mongoose.createConnection(atlasUri, { serverSelectionTimeoutMS: 10000 }).asPromise();
  console.log('✅ Connected to MongoDB Atlas Cloud Cluster!');

  const modelsList = [
    { name: 'User', schema: require('../models/User').schema },
    { name: 'Project', schema: require('../models/Project').schema },
    { name: 'Skill', schema: require('../models/Skill').schema },
    { name: 'Certificate', schema: require('../models/Certificate').schema },
    { name: 'Experience', schema: require('../models/Experience').schema },
    { name: 'Education', schema: require('../models/Education').schema },
    { name: 'Volunteering', schema: require('../models/Volunteering').schema },
    { name: 'Testimonial', schema: require('../models/Testimonial').schema },
    { name: 'CV', schema: require('../models/CV').schema },
    { name: 'File', schema: require('../models/File').schema }
  ];

  for (const m of modelsList) {
    const AtlasModel = atlasConn.model(m.name, m.schema);
    let docs = [];

    // Try fetching from local DB
    if (localConn) {
      try {
        const LocalModel = localConn.model(m.name, m.schema);
        docs = await LocalModel.find().lean();
      } catch (e) {
        console.warn(`Error reading local ${m.name}:`, e.message);
      }
    }

    // If local was empty, check JSON fallback files
    if (docs.length === 0) {
      if (m.name === 'Project') {
        const pFile = path.join(__dirname, '../../client/assets/data/projects.json');
        if (fs.existsSync(pFile)) {
          const raw = JSON.parse(fs.readFileSync(pFile, 'utf8'));
          docs = raw.projects || raw;
        }
      } else if (m.name === 'Skill') {
        const sFile = path.join(__dirname, '../../client/assets/data/skills.json');
        if (fs.existsSync(sFile)) {
          const raw = JSON.parse(fs.readFileSync(sFile, 'utf8'));
          docs = raw.skills || raw;
        }
      } else if (['Experience', 'Education', 'Volunteering', 'Certificate'].includes(m.name)) {
        const wFile = path.join(__dirname, '../../client/assets/data/work.json');
        if (fs.existsSync(wFile)) {
          const raw = JSON.parse(fs.readFileSync(wFile, 'utf8'));
          const key = m.name.toLowerCase() === 'certificate' ? 'certificates' : m.name.toLowerCase();
          docs = raw[key] || [];
        }
      }
    }

    if (docs && docs.length > 0) {
      const existingCount = await AtlasModel.countDocuments();
      if (existingCount < docs.length) {
        let inserted = 0;
        for (const doc of docs) {
          const copy = { ...doc };
          if (copy._id && !mongoose.Types.ObjectId.isValid(copy._id)) {
            delete copy._id;
          }
          delete copy.__v;

          try {
            if (copy._id) {
              await AtlasModel.findByIdAndUpdate(copy._id, copy, { upsert: true, new: true });
            } else {
              await AtlasModel.create(copy);
            }
            inserted++;
          } catch (insertErr) {
            // If duplicate key error, try create without _id
            try {
              delete copy._id;
              await AtlasModel.create(copy);
              inserted++;
            } catch (e2) {}
          }
        }
        console.log(`🚀 Migrated ${inserted} records for ${m.name} to MongoDB Atlas!`);
      } else {
        console.log(`ℹ️ Atlas already has ${existingCount} records for ${m.name}.`);
      }
    }
  }

  // 3. Ensure Default Admin User exists on Atlas
  const AtlasUser = atlasConn.model('User', require('../models/User').schema);
  const adminExists = await AtlasUser.findOne({ username: 'admin' });
  if (!adminExists) {
    const bcrypt = require('bcryptjs');
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('admin123', salt);
    await AtlasUser.create({
      username: 'admin',
      email: 'admin@islam-shahat.dev',
      password: hashedPassword,
      role: 'admin',
      fullName: 'Islam Shahat'
    });
    console.log('✅ Created default admin user on Atlas: username: admin / password: admin123');
  } else {
    console.log('✅ Admin user verified on Atlas.');
  }

  console.log('🎉 --- Migration to Cloud MongoDB Completed Successfully! ---');
  if (localConn) await localConn.close();
  await atlasConn.close();
  process.exit(0);
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});

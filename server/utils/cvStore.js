const fs = require('fs');
const path = require('path');

const isVercel = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME;
const dataDir = isVercel ? path.join('/tmp', 'data') : path.join(__dirname, '../data');
const dataFilePath = path.join(dataDir, 'cvs.json');

const initialCv = {
  _id: 'cv-active-islam',
  name: 'Islam_Shahat_CV.pdf',
  version: 'v2.0',
  pdfFile: '/uploads/cv/Islam_Shahat_CV.pdf',
  originalName: 'Islam_Shahat_CV.pdf',
  fileSize: 58439,
  active: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

function ensureFileExists() {
  try {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    if (!fs.existsSync(dataFilePath)) {
      fs.writeFileSync(dataFilePath, JSON.stringify([initialCv], null, 2), 'utf8');
    }
  } catch (err) {
    // Graceful fallback for read-only environments
  }
}

function loadCvsFromFile() {
  ensureFileExists();
  try {
    if (fs.existsSync(dataFilePath)) {
      const raw = fs.readFileSync(dataFilePath, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Notice: Error reading cvs.json fallback:', err.message);
  }
  return [initialCv];
}

function saveCvsToFile(cvList) {
  ensureFileExists();
  try {
    fs.writeFileSync(dataFilePath, JSON.stringify(cvList, null, 2), 'utf8');
  } catch (err) {
    console.warn('Notice: Error writing cvs.json fallback:', err.message);
  }
}

module.exports = {
  initialCv,
  loadCvsFromFile,
  saveCvsToFile
};

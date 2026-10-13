require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const path = require('path');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

async function uploadFile(filePath, folder, resourceType = 'auto') {
  if (!fs.existsSync(filePath)) {
    console.warn(`[Skip] File not found: ${filePath}`);
    return null;
  }
  try {
    const filenameNoExt = path.parse(filePath).name;
    const res = await cloudinary.uploader.upload(filePath, {
      folder,
      resource_type: resourceType,
      public_id: filenameNoExt,
      overwrite: true
    });
    return res.secure_url;
  } catch (err) {
    console.error(`[Error] Failed uploading ${filePath}:`, err.message);
    return null;
  }
}

async function run() {
  console.log('🚀 Starting Cloudinary Sync...');

  // 1. Upload CVs
  const cvDir = path.join(__dirname, '../server/uploads/cv');
  const mainCvPath = path.join(cvDir, 'Islam_Shahat_CV.pdf');
  const assetCvPath = path.join(__dirname, '../client/assets/pdf/Islam_Shahat_CV.pdf');
  
  const uploadCvSource = fs.existsSync(mainCvPath) ? mainCvPath : assetCvPath;
  let liveCvUrl = '';
  if (fs.existsSync(uploadCvSource)) {
    console.log(`Uploading Primary CV from ${uploadCvSource}...`);
    liveCvUrl = await uploadFile(uploadCvSource, 'portfolio/cv', 'raw');
    console.log(`✅ CV Uploaded: ${liveCvUrl}`);
  }

  // 2. Upload Documents / Certificates
  const docsDir = path.join(__dirname, '../server/uploads/documents');
  const docUrlMap = {};

  if (fs.existsSync(docsDir)) {
    const files = fs.readdirSync(docsDir);
    for (const file of files) {
      const fullPath = path.join(docsDir, file);
      if (fs.statSync(fullPath).isFile()) {
        console.log(`Uploading certificate: ${file}...`);
        const url = await uploadFile(fullPath, 'portfolio/certificates', 'raw');
        if (url) {
          docUrlMap[`/uploads/documents/${file}`] = url;
          docUrlMap[file] = url;
        }
      }
    }
  }

  // 3. Update client/assets/data/work.json
  const workJsonPath = path.join(__dirname, '../client/assets/data/work.json');
  if (fs.existsSync(workJsonPath)) {
    try {
      const workData = JSON.parse(fs.readFileSync(workJsonPath, 'utf8'));
      let updatedCerts = 0;
      if (Array.isArray(workData.certificates)) {
        workData.certificates = workData.certificates.map(cert => {
          if (cert.pdfFile && docUrlMap[cert.pdfFile]) {
            cert.pdfFile = docUrlMap[cert.pdfFile];
            cert.cloudinaryUrl = docUrlMap[cert.pdfFile];
            updatedCerts++;
          } else if (cert.pdfFile) {
            const filename = path.basename(cert.pdfFile);
            if (docUrlMap[filename]) {
              cert.pdfFile = docUrlMap[filename];
              cert.cloudinaryUrl = docUrlMap[filename];
              updatedCerts++;
            }
          }
          return cert;
        });
      }

      fs.writeFileSync(workJsonPath, JSON.stringify(workData, null, 4), 'utf8');
      console.log(`✅ work.json updated successfully with ${updatedCerts} Cloudinary URLs!`);
    } catch (err) {
      console.error('Error updating work.json:', err.message);
    }
  }

  console.log('🎉 Done syncing files to Cloudinary!');
}

run();

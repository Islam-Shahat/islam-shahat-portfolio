require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const path = require('path');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

async function uploadPdfAndImage(filePath, filename) {
  if (!fs.existsSync(filePath)) return null;
  const filenameNoExt = path.parse(filename).name;

  let rawPdfUrl = '';
  let previewImageUrl = '';

  // 1. Upload Raw PDF (for Download)
  try {
    const rawRes = await cloudinary.uploader.upload(filePath, {
      folder: 'portfolio/certificates',
      resource_type: 'raw',
      public_id: filenameNoExt,
      overwrite: true
    });
    rawPdfUrl = rawRes.secure_url;
  } catch (e) {
    console.warn(`[Raw PDF Error] ${filename}:`, e.message);
  }

  // 2. Generate and Upload instant Image/WebP preview (First Page)
  try {
    const imgRes = await cloudinary.uploader.upload(filePath, {
      folder: 'portfolio/certificates_preview',
      resource_type: 'image',
      format: 'webp',
      public_id: filenameNoExt,
      page: 1,
      overwrite: true
    });
    previewImageUrl = imgRes.secure_url;
  } catch (e) {
    console.warn(`[Image Preview Error] ${filename}:`, e.message);
  }

  return { rawPdfUrl, previewImageUrl };
}

async function run() {
  console.log('⚡ Generating Instant Image Previews for Certificates...');

  const docsDir = path.join(__dirname, '../server/uploads/documents');
  const results = {};

  if (fs.existsSync(docsDir)) {
    const files = fs.readdirSync(docsDir);
    for (const file of files) {
      const fullPath = path.join(docsDir, file);
      if (fs.statSync(fullPath).isFile() && file.endsWith('.pdf')) {
        console.log(`Processing ${file}...`);
        const res = await uploadPdfAndImage(fullPath, file);
        if (res && res.previewImageUrl) {
          results[file] = res;
          results[`/uploads/documents/${file}`] = res;
        }
      }
    }
  }

  // Update client/assets/data/work.json
  const workJsonPath = path.join(__dirname, '../client/assets/data/work.json');
  if (fs.existsSync(workJsonPath)) {
    const workData = JSON.parse(fs.readFileSync(workJsonPath, 'utf8'));
    let count = 0;
    if (Array.isArray(workData.certificates)) {
      workData.certificates = workData.certificates.map(cert => {
        const rawFile = cert.pdfFile || '';
        const filename = path.basename(rawFile.split('?')[0]);

        // Find match in results
        let matched = results[filename] || results[rawFile];
        if (!matched) {
          for (const key of Object.keys(results)) {
            if (rawFile.includes(path.parse(key).name)) {
              matched = results[key];
              break;
            }
          }
        }

        if (matched) {
          cert.image = matched.previewImageUrl;
          if (matched.rawPdfUrl) cert.pdfFile = matched.rawPdfUrl;
          count++;
        }
        return cert;
      });
    }

    fs.writeFileSync(workJsonPath, JSON.stringify(workData, null, 4), 'utf8');
    console.log(`✅ work.json updated: ${count} certificates now have instant WebP images!`);
  }
}

run();

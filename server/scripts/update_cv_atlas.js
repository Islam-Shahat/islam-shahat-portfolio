const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
require('dotenv').config({ path: __dirname + '/../.env' });
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

async function updateCv() {
  await mongoose.connect(process.env.MONGODB_URI);
  const CV = require('../models/CV');

  const pdfPath = path.join(__dirname, '../uploads/cv/Islam_Shahat_CV.pdf');
  const fileBuffer = fs.readFileSync(pdfPath);
  const base64Data = fileBuffer.toString('base64');

  let cv = await CV.findOne({ active: true });
  if (!cv) cv = new CV();

  cv.name = 'Islam_Shahat_CV.pdf';
  cv.originalName = 'Islam_Shahat_CV.pdf';
  cv.pdfFile = '/uploads/cv/Islam_Shahat_CV.pdf';
  cv.fileSize = fileBuffer.length;
  cv.fileData = base64Data;
  cv.active = true;

  await cv.save();

  console.log('Active CV in Atlas updated successfully:', cv.name, 'Size:', cv.fileSize, 'Has fileData:', !!cv.fileData);
  await mongoose.disconnect();
}

updateCv().catch(console.error);

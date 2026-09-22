const cloudinary = require('cloudinary').v2;
const path = require('path');
const fs = require('fs');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || '',
  api_key: process.env.CLOUDINARY_API_KEY || '',
  api_secret: process.env.CLOUDINARY_API_SECRET || ''
});

const isCloudinaryConfigured = () => {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
};

/**
 * Upload a file to Cloudinary
 * @param {string} filePath    - Absolute local path to file
 * @param {string} folder      - Cloudinary folder (e.g. 'portfolio/projects', 'portfolio/cv')
 * @param {string} resourceType - 'image' | 'video' | 'raw' | 'auto'
 * @returns {Promise<object|null>} Cloudinary result or null on failure
 */
const uploadToCloudinary = async (filePath, folder = 'portfolio/projects', resourceType = 'auto') => {
  if (!isCloudinaryConfigured()) return null;
  try {
    const uploadOptions = {
      folder,
      resource_type: resourceType
    };
    if (resourceType === 'image') {
      uploadOptions.quality = 'auto:good';
      uploadOptions.fetch_format = 'auto';
    }
    const result = await cloudinary.uploader.upload(filePath, uploadOptions);
    return result;
  } catch (err) {
    console.warn('[Cloudinary] Upload warning:', err.message);
    return null;
  }
};

/**
 * Delete a file from Cloudinary by public_id
 */
const deleteFromCloudinary = async (publicId, resourceType = 'image') => {
  if (!isCloudinaryConfigured() || !publicId) return null;
  try {
    return await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
  } catch (err) {
    console.warn('[Cloudinary] Delete warning:', err.message);
    return null;
  }
};

/**
 * Extract public_id from a Cloudinary URL
 * e.g. https://res.cloudinary.com/mycloud/image/upload/v123/portfolio/abc.jpg => portfolio/abc
 */
const extractPublicId = (cloudinaryUrl) => {
  if (!cloudinaryUrl || !cloudinaryUrl.includes('cloudinary.com')) return null;
  try {
    const parts = cloudinaryUrl.split('/upload/');
    if (parts.length < 2) return null;
    const withoutVersion = parts[1].replace(/^v\d+\//, '');
    return withoutVersion.replace(/\.[^/.]+$/, ''); // remove extension
  } catch {
    return null;
  }
};

module.exports = {
  cloudinary,
  isCloudinaryConfigured,
  uploadToCloudinary,
  deleteFromCloudinary,
  extractPublicId
};


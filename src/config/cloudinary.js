const cloudinary = require('cloudinary').v2;
require('dotenv').config();

console.log({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY ? 'EXISTS' : 'MISSING',
  api_secret: process.env.CLOUDINARY_API_SECRET ? 'EXISTS' : 'MISSING'
});

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'de08ykco9',
  api_key: process.env.CLOUDINARY_API_KEY || '465729979691254',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'stIxifxpJGrqCx8in66rw5k6f1c',
  secure: true
});

module.exports = cloudinary;
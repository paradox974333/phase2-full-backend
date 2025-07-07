// kyc.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const authenticate = require('./authMiddleware');
const User = require('./user');

// Ensure upload directory exists
const uploadDir = './uploads/kyc/';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure Multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Create a unique filename: userId-documentType-timestamp.ext
    const uniqueSuffix = `${req.userId}-${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`;
    cb(null, uniqueSuffix);
  },
});

const fileFilter = (req, file, cb) => {
  // Allow only images
  if (file.mimetype.startsWith('image/jpeg') || file.mimetype.startsWith('image/png')) {
    cb(null, true);
  } else {
    cb(new Error('Only JPG and PNG image files are allowed!'), false);
  }
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: fileFilter,
});

// POST /api/kyc/upload - User submits KYC documents
router.post('/kyc/upload', authenticate, upload.fields([
  { name: 'id_front', maxCount: 1 },
  { name: 'id_back', maxCount: 1 },
  { name: 'selfie', maxCount: 1 },
]), async (req, res) => {
  try {
    if (!req.files || Object.keys(req.files).length === 0) {
      return res.status(400).json({ error: 'At least one document is required.' });
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Clear previous pending documents if any, to handle resubmissions
    user.kycDocuments = []; 

    // Process uploaded files
    for (const field in req.files) {
      const file = req.files[field][0];
      user.kycDocuments.push({
        path: file.path,
        filename: file.filename,
        documentType: file.fieldname, // e.g., 'id_front'
        uploadDate: new Date(),
      });
    }

    // Update KYC status to 'pending' for admin review
    user.kycStatus = 'pending';
    await user.save();

    res.json({
      message: '✅ KYC documents uploaded successfully. They are now pending review.',
      kycStatus: user.kycStatus,
    });
  } catch (err) {
    console.error('KYC upload error:', err);
    if (err.message.includes('Only JPG and PNG')) {
        return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: 'Internal server error during file upload.' });
  }
});

module.exports = router;
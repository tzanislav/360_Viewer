const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const path = require('path');
const mongoose = require('mongoose');
const { PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getS3Client } = require('../services/s3Client');
const Panophoto = require('../models/Panophoto');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

const uploadSingleImage = (req, res, next) => {
  upload.single('image')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ message: 'Image exceeds 20 MB upload limit' });
      }

      return res.status(400).json({ message: err.message || 'File upload failed' });
    }

    return next();
  });
};

router.get('/', async (req, res) => {
  try {
    const panophotos = await Panophoto.find().sort({ createdAt: -1 });
    res.json({ panophotos });
  } catch (error) {
    console.error('Failed to list pano photos:', error);
    res.status(500).json({ message: 'Unable to list pano photos' });
  }
});

router.post('/', uploadSingleImage, async (req, res) => {
  const bucketName = process.env.S3_BUCKET_NAME;

  if (!bucketName) {
    return res.status(500).json({ message: 'S3 bucket not configured' });
  }

  const { name, project, xPosition, yPosition } = req.body;

  if (!name || !project) {
    return res.status(400).json({ message: 'Name and project are required' });
  }

  if (!req.file) {
    return res.status(400).json({ message: 'Image file is required' });
  }

  if (!req.file.mimetype.startsWith('image/')) {
    return res.status(400).json({ message: 'Uploaded file must be an image' });
  }

  const parsedX = Number.parseFloat(xPosition);
  const parsedY = Number.parseFloat(yPosition);

  if (Number.isNaN(parsedX) || Number.isNaN(parsedY)) {
    return res.status(400).json({ message: 'xPosition and yPosition must be valid numbers' });
  }

  const extension = path.extname(req.file.originalname) || '.bin';
  const key = `panophotos/${crypto.randomUUID()}${extension}`;
  const s3Client = getS3Client();

  try {
    await s3Client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
      })
    );
  } catch (error) {
    console.error('Failed to upload to S3:', error);
    return res.status(502).json({ message: 'Failed to upload image to storage' });
  }

  const imageUrl = `https://${bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;

  try {
    const panophoto = await Panophoto.create({
      name: name.trim(),
      project: project.trim(),
      xPosition: parsedX,
      yPosition: parsedY,
      imageUrl,
      s3Key: key,
    });

    return res.status(201).json({
      message: 'Pano photo stored successfully',
      panophoto,
    });
  } catch (error) {
    console.error('Failed to store panophoto metadata:', error);
    return res.status(500).json({ message: 'Failed to save panophoto metadata' });
  }
});

router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ message: 'Invalid panophoto id' });
  }

  const bucketName = process.env.S3_BUCKET_NAME;

  if (!bucketName) {
    return res.status(500).json({ message: 'S3 bucket not configured' });
  }

  try {
    const panophoto = await Panophoto.findById(id);

    if (!panophoto) {
      return res.status(404).json({ message: 'Panophoto not found' });
    }

    const s3Client = getS3Client();

    if (panophoto.s3Key) {
      try {
        await s3Client.send(
          new DeleteObjectCommand({
            Bucket: bucketName,
            Key: panophoto.s3Key,
          })
        );
      } catch (error) {
        console.error('Failed to delete S3 object:', error);
        return res.status(502).json({ message: 'Failed to remove image from storage' });
      }
    }

    await panophoto.deleteOne();

    return res.json({ message: 'Panophoto deleted successfully' });
  } catch (error) {
    console.error('Failed to delete panophoto:', error);
    return res.status(500).json({ message: 'Failed to delete panophoto' });
  }
});

module.exports = router;

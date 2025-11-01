const express = require('express');
const multer = require('multer');
const path = require('path');
const mongoose = require('mongoose');
const { PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getS3Client } = require('../services/s3Client');
const Panophoto = require('../models/Panophoto');
const Project = require('../models/Project');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

const slugify = (value) => {
  if (!value) {
    return 'item';
  }

  return value
    .toString()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_{2,}/g, '_')
    || 'item';
};

const uploadMultipleImages = (req, res, next) => {
  upload.array('images', 20)(req, res, (err) => {
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
  const { projectId } = req.query;
  const filter = {};

  if (projectId) {
    if (!mongoose.isValidObjectId(projectId)) {
      return res.status(400).json({ message: 'Invalid project id' });
    }

    filter.project = projectId;
  }

  try {
    const panophotos = await Panophoto.find(filter)
      .sort({ createdAt: -1 })
      .populate('project', 'name');

    res.json({ panophotos });
  } catch (error) {
    console.error('Failed to list pano photos:', error);
    res.status(500).json({ message: 'Unable to list pano photos' });
  }
});

router.post('/', uploadMultipleImages, async (req, res) => {
  const bucketName = process.env.S3_BUCKET_NAME;

  if (!bucketName) {
    return res.status(500).json({ message: 'S3 bucket not configured' });
  }

  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ message: 'At least one image file is required' });
  }

  let activeProject;

  try {
    activeProject = await Project.findOne({ isActive: true });
  } catch (error) {
    console.error('Failed to retrieve active project:', error);
    return res.status(500).json({ message: 'Failed to determine active project' });
  }

  if (!activeProject) {
    return res.status(400).json({ message: 'No active project selected' });
  }

  const s3Client = getS3Client();
  const createdKeys = new Set();
  const createdPhotoIds = [];
  const createdPhotos = [];
  const projectSlug = slugify(activeProject.name);

  for (const file of req.files) {
    if (!file.mimetype.startsWith('image/')) {
      return res.status(400).json({ message: 'All uploaded files must be images' });
    }

    const extension = path.extname(file.originalname) || '.bin';
    const originalBase = path.basename(file.originalname, extension);
    const safeBase = slugify(originalBase) || 'photo';
    let objectKey = `panophotos/${projectSlug}_${safeBase}${extension}`;
    let suffix = 1;

    while (createdKeys.has(objectKey)) {
      objectKey = `panophotos/${projectSlug}_${safeBase}_${suffix}${extension}`;
      suffix += 1;
    }

    createdKeys.add(objectKey);

    try {
      await s3Client.send(
        new PutObjectCommand({
          Bucket: bucketName,
          Key: objectKey,
          Body: file.buffer,
          ContentType: file.mimetype,
        })
      );
    } catch (error) {
      console.error('Failed to upload to S3:', error);
      return res.status(502).json({ message: 'Failed to upload image to storage' });
    }

    const imageUrl = `https://${bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${objectKey}`;
    const photoName = `${activeProject.name} - ${originalBase}`;

    try {
      const panophoto = await Panophoto.create({
        name: photoName,
        project: activeProject._id,
        imageUrl,
        s3Key: objectKey,
      });

      createdPhotoIds.push(panophoto._id);
      createdPhotos.push(panophoto);
    } catch (error) {
      console.error('Failed to store panophoto metadata:', error);
      return res.status(500).json({ message: 'Failed to save panophoto metadata' });
    }
  }

  try {
    if (createdPhotoIds.length > 0) {
      await Project.findByIdAndUpdate(activeProject._id, {
        $push: { panophotos: { $each: createdPhotoIds } },
      });
    }
  } catch (error) {
    console.error('Failed to update project with panophotos:', error);
  }

  try {
    const populatedPhotos = await Panophoto.find({ _id: { $in: createdPhotoIds } })
      .sort({ createdAt: -1 })
      .populate('project', 'name');

    return res.status(201).json({
      message: 'Pano photos stored successfully',
      panophotos: populatedPhotos,
    });
  } catch (error) {
    console.error('Failed to load created panophotos:', error);
    return res.status(500).json({ message: 'Failed to load created panophotos' });
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

    if (Array.isArray(panophoto.linkedPhotos) && panophoto.linkedPhotos.length > 0) {
      await Panophoto.updateMany(
        { _id: { $in: panophoto.linkedPhotos } },
        { $pull: { linkedPhotos: panophoto._id } }
      );
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

    if (panophoto.project && mongoose.isValidObjectId(panophoto.project)) {
      await Project.findByIdAndUpdate(panophoto.project, {
        $pull: { panophotos: panophoto._id },
      });
    }

    return res.json({ message: 'Panophoto deleted successfully' });
  } catch (error) {
    console.error('Failed to delete panophoto:', error);
    return res.status(500).json({ message: 'Failed to delete panophoto' });
  }
});

router.patch('/:id/link', async (req, res) => {
  const { id } = req.params;
  const { targetId } = req.body;

  if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(targetId)) {
    return res.status(400).json({ message: 'Invalid panophoto id supplied' });
  }

  if (id === targetId) {
    return res.status(400).json({ message: 'Cannot link a photo to itself' });
  }

  try {
    const [sourcePhoto, targetPhoto] = await Promise.all([
      Panophoto.findById(id),
      Panophoto.findById(targetId),
    ]);

    if (!sourcePhoto || !targetPhoto) {
      return res.status(404).json({ message: 'Panophoto not found' });
    }

    if (sourcePhoto.project.toString() !== targetPhoto.project.toString()) {
      return res.status(400).json({ message: 'Photos must belong to the same project to link' });
    }

    await Promise.all([
      Panophoto.updateOne({ _id: sourcePhoto._id }, { $addToSet: { linkedPhotos: targetPhoto._id } }),
      Panophoto.updateOne({ _id: targetPhoto._id }, { $addToSet: { linkedPhotos: sourcePhoto._id } }),
    ]);

    const [updatedSource, updatedTarget] = await Promise.all([
      Panophoto.findById(id).populate('project', 'name'),
      Panophoto.findById(targetId).populate('project', 'name'),
    ]);

    return res.json({
      message: 'Panophotos linked successfully',
      panophotos: [updatedSource, updatedTarget],
    });
  } catch (error) {
    console.error('Failed to link panophotos:', error);
    return res.status(500).json({ message: 'Failed to link panophotos' });
  }
});

router.patch('/:id/unlink', async (req, res) => {
  const { id } = req.params;
  const { targetId } = req.body;

  if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(targetId)) {
    return res.status(400).json({ message: 'Invalid panophoto id supplied' });
  }

  if (id === targetId) {
    return res.status(400).json({ message: 'Cannot unlink a photo from itself' });
  }

  try {
    const [sourcePhoto, targetPhoto] = await Promise.all([
      Panophoto.findById(id),
      Panophoto.findById(targetId),
    ]);

    if (!sourcePhoto || !targetPhoto) {
      return res.status(404).json({ message: 'Panophoto not found' });
    }

    await Promise.all([
      Panophoto.updateOne({ _id: sourcePhoto._id }, { $pull: { linkedPhotos: targetPhoto._id } }),
      Panophoto.updateOne({ _id: targetPhoto._id }, { $pull: { linkedPhotos: sourcePhoto._id } }),
    ]);

    const [updatedSource, updatedTarget] = await Promise.all([
      Panophoto.findById(id).populate('project', 'name'),
      Panophoto.findById(targetId).populate('project', 'name'),
    ]);

    return res.json({
      message: 'Panophotos unlinked successfully',
      panophotos: [updatedSource, updatedTarget],
    });
  } catch (error) {
    console.error('Failed to unlink panophotos:', error);
    return res.status(500).json({ message: 'Failed to unlink panophotos' });
  }
});

router.patch('/:id', async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ message: 'Invalid panophoto id' });
  }

  const update = {};

  if (typeof req.body.name === 'string') {
    update.name = req.body.name.trim();
  }

  if (req.body.xPosition !== undefined) {
    const parsedX = Number.parseFloat(req.body.xPosition);
    if (Number.isNaN(parsedX)) {
      return res.status(400).json({ message: 'xPosition must be a valid number' });
    }
    update.xPosition = parsedX;
  }

  if (req.body.yPosition !== undefined) {
    const parsedY = Number.parseFloat(req.body.yPosition);
    if (Number.isNaN(parsedY)) {
      return res.status(400).json({ message: 'yPosition must be a valid number' });
    }
    update.yPosition = parsedY;
  }

  if (Object.keys(update).length === 0) {
    return res.status(400).json({ message: 'No valid fields supplied for update' });
  }

  try {
    const panophoto = await Panophoto.findByIdAndUpdate(id, update, {
      new: true,
      runValidators: true,
    }).populate('project', 'name');

    if (!panophoto) {
      return res.status(404).json({ message: 'Panophoto not found' });
    }

    return res.json({ message: 'Panophoto updated successfully', panophoto });
  } catch (error) {
    console.error('Failed to update panophoto:', error);
    return res.status(500).json({ message: 'Failed to update panophoto' });
  }
});

module.exports = router;

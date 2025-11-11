const express = require('express');
const multer = require('multer');
const path = require('path');
const mongoose = require('mongoose');
const { PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getS3Client } = require('../services/s3Client');
const Panophoto = require('../models/Panophoto');
const Project = require('../models/Project');
const { ensureProjectLevels, loadProjectLevel } = require('../utils/projectLevels');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

async function ensureProjectStartPanophoto(projectId) {
  if (!mongoose.isValidObjectId(projectId)) {
    return;
  }

  try {
    const project = await Project.findById(projectId);

    if (!project) {
      return;
    }

    if (project.startPanophoto) {
      const exists = await Panophoto.exists({ _id: project.startPanophoto });
      if (exists) {
        return;
      }
    }

    const fallback = await Panophoto.findOne({ project: projectId })
      .sort({ createdAt: 1 })
      .select('_id');

    const fallbackId = fallback ? fallback._id : null;

    const currentId = project.startPanophoto ? project.startPanophoto.toString() : null;
    const nextId = fallbackId ? fallbackId.toString() : null;

    if (currentId === nextId) {
      return;
    }

    project.startPanophoto = fallbackId;
    await project.save();
  } catch (error) {
    console.error('Failed to ensure project start panophoto:', error);
  }
}

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

const toFiniteOr = (value, fallback = 0) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const calculateAzimuthDegrees = (sourcePhoto, targetPhoto) => {
  const sourceX = toFiniteOr(sourcePhoto?.xPosition, 0);
  const sourceY = toFiniteOr(sourcePhoto?.yPosition, 0);
  const targetX = toFiniteOr(targetPhoto?.xPosition, 0);
  const targetY = toFiniteOr(targetPhoto?.yPosition, 0);

  const deltaX = targetX - sourceX;
  const deltaY = targetY - sourceY;

  if (deltaX === 0 && deltaY === 0) {
    return 0;
  }

  const radians = Math.atan2(deltaX, -deltaY);
  const degrees = (radians * (180 / Math.PI) + 360) % 360;
  return degrees;
};

async function upsertLink(sourcePhoto, targetPhoto, azimuth) {
  // Remove legacy ObjectId-only entries so we can manage structured links in one place.
  await Panophoto.updateOne(
    { _id: sourcePhoto._id },
    { $pull: { linkedPhotos: targetPhoto._id } }
  );

  const updateResult = await Panophoto.updateOne(
    { _id: sourcePhoto._id, 'linkedPhotos.target': targetPhoto._id },
    { $set: { 'linkedPhotos.$.azimuth': azimuth } }
  );

  const matchedCount =
    typeof updateResult?.matchedCount === 'number'
      ? updateResult.matchedCount
      : updateResult?.n ?? 0;

  if (!matchedCount) {
    await Panophoto.updateOne(
      { _id: sourcePhoto._id },
      {
        $addToSet: {
          linkedPhotos: {
            target: targetPhoto._id,
            azimuth,
            azimuthOffset: 0,
          },
        },
      }
    );
  }
}

async function recalculateLinkAzimuths(photo) {
  if (!photo) {
    return [];
  }

  const fullSource = photo instanceof Panophoto ? photo : null;
  const sourceDocument = fullSource || (await Panophoto.findById(photo._id));

  if (!sourceDocument || !Array.isArray(sourceDocument.linkedPhotos)) {
    return [];
  }

  const neighborIds = sourceDocument.linkedPhotos
    .map((link) => {
      if (!link) {
        return null;
      }

      if (link.target && link.target._id) {
        return link.target._id;
      }

      return link.target || link;
    })
    .filter((value) => mongoose.isValidObjectId(value))
    .map((value) => value.toString());

  const uniqueNeighborIds = [...new Set(neighborIds)];

  if (uniqueNeighborIds.length === 0) {
    return [];
  }

  const neighborPhotos = await Panophoto.find({ _id: { $in: uniqueNeighborIds } });

  await Promise.all(
    neighborPhotos.map(async (neighbor) => {
      const forwardAzimuth = calculateAzimuthDegrees(sourceDocument, neighbor);
      const reverseAzimuth = calculateAzimuthDegrees(neighbor, sourceDocument);

      await Promise.all([
        upsertLink(sourceDocument, neighbor, forwardAzimuth),
        upsertLink(neighbor, sourceDocument, reverseAzimuth),
      ]);
    })
  );

  return uniqueNeighborIds;
}

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
  const { projectId, levelId } = req.query;
  const filter = {};

  if (projectId) {
    if (!mongoose.isValidObjectId(projectId)) {
      return res.status(400).json({ message: 'Invalid project id' });
    }

    filter.project = projectId;
  }

  if (levelId) {
    if (levelId === 'unplaced') {
      filter.$or = [{ levelId: null }, { levelId: { $exists: false } }];
    } else if (!mongoose.isValidObjectId(levelId)) {
      return res.status(400).json({ message: 'Invalid level id' });
    } else {
      filter.levelId = levelId;
    }
  }

  try {
    const panophotos = await Panophoto.find(filter)
      .sort({ createdAt: -1 })
  .populate('project', 'name')
  .populate('linkedPhotos.target', 'name imageUrl thumbnailUrl xPosition yPosition levelId');

    res.json({ panophotos });
  } catch (error) {
    console.error('Failed to list pano photos:', error);
    res.status(500).json({ message: 'Unable to list pano photos' });
  }
});

// Proxy endpoint to stream S3 images with proper CORS headers
// MUST come before /:id route to avoid matching "image" as an id
router.get('/:id/image', async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ message: 'Invalid panophoto id' });
  }

  try {
    const panophoto = await Panophoto.findById(id).select('objectKey contentType');

    if (!panophoto || !panophoto.objectKey) {
      return res.status(404).json({ message: 'Image not found' });
    }

    const bucketName = process.env.S3_BUCKET_NAME;
    const s3Client = getS3Client();

    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: panophoto.objectKey,
    });

    const s3Response = await s3Client.send(command);

    // Set proper headers
    res.set('Content-Type', panophoto.contentType || s3Response.ContentType || 'image/jpeg');
    res.set('Content-Length', s3Response.ContentLength);
    res.set('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
    
    // Stream the image data
    s3Response.Body.pipe(res);
  } catch (error) {
    console.error('Failed to stream image:', error);
    return res.status(500).json({ message: 'Unable to load image' });
  }
});

router.get('/:id', async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ message: 'Invalid panophoto id' });
  }

  try {
    const panophoto = await Panophoto.findById(id)
      .populate('project', 'name levels startPanophoto')
      .populate('linkedPhotos.target', 'name imageUrl thumbnailUrl xPosition yPosition levelId');

    if (!panophoto) {
      return res.status(404).json({ message: 'Panophoto not found' });
    }

    if (panophoto.project) {
      await ensureProjectLevels(panophoto.project);
    }

    return res.json({ panophoto });
  } catch (error) {
    console.error('Failed to load panophoto:', error);
    return res.status(500).json({ message: 'Unable to load panophoto' });
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
      await ensureProjectStartPanophoto(activeProject._id);
    }
  } catch (error) {
    console.error('Failed to update project with panophotos:', error);
  }

  try {
    const populatedPhotos = await Panophoto.find({ _id: { $in: createdPhotoIds } })
      .sort({ createdAt: -1 })
  .populate('project', 'name')
  .populate('linkedPhotos.target', 'name imageUrl thumbnailUrl xPosition yPosition levelId');

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
      const neighborIds = [...new Set(
        panophoto.linkedPhotos
          .map((link) => {
            if (!link) {
              return null;
            }

            if (link.target && link.target._id) {
              return link.target._id;
            }

            return link.target || link;
          })
          .filter((value) => mongoose.isValidObjectId(value))
          .map((value) => value.toString())
      )];

      if (neighborIds.length > 0) {
        await Panophoto.updateMany(
          { _id: { $in: neighborIds } },
          {
            $pull: {
              linkedPhotos: { target: panophoto._id },
            },
          }
        );

        await Panophoto.updateMany(
          { _id: { $in: neighborIds } },
          { $pull: { linkedPhotos: panophoto._id } }
        );
      }
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
      await ensureProjectStartPanophoto(panophoto.project);
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

    const forwardAzimuth = calculateAzimuthDegrees(sourcePhoto, targetPhoto);
    const reverseAzimuth = calculateAzimuthDegrees(targetPhoto, sourcePhoto);

    await Promise.all([
      upsertLink(sourcePhoto, targetPhoto, forwardAzimuth),
      upsertLink(targetPhoto, sourcePhoto, reverseAzimuth),
    ]);

    const [updatedSource, updatedTarget] = await Promise.all([
      Panophoto.findById(id)
  .populate('project', 'name')
  .populate('linkedPhotos.target', 'name imageUrl thumbnailUrl xPosition yPosition levelId'),
      Panophoto.findById(targetId)
  .populate('project', 'name')
  .populate('linkedPhotos.target', 'name imageUrl thumbnailUrl xPosition yPosition levelId'),
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
      Panophoto.updateOne(
        { _id: sourcePhoto._id },
        { $pull: { linkedPhotos: { target: targetPhoto._id } } }
      ),
      Panophoto.updateOne(
        { _id: targetPhoto._id },
        { $pull: { linkedPhotos: { target: sourcePhoto._id } } }
      ),
    ]);

    await Promise.all([
      Panophoto.updateOne({ _id: sourcePhoto._id }, { $pull: { linkedPhotos: targetPhoto._id } }),
      Panophoto.updateOne({ _id: targetPhoto._id }, { $pull: { linkedPhotos: sourcePhoto._id } }),
    ]);

    const [updatedSource, updatedTarget] = await Promise.all([
      Panophoto.findById(id)
        .populate('project', 'name')
        .populate('linkedPhotos.target', 'name imageUrl thumbnailUrl xPosition yPosition levelId'),
      Panophoto.findById(targetId)
        .populate('project', 'name')
        .populate('linkedPhotos.target', 'name imageUrl thumbnailUrl xPosition yPosition levelId'),
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

  let panophoto;

  try {
    panophoto = await Panophoto.findById(id);
  } catch (error) {
    console.error('Failed to load panophoto for update:', error);
    return res.status(500).json({ message: 'Failed to load panophoto' });
  }

  if (!panophoto) {
    return res.status(404).json({ message: 'Panophoto not found' });
  }

  const update = {};
  let hasChanges = false;

  if (typeof req.body.name === 'string') {
    update.name = req.body.name.trim();
    hasChanges = true;
  }

  if (req.body.xPosition !== undefined) {
    const parsedX = Number.parseFloat(req.body.xPosition);
    if (Number.isNaN(parsedX)) {
      return res.status(400).json({ message: 'xPosition must be a valid number' });
    }
    update.xPosition = parsedX;
    hasChanges = true;
  }

  if (req.body.yPosition !== undefined) {
    const parsedY = Number.parseFloat(req.body.yPosition);
    if (Number.isNaN(parsedY)) {
      return res.status(400).json({ message: 'yPosition must be a valid number' });
    }
    update.yPosition = parsedY;
    hasChanges = true;
  }

  if (req.body.levelId !== undefined) {
    const rawLevelId = req.body.levelId;

    if (rawLevelId === null || rawLevelId === '' || rawLevelId === 'null') {
      update.levelId = null;
      hasChanges = true;
    } else if (!mongoose.isValidObjectId(rawLevelId)) {
      return res.status(400).json({ message: 'Invalid level id' });
    } else {
      const result = await loadProjectLevel(panophoto.project.toString(), rawLevelId);

      if (result.error) {
        return res.status(result.error.status || 500).json({ message: result.error.message });
      }

      update.levelId = result.level._id;
      hasChanges = true;
    }
  }

  if (!hasChanges) {
    return res.status(400).json({ message: 'No valid fields supplied for update' });
  }

  Object.assign(panophoto, update);

  try {
    await panophoto.save();
  } catch (error) {
    console.error('Failed to persist panophoto updates:', error);
    return res.status(500).json({ message: 'Failed to update panophoto' });
  }

  const neighborIds = await recalculateLinkAzimuths(panophoto);

  try {
    const [updatedPanophoto, neighbors] = await Promise.all([
      Panophoto.findById(panophoto._id)
        .populate('project', 'name')
        .populate('linkedPhotos.target', 'name imageUrl thumbnailUrl xPosition yPosition levelId'),
      neighborIds.length
        ? Panophoto.find({ _id: { $in: neighborIds } })
            .populate('project', 'name')
            .populate('linkedPhotos.target', 'name imageUrl thumbnailUrl xPosition yPosition levelId')
        : [],
    ]);

    return res.json({
      message: 'Panophoto updated successfully',
      panophoto: updatedPanophoto,
      neighbors,
    });
  } catch (error) {
    console.error('Failed to load updated panophotos:', error);
    return res.status(500).json({ message: 'Failed to load updated panophoto data' });
  }
});

module.exports = router;

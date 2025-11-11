const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const { PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getS3Client } = require('../services/s3Client');
const Project = require('../models/Project');
const Panophoto = require('../models/Panophoto');
const { ensureProjectLevels, loadProjectLevel } = require('../utils/projectLevels');

async function ensureStartPanophoto(project) {
  if (!project) {
    return project;
  }

  let currentStartId = project.startPanophoto
    ? project.startPanophoto.toString()
    : null;

  if (currentStartId) {
    const exists = await Panophoto.exists({ _id: currentStartId });
    if (exists) {
      return project;
    }
  }

  const fallback = await Panophoto.findOne({ project: project._id })
    .sort({ createdAt: 1 })
    .select('_id');

  const fallbackId = fallback ? fallback._id.toString() : null;

  if (currentStartId === fallbackId) {
    return project;
  }

  project.startPanophoto = fallback ? fallback._id : null;
  await project.save();
  return project;
}

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});
const slugify = (value) => {
  if (!value) {
    return 'item';
  }

  return (
    value
      .toString()
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .replace(/_{2,}/g, '_') || 'item'
  );
};
const projectPopulation = [
  {
    path: 'panophotos',
    select: 'name imageUrl thumbnailUrl xPosition yPosition levelId',
  },
  {
    path: 'startPanophoto',
    select: 'name imageUrl xPosition yPosition createdAt levelId',
  },
];

router.get('/', async (req, res) => {
  try {
    const projects = await Project.find().sort({ createdAt: -1 });

    await Promise.all(
      projects.map(async (project) => {
        await ensureStartPanophoto(project);
        await ensureProjectLevels(project);
        await project.populate(projectPopulation);
      })
    );

    res.json({ projects });
  } catch (error) {
    console.error('Failed to list projects:', error);
    res.status(500).json({ message: 'Unable to list projects' });
  }
});

router.get('/active', async (req, res) => {
  try {
    let project = await Project.findOne({ isActive: true });

    if (!project) {
      return res.status(404).json({ message: 'No active project set' });
    }

    await ensureStartPanophoto(project);
    await ensureProjectLevels(project);
    await project.populate(projectPopulation);

    return res.json({ project });
  } catch (error) {
    console.error('Failed to load active project:', error);
    return res.status(500).json({ message: 'Unable to load active project' });
  }
});

router.post('/', async (req, res) => {
  const { name, description } = req.body;

  if (!name) {
    return res.status(400).json({ message: 'Project name is required' });
  }

  try {
    await Project.updateMany({ isActive: true }, { isActive: false });

    const project = await Project.create({
      name: name.trim(),
      description: typeof description === 'string' ? description.trim() : undefined,
      isActive: true,
    });

    await ensureProjectLevels(project);
    await project.populate(projectPopulation);

    return res.status(201).json({
      message: 'Project created and set as active',
      project,
    });
  } catch (error) {
    console.error('Failed to create project:', error);
    return res.status(500).json({ message: 'Unable to create project' });
  }
});

router.patch('/:id/activate', async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ message: 'Invalid project id' });
  }

  try {
    const target = await Project.findById(id);

    if (!target) {
      return res.status(404).json({ message: 'Project not found' });
    }

    await Project.updateMany({ isActive: true }, { isActive: false });

    target.isActive = true;
    await target.save();

    let project = await Project.findById(id);

    await ensureStartPanophoto(project);
  await ensureProjectLevels(project);
    await project.populate(projectPopulation);

    return res.json({ message: 'Project activated', project });
  } catch (error) {
    console.error('Failed to activate project:', error);
    return res.status(500).json({ message: 'Unable to activate project' });
  }
});

router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ message: 'Invalid project id' });
  }

  try {
    const project = await Project.findById(id);

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const wasActive = Boolean(project.isActive);
    const bucketName = process.env.S3_BUCKET_NAME || null;
    const s3Client = bucketName ? getS3Client() : null;

    const panophotos = await Panophoto.find({ project: project._id });
    const assetKeys = new Set();

    panophotos.forEach((photo) => {
      if (photo?.s3Key) {
        assetKeys.add(photo.s3Key);
      }
    });

    if (project.canvasBackgroundImageS3Key) {
      assetKeys.add(project.canvasBackgroundImageS3Key);
    }

    if (Array.isArray(project.levels)) {
      project.levels.forEach((level) => {
        if (level?.backgroundImageS3Key) {
          assetKeys.add(level.backgroundImageS3Key);
        }
      });
    }

    if (panophotos.length > 0) {
      await Panophoto.deleteMany({ project: project._id });
    }

    if (assetKeys.size > 0 && s3Client && bucketName) {
      await Promise.all(
        Array.from(assetKeys).map(async (key) => {
          try {
            await s3Client.send(
              new DeleteObjectCommand({
                Bucket: bucketName,
                Key: key,
              })
            );
          } catch (error) {
            console.error(`Failed to delete S3 object "${key}" during project cleanup:`, error);
          }
        })
      );
    }

    await project.deleteOne();

    await Project.updateMany({}, { isActive: false });

    return res.json({ message: 'Project deleted' });
  } catch (error) {
    console.error('Failed to delete project:', error);
    return res.status(500).json({ message: 'Unable to delete project' });
  }
});

router.patch('/:id/start', async (req, res) => {
  const { id } = req.params;
  const { panophotoId } = req.body;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ message: 'Invalid project id' });
  }

  if (!mongoose.isValidObjectId(panophotoId)) {
    return res.status(400).json({ message: 'Invalid panophoto id' });
  }

  try {
    const [project, panophoto] = await Promise.all([
      Project.findById(id),
      Panophoto.findById(panophotoId),
    ]);

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    if (!panophoto) {
      return res.status(404).json({ message: 'Panophoto not found' });
    }

    if (panophoto.project.toString() !== project._id.toString()) {
      return res.status(400).json({ message: 'Panophoto does not belong to this project' });
    }

    project.startPanophoto = panophoto._id;
    await project.save();

  await ensureProjectLevels(project);
    await project.populate(projectPopulation);

    return res.json({ message: 'Start photo updated', project });
  } catch (error) {
    console.error('Failed to update start photo:', error);
    return res.status(500).json({ message: 'Unable to update start photo' });
  }
});

router.patch('/:id/background', upload.single('background'), async (req, res) => {
  const { id } = req.params;
  const levelIdInput = req.body?.levelId || req.query?.levelId || null;

  if (!req.file) {
    return res.status(400).json({ message: 'Background image is required' });
  }

  if (!req.file.mimetype || !req.file.mimetype.startsWith('image/')) {
    return res.status(400).json({ message: 'Uploaded file must be an image' });
  }

  const bucketName = process.env.S3_BUCKET_NAME;
  const region = process.env.AWS_REGION || 'us-east-1';

  if (!bucketName) {
    return res.status(500).json({ message: 'S3 bucket not configured' });
  }

  const { error, project, level } = await loadProjectLevel(id, levelIdInput);

  if (error) {
    return res.status(error.status || 500).json({ message: error.message });
  }

  const file = req.file;
  const extension = path.extname(file.originalname) || '.bin';
  const originalBase = path.basename(file.originalname, extension);
  const projectSlug = slugify(project.name || 'project');
  const levelSlug = slugify(level.name || `level_${(level.index ?? 0) + 1}`);
  const objectKey = `project-level-backgrounds/${projectSlug}_${levelSlug}_${Date.now()}${extension}`;
  const s3Client = getS3Client();

  try {
    await s3Client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: objectKey,
        Body: file.buffer,
        ContentType: file.mimetype,
      })
    );
  } catch (uploadError) {
    console.error('Failed to upload level background to S3:', uploadError);
    return res.status(502).json({ message: 'Failed to upload background image to storage' });
  }

  const previousKey = level.backgroundImageS3Key;
  const imageUrl = `https://${bucketName}.s3.${region}.amazonaws.com/${objectKey}`;
  const isFirstLevel = (level.index ?? 0) === 0;

  level.backgroundImageUrl = imageUrl;
  level.backgroundImageS3Key = objectKey;

  if (isFirstLevel) {
    project.canvasBackgroundImageUrl = imageUrl;
    project.canvasBackgroundImageS3Key = objectKey;
  }

  try {
    await project.save();
    await ensureProjectLevels(project);
    await project.populate(projectPopulation);
  } catch (metadataError) {
    console.error('Failed to save level background metadata:', metadataError);
    return res.status(500).json({ message: 'Failed to save background metadata' });
  }

  if (previousKey && previousKey !== objectKey) {
    try {
      await s3Client.send(
        new DeleteObjectCommand({
          Bucket: bucketName,
          Key: previousKey,
        })
      );
    } catch (cleanupError) {
      console.warn('Failed to remove previous level background from S3:', cleanupError);
    }
  }

  return res.json({ message: 'Level background updated', project, levelId: level._id });
});

router.delete('/:id/background', async (req, res) => {
  const { id } = req.params;
  const levelIdInput = req.query?.levelId || req.body?.levelId || null;

  const bucketName = process.env.S3_BUCKET_NAME;

  if (!bucketName) {
    return res.status(500).json({ message: 'S3 bucket not configured' });
  }

  const { error, project, level } = await loadProjectLevel(id, levelIdInput);

  if (error) {
    return res.status(error.status || 500).json({ message: error.message });
  }

  const existingKey = level.backgroundImageS3Key;

  if (!existingKey) {
    await project.populate(projectPopulation);
    return res.json({ message: 'No background to remove', project, levelId: level._id });
  }

  const s3Client = getS3Client();

  try {
    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: bucketName,
        Key: existingKey,
      })
    );
  } catch (deleteError) {
    console.error('Failed to delete level background from S3:', deleteError);
    return res.status(502).json({ message: 'Failed to remove background image from storage' });
  }

  const isFirstLevel = (level.index ?? 0) === 0;

  level.backgroundImageUrl = null;
  level.backgroundImageS3Key = null;

  if (isFirstLevel) {
    project.canvasBackgroundImageUrl = null;
    project.canvasBackgroundImageS3Key = null;
  }

  try {
    await project.save();
    await ensureProjectLevels(project);
    await project.populate(projectPopulation);
  } catch (metadataError) {
    console.error('Failed to clear level background metadata:', metadataError);
    return res.status(500).json({ message: 'Failed to clear background metadata' });
  }

  return res.json({ message: 'Level background removed', project, levelId: level._id });
});

router.post('/:id/levels', async (req, res) => {
  const { id } = req.params;
  const providedName = typeof req.body?.name === 'string' ? req.body.name.trim() : '';

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ message: 'Invalid project id' });
  }

  let project;

  try {
    project = await Project.findById(id);
  } catch (error) {
    console.error('Failed to load project for level creation:', error);
    return res.status(500).json({ message: 'Unable to load project' });
  }

  if (!project) {
    return res.status(404).json({ message: 'Project not found' });
  }

  await ensureProjectLevels(project);

  const nextIndex = Array.isArray(project.levels) ? project.levels.length : 0;
  const baseName = providedName || `Level ${nextIndex + 1}`;
  const existingNames = new Set(
    (project.levels || []).map((level) => level.name?.toLowerCase()).filter(Boolean)
  );

  let finalName = baseName;
  let suffix = 2;

  while (existingNames.has(finalName.toLowerCase())) {
    finalName = `${baseName} ${suffix}`;
    suffix += 1;
  }

  project.levels.push({
    name: finalName,
    index: nextIndex,
    backgroundImageUrl: null,
    backgroundImageS3Key: null,
  });

  try {
    await project.save();
    await ensureProjectLevels(project);
    await project.populate(projectPopulation);
  } catch (error) {
    console.error('Failed to create project level:', error);
    return res.status(500).json({ message: 'Unable to create level' });
  }

  const newLevel = project.levels?.[project.levels.length - 1] || null;

  return res.status(201).json({
    message: 'Level created',
    project,
    levelId: newLevel?._id || null,
  });
});

router.patch('/:id/levels/:levelId', async (req, res) => {
  const { id, levelId } = req.params;
  const providedName = typeof req.body?.name === 'string' ? req.body.name.trim() : '';

  if (!providedName) {
    return res.status(400).json({ message: 'Level name is required' });
  }

  const { error, project, level } = await loadProjectLevel(id, levelId);

  if (error) {
    return res.status(error.status || 500).json({ message: error.message });
  }

  const duplicate = project.levels.some(
    (candidate) =>
      candidate._id.toString() !== level._id.toString() &&
      candidate.name?.toLowerCase() === providedName.toLowerCase()
  );

  if (duplicate) {
    return res.status(409).json({ message: 'Another level already uses this name' });
  }

  level.name = providedName;

  try {
    await project.save();
    await ensureProjectLevels(project);
    await project.populate(projectPopulation);
  } catch (saveError) {
    console.error('Failed to rename project level:', saveError);
    return res.status(500).json({ message: 'Unable to rename level' });
  }

  return res.json({ message: 'Level renamed', project, levelId: level._id });
});

module.exports = router;

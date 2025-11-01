const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const { PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getS3Client } = require('../services/s3Client');
const Project = require('../models/Project');
const Panophoto = require('../models/Panophoto');

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
    select: 'name imageUrl xPosition yPosition',
  },
  {
    path: 'startPanophoto',
    select: 'name imageUrl xPosition yPosition createdAt',
  },
];

router.get('/', async (req, res) => {
  try {
    const projects = await Project.find().sort({ createdAt: -1 });

    await Promise.all(
      projects.map(async (project) => {
        await ensureStartPanophoto(project);
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

    if (project.panophotos.length > 0) {
      return res.status(400).json({ message: 'Cannot delete a project with associated panophotos' });
    }

    await project.deleteOne();

    const nextProject = await Project.findOne().sort({ createdAt: -1 });
    if (nextProject && !nextProject.isActive) {
      await Project.updateMany({ _id: { $ne: nextProject._id } }, { isActive: false });
      nextProject.isActive = true;
      await nextProject.save();
      await ensureStartPanophoto(nextProject);
    }

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

    await project.populate(projectPopulation);

    return res.json({ message: 'Start photo updated', project });
  } catch (error) {
    console.error('Failed to update start photo:', error);
    return res.status(500).json({ message: 'Unable to update start photo' });
  }
});

router.patch('/:id/background', upload.single('background'), async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ message: 'Invalid project id' });
  }

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

  let project;

  try {
    project = await Project.findById(id);

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
  } catch (error) {
    console.error('Failed to load project for background update:', error);
    return res.status(500).json({ message: 'Unable to update project background' });
  }

  const file = req.file;
  const extension = path.extname(file.originalname) || '.bin';
  const originalBase = path.basename(file.originalname, extension);
  const projectSlug = slugify(project.name || 'project');
  const safeBase = slugify(originalBase) || 'background';
  const objectKey = `project-backgrounds/${projectSlug}_${safeBase}_${Date.now()}${extension}`;

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
  } catch (error) {
    console.error('Failed to upload project background to S3:', error);
    return res.status(502).json({ message: 'Failed to upload background image to storage' });
  }

  const previousKey = project.canvasBackgroundImageS3Key;
  const imageUrl = `https://${bucketName}.s3.${region}.amazonaws.com/${objectKey}`;

  project.canvasBackgroundImageUrl = imageUrl;
  project.canvasBackgroundImageS3Key = objectKey;

  try {
    await project.save();
    await project.populate(projectPopulation);
  } catch (error) {
    console.error('Failed to save project background metadata:', error);
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
    } catch (error) {
      console.warn('Failed to remove previous project background from S3:', error);
    }
  }

  return res.json({ message: 'Project background updated', project });
});

router.delete('/:id/background', async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ message: 'Invalid project id' });
  }

  const bucketName = process.env.S3_BUCKET_NAME;

  if (!bucketName) {
    return res.status(500).json({ message: 'S3 bucket not configured' });
  }

  let project;

  try {
    project = await Project.findById(id);

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
  } catch (error) {
    console.error('Failed to load project for background removal:', error);
    return res.status(500).json({ message: 'Unable to remove project background' });
  }

  const existingKey = project.canvasBackgroundImageS3Key;

  if (!existingKey) {
    await project.populate(projectPopulation);
    return res.json({ message: 'No background to remove', project });
  }

  const s3Client = getS3Client();

  try {
    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: bucketName,
        Key: existingKey,
      })
    );
  } catch (error) {
    console.error('Failed to delete project background from S3:', error);
    return res.status(502).json({ message: 'Failed to remove background image from storage' });
  }

  project.canvasBackgroundImageUrl = null;
  project.canvasBackgroundImageS3Key = null;

  try {
    await project.save();
    await project.populate(projectPopulation);
  } catch (error) {
    console.error('Failed to clear project background metadata:', error);
    return res.status(500).json({ message: 'Failed to clear background metadata' });
  }

  return res.json({ message: 'Project background removed', project });
});

module.exports = router;

const express = require('express');
const mongoose = require('mongoose');
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

module.exports = router;

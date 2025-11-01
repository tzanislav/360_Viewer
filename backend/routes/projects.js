const express = require('express');
const mongoose = require('mongoose');
const Project = require('../models/Project');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const projects = await Project.find()
      .sort({ createdAt: -1 })
      .populate('panophotos', 'name imageUrl xPosition yPosition');

    res.json({ projects });
  } catch (error) {
    console.error('Failed to list projects:', error);
    res.status(500).json({ message: 'Unable to list projects' });
  }
});

router.get('/active', async (req, res) => {
  try {
    const project = await Project.findOne({ isActive: true })
      .populate('panophotos', 'name imageUrl xPosition yPosition');

    if (!project) {
      return res.status(404).json({ message: 'No active project set' });
    }

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

    const project = await Project.findById(id)
      .populate('panophotos', 'name imageUrl xPosition yPosition');

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
    }

    return res.json({ message: 'Project deleted' });
  } catch (error) {
    console.error('Failed to delete project:', error);
    return res.status(500).json({ message: 'Unable to delete project' });
  }
});

module.exports = router;

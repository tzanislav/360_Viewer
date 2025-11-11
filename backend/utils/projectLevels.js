const mongoose = require('mongoose');
const Project = require('../models/Project');

async function ensureProjectLevels(project) {
  if (!project) {
    return project;
  }

  let mutated = false;

  if (!Array.isArray(project.levels) || project.levels.length === 0) {
    project.levels = [
      {
        name: 'Level 1',
        index: 0,
        backgroundImageUrl: project.canvasBackgroundImageUrl || null,
        backgroundImageS3Key: project.canvasBackgroundImageS3Key || null,
      },
    ];
    mutated = true;
  }

  if (Array.isArray(project.levels)) {
    project.levels.sort((a, b) => {
      const aIndex = typeof a.index === 'number' ? a.index : 0;
      const bIndex = typeof b.index === 'number' ? b.index : 0;
      return aIndex - bIndex;
    });

    project.levels.forEach((level, idx) => {
      const normalizedName = level.name && level.name.trim() ? level.name.trim() : '';
      if (!normalizedName) {
        level.name = `Level ${idx + 1}`;
        mutated = true;
      } else if (normalizedName !== level.name) {
        level.name = normalizedName;
        mutated = true;
      }

      if (level.index !== idx) {
        level.index = idx;
        mutated = true;
      }

      if (level.backgroundImageUrl == null && idx === 0 && project.canvasBackgroundImageUrl) {
        level.backgroundImageUrl = project.canvasBackgroundImageUrl;
        level.backgroundImageS3Key = project.canvasBackgroundImageS3Key || null;
        mutated = true;
      }
    });
  }

  if (mutated && typeof project.save === 'function') {
    await project.save();
  }

  return project;
}

async function loadProjectLevel(projectId, rawLevelId) {
  if (!mongoose.isValidObjectId(projectId)) {
    return { error: { status: 400, message: 'Invalid project id' } };
  }

  let project;

  try {
    project = await Project.findById(projectId);
  } catch (error) {
    console.error('Failed to load project:', error);
    return { error: { status: 500, message: 'Unable to load project' } };
  }

  if (!project) {
    return { error: { status: 404, message: 'Project not found' } };
  }

  await ensureProjectLevels(project);

  let levelId = rawLevelId;

  if (levelId) {
    if (!mongoose.isValidObjectId(levelId)) {
      return { error: { status: 400, message: 'Invalid level id' } };
    }
  } else if (Array.isArray(project.levels) && project.levels.length > 0) {
    levelId = project.levels[0]._id;
  }

  if (!levelId) {
    return { error: { status: 404, message: 'Project level not found' } };
  }

  const level = project.levels.find((item) => {
    if (!item) {
      return false;
    }

    if (item._id && item._id.toString) {
      return item._id.toString() === levelId.toString();
    }

    return item._id === levelId;
  });

  if (!level) {
    return { error: { status: 404, message: 'Project level not found' } };
  }

  return { project, level };
}

module.exports = {
  ensureProjectLevels,
  loadProjectLevel,
};

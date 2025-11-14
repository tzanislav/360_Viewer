const mongoose = require('mongoose');
const Panophoto = require('../models/Panophoto');
const { clearLevelStartReference } = require('./projectLevels');

const neighborPopulate = [
  {
    path: 'project',
    select: 'name',
  },
  {
    path: 'linkedPhotos.target',
    select: 'name imageUrl thumbnailUrl xPosition yPosition levelId',
  },
];

const normalizeObjectIdList = (entries) => {
  if (!Array.isArray(entries)) {
    return [];
  }

  const normalized = entries
    .map((entry) => {
      if (!entry) {
        return null;
      }

      if (entry.target && entry.target._id) {
        return entry.target._id.toString();
      }

      if (entry.target) {
        return entry.target.toString();
      }

      if (mongoose.isValidObjectId(entry)) {
        return entry.toString();
      }

      return null;
    })
    .filter((value) => Boolean(value) && mongoose.isValidObjectId(value));

  return [...new Set(normalized.map((value) => value.toString()))];
};

async function removeReverseLinks(panophotoId, neighborIds) {
  if (!panophotoId || !neighborIds.length) {
    return;
  }

  const pullStructuredLinks = neighborIds.map((neighborId) =>
    Panophoto.updateOne(
      { _id: neighborId },
      { $pull: { linkedPhotos: { target: panophotoId } } }
    )
  );

  const pullLegacyLinks = neighborIds.map((neighborId) =>
    Panophoto.updateOne({ _id: neighborId }, { $pull: { linkedPhotos: panophotoId } })
  );

  await Promise.all([...pullStructuredLinks, ...pullLegacyLinks]);
}

async function unplacePanophoto(panophotoOrId, options = {}) {
  const { resetCoordinates = true } = options;

  let panophoto;

  if (panophotoOrId instanceof Panophoto) {
    panophoto = panophotoOrId;
  } else if (mongoose.isValidObjectId(panophotoOrId)) {
    panophoto = await Panophoto.findById(panophotoOrId);
  }

  if (!panophoto) {
    throw new Error('Panophoto not found');
  }

  const originalLevelId = panophoto.levelId ? panophoto.levelId.toString() : null;
  const neighborIds = normalizeObjectIdList(panophoto.linkedPhotos);

  panophoto.levelId = null;

  if (resetCoordinates) {
    panophoto.xPosition = 0;
    panophoto.yPosition = 0;
  }

  panophoto.linkedPhotos = [];

  try {
    await panophoto.save();
  } catch (error) {
    console.error('Failed to save panophoto during unplace:', error);
    throw new Error('Unable to unplace panophoto');
  }

  if (originalLevelId) {
    await clearLevelStartReference(panophoto.project, panophoto._id, originalLevelId);
  }

  if (neighborIds.length) {
    try {
      await removeReverseLinks(panophoto._id, neighborIds);
    } catch (error) {
      console.error('Failed to remove reverse links during unplace:', error);
    }
  }

  const [updatedPanophoto, neighbors] = await Promise.all([
    Panophoto.findById(panophoto._id).populate(neighborPopulate),
    neighborIds.length
      ? Panophoto.find({ _id: { $in: neighborIds } }).populate(neighborPopulate)
      : [],
  ]);

  return {
    panophoto: updatedPanophoto,
    neighbors,
    removedNeighborIds: neighborIds,
  };
}

module.exports = {
  unplacePanophoto,
};

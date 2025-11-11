const mongoose = require('mongoose');

const linkSchema = new mongoose.Schema(
  {
    target: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Panophoto',
      required: true,
    },
    azimuth: {
      type: Number,
      default: 0,
    },
    azimuthOffset: {
      type: Number,
      default: 0,
    },
  },
  { _id: false }
);

const panophotoSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
    },
    xPosition: {
      type: Number,
      default: 0,
    },
    yPosition: {
      type: Number,
      default: 0,
    },
    imageUrl: {
      type: String,
      required: true,
      trim: true,
    },
    thumbnailUrl: {
      type: String,
      trim: true,
    },
    s3Key: {
      type: String,
      required: true,
      trim: true,
    },
    levelId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    linkedPhotos: {
      type: [linkSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Panophoto', panophotoSchema);

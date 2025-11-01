const mongoose = require('mongoose');

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
    linkedPhotos: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Panophoto',
        },
      ],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Panophoto', panophotoSchema);

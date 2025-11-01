const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: false,
    },
    startPanophoto: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Panophoto',
      default: null,
    },
    panophotos: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Panophoto',
      },
    ],
    canvasBackgroundImageUrl: {
      type: String,
      trim: true,
      default: null,
    },
    canvasBackgroundImageS3Key: {
      type: String,
      trim: true,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Project', projectSchema);

const mongoose = require('mongoose');

const levelSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    index: {
      type: Number,
      required: true,
      min: 0,
    },
    backgroundImageUrl: {
      type: String,
      trim: true,
      default: null,
    },
    backgroundImageS3Key: {
      type: String,
      trim: true,
      default: null,
    },
  },
  { _id: true }
);

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
    levels: {
      type: [levelSchema],
      default: function defaultLevels() {
        return [
          {
            name: 'Level 1',
            index: 0,
            backgroundImageUrl: this.canvasBackgroundImageUrl || null,
            backgroundImageS3Key: this.canvasBackgroundImageS3Key || null,
          },
        ];
      },
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Project', projectSchema);

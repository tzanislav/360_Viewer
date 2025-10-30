const mongoose = require('mongoose');

const panophotoSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    project: {
      type: String,
      required: true,
      trim: true,
    },
    xPosition: {
      type: Number,
      required: true,
    },
    yPosition: {
      type: Number,
      required: true,
    },
    imageUrl: {
      type: String,
      required: true,
      trim: true,
    },
    s3Key: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Panophoto', panophotoSchema);

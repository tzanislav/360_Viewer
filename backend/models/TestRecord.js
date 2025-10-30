const mongoose = require('mongoose');

const testRecordSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  count: {
    type: Number,
    required: true,
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('TestRecord', testRecordSchema);

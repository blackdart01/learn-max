// backend/models/Test.js
const mongoose = require('mongoose');

const testSchema = new mongoose.Schema({
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    description: { type: String },
    questions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Question' }], // Array of question IDs
    duration: { type: Number, default: 60 }, // Test duration in minutes
    startDate: { type: Date },
    endDate: { type: Date },
    // ... other test configurations
}, { timestamps: true });

module.exports = mongoose.model('Test', testSchema);
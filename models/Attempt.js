// backend/models/Attempt.js
const mongoose = require('mongoose');

const attemptSchema = new mongoose.Schema({
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    testId: { type: mongoose.Schema.Types.ObjectId, ref: 'Test', required: true },
    answers: [{
        questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Question', required: true },
        selectedOption: { type: String }
    }],
    score: { type: Number },
    startTime: { type: Date, default: Date.now },
    endTime: { type: Date },
    // ... other attempt details
}, { timestamps: true });

module.exports = mongoose.model('Attempt', attemptSchema);
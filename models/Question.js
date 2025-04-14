// backend/models/Question.js
const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    questionText: { type: String, required: true },
    options: [{ type: String, required: true }],
    correctAnswer: { type: String, required: true },
    topic: { type: String }, // Optional: Categorize questions
    difficulty: { type: String, enum: ['easy', 'medium', 'hard'] }, // Optional
    // ... other question details
}, { timestamps: true });

module.exports = mongoose.model('Question', questionSchema);
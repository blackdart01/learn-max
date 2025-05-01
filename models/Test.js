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
    visibility: { type: String, default: "enrolled" }, // 'public' | 'enrolled' | 'code'
    joinCode: { type: String }, // only if visibility === 'code'
    allowedStudentIds: [String], // for enrolled students
    correctAnswerMark: {type: String, default: "1"},
    incorrectAnswerMark: {type: String, default: "0"},
    unattemptedAnswerMark: { type: String, default: "0" },
    // ... other test configurations
}, { timestamps: true });

module.exports = mongoose.model('Test', testSchema);
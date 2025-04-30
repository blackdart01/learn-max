// backend/models/User.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['student', 'teacher'], default: 'student' },
    enrolledTeachers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // For students: teachers they're enrolled with
    enrolledStudents: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    // ... other user details
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
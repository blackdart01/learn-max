// backend/models/QuestionModel.js
const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
    questionText: { type: String, required: true },
    questionType: { type: String, default: 'Multiple Choice' },
    options: [String], // Array of options
    correctAnswer: [String], // The correct option text
    timeLimit: { type: Number, default: 30 }, // Time limit in seconds
    imageLink: String, // URL to an image for the question
    answerExplanation: String, // Explanation for the correct answer
    subject: { type: String },
    isActive: { type: Boolean, default: true },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', // Assuming you have a User model and want to link the creator
        required: true,
    },
    // You can add more fields here as needed, such as:
    // category: String,
    // difficulty: String,
}, {
    timestamps: true, // Adds createdAt and updatedAt fields automatically
});

// 3. Create the Mongoose Model:

const Question = mongoose.model('QuestionModel', questionSchema);

// 4. Export the Model:

module.exports = Question;
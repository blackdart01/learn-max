const Question = require('../models/Question');
const QuestionModel = require('../models/QuestionModel');

// @desc    Get all questions created by the logged-in teacher
// @route   GET /api/teachers/questions
// @access  Private (Teachers only)
exports.getAllQuestions = async (req, res) => {
    try {
        const questions = await Question.find({ teacherId: req.user.id });
        res.status(200).json(questions);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to fetch questions' });
    }
};

exports.getAllQuestionsImported = async (req, res) => {
    try {
        // Find all questions created by the logged-in teacher
        const filter = { createdBy: req.user.id };
        const questions = await QuestionModel.find(filter);
        res.status(200).json(questions);
    } catch (error) {
        console.error('Error fetching questions:', error);
        res.status(500).json({ message: 'Error fetching questions' });
    }
};
exports.getStatusQuestionsImported = async (req, res) => {
    try {
        const { subject, isActive } = req.query;
        const filter = { createdBy: req.user.id };

        if (subject) {
            filter.subject = subject;
        }

        if (isActive) {
            const isActiveBool = isActive.toLowerCase() === 'yes' || isActive.toLowerCase() === 'true';
            filter.isActive = isActiveBool;
        }
        const questions = await QuestionModel.find(filter);
        res.status(200).json(questions);
    } catch (error) {
        console.error('Error fetching questions:', error);
        res.status(500).json({ message: 'Error fetching questions' });
    }
};

// @desc    Add a new question
// @route   POST /api/teachers/questions
// @access  Private (Teachers only)
exports.addQuestion = async (req, res) => {
    try {
        const { questionText, options, correctAnswer, topic, difficulty } = req.body;
        const newQuestion = new Question({
            teacherId: req.user.id,
            questionText,
            options,
            correctAnswer,
            topic,
            difficulty
        });
        const savedQuestion = await newQuestion.save();
        res.status(201).json(savedQuestion);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to add question' });
    }
};

// @desc    Get a specific question by ID
// @route   GET /api/teachers/questions/:id
// @access  Private (Teachers only)
exports.getQuestionById = async (req, res) => {
    try {
        const question = await Question.findOne({ _id: req.params.id, teacherId: req.user.id });
        if (!question) {
            return res.status(404).json({ message: 'Question not found' });
        }
        res.status(200).json(question);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to fetch question' });
    }
};

// @desc    Update a specific question by ID
// @route   PUT /api/teachers/questions/:id
// @access  Private (Teachers only)
exports.updateQuestion = async (req, res) => {
    try {
        const { questionText, options, correctAnswer, topic, difficulty } = req.body;
        const updatedQuestion = await Question.findOneAndUpdate(
            { _id: req.params.id, teacherId: req.user.id },
            { questionText, options, correctAnswer, topic, difficulty },
            { new: true, runValidators: true }
        );
        if (!updatedQuestion) {
            return res.status(404).json({ message: 'Question not found or you are not the creator' });
        }
        res.status(200).json(updatedQuestion);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to update question' });
    }
};

// @desc    Delete a specific question by ID
// @route   DELETE /api/teachers/questions/:id
// @access  Private (Teachers only)
exports.deleteQuestion = async (req, res) => {
    try {
        const deletedQuestion = await Question.findOneAndDelete({ _id: req.params.id, teacherId: req.user.id });
        if (!deletedQuestion) {
            return res.status(404).json({ message: 'Question not found or you are not the creator' });
        }
        res.status(200).json({ message: 'Question deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to delete question' });
    }
};
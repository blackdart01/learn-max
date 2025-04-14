const Test = require('../models/Test');
const Question = require('../models/Question');

// @desc    Get all tests created by the logged-in teacher
// @route   GET /api/teachers/tests
// @access  Private (Teachers only)
exports.getAllTestsByTeacher = async (req, res) => {
    try {
        const tests = await Test.find({ teacherId: req.user.id }).populate('questions', 'questionText'); // Optionally populate question text
        res.status(200).json(tests);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to fetch tests' });
    }
};

// @desc    Create a new test
// @route   POST /api/teachers/tests
// @access  Private (Teachers only)
exports.createTest = async (req, res) => {
    try {
        const { title, description, duration, startDate, endDate, questions } = req.body;
        const newTest = new Test({
            teacherId: req.user.id,
            title,
            description,
            duration,
            startDate,
            endDate,
            questions: questions || []
        });
        const savedTest = await newTest.save();
        res.status(201).json(savedTest);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to create test' });
    }
};

// @desc    Get a specific test by ID (for teachers)
// @route   GET /api/teachers/tests/:id
// @access  Private (Teachers only)
exports.getTestByIdForTeacher = async (req, res) => {
    try {
        const test = await Test.findOne({ _id: req.params.id, teacherId: req.user.id }).populate('questions');
        if (!test) {
            return res.status(404).json({ message: 'Test not found or you are not the creator' });
        }
        res.status(200).json(test);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to fetch test' });
    }
};

// @desc    Update a specific test by ID
// @route   PUT /api/teachers/tests/:id
// @access  Private (Teachers only)
exports.updateTest = async (req, res) => {
    try {
        const { title, description, duration, startDate, endDate, questions } = req.body;
        const updatedTest = await Test.findOneAndUpdate(
            { _id: req.params.id, teacherId: req.user.id },
            { title, description, duration, startDate, endDate, questions },
            { new: true, runValidators: true }
        ).populate('questions');
        if (!updatedTest) {
            return res.status(404).json({ message: 'Test not found or you are not the creator' });
        }
        res.status(200).json(updatedTest);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to update test' });
    }
};

// @desc    Delete a specific test by ID
// @route   DELETE /api/teachers/tests/:id
// @access  Private (Teachers only)
exports.deleteTest = async (req, res) => {
    try {
        const deletedTest = await Test.findOneAndDelete({ _id: req.params.id, teacherId: req.user.id });
        if (!deletedTest) {
            return res.status(404).json({ message: 'Test not found or you are not the creator' });
        }
        res.status(200).json({ message: 'Test deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to delete test' });
    }
};

// @desc    Add an existing question to a test
// @route   POST /api/teachers/tests/:testId/add-question
// @access  Private (Teachers only)
exports.addQuestionToTest = async (req, res) => {
    try {
        const { questionId } = req.body;
        const test = await Test.findOneAndUpdate(
            { _id: req.params.testId, teacherId: req.user.id },
            { $addToSet: { questions: questionId } }, // $addToSet ensures no duplicates
            { new: true }
        ).populate('questions');

        if (!test) {
            return res.status(404).json({ message: 'Test not found or you are not the creator' });
        }
        const questionExists = await Question.findById(questionId);
        if (!questionExists) {
            return res.status(400).json({ message: 'Question not found' });
        }
        res.status(200).json(test);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to add question to test' });
    }
};

// @desc    Remove a question from a test
// @route   POST /api/teachers/tests/:testId/remove-question
// @access  Private (Teachers only)
exports.removeQuestionFromTest = async (req, res) => {
    try {
        const { questionId } = req.body;
        const test = await Test.findOneAndUpdate(
            { _id: req.params.testId, teacherId: req.user.id },
            { $pull: { questions: questionId } },
            { new: true }
        ).populate('questions');

        if (!test) {
            return res.status(404).json({ message: 'Test not found or you are not the creator' });
        }
        res.status(200).json(test);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to remove question from test' });
    }
};
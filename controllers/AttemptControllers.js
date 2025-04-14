// backend/controllers/AttemptController.js

const Attempt = require('../models/Attempt');
const Test = require('../models/Test');
const Question = require('../models/Question');

// @desc    Get all available tests for students
// @route   GET /api/students/tests
// @access  Private (Students only)
exports.getAllAvailableTests = async (req, res) => {
    try {
        const now = new Date();
        const tests = await Test.find({
            startDate: { $lte: now },
            endDate: { $gte: now }
        }).select('-questions'); // Don't send all questions in the list
        res.status(200).json(tests);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to fetch available tests' });
    }
};

// @desc    Get details of a specific test for students (including questions)
// @route   GET /api/students/tests/:testId
// @access  Private (Students only)
exports.getTestByIdForStudent = async (req, res) => {
    try {
        const test = await Test.findById(req.params.testId).populate('questions');
        if (!test) {
            return res.status(404).json({ message: 'Test not found' });
        }
        const now = new Date();
        if (test.startDate > now || test.endDate < now) {
            return res.status(403).json({ message: 'Test is not currently active' });
        }
        res.status(200).json(test);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to fetch test details' });
    }
};

// @desc    Start a test (create a new attempt record)
// @route   POST /api/students/tests/:testId/start
// @access  Private (Students only)
exports.startTest = async (req, res) => {
    try {
        const test = await Test.findById(req.params.testId);
        if (!test) {
            return res.status(404).json({ message: 'Test not found' });
        }
        const now = new Date();
        if (test.startDate > now || test.endDate < now) {
            return res.status(403).json({ message: 'Test is not currently active' });
        }

        const existingAttempt = await Attempt.findOne({ studentId: req.user.id, testId: req.params.testId, endTime: null });
        if (existingAttempt) {
            return res.status(400).json({ message: 'You have already started this test' });
        }

        const newAttempt = new Attempt({
            studentId: req.user.id,
            testId: req.params.testId,
            startTime: new Date()
        });
        const savedAttempt = await newAttempt.save();
        res.status(201).json(savedAttempt);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to start test' });
    }
};

// @desc    Submit answers for a test
// @route   POST /api/students/tests/:testId/submit
// @access  Private (Students only)
exports.submitTest = async (req, res) => {
    try {
        const { answers } = req.body; // Array of { questionId, selectedOption }
        const testId = req.params.testId;
        const studentId = req.user.id;

        const test = await Test.findById(testId).populate('questions', 'correctAnswer');
        if (!test) {
            return res.status(404).json({ message: 'Test not found' });
        }

        const attempt = await Attempt.findOne({ studentId, testId, endTime: null });
        if (!attempt) {
            return res.status(400).json({ message: 'Test not started or already submitted' });
        }

        let score = 0;
        for (const submittedAnswer of answers) {
            const question = test.questions.find(q => q._id.toString() === submittedAnswer.questionId);
            if (question && submittedAnswer.selectedOption === question.correctAnswer) {
                score++;
            }
        }

        attempt.answers = answers;
        attempt.score = score;
        attempt.endTime = new Date();
        const updatedAttempt = await attempt.save();

        res.status(200).json({ message: 'Test submitted successfully', score: updatedAttempt.score });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to submit test' });
    }
};

// @desc    Get all attempts of the logged-in student
// @route   GET /api/students/attempts
// @access  Private (Students only)
exports.getStudentAttempts = async (req, res) => {
    try {
        const attempts = await Attempt.find({ studentId: req.user.id }).populate('testId', 'title');
        res.status(200).json(attempts);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to fetch student attempts' });
    }
};

// @desc    Get a specific attempt of the logged-in student by ID
// @route   GET /api/students/attempts/:attemptId
// @access  Private (Students only)
exports.getStudentAttemptById = async (req, res) => {
    try {
        const attempt = await Attempt.findOne({ _id: req.params.attemptId, studentId: req.user.id })
            .populate('testId', 'title')
            .populate({
                path: 'answers.questionId',
                model: 'Question',
                select: 'questionText options correctAnswer' // Optionally include correct answer for review
            });
        if (!attempt) {
            return res.status(404).json({ message: 'Attempt not found' });
        }
        res.status(200).json(attempt);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to fetch attempt details' });
    }
};

// @desc    Get all attempts for a specific test (for teachers)
// @route   GET /api/teachers/attempts/:testId
// @access  Private (Teachers only)
exports.getAttemptsByTest = async (req, res) => {
    try {
        const attempts = await Attempt.find({ testId: req.params.testId })
            .populate('studentId', 'username')
            .populate('testId', 'title');
        res.status(200).json(attempts);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to fetch attempts for this test' });
    }
};

// @desc    Get details of a specific attempt by ID (for teachers)
// @route   GET /api/teachers/attempts/:attemptId
// @access  Private (Teachers only)
exports.getAttemptDetails = async (req, res) => {
    try {
        const attempt = await Attempt.findById(req.params.attemptId)
            .populate('studentId', 'username')
            .populate('testId', 'title')
            .populate({
                path: 'answers.questionId',
                model: 'Question',
                select: 'questionText options correctAnswer'
            });
        if (!attempt) {
            return res.status(404).json({ message: 'Attempt not found' });
        }
        res.status(200).json(attempt);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to fetch attempt details' });
    }
};
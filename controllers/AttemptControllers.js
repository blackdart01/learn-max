// backend/controllers/AttemptController.js

const Attempt = require('../models/Attempt');
const Test = require('../models/Test');
const Question = require('../models/QuestionModel');

// @desc    Get all available tests for students
// @route   GET /api/students/tests
// @access  Private (Students only)
exports.getAllAvailableTests = async (req, res) => {
    try {
        const now = new Date();
        const studentId = req.user.id;
        const tests = await Test.find({
            startDate: { $lte: now },
            endDate: { $gte: now },
            $or: [
                { visibility: 'public' },
                { visibility: 'enrolled', allowedStudentIds: studentId },
                { visibility: 'code', allowedStudentIds: studentId }
            ]
        })
        .populate('teacherId', 'username'); // Populate teacher username
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
// exports.submitTest = async (req, res) => {
//     try {
//         const { answers } = req.body; // Array of { questionId, selectedOption }
//         const testId = req.params.testId;
//         const studentId = req.user.id;

//         const test = await Test.findById(testId).populate('questions', 'correctAnswer');
//         if (!test) {
//             return res.status(404).json({ message: 'Test not found' });
//         }

//         const attempt = await Attempt.findOne({ studentId, testId, endTime: null });
//         if (!attempt) {
//             return res.status(400).json({ message: 'Test not started or already submitted' });
//         }

//         // Calculate score as a percentage
//         let correctAnswers = 0;
//         const totalQuestions = test.questions.length;

//         for (const submittedAnswer of answers) {
//             const question = test.questions.find(q => q._id.toString() === submittedAnswer.questionId);
//             if (question && submittedAnswer.selectedOption.toString() === question.correctAnswer.toString()) {
//                 correctAnswers++;
//             }
//         }

//         // Calculate score as a percentage
//         const scorePercentage = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;

//         attempt.answers = answers;
//         attempt.score = scorePercentage;
//         attempt.endTime = new Date();
//         const updatedAttempt = await attempt.save();

//         res.status(200).json({ message: 'Test submitted successfully', score: updatedAttempt.score });
//     } catch (error) {
//         console.error(error);
//         res.status(500).json({ message: 'Failed to submit test' });
//     }
// }; 

exports.submitTest = async (req, res) => {
    try {
        const { answers } = req.body; // Array of { questionId, selectedOption }
        const testId = req.params.testId;
        const studentId = req.user.id;

        // Get test with fully populated questions
        const test = await Test.findById(testId);
        if (!test) {
            return res.status(404).json({ message: 'Test not found' });
        }

        // Fetch all questions for this test
        const questions = await Question.find({
            _id: { $in: test.questions }
        });

        if (!questions || questions.length === 0) {
            return res.status(400).json({ message: 'No questions found for this test' });
        }

        console.log('Found questions:', questions.map(q => ({
            id: q._id,
            correctAnswer: q.correctAnswer
        })));

        const attempt = await Attempt.findOne({ studentId, testId, endTime: null });
        if (!attempt) {
            return res.status(400).json({ message: 'Test not started or already submitted' });
        }

        // Calculate score
        let score = 0;
        let totalQuestions = questions.length;

        console.log('Calculating score...');
        console.log('Total questions:', totalQuestions);
        console.log('Submitted answers:', JSON.stringify(answers, null, 2));

        for (const submittedAnswer of answers) {
            console.log("submittedAnswer", submittedAnswer);
            const question = questions.find(q => q._id.toString() === submittedAnswer.questionId);

            if (question) {
                // Convert both answers to strings and trim whitespace for comparison
                const submittedOption = String(submittedAnswer.selectedOption || '').trim().toLowerCase();
                const correctOption = String(question.correctAnswer || '').trim().toLowerCase();

                console.log(`Comparing answers for question ${question._id}:`);
                console.log('Submitted:', submittedOption);
                console.log('Correct:', correctOption);

                if (submittedOption === correctOption) {
                    score++;
                    console.log('✓ Correct answer! Current score:', score);
                } else {
                    console.log('✗ Incorrect answer');
                }
            } else {
                console.log(`Warning: Question not found for ID ${submittedAnswer.questionId}`);
            }
        }

        // Calculate percentage score (ensure we don't divide by zero)
        const percentageScore = totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : 0;
        console.log('Final percentage score:', percentageScore + '%');

        // Update attempt with answers and score
        attempt.answers = answers;
        attempt.score = percentageScore;
        attempt.endTime = new Date();

        const updatedAttempt = await attempt.save();

        res.status(200).json({
            message: 'Test submitted successfully',
            score: updatedAttempt.score,
            totalQuestions,
            correctAnswers: score
        });
    } catch (error) {
        console.error('Error in submitTest:', error);
        res.status(500).json({ message: 'Failed to submit test', error: error.message });
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
        console.log('Fetching attempt with ID:', req.params.attemptId);
        
        // First, get the attempt and populate the test
        const attempt = await Attempt.findOne({ 
            _id: req.params.attemptId, 
            studentId: req.user.id 
        }).populate('testId');

        if (!attempt) {
            return res.status(404).json({ message: 'Attempt not found' });
        }

        // Then, populate the questions separately
        await Test.populate(attempt.testId, {
            path: 'questions',
            model: 'QuestionModel',
            select: 'questionText options correctAnswer topic difficulty'
        });

        // Populate the answers
        await Attempt.populate(attempt, {
            path: 'answers.questionId',
            model: 'QuestionModel',
            select: 'questionText options correctAnswer'
        });

        // Debug logs
        console.log('Found attempt:', attempt._id);
        console.log('Test ID:', attempt.testId._id);
        console.log('Test title:', attempt.testId.title);
        console.log('Questions array length:', attempt.testId.questions ? attempt.testId.questions.length : 0);
        console.log('Question IDs:', attempt.testId.questions.map(q => q._id));
        
        // Verify each question exists
        const missingQuestions = attempt.testId.questions.filter(q => !q.questionText);
        if (missingQuestions.length > 0) {
            console.log('Warning: Some questions could not be populated:', missingQuestions.map(q => q._id));
        }

        // Check if test exists but has no questions
        if (!attempt.testId.questions || attempt.testId.questions.length === 0) {
            console.log('Warning: Test has no questions');
            return res.status(400).json({ 
                message: 'This test has no questions assigned to it. Please contact your teacher.',
                attempt: attempt 
            });
        }

        res.status(200).json(attempt);
    } catch (error) {
        console.error('Error in getStudentAttemptById:', error);
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

// @desc    Join a test by code
// @route   POST /api/students/tests/join
// @access  Private (Students only)
exports.joinTestByCode = async (req, res) => {
    try {
        const { code } = req.body;
        const studentId = req.user.id;
        // Find the test with the given join code and visibility 'code'
        const test = await Test.findOne({ joinCode: code, visibility: 'code' });
        if (!test) {
            return res.status(404).json({ message: 'Invalid or expired join code' });
        }
        // Check if student is already enrolled
        if (test.allowedStudentIds.includes(studentId)) {
            return res.status(200).json({ message: 'Already joined this test' });
        }
        // Add student to allowedStudentIds
        test.allowedStudentIds.push(studentId);
        await test.save();
        res.status(200).json({ message: 'Joined test successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to join test by code' });
    }
};
exports.saveTestProgress = async (req, res) => {
    try {
        const { attemptId } = req.params;
        const { answers, timeLeft, current } = req.body;
        const userId = req.user.id;

        // Find the attempt and verify ownership
        const attempt = await Attempt.findById(attemptId);
        if (!attempt) {
            return res.status(404).json({ message: 'Attempt not found' });
        }

        if (attempt.studentId.toString() !== userId) {
            return res.status(403).json({ message: 'Not authorized to modify this attempt' });
        }

        // Don't allow progress updates for completed attempts
        if (attempt.endTime) {
            return res.status(400).json({ message: 'Cannot update completed attempt' });
        }

        // Update the attempt with progress
        attempt.progress = {
            answers,
            timeLeft,
            current,
            lastUpdate: new Date()
        };

        await attempt.save();

        res.status(200).json({ message: 'Progress saved successfully' });
    } catch (error) {
        console.error('Error saving test progress:', error);
        res.status(500).json({ message: 'Error saving test progress' });
    }
};

// Get test progress
exports.getTestProgress = async (req, res) => {
    try {
        const { attemptId } = req.params;
        const userId = req.user.id;

        // Find the attempt and verify ownership
        const attempt = await Attempt.findById(attemptId);
        if (!attempt) {
            return res.status(404).json({ message: 'Attempt not found' });
        }

        if (attempt.studentId.toString() !== userId) {
            return res.status(403).json({ message: 'Not authorized to view this attempt' });
        }

        // Don't return progress for completed attempts
        if (attempt.endTime) {
            return res.status(400).json({ message: 'Cannot retrieve progress for completed attempt' });
        }

        // If no progress saved yet, return empty state
        if (!attempt.progress) {
            return res.status(200).json({
                answers: {},
                timeLeft: 0,
                current: 0
            });
        }

        res.status(200).json(attempt.progress);
    } catch (error) {
        console.error('Error retrieving test progress:', error);
        res.status(500).json({ message: 'Error retrieving test progress' });
    }
}; 
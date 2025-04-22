const Test = require('../models/Test');
const QuestionModel = require('../models/QuestionModel');
const mongoose = require('mongoose');
// @desc    Get all tests created by the logged-in teacher
// @route   GET /api/teachers/tests
// @access  Private (Teachers only)
exports.getAllTestsByTeacher = async (req, res) => {
    try {
        const tests = await Test.find({ teacherId: req.user.id }); // Optionally populate question text
        res.status(200).json(tests);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to fetch tests' });
    }
};

    exports.getTestGist = async(req, res) => {
        const tests = await Test.find({ teacherId: req.user.id }).lean();
        if (!tests || tests.length === 0) {
            return res.status(200).json([]); // Return empty array if no tests found
        }
        console.log("tests ->", tests);
        let testGist = [];
        for(const data of tests){
            console.log("data ->", data);
            
            if (data && data.title){
                const now = new Date();
                const start = new Date(data.startDate);
                const end = new Date(data.endDate);
                if (now < start || (now >= start && now <= end)){
                    testGist.push({ title: data.title, _id: data._id, description: data.description });
                }
            }
        }
        return res.status(200).json(testGist);
    }
    exports.getAllTestsByTeacherNew = async (req, res) => {
        try {
            const tests = await Test.find({ teacherId: req.user.id }).lean(); // Use lean() for faster, plain JavaScript objects

            if (!tests || tests.length === 0) {
                return res.status(200).json([]); // Return empty array if no tests found
            }

            const allQuestionIds = new Set();
            tests.forEach(test => {
                if (test.questions && Array.isArray(test.questions)) {
                    test.questions.forEach(questionId => allQuestionIds.add(questionId));
                }
            });

            const questionIdArray = Array.from(allQuestionIds);
            const questions = await QuestionModel.find({
                _id: { $in: questionIdArray },
                createdBy: req.user.id // Ensure teacher owns the questions
            }).lean();

            const questionsMap = new Map(questions.map(question => [question._id.toString(), question.questionText]));

            const updatedTests = tests.map(test => {
                if (test.questions && Array.isArray(test.questions)) {
                    const questionNames = test.questions.map(questionId => {
                        return questionsMap.get(questionId.toString()) || `(Not Found ID: ${questionId})`;
                    });
                    return { ...test, questions: questionNames };
                }
                return test;
            });

            res.status(200).json(updatedTests);

        } catch (error) {
            console.error(error);
            res.status(500).json({ message: 'Failed to fetch tests with question names' });
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
        const test = await Test.findOne({ _id: req.params.id, teacherId: req.user.id });
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
        const { testId } = req.params;

        console.log("Adding question ID:", questionId, "to test ID:", testId);

        // Validate IDs
        if (!isValidMongoId(questionId)) {
            return res.status(400).json({ message: 'Invalid Question ID' });
        }
        if (!isValidMongoId(testId)) {
            return res.status(400).json({ message: 'Invalid Test ID' });
        }

        // Check if the question exists and belongs to the teacher
        const questionExists = await QuestionModel.findOne({ _id: questionId, createdBy: req.user.id });
        if (!questionExists) {
            return res.status(404).json({ message: 'Question not found or you are not the creator' });
        }

        // Find the test and check if the teacher owns it
        const test = await Test.findOne({ _id: testId, teacherId: req.user.id });
        if (!test) {
            return res.status(404).json({ message: 'Test not found or you are not the creator' });
        }

        // Check if the question is already present in the test's questions array
        if (test.questions.includes(questionId)) {
            return res.status(409).json({ message: 'Question already present in the Test' });
        }

        // Add the question ID to the test's questions array using $addToSet
        const updatedTest = await Test.findByIdAndUpdate(
            testId,
            { $addToSet: { questions: questionId } },
            { new: true }
        );

        if (!updatedTest) {
            return res.status(500).json({ message: 'Failed to update the test' }); // Should ideally not happen if findOne worked
        }

        res.status(200).json(updatedTest);

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to add question to test' });
    }
};
function isValidMongoId(id) {
    return mongoose.Types.ObjectId.isValid(id);
}

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
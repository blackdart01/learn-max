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
        const { title, description, duration, startDate, endDate, questions, visibility, joinCode, allowedStudentIds } = req.body;
        const newTest = new Test({
            teacherId: req.user.id,
            title,
            description,
            duration,
            startDate,
            endDate,
            questions: questions || [],
            visibility: visibility || "enrolled",
            joinCode : joinCode || "",
            allowedStudentIds: allowedStudentIds || [],
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
        const { title, description, duration, startDate, endDate, questions, visibility, joinCode, allowedStudentIds } = req.body;
        console.log(req.body);
        
        const updatedTest = await Test.findOneAndUpdate(
            { _id: req.params.id, teacherId: req.user.id },
            { title, description, duration, startDate, endDate, questions, visibility, joinCode, allowedStudentIds },
            { new: true, runValidators: true }
        );
        console.log("updatedTest -> ", updatedTest);
        
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

exports.addMultipleQuestionToTest = async (req, res) => {
    try {
        const { questionIds } = req.body;  // Receive an array of question IDs
        const { testId } = req.params;

        console.log("Adding question IDs:", questionIds, "to test ID:", testId);

        // Validate testId
        if (!isValidMongoId(testId)) {
            return res.status(400).json({ message: 'Invalid Test ID' });
        }

        if (!Array.isArray(questionIds)) {
            return res.status(400).json({ message: 'questionIds must be an array' });
        }

        // Validate each questionId and check ownership
        const validQuestionIds = [];
        for (const questionId of questionIds) {
            if (!isValidMongoId(questionId)) {
                return res.status(400).json({ message: `Invalid Question ID: ${questionId}` });
            }
            const questionExists = await QuestionModel.findOne({ _id: questionId, createdBy: req.user.id });
            if (!questionExists) {
                return res.status(404).json({ message: `Question not found or you are not the creator: ${questionId}` });
            }
            validQuestionIds.push(questionId); // Only add valid question IDs to the array
        }

        // Find the test and check ownership
        const test = await Test.findOne({ _id: testId, teacherId: req.user.id });
        if (!test) {
            return res.status(404).json({ message: 'Test not found or you are not the creator' });
        }
        // Check if the question is already present in the test's questions array
        if (test.questions.includes(questionId)) {
            return res.status(409).json({ message: 'Question already present in the Test' });
        }
        // Check for duplicate questions *before* updating
        const existingQuestionIds = new Set(test.questions.map(q => q.toString())); // Convert ObjectIds to strings for comparison
        const newQuestionsToAdd = validQuestionIds.filter(qId => !existingQuestionIds.has(qId.toString()));

        if (newQuestionsToAdd.length === 0) {
            return res.status(200).json({ message: 'All provided questions are already in the test', updatedTest: test }); // Or 200
        }
        // Add the question IDs to the test's questions array using $addToSet
        const updatedTest = await Test.findByIdAndUpdate(
            testId,
            { $addToSet: { questions: { $each: newQuestionsToAdd } } }, // Use $each to add multiple
            { new: true }
        );

        if (!updatedTest) {
            return res.status(500).json({ message: 'Failed to update the test' });
        }

        res.status(200).json(updatedTest);

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to add questions to test' });
    }
};
exports.getQuestionDetailsByTestId = async (req, res) => {
    try {
        const testId  = req.params.id; // Get test ID from URL
        const teacherId = req.user.id;    // Get teacher ID from authentication

        console.log(`Fetching question details for test ID: ${JSON.stringify(req.params)}`);
        console.log(`Fetching question details for test ID: ${JSON.stringify(testId)}`);

        // 1. Validate testId
        if (!isValidMongoId(testId)) {

            return res.status(400).json({ message: 'Invalid testId' });
        }

        // 2. Find the test and ensure it belongs to the teacher
        const test = await Test.findOne({ _id: testId, teacherId });
        if (!test) {
            return res.status(404).json({ message: 'Test not found or not owned by teacher' });
        }

        // 3. Extract and return question details
        const questions = test.questions;
        let arrayOfDetails = [];
        for(let ques of questions){
            console.log("ques -> ", ques);
            
            console.log("det -> ", { _id: ques, createdBy: req.user.id });
            const quesDetails = await QuestionModel.findOne({ _id: ques, createdBy: req.user.id });
            console.log("quesDetails -> ", quesDetails);
            if(quesDetails!=null){
                arrayOfDetails.push(quesDetails);
            }
        }
        res.status(200).json({
            message: 'Question details retrieved successfully',
            questions: arrayOfDetails,
        });
    } catch (error) {
        // 4. Handle Errors
        console.error('Error fetching question details:', error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};
exports.addQuestionToMultipleTest = async (req, res) => {
    try {
        const { testIds } = req.body; // Array of test IDs
        const { questionId } = req.params; // Question ID from URL
        const teacherId = req.user.id;    // Get teacher ID from authentication

        console.log(`Tagging question ${questionId} to tests: ${testIds}`);

        // 1. Input Validation
        if (!isValidMongoId(questionId)) {
            return res.status(400).json({ message: 'Invalid questionId' });
        }

        if (!Array.isArray(testIds) || testIds.length === 0) {
            return res.status(400).json({ message: 'Invalid testIds: Must be a non-empty array' });
        }

        // 2. Validate testIds and prepare for update
        const testsToUpdate = [];
        for (const testId of testIds) {
            if (!isValidMongoId(testId)) {
                return res.status(400).json({ message: `Invalid testId: ${testId}` });
            }

            // Check if the test exists and is owned by the teacher
            const test = await Test.findOne({ _id: testId, teacherId });
            if (!test) {
                return res.status(404).json({ message: `Test not found or not owned by teacher: ${testId}` });
            }
            // Check if the question is already present in the test's questions array
            if (test.questions.includes(questionId)) {
                return res.status(409).json({ message: 'Question already present in the Test' });
            }
            // Only add the testId to the array if it passes validation
            testsToUpdate.push(testId);
        }

        // 3. Check Question Existence and Ownership
        const question = await QuestionModel.findOne({ _id: questionId, createdBy: teacherId });
        if (!question) {
            return res.status(404).json({ message: 'Question not found or not owned by teacher' });
        }

        // 4. Update Tests (using a single updateMany)
        const updateResult = await Test.updateMany(
            { _id: { $in: testsToUpdate }, teacherId: teacherId }, // Filter: only update the teacher's tests
            { $addToSet: { questions: questionId } }       // Add questionId to the questions array
        );

        // Check if the update affected the expected number of documents
        if (updateResult.modifiedCount !== testsToUpdate.length) {
            // Handle the case where not all tests were updated.
            //  This could indicate a data inconsistency or a race condition.
            console.error(`Expected to update ${testsToUpdate.length} tests, but updated ${updateResult.modifiedCount}`);
            return res.status(500).json({
                message: 'Failed to update all tests.  Possible data inconsistency.',
                updatedCount: updateResult.modifiedCount,
                expectedCount: testsToUpdate.length
            });
        }

        // 5. Respond with Success
        res.status(200).json({
            message: 'Question tagged to tests successfully',
            updatedCount: updateResult.modifiedCount
        });

    } catch (error) {
        // 6. Handle Errors
        console.error('Error tagging question to tests:', error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
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


// Get all available tests for students
exports.getAvailableTests = async (req, res) => {
    try {
        const currentDate = new Date();
        const studentId = req.user.id;

        // Find tests that are either:
        // 1. Public visibility OR
        // 2. Enrolled visibility AND student is in allowedStudentIds
        const tests = await Test.find({
            $or: [
                { visibility: 'public' },
                {
                    visibility: 'enrolled',
                    allowedStudentIds: studentId
                }
            ],
            startDate: { $lte: currentDate },
            endDate: { $gt: currentDate }
        }).populate('questions', 'question options');

        res.json(tests);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching tests', error: error.message });
    }
};
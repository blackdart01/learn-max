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
                console.log("testtttttt->", test);
                
                if (submittedOption === correctOption) {
                    
                    submittedAnswer.score = parseInt(test.correctAnswerMark)||0;
                    submittedAnswer.isCorrect = true;
                    console.log('✓ Correct answer! Current score:', submittedAnswer.score);
                } else {
                    submittedAnswer.isCorrect = false;
                    submittedAnswer.score = parseInt(test.incorrectAnswerMark) || 0;
                    console.log('✗ Incorrect answer:', submittedAnswer.score);
                }
                score+=submittedAnswer.score;
                console.log('final score of that question:', score);
            } else {
                console.log(`Warning: Question not found for ID ${submittedAnswer.questionId}`);
            }
        }
        console.log("answers-----> ", JSON.stringify(answers, null, 2));
        
        // Calculate percentage score (ensure we don't divide by zero)
        const percentageScore = totalQuestions > 0 ? Math.round((score / (totalQuestions * parseInt(test.correctAnswerMark) || 1)) * 100) : 0;
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
        // const attempt = await Attempt.findById(req.params.attemptId)
        //     .populate('studentId', 'username')
        //     .populate('testId', 'title')
        //     .populate({
        //         path: 'answers.questionId',
        //         model: 'QuestionModel',
        //         select: 'questionText options correctAnswer'
        //     });

        //     console.log("testId->", attempt.testId._id);
        // await Test.populate(attempt.testId._id, {
        //     path: 'questions',
        //     model: 'QuestionModel',
        //     select: 'questionText options correctAnswer topic difficulty'
        // });
        const attempt = await Attempt.findById(req.params.attemptId)
            .populate('studentId', 'username')
            .populate({
                path: 'testId',
                select: 'title questions', // Select the 'questions' field of the Test
                populate: {
                    path: 'questions',
                    model: 'QuestionModel',
                    select: 'questionText options correctAnswer topic difficulty'
                }
            })
            .populate({
                path: 'answers.questionId',
                model: 'QuestionModel',
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
// exports.getAttemptDetails = async (req, res) => {
//     try {
//         console.log('Fetching attempt details for ID:', req.params.attemptId);

//         // First find all tests created by this teacher
//         const teacherTests = await Test.find({ teacherId: req.user.id }).select('_id');
//         const testIds = teacherTests.map(test => test._id);

//         console.log('Teacher test IDs:', testIds);

//         // Find the attempt and verify it belongs to one of the teacher's tests
//         const attempt = await Attempt.findOne({
//             _id: req.params.attemptId,
//             testId: { $in: testIds }
//         })
//             .populate('studentId', 'username')
//             .populate('testId', 'title')
//             .populate({
//                 path: 'answers.questionId',
//                 model: 'QuestionModel',
//                 select: 'questionText options correctAnswer'
//             });

//         console.log('Found attempt:', attempt ? 'Yes' : 'No');
//         console.log(attempt);

//         if (!attempt) {
//             return res.status(404).json({
//                 message: 'Attempt not found or you do not have permission to view it'
//             });
//         }

//         // Add debug information
//         console.log('Attempt details:', {
//             id: attempt._id,
//             testTitle: attempt.testId?.title,
//             studentName: attempt.studentId?.username,
//             answersCount: attempt.answers?.length
//         });

//         res.status(200).json(attempt);
//     } catch (error) {
//         console.error('Error in getAttemptDetails:', error);
//         res.status(500).json({
//             message: 'Failed to fetch attempt details',
//             error: error.message
//         });
//     }
// };

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
// exports.updateAnswer = async (req, res) => {
//     try {
//         const { attemptId, answerId } = req.params;
//         const { isCorrect, teacherComment } = req.body;

//         // Find the attempt
//         const attempt = await Attempt.findById(attemptId);
//         if (!attempt) {
//             return res.status(404).json({ message: 'Attempt not found' });
//         }

//         // Find the answer in the attempt's answers array
//         const answerIndex = attempt.answers.findIndex(ans => ans._id.toString() === answerId);
//         if (answerIndex === -1) {
//             return res.status(404).json({ message: 'Answer not found in this attempt' });
//         }

//         // Update the answer
//         attempt.answers[answerIndex].isCorrect = isCorrect;
//         attempt.answers[answerIndex].teacherComment = teacherComment;

//         // Recalculate the score based on correct answers
//         const totalQuestions = attempt.answers.length;
//         const correctAnswers = attempt.answers.filter(ans => ans.isCorrect).length;
//         attempt.score = Math.round((correctAnswers / totalQuestions) * 100);

//         // Save the updated attempt
//         await attempt.save();

//         res.status(200).json({
//             status: 'success',
//             data: attempt
//         });

//     } catch (error) {
//         console.error('Error updating answer:', error);
//         res.status(500).json({
//             status: 'error',
//             message: 'Error updating answer'
//         });
//     }
// };


exports.updateAnswer = async (req, res) => {
    try {
        const { attemptId, answerId } = req.params;
        const { isCorrect, teacherComment } = req.body;

        console.log('Updating answer:', { attemptId, answerId, isCorrect, teacherComment });

        // Find the attempt and populate test details
        const attempt = await Attempt.findById(attemptId).populate({
            path: 'testId',
            select: 'questions'
        });

        if (!attempt) {
            return res.status(404).json({ message: 'Attempt not found' });
        }

        console.log('Found attempt:', attempt);
        const testDetails = await Test.findById(attempt.testId._id);
        // Convert answers to plain objects and preserve existing isCorrect values
        let answers = attempt.answers.map(ans => {
            // Convert to plain object if it's a Mongoose document
            const plainAns = ans.toObject ? ans.toObject() : { ...ans };
            return {
                questionId: plainAns.questionId,
                selectedOption: plainAns.selectedOption,
                isCorrect: plainAns.isCorrect, // Preserve existing isCorrect value
                teacherComment: plainAns.teacherComment,
                _id: plainAns._id
            };
        });

        // Find the answer index
        const answerIndex = answers.findIndex(ans =>
            ans.questionId.toString() === answerId ||
            (ans.questionId._id && ans.questionId._id.toString() === answerId)
        );

        console.log('Answer index:', answerIndex);
        console.log('Current answers state:', JSON.stringify(answers, null, 2));

        if (answerIndex === -1) {
            // If answer doesn't exist, create a new one
            answers.push({
                questionId: answerId,
                selectedOption: null,
                isCorrect: isCorrect,
                teacherComment: teacherComment
            });
        } else {
            // Update existing answer while preserving other fields
            let updatedScore = isCorrect ? testDetails.correctAnswerMark : !isCorrect ? testDetails.incorrectAnswerMark : testDetails.unattemptedAnswerMark;
                 console.log("updatedScore ->", updatedScore);
            answers[answerIndex] = {
                ...answers[answerIndex],
                isCorrect: isCorrect,
                score: updatedScore,
                teacherComment: teacherComment
            };
        }

        console.log('Updated answers:', JSON.stringify(answers, null, 2));

        // Update the attempt with new answers
        attempt.answers = answers;

        // Recalculate score
        if (attempt.testId && attempt.testId.questions) {
            const totalQuestions = attempt.testId.questions.length;
            // Only count answers that are explicitly marked as correct (true)
            const correctAnswers = answers.filter(ans => ans.isCorrect === true).length;
            attempt.score = Math.round((correctAnswers / (totalQuestions * parseInt(testDetails.correctAnswerMark) || 1)) * 100);
            console.log('Score calculation:', {
                totalQuestions,
                correctAnswers,
                newScore: attempt.score,
                answers: answers.map(a => ({ id: a.questionId, isCorrect: a.isCorrect }))
            });
        }

        // Mark the answers array as modified
        attempt.markModified('answers');

        // Save the updated attempt
        const updatedAttempt = await attempt.save();
        console.log('Saved attempt:', updatedAttempt);

        // Fetch the complete updated attempt with all populated fields
        const finalAttempt = await Attempt.findById(updatedAttempt._id)
            .populate('testId', 'title questions')
            .populate({
                path: 'answers.questionId',
                model: 'QuestionModel',
                select: 'questionText options correctAnswer'
            });

        res.status(200).json({
            status: 'success',
            data: finalAttempt
        });

    } catch (error) {
        console.error('Error updating answer:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error updating answer',
            error: error.message
        });
    }
};

// exports.updateAnswer = async (req, res) => {
//     try {
//         const { attemptId, answerId } = req.params;
//         const { isCorrect: manualIsCorrect, teacherComment } = req.body; // Rename to avoid confusion

//         console.log('Updating answer:', { attemptId, answerId, isCorrect: manualIsCorrect, teacherComment });

//         // Find the attempt and populate test with questions
//         const attempt = await Attempt.findById(attemptId).populate({
//             path: 'testId',
//             select: 'questions',
//             populate: {
//                 path: 'questions',
//                 model: 'QuestionModel',
//                 select: 'correctAnswer' // Only need correctAnswer for evaluation
//             }
//         });

//         if (!attempt) {
//             return res.status(404).json({ message: 'Attempt not found' });
//         }

//         console.log('Found attempt:', attempt);
//         const testDetails = await Test.findById(attempt.testId._id);
//         console.log('Found testDetails:', testDetails);
//         let answers = attempt.answers.map(ans => ({ ...ans.toObject() }));

//         // Find the index of the answer being manually updated
//         const updatedAnswerIndex = answers.findIndex(ans =>
//             ans.questionId.toString() === answerId ||
//             (ans.questionId._id && ans.questionId._id.toString() === answerId)
//         );

//         console.log('Updated answer index:', updatedAnswerIndex);
//         console.log('Current answers state:', JSON.stringify(answers, null, 2));

//         if (updatedAnswerIndex !== -1) {
//             // Update the specific answer with teacher's feedback
//             let updatedScore = manualIsCorrect ? testDetails.correctAnswerMark : !manualIsCorrect ? testDetails.incorrectAnswerMark : testDetails.unattemptedAnswerMark;
//             console.log("updatedScore ->", updatedScore);
            
//             answers[updatedAnswerIndex] = {
//                 ...answers[updatedAnswerIndex],
//                 isCorrect: manualIsCorrect,
//                 score: updatedScore,
//                 teacherComment: teacherComment
//             };
//             console.log("updated answer detail ->", JSON.stringify(answers[updatedAnswerIndex]));
            
//         } else {
//             // If the answer doesn't exist, create a new one (only with teacher feedback)
//             answers.push({
//                 questionId: answerId,
//                 selectedOption: null,
//                 isCorrect: manualIsCorrect,
//                 teacherComment: teacherComment
//             });
//         }

//         // Re-evaluate correctness for all answers based on test questions
//         if (attempt.testId && attempt.testId.questions) {
//             answers = answers.map(submittedAnswer => {
//                 const question = attempt.testId.questions.find(
//                     q => q._id.toString() === submittedAnswer.questionId.toString()
//                 );

//                 if (question) {
//                     const submittedOption = String(submittedAnswer.selectedOption || '').trim().toLowerCase();
//                     const correctOption = Array.isArray(question.correctAnswer)
//                         ? question.correctAnswer.map(ans => String(ans).trim().toLowerCase())
//                         : String(question.correctAnswer || '').trim().toLowerCase();

//                     submittedAnswer.isCorrect = Array.isArray(correctOption)
//                         ? correctOption.includes(submittedOption)
//                         : submittedOption === correctOption;
//                 }
//                 return submittedAnswer;
//             });
//         }

//         console.log('Updated answers:', JSON.stringify(answers, null, 2));

//         attempt.answers = answers;

//         // Recalculate score
//         if (attempt.testId && attempt.testId.questions) {
//             const totalQuestions = attempt.testId.questions.length;
//             const correctAnswersCount = answers.filter(ans => ans.isCorrect === true).length;
//             attempt.score = Math.round((correctAnswersCount / totalQuestions) * 100);
//             console.log('Score calculation:', {
//                 totalQuestions,
//                 correctAnswersCount,
//                 newScore: attempt.score,
//                 answers: answers.map(a => ({ id: a.questionId, isCorrect: a.isCorrect }))
//             });
//         }

//         attempt.markModified('answers');
//         const updatedAttempt = await attempt.save();
//         console.log('Saved attempt:', updatedAttempt);

//         const finalAttempt = await Attempt.findById(updatedAttempt._id)
//             .populate('testId', 'title questions')
//             .populate({
//                 path: 'answers.questionId',
//                 model: 'QuestionModel',
//                 select: 'questionText options correctAnswer'
//             });

//         res.status(200).json({
//             status: 'success',
//             data: finalAttempt
//         });

//     } catch (error) {
//         console.error('Error updating answer:', error);
//         res.status(500).json({
//             status: 'error',
//             message: 'Error updating answer',
//             error: error.message
//         });
//     }
// };

// @desc    Get all attempts for a teacher
// @route   GET /api/teachers/attempts
// @access  Private (Teachers only)
exports.getAllTeacherAttempts = async (req, res) => {
    try {
        // Find all tests created by this teacher
        const teacherTests = await Test.find({ teacherId: req.user.id }).select('_id');
        const testIds = teacherTests.map(test => test._id);

        // Find all attempts for these tests
        const attempts = await Attempt.find({ testId: { $in: testIds } })
            .populate('testId', 'title')
            .populate('studentId', 'username')
            .sort({ startTime: -1 });

        res.status(200).json(attempts);
    } catch (error) {
        console.error('Error in getAllTeacherAttempts:', error);
        res.status(500).json({ message: 'Failed to fetch attempts' });
    }
};
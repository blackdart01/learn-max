const express = require('express');
const router = express.Router();
const attemptController = require('../controllers/AttemptControllers');
const authMiddleware = require('../middleware/authMiddleware'); // Assuming you have an auth middleware

// Middleware to protect student routes
const requireStudent = (req, res, next) => {
    if (req.user && req.user.role === 'student') {
        next();
    } else {
        return res.status(403).json({ message: 'Unauthorized: Student role required' });
    }
};

// Middleware to protect teacher routes for viewing attempts
const requireTeacher = (req, res, next) => {
    if (req.user && req.user.role === 'teacher') {
        next();
    } else {
        return res.status(403).json({ message: 'Unauthorized: Teacher role required' });
    }
};

// Student routes
router.use('/students', authMiddleware.authenticate);
router.use('/students', requireStudent);

router.get('/students/tests', attemptController.getAllAvailableTests);
router.get('/students/tests/:testId', attemptController.getTestByIdForStudent);
// router.post('/students/tests/:testId/start', attemptController.startTest);
// router.post('/students/tests/:testId/submit', attemptController.submitTest);
router.post('/students/join-test-by-code', attemptController.joinTestByCode);
// router.get('/students/attempts', attemptController.getStudentAttempts);
// router.get('/students/attempts/:attemptId', attemptController.getStudentAttemptById);
router.post('/students/tests/:testId/start', attemptController.startTest);
router.post('/students/tests/:testId/submit', attemptController.submitTest);
router.get('/students/attempts', attemptController.getStudentAttempts);
router.get('/students/attempts/:attemptId', attemptController.getStudentAttemptById);

// Teacher routes for viewing attempts
router.use('/teachers', authMiddleware.authenticate);
router.use('/teachers', requireTeacher);

// router.get('/teachers/attempts/:testId', attemptController.getAttemptsByTest);
// router.get('/teachers/attempts/attempt/:attemptId', attemptController.getAttemptDetails);
router.get('/teachers/attempts/:testId', attemptController.getAttemptsByTest);
router.get('/teachers/attempts/attempt/:attemptId', attemptController.getAttemptDetails);
router.patch('/teachers/attempts/:attemptId/grade/:answerId', attemptController.updateAnswer);
router.get('/teachers/attempts', attemptController.getAllTeacherAttempts);


// Progress saving and retrieval routes
// router.post('/students/attempts/:attemptId/progress', attemptController.saveTestProgress);
// router.get('/students/attempts/:attemptId/progress', attemptController.getTestProgress);
router.post('/students/attempts/:attemptId/progress', attemptController.saveTestProgress);
router.get('/students/attempts/:attemptId/progress', attemptController.getTestProgress);

module.exports = router;
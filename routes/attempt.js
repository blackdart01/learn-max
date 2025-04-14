const express = require('express');
const router = express.Router();
const attemptController = require('../controllers/AttemptController');
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
router.post('/students/tests/:testId/start', attemptController.startTest);
router.post('/students/tests/:testId/submit', attemptController.submitTest);
router.get('/students/attempts', attemptController.getStudentAttempts);
router.get('/students/attempts/:attemptId', attemptController.getStudentAttemptById);

// Teacher routes for viewing attempts
router.use('/teachers', authMiddleware.authenticate);
router.use('/teachers', requireTeacher);

router.get('/teachers/attempts/:testId', attemptController.getAttemptsByTest);
router.get('/teachers/attempts/:attemptId', attemptController.getAttemptDetails);

module.exports = router;
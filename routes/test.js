const express = require('express');
const router = express.Router();
const testController = require('../controllers/TestController');
const authMiddleware = require('../middleware/authMiddleware'); // Assuming you have an auth middleware

// Middleware to protect teacher routes
const requireTeacher = (req, res, next) => {
    if (req.user && req.user.role === 'teacher') {
        next();
    } else {
        return res.status(403).json({ message: 'Unauthorized: Teacher role required' });
    }
};

// Apply authentication middleware to all teacher routes
router.use(authMiddleware.authenticate);
router.use(requireTeacher);

router.get('/tests', testController.getAllTestsByTeacher);
router.get('/tests/new', testController.getAllTestsByTeacherNew);
router.get('/tests/testGist', testController.getTestGist);
router.post('/tests', testController.createTest);
router.get('/tests/:id', testController.getTestByIdForTeacher);
router.get('/tests/:id/complete', testController.getQuestionDetailsByTestId);
router.put('/tests/:id', testController.updateTest);
router.delete('/tests/:id', testController.deleteTest);
router.post('/tests/:testId/add-question', testController.addQuestionToTest);
router.post('/tests/:testId/add-multiple-question', testController.addMultipleQuestionToTest);
router.post('/tests/:questionId/add-question-to-multiple-test', testController.addQuestionToMultipleTest);
router.post('/tests/:testId/remove-question', testController.removeQuestionFromTest);

module.exports = router;
const express = require('express');
const router = express.Router();
const questionController = require('../controllers/QuestionController');
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

router.get('/questions', questionController.getAllQuestions);
router.post('/questions', questionController.addQuestion);
router.get('/questions/:id', questionController.getQuestionById);
router.put('/questions/:id/:value', questionController.updateActiveNessOfQuestion);
router.put('/questions/:id', questionController.updateQuestion);
router.delete('/questions/:id', questionController.deleteQuestion);

module.exports = router;
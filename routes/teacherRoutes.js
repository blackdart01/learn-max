const express = require('express');
const multer = require('multer');
const path = require('path');
const csv = require('csv-parser');
const fs = require('fs');
const { authenticate } = require('../middleware/authMiddleware');
const QuestionModel = require('../models/QuestionModel'); // Assuming you have a Question model
const questionController = require('../controllers/QuestionController')
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware'); // Assuming you have an auth middleware

// Middleware to handle file uploads (using multer)
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        console.log("req->", __dirname);
        
        cb(null, path.join(__dirname, '../uploads')); // Store uploaded files in the 'uploads' directory
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// @desc    Upload CSV file to create multiple questions
// @route   POST /api/teachers/questions/upload-csv
// @access  Protected (Teachers only)
router.post('/questions/upload-csv', authenticate, upload.single('questions'), async (req, res) => {
    // console.log("path :", req.file); // Log file info
    if (!req.file) {
        return res.status(400).json({ message: 'Please upload a CSV file named "questions"' });
    }
    console.log("Uploaded file details:", req.file);
    const results = [];
    const filePath = req.file.path;
    console.log("File path for reading:", filePath);

    fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => {
            console.log("data ->", JSON.stringify(data));
            
            results.push(data);
        })
        .on('end', async () => {
            fs.unlinkSync(filePath);
            
            try {
                const questionsToCreate = results.map(row => {
                    const options = [];
                    for (let i = 1; i <= 5; i++) {
                        // console.log(`option ${i}`, row[i]);
                        
                        if (row[`Option ${i}`] !== undefined && row[`Option ${i}`].trim() !== '') {
                            options.push(row[`Option ${i}`].trim());
                        }
                    }

                    let correctAnswer = null;
                    if (row['Correct Answer'] && !isNaN(parseInt(row['Correct Answer']))) {
                        const correctIndex = parseInt(row['Correct Answer']) - 1;
                        if (correctIndex >= 0 && correctIndex < options.length) {
                            correctAnswer = options[correctIndex];
                        }
                    }
                    let isActiveValue = row['Is Active'] ? row['Is Active'].trim().toLowerCase() : 'yes'; // Default to yes if not provided or empty
                    let isActive = isActiveValue === 'yes' || isActiveValue === 'true';
                    return {
                        questionText: row['Question Text'] ? row['Question Text'].trim() : '',
                        questionType: row['Question Type'] ? row['Question Type'].trim() : 'Multiple Choice',
                        options: options,
                        correctAnswer: correctAnswer,
                        subject: row['Subject'] ? row['Subject'].trim() : undefined,
                        isActive: isActive,
                        timeLimit: row['Time in seconds'] && !isNaN(parseInt(row['Time in seconds']))? parseInt(row['Time in seconds']): 30, 
                        imageLink: row['Image Link'] ? row['Image Link'].trim() : '',
                        answerExplanation: row['Answer explanation'] ? row['Answer explanation'].trim() : '',
                        createdBy: req.user.id, // Assuming authenticate middleware adds user info
                    };
                });
                
                // Validate required fields (you might want more robust validation)
                const invalidQuestions = questionsToCreate.filter(q => !q.questionText);
                if (invalidQuestions.length > 0) {
                    return res.status(400).json({ message: 'CSV contains questions with missing Question Text.' });
                }

                // Create the questions in the database
                const createdQuestions = await QuestionModel.insertMany(questionsToCreate);

                res.status(201).json({ message: `${createdQuestions.length} questions uploaded successfully.`, data: createdQuestions });

            } catch (error) {
                console.error('Error processing CSV:', error);
                res.status(500).json({ message: 'Error processing CSV file.' });
            }
        });
});
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

router.get('/questionsImported', questionController.getAllQuestionsImported);
router.get('/questionsImportedNew', questionController.getStatusQuestionsImported);
module.exports = router;
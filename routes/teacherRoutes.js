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
const { v4: uuidv4 } = require('uuid'); // For generating unique filenames
const { fromPath } = require('pdf2pic');
const Tesseract = require('tesseract.js');
const pdfParse = require('pdf-parse');
const enrollmentController = require('../controllers/enrollmentController');


// Middleware to handle file uploads (using multer)
const isExcelFile = (file) => {
    return ['.xls', '.xlsx'].includes(path.extname(file.originalname).toLowerCase());
};

// Utility function to check if a file is a CSV file
const isCsvFile = (file) => {
    return ['.csv'].includes(path.extname(file.originalname).toLowerCase());
};

// File filter for images and PDFs
const isImageOrPdfFile = (file) => {
    const ext = path.extname(file.originalname).toLowerCase();
    return (
        file.mimetype === 'application/pdf' ||
        file.mimetype.startsWith('image/') ||
        ['.jpg', '.jpeg', '.png', '.bmp', '.gif', '.tiff', '.pdf'].includes(ext)
    );
};

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        console.log("req->", __dirname);
        cb(null, path.join(__dirname, '../uploads')); // Store uploaded files in the 'uploads' directory
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = uuidv4(); // Use uuid for unique filenames
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        if (isExcelFile(file) || isCsvFile(file)) {
            console.log("is excel or csv");
            cb(null, true);
        } else {
            console.log("neither excel or csv");
            cb(null, false); // Reject the file
        }
    }
});

const uploadScan = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        if (isImageOrPdfFile(file)) {
            cb(null, true);
        } else {
            cb(new Error('Only image or PDF files are allowed!'), false);
        }
    }
});

// @desc    Upload Excel/CSV file to create multiple questions
// @route   POST /api/teachers/questions/upload-csv
// @access  Protected (Teachers only)
router.post('/questions/upload-csv', authenticate, upload.single('questions'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'Please upload an Excel or CSV file named "questions"' });
    }

    console.log("Uploaded file details:", req.file);

    let csvFilePath = req.file.path; // Start with the uploaded file path

    try {
        if (isExcelFile(req.file)) {
            // 1. Convert Excel to CSV using the Java program
            const excelFilePath = req.file.path;
            const csvFileName = `temp-${uuidv4()}.csv`;
            csvFilePath = path.join(__dirname, '../uploads', csvFileName); //create a unique name

            const javaProcess = spawn('java', [
                '-classpath',  // Classpath for Apache POI and any dependencies
                './*',       //  Assuming your compiled Java class and POI are in the current dir
                'ExcelToCsvConverter',  // Main class name
                excelFilePath,      // Argument 1: Excel file path
                csvFilePath       // Argument 2: CSV file path
            ]);

            // Capture the output and error streams
            let javaOutput = '';
            let javaError = '';

            javaProcess.stdout.on('data', (data) => {
                javaOutput += data.toString();
            });

            javaProcess.stderr.on('data', (data) => {
                javaError += data.toString();
            });

            // Wait for the Java process to complete
            const exitCode = await new Promise((resolve) => {
                javaProcess.on('close', (code) => {
                    resolve(code);
                });
            });

            if (exitCode !== 0) {
                // Handle errors from the Java conversion process
                console.error(`Java process exited with code ${exitCode}`);
                console.error('Java Output:', javaOutput);
                console.error('Java Error:', javaError);
                return res.status(500).json({
                    message: 'Error converting Excel to CSV',
                    error: javaError || 'Conversion failed',
                });
            }

            console.log('Excel to CSV conversion successful. CSV file: ', csvFilePath);
            // Optionally log the Java output
            console.log('Java Output:', javaOutput);

        }
        // 2. Process the CSV file (either the original or the converted one)
        //    -  The 'csvFilePath' variable now holds the correct path to the CSV file
        const questions = [];
        const csvData = fs.readFileSync(csvFilePath, 'utf-8');
        const lines = csvData.trim().split('\n');

        // 2.1 Parse the header row to get column names
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/^"|"$/g, '')); // to lower case and remove quotes for consistency

        // 2.2 Define the expected columns and their corresponding properties
        const expectedColumns = {
            'subject': 'subject',
            'question text': 'questionText',
            'question type': 'questionType',
            'option 1': 'option1',
            'option 2': 'option2',
            'option 3': 'option3',
            'option 4': 'option4',
            'option 5': 'option5', //make it dynamic
            'correct answer': 'correctAnswer',
            'answer explanation': 'answerExplanation',
            'time in seconds': 'timeInSeconds',
            'image link': 'imageLink',
            'is active': 'isActive'
        };

        // Parse each line of the CSV, handling potential errors
        for (let i = 1; i < lines.length; i++) { // Start from the second row (index 1)
            try {
                const line = lines[i].trim();
                if (!line) continue; // Skip empty lines

                const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, '')); // Remove quotes

                //check if number of values matches the number of headers
                if (values.length !== headers.length) {
                    console.warn(`Skipping line ${i + 1}: Number of values does not match number of headers`);
                    continue;
                }
                const questionData = {}; // Use 'any' to avoid TypeScript errors

                // Iterate through the values and assign them to the corresponding properties based on the headers
                for (let j = 0; j < headers.length; j++) {
                    const header = headers[j];
                    const value = values[j];

                    if (expectedColumns[header]) {
                        if (header === 'is active') {
                            questionData[expectedColumns[header]] = value === 'TRUE';
                        } else if (header === 'timeinseconds') {
                            questionData[expectedColumns[header]] = parseInt(value, 10) || 60;
                        }
                        else {
                            questionData[expectedColumns[header]] = value;
                        }
                    }
                    // Handle additional options dynamically
                    else if (header.startsWith('option ')) {
                        if (!questionData.options) {
                            questionData.options = [];
                        }
                        questionData.options.push(value);
                    }
                }

                // Basic validation: Check for the required fields
                if (!questionData.questionText || !questionData.correctAnswer) {
                    console.warn(`Skipping line ${i + 1}: Missing required fields (questionText, correctAnswer)`);
                    continue; // Skip malformed lines
                }
                const finalOptions = [];
                for (let k = 1; k <= 5; k++) {
                    const optionKey = `option${k}`;
                    if (questionData[optionKey]) {
                        finalOptions.push(questionData[optionKey])
                    }
                }
                questions.push({
                    isActive: questionData.isActive,
                    subject: questionData.subject,
                    questionText: questionData.questionText,
                    questionType: questionData.questionType,
                    options: finalOptions, // Ensure options is always an array
                    correctAnswer: questionData.correctAnswer,
                    answerExplanation: questionData.answerExplanation || '',
                    timeInSeconds: questionData.timeInSeconds || 60,
                    imageLink: questionData.imageLink || '',
                    createdBy: req.user.id, // Assuming you have user info in req.user
                });
            } catch (e) {
                console.error(`Error parsing line ${i + 1}:`, e.message);
                // Consider if you want to stop processing or continue with other lines
                //  For now, we continue to the next line.
            }
        }

        if (questions.length === 0) {
            return res.status(400).json({ message: 'No valid questions found in the uploaded file' });
        }

        // 3. Create questions in the database
        const createdQuestions = await QuestionModel.insertMany(questions);
        const uploadDir = path.join(__dirname, '../uploads');
        fs.readdir(uploadDir, (err, files) => {
            if (err) {
                console.error('Error reading uploads directory:', err);
                // Optionally, handle the error (e.g., send an error response)
                return;
            }
            for (const file of files) {
                fs.unlink(path.join(uploadDir, file), (err) => {
                    if (err) {
                        console.error(`Error deleting file ${file}:`, err);
                        // Optionally, handle the error for each file deletion
                    }
                });
            }
            console.log('Uploads directory cleared successfully.');
        });
        res.status(201).json({
            message: 'Questions uploaded successfully',
            count: createdQuestions.length,
            data: createdQuestions,
        });
    } catch (error) {
        // Handle any errors that occurred during file processing, database operations, etc.
        console.error("Error processing file:", error);
        res.status(500).json({ message: 'Failed to upload questions', error: error.message });
    } finally {
        // Clean up: Delete the temporary CSV file (if created)
        if (isExcelFile(req.file) && fs.existsSync(csvFilePath)) {
            fs.unlinkSync(csvFilePath);
            console.log('Deleted temporary CSV file:', csvFilePath);
        }
    }
});

// @desc    Upload scan (image/pdf) to create questions
// @route   POST /api/teachers/questions/upload-scan
// @access  Private (Teachers only)
router.post('/questions/upload-csv-v2', authenticate, uploadScan.single('scan'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'Please upload an image or PDF file named "scan"' });
    }

    console.log("Uploaded file details:", req.file);

    const filePath = req.file.path;

    try {
        let extractedText = '';
        if (isImageOrPdfFile(req.file)) {
            extractedText = await extractTextFromScannedPDF(filePath);
        } else {
            return res.status(400).json({ message: 'Invalid file format. Only images or PDFs are allowed.' });
        }

        if (extractedText.trim() === '') {
            return res.status(400).json({ message: 'Extracted text is empty. Please try again with a different file or use OCR.' });
        }

        // Process the extracted text
        const questions = [];
        const lines = extractedText.trim().split('\n');

        // 2.1 Parse the header row to get column names
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/^"|"$/g, '')); // to lower case and remove quotes for consistency

        // 2.2 Define the expected columns and their corresponding properties
        const expectedColumns = {
            'subject': 'subject',
            'question text': 'questionText',
            'question type': 'questionType',
            'option 1': 'option1',
            'option 2': 'option2',
            'option 3': 'option3',
            'option 4': 'option4',
            'option 5': 'option5', //make it dynamic
            'correct answer': 'correctAnswer',
            'answer explanation': 'answerExplanation',
            'time in seconds': 'timeInSeconds',
            'image link': 'imageLink',
            'is active': 'isActive'
        };

        // Parse each line of the extracted text, handling potential errors
        for (let i = 0; i < lines.length; i++) {
            try {
                const line = lines[i].trim();
                if (!line) continue; // Skip empty lines

                const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, '')); // Remove quotes

                //check if number of values matches the number of headers
                if (values.length !== headers.length) {
                    console.warn(`Skipping line ${i + 1}: Number of values does not match number of headers`);
                    continue;
                }
                const questionData = {}; // Use 'any' to avoid TypeScript errors

                // Iterate through the values and assign them to the corresponding properties based on the headers
                for (let j = 0; j < headers.length; j++) {
                    const header = headers[j];
                    const value = values[j];

                    if (expectedColumns[header]) {
                        if (header === 'is active') {
                            questionData[expectedColumns[header]] = value === 'TRUE';
                        } else if (header === 'timeinseconds') {
                            questionData[expectedColumns[header]] = parseInt(value, 10) || 60;
                        }
                        else {
                            questionData[expectedColumns[header]] = value;
                        }
                    }
                    // Handle additional options dynamically
                    else if (header.startsWith('option ')) {
                        if (!questionData.options) {
                            questionData.options = [];
                        }
                        questionData.options.push(value);
                    }
                }

                // Basic validation: Check for the required fields
                if (!questionData.questionText || !questionData.correctAnswer) {
                    console.warn(`Skipping line ${i + 1}: Missing required fields (questionText, correctAnswer)`);
                    continue; // Skip malformed lines
                }
                const finalOptions = [];
                for (let k = 1; k <= 5; k++) {
                    const optionKey = `option${k}`;
                    if (questionData[optionKey]) {
                        finalOptions.push(questionData[optionKey])
                    }
                }
                questions.push({
                    isActive: questionData.isActive,
                    subject: questionData.subject,
                    questionText: questionData.questionText,
                    questionType: questionData.questionType,
                    options: finalOptions, // Ensure options is always an array
                    correctAnswer: questionData.correctAnswer,
                    answerExplanation: questionData.answerExplanation || '',
                    timeInSeconds: questionData.timeInSeconds || 60,
                    imageLink: questionData.imageLink || '',
                    createdBy: req.user.id, // Assuming you have user info in req.user
                });
            } catch (e) {
                console.error(`Error parsing line ${i + 1}:`, e.message);
                // Consider if you want to stop processing or continue with other lines
                //  For now, we continue to the next line.
            }
        }

        if (questions.length === 0) {
            return res.status(400).json({ message: 'No valid questions found in the extracted text' });
        }

        // 3. Create questions in the database
        const createdQuestions = await QuestionModel.insertMany(questions);
        const uploadDir = path.join(__dirname, '../uploads');
        fs.readdir(uploadDir, (err, files) => {
            if (err) {
                console.error('Error reading uploads directory:', err);
                // Optionally, handle the error (e.g., send an error response)
                return;
            }
            for (const file of files) {
                fs.unlink(path.join(uploadDir, file), (err) => {
                    if (err) {
                        console.error(`Error deleting file ${file}:`, err);
                        // Optionally, handle the error for each file deletion
                    }
                });
            }
            console.log('Uploads directory cleared successfully.');
        });
        res.status(201).json({
            message: 'Questions uploaded successfully',
            count: createdQuestions.length,
            data: createdQuestions,
        });
    } catch (error) {
        // Handle any errors that occurred during text processing, database operations, etc.
        console.error("Error processing text:", error);
        res.status(500).json({ message: 'Failed to upload questions', error: error.message });
    } finally {
        // Clean up: Delete the temporary file (if created)
        if (isImageOrPdfFile(req.file) && fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log('Deleted temporary file:', filePath);
        }
    }
});

const requireTeacher = (req, res, next) => {
    if (req.user && req.user.role === 'teacher') {
        next();
    } else {
        return res.status(403).json({ message: 'Unauthorized: Teacher role required' });
    }
};


// Enrollment routes
router.get('/enrolled-students', authenticate, enrollmentController.getEnrolledStudents);
router.post('/enroll-students', authenticate, enrollmentController.enrollStudents);
router.post('/remove-students', authenticate, enrollmentController.removeEnrolledStudents);

// Apply authentication middleware to all teacher routes
router.use(authMiddleware.authenticate);
router.use(requireTeacher);

router.get('/questionsImported', questionController.getAllQuestionsImported);
router.get('/questionsImportedNew', questionController.getStatusQuestionsImported);
module.exports = router;
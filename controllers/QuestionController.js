// const Question = require('../models/Question');
const QuestionModel = require('../models/QuestionModel');
const Tesseract = require('tesseract.js');
const pdfParse = require('pdf-parse');
const fs = require('fs');
const path = require('path');
const OpenAI = require("openai");
const client = new OpenAI({ apiKey: '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'});
const { GoogleGenAI, createUserContent, createPartFromUri } = require("@google/genai");
const ai = new GoogleGenAI({ apiKey: process.env.GENAI_KEY});
// const multer = require('multer');
// @desc    Get all questions created by the logged-in teacher
// @route   GET /api/teachers/questions
// @access  Private (Teachers only)
exports.getAllQuestions = async (req, res) => {
    try {
        const questions = await QuestionModel.find({ createdBy: req.user.id });
        res.status(200).json(questions);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to fetch questions' });
    }
};

exports.getAllQuestionsImported = async (req, res) => {
    try {
        // Find all questions created by the logged-in teacher
        const filter = { createdBy: req.user.id };
        const questions = await QuestionModel.find(filter);
        res.status(200).json(questions);
    } catch (error) {
        console.error('Error fetching questions:', error);
        res.status(500).json({ message: 'Error fetching questions' });
    }
};
exports.getStatusQuestionsImported = async (req, res) => {
    try {
        const { subject, isActive } = req.query;
        const filter = { createdBy: req.user.id };

        if (subject) {
            filter.subject = subject;
        }

        if (isActive) {
            const isActiveBool = isActive.toLowerCase() === 'yes' || isActive.toLowerCase() === 'true';
            filter.isActive = isActiveBool;
        }
        const questions = await QuestionModel.find(filter);
        res.status(200).json(questions);
    } catch (error) {
        console.error('Error fetching questions:', error);
        res.status(500).json({ message: 'Error fetching questions' });
    }
};

// @desc    Add a new question
// @route   POST /api/teachers/questions
// @access  Private (Teachers only)
exports.addQuestion = async (req, res) => {
    try {
        const { questionText, questionType, options, correctAnswer, timeLimit, imageLink, answerExplanation, subject, isActive } = req.body;
        const newQuestion = new QuestionModel({
            createdBy: req.user.id,
            questionText, questionType, options, correctAnswer, timeLimit, imageLink, answerExplanation, subject, isActive
        });
        const savedQuestion = await newQuestion.save();
        res.status(201).json(savedQuestion);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to add question' });
    }
};

exports.addScannedQuestion = async (req, res) => {
    try {
        console.log("inside addScannedQuestions");
        
        const questionsData = req.body; //  Now, req.body is an array of question objects

        if (!Array.isArray(questionsData)) {
            return res.status(400).json({ message: 'Expected an array of questions in the request body' });
        }

        const savedQuestions = [];

        for (const questionData of questionsData) {
            const { questionText, options, correctAnswer } = questionData;

            const newQuestion = new QuestionModel({
                createdBy: req.user.id,
                questionText,
                options,
                correctAnswer,
            });

            const savedQuestion = await newQuestion.save();
            savedQuestions.push(savedQuestion); //  Collect the saved questions
        }

        res.status(201).json(savedQuestions); //  Send back the array of saved questions

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to add questions' });
    }
};

// @desc    Get a specific question by ID
// @route   GET /api/teachers/questions/:id
// @access  Private (Teachers only)
exports.getQuestionById = async (req, res) => {
    try {
        const question = await QuestionModel.findOne({ _id: req.params.id, createdBy: req.user.id });
        if (!question) {
            return res.status(404).json({ message: 'Question not found' });
        }
        res.status(200).json(question);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to fetch question' });
    }
};
async function addScannedQuestions(questionsData, userId) {
    try {
        if (!Array.isArray(questionsData)) {
            throw new Error('Expected an array of questionsData');
        }

        if (!userId) {
            throw new Error('userId is required');
        }

        // Prepare the array of question documents to insert
        const questionsToInsert = questionsData.map(questionData => ({
            createdBy: userId,
            questionText: questionData.questionText,
            options: questionData.options,
            correctAnswer: questionData.correctAnswer,
            // Add other fields as needed
        }));

        // Perform the bulk insert
        const savedQuestions = await QuestionModel.insertMany(questionsToInsert);

        return savedQuestions;
    } catch (error) {
        console.error("Error adding scanned questions (bulk):", error);
        throw error; // Re-throw the error for the calling code to handle
    }
}

exports.getOpenAi = async (req, res) => {
    
    try {
        // 1. Handle File Upload (PDF)
        if (!req.file) {
            return res.status(400).json({ message: 'Please upload a PDF file' });
        }

        const pdfPath = req.file.path; // Path to the uploaded PDF (set by multer)
        const prompt = `Read the following text from a PDF and extract the questions with their answers, formatting the output as an array of JSON objects that conform to the provided Mongoose schema.  Do not include the schema in your response, only the JSON array.
        The expected output should be an array of JSON objects, like this:
        [
          {
            "questionText": "What is the first question?",
            "questionType": "Multiple Choice",
            "options": ["Option A", "Option B", "Option C"],
            "correctAnswer": ["Option A"],
            "timeLimit": 60,
            "answerExplanation": "Explanation of why Option A is correct.",
            "subject": "Chemistry"
          },
          {
            "questionText": "What is the second question?",
            "questionType": "Short Answer",
            "correctAnswer": ["The answer to the second question."],
             "timeLimit": 30,
            "answerExplanation": "Explanation.",
            "subject": "Physics"
          },
           //  Add more questions as needed
        ]
        
        Ensure that the output is valid JSON.  If a field is not present in the text, omit it from the JSON object.  For example, if the options are not provided, do not include the "options" field.  If the answer explanation is not provided, do not include "answerExplanation".  If the subject is not provided, do not include "subject".
        `;
        const myfile = await ai.files.upload({
            file: pdfPath,
            config: { mimeType: "application/pdf" },
        });
        const result = await ai.models.generateContent({
            model: "gemini-2.0-flash",
            contents: createUserContent([
                createPartFromUri(myfile.uri, myfile.mimeType),
                prompt,
            ]),
        });
        let responseText = "";
        let parsedResponse = "";
        let parsedObject = [];
        if (result && result.candidates && result.candidates.length > 0 && result.candidates[0].content && result.candidates[0].content.parts && result.candidates[0].content.parts.length > 0) {
            responseText = result.candidates[0].content.parts[0].text;
            parsedResponse = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
            parsedObject = JSON.parse(parsedResponse);
        } else {
            console.error("Unexpected Gemini response structure:", result);
            return res.status(500).json({ message: "Unexpected Gemini response structure", geminiResponse: result });
        }

        // console.log("Gemini response text:", parsedObject);
        let uploadedScannedQuestion = [];
        if (!parsedObject) {
            return res.status(404).json({ message: 'No data extracted from PDF' });
        } else {
            uploadedScannedQuestion = await addScannedQuestions(parsedObject, req.user.id)
        }

        if (!uploadedScannedQuestion){
            return res.status(404).json({ message: 'Unable to upload scanned questions' });
        }
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
        res.status(200).json(uploadedScannedQuestion);

    } catch (error) {
        console.error("Error processing PDF and getting response:", error);
        res.status(500).json({ message: 'Failed to process PDF and get response', error: error.message });
    }
};
exports.updateActiveNessOfQuestion = async (req, res) => {
    try {
        const question = await QuestionModel.findOne({ _id: req.params.id, createdBy: req.user.id });
        let updatedQuestion = null;
        if (!question) {
            return res.status(404).json({ message: 'Question not found' });
        } else {
            question.isActive = req.params.value;
            updatedQuestion = await QuestionModel.findByIdAndUpdate({ _id: req.params.id, createdBy: req.user.id }, { question });
        }
        res.status(200).json(updatedQuestion);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to fetch question' });
    }
};

// @desc    Update a specific question by ID
// @route   PUT /api/teachers/questions/:id
// @access  Private (Teachers only)
exports.updateQuestion = async (req, res) => {
    try {
        let { questionText, questionType, options, correctAnswer, timeLimit, imageLink, answerExplanation, subject, isActive } = req.body;
        console.log("questionType -> ", questionType);
        if (questionType.toLowerCase() == "fill-in-the-blank"){
            console.log("inside");
            
            if (options!=null)
                options=[];
        }
        console.log("options -> ", options);
        const updatedQuestion = await QuestionModel.findOneAndUpdate(
            { _id: req.params.id, createdBy: req.user.id },
            { questionText, questionType, options, correctAnswer, timeLimit, imageLink, answerExplanation, subject, isActive},
            { new: true, runValidators: true }
        );
        if (!updatedQuestion) {
            return res.status(404).json({ message: 'Question not found or you are not the creator' });
        }
        res.status(200).json(updatedQuestion);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to update question' });
    }
};

// @desc    Delete a specific question by ID
// @route   DELETE /api/teachers/questions/:id
// @access  Private (Teachers only)
exports.deleteQuestion = async (req, res) => {
    try {
        const deletedQuestion = await QuestionModel.findOneAndDelete({ _id: req.params.id, createdBy: req.user.id });
        if (!deletedQuestion) {
            return res.status(404).json({ message: 'Question not found or you are not the creator' });
        }
        res.status(200).json({ message: 'Question deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to delete question' });
    }
};
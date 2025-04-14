// // backend/server.js
// const express = require('express');
// const mongoose = require('mongoose');
// const cors = require('cors');
// require('dotenv').config();

// const app = express();
// const port = process.env.PORT || 5000;

// app.use(cors());
// app.use(express.json()); // For parsing JSON request bodies

// const uri = process.env.ATLAS_URI; // Your MongoDB connection string from .env
// mongoose.connect(uri) // Remove useNewUrlParser and useUnifiedTopology
//     .then(() => console.log('MongoDB database connection established successfully'))
//     .catch(err => console.log(err));

// app.get('/', (req, res) => {
//     res.send('Backend server is running!');
// });

// app.listen(port, () => {
//     console.log(`Server is running on port: ${port}`);
// });

// backend/server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const questionRoutes = require('./routes/question');
const testRoutes = require('./routes/test');
const attemptRoutes = require('./routes/attempt');
const teacherRoutes = require('./routes/teacherRoutes');
const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const uri = process.env.ATLAS_URI;
mongoose.connect(uri)
    .then(() => console.log('MongoDB database connection established successfully'))
    .catch(err => console.log(err));

// Use the routes with a base path
app.use('/api/auth', authRoutes);
app.use('/api/teachers', questionRoutes);
app.use('/api/teachers', testRoutes);
app.use('/api', attemptRoutes); // Note the /api prefix here
app.use('/api/teachers', teacherRoutes); // Note the /api prefix here


app.get('/', (req, res) => {
    res.send('Backend server is running!');
});

app.listen(port, () => {
    console.log(`Server is running on port: ${port}`);
});
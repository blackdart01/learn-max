const User = require('../models/User');
const Test = require('../models/Test');

// Helper function to sync enrolled students with test permissions
exports.syncEnrolledStudentsWithTests = async (req, res) => {
    try {
        // Get the teacher's enrolled students
        const teacher = await User.findById(req.user.id).populate('enrolledStudents');
        if (!teacher) {
            return res.status(404).json({ message: 'Teacher not found' });
        }

        // Find all enrolled-visibility tests for this teacher
        const tests = await Test.find({
            teacherId: req.user.id,
            visibility: 'enrolled'
        });

        if (tests.length === 0) {
            return res.json({
                message: 'No enrolled-visibility tests found',
                enrolledStudentsCount: teacher.enrolledStudents.length
            });
        }

        // Update each test individually to ensure all are updated
        const updatePromises = tests.map(test =>
            Test.findByIdAndUpdate(
                test._id,
                {
                    $set: {
                        allowedStudentIds: teacher.enrolledStudents.map(student => student._id)
                    }
                },
                { new: true }
            )
        );

        await Promise.all(updatePromises);

        res.json({
            message: 'Successfully synced enrolled students with test permissions',
            enrolledStudentsCount: teacher.enrolledStudents.length,
            updatedTestsCount: tests.length
        });
    } catch (error) {
        console.error('Sync error:', error);
        res.status(500).json({ message: 'Error syncing enrolled students', error: error.message });
    }
};

// Get all enrolled students for a teacher
exports.getEnrolledStudents = async (req, res) => {
    try {
        const teacher = await User.findById(req.user.id)
            .populate('enrolledStudents', 'username role');

        if (!teacher) {
            return res.status(404).json({ message: 'Teacher not found' });
        }

        res.json(teacher.enrolledStudents);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching enrolled students', error: error.message });
    }
};

// Enroll students by username
exports.enrollStudents = async (req, res) => {
    try {
        const { usernames } = req.body;

        if (!Array.isArray(usernames)) {
            return res.status(400).json({ message: 'Usernames must be provided as an array' });
        }

        // Find all students with the provided usernames
        const students = await User.find({
            username: { $in: usernames },
            role: 'student'
        });

        if (students.length === 0) {
            return res.status(404).json({ message: 'No valid students found with the provided usernames' });
        }

        // Get student IDs
        const studentIds = students.map(student => student._id);

        // Update teacher's enrolled students
        const teacher = await User.findById(req.user.id);
        if (!teacher) {
            return res.status(404).json({ message: 'Teacher not found' });
        }

        // Add new students to teacher's enrolledStudents (avoid duplicates)
        teacher.enrolledStudents = [...new Set([...teacher.enrolledStudents, ...studentIds])];
        await teacher.save();

        // Update each student's enrolledTeachers
        await User.updateMany(
            { _id: { $in: studentIds } },
            { $addToSet: { enrolledTeachers: req.user.id } }
        );

        // Find all enrolled-visibility tests for this teacher
        const tests = await Test.find({
            teacherId: req.user.id,
            visibility: 'enrolled'
        });

        // Update each test individually
        const updatePromises = tests.map(test =>
            Test.findByIdAndUpdate(
                test._id,
                {
                    $addToSet: {
                        allowedStudentIds: { $each: studentIds }
                    }
                },
                { new: true }
            )
        );

        await Promise.all(updatePromises);

        res.json({
            message: 'Students enrolled successfully',
            enrolledStudents: await User.find({ _id: { $in: studentIds } }, 'username role'),
            updatedTestsCount: tests.length
        });
    } catch (error) {
        res.status(500).json({ message: 'Error enrolling students', error: error.message });
    }
};

// Remove enrolled students
exports.removeEnrolledStudents = async (req, res) => {
    try {
        const { studentIds } = req.body;

        if (!Array.isArray(studentIds)) {
            return res.status(400).json({ message: 'Student IDs must be provided as an array' });
        }

        // Update teacher's enrolled students
        const teacher = await User.findById(req.user.id);
        if (!teacher) {
            return res.status(404).json({ message: 'Teacher not found' });
        }

        // Remove students from teacher's enrolledStudents
        teacher.enrolledStudents = teacher.enrolledStudents.filter(
            id => !studentIds.includes(id.toString())
        );
        await teacher.save();

        // Remove teacher from students' enrolledTeachers
        await User.updateMany(
            { _id: { $in: studentIds } },
            { $pull: { enrolledTeachers: req.user.id } }
        );

        // Find all enrolled-visibility tests for this teacher
        const tests = await Test.find({
            teacherId: req.user.id,
            visibility: 'enrolled'
        });

        // Update each test individually
        const updatePromises = tests.map(test =>
            Test.findByIdAndUpdate(
                test._id,
                {
                    $pull: {
                        allowedStudentIds: { $in: studentIds }
                    }
                },
                { new: true }
            )
        );

        await Promise.all(updatePromises);

        res.json({
            message: 'Students removed successfully',
            updatedTestsCount: tests.length
        });
    } catch (error) {
        res.status(500).json({ message: 'Error removing students', error: error.message });
    }
}; 
const fs = require('fs');
const path = require('path');
const Student = require('../models/Student');

const PROFILE_PICTURE_PUBLIC_PATH = '/uploads/profile-pictures/';

const populateStudentProfile = (query) => query
    .select('-password')
    .populate('college', 'name code')
    .populate('department', 'name code')
    .populate('assignedHostel', 'name code')
    .populate('assignedRoom', 'roomNumber floor')
    .populate('assignedBunk', 'bunkNumber');

const buildProfilePictureUrl = (req, filename) => `${req.protocol}://${req.get('host')}${PROFILE_PICTURE_PUBLIC_PATH}${filename}`;

const getStoredProfilePicturePath = (pictureUrl) => {
    if (!pictureUrl || typeof pictureUrl !== 'string') {
        return null;
    }

    let pathname = pictureUrl.trim();
    if (!pathname) {
        return null;
    }

    try {
        if (/^https?:\/\//i.test(pathname)) {
            pathname = new URL(pathname).pathname;
        }
    }
    catch {
        return null;
    }

    if (!pathname.startsWith(PROFILE_PICTURE_PUBLIC_PATH)) {
        return null;
    }

    const relativeSegments = pathname
        .replace(/^\/+/, '')
        .split('/')
        .filter(Boolean);

    if (relativeSegments.length === 0) {
        return null;
    }

    return path.join(__dirname, '..', '..', ...relativeSegments);
};

const removeStoredProfilePicture = async (pictureUrl) => {
    const filePath = getStoredProfilePicturePath(pictureUrl);
    if (!filePath) {
        return;
    }

    try {
        await fs.promises.unlink(filePath);
    }
    catch (error) {
        if (error.code !== 'ENOENT') {
            console.error('Failed to remove old profile picture:', error);
        }
    }
};

const updateStudentProfile = async (studentId, updateData) => {
    const hasProfilePictureUpdate = Object.prototype.hasOwnProperty.call(updateData, 'profilePicture');
    const existingStudent = hasProfilePictureUpdate
        ? await Student.findById(studentId).select('profilePicture')
        : null;

    if (hasProfilePictureUpdate && !existingStudent) {
        return null;
    }

    const updatedStudent = await populateStudentProfile(Student.findByIdAndUpdate(studentId, updateData, {
        new: true,
        runValidators: true,
    }));

    if (!updatedStudent) {
        return null;
    }

    if (hasProfilePictureUpdate) {
        const previousPicture = existingStudent?.profilePicture || null;
        const nextPicture = updatedStudent.profilePicture || null;

        if (previousPicture && previousPicture !== nextPicture) {
            await removeStoredProfilePicture(previousPicture);
        }
    }

    return updatedStudent;
};

module.exports = {
    buildProfilePictureUrl,
    populateStudentProfile,
    updateStudentProfile,
};

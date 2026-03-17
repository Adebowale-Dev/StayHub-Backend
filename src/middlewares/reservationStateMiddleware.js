const { reconcileStudentReservationState } = require('../services/reservationCleanupService');

const refreshStudentReservationState = async (req, res, next) => {
    if (req.userRole !== 'student' || !req.user?._id) {
        return next();
    }
    try {
        const refreshedStudent = await reconcileStudentReservationState(req.user);
        if (refreshedStudent) {
            req.user = refreshedStudent;
        }
    }
    catch (error) {
        console.error('Failed to refresh student reservation state:', error);
    }
    next();
};

module.exports = {
    refreshStudentReservationState,
};

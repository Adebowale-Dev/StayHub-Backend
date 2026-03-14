const addHours = (date, hours) => {
    const result = new Date(date);
    result.setHours(result.getHours() + hours);
    return result;
};
const addDays = (date, days) => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
};
const isPast = (date) => {
    return new Date(date) < new Date();
};
const isFuture = (date) => {
    return new Date(date) > new Date();
};
const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
};
const formatDateTime = (date) => {
    return new Date(date).toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};
const getHoursDifference = (date1, date2) => {
    const diff = Math.abs(new Date(date2) - new Date(date1));
    return Math.floor(diff / (1000 * 60 * 60));
};
const getDaysDifference = (date1, date2) => {
    const diff = Math.abs(new Date(date2) - new Date(date1));
    return Math.floor(diff / (1000 * 60 * 60 * 24));
};
const isExpired = (expiryDate) => {
    if (!expiryDate)
        return false;
    return new Date() > new Date(expiryDate);
};
const getCurrentAcademicYear = () => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    if (currentMonth >= 8) {
        return `${currentYear}/${currentYear + 1}`;
    }
    else {
        return `${currentYear - 1}/${currentYear}`;
    }
};
const getCurrentSemester = () => {
    const now = new Date();
    const month = now.getMonth();
    if (month >= 8 || month <= 0) {
        return 'First';
    }
    else {
        return 'Second';
    }
};
module.exports = {
    addHours,
    addDays,
    isPast,
    isFuture,
    formatDate,
    formatDateTime,
    getHoursDifference,
    getDaysDifference,
    isExpired,
    getCurrentAcademicYear,
    getCurrentSemester,
};

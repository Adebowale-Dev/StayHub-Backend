const mongoose = require('mongoose');
const College = require('../models/College');
const Department = require('../models/Department');
const { generateDefaultPassword } = require('./passwordUtils');

const ALLOWED_LEVELS = new Set([100, 200, 300, 400, 500, 600]);
const ALLOWED_GENDERS = new Set(['male', 'female']);

const STUDENT_IMPORT_TEMPLATE_HEADERS = [
    'firstName',
    'lastName',
    'matricNo',
    'email',
    'level',
    'gender',
    'collegeCode',
    'departmentCode',
    'password',
];

const STUDENT_IMPORT_TEMPLATE_ROWS = [
    {
        firstName: 'John',
        lastName: 'Doe',
        matricNo: 'STU20240001',
        email: 'john.doe@example.edu',
        level: 100,
        gender: 'male',
        collegeCode: 'REPLACE_WITH_COLLEGE_CODE',
        departmentCode: 'REPLACE_WITH_DEPARTMENT_CODE',
        password: '',
    },
];

const normalizeCell = (value) => String(value ?? '').trim();

const escapeCsvValue = (value) => {
    const stringValue = String(value ?? '');
    return `"${stringValue.replace(/"/g, '""')}"`;
};

const buildCsv = (headers, rows) => [
    headers.map(escapeCsvValue).join(','),
    ...rows.map((row) => headers.map((header) => escapeCsvValue(row[header] ?? '')).join(',')),
].join('\n');

const buildStudentImportTemplateCsv = () => buildCsv(
    STUDENT_IMPORT_TEMPLATE_HEADERS,
    STUDENT_IMPORT_TEMPLATE_ROWS,
);

const resolveCollegeForImport = async (row) => {
    const rawCollegeId = normalizeCell(row.collegeId || row.college);
    const collegeCode = normalizeCell(row.collegeCode).toUpperCase();
    const collegeName = normalizeCell(row.collegeName);

    if (rawCollegeId && mongoose.Types.ObjectId.isValid(rawCollegeId)) {
        const college = await College.findOne({ _id: rawCollegeId, isActive: true });
        if (!college) {
            throw new Error('College ID does not match an active college');
        }
        return college;
    }

    if (collegeCode) {
        const college = await College.findOne({ code: collegeCode, isActive: true });
        if (!college) {
            throw new Error(`College code "${collegeCode}" was not found`);
        }
        return college;
    }

    if (collegeName) {
        const college = await College.findOne({ name: collegeName, isActive: true });
        if (!college) {
            throw new Error(`College name "${collegeName}" was not found`);
        }
        return college;
    }

    throw new Error('College is required. Use collegeCode, collegeName, collegeId, or college');
};

const resolveDepartmentForImport = async (row, collegeId) => {
    const rawDepartmentId = normalizeCell(row.departmentId || row.department);
    const departmentCode = normalizeCell(row.departmentCode).toUpperCase();
    const departmentName = normalizeCell(row.departmentName);

    if (rawDepartmentId && mongoose.Types.ObjectId.isValid(rawDepartmentId)) {
        const department = await Department.findOne({
            _id: rawDepartmentId,
            college: collegeId,
            isActive: true,
        });

        if (!department) {
            throw new Error('Department ID does not match an active department in the selected college');
        }

        return department;
    }

    if (departmentCode) {
        const department = await Department.findOne({
            code: departmentCode,
            college: collegeId,
            isActive: true,
        });
        if (!department) {
            throw new Error(`Department code "${departmentCode}" was not found in the selected college`);
        }
        return department;
    }

    if (departmentName) {
        const department = await Department.findOne({
            name: departmentName,
            college: collegeId,
            isActive: true,
        });
        if (!department) {
            throw new Error(`Department name "${departmentName}" was not found in the selected college`);
        }
        return department;
    }

    throw new Error('Department is required. Use departmentCode, departmentName, departmentId, or department');
};

const parseStudentImportRow = async (row) => {
    const firstName = normalizeCell(row.firstName);
    const lastName = normalizeCell(row.lastName);
    const matricNo = normalizeCell(row.matricNo).toUpperCase();
    const email = normalizeCell(row.email).toLowerCase();
    const level = Number.parseInt(normalizeCell(row.level), 10);
    const gender = (normalizeCell(row.gender) || 'male').toLowerCase();
    const password = normalizeCell(row.password) || generateDefaultPassword(firstName || 'Student');

    if (!firstName) {
        throw new Error('First name is required');
    }

    if (!lastName) {
        throw new Error('Last name is required');
    }

    if (!matricNo) {
        throw new Error('Matric number is required');
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new Error('A valid email is required');
    }

    if (!ALLOWED_LEVELS.has(level)) {
        throw new Error('Level must be one of 100, 200, 300, 400, 500, or 600');
    }

    if (!ALLOWED_GENDERS.has(gender)) {
        throw new Error('Gender must be either male or female');
    }

    const college = await resolveCollegeForImport(row);
    const department = await resolveDepartmentForImport(row, college._id);

    return {
        firstName,
        lastName,
        matricNo,
        email,
        level,
        gender,
        college: college._id,
        department: department._id,
        password,
    };
};

const formatStudentImportError = (error) => {
    if (!error) {
        return 'Unknown import error';
    }

    if (error.code === 11000) {
        if (error.keyPattern?.matricNo) {
            return 'Matric number already exists';
        }

        if (error.keyPattern?.email) {
            return 'Email already exists';
        }

        if (error.keyPattern?.paymentCode) {
            return 'Generated payment code already exists. Please retry the import';
        }

        return 'A unique field already exists';
    }

    return error.message || 'Unknown import error';
};

module.exports = {
    buildStudentImportTemplateCsv,
    formatStudentImportError,
    parseStudentImportRow,
    STUDENT_IMPORT_TEMPLATE_HEADERS,
};

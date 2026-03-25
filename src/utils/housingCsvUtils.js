const mongoose = require('mongoose');
const Hostel = require('../models/Hostel');
const Room = require('../models/Room');

const ALLOWED_LEVELS = new Set([100, 200, 300, 400, 500]);
const ALLOWED_HOSTEL_GENDERS = new Set(['male', 'female', 'mixed']);
const TRUE_VALUES = new Set(['true', '1', 'yes', 'y']);
const FALSE_VALUES = new Set(['false', '0', 'no', 'n']);

const HOSTEL_IMPORT_TEMPLATE_HEADERS = [
    'name',
    'level',
    'gender',
    'totalRooms',
    'autoCreateRooms',
    'bedsPerRoom',
    'floorsCount',
    'description',
    'isActive',
];

const ROOM_IMPORT_TEMPLATE_HEADERS = [
    'roomNumber',
    'hostelName',
    'level',
    'capacity',
    'floor',
];

const HOSTEL_IMPORT_TEMPLATE_ROWS = [
    {
        name: 'John Hostel',
        level: 400,
        gender: 'male',
        totalRooms: 24,
        autoCreateRooms: 'true',
        bedsPerRoom: 4,
        floorsCount: 3,
        description: 'Main male hostel for 400 level students',
        isActive: 'true',
    },
];

const ROOM_IMPORT_TEMPLATE_ROWS = [
    {
        roomNumber: 'A101',
        hostelName: 'John Hostel',
        level: 400,
        capacity: 4,
        floor: 1,
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

const parseBooleanCell = (value, defaultValue = false) => {
    const normalized = normalizeCell(value).toLowerCase();

    if (!normalized) {
        return defaultValue;
    }

    if (TRUE_VALUES.has(normalized)) {
        return true;
    }

    if (FALSE_VALUES.has(normalized)) {
        return false;
    }

    throw new Error(`Invalid boolean value "${value}"`);
};

const buildHostelImportTemplateCsv = () => buildCsv(
    HOSTEL_IMPORT_TEMPLATE_HEADERS,
    HOSTEL_IMPORT_TEMPLATE_ROWS,
);

const buildRoomImportTemplateCsv = () => buildCsv(
    ROOM_IMPORT_TEMPLATE_HEADERS,
    ROOM_IMPORT_TEMPLATE_ROWS,
);

const parseImportError = (error, duplicateMessages = {}) => {
    if (!error) {
        return 'Unknown import error';
    }

    if (error.code === 11000) {
        const duplicateField = Object.keys(error.keyPattern || {})[0];
        return duplicateMessages[duplicateField] || 'A unique field already exists';
    }

    return error.message || 'Unknown import error';
};

const parseHostelImportRow = async (row) => {
    const name = normalizeCell(row.name);
    const level = Number.parseInt(normalizeCell(row.level), 10);
    const gender = normalizeCell(row.gender).toLowerCase();
    const totalRooms = Number.parseInt(normalizeCell(row.totalRooms), 10);
    const autoCreateRooms = parseBooleanCell(row.autoCreateRooms, false);
    const bedsPerRoom = Number.parseInt(normalizeCell(row.bedsPerRoom), 10);
    const floorsCount = Number.parseInt(normalizeCell(row.floorsCount), 10);
    const description = normalizeCell(row.description);
    const isActive = parseBooleanCell(row.isActive, true);

    if (!name) {
        throw new Error('Hostel name is required');
    }

    if (!ALLOWED_LEVELS.has(level)) {
        throw new Error('Level must be one of 100, 200, 300, 400, or 500');
    }

    if (!ALLOWED_HOSTEL_GENDERS.has(gender)) {
        throw new Error('Gender must be male, female, or mixed');
    }

    if (!Number.isInteger(totalRooms) || totalRooms < 1) {
        throw new Error('Total rooms must be at least 1');
    }

    const existingHostel = await Hostel.findOne({ name });
    if (existingHostel) {
        throw new Error('Hostel name already exists');
    }

    if (autoCreateRooms) {
        if (!Number.isInteger(bedsPerRoom) || bedsPerRoom < 2) {
            throw new Error('Beds per room must be at least 2 when autoCreateRooms is true');
        }

        if (!Number.isInteger(floorsCount) || floorsCount < 1) {
            throw new Error('Floors count must be at least 1 when autoCreateRooms is true');
        }
    }

    return {
        name,
        level,
        gender,
        totalRooms,
        autoCreateRooms,
        bedsPerRoom: autoCreateRooms ? bedsPerRoom : undefined,
        floorsCount: autoCreateRooms ? floorsCount : undefined,
        description: description || undefined,
        isActive,
    };
};

const resolveHostelForRoomImport = async (row) => {
    const rawHostel = normalizeCell(row.hostelId || row.hostel);
    const hostelName = normalizeCell(row.hostelName);

    if (rawHostel && mongoose.Types.ObjectId.isValid(rawHostel)) {
        const hostelById = await Hostel.findOne({ _id: rawHostel, isActive: true });
        if (!hostelById) {
            throw new Error('Hostel ID does not match an active hostel');
        }
        return hostelById;
    }

    const resolvedHostelName = hostelName || rawHostel;
    if (!resolvedHostelName) {
        throw new Error('Hostel is required. Use hostelName, hostelId, or hostel');
    }

    const hostelsByName = await Hostel.find({ name: resolvedHostelName, isActive: true }).limit(2);
    if (hostelsByName.length === 0) {
        throw new Error(`Hostel "${resolvedHostelName}" was not found`);
    }

    if (hostelsByName.length > 1) {
        throw new Error(`Hostel name "${resolvedHostelName}" is ambiguous. Use hostelId instead`);
    }

    return hostelsByName[0];
};

const parseRoomImportRow = async (row) => {
    const roomNumber = normalizeCell(row.roomNumber);
    const capacity = Number.parseInt(normalizeCell(row.capacity), 10);
    const level = Number.parseInt(normalizeCell(row.level), 10);
    const rawFloor = normalizeCell(row.floor);
    const floor = rawFloor ? Number.parseInt(rawFloor, 10) : undefined;

    if (!roomNumber) {
        throw new Error('Room number is required');
    }

    if (!Number.isInteger(capacity) || capacity < 2) {
        throw new Error('Capacity must be at least 2');
    }

    if (!ALLOWED_LEVELS.has(level)) {
        throw new Error('Level must be one of 100, 200, 300, 400, or 500');
    }

    if (rawFloor && (!Number.isInteger(floor) || floor < 0)) {
        throw new Error('Floor cannot be negative');
    }

    const hostel = await resolveHostelForRoomImport(row);
    const existingRoom = await Room.findOne({ roomNumber, hostel: hostel._id });
    if (existingRoom) {
        throw new Error('Room number already exists in the selected hostel');
    }

    return {
        roomNumber,
        capacity,
        level,
        floor,
        hostel: hostel._id,
    };
};

module.exports = {
    buildHostelImportTemplateCsv,
    buildRoomImportTemplateCsv,
    parseHostelImportRow,
    parseRoomImportRow,
    parseImportError,
};

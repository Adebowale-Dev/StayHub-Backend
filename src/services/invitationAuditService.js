const Student = require('../models/Student');
const getEntityId = (entity) => entity?._id || entity || null;
const buildSnapshot = ({ room, hostel, bunk }) => ({
    hostel: getEntityId(hostel),
    hostelName: hostel?.name || undefined,
    room: getEntityId(room),
    roomNumber: room?.roomNumber || room?.number || undefined,
    bunk: getEntityId(bunk),
    bunkNumber: bunk?.bunkNumber != null
        ? String(bunk.bunkNumber)
        : bunk?.number != null
            ? String(bunk.number)
            : undefined,
});
const buildEntry = ({ action, role, actor, relatedStudent, room, hostel, bunk, notes, createdAt = new Date(), }) => ({
    action,
    role,
    actor: getEntityId(actor),
    relatedStudent: getEntityId(relatedStudent),
    ...buildSnapshot({ room, hostel, bunk }),
    notes,
    createdAt,
});
const appendInvitationHistory = async (studentId, entry) => {
    if (!studentId)
        return;
    await Student.findByIdAndUpdate(studentId, {
        $push: {
            invitationHistory: {
                $each: [entry],
                $slice: -25,
            },
        },
    });
};
const logInvitationCreated = async ({ invitee, inviter, room, hostel, bunk, notes = 'Room invitation created', }) => {
    const inviteeId = getEntityId(invitee);
    const inviterId = getEntityId(inviter);
    if (!inviteeId || !inviterId || String(inviteeId) === String(inviterId)) {
        return;
    }
    const createdAt = new Date();
    await Promise.all([
        appendInvitationHistory(inviteeId, buildEntry({
            action: 'invited',
            role: 'invitee',
            actor: inviterId,
            relatedStudent: inviterId,
            room,
            hostel,
            bunk,
            notes,
            createdAt,
        })),
        appendInvitationHistory(inviterId, buildEntry({
            action: 'invited',
            role: 'inviter',
            actor: inviterId,
            relatedStudent: inviteeId,
            room,
            hostel,
            bunk,
            notes,
            createdAt,
        })),
    ]);
};
const logInvitationOutcome = async ({ invitee, inviter, actor, action, room, hostel, bunk, notes, }) => {
    const inviteeId = getEntityId(invitee);
    const inviterId = getEntityId(inviter);
    const actorId = getEntityId(actor);
    if (!inviteeId || !inviterId || !['viewed', 'approved', 'rejected', 'expired'].includes(action)) {
        return;
    }
    const createdAt = new Date();
    await Promise.all([
        appendInvitationHistory(inviteeId, buildEntry({
            action,
            role: 'invitee',
            actor: actorId || inviteeId,
            relatedStudent: inviterId,
            room,
            hostel,
            bunk,
            notes,
            createdAt,
        })),
        appendInvitationHistory(inviterId, buildEntry({
            action,
            role: 'inviter',
            actor: actorId || inviteeId,
            relatedStudent: inviteeId,
            room,
            hostel,
            bunk,
            notes,
            createdAt,
        })),
    ]);
};
module.exports = {
    logInvitationCreated,
    logInvitationOutcome,
};

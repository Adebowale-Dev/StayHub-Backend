const Room = require('../models/Room');
const Bunk = require('../models/Bunk');

const normalizeCapacity = (value) => {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? Math.max(0, numericValue) : 0;
};

const getBunkSequence = (bunkOrNumber) => {
    const bunkNumber = typeof bunkOrNumber === 'string'
        ? bunkOrNumber
        : bunkOrNumber?.bunkNumber;
    const match = String(bunkNumber || '').match(/(\d+)/);
    return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
};

const compareBunksBySequence = (left, right) => {
    const sequenceDifference = getBunkSequence(left) - getBunkSequence(right);
    if (sequenceDifference !== 0) {
        return sequenceDifference;
    }
    return String(left?.bunkNumber || '').localeCompare(String(right?.bunkNumber || ''));
};

const sortBunksBySequence = (bunks = []) => [...bunks].sort(compareBunksBySequence);

const syncRoomBunksToCapacity = async (roomInput, options = {}) => {
    const room = roomInput?._id
        ? roomInput
        : await Room.findById(roomInput).select('_id capacity');

    if (!room) {
        throw new Error('Room not found');
    }

    const targetCapacity = normalizeCapacity(options.capacity ?? room.capacity);

    if (targetCapacity > 0) {
        const upsertOperations = [];

        for (let index = 1; index <= targetCapacity; index += 1) {
            upsertOperations.push({
                updateOne: {
                    filter: {
                        room: room._id,
                        bunkNumber: `B${index}`,
                    },
                    update: {
                        $setOnInsert: {
                            room: room._id,
                            bunkNumber: `B${index}`,
                        },
                        $set: {
                            isActive: true,
                        },
                    },
                    upsert: true,
                },
            });
        }

        if (upsertOperations.length > 0) {
            await Bunk.bulkWrite(upsertOperations, { ordered: false });
        }
    }

    let bunks = await Bunk.find({ room: room._id });
    const extraBunks = bunks.filter((bunk) => getBunkSequence(bunk) > targetCapacity);
    const blockingExtraBunks = extraBunks.filter((bunk) => bunk.isActive && (bunk.status !== 'available' || bunk.occupiedByStudent || bunk.reservedUntil));

    if (blockingExtraBunks.length > 0 && options.failOnBlockingExtraBunks !== false) {
        const bunkLabels = sortBunksBySequence(blockingExtraBunks).map((bunk) => bunk.bunkNumber).join(', ');
        throw new Error(`Cannot reduce room capacity while bunks ${bunkLabels} are assigned or reserved`);
    }

    const bunksToDeactivate = extraBunks
        .filter((bunk) => bunk.isActive && bunk.status === 'available' && !bunk.occupiedByStudent && !bunk.reservedUntil)
        .map((bunk) => bunk._id);

    if (bunksToDeactivate.length > 0) {
        await Bunk.updateMany({
            _id: { $in: bunksToDeactivate },
        }, {
            $set: {
                isActive: false,
            },
        });

        bunks = await Bunk.find({ room: room._id });
    }

    const sortedBunks = sortBunksBySequence(bunks);
    const activeBunks = sortedBunks.filter((bunk) => bunk.isActive);
    const availableBunks = activeBunks.filter((bunk) => bunk.status === 'available');
    const occupiedOrReservedBunks = activeBunks.filter((bunk) => bunk.status === 'occupied' || bunk.status === 'reserved');

    return {
        roomId: room._id,
        capacity: targetCapacity,
        bunks: sortedBunks,
        activeBunks,
        availableBunks,
        occupiedOrReservedBunks,
        blockingExtraBunks: sortBunksBySequence(blockingExtraBunks),
    };
};

module.exports = {
    getBunkSequence,
    sortBunksBySequence,
    syncRoomBunksToCapacity,
};

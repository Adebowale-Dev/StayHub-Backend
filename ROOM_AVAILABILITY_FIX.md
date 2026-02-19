# Room Availability Issue - Fix Documentation

## 🐛 Problem
The mobile app was showing rooms as "full" or "occupied" even though the rooms had available bunks.

## 🔍 Root Cause
The `Room.status` field in the database was not being updated correctly when bunks were reserved/occupied. The API was filtering rooms by status:

```javascript
// OLD CODE - PROBLEMATIC
const rooms = await Room.find({
  hostel: hostelId,
  isActive: true,
  status: { $in: ['available', 'partially_occupied'] }, // ❌ Excluded rooms with wrong status
})
```

If a room had `status: 'full'` but actually had available bunks, it wouldn't appear in the API response at all.

## ✅ Solution
**Updated the `getAvailableRooms` endpoint** to:
1. **Remove the status filter** - Get ALL active rooms regardless of status field
2. **Calculate real-time availability** from the actual bunks
3. **Return accurate availability data** to the mobile app

### Code Changes

**File:** `src/controllers/studentController.js`

```javascript
// NEW CODE - FIXED
exports.getAvailableRooms = async (req, res) => {
  try {
    const { hostelId } = req.params;
    
    // Get ALL active rooms, don't filter by status field
    // We'll calculate real-time availability from bunks instead
    const rooms = await Room.find({
      hostel: hostelId,
      isActive: true, // ✅ Only filter by isActive
    })
      .populate('bunks')
      .lean();

    // Calculate real-time availability from bunks
    const roomsWithAvailability = rooms.map(room => {
      const availableBunks = room.bunks?.filter(
        bunk => bunk.status === 'available' && bunk.isActive
      ).length || 0;
      
      const currentOccupants = room.bunks?.filter(
        bunk => bunk.status === 'occupied'
      ).length || 0;
      
      const reservedBunks = room.bunks?.filter(
        bunk => bunk.status === 'reserved'
      ).length || 0;
      
      return {
        ...room,
        availableSpaces: availableBunks,      // ✅ Real-time count
        currentOccupants: currentOccupants,    // ✅ Real-time count
        reservedSpaces: reservedBunks,         // ✅ Real-time count
        isAvailable: availableBunks > 0        // ✅ True if ANY bunks available
      };
    });

    res.status(200).json({
      success: true,
      data: roomsWithAvailability,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
```

## 📱 Mobile App Integration

### How to Use the Fixed API

**Endpoint:** `GET /api/student/hostels/{hostelId}/rooms`

**Response Structure:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "room_id",
      "roomNumber": "101",
      "capacity": 4,
      "status": "full",              // ⚠️ Ignore this field (may be outdated)
      "availableSpaces": 2,          // ✅ Use this instead
      "currentOccupants": 1,         // ✅ Currently occupied bunks
      "reservedSpaces": 1,           // ✅ Reserved but not occupied
      "isAvailable": true            // ✅ Use this to enable/disable booking
    }
  ]
}
```

### Mobile App Code Examples

**React Native:**
```javascript
const RoomCard = ({ room }) => {
  // ✅ Use isAvailable field
  const canBook = room.isAvailable;
  
  return (
    <View style={styles.card}>
      <Text>Room {room.roomNumber}</Text>
      <Text>Available: {room.availableSpaces} / {room.capacity}</Text>
      <Text>Occupied: {room.currentOccupants}</Text>
      <Text>Reserved: {room.reservedSpaces}</Text>
      
      <Button 
        title="Book Room"
        disabled={!canBook}  // ✅ Disable if no available spaces
        onPress={() => bookRoom(room._id)}
      />
      
      {!canBook && <Text style={styles.full}>Room Full</Text>}
    </View>
  );
};
```

**Flutter:**
```dart
class RoomCard extends StatelessWidget {
  final Room room;
  
  @override
  Widget build(BuildContext context) {
    // ✅ Use isAvailable field
    final canBook = room.isAvailable;
    
    return Card(
      child: Column(
        children: [
          Text('Room ${room.roomNumber}'),
          Text('Available: ${room.availableSpaces} / ${room.capacity}'),
          Text('Occupied: ${room.currentOccupants}'),
          Text('Reserved: ${room.reservedSpaces}'),
          
          ElevatedButton(
            onPressed: canBook ? () => bookRoom(room.id) : null,
            child: Text('Book Room'),
          ),
          
          if (!canBook)
            Text('Room Full', style: TextStyle(color: Colors.red)),
        ],
      ),
    );
  }
}
```

## 🎯 Key Points

### What Changed
1. ✅ API now returns ALL active rooms (not filtered by status)
2. ✅ Real-time availability calculated from actual bunks
3. ✅ `isAvailable` field tells you if room can be booked
4. ✅ `availableSpaces` shows exact number of available bunks

### What to Do in Mobile App
1. ✅ **Ignore** `room.status` field - it may be outdated
2. ✅ **Use** `room.isAvailable` to enable/disable booking button
3. ✅ **Display** `room.availableSpaces` to show how many bunks are available
4. ✅ **Show** "Room Full" message when `isAvailable === false`

### Example Display Logic
```javascript
// ✅ CORRECT WAY
if (room.isAvailable) {
  // Show "Book Room" button
  // Display: "2 spaces available"
} else {
  // Disable button
  // Display: "Room Full"
}

// ❌ WRONG WAY - Don't do this
if (room.status === 'available') {
  // This field may be outdated!
}
```

## 🔄 Room Status Field (Legacy)

The `Room.status` field is still in the database for historical reasons, but:
- ⚠️ May not be updated in real-time
- ⚠️ Should NOT be used for availability checks
- ✅ Real-time availability comes from bunk counts

### Why Not Delete It?
- Used by admin panel for overview
- Used by porter dashboard
- May be needed for reports/analytics
- Removing it requires database migration

## 🧪 Testing

### Before Fix
```
GET /api/student/hostels/123/rooms

Response: 10 rooms (missing some with outdated status)
Issue: Room 101 has 2 available bunks but not in response
```

### After Fix
```
GET /api/student/hostels/123/rooms

Response: 15 rooms (all active rooms included)
Success: Room 101 shows with availableSpaces: 2, isAvailable: true
```

## 📝 Maintenance Scripts

Created diagnostic scripts to help identify issues:

1. **diagnose-room-status.js** - Finds rooms with incorrect status
2. **fix-room-statuses.js** - Fixes rooms marked as full but have available bunks

Run these periodically if you notice issues:
```bash
node diagnose-room-status.js
node fix-room-statuses.js
```

## 🚀 Deployment Notes

### Backend Changes
- ✅ Updated `src/controllers/studentController.js`
- ✅ Changed `getAvailableRooms` function
- ✅ No database schema changes required
- ✅ Backward compatible with existing mobile app

### Mobile App Updates Needed
If your mobile app was checking `room.status`:
```javascript
// Change this:
if (room.status === 'available' || room.status === 'partially_occupied') {
  // show booking button
}

// To this:
if (room.isAvailable) {
  // show booking button
}
```

## ✅ Verification Checklist

- [x] API returns all active rooms
- [x] `availableSpaces` calculated from bunks
- [x] `isAvailable` field present in response
- [x] Rooms with available bunks show up in API
- [ ] Mobile app updated to use `isAvailable` field
- [ ] Mobile app displays `availableSpaces` count
- [ ] Tested booking flow with real data

## 🆘 Troubleshooting

### Issue: Still seeing wrong availability
**Solution:** Clear mobile app cache and reload data

### Issue: Room shows available but can't book
**Check:** 
1. Is payment status = 'paid'?
2. Is bunk.isActive = true?
3. Check server logs for actual error

### Issue: Numbers don't match capacity
**Explanation:** 
- Some bunks may not exist yet (capacity 4, only 2 bunks created)
- Run `fix-room-bunks.js` to create missing bunks

---

**Fixed Date:** December 16, 2025  
**Affected Endpoint:** `GET /api/student/hostels/:hostelId/rooms`  
**Breaking Changes:** None (backward compatible)

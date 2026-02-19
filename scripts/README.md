# Database Scripts

Utility scripts for managing StayHub database operations.

## updateRoomNumbers.js

Updates room numbering to sequential format (01, 02, 03, etc.) with automatic floor calculation.

### Usage

```bash
# Update rooms for "John Hostel" (default)
node scripts/updateRoomNumbers.js

# Update rooms for a specific hostel
node scripts/updateRoomNumbers.js "Mary Hostel"
```

### What it does

- Finds the specified hostel
- Gets all rooms sorted by floor and room number
- Renumbers them sequentially: 01, 02, 03, etc.
- Assigns floors automatically (15 rooms per floor):
  - Rooms 01-15: Floor 1
  - Rooms 16-30: Floor 2
  - Rooms 31-45: Floor 3
  - Rooms 46-60: Floor 4
  - And so on...

### Before running

Make sure you have:
1. `.env` file configured with `MONGODB_URI`
2. Node.js installed
3. All dependencies installed (`npm install`)

### Example output

```
✅ Connected to database
📍 Found hostel: John Hostel (64abc...)
📦 Found 60 rooms to update

  101 → 01 (Floor 1)
  102 → 02 (Floor 1)
  103 → 03 (Floor 1)
  ...
  401 → 46 (Floor 4)
  402 → 47 (Floor 4)

✅ All rooms updated successfully!
📊 Updated 60 rooms

📋 New numbering scheme:
  • Rooms 01-15: Floor 1
  • Rooms 16-30: Floor 2
  • Rooms 31-45: Floor 3
  • Rooms 46-60: Floor 4

🔌 Disconnected from database
```

## Notes

- The script uses bulk operations for better performance
- It automatically calculates floor numbers (15 rooms per floor)
- Original room data is preserved except for `roomNumber` and `floor` fields
- Safe to run multiple times (idempotent)

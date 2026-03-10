# Enhanced Attendance Module - Setup Guide

## Overview

The Attendance module now supports both **web-based** and **native mobile** attendance marking with:

- ✅ Live camera capture with timestamp watermark
- ✅ High-accuracy GPS location tracking
- ✅ Reverse geocoding (City/State display)
- ✅ Permission handling (Camera & Location)
- ✅ Offline mode with automatic sync
- ✅ Photo storage in Supabase Storage
- ✅ Device metadata collection
- ✅ Capacitor integration for native mobile apps

---

## Phase 1: Web-Based (Ready to Use)

The web-based attendance is **already working** and can be used immediately on any device with a browser.

### Features Available in Web Version:
- Live camera preview and capture
- GPS location with accuracy display
- City/State using reverse geocoding
- Offline mode (saves to IndexedDB, syncs when online)
- Photo compression and watermarking
- Permission handling

### How to Use:
1. Navigate to `/attendance` page
2. Click **"Check In with Photo & GPS"**
3. Grant camera and location permissions
4. Wait for GPS lock (5-15 seconds)
5. Capture your photo
6. Review and submit

### Limitations:
- GPS accuracy varies (typically 10-100 meters)
- Cannot prevent gallery uploads (browser limitation)
- Limited offline storage (~50MB)
- No background sync

---

## Phase 2: Native Mobile App (Optional)

For advanced features like high-accuracy GPS, forced live capture, and better performance, set up the native mobile app.

### Additional Features in Native:
- ✅ High-accuracy GPS (<10 meters)
- ✅ Force live capture (prevents gallery uploads)
- ✅ Background sync
- ✅ Better camera control
- ✅ Unlimited offline storage
- ✅ Native permissions UX

---

## Setting Up Native Mobile App

### Prerequisites:
- **For iOS**: Mac with Xcode installed
- **For Android**: Android Studio installed
- Git repository access
- Node.js and npm

### Step 1: Export Project to GitHub
1. Clone your repository locally:
   ```bash
   git clone <your-repo-url>
   cd <your-project>
   ```

### Step 2: Install Dependencies
```bash
npm install
```

### Step 3: Add Native Platforms

#### For Android:
```bash
npx cap add android
npx cap update android
```

#### For iOS (Mac only):
```bash
npx cap add ios
npx cap update ios
```

### Step 4: Configure Permissions

#### Android (`android/app/src/main/AndroidManifest.xml`):
The following permissions are required. Add them inside `<manifest>`:

```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
```

#### iOS (`ios/App/Info.plist`):
Add these keys inside `<dict>`:

```xml
<key>NSCameraUsageDescription</key>
<string>We need camera access to capture your attendance photo</string>
<key>NSLocationWhenInUseUsageDescription</key>
<string>We need your location to verify attendance</string>
<key>NSLocationAlwaysUsageDescription</key>
<string>We need your location to verify attendance</string>
```

### Step 5: Build and Run

#### For Web (Development):
```bash
npm run dev
```

#### For Android:
```bash
npm run build
npx cap sync android
npx cap run android
```

#### For iOS:
```bash
npm run build
npx cap sync ios
npx cap run ios
```

Or open in IDE:
```bash
npx cap open android  # Opens Android Studio
npx cap open ios      # Opens Xcode
```

---

## Architecture

### Web Flow:
```
User → PermissionHandler → LocationCapture → CameraCapture → Review → Submit
  ↓
Browser APIs (getUserMedia, Geolocation)
  ↓
Supabase Storage (photos) + Database (metadata)
```

### Native Flow:
```
User → PermissionHandler → Native Location → Native Camera → Review → Submit
  ↓
Capacitor Plugins (@capacitor/camera, @capacitor/geolocation)
  ↓
Native APIs (High-accuracy GPS, Camera with metadata)
  ↓
Supabase Storage (photos) + Database (metadata)
```

---

## Components

### Core Components:

1. **`PermissionHandler.tsx`**
   - Checks and requests camera/location permissions
   - Shows permission status
   - Handles denied permissions gracefully

2. **`CameraCapture.tsx`**
   - Live camera preview using WebRTC
   - Photo capture with timestamp watermark
   - Image compression (targets 200-500KB)
   - Front/back camera toggle

3. **`LocationCapture.tsx`**
   - GPS coordinates capture
   - Accuracy display
   - Reverse geocoding for City/State
   - Retry mechanism for slow GPS

4. **`AttendanceCapture.tsx`**
   - Orchestrates the entire flow
   - Step-by-step progress UI
   - Review screen before submission
   - Device metadata collection

5. **`useAttendanceCapture.ts`**
   - Hook for capture logic
   - Photo upload to Supabase Storage
   - Offline sync with IndexedDB
   - Network status detection

6. **`nativeAttendance.ts`**
   - Service layer for Capacitor APIs
   - Platform detection (web vs native)
   - High-accuracy GPS
   - Native camera with forced live capture

---

## Database Schema

New columns added to `attendance_records`:

| Column | Type | Description |
|--------|------|-------------|
| `sign_in_photo_url` | TEXT | Photo URL for check-in |
| `sign_out_photo_url` | TEXT | Photo URL for check-out |
| `sign_in_location_accuracy` | NUMERIC | GPS accuracy in meters (check-in) |
| `sign_out_location_accuracy` | NUMERIC | GPS accuracy in meters (check-out) |
| `sign_in_location_city` | TEXT | City name (check-in) |
| `sign_in_location_state` | TEXT | State name (check-in) |
| `sign_out_location_city` | TEXT | City name (check-out) |
| `sign_out_location_state` | TEXT | State name (check-out) |
| `network_status` | TEXT | online/offline |
| `sync_status` | TEXT | synced/pending |

---

## Storage Bucket

**Bucket Name**: `attendance-photos`  
**Public**: No (private with RLS)

### RLS Policies:
- Users can upload their own photos
- Users can view their own photos
- Admins can view all photos

### File Structure:
```
attendance-photos/
  └── {user_id}/
      └── {date}/
          ├── sign_in_{timestamp}.jpg
          └── sign_out_{timestamp}.jpg
```

---

## Offline Mode

### How It Works:
1. When network is offline, attendance data is saved to **IndexedDB**
2. Queue is stored with retry count
3. When network comes back online, automatic sync starts
4. Failed uploads retry with exponential backoff

### IndexedDB Schema:
```javascript
{
  store: 'pending_attendance',
  records: [
    {
      id: uuid,
      photo_blob: Blob,
      location: { lat, lng, accuracy, city, state },
      device_info: { ... },
      created_at: Date,
      retry_count: 0
    }
  ]
}
```

---

## Security

### Photo Security:
- Timestamp watermark on every photo
- Photos compressed to 200-500KB
- Stored with UUID filenames
- RLS policies: users can only access their own photos
- Signed URLs with 1-hour expiration

### Location Security:
- GPS accuracy threshold: < 100 meters recommended
- Reverse geocoding using OpenStreetMap (no API key needed)
- Coordinates stored with 6 decimal precision

### Data Validation:
- Photo must be captured within same minute as submission
- Location accuracy must be within acceptable threshold
- Device info matched against user's typical devices (optional)

---

## Testing

### Web Testing:
- [x] Camera permission denied → clear error message
- [x] Location permission denied → retry option
- [x] Slow GPS lock → progress indicator
- [x] Poor GPS accuracy (>100m) → warning
- [x] Offline mode → saves locally
- [x] Online recovery → auto-syncs
- [x] Multiple browsers (Chrome, Firefox, Safari, Edge)

### Native Testing:
- [ ] Android permissions flow
- [ ] iOS permissions flow
- [ ] High-accuracy GPS
- [ ] Forced live capture
- [ ] Background sync
- [ ] Different Android versions (9-14)
- [ ] Different iOS versions (13-17)

---

## Troubleshooting

### Issue: Camera not working
- **Web**: Check HTTPS (required for camera access)
- **Native**: Verify permissions in `AndroidManifest.xml` or `Info.plist`
- **Both**: Check browser/device camera permissions

### Issue: GPS not locking
- **Web**: Move to area with better GPS signal
- **Native**: Enable high-accuracy location in device settings
- **Both**: Wait 15-30 seconds for initial lock

### Issue: Photos not uploading
- Check Supabase Storage bucket exists: `attendance-photos`
- Verify RLS policies are correct
- Check network connection
- Check console for error messages

### Issue: Offline sync not working
- Check browser storage quota
- Verify IndexedDB is enabled
- Check service worker registration
- Look for sync errors in console

---

## Future Enhancements

### Planned:
- [ ] Face detection validation (ML.js)
- [ ] Geofencing (restrict check-in to office location)
- [ ] Biometric authentication before attendance
- [ ] Push notifications for check-in/out reminders
- [ ] Background location tracking (with user consent)
- [ ] Attendance analytics and reports
- [ ] Manager approval workflow
- [ ] Photo quality validation

---

## Support

For issues or questions:
1. Check console logs for errors
2. Verify permissions are granted
3. Test on different devices/browsers
4. Review Supabase logs in dashboard
5. Check network requests in browser DevTools

---

## Credits

Built with:
- React + TypeScript
- Supabase (Database + Storage)
- Capacitor (Native mobile)
- OpenStreetMap Nominatim (Reverse geocoding)
- WebRTC (Camera access)
- Geolocation API (GPS)

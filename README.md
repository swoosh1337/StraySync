# StraySync

A React Native mobile app that helps users locate and track stray animals in their area. Users can pin the exact location where they spot a stray dog or cat by uploading a photo and marking it on the map. When another user taps the pin, they'll see the cat's photo and get directions to that location.

| ![Map Screen](img1.png) | ![Add Cat](img2.png) | ![Cat Details](img3.png) |

## Features

- **Interactive Map**: View stray animal sightings on a Google Maps-like interface
- **Add Cat Sightings**: Upload photos and mark the exact location of stray animals
- **Animal Details**: View photos, descriptions, and directions to stray animals
- **Proximity Notifications**: Get alerts when you're near a stray animal location
- **Customizable Settings**: Set notification radius and time frame preferences

## Tech Stack

- React Native with Expo
- TypeScript
- Supabase (Backend & Storage)
- React Navigation
- React Native Maps
- Expo Location & Notifications

## Project Structure

- **app/**: Main application code
  - **components/**: Reusable UI components
  - **contexts/**: React context providers
  - **navigation/**: Navigation configuration
  - **screens/**: Application screens
  - **services/**: Service modules for API, storage, location, etc.
  - **types/**: TypeScript type definitions

- **database/**: Database-related files and scripts
  - **schemas/**: SQL schema definitions
  - **migrations/**: SQL migration files
  - **scripts/**: Database setup and maintenance scripts
  - **utils/**: Database utility scripts

- **assets/**: Static assets like images and fonts

## Setup Instructions

### Prerequisites

- Node.js (v14 or newer)
- npm or yarn
- Expo CLI (`npm install -g expo-cli`)
- Supabase account
- iOS device or simulator (for iOS testing)

### Supabase Setup

1. Create a new Supabase project
2. Choose one of the following SQL setup options:

   **Option 1 (Simple Setup - Recommended)**: 
   - Copy the contents of `database/schemas/simple-setup.sql`
   - Run it in the Supabase SQL Editor
   - This creates the basic tables and functions without PostGIS dependencies

   **Option 2 (Advanced Setup - If your Supabase instance supports PostGIS)**:
   - Copy the contents of `database/schemas/direct-setup-fixed.sql`
   - Run it in the Supabase SQL Editor
   - This creates tables with spatial indexing for more efficient location queries

   **Option 3 (Not Recommended)**:
   - Try running the setup script: `npm run setup-db`
   - This may encounter permission issues with your Supabase instance

> **Note**: The app is designed to work with any of these setup options. If PostGIS is not available, the app will automatically fall back to calculating distances on the client side.

### Environment Setup

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Create a `.env` file in the root directory with your Supabase credentials:
   ```
   SUPABASE_URL=your_supabase_url
   SUPABASE_ANON_KEY=your_supabase_anon_key
   EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

### Running the App

1. Start the development server:
   ```
   npm start
   ```
2. Scan the QR code with the Expo Go app on your iOS device, or press 'i' to open in an iOS simulator

## Usage

1. **Map Screen**: View stray animal sightings on the map
2. **Add Cat**: Tap the "+" button to add a new cat sighting
3. **Cat Details**: Tap on a cat marker to view details and get directions
4. **Settings**: Customize notification preferences and app settings

## Troubleshooting

### Database Setup Issues

If you encounter errors with SQL commands:

1. Try the `database/schemas/simple-setup.sql` file which has fewer dependencies
2. Run each SQL command separately in the Supabase SQL Editor
3. Check if your Supabase instance supports the PostGIS extension

### Storage Bucket Issues

If you encounter errors with the storage bucket or image uploads:

1. Run the provided fix script:
   ```
   npm run fix-storage
   ```

2. If that doesn't work, manually fix the storage bucket in the Supabase SQL Editor:
   - Go to the SQL Editor in your Supabase dashboard
   - Run the SQL commands from `database/migrations/fix-storage-policies.sql`

3. Verify the bucket exists in the Storage section of your Supabase dashboard
4. Make sure the bucket is set to public access
5. If you still have issues, try uploading a test file through the Supabase dashboard to verify permissions

### Testing Image Uploads

To verify that image uploads are working correctly:

1. Run the test script:
   ```
   npm run test-upload
   ```

2. This script will:
   - Upload a PNG image to the storage bucket
   - Upload a JPEG image to the storage bucket
   - Upload an image with a user ID in the filename
   - List all files in the bucket
   - Verify that the uploaded images are publicly accessible

3. If all tests pass, your storage bucket is correctly configured for the app

4. If you encounter errors, check the Supabase dashboard for:
   - Storage bucket permissions
   - Row Level Security (RLS) policies
   - Authentication settings

### Row Level Security Issues

If you encounter issues with Row Level Security (RLS) policies:

1. Run the fix script:
   ```
   npm run fix-rls
   ```

2. Or manually apply the SQL commands from `database/migrations/fix-rls-policies.sql`

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details. 

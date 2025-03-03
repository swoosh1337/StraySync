# Database Directory

This directory contains all database-related files and scripts for the Stray Cat Finder application.

## Directory Structure

- **schemas/**: Contains SQL schema definitions for the database
  - `supabase-schema.sql`: Main schema file
  - `simple-setup.sql`: Simplified schema without PostGIS dependencies
  - `direct-setup.sql`: Original direct setup schema
  - `direct-setup-fixed.sql`: Fixed version of the direct setup schema

- **migrations/**: Contains SQL migration files for database changes
  - `fix-storage-policies.sql`: SQL to fix storage bucket policies
  - `fix-rls-policies.sql`: SQL to fix Row Level Security policies
  - `fix-rls-policies-simple.sql`: Simplified version of RLS policies
  - `fix-storage-delete-simple.sql`: SQL to fix storage deletion policies

- **scripts/**: Contains JavaScript scripts for database setup and maintenance
  - `setup-supabase.js`: Main script to set up the Supabase database
  - `fix-storage.js`: Script to fix storage bucket issues
  - `fix-rls.js`: Script to fix Row Level Security issues
  - `test-image-upload.js`: Script to test image uploads to Supabase storage

- **utils/**: Contains utility scripts for database management
  - `delete-file-rest.js`: Utility to delete files using REST API
  - `delete-file-supabase.js`: Utility to delete files using Supabase client
  - `delete-specific-file.js`: Utility to delete a specific file
  - `delete-test-file.js`: Utility to delete test files
  - `delete-with-delay.js`: Utility to delete files with delay
  - `fix-storage-delete.js`: Utility to fix storage deletion issues

## Database CLI

The database directory includes a CLI utility to help with database operations. You can use it to set up the database, fix issues, run tests, and clean up the database.

### Usage

```bash
npm run db <command> [subcommand] [options]
```

Or directly:

```bash
node database/db-cli.js <command> [subcommand] [options]
```

### Commands

- `setup`: Set up the database
- `fix`: Fix database issues
  - `storage`: Fix storage bucket issues
  - `rls`: Fix Row Level Security issues
- `test`: Run tests
  - `upload`: Test image uploads
- `clean`: Clean up database
  - `files`: Delete files from storage
- `help`: Show help text

### Examples

```bash
# Set up the database
npm run db setup

# Fix storage bucket issues
npm run db fix storage

# Test image uploads
npm run db test upload

# Clean up files from storage
npm run db clean files
```

## Individual Scripts

If you prefer to run the scripts directly, you can use the following npm commands:

### Setting Up the Database

To set up the database, run:

```bash
npm run setup-db
```

### Fixing Storage Issues

If you encounter storage issues, run:

```bash
npm run fix-storage
```

### Testing Image Uploads

To test image uploads, run:

```bash
npm run test-upload
```

### Fixing RLS Policies

If you encounter RLS policy issues, run:

```bash
npm run fix-rls
```

### Deleting Files

To delete specific files from storage, run:

```bash
npm run delete-file
``` 
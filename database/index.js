// Database utilities index file
// This file provides a convenient way to import database utilities

// Import scripts
const setupDatabase = require('./scripts/setup-supabase');
const fixStorage = require('./scripts/fix-storage');
const fixRls = require('./scripts/fix-rls');
const testImageUpload = require('./scripts/test-image-upload');

// Import utilities
const deleteFile = require('./utils/delete-specific-file');
const deleteWithDelay = require('./utils/delete-with-delay');
const fixStorageDelete = require('./utils/fix-storage-delete');

// Export utilities
module.exports = {
  // Setup functions
  setupDatabase: setupDatabase.setupDatabase || setupDatabase,
  fixStorage: fixStorage.fixStorage || fixStorage,
  fixRls: fixRls.fixRlsPolicies || fixRls,
  testImageUpload: testImageUpload.testImageUpload || testImageUpload,
  
  // Utility functions
  deleteFile: deleteFile.deleteSpecificFile || deleteFile,
  deleteWithDelay: deleteWithDelay.main || deleteWithDelay,
  fixStorageDelete: fixStorageDelete.fixStoragePolicies || fixStorageDelete,
  
  // Schema paths
  schemas: {
    simple: './schemas/simple-setup.sql',
    direct: './schemas/direct-setup.sql',
    directFixed: './schemas/direct-setup-fixed.sql',
    main: './schemas/supabase-schema.sql',
  },
  
  // Migration paths
  migrations: {
    fixStorage: './migrations/fix-storage-policies.sql',
    fixRls: './migrations/fix-rls-policies.sql',
    fixRlsSimple: './migrations/fix-rls-policies-simple.sql',
    fixStorageDelete: './migrations/fix-storage-delete-simple.sql',
  },
}; 
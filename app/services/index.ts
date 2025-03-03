// Central export file for all services
// This allows importing from a single point: import { catService, locationService } from '../services'

// Re-export specific services to avoid ambiguity
import { catService } from './api/catService';
import { supabase, checkSupabaseConnection } from './api/supabaseClient';
import { storageService } from './storage/storageService';
import { locationService } from './location/locationService';
import { notificationService } from './notifications/notificationService';
import { settingsService } from './settings/settingsService';
import { utilsService } from './utils/utilsService';
import { validationService } from './validation/validationService';

// Export all services
export {
  catService,
  supabase,
  checkSupabaseConnection,
  storageService,
  locationService,
  notificationService,
  settingsService,
  utilsService,
  validationService
}; 
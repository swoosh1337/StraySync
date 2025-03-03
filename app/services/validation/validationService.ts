import { utilsService } from '../utils/utilsService';
import { Cat } from '../../types';

export const validationService = {
  // Validate cat form
  validateCatForm(cat: Partial<Cat>): { valid: boolean; message?: string } {
    // Image is required
    if (!cat.image_url) {
      return { valid: false, message: 'Please add a photo of the cat' };
    }
    
    // Description is optional but if provided, should be at least 10 characters
    if (cat.description && cat.description.length < 10) {
      return {
        valid: false,
        message: 'Description should be at least 10 characters long',
      };
    }
    
    // Location is required
    if (!cat.latitude || !cat.longitude) {
      return { valid: false, message: 'Please select a location on the map' };
    }
    
    // If adoptable is true, contact info is required
    if (cat.is_adoptable && !cat.contact_info) {
      return {
        valid: false,
        message: 'Please provide contact information for adoption',
      };
    }
    
    return { valid: true };
  },
  
  // Validate contact info
  validateContactInfo(contactInfo: string): { valid: boolean; message?: string } {
    if (!contactInfo) {
      return { valid: false, message: 'Contact information is required' };
    }
    
    // Check if it's an email
    if (contactInfo.includes('@') && !utilsService.isValidEmail(contactInfo)) {
      return { valid: false, message: 'Please enter a valid email address' };
    }
    
    // Check if it's a phone number (simple validation)
    if (/^\d+$/.test(contactInfo) && contactInfo.length < 10) {
      return {
        valid: false,
        message: 'Phone number should be at least 10 digits',
      };
    }
    
    return { valid: true };
  },
}; 
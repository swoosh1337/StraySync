import { Platform } from 'react-native';
import { supabase } from './api/supabaseClient';

// Safely import RevenueCat (may not be available in Expo Go)
let Purchases: any = null;
let PurchasesModule: any = null;

try {
  PurchasesModule = require('react-native-purchases');
  Purchases = PurchasesModule.default;
} catch (e) {
  console.warn('[RevenueCat] Not available - using mock mode');
}

// Mock types when Purchases isn't available
type PurchasesPackage = any;
type PurchasesOfferings = any;
type CustomerInfo = any;
type PurchasesStoreProduct = any;

/**
 * RevenueCat Service
 * Handles in-app purchase initialization, purchases, and entitlement checking
 */

// RevenueCat API keys (get from RevenueCat dashboard)
const REVENUECAT_API_KEY_IOS = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY || '';
const REVENUECAT_API_KEY_ANDROID = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY || '';

export interface DonationTier {
  id: string;
  productId: string;
  price: string;
  name: string;
  icon: string;
  color: string;
  benefits: string[];
  popular?: boolean;
}

class RevenueCatService {
  private initialized = false;
  private currentUserId: string | null = null;
  private isAvailable = false;

  private checkAvailability(): boolean {
    if (!Purchases || !this.isAvailable) {
      if (__DEV__) {
        console.warn('[RevenueCat] SDK not available');
      }
      return false;
    }
    return true;
  }

  /**
   * Initialize RevenueCat SDK
   * Call this once when the app starts
   */
  async initialize(userId?: string): Promise<void> {
    try {
      if (this.initialized) {
        if (__DEV__) {
          console.log('[RevenueCat] Already initialized');
        }
        return;
      }

      // Check if Purchases is available
      if (!Purchases) {
        console.warn('[RevenueCat] SDK not available (running in Expo Go?)');
        return;
      }

      // Get platform-specific API key
      const apiKey = Platform.OS === 'ios' ? REVENUECAT_API_KEY_IOS : REVENUECAT_API_KEY_ANDROID;

      if (!apiKey) {
        console.warn('[RevenueCat] API key not configured, skipping initialization');
        return;
      }

      if (__DEV__) {
        console.log('[RevenueCat] Initializing SDK...');
      }

      // Configure SDK
      await Purchases.configure({ apiKey });

      this.initialized = true;
      this.isAvailable = true;

      // Identify user if provided
      if (userId) {
        await this.identifyUser(userId);
      }

      if (__DEV__) {
        console.log('[RevenueCat] Initialized successfully');
      }
    } catch (error) {
      console.error('[RevenueCat] Initialization error:', error);
    }
  }

  /**
   * Identify user with RevenueCat
   * Links purchases to your user ID (Supabase user ID)
   */
  async identifyUser(userId: string): Promise<void> {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      // Ensure Purchases SDK is available before proceeding
      if (!this.checkAvailability()) {
        console.warn('[RevenueCat] Purchases unavailable; skipping user identification');
        return;
      }

      if (this.currentUserId === userId) {
        return; // Already identified
      }

      if (__DEV__) {
        console.log(`[RevenueCat] Identifying user: ${userId}`);
      }

      await Purchases.logIn(userId);
      this.currentUserId = userId;

      // Sync entitlements with Supabase
      await this.syncEntitlements();
    } catch (error) {
      console.error('[RevenueCat] User identification error:', error);
    }
  }

  /**
   * Get available offerings (products)
   */
  async getOfferings(): Promise<PurchasesOfferings | null> {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      // Guard: ensure Purchases is available and configured
      if (!this.checkAvailability()) return null;

      const offerings = await Purchases.getOfferings();
      return offerings;
    } catch (error) {
      console.error('[RevenueCat] Error fetching offerings:', error);
      return null;
    }
  }

  /**
   * Purchase a product
   */
  async purchaseProduct(productId: string): Promise<{
    success: boolean;
    customerInfo?: CustomerInfo;
    error?: string;
  }> {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      if (!this.checkAvailability()) {
        return { success: false, error: 'UNAVAILABLE' };
      }

      if (__DEV__) {
        console.log(`[RevenueCat] Purchasing product: ${productId}`);
      }

      // In development, simulate purchase
      if (__DEV__ && !REVENUECAT_API_KEY_IOS && !REVENUECAT_API_KEY_ANDROID) {
        console.log('[RevenueCat] Development mode - simulating purchase');
        await this.updateSupporterStatus(true);
        return { success: true };
      }

      // Get offerings
      const offerings = await this.getOfferings();
      if (!offerings || !offerings.current) {
        throw new Error('No offerings available');
      }

      // Find the package
      const packages = offerings.current.availablePackages;
      const packageToPurchase = packages.find(
        (pkg) => pkg.product.identifier === productId
      );

      if (!packageToPurchase) {
        throw new Error('Product not found');
      }

      // Make purchase
      const { customerInfo } = await Purchases.purchasePackage(packageToPurchase);

      // Update Supabase (null-safe check)
      if (customerInfo?.entitlements?.active?.['supporter']) {
        await this.updateSupporterStatus(true);
      }

      return { success: true, customerInfo };
    } catch (error: any) {
      console.error('[RevenueCat] Purchase error:', error);

      // User cancelled
      if (error.userCancelled) {
        return { success: false, error: 'USER_CANCELLED' };
      }

      return { success: false, error: error.message || 'Purchase failed' };
    }
  }

  /**
   * Check if user has active entitlement
   */
  async hasEntitlement(entitlementId: string = 'supporter'): Promise<boolean> {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      if (!this.checkAvailability()) {
        return false;
      }

      const customerInfo = await Purchases.getCustomerInfo();
      return Boolean(customerInfo?.entitlements?.active?.[entitlementId]);
    } catch (error) {
      console.error('[RevenueCat] Error checking entitlement:', error);
      return false;
    }
  }

  /**
   * Restore purchases (for users who already purchased on another device)
   */
  async restorePurchases(): Promise<{
    success: boolean;
    hasActiveEntitlement: boolean;
  }> {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      if (__DEV__) {
        console.log('[RevenueCat] Restoring purchases...');
      }

      if (!this.checkAvailability()) {
        return { success: false, hasActiveEntitlement: false };
      }

      const customerInfo = await Purchases.restorePurchases();
      const hasActiveEntitlement = !!customerInfo?.entitlements?.active?.['supporter'];

      if (hasActiveEntitlement) {
        await this.updateSupporterStatus(true);
      }

      return { success: true, hasActiveEntitlement };
    } catch (error) {
      console.error('[RevenueCat] Restore error:', error);
      return { success: false, hasActiveEntitlement: false };
    }
  }

  /**
   * Sync entitlements with Supabase
   * Updates is_supporter status based on RevenueCat
   */
  async syncEntitlements(): Promise<void> {
    try {
      const hasSupporter = await this.hasEntitlement('supporter');

      if (__DEV__) {
        console.log(`[RevenueCat] Syncing entitlements - has supporter: ${hasSupporter}`);
      }

      await this.updateSupporterStatus(hasSupporter);
    } catch (error) {
      console.error('[RevenueCat] Sync error:', error);
    }
  }

  /**
   * Update supporter status in Supabase
   */
  private async updateSupporterStatus(isSupporter: boolean): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        console.warn('[RevenueCat] No authenticated user to update');
        return;
      }

      const updateData: any = {
        is_supporter: isSupporter,
        updated_at: new Date().toISOString(),
      };

      // Set supporter_since only if becoming a supporter
      if (isSupporter) {
        // Check if already a supporter
        const { data: profile } = await supabase
          .from('profiles')
          .select('is_supporter, supporter_since')
          .eq('id', user.id)
          .single();

        if (profile && !profile.is_supporter) {
          updateData.supporter_since = new Date().toISOString();
        } else if (!profile) {
          if (__DEV__) {
            console.warn('[RevenueCat] Profile not found; not setting supporter_since');
          }
        }
      }

      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', user.id);

      if (error) {
        console.error('[RevenueCat] Supabase update error:', error);
      } else {
        if (__DEV__) {
          console.log('[RevenueCat] Supporter status updated in Supabase');
        }
      }
    } catch (error) {
      console.error('[RevenueCat] Error updating supporter status:', error);
    }
  }

  /**
   * Log out user from RevenueCat
   */
  async logout(): Promise<void> {
    try {
      if (!this.initialized) {
        return;
      }

      if (__DEV__) {
        console.log('[RevenueCat] Logging out user');
      }

      if (!this.checkAvailability()) {
        return;
      }

      await Purchases.logOut();
      this.currentUserId = null;
    } catch (error) {
      console.error('[RevenueCat] Logout error:', error);
    }
  }

  /**
   * Get customer info
   */
  async getCustomerInfo(): Promise<CustomerInfo | null> {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      if (!this.checkAvailability()) {
        return null;
      }
      return await Purchases.getCustomerInfo();
    } catch (error) {
      console.error('[RevenueCat] Error getting customer info:', error);
      return null;
    }
  }
}

// Export singleton instance
export const revenueCatService = new RevenueCatService();

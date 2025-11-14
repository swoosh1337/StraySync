import { Platform } from 'react-native';
import { supabase } from './api/supabaseClient';

// Try to import RevenueCat (may not be available)
let Purchases: any = null;
try {
  const PurchasesModule = require('react-native-purchases');
  Purchases = PurchasesModule.default;
} catch (e) {
  if (__DEV__) {
    console.log('[PurchaseService] RevenueCat not available');
  }
}

// Try to import expo-in-app-purchases (may not be available in Expo Go)
let InAppPurchases: any = null;
try {
  InAppPurchases = require('expo-in-app-purchases');
} catch (e) {
  if (__DEV__) {
    console.log('[PurchaseService] expo-in-app-purchases not available');
  }
}

export interface PurchaseResult {
  success: boolean;
  isSupporter: boolean;
  error?: string;
  provider?: 'revenuecat' | 'storekit' | 'mock';
}

/**
 * Unified Purchase Service
 * Tries RevenueCat first, falls back to native StoreKit/Google Play
 */
class PurchaseService {
  private initialized = false;
  private provider: 'revenuecat' | 'storekit' | 'none' = 'none';
  private revenueCatApiKey: string | null = null;
  private purchaseListenerSet = false;
  private pendingPurchaseResolvers: Map<string, {
    resolve: (result: PurchaseResult) => void;
    reject: (error: Error) => void;
  }> = new Map();

  /**
   * Initialize the purchase system
   * Tries RevenueCat first, then falls back to StoreKit
   */
  async initialize(userId?: string): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Try RevenueCat first (only if configured)
      this.revenueCatApiKey = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY || null;

      if (Purchases && this.revenueCatApiKey) {
        if (__DEV__) {
          console.log('[PurchaseService] Initializing RevenueCat...');
        }

        await Purchases.configure({ apiKey: this.revenueCatApiKey });

        if (userId) {
          await Purchases.logIn(userId);
        }

        this.provider = 'revenuecat';
        this.initialized = true;

        if (__DEV__) {
          console.log('[PurchaseService] ✅ Using RevenueCat');
        }
        return;
      }

      // Fall back to StoreKit
      if (InAppPurchases) {
        if (__DEV__) {
          console.log('[PurchaseService] Initializing StoreKit...');
          console.log('[PurchaseService] ⚠️ NOTE: StoreKit purchases may not work in development builds');
          console.log('[PurchaseService] ⚠️ Test in TestFlight for reliable IAP testing');
        }

        // Set up purchase listener FIRST (REQUIRED - purchaseItemAsync returns undefined)
        // Must be set up before connectAsync to catch any pending transactions
        if (!this.purchaseListenerSet) {
          if (__DEV__) {
            console.log('[PurchaseService] Setting up purchase listener...');
          }
          
          InAppPurchases.setPurchaseListener(async ({ responseCode, results, errorCode }: {
            responseCode: number;
            results?: any[];
            errorCode?: number;
          }) => {
            if (__DEV__) {
              console.log('[PurchaseService] 🔔 Purchase listener CALLED:', {
                responseCode,
                errorCode,
                resultsCount: results?.length || 0,
                IAPResponseCode_OK: InAppPurchases.IAPResponseCode.OK,
                IAPResponseCode_USER_CANCELED: InAppPurchases.IAPResponseCode.USER_CANCELED,
              });
            }

            if (responseCode === InAppPurchases.IAPResponseCode.OK && results) {
              if (__DEV__) {
                console.log('[PurchaseService] ✅ Purchase successful! Processing', results.length, 'purchase(s)');
              }
              
              // Process each purchase (use for...of to properly handle async)
              for (const purchase of results) {
                try {
                  if (__DEV__) {
                    console.log('[PurchaseService] Processing purchase:', {
                      productId: purchase.productId,
                      transactionId: purchase.transactionId,
                      acknowledged: purchase.acknowledged,
                    });
                    console.log('[PurchaseService] Pending resolvers:', Array.from(this.pendingPurchaseResolvers.keys()));
                  }

                  // Find pending resolver for this product
                  const resolver = this.pendingPurchaseResolvers.get(purchase.productId);
                  
                  if (resolver) {
                    if (__DEV__) {
                      console.log('[PurchaseService] ✅ Found resolver for', purchase.productId);
                    }
                    
                    // Finish transaction
                    await InAppPurchases.finishTransactionAsync(purchase, true);
                    
                    if (__DEV__) {
                      console.log('[PurchaseService] Transaction finished, resolving promise');
                    }
                    
                    // Resolve the promise (Supabase update happens in resolver callback)
                    resolver.resolve({
                      success: true,
                      isSupporter: true,
                      provider: 'storekit',
                    });
                    
                    // Remove resolver
                    this.pendingPurchaseResolvers.delete(purchase.productId);
                  } else {
                    if (__DEV__) {
                      console.warn('[PurchaseService] ⚠️ No resolver found for', purchase.productId, '- orphaned transaction?');
                    }
                    
                    // No pending purchase (e.g., app restarted, purchase from previous session)
                    // Still finish the transaction to prevent it from being stuck
                    if (!purchase.acknowledged) {
                      await InAppPurchases.finishTransactionAsync(purchase, true);
                      if (__DEV__) {
                        console.log('[PurchaseService] Finished orphaned transaction:', purchase.productId);
                      }
                    }
                  }
                } catch (purchaseError: any) {
                  console.error('[PurchaseService] Error processing purchase:', purchaseError);
                }
              }
            } else if (responseCode === InAppPurchases.IAPResponseCode.USER_CANCELED) {
              // User cancelled - reject all pending purchases
              if (__DEV__) {
                console.log('[PurchaseService] User cancelled purchase');
              }
              
              // Reject all pending purchases (we don't know which one was cancelled)
              this.pendingPurchaseResolvers.forEach((resolver, productId) => {
                resolver.reject(new Error('USER_CANCELLED'));
                this.pendingPurchaseResolvers.delete(productId);
              });
            } else {
              // Other error
              if (__DEV__) {
                console.error('[PurchaseService] Purchase error:', errorCode);
              }
              
              // Reject all pending purchases
              this.pendingPurchaseResolvers.forEach((resolver, productId) => {
                resolver.reject(new Error(`Purchase failed: ${errorCode}`));
                this.pendingPurchaseResolvers.delete(productId);
              });
            }
          });
          
          this.purchaseListenerSet = true;
          if (__DEV__) {
            console.log('[PurchaseService] ✅ Purchase listener set up');
          }
        }
        
        // Now connect (listener is already set up to catch pending transactions)
        await InAppPurchases.connectAsync();
        
        if (__DEV__) {
          console.log('[PurchaseService] Connected to StoreKit');
        }
        
        this.provider = 'storekit';
        this.initialized = true;

        if (__DEV__) {
          console.log('[PurchaseService] ✅ Using StoreKit');
        }
      } else {
        if (__DEV__) {
          console.log('[PurchaseService] No purchase provider available');
        }
        this.provider = 'none';
      }
    } catch (error) {
      console.error('[PurchaseService] Initialization error:', error);
      this.provider = 'none';
    }
  }

  /**
   * Purchase a product
   */
  async purchaseProduct(productId: string, userId?: string): Promise<PurchaseResult> {
    try {
      if (!this.initialized) {
        await this.initialize(userId);
      }

      if (this.provider === 'none') {
        return {
          success: false,
          isSupporter: false,
          error: 'Purchase system not available',
        };
      }

      if (__DEV__) {
        console.log(`[PurchaseService] Purchasing ${productId} via ${this.provider}...`);
      }

      // RevenueCat purchase
      if (this.provider === 'revenuecat') {
        return await this.purchaseViaRevenueCat(productId, userId);
      }

      // StoreKit purchase
      if (this.provider === 'storekit') {
        return await this.purchaseViaStoreKit(productId, userId);
      }

      return {
        success: false,
        isSupporter: false,
        error: 'Unknown provider',
      };
    } catch (error: any) {
      console.error('[PurchaseService] Purchase error:', error);
      return {
        success: false,
        isSupporter: false,
        error: error.message || 'Purchase failed',
      };
    }
  }

  /**
   * Purchase via RevenueCat
   */
  private async purchaseViaRevenueCat(productId: string, userId?: string): Promise<PurchaseResult> {
    try {
      if (__DEV__) {
        console.log('[PurchaseService] Getting RevenueCat offerings...');
      }
      
      // Get offerings
      const offerings = await Purchases.getOfferings();
      
      if (__DEV__) {
        console.log('[PurchaseService] Offerings:', offerings);
        console.log('[PurchaseService] Current offering:', offerings?.current);
        console.log('[PurchaseService] Available packages:', offerings?.current?.availablePackages?.map((pkg: any) => ({
          identifier: pkg.identifier,
          productId: pkg.product.identifier,
          price: pkg.product.priceString,
        })));
      }
      
      if (!offerings || !offerings.current) {
        if (__DEV__) {
          console.error('[PurchaseService] No offerings available. You need to configure products in RevenueCat dashboard.');
        }
        throw new Error('No offerings available. Please contact support.');
      }

      // Find the product
      const packages = offerings.current.availablePackages;
      const packageToPurchase = packages.find(
        (pkg: any) => pkg.product.identifier === productId
      );

      if (!packageToPurchase) {
        if (__DEV__) {
          console.error('[PurchaseService] Product not found:', productId);
          console.error('[PurchaseService] Available products:', packages.map((pkg: any) => pkg.product.identifier));
        }
        throw new Error(`Product "${productId}" not found. Please contact support.`);
      }

      if (__DEV__) {
        console.log('[PurchaseService] Found package:', packageToPurchase.identifier);
        console.log('[PurchaseService] Purchasing...');
      }

      // Make purchase
      const { customerInfo } = await Purchases.purchasePackage(packageToPurchase);

      if (__DEV__) {
        console.log('[PurchaseService] Purchase completed!');
        console.log('[PurchaseService] Active entitlements:', Object.keys(customerInfo.entitlements.active));
      }

      // Check if any entitlement is active (supporter or donation)
      const isSupporter = Object.keys(customerInfo.entitlements.active).length > 0;

      // Update Supabase
      if (isSupporter && userId) {
        await this.updateSupporterStatus(userId, true);
      }

      return {
        success: true,
        isSupporter,
        provider: 'revenuecat',
      };
    } catch (error: any) {
      // User cancelled
      if (error.userCancelled) {
        if (__DEV__) {
          console.log('[PurchaseService] User cancelled purchase');
        }
        return {
          success: false,
          isSupporter: false,
          error: 'USER_CANCELLED',
          provider: 'revenuecat',
        };
      }

      console.error('[PurchaseService] RevenueCat purchase error:', error);
      throw error;
    }
  }

  /**
   * Purchase via StoreKit (expo-in-app-purchases)
   * NOTE: purchaseItemAsync returns undefined by design - we use setPurchaseListener instead
   */
  private async purchaseViaStoreKit(productId: string, userId?: string): Promise<PurchaseResult> {
    if (!InAppPurchases) {
      throw new Error('StoreKit not available');
    }

    try {
      // Ensure purchase listener is set up
      if (!this.purchaseListenerSet) {
        await this.initialize(userId);
      }

      // Get product details with proper error handling
      const productsResponse = await InAppPurchases.getProductsAsync([productId]);
      
      // Add null check for the response
      if (!productsResponse) {
        throw new Error('Failed to fetch product information. Please try again.');
      }

      const { responseCode, results } = productsResponse;

      if (responseCode !== InAppPurchases.IAPResponseCode.OK) {
        throw new Error(`Product fetch failed with code: ${responseCode}`);
      }

      if (!results || results.length === 0) {
        throw new Error('Product not found in App Store. Please check that the product ID is configured correctly.');
      }

      if (__DEV__) {
        console.log('[PurchaseService] Product found:', results[0]);
        console.log('[PurchaseService] Initiating purchase for:', productId);
      }
      
      // Verify product is ready for purchase
      if (!results[0] || !results[0].productId) {
        throw new Error('Product not ready for purchase');
      }

      // Create a promise that will be resolved by the purchase listener
      return new Promise<PurchaseResult>((resolve, reject) => {
        // Set timeout (30 seconds)
        const timeout = setTimeout(() => {
          this.pendingPurchaseResolvers.delete(productId);
          reject(new Error('Purchase timeout - no response received'));
        }, 30000);

        // Store resolver for this purchase
        this.pendingPurchaseResolvers.set(productId, {
          resolve: (result: PurchaseResult) => {
            clearTimeout(timeout);
            // Update Supabase with userId
            if (result.success && userId) {
              this.updateSupporterStatus(userId, true).catch(err => {
                console.error('[PurchaseService] Error updating supporter status:', err);
              });
            }
            resolve(result);
          },
          reject: (error: Error) => {
            clearTimeout(timeout);
            if (error.message === 'USER_CANCELLED') {
              resolve({
                success: false,
                isSupporter: false,
                error: 'USER_CANCELLED',
                provider: 'storekit',
              });
            } else {
              reject(error);
            }
          },
        });

        // Initiate purchase (returns undefined - result comes via listener)
        if (__DEV__) {
          console.log('[PurchaseService] Calling purchaseItemAsync for', productId);
          console.log('[PurchaseService] Pending resolvers before purchase:', Array.from(this.pendingPurchaseResolvers.keys()));
        }
        
        InAppPurchases.purchaseItemAsync(productId).then(() => {
          if (__DEV__) {
            console.log('[PurchaseService] purchaseItemAsync completed (returned undefined as expected)');
          }
        }).catch((error: any) => {
          clearTimeout(timeout);
          this.pendingPurchaseResolvers.delete(productId);
          console.error('[PurchaseService] purchaseItemAsync error:', error);
          reject(new Error(`Purchase initiation failed: ${error?.message || 'Unknown error'}`));
        });
      });
    } catch (error: any) {
      console.error('[PurchaseService] StoreKit error:', error);
      throw error;
    }
  }

  /**
   * Restore purchases
   */
  async restorePurchases(userId?: string): Promise<PurchaseResult> {
    try {
      if (!this.initialized) {
        await this.initialize(userId);
      }

      if (this.provider === 'revenuecat' && Purchases) {
        const customerInfo = await Purchases.restorePurchases();
        const isSupporter = customerInfo.entitlements.active['supporter'] !== undefined;

        if (isSupporter && userId) {
          await this.updateSupporterStatus(userId, true);
        }

        return {
          success: true,
          isSupporter,
          provider: 'revenuecat',
        };
      }

      if (this.provider === 'storekit' && InAppPurchases) {
        // StoreKit restore with proper null checks
        const history = await InAppPurchases.getPurchaseHistoryAsync();

        // Add null check for history response
        if (!history) {
          throw new Error('Failed to fetch purchase history. Please try again.');
        }

        if (history.responseCode === InAppPurchases.IAPResponseCode.OK && history.results) {
          // Check for existing product ID prefix (com.straysync.donation)
          const hasAnyDonation = history.results.some((purchase: any) =>
            purchase.productId.includes('com.straysync.donation.')
          );

          if (hasAnyDonation && userId) {
            await this.updateSupporterStatus(userId, true);
          }

          return {
            success: true,
            isSupporter: hasAnyDonation,
            provider: 'storekit',
          };
        }
      }

      return {
        success: false,
        isSupporter: false,
        error: 'No purchases to restore',
      };
    } catch (error: any) {
      console.error('[PurchaseService] Restore error:', error);
      return {
        success: false,
        isSupporter: false,
        error: error.message || 'Restore failed',
      };
    }
  }

  /**
   * Check if user has active supporter status
   */
  async hasSupporter(userId?: string): Promise<boolean> {
    try {
      if (!this.initialized) {
        await this.initialize(userId);
      }

      if (this.provider === 'revenuecat' && Purchases) {
        const customerInfo = await Purchases.getCustomerInfo();
        return customerInfo.entitlements.active['supporter'] !== undefined;
      }

      // For StoreKit, check Supabase
      if (userId) {
        const { data } = await supabase
          .from('profiles')
          .select('is_supporter')
          .eq('id', userId)
          .single();

        return data?.is_supporter || false;
      }

      return false;
    } catch (error) {
      console.error('[PurchaseService] Error checking supporter status:', error);
      return false;
    }
  }

  /**
   * Update supporter status in Supabase
   */
  private async updateSupporterStatus(userId: string, isSupporter: boolean): Promise<void> {
    try {
      const updateData: any = {
        is_supporter: isSupporter,
        updated_at: new Date().toISOString(),
      };

      // Set supporter_since only if becoming a supporter
      if (isSupporter) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('is_supporter, supporter_since')
          .eq('id', userId)
          .single();

        if (!profile?.is_supporter) {
          updateData.supporter_since = new Date().toISOString();
        }
      }

      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', userId);

      if (error) {
        console.error('[PurchaseService] Supabase update error:', error);
      } else {
        if (__DEV__) {
          console.log('[PurchaseService] Supporter status updated in Supabase');
        }
      }
    } catch (error) {
      console.error('[PurchaseService] Error updating supporter status:', error);
    }
  }

  /**
   * Get current provider
   */
  getProvider(): 'revenuecat' | 'storekit' | 'none' {
    return this.provider;
  }

  /**
   * Check if purchases are available
   */
  isAvailable(): boolean {
    return this.provider !== 'none';
  }

  /**
   * Disconnect (cleanup)
   */
  async disconnect(): Promise<void> {
    try {
      if (this.provider === 'storekit' && InAppPurchases) {
        await InAppPurchases.disconnectAsync();
      }

      if (this.provider === 'revenuecat' && Purchases) {
        await Purchases.logOut();
      }

      this.initialized = false;
      this.provider = 'none';
    } catch (error) {
      console.error('[PurchaseService] Disconnect error:', error);
    }
  }
}

// Export singleton - wrapped in try/catch to ensure export always succeeds
let purchaseService: PurchaseService;
try {
  purchaseService = new PurchaseService();
} catch (error) {
  console.error('[PurchaseService] Failed to create service instance:', error);
  // Create a minimal fallback service
  purchaseService = new PurchaseService();
}

export { purchaseService };

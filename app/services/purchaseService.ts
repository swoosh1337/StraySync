import { Platform } from 'react-native';
import { supabase } from './api/supabaseClient';

// Try to import expo-in-app-purchases
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
}

/**
 * Purchase Service using expo-in-app-purchases
 * Uses polling instead of unreliable event listeners
 */
class PurchaseService {
  private initialized = false;
  private currentUserId: string | null = null;

  /**
   * Initialize the purchase system
   */
  async initialize(userId?: string): Promise<void> {
    if (this.initialized) {
      return;
    }

    this.currentUserId = userId || null;

    if (!InAppPurchases) {
      console.error('[PurchaseService] expo-in-app-purchases not available');
      return;
    }

    try {
      if (__DEV__) {
        console.log('[PurchaseService] Initializing StoreKit...');
      }

      // Connect to the store
      await InAppPurchases.connectAsync();

      // Check for any pending transactions
      await this.processPendingTransactions();

      this.initialized = true;

      if (__DEV__) {
        console.log('[PurchaseService] ✅ StoreKit initialized');
      }
    } catch (error) {
      console.error('[PurchaseService] Initialization failed:', error);
    }
  }

  /**
   * Process a completed purchase transaction
   */
  private async processTransaction(purchase: any): Promise<void> {
    try {
      if (__DEV__) {
        console.log('[PurchaseService] Processing transaction:', {
          productId: purchase.productId,
          acknowledged: purchase.acknowledged,
        });
      }

      // Finish the transaction only if not already acknowledged
      if (!purchase.acknowledged) {
        await InAppPurchases.finishTransactionAsync(purchase, false);
        if (__DEV__) {
          console.log('[PurchaseService] Transaction finished');
        }
      }

      // Update supporter status in Supabase (non-blocking)
      if (this.currentUserId) {
        try {
          await this.updateSupporterStatus(this.currentUserId, true);
        } catch (supabaseError) {
          console.warn('[PurchaseService] Supabase update failed, but purchase succeeded');
        }
      }
    } catch (error) {
      console.error('[PurchaseService] Error processing transaction:', error);
      throw error;
    }
  }

  /**
   * Process any pending transactions
   */
  private async processPendingTransactions() {
    if (!InAppPurchases) return;

    try {
      const history = await InAppPurchases.getPurchaseHistoryAsync();

      // Handle undefined response
      if (!history) {
        if (__DEV__) {
          console.log('[PurchaseService] Purchase history returned undefined');
        }
        return;
      }

      if (history.responseCode === InAppPurchases.IAPResponseCode.OK && history.results) {
        if (__DEV__) {
          console.log('[PurchaseService] Found', history.results.length, 'transaction(s) in history');
        }

        // Check if any are donation purchases
        const hasDonationPurchase = history.results.some((purchase: any) =>
          purchase.productId.includes('donation') ||
          purchase.productId.startsWith('com.straysync.') ||
          purchase.productId.startsWith('com.igrigolia.stray.')
        );

        // If user has any donation purchase, restore supporter status
        if (hasDonationPurchase && this.currentUserId) {
          if (__DEV__) {
            console.log('[PurchaseService] Found donation purchase(s), ensuring supporter status');
          }
          try {
            await this.updateSupporterStatus(this.currentUserId, true);
          } catch (error) {
            console.warn('[PurchaseService] Failed to update supporter status during init, will retry later');
          }
        }

        // Process pending transactions
        for (const purchase of history.results) {
          if (!purchase.acknowledged) {
            await this.processTransaction(purchase);
            if (__DEV__) {
              console.log('[PurchaseService] Finished pending transaction:', purchase.productId);
            }
          }
        }
      }
    } catch (error) {
      console.error('[PurchaseService] Error processing pending transactions:', error);
    }
  }

  /**
   * Check if user is a supporter
   */
  async checkSupporterStatus(userId?: string): Promise<boolean> {
    try {
      const userIdToCheck = userId || this.currentUserId;
      if (!userIdToCheck) return false;

      const { data, error } = await supabase
        .from('profiles')
        .select('is_supporter')
        .eq('id', userIdToCheck)
        .single();

      if (error) throw error;
      return data?.is_supporter || false;
    } catch (error) {
      console.error('[PurchaseService] Error checking supporter status:', error);
      return false;
    }
  }

  /**
   * Update supporter status in Supabase
   */
  private async updateSupporterStatus(userId: string, isSupporter: boolean): Promise<void> {
    if (__DEV__) {
      console.log('[PurchaseService] Updating Supabase:', { userId, isSupporter });
    }

    const { data, error } = await supabase
      .from('profiles')
      .update({ is_supporter: isSupporter })
      .eq('id', userId)
      .select();

    if (error) {
      if (__DEV__) {
        console.warn('[PurchaseService] Supabase update error:', error.message || error);
      }
      throw error;
    }

    if (__DEV__) {
      console.log('[PurchaseService] ✅ Supporter status updated in Supabase');
    }
  }

  /**
   * Purchase a product
   */
  async purchaseProduct(productId: string, userId?: string): Promise<PurchaseResult> {
    if (!InAppPurchases) {
      return {
        success: false,
        isSupporter: false,
        error: 'In-app purchases not available',
      };
    }

    // Initialize if not already done
    if (!this.initialized) {
      await this.initialize(userId);
    }

    // Update current user ID
    if (userId) {
      this.currentUserId = userId;
    }

    try {
      if (__DEV__) {
        console.log('[PurchaseService] Starting purchase for:', productId);
      }

      // Verify product exists
      const productsResponse = await InAppPurchases.getProductsAsync([productId]);

      // Handle undefined or invalid response
      if (!productsResponse) {
        throw new Error('Unable to connect to the App Store. Please check your connection and try again.');
      }

      if (productsResponse.responseCode !== InAppPurchases.IAPResponseCode.OK) {
        throw new Error(`App Store error (code: ${productsResponse.responseCode || 'unknown'})`);
      }

      if (!productsResponse.results || productsResponse.results.length === 0) {
        throw new Error('Product not found. Please check your configuration.');
      }

      if (__DEV__) {
        console.log('[PurchaseService] Product found:', productsResponse.results[0]);
      }

      // Initiate purchase
      if (__DEV__) {
        console.log('[PurchaseService] Starting purchase...');
      }

      await InAppPurchases.purchaseItemAsync(productId);

      if (__DEV__) {
        console.log('[PurchaseService] Purchase initiated, polling for completion...');
      }

      // Poll purchase history until we find the purchase (max 30 seconds)
      const maxAttempts = 30;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second

        try {
          const history = await InAppPurchases.getPurchaseHistoryAsync();

          if (!history || history.responseCode !== InAppPurchases.IAPResponseCode.OK) {
            continue;
          }

          if (history.results && history.results.length > 0) {
            const purchase = history.results.find((p: any) => p.productId === productId);

            if (purchase) {
              if (__DEV__) {
                console.log('[PurchaseService] ✅ Purchase found, processing...');
              }

              // Process the transaction
              await this.processTransaction(purchase);

              return {
                success: true,
                isSupporter: true,
              };
            }
          }
        } catch (error) {
          console.error('[PurchaseService] Error polling purchase history:', error);
        }
      }

      // Timeout after 30 seconds
      return {
        success: false,
        isSupporter: false,
        error: 'Purchase timeout. If you completed the purchase, please use "Restore Purchases".',
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
   * Restore purchases
   */
  async restorePurchases(userId?: string): Promise<PurchaseResult> {
    if (!InAppPurchases) {
      return {
        success: false,
        isSupporter: false,
        error: 'In-app purchases not available',
      };
    }

    try {
      if (__DEV__) {
        console.log('[PurchaseService] Restoring purchases...');
      }

      const history = await InAppPurchases.getPurchaseHistoryAsync();

      if (__DEV__) {
        console.log('[PurchaseService] Purchase history response:', {
          responseCode: history?.responseCode,
          resultsCount: history?.results?.length || 0,
        });

        if (history?.results && history.results.length > 0) {
          console.log('[PurchaseService] All purchases in history:',
            history.results.map((p: any) => ({
              productId: p.productId,
              transactionId: p.transactionId,
              acknowledged: p.acknowledged,
              transactionDate: p.transactionDate,
            }))
          );
        }
      }

      // Handle undefined response
      if (!history) {
        throw new Error('Unable to connect to the App Store. Please check your connection and try again.');
      }

      if (history.responseCode !== InAppPurchases.IAPResponseCode.OK) {
        throw new Error(`App Store error (code: ${history.responseCode || 'unknown'})`);
      }

      if (!history.results || history.results.length === 0) {
        // No purchases in history, but check Supabase for existing supporter status
        const userIdToCheck = userId || this.currentUserId;
        if (userIdToCheck) {
          const isSupporter = await this.checkSupporterStatus(userIdToCheck);
          if (isSupporter) {
            if (__DEV__) {
              console.log('[PurchaseService] No purchases in history, but user is already a supporter in Supabase');
            }
            return {
              success: true,
              isSupporter: true,
            };
          }
        }

        return {
          success: false,
          isSupporter: false,
          error: 'No previous purchases found',
        };
      }

      if (__DEV__) {
        console.log('[PurchaseService] Found', history.results.length, 'previous purchase(s)');
      }

      // Check if any purchase is for a donation product
      const donationPurchases = history.results.filter((purchase: any) =>
        purchase.productId.includes('donation') ||
        purchase.productId.startsWith('com.straysync.') ||
        purchase.productId.startsWith('com.igrigolia.stray.')
      );

      if (__DEV__) {
        console.log('[PurchaseService] Found', donationPurchases.length, 'donation purchase(s)');
      }

      if (donationPurchases.length === 0) {
        return {
          success: false,
          isSupporter: false,
          error: 'No donation purchases found',
        };
      }

      // Update supporter status (non-blocking - don't fail restore if Supabase fails)
      const userIdToUpdate = userId || this.currentUserId;
      if (userIdToUpdate) {
        if (__DEV__) {
          console.log('[PurchaseService] Updating supporter status for user:', userIdToUpdate);
        }
        try {
          await this.updateSupporterStatus(userIdToUpdate, true);
        } catch (error) {
          console.warn('[PurchaseService] Failed to update supporter status in Supabase, but restore succeeded');
        }
      }

      // Note: Transactions are already finished (non-consumable, so they stay in history)
      // No need to finish them again during restore

      if (__DEV__) {
        console.log('[PurchaseService] ✅ Purchases restored successfully');
      }

      return {
        success: true,
        isSupporter: true,
      };
    } catch (error: any) {
      console.error('[PurchaseService] Restore error:', error);
      return {
        success: false,
        isSupporter: false,
        error: error.message || 'Failed to restore purchases',
      };
    }
  }

  /**
   * Get current provider
   */
  getProvider(): string {
    return InAppPurchases ? 'storekit' : 'none';
  }

  /**
   * Check if purchases are available
   */
  isAvailable(): boolean {
    return InAppPurchases !== null;
  }

  /**
   * Disconnect from the store
   */
  async disconnect(): Promise<void> {
    if (InAppPurchases && this.initialized) {
      await InAppPurchases.disconnectAsync();
      this.initialized = false;
      if (__DEV__) {
        console.log('[PurchaseService] Disconnected from store');
      }
    }
  }
}

export const purchaseService = new PurchaseService();


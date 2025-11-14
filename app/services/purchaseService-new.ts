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
 * Rewritten from scratch with proper listener implementation
 */
class PurchaseService {
  private initialized = false;
  private currentUserId: string | null = null;
  private purchaseInProgress: {
    productId: string;
    resolve: (result: PurchaseResult) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  } | null = null;

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

      // Set up purchase listener BEFORE connecting
      this.setupPurchaseListener();

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
   * Set up the purchase listener
   * This receives ALL purchase updates from StoreKit
   */
  private setupPurchaseListener() {
    if (!InAppPurchases) return;

    InAppPurchases.setPurchaseListener(({ responseCode, results, errorCode }: any) => {
      if (__DEV__) {
        console.log('[PurchaseService] 🔔 Purchase listener triggered:', {
          responseCode,
          errorCode,
          resultsCount: results?.length || 0,
        });
      }

      // Success
      if (responseCode === InAppPurchases.IAPResponseCode.OK && results) {
        this.handleSuccessfulPurchase(results);
      }
      // User cancelled
      else if (responseCode === InAppPurchases.IAPResponseCode.USER_CANCELED) {
        this.handleCancelledPurchase();
      }
      // Error
      else {
        this.handleFailedPurchase(errorCode);
      }
    });

    if (__DEV__) {
      console.log('[PurchaseService] Purchase listener set up');
    }
  }

  /**
   * Handle successful purchase
   */
  private async handleSuccessfulPurchase(results: any[]) {
    if (__DEV__) {
      console.log('[PurchaseService] ✅ Purchase successful, processing', results.length, 'transaction(s)');
    }

    for (const purchase of results) {
      try {
        if (__DEV__) {
          console.log('[PurchaseService] Processing transaction:', {
            productId: purchase.productId,
            transactionId: purchase.transactionId,
            acknowledged: purchase.acknowledged,
          });
        }

        // Finish the transaction
        if (!purchase.acknowledged) {
          await InAppPurchases.finishTransactionAsync(purchase, true);
          if (__DEV__) {
            console.log('[PurchaseService] Transaction finished');
          }
        }

        // Update supporter status in Supabase
        if (this.currentUserId) {
          await this.updateSupporterStatus(this.currentUserId, true);
        }

        // Resolve the promise if this matches the current purchase
        if (this.purchaseInProgress && purchase.productId === this.purchaseInProgress.productId) {
          clearTimeout(this.purchaseInProgress.timeout);
          this.purchaseInProgress.resolve({
            success: true,
            isSupporter: true,
          });
          this.purchaseInProgress = null;
        }
      } catch (error) {
        console.error('[PurchaseService] Error processing transaction:', error);
      }
    }
  }

  /**
   * Handle cancelled purchase
   */
  private handleCancelledPurchase() {
    if (__DEV__) {
      console.log('[PurchaseService] User cancelled purchase');
    }

    if (this.purchaseInProgress) {
      clearTimeout(this.purchaseInProgress.timeout);
      this.purchaseInProgress.resolve({
        success: false,
        isSupporter: false,
        error: 'USER_CANCELLED',
      });
      this.purchaseInProgress = null;
    }
  }

  /**
   * Handle failed purchase
   */
  private handleFailedPurchase(errorCode?: number) {
    console.error('[PurchaseService] Purchase failed with error code:', errorCode);

    if (this.purchaseInProgress) {
      clearTimeout(this.purchaseInProgress.timeout);
      this.purchaseInProgress.reject(new Error(`Purchase failed with error code: ${errorCode}`));
      this.purchaseInProgress = null;
    }
  }

  /**
   * Process any pending transactions
   */
  private async processPendingTransactions() {
    if (!InAppPurchases) return;

    try {
      const history = await InAppPurchases.getPurchaseHistoryAsync();
      
      if (history && history.responseCode === InAppPurchases.IAPResponseCode.OK && history.results) {
        if (__DEV__) {
          console.log('[PurchaseService] Found', history.results.length, 'pending transaction(s)');
        }

        // Finish any unfinished transactions
        for (const purchase of history.results) {
          if (!purchase.acknowledged) {
            await InAppPurchases.finishTransactionAsync(purchase, true);
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
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_supporter: isSupporter })
        .eq('id', userId);

      if (error) throw error;

      if (__DEV__) {
        console.log('[PurchaseService] Supporter status updated in Supabase');
      }
    } catch (error) {
      console.error('[PurchaseService] Failed to update supporter status:', error);
      throw error;
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

    // Check if purchase already in progress
    if (this.purchaseInProgress) {
      return {
        success: false,
        isSupporter: false,
        error: 'Another purchase is in progress',
      };
    }

    try {
      if (__DEV__) {
        console.log('[PurchaseService] Starting purchase for:', productId);
      }

      // Verify product exists
      const productsResponse = await InAppPurchases.getProductsAsync([productId]);
      
      if (!productsResponse || productsResponse.responseCode !== InAppPurchases.IAPResponseCode.OK) {
        throw new Error('Failed to fetch product information');
      }

      if (!productsResponse.results || productsResponse.results.length === 0) {
        throw new Error('Product not found. Please check your configuration.');
      }

      if (__DEV__) {
        console.log('[PurchaseService] Product found:', productsResponse.results[0]);
      }

      // Create promise for purchase result
      return new Promise<PurchaseResult>((resolve, reject) => {
        // Set timeout (60 seconds)
        const timeout = setTimeout(() => {
          if (__DEV__) {
            console.warn('[PurchaseService] Purchase timeout after 60 seconds');
          }
          this.purchaseInProgress = null;
          resolve({
            success: false,
            isSupporter: false,
            error: 'Purchase timeout. If you completed the purchase, please use "Restore Purchases".',
          });
        }, 60000);

        // Store purchase info
        this.purchaseInProgress = {
          productId,
          resolve,
          reject,
          timeout,
        };

        // Initiate purchase (result comes via listener)
        if (__DEV__) {
          console.log('[PurchaseService] Calling purchaseItemAsync...');
        }

        InAppPurchases.purchaseItemAsync(productId)
          .then(() => {
            if (__DEV__) {
              console.log('[PurchaseService] purchaseItemAsync called successfully');
              console.log('[PurchaseService] Waiting for purchase listener to be triggered...');
            }
          })
          .catch((error: any) => {
            console.error('[PurchaseService] purchaseItemAsync error:', error);
            clearTimeout(timeout);
            this.purchaseInProgress = null;
            reject(new Error(`Failed to initiate purchase: ${error.message}`));
          });
      });
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

      if (!history || history.responseCode !== InAppPurchases.IAPResponseCode.OK) {
        throw new Error('Failed to fetch purchase history');
      }

      if (__DEV__) {
        console.log('[PurchaseService] Found', history.results?.length || 0, 'previous purchase(s)');
      }

      if (!history.results || history.results.length === 0) {
        return {
          success: false,
          isSupporter: false,
          error: 'No previous purchases found',
        };
      }

      // Check if any purchase is for a donation product
      const hasDonationPurchase = history.results.some((purchase: any) =>
        purchase.productId.startsWith('com.straysync.donation.') ||
        purchase.productId.startsWith('com.igrigolia.stray.')
      );

      if (!hasDonationPurchase) {
        return {
          success: false,
          isSupporter: false,
          error: 'No donation purchases found',
        };
      }

      // Update supporter status
      const userIdToUpdate = userId || this.currentUserId;
      if (userIdToUpdate) {
        await this.updateSupporterStatus(userIdToUpdate, true);
      }

      // Finish any unfinished transactions
      for (const purchase of history.results) {
        if (!purchase.acknowledged) {
          await InAppPurchases.finishTransactionAsync(purchase, true);
        }
      }

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


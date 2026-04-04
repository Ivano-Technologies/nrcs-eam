// @ts-ignore - no types available
import QuickBooks from 'node-quickbooks';
import * as db from './db';

/**
 * QuickBooks Integration for NRCS EAM System
 * Handles OAuth authentication and automatic financial transaction sync
 */

export interface QuickBooksConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  realmId: string; // Company ID
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: Date;
}

export interface SyncResult {
  success: boolean;
  synced: number;
  failed: number;
  errors: string[];
}

/**
 * QuickBooks OAuth URLs
 */
export const QUICKBOOKS_OAUTH = {
  authorizationUrl: 'https://appcenter.intuit.com/connect/oauth2',
  tokenUrl: 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer',
  revokeUrl: 'https://developer.api.intuit.com/v2/oauth2/tokens/revoke',
  discoveryUrl: 'https://developer.api.intuit.com/.well-known/openid_configuration/',
};

/**
 * Generate QuickBooks OAuth authorization URL
 */
export function getQuickBooksAuthUrl(config: Pick<QuickBooksConfig, 'clientId' | 'redirectUri'>): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: 'com.intuit.quickbooks.accounting',
    state: generateRandomState(),
  });
  
  return `${QUICKBOOKS_OAUTH.authorizationUrl}?${params.toString()}`;
}

/**
 * Exchange authorization code for access token
 */
export async function exchangeCodeForToken(
  code: string,
  config: Pick<QuickBooksConfig, 'clientId' | 'clientSecret' | 'redirectUri'>
): Promise<{ accessToken: string; refreshToken: string; expiresIn: number; realmId: string }> {
  const axios = (await import('axios')).default;
  
  const auth = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64');
  
  const response = await axios.post(
    QUICKBOOKS_OAUTH.tokenUrl,
    new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: config.redirectUri,
    }),
    {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    }
  );
  
  return {
    accessToken: response.data.access_token,
    refreshToken: response.data.refresh_token,
    expiresIn: response.data.expires_in,
    realmId: response.data.realmId || '',
  };
}

/**
 * Refresh access token
 */
export async function refreshAccessToken(
  refreshToken: string,
  config: Pick<QuickBooksConfig, 'clientId' | 'clientSecret'>
): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
  const axios = (await import('axios')).default;
  
  const auth = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64');
  
  const response = await axios.post(
    QUICKBOOKS_OAUTH.tokenUrl,
    new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
    {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    }
  );
  
  return {
    accessToken: response.data.access_token,
    refreshToken: response.data.refresh_token,
    expiresIn: response.data.expires_in,
  };
}

/**
 * Create QuickBooks client instance
 */
export function createQuickBooksClient(config: QuickBooksConfig): any {
  return new QuickBooks(
    config.clientId,
    config.clientSecret,
    config.accessToken || '',
    false, // no token secret needed for OAuth 2.0
    config.realmId,
    true, // use sandbox
    false, // debug
    null, // minor version
    '2.0', // oauth version
    config.refreshToken || ''
  );
}

/**
 * Sync financial transaction to QuickBooks as expense
 */
export async function syncExpenseToQuickBooks(
  transactionId: number,
  config: QuickBooksConfig
): Promise<boolean> {
  try {
    const transaction = await db.getFinancialTransactionById(transactionId);
    if (!transaction) {
      throw new Error('Transaction not found');
    }
    
    const qbo = createQuickBooksClient(config);
    
    // Create expense in QuickBooks
    const expense = {
      AccountRef: {
        value: '1', // Default expense account
        name: 'Maintenance Expense',
      },
      PaymentType: 'Cash',
      TotalAmt: parseFloat(transaction.amount),
      Line: [
        {
          Amount: parseFloat(transaction.amount),
          DetailType: 'AccountBasedExpenseLineDetail',
          Description: transaction.description || 'EAM System Expense',
          AccountBasedExpenseLineDetail: {
            AccountRef: {
              value: '1',
              name: 'Maintenance Expense',
            },
          },
        },
      ],
    };
    
    return new Promise((resolve, reject) => {
      qbo.createPurchase(expense, (err: any, result: any) => {
        if (err) {
          console.error('QuickBooks sync error:', err);
          reject(err);
        } else {
          console.log('Synced to QuickBooks:', result.Id);
          resolve(true);
        }
      });
    });
  } catch (error) {
    console.error('Failed to sync expense:', error);
    return false;
  }
}

/**
 * Sync all pending financial transactions
 */
export async function syncAllTransactions(config: QuickBooksConfig): Promise<SyncResult> {
  const transactions = await db.getFinancialTransactions();
  
  let synced = 0;
  let failed = 0;
  const errors: string[] = [];
  
  for (const transaction of transactions) {
    try {
      const success = await syncExpenseToQuickBooks(transaction.id, config);
      if (success) {
        synced++;
      } else {
        failed++;
        errors.push(`Transaction ${transaction.id}: Sync failed`);
      }
    } catch (error: any) {
      failed++;
      errors.push(`Transaction ${transaction.id}: ${error.message}`);
    }
  }
  
  return {
    success: failed === 0,
    synced,
    failed,
    errors,
  };
}

/**
 * Get QuickBooks company info
 */
export async function getCompanyInfo(config: QuickBooksConfig): Promise<any> {
  const qbo = createQuickBooksClient(config);
  
  return new Promise((resolve, reject) => {
    qbo.getCompanyInfo(config.realmId, (err: any, companyInfo: any) => {
      if (err) {
        reject(err);
      } else {
        resolve(companyInfo);
      }
    });
  });
}

/**
 * Test QuickBooks connection
 */
export async function testConnection(config: QuickBooksConfig): Promise<boolean> {
  try {
    await getCompanyInfo(config);
    return true;
  } catch (error) {
    console.error('QuickBooks connection test failed:', error);
    return false;
  }
}

/**
 * Generate random state for OAuth
 */
function generateRandomState(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

/**
 * Map EAM transaction types to QuickBooks expense categories
 */
export function mapTransactionCategory(type: string): string {
  const mapping: Record<string, string> = {
    'maintenance': 'Maintenance and Repairs',
    'purchase': 'Equipment Purchase',
    'depreciation': 'Depreciation Expense',
    'parts': 'Parts and Supplies',
    'labor': 'Labor Cost',
    'other': 'Other Expenses',
  };
  
  return mapping[type] || 'Other Expenses';
}

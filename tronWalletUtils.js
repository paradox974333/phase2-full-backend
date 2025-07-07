// tronWalletUtils.js
const { TronWeb } = require('tronweb');
const crypto = require('crypto');
const dotenv = require('dotenv'); // Load environment variables here too for ENCRYPTION_KEY check

dotenv.config(); // Load .env file

// Initialize TronWeb with mainnet (change to testnet for development)
// Ensure process.env.TRON_API_KEY is set in your .env file if needed for your provider
const tronWeb = new TronWeb({
  fullHost: 'https://api.trongrid.io', // Mainnet (or use a different provider URL)
  // fullHost: 'https://api.shasta.trongrid.io', // Testnet example
  // fullHost: 'https://api.nileex.io', // Nile Testnet example
  headers: { 'TRON-PRO-API-KEY': process.env.TRON_API_KEY || '' } // Optional but often required by providers
});

// Encryption key must be a 32-byte (256-bit) key. Represented as 64 hex characters.
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 64) {
  console.error('ERROR: ENCRYPTION_KEY must be a 64-character hex string (32 bytes). Please set it in your .env file.');
  // Exiting here is safer than allowing operations with a bad key.
  process.exit(1);
}

/**
 * Encrypt private key using AES-256-CBC
 * @param {string} privateKey - The private key to encrypt
 * @returns {string} - Encrypted private key in format: iv:encryptedData (both in hex)
 * @throws Error if encryption fails
 */
function encryptPrivateKey(privateKey) {
  try {
    // Create a random 16-byte Initialization Vector (IV)
    const iv = crypto.randomBytes(16);
    // Create cipher using AES-256-CBC, the hex key, and the IV
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
    // Update cipher with the data to encrypt (private key)
    let encrypted = cipher.update(privateKey, 'utf8');
    // Finalize encryption
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    // Return IV and encrypted data, separated by a colon, both as hex strings
    return iv.toString('hex') + ':' + encrypted.toString('hex');
  } catch (error) {
    // Log and re-throw specific error
    console.error('Encryption failed:', error);
    throw new Error('Failed to encrypt private key: ' + error.message);
  }
}

/**
 * Decrypt private key using AES-256-CBC
 * @param {string} encryptedPrivateKey - The encrypted private key (in iv:encryptedData hex format)
 * @returns {string} - Decrypted private key (original string)
 * @throws Error if decryption fails or format is invalid
 */
function decryptPrivateKey(encryptedPrivateKey) {
  try {
    // Split the string into IV and encrypted data parts
    const textParts = encryptedPrivateKey.split(':');
    if (textParts.length !== 2) {
      throw new Error('Invalid encrypted private key format');
    }

    // Convert hex IV and encrypted data back to Buffers
    const iv = Buffer.from(textParts[0], 'hex');
    const encryptedText = Buffer.from(textParts[1], 'hex');

    // Create decipher using AES-256-CBC, the hex key, and the IV
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
    // Update decipher with the encrypted data
    let decrypted = decipher.update(encryptedText);
    // Finalize decryption
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    // Return decrypted data as a UTF-8 string (the original private key)
    return decrypted.toString('utf8');
  } catch (error) {
    // Log and re-throw specific error
    console.error('Decryption failed:', error);
    throw new Error('Failed to decrypt private key: ' + error.message);
  }
}

/**
 * Generate a new TRON wallet
 * @returns {Promise<Object>} - Promise resolving to a wallet object with address and encrypted private key
 * @throws Error if wallet generation fails
 */
async function generateTronWallet() {
  try {
    // Use tronWeb to create a new account (wallet)
    const account = await tronWeb.createAccount();
    // Extract base58 address and private key
    const address = account.address.base58;
    const privateKey = account.privateKey;

    // Encrypt the generated private key before storing/returning
    const encryptedPrivateKey = encryptPrivateKey(privateKey);

    return {
      address,
      // Return the encrypted private key, NOT the plain one
      encryptedPrivateKey,
      // PublicKey is less sensitive, can be returned if needed
      publicKey: account.publicKey
    };
  } catch (error) {
    console.error('TRON wallet generation failed:', error);
    throw new Error('Failed to generate TRON wallet: ' + error.message);
  }
}

/**
 * Get wallet balance in TRX
 * @param {string} address - Wallet address
 * @returns {Promise<number>} - Promise resolving to the balance in TRX
 * @throws Error if fetching balance fails
 */
async function getWalletBalance(address) {
  try {
    // Get balance in SUN (smallest unit)
    const balance = await tronWeb.trx.getBalance(address);
    // Convert from SUN to TRX and return
    return tronWeb.fromSun(balance);
  } catch (error) {
    console.error(`Failed to get balance for ${address}:`, error);
    throw new Error(`Failed to get wallet balance for ${address}: ` + error.message);
  }
}

/**
 * Send TRX to another address
 * IMPORTANT: In a real application, this function should be protected and
 * only called for necessary, authorized transactions.
 * @param {string} fromAddress - Sender address
 * @param {string} encryptedPrivateKey - Encrypted private key of sender
 * @param {string} toAddress - Recipient address
 * @param {number} amount - Amount in TRX (not SUN)
 * @returns {Promise<Object>} - Promise resolving to transaction result
 * @throws Error if sending TRX fails
 */
async function sendTRX(fromAddress, encryptedPrivateKey, toAddress, amount) {
  try {
    // Decrypt the private key to sign the transaction
    const privateKey = decryptPrivateKey(encryptedPrivateKey);

    // Temporarily set the private key in tronWeb for signing
    // NOTE: Be cautious with setPrivateKey, ensure it's handled securely
    tronWeb.setPrivateKey(privateKey);

    // Validate addresses using tronWeb's utility
    if (!tronWeb.isAddress(fromAddress) || !tronWeb.isAddress(toAddress)) {
      throw new Error('Invalid address format');
    }

    // Convert amount from TRX to SUN
    const amountInSun = tronWeb.toSun(amount);

    // Optional: Check balance before sending
    // const balance = await getWalletBalance(fromAddress);
    // if (balance < amount) {
    //   throw new Error('Insufficient balance');
    // }

    // Create and send the transaction
    // sendTransaction handles signing internally when private key is set
    const transaction = await tronWeb.trx.sendTransaction(toAddress, amountInSun, fromAddress);

    // Clear the private key from tronWeb instance after use (good practice if tronWeb instance is shared)
    // However, in many simple server setups, a new instance might be implicitly handled per request,
    // or you manage state carefully. For simplicity here, we rely on the instance's scope.
    // For production, consider creating a new tronWeb instance per transaction or use external signers.
    // tronWeb.setPrivateKey(null); // Explicitly clear if needed

    return {
      success: true,
      txHash: transaction.txid,
      transaction // The raw transaction object
    };
  } catch (error) {
    console.error('Failed to send TRX:', error);
    throw new Error('Failed to send TRX: ' + error.message);
  } finally {
      // Ensure private key is unset if you set it globally
      // tronWeb.setPrivateKey(null);
  }
}

/**
 * Get transaction history for an address (TRX transfers)
 * Note: This uses tronscan API typically, which tronWeb interfaces with.
 * Limit the results to avoid excessive data.
 * @param {string} address - Wallet address
 * @param {number} limit - Number of transactions to fetch (default 20)
 * @returns {Promise<Array>} - Promise resolving to an array of transaction objects
 * @throws Error if fetching history fails
 */
async function getTransactionHistory(address, limit = 20) {
  try {
    // Get transactions from address (sent transactions)
    const sentTransactions = await tronWeb.trx.getTransactionsFromAddress(address, { limit });
    // Get transactions to address (received transactions)
    const receivedTransactions = await tronWeb.trx.getTransactionsToAddress(address, { limit });

    // Combine sent and received, remove duplicates if necessary (based on txID)
    // This is a simplified approach. A real app might query a block explorer API directly
    // with better filtering/pagination or use WebSockets for real-time updates.
    const allTransactions = [...sentTransactions, ...receivedTransactions];

    // Filter out duplicates by txID
    const uniqueTransactions = Array.from(new Map(allTransactions.map(tx => [tx.txID, tx])).values());

    // Map to a more readable format
    return uniqueTransactions
      .sort((a, b) => b.raw_data.timestamp - a.raw_data.timestamp) // Sort by timestamp desc
      .map(tx => {
        // Extract relevant data from the transaction object
        const contractData = tx.raw_data.contract[0]?.parameter?.value;
        const type = tx.raw_data.contract[0]?.type;

        let from = null;
        let to = null;
        let amount = 0;

        // Handle different transaction types, specifically TransferContract (TRX)
        if (type === 'TransferContract' && contractData) {
          from = tronWeb.address.fromHex(contractData.owner_address);
          to = tronWeb.address.fromHex(contractData.to_address);
          amount = contractData.amount ? tronWeb.fromSun(contractData.amount) : 0;
        }
        // Add logic here for other types if needed (e.g., TriggerSmartContract for tokens/DApps)

        return {
          txHash: tx.txID,
          timestamp: tx.raw_data.timestamp, // Unix timestamp in milliseconds
          type: type,
          amount: amount,
          from: from,
          to: to,
          status: tx.ret[0]?.contractRet // Transaction status (e.g., 'SUCCESS')
        };
      });

  } catch (error) {
    console.error(`Failed to get transaction history for ${address}:`, error);
    throw new Error(`Failed to get transaction history for ${address}: ` + error.message);
  }
}

/**
 * Validate TRON address format
 * @param {string} address - Address to validate
 * @returns {boolean} - True if address format is valid
 */
function isValidTronAddress(address) {
  return tronWeb.isAddress(address);
}

/**
 * Get account information (balance, bandwidth, energy etc.)
 * @param {string} address - Wallet address
 * @returns {Promise<Object>} - Promise resolving to account information
 * @throws Error if fetching account info fails
 */
async function getAccountInfo(address) {
  try {
    // Fetch account details from the network
    const account = await tronWeb.trx.getAccount(address);

    // If account doesn't exist, getAccount might return an empty object or throw.
    // Let's handle the case where the address is valid format but not on chain yet.
    if (!account || Object.keys(account).length === 0) {
       // Could return a default structure for a non-existent account
       return {
        address,
        balance: 0, // Balance is 0 if account doesn't exist yet
        bandwidth: 0,
        energy: 0,
        createTime: null, // No create time if not on chain
        accountType: 'NotActivated' // Or handle this case as an error depending on requirement
       };
    }

    // Get balance using the dedicated function for consistency
    const balance = await getWalletBalance(address);

    return {
      address,
      balance: balance, // Use the result from getWalletBalance (TRX)
      bandwidth: account.free_net_usage || 0, // Free bandwidth
      energy: account.account_resource?.energy_limit || 0, // Energy limit
      createTime: account.create_time || null, // Account creation timestamp
      accountType: account.type || 'Normal' // Account type
    };
  } catch (error) {
    console.error(`Failed to get account info for ${address}:`, error);
    // Specific error check if needed (e.g., address not found)
    // if (error.message.includes('Account not found')) { ... }
    throw new Error(`Failed to get account info for ${address}: ` + error.message);
  }
}

// Export relevant functions and the tronWeb instance if needed elsewhere
module.exports = {
  generateTronWallet,
  encryptPrivateKey, // Useful if you need to encrypt other data later
  decryptPrivateKey, // Useful for retrieving private key to sign transactions
  getWalletBalance,
  sendTRX,
  getTransactionHistory,
  isValidTronAddress,
  getAccountInfo,
  tronWeb // Export tronWeb instance if other modules need direct access
};
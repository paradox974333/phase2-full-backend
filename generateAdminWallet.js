const { generateTronWallet } = require('./tronWalletUtils');

(async () => {
  const wallet = await generateTronWallet();
  console.log('📥 Admin Wallet Address:', wallet.address);
  console.log('🔐 Encrypted Private Key:', wallet.encryptedPrivateKey);
})();

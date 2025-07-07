# Crypto Staking Platform

A comprehensive cryptocurrency staking application that allows users to deposit crypto, stake for rewards, and earn through referrals using an internal credit system.

## 🚀 Features

- **Unique Wallet Generation**: Each user receives a dedicated wallet address
- **Automated Fund Management**: Instant transfer to main wallet upon deposit
- **Credit-Based System**: Internal virtual currency for staking plans
- **Daily Reward Distribution**: Users receive daily credits throughout staking period
- **Multiple Staking Plans**: Various duration and reward options
- **Referral Program**: 10% commission on referred user's staking plans
- **Secure Withdrawals**: Convert credits back to cryptocurrency

## 🏗️ System Architecture

### Core Components

1. **Wallet Service**: Generates unique addresses and monitors deposits
2. **Credit System**: Internal virtual currency management
3. **Staking Engine**: Handles plan selection and daily reward distribution
4. **Withdrawal Service**: Processes credit-to-crypto conversions
5. **Referral System**: Tracks and rewards user referrals

### Data Flow

```
User Registration → Wallet Generation → Deposit Crypto → Credits Added → 
Select Staking Plan → Daily Rewards → Withdrawal Request → Crypto Transfer
```

## 💰 Staking Plans

### Available Plans

| Plan | Duration | Minimum Credits | Total Reward | Daily Reward |
|------|----------|----------------|--------------|--------------|
| Quick Stake | 7 days | 50 | 100% (100 credits) | ~14.29 credits/day |
| Standard Stake | 30 days | 100 | 250% (350 credits) | ~11.67 credits/day |
| Premium Stake | 90 days | 500 | 500% (3000 credits) | ~33.33 credits/day |
| Elite Stake | 180 days | 1000 | 1000% (11000 credits) | ~61.11 credits/day |

### Reward Calculation

- **Total Reward**: Plan percentage × Staked amount
- **Daily Reward**: Total reward ÷ Plan duration
- **Final Credits**: Original stake + Total reward

## 🔄 User Flow

### 1. Registration & Wallet Setup
- User creates account
- System generates unique wallet address
- Wallet address displayed to user

### 2. Deposit Process
- User sends cryptocurrency to their wallet address
- System monitors and verifies deposit
- Credits equal to deposit amount are added to user account
- Funds automatically transferred to main wallet

### 3. Staking Process
- User selects available staking plan
- System validates sufficient credits
- Staking period begins immediately
- Daily rewards are distributed automatically

### 4. Reward Distribution
- Credits are added daily based on plan calculation
- Users can view accumulated rewards in real-time
- Withdrawal available only after staking period completion

### 5. Withdrawal Process
- User requests withdrawal after staking period ends
- Provides withdrawal address and amount
- System validates credit balance
- Cryptocurrency sent to specified address

## 🤝 Referral Program

### How It Works
- Each user receives unique referral link
- Referrer earns 10% of completed staking plan value
- Rewards credited as additional credits
- No limit on referral earnings

### Example
- User A refers User B
- User B stakes 1000 credits in Elite Plan
- User A receives 100 credits (10% of 1000) as referral reward

## 🔧 Technical Implementation

### Required Components

#### Backend Services
- **Wallet Generator**: Creates unique addresses for each user
- **Blockchain Monitor**: Tracks deposits and confirmations
- **Credit Manager**: Handles virtual currency operations
- **Staking Engine**: Manages plans and daily distributions
- **Withdrawal Processor**: Handles crypto payouts

#### Database Schema
```sql
Users: id, email, wallet_address, credits, referral_code
Deposits: id, user_id, amount, tx_hash, status
Stakes: id, user_id, plan_id, amount, start_date, end_date, daily_reward
Withdrawals: id, user_id, amount, address, status, tx_hash
Referrals: id, referrer_id, referee_id, commission_earned
```

#### Security Features
- Multi-signature main wallet
- Encrypted private keys
- Rate limiting for API endpoints
- KYC/AML compliance checks
- Withdrawal address validation

## 📊 Administrative Features

### Dashboard Metrics
- Total deposits and withdrawals
- Active staking plans
- Daily reward distributions
- Referral program performance
- User activity statistics

### Risk Management
- Maximum daily withdrawal limits
- Automated fraud detection
- Balance reconciliation
- Reserve fund monitoring

## 🚨 Important Considerations

### Regulatory Compliance
- **Financial Services**: May require licensing depending on jurisdiction
- **Securities Law**: High-yield investment programs may be regulated
- **AML/KYC**: Identity verification requirements
- **Tax Reporting**: User earning disclosures

### Security Measures
- **Hot/Cold Wallet Strategy**: Minimize online fund exposure
- **Multi-signature**: Require multiple approvals for large transactions
- **Regular Audits**: Smart contract and system security reviews
- **Insurance**: Consider coverage for digital assets

### Financial Sustainability
- **Reserve Requirements**: Maintain sufficient funds for withdrawals
- **Risk Assessment**: High reward percentages require careful planning
- **Liquidity Management**: Ensure ability to process withdrawals

## 🛠️ Development Setup

### Prerequisites
- Node.js 18+
- PostgreSQL 13+
- Redis
- Blockchain node access (Bitcoin, Ethereum, etc.)

### Installation
```bash
git clone <repository-url>
cd crypto-staking-app
npm install
```

### Configuration
```env
DATABASE_URL=postgresql://user:pass@localhost/staking_db
REDIS_URL=redis://localhost:6379
MAIN_WALLET_ADDRESS=your_main_wallet_address
BLOCKCHAIN_API_KEY=your_blockchain_api_key
```

### Running the Application
```bash
npm run dev
```

## 📝 API Documentation

### Authentication
All API endpoints require JWT authentication except registration and login.

### Key Endpoints
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/wallet/address` - Get user's wallet address
- `POST /api/stake/create` - Create new staking plan
- `GET /api/stake/history` - View staking history
- `POST /api/withdraw/request` - Request withdrawal
- `GET /api/referral/link` - Get referral link

## 🧪 Testing

### Comprehensive End-to-End Testing Strategy

This section provides a complete testing methodology that covers every aspect of the crypto staking platform, from user registration to admin functions.

#### Phase 0: Setup - Testing Environment

**Prerequisites:**
- Postman Desktop App
- TronLink browser extension with test wallet
- Node.js server running (`node server.js`)
- MongoDB instance

**Environment Setup:**
1. **Clean Database State**
   ```bash
   mongosh
   db.users.deleteMany({})  # Clear all test data
   ```

2. **Postman Environment Variables**
   ```
   baseURL: http://localhost:5000
   aliceId: (populated during testing)
   aliceWallet: (populated during testing)
   aliceAuthToken: (populated during testing)
   bobId: (populated during testing)
   bobWallet: (populated during testing)
   bobAuthToken: (populated during testing)
   adminAuthToken: (populated during testing)
   personalWallet: (your TronLink address)
   ```

3. **Wallet Funding**
   - Personal wallet: 30+ TRX
   - Admin wallet: 15+ TRX (for withdrawal processing)

#### Phase 1: Complete User Lifecycle Testing

**Test User: Alice**

1. **Registration Test**
   ```http
   POST {{baseURL}}/register
   Content-Type: application/json
   
   {
     "username": "alice",
     "email": "alice@example.com",
     "password": "Password123!",
     "agreeToTerms": true
   }
   ```
   - Verify: 201 status, unique wallet address generated
   - Save: userId and walletAddress to environment

2. **Authentication Test**
   ```http
   POST {{baseURL}}/login
   Content-Type: application/json
   
   {
     "identifier": "alice@example.com",
     "password": "Password123!"
   }
   ```
   - Verify: 200 status, JWT token returned
   - Save: authToken to environment

3. **Deposit & Auto-Sweep Test**
   - Send 10 TRX to Alice's wallet via TronLink
   - Monitor server logs for automated deposit detection:
     ```
     🔍 Running deposit check...
     💰 Deposit of 10 TRX found for user alice.
     🧹 Swept 9.9 TRX from alice to admin. Tx: <hash>
     ```
   - Verify: User credits = 10 via profile endpoint

4. **Staking Test**
   ```http
   POST {{baseURL}}/api/staking/plan
   Authorization: Bearer {{aliceAuthToken}}
   Content-Type: application/json
   
   {
     "planId": "quick",
     "amount": 5
   }
   ```
   - Verify: Credits deducted, stake recorded
   - Check: Profile shows remaining credits = 5

5. **Transaction History Test**
   ```http
   GET {{baseURL}}/api/history
   Authorization: Bearer {{aliceAuthToken}}
   ```
   - Verify: Deposit (+10) and stake (-5) entries present

6. **Withdrawal Test**
   ```http
   POST {{baseURL}}/api/withdrawal/request
   Authorization: Bearer {{aliceAuthToken}}
   Content-Type: application/json
   
   {
     "withdrawalAddress": "{{personalWallet}}",
     "amount": 2
   }
   ```
   - Verify: 200 status, txHash returned
   - Check: TronLink wallet receives 2 TRX
   - Confirm: User credits reduced to 3

7. **KYC Upload Test**
   ```http
   POST {{baseURL}}/api/kyc/upload
   Authorization: Bearer {{aliceAuthToken}}
   Content-Type: multipart/form-data
   
   id_front: [image file]
   selfie: [image file]
   ```
   - Verify: KYC status set to "pending"

#### Phase 2: Referral System Testing

**Test Users: Alice (referrer) & Bob (referee)**

1. **Get Referral Code**
   ```http
   GET {{baseURL}}/api/referral/code
   Authorization: Bearer {{aliceAuthToken}}
   ```

2. **Register with Referral**
   ```http
   POST {{baseURL}}/register
   Content-Type: application/json
   
   {
     "username": "bob",
     "email": "bob@example.com",
     "password": "Password123!",
     "agreeToTerms": true,
     "referralCode": "<ALICE_REFERRAL_CODE>"
   }
   ```

3. **Fund & Stake as Bob**
   - Deposit 55 TRX to Bob's wallet
   - Stake 50 credits in quick plan
   - Verify: Bob's stake is active

4. **Simulate Referral Payout**
   - Database: Mark Bob's stake as "completed"
   - Temporarily adjust cron schedule for testing
   - Verify: Alice receives 5 credits referral bonus

#### Phase 3: Admin Function Testing

1. **Promote User to Admin**
   ```bash
   db.users.updateOne({username: "alice"}, {$set: {isAdmin: true}})
   ```

2. **Admin Authentication**
   - Login as Alice again to get admin-privileged token

3. **Admin Endpoints Testing**
   ```http
   GET {{baseURL}}/api/admin/stats
   GET {{baseURL}}/api/admin/users
   GET {{baseURL}}/api/admin/kyc/pending
   POST {{baseURL}}/api/admin/kyc/{{aliceId}}/approve
   POST {{baseURL}}/api/admin/users/{{bobId}}/credits
   ```

### Critical Test Scenarios

**Error Handling Tests:**
- Insufficient credits for staking
- Invalid withdrawal addresses
- Duplicate user registration
- Invalid authentication tokens
- Missing required fields

**Security Tests:**
- Unauthorized access to admin endpoints
- Token expiration handling
- SQL injection attempts
- File upload validation

**Performance Tests:**
- Concurrent user registration
- Multiple simultaneous deposits
- High-volume withdrawal requests
- Database query optimization

### Automated Testing Suite

#### Unit Tests
```bash
npm run test
```

#### Integration Tests
```bash
npm run test:integration
```

#### Load Testing
```bash
npm run test:load
```

### Testing Checklist

**Before Production:**
- [ ] All user flows tested end-to-end
- [ ] Deposit detection and auto-sweep working
- [ ] Daily reward distribution functional
- [ ] Withdrawal processing successful
- [ ] Referral system calculating correctly
- [ ] Admin functions accessible and secure
- [ ] Error handling comprehensive
- [ ] Performance benchmarks met
- [ ] Security vulnerabilities addressed

## 📈 Monitoring & Analytics

### Key Metrics
- Daily active users
- Deposit/withdrawal volumes
- Staking plan popularity
- Referral conversion rates
- System uptime and performance

### Alerts
- Large withdrawal requests
- Unusual deposit patterns
- System performance issues
- Security threats

## 🔄 Deployment

### Production Checklist
- [ ] Security audit completed
- [ ] Legal compliance verified
- [ ] Load testing passed
- [ ] Backup systems tested
- [ ] Monitoring configured
- [ ] Support documentation ready

### Scaling Considerations
- Database sharding for large user bases
- CDN for static assets
- Load balancing for high traffic
- Blockchain node redundancy

## 📞 Support

For technical support or questions about implementation, please refer to:
- Technical documentation
- API reference
- Security best practices
- Regulatory compliance guidelines

---

## ⚠️ Dependaces
```bash
npm install express mongoose dotenv cors express-rate-limit helmet crypto node-cron bcrypt jsonwebtoken tronweb multer nodemailer
```

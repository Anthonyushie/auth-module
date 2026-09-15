# 🔐 Authentication & Paid Content Module (Flutterwave Subscriptions)

A secure, production-ready Auth + Medium-style paid content system built with **Node.js**, **Express**, **TypeScript**, and **Prisma (PostgreSQL)**.

---

## ⚡ Features

### 🛡️ Authentication & Security
- **JWT Authentication**: Short-lived Access Tokens (15m) + Long-lived Refresh Tokens (7d).
- **HTTP-Only Cookies**: Refresh tokens stored securely in cookies to prevent XSS attacks.
- **Token Rotation & Reuse Detection**: Every refresh rotates token pairs; token reuse triggers automatic revocation of all user sessions.
- **Role-Based Access Control (RBAC)**: Middleware supporting role whitelisting (e.g. `requireRole(['admin'])`).
- **Password Hashing**: Secure password storage using `bcrypt` (work factor 12).
- **Security Headers**: Configured with `helmet` and strict CORS credentials policies.

### 📰 Articles / Paid Content (Medium-style, full paywall)
- **Gated reads**: `GET /api/articles` returns titles/metadata only (`body` never sent); detail returns `402 + subscribeUrl` without an active sub.
- **Roles**: `admin` creates/edits/deletes; `user` reads only with subscription.
- **Single-tier subscription**: one active sub per user, `status=Active && currentPeriodEnd>now`.
- **Cascade Deletions**: Deleting a user automatically cleans up their articles, subscription and tokens via PostgreSQL relations.

---

## 🗄️ Database Schema

The module uses Prisma ORM with PostgreSQL. Key models include:

- **`User`**: Core user accounts (`id`, `email`, `passwordHash`, `role`, timestamps).
- **`RefreshToken`**: Stored sessions for rotation and reuse detection.
- **`Article`**: Paid content (`title`, `slug`, `body`, `coverImageUrl`, `status`, `authorId`) with `status+createdAt` index.
- **`Subscription`**: Single-tier sub per user (`flwPlanId`, `flwSubscriptionId`, `txRef`, `status`, `currentPeriodEnd`).
- **`PaymentEvent`**: Audit log for checkout/verify/webhook payloads.

---

## 🚀 Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Configure `.env`
Create a `.env` file from `.env.example`:
```env
PORT=5000
DATABASE_URL="postgresql://user:password@localhost:5432/auth_db?schema=public"
JWT_ACCESS_SECRET="your-access-secret"
JWT_REFRESH_SECRET="your-refresh-secret"
JWT_ACCESS_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"
CLIENT_URL="http://localhost:3000"
FRONTEND_URL="http://localhost:3000"
BCRYPT_SALT_ROUNDS=12
FLW_PUBLIC_KEY="FLW_TEST_KEY"
FLW_SECRET_KEY="FLW_TEST_KEY"
FLW_ENCRYPTION_KEY="FLW_TEST_KEY"
FLW_PAYMENT_PLAN_ID=243392
FLW_WEBHOOK_SECRET_HASH="your-webhook-hash"
SUBSCRIPTION_AMOUNT=5000
SUBSCRIPTION_CURRENCY=NGN
```

### 3. Run Migrations & Generate Prisma Client
```bash
npx prisma migrate dev --name init
npx prisma generate
```

### 4. Start Server
```bash
# Development mode
npm run dev

# Production build
npm run build
npm start
```
Server runs at: `http://localhost:5000`

---

## 📡 API Reference

### Public Authentication Routes
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Register user (`email`, `password`, optional `role`) |
| `POST` | `/api/auth/login` | Authenticate; returns `accessToken` & sets `refreshToken` cookie |
| `POST` | `/api/auth/refresh` | Rotates token pair using HTTP-Only cookie |
| `POST` | `/api/auth/logout` | Revokes current session & clears cookie |

### Protected Auth Routes
*Require header: `Authorization: Bearer <accessToken>`*

| Method | Endpoint | Authorization | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/auth/profile` | `requireAuth` | Get authenticated user info |
| `GET` | `/api/auth/admin-dashboard` | `requireAuth`, `admin` | Admin dashboard / metrics |
| `GET` | `/api/auth/users` | `requireAuth`, `admin` | Get all users |
| `PUT` | `/api/auth/users/:id/role` | `requireAuth`, `admin` | Update user role |
| `DELETE` | `/api/auth/users/:id` | `requireAuth`, `admin` | Delete a user (cascade deletes articles/subscription) |

### Protected Article Routes (full paywall)
*Require header: `Authorization: Bearer <accessToken>`*

| Method | Endpoint | Description | Payload Example |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/articles?status=published` | List titles/metadata only (no body) | *None* |
| `GET` | `/api/articles/:idOrSlug` | Full body if subscribed/admin, else `402` | *None* |
| `POST` | `/api/articles` | Admin create (`title>=3`, `body>=50`) | `{"title":"...","body":"...","status":"Published"}` |
| `PUT` | `/api/articles/:id` | Admin update | `{"title":"..."}` |
| `DELETE` | `/api/articles/:id` | Admin delete | *None* |

### Payment Routes (Flutterwave Test Mode, plan 243392 / 5000 NGN / Monthly)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/payments/checkout` | Create `Pending` sub + return `{paymentLink,txRef}` |
| `GET` | `/api/payments/verify?transaction_id&tx_ref` | Server-side verify + activate |
| `POST` | `/api/payments/webhook` | Public, `verif-hash` check, fast `200` |
| `GET` | `/api/payments/status` | `{hasAccess,status,currentPeriodEnd,planId}` |

#### Paywall Response Example (`GET /api/articles/:slug` without sub)
```json
{
  "success": false,
  "code": "PAYMENT_REQUIRED",
  "subscribeUrl": "/api/payments/checkout"
}
```

---

## 🧪 Testing

- **REST Client / VS Code**: Open and run requests directly via [requests.http](./requests.http).
- **Health Check**: `GET http://localhost:5000/health`


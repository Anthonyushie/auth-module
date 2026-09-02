# 🔐 Authentication & Security Module

A secure, production-ready Auth system built with **Node.js**, **Express**, **TypeScript**, and **Prisma (PostgreSQL)**.

---

## ⚡ Features

- **JWT Authentication**: Short-lived Access Tokens (15m) + Long-lived Refresh Tokens (7d).
- **HTTP-Only Cookies**: Refresh tokens stored securely in cookies to prevent XSS.
- **Token Rotation & Reuse Detection**: Re-authenticating revokes old tokens. Replay attacks trigger automatic invalidation of all user sessions.
- **Role-Based Access Control (RBAC)**: `requireRole(['admin'])` middleware.
- **Password Hashing**: Secure `bcrypt` (work factor 12).

---

## 🚀 Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Configure `.env`
Set your PostgreSQL connection string and JWT secrets in `.env`:
```env
PORT=5000
DATABASE_URL="postgresql://user:password@localhost:5432/auth_db?schema=public"
JWT_ACCESS_SECRET="your-access-secret"
JWT_REFRESH_SECRET="your-refresh-secret"
```

### 3. Sync Database & Start Server
```bash
npx prisma db push
npm run dev
```
Server runs at: `http://localhost:5000`

---

## 📡 API Reference

### Public Routes
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Register user (`email`, `password`, `role`) |
| `POST` | `/api/auth/login` | Login, returns `accessToken` & sets `refreshToken` cookie |
| `POST` | `/api/auth/refresh` | Rotates token pair using HTTP-Only cookie |
| `POST` | `/api/auth/logout` | Revokes refresh token & clears cookie |

### Protected Routes
| Method | Endpoint | Authorization | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/auth/profile` | `Bearer <token>` | Current user profile |
| `GET` | `/api/auth/admin-dashboard` | `Bearer <token>` (`admin` only) | Admin metrics |

---

## 🧪 Testing

Open and execute the included [requests.http](./requests.http) file in VS Code / REST Client, or test via PowerShell / Postman.
# auth-module

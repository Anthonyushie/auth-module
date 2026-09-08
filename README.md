# 🔐 Authentication & Task Management Module

A secure, production-ready Auth and Task Management system built with **Node.js**, **Express**, **TypeScript**, and **Prisma (PostgreSQL)**.

---

## ⚡ Features

### 🛡️ Authentication & Security
- **JWT Authentication**: Short-lived Access Tokens (15m) + Long-lived Refresh Tokens (7d).
- **HTTP-Only Cookies**: Refresh tokens stored securely in cookies to prevent XSS attacks.
- **Token Rotation & Reuse Detection**: Every refresh rotates token pairs; token reuse triggers automatic revocation of all user sessions.
- **Role-Based Access Control (RBAC)**: Middleware supporting role whitelisting (e.g. `requireRole(['admin'])`).
- **Password Hashing**: Secure password storage using `bcrypt` (work factor 12).
- **Security Headers**: Configured with `helmet` and strict CORS credentials policies.

### 📋 Task Management (CRUD)
- **User-Isolated Task Management**: Full CRUD operations for tasks (`id`, `title`, `completed`, `userId`, `createdAt`, `updatedAt`).
- **Strict Ownership Checks**: Users can only access, update, and delete tasks they own.
- **IDOR / Resource Leak Protection**: Queries targeting unowned task IDs return `404 Not Found` rather than `403` to prevent object enumeration.
- **Cascade Deletions**: Deleting a user automatically cleans up their tasks and tokens via PostgreSQL relations.

---

## 🗄️ Database Schema

The module uses Prisma ORM with PostgreSQL. Key models include:

- **`User`**: Core user accounts (`id`, `email`, `passwordHash`, `role`, timestamps).
- **`RefreshToken`**: Stored sessions for rotation and reuse detection.
- **`Task`**: User tasks linked to `User` via foreign key `userId` with cascade delete and indexing for fast lookups.

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
BCRYPT_SALT_ROUNDS=12
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

### Protected Task Routes
*Require header: `Authorization: Bearer <accessToken>`*

| Method | Endpoint | Description | Payload Example |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/tasks` | Get all tasks owned by current user | *None* |
| `POST` | `/api/tasks` | Create a task for current user | `{"title": "Buy groceries"}` |
| `PUT` | `/api/tasks/:id` | Update task title and/or completed status | `{"title": "Updated", "completed": true}` |
| `DELETE` | `/api/tasks/:id` | Delete user task (ownership verified) | *None* |

#### Task Response Example (`GET /api/tasks` / `POST /api/tasks`)
```json
{
  "success": true,
  "message": "Task created successfully",
  "data": {
    "id": "c1f7b0f2-4e0a-426b-b4f7-873bfa99b418",
    "title": "Buy groceries",
    "completed": false,
    "createdAt": "2026-09-09T00:00:00.000Z",
    "updatedAt": "2026-09-09T00:00:00.000Z"
  }
}
```

---

## 🧪 Testing

- **REST Client / VS Code**: Open and run requests directly via [requests.http](./requests.http).
- **Health Check**: `GET http://localhost:5000/health`


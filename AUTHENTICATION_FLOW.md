# Authentication & Authorization Flow

## Overview

The YAZ Media Dashboard uses JWT (JSON Web Tokens) for authentication and role-based middleware for authorization. This document explains the complete flow.

---

## 1. Login Flow

### Step 1: User Submits Credentials
```
POST /auth/login
Body: {
  "email": "user@example.com",
  "password": "password123"
}
```

### Step 2: Backend Validates
```typescript
// In authController.ts
1. Find employee by email
2. Compare password with hashed password
3. Check if user is ACTIVE
4. Update lastLogin timestamp
5. Generate JWT token
```

### Step 3: Token Generated
```typescript
const token = generateToken({
  userId: employee.id,
  email: employee.email,
  role: employee.role,
});
```

### Step 4: Response Sent
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "user123",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "HR",
      "userStatus": "ACTIVE"
    }
  }
}
```

### Step 5: Frontend Stores Token
```typescript
// In frontend (React)
localStorage.setItem('token', response.data.token);
localStorage.setItem('user', JSON.stringify(response.data.user));
```

---

## 2. Protected Request Flow

### Step 1: Frontend Makes Request
```typescript
// In frontend API service
const response = await fetch('/api/employees', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

### Step 2: Request Reaches Backend
```
GET /employees
Headers: {
  "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Step 3: authMiddleware Processes
```typescript
// In middleware/auth.ts
1. Extract token from Authorization header
2. Verify token signature using JWT_SECRET
3. Decode token to get user data
4. Attach user data to req.user
5. Call next() to proceed
```

### Step 4: requireRole Middleware Checks
```typescript
// If endpoint requires specific roles
1. Check if req.user exists
2. Check if req.user.role is in allowed roles
3. If match: call next()
4. If no match: return 403 Forbidden
```

### Step 5: Controller Executes
```typescript
// Controller has access to user data
export const getEmployees = async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  const userRole = req.user?.role;
  
  // Execute business logic
  // Return response
};
```

### Step 6: Response Sent
```json
{
  "success": true,
  "data": [
    { "id": "emp1", "name": "John", "role": "EMPLOYEE" },
    { "id": "emp2", "name": "Jane", "role": "HR" }
  ]
}
```

---

## 3. Error Scenarios

### Scenario 1: No Token Provided
```
GET /employees
Headers: {} (no Authorization header)

Response: 401 Unauthorized
{
  "error": "No token provided"
}
```

### Scenario 2: Invalid Token
```
GET /employees
Headers: {
  "Authorization": "Bearer invalid_token_xyz"
}

Response: 401 Unauthorized
{
  "error": "Invalid token"
}
```

### Scenario 3: Expired Token
```
GET /employees
Headers: {
  "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." (expired)
}

Response: 401 Unauthorized
{
  "error": "Invalid token"
}
```

### Scenario 4: Insufficient Permissions
```
GET /payroll (requires FINANCE, MANAGEMENT, or ADMIN)
Headers: {
  "Authorization": "Bearer <EMPLOYEE_token>"
}

Response: 403 Forbidden
{
  "error": "Forbidden"
}
```

### Scenario 5: Inactive User
```
POST /auth/login
Body: {
  "email": "inactive@example.com",
  "password": "password123"
}

Response: 403 Forbidden
{
  "error": "Your account is not active"
}
```

---

## 4. Token Structure

### JWT Format
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ1c2VyMTIzIiwiZW1haWwiOiJ1c2VyQGV4YW1wbGUuY29tIiwicm9sZSI6IkhSIiwiaWF0IjoxNjk0NzY1NDAwLCJleHAiOjE2OTQ4NTE4MDB9.signature
```

### Header
```json
{
  "alg": "HS256",
  "typ": "JWT"
}
```

### Payload
```json
{
  "userId": "user123",
  "email": "user@example.com",
  "role": "HR",
  "iat": 1694765400,
  "exp": 1694851800
}
```

### Signature
```
HMACSHA256(
  base64UrlEncode(header) + "." +
  base64UrlEncode(payload),
  JWT_SECRET
)
```

---

## 5. Logout Flow

### Step 1: Frontend Clears Storage
```typescript
// In frontend
localStorage.removeItem('token');
localStorage.removeItem('user');
```

### Step 2: Frontend Redirects
```typescript
// Redirect to login page
navigate('/login');
```

### Step 3: Backend (Optional)
```typescript
// Backend can optionally:
// - Blacklist token
// - Log logout event
// - Update lastLogout timestamp
```

---

## 6. Google OAuth Flow

### Step 1: Frontend Gets Google Token
```typescript
// Using Google Sign-In library
const googleToken = await googleSignIn();
```

### Step 2: Frontend Sends to Backend
```
POST /auth/google
Body: {
  "token": "google_jwt_token"
}
```

### Step 3: Backend Verifies Google Token
```typescript
// In authController.ts
1. Verify Google token signature
2. Extract email from Google token
3. Find or create employee
4. Generate app JWT token
```

### Step 4: Response Sent
```json
{
  "success": true,
  "data": {
    "token": "app_jwt_token",
    "user": { ... }
  }
}
```

---

## 7. Middleware Chain Example

### Example: Create Employee Endpoint
```typescript
router.post(
  '/employees',
  authMiddleware,           // Step 1: Verify token
  requireRole('HR', 'ADMIN'), // Step 2: Check role
  createEmployee            // Step 3: Execute controller
);
```

### Request Flow
```
1. POST /employees with token
   ↓
2. authMiddleware
   - Extract token
   - Verify signature
   - Decode payload
   - Attach to req.user
   ↓
3. requireRole('HR', 'ADMIN')
   - Check req.user.role
   - Verify role matches
   ↓
4. createEmployee controller
   - Access req.user
   - Execute business logic
   - Return response
```

---

## 8. Security Best Practices

### Token Storage
```typescript
// ✓ Good: localStorage (for web apps)
localStorage.setItem('token', token);

// ✓ Better: httpOnly cookie (more secure)
// Set by backend in Set-Cookie header
```

### Token Transmission
```typescript
// ✓ Correct format
Authorization: Bearer <token>

// ✗ Wrong formats
Authorization: <token>
Authorization: JWT <token>
```

### Token Expiration
```typescript
// Set reasonable expiration
const token = jwt.sign(payload, secret, { expiresIn: '24h' });

// User must login again after expiration
```

### Secret Management
```typescript
// ✓ Use environment variable
const secret = process.env.JWT_SECRET;

// ✗ Never hardcode
const secret = 'my-secret-key';
```

### HTTPS Only
```typescript
// ✓ Always use HTTPS in production
// Prevents token interception

// ✗ Never use HTTP in production
```

---

## 9. Debugging Authentication Issues

### Enable Debug Logging
```typescript
// Middleware logs:
console.log('🔍 Auth Middleware Debug:', { url, method, authHeader });
console.log('🔐 requireRole Middleware:', { userRole, requiredRoles });
console.log('✅ Token verified for user:', email);
console.log('❌ Token verification failed:', error);
```

### Check Token Validity
```bash
# Decode token at jwt.io
# Verify:
# - Signature is valid
# - Token is not expired
# - Payload contains correct data
```

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| 401 on every request | Token not sent | Check Authorization header |
| 401 after login | Token invalid | Verify JWT_SECRET matches |
| 403 on valid token | Wrong role | Check user role in database |
| Token expires too fast | Short expiration | Increase expiresIn value |

---

## 10. Implementation Checklist

- ✓ JWT_SECRET set in environment variables
- ✓ authMiddleware applied to all protected routes
- ✓ requireRole applied to role-specific routes
- ✓ Token stored securely in frontend
- ✓ Token sent in Authorization header
- ✓ Error handling for 401 and 403
- ✓ Token refresh mechanism (optional)
- ✓ Logout clears token
- ✓ HTTPS enabled in production
- ✓ Rate limiting on auth endpoints



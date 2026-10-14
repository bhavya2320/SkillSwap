# SkillSwap Backend

This project provides the integrated authentication, profile, skill, swap, credit, message, session, and review APIs for the SkillSwap frontend.

## Tech stack

- Node.js
- Express.js
- MongoDB with Mongoose
- bcryptjs
- JWT
- express-validator
- Helmet
- express-rate-limit
- CORS
- Jest + Supertest

## Project structure

```text
skillswap-member2-backend/
src/
  config/
    db.js
  models/
    User.js
  controllers/
    authController.js
    userController.js
  routes/
    authRoutes.js
    userRoutes.js
  middleware/
    authMiddleware.js
    errorMiddleware.js
  validators/
    authValidators.js
    userValidators.js
  app.js
  server.js
tests/
  auth.test.js
  users.test.js
.env.example
.gitignore
package.json
README.md
```

## Setup

1. Copy `.env.example` to `.env`.
2. Set a MongoDB connection string in `MONGODB_URI`.
3. Set a strong random value in `JWT_SECRET`.
4. Install dependencies:

```bash
npm install
```

5. Start the server:

```bash
npm start
```

## MongoDB configuration

If you do not already have a database URI, create a free MongoDB Atlas cluster and copy the connection string.

Example:

```env
MONGODB_URI=mongodb+srv://yourUsername:yourPassword@cluster0.mongodb.net/skillswap-member2?retryWrites=true&w=majority
```

Use the actual username and password from your Atlas user. Do not commit the real `.env` file to Git.

## Frontend CORS configuration

Set `FRONTEND_ORIGIN` to the exact origin used by the frontend project, including protocol and port.

Example values:

```env
FRONTEND_ORIGIN=http://localhost:3000
FRONTEND_ORIGIN=https://your-frontend-domain.com
```

The frontend developer on another laptop should update this value to their local URL (for example `http://192.168.1.12:3000`) or the deployed production URL. Do not use wildcard origins with credentials.

## Authentication

Use the Authorization header with a Bearer token:

```http
Authorization: Bearer <jwt>
```

The JWT payload contains the authenticated user ID and is signed using `JWT_SECRET`. The token expiration is defined by `JWT_EXPIRES_IN`.

Future backend modules should use the same `protect` middleware to require a valid JWT before processing requests. Example:

```js
const { protect } = require('../middleware/authMiddleware');
router.get('/some-protected-route', protect, controllerFn);
```

Inside the controller, use `req.user` or `req.userId` to identify the logged-in user. Do not trust a client-supplied user ID.

## User model and profile fields

The user profile supports these fields:

- `name`: string
- `email`: normalized unique email address
- `bio`: optional string
- `teachingSkills`: array of strings such as `['JavaScript', 'React']`
- `learningSkills`: array of strings such as `['Python', 'UI/UX']`
- `availability`: array of strings such as `['Monday 6:00-8:00 PM', 'Wednesday 5:00-7:00 PM']`
- `profileImageUrl`: optional valid URL string
- `credits`: number, default `5`
- `role`: server-controlled value, default `user`

Protected fields such as `credits`, `role`, `email`, `passwordHash`, and verification status cannot be changed through the profile update route.

## API endpoints

### Auth routes

#### Register

`POST /api/auth/register`

Request body:

```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "password": "StrongPass123!",
  "confirmPassword": "StrongPass123!"
}
```

Response:

```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "token": "eyJ...",
    "user": {
      "_id": "66c123...",
      "name": "Jane Doe",
      "email": "jane@example.com",
      "credits": 5,
      "role": "user",
      "createdAt": "2026-10-09T00:00:00.000Z"
    }
  }
}
```

#### Login

`POST /api/auth/login`

Request body:

```json
{
  "email": "jane@example.com",
  "password": "StrongPass123!"
}
```

Response:

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "eyJ...",
    "user": {
      "_id": "66c123...",
      "name": "Jane Doe",
      "email": "jane@example.com",
      "credits": 5,
      "role": "user"
    }
  }
}
```

#### Get current user

`GET /api/auth/me`

Headers:

```http
Authorization: Bearer <jwt>
```

Response:

```json
{
  "success": true,
  "data": {
    "user": {
      "_id": "66c123...",
      "name": "Jane Doe",
      "email": "jane@example.com",
      "credits": 5,
      "role": "user"
    }
  }
}
```

### User routes

#### Get current user profile

`GET /api/users`

Headers:

```http
Authorization: Bearer <jwt>
```

#### Get public profile by ID

`GET /api/users/:id`

Response includes public profile fields without password, email, or credit balance.

#### Update profile

`PUT /api/users`

Headers:

```http
Authorization: Bearer <jwt>
```

Request body example:

```json
{
  "name": "Jane Smith",
  "bio": "I teach JavaScript and learn UX design.",
  "teachingSkills": ["JavaScript", "Node.js"],
  "learningSkills": ["Python", "Product Design"],
  "availability": ["Monday 6-8 PM", "Thursday 7-9 PM"],
  "profileImageUrl": "https://example.com/avatar.jpg"
}
```

Protected fields are rejected by the server.

## Error handling

The API uses consistent JSON responses:

```json
{
  "success": false,
  "message": "Helpful error message"
}
```

HTTP status codes are used as follows:

- `200` for successful GET/PUT requests
- `201` for successful registration
- `400` for validation or malformed request issues
- `401` for unauthenticated or invalid JWT
- `404` for missing resources
- `409` for duplicate email registration
- `500` for unexpected server errors

## Testing

Run the Jest tests with:

```bash
npm test
```

The test environment uses an in-memory MongoDB instance so the backend can be tested without a local MongoDB daemon.

## SkillSwap frontend integration

From the repository root, serve the frontend with `node frontend/server.js` at `http://127.0.0.1:5500` while the API runs on port `5000`. The CORS allowlist also supports `http://localhost:5500`, `http://localhost:3000`, and `http://localhost:5173`; configure `FRONTEND_ORIGIN` for other origins.

The integrated platform APIs use the shared `protect` middleware and derive private ownership from `req.user` or `req.userId`, not user IDs supplied by the browser.

Registration and lesson credit transfers require MongoDB transaction support (a replica-set deployment such as MongoDB Atlas). Registration records its initial 5-credit grant as a `signup_bonus` transaction atomically.

| Route | Supported operations |
| --- | --- |
| `/api/skills` | Authenticated create/list; `PUT /:id` update; `DELETE /:id`; search with `search`, `type`, and `userId` query parameters |
| `/api/swaps` | Authenticated create/list; `PATCH /:id/status` accept/reject; `PATCH /:id/complete` teacher lesson completion and credit transfer |
| `/api/credits/:userId` | Authenticated own-account balance and transaction history |
| `/api/messages` | Authenticated send; `GET /:swapId` participant conversation history |
| `/api/sessions` | Authenticated list/schedule; `PUT /:id/complete` |
| `/api/reviews` | Authenticated list of authored/received reviews, optionally by participant session; submit one review per completed session |

Session and review listing, skill updates, and ownership checks were added to support the frontend. Cancellation, real-time messaging, and a standalone user-search endpoint are not available; the frontend does not simulate those features. Search discovers members through their actual skill listings and links to public profiles.

Run `npm test` from `backend`; `tests/platform.test.js` covers integrated ownership and read endpoints with an in-memory MongoDB.

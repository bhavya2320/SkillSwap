# SkillSwap

SkillSwap is a vanilla HTML/CSS/JavaScript frontend connected to the Express/Mongoose API in `backend`. The application supports authentication, profiles, skill listings, swap requests, messages, scheduled sessions, reviews, and server-managed credit history.

## Local development

1. Configure `backend/.env` using `backend/.env.example` (MongoDB URI and JWT secret). Keep the real `.env` local; it is ignored by Git.
2. In a terminal, start the API:

   ```powershell
   cd backend
   npm install
   npm start
   ```

   The API listens on `http://localhost:5000`. Check `http://localhost:5000/api/health`.
3. In another terminal, start the static frontend server:

   ```powershell
   cd frontend
   node server.js
   ```

   Open `http://127.0.0.1:5500`. The backend CORS allowlist includes this origin, `http://localhost:5500`, and common development ports. If you use a different origin, set `FRONTEND_ORIGIN` in the backend environment.

   If port 5500 is already in use, start on the allowed port 3000 with `$env:FRONTEND_PORT = '3000'; node server.js` and open `http://127.0.0.1:3000`.

## Authentication and data

The frontend retains the `skillswap-token`, `skillswap-user`, `skillswap-name`, `skillswap-email`, and `skillswap-credits` local-storage keys. Protected requests send the JWT as `Authorization: Bearer <token>`. User identity, skill listings, balances, transactions, messages, requests, sessions, and reviews are loaded from the backend; credit balances are never changed in the browser.

The 5-credit registration grant and later teaching/learning transfers are recorded in the transaction ledger. Swap creation requires the requester to own a teaching listing and the receiver to own the requested teaching listing. A teacher marks a lesson complete from the Requests page; the backend performs the corresponding credit transfer. Session completion is separate, and is required before either participant can submit a review.

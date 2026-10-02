# Security Specification & Test Payloads

## 1. Data Invariants
1. A pharmacy user can only read and write their own data: `/users/{userId}/**` must strictly match `request.auth.uid == userId`.
2. Admin (`mirolab12@gmail.com`) can read all user records to activate accounts or manage subscriptions (`subscribedUntil`).
3. Regular users cannot escalate privileges or change `role` to 'admin' or alter their own `trialEndsAt` / `subscribedUntil` directly without admin rights.
4. All child collections (`suppliers`, `drugs`, `cart`) must belong to the authenticated user (`userId == request.auth.uid`).
5. A drug item cannot be inserted or updated with negative price or negative effectivePrice.
6. A supplier phone must be a valid phone string within length constraints.
7. Deletion of cart items and supplier records can only be done by the authenticated owner.

## 2. The "Dirty Dozen" Malicious Payloads (Should Return PERMISSION_DENIED)
1. **Unauthenticated Read**: Attempting to read `/users/{userId}` without being signed in.
2. **Cross-Tenant User Profile Read**: User A (`user_123`) reading `/users/user_456`.
3. **Cross-Tenant Drug Read**: User A querying drugs belonging to User B `/users/user_456/drugs`.
4. **Identity Spoofing on Drug Create**: User A inserting a drug under `/users/user_123/drugs/d1` with `userId: "user_456"`.
5. **Self-Assigned Admin Escalation**: User A attempting to update `/users/user_123` with `{ role: "admin" }` or `{ subscribedUntil: "2099-01-01" }`.
6. **Negative Price Poisoning**: User A inserting a drug with `{ price: -50, effectivePrice: -50 }`.
7. **Junk Field Injection (Shadow Update)**: User A sending `{ ghostField: "injected", name: "Panadol" }`.
8. **Malicious Document ID (ID Poisoning)**: Document ID containing non-alphanumeric special characters or huge 1KB strings.
9. **Unauthenticated Drug Creation**: Creating a drug document without an authenticated session.
10. **Cross-Tenant Cart Injection**: User A writing an item into User B's cart `/users/user_456/cart/item_1`.
11. **Negative Quantity Cart Item**: Inserting a cart item with `quantity: -5`.
12. **Admin Email Spoof without Verification**: An unverified account claiming `mirolab12@gmail.com` trying to write to another user's `subscribedUntil`.

# Security Specification: QueueLess

## Data Invariants
1. A Queue must have an `adminId` matching the creator.
2. A Token must belong to a user and link to the `adminId` of its parent Queue.
3. Users can only join a Queue if `status` is 'open'.
4. Users can only increment `totalTokensIssued` on a Queue document when also creating a Token for themselves.
5. Users can only cancel their own tokens.
6. Admins can only serve tokens from Queues they own.

## The "Dirty Dozen" (Attack Payloads)
1. **The Spoof**: User A tries to create a token for User B (`userId: 'UserB'`).
2. **The Ghost Admin**: User A tries to create a Queue with `adminId: 'SomeoneElse'`.
3. **The Skip**: User A tries to increment `totalTokensIssued` by 5 instead of 1.
4. **The Hijack**: User A tries to update User B's token status to `cancelled`.
5. **The Shadow Field**: User A tries to update a Token with `isVerifiedAdmin: true`.
6. **The Outcome Swap**: User A tries to change their token status to `completed` without being an admin.
7. **The ID Poison**: User A tries to use a 1MB string as a `queueId`.
8. **The Orphan Write**: User A tries to create a token for a non-existent Queue (checked via rules).
9. **The Forbidden Read**: User A tries to `list` all tokens in a Queue they don't own and haven't joined (rules must restrict to owned/joined).
10. **The Update Gap**: User A tries to update `tokenNumber` after joining.
11. **The PII Leak**: User A tries to `get` User B's profile (if profile collection exists - currently tokens store names).
12. **The Server-Side Bypass**: User A tries to set `joinedAt` to a future date instead of `request.time`.

// Which portal this frontend instance is serving.
// The SAME codebase runs as two separately-deployable instances on different
// ports so the staff/admin panel can be firewalled away from vendors:
//
//   NEXT_PUBLIC_PORTAL=vendor  → vendor/consumer app   (default, port 3001)
//   NEXT_PUBLIC_PORTAL=admin   → staff/company panel    (port 3002)
//
// Each instance rejects the wrong audience at login and blocks the other
// portal's routes (see the layout guards).
export const PORTAL = process.env.NEXT_PUBLIC_PORTAL === 'admin' ? 'admin' : 'vendor';
export const isAdminPortal = PORTAL === 'admin';
export const isVendorPortal = PORTAL === 'vendor';

// URLs of the sibling portal, used for "you're in the wrong place" messages.
export const VENDOR_URL = process.env.NEXT_PUBLIC_VENDOR_URL || 'http://localhost:3001';
export const ADMIN_URL = process.env.NEXT_PUBLIC_ADMIN_URL || 'http://localhost:3002';

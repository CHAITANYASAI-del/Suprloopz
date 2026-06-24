// Single source of truth for app routes. Both portals live under path prefixes
// on one domain so it deploys to a single Vercel project:
//   /vendor/*       → vendor / consumer portal
//   /admin/*  → staff / company admin portal
export const VENDOR_PREFIX = '/vendor';
export const ADMIN_PREFIX = '/admin';

export const routes = {
  // vendor portal
  vendorHome: VENDOR_PREFIX,
  vendorLogin: `${VENDOR_PREFIX}/login`,
  vendorActivate: `${VENDOR_PREFIX}/activate`,
  vendorReset: `${VENDOR_PREFIX}/reset-password`,
  vendorDashboard: `${VENDOR_PREFIX}/dashboard`,
  onboarding: (step) => `${VENDOR_PREFIX}/onboarding/${step}`,

  // admin portal
  adminLogin: `${ADMIN_PREFIX}/login`,
  adminSetPassword: `${ADMIN_PREFIX}/set-password`,
  adminHome: ADMIN_PREFIX,
  adminVendors: `${ADMIN_PREFIX}/vendors`,
  adminVendor: (id) => `${ADMIN_PREFIX}/vendors/${id}`,
  adminCallback: `${ADMIN_PREFIX}/auth/callback`,
};

// Resume onboarding at the first incomplete step.
export function nextOnboardingPath(o) {
  if (!o) return routes.onboarding('profile');
  if (o.fullyOnboarded) return routes.vendorDashboard;
  if (!o.profileCompleted) return routes.onboarding('profile');
  if (!o.companyInfoCompleted) return routes.onboarding('company');
  if (!o.legalDocsCompleted) return routes.onboarding('legal');
  if (!o.addressCompleted) return routes.onboarding('address');
  return routes.vendorDashboard;
}

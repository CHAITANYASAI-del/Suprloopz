import { Logo } from '@/components/Logo';

export const metadata = { title: 'Suprloopz — Coming soon' };

// Bare root is a placeholder until the marketing site ships. The two portals live
// at /admin (staff) and /vendor (vendors).
export default function Root() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-navy px-6 text-center text-white">
      <Logo light />
      <h1 className="mt-8 text-3xl font-semibold tracking-tight">Landing page coming soon</h1>
      <p className="mt-3 max-w-md text-sm text-white/70">
        We&apos;re putting the finishing touches on something great. Check back shortly.
      </p>
    </main>
  );
}

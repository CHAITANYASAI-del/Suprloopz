import './globals.css';
import { AuthProvider } from '@/lib/auth';

export const metadata = {
  title: 'SuperLoopz — Vendor Onboarding',
  description: 'Universal AI-native commerce operating system',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}

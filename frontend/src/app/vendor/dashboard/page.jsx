'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Clock, FileText } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { routes } from '@/lib/routes';
import { AppHeader } from '@/components/AppHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function DashboardPage() {
  const { ready, isAuthenticated, user } = useAuth();
  const router = useRouter();
  const [data, setData] = useState(null);
  const [company, setCompany] = useState(null);
  const [docs, setDocs] = useState([]);

  useEffect(() => {
    if (!ready) return;
    if (!isAuthenticated) router.replace(routes.vendorLogin);
  }, [ready, isAuthenticated, router]);

  useEffect(() => {
    if (!isAuthenticated) return;
    api.onboardingStatus().then(setData).catch(() => {});
    api.vendorCompany().then((r) => setCompany(r.company)).catch(() => {});
    api.vendorDocuments().then((r) => setDocs(r.documents || [])).catch(() => {});
  }, [isAuthenticated]);

  if (!ready || !isAuthenticated) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading…</div>;
  }

  const o = data?.onboarding;
  const steps = [
    ['Password set', o?.password_reset],
    ['Profile completed', o?.profile_completed],
    ['Company info', o?.company_info_completed],
    ['Legal documents', o?.legal_docs_completed],
    ['Addresses', o?.address_completed],
  ];

  return (
    <div className="min-h-screen bg-muted/30">
      <AppHeader subtitle="Dashboard" />
      <main className="mx-auto max-w-4xl space-y-6 px-4 py-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Welcome{company?.legal_name ? `, ${company.legal_name}` : ''}
          </h1>
          <p className="text-sm text-muted-foreground">{user?.email}</p>
        </div>

        {o?.fully_onboarded ? (
          <Card className="border-green-200 bg-green-50">
            <CardContent className="flex items-center gap-3 py-4">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
              <div>
                <p className="font-medium text-green-800">You are fully onboarded</p>
                <p className="text-sm text-green-700">Your vendor account is active.</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="flex items-center gap-3 py-4">
              <Clock className="h-6 w-6 text-amber-600" />
              <p className="text-sm text-amber-800">Your onboarding is still in progress.</p>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Onboarding checklist</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {steps.map(([label, done]) => (
                <div key={label} className="flex items-center justify-between text-sm">
                  <span>{label}</span>
                  {done ? (
                    <Badge variant="success">Done</Badge>
                  ) : (
                    <Badge variant="secondary">Pending</Badge>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Documents</CardTitle>
              <CardDescription>Verification status of your statutory documents.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {docs.length === 0 && <p className="text-sm text-muted-foreground">No documents yet.</p>}
              {docs.map((d) => (
                <div key={d.id} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" /> {d.doc_type} · {d.doc_number}
                  </span>
                  {d.verified ? (
                    <Badge variant="success">Verified</Badge>
                  ) : (
                    <Badge variant="warning">Under review</Badge>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

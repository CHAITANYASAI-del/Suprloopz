'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Clock, FileText, ArrowRight } from 'lucide-react';
import { db } from '@/lib/db';
import { useAuth } from '@/lib/auth';
import { routes } from '@/lib/routes';
import { AppHeader } from '@/components/AppHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

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
    db.onboarding().then(setData).catch(() => {});
    db.getCompany().then(setCompany).catch(() => {});
    db.getDocuments().then(setDocs).catch(() => {});
  }, [isAuthenticated]);

  if (!ready || !isAuthenticated) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading…</div>;
  }

  const o = data?.onboarding;
  const stepDefs = [
    { key: 'profile', label: 'Profile completed', done: !!o?.profile_completed },
    { key: 'company', label: 'Company info', done: !!o?.company_info_completed },
    { key: 'legal', label: 'Legal documents', done: !!o?.legal_docs_completed },
    { key: 'address', label: 'Addresses', done: !!o?.address_completed },
  ];
  const firstIncomplete = stepDefs.find((s) => !s.done)?.key || 'profile';

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
            <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
              <div className="flex items-center gap-3">
                <Clock className="h-6 w-6 shrink-0 text-amber-600" />
                <p className="text-sm text-amber-800">
                  Your onboarding is still in progress. Pick up where you left off.
                </p>
              </div>
              <Button onClick={() => router.push(routes.onboarding(firstIncomplete))}>
                Continue onboarding <ArrowRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Onboarding checklist</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {stepDefs.map((s) => (
                <div key={s.key} className="flex items-center justify-between text-sm">
                  <span>{s.label}</span>
                  {s.done ? (
                    <span className="flex items-center gap-2">
                      <Badge variant="success">Done</Badge>
                      <button
                        type="button"
                        onClick={() => router.push(routes.onboarding(s.key))}
                        className="text-xs font-medium text-primary hover:underline"
                      >
                        {s.key === 'legal' ? 'View' : 'Edit'}
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => router.push(routes.onboarding(s.key))}
                      className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                    >
                      Continue <ArrowRight className="h-3.5 w-3.5" />
                    </button>
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

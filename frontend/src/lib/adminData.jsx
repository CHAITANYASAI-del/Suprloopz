'use client';
// Shared admin data + notifications. Polls the vendor list, derives an activity
// feed (invited / accepted / onboarded), tracks unread state, and raises a toast
// when a vendor accepts their invitation. Consumed by the dashboard, the bell,
// and the toaster.
import { createContext, useContext, useCallback, useEffect, useRef, useState } from 'react';
import { adminApi } from '@/lib/adminApi';

const POLL_MS = 30000;
const SEEN_KEY = 'admin:notif:lastSeen';

const Ctx = createContext(null);
export const useAdminData = () => useContext(Ctx);

// Build a flat, time-sorted activity feed from the vendor rows.
function deriveEvents(vendors) {
  const events = [];
  for (const v of vendors) {
    const name = [v.first_name, v.last_name].filter(Boolean).join(' ') || v.email;
    if (v.invited_at) events.push({ id: `${v.id}:invited`, type: 'invited', vendorId: v.id, name, email: v.email, at: v.invited_at });
    if (v.accepted_at) events.push({ id: `${v.id}:accepted`, type: 'accepted', vendorId: v.id, name, email: v.email, at: v.accepted_at });
    if (v.fully_onboarded && v.completed_at) events.push({ id: `${v.id}:onboarded`, type: 'onboarded', vendorId: v.id, name, email: v.email, at: v.completed_at });
  }
  return events.sort((a, b) => new Date(b.at) - new Date(a.at));
}

export function AdminDataProvider({ children }) {
  const [vendors, setVendors] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastSeen, setLastSeen] = useState(0);
  const [toasts, setToasts] = useState([]);
  const knownAccepted = useRef(null); // Set of accepted vendor ids; null until first load

  useEffect(() => {
    setLastSeen(Number(localStorage.getItem(SEEN_KEY) || 0));
  }, []);

  const pushToast = useCallback((toast) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((t) => [...t, { id, ...toast }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 6000);
  }, []);
  const dismissToast = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const refresh = useCallback(async () => {
    try {
      const { vendors: vs, stats: st } = await adminApi.listAll();
      setVendors(vs);
      setStats(st);
      setError('');

      // Detect newly-accepted vendors → toast (skip on the very first load).
      const acceptedNow = vs.filter((v) => v.accepted);
      if (knownAccepted.current === null) {
        knownAccepted.current = new Set(acceptedNow.map((v) => v.id));
      } else {
        for (const v of acceptedNow) {
          if (!knownAccepted.current.has(v.id)) {
            knownAccepted.current.add(v.id);
            const name = [v.first_name, v.last_name].filter(Boolean).join(' ') || v.email;
            pushToast({ title: 'Invitation accepted', message: `${name} accepted the invitation and is onboarding.` });
          }
        }
      }
    } catch (err) {
      setError(err.message || 'Could not load vendors');
    } finally {
      setLoading(false);
    }
  }, [pushToast]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, POLL_MS);
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);
    return () => { clearInterval(t); window.removeEventListener('focus', onFocus); };
  }, [refresh]);

  const events = deriveEvents(vendors);
  const unreadCount = events.filter((e) => new Date(e.at).getTime() > lastSeen).length;
  const markAllSeen = useCallback(() => {
    const now = Date.now();
    localStorage.setItem(SEEN_KEY, String(now));
    setLastSeen(now);
  }, []);

  return (
    <Ctx.Provider value={{ vendors, stats, loading, error, refresh, events, unreadCount, lastSeen, markAllSeen, toasts, dismissToast }}>
      {children}
    </Ctx.Provider>
  );
}

import { useState } from 'react';
import { useAuth } from '../auth';
import { useStore } from '../store';
import { Badge, Button, Card, Field } from './ui';

// Account + cloud-sync panel. Renders three states:
//   - not configured  -> a hint on how to enable sync
//   - signed out       -> email/password sign in / sign up form
//   - signed in        -> account email, sync status, sign out
export function AccountSync() {
  const { configured, session, email, signIn, signUp, signOut } = useAuth();
  const { syncStatus, lastSyncedAt, cloudActive, syncNow } = useStore();

  const [tab, setTab] = useState<'signin' | 'signup'>('signin');
  const [form, setForm] = useState({ email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);

  if (!configured) {
    return (
      <Card>
        <div className="card-title">Cloud sync</div>
        <p className="muted" style={{ fontSize: 13.5 }}>
          Cross-device sync isn't configured for this build. Add your Supabase URL and anon key
          (see the <strong>README</strong> → “Cloud sync” section) to enable signing in and syncing
          your data between your laptop and phone.
        </p>
      </Card>
    );
  }

  const submit = async () => {
    setBusy(true);
    setMsg(null);
    const e = form.email.trim();
    if (!e || form.password.length < 6) {
      setMsg({ tone: 'err', text: 'Enter an email and a password of at least 6 characters.' });
      setBusy(false);
      return;
    }
    const res = tab === 'signin' ? await signIn(e, form.password) : await signUp(e, form.password);
    if (res.error) {
      setMsg({ tone: 'err', text: res.error });
    } else if ('needsConfirmation' in res && res.needsConfirmation) {
      setMsg({ tone: 'ok', text: 'Account created. Check your email to confirm, then sign in.' });
      setTab('signin');
    }
    setBusy(false);
  };

  // Signed in
  if (session) {
    const statusBadge =
      syncStatus === 'synced' ? (
        <Badge tone="safe">Synced</Badge>
      ) : syncStatus === 'syncing' ? (
        <Badge tone="info">Syncing…</Badge>
      ) : syncStatus === 'error' ? (
        <Badge tone="danger">Sync error</Badge>
      ) : (
        <Badge>Idle</Badge>
      );

    return (
      <Card>
        <div className="card-title">Account &amp; sync</div>
        <div className="spread" style={{ marginBottom: 10 }}>
          <span className="muted" style={{ fontSize: 13.5 }}>
            Signed in as <strong>{email}</strong>
          </span>
          {statusBadge}
        </div>

        {cloudActive ? (
          <p className="muted tiny" style={{ marginBottom: 12 }}>
            Your <strong>Personal</strong> data syncs automatically across devices.
            {lastSyncedAt
              ? ` Last synced at ${new Date(lastSyncedAt).toLocaleTimeString()}.`
              : ''}
          </p>
        ) : (
          <p className="muted tiny" style={{ marginBottom: 12 }}>
            Sync is paused in Demo mode. Switch to <strong>Personal</strong> mode to sync.
          </p>
        )}

        <div className="btn-row">
          {cloudActive && (
            <Button variant="secondary" onClick={syncNow}>
              🔄 Sync now
            </Button>
          )}
          <Button variant="ghost" onClick={() => signOut()}>
            Sign out
          </Button>
        </div>
      </Card>
    );
  }

  // Signed out -> auth form
  return (
    <Card>
      <div className="card-title">Sign in to sync across devices</div>
      <p className="muted" style={{ fontSize: 13.5, marginBottom: 14 }}>
        Use the same account on your laptop and phone to keep your Personal data in sync. Your data
        is private to your account.
      </p>

      <div className="form-grid">
        <Field label="Email">
          <input
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            placeholder="you@example.com"
          />
        </Field>
        <Field label="Password" hint="At least 6 characters">
          <input
            type="password"
            autoComplete={tab === 'signin' ? 'current-password' : 'new-password'}
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            placeholder="••••••••"
          />
        </Field>
      </div>

      {msg && (
        <div
          className="callout"
          style={
            msg.tone === 'ok'
              ? { background: 'var(--safe-bg)', color: '#166534', marginTop: 14 }
              : { background: 'var(--danger-bg)', color: '#991b1b', marginTop: 14 }
          }
        >
          {msg.text}
        </div>
      )}

      <div className="form-actions">
        <Button
          variant="ghost"
          onClick={() => {
            setTab(tab === 'signin' ? 'signup' : 'signin');
            setMsg(null);
          }}
        >
          {tab === 'signin' ? 'Create an account' : 'I already have an account'}
        </Button>
        <Button onClick={submit} disabled={busy}>
          {busy ? 'Please wait…' : tab === 'signin' ? 'Sign in' : 'Sign up'}
        </Button>
      </div>
    </Card>
  );
}

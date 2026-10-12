import { useId, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { ArrowLeft } from '@/components/ui/Icons';
import { Pill, SeverityBadge } from '@/components/ui/Severity';
import { Tab, TabList, TabPanel, Tabs } from '@/components/ui/Tabs';
import { FINDING_BY_ID } from '@/data/findings';
import { OWASP } from '@/data/taxonomy';
import { cn, whenText } from '@/lib/format';
import { statusLabel, useActiveEnv, useApp } from '@/store/app';
import type { EvidencePanel, FindingStatus } from '@/types';

type MarkAs = 'open' | 'fixed' | 'false-positive' | 'accepted-risk';

export function FindingDetailPage() {
  const { findingId } = useParams();
  const finding = findingId ? FINDING_BY_ID[findingId] : undefined;
  const state = useApp((s) => (findingId ? s.findings[findingId] : undefined));
  const setStatus = useApp((s) => s.setFindingStatus);
  const addHistory = useApp((s) => s.addFindingHistory);
  const showToast = useApp((s) => s.showToast);
  const env = useActiveEnv();
  const [tab, setTab] = useState('evidence');
  const [replay, setReplay] = useState<{ tone: 'crit' | 'pine' | 'caution'; text: string } | null>(null);
  const [replaying, setReplaying] = useState(false);
  const [reasonFor, setReasonFor] = useState<MarkAs | null>(null);
  const [reason, setReason] = useState('');
  const markId = useId();

  if (!finding || !state) {
    return (
      <div className="px-4 py-10 md:px-10">
        <p className="text-[16px] font-semibold">Finding not found</p>
        <Link to="/findings" className="link mt-2 inline-block">
          Back to all findings
        </Link>
      </div>
    );
  }

  const markValue: MarkAs =
    state.status === 'fixed' || state.status === 'verified'
      ? 'fixed'
      : state.status === 'false-positive' || state.status === 'accepted-risk'
        ? state.status
        : 'open';

  const mark = (value: MarkAs) => {
    if (value === markValue) return;
    if (value === 'false-positive' || value === 'accepted-risk') {
      setReason('');
      setReasonFor(value);
      return;
    }
    setStatus(finding.id, value as FindingStatus);
    setReplay(null);
    showToast('success', value === 'fixed' ? 'Marked Fixed. Replay the attack or rescan to verify it.' : 'Marked Open.');
  };

  const doReplay = async () => {
    if (finding.destructive && (env.safeMode || env.kind === 'production')) {
      setReplay({
        tone: 'caution',
        text:
          env.kind === 'production'
            ? `Replay blocked: this attack deletes data, and ${env.name} is a Production environment.`
            : 'Replay blocked: this attack deletes data and safe mode is on. Turn safe mode off to replay it against a fixture user that ApiArmor creates; real data is never touched.',
      });
      return;
    }
    setReplaying(true);
    setReplay(null);
    await new Promise((r) => setTimeout(r, 700));
    setReplaying(false);
    const fixed = useApp.getState().findings[finding.id]?.simulatedFixed;
    if (fixed) {
      setReplay({ tone: 'pine', text: 'Attack is now blocked. Fix confirmed.' });
      setStatus(finding.id, 'verified');
      addHistory(finding.id, 'Replayed attack: now blocked');
    } else {
      setReplay({ tone: 'crit', text: `Still vulnerable: the attack returned ${finding.evidence.attack.meta}.` });
      addHistory(finding.id, 'Replayed attack: still vulnerable');
    }
  };

  const copyCurl = async () => {
    try {
      await navigator.clipboard.writeText(finding.attackCurl);
      showToast('success', 'Copied the attack as cURL. Tokens are redacted.');
    } catch {
      showToast('error', 'Couldn’t access the clipboard. Select the command in the Evidence tab instead.');
    }
  };

  return (
    <div className="mx-auto max-w-[1180px] px-4 py-6 md:px-10 md:py-8">
      <Link to="/findings" className="inline-flex items-center gap-1.5 text-[15px] font-medium text-pine-ink hover:underline">
        <ArrowLeft className="h-4 w-4" /> All findings
      </Link>

      <div className="mt-5 flex flex-wrap items-start justify-between gap-5">
        <div className="min-w-0">
          <div className="flex flex-wrap gap-2">
            <SeverityBadge severity={finding.severity} size="md" />
            <Pill tone="pine">Confirmed</Pill>
            <Pill tone={state.status === 'came-back' ? 'caution' : 'neutral'}>{statusLabel(state.status)}</Pill>
          </div>
          <h2 className="mt-3 text-[26px] leading-tight font-semibold tracking-tight md:text-[32px]">{finding.title}</h2>
          <p className="mt-2 font-mono text-[14px]">
            {finding.method === 'ALL' ? 'All' : finding.method} {finding.endpoint}
          </p>
          <p className="mt-1.5 text-[15px] text-ink-2">
            {finding.owasp}:2025 {OWASP[finding.owasp]} · {finding.api}:2023 · {finding.cwe}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <Button variant="primary" onClick={doReplay} disabled={replaying} className="h-11">
            {replaying ? 'Replaying…' : 'Replay attack'}
          </Button>
          <label htmlFor={markId}>
            <span className="mb-1 block text-[13px] text-ink-2">Mark as</span>
            <select id={markId} className="select h-11 w-44 py-2" value={markValue} onChange={(e) => mark(e.target.value as MarkAs)}>
              <option value="open">Open</option>
              <option value="fixed">Fixed</option>
              <option value="false-positive">False positive</option>
              <option value="accepted-risk">Accepted risk</option>
            </select>
          </label>
          <Button onClick={copyCurl} className="h-11">
            Copy as cURL
          </Button>
        </div>
      </div>

      <div aria-live="polite">
        {replay && (
          <p
            className={cn(
              'mt-4 rounded-xl px-4 py-3 text-[15px] font-medium',
              replay.tone === 'crit' && 'bg-crit-soft text-crit',
              replay.tone === 'pine' && 'bg-pine-soft text-pine-ink',
              replay.tone === 'caution' && 'bg-caution-soft text-caution',
            )}
          >
            {replay.text}
          </p>
        )}
      </div>

      <Tabs value={tab} onValueChange={setTab} className="mt-6">
        <TabList label="Finding detail">
          <Tab value="evidence">Evidence</Tab>
          <Tab value="explain">Explanation and fix</Tab>
          <Tab value="history">History</Tab>
        </TabList>

        <TabPanel value="evidence" className="pt-6 outline-none">
          <p className="max-w-[80ch] text-[16px] leading-relaxed">{finding.evidence.intro}</p>
          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <EvidenceBox panel={finding.evidence.baseline} />
            <EvidenceBox panel={finding.evidence.attack} attack />
          </div>
          <p className="mt-4 text-[14px] text-ink-2">
            Lines starting with &minus; and + show the only difference between requests. Tokens and secrets are redacted.
            {finding.evidence.note && ` ${finding.evidence.note}`}
          </p>
        </TabPanel>

        <TabPanel value="explain" className="pt-6 outline-none">
          <div className="grid max-w-[80ch] gap-6">
            <section>
              <h3 className="text-[17px] font-semibold">What&rsquo;s wrong</h3>
              <p className="mt-1.5 text-[16px] leading-relaxed text-ink-2">{finding.explanation.what}</p>
            </section>
            <section>
              <h3 className="text-[17px] font-semibold">Why it matters</h3>
              <p className="mt-1.5 text-[16px] leading-relaxed text-ink-2">{finding.explanation.why}</p>
            </section>
            <section>
              <h3 className="text-[17px] font-semibold">How to fix it</h3>
              <p className="mt-1.5 text-[16px] leading-relaxed text-ink-2">{finding.explanation.fix}</p>
              <pre className="code-block mt-3 rounded-xl">
                <code>{finding.explanation.code}</code>
              </pre>
            </section>
            <p className="text-[14px] text-ink-3">
              Mapped to {finding.owasp}:2025 {OWASP[finding.owasp]} in the OWASP Top 10:2025, with {finding.api} from the OWASP API
              Security Top 10 (2023) as a cross-reference.
            </p>
          </div>
        </TabPanel>

        <TabPanel value="history" className="pt-6 outline-none">
          <dl className="mb-5 flex flex-wrap gap-x-10 gap-y-2 text-[15px]">
            <div>
              <dt className="text-ink-2">First seen</dt>
              <dd className="font-medium">{whenText(state.firstSeen)}</dd>
            </div>
            <div>
              <dt className="text-ink-2">Last seen</dt>
              <dd className="font-medium">{whenText(state.lastSeen)}</dd>
            </div>
            {state.verifiedAt && (
              <div>
                <dt className="text-ink-2">Verified fixed</dt>
                <dd className="font-medium text-pine-ink">{whenText(state.verifiedAt)}</dd>
              </div>
            )}
          </dl>
          <ol className="relative max-w-[80ch] border-l-2 border-line pl-6">
            {[...state.history].reverse().map((h, i) => (
              <li key={i} className="relative pb-5">
                <span className="absolute top-1.5 -left-[31px] h-3 w-3 rounded-full border-2 border-surface bg-pine" />
                <p className="text-[15px] font-medium">{h.text}</p>
                {h.reason && <p className="mt-0.5 text-[14px] text-ink-2">Reason: {h.reason}</p>}
                <p className="mt-0.5 text-[13px] text-ink-3">{whenText(h.at)}</p>
              </li>
            ))}
          </ol>
        </TabPanel>
      </Tabs>

      <Dialog
        open={Boolean(reasonFor)}
        onOpenChange={(o) => !o && setReasonFor(null)}
        title={reasonFor === 'false-positive' ? 'Why is this a false positive?' : 'Why accept this risk?'}
        description="Your reason is saved in the finding’s history so teammates can see why it was closed."
        footer={
          <>
            <Button onClick={() => setReasonFor(null)}>Cancel</Button>
            <Button
              variant="primary"
              disabled={reason.trim().length < 3}
              onClick={() => {
                setStatus(finding.id, reasonFor!, reason.trim());
                showToast('success', `Marked ${statusLabel(reasonFor!)}.`);
                setReasonFor(null);
              }}
            >
              Save
            </Button>
          </>
        }
      >
        <label>
          <span className="label">Reason (required)</span>
          <textarea
            className="input"
            rows={3}
            autoFocus
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={reasonFor === 'false-positive' ? 'e.g. Orders are intentionally shared within a household account' : 'e.g. Internal tool, behind VPN; fix planned for Q1'}
          />
        </label>
      </Dialog>
    </div>
  );
}

function EvidenceBox({ panel, attack }: { panel: EvidencePanel; attack?: boolean }) {
  return (
    <figure className={cn('overflow-hidden rounded-2xl border-2', attack ? 'border-crit' : 'border-line')}>
      <figcaption
        className={cn('flex flex-wrap items-center justify-between gap-2 px-5 py-3.5 text-[15px]', attack ? 'bg-crit-soft' : 'bg-surface')}
      >
        <span className="font-semibold">{panel.label}</span>
        <span className={cn('text-[14px] font-semibold', attack ? 'text-crit' : 'text-pine-ink')}>{panel.meta}</span>
      </figcaption>
      <pre className="code-block min-h-[180px] text-[13px]">
        {panel.lines.map((line, i) => {
          const minus = line.startsWith('- ');
          const plus = line.startsWith('+ ');
          return (
            <span
              key={i}
              className={cn('-mx-5 block px-5', minus && 'bg-[#5a2433]/70', plus && 'bg-[#2c5a46]/80')}
            >
              {minus ? <span aria-label="removed">− </span> : plus ? <span aria-label="added">+ </span> : null}
              {minus || plus ? line.slice(2) : line || ' '}
            </span>
          );
        })}
      </pre>
    </figure>
  );
}

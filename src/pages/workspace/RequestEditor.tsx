import * as DM from '@radix-ui/react-dropdown-menu';
import { useId, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { CheckIcon, ChevronDown } from '@/components/ui/Icons';
import { Tab, TabList, TabPanel, Tabs } from '@/components/ui/Tabs';
import { MOD } from '@/components/ShortcutsDialog';
import { useActiveEnv, useApp } from '@/store/app';
import { METHODS, type ApiRequest, type Method } from '@/types';
import { BodyPanel, HeadersPanel } from './HeadersBodyPanels';
import { AdvancedScanDialog } from './ScanDialogs';
import { SecurityPanel } from './SecurityPanel';
import { UrlField } from './UrlField';

const menuItem =
  'flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 text-[15px] text-ink outline-none data-[highlighted]:bg-surface-2';

export function RequestEditor({
  request,
  onSend,
  onScan,
  onScanCollection,
}: {
  request: ApiRequest & { dirty: boolean };
  onSend: () => void;
  onScan: () => void;
  onScanCollection: () => void;
}) {
  const env = useActiveEnv();
  const updateDraft = useApp((s) => s.updateDraft);
  const sending = useApp((s) => s.sending[request.id]);
  const scanning = useApp((s) => s.scans.some((x) => x.state === 'running'));
  const profile = useApp((s) => s.scanProfile);
  const setProfile = useApp((s) => s.setScanProfile);
  const [tab, setTab] = useState('security');
  const [advanced, setAdvanced] = useState(false);
  const urlId = useId();
  const methodId = useId();
  const enabledHeaders = request.headers.filter((h) => h.enabled).length;

  return (
    <div className="min-w-0">
      <p className="text-[15px] text-ink-2">
        {request.group} / <span className="font-semibold text-ink">{request.name}</span>
        {request.dirty && <span className="ml-2 rounded bg-brass-soft px-1.5 py-0.5 text-[12px] font-semibold text-brass-ink">Unsaved</span>}
      </p>

      <div className="mt-3 flex flex-wrap items-start gap-2.5">
        <label htmlFor={methodId} className="sr-only">
          Method
        </label>
        <select
          id={methodId}
          value={request.method}
          onChange={(e) => updateDraft(request.id, { method: e.target.value as Method })}
          className="select h-[46px] w-[104px] font-mono text-[14px] font-medium"
        >
          {METHODS.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
        <UrlField id={urlId} value={request.url} env={env} onChange={(url) => updateDraft(request.id, { url })} onSubmit={onSend} />
        <Button onClick={onSend} disabled={sending} className="h-[46px] px-6 text-[16px]" title={`Send (${MOD} Enter)`}>
          {sending ? 'Sending…' : 'Send'}
        </Button>
      </div>

      <div className="mt-3 flex items-center">
        <Button
          variant="primary"
          onClick={onScan}
          disabled={scanning}
          className="h-[46px] rounded-r-none px-6 text-[16px]"
          title={`Scan (${MOD} Shift Enter)`}
        >
          {scanning ? 'Scanning…' : 'Scan'}
        </Button>
        <DM.Root>
          <DM.Trigger asChild>
            <Button
              variant="primary"
              disabled={scanning}
              className="h-[46px] rounded-l-none border-l border-white/25 px-2.5"
              aria-label="Scan options"
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DM.Trigger>
          <DM.Portal>
            <DM.Content align="start" sideOffset={6} className="z-50 min-w-72 rounded-xl border border-line bg-surface p-1.5 shadow-xl">
              <DM.Label className="px-3 pt-1.5 pb-1 text-xs font-semibold tracking-wider text-ink-3 uppercase">Scan profile</DM.Label>
              {(
                [
                  ['default', 'Default', 'All checks that apply'],
                  ['passive', 'Passive only', 'Inspect responses; no attack probes'],
                ] as const
              ).map(([value, label, hint]) => (
                <DM.Item key={value} className={menuItem} onSelect={() => setProfile(value)}>
                  <span className="w-4">{profile === value && <CheckIcon className="h-4 w-4 text-pine" />}</span>
                  <span>
                    <span className="block">{label}</span>
                    <span className="block text-[13px] text-ink-2">{hint}</span>
                  </span>
                </DM.Item>
              ))}
              <DM.Separator className="my-1 h-px bg-line" />
              <DM.Item className={menuItem} onSelect={() => setAdvanced(true)}>
                <span className="w-4" />
                Advanced settings…
              </DM.Item>
              <DM.Item className={menuItem} onSelect={onScanCollection}>
                <span className="w-4" />
                Scan whole collection…
              </DM.Item>
            </DM.Content>
          </DM.Portal>
        </DM.Root>
        {profile === 'passive' && <span className="ml-3 text-[13px] text-ink-2">Profile: passive only</span>}
      </div>

      <Tabs value={tab} onValueChange={setTab} className="mt-5">
        <TabList label="Request settings">
          <Tab value="security">Security</Tab>
          <Tab value="headers">Headers ({enabledHeaders})</Tab>
          <Tab value="body">Body</Tab>
        </TabList>
        <TabPanel value="security" className="pt-5 outline-none">
          <SecurityPanel requestId={request.id} request={request} />
        </TabPanel>
        <TabPanel value="headers" className="pt-5 outline-none">
          <HeadersPanel headers={request.headers} onChange={(headers) => updateDraft(request.id, { headers })} />
        </TabPanel>
        <TabPanel value="body" className="pt-5 outline-none">
          <BodyPanel request={request} onChange={(body) => updateDraft(request.id, { body })} />
        </TabPanel>
      </Tabs>
      <AdvancedScanDialog open={advanced} onOpenChange={setAdvanced} />
    </div>
  );
}

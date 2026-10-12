import { useCallback, useEffect, useState } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { CloseIcon } from '@/components/ui/Icons';
import { MethodTag } from '@/components/ui/Severity';
import { cn } from '@/lib/format';
import { effectiveRequest, useApp } from '@/store/app';
import { useRequestActions } from './actions';
import { RequestEditor } from './RequestEditor';
import { RequestTree } from './RequestTree';
import { ResponsePanel } from './ResponsePanel';
import { ScanConfirmDialog, SecondIdentityDialog } from './ScanDialogs';

function useIsDesktop() {
  const query = '(min-width: 768px)';
  const [desktop, setDesktop] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setDesktop(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return desktop;
}

const handleCls =
  'group relative w-3 shrink-0 outline-none data-[panel-group-direction=vertical]:h-3 data-[panel-group-direction=vertical]:w-full';
function ResizeHandle({ label }: { label: string }) {
  return (
    <PanelResizeHandle className={handleCls} aria-label={label}>
      <div className="absolute inset-y-6 left-1/2 w-[3px] -translate-x-1/2 rounded-full bg-transparent transition-colors group-hover:bg-line-strong group-focus-visible:bg-brass-dark group-data-[panel-group-direction=vertical]:inset-x-6 group-data-[panel-group-direction=vertical]:inset-y-auto group-data-[panel-group-direction=vertical]:top-1/2 group-data-[panel-group-direction=vertical]:h-[3px] group-data-[panel-group-direction=vertical]:w-auto group-data-[panel-group-direction=vertical]:-translate-x-0 group-data-[panel-group-direction=vertical]:-translate-y-1/2 group-data-[resize-handle-state=drag]:bg-brass-dark" />
    </PanelResizeHandle>
  );
}

export function WorkspacePage() {
  const { requestId } = useParams();
  const navigate = useNavigate();
  const state = useApp();
  const { activeRequestId, openTabs, openRequest, requests, responseLayout } = state;
  const desktop = useIsDesktop();
  const [needsSecond, setNeedsSecond] = useState(false);
  const [scanTarget, setScanTarget] = useState<{ ids: string[]; name?: string } | null>(null);
  const [closing, setClosing] = useState<string | null>(null);

  const exists = requestId ? requests.some((r) => r.id === requestId) : false;
  useEffect(() => {
    if (requestId && exists && (activeRequestId !== requestId || !openTabs.includes(requestId))) openRequest(requestId);
  }, [requestId, exists, activeRequestId, openTabs, openRequest]);

  const id = requestId && exists ? requestId : null;
  const request = id ? effectiveRequest(state, id) : undefined;
  const onNeedSecondUser = useCallback(() => setNeedsSecond(true), []);
  const onConfirmScan = useCallback((ids: string[], name?: string) => setScanTarget({ ids, name }), []);
  const { send, scan, save } = useRequestActions(id, { onNeedSecondUser, onConfirmScan });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      if (e.key === 'Enter' && e.shiftKey) {
        e.preventDefault();
        scan();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        void send();
      } else if (e.key.toLowerCase() === 's') {
        e.preventDefault();
        save();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [send, scan, save]);

  if (!requestId) {
    const target = activeRequestId && requests.some((r) => r.id === activeRequestId) ? activeRequestId : 'get-order';
    return <Navigate to={`/collections/${target}`} replace />;
  }

  if (!desktop) {
    return (
      <div className="px-4 py-8">
        <div className="card p-6">
          <h2 className="text-[18px] font-semibold">The request editor needs a bigger screen</h2>
          <p className="mt-2 text-[15px] leading-relaxed text-ink-2">
            Building requests on a phone isn&rsquo;t practical, so the editor is desktop-only. You can still read findings,
            follow scans and change a finding&rsquo;s status here.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link to="/findings">
              <Button variant="primary">Open findings</Button>
            </Link>
            <Link to="/scans">
              <Button>View scans</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const closeTab = (tabId: string) => {
    const r = effectiveRequest(state, tabId);
    if (r?.dirty) return setClosing(tabId);
    doClose(tabId);
  };
  const doClose = (tabId: string) => {
    const idx = openTabs.indexOf(tabId);
    const remaining = openTabs.filter((t) => t !== tabId);
    state.closeTab(tabId);
    if (tabId === id) navigate(remaining.length ? `/collections/${remaining[Math.min(idx, remaining.length - 1)]}` : '/collections/get-order');
  };
  const closingReq = closing ? effectiveRequest(state, closing) : undefined;

  const editor = request ? (
    <div className="h-full overflow-auto pr-1 pb-8">
      <RequestEditor request={request} onSend={() => void send()} onScan={() => scan()} onScanCollection={() => onConfirmScan(requests.map((r) => r.id), 'the whole collection')} />
    </div>
  ) : (
    <div className="card p-8 text-center">
      <p className="text-[16px] font-semibold">That request doesn&rsquo;t exist</p>
      <p className="mt-1 text-ink-2">It may have been removed. Pick one from the collection.</p>
    </div>
  );

  return (
    <div className="flex h-[calc(100vh-68px)] min-h-[620px] flex-col px-6 pt-5 pb-4 lg:px-8">
      {openTabs.length > 0 && (
        <div role="tablist" aria-label="Open requests" className="mb-4 flex gap-1 overflow-x-auto">
          {openTabs.map((t) => {
            const r = effectiveRequest(state, t);
            if (!r) return null;
            const active = t === id;
            return (
              <div
                key={t}
                className={cn(
                  'group flex shrink-0 items-center rounded-lg border text-[14px]',
                  active ? 'border-line-strong bg-surface font-medium' : 'border-transparent text-ink-2 hover:bg-surface/70',
                )}
              >
                <button role="tab" aria-selected={active} onClick={() => navigate(`/collections/${t}`)} className="flex items-center gap-2 py-1.5 pr-1 pl-3">
                  <MethodTag method={r.method} className="text-[11px]" />
                  <span className="max-w-44 truncate">{r.name}</span>
                  {r.dirty && <span className="h-2 w-2 rounded-full bg-brass-dark" aria-label="unsaved" />}
                </button>
                <button
                  onClick={() => closeTab(t)}
                  aria-label={`Close ${r.name}`}
                  className="mr-1 grid h-6 w-6 place-items-center rounded text-ink-3 hover:bg-ink/10 hover:text-ink"
                >
                  <CloseIcon className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <PanelGroup direction="horizontal" autoSaveId="apiarmor-ws-h2" className="min-h-0 flex-1">
        <Panel defaultSize={27} minSize={20} maxSize={40} order={1}>
          <RequestTree activeId={id} onScanRequests={onConfirmScan} />
        </Panel>
        <ResizeHandle label="Resize collection pane" />
        {responseLayout === 'right' ? (
          <>
            <Panel defaultSize={44} minSize={30} order={2}>
              {editor}
            </Panel>
            <ResizeHandle label="Resize response pane" />
            <Panel defaultSize={29} minSize={20} order={3}>
              <div className="h-full overflow-auto">{id && <ResponsePanel requestId={id} />}</div>
            </Panel>
          </>
        ) : (
          <Panel defaultSize={73} minSize={40} order={2}>
            <PanelGroup direction="vertical" autoSaveId="apiarmor-ws-v">
              <Panel defaultSize={60} minSize={25}>
                {editor}
              </Panel>
              <ResizeHandle label="Resize response pane" />
              <Panel defaultSize={40} minSize={15}>
                <div className="h-full overflow-auto">{id && <ResponsePanel requestId={id} />}</div>
              </Panel>
            </PanelGroup>
          </Panel>
        )}
      </PanelGroup>

      <SecondIdentityDialog open={needsSecond} onOpenChange={setNeedsSecond} onSkip={() => scan({ allowMissingSecondUser: true })} />
      <ScanConfirmDialog
        open={Boolean(scanTarget)}
        onOpenChange={(o) => !o && setScanTarget(null)}
        requestIds={scanTarget?.ids ?? []}
        name={scanTarget?.name}
        kind={scanTarget?.ids.length === 1 ? 'request' : 'collection'}
      />
      <Dialog
        open={Boolean(closing)}
        onOpenChange={(o) => !o && setClosing(null)}
        title={`Save changes to “${closingReq?.name ?? ''}”?`}
        description="This request has unsaved changes. If you close it without saving, they’re lost."
        footer={
          <>
            <Button onClick={() => setClosing(null)}>Cancel</Button>
            <Button
              variant="ghost"
              onClick={() => {
                doClose(closing!);
                setClosing(null);
              }}
            >
              Don&rsquo;t save
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                state.saveRequest(closing!);
                doClose(closing!);
                setClosing(null);
              }}
            >
              Save and close
            </Button>
          </>
        }
      />
    </div>
  );
}

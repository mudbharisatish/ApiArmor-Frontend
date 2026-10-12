import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { planChecks } from '@/lib/scanPlan';
import { runningScan } from '@/lib/scanRunner';
import { simulateSend } from '@/lib/shoplabResponder';
import { accessFor, effectiveRequest, pairFor, useApp } from '@/store/app';

/** Send, scan and save for one request. Shared by the editor buttons and keyboard shortcuts. */
export function useRequestActions(
  id: string | null,
  { onNeedSecondUser, onConfirmScan }: { onNeedSecondUser?: () => void; onConfirmScan: (ids: string[]) => void },
) {
  const navigate = useNavigate();

  const send = useCallback(async () => {
    if (!id) return;
    const s = useApp.getState();
    if (s.sending[id]) return;
    const req = effectiveRequest(s, id);
    if (!req) return;
    const env = s.environments.find((e) => e.id === s.activeEnvId)!;
    const sender = s.identities.find((i) => i.id === pairFor(s, id).a);
    s.setSending(id, true);
    try {
      const res = await simulateSend({
        request: req,
        env,
        sender: sender?.name,
        senderSignedIn: sender ? sender.status !== 'failed' : false,
      });
      useApp.getState().setResponse(id, res);
    } finally {
      useApp.getState().setSending(id, false);
    }
  }, [id]);

  const scan = useCallback(
    (opts?: { allowMissingSecondUser?: boolean }) => {
      if (!id) return;
      const existing = runningScan();
      if (existing) {
        navigate(`/scans/${existing.id}`);
        return;
      }
      const s = useApp.getState();
      const req = effectiveRequest(s, id);
      if (!req) return;
      const pair = pairFor(s, id);
      const plan = planChecks({
        request: req,
        access: accessFor(s, id),
        identityA: s.identities.find((i) => i.id === pair.a),
        identityB: s.identities.find((i) => i.id === pair.b),
        env: s.environments.find((e) => e.id === s.activeEnvId)!,
        profile: s.scanProfile,
      });
      if (!opts?.allowMissingSecondUser && plan.some((p) => p.needsSecondUser) && onNeedSecondUser) {
        onNeedSecondUser();
        return;
      }
      onConfirmScan([id]);
    },
    [id, navigate, onNeedSecondUser, onConfirmScan],
  );

  const save = useCallback(() => {
    if (!id) return;
    const s = useApp.getState();
    const req = effectiveRequest(s, id);
    if (!req?.dirty) {
      s.showToast('info', 'No unsaved changes.');
      return;
    }
    s.saveRequest(id);
    s.showToast('success', `Saved “${req.name}”.`);
  }, [id]);

  return { send, scan, save };
}

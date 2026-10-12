import { useId, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Pill } from '@/components/ui/Severity';
import { SAMPLE_CURL } from '@/data/shoplab';
import { parseCurl } from '@/lib/curl';
import { uid } from '@/lib/format';
import { parseUrl } from '@/lib/url';
import { useApp } from '@/store/app';

export function HomePage() {
  const navigate = useNavigate();
  const openRequest = useApp((s) => s.openRequest);

  const openShopLab = () => {
    openRequest('get-order');
    navigate('/collections/get-order');
  };

  return (
    <div className="mx-auto max-w-[1180px] px-4 py-8 md:px-10 md:py-10">
      <p className="font-mono text-[13px] font-medium text-brass-ink">Mapped to the OWASP Top 10:2025</p>
      <h2 className="mt-3 max-w-[18ch] text-[32px] leading-[1.08] font-semibold tracking-[-0.02em] md:max-w-[22ch] md:text-[42px]">
        Find security problems in your API before attackers do
      </h2>
      <p className="mt-4 max-w-[62ch] text-[16px] leading-relaxed text-ink-2 md:text-[17px]">
        Build requests like any API client, then scan them for broken access control, weak authentication,
        misconfiguration and more. Everything runs on your computer.
      </p>

      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        <section className="flex flex-col rounded-2xl bg-night p-6 text-night-ink" aria-labelledby="demo-title">
          <Pill tone="brass" className="self-start bg-brass text-night">
            Recommended
          </Pill>
          <h3 id="demo-title" className="mt-4 text-[20px] font-semibold text-white">
            Try the demo API
          </h3>
          <p className="mt-2 text-[15px] leading-relaxed text-night-ink/85">
            ShopLab is a practice API with planted flaws and three ready test users. Your first finding takes about two
            minutes.
          </p>
          <Button variant="brass" size="lg" className="mt-6 h-auto min-h-12 w-full py-2 whitespace-normal lg:mt-auto" onClick={openShopLab}>
            Open ShopLab collection
          </Button>
        </section>

        <CurlCard />

        <section className="flex flex-col rounded-2xl border border-line bg-surface p-6" aria-labelledby="import-title">
          <Pill className="self-start">Coming in Phase 2</Pill>
          <h3 id="import-title" className="mt-4 text-[20px] font-semibold">
            Import a collection
          </h3>
          <p className="mt-2 text-[15px] leading-relaxed text-ink-2">
            Postman, OpenAPI or a browser HAR export. ApiArmor will list anything it could not import.
          </p>
          <Button size="lg" className="mt-6 w-full lg:mt-auto" disabled aria-describedby="import-title">
            Import file
          </Button>
        </section>
      </div>

      <section className="card mt-6 p-6" aria-labelledby="before-title">
        <h3 id="before-title" className="text-[18px] font-semibold">
          Before you scan your own API
        </h3>
        <ol className="mt-4 grid gap-5 md:grid-cols-3">
          {[
            ['Add a second test user.', 'Access tests compare what two users can see.'],
            ['Mark who should use each endpoint.', 'This prevents false alarms.'],
            ['Keep safe mode on.', 'Only read-only tests run until you turn it off.'],
          ].map(([strong, rest], i) => (
            <li key={strong} className="flex gap-3">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brass-soft text-[13px] font-semibold text-brass-ink">
                {i + 1}
              </span>
              <p className="text-[15px] leading-relaxed text-ink-2">
                <strong className="font-semibold text-ink">{strong}</strong> {rest}
              </p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function CurlCard() {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const addRequest = useApp((s) => s.addRequest);
  const showToast = useApp((s) => s.showToast);
  const navigate = useNavigate();
  const errorId = useId();
  const fieldId = useId();

  const create = () => {
    const result = parseCurl(text);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    const { method, url, headers, body } = result.value;
    const id = uid('req');
    const path = parseUrl(url).path || url;
    addRequest({ id, group: 'Imported', name: `${method} ${path}`, method, url, headers, body, imported: true });
    showToast('success', `Created an imported request with ${headers.length} header${headers.length === 1 ? '' : 's'}.`);
    setText('');
    navigate(`/collections/${id}`);
  };

  return (
    <section className="flex flex-col rounded-2xl border border-line bg-surface p-6" aria-labelledby="curl-title">
      <h3 id="curl-title" className="text-[20px] font-semibold">
        Paste a cURL command
      </h3>
      <label htmlFor={fieldId} className="mt-2 text-[15px] text-ink-2">
        From your browser&rsquo;s dev tools or terminal.
      </label>
      <textarea
        id={fieldId}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') create();
        }}
        rows={4}
        spellCheck={false}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        placeholder={"curl http://localhost:8080/api/users/12 -H 'Authorization: Bearer …'"}
        className="input mt-4 resize-y font-mono text-[13px] leading-relaxed aria-[invalid=true]:border-crit"
      />
      {error && (
        <p id={errorId} className="mt-2 text-[14px] font-medium text-crit">
          {error}
        </p>
      )}
      <Button variant="primary" size="lg" className="mt-3 w-full" onClick={create}>
        Create request
      </Button>
      <button
        className="link mt-4 self-start text-[14px]"
        onClick={() => {
          setText(SAMPLE_CURL);
          setError(null);
        }}
      >
        Use a sample command
      </button>
    </section>
  );
}

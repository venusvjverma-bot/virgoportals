import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Check, Copy, ExternalLink, QrCode as QrIcon } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Notice } from '@/components/ui/Notice';

interface QrViewProps {
  link: string;
}

export function QrView({ link }: QrViewProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(link, {
      width: 512,
      margin: 2,
      color: { dark: '#1C1917', light: '#FFFFFF' },
    })
      .then((url) => {
        if (active) setDataUrl(url);
      })
      .catch(() => {
        if (active) setError('Could not build the QR code.');
      });
    return () => {
      active = false;
    };
  }, [link]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Copy failed. Select the link and copy it manually.');
    }
  }

  return (
    <div className="max-w-xl space-y-5">
      <Card className="animate-fade-in text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-olive-100 text-olive-700">
          <QrIcon className="h-7 w-7" />
        </div>
        <h2 className="mt-4 font-display text-xl font-semibold tracking-tight text-ink">
          Your visitor QR
        </h2>
        <p className="mt-1.5 text-sm text-ink-muted">
          Guests scan this to open your menu page. No login needed.
        </p>

        <div className="mt-6 flex justify-center">
          {dataUrl ? (
            <img
              src={dataUrl}
              alt="QR code for your visitor menu link"
              className="h-56 w-56 rounded-2xl bg-white p-3 shadow-soft ring-1 ring-cream-200"
            />
          ) : (
            <div className="flex h-56 w-56 items-center justify-center rounded-2xl bg-cream-100 text-sm text-ink-faint ring-1 ring-inset ring-cream-200">
              Building QR…
            </div>
          )}
        </div>

        {error ? <Notice tone="error" className="mt-5 text-left">{error}</Notice> : null}

        <div className="mt-6 flex flex-col gap-2 rounded-xl bg-cream-50 p-3 ring-1 ring-inset ring-cream-200 sm:flex-row sm:items-center">
          <span className="min-w-0 flex-1 truncate text-left text-sm text-olive-700">{link}</span>
          <div className="flex shrink-0 gap-2">
            <Button variant="secondary" size="sm" onClick={copyLink}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copied' : 'Copy'}
            </Button>
            <a href={link} target="_blank" rel="noreferrer">
              <Button variant="secondary" size="sm">
                <ExternalLink className="h-4 w-4" />
                Open
              </Button>
            </a>
          </div>
        </div>
      </Card>
    </div>
  );
}

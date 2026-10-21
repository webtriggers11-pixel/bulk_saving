import { useState } from 'react';
import { normalisePhone } from '@bulk/shared';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { useDevWhatsApp } from './useDevWhatsApp';

/**
 * DEV ONLY (FEAT-027): the phone's half of the sign-in, by hand. What the stub sender
 * "replies" shows up here with its buttons; tapping one does what WhatsApp would.
 */
export function DevWhatsAppPanel({ code }: { code: string }) {
  const [phone, setPhone] = useState('+91 99999 00201');
  const dev = useDevWhatsApp(code);
  const plausible = normalisePhone(phone) !== null;
  return (
    <section className="mt-6 rounded-tile border border-dashed border-amber-ink/40 bg-amber-ink/5 p-4" data-testid="dev-whatsapp-panel" aria-label="Dev only: simulate WhatsApp">
      <p className="mb-3 text-[10px] font-extrabold uppercase tracking-[0.18em] text-amber-ink">Dev only · Simulate WhatsApp</p>
      <Label htmlFor="dev-wa-phone">Pretend to be this number</Label>
      <Input id="dev-wa-phone" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="num" />
      <Button variant="secondary" size="sm" className="mt-3 w-full" disabled={!plausible || dev.busy} onClick={() => void dev.sendMessage(phone)} data-testid="dev-wa-send">
        {dev.busy ? 'Sending…' : 'Send the login message as this number'}
      </Button>
      {dev.error && <p className="mt-2 text-meta font-semibold text-danger-ink">{dev.error}</p>}
      {dev.prompt && (
        <div className="mt-4 rounded-tile bg-paper/80 p-3" data-testid="dev-wa-prompt">
          <p className="whitespace-pre-line text-caption text-ink">{dev.prompt.body}</p>
          {dev.prompt.buttons.length > 0 && (
            <div className="mt-3 flex gap-2">
              {dev.prompt.buttons.map((b) => (
                <Button key={b.id} variant="outline" size="sm" className="flex-1" disabled={dev.busy} onClick={() => void dev.tap(phone, b.id)} data-testid="dev-wa-button">
                  {b.title}
                </Button>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

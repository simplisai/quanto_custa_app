import { useState } from "react";
import { MessageCircle, Send, X } from "lucide-react";

interface Props {
  /** Called with the normalized phone number */
  onShare: (phone: string) => Promise<void> | void;
  /** Pre-fill the phone from a selected client */
  prefilledPhone?: string;
  disabled?: boolean;
  isLoading?: boolean;
}

/**
 * A button that opens an inline phone input and triggers WhatsApp sharing.
 * Desktop → downloads PDF + opens WhatsApp Web.
 * Mobile  → native share sheet (PDF attachment).
 */
export function WhatsAppShareButton({ onShare, prefilledPhone, disabled, isLoading }: Props) {
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState(prefilledPhone ?? "");

  // Sync with external prefilledPhone changes (e.g. client selected after opening)
  const handleOpen = () => {
    setPhone(prefilledPhone ?? "");
    setOpen(true);
  };

  const handleSend = async () => {
    if (!phone.trim()) return;
    await onShare(phone);
    setOpen(false);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSend();
    if (e.key === "Escape") setOpen(false);
  };

  // Format as user types: keep only digits + common chars
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(e.target.value);
  };

  if (open) {
    return (
      <div className="flex w-full min-w-0 items-center gap-1.5 rounded-xl border-2 border-[#25D366]/60 bg-[#25D366]/5 px-2 py-1 sm:w-auto">
        <MessageCircle className="h-4 w-4 shrink-0 text-[#25D366]" />
        <input
          autoFocus
          value={phone}
          onChange={handleChange}
          onKeyDown={handleKey}
          placeholder="(11) 9 8765-4321"
          type="tel"
          className="w-full min-w-0 flex-1 bg-transparent text-sm font-medium outline-none placeholder:text-muted-foreground/60 sm:w-36 sm:flex-none"
        />
        <button
          onClick={handleSend}
          disabled={!phone.trim() || isLoading}
          aria-label="Enviar"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#25D366] text-white transition hover:bg-[#1ebe5d] active:scale-95 disabled:opacity-40"
          title="Enviar"
        >
          <Send className="h-4 w-4" />
        </button>
        <button
          onClick={() => setOpen(false)}
          aria-label="Cancelar"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted active:scale-95"
          title="Cancelar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleOpen}
      disabled={disabled || isLoading}
      title="Enviar via WhatsApp"
      className="flex min-h-[44px] items-center gap-2 rounded-xl border-2 border-[#25D366]/40 bg-[#25D366]/10 px-3 py-2 text-sm font-bold text-[#25D366] transition hover:bg-[#25D366]/20 active:scale-[0.98] disabled:opacity-40"
    >
      <MessageCircle className="h-4 w-4" />
      <span className="hidden sm:inline">WhatsApp</span>
    </button>
  );
}

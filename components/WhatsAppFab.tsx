import { whatsappLink } from "@/config/site";
import { t } from "@/content";
import { WhatsAppIcon } from "./WhatsAppIcon";

export function WhatsAppFab() {
  return (
    <a
      href={whatsappLink(t.whatsapp.prefill)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t.whatsapp.label}
      title={t.whatsapp.label}
      className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] end-4 z-40 grid size-14 place-items-center rounded-full bg-emerald text-cream ring-1 ring-cream/40 transition-transform hover:scale-105 hover:bg-emerald-700 focus-visible:outline-offset-4 sm:end-6"
    >
      <WhatsAppIcon className="size-7" />
    </a>
  );
}

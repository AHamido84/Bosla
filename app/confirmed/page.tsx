import type { Metadata } from "next";
import { ConfirmedView } from "@/components/ConfirmedView";
import { t } from "@/content";

export const metadata: Metadata = {
  title: t.confirmed.metaTitle,
  robots: { index: false, follow: false },
};

export default function ConfirmedPage() {
  return (
    <div className="container-page">
      <ConfirmedView />
    </div>
  );
}

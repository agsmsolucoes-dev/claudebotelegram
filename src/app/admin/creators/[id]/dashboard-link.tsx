"use client";

import { useState } from "react";

export function DashboardLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="flex max-w-md gap-2">
      <input
        readOnly
        value={url}
        className="flex-1 rounded border border-zinc-300 px-3 py-2 text-sm text-zinc-600"
        onFocus={(e) => e.target.select()}
      />
      <button
        type="button"
        onClick={async () => {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
        className="rounded bg-zinc-900 px-4 py-2 text-sm text-white hover:bg-zinc-700"
      >
        {copied ? "Copiado!" : "Copiar"}
      </button>
    </div>
  );
}

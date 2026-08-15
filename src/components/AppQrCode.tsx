"use client";

import { useEffect, useState } from "react";

export default function AppQrCode() {
  const [url, setUrl] = useState<string | null>(null);
  const [dataUri, setDataUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const origin = window.location.origin;
    Promise.resolve().then(() => setUrl(origin));
    fetch("/api/settings/app/qr-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: origin }),
    })
      .then((res) => res.json())
      .then((body) => {
        if (body.dataUri) setDataUri(body.dataUri);
        else setError(body.error ?? "Failed to generate QR code");
      })
      .catch(() => setError("Failed to generate QR code"));
  }, []);

  return (
    <div className="surface-card flex flex-col items-center gap-3 text-center">
      <h3 className="font-medium">Scan to open on your phone</h3>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {dataUri ? (
        // eslint-disable-next-line @next/next/no-img-element -- a small data: URI, not a real asset Next's <Image> optimizer applies to
        <img src={dataUri} alt="QR code for this app's URL" width={240} height={240} className="rounded-lg" />
      ) : (
        !error && <div className="h-[240px] w-[240px] animate-pulse rounded-lg bg-black/[0.05] dark:bg-white/[0.05]" />
      )}
      {url && <p className="font-mono text-xs text-muted">{url}</p>}
      <p className="max-w-sm text-sm text-muted">
        Open your phone&apos;s camera, point it at the code, then tap the link that pops up. Once the page
        loads, use your browser&apos;s &quot;Add to Home Screen&quot; / &quot;Install app&quot; option to install it.
      </p>
      <p className="text-xs text-muted">
        This only works if your phone can actually reach this address — same Wi-Fi network for a local
        install, or a real domain if this app is deployed to a server.
      </p>
    </div>
  );
}

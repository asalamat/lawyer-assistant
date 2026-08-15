"use client";

import { useEffect, useState } from "react";

// A phone scanning a QR code encoding "http://localhost:3000" would try to
// reach itself, not this machine — localhost only ever means "this same
// device." Detected by hostname, not just assumed, since some setups
// really do use a real domain/IP already (nothing to swap out then).
function isLocalhost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

export default function AppQrCode() {
  const [url, setUrl] = useState<string | null>(null);
  const [lanIps, setLanIps] = useState<string[]>([]);
  const [selectedIp, setSelectedIp] = useState<string | null>(null);
  const [noLanIp, setNoLanIp] = useState(false);
  const [dataUri, setDataUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const { protocol, hostname, port } = window.location;
    if (!isLocalhost(hostname)) {
      Promise.resolve().then(() => setUrl(window.location.origin));
      return;
    }

    fetch("/api/settings/app/network-info")
      .then((res) => res.json())
      .then((body: { lanIps: string[] }) => {
        if (body.lanIps.length > 0) {
          setLanIps(body.lanIps);
          setSelectedIp(body.lanIps[0]);
          setUrl(`${protocol}//${body.lanIps[0]}${port ? `:${port}` : ""}`);
        } else {
          setNoLanIp(true);
        }
      })
      .catch(() => setNoLanIp(true));
  }, []);

  useEffect(() => {
    if (!url) return;
    fetch("/api/settings/app/qr-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    })
      .then((res) => res.json())
      .then((body) => {
        if (body.dataUri) setDataUri(body.dataUri);
        else setError(body.error ?? "Failed to generate QR code");
      })
      .catch(() => setError("Failed to generate QR code"));
  }, [url]);

  function handleSelectIp(ip: string) {
    setSelectedIp(ip);
    setUrl(`${window.location.protocol}//${ip}${window.location.port ? `:${window.location.port}` : ""}`);
  }

  return (
    <div className="surface-card flex flex-col items-center gap-3 text-center">
      <h3 className="font-medium">Scan to open on your phone</h3>
      {noLanIp && (
        <p className="max-w-sm text-sm text-red-600">
          Couldn&apos;t detect this machine&apos;s network address automatically — the server this app is
          running on may not have a real network interface (e.g. a container with no LAN access). A QR code
          to &quot;localhost&quot; wouldn&apos;t work from a phone, so none is shown.
        </p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {dataUri ? (
        // eslint-disable-next-line @next/next/no-img-element -- a small data: URI, not a real asset Next's <Image> optimizer applies to
        <img src={dataUri} alt="QR code for this app's URL" width={240} height={240} className="rounded-lg" />
      ) : (
        !error &&
        !noLanIp && (
          <div className="h-[240px] w-[240px] animate-pulse rounded-lg bg-black/[0.05] dark:bg-white/[0.05]" />
        )
      )}
      {lanIps.length > 1 && (
        <label className="flex items-center gap-2 text-xs text-muted">
          Network:
          <select
            value={selectedIp ?? ""}
            onChange={(e) => handleSelectIp(e.target.value)}
            className="surface-input py-1 text-xs"
          >
            {lanIps.map((ip) => (
              <option key={ip} value={ip}>
                {ip}
              </option>
            ))}
          </select>
        </label>
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

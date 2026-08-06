"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function RefreshButton() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  return (
    <button
      type="button"
      onClick={() => {
        setRefreshing(true);
        router.refresh();
        setTimeout(() => setRefreshing(false), 500);
      }}
      className="btn-secondary text-sm"
    >
      {refreshing ? "Refreshing…" : "Refresh"}
    </button>
  );
}

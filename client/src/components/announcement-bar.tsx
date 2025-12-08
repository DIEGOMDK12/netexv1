import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useState } from "react";

interface AnnouncementBarProps {
  resellerId?: number;
}

interface AnnouncementData {
  enabled: boolean;
  text: string;
  backgroundColor: string;
  textColor: string;
}

export function AnnouncementBar({ resellerId }: AnnouncementBarProps) {
  const [dismissed, setDismissed] = useState(false);

  const { data: announcement } = useQuery<AnnouncementData>({
    queryKey: ["/api/announcement", resellerId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (resellerId) params.append("resellerId", resellerId.toString());
      const response = await fetch(`/api/announcement?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch announcement");
      return response.json();
    },
    staleTime: 60000,
  });

  if (!announcement?.enabled || dismissed || !announcement.text) {
    return null;
  }

  return (
    <div
      className="w-full py-2 px-4 text-center text-sm font-medium relative"
      style={{
        backgroundColor: announcement.backgroundColor || "#9333EA",
        color: announcement.textColor || "#FFFFFF",
      }}
      data-testid="announcement-bar"
    >
      <span data-testid="text-announcement">{announcement.text}</span>
      <button
        onClick={() => setDismissed(true)}
        className="absolute right-2 top-1/2 -translate-y-1/2 opacity-70 hover:opacity-100 transition-opacity"
        aria-label="Fechar anúncio"
        data-testid="button-dismiss-announcement"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

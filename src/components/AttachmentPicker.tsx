import { useEffect, useMemo } from "react";
import { FileText, Image as ImageIcon, X } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { formatBytes } from "@/lib/uploads";

export type PendingFile = { id: string; file: File; progress: number; error?: string };

export function PendingAttachments({
  items,
  onRemove,
  disabled,
}: {
  items: PendingFile[];
  onRemove: (id: string) => void;
  disabled?: boolean;
}) {
  if (!items.length) return null;
  return (
    <div className="flex flex-wrap gap-2 pb-2" aria-label="Attachments to send">
      {items.map((it) => (
        <PendingCard key={it.id} item={it} onRemove={onRemove} disabled={disabled} />
      ))}
    </div>
  );
}

function PendingCard({ item, onRemove, disabled }: { item: PendingFile; onRemove: (id: string) => void; disabled?: boolean }) {
  const isImage = item.file.type.startsWith("image/");
  const url = useMemo(() => (isImage ? URL.createObjectURL(item.file) : null), [item.file, isImage]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  return (
    <div className="relative w-40 rounded-lg border bg-card p-2 text-xs" data-testid="pending-attachment">
      <button
        type="button"
        aria-label={`Remove ${item.file.name}`}
        onClick={() => onRemove(item.id)}
        disabled={disabled}
        className="absolute -right-2 -top-2 rounded-full border bg-background p-0.5 shadow hover:bg-accent disabled:opacity-50"
      >
        <X className="h-3 w-3" />
      </button>
      {url ? (
        <img src={url} alt={item.file.name} className="mb-1 h-20 w-full rounded object-cover" />
      ) : (
        <div className="mb-1 flex h-20 items-center justify-center rounded bg-muted">
          {isImage ? <ImageIcon className="h-6 w-6" /> : <FileText className="h-6 w-6 text-primary" />}
        </div>
      )}
      <div className="truncate font-medium" title={item.file.name}>{item.file.name}</div>
      <div className="text-muted-foreground">{formatBytes(item.file.size)}</div>
      {item.progress > 0 && <Progress value={item.progress} className="mt-1 h-1" />}
      {item.error && <div className="mt-1 text-destructive">{item.error}</div>}
    </div>
  );
}

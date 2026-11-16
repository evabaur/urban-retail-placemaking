"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
export function RoundWindow({
  round,
  busy,
  onSave,
}: {
  round: Record<string, any>;
  busy: boolean;
  onSave: (value: Record<string, unknown>) => Promise<any>;
}) {
  const date = round.closes ? new Date(round.closes) : null;
  const local =
    date && Number.isFinite(date.getTime())
      ? new Date(date.getTime() - date.getTimezoneOffset() * 60000)
          .toISOString()
          .slice(0, 16)
      : "";
  return (
    <form
      className="form-stack"
      onSubmit={(e) => {
        e.preventDefault();
        const value = String(new FormData(e.currentTarget).get("closes") || "");
        onSave({
          id: round.id,
          open: round.open,
          closes: value ? new Date(value).toISOString() : null,
        }).catch(() => {});
      }}
    >
      <label>
        Close automatically (your local time)
        <Input name="closes" type="datetime-local" defaultValue={local} />
      </label>
      <Button variant="outline" disabled={busy}>
        Save closing time
      </Button>
    </form>
  );
}

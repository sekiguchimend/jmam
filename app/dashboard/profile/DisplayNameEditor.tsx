"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui";
import { updateMyDisplayName } from "@/actions/profile";

type Props = {
  initialName: string | null;
};

const MAX_NAME_LEN = 50;

export function DisplayNameEditor({ initialName }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentName, setCurrentName] = useState<string | null>(initialName);
  const [name, setName] = useState<string>(initialName ?? "");

  const display = useMemo(() => {
    const v = (currentName ?? "").trim();
    return v ? v : "未設定";
  }, [currentName]);

  const startEdit = () => {
    setError(null);
    setName(currentName ?? "");
    setEditing(true);
  };

  const cancelEdit = () => {
    setError(null);
    setName(currentName ?? "");
    setEditing(false);
  };

  const save = () => {
    setError(null);
    const trimmed = name.trim();
    if (trimmed.length > MAX_NAME_LEN) {
      setError(`表示名は${MAX_NAME_LEN}文字以内で入力してください`);
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.set("name", trimmed);
      const res = await updateMyDisplayName({ ok: false }, formData);
      if (!res.ok) {
        setError(res.error ?? "表示名の更新に失敗しました");
        return;
      }

      setCurrentName(res.name ?? null);
      setEditing(false);
      router.refresh();
    });
  };

  if (!editing) {
    return (
      <div className="flex items-center gap-2">
        <p className="text-sm lg:text-base font-bold truncate" style={{ color: "#323232" }}>
          {display}
        </p>
        <button
          type="button"
          onClick={startEdit}
          disabled={isPending}
          className="p-1 hover:opacity-70 transition-opacity disabled:opacity-50"
        >
          <Pencil className="w-4 h-4" style={{ color: "#323232" }} />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <input
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={MAX_NAME_LEN}
          className="flex-1 min-w-0 px-2 py-1.5 lg:px-3 lg:py-2 rounded-lg text-sm font-bold transition-all"
          style={{
            border: "1px solid var(--border)",
            background: "var(--surface)",
            color: "#323232",
          }}
          placeholder="表示名（未設定も可）"
        />
        <Button
          type="button"
          size="sm"
          onClick={save}
          isLoading={isPending}
          className="shrink-0 whitespace-nowrap"
        >
          保存
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={cancelEdit}
          disabled={isPending}
          className="shrink-0 whitespace-nowrap"
        >
          キャンセル
        </Button>
      </div>
      {error && (
        <p className="text-xs font-bold" style={{ color: "#dc2626" }}>
          {error}
        </p>
      )}
      <p className="text-[11px] font-bold" style={{ color: "var(--text-muted)" }}>
        ※ 最大{MAX_NAME_LEN}文字
      </p>
    </div>
  );
}



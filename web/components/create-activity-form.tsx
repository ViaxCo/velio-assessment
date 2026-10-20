"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, type Activity } from "@/lib/api";
import { useIdentity } from "@/lib/identity";
import { Button, Card, inputClass, Notice } from "./ui";

export function CreateActivityForm() {
  const { userId } = useIdentity();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const create = useMutation({
    mutationFn: (form: FormData) =>
      api.createActivity(userId!, {
        title: String(form.get("title")),
        description: String(form.get("description")),
        startsAt: new Date(String(form.get("startsAt"))).toISOString(),
        priceMinor: Number(String(form.get("price")).replaceAll(",", "")) * 100,
        capacity: Number(form.get("capacity")),
      }),
    onSuccess: (activity) => {
      queryClient.setQueryData<Activity[]>(["activities"], (activities = []) =>
        [...activities, activity].sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
      );
      setOpen(false);
    },
  });

  if (!open) {
    return (
      <Button arrow onClick={() => setOpen(true)}>
        Create an activity
      </Button>
    );
  }

  return (
    <Card>
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          create.mutate(new FormData(event.currentTarget));
        }}
      >
        <h2 className="text-xl">New activity</h2>
        <input name="title" placeholder="Sunset Kayaking" className={inputClass} required minLength={3} maxLength={80} />
        <textarea name="description" placeholder="What should people expect?" className={inputClass} rows={3} maxLength={1000} />
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm">
            <span className="mb-1 block font-medium text-ink/80">Spots</span>
            <input name="capacity" type="number" min={1} max={1000} defaultValue={10} className={inputClass} required />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-ink/80">Price (₦)</span>
            <input
              name="price"
              inputMode="numeric"
              defaultValue="15,000"
              onChange={({ target }) => {
                const fromEnd = target.value.length - (target.selectionStart ?? 0);
                const digits = target.value.replace(/\D/g, "");
                target.value = digits && Number(digits).toLocaleString("en-NG");
                target.setSelectionRange(target.value.length - fromEnd, target.value.length - fromEnd);
              }}
              className={inputClass}
              required
            />
          </label>
        </div>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-ink/80">Starts</span>
          <input name="startsAt" type="datetime-local" className={inputClass} required />
        </label>
        {create.error && <Notice tone="error" title="We couldn't create this activity">{create.error.message}</Notice>}
        <div className="flex justify-end gap-3">
          <Button type="button" onClick={() => setOpen(false)} className="!bg-transparent ring-1 ring-ink/15 enabled:hover:!bg-ink/5">
            Cancel
          </Button>
          <Button arrow type="submit" pending={create.isPending}>
            Create
          </Button>
        </div>
      </form>
    </Card>
  );
}

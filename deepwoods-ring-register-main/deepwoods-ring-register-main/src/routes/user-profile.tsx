import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { TopLevelShell } from "@/components/portal/shell";
import { Field, inputCls } from "@/components/portal/primitives";

export const Route = createFileRoute("/user-profile")({
  head: () => ({
    meta: [
      { title: "User profile — Deepwoods GHG Portal" },
      {
        name: "description",
        content: "Your Deepwoods GHG Portal login details, role and password settings.",
      },
      { property: "og:title", content: "User profile — Deepwoods GHG Portal" },
      { property: "og:description", content: "Manage your portal login and password." },
    ],
  }),
  component: UserProfile,
});

function UserProfile() {
  const [password, setPassword] = useState("");

  return (
    <TopLevelShell active="register">
      <h1 className="text-[32px] leading-tight font-bold text-ink">User profile</h1>
      <p className="mt-1 text-sm text-slate">Your login for the group, across every entity.</p>

      <div className="mt-7 max-w-2xl rounded-[10px] border border-border bg-white p-8">
        <div className="grid gap-6 md:grid-cols-2">
          <Field label="Name">
            <input className={inputCls + " bg-paper"} readOnly value="Featherlite Furnitures" />
          </Field>
          <Field label="Email">
            <input
              className={inputCls + " bg-paper"}
              readOnly
              value="group.admin@featherlite.example"
            />
          </Field>
          <Field label="Role">
            <input className={inputCls + " bg-paper"} readOnly value="Group Admin" />
          </Field>
          <Field label="Change password" helper="Leave blank to keep your current password.">
            <input
              type="password"
              className={inputCls}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
        </div>
        <button
          type="button"
          onClick={() => {
            setPassword("");
            toast("Profile saved.");
          }}
          className="mt-7 cursor-pointer rounded-[6px] bg-canopy px-5 py-2.5 text-sm font-medium text-white hover:opacity-90"
        >
          Save
        </button>
      </div>
    </TopLevelShell>
  );
}

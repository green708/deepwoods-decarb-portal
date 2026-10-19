import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/workstreams")({
  beforeLoad: () => {
    throw redirect({ to: "/home", replace: true });
  },
  component: () => null,
});

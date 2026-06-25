import { ClientOnly } from "@tanstack/react-router";
import type { ComponentProps } from "react";
import { LeafletMap } from "./LeafletMap";

export function MapClient(props: ComponentProps<typeof LeafletMap>) {
  return (
    <ClientOnly fallback={<div className={props.className ?? "h-full w-full"} style={{ background: "var(--color-panel)" }} />}>
      <LeafletMap {...props} />
    </ClientOnly>
  );
}
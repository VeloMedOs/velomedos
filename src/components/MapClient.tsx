import { ClientOnly } from "@tanstack/react-router";
import type { ComponentProps } from "react";
import { GoogleMap } from "./GoogleMap";

export function MapClient(props: ComponentProps<typeof GoogleMap>) {
  return (
    <ClientOnly fallback={<div className={props.className ?? "h-full w-full"} style={{ background: "var(--color-panel)" }} />}>
      <GoogleMap {...props} />
    </ClientOnly>
  );
}
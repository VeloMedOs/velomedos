import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { lazy, Suspense, useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { supabase } from "@/integrations/supabase/client";
import { Toaster } from "@/components/ui/sonner";
import { organizationLd, jsonld } from "@/components/Jsonld";
import { SITE } from "@/lib/site-config";
import { ThemeProvider, useTheme, NO_FLASH_SCRIPT } from "@/lib/theme";
// Lazy-load DebugOverlay — it's an opt-in developer tool toggled via
// localStorage; no reason to ship it in the public LCP bundle.
const DebugOverlay = lazy(() =>
  import("@/components/DebugOverlay").then((m) => ({ default: m.DebugOverlay })),
);

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "VeloMed OS — API-first medical mobility platform" },
      { name: "description", content: "Live ambulance dispatch, paramedic & driver tooling, patient app, fleet compliance, telehealth, training & certification — all on one documented REST API." },
      { name: "author", content: "VeloMed Infrastructure Group" },
      { name: "robots", content: "index,follow" },
      { name: "google-site-verification", content: "O7J9rhDuo3FdZTjJ6l2xo6ij9tWqiUz9fC1JnILR9T8" },
      { property: "og:site_name", content: SITE.brand },
      { property: "og:title", content: "VeloMed OS — API-first medical mobility platform" },
      { property: "og:description", content: "Live ambulance dispatch, paramedic & driver tooling, patient app, fleet compliance, telehealth, training & certification — all on one documented REST API." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "theme-color", content: "#0b0d10" },
      { name: "twitter:title", content: "VeloMed OS — API-first medical mobility platform" },
      { name: "twitter:description", content: "Live ambulance dispatch, paramedic & driver tooling, patient app, fleet compliance, telehealth, training & certification — all on one documented REST API." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/95877bc1-2b10-4007-9f5f-08de39114cf3" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/95877bc1-2b10-4007-9f5f-08de39114cf3" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      // Pre-resolve DNS+TLS to Google Fonts before the stylesheet request — saves
      // 200–500ms on mobile cold loads. `crossorigin` is required for fonts.gstatic
      // so the font file fetch reuses the warmed connection.
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      // Trimmed weights: Inter 400/600/700, Fraunces 400/600, Mono 500.
      // Removed 500-Inter, 500/700-Fraunces, 400/600-Mono — unused or near-duplicates.
      // Saves ~80–120KB of font payload on mobile.
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Fraunces:opsz,wght@9..144,400;9..144,600&family=JetBrains+Mono:wght@500&display=swap" },
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "apple-touch-icon", href: "/favicon.png" },
    ],
    scripts: [
      { type: "application/ld+json", children: jsonld(organizationLd()) },
      // No-flash theme script. Runs before React mounts so the right theme
      // class is on <html> on first paint.
      { children: NO_FLASH_SCRIPT },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });
    return () => subscription.unsubscribe();
  }, [queryClient, router]);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <Outlet />
        <ThemedToaster />
        <Suspense fallback={null}>
          <DebugOverlay />
        </Suspense>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

function ThemedToaster() {
  const { resolved } = useTheme();
  return <Toaster theme={resolved} position="top-right" />;
}

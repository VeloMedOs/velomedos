/**
 * VeloMed OS · <ResponsiveImage>
 *
 * Renders a <picture> with AVIF → WebP → fallback sources, srcset/sizes,
 * native lazy-loading, async decode, and explicit width/height to prevent
 * CLS. Designed for public marketing pages where every kilobyte and
 * layout shift on a 360 px Android matters.
 *
 * Usage with a build-time imported asset (preferred — `vite-imagetools`
 * or `?url` imports give immutable hashed URLs):
 *
 *   import hero from "@/assets/hero.jpg?url";
 *   <ResponsiveImage
 *     src={hero}
 *     alt="Dispatch console at golden hour"
 *     width={1600}
 *     height={900}
 *     sizes="(min-width: 1024px) 960px, 100vw"
 *     priority   // ← LCP candidate only; everything else lazy-loads
 *   />
 *
 * For CDN-hosted assets (Lovable Assets / R2 / Supabase Storage), pass
 * an `avifSrc` / `webpSrc` derived from your CDN's format negotiation,
 * or rely on `src` alone — the component still emits sizes + lazy + async
 * + explicit dimensions, which is the bulk of the win.
 */
import * as React from "react";

export type ResponsiveImageProps = {
  /** Required fallback URL (usually JPG/PNG). */
  src: string;
  /** Optional AVIF URL — emitted as <source type="image/avif">. */
  avifSrc?: string;
  /** Optional WebP URL — emitted as <source type="image/webp">. */
  webpSrc?: string;
  /** Optional srcset for the fallback <img>. AVIF/WebP variants can carry their own via `avifSrcSet` / `webpSrcSet`. */
  srcSet?: string;
  avifSrcSet?: string;
  webpSrcSet?: string;
  sizes?: string;
  alt: string;
  width: number;
  height: number;
  /** LCP candidate — disables lazy loading and signals `fetchpriority="high"`. */
  priority?: boolean;
  className?: string;
  /** Below-the-fold images use `loading="lazy"` automatically; set this only to override. */
  loading?: "eager" | "lazy";
  decoding?: "async" | "sync" | "auto";
};

export function ResponsiveImage({
  src,
  avifSrc,
  webpSrc,
  srcSet,
  avifSrcSet,
  webpSrcSet,
  sizes,
  alt,
  width,
  height,
  priority = false,
  className,
  loading,
  decoding = "async",
}: ResponsiveImageProps) {
  const effectiveLoading = loading ?? (priority ? "eager" : "lazy");
  return (
    <picture>
      {avifSrc || avifSrcSet ? (
        <source
          type="image/avif"
          srcSet={avifSrcSet ?? avifSrc}
          sizes={sizes}
        />
      ) : null}
      {webpSrc || webpSrcSet ? (
        <source
          type="image/webp"
          srcSet={webpSrcSet ?? webpSrc}
          sizes={sizes}
        />
      ) : null}
      <img
        src={src}
        srcSet={srcSet}
        sizes={sizes}
        alt={alt}
        width={width}
        height={height}
        loading={effectiveLoading}
        decoding={decoding}
        // @ts-expect-error fetchpriority is valid HTML but not yet in React's typings
        fetchpriority={priority ? "high" : undefined}
        className={className}
        // Prevent layout shift even when CSS overrides dimensions
        style={{ aspectRatio: `${width} / ${height}` }}
      />
    </picture>
  );
}
import type { MetadataRoute } from "next";

/** Served as /manifest.webmanifest. Has a file extension, so the launch gate's
 * matcher leaves it alone in waitlist mode, like the icons it points at. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Worthmark",
    short_name: "Worthmark",
    description:
      "Pricing, proposals and onboarding for AI and automation agencies.",
    start_url: "/",
    display: "standalone",
    background_color: "#02070A",
    theme_color: "#02070A",
    icons: [
      { src: "/icon.png", sizes: "512x512", type: "image/png" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}

import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  output: "standalone",
  generateBuildId: async () => process.env.GIT_SHA ?? "dev",
};

export default withNextIntl(nextConfig);

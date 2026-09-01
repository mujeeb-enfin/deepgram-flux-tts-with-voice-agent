import nextConfig from "eslint-config-next";

/** @type {import("eslint").Linter.Config[]} */
const eslintConfig = [
  ...nextConfig,
  {
    ignores: [
      "node_modules/",
      ".next/",
      "out/",
      "**/*.test.ts",
      "vitest.config.ts",
    ],
  },
];

export default eslintConfig;

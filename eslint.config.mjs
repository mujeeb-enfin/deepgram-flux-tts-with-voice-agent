import { createRequire } from "module";
const require = createRequire(import.meta.url);
const nextConfig = require("eslint-config-next");

const eslintConfig = [
  ...nextConfig,
  {
    ignores: ["node_modules/", ".next/", "out/"],
  },
];

export default eslintConfig;

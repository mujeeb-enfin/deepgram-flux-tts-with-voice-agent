import { FluxAgentBench } from "@/components/FluxAgentBench";
import type { ProductConfig, AvailableProduct } from "@/components/FluxAgentBench";
import * as fs from "node:fs";
import * as path from "node:path";

export const dynamic = "force-dynamic";

function loadProductsFromDisk(): AvailableProduct[] {
  const productsDir = path.join(process.cwd(), "products");
  if (!fs.existsSync(productsDir)) return [];

  const files = fs.readdirSync(productsDir).filter((f) => f.endsWith(".json"));
  const products: AvailableProduct[] = [];

  for (const file of files) {
    try {
      const raw = fs.readFileSync(path.join(productsDir, file), "utf-8");
      const config = JSON.parse(raw) as ProductConfig;
      products.push({ fileName: file.replace(/\.json$/, ""), config });
    } catch {
      // skip malformed JSON files
    }
  }

  return products;
}

export default function Page() {
  const availableProducts = loadProductsFromDisk();

  return (
    <FluxAgentBench
      initialApiKey={process.env.DEEPGRAM_API_KEY ?? ""}
      initialVoiceModel={process.env.DEEPGRAM_VOICE_MODEL ?? "flux-kit-en"}
      initialThinkModel={process.env.DEEPGRAM_THINK_MODEL ?? "gpt-4o-mini"}
      initialSpeed={process.env.DEEPGRAM_SPEED ?? "1.0"}
      initialEotThreshold={process.env.DEEPGRAM_EOT_THRESHOLD ?? "0.7"}
      availableProducts={availableProducts}
      defaultProductFile="karcher_k_2_360"
    />
  );
}

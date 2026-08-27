"use client";

import { useState, useMemo } from "react";
import type { AvailableProduct } from "@/components/FluxAgentBench";

const inputClasses =
  "w-full rounded-md border border-line bg-input-bg px-2.5 py-2 font-sans text-[13.5px] text-ink outline-none focus:border-signal focus:ring-3 focus:ring-signal-ring";
const selectClasses = inputClasses;
const labelClasses =
  "mb-1 block font-mono text-[10.5px] uppercase tracking-widest text-ink2";

interface SystemPromptPanelProps {
  behaviorPrompt: string;
  onBehaviorPromptChange: (value: string) => void;
  productConfigJson: string;
  onProductConfigJsonChange: (value: string) => void;
  greeting: string;
  onGreetingChange: (value: string) => void;
  onApplyLive: () => void;
  isConnected: boolean;
  availableProducts: AvailableProduct[];
  selectedProductFile: string;
  onProductFileChange: (fileName: string) => void;
}

export function SystemPromptPanel({
  behaviorPrompt,
  onBehaviorPromptChange,
  productConfigJson,
  onProductConfigJsonChange,
  greeting,
  onGreetingChange,
  onApplyLive,
  isConnected,
  availableProducts,
  selectedProductFile,
  onProductFileChange,
}: SystemPromptPanelProps) {
  const [isBehaviorExpanded, setIsBehaviorExpanded] = useState(false);
  const jsonValidationError = useMemo(() => {
    try {
      JSON.parse(productConfigJson);
      return null;
    } catch (parseError) {
      return (parseError as Error).message;
    }
  }, [productConfigJson]);

  return (
    <section className="overflow-hidden rounded-[10px] border border-line bg-panel">
      <div className="flex items-center justify-between gap-2.5 border-b border-line2 px-3.5 py-[11px]">
        <h2 className="font-mono text-[11px] font-medium uppercase tracking-widest text-ink2">
          System prompt
        </h2>
        <button
          onClick={onApplyLive}
          disabled={!isConnected}
          className="rounded-md border border-line bg-panel px-2.5 py-1 font-sans text-xs text-ink hover:border-ink3 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Apply live
        </button>
      </div>
      <div className="space-y-3 p-3.5">
        <div>
          <button
            type="button"
            onClick={() => setIsBehaviorExpanded((prev) => !prev)}
            className="mb-1 flex w-full items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-widest text-ink2 hover:text-ink"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 16 16"
              fill="currentColor"
              className={`size-3 transition-transform ${isBehaviorExpanded ? "rotate-90" : ""}`}
            >
              <path fillRule="evenodd" d="M6.22 4.22a.75.75 0 0 1 1.06 0l3.25 3.25a.75.75 0 0 1 0 1.06l-3.25 3.25a.75.75 0 0 1-1.06-1.06L8.94 8 6.22 5.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
            </svg>
            Agent behavior (read-only)
          </button>
          {isBehaviorExpanded && (
            <textarea
              id="bench_prompt_behavior"
              rows={10}
              readOnly
              value={behaviorPrompt}
              className={`${inputClasses} resize-y font-mono text-[12.5px] leading-relaxed cursor-default bg-field text-ink2`}
            />
          )}
        </div>
        {availableProducts.length > 0 && (
          <div>
            <label htmlFor="bench_prompt_productFile" className={labelClasses}>
              Load product
            </label>
            <select
              id="bench_prompt_productFile"
              value={selectedProductFile}
              onChange={(e) => onProductFileChange(e.target.value)}
              className={selectClasses}
            >
              {availableProducts.map((product) => (
                <option key={product.fileName} value={product.fileName}>
                  {product.config.productName}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label htmlFor="bench_prompt_product" className={labelClasses}>
            Product knowledge (JSON)
          </label>
          <textarea
            id="bench_prompt_product"
            rows={14}
            value={productConfigJson}
            onChange={(e) => onProductConfigJsonChange(e.target.value)}
            className={`${inputClasses} resize-y font-mono text-[12.5px] leading-relaxed ${jsonValidationError ? "border-danger focus:border-danger focus:ring-danger/20" : ""}`}
          />
          {jsonValidationError && (
            <p className="mt-1 font-mono text-[10.5px] text-danger">
              {jsonValidationError}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="bench_prompt_greeting" className={labelClasses}>
            Greeting
          </label>
          <input
            id="bench_prompt_greeting"
            type="text"
            value={greeting}
            onChange={(e) => onGreetingChange(e.target.value)}
            className={inputClasses}
          />
        </div>
      </div>
    </section>
  );
}

let dashjsModulePromise: Promise<typeof import("dashjs")> | null = null;

export function preloadDashjsModule(): void {
  if (dashjsModulePromise) return;
  dashjsModulePromise = import("dashjs");
  console.info(
    JSON.stringify({
      level: "info",
      component: "preload_dashjs",
      event: "dashjs_preload_started",
    })
  );
}

export function getDashjsModule(): Promise<typeof import("dashjs")> {
  if (!dashjsModulePromise) {
    dashjsModulePromise = import("dashjs");
    console.info(
      JSON.stringify({
        level: "info",
        component: "preload_dashjs",
        event: "dashjs_lazy_import_started",
      })
    );
  }
  return dashjsModulePromise;
}

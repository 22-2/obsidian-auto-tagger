import manifest from "../../manifest.json" with { type: "json" };

export const APP_NAME = manifest.name || "MyPlugin";

export const VIEW_TYPE_AUTO_TAGGER = "auto-tagger-view";

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { productHtml } from '../../shared/productHtml';
import { brandAssets } from '../../shared/brandAssets';
export default defineConfig({ plugins: [react(), productHtml(), brandAssets()] });

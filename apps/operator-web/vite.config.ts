import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { productHtml } from '../../shared/productHtml';
export default defineConfig({ plugins: [react(), productHtml()] });

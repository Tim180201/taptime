import product from './product.json' with { type: 'json' };

// HTML is rendered at build time, including with JavaScript disabled.
export function productHtml() {
  return {
    name: 'product-name',
    transformIndexHtml(html: string) {
      const escaped = product.name.replace(/[&<>"']/g, character => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
      })[character]!);
      return html.replaceAll('%APP_NAME%', escaped);
    },
  };
}

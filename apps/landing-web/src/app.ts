import links from './appLinks.json';
import { renderAppDownload } from './appDownload';

renderAppDownload(document.getElementById('app-download')!, links, navigator, url => window.location.replace(url));

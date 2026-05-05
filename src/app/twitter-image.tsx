// Twitter card image. Renders the same composition as opengraph-image so
// each platform's metadata gets its own absolute URL — some validators don't
// fall back from og:image.
import OpengraphImage from './opengraph-image';

export const runtime = 'edge';
export const alt = 'VibeDuel — The Competitive Arena for AI-Powered Coding';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default OpengraphImage;

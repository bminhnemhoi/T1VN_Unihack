import type { MetadataRoute } from 'next';

/**
 * Web app manifest (B23 part 3): "Thêm vào màn hình chính" opens the app at the circles list, standalone. Icons are the
 * envelope logo (public/brand). No service worker: nothing from the chain is cached, so balances and rounds are never stale.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'HụiSafe',
    short_name: 'HụiSafe',
    description: 'Hụi bỏ thăm chạy bằng smart contract trên Avalanche. Chủ hụi không cầm tiền, nhưng vẫn phải bảo lãnh.',
    lang: 'vi',
    start_url: '/circles',
    scope: '/',
    display: 'standalone',
    background_color: '#F4F0E8',
    theme_color: '#201D1D',
    icons: [
      { src: '/brand/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/brand/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/brand/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: '/brand/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
    ],
  };
}

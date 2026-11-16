import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/'],
      },
    ],
    sitemap: 'https://garmentory-web.vercel.app/sitemap.xml',
    host: 'https://garmentory-web.vercel.app',
  };
}

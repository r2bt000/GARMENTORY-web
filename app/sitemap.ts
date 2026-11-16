import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://garmentory-web.vercel.app';
  const lastMod = new Date('2026-11-16T00:00:00.000Z');

  return [
    {
      url: `${baseUrl}/`,
      lastModified: lastMod,
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: lastMod,
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: lastMod,
      changeFrequency: 'monthly',
      priority: 0.3,
    },
  ];
}

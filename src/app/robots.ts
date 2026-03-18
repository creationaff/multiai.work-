import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/'],
    },
    host: 'https://multiai.work',
    sitemap: 'https://multiai.work/sitemap.xml',
  };
}

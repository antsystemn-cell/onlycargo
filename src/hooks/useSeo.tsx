import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useSiteSettings } from '@/hooks/useSiteSettings';

const ROUTE_TO_PAGE_KEY: Record<string, string> = {
  '/': 'home',
  '/my-cargo': 'my-cargo',
  '/calculator': 'calculator',
  '/china-address': 'china-address',
  '/profile': 'profile',
  '/wallet': 'wallet',
  '/referral': 'referral',
};

function setMetaTag(name: string, content: string, attribute = 'name') {
  if (!content) return;
  let el = document.querySelector(`meta[${attribute}="${name}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attribute, name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

export function useSeo() {
  const location = useLocation();
  const { seoSettings, faviconUrl } = useSiteSettings();

  useEffect(() => {
    const pageKey = ROUTE_TO_PAGE_KEY[location.pathname];
    const seo = pageKey ? seoSettings?.[pageKey] : null;

    if (seo) {
      if (seo.title) document.title = seo.title;
      if (seo.description) setMetaTag('description', seo.description);
      if (seo.keywords) setMetaTag('keywords', seo.keywords);
      setMetaTag('og:title', seo.og_title || seo.title, 'property');
      setMetaTag('og:description', seo.og_description || seo.description, 'property');
      if (seo.og_image) setMetaTag('og:image', seo.og_image, 'property');
    }
  }, [location.pathname, seoSettings]);

  // Apply favicon
  useEffect(() => {
    if (faviconUrl && faviconUrl !== '/favicon.ico') {
      let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement | null;
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.type = 'image/png';
      link.href = faviconUrl;
    }
  }, [faviconUrl]);
}

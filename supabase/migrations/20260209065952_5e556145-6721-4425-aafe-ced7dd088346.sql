
-- Insert default favicon_url setting
INSERT INTO public.site_settings (key, value)
VALUES ('favicon_url', '"/favicon.ico"'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Insert default seo_settings (per-page SEO config)
INSERT INTO public.site_settings (key, value)
VALUES ('seo_settings', '{
  "home": {"title": "OnlyCargo - Хятадаас Монгол руу карго тээвэр", "description": "Хятадаас Монгол руу хурдан, найдвартай карго тээвэрлэлт", "keywords": "", "og_title": "", "og_description": ""},
  "my-cargo": {"title": "Миний ачаа - OnlyCargo", "description": "Ачааны төлөв шалгах", "keywords": "", "og_title": "", "og_description": ""},
  "calculator": {"title": "Тооцоолуур - OnlyCargo", "description": "Карго тээврийн үнэ тооцоолох", "keywords": "", "og_title": "", "og_description": ""},
  "china-address": {"title": "Хятад хаяг - OnlyCargo", "description": "Хятадын агуулахын хаяг", "keywords": "", "og_title": "", "og_description": ""},
  "profile": {"title": "Профайл - OnlyCargo", "description": "Хэрэглэгчийн мэдээлэл", "keywords": "", "og_title": "", "og_description": ""},
  "wallet": {"title": "Хэтэвч - OnlyCargo", "description": "Хэтэвчийн үлдэгдэл, гүйлгээ", "keywords": "", "og_title": "", "og_description": ""},
  "referral": {"title": "Урилга - OnlyCargo", "description": "Найзаа урьж урамшуулал аваарай", "keywords": "", "og_title": "", "og_description": ""}
}'::jsonb)
ON CONFLICT (key) DO NOTHING;

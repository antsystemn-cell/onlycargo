# OnlyCargo API Provider Improvements

OnlyCargo үлдэнэ source of truth. Одоо байгаа workflow, статус enum-уудыг бүгдийг хадгална. Only Hub зэрэг гадны системд найдвартай API үйлчилгээ үзүүлэхийн тулд `external-api` edge function болон харгалзах бүтцийг өргөтгөнө.

## 1. Merchant ownership (DB migration)

`cargo` хүснэгтэд optional баганууд нэмнэ (одоо байгаа өгөгдөл хөндөгдөхгүй):
- `merchant_id text` (nullable, indexed)
- `customer_code text` (nullable, indexed)
- `external_ref text` (nullable, indexed) — Only Hub талын shipment id хадгалах

`api_keys` хүснэгтэд:
- `merchant_id text` (nullable) — key нь зөвхөн өөрийн merchant-ын ачааг харна
- `allowed_customer_codes text[] default '{}'`

RLS-ийг хөндөхгүй; external-api edge function service role-оор уншина, key-ний scope-оор шүүнэ.

## 2. Status standardization

Дотоод `CargoStatus` enum (registered/received_ereen/transporting/warehouse_processing/ready_warehouse/completed) хэвээр үлдэнэ. API talcyд гадаад стандарт статус руу mapping хийнэ:

```
registered           -> created
received_ereen       -> received
transporting         -> in_transit
warehouse_processing -> processing
ready_warehouse      -> ready_for_pickup
completed            -> completed
(archived)           -> archived   // зөвхөн API-д, soft archive flag-аар
```

`POST /cargo/status` дээр гадаад статус хүлээж аваад дотоод статус руу буцаан хөрвүүлнэ. Unknown статус → 400.

`arrived` статусыг `ready_for_pickup`-тэй ижил mapping-аар хүлээн авна (хоёулаа `ready_warehouse` руу буух) — гадаад системд нийцтэй.

## 3. Endpoint бүрэн жагсаалт (external-api)

Бүгд `Authorization: Bearer <key>` эсвэл `X-API-Key`. JSON response: `{ data, meta? }` эсвэл `{ error, code }`.

- `GET /health` — одоогийнхоор
- `GET /shipments` — list. Query: `page`, `pageSize` (max 100), `sort` (`created_at|status_date`), `order` (`asc|desc`), `status` (external), `q` (track_number/phone substring), `merchant_id`, `customer_code`, `from`, `to` (ISO). Returns `{ data: Shipment[], meta: { page, pageSize, total, hasMore } }`.
- `GET /shipments/:trackNumber` — detail (масклагдсан phone, mapped status, fee).
- `GET /shipments/:trackNumber/history` — `cargo_status_history`-г external статусаар map хийж өгнө.
- `GET /shipments/:trackNumber/status` — зөвхөн статус + timestamp.
- `GET /shipments/:trackNumber/fee` — `price`, `weight_price`, `volume_price`, `cubic_meters` (`allow_price` тохиргооноос хамаарна).
- `GET /shipments/:trackNumber/images` — `cargo_photos`-аас public URL-ууд.
- `GET /shipments/:trackNumber/location` — одоогийн статус дээр үндэслэсэн location label (Эрээн / Замын / Агуулах / Хүлээлгэж өгсөн) + branch нэр/код.
- `POST /shipments/:trackNumber/status` — external статус хүлээж аваад update (одоогийн `/cargo/status` логикийг хадгална).

Хуучин `/cargo/by-tracking`, `/cargo/by-phone`, `/cargo/history`, `/cargo/status` route-уудыг backward compatible байлгана.

## 4. Scoping rules

Key validation дараах дарааллаар шүүнэ:
1. `allowed_branches` (одоогийнх) — set бол `branch_id IN (...)`
2. `merchant_id` — set бол `cargo.merchant_id = key.merchant_id`
3. `allowed_customer_codes` — set бол `cargo.customer_code = ANY(...)`

Хэрэв key дээр merchant/customer scope тавьсан атал ачаа таарахгүй бол 404 буцаана (хэрэглэгчид өөр merchant-ын мэдээлэл байгаа эсэхийг мэдэгдэхгүй).

## 5. Pagination, sorting, filtering, retry

- Pagination: `range()` ашиглан Supabase-аас `count: 'exact'` авч `meta.total` буцаана.
- Sorting: `created_at` (default desc), `status_date`.
- Search: `track_number ilike %q%` OR `phone_number ilike %q%` (key-д `allow_phone_search` идэвхтэй бол).
- Retry: 5xx response-уудад `Retry-After: 1` header нэмнэ. Rate-limit 429 дээр одоогоор `Retry-After: 60`.
- Идempotency: `POST /shipments/:trackNumber/status` дээр `Idempotency-Key` header хүлээж авч сүүлийн 24 цагийн log-оос дуплекат шалгана (хөнгөн хувилбар: ижил key+endpoint+статус сүүлийн 1 минутад → cached 200).

## 6. Security & masking

- Admin notes, `registered_by`, `payment_id`, internal id-уудыг хариунд оруулахгүй.
- Phone үргэлж масклана (одоогийн логик).
- API key-үүд SHA-256 hashed (одоогоор тийм).
- `last_used_at`, `last_ip` талбарыг `api_keys`-д шинэчилнэ.
- CORS зөвхөн `*` GET/POST үлдэнэ; admin endpoints энд байхгүй.

## 7. Performance

DB migration-д дараах index нэмнэ:
- `cargo (merchant_id)`
- `cargo (customer_code)`
- `cargo (status, status_date desc)`
- `cargo (branch_id, status_date desc)`
- `cargo_status_history (cargo_id, created_at)`
- `api_key_usage_logs (api_key_id, created_at desc)`

List query-д зөвхөн хэрэгтэй баганыг select хийнэ. Rate-limit count `head: true` (одоогоор тийм).

## 8. Admin UI шинэчлэл

`ApiKeyManagement.tsx`:
- Form-д `merchant_id`, `allowed_customer_codes` (comma separated) талбар нэмнэ.
- Шинэ endpoint жагсаалт + curl жишээнүүдийг docs хэсэгт шинэчилнэ.

## 9. Туршилт

- `supabase functions test` шаардахгүй; гар туршилтын curl жишээнүүдийг docs-д нэмнэ.
- Migration хийсний дараа жишээ key үүсгээд `/shipments?pageSize=5` дуудаж шалгана.

## Файлууд

- migration: cargo + api_keys багана, индексүүд
- `supabase/functions/external-api/index.ts` — бүтэн дахин зохиогдоно (router + helpers)
- `src/pages/admin/ApiKeyManagement.tsx` — merchant/customer code талбар, шинэ docs
- `src/integrations/supabase/types.ts` — migration-ы дараа автоматаар шинэчлэгдэнэ

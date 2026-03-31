# 🎟️ Guest / Customer API Contract (Queue Session Based)

Dokumen ini memuat daftar *endpoint* yang digunakan oleh **Customer (Guest)** untuk melakukan proses pemesanan mandiri menggunakan nomor antrean.

---

## 🔍 1. Inisialisasi Sesi Antrean
Customer men-scan QR antrean yang diberikan/ditampilkan kasir untuk masuk ke menu.

- **URL:** `POST /api/sessions/scan`
- **Body Request:**
```json
{
  "token": "uuid-session-token-dari-qr"
}
```
- **Response 200 OK:**
```json
{
  "success": true,
  "message": "Welcome!",
  "data": {
    "id_session": 10,
    "queue_number": 5,
    "session_token": "uuid-...",
    "status": "ordering"
  }
}
```

---

## 📖 2. Menu & Produk

### Ambil Daftar Menu Aktif
- **URL:** `GET /api/products?is_available=true`
- **Response 200 OK:** Memasukan daftar produk yang dapat dipesan.

---

## 📝 3. Pemesanan (Multi-Order)

### Buat Pesanan Baru
Customer dapat mengirim order berkali-kali dalam satu sesi antrean (Add-on).

- **URL:** `POST /api/orders`
- **Body Request:**
```json
{
  "session_token": "uuid-session-token-dari-qr",
  "promo_id": null,
  "items": [
    { "product_id": 5, "qty": 2, "notes": "Pedas" }
  ]
}
```
- **Response 201 Created:**
```json
{
  "success": true,
  "data": {
    "id_order": 125,
    "order_code": "ORD-1711...",
    "status": "pending",
    "final_amount": 95000
  }
}
```

---

## 🛰️ 4. Tracking & Riwayat

### Pantau Status Order
Cek apakah pesanan sedang dimasak, siap saji, atau sudah selesai.

- **URL:** `GET /api/orders/:id`
- **Response 200 OK:** Mengembalikan status terkini (`pending`, `processing`, `ready`, `completed`).

### Cek Total Tagihan Antrean
Melihat akumulasi seluruh order yang sudah dipesan dalam satu nomor antrean.

- **URL:** `GET /api/guest/orders/:session_id`

---

## 🔐 Keamanan
1. **QR Dinamis:** Token akan ditolak jika status antrean sudah `completed` (sudah dibayar) atau `cancelled`.
2. **Kalkulasi Server:** Pajak, service charge, dan diskon dihitung di backend.
# 📜 Master API Contract - POS Queue System

Dokumen ini memuat daftar *endpoint* final untuk semua role (Guest, Kasir, Admin) setelah migrasi ke arsitektur **Queue Session**.

---

## 🎟️ ROLE: GUEST / CUSTOMER (Public / Session-Based)
Digunakan oleh pelanggan via scan QR antrean.

### 1. Inisialisasi Sesi (Scan QR)
- **URL:** `POST /api/sessions/scan`
- **Body:** `{ "token": "uuid-token" }`
- **Response:** Data sesi (`id_session`, `queue_number`, `status`).

### 2. Katalog Menu
- **URL:** `GET /api/products?is_available=true`
- **URL:** `GET /api/categories`

### 3. Pemesanan (Postpaid Multi-Order)
- **URL:** `POST /api/orders`
- **Body:** 
  ```json
  {
    "session_token": "uuid",
    "promo_id": null,
    "items": [{ "product_id": 1, "qty": 2, "notes": "No sugar" }]
  }
  ```
- **Validasi:** Gagal jika sesi sudah `completed` atau `cancelled`. (Hanya bisa order jika `waiting` atau `ordering`).

### 4. Tracking Order Mandiri
- **URL:** `GET /api/orders/:id`
- **URL:** `GET /api/guest/orders/:session_id` (Cek semua order di satu antrean)

---

## 🧑💼 ROLE: KASIR (Protected - Role: 'kasir')
Fokus pada manajemen antrean harian dan pembayaran.

### 1. Buka Antrean Baru
- **URL:** `POST /api/sessions` (Generate nomor antrean baru)
- **Response:** QR Token & `queue_number`.

### 2. Dashboad Antrean
- **URL:** `GET /api/sessions?status=waiting,ordering`
- **URL:** `GET /api/sessions/:id` (Detail rekap per antrean)

### 3. Manajemen Order (Dapur/Server)
- **URL:** `PUT /api/orders/:id/status` (Update `pending` -> `processing` -> `ready`)

### 4. Proses Pembayaran (Finalization)
Membayar seluruh total tagihan dalam satu nomor antrean.
- **URL:** `POST /api/orders/pay-session`
- **Body:**
  ```json
  {
    "session_id": 10,
    "amount_paid": 50000,
    "method": "cash"
  }
  ```
- **Validasi:** Hanya menjumlahkan order dengan status `processing` atau `ready`. Total dihitung di backend.

---

## 🛡️ ROLE: ADMIN (Protected - Role: 'admin')
Fokus pada laporan, manajemen user, dan menu.

### 1. Statistik Penjualan
- **URL:** `GET /api/admin/stats?period=daily`
- **URL:** `GET /api/cashier/summary` (Omzet harian)

### 2. Manajemen User (Staff)
- **URL:** `GET /api/admin/users` (List Kasir)
- **URL:** `POST /api/admin/users` (Tambah Kasir)
- **URL:** `PUT /api/admin/users/:id` (Reset Pass / Ganti Status)

### 3. Manajemen Menu & Promo
- **URL:** `POST /api/products` (Tambah Menu)
- **URL:** `PUT /api/products/:id` (Update Stok/Harga)
- **URL:** `POST /api/promos` (Tambah Diskon)

---

## 🔐 KEAMANAN & REALTIME
1. **Socket.io Rooms:** Pastikan frontend melakukan `socket.emit('join:session', sessionId)` agar update status makanan privat per antrean.
2. **Kalkulasi Server:** Pajak (11%), Service (5%), dan Diskon mutlak dihitung di Backend.
3. **Double Click Guard:** Status sesi dicek di awal transaksi untuk mencegah duplikasi pembayaran.

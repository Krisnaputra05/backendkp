# Backend API Documentation - Restaurant QR Ordering System

Backend RESTful API & Realtime Socket.IO yang dibangun menggunakan **Node.js**, **Express**, dan **Supabase**. Sistem ini mendukung pemesanan mandiri via QR Code (Guest), manajemen pesanan (Kasir), dan manajemen operasional (Admin).

---

## 🛠 Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: Supabase (PostgreSQL)
- **Realtime Services**: Socket.IO
- **Authentication**: JWT (JSON Web Token)
- **Security**: bcryptjs, cors, helmet-ready architecture
- **Logging**: Morgan

---

## 🏛 Arsitektur Sistem

Sistem menggunakan arsitektur **Modular Monolith** dimana setiap domain bisnis (Auth, Order, Product, dll) memiliki foldernya sendiri yang berisi *Routes*, *Controller*, dan *Service*.

Pola komunikasi:
1. **REST API**: Untuk pertukaran data request-response standar.
2. **Socket.IO**: Untuk update status pesanan realtime ke dapur, kasir, dan pelanggan.

### Struktur Folder (`src/`)

```
src/
├── config/         # Konfigurasi Supabase & Environment
├── middlewares/    # Middleware Auth, Role, Error Handling
├── modules/        # Domain Bisnis (Fitur Utama)
│   ├── admin/      # Manajemen User & Statistik Admin
│   ├── auth/       # Login & Autentikasi
│   ├── cashier/    # Laporan & Dashboard Kasir
│   ├── category/   # CRUD Kategori Menu
│   ├── guest/      # Akses Pelanggan (Scan QR)
│   ├── order/      # Logic Pemesanan & Pembayaran
│   ├── product/    # Manajemen Produk
│   └── table/      # Manajemen Meja & QR Token
├── socket/         # Event Handler Socket.IO
└── utils/          # Helper Response, UUID, dll
```

---

## 👥 Role & Hak Akses

1. **GUEST (Pelanggan)**
   - Tidak perlu login/akun.
   - Akses via **Scan QR Code** yang valid.
   - Bisa melihat menu, memfilter, membuat pesanan.
   - Tidak bisa mengedit/menghapus struktur data server.

2. **KASIR (`role: 'kasir'`)**
   - Wajib Login.
   - Menerima notifikasi pesanan baru.
   - Mengubah status pesanan (*pending -> cooking -> ready*).
   - Memproses pembayaran (*cash/non-cash*).

3. **ADMIN (`role: 'admin'`)**
   - Wajib Login.
   - Full akses ke semua data master (Produk, Kategori, Meja).
   - Manajemen user system (buat akun kasir, reset password).
   - Melihat laporan penjualan detail.

---

## 📡 API Endpoints

Semua endpoint diawali dengan prefix: `/api`

### 1. Authentication (Auth)

**Login User (Admin/Kasir)**
- **URL**: `POST /api/auth/login`
- **Body**:
  ```json
  { "username": "admin", "password": "password123" }
  ```
- **Response Success**:
  ```json
  {
    "success": true,
    "message": "Login successful",
    "data": { "token": "eyJh...", "user": { "role": "admin", ... } }
  }
  ```

---

### 2. Guest (Pelanggan)
Lihat detail lengkap di: [GUEST_API_CONTRACT.md](./GUEST_API_CONTRACT.md)

**Scan QR / Validasi Session**
- **URL**: `POST /api/guest/scan`
- **Body**: `{ "token": "qr-token-from-table" }`
- **Response**: Mengembalikan objek `session` (isi: `id_session`, `queue_number`, `table_id`) jika token valid.

**Riwayat Pesanan Sesi**
- **URL**: `GET /api/guest/orders/:sessionId`
- **Desc**: Melihat semua pesanan yang dibuat pelanggan dalam sesi aktif ini.

**Promo Aktif**
- **URL**: `GET /api/guest/promos`
- **Desc**: Mengambil daftar promo yang bisa digunakan saat memesan.

---

### 3. Product & Menu

**List Semua Produk (Public/Guest)**
- **URL**: `GET /api/products`
- **Query Params**:
  - `category_id`: Filter by ID Kategori
  - `search`: Cari nama produk
  - `sort`: `price.asc`, `price.desc`
  - `is_available`: `true`/`false`
- **Response**: List produk beserta info kategorinya.

**Detail Produk**
- **URL**: `GET /api/products/:id`

**Manage Produk (Admin Only)**
- **Auth**: `Bearer Token`
- `POST /api/products` - Tambah Produk
- `PUT /api/products/:id` - Update Produk
- `DELETE /api/products/:id` - Hapus Produk

---

### 4. Category

**List Kategori (Public)**
- **URL**: `GET /api/categories`

**Manage Kategori (Admin Only)**
- **Auth**: `Bearer Token`
- `POST /api/categories`
- `PUT /api/categories/:id`
- `DELETE /api/categories/:id`

---

### 5. Table (Meja)

**Verifikasi QR (Public)**
- **URL**: `GET /api/table/verify/:token`

**List Meja (Admin/Kasir)**
- **URL**: `GET /api/table`

**Manage Meja (Admin Only)**
- `POST /api/table` (Body: `{ "table_number": 1 }`)
- `POST /api/table/:id/generate-token` (Regenerate QR Token baru)
- `DELETE /api/table/:id`

---

### 6. Order (Pemesanan)

**Buat Pesanan Baru (Guest)**
- **URL**: `POST /api/orders`
- **Body**:
  ```json
  {
    "session_token": "token-dari-scan-qr",
    "items": [
      { "product_id": 10, "qty": 2, "notes": "No onion" },
      { "product_id": 5, "qty": 1 }
    ],
    "payment_method": "cash",
    "promo_id": 1
  }
  ```
- **Logic**: Backend memvalidasi session, menghitung total (termasuk pajak/service/promo), dan membuat record `orders` + `order_items` + `payments`.
- **Socket Emit**: `order:new` (to cashier), `order:new` (to session room)

**List Pesanan (Kasir/Admin)**
- **URL**: `GET /api/order`
- **Query**: `?status=pending` atau `?table_id=5`

**Update Status Pesanan (Kasir/Admin)**
- **URL**: `PUT /api/order/:id/status`
- **Body**: `{ "status": "cooking" }`
- **Enum Status**: `pending` → `cooking` → `ready` → `completed` → `cancelled`
- **Socket Emit**: `order:update` (dikirim ke room meja terkait)

**Proses Pembayaran (Kasir)**
- **URL**: `POST /api/order/:id/pay`
- **Body**: `{ "amount_paid": 50000, "method": "cash" }`
- **Logic**: Mengupdate status pembayaran jadi `paid`, order jadi `completed`.
- **Socket Emit**: `table:closed`, `order:update`

---

### 7. Admin Dashboard & User Management

**Dashboard Stats**
- **URL**: `GET /api/admin/stats`
- **Data**: Total Omzet, Menu Terlaris.

**Manage Users**
- `GET /api/admin/users`
- `POST /api/admin/users` (Body: `{ "username": "...", "password": "...", "role": "kasir" }`)
- `PUT /api/admin/users/:id/reset-password`

---

### 8. Cashier Dashboard

**Daily Summary**
- **URL**: `GET /api/cashier/stats`
- **Data**: Transaksi hari ini, total cash vs non-cash.

---

## ⚡ Realtime Socket.IO

Koneksi ke: `ws://HOSTNAME:PORT`

### Rooms
1. **`table:{table_id}`**
   - Digunakan oleh Client Pelanggan.
   - Menerima update spesifik untuk meja tersebut (status pesanan berubah).
2. **`role:cashier`**
   - Digunakan oleh Dashboard Kasir/Dapur.
   - Menerima notifikasi global (ada order baru, panggilan pelayan).
3. **`role:admin`**

### Events List

| Event Name | Direction | Payload Example | Deskripsi |
| :--- | :--- | :--- | :--- |
| `join:table` | Client -> Server | `5` (Table ID) | Client Guest join room meja. |
| `join:role` | Client -> Server | `'cashier'` | Client Kasir join channel notifikasi. |
| `order:new` | Server -> All | `{ "id_orders": 12, ... }` | Saat order baru masuk. Dikirim ke Room Table & Room Cashier. |
| `order:update` | Server -> Table | `{ "status": "cooking" }` | Saat status pesanan diubah kasir. |
| `table:closed` | Server -> Table | `{ "orderId": 12 }` | Saat pembayaran selesai. Instruksi client untuk reset session. |
| `notification:new` | Server -> Cashier | `{ "message": "Table 1 ordered..." }` | Notifikasi toast/suara untuk kasir. |

---

## ⚙️ Business Rules (Aturan Bisnis)

1. **Alur Pemesanan**:
   - Guest scan QR -> Validasi di Backend -> Token Valid.
   - Guest pilih menu -> Checkout -> Backend hitung total -> Order Created (Status: `pending`, Payment: `unpaid`).
2. **Harga**:
   - Harga disimpan di `order_items` (`price_at_purchase`) saat transaksi terjadi. Perubahan harga master produk tidak mengubah history pesanan lama.
3. **Pembayaran**:
   - Satu order hanya memiliki satu record pembayaran aktif.
   - Ketika pembayaran lunas (`paid`), sistem otomatis mengubah status order menjadi `completed` dan memberitahu meja bahwa sesi selesai (`table:closed`).
4. **Validasi Meja**:
   - Order tidak bisa dibuat jika `qr_token` salah atau tidak ditemukan.

---

## 🧪 Panduan Testing (Postman)

**Skenario: Full Cycle Order**

1. **Login sebagai Admin/Kasir**
   - `POST /api/auth/login`
   - Copy `token` dari response.
   - Set Authorization Type: `Bearer Token` di Postman untuk request subsequent.

2. **Setup Meja (Admin Only)**
   - `POST /api/table` -> Buat meja baru.
   - `GET /api/table` -> Ambil `qr_token` dari salah satu meja.

3. **Guest Scan & Order (Tanpa Login)**
   - `POST /api/guest/scan` -> Body: `{ "token": "TOKEN_MEJA_TADI" }` -> Pastikan OK.
   - `POST /api/order` -> Masukkan `table_token` dan `items`.
   - **Check**: Cek Dashboard Kasir, harusnya order masuk realtime.

4. **Kasir Proses Order**
   - `PUT /api/order/:id/status` -> Ubah ke `cooking` lalu `ready`.
   - Guest cek status via endpoint order history, status harus berubah.

5. **Kasir Pembayaran**
   - `POST /api/order/:id/pay` -> Bayar lunas.
   - **Result**: Order status `completed`, Table status closed.

---

**Dibuat otomatis oleh Backend Engineering Team**
*Dokumentasi ini bersifat final dan merujuk pada implementasi kode aktual.*

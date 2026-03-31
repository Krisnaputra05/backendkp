# 🧾 Cashier / Staf API Contract (Advanced POS System)

Dokumen ini memuat daftar *endpoint* lengkap untuk **Role Kasir** guna mengelola siklus hidup antrean, pesanan dapur, hingga fitur-fitur darurat seperti pembatalan dan edit pesanan.

---

## 🏛️ 1. Manajemen Sesi Antrean (Daily Queue)
Kasir bertanggung jawab membuka dan menutup antrean pelanggan.

### A. Buat Antrean Baru [Protected]
Kasir memanggil nomor antrean berikutnya dan mencetak QR tiket untuk pelanggan.
- **URL:** `POST /api/sessions` 
- **Auth:** `Bearer <token_kasir>`
- **Response 210 Created:**
```json
{
  "success": true,
  "data": {
    "id_session": 15,
    "queue_number": 8,
    "session_token": "uuid-token",
    "status": "waiting"
  }
}
```

---

## 👨🍳 2. Manajemen Pesanan & Edit (Order Management)
Fitur pengeditan jika terjadi kesalahan atau perubahan di meja pelanggan.

### A. Update Status Pesanan (Dapur/Server)
- **URL:** `PUT /api/orders/:id/status`
- **Body:** `{ "status": "processing" }`

### B. Edit Jumlah Item (Order Adjustment)
Mengedit kuantitas item yang sudah terlanjur dipesan (jika dapur belum memproses).
- **URL:** `PUT /api/orders/:id/items`
- **Body Request:**
```json
{
  "product_id": 5,
  "qty": 4
}
```

### C. Pembatalan Pesanan (Cancel Order)
Membatalkan seluruh pesanan tertentu dengan alasan.
- **URL:** `PUT /api/orders/:id/cancel`
- **Body:** `{ "reason": "Habis" }`

---

## 🏷️ 3. Fitur Promo Kasir (Manual Discount)
Kasir bisa mengaplikasikan promo ke sebuah pesanan saat di kasir.

### A. Terapkan Promo
- **URL:** `PUT /api/orders/:id/promo`
- **Body Request:**
```json
{
  "promo_id": 2
}
```
- **Effect:** Backend otomatis menghitung ulang diskon, pajak, dan grand total.

---

## 💳 4. Proses Pembayaran & Struk (Postpaid System)
Sistem **Bayar di Akhir** secara kolektif untuk seluruh pesanan dalam antrean.

### A. Bayar Sesi (Finalize Payment)
Membayar seluruh total tagihan satu nomor antrean sekaligus (multi-order).
- **URL:** `POST /api/orders/pay-session`
- **Auth:** `Bearer <token_kasir>`
- **Body Request:**
```json
{
  "session_id": 15,
  "amount_paid": 200000,
  "method": "cash"
}
```
- **Response 200 OK:**
```json
{
  "success": true,
  "data": {
    "amount_due": 175000,
    "change_amount": 25000,
    "payment_id": 102
  }
}
```

### B. Data Struk Gabungan (Session Receipt)
Data lengkap akumulasi seluruh pesanan untuk dicetak ke printer struk tunggal.
- **URL:** `GET /api/orders/session/:id/receipt`
- **Response:** Data objek struk lengkap (Header, Items, Subtotal, Pajak, Diskon, Kembalian).

---

## 📊 5. Laporan Harian (Closing Shift)
Laporan omzet kasir yang sedang login hari ini.
- **URL:** `GET /api/cashier/summary`
- **Response:** Summary transaksi (`total_omzet`, `total_cash`, `total_non_cash`).

---

## 🔐 Info Socket (Realtime Flow)
1.  **Room Login:** Kasir harus panggil `socket.emit('join:role', 'cashier')`.
2.  **Order Alert:** Backend akan mengirimkan event `notification:new` ke room `cashier` setiap ada pelanggan baru yang memesan.
3.  **Table Update:** Backend mengirimkan event `order:update` ke room `session:ID_SESSION` untuk sinkronisasi privat antar perangkat di meja yang sama.

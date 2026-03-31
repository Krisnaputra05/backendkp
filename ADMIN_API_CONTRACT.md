# 🛡️ Admin & Settings API Contract

Dokumen API Contract ini khusus memuat endpoint yang digunakan untuk fitur khusus **Admin**, meliputi: Manajemen User (Kasir), Laporan & Statistik, serta Pengaturan Sistem.
Semua endpoint dalam dokumen ini wajib memasukkan *Header* `Authorization: Bearer <token>` dan memiliki *Role* sebagai `admin`.

---

## 👥 A. Manajemen User (Kasir)
Base URL terkait: `/api/admin/users`

### 1. Mendapatkan Daftar Kasir
Menampilkan semua akun yang berstatus (role) sebagai kasir.

- **URL:** `/api/admin/users`
- **Method:** `GET`
- **Response Success (200 OK):**
```json
{
  "status": "success",
  "message": "Users retrieved",
  "data": [
    {
      "id_user": 1,
      "user_code": "KSR-1712412850020",
      "username": "kasir_budi",
      "role": "kasir",
      "is_active": true,
      "created_at": "2024-03-27T10:00:00.000Z"
    }
  ]
}
```

### 2. Tambah Akun Kasir
Membuat staf kasir baru. Password akan otomatis dienkripsi di server (bcrypt).

- **URL:** `/api/admin/users`
- **Method:** `POST`
- **Body Request:**
```json
{
  "username": "kasir_baru",
  "password": "passwordkasir123"
}
```
- **Response Success (201 Created):**
```json
{
  "status": "success",
  "message": "User created",
  "data": {
    "id_user": 2,
    "user_code": "KSR-1712412950000",
    "username": "kasir_baru",
    "role": "kasir"
  }
}
```

### 3. Aktif / Nonaktif Akun Kasir
Merubah status kasir. Jika `is_active: false`, kasir tidak dapat login.

- **URL:** `/api/admin/users/:id/status` (Dimana `:id` adalah id_user)
- **Method:** `PUT`
- **Body Request:**
```json
{
  "is_active": false
}
```
- **Response Success (200 OK):**
```json
{
  "status": "success",
  "message": "User status updated",
  "data": {
    "is_active": false
  }
}
```

### 4. Reset Password Kasir
Mengganti password kasir tertentu dengan password baru.

- **URL:** `/api/admin/users/:id/reset-password`
- **Method:** `PUT`
- **Body Request:**
```json
{
  "newPassword": "password_baru123"
}
```
- **Response Success (200 OK):**
```json
{
  "status": "success",
  "message": "Password reset successful",
  "data": {
    "id_user": 2,
    "username": "kasir_baru",
    "role": "kasir"
  }
}
```

---

## 📈 B. Laporan & Statistik
Base URL terkait: `/api/admin/stats`

### 1. Dashboard Statistik & Laporan Penjualan
Mengambil rangkuman omzet, jumlah transaksi, dan menu terlaris. Admin bisa memfilter berdasarkan periode harian, bulanan, atau tahunan.

- **URL:** `/api/admin/stats`
- **Method:** `GET`
- **Query Params (Opsional):** `?period=daily` atau `monthly` atau `yearly` atau `all`
- **Response Success (200 OK):**
```json
{
  "status": "success",
  "message": "Dashboard stats",
  "data": {
    "period": "daily",
    "total_omzet": 1500000,
    "total_cash": 400000,
    "total_non_cash": 1100000,
    "total_discounts_given": 50000,
    "total_transactions": 25,
    "top_selling": [
      {
        "name": "Nasi Goreng Spesial",
        "qty": 35,
        "revenue": 875000
      },
      {
        "name": "Es Teh Manis",
        "qty": 20,
        "revenue": 100000
      }
    ]
  }
}
```

---

## ⚙️ C. Pengaturan Sistem
Base URL terkait: `/api/settings`

### 1. Mendapatkan Semua Pengaturan (Global)
Menampilkan seluruh *key-value pair* pengaturan restoran (jam operasional, nama, pajak).
*Catatan: Endpoint ini bisa diakses publik (tanpa token) untuk digunakan mesin kasir kasir/frontend.*

- **URL:** `/api/settings`
- **Method:** `GET`
- **Response Success (200 OK):**
```json
{
  "status": "success",
  "message": "Settings retrieved",
  "data": {
    "restaurant_name": "Resto Bintang 5",
    "tax_percentage": "11",
    "service_charge_percentage": "5",
    "operational_hours": "08:00-22:00"
  }
}
```

### 2. Memperbarui Pengaturan
Admin merubah atau menambahkan komponen *setting* (hanya butuh *key* dan *value*). Sistem akan otomatis melakukan Upsert.

- **URL:** `/api/settings/:key` (Contoh: `/api/settings/tax_percentage`)
- **Method:** `PUT`
- **Body Request:**
```json
{
  "value": "12"
}
```
- **Response Success (200 OK):**
```json
{
  "status": "success",
  "message": "Setting updated",
  "data": {
    "id_setting": 3,
    "key": "tax_percentage",
    "value": "12",
    "description": null,
    "updated_at": "2024-03-27T10:05:00.000Z"
  }
}
```

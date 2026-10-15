# Violet Money & Music — Local Storage

Violet adalah aplikasi Flask dengan fitur pencatatan transaksi dan pencarian musik. Data transaksi disimpan di `localStorage` browser pada perangkat ini. Tidak ada Supabase, login, atau sinkronisasi cloud.

## Menjalankan di Windows
1. Instal Python 3.10+ jika belum ada.
2. Buka terminal di folder `webapp`.
3. Jalankan `python -m venv .venv` lalu aktifkan: `.venv\Scripts\activate`.
4. Jalankan `pip install -r requirements.txt`.
5. Jalankan `python app.py`.
6. Buka alamat lokal yang ditampilkan di terminal (biasanya `http://127.0.0.1:5000`).

## Penyimpanan
- Transaksi disimpan pada browser/perangkat yang digunakan.
- Browser berbeda atau perangkat berbeda tidak berbagi data.
- Ekspor JSON secara berkala sebagai cadangan. Menghapus data situs/browser dapat menghapus transaksi lokal.
- Pencarian musik memerlukan internet. Stream musik dapat berubah atau tidak tersedia sewaktu-waktu.

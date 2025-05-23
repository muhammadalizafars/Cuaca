// =========================
// Helper: Arah Mata Angin
// =========================
const arahMataAngin = {
    N: "Utara", NE: "Timur Laut", E: "Timur", SE: "Tenggara",
    S: "Selatan", SW: "Barat Daya", W: "Barat", NW: "Barat Laut"
};

// =========================
// CSV Wilayah BMKG
// =========================
let wilayahData = [];
let currentKodeWilayah = null; // default: null, akan diisi dari CSV pertama

// Helper: get province from kode wilayah (first 2 digits)
function getProvinsiFromKode(kode) {
    const provMap = {
        "11": "Aceh", "12": "Sumatera Utara", "13": "Sumatera Barat", "14": "Riau", "15": "Jambi",
        "16": "Sumatera Selatan", "17": "Bengkulu", "18": "Lampung", "19": "Kep. Bangka Belitung",
        "21": "Kep. Riau", "31": "DKI Jakarta", "32": "Jawa Barat", "33": "Jawa Tengah",
        "34": "DI Yogyakarta", "35": "Jawa Timur", "36": "Banten", "51": "Bali",
        "52": "Nusa Tenggara Barat", "53": "Nusa Tenggara Timur", "61": "Kalimantan Barat",
        "62": "Kalimantan Tengah", "63": "Kalimantan Selatan", "64": "Kalimantan Timur",
        "65": "Kalimantan Utara", "71": "Sulawesi Utara", "72": "Sulawesi Tengah",
        "73": "Sulawesi Selatan", "74": "Sulawesi Tenggara", "75": "Gorontalo",
        "76": "Sulawesi Barat", "81": "Maluku", "82": "Maluku Utara", "91": "Papua Barat", "94": "Papua"
    };
    if (!kode || kode.length < 2) return "-";
    return provMap[kode.substring(0, 2)] || "-";
}

// Load CSV, parsing kabupaten jika ada (kolom ke-2: nama, kolom ke-3: kabupaten)
function loadWilayahCSV(callback) {
    Papa.parse('base.csv', {
        download: true,
        header: false,
        skipEmptyLines: true,
        complete: function (results) {
            wilayahData = results.data.map(row => ({
                kode: row[0],
                nama: row[1],
                kabupaten: row[2] || "-",
                provinsi: getProvinsiFromKode(row[0])
            }));
            if (wilayahData.length > 0) {
                currentKodeWilayah = wilayahData[0].kode;
            }
            if (callback) callback();
        }
    });
}

// =========================
// Fetch & Render Cuaca
// =========================
async function fetchCuaca(kodeWilayah = currentKodeWilayah) {
    if (!kodeWilayah) return;
    try {
        const response = await fetch(`https://api.bmkg.go.id/publik/prakiraan-cuaca?adm4=${kodeWilayah}`);
        const result = await response.json();

        const lokasi = result.data[0].lokasi;
        const cuacaList = result.data[0].cuaca[0];
        const now = new Date();
        const nowHour = now.getHours();

        // Pilih data cuaca saat ini
        const cuacaSekarang = cuacaList.find(item =>
            new Date(item.local_datetime).getHours() === nowHour
        ) || cuacaList[0];

        // Render info utama
        document.getElementById("cuaca-sekarang").textContent = cuacaSekarang.weather_desc;
        document.getElementById("suhu-sekarang").textContent = cuacaSekarang.t + "°C";
        document.getElementById("waktu-update").textContent =
            "UPDATE: " + new Date(cuacaSekarang.local_datetime).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });
        document.getElementById("kelembapan").textContent = "🌫️ Kelembapan: " + cuacaSekarang.hu + "%";
        document.getElementById("angin").textContent = "🌬️ Kecepatan Angin: " + cuacaSekarang.ws + " km/jam";
        document.getElementById("arah-angin").textContent = "🌍 Arah Angin dari: " + (arahMataAngin[cuacaSekarang.wd] || cuacaSekarang.wd);
        document.getElementById("jarak-pandang").textContent = "👁️ Jarak Pandang: " + cuacaSekarang.vs_text;
        document.getElementById("lokasi").textContent =
            `DI ${lokasi.desa.toUpperCase()}, ${lokasi.kecamatan.toUpperCase()}, ${lokasi.kotkab.toUpperCase()}`;

        // Ikon cuaca
        document.getElementById("ikon-cuaca").src = cuacaSekarang.image;
        document.getElementById("ikon-cuaca").alt = cuacaSekarang.weather_desc;

        // Set Map Location from API
        let lat = lokasi.latitude || lokasi.lat || lokasi.lintang || -6.922222;
        let lon = lokasi.longitude || lokasi.lon || lokasi.bujur || 107.6425;
        lat = typeof lat === "string" ? parseFloat(lat) : lat;
        lon = typeof lon === "string" ? parseFloat(lon) : lon;
        const mapUrl = `https://www.google.com/maps?q=${lat},${lon}&hl=id&z=14&output=embed`;
        document.getElementById("mini-map").src = mapUrl;
        document.getElementById("fullscreen-map").src = mapUrl;

        // Prakiraan Jam & Grafik 24 Jam
        const container = document.getElementById("jam-container");
        container.innerHTML = "";
        const dataGrafik = { labels: [], suhu: [] };

        // Interpolasi antar data 3-jam jadi 1-jam
        const interpolated = [];
        for (let i = 0; i < cuacaList.length - 1; i++) {
            const curr = cuacaList[i];
            const next = cuacaList[i + 1];

            const currDate = new Date(curr.local_datetime);
            interpolated.push({
                waktu: currDate,
                t: curr.t,
                desc: curr.weather_desc,
                image: curr.image
            });

            for (let j = 1; j < 3; j++) {
                const interTime = new Date(currDate.getTime() + j * 3600000);
                interpolated.push({
                    waktu: interTime,
                    t: Math.round((curr.t * (3 - j) + next.t * j) / 3),
                    desc: curr.weather_desc,
                    image: curr.image
                });
            }
        }
        // Tambahkan data terakhir
        const last = cuacaList[cuacaList.length - 1];
        interpolated.push({
            waktu: new Date(last.local_datetime),
            t: last.t,
            desc: last.weather_desc,
            image: last.image
        });

        // Ambil 24 jam ke depan (atau sebanyak data yang tersedia, maksimal 24)
        const grafikItems = interpolated.slice(0, 24);

        grafikItems.forEach(item => {
            const waktu = item.waktu.toLocaleTimeString("id-ID", {
                hour: "2-digit", minute: "2-digit", hour12: false
            });

            // Box prakiraan jam
            const box = document.createElement("div");
            box.className = "jam-box";
            box.innerHTML = `
                <p><strong>${waktu} WIB</strong></p>
                <img src="${item.image}" alt="${item.desc}" width="50">
                <p>${item.desc}</p>
                <p>${item.t}°C</p>
            `;
            container.appendChild(box);

            // Data grafik
            dataGrafik.labels.push(waktu);
            dataGrafik.suhu.push(item.t);
        });

        // Render grafik suhu 24 jam
        new Chart(document.getElementById("grafik-suhu"), {
            type: "line",
            data: {
                labels: dataGrafik.labels,
                datasets: [{
                    label: "Suhu (°C)",
                    data: dataGrafik.suhu,
                    borderColor: "#42a5f5",
                    backgroundColor: "rgba(66,165,245,0.2)",
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                plugins: { legend: { display: true } },
                scales: { y: { beginAtZero: false } }
            }
        });

    } catch (error) {
        console.error("Gagal memuat data cuaca:", error);
        document.getElementById("jam-container").innerHTML = "<p>Gagal memuat data.</p>";
    }
}

// =========================
// Fullscreen Map Overlay
// =========================
function setupFullscreenMap() {
    const openBtn = document.getElementById('open-fullscreen-map');
    const closeBtn = document.getElementById('close-fullscreen-map');
    const overlay = document.getElementById('fullscreen-map-overlay');

    function openMap() {
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
    function closeMap() {
        overlay.classList.remove('active');
        document.body.style.overflow = '';
    }

    openBtn.addEventListener('click', openMap);
    closeBtn.addEventListener('click', closeMap);

    // Close on overlay click (but not on iframe or close button)
    overlay.addEventListener('click', function (e) {
        if (e.target === overlay) closeMap();
    });

    // ESC key closes overlay
    document.addEventListener('keydown', function (e) {
        if (e.key === "Escape" && overlay.classList.contains('active')) closeMap();
    });
}

// =========================
// Autocomplete Search Bar Handler
// =========================
function setupSearchBar() {
    const input = document.getElementById("search-input");
    const form = document.getElementById("search-form");
    const errorDiv = document.getElementById("search-error");
    const autocompleteList = document.getElementById("autocomplete-list");

    let currentFocus = -1;
    let currentSuggestions = [];

    input.addEventListener("input", function () {
        const val = this.value.trim().toLowerCase();
        autocompleteList.innerHTML = "";
        autocompleteList.style.display = "none";
        currentFocus = -1;
        currentSuggestions = [];
        if (!val || wilayahData.length === 0) return;

        // Cari semua lokasi yang mengandung input
        const matches = wilayahData.filter(w =>
            w.nama && w.nama.toLowerCase().includes(val)
        ).slice(0, 20); // batasi 20 hasil

        if (matches.length === 0) return;

        matches.forEach((w, idx) => {
            const item = document.createElement("div");
            item.className = "autocomplete-item";
            item.innerHTML = `<span>${w.nama}</span>
                <span style="color:#888;font-size:0.95em;">
                    ${w.kabupaten}, ${w.provinsi}
                </span>`;
            item.addEventListener("mousedown", function (e) {
                e.preventDefault();
                input.value = w.nama;
                autocompleteList.innerHTML = "";
                autocompleteList.style.display = "none";
                errorDiv.textContent = "";
                currentKodeWilayah = w.kode;
                fetchCuaca(currentKodeWilayah);
            });
            autocompleteList.appendChild(item);
        });
        currentSuggestions = matches;
        autocompleteList.style.display = "block";
    });

    // Keyboard navigation
    input.addEventListener("keydown", function (e) {
        let items = autocompleteList.getElementsByClassName("autocomplete-item");
        if (!items.length) return;
        if (e.key === "ArrowDown") {
            currentFocus++;
            addActive(items);
        } else if (e.key === "ArrowUp") {
            currentFocus--;
            addActive(items);
        } else if (e.key === "Enter") {
            if (currentFocus > -1 && items[currentFocus]) {
                items[currentFocus].dispatchEvent(new Event("mousedown"));
                e.preventDefault();
            }
        }
    });

    function addActive(items) {
        if (!items) return;
        removeActive(items);
        if (currentFocus >= items.length) currentFocus = 0;
        if (currentFocus < 0) currentFocus = items.length - 1;
        items[currentFocus].classList.add("active");
        items[currentFocus].scrollIntoView({ block: "nearest" });
    }
    function removeActive(items) {
        for (let i = 0; i < items.length; i++) {
            items[i].classList.remove("active");
        }
    }

    // Hide autocomplete on blur/click outside
    document.addEventListener("click", function (e) {
        if (!autocompleteList.contains(e.target) && e.target !== input) {
            autocompleteList.innerHTML = "";
            autocompleteList.style.display = "none";
        }
    });

    // Submit handler (fallback jika user tekan enter tanpa pilih)
    form.addEventListener("submit", function (e) {
        e.preventDefault();
        const val = input.value.trim().toLowerCase();
        if (!val) {
            errorDiv.textContent = "Masukkan nama lokasi!";
            return;
        }
        // Cari semua yang cocok
        const matches = wilayahData.filter(w =>
            w.nama && w.nama.toLowerCase() === val
        );
        if (matches.length === 1) {
            errorDiv.textContent = "";
            currentKodeWilayah = matches[0].kode;
            fetchCuaca(currentKodeWilayah);
        } else if (matches.length > 1) {
            errorDiv.textContent = "Terdapat beberapa lokasi dengan nama sama. Pilih dari daftar!";
            autocompleteList.innerHTML = "";
            matches.forEach((w, idx) => {
                const item = document.createElement("div");
                item.className = "autocomplete-item";
                item.innerHTML = `<span>${w.nama}</span>
                    <span style="color:#888;font-size:0.95em;">
                        ${w.kabupaten}, ${w.provinsi}
                    </span>`;
                item.addEventListener("mousedown", function (e) {
                    e.preventDefault();
                    input.value = w.nama;
                    autocompleteList.innerHTML = "";
                    autocompleteList.style.display = "none";
                    errorDiv.textContent = "";
                    currentKodeWilayah = w.kode;
                    fetchCuaca(currentKodeWilayah);
                });
                autocompleteList.appendChild(item);
            });
            autocompleteList.style.display = "block";
        } else {
            errorDiv.textContent = "Lokasi tidak ditemukan. Coba nama kota/kabupaten/kecamatan lain.";
        }
    });
}

// =========================
// Inisialisasi
// =========================
document.addEventListener("DOMContentLoaded", function () {
    loadWilayahCSV(function () {
        fetchCuaca(currentKodeWilayah);
    });
    setupFullscreenMap();
    setupSearchBar();
});
document.addEventListener("DOMContentLoaded", function() {
    const openBtn = document.getElementById("open-fullscreen-map");
    const closeBtn = document.getElementById("close-fullscreen-map");
    const overlay = document.getElementById("fullscreen-map-overlay");

    if (openBtn && closeBtn && overlay) {
        openBtn.addEventListener("click", function() {
            overlay.style.display = "flex";
            document.body.style.overflow = "hidden";
        });
        closeBtn.addEventListener("click", function() {
            overlay.style.display = "none";
            document.body.style.overflow = "";
        });
        // Optional: close overlay when clicking outside the iframe
        overlay.addEventListener("click", function(e) {
            if (e.target === overlay) {
                overlay.style.display = "none";
                document.body.style.overflow = "";
            }
        });
    }
});
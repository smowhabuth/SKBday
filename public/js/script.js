// Frontend JavaScript (if needed)
document.addEventListener('DOMContentLoaded', function() {
    // Any client-side functionality can go here
    console.log("Birthday app loaded!");
});


document.addEventListener("DOMContentLoaded", function() {
    const modal = document.getElementById("messageModal");
    const modalAuthor = document.getElementById("modalAuthor");
    const modalMessage = document.getElementById("modalMessage");
    const closeBtn = document.querySelector(".close-btn");

    document.querySelectorAll(".envelope.clickable").forEach(env => {
        env.addEventListener("click", function() {
            this.textContent = "✉️"; // change to opened envelope
            this.classList.add("opened");
            modalAuthor.textContent = this.dataset.author;
            modalMessage.textContent = this.dataset.message;
            modal.style.display = "block";
        });
    });

    closeBtn.addEventListener("click", function() {
        modal.style.display = "none";
    });

    window.addEventListener("click", function(e) {
        if (e.target === modal) {
            modal.style.display = "none";
        }
    });
});

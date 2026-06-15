document.addEventListener("DOMContentLoaded", () => {
    // Inject Navbar
    const navbarHtml = `
    <div class="global-navbar" id="globalNavbarEl">
        <div class="global-navbar-profile" id="globalNavProfileBtn">
            <img src="/assets/default_avatar.png" class="global-navbar-avatar" id="globalNavAvatar" alt="Profile">
            <span class="global-navbar-name" id="globalNavName">Guest</span>
        </div>
        <a href="/leaderboard.html" class="global-navbar-btn">🏆 Leaderboard</a>
    </div>
    `;
    document.body.insertAdjacentHTML('afterbegin', navbarHtml);

    // Load Data
    const savedName = localStorage.getItem("playerName");
    const savedPhoto = localStorage.getItem("playerPhotoUrl");
    if (savedName) document.getElementById("globalNavName").innerText = savedName;
    if (savedPhoto) document.getElementById("globalNavAvatar").src = savedPhoto;

    // Handle Clicks
    document.getElementById("globalNavProfileBtn").onclick = () => {
        if (!localStorage.getItem("playerId")) {
            // Not logged in yet
            const nameInput = document.getElementById("playerName");
            if (nameInput) nameInput.focus();
        } else {
            // Go to profile page to view/edit
            window.location.href = "/profile.html";
        }
    };
});

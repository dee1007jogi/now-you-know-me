document.addEventListener("DOMContentLoaded", () => {
    // Inject Navbar
    const navbarHtml = `
    <!-- Top Left Title -->
    <div id="globalNavTitle" style="position: absolute; top: 15px; left: 30px; z-index: 1000; display: none; cursor: pointer; transform: scale(0.35); transform-origin: top left;" onclick="location.href='/'">
        <div class="cinematic-container" style="margin: 0;">
            <div class="cinematic-title">
                <span>N</span><span>O</span><span>W</span>&nbsp;<span>Y</span><span>O</span><span>U</span><br/>
                <span>K</span><span>N</span><span>O</span><span>W</span>&nbsp;<span>M</span><span>E</span>
            </div>
        </div>
    </div>

    <!-- Top Right Navbar -->
    <div class="global-navbar" id="globalNavbarEl">
        <div class="global-navbar-profile" id="globalNavProfileBtn">
            <img src="/assets/default_avatar.png" class="global-navbar-avatar" id="globalNavAvatar" alt="Profile">
            <span class="global-navbar-name" id="globalNavName">Guest</span>
        </div>
        <a href="/leaderboard.html" class="global-navbar-btn">🏆 Leaderboard</a>
    </div>

    <!-- Sidebar Overlay -->
    <div id="profileSidebarOverlay" style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.6); backdrop-filter: blur(5px); z-index: 9998; opacity: 0; pointer-events: none; transition: opacity 0.3s ease;"></div>
    
    <!-- Profile Sidebar -->
    <div id="profileSidebar" style="position: fixed; top: 0; right: -500px; width: 100%; max-width: 500px; height: 100vh; background: #060913; z-index: 9999; transition: right 0.4s cubic-bezier(0.16, 1, 0.3, 1); box-shadow: -10px 0 30px rgba(0,0,0,0.8);">
        <iframe id="profileIframe" src="" style="width: 100%; height: 100%; border: none; background: transparent;"></iframe>
    </div>
    `;
    document.body.insertAdjacentHTML('afterbegin', navbarHtml);

    // Show title only if not on main page
    const isMainPage = window.location.pathname === '/' || window.location.pathname === '/index.html';
    if (!isMainPage) {
        document.getElementById("globalNavTitle").style.display = "block";
    }

    // Load Data
    const savedName = localStorage.getItem("playerName");
    const savedPhoto = localStorage.getItem("playerPhotoUrl");
    if (savedName) document.getElementById("globalNavName").innerText = savedName;
    if (savedPhoto) document.getElementById("globalNavAvatar").src = savedPhoto;

    // Handle Profile Clicks
    document.getElementById("globalNavProfileBtn").onclick = () => {
        if (!localStorage.getItem("playerId")) {
            // Not logged in yet
            const nameInput = document.getElementById("playerName");
            if (nameInput) nameInput.focus();
        } else {
            // Open sidebar
            const sidebar = document.getElementById("profileSidebar");
            const overlay = document.getElementById("profileSidebarOverlay");
            const iframe = document.getElementById("profileIframe");
            
            // Set source if not already set, appending ?sidebar=1
            if (!iframe.src || iframe.src === window.location.href) {
                iframe.src = "/profile.html?sidebar=1";
            }
            
            sidebar.style.right = "0";
            overlay.style.opacity = "1";
            overlay.style.pointerEvents = "auto";
        }
    };

    // Close Sidebar
    window.closeProfileSidebar = () => {
        const sidebar = document.getElementById("profileSidebar");
        const overlay = document.getElementById("profileSidebarOverlay");
        sidebar.style.right = "-500px";
        overlay.style.opacity = "0";
        overlay.style.pointerEvents = "none";
    };

    document.getElementById("profileSidebarOverlay").onclick = window.closeProfileSidebar;
});

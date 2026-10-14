document.addEventListener("DOMContentLoaded", function () {
    const toggle = document.getElementById("themeToggle");
    const savedTheme = localStorage.getItem("skillswap-theme");
    if (savedTheme === "dark") document.body.classList.add("dark-theme");

    function updateThemeButton() {
        if (!toggle) return;
        const dark = document.body.classList.contains("dark-theme");
        toggle.textContent = dark ? "☀" : "☾";
        toggle.setAttribute("aria-label", dark ? "Switch to light theme" : "Switch to dark theme");
    }

    if (toggle) {
        toggle.addEventListener("click", function () {
            document.body.classList.toggle("dark-theme");
            localStorage.setItem(
                "skillswap-theme",
                document.body.classList.contains("dark-theme") ? "dark" : "light"
            );
            updateThemeButton();
        });
    }
    updateThemeButton();

    const signedIn = Boolean(localStorage.getItem(window.SkillSwap.TOKEN_KEY));
    document.querySelectorAll("[data-auth-link]").forEach(function (link) {
        link.hidden = link.dataset.authLink === "guest" ? signedIn : !signedIn;
    });
});

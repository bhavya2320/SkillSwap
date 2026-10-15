(function () {
    const API_BASE_URL = "https://skillswap-xxy9.onrender.com";
    const TOKEN_KEY = "skillswap-token";
    const USER_KEY = "skillswap-user";

    function getUser() {
        try {
            return JSON.parse(localStorage.getItem(USER_KEY) || "null");
        } catch (error) {
            console.error("Could not read the saved SkillSwap user.", error);
            return null;
        }
    }

    function saveUser(user) {
        localStorage.setItem(USER_KEY, JSON.stringify(user));
        localStorage.setItem("skillswap-name", user.name || "");
        localStorage.setItem("skillswap-email", user.email || "");
        if (user.credits !== undefined) {
            localStorage.setItem("skillswap-credits", String(user.credits));
        }
    }

    function clearSession() {
        [
            TOKEN_KEY,
            USER_KEY,
            "skillswap-name",
            "skillswap-email",
            "skillswap-credits",
            "skillswap-skills"
        ].forEach(function (key) {
            localStorage.removeItem(key);
        });
    }

    async function request(path, options) {
        const settings = options || {};
        const headers = new Headers(settings.headers || {});
        const token = localStorage.getItem(TOKEN_KEY);

        if (settings.body !== undefined && !headers.has("Content-Type")) {
            headers.set("Content-Type", "application/json");
        }
        if (token) {
            headers.set("Authorization", "Bearer " + token);
        }

        let response;
        try {
            response = await fetch(API_BASE_URL + path, {
                ...settings,
                headers: headers
            });
        } catch (error) {
            if (error instanceof TypeError) {
                throw new Error("Cannot reach the SkillSwap API at " + API_BASE_URL + ". Make sure the backend is running.");
            }
            throw error;
        }
        const contentType = response.headers.get("content-type") || "";
        const data = contentType.includes("application/json")
            ? await response.json()
            : null;

        if (response.status === 401 && document.body.dataset.protected === "true") {
            clearSession();
            window.location.replace("login.html");
        }

        if (!response.ok || (data && data.success === false)) {
            throw new Error((data && data.message) || "The request could not be completed.");
        }

        return data;
    }

    function requireAuth() {
        if (localStorage.getItem(TOKEN_KEY)) {
            return true;
        }
        const next = encodeURIComponent(window.location.pathname.split("/").pop() || "dashboard.html");
        window.location.replace("login.html?next=" + next);
        return false;
    }

    function setSession(data) {
        if (!data || !data.token || !data.user) {
            throw new Error("The server returned an invalid authentication response.");
        }
        localStorage.setItem(TOKEN_KEY, data.token);
        saveUser(data.user);
    }

    function showMessage(target, message, type) {
        if (!target) return;
        target.textContent = message || "";
        target.className = "notice" + (type ? " notice-" + type : "");
        target.hidden = !message;
        target.setAttribute("role", type === "error" ? "alert" : "status");
    }

    function element(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined && text !== null) node.textContent = String(text);
        return node;
    }

    function formatDate(value) {
        if (!value) return "Date not available";
        const date = new Date(value);
        return Number.isNaN(date.getTime())
            ? String(value)
            : date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
    }

    window.SkillSwap = {
        API_BASE_URL: API_BASE_URL,
        TOKEN_KEY: TOKEN_KEY,
        USER_KEY: USER_KEY,
        request: request,
        getUser: getUser,
        saveUser: saveUser,
        setSession: setSession,
        clearSession: clearSession,
        requireAuth: requireAuth,
        showMessage: showMessage,
        element: element,
        formatDate: formatDate
    };
}());

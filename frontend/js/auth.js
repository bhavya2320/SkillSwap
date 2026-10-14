document.addEventListener("DOMContentLoaded", function () {
    const api = window.SkillSwap;
    const loginForm = document.getElementById("loginForm");
    const registerForm = document.getElementById("registerForm");

    function setBusy(form, busy) {
        const button = form.querySelector('button[type="submit"]');
        if (button) {
            button.disabled = busy;
            button.setAttribute("aria-busy", String(busy));
        }
    }

    function setPasswordVisibility(toggleId, inputIds) {
        const toggle = document.getElementById(toggleId);
        if (!toggle) return;

        toggle.addEventListener("change", function () {
            inputIds.forEach(function (id) {
                const input = document.getElementById(id);
                if (input) input.type = toggle.checked ? "text" : "password";
            });
        });
    }

    setPasswordVisibility("showPassword", ["password"]);
    setPasswordVisibility("showRegisterPassword", ["registerPassword", "confirmPassword"]);

    if (loginForm) {
        loginForm.addEventListener("submit", async function (event) {
            event.preventDefault();
            const message = document.getElementById("formMessage");
            api.showMessage(message, "", "");
            setBusy(loginForm, true);

            try {
                const result = await api.request("/api/auth/login", {
                    method: "POST",
                    body: JSON.stringify({
                        email: document.getElementById("email").value.trim(),
                        password: document.getElementById("password").value
                    })
                });
                api.setSession(result.data);
                window.location.assign("dashboard.html");
            } catch (error) {
                api.showMessage(message, error.message, "error");
            } finally {
                setBusy(loginForm, false);
            }
        });
    }

    if (registerForm) {
        registerForm.addEventListener("submit", async function (event) {
            event.preventDefault();
            const message = document.getElementById("registerMessage");
            const password = document.getElementById("registerPassword").value;
            const confirmPassword = document.getElementById("confirmPassword").value;
            api.showMessage(message, "", "");

            if (password !== confirmPassword) {
                api.showMessage(message, "Passwords do not match.", "error");
                return;
            }

            setBusy(registerForm, true);
            try {
                const result = await api.request("/api/auth/register", {
                    method: "POST",
                    body: JSON.stringify({
                        name: document.getElementById("name").value.trim(),
                        email: document.getElementById("registerEmail").value.trim(),
                        password: password,
                        confirmPassword: confirmPassword
                    })
                });
                api.setSession(result.data);
                window.location.assign("dashboard.html");
            } catch (error) {
                api.showMessage(message, error.message, "error");
            } finally {
                setBusy(registerForm, false);
            }
        });
    }
});

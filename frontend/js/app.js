document.addEventListener("DOMContentLoaded", function () {
    const api = window.SkillSwap;
    if (document.body.dataset.protected === "true" && !api.requireAuth()) return;

    const currentPage = document.body.dataset.page;
    const cachedUser = api.getUser();
    if (cachedUser && cachedUser.name) {
        document.querySelectorAll("[data-user-name]").forEach(function (node) {
            node.textContent = cachedUser.name;
        });
    }
    const userId = function () {
        const user = api.getUser();
        return user && user._id ? String(user._id) : "";
    };

    document.querySelectorAll("[data-logout]").forEach(function (button) {
        button.addEventListener("click", function () {
            api.clearSession();
            window.location.assign("login.html");
        });
    });

    const profileLink = document.querySelector("[data-profile-link]");
    if (profileLink && userId()) profileLink.href = "profile.html?id=" + encodeURIComponent(userId());

    function setBusy(form, busy) {
        const button = form.querySelector('button[type="submit"]');
        if (button) {
            button.disabled = busy;
            button.setAttribute("aria-busy", String(busy));
        }
    }

    function clearAndShow(target, message, type) {
        target.replaceChildren();
        if (message) {
            const notice = api.element(target.tagName === "UL" || target.tagName === "OL" ? "li" : "p", "empty-state", message);
            target.appendChild(notice);
        }
        if (type === "error" && message) target.setAttribute("role", "alert");
        else target.removeAttribute("role");
    }

    function labeledValue(label, value) {
        const wrapper = api.element("p", "detail-line");
        wrapper.appendChild(api.element("strong", "", label + ": "));
        wrapper.appendChild(document.createTextNode(value || "—"));
        return wrapper;
    }

    function displayProfileImage(user) {
        const avatar = document.getElementById("profileAvatar");
        const initial = (user.name || "S").charAt(0).toUpperCase();
        avatar.replaceChildren();
        avatar.textContent = initial;

        if (user.profileImageUrl) {
            const image = document.createElement("img");
            image.src = user.profileImageUrl;
            image.alt = user.name ? user.name + " profile photo" : "Profile photo";
            image.addEventListener("error", function () {
                avatar.replaceChildren();
                avatar.textContent = initial;
            }, { once: true });
            avatar.replaceChildren(image);
        }
    }

    async function loadDashboard() {
        const welcome = document.getElementById("welcomeName");
        const balance = document.getElementById("creditBalance");
        const skillsTarget = document.getElementById("dashboardSkills");
        const requestsTarget = document.getElementById("dashboardRequests");
        try {
            const profile = await api.request("/api/auth/me");
            const user = profile.data.user;
            api.saveUser(user);
            welcome.textContent = user.name || "there";
            document.querySelectorAll("[data-user-name]").forEach(function (node) {
                node.textContent = user.name || "SkillSwap member";
            });

            const [skillsResult, swapsResult, creditsResult] = await Promise.all([
                api.request("/api/skills?userId=" + encodeURIComponent(user._id)),
                api.request("/api/swaps"),
                api.request("/api/credits/" + encodeURIComponent(user._id) + "/balance")
            ]);
            balance.textContent = String(creditsResult.balance);
            const mySkills = skillsResult.skills || [];
            document.getElementById("dashboardSkillCount").textContent = String(mySkills.length);
            skillsTarget.replaceChildren();
            if (mySkills.length === 0) {
                clearAndShow(skillsTarget, "Add a skill you can teach or want to learn.", "");
            } else {
                mySkills.slice(0, 4).forEach(function (skill) {
                    const item = api.element("li", "list-item");
                    item.appendChild(api.element("strong", "", skill.name));
                    item.appendChild(api.element("span", "tag", skill.type === "teach" ? "Teaching" : "Learning"));
                    skillsTarget.appendChild(item);
                });
            }

            const swaps = swapsResult.swaps || [];
            const incoming = swaps.filter(function (swap) {
                return String(swap.receiverId) === String(user._id) && swap.status === "pending";
            });
            document.getElementById("pendingRequestCount").textContent = String(incoming.length);
            requestsTarget.replaceChildren();
            if (incoming.length === 0) {
                clearAndShow(requestsTarget, "No incoming requests yet.", "");
            } else {
                incoming.slice(0, 3).forEach(function (swap) {
                    const item = api.element("li", "list-item");
                    item.appendChild(api.element("strong", "", swap.requesterName + " wants to swap"));
                    item.appendChild(api.element("span", "", swap.skillOffered + " for " + swap.skillWanted));
                    requestsTarget.appendChild(item);
                });
            }
        } catch (error) {
            api.showMessage(document.getElementById("pageMessage"), error.message, "error");
        }
    }

    async function loadProfile() {
        const form = document.getElementById("profileForm");
        const profileMessage = document.getElementById("pageMessage");
        const requestedId = new URLSearchParams(window.location.search).get("id");
        const ownProfile = !requestedId || requestedId === userId();
        try {
            const result = await api.request(ownProfile ? "/api/users" : "/api/users/" + encodeURIComponent(requestedId));
            const user = result.data.user;
            document.getElementById("profileName").textContent = user.name;
            displayProfileImage(user);
            document.getElementById("profileEmail").textContent = user.email || "";
            document.getElementById("profileBio").textContent = user.bio || "This member has not added a bio yet.";
            document.getElementById("profileTeaching").textContent = (user.teachingSkills || []).join(", ") || "Not listed";
            document.getElementById("profileLearning").textContent = (user.learningSkills || []).join(", ") || "Not listed";
            document.getElementById("profileAvailability").textContent = (user.availability || []).join(", ") || "Not listed";
            const profileCredits = document.getElementById("profileCredits");
            profileCredits.textContent = user.credits === undefined ? "" : String(user.credits);
            profileCredits.parentElement.hidden = user.credits === undefined;
            document.getElementById("profileFormSection").hidden = !ownProfile;
            if (!ownProfile) document.getElementById("profileEmail").hidden = true;

            if (ownProfile) {
                document.getElementById("profileNameInput").value = user.name || "";
                document.getElementById("bioInput").value = user.bio || "";
                document.getElementById("teachingSkillsInput").value = (user.teachingSkills || []).join(", ");
                document.getElementById("learningSkillsInput").value = (user.learningSkills || []).join(", ");
                document.getElementById("availabilityInput").value = (user.availability || []).join("\n");
                document.getElementById("profileImageUrlInput").value = user.profileImageUrl || "";

                form.addEventListener("submit", async function (event) {
                    event.preventDefault();
                    api.showMessage(profileMessage, "", "");
                    setBusy(form, true);
                    const splitValues = function (value) {
                        return value.split(/[\n,]/).map(function (item) {
                            return item.trim();
                        }).filter(Boolean);
                    };
                    try {
                        const updated = await api.request("/api/users", {
                            method: "PUT",
                            body: JSON.stringify({
                                name: document.getElementById("profileNameInput").value.trim(),
                                bio: document.getElementById("bioInput").value.trim(),
                                teachingSkills: splitValues(document.getElementById("teachingSkillsInput").value),
                                learningSkills: splitValues(document.getElementById("learningSkillsInput").value),
                                availability: splitValues(document.getElementById("availabilityInput").value),
                                profileImageUrl: document.getElementById("profileImageUrlInput").value.trim()
                            })
                        });
                        api.saveUser(updated.data.user);
                        document.getElementById("profileName").textContent = updated.data.user.name;
                        displayProfileImage(updated.data.user);
                        document.getElementById("profileBio").textContent = updated.data.user.bio || "This member has not added a bio yet.";
                        document.getElementById("profileTeaching").textContent = (updated.data.user.teachingSkills || []).join(", ") || "Not listed";
                        document.getElementById("profileLearning").textContent = (updated.data.user.learningSkills || []).join(", ") || "Not listed";
                        document.getElementById("profileAvailability").textContent = (updated.data.user.availability || []).join(", ") || "Not listed";
                        api.showMessage(profileMessage, "Your profile has been updated.", "success");
                    } catch (error) {
                        api.showMessage(profileMessage, error.message, "error");
                    } finally {
                        setBusy(form, false);
                    }
                });
            }
        } catch (error) {
            api.showMessage(profileMessage, error.message, "error");
        }
    }

    async function loadSkills() {
        const form = document.getElementById("skillForm");
        const target = document.getElementById("skillsList");
        const message = document.getElementById("pageMessage");

        async function refresh() {
            const result = await api.request("/api/skills?userId=" + encodeURIComponent(userId()));
            target.replaceChildren();
            if (!result.skills.length) {
                clearAndShow(target, "Your skill list is empty. Add a skill above to get started.", "");
                return;
            }

            result.skills.forEach(function (skill) {
                const card = api.element("article", "surface-card skill-entry");
                const details = api.element("div", "");
                details.appendChild(api.element("h3", "", skill.name));
                details.appendChild(api.element("span", "tag", skill.type === "teach" ? "I can teach" : "I want to learn"));
                details.appendChild(api.element("p", "muted", (skill.level || "Beginner") + (skill.description ? " · " + skill.description : "")));
                card.appendChild(details);

                const actions = api.element("div", "inline-actions");
                const edit = api.element("button", "button button-secondary", "Edit");
                edit.type = "button";
                edit.addEventListener("click", function () {
                    const editing = card.querySelector("form");
                    if (editing) {
                        editing.remove();
                        return;
                    }
                    const editForm = api.element("form", "edit-skill-form");
                    const nameInput = document.createElement("input");
                    nameInput.value = skill.name;
                    nameInput.maxLength = 100;
                    nameInput.required = true;
                    nameInput.setAttribute("aria-label", "Skill name");
                    const typeSelect = document.createElement("select");
                    typeSelect.setAttribute("aria-label", "Skill type");
                    [["teach", "I can teach"], ["learn", "I want to learn"]].forEach(function (option) {
                        const item = document.createElement("option");
                        item.value = option[0];
                        item.textContent = option[1];
                        typeSelect.appendChild(item);
                    });
                    typeSelect.value = skill.type;
                    const levelSelect = document.createElement("select");
                    levelSelect.setAttribute("aria-label", "Skill level");
                    ["Beginner", "Intermediate", "Advanced"].forEach(function (level) {
                        const item = document.createElement("option");
                        item.value = level;
                        item.textContent = level;
                        levelSelect.appendChild(item);
                    });
                    levelSelect.value = skill.level || "Beginner";
                    const descriptionInput = document.createElement("textarea");
                    descriptionInput.value = skill.description || "";
                    descriptionInput.maxLength = 500;
                    descriptionInput.setAttribute("aria-label", "Skill description");
                    const save = api.element("button", "button", "Save changes");
                    save.type = "submit";
                    editForm.append(nameInput, typeSelect, levelSelect, descriptionInput, save);
                    editForm.addEventListener("submit", async function (event) {
                        event.preventDefault();
                        setBusy(editForm, true);
                        try {
                            await api.request("/api/skills/" + encodeURIComponent(skill._id), {
                                method: "PUT",
                                body: JSON.stringify({
                                    name: nameInput.value.trim(),
                                    type: typeSelect.value,
                                    level: levelSelect.value,
                                    description: descriptionInput.value.trim()
                                })
                            });
                            await refresh();
                            api.showMessage(message, "Skill updated.", "success");
                        } catch (error) {
                            api.showMessage(message, error.message, "error");
                            setBusy(editForm, false);
                        }
                    });
                    card.appendChild(editForm);
                });

                const remove = api.element("button", "button button-danger", "Delete");
                remove.type = "button";
                remove.addEventListener("click", async function () {
                    remove.disabled = true;
                    try {
                        await api.request("/api/skills/" + encodeURIComponent(skill._id), { method: "DELETE" });
                        await refresh();
                        api.showMessage(message, "Skill deleted.", "success");
                    } catch (error) {
                        api.showMessage(message, error.message, "error");
                        remove.disabled = false;
                    }
                });
                actions.append(edit, remove);
                card.appendChild(actions);
                target.appendChild(card);
            });
        }

        form.addEventListener("submit", async function (event) {
            event.preventDefault();
            api.showMessage(message, "", "");
            setBusy(form, true);
            try {
                await api.request("/api/skills", {
                    method: "POST",
                    body: JSON.stringify({
                        name: document.getElementById("skillName").value.trim(),
                        type: document.getElementById("skillType").value,
                        level: document.getElementById("skillLevel").value,
                        description: document.getElementById("skillDescription").value.trim()
                    })
                });
                form.reset();
                await refresh();
                api.showMessage(message, "Skill added.", "success");
            } catch (error) {
                api.showMessage(message, error.message, "error");
            } finally {
                setBusy(form, false);
            }
        });

        try {
            await refresh();
        } catch (error) {
            api.showMessage(message, error.message, "error");
        }
    }

    async function loadSearch() {
        const form = document.getElementById("searchForm");
        const target = document.getElementById("searchResults");
        const message = document.getElementById("pageMessage");
        let myTeachingSkills = [];

        async function search() {
            target.replaceChildren(api.element("p", "loading-state", "Searching available skills…"));
            const query = new URLSearchParams();
            const searchText = document.getElementById("searchText").value.trim();
            const type = document.getElementById("searchType").value;
            if (searchText) query.set("search", searchText);
            if (type) query.set("type", type);
            const [result, ownSkills] = await Promise.all([
                api.request("/api/skills?" + query.toString()),
                api.request("/api/skills?userId=" + encodeURIComponent(userId()) + "&type=teach")
            ]);
            myTeachingSkills = ownSkills.skills || [];
            const existingSwaps = await api.request("/api/swaps");
            target.replaceChildren();
            if (!result.skills.length) {
                clearAndShow(target, "No matching skills found. Try a different search or check back later.", "");
                return;
            }
            result.skills.forEach(function (skill) {
                const card = api.element("article", "surface-card result-card");
                card.appendChild(api.element("h3", "", skill.name));
                card.appendChild(api.element("p", "muted", skill.level || "Beginner"));
                const ownerLink = api.element("a", "text-link", skill.userName || "View member");
                ownerLink.href = "profile.html?id=" + encodeURIComponent(skill.userId);
                card.appendChild(ownerLink);
                if (String(skill.userId) !== userId() && skill.type === "teach") {
                    if (myTeachingSkills.length) {
                        const requestForm = api.element("form", "request-skill-form");
                        requestForm.hidden = true;
                        const offerLabel = api.element("label", "", "Skill you can teach in exchange");
                        const select = document.createElement("select");
                        select.required = true;
                        select.setAttribute("aria-label", "Choose a skill to offer");
                        const placeholder = document.createElement("option");
                        placeholder.value = "";
                        placeholder.textContent = "Choose one of your teaching skills";
                        placeholder.disabled = true;
                        placeholder.selected = true;
                        select.appendChild(placeholder);
                        myTeachingSkills.forEach(function (ownedSkill) {
                            const option = document.createElement("option");
                            option.value = ownedSkill.name;
                            option.textContent = ownedSkill.name;
                            select.appendChild(option);
                        });
                        offerLabel.appendChild(select);
                        const selectedSkills = api.element("p", "muted", "Requesting " + skill.name + " from " + (skill.userName || "this member") + ".");
                        const submit = api.element("button", "button", "Send swap request");
                        submit.type = "submit";
                        requestForm.append(selectedSkills, offerLabel, submit);
                        requestForm.addEventListener("submit", async function (event) {
                            event.preventDefault();
                            if (!select.value || !myTeachingSkills.some(function (ownSkill) {
                                return ownSkill.name === select.value && ownSkill.type === "teach" && String(ownSkill.userId) === userId();
                            })) {
                                select.focus();
                                api.showMessage(message, "Choose one of your own teaching skills to offer.", "error");
                                return;
                            }
                            setBusy(requestForm, true);
                            try {
                                await api.request("/api/swaps", {
                                    method: "POST",
                                    body: JSON.stringify({
                                        receiverId: skill.userId,
                                        skillOffered: select.value,
                                        skillWanted: skill.name
                                    })
                                });
                                api.showMessage(message, "Swap request sent to " + (skill.userName || "this member") + ".", "success");
                                submit.textContent = "Request sent";
                                submit.disabled = true;
                                requestForm.hidden = true;
                                requestForm.previousElementSibling.textContent = "Request pending";
                                requestForm.previousElementSibling.disabled = true;
                            } catch (error) {
                                api.showMessage(message, error.message, "error");
                            } finally {
                                setBusy(requestForm, false);
                            }
                        });
                        const hasPendingRequest = existingSwaps.swaps.some(function (swap) {
                            return String(swap.requesterId) === userId() &&
                                String(swap.receiverId) === String(skill.userId) &&
                                swap.status === "pending" &&
                                myTeachingSkills.some(function (ownSkill) {
                                    return String(swap.skillOffered).toLocaleLowerCase() === String(ownSkill.name).toLocaleLowerCase();
                                }) &&
                                String(swap.skillWanted).toLocaleLowerCase() === String(skill.name).toLocaleLowerCase();
                        });
                        const openForm = api.element("button", "button", hasPendingRequest ? "Request pending" : "Request Swap");
                        openForm.type = "button";
                        openForm.disabled = hasPendingRequest;
                        openForm.setAttribute("aria-expanded", "false");
                        openForm.addEventListener("click", function () {
                            requestForm.hidden = !requestForm.hidden;
                            openForm.setAttribute("aria-expanded", String(!requestForm.hidden));
                            if (!requestForm.hidden) select.focus();
                        });
                        card.append(openForm, requestForm);
                    } else {
                        card.appendChild(api.element("p", "muted", "Add a teaching skill before requesting a swap."));
                    }
                } else if (String(skill.userId) === userId()) {
                    card.appendChild(api.element("span", "tag", "Your skill"));
                } else {
                    card.appendChild(api.element("p", "muted", "Only teaching listings can receive swap requests."));
                }
                target.appendChild(card);
            });
        }

        form.addEventListener("submit", async function (event) {
            event.preventDefault();
            try {
                api.showMessage(message, "", "");
                await search();
            } catch (error) {
                api.showMessage(message, error.message, "error");
                clearAndShow(target, "Search could not be completed.", "error");
            }
        });

        try {
            await search();
        } catch (error) {
            api.showMessage(message, error.message, "error");
            clearAndShow(target, "Search could not be completed.", "error");
        }
    }

    async function loadRequests() {
        const target = document.getElementById("requestsList");
        const message = document.getElementById("pageMessage");

        async function refresh() {
            const result = await api.request("/api/swaps");
            target.replaceChildren();
            if (!result.swaps.length) {
                clearAndShow(target, "No swap requests yet. Discover a skill to start one.", "");
                return;
            }

            result.swaps.forEach(function (swap) {
                const incoming = String(swap.receiverId) === userId();
                const card = api.element("article", "surface-card request-card");
                card.appendChild(api.element("h3", "", incoming ? "Incoming request" : "Outgoing request"));
                card.appendChild(labeledValue("Requester", swap.requesterName));
                card.appendChild(labeledValue("Recipient", swap.receiverName));
                card.appendChild(labeledValue("Offered teaching skill", swap.skillOffered));
                card.appendChild(labeledValue("Requested skill", swap.skillWanted));
                card.appendChild(api.element("span", "tag status-" + swap.status, swap.status));
                const actions = api.element("div", "inline-actions");

                if (incoming && swap.status === "pending") {
                    [["accepted", "Accept"], ["rejected", "Reject"]].forEach(function (action) {
                        const button = api.element("button", "button" + (action[0] === "rejected" ? " button-secondary" : ""), action[1]);
                        button.type = "button";
                        button.addEventListener("click", async function () {
                            const idleText = action[1];
                            button.disabled = true;
                            button.textContent = action[0] === "accepted" ? "Accepting…" : "Rejecting…";
                            button.setAttribute("aria-busy", "true");
                            try {
                                await api.request("/api/swaps/" + encodeURIComponent(swap._id) + "/status", {
                                    method: "PATCH",
                                    body: JSON.stringify({ status: action[0] })
                                });
                                api.showMessage(message, "Swap request " + action[0] + ".", "success");
                                await refresh();
                            } catch (error) {
                                api.showMessage(message, error.message, "error");
                                button.disabled = false;
                                button.textContent = idleText;
                                button.removeAttribute("aria-busy");
                                if (error.message === "Pending request not found for this receiver") {
                                    await refresh();
                                }
                            }
                        });
                        actions.appendChild(button);
                    });
                }

                if (swap.status === "accepted" || swap.status === "completed") {
                    const counterpart = incoming ? swap.requesterName : swap.receiverName;
                    const messageLink = api.element("a", "button button-secondary", "Open messages");
                    messageLink.href = "messages.html?swapId=" + encodeURIComponent(swap._id);
                    actions.append(messageLink);
                    if (swap.status === "accepted") {
                        const sessionLink = api.element("a", "button button-secondary", "Schedule session");
                        sessionLink.href = "sessions.html?swapId=" + encodeURIComponent(swap._id);
                        actions.appendChild(sessionLink);
                    }
                    if (swap.status === "accepted") {
                        const lessonRole = String(swap.requesterId) === userId() ? "requester" : "receiver";
                        const lessonStatus = lessonRole === "requester" ? swap.requesterLessonStatus : swap.receiverLessonStatus;
                        if (lessonStatus !== "completed") {
                            const skill = lessonRole === "requester" ? swap.skillOffered : swap.skillWanted;
                            const complete = api.element("button", "button", "Mark " + skill + " taught");
                            complete.type = "button";
                            complete.addEventListener("click", async function () {
                                complete.disabled = true;
                                try {
                                    await api.request("/api/swaps/" + encodeURIComponent(swap._id) + "/complete", {
                                        method: "PATCH",
                                        body: JSON.stringify({ lessonRole: lessonRole })
                                    });
                                    api.showMessage(message, "Lesson marked complete. Credit transfer recorded by the server.", "success");
                                    await refresh();
                                } catch (error) {
                                    api.showMessage(message, error.message, "error");
                                    complete.disabled = false;
                                }
                            });
                            actions.appendChild(complete);
                        }
                    }
                    card.appendChild(api.element("p", "muted", "Swap with " + counterpart + " · lessons: " + swap.requesterLessonStatus + " / " + swap.receiverLessonStatus));
                }

                if (actions.childElementCount) card.appendChild(actions);
                target.appendChild(card);
            });
        }

        try {
            await refresh();
        } catch (error) {
            api.showMessage(message, error.message, "error");
            clearAndShow(target, "Requests could not be loaded.", "error");
        }
    }

    async function loadMessages() {
        const threads = document.getElementById("conversationList");
        const messages = document.getElementById("messageList");
        const form = document.getElementById("messageForm");
        const message = document.getElementById("pageMessage");
        const heading = document.getElementById("conversationHeading");
        let selectedSwap = null;

        async function showThread(swap) {
            selectedSwap = swap;
            heading.textContent = "Conversation with " + (String(swap.requesterId) === userId() ? swap.receiverName : swap.requesterName);
            form.hidden = false;
            messages.replaceChildren(api.element("p", "loading-state", "Loading messages…"));
            try {
                const result = await api.request("/api/messages/" + encodeURIComponent(swap._id));
                messages.replaceChildren();
                if (!result.messages.length) {
                    clearAndShow(messages, "No messages yet. Say hello to start the conversation.", "");
                } else {
                    result.messages.forEach(function (item) {
                        const entry = api.element("article", "message-bubble" + (String(item.senderId) === userId() ? " message-own" : ""));
                        entry.appendChild(api.element("p", "", item.text));
                        entry.appendChild(api.element("time", "muted", api.formatDate(item.createdAt)));
                        messages.appendChild(entry);
                    });
                    messages.scrollTop = messages.scrollHeight;
                }
            } catch (error) {
                api.showMessage(message, error.message, "error");
                clearAndShow(messages, "Messages could not be loaded.", "error");
            }
        }

        try {
            const result = await api.request("/api/swaps");
            const available = (result.swaps || []).filter(function (swap) {
                return ["accepted", "completed"].includes(swap.status);
            });
            threads.replaceChildren();
            if (!available.length) {
                clearAndShow(threads, "Messages are available after a swap is accepted.", "");
            } else {
                available.forEach(function (swap) {
                    const participant = String(swap.requesterId) === userId() ? swap.receiverName : swap.requesterName;
                    const button = api.element("button", "conversation-button", participant + " · " + swap.skillOffered + " / " + swap.skillWanted);
                    button.type = "button";
                    button.addEventListener("click", function () { showThread(swap); });
                    threads.appendChild(button);
                });
                const requestedSwap = new URLSearchParams(window.location.search).get("swapId");
                const initial = available.find(function (swap) { return swap._id === requestedSwap; }) || available[0];
                await showThread(initial);
            }
        } catch (error) {
            api.showMessage(message, error.message, "error");
        }

        form.addEventListener("submit", async function (event) {
            event.preventDefault();
            if (!selectedSwap) return;
            const input = document.getElementById("messageText");
            api.showMessage(message, "", "");
            setBusy(form, true);
            try {
                const receiverId = String(selectedSwap.requesterId) === userId()
                    ? selectedSwap.receiverId
                    : selectedSwap.requesterId;
                await api.request("/api/messages", {
                    method: "POST",
                    body: JSON.stringify({
                        swapId: selectedSwap._id,
                        receiverId: receiverId,
                        text: input.value.trim()
                    })
                });
                input.value = "";
                await showThread(selectedSwap);
            } catch (error) {
                api.showMessage(message, error.message, "error");
            } finally {
                setBusy(form, false);
            }
        });
    }

    async function loadSessions() {
        const target = document.getElementById("sessionsList");
        const form = document.getElementById("sessionForm");
        const select = document.getElementById("sessionSwap");
        const message = document.getElementById("pageMessage");

        async function refresh() {
            const result = await api.request("/api/sessions");
            target.replaceChildren();
            if (!result.sessions.length) {
                clearAndShow(target, "No sessions scheduled. You can schedule one with an accepted swap.", "");
            } else {
                result.sessions.forEach(function (session) {
                    const card = api.element("article", "surface-card session-card");
                    card.appendChild(api.element("h3", "", "Learning session"));
                    card.appendChild(labeledValue("Date", session.date));
                    card.appendChild(labeledValue("Time", session.time));
                    card.appendChild(api.element("span", "tag status-" + session.status, session.status));
                    const reviewLink = api.element("a", "text-link", "View or write a review");
                    reviewLink.href = "reviews.html?sessionId=" + encodeURIComponent(session._id);
                    card.appendChild(reviewLink);
                    if (session.status === "scheduled") {
                        const complete = api.element("button", "button button-secondary", "Mark session complete");
                        complete.type = "button";
                        complete.addEventListener("click", async function () {
                            complete.disabled = true;
                            try {
                                await api.request("/api/sessions/" + encodeURIComponent(session._id) + "/complete", { method: "PUT" });
                                await refresh();
                            } catch (error) {
                                api.showMessage(message, error.message, "error");
                                complete.disabled = false;
                            }
                        });
                        card.appendChild(complete);
                    }
                    target.appendChild(card);
                });
            }
        }

        try {
            const swaps = await api.request("/api/swaps");
            const accepted = (swaps.swaps || []).filter(function (swap) { return swap.status === "accepted"; });
            const requestedSwap = new URLSearchParams(window.location.search).get("swapId");
            select.replaceChildren();
            select.appendChild(new Option(accepted.length ? "Choose an accepted swap" : "No accepted swaps available", ""));
            accepted.forEach(function (swap) {
                const participant = String(swap.requesterId) === userId() ? swap.receiverName : swap.requesterName;
                const option = new Option(participant + " · " + swap.skillOffered + " / " + swap.skillWanted, swap._id);
                select.appendChild(option);
            });
            if (requestedSwap && accepted.some(function (swap) { return swap._id === requestedSwap; })) {
                select.value = requestedSwap;
            }
        } catch (error) {
            api.showMessage(message, error.message, "error");
        }

        form.addEventListener("submit", async function (event) {
            event.preventDefault();
            api.showMessage(message, "", "");
            setBusy(form, true);
            try {
                const swaps = await api.request("/api/swaps");
                const swap = (swaps.swaps || []).find(function (item) { return item._id === select.value; });
                if (!swap) throw new Error("Choose an accepted swap.");
                const receiverId = String(swap.requesterId) === userId() ? swap.receiverId : swap.requesterId;
                await api.request("/api/sessions", {
                    method: "POST",
                    body: JSON.stringify({
                        swapId: swap._id,
                        receiverId: receiverId,
                        date: document.getElementById("sessionDate").value,
                        time: document.getElementById("sessionTime").value
                    })
                });
                form.reset();
                api.showMessage(message, "Session scheduled.", "success");
                await refresh();
            } catch (error) {
                api.showMessage(message, error.message, "error");
            } finally {
                setBusy(form, false);
            }
        });

        try {
            await refresh();
        } catch (error) {
            api.showMessage(message, error.message, "error");
        }
    }

    async function loadReviews() {
        const form = document.getElementById("reviewForm");
        const sessionSelect = document.getElementById("reviewSession");
        const target = document.getElementById("reviewsList");
        const message = document.getElementById("pageMessage");
        let sessions = [];

        try {
            const [sessionResult, reviewResult] = await Promise.all([
                api.request("/api/sessions"),
                api.request("/api/reviews")
            ]);
            const alreadyReviewed = new Set((reviewResult.reviews || [])
                .filter(function (review) { return String(review.reviewerId) === userId(); })
                .map(function (review) { return String(review.sessionId); }));
            sessions = (sessionResult.sessions || []).filter(function (session) {
                return session.status === "completed" && !alreadyReviewed.has(String(session._id));
            });
            sessionSelect.replaceChildren();
            sessionSelect.appendChild(new Option(sessions.length ? "Choose a completed session" : "No completed sessions available", ""));
            sessions.forEach(function (session) {
                sessionSelect.appendChild(new Option(session.date + " at " + session.time, session._id));
            });
            const requestedId = new URLSearchParams(window.location.search).get("sessionId");
            if (requestedId && sessions.some(function (session) { return session._id === requestedId; })) {
                sessionSelect.value = requestedId;
            }

            target.replaceChildren();
            if (!reviewResult.reviews.length) {
                clearAndShow(target, "No reviews to show yet.", "");
            } else {
                reviewResult.reviews.forEach(function (review) {
                    const card = api.element("article", "surface-card review-card");
                    card.appendChild(api.element("h3", "", "★".repeat(review.rating) + " " + review.rating + " / 5"));
                    card.appendChild(api.element("p", "", review.comment || "No written comment."));
                    card.appendChild(api.element("p", "muted", String(review.reviewerId) === userId() ? "Your review" : "Review received"));
                    card.appendChild(api.element("time", "muted", api.formatDate(review.createdAt)));
                    target.appendChild(card);
                });
            }
        } catch (error) {
            api.showMessage(message, error.message, "error");
        }

        form.addEventListener("submit", async function (event) {
            event.preventDefault();
            api.showMessage(message, "", "");
            setBusy(form, true);
            try {
                await api.request("/api/reviews", {
                    method: "POST",
                    body: JSON.stringify({
                        sessionId: sessionSelect.value,
                        rating: Number(document.getElementById("reviewRating").value),
                        comment: document.getElementById("reviewComment").value.trim()
                    })
                });
                form.reset();
                api.showMessage(message, "Review submitted.", "success");
                const result = await api.request("/api/reviews");
                target.replaceChildren();
                result.reviews.forEach(function (review) {
                    const card = api.element("article", "surface-card review-card");
                    card.appendChild(api.element("h3", "", "★".repeat(review.rating) + " " + review.rating + " / 5"));
                    card.appendChild(api.element("p", "", review.comment || "No written comment."));
                    card.appendChild(api.element("p", "muted", String(review.reviewerId) === userId() ? "Your review" : "Review received"));
                    target.appendChild(card);
                });
            } catch (error) {
                api.showMessage(message, error.message, "error");
            } finally {
                setBusy(form, false);
            }
        });
    }

    async function loadTransactions() {
        const balance = document.getElementById("transactionBalance");
        const target = document.getElementById("transactionsList");
        const message = document.getElementById("pageMessage");
        try {
            const id = encodeURIComponent(userId());
            const [balanceResult, transactionsResult] = await Promise.all([
                api.request("/api/credits/" + id + "/balance"),
                api.request("/api/credits/" + id + "/transactions")
            ]);
            balance.textContent = String(balanceResult.balance);
            target.replaceChildren();
            if (!transactionsResult.transactions.length) {
                clearAndShow(target, "No credit transactions yet.", "");
                return;
            }
            transactionsResult.transactions.forEach(function (transaction) {
                const card = api.element("article", "surface-card transaction-row");
                const detail = api.element("div", "");
                detail.appendChild(api.element("h3", "", transaction.description));
                detail.appendChild(api.element("p", "muted", transaction.type.replaceAll("_", " ") + " · " + api.formatDate(transaction.createdAt)));
                card.appendChild(detail);
                card.appendChild(api.element("strong", transaction.amount >= 0 ? "credit-positive" : "credit-negative", (transaction.amount > 0 ? "+" : "") + transaction.amount));
                target.appendChild(card);
            });
        } catch (error) {
            api.showMessage(message, error.message, "error");
        }
    }

    const pages = {
        dashboard: loadDashboard,
        profile: loadProfile,
        skills: loadSkills,
        search: loadSearch,
        requests: loadRequests,
        messages: loadMessages,
        sessions: loadSessions,
        reviews: loadReviews,
        transactions: loadTransactions
    };
    if (pages[currentPage]) pages[currentPage]();
});

import {
    auth,
    db
} from "./firebase-config.js";


import {
    signOut,
    updateEmail,
    onAuthStateChanged,
    EmailAuthProvider,
    reauthenticateWithCredential,
    updatePassword
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";


import {
    doc,
    getDoc,
    updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


/* ================================================= */
/* GLOBAL VARIABLES */
/* ================================================= */

let currentUser = null;

let currentProfileRef = null;

let originalProfile = {};


/* ================================================= */
/* AUTHENTICATION */
/* ================================================= */

onAuthStateChanged(
    auth,
    (user) => {

        currentUser =
            user;


        if (!user) {

            window.location.replace(
                "../login.html"
            );

            return;

        }


        console.log(
            "Student Profile Auth:",
            user.email
        );


        console.log(
            "Student Profile UID:",
            user.uid
        );

    }
);


/* ================================================= */
/* BACK BUTTON PROTECTION */
/* ================================================= */

window.addEventListener(
    "pageshow",
    (event) => {

        if (event.persisted) {

            window.location.reload();

        }

    }
);


/* ================================================= */
/* PROFILE MENU */
/* ================================================= */

function toggleProfileMenu() {

    const menu =
        document.getElementById(
            "profile-menu"
        );


    if (!menu) {

        return;

    }


    menu.classList.toggle(
        "active"
    );

}


/*
 * Close menu when clicking outside.
 */

document.addEventListener(
    "click",
    (event) => {

        const wrapper =
            document.querySelector(
                ".profile-wrapper"
            );


        const menu =
            document.getElementById(
                "profile-menu"
            );


        if (
            wrapper &&
            menu &&
            !wrapper.contains(
                event.target
            )
        ) {

            menu.classList.remove(
                "active"
            );

        }

    }
);


/* ================================================= */
/* FIND STUDENT PROFILE */
/* ================================================= */

async function findUserProfile(
    user
) {

    if (!user) {

        return null;

    }


    try {

        /*
         * IMPORTANT:
         *
         * We ONLY read:
         *
         * users/{authenticated UID}
         *
         * This matches the Firestore rule:
         *
         * request.auth.uid == userId
         */

        const userRef =
            doc(
                db,
                "users",
                user.uid
            );


        const snapshot =
            await getDoc(
                userRef
            );


        if (
            !snapshot.exists()
        ) {

            console.error(
                "Student profile document does not exist:",
                user.uid
            );


            return null;

        }


        return {

            ref:
                userRef,

            data:
                snapshot.data()

        };

    }
    catch (error) {

        console.error(
            "Find profile error:",
            error
        );


        return null;

    }

}


/* ================================================= */
/* OPEN PROFILE */
/* ================================================= */

async function openProfile() {

    const menu =
        document.getElementById(
            "profile-menu"
        );


    if (menu) {

        menu.classList.remove(
            "active"
        );

    }


    const user =
        currentUser ||
        auth.currentUser;


    if (!user) {

        alert(
            "No logged-in user found."
        );

        return;

    }


    try {

        const profile =
            await findUserProfile(
                user
            );


        if (!profile) {

            showProfileMessage(
                "Your student profile could not be found.",
                "error"
            );


            const overlay =
                document.getElementById(
                    "profile-overlay"
                );


            if (overlay) {

                overlay.classList.add(
                    "active"
                );

            }


            return;

        }


        currentProfileRef =
            profile.ref;


        const data =
            profile.data;


        originalProfile = {

            fullname:
                data.fullname || "",

            email:
                data.email ||
                user.email ||
                "",

            studentId:
                data.studentId ||
                data.studentNumber ||
                data.idNumber ||
                data.userId ||
                "",

            section:
                data.section ||
                "",

            academicYear:
                data.activeAcademicYear ||
                "",

            role:
                data.role ||
                "Student"

        };


        setProfileField(
            "profile-fullname",
            originalProfile.fullname
        );


        setProfileField(
            "profile-email",
            originalProfile.email
        );


        setProfileField(
            "profile-student-id",
            originalProfile.studentId
        );


        setProfileField(
            "profile-section",
            originalProfile.section
        );


        setProfileField(
            "profile-academic-year",
            originalProfile.academicYear
        );


        setProfileField(
            "profile-role",
            originalProfile.role
        );


        /*
         * Avatar
         */

        const fullname =
            originalProfile.fullname.trim();


        let initials =
            "?";


        if (fullname) {

            const parts =
                fullname.split(
                    /\s+/
                );


            if (
                parts.length >= 2
            ) {

                initials =
                    parts[0].charAt(0) +
                    parts[
                        parts.length - 1
                    ].charAt(0);

            }
            else {

                initials =
                    parts[0].charAt(0);

            }

        }


        const avatar =
            document.getElementById(
                "profile-avatar"
            );


        if (avatar) {

            avatar.textContent =
                initials.toUpperCase();

        }


        resetProfileEdit();


        showProfileMessage(
            "",
            ""
        );


        const overlay =
            document.getElementById(
                "profile-overlay"
            );


        if (overlay) {

            overlay.classList.add(
                "active"
            );

        }

    }
    catch (error) {

        console.error(
            "Error loading profile:",
            error
        );


        showProfileMessage(
            "Unable to load your profile.",
            "error"
        );

    }

}


/* ================================================= */
/* PROFILE FIELD HELPER */
/* ================================================= */

function setProfileField(
    id,
    value
) {

    const element =
        document.getElementById(
            id
        );


    if (element) {

        element.value =
            value || "";

    }

}


/* ================================================= */
/* EDIT PROFILE */
/* ================================================= */

function enableProfileEdit() {

    const fullname =
        document.getElementById(
            "profile-fullname"
        );


    const email =
        document.getElementById(
            "profile-email"
        );




    if (fullname) {

        fullname.disabled =
            false;

    }


    if (email) {

        email.disabled =
            false;

    }



    const editButton =
        document.getElementById(
            "edit-profile-btn"
        );


    const saveButton =
        document.getElementById(
            "save-profile-btn"
        );


    const cancelButton =
        document.getElementById(
            "cancel-profile-btn"
        );


    if (editButton) {

        editButton.style.display =
            "none";

    }


    if (saveButton) {

        saveButton.style.display =
            "block";

    }


    if (cancelButton) {

        cancelButton.style.display =
            "block";

    }


    showProfileMessage(
        "",
        ""
    );

}


/* ================================================= */
/* CANCEL PROFILE EDIT */
/* ================================================= */

function cancelProfileEdit() {

    setProfileField(
        "profile-fullname",
        originalProfile.fullname
    );


    setProfileField(
        "profile-email",
        originalProfile.email
    );


    setProfileField(
        "profile-section",
        originalProfile.section
    );


    resetProfileEdit();

}


/* ================================================= */
/* RESET PROFILE EDIT */
/* ================================================= */

function resetProfileEdit() {

    const fields = [

        "profile-fullname",
        "profile-email",
        "profile-student-id",
        "profile-section",
        "profile-academic-year",
        "profile-role"

    ];


    fields.forEach(
        (id) => {

            const element =
                document.getElementById(
                    id
                );


            if (element) {

                element.disabled =
                    true;

            }

        }
    );


    const editButton =
        document.getElementById(
            "edit-profile-btn"
        );


    const saveButton =
        document.getElementById(
            "save-profile-btn"
        );


    const cancelButton =
        document.getElementById(
            "cancel-profile-btn"
        );


    if (editButton) {

        editButton.style.display =
            "block";

    }


    if (saveButton) {

        saveButton.style.display =
            "none";

    }


    if (cancelButton) {

        cancelButton.style.display =
            "none";

    }

}


/* ================================================= */
/* SAVE PROFILE */
/* ================================================= */

async function saveProfile() {

    const user =
        currentUser ||
        auth.currentUser;


    if (!user) {

        showProfileMessage(
            "No logged-in user found.",
            "error"
        );

        return;

    }


    if (!currentProfileRef) {

        showProfileMessage(
            "Profile record was not found.",
            "error"
        );

        return;

    }


    const fullnameElement =
        document.getElementById(
            "profile-fullname"
        );


    const emailElement =
        document.getElementById(
            "profile-email"
        );


    const sectionElement =
        document.getElementById(
            "profile-section"
        );


    const fullname =
        fullnameElement
            ? fullnameElement.value.trim()
            : "";


    const email =
        emailElement
            ? emailElement.value.trim()
            : "";


    const section =
        sectionElement
            ? sectionElement.value.trim()
            : "";


    if (!fullname) {

        showProfileMessage(
            "Full name cannot be empty.",
            "error"
        );

        return;

    }


    if (!email) {

        showProfileMessage(
            "Email cannot be empty.",
            "error"
        );

        return;

    }


    try {

        /*
         * Update Firebase Authentication
         * email only when changed.
         */

        if (
            email !== user.email
        ) {

            await updateEmail(
                user,
                email
            );

        }


        /*
         * Update Firestore profile.
         */

        await updateDoc(
            currentProfileRef,
            {

                fullname:
                    fullname,

                email:
                    email,

                section:
                    section

            }
        );


        originalProfile.fullname =
            fullname;


        originalProfile.email =
            email;


        originalProfile.section =
            section;


        /*
         * Update avatar.
         */

        const parts =
            fullname.split(
                /\s+/
            );


        let initials =
            "";


        if (
            parts.length >= 2
        ) {

            initials =
                parts[0].charAt(0) +
                parts[
                    parts.length - 1
                ].charAt(0);

        }
        else {

            initials =
                fullname.charAt(0);

        }


        const avatar =
            document.getElementById(
                "profile-avatar"
            );


        if (avatar) {

            avatar.textContent =
                initials.toUpperCase();

        }


        /*
         * Update dashboard welcome name.
         */

        const welcomeName =
            document.getElementById(
                "student-welcome-name"
            );


        if (welcomeName) {

            welcomeName.textContent =
                fullname;

        }


        resetProfileEdit();


        showProfileMessage(
            "Profile updated successfully!",
            "success"
        );

    }
    catch (error) {

        console.error(
            "Profile update error:",
            error
        );


        if (
            error.code ===
            "auth/requires-recent-login"
        ) {

            showProfileMessage(
                "For security, please log in again before changing your email.",
                "error"
            );

        }
        else if (
            error.code ===
            "auth/invalid-email"
        ) {

            showProfileMessage(
                "Please enter a valid email address.",
                "error"
            );

        }
        else if (
            error.code ===
            "auth/email-already-in-use"
        ) {

            showProfileMessage(
                "That email address is already being used.",
                "error"
            );

        }
        else {

            showProfileMessage(
                "Unable to save profile changes.",
                "error"
            );

        }

    }

}


/* ================================================= */
/* PROFILE MESSAGE */
/* ================================================= */

function showProfileMessage(
    message,
    type
) {

    const element =
        document.getElementById(
            "profile-message"
        );


    if (!element) {

        return;

    }


    element.textContent =
        message;


    element.className =
        "profile-message";


    if (type) {

        element.classList.add(
            type
        );

    }


    if (message) {

        setTimeout(
            () => {

                element.textContent =
                    "";

                element.className =
                    "profile-message";

            },
            3000
        );

    }

}


/* ================================================= */
/* CLOSE PROFILE */
/* ================================================= */

function closeProfile() {

    const overlay =
        document.getElementById(
            "profile-overlay"
        );


    if (overlay) {

        overlay.classList.remove(
            "active"
        );

    }

}


/* ================================================= */
/* CLOSE PROFILE OUTSIDE */
/* ================================================= */

function closeProfileOutside(
    event
) {

    if (
        event.target &&
        event.target.id ===
        "profile-overlay"
    ) {

        closeProfile();

    }

}


/* ================================================= */
/* CHANGE PASSWORD */
/* ================================================= */

function openChangePassword() {

    const menu =
        document.getElementById(
            "profile-menu"
        );


    if (menu) {

        menu.classList.remove(
            "active"
        );

    }


    const overlay =
        document.getElementById(
            "change-password-overlay"
        );


    if (!overlay) {

        console.error(
            "change-password-overlay was not found."
        );

        return;

    }


    const current =
        document.getElementById(
            "current-password"
        );


    const newPassword =
        document.getElementById(
            "new-password"
        );


    const confirmPassword =
        document.getElementById(
            "confirm-password"
        );


    /*
     * Clear previous values.
     */

    if (current) {

        current.value =
            "";

        current.type =
            "password";

    }


    if (newPassword) {

        newPassword.value =
            "";

        newPassword.type =
            "password";

    }


    if (confirmPassword) {

        confirmPassword.value =
            "";

        confirmPassword.type =
            "password";

    }


    /*
     * Reset all eye icons.
     */

    resetEyeIcons();


    /*
     * Reset requirements.
     */

    resetPasswordRequirements();


    /*
     * IMPORTANT:
     * Force the requirements box
     * to remain visible.
     */

    const requirements =
        document.getElementById(
            "password-requirements"
        );


    if (requirements) {

        requirements.style.display =
            "block";

        requirements.style.visibility =
            "visible";

        requirements.style.opacity =
            "1";

    }


    /*
     * Clear old message.
     */

    const message =
        document.getElementById(
            "password-message"
        );


    if (message) {

        message.textContent =
            "";

        message.className =
            "password-message";

    }


    /*
     * Open modal.
     */

    overlay.classList.add(
        "active"
    );


    overlay.style.display =
        "flex";


    document.body.style.overflow =
        "hidden";

}


/* ================================================= */
/* EYE TOGGLE */
/* ================================================= */

function togglePassword(
    inputId,
    iconSpan
) {

    const input =
        document.getElementById(
            inputId
        );


    if (!input || !iconSpan) {

        return;

    }


    const openEye =
        iconSpan.querySelector(
            ".eye-open"
        );


    const closedEye =
        iconSpan.querySelector(
            ".eye-closed"
        );


    if (
        input.type ===
        "password"
    ) {

        input.type =
            "text";


        if (openEye) {

            openEye.classList.add(
                "hidden"
            );

        }


        if (closedEye) {

            closedEye.classList.remove(
                "hidden"
            );

        }

    }
    else {

        input.type =
            "password";


        if (openEye) {

            openEye.classList.remove(
                "hidden"
            );

        }


        if (closedEye) {

            closedEye.classList.add(
                "hidden"
            );

        }

    }

}


/* ================================================= */
/* RESET EYE ICONS */
/* ================================================= */

function resetEyeIcons() {

    const eyes =
        document.querySelectorAll(
            ".password-eye"
        );


    eyes.forEach(
        (eye) => {

            const openEye =
                eye.querySelector(
                    ".eye-open"
                );


            const closedEye =
                eye.querySelector(
                    ".eye-closed"
                );


            if (openEye) {

                openEye.classList.remove(
                    "hidden"
                );

            }


            if (closedEye) {

                closedEye.classList.add(
                    "hidden"
                );

            }

        }
    );

}


/* ================================================= */
/* CLOSE CHANGE PASSWORD */
/* ================================================= */

function closeChangePassword() {

    const overlay =
        document.getElementById(
            "change-password-overlay"
        );


    if (overlay) {

        overlay.classList.remove(
            "active"
        );

        overlay.style.display =
            "none";

    }


    document.body.style.overflow =
        "";

}


/* ================================================= */
/* CLOSE CHANGE PASSWORD OUTSIDE */
/* ================================================= */

function closeChangePasswordOutside(
    event
) {

    if (
        event.target &&
        event.target.id ===
        "change-password-overlay"
    ) {

        closeChangePassword();

    }

}


/* ================================================= */
/* PASSWORD REQUIREMENTS */
/* ================================================= */

function getPasswordRequirements(
    password
) {

    return {

        length:
            password.length >= 8,

        uppercase:
            /[A-Z]/.test(
                password
            ),

        special:
            /[^A-Za-z0-9]/.test(
                password
            )

    };

}


/* ================================================= */
/* SET REQUIREMENT */
/* ================================================= */

function setRequirement(
    elementId,
    valid,
    text
) {

    const element =
        document.getElementById(
            elementId
        );


    if (!element) {

        return;

    }


    element.classList.remove(
        "valid",
        "invalid"
    );


    if (valid) {

        element.classList.add(
            "valid"
        );


        element.textContent =
            "✓ " + text;

    }
    else {

        element.classList.add(
            "invalid"
        );


        element.textContent =
            "✕ " + text;

    }

}


/* ================================================= */
/* VALIDATE NEW PASSWORD */
/* ================================================= */

function validateNewPassword() {

    const input =
        document.getElementById(
            "new-password"
        );


    const password =
        input
            ? input.value
            : "";


    const requirements =
        getPasswordRequirements(
            password
        );


    setRequirement(
        "requirement-length",
        requirements.length,
        "At least 8 characters"
    );


    setRequirement(
        "requirement-uppercase",
        requirements.uppercase,
        "At least 1 uppercase letter"
    );


    setRequirement(
        "requirement-special",
        requirements.special,
        "At least 1 special character"
    );


    /*
     * Make sure requirements
     * stay visible.
     */

    const requirementsBox =
        document.getElementById(
            "password-requirements"
        );


    if (requirementsBox) {

        requirementsBox.style.display =
            "block";

        requirementsBox.style.visibility =
            "visible";

        requirementsBox.style.opacity =
            "1";

    }


    validatePasswordMatch();

}


/* ================================================= */
/* VALIDATE PASSWORD MATCH */
/* ================================================= */

function validatePasswordMatch() {

    const newPassword =
        document.getElementById(
            "new-password"
        );


    const confirmPassword =
        document.getElementById(
            "confirm-password"
        );


    if (
        !newPassword ||
        !confirmPassword
    ) {

        return;

    }


    const newValue =
        newPassword.value;


    const confirmValue =
        confirmPassword.value;


    if (
        confirmValue &&
        newValue !== confirmValue
    ) {

        showPasswordMessage(
            "New passwords do not match.",
            "error"
        );

    }
    else if (
        confirmValue &&
        newValue === confirmValue
    ) {

        showPasswordMessage(
            "Password confirmed.",
            "success"
        );

    }
    else {

        clearPasswordMessage();

    }

}


/* ================================================= */
/* RESET REQUIREMENTS */
/* ================================================= */

function resetPasswordRequirements() {

    setRequirement(
        "requirement-length",
        false,
        "At least 8 characters"
    );


    setRequirement(
        "requirement-uppercase",
        false,
        "At least 1 uppercase letter"
    );


    setRequirement(
        "requirement-special",
        false,
        "At least 1 special character"
    );


    const requirements =
        document.getElementById(
            "password-requirements"
        );


    if (requirements) {

        requirements.style.display =
            "block";

        requirements.style.visibility =
            "visible";

        requirements.style.opacity =
            "1";

    }

}


/* ================================================= */
/* PASSWORD MESSAGE */
/* ================================================= */

function showPasswordMessage(
    message,
    type
) {

    const element =
        document.getElementById(
            "password-message"
        );


    if (!element) {

        return;

    }


    element.textContent =
        message;


    element.className =
        "password-message";


    if (type) {

        element.classList.add(
            type
        );

    }

}


/* ================================================= */
/* CLEAR PASSWORD MESSAGE */
/* ================================================= */

function clearPasswordMessage() {

    const element =
        document.getElementById(
            "password-message"
        );


    if (!element) {

        return;

    }


    element.textContent =
        "";


    element.className =
        "password-message";

}


/* ================================================= */
/* CONFIRM CHANGE PASSWORD */
/* ================================================= */

async function confirmChangePassword() {

    console.log(
        "================================="
    );


    console.log(
        "CHANGE PASSWORD BUTTON CLICKED"
    );


    console.log(
        "================================="
    );


    const user =
        currentUser ||
        auth.currentUser;


    if (!user) {

        showPasswordMessage(
            "No logged-in user found.",
            "error"
        );

        return;

    }


    const currentElement =
        document.getElementById(
            "current-password"
        );


    const newElement =
        document.getElementById(
            "new-password"
        );


    const confirmElement =
        document.getElementById(
            "confirm-password"
        );


    const currentPassword =
        currentElement
            ? currentElement.value
            : "";


    const newPassword =
        newElement
            ? newElement.value
            : "";


    const confirmPassword =
        confirmElement
            ? confirmElement.value
            : "";


    console.log(
        "Current password entered:",
        Boolean(currentPassword)
    );


    console.log(
        "New password length:",
        newPassword.length
    );


    console.log(
        "Confirm password length:",
        confirmPassword.length
    );


    /* ================================================= */
    /* EMPTY CURRENT PASSWORD */
    /* ================================================= */

    if (!currentPassword) {

        showPasswordMessage(
            "Please enter your current password.",
            "error"
        );

        return;

    }


    /* ================================================= */
    /* EMPTY NEW PASSWORD */
    /* ================================================= */

    if (!newPassword) {

        showPasswordMessage(
            "Please enter a new password.",
            "error"
        );

        return;

    }


    /* ================================================= */
    /* EMPTY CONFIRM PASSWORD */
    /* ================================================= */

    if (!confirmPassword) {

        showPasswordMessage(
            "Please confirm your new password.",
            "error"
        );

        return;

    }


    /* ================================================= */
    /* PASSWORD REQUIREMENTS */
    /* ================================================= */

    const requirements =
        getPasswordRequirements(
            newPassword
        );


    if (
        !requirements.length ||
        !requirements.uppercase ||
        !requirements.special
    ) {

        validateNewPassword();


        showPasswordMessage(
            "Your new password does not meet all requirements.",
            "error"
        );


        return;

    }


    /* ================================================= */
    /* PASSWORD MATCH */
    /* ================================================= */

    if (
        newPassword !==
        confirmPassword
    ) {

        showPasswordMessage(
            "New passwords do not match.",
            "error"
        );

        return;

    }


    /* ================================================= */
    /* SAME PASSWORD */
    /* ================================================= */

    if (
        currentPassword ===
        newPassword
    ) {

        showPasswordMessage(
            "Your new password must be different from your current password.",
            "error"
        );

        return;

    }


    try {

        /*
         * Verify current password.
         */

        showPasswordMessage(
            "Verifying current password...",
            ""
        );


        const credential =
            EmailAuthProvider.credential(
                user.email,
                currentPassword
            );


        await reauthenticateWithCredential(
            user,
            credential
        );


        /*
         * CURRENT PASSWORD IS CORRECT.
         */

        showPasswordMessage(
            "Password confirmed. Updating password...",
            "success"
        );


        console.log(
            "Password confirmed."
        );


        /*
         * Update Firebase password.
         */

        await updatePassword(
            user,
            newPassword
        );


        /*
         * SUCCESS.
         */

        showPasswordMessage(
            "Password changed successfully!",
            "success"
        );


        /*
         * Clear fields.
         */

        if (currentElement) {

            currentElement.value =
                "";

        }


        if (newElement) {

            newElement.value =
                "";

        }


        if (confirmElement) {

            confirmElement.value =
                "";

        }


        resetPasswordRequirements();


        resetEyeIcons();


        /*
         * Keep success message
         * visible before closing.
         */

        setTimeout(
            () => {

                closeChangePassword();

            },
            1500
        );

    }
    catch (error) {

        console.error(
            "Change password error:",
            error
        );


        if (
            error.code ===
            "auth/invalid-credential"
        ) {

            showPasswordMessage(
                "Current password is incorrect.",
                "error"
            );

        }
        else if (
            error.code ===
            "auth/wrong-password"
        ) {

            showPasswordMessage(
                "Current password is incorrect.",
                "error"
            );

        }
        else if (
            error.code ===
            "auth/weak-password"
        ) {

            showPasswordMessage(
                "The new password is too weak.",
                "error"
            );

        }
        else if (
            error.code ===
            "auth/requires-recent-login"
        ) {

            showPasswordMessage(
                "Please log in again before changing your password.",
                "error"
            );

        }
        else {

            showPasswordMessage(
                "Unable to change password. Please try again.",
                "error"
            );

        }

    }

}


/* ================================================= */
/* LOGOUT MODAL */
/* ================================================= */

function logout() {

    const menu =
        document.getElementById(
            "profile-menu"
        );


    if (menu) {

        menu.classList.remove(
            "active"
        );

    }


    const overlay =
        document.getElementById(
            "logout-overlay"
        );


    if (!overlay) {

        console.error(
            "logout-overlay was not found."
        );

        return;

    }


    overlay.classList.add(
        "active"
    );


    overlay.style.display =
        "flex";


    document.body.style.overflow =
        "hidden";

}


/* ================================================= */
/* CLOSE LOGOUT MODAL */
/* ================================================= */

function closeLogoutModal() {

    const overlay =
        document.getElementById(
            "logout-overlay"
        );


    if (overlay) {

        overlay.classList.remove(
            "active"
        );


        overlay.style.display =
            "none";

    }


    document.body.style.overflow =
        "";

}


/* ================================================= */
/* CLOSE LOGOUT OUTSIDE */
/* ================================================= */

function closeLogoutOutside(
    event
) {

    if (
        event.target &&
        event.target.id ===
        "logout-overlay"
    ) {

        closeLogoutModal();

    }

}


/* ================================================= */
/* ACTUAL LOGOUT */
/* ================================================= */

async function performLogout() {

    try {

        await signOut(
            auth
        );


        localStorage.clear();


        window.location.replace(
            "../login.html"
        );

    }
    catch (error) {

        console.error(
            "Logout error:",
            error
        );


        alert(
            "Unable to log out. Please try again."
        );

    }

}


/* ================================================= */
/* EXPORT FUNCTIONS */
/* ================================================= */

window.toggleProfileMenu =
    toggleProfileMenu;


window.openProfile =
    openProfile;


window.closeProfile =
    closeProfile;


window.closeProfileOutside =
    closeProfileOutside;


window.enableProfileEdit =
    enableProfileEdit;


window.cancelProfileEdit =
    cancelProfileEdit;


window.saveProfile =
    saveProfile;


/* CHANGE PASSWORD */

window.openChangePassword =
    openChangePassword;


window.closeChangePassword =
    closeChangePassword;


window.closeChangePasswordOutside =
    closeChangePasswordOutside;


window.togglePassword =
    togglePassword;


window.validateNewPassword =
    validateNewPassword;


window.validatePasswordMatch =
    validatePasswordMatch;


window.confirmChangePassword =
    confirmChangePassword;


/* LOGOUT */

window.logout =
    logout;


window.closeLogoutModal =
    closeLogoutModal;


window.closeLogoutOutside =
    closeLogoutOutside;


window.performLogout =
    performLogout;
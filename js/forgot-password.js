import { auth } from "./firebase-config.js";

import {
    sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";


/* =====================================================
   GET ROLE
===================================================== */

const params =
    new URLSearchParams(window.location.search);

const role =
    params.get("role") || "student";


/* =====================================================
   ELEMENTS
===================================================== */

const title =
    document.getElementById("forgotTitle");

const subtitle =
    document.getElementById("forgotSubtitle");

const emailInput =
    document.getElementById("resetEmail");

const resetButton =
    document.getElementById("resetButton");

const message =
    document.getElementById("forgotMessage");

const backLogin =
    document.getElementById("backLogin");


/* =====================================================
   ROLE SETTINGS
===================================================== */

if (role === "faculty") {

    title.textContent =
        "Faculty Forgot Password";

    subtitle.textContent =
        "Enter your registered faculty email address to reset your password.";

    emailInput.placeholder =
        "Faculty Email";

    backLogin.textContent =
        "← Back to Faculty Login";

    document.title =
        "Faculty Forgot Password | SpecAdvisor";

}


else if (role === "admin") {

    title.textContent =
        "Admin Forgot Password";

    subtitle.textContent =
        "Enter your registered admin email address to reset your password.";

    emailInput.placeholder =
        "Admin Email";

    backLogin.textContent =
        "← Back to Admin Login";

    document.title =
        "Admin Forgot Password | SpecAdvisor";

}


else {

    title.textContent =
        "Student Forgot Password";

    subtitle.textContent =
        "Enter your registered student email address to reset your password.";

    emailInput.placeholder =
        "Student Email";

    backLogin.textContent =
        "← Back to Student Login";

    document.title =
        "Student Forgot Password | SpecAdvisor";
}


/* =====================================================
   BACK TO LOGIN
===================================================== */

function goBackLogin() {

    if (role === "faculty") {

        window.location.href =
            "./faculty/faculty-login.html";

        return;
    }


    if (role === "admin") {

        window.location.href =
            "./admin/admin-login.html";

        return;
    }


    window.location.href =
        "./login.html";
}


window.goBackLogin =
    goBackLogin;


/* =====================================================
   SEND RESET EMAIL
===================================================== */

async function sendResetEmail() {

    const email =
        emailInput.value.trim().toLowerCase();


    /* EMPTY */

    if (!email) {

        message.textContent =
            "Please enter your email address.";

        return;
    }


    /* BASIC EMAIL CHECK */

    if (
        !email.includes("@") ||
        !email.includes(".")
    ) {

        message.textContent =
            "Please enter a valid email address.";

        return;
    }


    /* LOADING */

    resetButton.disabled = true;

    resetButton.textContent =
        "Sending...";

    message.textContent =
        "";


    try {

        /*
         * Firebase only sends the reset email
         * to an existing Firebase Authentication
         * account.
         */

        await sendPasswordResetEmail(
            auth,
            email
        );


        message.textContent =
            "Password reset link sent. Please check your email and spam folder.";

        emailInput.value = "";


    }

    catch (error) {

        console.error(
            "Password reset error:",
            error
        );


        message.textContent =
            "We could not send the reset link. Please make sure you are using the email connected to your SpecAdvisor account.";

    }


    finally {

        resetButton.disabled = false;

        resetButton.textContent =
            "Send Reset Link";

    }
}


window.sendResetEmail =
    sendResetEmail;
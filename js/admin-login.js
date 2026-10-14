import {
    auth,
    db
} from "./firebase-config.js";

import {
    signInWithEmailAndPassword,
    signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
    doc,
    getDoc,
    collection,
    addDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let isLoggingIn = false;

function showProcessing(){

    const overlay =
        document.getElementById("auth-processing-overlay");

    const button =
        document.getElementById("loginBtn");

    if(overlay){
        overlay.classList.add("active");
    }

    if(button){
        button.disabled = true;
        button.textContent = "Please wait...";
    }
}

function hideProcessing(){

    const overlay =
        document.getElementById("auth-processing-overlay");

    const button =
        document.getElementById("loginBtn");

    if(overlay){
        overlay.classList.remove("active");
    }

    if(button){
        button.disabled = false;
        button.textContent = "Log In";
    }
}

async function login(){

    if(isLoggingIn){
        return;
    }

    const email =
        document
            .getElementById("username")
            .value
            .trim();

    const password =
        document
            .getElementById("password")
            .value
            .trim();

    if(email === "" || password === ""){

        alert("Please fill all fields");
        return;
    }

    isLoggingIn = true;

    showProcessing();

    try{

        const credential =
            await signInWithEmailAndPassword(
                auth,
                email,
                password
            );

        const user = credential.user;

        const userRef =
            doc(
                db,
                "users",
                user.uid
            );

        const userSnap =
            await getDoc(userRef);

        if(!userSnap.exists()){

            await signOut(auth);

            throw new Error(
                "User data not found."
            );
        }

        const userData =
            userSnap.data();

        if(userData.role !== "ADMIN"){

            await signOut(auth);

            throw new Error(
                "This account is not an Admin account."
            );
        }

        if(userData.active === false){

            await signOut(auth);

            throw new Error(
                "Your account has been deactivated. Please contact the administrator."
            );
        }

        localStorage.setItem(
            "currentUser",
            user.uid
        );

        localStorage.setItem(
            "currentStudentName",
            userData.fullname ||
            userData.email ||
            "ADMIN"
        );

        localStorage.setItem(
            "userRole",
            userData.role
        );

        localStorage.setItem(
            "userData",
            JSON.stringify(userData)
        );

        try{

            await addDoc(
                collection(
                    db,
                    "activityLogs"
                ),
                {
                    user:
                        userData.fullname ||
                        userData.email ||
                        "ADMIN",

                    role: "ADMIN",

                    academicYear:
                        userData.activeAcademicYear ||
                        "N/A",

                    action: "Login Attempt",

                    status: "Success",

                    time:
                        new Date()
                            .toLocaleString(),

                    timestamp:
                        Date.now()
                }
            );

        }
        catch(logError){

            console.error(
                "Activity log failed:",
                logError
            );

        }

        window.location.replace(
            "./admin-dashboard.html"
        );

    }

    catch(error){

        console.error(
            "Admin login error:",
            error
        );

        try{

            await addDoc(
                collection(
                    db,
                    "activityLogs"
                ),
                {
                    user: email,

                    role: "ADMIN",

                    academicYear: "N/A",

                    action: "Login Attempt",

                    status: "Failed",

                    time:
                        new Date()
                            .toLocaleString(),

                    timestamp:
                        Date.now()
                }
            );

        }
        catch(logError){

            console.error(
                "Failed login log error:",
                logError
            );

        }

        hideProcessing();

        isLoggingIn = false;

        if(
            error.message.includes(
                "not an Admin account"
            )
        ){

            alert(
                "This account is not an Admin account."
            );

        }

        else if(
            error.message.includes(
                "deactivated"
            )
        ){

            alert(
                error.message
            );

        }

        else if(
            error.message.includes(
                "User data not found"
            )
        ){

            alert(
                "User data not found."
            );

        }

        else{

            alert(
                "Invalid Admin Email or Password"
            );

        }

    }

}

window.login = login;

// Prevent returning to the Admin Dashboard after logout
window.history.pushState(null, "", window.location.href);

window.addEventListener("popstate", function () {
    window.history.pushState(null, "", window.location.href);
});

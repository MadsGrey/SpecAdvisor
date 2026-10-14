import {
    auth,
    db
} from "./firebase-config.js";

import {
    signInWithEmailAndPassword,
    sendPasswordResetEmail,
    signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
    doc,
    getDoc,
    collection,
    addDoc,
    updateDoc,
    query,
    where,
    getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


/* PROCESSING POPUP */

function showProcessing(message = "Please wait..."){

    let overlay =
        document.getElementById(
            "auth-processing-overlay"
        );


    if(!overlay){

        overlay =
            document.createElement("div");

        overlay.id =
            "auth-processing-overlay";

        overlay.className =
            "auth-processing-overlay";


        overlay.innerHTML = `
            <div class="auth-processing-box">

                <div class="auth-spinner"></div>

                <h3>Processing...</h3>

                <p id="auth-processing-message">
                    ${message}
                </p>

            </div>
        `;


        document.body.appendChild(
            overlay
        );

    }


    const messageElement =
        document.getElementById(
            "auth-processing-message"
        );


    if(messageElement){

        messageElement.textContent =
            message;

    }


    overlay.classList.add(
        "active"
    );

}


/* HIDE PROCESSING */

function hideProcessing(){

    const overlay =
        document.getElementById(
            "auth-processing-overlay"
        );


    if(overlay){

        overlay.classList.remove(
            "active"
        );

    }

}


/* UPDATE ACTIVE ACADEMIC YEAR */

async function updateUserAcademicYear(uid){

    const q =
        query(
            collection(db, "academicYears"),
            where("active", "==", true)
        );


    const snapshot =
        await getDocs(q);


    if(snapshot.empty){

        console.log(
            "No active academic year found"
        );

        return "";

    }


    const activeYear =
        snapshot.docs[0].data().year;


    await updateDoc(
        doc(db, "users", uid),
        {
            activeAcademicYear:
                activeYear
        }
    );


    return activeYear;

}


/* STUDENT LOGIN */

async function login(){

    const username =
        document
        .getElementById("username")
        .value
        .trim();


    const password =
        document
        .getElementById("password")
        .value
        .trim();


    if(
        username === "" ||
        password === ""
    ){

        alert(
            "Please fill all fields"
        );

        return;

    }


    const loginButton =
        document.querySelector(
            ".login-page button"
        );


    if(loginButton){

        loginButton.disabled =
            true;

    }


    showProcessing(
        "Please wait while we sign you in..."
    );


    try{

        /* FIREBASE LOGIN */

        const userCredential =
            await signInWithEmailAndPassword(
                auth,
                username,
                password
            );


        const user =
            userCredential.user;


        /*
         * NO EMAIL VERIFICATION CHECK FOR STUDENTS.
         * Student accounts are already created and
         * recorded by the school, so they can log in
         * right away.
         */


        /* GET USER DATA */

        const userRef =
            doc(
                db,
                "users",
                user.uid
            );


        const docSnap =
            await getDoc(
                userRef
            );


        if(!docSnap.exists()){

            await signOut(auth);

            throw new Error(
                "User data not found."
            );

        }


        const userData =
            docSnap.data();


        /* STUDENT-ONLY CHECK */

        if(
            userData.role !== "Student"
        ){

            await signOut(auth);

            throw new Error(
                "This login page is for Student accounts only."
            );

        }


        /* ACTIVE CHECK */

        if(
            userData.active === false
        ){

            await signOut(auth);

            await addDoc(
                collection(
                    db,
                    "activityLogs"
                ),
                {

                    user:
                        userData.fullname ||
                        userData.email ||
                        userData.studentNumber,

                    role:
                        userData.role,

                    academicYear:
                        userData.activeAcademicYear ||
                        "N/A",

                    action:
                        "Login Attempt",

                    status:
                        "Failed",

                    time:
                        new Date()
                        .toLocaleString(),

                    timestamp:
                        Date.now()

                }
            );


            throw new Error(
                "Your account has been deactivated. Please contact the administrator."
            );

        }


        /* UPDATE ACADEMIC YEAR */

        const activeYear =
            await updateUserAcademicYear(
                user.uid
            );


        if(activeYear){

            userData.activeAcademicYear =
                activeYear;

        }


        /* SAVE SESSION */

        localStorage.setItem(
            "currentUser",
            user.uid
        );


        localStorage.setItem(
            "currentStudentName",
            userData.fullname ||
            userData.email
        );


        localStorage.setItem(
            "userRole",
            userData.role
        );


        localStorage.setItem(
            "userData",
            JSON.stringify(userData)
        );


        /* SUCCESS ACTIVITY LOG */

        await addDoc(
            collection(
                db,
                "activityLogs"
            ),
            {

                user:
                    userData.fullname ||
                    userData.email ||
                    userData.studentNumber,

                role:
                    userData.role,

                academicYear:
                    userData.activeAcademicYear ||
                    "N/A",

                action:
                    "Login Attempt",

                status:
                    "Success",

                time:
                    new Date()
                    .toLocaleString(),

                timestamp:
                    Date.now()

            }
        );


        /* REDIRECT */

        showProcessing(
            "Login successful. Please wait while we take you to your dashboard..."
        );


        window.location.replace(
            "./student/dashboard.html"
        );

    }


    catch(error){

        console.error(
            "Login Error:",
            error
        );


        hideProcessing();


        if(loginButton){

            loginButton.disabled =
                false;

        }


        /* FAILED LOGIN LOG */

        try{

            await addDoc(
                collection(
                    db,
                    "activityLogs"
                ),
                {

                    user:
                        username,

                    role:
                        "Unknown",

                    academicYear:
                        "N/A",

                    action:
                        "Login Attempt",

                    status:
                        "Failed",

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
                "Failed to save login activity:",
                logError
            );

        }


        /* SPECIFIC ERRORS */

        if(
            error.message ===
            "This login page is for Student accounts only."
        ){

            alert(
                "This login page is for Student accounts only."
            );

            return;

        }


        if(
            error.message ===
            "Your account has been deactivated. Please contact the administrator."
        ){

            alert(
                "Your account has been deactivated. Please contact the administrator."
            );

            return;

        }


        if(
            error.message ===
            "User data not found."
        ){

            alert(
                "User data not found."
            );

            return;

        }


        /* NORMAL LOGIN ERROR */

        alert(
            "Invalid Username or Password"
        );

    }

}


/* PASSWORD RESET */

async function resetPassword(){

    const email =
        document
        .getElementById("username")
        .value
        .trim();


    if(email === ""){

        alert(
            "Enter your email first"
        );

        return;

    }


    try{

        showProcessing(
            "Sending password reset email..."
        );


        await sendPasswordResetEmail(
            auth,
            email
        );


        hideProcessing();


        alert(
            "Password reset email sent!"
        );

    }


    catch(error){

        hideProcessing();

        alert(
            error.message
        );

    }

}


/* EXPORT */

window.login =
    login;

window.resetPassword =
    resetPassword;

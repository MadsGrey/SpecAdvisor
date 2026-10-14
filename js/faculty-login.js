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
    addDoc,
    updateDoc,
    query,
    where,
    getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


let isLoggingIn = false;


/* PROCESSING POPUP */

function showProcessing(){

    const overlay =
        document.getElementById(
            "auth-processing-overlay"
        );

    const button =
        document.getElementById(
            "loginBtn"
        );


    if(overlay){

        overlay.classList.add(
            "active"
        );

    }


    if(button){

        button.disabled =
            true;

        button.textContent =
            "Please wait...";

    }

}


/* HIDE PROCESSING */

function hideProcessing(){

    const overlay =
        document.getElementById(
            "auth-processing-overlay"
        );

    const button =
        document.getElementById(
            "loginBtn"
        );


    if(overlay){

        overlay.classList.remove(
            "active"
        );

    }


    if(button){

        button.disabled =
            false;

        button.textContent =
            "Log In";

    }

}


/* UPDATE ACTIVE ACADEMIC YEAR */

async function updateUserAcademicYear(uid){

    const q =
        query(
            collection(
                db,
                "academicYears"
            ),
            where(
                "active",
                "==",
                true
            )
        );


    const snapshot =
        await getDocs(q);


    if(snapshot.empty){

        return "";

    }


    const activeYear =
        snapshot.docs[0].data().year;


    await updateDoc(
        doc(
            db,
            "users",
            uid
        ),
        {
            activeAcademicYear:
                activeYear
        }
    );


    return activeYear;

}


/* FACULTY LOGIN */

async function login(){

    if(isLoggingIn){

        return;

    }


    const email =
        document
            .getElementById(
                "username"
            )
            .value
            .trim();


    const password =
        document
            .getElementById(
                "password"
            )
            .value
            .trim();


    if(
        email === "" ||
        password === ""
    ){

        alert(
            "Please fill all fields"
        );

        return;

    }


    isLoggingIn =
        true;


    showProcessing();


    try{

        /* FIREBASE LOGIN */

        const credential =
            await signInWithEmailAndPassword(
                auth,
                email,
                password
            );


        const user =
            credential.user;


        /* EMAIL VERIFICATION CHECK */

        if(!user.emailVerified){

            await signOut(auth);

            throw new Error(
                "EMAIL_NOT_VERIFIED"
            );

        }


        /* GET USER DATA */

        const userRef =
            doc(
                db,
                "users",
                user.uid
            );


        const userSnap =
            await getDoc(
                userRef
            );


        if(!userSnap.exists()){

            await signOut(auth);

            throw new Error(
                "USER_DATA_NOT_FOUND"
            );

        }


        const userData =
            userSnap.data();


        /* FACULTY ROLE CHECK */

        if(
            userData.role !== "Faculty"
        ){

            await signOut(auth);

            throw new Error(
                "NOT_FACULTY"
            );

        }


        /* ADMIN APPROVAL CHECK */

        if(
            userData.active !== true
        ){

            await signOut(auth);

            throw new Error(
                "WAITING_FOR_APPROVAL"
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
            JSON.stringify(
                userData
            )
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
                    userData.email,

                role:
                    "Faculty",

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

        window.location.replace(
            "./faculty-dashboard.html"
        );

    }


    catch(error){

        console.error(
            "Faculty Login Error:",
            error
        );


        /* FAILED LOGIN LOG */

        try{

            await addDoc(
                collection(
                    db,
                    "activityLogs"
                ),
                {

                    user:
                        email,

                    role:
                        "Faculty",

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


        hideProcessing();

        isLoggingIn =
            false;


        /* EMAIL NOT VERIFIED */

        if(
            error.message ===
            "EMAIL_NOT_VERIFIED"
        ){

            alert(
                "Please verify your email address before logging in.\n\nCheck your inbox for the verification email."
            );

        }


        /* WAITING FOR ADMIN APPROVAL */

        else if(
            error.message ===
            "WAITING_FOR_APPROVAL"
        ){

            alert(
                "Your Faculty account is waiting for admin approval.\n\nPlease wait until an administrator activates your account."
            );

        }


        /* WRONG ROLE */

        else if(
            error.message ===
            "NOT_FACULTY"
        ){

            alert(
                "This account is not a Faculty account."
            );

        }


        /* USER DATA MISSING */

        else if(
            error.message ===
            "USER_DATA_NOT_FOUND"
        ){

            alert(
                "User data not found."
            );

        }


        /* NORMAL LOGIN ERROR */

        else{

            alert(
                "Invalid Faculty Email or Password"
            );

        }

    }

}


window.login =
    login;

// Prevent returning to the Faculty Dashboard after logout
window.history.pushState(null, "", window.location.href);

window.addEventListener("popstate", function () {
    window.history.pushState(null, "", window.location.href);
});

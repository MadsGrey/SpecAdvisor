import {
    db,
    auth
}
from "./firebase-config.js";

import {
    signOut,
    onAuthStateChanged
}
from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
    collection,
    addDoc,
    getDocs,
    deleteDoc,
    updateDoc,
    doc,
    writeBatch
}
from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
    appAlert,
    appConfirm
} from "./ui-dialog.js";

import { INTEREST_AREAS } from "./interest-config.js";


/* AUTHENTICATION */

onAuthStateChanged(auth, (user) => {

    if (!user) {

        window.location.replace("../login.html");

    }

});


/* BACK BUTTON PROTECTION */

window.addEventListener("pageshow", (event) => {

    if (event.persisted) {

        window.location.reload();

    }

});


/* SIDEBAR */

function toggleSidebar(){

    const sidebar =
        document.getElementById("sidebar");

    if(sidebar){

        sidebar.classList.toggle("active");

    }

}


/* NAVIGATION */

function goPage(url){

    window.location.href = url;

}


/* =========================================================
   LOGOUT MODAL (unchanged)
========================================================= */

function hideLogoutModal(){

    const overlay =
        document.getElementById("logout-overlay");

    if(!overlay){
        return;
    }

    overlay.classList.remove("active");

    overlay.style.display = "none";

    document.body.style.overflow = "";

}


function logout(){

    const overlay =
        document.getElementById("logout-overlay");

    if(!overlay){

        console.error(
            "Logout modal not found."
        );

        return;

    }

    overlay.classList.add("active");

    overlay.style.display = "flex";

    document.body.style.overflow = "hidden";

}


function closeLogoutModal(){

    const overlay =
        document.getElementById("logout-overlay");

    if(!overlay){
        return;
    }

    overlay.classList.remove("active");

    overlay.style.display = "none";

    document.body.style.overflow = "";

}


function closeLogoutOutside(event){

    if(
        event &&
        event.target &&
        event.target.id === "logout-overlay"
    ){

        closeLogoutModal();

    }

}


async function confirmLogout(){

    const confirmButton =
        document.querySelector(
            ".logout-confirm-btn"
        );

    if(confirmButton){

        confirmButton.disabled = true;

        confirmButton.textContent =
            "Logging out...";

    }


    try{

        await signOut(auth);

        localStorage.clear();

        window.location.replace(
            "../login.html"
        );

    }

    catch(error){

        console.error(
            "Logout error:",
            error
        );


        if(confirmButton){

            confirmButton.disabled = false;

            confirmButton.textContent =
                "Log Out";

        }


        await appAlert(
            "Unable to log out. Please try again.",
            { type: "error" }
        );

    }

}


/* LOAD EVERYTHING */

async function loadAll(){

    await Promise.all([

        loadSpecs(),

        loadSections(),

        loadAcademicYears()

    ]);

}


/* =========================================================
   SPECIALIZATIONS
========================================================= */

async function addSpec(){

    const input =
        document.getElementById("specInput");

    const value =
        input.value.trim();

    if(value === ""){

        await appAlert(
            "Please enter a specialization.",
            { type: "warning" }
        );

        return;

    }

    try{

        await addDoc(
            collection(
                db,
                "specializations"
            ),
            {
                name: value,
                interestAreas: []
            }
        );

        input.value = "";

        await loadSpecs();

    }
    catch(error){

        console.error(
            "Error adding specialization:",
            error
        );

        await appAlert(
            error.message,
            { type: "error" }
        );

    }

}


/*
   Interest-area tick boxes for one specialization.
   Saved straight to Firestore when ticked/unticked.
*/
function buildInterestTagRow(specId, selectedAreas){

    const wrap =
        document.createElement("div");

    wrap.style.cssText =
        "display:flex;flex-wrap:wrap;gap:8px;align-items:center;";


    const label =
        document.createElement("span");

    label.textContent =
        "Interest areas:";

    label.style.cssText =
        "font-size:12px;color:#5f6368;";

    wrap.appendChild(label);


    const hint =
        document.createElement("span");

    hint.style.cssText =
        "font-size:11px;color:#b06000;";

    function updateHint(count){

        hint.textContent =
            count === 0
                ? "Not tagged: student interest answers will not affect this specialization."
                : "";

    }

    updateHint(selectedAreas.length);


    INTEREST_AREAS.forEach((area) => {

        const chip =
            document.createElement("label");

        chip.style.cssText = `
            display:inline-flex;align-items:center;gap:5px;
            padding:4px 10px;border:1px solid #dadce0;
            border-radius:16px;font-size:12px;cursor:pointer;
            background:#fff;color:#3c4043;
        `;

        const box =
            document.createElement("input");

        box.type = "checkbox";

        box.value = area;

        box.checked =
            selectedAreas.includes(area);

        chip.appendChild(box);

        chip.appendChild(
            document.createTextNode(area)
        );


        box.addEventListener("change", async () => {

            const boxes =
                wrap.querySelectorAll("input");

            const checked =
                [...wrap.querySelectorAll("input:checked")]
                    .map((input) => input.value);

            boxes.forEach((input) => {
                input.disabled = true;
            });

            try{

                await updateDoc(
                    doc(
                        db,
                        "specializations",
                        specId
                    ),
                    {
                        interestAreas: checked
                    }
                );

                updateHint(checked.length);

                boxes.forEach((input) => {
                    input.disabled = false;
                });

            }
            catch(error){

                console.error(
                    "Error saving interest areas:",
                    error
                );

                await appAlert(
                    "Unable to save the interest areas.",
                    { type: "error" }
                );

                await loadSpecs();

            }

        });

        wrap.appendChild(chip);

    });

    wrap.appendChild(hint);

    return wrap;

}


/* LOAD SPECIALIZATIONS */

async function loadSpecs(){

    const list =
        document.getElementById("specList");

    const dropdown =
        document.getElementById("specDropdown");

    if(list){

        list.innerHTML = "";

    }

    if(dropdown){

        dropdown.innerHTML = `
            <option value="">
                Select Specialization
            </option>
        `;

    }

    try{

        const snapshot =
            await getDocs(
                collection(
                    db,
                    "specializations"
                )
            );

        snapshot.forEach((docSnap) => {

            const data =
                docSnap.data();

            const name =
                data.name || "";

            const areas =
                Array.isArray(data.interestAreas)
                    ? data.interestAreas
                    : [];


            if(list){

                const item =
                    document.createElement("div");

                item.className =
                    "manage-item";

                // Two rows: name + delete, then interest tags
                item.style.cssText =
                    "flex-direction:column;align-items:stretch;gap:10px;";


                const topRow =
                    document.createElement("div");

                topRow.style.cssText =
                    "display:flex;justify-content:space-between;align-items:center;gap:10px;";


                const nameEl =
                    document.createElement("span");

                nameEl.textContent = name;


                const deleteButton =
                    document.createElement("button");

                deleteButton.textContent =
                    "Delete";

                deleteButton.addEventListener(
                    "click",
                    () => deleteSpec(docSnap.id)
                );


                topRow.appendChild(nameEl);

                topRow.appendChild(deleteButton);

                item.appendChild(topRow);

                item.appendChild(
                    buildInterestTagRow(
                        docSnap.id,
                        areas
                    )
                );

                list.appendChild(item);

            }


            if(dropdown){

                const option =
                    document.createElement("option");

                option.value = name;

                option.textContent = name;

                dropdown.appendChild(option);

            }

        });

    }
    catch(error){

        console.error(
            "Error loading specializations:",
            error
        );

    }

}


/* DELETE SPECIALIZATION */

async function deleteSpec(id){

    const confirmed =
        await appConfirm(
            "Delete this specialization?",
            {
                title: "Delete Specialization",
                confirmText: "Delete",
                type: "warning",
                danger: true
            }
        );

    if(!confirmed){

        return;

    }

    try{

        await deleteDoc(
            doc(
                db,
                "specializations",
                id
            )
        );

        await loadSpecs();

    }
    catch(error){

        console.error(
            "Error deleting specialization:",
            error
        );

        await appAlert(
            error.message,
            { type: "error" }
        );

    }

}


/* =========================================================
   SECTIONS
========================================================= */

async function addSec(){

    const input =
        document.getElementById("secInput");

    const value =
        input.value.trim();

    if(value === ""){

        await appAlert(
            "Please enter a section.",
            { type: "warning" }
        );

        return;

    }

    try{

        await addDoc(
            collection(
                db,
                "sections"
            ),
            {
                name: value
            }
        );

        input.value = "";

        await loadSections();

    }
    catch(error){

        console.error(
            "Error adding section:",
            error
        );

        await appAlert(
            error.message,
            { type: "error" }
        );

    }

}


/* LOAD SECTIONS */

async function loadSections(){

    const list =
        document.getElementById("secList");

    if(!list){

        return;

    }

    list.innerHTML = "";

    try{

        const snapshot =
            await getDocs(
                collection(
                    db,
                    "sections"
                )
            );

        snapshot.forEach((docSnap) => {

            const data =
                docSnap.data();

            const item =
                document.createElement("div");

            item.className =
                "manage-item";

            item.innerHTML = `
                <span></span>
                <button>
                    Delete
                </button>
            `;

            item.querySelector("span")
                .textContent =
                    data.name || "";

            item.querySelector("button")
                .addEventListener(
                    "click",
                    () => deleteSec(docSnap.id)
                );

            list.appendChild(item);

        });

    }
    catch(error){

        console.error(
            "Error loading sections:",
            error
        );

    }

}


/* DELETE SECTION */

async function deleteSec(id){

    const confirmed =
        await appConfirm(
            "Delete this section?",
            {
                title: "Delete Section",
                confirmText: "Delete",
                type: "warning",
                danger: true
            }
        );

    if(!confirmed){

        return;

    }

    try{

        await deleteDoc(
            doc(
                db,
                "sections",
                id
            )
        );

        await loadSections();

    }
    catch(error){

        console.error(
            "Error deleting section:",
            error
        );

        await appAlert(
            error.message,
            { type: "error" }
        );

    }

}


/* =========================================================
   ACADEMIC YEARS
========================================================= */

async function addAcademicYear(){

    const input =
        document.getElementById("yearInput");

    const value =
        input.value.trim();

    if(value === ""){

        await appAlert(
            "Please enter an academic year.",
            { type: "warning" }
        );

        return;

    }

    try{

        const snapshot =
            await getDocs(
                collection(
                    db,
                    "academicYears"
                )
            );

        const exists =
            snapshot.docs.some(
                (docSnap) =>
                    docSnap.data().year === value
            );

        if(exists){

            await appAlert(
                "This academic year already exists.",
                { type: "warning" }
            );

            return;

        }


        await addDoc(
            collection(
                db,
                "academicYears"
            ),
            {
                year: value,
                active: false
            }
        );

        input.value = "";

        await loadAcademicYears();

    }
    catch(error){

        console.error(
            "Error adding academic year:",
            error
        );

        await appAlert(
            error.message,
            { type: "error" }
        );

    }

}


/* LOAD ACADEMIC YEARS */

async function loadAcademicYears(){

    const list =
        document.getElementById(
            "yearList"
        );

    if(!list){

        return;

    }

    list.innerHTML = "";

    try{

        const snapshot =
            await getDocs(
                collection(
                    db,
                    "academicYears"
                )
            );

        snapshot.forEach((docSnap) => {

            const data =
                docSnap.data();

            const item =
                document.createElement("div");

            item.className =
                "manage-item";


            const name =
                document.createElement("b");

            name.textContent =
                data.year || "";

            item.appendChild(name);


            if(data.active){

                item.appendChild(
                    document.createTextNode(
                        " (Active)"
                    )
                );

            }


            const buttons =
                document.createElement("div");


            const activeButton =
                document.createElement("button");

            activeButton.textContent =
                "Set Active";

            activeButton.onclick = () =>
                setActiveYear(docSnap.id);


            const deleteButton =
                document.createElement("button");

            deleteButton.textContent =
                "Delete";

            deleteButton.onclick = () =>
                deleteAcademicYear(
                    docSnap.id
                );


            buttons.appendChild(
                activeButton
            );

            buttons.appendChild(
                deleteButton
            );

            item.appendChild(buttons);

            list.appendChild(item);

        });

    }
    catch(error){

        console.error(
            "Error loading academic years:",
            error
        );

    }

}


/* SET ACTIVE ACADEMIC YEAR */

async function setActiveYear(id){

    try{

        const snapshot =
            await getDocs(
                collection(
                    db,
                    "academicYears"
                )
            );


        let batch =
            writeBatch(db);

        let operationCount = 0;


        for(
            const yearDoc
            of snapshot.docs
        ){

            const yearRef =
                doc(
                    db,
                    "academicYears",
                    yearDoc.id
                );


            batch.update(
                yearRef,
                {
                    active:
                        yearDoc.id === id
                }
            );

            operationCount++;


            if(operationCount === 450){

                await batch.commit();

                batch =
                    writeBatch(db);

                operationCount = 0;

            }

        }


        if(operationCount > 0){

            await batch.commit();

        }


        await loadAcademicYears();

    }
    catch(error){

        console.error(
            "Error setting active academic year:",
            error
        );

        await appAlert(
            error.message,
            { type: "error" }
        );

    }

}


/* DELETE ACADEMIC YEAR */

async function deleteAcademicYear(id){

    const confirmed =
        await appConfirm(
            "Delete this academic year?",
            {
                title: "Delete Academic Year",
                confirmText: "Delete",
                type: "warning",
                danger: true
            }
        );

    if(!confirmed){

        return;

    }

    try{

        await deleteDoc(
            doc(
                db,
                "academicYears",
                id
            )
        );

        await loadAcademicYears();

    }
    catch(error){

        console.error(
            "Error deleting academic year:",
            error
        );

        await appAlert(
            error.message,
            { type: "error" }
        );

    }

}


/* PAGE LOAD */

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        hideLogoutModal();

        await loadAll();

    }
);


/* EXPORTS */

window.toggleSidebar =
    toggleSidebar;

window.goPage =
    goPage;

window.logout =
    logout;

window.closeLogoutModal =
    closeLogoutModal;

window.closeLogoutOutside =
    closeLogoutOutside;

window.confirmLogout =
    confirmLogout;


/* SPECIALIZATIONS */

window.addSpec =
    addSpec;

window.deleteSpec =
    deleteSpec;


/* SECTIONS */

window.addSec =
    addSec;

window.deleteSec =
    deleteSec;


/* ACADEMIC YEARS */

window.addAcademicYear =
    addAcademicYear;

window.setActiveYear =
    setActiveYear;

window.deleteAcademicYear =
    deleteAcademicYear;

/* SIDEBAR */

function toggleSidebar(){

    const sidebar =
        document.getElementById("sidebar");

    if(sidebar){

        sidebar.classList.toggle("active");

    }

}


/* NAVIGATION */

function goPage(page){

    document.body.style.opacity = "0";

    setTimeout(()=>{

        window.location.href = page;

    },300);

}


/* CALENDAR */

function loadCalendar(){

    // Check if this page actually has a calendar
    const calendarTitle =
        document.getElementById("calendar-title");

    const calendarTable =
        document.getElementById("calendar-table");

    const calendarBody =
        document.getElementById("calendar-body");

    // If there is no calendar on this page,
    // simply stop and do nothing.
    if(
        !calendarTitle ||
        !calendarTable ||
        !calendarBody
    ){

        return;

    }


    const monthNames = [

        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December"

    ];


    const now =
        new Date();


    const year =
        now.getFullYear();


    const month =
        now.getMonth();


    calendarTitle.innerText =
        `📅 ${monthNames[month]} ${year}`;


    const firstDay =
        new Date(
            year,
            month,
            1
        ).getDay();


    const daysInMonth =
        new Date(
            year,
            month + 1,
            0
        ).getDate();


    let body =
        calendarBody;


    body.innerHTML = "";


    let date = 1;


    for(
        let i = 0;
        i < 6;
        i++
    ){

        let row =
            document.createElement("tr");


        for(
            let j = 0;
            j < 7;
            j++
        ){

            let cell =
                document.createElement("td");


            if(
                i === 0 &&
                j < firstDay
            ){

                cell.innerHTML = "";

            }

            else if(
                date > daysInMonth
            ){

                cell.innerHTML = "";

            }

            else{

                cell.innerHTML =
                    date;


                if(
                    date === now.getDate()
                ){

                    cell.style.background =
                        "#ffd6ea";

                    cell.style.color =
                        "#2f2fa2";

                    cell.style.fontWeight =
                        "bold";

                }


                date++;

            }


            row.appendChild(cell);

        }


        body.appendChild(row);

    }

}


/* RUN CALENDAR */

document.addEventListener(
    "DOMContentLoaded",
    ()=>{

        loadCalendar();

    }
);

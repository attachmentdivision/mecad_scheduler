let courseData = [];
let selectedCourses = [];
let currentTerm = "BFA FALL"; // Tracks which tab is currently active

const container = document.getElementById("course-container");
const searchInput = document.getElementById("searchInput");
const deptFilter = document.getElementById("deptFilter");
const dayFilter = document.getElementById("dayFilter");
const resetFiltersBtn = document.getElementById("resetFilters");
const tabs = document.querySelectorAll(".tab-btn");

const departmentMap = {
  AG: "Animation & Game Art",
  AM: "Music",
  AS: "Academic Studies",
  CE: "Ceramics",
  FN: "Foundation",
  GD: "Graphic Design",
  IL: "Illustration",
  MJ: "Metalsmithing & Jewelry",
  PE: "Public Engagement",
  PH: "Photography",
  PR: "Printmaking",
  PT: "Painting",
  SC: "Sculpture",
  SEM: "Seminars",
  TF: "Textile & Fashion Design",
  WF: "Woodworking & Furniture",
};

// --- APP INITIALIZATION ---
// Fetch BOTH files simultaneously
Promise.all([
  fetch("fall.json").then((res) => (res.ok ? res.json() : [])),
  fetch("spring.json").then((res) => (res.ok ? res.json() : [])),
])
  .then(([fallData, springData]) => {
    // Combine them into one master array
    const rawData = [...fallData, ...springData];

    courseData = rawData
      .filter((c) => c.title && c.courseCode && c.department !== "0")
      .map((course, index) => {
        if (!course.schedule) course.schedule = { day: "", time: "" };

        course.schedule.day = formatAcademicTime(course.schedule.day);
        course.schedule.time = formatAcademicTime(course.schedule.time);
        course.title = course.title.replace(/\[anticipate.*?\]/gi, "").trim();
        course.id = "course-" + index;
        return course;
      });

    courseData.sort((a, b) => {
      if (a.department === "GD" && b.department !== "GD") return -1;
      if (b.department === "GD" && a.department !== "GD") return 1;
      return 0;
    });

    const uniqueDepartments = [
      ...new Set(courseData.map((c) => c.department)),
    ].sort();
    uniqueDepartments.forEach((dept) => {
      const option = document.createElement("option");
      option.value = dept;
      option.textContent = departmentMap[dept] || dept;
      deptFilter.appendChild(option);
    });

    buildTimeAxis();
    filterCourses();
    updateScheduleUI();
  })
  .catch((error) => {
    console.error("Error loading JSON data:", error);
    container.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; color: #dc2626; background: #fee2e2; padding: 20px; border-radius: 8px;">
            <strong>Failed to load courses.</strong><br><br>
            Make sure 'fall.json' and 'spring.json' are both in your folder and formatted correctly.<br>
            <em>Technical Details: ${error.message}</em>
        </div>`;
  });

// --- TIME PARSING LOGIC ---
function formatAcademicTime(str) {
  if (!str) return "";
  str = str.replace(/PMA/gi, "").replace(/--/g, "-").trim();
  str = str.replace(/\b845\b/g, "8:45");
  str = str.replace(/\b10-11\b/g, "10:00-11:00");

  return str.replace(
    /(\d{1,2})(?::(\d{2}))?\s*-\s*(\d{1,2})(?::(\d{2}))?/g,
    function (match, h1, m1, h2, m2) {
      h1 = parseInt(h1);
      m1 = m1 || "00";
      h2 = parseInt(h2);
      m2 = m2 || "00";

      let ap1 = h1 >= 8 && h1 <= 11 ? "AM" : "PM";
      if (h1 === 12) ap1 = "PM";

      let ap2 = h2 >= 8 && h2 <= 11 && h1 !== 12 && h1 >= 8 ? "AM" : "PM";
      if (h2 === 12) ap2 = "PM";

      return `${h1}:${m1} ${ap1} - ${h2}:${m2} ${ap2}`;
    },
  );
}

function parseAllTimeRanges(str) {
  const regex =
    /(\d{1,2}):(\d{2})\s*(AM|PM)\s*-\s*(\d{1,2}):(\d{2})\s*(AM|PM)/gi;
  let matches = [];
  let match;
  while ((match = regex.exec(str)) !== null) {
    let h1 = parseInt(match[1]),
      m1 = parseInt(match[2]),
      ap1 = match[3].toUpperCase();
    let h2 = parseInt(match[4]),
      m2 = parseInt(match[5]),
      ap2 = match[6].toUpperCase();

    if (ap1 === "PM" && h1 !== 12) h1 += 12;
    if (ap1 === "AM" && h1 === 12) h1 = 0;
    if (ap2 === "PM" && h2 !== 12) h2 += 12;
    if (ap2 === "AM" && h2 === 12) h2 = 0;

    matches.push({ start: h1 + m1 / 60, end: h2 + m2 / 60, raw: match[0] });
  }
  return matches;
}

function getCourseTimes(c) {
  let times = [];
  if (!c || !c.schedule) return times;

  const timeString = (c.schedule.day + " | " + c.schedule.time).toUpperCase();

  let matchedDays = [];
  const dayRegex = /\b(MON|TUE|WED|THU|FRI|M|TU|W|TH|F|FR)\b/g;
  let dayMatch;
  while ((dayMatch = dayRegex.exec(timeString)) !== null) {
    let d = dayMatch[1];
    if (d === "M" || d === "MON") matchedDays.push("mon");
    else if (d === "TU" || d === "TUE") matchedDays.push("tue");
    else if (d === "W" || d === "WED") matchedDays.push("wed");
    else if (d === "TH" || d === "THU") matchedDays.push("thu");
    else if (d === "F" || d === "FR" || d === "FRI") matchedDays.push("fri");
  }
  matchedDays = [...new Set(matchedDays)];
  const timeRanges = parseAllTimeRanges(timeString);

  if (timeRanges.length === 0) return times;

  matchedDays.forEach((day, index) => {
    let tRange =
      timeRanges.length === matchedDays.length
        ? timeRanges[index]
        : timeRanges[0];
    if (tRange) {
      times.push({
        day: day,
        start: tRange.start,
        end: tRange.end,
        raw: tRange.raw,
      });
    }
  });
  return times;
}

function getCourseCategory(dept) {
  if (dept === "AS") return "as";
  if (dept === "SEM") return "sem";
  return "studio";
}

function buildTimeAxis() {
  const timeAxisContainer = document.getElementById("time-axis");
  timeAxisContainer.innerHTML = "";
  for (let i = 8; i <= 22; i++) {
    let ap = i >= 12 && i < 24 ? "PM" : "AM";
    let displayHour = i > 12 ? i - 12 : i;
    let topPct = ((i - 8) / 14) * 100;
    timeAxisContainer.innerHTML += `<div class="time-label" style="top: ${topPct}%;">${displayHour} ${ap}</div>`;
  }
}

// --- CONFLICT DETECTION ---
function hasConflict(courseToCheck, currentSchedule) {
  const newTimes = getCourseTimes(courseToCheck);
  for (let scheduledCourse of currentSchedule) {
    const existingTimes = getCourseTimes(scheduledCourse);
    for (let nt of newTimes) {
      for (let et of existingTimes) {
        if (nt.day === et.day) {
          if (nt.start < et.end && nt.end > et.start) {
            return true;
          }
        }
      }
    }
  }
  return false;
}

// --- APP LOGIC ---

// Tab Click Logic
tabs.forEach((tab) => {
  tab.addEventListener("click", (e) => {
    // Remove active class from all tabs
    tabs.forEach((t) => t.classList.remove("active"));
    // Add to clicked tab
    e.target.classList.add("active");

    // Update global variable
    currentTerm = e.target.getAttribute("data-term");

    // Re-render
    filterCourses();
    updateScheduleUI();
  });
});

window.toggleDescription = function (id, btnElement) {
  const descDiv = document.getElementById(id);
  if (descDiv.style.display === "none" || descDiv.style.display === "") {
    descDiv.style.display = "block";
    btnElement.innerHTML = "Hide Description &uarr;";
  } else {
    descDiv.style.display = "none";
    btnElement.innerHTML = "Read Description &darr;";
  }
};

window.toggleCourse = function (id) {
  const course = courseData.find((c) => c.id === id);
  const isSelected = selectedCourses.some((c) => c.id === id);

  if (isSelected) {
    selectedCourses = selectedCourses.filter((c) => c.id !== id);
  } else {
    selectedCourses.push(course);
  }

  filterCourses();
  updateScheduleUI();
};

function updateScheduleUI() {
  let countAS = 0,
    countSem = 0,
    countStudio = 0;

  ["mon", "tue", "wed", "thu", "fri"].forEach((day) => {
    document.getElementById("col-" + day).innerHTML = "";
  });

  // Only plot courses that match the currently selected tab
  const currentTermSelected = selectedCourses.filter(
    (c) => c.term === currentTerm,
  );

  currentTermSelected.forEach((c) => {
    const cat = getCourseCategory(c.department);
    if (cat === "as") countAS++;
    else if (cat === "sem") countSem++;
    else countStudio++;

    const times = getCourseTimes(c);

    times.forEach((t) => {
      const topPct = ((t.start - 8) / 14) * 100;
      const heightPct = ((t.end - t.start) / 14) * 100;

      const blockClass = `bg-${cat}`;

      const eventHTML = `
                <div class="sched-event ${blockClass}" style="top: ${topPct}%; height: ${heightPct}%;">
                    <div class="event-info">
                        <strong>${c.courseCode}</strong><br>
                        ${t.raw}
                    </div>
                    <button class="event-remove-btn" onclick="toggleCourse('${c.id}')" title="Remove from schedule">&times;</button>
                </div>
            `;
      document.getElementById("col-" + t.day).innerHTML += eventHTML;
    });
  });

  document.getElementById("tracker-as").innerText = `Academic: ${countAS}`;
  document.getElementById("tracker-sem").innerText = `Seminars: ${countSem}`;
  document.getElementById("tracker-studio").innerText =
    `Studios: ${countStudio}`;
}

function renderCourses(courses) {
  container.innerHTML = "";

  if (courses.length === 0) {
    container.innerHTML =
      '<div style="grid-column: 1/-1; text-align: center;">No courses found matching your criteria.</div>';
    return;
  }

  courses.forEach((course) => {
    const card = document.createElement("div");
    const cat = getCourseCategory(course.department);

    // Only check for conflicts against courses in the SAME term
    const currentTermSelected = selectedCourses.filter(
      (c) => c.term === currentTerm,
    );

    const isSelected = selectedCourses.some((c) => c.id === course.id);
    const isConflict = !isSelected && hasConflict(course, currentTermSelected);

    card.className = `course-card type-${cat} ${isConflict ? "has-conflict" : ""}`;

    let btnText = isSelected ? "Remove from Schedule" : "Add to Schedule";
    let btnClass = isSelected ? "btn-remove" : "btn-add";
    let disabledAttr = "";

    if (isConflict) {
      btnText = "Schedule Conflict";
      btnClass = "btn-conflict";
      disabledAttr = "disabled";
    }

    let typeName =
      cat === "as" ? "Academic" : cat === "sem" ? "Seminar" : "Studio";

    let timeDisplay = course.schedule.day;
    if (course.schedule.time && course.schedule.time !== course.schedule.day) {
      timeDisplay += " | " + course.schedule.time;
    }

    const descText =
      course.description || "No description available for this course.";

    card.innerHTML = `
            <div style="flex: 1;">
                <div class="course-header">
                    <span class="course-code">${course.courseCode} ${course.section ? "(" + course.section + ")" : ""}</span>
                    <span class="course-badge bg-${cat}">${typeName}</span>
                </div>
                <h3 class="course-title">${course.title}</h3>
                <p class="course-detail"><strong>Instructor:</strong> ${course.instructor || "TBD"}</p>
                <p class="course-detail"><strong>Schedule:</strong> ${timeDisplay || "TBD"}</p>
                <p class="course-detail"><strong>Room:</strong> ${course.room || "TBD"}</p>
                ${course.notes ? `<p class="course-detail" style="margin-bottom: 5px;"><em>Note: ${course.notes}</em></p>` : ""}
                
                ${isConflict ? `<div class="conflict-alert">⚠️ Time conflicts with schedule</div>` : ""}
                
                <div id="desc-${course.id}" class="course-desc" style="display: none;">
                    ${descText}
                </div>
            </div>
            
            <div class="card-actions">
                <button class="btn-toggle" onclick="toggleDescription('desc-${course.id}', this)">Description &darr;</button>
                <button class="btn ${btnClass}" onclick="toggleCourse('${course.id}')" ${disabledAttr}>${btnText}</button>
            </div>
        `;
    container.appendChild(card);
  });
}

function filterCourses() {
  const searchTerm = searchInput.value.toLowerCase();
  const selectedDept = deptFilter.value;
  const selectedDay = dayFilter.value;

  const filtered = courseData.filter((course) => {
    const matchesSearch =
      (course.title && course.title.toLowerCase().includes(searchTerm)) ||
      (course.courseCode &&
        course.courseCode.toLowerCase().includes(searchTerm)) ||
      (course.instructor &&
        course.instructor.toLowerCase().includes(searchTerm));

    const matchesDept =
      selectedDept === "all" || course.department === selectedDept;

    // Filter the left-hand column to only show courses from the active tab
    const matchesTerm = course.term === currentTerm;

    const times = getCourseTimes(course);
    const matchesDay =
      selectedDay === "all" || times.some((t) => t.day === selectedDay);

    return matchesSearch && matchesDept && matchesDay && matchesTerm;
  });

  renderCourses(filtered);
}

// Attach Event Listeners
searchInput.addEventListener("input", filterCourses);
deptFilter.addEventListener("change", filterCourses);
dayFilter.addEventListener("change", filterCourses);

// Reset only the form inputs, leave selected courses and current tab alone
resetFiltersBtn.addEventListener("click", () => {
  searchInput.value = "";
  deptFilter.value = "all";
  dayFilter.value = "all";
  filterCourses();
});

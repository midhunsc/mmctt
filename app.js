// ==========================================================================
// COLLEGE TIMETABLE SYSTEM - CLIENT APPLICATION CODE (MMCTT FRESH VERSION)
// ==========================================================================

// --- MOCK DATABASE FALLBACK (CLEARED FOR DIRECT GOOGLE SHEETS MODE) ---
const MOCK_DATABASE = {
  classes: [],
  faculty: [],
  subjects: [],
  subjectfaculty: [],
  timetable: []
};

// Helper to retrieve values from spreadsheet rows case-insensitively and space-insensitively.
// This is critical since spreadsheet headers can vary (e.g., 'Department' vs 'department' vs 'Dept').
function getVal(obj, ...keys) {
  if (!obj) return "";
  for (let key of keys) {
    const cleanKey = String(key).toLowerCase().replace(/[\s_-]/g, "");
    for (const [k, v] of Object.entries(obj)) {
      const cleanK = String(k).toLowerCase().replace(/[\s_-]/g, "");
      if (cleanK === cleanKey) {
        return String(v).trim();
      }
    }
  }
  return "";
}

// --- GLOBAL APPLICATION STATE ---
let db = { ...MOCK_DATABASE };
let config = {
  // Hardcoded deployment Google Apps Script URL for MMCTT portal
  apiUrl: "https://script.google.com/macros/s/AKfycbxZ41-SlA1RMMQO4kZgk9ea8jSLXU-u1x68vLnMZo_A1hJPRJNVSaqpDOL7kmIreEUD/exec"
};

// Selections
let activeFilters = {
  academicYear: "2026-2027",
  semester: "",
  department: "",
  classId: "",
  mode: "class",     // "class" or "teacher"
  teacherId: ""      // Selected Faculty ID in teacher mode
};

// Timetable Grid data state representing current layout:
// Key: "Day_PeriodIndex" (e.g., "Monday_0", "Tuesday_4")
// Value: { subjectCode: "...", faculty: ["F001", "F002"] } OR in teacher mode: { subjectCode: "...", classId: "..." }
let gridState = {};

// Cell currently being edited
let currentEditingCell = {
  day: "",
  periodIndex: -1
};

// Mapping of column indexes to Period names inside Google Sheet database
const PERIOD_DATABASE_MAP = ["Hour 0", "Hour 1", "Hour 2", "Hour 3", "Hour 4", "Hour 5"];
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

// --- DOM ELEMENTS ---
const elements = {
  // Mode Selection Tabs
  tabClassMode: document.getElementById("tab-class-mode"),
  tabTeacherMode: document.getElementById("tab-teacher-mode"),
  
  // Sidebar Filters
  selectAY: document.getElementById("select-academic-year"),
  selectSem: document.getElementById("select-semester"),
  selectDept: document.getElementById("select-department"),
  
  classFilterGroup: document.getElementById("class-filter-group"),
  selectClass: document.getElementById("select-class"),
  
  teacherFilterGroup: document.getElementById("teacher-filter-group"),
  selectTeacher: document.getElementById("select-teacher"),
  
  btnLoadClass: document.getElementById("btn-load-class"),
  
  // Top Action Bar
  badgeStatus: document.getElementById("badge-status"),
  lblCurrentClass: document.getElementById("lbl-current-class"),
  btnCopyTimetable: document.getElementById("btn-copy-timetable"),
  btnPrint: document.getElementById("btn-print"),
  btnSave: document.getElementById("btn-save"),
  
  // Workspace Views
  welcomeScreen: document.getElementById("welcome-screen"),
  timetableGridWrapper: document.getElementById("timetable-grid-wrapper"),
  timetableTbody: document.getElementById("timetable-tbody"),
  
  // Copy Modal
  modalCopy: document.getElementById("modal-copy"),
  selectCopySource: document.getElementById("copy-source-class"),
  btnConfirmCopy: document.getElementById("btn-confirm-copy"),
  btnCloseCopy: document.getElementById("btn-close-copy"),
  
  // Cell Edit Modal
  modalCellEdit: document.getElementById("modal-cell-edit"),
  cellEditTitle: document.getElementById("cell-edit-title"),
  cellEditSubtitle: document.getElementById("cell-edit-subtitle"),
  
  cellClassGroup: document.getElementById("cell-class-group"),
  cellSelectClass: document.getElementById("cell-select-class"),
  
  cellSelectSubject: document.getElementById("cell-select-subject"),
  facultyAssignmentSection: document.getElementById("faculty-assignment-section"),
  cellSelectFaculty1: document.getElementById("cell-select-faculty1"),
  chkTwoFaculty: document.getElementById("chk-two-faculty"),
  faculty2Wrapper: document.getElementById("faculty2-wrapper"),
  cellSelectFaculty2: document.getElementById("cell-select-faculty2"),
  dialogClashWarning: document.getElementById("dialog-clash-warning"),
  dialogClashMsg: document.getElementById("dialog-clash-msg"),
  btnClearCell: document.getElementById("btn-clear-cell"),
  btnApplyCell: document.getElementById("btn-apply-cell"),
  btnCloseCellEdit: document.getElementById("btn-close-cell-edit"),
  
  // Toasts
  toastContainer: document.getElementById("toast-container")
};

// --- INITIALIZATION ---
document.addEventListener("DOMContentLoaded", () => {
  initApp();
});

function initApp() {
  // 1. Initial Icon Load
  lucide.createIcons();
  
  // 2. Fetch database from Google Sheets
  fetchDataFromGoogleSheets();
  
  // 3. Set Event Listeners
  setupEventListeners();
}

function setupEventListeners() {
  // Mode Switches
  elements.tabClassMode.addEventListener("click", () => switchMode("class"));
  elements.tabTeacherMode.addEventListener("click", () => switchMode("teacher"));

  // Cascading Filter Listeners
  elements.selectAY.addEventListener("change", handleFilterChange);
  elements.selectSem.addEventListener("change", handleFilterChange);
  elements.selectDept.addEventListener("change", handleFilterChange);
  
  elements.selectClass.addEventListener("change", () => {
    elements.btnLoadClass.disabled = !elements.selectClass.value;
  });
  
  elements.selectTeacher.addEventListener("change", () => {
    elements.btnLoadClass.disabled = !elements.selectTeacher.value;
  });
  
  // Load Buttons
  elements.btnLoadClass.addEventListener("click", loadTimetableForSelectedClass);
  
  // Top Action Bar Buttons
  elements.btnSave.addEventListener("click", saveTimetableToSheets);
  elements.btnPrint.addEventListener("click", () => window.print());
  elements.btnCopyTimetable.addEventListener("click", openCopyModal);
  
  // Copy Modal Handlers
  elements.btnCloseCopy.addEventListener("click", () => closeModal(elements.modalCopy));
  elements.selectCopySource.addEventListener("change", () => {
    elements.btnConfirmCopy.disabled = !elements.selectCopySource.value;
  });
  elements.btnConfirmCopy.addEventListener("click", executeCopyTimetable);
  
  // Cell Edit Modal Handlers
  elements.btnCloseCellEdit.addEventListener("click", () => closeModal(elements.modalCellEdit));
  elements.cellSelectClass.addEventListener("change", handleCellClassChangeInDialog);
  elements.cellSelectSubject.addEventListener("change", handleSubjectSelectionInDialog);
  elements.chkTwoFaculty.addEventListener("change", toggleSecondFacultyField);
  
  elements.cellSelectFaculty1.addEventListener("change", checkForSchedulingClashes);
  elements.cellSelectFaculty2.addEventListener("change", checkForSchedulingClashes);
  
  elements.btnClearCell.addEventListener("click", clearCellInGrid);
  elements.btnApplyCell.addEventListener("click", applyCellEditToGrid);
  
  // Global modal overlay click to close
  window.addEventListener("click", (e) => {
    if (e.target.classList.contains("modal")) {
      closeModal(e.target);
    }
  });
}

// --- MODE SWITCH UTILITY ---
function switchMode(mode) {
  if (activeFilters.mode === mode) return;
  activeFilters.mode = mode;
  
  if (mode === "class") {
    elements.tabClassMode.classList.add("active");
    elements.tabTeacherMode.classList.remove("active");
    elements.classFilterGroup.classList.remove("hide");
    elements.teacherFilterGroup.classList.add("hide");
  } else {
    elements.tabClassMode.classList.remove("active");
    elements.tabTeacherMode.classList.add("active");
    elements.classFilterGroup.classList.add("hide");
    elements.teacherFilterGroup.classList.remove("hide");
  }
  
  // Reset active selections
  elements.selectClass.value = "";
  elements.selectTeacher.value = "";
  elements.btnLoadClass.disabled = true;
  
  // Reset grids
  elements.welcomeScreen.classList.remove("hide");
  elements.timetableGridWrapper.classList.add("hide");
  
  // Disable actions
  elements.btnSave.disabled = true;
  elements.btnPrint.disabled = true;
  elements.btnCopyTimetable.disabled = true;
  
  handleFilterChange();
}

// --- SYSTEM MODE CONTROL ---
function updateSystemMode(isOnline) {
  if (isOnline) {
    elements.badgeStatus.textContent = "MMCTT Connected";
    elements.badgeStatus.className = "badge badge-success";
  } else {
    elements.badgeStatus.textContent = "MMCTT Offline";
    elements.badgeStatus.className = "badge badge-neutral";
  }
}

// --- DATABASE FETCHING (Google Sheets Integration) ---
async function fetchDataFromGoogleSheets() {
  if (!config.apiUrl) return;
  
  showToast("Connecting to Google Sheets...", "warning");
  
  try {
    const response = await fetch(config.apiUrl);
    const json = await response.json();
    
    if (json.status === "success") {
      db.classes = json.data.classes || [];
      db.faculty = json.data.faculty || [];
      db.subjects = json.data.subjects || [];
      db.subjectfaculty = json.data.subjectfaculty || [];
      db.timetable = json.data.timetable || [];
      db.departments = json.data.departments || [];
      
      updateSystemMode(true);
      populateDepartmentDropdown();
      showToast("Synced database with Google Sheets!", "success");
    } else {
      throw new Error(json.message);
    }
  } catch (error) {
    console.error("Sheets connection failed:", error);
    updateSystemMode(false);
    showToast("Sync Failed: " + error.message, "error");
    
    // Fall back to offline mock database
    db = { ...MOCK_DATABASE };
    populateDepartmentDropdown();
  }
}

// --- FILTER CONTROLS ---
function populateDepartmentDropdown() {
  let departments = [];
  
  // Try loading from optional departments sheet first
  if (db.departments && db.departments.length > 0) {
    const firstRowObj = db.departments[0];
    const keys = Object.keys(firstRowObj);
    if (keys.length > 0) {
      const firstColumnHeader = keys[0].trim();
      
      // If the header itself is a department name (like "Computer Science")
      if (firstColumnHeader && 
          firstColumnHeader.toLowerCase() !== "department name" && 
          firstColumnHeader.toLowerCase() !== "department" && 
          firstColumnHeader.toLowerCase() !== "dept" &&
          firstColumnHeader.toLowerCase() !== "deptname" &&
          firstColumnHeader.toLowerCase() !== "name") {
        departments.push(firstColumnHeader);
      }
      
      // Get the row values from this first column
      db.departments.forEach(row => {
        if (!row) return;
        const val = String(row[keys[0]]).trim();
        if (val && val.toLowerCase() !== "major" && val.toLowerCase() !== "minor") {
          departments.push(val);
        }
      });
    }
  } else {
    // Fallback: collect unique departments from classes and faculty lists
    if (db.classes) {
      db.classes.forEach(c => {
        const val = getVal(c, "Department", "Dept");
        if (val) departments.push(val);
      });
    }
    if (db.faculty) {
      db.faculty.forEach(f => {
        const val = getVal(f, "Department", "Dept");
        if (val) departments.push(val);
      });
    }
  }
  
  // Deduplicate list, clean and sort
  departments = [...new Set(departments)];
  departments = departments.filter(d => d && d.trim() !== "").sort();
  
  // Store selected department before clearing
  const selectedDept = elements.selectDept.value;
  
  elements.selectDept.innerHTML = '<option value="">Select Department</option>';
  departments.forEach(dept => {
    const option = document.createElement("option");
    option.value = dept;
    option.textContent = dept;
    elements.selectDept.appendChild(option);
  });
  
  // Reapply previous value if it still exists
  if (departments.includes(selectedDept)) {
    elements.selectDept.value = selectedDept;
  }
  
  handleFilterChange();
}

function handleFilterChange() {
  const ay = elements.selectAY.value;
  const sem = elements.selectSem.value;
  const dept = elements.selectDept.value;
  
  // Reset buttons if filters are incomplete
  if (!sem || !dept) {
    elements.selectClass.innerHTML = '<option value="">Select Class</option>';
    elements.selectClass.disabled = true;
    elements.selectTeacher.innerHTML = '<option value="">Select Teacher</option>';
    elements.selectTeacher.disabled = true;
    elements.btnLoadClass.disabled = true;
    return;
  }
  
  if (activeFilters.mode === "class") {
    // Filter classes by Semester and Department
    const filteredClasses = db.classes.filter(c => getVal(c, "Semester") === sem && getVal(c, "Department", "Dept") === dept);
    
    elements.selectClass.innerHTML = '<option value="">Select Class</option>';
    if (filteredClasses.length > 0) {
      filteredClasses.forEach(c => {
        const option = document.createElement("option");
        option.value = getVal(c, "Class ID", "ClassID", "ID");
        option.textContent = `${getVal(c, "Short Name", "ShortName")} (${getVal(c, "Class Name", "ClassName")})`;
        elements.selectClass.appendChild(option);
      });
      elements.selectClass.disabled = false;
    } else {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "No classes found";
      elements.selectClass.appendChild(option);
      elements.selectClass.disabled = true;
    }
    
    elements.btnLoadClass.disabled = !elements.selectClass.value;
  } else {
    // Filter teachers by Department
    const filteredTeachers = db.faculty.filter(f => getVal(f, "Department", "Dept") === dept);
    
    elements.selectTeacher.innerHTML = '<option value="">Select Teacher</option>';
    if (filteredTeachers.length > 0) {
      filteredTeachers.forEach(f => {
        const option = document.createElement("option");
        const fId = getVal(f, "Faculty ID", "FacultyID", "ID");
        const fName = getVal(f, "Faculty Name", "FacultyName", "Name");
        option.value = fId;
        option.textContent = `${fName} (${fId})`;
        elements.selectTeacher.appendChild(option);
      });
      elements.selectTeacher.disabled = false;
    } else {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "No teachers found in department";
      elements.selectTeacher.appendChild(option);
      elements.selectTeacher.disabled = true;
    }
    
    elements.btnLoadClass.disabled = !elements.selectTeacher.value;
  }
}

// --- LOADING TIMETABLE GRID ---
function loadTimetableForSelectedClass() {
  activeFilters.academicYear = elements.selectAY.value;
  activeFilters.semester = elements.selectSem.value;
  activeFilters.department = elements.selectDept.value;
  
  let targetName = "";
  gridState = {};
  
  if (activeFilters.mode === "class") {
    activeFilters.classId = elements.selectClass.value;
    const classObj = db.classes.find(c => getVal(c, "Class ID", "ClassID", "ID") === activeFilters.classId);
    targetName = classObj ? getVal(classObj, "Short Name", "ShortName") : activeFilters.classId;
    
    // Parse timetable entries
    const classTimetableEntries = db.timetable.filter(t => 
      getVal(t, "Academic Year", "AcademicYear", "Year") === activeFilters.academicYear &&
      getVal(t, "Semester") === activeFilters.semester &&
      getVal(t, "Class", "ClassID", "Class ID") === activeFilters.classId
    );
    
    classTimetableEntries.forEach(entry => {
      const day = getVal(entry, "Day");
      const dbPeriod = getVal(entry, "Period");
      const periodIdx = PERIOD_DATABASE_MAP.indexOf(dbPeriod);
      
      if (periodIdx !== -1) {
        const subjectCode = getVal(entry, "Subject Code", "SubjectCode");
        if (subjectCode && String(subjectCode).trim() !== "") {
          let facultyList = [];
          const entryFaculty = getVal(entry, "Faculty");
          if (entryFaculty) {
            const items = String(entryFaculty).split(",").map(f => f.trim()).filter(f => f !== "");
            // Map names back to IDs if stored as names
            facultyList = items.map(item => {
              const matchedFaculty = db.faculty.find(f => getVal(f, "Faculty Name", "FacultyName", "Name").toLowerCase() === item.toLowerCase());
              return matchedFaculty ? getVal(matchedFaculty, "Faculty ID", "FacultyID", "ID") : item;
            });
          }
          
          gridState[`${day}_${periodIdx}`] = {
            subjectCode: subjectCode,
            faculty: facultyList
          };
        }
      }
    });
  } else {
    activeFilters.teacherId = elements.selectTeacher.value;
    const facObj = db.faculty.find(f => getVal(f, "Faculty ID", "FacultyID", "ID") === activeFilters.teacherId);
    targetName = facObj ? getVal(facObj, "Faculty Name", "FacultyName", "Name") : activeFilters.teacherId;
    const activeTeacherName = facObj ? getVal(facObj, "Faculty Name", "FacultyName", "Name").toLowerCase() : "";
    
    // Parse timetable entries for this teacher (match either by Name or ID)
    const teacherTimetableEntries = db.timetable.filter(t => {
      const matchAY = getVal(t, "Academic Year", "AcademicYear", "Year") === activeFilters.academicYear;
      const matchSem = getVal(t, "Semester") === activeFilters.semester;
      if (!matchAY || !matchSem) return false;
      
      const rowFacultyVal = String(getVal(t, "Faculty")).toLowerCase();
      const rowFacultyItems = rowFacultyVal.split(",").map(item => item.trim());
      
      return rowFacultyItems.includes(activeTeacherName) || rowFacultyItems.includes(activeFilters.teacherId.toLowerCase());
    });
    
    teacherTimetableEntries.forEach(entry => {
      const day = getVal(entry, "Day");
      const dbPeriod = getVal(entry, "Period");
      const periodIdx = PERIOD_DATABASE_MAP.indexOf(dbPeriod);
      
      if (periodIdx !== -1) {
        const subjectCode = getVal(entry, "Subject Code", "SubjectCode");
        if (subjectCode && String(subjectCode).trim() !== "") {
          gridState[`${day}_${periodIdx}`] = {
            subjectCode: subjectCode,
            classId: getVal(entry, "Class", "ClassID", "Class ID")
          };
        }
      }
    });
  }
  
  elements.lblCurrentClass.textContent = `${activeFilters.academicYear} | Semester ${activeFilters.semester} | ${targetName}`;
  
  // Render grid table UI
  renderTimetableGrid();
  
  // Toggle Visibility
  elements.welcomeScreen.classList.add("hide");
  elements.timetableGridWrapper.classList.remove("hide");
  
  // Enable action buttons
  elements.btnSave.disabled = false;
  elements.btnPrint.disabled = false;
  elements.btnCopyTimetable.disabled = false;
  
  showToast(`Loaded timetable for ${targetName}`, "success");
}

function renderTimetableGrid() {
  elements.timetableTbody.innerHTML = "";
  
  DAYS.forEach(day => {
    const tr = document.createElement("tr");
    
    // Day Label column
    const tdDay = document.createElement("td");
    tdDay.className = "day-header";
    tdDay.textContent = day;
    tr.appendChild(tdDay);
    
    // Periods 1 to 6
    for (let periodIdx = 0; periodIdx < 6; periodIdx++) {
      const tdCell = document.createElement("td");
      
      // Dynamic div representing interactive cell
      const cellDiv = document.createElement("div");
      cellDiv.className = "timetable-cell";
      cellDiv.dataset.day = day;
      cellDiv.dataset.periodIndex = periodIdx;
      
      const state = gridState[`${day}_${periodIdx}`];
      
      if (state && state.subjectCode) {
        cellDiv.classList.add("assigned");
        
        // Lookup Subject Details
        const subjectObj = db.subjects.find(s => getVal(s, "Subject Code", "SubjectCode") === state.subjectCode);
        const subjectName = subjectObj ? getVal(subjectObj, "Subject Name", "SubjectName") : "Unknown Subject";
        
        // Subject Code label
        const codeSpan = document.createElement("span");
        codeSpan.className = "cell-subject-code";
        codeSpan.textContent = state.subjectCode;
        cellDiv.appendChild(codeSpan);
        
        // Subject Name label
        const nameSpan = document.createElement("span");
        nameSpan.className = "cell-subject-name";
        nameSpan.textContent = subjectName;
        cellDiv.appendChild(nameSpan);
        
        // Faculty Badges (Class Mode) or Class Badges (Teacher Mode)
        let hasConflict = false;
        let conflictDetails = [];
        
        if (activeFilters.mode === "class") {
          const facultyContainer = document.createElement("div");
          facultyContainer.className = "cell-faculty-container";
          
          state.faculty.forEach(facultyId => {
            const facObj = db.faculty.find(f => getVal(f, "Faculty ID", "FacultyID", "ID") === facultyId);
            const facName = facObj ? getVal(facObj, "Faculty Name", "FacultyName", "Name") : facultyId;
            
            const badge = document.createElement("span");
            badge.className = "cell-faculty-badge";
            badge.textContent = getInitials(facName);
            badge.title = facName;
            facultyContainer.appendChild(badge);
            
            const conflict = checkGlobalConflict(day, periodIdx, facultyId);
            if (conflict) {
              hasConflict = true;
              conflictDetails.push(`${facName} is also teaching ${conflict.className} (${conflict.subject})`);
            }
          });
          
          cellDiv.appendChild(facultyContainer);
        } else {
          const classContainer = document.createElement("div");
          classContainer.className = "cell-faculty-container";
          
          const classObj = db.classes.find(c => getVal(c, "Class ID", "ClassID", "ID") === state.classId);
          const className = classObj ? getVal(classObj, "Short Name", "ShortName") : state.classId;
          
          const badge = document.createElement("span");
          badge.className = "cell-faculty-badge";
          badge.textContent = className;
          badge.title = classObj ? getVal(classObj, "Class Name", "ClassName") : state.classId;
          badge.style.borderColor = "var(--accent-secondary)";
          badge.style.color = "var(--text-main)";
          classContainer.appendChild(badge);
          
          cellDiv.appendChild(classContainer);
        }
        
        // Visual clash indicator
        if (hasConflict) {
          cellDiv.classList.add("clashed");
          cellDiv.title = conflictDetails.join("\n");
          
          const clashIcon = document.createElement("i");
          clashIcon.className = "cell-clash-indicator";
          clashIcon.setAttribute("data-lucide", "alert-triangle");
          cellDiv.appendChild(clashIcon);
        }
        
      } else {
        // Empty Cell layout
        const addBtn = document.createElement("div");
        addBtn.className = "cell-empty-btn";
        addBtn.innerHTML = '<i data-lucide="plus-circle" style="width:16px;height:16px;"></i> Assign';
        cellDiv.appendChild(addBtn);
      }
      
      // Cell Click event to edit
      cellDiv.addEventListener("click", () => openCellEditModal(day, periodIdx));
      
      tdCell.appendChild(cellDiv);
      tr.appendChild(tdCell);
    }
    
    elements.timetableTbody.appendChild(tr);
  });
  
  // Refresh newly inserted icons
  lucide.createIcons();
}

// Utility: extract name initials (e.g. Dr. Susan George -> S.G.)
function getInitials(name) {
  if (!name) return "";
  let cleanName = name.replace(/Dr\.|Prof\.|Mr\.|Mrs\.|Ms\./g, "").trim();
  const parts = cleanName.split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// --- CELL EDIT POPUP MODAL ---
function openCellEditModal(day, periodIndex) {
  currentEditingCell.day = day;
  currentEditingCell.periodIndex = periodIndex;
  
  // Display context titles
  elements.cellEditSubtitle.textContent = `${day} - Hour ${periodIndex} (${getTimeString(periodIndex)})`;
  
  // Find target department (use selected teacher's department in Teacher Mode)
  let subjectDept = activeFilters.department;
  if (activeFilters.mode === "teacher") {
    const teacherObj = db.faculty.find(f => getVal(f, "Faculty ID", "FacultyID", "ID") === activeFilters.teacherId);
    if (teacherObj) {
      subjectDept = getVal(teacherObj, "Department", "Dept");
    }
  }
  
  // 1. Populate Subject options filtered by current Department and Semester
  const filteredSubjects = db.subjects.filter(s => 
    getVal(s, "Department", "Dept") === subjectDept && 
    getVal(s, "Semester") === activeFilters.semester
  );
  
  elements.cellSelectSubject.innerHTML = '<option value="">-- Clear Hour (Free Hour) --</option>';
  filteredSubjects.forEach(s => {
    const option = document.createElement("option");
    const sCode = getVal(s, "Subject Code", "SubjectCode");
    const sName = getVal(s, "Subject Name", "SubjectName");
    const sCat = getVal(s, "Category", "Course Category");
    option.value = sCode;
    option.textContent = `[${sCode}] ${sName} (${sCat})`;
    elements.cellSelectSubject.appendChild(option);
  });
  
  const state = gridState[`${day}_${periodIndex}`];
  
  // Always hide class group in modal (resolved implicitly now)
  elements.cellClassGroup.classList.add("hide");
  
  if (activeFilters.mode === "class") {
    elements.facultyAssignmentSection.classList.remove("hide");
    
    // Load current state if assigned
    if (state && state.subjectCode) {
      elements.cellSelectSubject.value = state.subjectCode;
      
      populateFacultySelectors(state.subjectCode);
      
      if (state.faculty.length > 0) {
        elements.cellSelectFaculty1.value = state.faculty[0];
      } else {
        elements.cellSelectFaculty1.value = "";
      }
      
      if (state.faculty.length > 1) {
        elements.chkTwoFaculty.checked = true;
        elements.faculty2Wrapper.classList.remove("hide");
        elements.cellSelectFaculty2.value = state.faculty[1];
      } else {
        elements.chkTwoFaculty.checked = false;
        elements.faculty2Wrapper.classList.add("hide");
        elements.cellSelectFaculty2.value = "";
      }
    } else {
      // Empty cell reset
      elements.cellSelectSubject.value = "";
      elements.chkTwoFaculty.checked = false;
      elements.faculty2Wrapper.classList.add("hide");
      elements.cellSelectFaculty1.innerHTML = '<option value="">Select Primary Teacher</option>';
      elements.cellSelectFaculty2.innerHTML = '<option value="">Select Secondary Teacher</option>';
    }
  } else {
    elements.facultyAssignmentSection.classList.add("hide");
    
    // Load state
    if (state && state.subjectCode) {
      elements.cellSelectSubject.value = state.subjectCode;
    } else {
      elements.cellSelectSubject.value = "";
    }
  }
  
  // Hide warning box on open
  elements.dialogClashWarning.classList.add("hide");
  
  openModal(elements.modalCellEdit);
}

function handleSubjectSelectionInDialog() {
  const subjectCode = elements.cellSelectSubject.value;
  
  if (!subjectCode) {
    elements.facultyAssignmentSection.classList.add("hide");
    elements.dialogClashWarning.classList.add("hide");
    return;
  }
  
  if (activeFilters.mode === "class") {
    elements.facultyAssignmentSection.classList.remove("hide");
    populateFacultySelectors(subjectCode);
    checkForSchedulingClashes();
  } else {
    elements.facultyAssignmentSection.classList.add("hide");
    elements.dialogClashWarning.classList.add("hide");
  }
}

function populateFacultySelectors(subjectCode) {
  // Populate with all teachers in this department, sorted alphabetically by name
  const filteredFaculty = db.faculty
    .filter(f => getVal(f, "Department", "Dept") === activeFilters.department)
    .sort((a, b) => {
      const nameA = getVal(a, "Faculty Name", "FacultyName", "Name").toLowerCase();
      const nameB = getVal(b, "Faculty Name", "FacultyName", "Name").toLowerCase();
      return nameA.localeCompare(nameB);
    });
  
  // Fill Primary Selector
  elements.cellSelectFaculty1.innerHTML = '<option value="">Select Primary Teacher</option>';
  filteredFaculty.forEach(f => {
    const option = document.createElement("option");
    const fId = getVal(f, "Faculty ID", "FacultyID", "ID");
    const fName = getVal(f, "Faculty Name", "FacultyName", "Name");
    option.value = fId;
    option.textContent = `${fName} (${fId})`;
    elements.cellSelectFaculty1.appendChild(option);
  });
  
  // Fill Secondary Selector
  elements.cellSelectFaculty2.innerHTML = '<option value="">Select Secondary Teacher</option>';
  filteredFaculty.forEach(f => {
    const option = document.createElement("option");
    const fId = getVal(f, "Faculty ID", "FacultyID", "ID");
    const fName = getVal(f, "Faculty Name", "FacultyName", "Name");
    option.value = fId;
    option.textContent = `${fName} (${fId})`;
    elements.cellSelectFaculty2.appendChild(option);
  });
}

function toggleSecondFacultyField() {
  if (elements.chkTwoFaculty.checked) {
    elements.faculty2Wrapper.classList.remove("hide");
  } else {
    elements.faculty2Wrapper.classList.add("hide");
    elements.cellSelectFaculty2.value = "";
  }
  checkForSchedulingClashes();
}

// --- REAL-TIME SCHEDULING CONFLICT CHECKER ---
function checkGlobalConflict(day, periodIdx, facultyId) {
  if (!facultyId) return null;
  
  const periodDbStr = PERIOD_DATABASE_MAP[periodIdx];
  
  // Filter global database for a match
  const clash = db.timetable.find(t => 
    getVal(t, "Academic Year", "AcademicYear", "Year") === activeFilters.academicYear &&
    getVal(t, "Day") === day &&
    getVal(t, "Period") === periodDbStr &&
    getVal(t, "Class", "ClassID", "Class ID") !== activeFilters.classId &&
    String(getVal(t, "Faculty")).split(",").map(f => f.trim()).includes(facultyId)
  );
  
  if (clash) {
    const clashClassId = getVal(clash, "Class", "ClassID", "Class ID");
    const matchingClassObj = db.classes.find(c => getVal(c, "Class ID", "ClassID", "ID") === clashClassId);
    const className = matchingClassObj ? getVal(matchingClassObj, "Short Name", "ShortName") : clashClassId;
    
    return {
      className: className,
      subject: getVal(clash, "Subject Code", "SubjectCode")
    };
  }
  
  return null;
}

function checkGlobalClassConflict(day, periodIdx, classId) {
  if (!classId) return null;
  
  const periodDbStr = PERIOD_DATABASE_MAP[periodIdx];
  
  const clash = db.timetable.find(t => 
    getVal(t, "Academic Year", "AcademicYear", "Year") === activeFilters.academicYear &&
    getVal(t, "Semester") === activeFilters.semester &&
    getVal(t, "Day") === day &&
    getVal(t, "Period") === periodDbStr &&
    getVal(t, "Class", "ClassID", "Class ID") === classId &&
    !String(getVal(t, "Faculty")).split(",").map(f => f.trim()).includes(activeFilters.teacherId)
  );
  
  if (clash) {
    const facId = String(getVal(clash, "Faculty")).split(",")[0].trim();
    const facObj = db.faculty.find(f => getVal(f, "Faculty ID", "FacultyID", "ID") === facId);
    const facName = facObj ? getVal(facObj, "Faculty Name", "FacultyName", "Name") : facId;
    return {
      teacherName: facName,
      subject: getVal(clash, "Subject Code", "SubjectCode")
    };
  }
  
  return null;
}

// Warn HOD in edit window
function checkForSchedulingClashes() {
  if (activeFilters.mode === "teacher") {
    elements.dialogClashWarning.classList.add("hide");
    return;
  }

  const f1 = elements.cellSelectFaculty1.value;
  const f2 = elements.cellSelectFaculty2.value;
  const day = currentEditingCell.day;
  const periodIdx = currentEditingCell.periodIndex;
  
  let conflicts = [];
  
  const clash1 = checkGlobalConflict(day, periodIdx, f1);
  if (clash1) {
    const facObj = db.faculty.find(f => getVal(f, "Faculty ID", "FacultyID", "ID") === f1);
    const facName = facObj ? getVal(facObj, "Faculty Name", "FacultyName", "Name") : f1;
    conflicts.push(`<b>${facName}</b> is already assigned to <b>${clash1.className}</b> (${clash1.subject})`);
  }
  
  if (elements.chkTwoFaculty.checked && f2) {
    const clash2 = checkGlobalConflict(day, periodIdx, f2);
    if (clash2) {
      const facObj = db.faculty.find(f => getVal(f, "Faculty ID", "FacultyID", "ID") === f2);
      const facName = facObj ? getVal(facObj, "Faculty Name", "FacultyName", "Name") : f2;
      conflicts.push(`<b>${facName}</b> is already assigned to <b>${clash2.className}</b> (${clash2.subject})`);
    }
  }
  
  if (conflicts.length > 0) {
    elements.dialogClashMsg.innerHTML = conflicts.join("<br><br>");
    elements.dialogClashWarning.classList.remove("hide");
  } else {
    elements.dialogClashWarning.classList.add("hide");
  }
}

function handleCellClassChangeInDialog() {
  checkForSchedulingClashes();
}

// --- APPLY CELL CHANGES ---
function applyCellEditToGrid() {
  const day = currentEditingCell.day;
  const periodIdx = currentEditingCell.periodIndex;
  const subjectCode = elements.cellSelectSubject.value;
  
  if (!subjectCode) {
    // Empty cell representation
    delete gridState[`${day}_${periodIdx}`];
  } else {
    if (activeFilters.mode === "class") {
      const f1 = elements.cellSelectFaculty1.value;
      const f2 = elements.cellSelectFaculty2.value;
      
      if (!f1) {
        showToast("Please assign at least a Primary Teacher.", "warning");
        return;
      }
      
      const assignedFaculty = [f1];
      if (elements.chkTwoFaculty.checked && f2) {
        if (f1 === f2) {
          showToast("Primary and Secondary faculty cannot be the same person.", "warning");
          return;
        }
        assignedFaculty.push(f2);
      }
      
      gridState[`${day}_${periodIdx}`] = {
        subjectCode: subjectCode,
        faculty: assignedFaculty
      };
    } else {
      // Resolve Class ID matching the teacher's department and selected semester
      const teacherObj = db.faculty.find(f => getVal(f, "Faculty ID", "FacultyID", "ID") === activeFilters.teacherId);
      const teacherDept = teacherObj ? getVal(teacherObj, "Department", "Dept") : activeFilters.department;
      
      const matchingClass = db.classes.find(c => 
        getVal(c, "Department", "Dept") === teacherDept && 
        getVal(c, "Semester") === activeFilters.semester
      );
      
      const implicitClassId = matchingClass ? getVal(matchingClass, "Class ID", "ClassID", "ID") : "";
      
      gridState[`${day}_${periodIdx}`] = {
        subjectCode: subjectCode,
        classId: implicitClassId
      };
    }
  }
  
  renderTimetableGrid();
  closeModal(elements.modalCellEdit);
}

function clearCellInGrid() {
  const day = currentEditingCell.day;
  const periodIdx = currentEditingCell.periodIndex;
  
  delete gridState[`${day}_${periodIdx}`];
  renderTimetableGrid();
  closeModal(elements.modalCellEdit);
}

// --- CLONE/COPY TIMETABLE ---
function openCopyModal() {
  const modalLabel = document.querySelector("#modal-copy .modal-desc");
  const modalTitle = document.querySelector("#modal-copy h3");
  
  if (activeFilters.mode === "class") {
    modalTitle.innerHTML = '<i data-lucide="copy"></i> Copy Class Timetable';
    modalLabel.textContent = "Copy another class's timetable into the current class. This will overwrite the unsaved grid cells below.";
    
    // Populate copy dropdown with other classes in the SAME department
    const otherClasses = db.classes.filter(c => 
      getVal(c, "Department", "Dept") === activeFilters.department && 
      getVal(c, "Class ID", "ClassID", "ID") !== activeFilters.classId
    );
    
    elements.selectCopySource.innerHTML = '<option value="">Select Source Class</option>';
    if (otherClasses.length > 0) {
      otherClasses.forEach(c => {
        const option = document.createElement("option");
        option.value = getVal(c, "Class ID", "ClassID", "ID");
        option.textContent = `${getVal(c, "Short Name", "ShortName")} (${getVal(c, "Class Name", "ClassName")})`;
        elements.selectCopySource.appendChild(option);
      });
      elements.selectCopySource.disabled = false;
    } else {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "No sibling classes found in department";
      elements.selectCopySource.appendChild(option);
      elements.selectCopySource.disabled = true;
    }
  } else {
    modalTitle.innerHTML = '<i data-lucide="copy"></i> Copy Teacher Timetable';
    modalLabel.textContent = "Copy another teacher's timetable into the current teacher. This will overwrite the unsaved grid cells below.";
    
    // Populate copy dropdown with other teachers in the SAME department
    const otherTeachers = db.faculty.filter(f => 
      getVal(f, "Department", "Dept") === activeFilters.department && 
      getVal(f, "Faculty ID", "FacultyID", "ID") !== activeFilters.teacherId
    );
    
    elements.selectCopySource.innerHTML = '<option value="">Select Source Teacher</option>';
    if (otherTeachers.length > 0) {
      otherTeachers.forEach(f => {
        const option = document.createElement("option");
        const fId = getVal(f, "Faculty ID", "FacultyID", "ID");
        const fName = getVal(f, "Faculty Name", "FacultyName", "Name");
        option.value = fId;
        option.textContent = `${fName} (${fId})`;
        elements.selectCopySource.appendChild(option);
      });
      elements.selectCopySource.disabled = false;
    } else {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "No other teachers found in department";
      elements.selectCopySource.appendChild(option);
      elements.selectCopySource.disabled = true;
    }
  }
  
  elements.btnConfirmCopy.disabled = true;
  openCopyModalOverlay();
}

function openCopyModalOverlay() {
  openModal(elements.modalCopy);
  lucide.createIcons();
}

function executeCopyTimetable() {
  const sourceId = elements.selectCopySource.value;
  if (!sourceId) return;
  
  let sourceEntries = [];
  
  if (activeFilters.mode === "class") {
    // Find entries belonging to source class
    sourceEntries = db.timetable.filter(t => 
      getVal(t, "Academic Year", "AcademicYear", "Year") === activeFilters.academicYear &&
      getVal(t, "Semester") === activeFilters.semester &&
      getVal(t, "Class", "ClassID", "Class ID") === sourceId
    );
  } else {
    // Find entries belonging to source teacher
    sourceEntries = db.timetable.filter(t => 
      getVal(t, "Academic Year", "AcademicYear", "Year") === activeFilters.academicYear &&
      getVal(t, "Semester") === activeFilters.semester &&
      String(getVal(t, "Faculty")).split(",").map(f => f.trim()).includes(sourceId)
    );
  }
  
  if (sourceEntries.length === 0) {
    showToast("Selected source has no saved timetable entries to copy.", "warning");
    closeModal(elements.modalCopy);
    return;
  }
  
  // Overwrite local grid state
  gridState = {};
  sourceEntries.forEach(entry => {
    const day = getVal(entry, "Day");
    const dbPeriod = getVal(entry, "Period");
    const periodIdx = PERIOD_DATABASE_MAP.indexOf(dbPeriod);
    
    if (periodIdx !== -1) {
      if (activeFilters.mode === "class") {
        let facultyList = [];
        const entryFaculty = getVal(entry, "Faculty");
        if (entryFaculty) {
          const items = String(entryFaculty).split(",").map(f => f.trim()).filter(f => f !== "");
          facultyList = items.map(item => {
            const matchedFaculty = db.faculty.find(f => getVal(f, "Faculty Name", "FacultyName", "Name").toLowerCase() === item.toLowerCase());
            return matchedFaculty ? getVal(matchedFaculty, "Faculty ID", "FacultyID", "ID") : item;
          });
        }
        gridState[`${day}_${periodIdx}`] = {
          subjectCode: getVal(entry, "Subject Code", "SubjectCode"),
          faculty: facultyList
        };
      } else {
        gridState[`${day}_${periodIdx}`] = {
          subjectCode: getVal(entry, "Subject Code", "SubjectCode"),
          classId: getVal(entry, "Class", "ClassID", "Class ID")
        };
      }
    }
  });
  
  renderTimetableGrid();
  closeModal(elements.modalCopy);
  showToast("Copied layout. Remember to review conflicts and click Save.", "success");
}

// --- SAVE TIMETABLE ---
async function saveTimetableToSheets() {
  elements.btnSave.disabled = true;
  elements.btnSave.innerHTML = '<i class="spin-icon" data-lucide="loader-2"></i> Saving...';
  lucide.createIcons();
  
  // Pack grid data into post payload (all 30 slots)
  const entriesToSend = [];
  
  DAYS.forEach(day => {
    for (let periodIdx = 0; periodIdx < 6; periodIdx++) {
      const periodDbStr = PERIOD_DATABASE_MAP[periodIdx];
      const cell = gridState[`${day}_${periodIdx}`];
      
      let subjectCode = "";
      let subjectName = "";
      let faculty = "";
      let classId = "";
      
      if (cell && cell.subjectCode) {
        subjectCode = cell.subjectCode;
        const subjectObj = db.subjects.find(s => getVal(s, "Subject Code", "SubjectCode") === cell.subjectCode);
        subjectName = subjectObj ? getVal(subjectObj, "Subject Name", "SubjectName") : "";
        
        if (activeFilters.mode === "class") {
          const facultyNames = cell.faculty.map(fId => {
            const facObj = db.faculty.find(f => getVal(f, "Faculty ID", "FacultyID", "ID") === fId);
            return facObj ? getVal(facObj, "Faculty Name", "FacultyName", "Name") : fId;
          });
          faculty = facultyNames.join(", ");
          classId = activeFilters.classId;
        } else {
          const facObj = db.faculty.find(f => getVal(f, "Faculty ID", "FacultyID", "ID") === activeFilters.teacherId);
          faculty = facObj ? getVal(facObj, "Faculty Name", "FacultyName", "Name") : activeFilters.teacherId;
          classId = cell.classId;
        }
      } else {
        // Empty slot defaults
        if (activeFilters.mode === "class") {
          classId = activeFilters.classId;
        } else {
          const facObj = db.faculty.find(f => getVal(f, "Faculty ID", "FacultyID", "ID") === activeFilters.teacherId);
          faculty = facObj ? getVal(facObj, "Faculty Name", "FacultyName", "Name") : activeFilters.teacherId;
          
          // Resolve implicit Class ID matching the teacher's department and selected semester for empty rows
          const teacherDept = facObj ? getVal(facObj, "Department", "Dept") : activeFilters.department;
          const matchingClass = db.classes.find(c => 
            getVal(c, "Department", "Dept") === teacherDept && 
            getVal(c, "Semester") === activeFilters.semester
          );
          classId = matchingClass ? getVal(matchingClass, "Class ID", "ClassID", "ID") : "";
        }
      }
      
      entriesToSend.push({
        day: day,
        period: periodDbStr,
        subjectCode: subjectCode,
        subjectName: subjectName,
        faculty: faculty,
        classId: classId
      });
    }
  });
  
  const facObj = db.faculty.find(f => getVal(f, "Faculty ID", "FacultyID", "ID") === activeFilters.teacherId);
  const teacherName = facObj ? getVal(facObj, "Faculty Name", "FacultyName", "Name") : activeFilters.teacherId;
  
  const payload = {
    academicYear: activeFilters.academicYear,
    semester: activeFilters.semester,
    mode: activeFilters.mode,
    targetId: (activeFilters.mode === "class") ? activeFilters.classId : teacherName,
    entries: entriesToSend
  };
  
  if (config.apiUrl) {
    try {
      const response = await fetch(config.apiUrl, {
        method: "POST",
        mode: "cors",
        headers: {
          "Content-Type": "text/plain"
        },
        body: JSON.stringify(payload)
      });
      
      const json = await response.json();
      
      if (json.status === "success") {
        showToast("Timetable saved successfully to Google Sheets!", "success");
        
        clearLocalTimetableMemory();
        
        entriesToSend.forEach(entry => {
          db.timetable.push({
            "Academic Year": activeFilters.academicYear,
            "Semester": activeFilters.semester,
            "Class": entry.classId,
            "Day": entry.day,
            "Period": entry.period,
            "Subject Code": entry.subjectCode,
            "Subject Name": entry.subjectName,
            "Faculty": entry.faculty
          });
        });
        
        renderTimetableGrid();
      } else {
        throw new Error(json.message);
      }
    } catch (error) {
      console.error(error);
      showToast("Sync Error: Saved changes only in local session memory.", "error");
      saveLocallyToMock(entriesToSend);
    }
  } else {
    saveLocallyToMock(entriesToSend);
    showToast("Saved successfully! (Demo Mode - Saved in Session Memory)", "success");
  }
  
  elements.btnSave.disabled = false;
  elements.btnSave.innerHTML = '<i data-lucide="save"></i> Save to Sheets';
  lucide.createIcons();
}

function clearLocalTimetableMemory() {
  const facObj = db.faculty.find(f => getVal(f, "Faculty ID", "FacultyID", "ID") === activeFilters.teacherId);
  const activeTeacherName = facObj ? getVal(facObj, "Faculty Name", "FacultyName", "Name").toLowerCase() : "";
  
  db.timetable = db.timetable.filter(t => {
    const matchAY = getVal(t, "Academic Year", "AcademicYear", "Year") === activeFilters.academicYear;
    const matchSem = getVal(t, "Semester") === activeFilters.semester;
    if (matchAY && matchSem) {
      if (activeFilters.mode === "class") {
        return getVal(t, "Class", "ClassID", "Class ID") !== activeFilters.classId;
      } else {
        const rowFacultyVal = String(getVal(t, "Faculty")).toLowerCase();
        const rowFacultyItems = rowFacultyVal.split(",").map(f => f.trim());
        return !(rowFacultyItems.includes(activeTeacherName) || rowFacultyItems.includes(activeFilters.teacherId.toLowerCase()));
      }
    }
    return true;
  });
}

function saveLocallyToMock(entriesToSend) {
  clearLocalTimetableMemory();
  
  entriesToSend.forEach(entry => {
    db.timetable.push({
      "Academic Year": activeFilters.academicYear,
      "Semester": activeFilters.semester,
      "Class": entry.classId,
      "Day": entry.day,
      "Period": entry.period,
      "Subject Code": entry.subjectCode,
      "Subject Name": entry.subjectName,
      "Faculty": entry.faculty
    });
  });
  
  renderTimetableGrid();
}

// --- DIALOG MODAL HELPERS ---
function openModal(modalEl) {
  modalEl.classList.add("show");
}

function closeModal(modalEl) {
  modalEl.classList.remove("show");
}

// --- TIME FORMATTING HELPER ---
function getTimeString(index) {
  const times = [
    "09:00 - 09:55",
    "10:00 - 10:55",
    "11:05 - 12:00",
    "12:05 - 01:00",
    "01:40 - 02:35",
    "02:45 - 03:40"
  ];
  return times[index] || "";
}

// --- TOAST NOTIFICATIONS ---
function showToast(message, type = "success") {
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  
  let icon = "info";
  if (type === "success") icon = "check-circle";
  if (type === "error") icon = "alert-circle";
  if (type === "warning") icon = "help-circle";
  
  toast.innerHTML = `
    <i data-lucide="${icon}"></i>
    <span class="toast-msg">${message}</span>
  `;
  
  elements.toastContainer.appendChild(toast);
  lucide.createIcons();
  
  setTimeout(() => toast.classList.add("show"), 10);
  
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

# MMCTT - Customization and Editing Guide

This guide explains how to customize and maintain your MMCTT Academic Timetable Portal. It details how to update the dropdown lists, edit your curriculum data, configure the database connection, and tweak the design.

---

## 📂 Customization Overview

MMCTT draws its configuration and data from two sources:
1. **The HTML/CSS/JS Files** (For semesters, application branding, and layout adjustments).
2. **The Connected Google Sheet** (For departments, classes, subjects, teachers, mappings, and saved timetables).

---

## 1. Modifying Semesters (HTML)

The Semester filter choices (e.g., S1, S3, S5) are hardcoded in the frontend layout. To edit them (e.g., adding S2, S4, S6 for even semesters):

1. Open [index.html](file:///C:/Users/HP/.gemini/antigravity/scratch/college-timetable/index.html) in a text editor (like Notepad, VS Code, or Sublime Text).
2. Find the `<select id="select-semester">` block (around line 55). It looks like this:
   ```html
   <select id="select-semester">
     <option value="">Select Semester</option>
     <option value="S1">S1 (Semester 1)</option>
     <option value="S3">S3 (Semester 3)</option>
     <option value="S5">S5 (Semester 5)</option>
   </select>
   ```
3. To add more semesters, add new `<option>` tags. For example, to support even semesters:
   ```html
   <select id="select-semester">
     <option value="">Select Semester</option>
     <option value="S2">S2 (Semester 2)</option>
     <option value="S4">S4 (Semester 4)</option>
     <option value="S6">S6 (Semester 6)</option>
   </select>
   ```
4. Save the file and refresh your browser.

---

## 2. Modifying Core Database Data (Google Sheets)

Most of your MMCTT data is managed dynamically inside your Google Sheet. To edit departments, teachers, classes, and subjects, open your spreadsheet workbook and modify the following tabs:

### 🅰️ Departments
* **Tab Name**: `Departments` (or `departments`)
* **Columns**: `Department Name` (or `Department`)
* **How it affects MMCTT**: The Department dropdown in the sidebar is populated directly from this list. If this tab is empty or missing, MMCTT automatically pulls unique departments from your `Classes` and `Faculty` tabs.

### 🅱️ Classes
* **Tab Name**: `Classes` (or `classes`)
* **Columns**: `Class ID` | `Short Name` | `Class Name` | `Semester` | `Department`
* **How it affects MMCTT**: When a HOD selects a Department and Semester, the sidebar class dropdown filters and displays the matching classes listed here.
* *Example entry*: `C1` | `I BA Eng` | `BA English Literature - Year 1` | `S1` | `English`

### 🆃 Teachers
* **Tab Name**: `Faculty` (or `faculty`)
* **Columns**: `Faculty ID` | `Faculty Name` | `Department`
* **How it affects MMCTT**: Used in **Teacher Mode** to list the teachers in the sidebar. It is also used in **Class Mode** to populate the teacher dropdowns in the period assignment window.
* *Example entry*: `F031` | `Fr. Ajay Antony` | `Malayalam`

### 🆂 Subjects / Courses
* **Tab Name**: `Subjects` (or `subjects`)
* **Columns**: `Subject Code` | `Subject Name` | `Category` | `Department` | `Semester`
* **How it affects MMCTT**: When editing a period hour in the grid, the Subject dropdown lists courses matching the active department and semester from this table.
* *Example entry*: `KU1DSCMAL104` | `സ്ത്രീ അനുഭവമെഴുത്ത്` | `Major` | `Malayalam` | `S1`

### 🅼 Subject-to-Teacher Mappings
* **Tab Name**: `Subjectfaculty` (or `subjectfaculty`)
* **Columns**: `Subject Code` | `Faculty ID`
* **How it affects MMCTT**: In **Class Mode**, when you select a subject in the modal, the website queries this tab to automatically recommend the teachers mapped to this subject. If no mapping exists, it displays all teachers belonging to that department as a fallback.
* *Example entry*: `KU1DSCMAL104` | `F031`

---

## 3. Editing Timetable Grid Hours & Time Slots

The column headers (Hour 0 to Hour 5) and their time ranges are configured in two places:

### 📅 Grid Headers (HTML)
To change the column titles or the time ranges shown in the grid table:
1. Open [index.html](file:///C:/Users/HP/.gemini/antigravity/scratch/college-timetable/index.html) and search for the `<thead>` section (around line 150).
2. Change the text inside the `.period-num` (e.g. `Hour 0`) or `.period-time` (e.g. `09:00 - 09:55`) tags.

### ⏱️ Modal Dialogs (JavaScript)
To change the time ranges displayed inside the edit cell popup:
1. Open [app.js](file:///C:/Users/HP/.gemini/antigravity/scratch/college-timetable/app.js).
2. Search for the `getTimeString` helper function (around line 1365).
3. Update the array elements with your new time ranges (ensure they line up with Hours 0-5 in order):
   ```javascript
   function getTimeString(index) {
     const times = [
       "09:00 - 09:55", // Hour 0
       "10:00 - 10:55", // Hour 1
       "11:05 - 12:00", // Hour 2
       "12:05 - 01:00", // Hour 3
       "01:40 - 02:35", // Hour 4
       "02:45 - 03:40"  // Hour 5
     ];
     return times[index] || "";
   }
   ```

---

## 4. Configuring Database Settings (API Connection)

To toggle between the **Offline Demo Mode** and your live **Google Sheet database**:

1. Click **Database Settings** at the bottom of the sidebar.
2. **To Connect your Sheet**: Paste your deployed Google Apps Script Web App URL into the text box and click **Save Configuration**. The badge at the top will change to **Connected Online**.
3. **To disconnect / use Offline Demo**: Clear the text box and click **Save Configuration**. The app will load simulated offline data for demonstration.

---

## 5. Changing Application Names and Developer Info

* **App Title Branding**: Search and edit `<h1>MMCTT</h1>` in [index.html](file:///C:/Users/HP/.gemini/antigravity/scratch/college-timetable/index.html#L26) to change the main brand name.
* **Developer Wording**: Edit the `div` with the class `.developer-info` in [index.html](file:///C:/Users/HP/.gemini/antigravity/scratch/college-timetable/index.html#L108-L110) to customize your signature info.
* **App Colors and Fonts**: Open [style.css](file:///C:/Users/HP/.gemini/antigravity/scratch/college-timetable/style.css) to modify CSS variables like `--accent-primary` or `--font-family` at the top of the stylesheet.

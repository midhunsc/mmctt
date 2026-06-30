/**
 * College Timetable Google Sheets Backend (Robust In-Place Update Version)
 * 
 * Instructions:
 * 1. Open your Google Sheet ("Time table entry.xlsx" imported into Google Sheets).
 * 2. Click on "Extensions" -> "Apps Script". (DO NOT create a standalone script at script.google.com).
 * 3. Delete any code in Code.gs and paste this code.
 * 4. Click the "Save" (floppy disk) icon.
 * 5. Click "Deploy" -> "New deployment".
 * 6. Click the Cog icon next to "Select type" and select "Web app".
 * 7. Set:
 *    - Description: College Timetable API
 *    - Execute as: Me (your email)
 *    - Who has access: Anyone (This is REQUIRED so the website can communicate with it!)
 * 8. Click "Deploy", authorize Google permissions if asked (click Advanced -> Go to Project to confirm).
 * 9. Copy the "Web app URL" (looks like https://script.google.com/macros/s/.../exec).
 * 10. Paste this URL into the settings of your timetable website.
 */

// GET Handler: Reads database sheets and returns reference data + existing timetables
function doGet(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) {
      throw new Error("Active spreadsheet not found! Make sure you clicked 'Extensions -> Apps Script' from WITHIN your Google Sheet. Do not create a standalone script at script.google.com.");
    }
    
    // Verify required sheets exist (case-insensitive and space-insensitive search)
    const requiredSheets = ["Classes", "Faculty", "Subjects", "Subjectfaculty", "Timetable"];
    for (let s of requiredSheets) {
      if (!getSheetCaseInsensitive(ss, s)) {
        throw new Error("Required sheet '" + s + "' not found! Please check your spreadsheet tabs and ensure you have tabs named: Classes, Faculty, Subjects, Subjectfaculty, Timetable");
      }
    }
    
    const responseData = {
      classes: getSheetData(ss, "Classes"),
      faculty: getSheetData(ss, "Faculty"),
      subjects: getSheetData(ss, "Subjects"),
      subjectfaculty: getSheetData(ss, "Subjectfaculty"),
      timetable: getSheetData(ss, "Timetable"),
      departments: getSheetData(ss, "Departments") // Optional departments sheet (returns [] if missing)
    };
    
    return createJsonResponse({ status: "success", data: responseData });
  } catch (error) {
    return createJsonResponse({ status: "error", message: error.toString() });
  }
}

// POST Handler: Saves HOD timetable entries by editing matching rows in-place, deleting cleared ones, or appending new ones
function doPost(e) {
  try {
    let requestData;
    
    // Parse post body
    if (e.postData && e.postData.contents) {
      requestData = JSON.parse(e.postData.contents);
    } else {
      throw new Error("Empty POST body received.");
    }
    
    const academicYear = requestData.academicYear;
    const semester = requestData.semester;
    const clearMode = requestData.mode || "class"; // "class" or "faculty"
    const targetId = requestData.targetId; // Class ID in class mode, Faculty Name in faculty mode
    const entries = requestData.entries; // Array of { day, period, subjectCode, subjectName, faculty, classId }
    
    if (!academicYear || !semester || !targetId || !entries) {
      throw new Error("Missing required parameters: academicYear, semester, targetId, entries");
    }
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) {
      throw new Error("Active spreadsheet not found. The script must be bound to a Google Sheet.");
    }
    
    const timetableSheet = getSheetCaseInsensitive(ss, "Timetable");
    if (!timetableSheet) {
      throw new Error("Sheet 'Timetable' not found in this spreadsheet.");
    }
    
    // 1. Read existing rows to edit in-place
    const headers = getSheetHeaders(timetableSheet);
    
    const getHeaderIndex = (list, ...keys) => {
      const lowerKeys = keys.map(k => k.toLowerCase().replace(/[\s_-]/g, ""));
      for (let i = 0; i < list.length; i++) {
        const cleanHeader = list[i].toLowerCase().replace(/[\s_-]/g, "");
        if (lowerKeys.indexOf(cleanHeader) !== -1) return i;
      }
      return -1;
    };
    
    const ayIdx = getHeaderIndex(headers, "Academic Year", "AcademicYear", "Year");
    const semIdx = getHeaderIndex(headers, "Semester", "Sem");
    const classIdx = getHeaderIndex(headers, "Class", "ClassID", "Class ID");
    const facIdx = getHeaderIndex(headers, "Faculty", "Teacher");
    const dayIdx = getHeaderIndex(headers, "Day");
    const periodIdx = getHeaderIndex(headers, "Period");
    const subjectCodeIdx = getHeaderIndex(headers, "Subject Code", "SubjectCode");
    const subjectNameIdx = getHeaderIndex(headers, "Subject Name", "SubjectName");
    
    if (ayIdx === -1 || semIdx === -1 || classIdx === -1 || facIdx === -1 || dayIdx === -1 || periodIdx === -1 || subjectCodeIdx === -1 || subjectNameIdx === -1) {
      throw new Error("Timetable sheet headers must include columns: ID, Academic Year, Semester, Class, Day, Period, Subject Code, Subject Name, Faculty");
    }
    
    let lastRow = timetableSheet.getLastRow();
    let lastCol = timetableSheet.getLastColumn();
    let existingData = [];
    if (lastRow > 1) {
      existingData = timetableSheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
    }
    
    // 2. Map and update matching rows in memory (or append new ones)
    entries.forEach(entry => {
      let matchIdx = -1;
      
      for (let i = 0; i < existingData.length; i++) {
        const row = existingData[i];
        const rowAY = String(row[ayIdx]).trim().toLowerCase();
        const rowSem = String(row[semIdx]).trim().toLowerCase();
        const rowDay = String(row[dayIdx]).trim().toLowerCase();
        const rowPeriod = String(row[periodIdx]).trim().toLowerCase();
        
        const matchAYSemDayPeriod = (rowAY === String(academicYear).trim().toLowerCase() && 
                                     rowSem === String(semester).trim().toLowerCase() &&
                                     rowDay === String(entry.day).trim().toLowerCase() &&
                                     rowPeriod === String(entry.period).trim().toLowerCase());
        
        if (matchAYSemDayPeriod) {
          if (clearMode === "class") {
            const rowClass = String(row[classIdx]).trim().toLowerCase();
            if (rowClass === String(targetId).trim().toLowerCase()) {
              matchIdx = i;
              break;
            }
          } else {
            // Teacher mode: Check if Faculty column matches targetId (teacher name)
            const rowFaculty = String(row[facIdx]).trim().toLowerCase();
            const facultyItems = rowFaculty.split(",").map(item => item.trim().toLowerCase());
            if (facultyItems.indexOf(String(targetId).trim().toLowerCase()) !== -1) {
              matchIdx = i;
              break;
            }
          }
        }
      }
      
      const isBlank = !entry.subjectCode || String(entry.subjectCode).trim() === "";
      
      if (isBlank) {
        // If cell is blank, delete the row from sheet if it exists
        if (matchIdx !== -1) {
          existingData.splice(matchIdx, 1);
        }
        // If it doesn't exist, we simply do not add it!
      } else {
        if (matchIdx !== -1) {
          // Overwrite cell values in matching row
          existingData[matchIdx][subjectCodeIdx] = entry.subjectCode;
          existingData[matchIdx][subjectNameIdx] = entry.subjectName || "";
          
          if (clearMode === "class") {
            existingData[matchIdx][facIdx] = entry.faculty || "";
          } else {
            existingData[matchIdx][classIdx] = entry.classId || "";
          }
        } else {
          // Appending a new row since slot has content and does not exist yet
          const newRow = new Array(headers.length).fill("");
          headers.forEach((header, colIdx) => {
            const cleanHeader = header.toLowerCase().replace(/[\s_-]/g, "");
            switch (cleanHeader) {
              case "id":
                newRow[colIdx] = "T-" + new Date().getTime() + "-" + Math.floor(Math.random() * 1000);
                break;
              case "academicyear":
              case "year":
                newRow[colIdx] = academicYear;
                break;
              case "semester":
              case "sem":
                newRow[colIdx] = semester;
                break;
              case "class":
              case "classid":
                newRow[colIdx] = entry.classId || (clearMode === "class" ? targetId : "");
                break;
              case "day":
                newRow[colIdx] = entry.day;
                break;
              case "period":
                newRow[colIdx] = entry.period;
                break;
              case "subjectcode":
                newRow[colIdx] = entry.subjectCode;
                break;
              case "subjectname":
                newRow[colIdx] = entry.subjectName || "";
                break;
              case "faculty":
              case "teacher":
                newRow[colIdx] = entry.faculty || (clearMode === "faculty" ? targetId : "");
                break;
            }
          });
          existingData.push(newRow);
        }
      }
    });
    
    // 3. Clear sheet and write all rows back to the sheet in a single batch
    timetableSheet.getRange(2, 1, Math.max(lastRow - 1, 1), lastCol).clearContent();
    
    if (existingData.length > 0) {
      timetableSheet.getRange(2, 1, existingData.length, timetableSheet.getLastColumn()).setValues(existingData);
    }
    
    return createJsonResponse({ status: "success", message: "Timetable updated successfully." });
  } catch (error) {
    return createJsonResponse({ status: "error", message: error.toString() });
  }
}

// Case and Space Insensitive sheet lookup helper
function getSheetCaseInsensitive(ss, name) {
  const sheets = ss.getSheets();
  const cleanTarget = String(name).toLowerCase().replace(/[\s_-]/g, "");
  
  // Try clean exact name match (ignoring spaces, case, hyphens, underscores)
  for (let sheet of sheets) {
    const cleanSheetName = sheet.getName().toLowerCase().replace(/[\s_-]/g, "");
    if (cleanSheetName === cleanTarget) {
      return sheet;
    }
  }
  
  // Singular / Plural aliases fallbacks
  const singularPluralMap = {
    "classes": "class",
    "class": "classes",
    "subjects": "subject",
    "subject": "subjects",
    "departments": "department",
    "department": "departments"
  };
  
  if (singularPluralMap[cleanTarget]) {
    const fallbackTarget = singularPluralMap[cleanTarget];
    for (let sheet of sheets) {
      const cleanSheetName = sheet.getName().toLowerCase().replace(/[\s_-]/g, "");
      if (cleanSheetName === fallbackTarget) {
        return sheet;
      }
    }
  }
  
  return null;
}

// Utility: Read sheets and convert rows to JSON objects using headers
function getSheetData(ss, sheetName) {
  if (!ss) return [];
  const sheet = getSheetCaseInsensitive(ss, sheetName);
  if (!sheet) return [];
  
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow <= 1 || lastCol === 0) return [];
  
  const headers = getSheetHeaders(sheet);
  const values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  
  return values.map(row => {
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = row[index];
    });
    return obj;
  });
}

// Utility: Get cleaned header names
function getSheetHeaders(sheet) {
  if (!sheet) return [];
  const lastCol = sheet.getLastColumn();
  if (lastCol === 0) return [];
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  return headers.map(h => String(h).trim());
}

// Case and Space Insensitive Object property lookup
function getVal(row, ...keys) {
  for (let key of keys) {
    if (row[key] !== undefined) return String(row[key]).trim();
    for (let k in row) {
      if (k.toLowerCase().trim() === key.toLowerCase().trim()) return String(row[k]).trim();
    }
  }
  return "";
}

// Utility: Standard JSON response builder
function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

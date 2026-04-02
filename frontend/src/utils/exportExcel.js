import * as XLSX from 'xlsx';

/**
 * Export data array to Excel file
 * @param {Object[]} rows - array of flat objects
 * @param {string} filename - without .xlsx extension
 * @param {string} sheetName
 */
export function exportToExcel(rows, filename, sheetName = 'Sheet1') {
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, `${filename}.xlsx`);
}

/**
 * Parse an Excel file and return array of row objects
 * @param {File} file
 * @returns {Promise<Object[]>}
 */
export function parseExcel(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const wb = XLSX.read(e.target.result, { type: 'array' });
                const ws = wb.Sheets[wb.SheetNames[0]];
                const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
                resolve(rows);
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
}

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'crm.db');
const db = new sqlite3.Database(dbPath);

const WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbzLghbWOdMCtge-OvTGRoVqluQmwsjGYFXZBjMpyIGxW_Ns7QIs3uYFVDSkdUOqJD1N/exec";

const dbRun = (sql, params = []) => new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve(this);
    });
});

async function migrate() {
    try {
        console.log("Fetching leads from Google Sheets...");
        const response = await fetch(WEBHOOK_URL, { method: 'GET' });
        const data = await response.json();
        
        const leads = data.data || [];
        if (leads.length === 0) {
            console.log("No leads found in Google Sheets.");
            return;
        }

        console.log(`Found ${leads.length} leads. Inserting into SQLite...`);
        let inserted = 0;

        for (const lead of leads) {
            const cols = Object.keys(lead).filter(k => k !== 'id');
            const placeholders = cols.map(() => '?').join(',');
            const values = cols.map(k => lead[k] !== undefined ? lead[k] : null);

            try {
                await dbRun(`INSERT INTO leads (${cols.join(',')}) VALUES (${placeholders})`, values);
                inserted++;
            } catch (err) {
                console.error("Error inserting lead:", err);
            }
        }
        console.log(`Successfully migrated ${inserted} leads!`);
    } catch (e) {
        console.error("Migration failed:", e);
    }
}

migrate();

# Service Ticket / Issue Management

This project is a complete browser-based service ticket dashboard built from the requirements in `Service Ticket _ Issue Management.pdf`.

It includes:

- Ticket creation with automatic ticket numbers
- Customer details with service-history lookup by mobile number
- Category, employee, department, and branch management
- Assignment, priority, status, and due-date tracking
- Estimate and spare-parts tracking
- Billing with automatic balance calculation
- Solution notes and device collection tracking
- Work-session time tracking with start, pause, and stop
- Internal comments and full activity history
- Local persistence with JSON import and export

## Run locally

### Option 1

Double-click `start-local.bat`

### Option 2

Run this inside the project folder:

```powershell
python -m http.server 8000
```

Then open:

[http://localhost:8000](http://localhost:8000)

## Files

- `index.html` - app layout
- `styles.css` - responsive styling
- `app.js` - all ticket logic and local persistence
- `start-local.bat` - quick local server launcher for Windows

## Notes

- Data is stored in the browser with `localStorage`
- Use `Export JSON` to back up or move data
- This version is dependency-free, so it can also be published easily with GitHub Pages

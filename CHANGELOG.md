# 🟢 Changelog — Orvia

## [1.0.4] — 2025-07-14

### ✅ Implemented
- UI improvement:
    - better animations
    - added a trapdoor for mobile access

### 🔧 In progress
- Keep fine-tuning UI:
    - Animations
    - Toast messages

### 📋 TODO
- i18n support: Chinese
- UI: dark mode support
- Exporting schedule to image or pdf


---

## [1.0.3] — 2025-06-28

### ✅ Implemented
- MAJOR UI REVAMP!!
    - Pages are now responsive!
- Optimize employee page layout
- Auto-cleanup of weekly schedules older than 12 weeks via Supabase Cron job
- Scheduling logic improvement: same worker cross-location validation
- Collapsible side navigation bar
- App-wise swr integration
- Enforce Pacific timezone in app
- Authentication auto-timeout after certain period of inactivity
- Informative dashboard which contains:
    - Current date & week on display
    - Workers on shift today
    - Workers' birthday reminders :tada:
    - This week's stats at a glance

### 🔧 In progress
- Fine-tuning UI (shadows, animations, etc.)

### 📋 TODO
- i18n support: Chinese
- UI: dark mode support


---

## [1.0.2] — 2025-06-14

### ✅ Implemented
- UI improvement: skeleton loading
- Data fetching logic improvement: swr library
- Employee personal data: refactored into 3 sections 
- *bug fix*: 404 redirect after authentication

### 🔧 In progress
- Informative dashboard
    - Current date
    - Week range display
    - Workers on shift today

### 📋 TODO
- Soft delete/database cleanup script
- Better employee page layout

---

## [1.0.1] — 2025-05-30

### ✅ Implemented
- Filter employee by location
- Confirmation dialog before regenerating schedule
- fix authentication issue on page refresh and on tab close
- *critical bug fix*: workers assignment cross-location check in scheduling logic

### 🔧 In progress
- Informative dashboard
    - Current date
    - Workers on shift today

### 📋 TODO
- Cursor loading state during system actions
- Soft delete/database cleanup script
- Add support for additional employee personal data fields (and potential layout refactoring)

---

## [1.0.0] — 2025-05-26

### ✅ Implemented
- Automatic shift generation
- Manual shift editing
- Multi-location support
- Recurring shift assignments
- User authentication

### 🛠️ TODO
- Filter employee by location
- Confirmation dialog before regenerating schedule
- Cursor loading state during system actions
- Soft delete/database cleanup script
- More dashboard content
- Add support for additional employee personal data fields (and potential layout refactoring)



---

## 🧩 Known Behaviors
- If a worker is active in multiple locations, at least one location should use recurring shifts for better load balancing
- Minor compatibility issue between a RAC component (EditEmployeeInfoModal) and the shadcn library 

## 📍 Future Enhancements
- Optional database type enforcement
- Conditional schedule generation with user prefill
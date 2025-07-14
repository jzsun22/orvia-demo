# Orvia — Smart Shift Scheduling for Multi-Location Stores (demo)

**This is a public version using fictional locations and names for demonstrating purposes.**

**Orvia** is a web-based scheduling tool built to streamline shift planning for store managers overseeing multiple locations. It automates weekly shift generation using worker availability, predefined role templates, and conflict-prevention logic — while supporting manual edits when needed.

---

## 🔑 Key Features

- **Automated Schedule Generation**  
  Create weekly shift plans based on worker availability, role requirements, and template rules.

- **Multi-Location Support**  
  Prevents scheduling conflicts across locations and adapts to store-specific staffing needs.

- **Template-Driven Shifts**  
  Define shifts by role, location, time window, and lead designation for consistency.

- **Conflict Validation**  
  Enforces one shift per worker per day, filters out inactive or soft-deleted workers, and avoids location overlaps.

- **Manual Adjustments**  
  Easily override or fine-tune schedules via a flexible UI after generation.

---

## 🛠️ Technology Overview

- **Frontend**: [Next.js](https://nextjs.org/) + TypeScript + Tailwind CSS 
  - Libraries: [Shadcn/ui](https://ui.shadcn.com/) + [Origin UI](https://originui.com/) (just a tiny bit)
- **Backend**: [Supabase](https://supabase.com/) (PostgreSQL + Edge Functions)  
- **Authentication**: Supabase Auth with Row-Level Security (RLS)  
- **Scheduling Logic**: Runs entirely in the browser using JavaScript

---

## 📦 Project Structure

```
Orvia
├── supabase/                       # Supabase function specific files
│   ├── functions/                  # Serverless functions deployed to Supabase Edge
│   ├── migrations/                                                        
│   └── import_map.json
├── src/                                                                   
│   ├── app/                                                              
│   │   ├── api/                                                           
│   │   ├── dashboard/                                                     
│   │   ├── employees/                                                     
│   │   ├── login/                                                         
│   │   └── schedule/                                                     
│   │       └── [location]/         # Dynamic route, location-specifc                                                  
│   ├── components/ 
│   │   ├── dashboard/              # Component used by dashboard page
│   │   ├── employees/              # Component used by employees page
│   │   ├── layout/                                                        
│   │   ├── modals/                 # Modal dialog components
│   │   ├── scheduling/             # Components specific to the scheduling features
│   │   ├── select/                 # Custom select/dropdown components
│   │   └── ui/                                                            
│   ├── hooks/                      # Custom React hooks for swr and state management
│   ├── lib/                                                               
│   │   ├── scheduling/             # Core logic for schedule generation and manipulation
│   │   ├── schemas/                # Data validation schemas 
│   │   ├── supabase/               # Supabase client    
│   │   ├── supabase.ts             # Supabase helper functions
│   │   ├── toast-service.ts
│   │   ├── types.ts
│   │   └── utils.ts
│   ├── styles/                                                            
│   ├── types/  
│   └── middleware.ts                                                           
└── public/                         # Static assets
``` 

---

## 👀 Status

Orvia is currently in its MVP phase with active development. Though tailored for a specific operational context, it is architected for future scalability and broader applications in workforce scheduling.

---

## 📬 Contact

Created by [**Jocelyn**](https://jzsun.me) — UX/Product Designer & Indie Developer.  
For questions or feedback, connect via [LinkedIn](https://www.linkedin.com/in/jzsun2).

---

And last but not least --

## 🙌 Thanks To
- Cursor for making coding possible, Gemini for doing all the dirty work, and ChatGPT for writing all the long docs I didn’t want to write  
- 👑 and 🍉 for being my honest reviewers and testers  
- 🌻 for being my inspiration  
- My neo ergo for putting up with my typing force  
- And myself, for actually putting this together ✨

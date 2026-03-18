# RMPL OPM

A Vite + React + TypeScript app using shadcn/ui components, deployed to Azure Static Web Apps.

## Tech Stack
- **Frontend:** React, TypeScript, Vite, Tailwind CSS, shadcn/ui (Radix UI)
- **Backend:** Supabase (database, auth, edge functions)
- **Deployment:** Azure Static Web Apps (deploys from `main` branch)

## Commands
- `npm run build` — production build
- `npm run lint` — run ESLint
- `npm run dev` — local dev server

## Code Standards
- Use TypeScript for all new code
- Follow existing ESLint configuration
- Use shadcn/ui components where possible
- All changes must pass `npm run build` before committing

## Branch Strategy
- `main` — production branch (triggers Azure deployment)
- `master` — development branch
- Always merge to `main` for production releases

## Issue Resolution Guidelines
- Read relevant source files before making changes
- Keep changes minimal and focused
- Ensure `npm run build` passes
- Create a PR targeting `main` with a clear description

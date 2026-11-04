# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

A single self-hosting user tracking their own nutrition daily. Mostly on a phone as an installed PWA; the desktop dashboard is used too. The main phone job is logging what was just eaten, quickly. An AI agent can also log food and weight through the agent API, so the app shows entries the user did not type themselves.

## Product Purpose

Track food, macros, micronutrients, water, caffeine, alcohol, supplements and body composition against personal targets. Success on the phone: logging a meal takes seconds and the day's standing is obvious at a glance.

## Positioning

Self-hosted and agent-first: anything can be logged by hand (search, Swiss barcode scan, recents) or by an AI agent from natural language, into one personal record with no ads, accounts elsewhere or paywalls.

## Operating Context

- Logging happens right after eating, often one-handed, on the phone.
- Swiss products: barcodes resolve through a local DB, Open Food Facts (Swiss first) and USDA; shop counter labels are not products.
- Foods come from a curated Swiss food database, Open Food Facts, USDA, the user's own foods, and the agent.
- Days are Swiss formatted (Sat 25 Oct), grams and millilitres.

## Capabilities and Constraints

- Next.js 16 + React 19 + Tailwind 4 frontend, FastAPI backend; PWA.
- Log by search, barcode camera, recents (one tap repeat), named servings, copy a meal to another day.
- Tracked nutrients: any nutrient except calories can be hidden in Settings.
- The agent API contracts must not change (additive changes only).

## Brand Commitments

- Dark theme stays.
- Name: NutriPilot.

## Evidence on Hand

The demo login (demo@nutripilot.dev) is filled by app/demo_daily.py with generated meals every day (no gaps), so streaks and history there are not real; README screenshots in docs/screenshots/ are taken from it. No testimonials or users beyond the owner.

## Product Principles

1. Logging speed beats completeness: the common path is the shortest.
2. Planned, organised screens: every element has a deliberate place and size; nothing reads as a clump.
3. Its own identity, never a generic fitness template.
4. Numbers are trustworthy and easy to read; what is left today is never ambiguous.

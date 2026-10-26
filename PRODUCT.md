# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

One owner (self-hosted), living in Switzerland, tracking his own nutrition daily. Mostly on an Android phone as an installed PWA; the desktop dashboard is used too. The main phone job is logging what he just ate, quickly. An AI agent (Seyoung) also logs food and weight through the agent API, so the app shows entries he did not type himself.

## Product Purpose

Track food, macros, micronutrients, water, caffeine, alcohol, supplements and body composition against personal targets. Success on the phone: logging a meal takes seconds and the day's standing is obvious at a glance.

## Positioning

Self-hosted and agent-first: anything can be logged by hand (search, Swiss barcode scan, recents) or by an AI agent from natural language, into one personal record with no ads, accounts elsewhere or paywalls.

## Operating Context

- Logging happens right after eating, often one-handed, on the phone.
- Swiss products: barcodes resolve through a local DB, Open Food Facts (Swiss first) and USDA; shop counter labels are not products.
- Foods come from a curated Swiss food database, Open Food Facts, USDA, the owner's own foods, and the agent.
- Days are Swiss formatted (Sat 25 Oct), grams and millilitres.

## Capabilities and Constraints

- Next.js 16 + React 19 + Tailwind 4 frontend, FastAPI backend; PWA.
- Log by search, barcode camera, recents (one tap repeat), named servings, copy a meal to another day.
- Tracked nutrients: any nutrient except calories can be hidden in Settings.
- The agent API contracts must not change (additive changes only).

## Brand Commitments

- Dark theme stays (owner, 2026-10-25).
- Name: NutriPilot.

## Evidence on Hand

Real daily data in the owner's own account. The demo login is filled by app/demo_daily.py with generated meals every day (no gaps), so streaks and history there are not real; use it for testing only. README screenshots in docs/screenshots/. No testimonials or users beyond the owner.

## Product Principles

1. Logging speed beats completeness: the common path is the shortest.
2. Planned, organised screens: every element has a deliberate place and size; nothing reads as a clump.
3. Its own identity, never a generic fitness template.
4. Numbers are trustworthy and easy to read; what is left today is never ambiguous.

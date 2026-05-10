# Product: Intelligent Inventory Dashboard

## Overview
A web-based dashboard for dealership managers to get a real-time overview of their vehicle stock. Part of the Keyloop Technical Assessment (Scenario B: Supply domain).

## Core Features
1. **Inventory Visualization** — Filterable list of all vehicles in a dealership's inventory (filter by make, model, age)
2. **Aging Stock Identification** — Automatically flags vehicles in inventory for >90 days with prominent visual treatment
3. **Actionable Insights** — Managers can log and persist a status/proposed action for each aging vehicle (e.g., "Price Reduction Planned")

## Target User
Dealership managers who need to monitor stock levels, identify slow-moving inventory, and take action on aging vehicles.

## Assumptions
- Single dealership scope (no multi-tenancy in MVP)
- "Age" is calculated from the date the vehicle was added to inventory
- Aging threshold is exactly 90 days (vehicles on day 91+ are considered aging)
- Actions/statuses are free-text or predefined options logged with a timestamp
- No authentication required for MVP

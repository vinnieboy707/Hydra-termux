# Intelligence Indicator Toolkit

This toolkit provides modular tools for discovering, validating, and scoring property distress indicators.

## 1. Indicator Scrapers
- `CountyTaxRegistryScraper`: Connects to county-level tax lien and delinquency registries.
- `UtilityUsageTracker`: Monitors for abnormal utility consumption (high/zero usage) indicating potential vacancy.
- `ListingHistoryAnalyzer`: Tracks listing stagnation, price cuts, and listing cancellations.

## 2. Searchable Databases
- `inmate_list`: Correlates with incarceration records (via `inmateService`).
- `obituary_records`: Correlates with death records for estate-related abandonment.
- `interaction_logs`: Persistent audit trail for all system actions.

## 3. Usage
To integrate a new indicator, create a new adapter in `services/adapters/` that implements the `fetchIndicators()` interface and add it to the `correlator` scoring model.

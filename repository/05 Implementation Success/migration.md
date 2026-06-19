# Ledger & Compliance Migration Playbook

## 1. Pre-Migration Checklist
*   Export trial balance, vendor ledgers, customer ledgers, and inventory balances from old software.
*   Ensure all bank statement data is complete up to the cutoff date.
*   Review open purchase orders and sales orders.

## 2. Extraction Templates
*   Use the standard HostBooks CSV/Excel templates for:
    *   Chart of Accounts Master
    *   Vendor & Customer Master (with GSTINs, PAN, bank details)
    *   Inventory Item Master (with HSN codes, UOM, tax rates)
    *   Opening Balances Ledger

## 3. Data Ingestion & Validation
*   Run the Migration Wizard tool to import spreadsheets.
*   Validate Trial Balance totals on HostBooks against the source system.
*   *Critical Step:* Cross-check GST ITC opening balance with the government portal dashboard.

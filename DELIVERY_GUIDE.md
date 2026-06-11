# Fixed Asset Manager Delivery Guide

This package is a local single-computer fixed asset management tool for `1-2` admins.

## What to send

Send this zip file directly:

- `fixed-asset-manager-delivery.zip`

## Requirement

The recipient needs:

- Node.js `20+`

## How to run

### macOS

1. Unzip `fixed-asset-manager-delivery.zip`
2. Double-click `START_FIXED_ASSET_SYSTEM.command`
3. On first run it will install dependencies automatically
4. The browser will open `http://127.0.0.1:8899`

### Windows

1. Unzip `fixed-asset-manager-delivery.zip`
2. Double-click `START_FIXED_ASSET_SYSTEM.bat`
3. On first run it will install dependencies automatically
4. The browser will open `http://127.0.0.1:8899`

## Data location

- Database file: `data/fixed-assets.sqlite`

## Import templates

- `public/templates/assets-template.csv`
- `public/templates/employees-template.csv`

## Notes

- This is a local single-machine edition, not a multi-user online deployment
- Data does not sync automatically between computers
- To migrate data, copy `data/fixed-assets.sqlite` to the new machine

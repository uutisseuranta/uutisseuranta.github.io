#!/usr/bin/env python3
"""
validate_decision_log.py - Validates DECISION_LOG.csv for structure, unique IDs, and dates.
"""
import sys
import csv
import re
from pathlib import Path

EXPECTED_HEADER = ["id", "date", "timestamp", "title", "decision", "rationale", "affects_issues"]
DATE_REGEX = re.compile(r"^\d{4}-\d{2}-\d{2}$")
TIMESTAMP_REGEX = re.compile(r"^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}$")
ID_REGEX = re.compile(r"^[GL]-\d{3}$")

def validate_decision_log(csv_path: Path) -> int:
    if not csv_path.exists():
        print(f"❌ Error: {csv_path} does not exist.", file=sys.stderr)
        return 1

    errors = []
    ids_seen = set()
    
    with open(csv_path, mode="r", encoding="utf-8", newline="") as f:
        reader = csv.reader(f)
        try:
            header = next(reader)
        except StopIteration:
            print(f"❌ Error: {csv_path} is empty.", file=sys.stderr)
            return 1

        # Check Header
        if header != EXPECTED_HEADER:
            errors.append(f"Header mismatch. Expected: {EXPECTED_HEADER}, Found: {header}")

        # Check Rows
        for line_num, row in enumerate(reader, start=2):
            if not row or not any(field.strip() for field in row):
                continue  # skip empty lines

            if len(row) != len(EXPECTED_HEADER):
                errors.append(f"Line {line_num}: Column count is {len(row)}, expected {len(EXPECTED_HEADER)}.")
                continue

            dec_id, dec_date, dec_ts, title, decision, rationale, affects = [c.strip() for c in row]

            # Check ID format and uniqueness
            if not ID_REGEX.match(dec_id):
                errors.append(f"Line {line_num}: Invalid ID format '{dec_id}'. Expected 'G-xxx' or 'L-xxx'.")
            elif dec_id in ids_seen:
                errors.append(f"Line {line_num}: Duplicate ID '{dec_id}'.")
            else:
                ids_seen.add(dec_id)

            # Check Date format
            if not DATE_REGEX.match(dec_date):
                errors.append(f"Line {line_num}: Invalid date format '{dec_date}'. Expected 'YYYY-MM-DD'.")

            # Check Timestamp format
            if not TIMESTAMP_REGEX.match(dec_ts):
                errors.append(f"Line {line_num}: Invalid timestamp format '{dec_ts}'. Expected 'YYYY-MM-DD HH:MM:SS'.")

            # Check non-empty contents
            if not title:
                errors.append(f"Line {line_num}: 'title' is empty.")
            if not decision:
                errors.append(f"Line {line_num}: 'decision' is empty.")
            if not rationale:
                errors.append(f"Line {line_num}: 'rationale' is empty.")

    if errors:
        print(f"❌ DECISION_LOG validation failed ({len(errors)} errors):", file=sys.stderr)
        for err in errors:
            print(f"  - {err}", file=sys.stderr)
        return 1

    print(f"✅ DECISION_LOG.csv is valid ({len(ids_seen)} decisions checked).")
    return 0

if __name__ == "__main__":
    repo_root = Path(__file__).resolve().parent.parent.parent.parent.parent
    target_csv = repo_root / "DECISION_LOG.csv"
    if len(sys.argv) > 1:
        target_csv = Path(sys.argv[1])
    sys.exit(validate_decision_log(target_csv))

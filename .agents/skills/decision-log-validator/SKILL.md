---
name: decision-log-validator
description: Validates DECISION_LOG.csv for header format, ID uniqueness, and date formatting using a deterministic Python script. Use whenever DECISION_LOG.csv is modified or before committing changes.
---

# Decision Log Validator

This skill provides fast, deterministic validation of `DECISION_LOG.csv` to ensure structural integrity and compliance with Decision G-005 without consuming LLM reasoning tokens.

## When to Use
- Whenever `DECISION_LOG.csv` is updated with a new decision (`G-xxx` or `L-xxx`).
- Before creating a pull request or committing changes affecting decisions.

## How to Execute
Run the Python script directly in the sandbox:
```bash
python3 .agents/skills/decision-log-validator/scripts/validate_decision_log.py
```

## Expected Behavior
- Returns exit code `0` if all headers, IDs, timestamps, and fields are valid.
- Returns exit code `1` with exact line numbers and error descriptions if invalid.

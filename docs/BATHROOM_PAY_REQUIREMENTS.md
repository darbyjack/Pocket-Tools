# Bathroom Pay Reference Mini App

## Purpose

Bathroom Pay tracks time spent on bathroom trips during paid work and calculates a gross pay equivalent for that elapsed time. It is the first complete proof that Pocket Tools can express a useful persistent utility entirely as a mini-app script.

The calculation is informational and must not be described as net pay, additional compensation, timecard advice, or a legal entitlement.

## Pay modes

### Hourly

```text
effective hourly rate = configured hourly gross rate
```

### Salary

```text
effective hourly rate =
  annual gross salary / (paid hours per week × paid weeks per year)
```

The app must reject or safely handle zero and invalid divisors.

### Trip earnings

```text
gross earnings equivalent =
  duration in seconds / 3,600 × effective hourly rate
```

The effective hourly rate used for a completed trip is stored with that trip so later setting changes do not rewrite historical values.

## Settings

- Pay type: hourly or salary
- Hourly gross rate
- Annual gross salary
- Paid hours per week
- Paid weeks per year

Salary-only and hourly-only settings are conditionally visible.

## Trip record

Each completed trip stores:

- Host-generated record ID
- Start timestamp
- End timestamp
- Duration in seconds
- Effective hourly rate at completion
- Gross earnings equivalent
- Optional notes
- Host-generated creation and update timestamps

## Required behavior

- Start one active bathroom-trip timer.
- Display elapsed duration and live gross equivalent.
- End the active timer and create one durable trip record.
- Recover an active trip after navigation, process death, relaunch, and device reboot.
- Add a trip manually from start and end timestamps.
- Edit and delete individual records.
- Show today, current week, current month, current year, and all-time totals.
- Show recent history in reverse chronological order.
- Export records as JSON and CSV after capability approval.
- Clear data only after explicit confirmation.

## Date boundaries

- Day boundaries use the device's current local timezone.
- Weeks start Monday.
- Stored timestamps use ISO 8601 UTC representations.
- Display formatting is host-owned and follows the device locale.

## Timer rules

- Only one `currentTrip` timer may be active for this mini app.
- Starting while already active must not create a second timer.
- Stopping an absent timer produces a structured error.
- A timer runs from host timestamps; the script is not kept alive.
- Clock-change and reboot behavior must be covered by host timer tests.

## Export rules

JSON exports complete records in a documented stable shape. CSV escapes quotes, includes a header row, and uses raw ISO timestamps and numeric values to remain portable.

## Acceptance criteria

The reference script is complete when it:

1. Installs through the ordinary paste-and-preview flow.
2. Uses only the public SDK.
3. Contains no host-specific imports or Bathroom Pay host code.
4. Persists settings, records, and active timer state correctly.
5. Passes embedded tests and host end-to-end tests.
6. Can be exported, removed, and restored with its data.

# Bathroom Pay Reference Mini App

## Purpose

Bathroom Pay tracks time spent on bathroom trips during paid work and calculates a gross pay equivalent for that elapsed time. It is the first proof that Pocket Tools can run a useful persistent utility entirely as a mini-app script.

The calculation is informational and is not net pay, additional compensation, timecard advice, or a legal entitlement.

## Pay calculations

Hourly mode uses the configured hourly gross rate.

Salary mode uses:

```text
effective hourly rate =
  annual gross salary / (paid hours per week × paid weeks per year)
```

Trip value uses:

```text
gross earnings equivalent =
  duration in seconds / 3,600 × effective hourly rate
```

The effective rate is stored with a completed trip so later settings do not rewrite history.

## Current working slice

- Configure hourly or salary pay.
- Start one active bathroom timer.
- Display elapsed duration and live gross equivalent.
- Stop the timer and create one durable record.
- Recover the active timer after process termination and relaunch.
- Show stored trips and today's trip, duration, and gross-equivalent totals.
- Execute all business logic through the public SDK and QuickJS-NG boundary.

## Trip record

Each completed trip stores:

- Host-generated record ID
- Start timestamp
- End timestamp
- Duration in seconds
- Effective hourly rate at completion
- Gross earnings equivalent
- Host-generated creation and update timestamps

## Date and timer rules

- Day boundaries use the device's current local timezone.
- Stored timestamps use ISO 8601 UTC values.
- Only one `currentTrip` timer may be active.
- Starting an active timer fails rather than creating a second timer.
- Stopping an absent timer fails.
- A running timer does not keep QuickJS or the application process alive.

## Later layers

After this slice is proven on Android, later tickets may add:

- Manual entries and notes
- Edit and delete
- Week, month, year, and all-time summaries
- JSON and CSV export
- Confirmed data clearing
- Backup and restore

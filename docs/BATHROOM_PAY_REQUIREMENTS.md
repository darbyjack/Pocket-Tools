# Bathroom Pay Reference Mini App

## Purpose

Bathroom Pay tracks time spent on bathroom trips during paid work and calculates a gross pay equivalent for that elapsed time. It is the first proof that Pocket Tools can express a useful persistent utility entirely as a mini-app script.

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

The app must safely handle zero or invalid divisors.

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
- Host-generated creation and update timestamps

## First working slice

The first Android slice must:

- Configure hourly or salary pay.
- Start one active bathroom timer.
- Display elapsed duration and live gross equivalent.
- Stop the timer and create one durable trip record.
- Recover the active trip after the app process is restarted.
- Show stored trips and today's totals.
- Run entirely through the public SDK and QuickJS boundary.

The SDK must not expand until this slice works end to end.

## Later Bathroom Pay layers

After the first slice works, add these requirements one layer at a time:

- Manual trip entry
- Notes
- Edit and delete individual records
- Current week, current month, current year, and all-time totals
- JSON and CSV export
- Explicitly confirmed data clearing
- Backup and restore

These are product requirements, but they do not justify placeholder APIs before their implementation ticket begins.

## Date boundaries

- Day boundaries use the device's current local timezone.
- Weeks start Monday.
- Stored timestamps use ISO 8601 UTC representations.
- Display formatting is host-owned and follows the device locale.

## Timer rules

- Only one `currentTrip` timer may be active for this mini app.
- Starting while already active must not create a second timer.
- Stopping an absent timer produces a structured error.
- The timer uses host timestamps; the script is not kept alive.

## Current pull-request acceptance

The reference script in this pull request is accepted when it:

1. Uses only the public SDK.
2. Contains no host-specific imports or privileged Bathroom Pay code.
3. Type-checks with strict JavaScript checking.
4. Passes definition validation.
5. Exercises only APIs justified by the first Bathroom Pay slice.

Runtime persistence and Android end-to-end behavior belong to the next working-slice pull request.

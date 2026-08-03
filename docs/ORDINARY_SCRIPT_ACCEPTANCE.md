# Ordinary Agent-Script Acceptance

This procedure proves that the existing Bathroom Pay source works as an ordinary SDK v1 script through the same published workflow available to any agent-authored mini app. It does not add Bathroom Pay behavior to the host or require rebuilding Pocket Tools after the initial development build is installed.

Tracker: [#10](https://github.com/darbyjack/Pocket-Tools/issues/10)

## Verification status

- Procedure prepared: complete
- Static host-specific branch audit: pending local checkout
- `pnpm check`: pending local checkout
- SDK v1 validation and inspection: pending local checkout
- Physical Android acceptance: pending physical device

Do not mark this acceptance complete until the command results, Android device details, and observed outcomes are recorded in this document or the pull request.

## Authority and source boundary

The acceptance participant starts with only:

1. [`AGENT_AUTHORING.md`](AGENT_AUTHORING.md), the canonical SDK v1 authoring entry point.
2. [`bathroom-pay.miniapp.js`](../examples/bathroom-pay.miniapp.js), the existing ordinary script source.

Do not change SDK v1, add another example, add a host hook, or rebuild the host to apply any source change during the Android procedure.

## 1. Repository checks

From the repository root:

```bash
corepack enable
pnpm install
pnpm check
```

Record the exact result before beginning Android validation.

## 2. Validate and inspect the source

Run both human-readable commands:

```bash
pnpm validate:mini-app ./examples/bathroom-pay.miniapp.js
pnpm inspect:mini-app ./examples/bathroom-pay.miniapp.js
```

Also retain machine-readable output when practical:

```bash
pnpm mini-app validate ./examples/bathroom-pay.miniapp.js --json
pnpm mini-app inspect ./examples/bathroom-pay.miniapp.js --json
```

The commands must exit successfully. Inspection must identify:

- Manifest: `bathroom-pay`, `Bathroom Pay`, SDK version `1`
- Settings: `payType`, `hourlyRate`, `annualSalary`, `hoursPerWeek`, `weeksPerYear`
- Collection: `trips`
- Screens: `home`, `history`, `settings`
- Actions: `startTrip`, `endTrip`

## 3. Audit host independence

The host must not contain Bathroom Pay-specific runtime, renderer, storage, navigation, or action branches. Run:

```bash
git grep -n -I -E 'bathroom-pay|Bathroom Pay|currentTrip|grossEarnings|effectiveHourlyRate' -- \
  apps/mobile/App.tsx apps/mobile/src modules packages \
  ':(exclude)apps/mobile/src/generated/bundled-mini-apps.json'
```

The command must return no matches. The generated bundled catalog is excluded because it contains the source text used only for one-time installation seeding.

Then review all remaining references:

```bash
git grep -n -I -E 'bathroom-pay|Bathroom Pay|currentTrip|grossEarnings|effectiveHourlyRate'
```

Every match must be limited to the ordinary script, its generated seed copy, documentation, or acceptance evidence. Any occurrence that changes host behavior for Bathroom Pay fails this acceptance.

## 4. Prepare the ordinary installer path

Use a physical Android device with the current development build installed.

1. Launch Pocket Tools and record the device model and Android version.
2. If the one-time seeded **Bathroom Pay** installation is present, choose **Remove** and then **Remove app and data**.
3. Confirm Bathroom Pay disappears from the library.
4. Do not rebuild, reinstall, clear app data, or regenerate the bundled catalog after this point.
5. Copy the exact contents of `examples/bathroom-pay.miniapp.js` for pasting into the Android editor.

PowerShell clipboard helper:

```powershell
Get-Content -Raw .\examples\bathroom-pay.miniapp.js | Set-Clipboard
```

## 5. Paste, preview, and install

1. Choose **Add script**.
2. Paste the exact Bathroom Pay source.
3. Choose **Validate**.
4. Confirm the editor reports a valid SDK v1 definition for `Bathroom Pay (bathroom-pay)`.
5. Choose **Preview**.
6. Confirm **Isolated preview** reaches **First render passed**.
7. Confirm the preview shows the timer, gross-equivalent live metric, today's summary, **History**, and **Pay settings** navigation.
8. Choose **Install app**.
9. Confirm the installed app opens without rebuilding the host.

## 6. Exercise settings, navigation, timer, records, and summaries

### Hourly settings

1. Open **Pay settings**.
2. Confirm **Hourly rate** is visible while the salary fields are hidden.
3. Set a recognizable hourly rate, such as `3600`, and return to the timer.
4. Navigate to **History** and back before starting a timer; confirm no state changes and the empty history remains available.

### Durable timer and live metric

1. Choose **Start trip**.
2. Confirm the timer advances and the gross-equivalent metric updates live.
3. Navigate to **History**, then **Pay settings**, then back to the timer.
4. Confirm the same timer remains active and elapsed time was not reset.

### Force-stop and relaunch

While the timer is still active:

```bash
adb shell am force-stop com.darbyjack.pockettools
adb shell pidof com.darbyjack.pockettools
```

The `pidof` command must print no PID.

1. Leave the application stopped long enough for the elapsed time to increase observably.
2. Reopen Pocket Tools manually.
3. Open Bathroom Pay.
4. Confirm the timer includes the force-stopped interval and the live metric resumes from reconstructed elapsed time.
5. Choose **End trip**.
6. Confirm today's summary shows one additional trip, nonzero elapsed time, and a nonzero gross equivalent.
7. Open **History** and confirm the completed trip record is present.

### Salary settings

1. Open **Pay settings** and switch **Pay type** to **Salary**.
2. Confirm **Annual gross salary**, **Paid hours per week**, and **Paid weeks per year** are visible while **Hourly rate** is hidden.
3. Enter recognizable valid values, return to the timer, start another trip, and confirm the live metric advances.
4. End the trip and confirm history and today's summaries include both records.
5. Navigate to the library and reopen Bathroom Pay; confirm settings, records, and summaries remain intact.

## 7. Apply a valid source update

1. Choose **Edit** for the installed Bathroom Pay app.
2. Change only this home-screen copy:

```text
Track a trip with a host-managed timer that remains correct after the app closes.
```

To:

```text
Acceptance update active. The host-managed timer still uses the ordinary script path.
```

3. Keep `manifest.id` as `bathroom-pay` and do not change settings, collection, or timer identifiers.
4. Choose **Validate**, then **Preview**.
5. Confirm the updated copy renders and existing settings, records, summaries, and any active timer are present in the isolated preview.
6. Choose **Update installed app**.
7. Confirm the updated copy is active and persisted app data is unchanged.
8. Confirm **Roll back** is now available.

No host rebuild is permitted during this update.

## 8. Reject a failed source update

1. Choose **Edit** again.
2. Change the History navigation target from `screen: "history"` to `screen: "missingScreen"`.
3. Choose **Validate** and **Preview** as far as the editor permits.
4. Confirm the candidate is rejected and **Update installed app** never becomes enabled for the invalid current source.
5. Choose **Cancel**.
6. Reopen Bathroom Pay and confirm the valid acceptance-update copy is still active.
7. Confirm settings, records, summaries, and timer state were not changed.
8. Confirm **Roll back** remains available, proving the failed candidate did not replace either stored source.

A validation failure or preview/first-render failure is acceptable; persistence of the candidate is not.

## 9. Roll back, export, and remove

### Rollback

1. Choose **Roll back** and confirm the prompt.
2. Confirm the original home-screen copy is active again.
3. Confirm settings, records, summaries, and timers are unchanged.

### Export

1. Choose **Export**.
2. Confirm the Android share sheet opens with the active source as text.
3. If the Android chooser surfaces the supplied share title, confirm it is `Bathroom Pay.miniapp.js`.
4. Confirm the exported source contains `id: "bathroom-pay"` and the original home-screen copy.

### Removal

1. Return to the library and choose **Remove**.
2. Choose **Remove app and data**.
3. Confirm Bathroom Pay disappears from the library immediately.
4. Relaunch Pocket Tools and confirm it remains absent.
5. Confirm the host still opens and other installed scripts remain usable.

No rebuild, reinstall, or application-data reset is permitted for rollback, export, or removal.

## 10. Record observed results

Complete this section only from actual command and physical-device observations.

- Date:
- Commit:
- Device:
- Android version:
- `pnpm check`:
- `validate:mini-app`:
- `inspect:mini-app`:
- Host-specific branch audit:
- Paste/validate/preview/install:
- Hourly settings and visibility:
- Salary settings and visibility:
- Live timer and metric:
- Navigation stability:
- Force-stop `pidof` result:
- Relaunch timer recovery:
- Records and summaries:
- Valid source update:
- Failed source update preservation:
- Rollback:
- Export:
- Removal and relaunch:
- Unexpected behavior:

Issue #10 may close only when every required result above is recorded as passed or an identified defect has been resolved and retested.

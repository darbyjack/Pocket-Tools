# Lifecycle and Namespace Diagnostics

Pocket Tools includes host-owned Android diagnostics for repeatable verification of namespace isolation, failure recovery, deletion behavior, and process-death timer recovery.

Open **Settings → Advanced → Diagnostics**.

The diagnostics use temporary ordinary scripts and the production QuickJS, validation, installed-source, and SQLite paths. They do not add public SDK capability or privileged tool behavior.

## Isolation and recovery suite

**Run isolation and recovery suite**:

1. installs two temporary tools with different manifest IDs
2. gives them colliding setting, collection, field, screen, action, and timer names
3. writes distinct state under each namespace
4. proves each tool reads only its own settings, records, and timer
5. renders multiple screens and proves navigation is non-mutating
6. runs an intentionally failed action
7. proves the failed invocation persisted nothing
8. runs a valid action immediately afterward
9. removes and reinstalls one tool with retained ordinary data
10. removes the tool with data and proves the namespace is empty
11. cleans all temporary installations and state

The screen reports independent results for namespace isolation, navigation stability, failed-invocation recovery, and removal semantics.

## Force-stop timer recovery

This is a two-launch procedure because an in-process test cannot prove process death.

1. Press **Prepare force-stop test**.
2. Record the prepared checkpoint.
3. Force-stop Pocket Tools:

   ```bash
   adb shell am force-stop com.darbyjack.pockettools
   ```

4. Confirm no process remains:

   ```bash
   adb shell pidof com.darbyjack.pockettools
   ```

   The command must print no PID.

5. Wait long enough for elapsed time to change.
6. Reopen Pocket Tools.
7. Return to Diagnostics and press **Resume after relaunch**.

The resumed diagnostic verifies a new host-launch token, the exact persisted timer start timestamp, elapsed time including process absence, agreement with the host clock, and normal timer stop behavior.

The timer is reconstructed from host-owned UTC state. No QuickJS context or background JavaScript remains alive.

## Cleanup

Diagnostic manifest IDs use the reserved `lifecycle-diagnostic-` prefix and are hidden from the normal library. User tools cannot claim that prefix.

Startup removes abandoned diagnostic state while preserving the one installation referenced by an active force-stop checkpoint. **Reset diagnostics** removes the checkpoint and its temporary namespace.

## Repository and Android validation

```bash
pnpm check
pnpm --dir apps/mobile exec expo prebuild --platform android --clean --no-install
cd apps/mobile/android
./gradlew :app:assembleDebug connectedDebugAndroidTest --max-workers=4
```

Repository tests cover elapsed-time reconstruction, reserved namespace rejection, cleanup rules, and executable diagnostic fixtures. They do not replace the physical `pidof` observation.

Record actual device results in the pull request or release record rather than editing this maintained procedure into an implementation diary.
